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
          if (order.paymentMode === "Credit" && (order.paymentTerms?.days || 0) > 0 && !order.dueDate) {
            order.dueDate = Date.now() + order.paymentTerms.days * 86400000;
          }
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
        if (order.paymentMode === "Credit" && (order.paymentTerms?.days || 0) > 0) {
          order.dueDate = Date.now() + order.paymentTerms.days * 86400000;
        }

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
      if (order.paymentMode === "Credit" && (order.paymentTerms?.days || 0) > 0) {
        order.dueDate = Date.now() + order.paymentTerms.days * 86400000;
      }
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

export const updatePurchaseOrderPaymentMode = async (orderId: string, newPaymentMode: string, user: any) => {
  try {
    if (isFirebaseEnabled) {
      await runTransaction(db, async (firestoreTx) => {
        const docRef = doc(db, "purchases", orderId);
        const docSnap = await firestoreTx.get(docRef);
        if (!docSnap.exists()) throw new Error("Purchase order not found");

        const order = { id: docSnap.id, ...docSnap.data() } as any;
        const oldPaymentMode = order.paymentMode || "Cash";
        if (oldPaymentMode === newPaymentMode) return;

        const total = order.total || 0;
        const createdById = order.createdById || user?.id || "system";
        const createdByName = order.createdBy || user?.name || "System";
        const supplierId = order.supplierId;

        // READ PHASE
        let supRef = null;
        let supSnap = null;
        if (supplierId) {
          supRef = doc(db, "suppliers", supplierId);
          supSnap = await firestoreTx.get(supRef);
        }

        let balRef = null;
        let balSnap = null;
        if (createdById) {
          balRef = doc(db, "coh_balances", createdById);
          balSnap = await firestoreTx.get(balRef);
        }

        // WRITE PHASE
        // 1. Revert Old Payment Mode Effect (if PO was already received or direct)
        if (order.status === "received") {
          if (oldPaymentMode === "Cash" && balRef && balSnap) {
            const currentCoh = balSnap.exists() ? (balSnap.data().balance || 0) : 0;
            const newCoh = currentCoh + total;
            firestoreTx.set(balRef, { balance: newCoh });

            const cohTxId = "coh_rev_" + Date.now();
            const cohTxRef = doc(db, "coh_transactions", cohTxId);
            firestoreTx.set(cohTxRef, {
              id: cohTxId,
              type: "income",
              fromUserId: "supplier_" + (supplierId || ""),
              fromUserName: order.supplier || "Supplier",
              toUserId: createdById,
              toUserName: createdByName,
              amount: total,
              sign: "credit",
              note: `Reversal of Cash Purchase #${orderId} (Switched to ${newPaymentMode})`,
              status: "approved",
              performedBy: user?.name || "System",
              timestamp: Date.now(),
              approvedAt: Date.now(),
            });
          } else if (oldPaymentMode === "Credit" && supRef && supSnap && supSnap.exists()) {
            const supData = supSnap.data();
            const currentBal = supData.balance || 0;
            const currentLedger = supData.ledger || [];
            const newBal = Math.max(0, currentBal - total);
            const newLedger = [...currentLedger, {
              date: Date.now(),
              type: "Adjustment",
              amount: -total,
              referenceId: orderId,
              description: `Payment mode changed from Credit to ${newPaymentMode} (Invoice: ${orderId})`
            }];
            firestoreTx.update(supRef, { balance: newBal, ledger: newLedger });
          }

          // 2. Apply New Payment Mode Effect
          if (newPaymentMode === "Credit" && supRef && supSnap && supSnap.exists()) {
            const supData = supSnap.data();
            const currentBal = supData.balance || 0;
            const effectiveBal = (oldPaymentMode === "Credit") ? Math.max(0, currentBal - total) : currentBal;
            const newBal = effectiveBal + total;
            const newLedger = [...(oldPaymentMode === "Credit" ? supData.ledger || [] : supData.ledger || []), {
              date: Date.now(),
              type: "Purchase",
              amount: total,
              referenceId: orderId,
              description: `Purchase Invoice (Switched to Credit): ${orderId}`
            }];
            firestoreTx.update(supRef, { balance: newBal, ledger: newLedger });
          } else if (newPaymentMode === "Cash" && balRef && balSnap) {
            const currentCoh = balSnap.exists() ? (balSnap.data().balance || 0) : 0;
            const effectiveCoh = (oldPaymentMode === "Cash") ? currentCoh + total : currentCoh;
            const newCoh = effectiveCoh - total;
            firestoreTx.set(balRef, { balance: newCoh });

            const cohTxId = "coh_" + Date.now();
            const cohTxRef = doc(db, "coh_transactions", cohTxId);
            firestoreTx.set(cohTxRef, {
              id: cohTxId,
              type: "expense",
              fromUserId: createdById,
              fromUserName: createdByName,
              toUserId: "supplier_" + (supplierId || ""),
              toUserName: order.supplier,
              amount: total,
              sign: "debit",
              note: `Cash Purchase (Switched from ${oldPaymentMode}): ${order.supplier}`,
              status: "approved",
              performedBy: user?.name || "System",
              timestamp: Date.now(),
              approvedAt: Date.now(),
            });
          }
        }

        // 3. Update Document
        firestoreTx.update(docRef, { paymentMode: newPaymentMode, updatedAt: Date.now() });
      });
      logAudit("purchase_payment_updated", "purchase", orderId, `Payment mode updated to ${newPaymentMode}`, { amount: 0 });
    } else {
      const list = getLocalData(LS_KEY, []);
      const order = list.find((o: any) => o.id === orderId);
      if (order) {
        order.paymentMode = newPaymentMode;
        order.updatedAt = Date.now();
        setLocalData(LS_KEY, list);
      }
    }
  } catch (err: any) {
    logError("PURCHASE", err.message, err.stack);
    throw new Error(`Update error: ${err.message}`);
  }
};

