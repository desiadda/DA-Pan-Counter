import { collection, doc, setDoc, addDoc, getDocs, getDoc, runTransaction } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";
import { logError } from "./errorLog";
import { getLocalData, setLocalData } from "./storage";
import { logAudit } from "./audit";
import { DEFAULT_PACK_SIZE } from "../constants";

const LS_KEY = "pan_purchase_orders";

async function syncPurchaseToFirebase(order) {
  const { id, ...data } = order;
  if (id) {
    await setDoc(doc(db, "purchases", id), data);
  } else {
    const ref = await addDoc(collection(db, "purchases"), data);
    order.id = ref.id;
  }
}

export const getPurchaseOrders = async () => {
  try {
    if (isFirebaseEnabled) {
      const snap = await getDocs(collection(db, "purchases"));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    return getLocalData(LS_KEY, []);
  } catch (err) {
    logError("PURCHASE", err.message, err.stack);
    return getLocalData(LS_KEY, []);
  }
};

export const savePurchaseOrder = async (order) => {
  try {
    if (isFirebaseEnabled) {
      await runTransaction(db, async (firestoreTx) => {
        let finalId = order.id;
        if (!finalId) {
          const newDocRef = doc(collection(db, "purchases"));
          finalId = newDocRef.id;
          order.id = finalId;
        }

        const docRef = doc(db, "purchases", finalId);

        // --- READ PHASE ---

        // A. Read all product states if receiving
        const prodDataList = [];
        if (order.status === "received" && !order.receivedAt) {
          for (const item of order.items) {
            const prodRef = doc(db, "products", item.productId);
            const prodSnap = await firestoreTx.get(prodRef);
            prodDataList.push({ item, prodRef, prodSnap });
          }
        }

        // B. Read supplier state if Credit and receiving
        let supRef = null;
        let supSnap = null;
        if (order.status === "received" && !order.receivedAt && order.paymentMode === "Credit" && order.supplierId) {
          supRef = doc(db, "suppliers", order.supplierId);
          supSnap = await firestoreTx.get(supRef);
        }

        // C. Read cashier COH state if Cash and receiving
        let balRef = null;
        let balSnap = null;
        if (order.status === "received" && !order.receivedAt && order.paymentMode === "Cash" && order.createdById) {
          balRef = doc(db, "coh_balances", order.createdById);
          balSnap = await firestoreTx.get(balRef);
        }

        // --- WRITE PHASE ---
        
        if (order.status === "received" && !order.receivedAt) {
          order.receivedAt = Date.now();
          for (const { item, prodRef, prodSnap } of prodDataList) {
            if (prodSnap.exists()) {
              const prod = prodSnap.data();
              const unitCost = item.isPack ? (item.costPrice / (item.packSize || prod.packSize || DEFAULT_PACK_SIZE)) : item.costPrice;
              const unitQty = item.isPack ? item.quantity * (item.packSize || prod.packSize || DEFAULT_PACK_SIZE) : item.quantity;

              const newBatch = {
                id: "b_po_" + finalId + "_" + Math.random().toString(36).substring(2),
                costPrice: unitCost,
                quantity: unitQty,
                createdAt: Date.now()
              };

              const updatedBatches = [...(prod.batches || []), newBatch];
              const newStock = (prod.stock || 0) + unitQty;

              const updates: any = {
                batches: updatedBatches,
                stock: newStock,
                costPrice: unitCost,
              };

              if (prod.isCigarette) {
                if (item.isPack) {
                  updates.costPricePack = item.costPrice;
                  updates.stockPack = Math.floor(newStock / (item.packSize || prod.packSize || DEFAULT_PACK_SIZE));
                  updates.stockLoose = newStock % (item.packSize || prod.packSize || DEFAULT_PACK_SIZE);
                } else {
                  updates.stockPack = Math.floor(newStock / (prod.packSize || DEFAULT_PACK_SIZE));
                  updates.stockLoose = newStock % (prod.packSize || DEFAULT_PACK_SIZE);
                }
              }

              firestoreTx.update(prodRef, updates);
            }
          }

          // Supplier balance and COH integrations
          if (order.paymentMode === "Credit" && supRef && supSnap && supSnap.exists()) {
            const supData = supSnap.data();
            const currentBal = supData.balance || 0;
            const currentLedger = supData.ledger || [];
            const newBal = currentBal + order.total;
            const newLedger = [...currentLedger, {
              date: Date.now(),
              type: "Purchase",
              amount: order.total,
              referenceId: finalId,
              description: `Purchase Invoice: ${finalId}`
            }];
            firestoreTx.update(supRef, { balance: newBal, ledger: newLedger });
          } else if (order.paymentMode === "Cash" && balRef && balSnap) {
            const currentCoh = balSnap.exists() ? (balSnap.data().balance || 0) : 0;
            const newCoh = currentCoh - order.total;

            const cohTxId = "coh_" + Date.now();
            const cohTxRef = doc(db, "coh_transactions", cohTxId);

            firestoreTx.set(balRef, { balance: newCoh });
            firestoreTx.set(cohTxRef, {
              id: cohTxId,
              type: "expense",
              fromUserId: order.createdById,
              fromUserName: order.createdBy || "System",
              toUserId: "supplier_" + (order.supplierId || ""),
              toUserName: order.supplier,
              amount: order.total,
              sign: "debit",
              note: `Direct Cash Purchase: ${order.supplier}`,
              status: "approved",
              performedBy: order.createdBy || "System",
              timestamp: Date.now(),
              approvedAt: Date.now(),
            });
          }
        }

        const { id, ...orderData } = order;
        firestoreTx.set(docRef, orderData);
      });
      logAudit("purchase_saved", "purchase", order.id, `${order.supplier || "?"} · ฿${(order.total || 0).toFixed(2)} · ${order.paymentMode || "?"}`, { amount: order.total || 0 });
    } else {
      const list = getLocalData(LS_KEY, []);
      if (order.id) {
        const idx = list.findIndex(o => o.id === order.id);
        if (idx !== -1) list[idx] = order;
      } else {
        order.id = "po_" + Date.now();
        list.push(order);
      }
      setLocalData(LS_KEY, list);
    }
  } catch (err) {
    logError("PURCHASE", err.message, err.stack);
    throw new Error(`Save error: ${err.message}`);
  }
};

export const receivePurchaseOrder = async (orderId, paymentMode) => {
  try {
    if (isFirebaseEnabled) {
      await runTransaction(db, async (firestoreTx) => {
        const docRef = doc(db, "purchases", orderId);
        const docSnap = await firestoreTx.get(docRef);
        if (!docSnap.exists()) return;
        const order = { id: docSnap.id, ...docSnap.data() };
        if (order.status !== "pending") return;

        order.status = "received";
        order.receivedAt = Date.now();
        if (paymentMode) order.paymentMode = paymentMode;

        // --- READ PHASE ---

        // A. Read all product states
        const prodDataList = [];
        for (const item of order.items) {
          const prodRef = doc(db, "products", item.productId);
          const prodSnap = await firestoreTx.get(prodRef);
          prodDataList.push({ item, prodRef, prodSnap });
        }

        // B. Read supplier state if Credit
        let supRef = null;
        let supSnap = null;
        if (order.paymentMode === "Credit" && order.supplierId) {
          supRef = doc(db, "suppliers", order.supplierId);
          supSnap = await firestoreTx.get(supRef);
        }

        // C. Read cashier COH state if Cash
        let balRef = null;
        let balSnap = null;
        if (order.paymentMode === "Cash" && order.createdById) {
          balRef = doc(db, "coh_balances", order.createdById);
          balSnap = await firestoreTx.get(balRef);
        }

        // --- WRITE PHASE ---

        for (const { item, prodRef, prodSnap } of prodDataList) {
          if (prodSnap.exists()) {
            const prod = prodSnap.data();
            const unitCost = item.isPack ? (item.costPrice / (item.packSize || prod.packSize || DEFAULT_PACK_SIZE)) : item.costPrice;
            const unitQty = item.isPack ? item.quantity * (item.packSize || prod.packSize || DEFAULT_PACK_SIZE) : item.quantity;

            const newBatch = {
              id: "b_po_" + order.id + "_" + Math.random().toString(36).substring(2),
              costPrice: unitCost,
              quantity: unitQty,
              createdAt: Date.now()
            };

            const updatedBatches = [...(prod.batches || []), newBatch];
            const newStock = (prod.stock || 0) + unitQty;

            const updates: any = {
              batches: updatedBatches,
              stock: newStock,
              costPrice: unitCost,
            };

            if (prod.isCigarette) {
              if (item.isPack) {
                updates.costPricePack = item.costPrice;
                updates.stockPack = Math.floor(newStock / (item.packSize || prod.packSize || DEFAULT_PACK_SIZE));
                updates.stockLoose = newStock % (item.packSize || prod.packSize || DEFAULT_PACK_SIZE);
              } else {
                updates.stockPack = Math.floor(newStock / (prod.packSize || DEFAULT_PACK_SIZE));
                updates.stockLoose = newStock % (prod.packSize || DEFAULT_PACK_SIZE);
              }
            }

            firestoreTx.update(prodRef, updates);
          }
        }

        // Supplier balance and COH integrations
        if (order.paymentMode === "Credit" && supRef && supSnap && supSnap.exists()) {
          const supData = supSnap.data();
          const currentBal = supData.balance || 0;
          const currentLedger = supData.ledger || [];
          const newBal = currentBal + order.total;
          const newLedger = [...currentLedger, {
            date: Date.now(),
            type: "Purchase",
            amount: order.total,
            referenceId: orderId,
            description: `Purchase Invoice: ${orderId}`
          }];
          firestoreTx.update(supRef, { balance: newBal, ledger: newLedger });
        } else if (order.paymentMode === "Cash" && balRef && balSnap) {
          const currentCoh = balSnap.exists() ? (balSnap.data().balance || 0) : 0;
          const newCoh = currentCoh - order.total;

          const cohTxId = "coh_" + Date.now();
          const cohTxRef = doc(db, "coh_transactions", cohTxId);

          firestoreTx.set(balRef, { balance: newCoh });
          firestoreTx.set(cohTxRef, {
            id: cohTxId,
            type: "expense",
            fromUserId: order.createdById,
            fromUserName: order.createdBy || "System",
            toUserId: "supplier_" + (order.supplierId || ""),
            toUserName: order.supplier,
            amount: order.total,
            sign: "debit",
            note: `PO Cash Payment: ${order.supplier}`,
            status: "approved",
            performedBy: order.createdBy || "System",
            timestamp: Date.now(),
            approvedAt: Date.now(),
          });
        }

        const { id, ...orderData } = order;
        firestoreTx.set(docRef, orderData);
      });
      logAudit("purchase_received", "purchase", orderId, `PO received · ${order.supplier || "?"} · ฿${(order.total || 0).toFixed(2)}`, { amount: order.total || 0 });
    } else {
      const list = getLocalData(LS_KEY, []);
      const order = list.find(o => o.id === orderId);
      if (!order || order.status !== "pending") return;
      order.status = "received";
      order.receivedAt = Date.now();
      if (paymentMode) order.paymentMode = paymentMode;
      setLocalData(LS_KEY, list);
    }
  } catch (err) {
    logError("PURCHASE", err.message, err.stack);
    throw new Error(`Receive error: ${err.message}`);
  }
};

export const cancelPurchaseOrder = async (orderId) => {
  try {
    if (isFirebaseEnabled) {
      const docRef = doc(db, "purchases", orderId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return;
      const order = { id: docSnap.id, ...docSnap.data() };
      order.status = "cancelled";
      order.cancelledAt = Date.now();
      await syncPurchaseToFirebase(order);
      logAudit("purchase_cancelled", "purchase", orderId, `PO cancelled · ${order.supplier || "?"} · ฿${(order.total || 0).toFixed(2)}`, { amount: order.total || 0 });
    } else {
      const list = getLocalData(LS_KEY, []);
      const order = list.find(o => o.id === orderId);
      if (!order) return;
      order.status = "cancelled";
      order.cancelledAt = Date.now();
      setLocalData(LS_KEY, list);
    }
  } catch (err) {
    logError("PURCHASE", err.message, err.stack);
    throw new Error(`Cancel error: ${err.message}`);
  }
};
