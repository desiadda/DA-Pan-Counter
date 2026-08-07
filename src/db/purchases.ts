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

export const updatePurchaseOrder = async (orderId: string, updatedOrder: any, user: any) => {
  try {
    if (isFirebaseEnabled) {
      await runTransaction(db, async (firestoreTx) => {
        const docRef = doc(db, "purchases", orderId);
        const docSnap = await firestoreTx.get(docRef);
        if (!docSnap.exists()) throw new Error("Purchase order not found");

        const existingOrder = { id: docSnap.id, ...docSnap.data() } as any;

        // READ PHASE
        const oldSupplierId = existingOrder.supplierId;
        const newSupplierId = updatedOrder.supplierId;

        let oldSupRef = null;
        let oldSupSnap = null;
        if (oldSupplierId) {
          oldSupRef = doc(db, "suppliers", oldSupplierId);
          oldSupSnap = await firestoreTx.get(oldSupRef);
        }

        let newSupRef = null;
        let newSupSnap = null;
        if (newSupplierId && newSupplierId !== oldSupplierId) {
          newSupRef = doc(db, "suppliers", newSupplierId);
          newSupSnap = await firestoreTx.get(newSupRef);
        } else {
          newSupRef = oldSupRef;
          newSupSnap = oldSupSnap;
        }

        const createdById = existingOrder.createdById || user?.id || "system";
        let balRef = null;
        let balSnap = null;
        if (createdById) {
          balRef = doc(db, "coh_balances", createdById);
          balSnap = await firestoreTx.get(balRef);
        }

        // READ ALL PRODUCTS IN OLD AND NEW ORDER (if status is received)
        const prodDataMap: Record<string, { prodRef: any; prodSnap: any }> = {};
        if (existingOrder.status === "received") {
          const allProductIds = new Set<string>();
          (existingOrder.items || []).forEach((it: any) => allProductIds.add(it.productId));
          (updatedOrder.items || []).forEach((it: any) => allProductIds.add(it.productId));

          for (const pid of allProductIds) {
            const pRef = doc(db, "products", pid);
            const pSnap = await firestoreTx.get(pRef);
            prodDataMap[pid] = { prodRef: pRef, prodSnap: pSnap };
          }
        }

        // WRITE PHASE
        if (existingOrder.status === "received") {
          // 1. Revert Old Items Stock & Batches
          for (const item of (existingOrder.items || [])) {
            const entry = prodDataMap[item.productId];
            if (entry && entry.prodSnap.exists()) {
              const prod = entry.prodSnap.data();
              const packSz = item.packSize || prod.packSize || DEFAULT_PACK_SIZE;
              const oldUnitQty = item.isPack ? item.quantity * packSz : item.quantity;

              const filteredBatches = (prod.batches || []).filter((b: any) => !b.id.startsWith("b_po_" + orderId));
              const revertedStock = Math.max(0, (prod.stock || 0) - oldUnitQty);

              const updates: any = {
                batches: filteredBatches,
                stock: revertedStock,
              };

              if (prod.isCigarette) {
                updates.stockPack = Math.floor(revertedStock / packSz);
                updates.stockLoose = revertedStock % packSz;
              }

              firestoreTx.update(entry.prodRef, updates);
              entry.prodSnap = {
                exists: () => true,
                data: () => ({ ...prod, ...updates })
              };
            }
          }

          // 2. Apply New Items Stock & Batches
          for (const item of (updatedOrder.items || [])) {
            const entry = prodDataMap[item.productId];
            if (entry && entry.prodSnap.exists()) {
              const prod = entry.prodSnap.data();
              const packSz = item.packSize || prod.packSize || DEFAULT_PACK_SIZE;
              const unitCost = item.isPack ? (item.costPrice / packSz) : item.costPrice;
              const newUnitQty = item.isPack ? item.quantity * packSz : item.quantity;

              const newBatch = {
                id: "b_po_" + orderId + "_" + Math.random().toString(36).substring(2),
                costPrice: unitCost,
                quantity: newUnitQty,
                createdAt: Date.now(),
              };

              const updatedBatches = [...(prod.batches || []), newBatch];
              const updatedStock = (prod.stock || 0) + newUnitQty;

              const updates: any = {
                batches: updatedBatches,
                stock: updatedStock,
                costPrice: unitCost,
              };

              if (prod.isCigarette) {
                if (item.isPack) {
                  updates.costPricePack = item.costPrice;
                }
                updates.stockPack = Math.floor(updatedStock / packSz);
                updates.stockLoose = updatedStock % packSz;
              }

              firestoreTx.update(entry.prodRef, updates);
              entry.prodSnap = {
                exists: () => true,
                data: () => ({ ...prod, ...updates })
              };
            }
          }

          // 3. Revert & Apply Financials (COH / Khata)
          const oldTotal = existingOrder.total || 0;
          const newTotal = updatedOrder.total || 0;
          const oldPaymentMode = existingOrder.paymentMode || "Cash";
          const newPaymentMode = updatedOrder.paymentMode || "Cash";

          let currentCoh = (balSnap && balSnap.exists()) ? (balSnap.data().balance || 0) : 0;

          // Revert old COH if old payment mode was Cash
          if (oldPaymentMode === "Cash" && balRef) {
            currentCoh += oldTotal;
            firestoreTx.set(balRef, { balance: currentCoh });

            const cohTxId = "coh_rev_" + Date.now();
            const cohTxRef = doc(db, "coh_transactions", cohTxId);
            firestoreTx.set(cohTxRef, {
              id: cohTxId,
              type: "income",
              fromUserId: "supplier_" + (oldSupplierId || ""),
              fromUserName: existingOrder.supplier || "Supplier",
              toUserId: createdById,
              toUserName: existingOrder.createdBy || user?.name || "System",
              amount: oldTotal,
              sign: "credit",
              note: `Reversal of Cash Purchase #${orderId} (Edited)`,
              status: "approved",
              performedBy: user?.name || "System",
              timestamp: Date.now(),
              approvedAt: Date.now(),
            });
          }

          // Revert old Khata if old payment mode was Credit
          if (oldPaymentMode === "Credit" && oldSupSnap && oldSupSnap.exists()) {
            const oldSupData = oldSupSnap.data();
            const revBal = Math.max(0, (oldSupData.balance || 0) - oldTotal);
            const revLedger = [...(oldSupData.ledger || []), {
              date: Date.now(),
              type: "Adjustment",
              amount: -oldTotal,
              referenceId: orderId,
              description: `Reversal of PO #${orderId} for edit`
            }];
            firestoreTx.update(oldSupRef, { balance: revBal, ledger: revLedger });
          }

          // Apply new COH if new payment mode is Cash
          if (newPaymentMode === "Cash" && balRef) {
            const finalCoh = currentCoh - newTotal;
            firestoreTx.set(balRef, { balance: finalCoh });

            const cohTxId = "coh_edit_" + Date.now();
            const cohTxRef = doc(db, "coh_transactions", cohTxId);
            firestoreTx.set(cohTxRef, {
              id: cohTxId,
              type: "expense",
              fromUserId: createdById,
              fromUserName: existingOrder.createdBy || user?.name || "System",
              toUserId: "supplier_" + (updatedOrder.supplierId || ""),
              toUserName: updatedOrder.supplier,
              amount: newTotal,
              sign: "debit",
              note: `Edited Purchase Order: ${updatedOrder.supplier}`,
              status: "approved",
              performedBy: user?.name || "System",
              timestamp: Date.now(),
              approvedAt: Date.now(),
            });
          }

          // Apply new Khata if new payment mode is Credit
          if (newPaymentMode === "Credit" && newSupSnap && newSupSnap.exists()) {
            const newSupData = newSupSnap.data();
            const startBal = (oldSupplierId === newSupplierId && oldPaymentMode === "Credit")
              ? Math.max(0, (newSupData.balance || 0) - oldTotal)
              : (newSupData.balance || 0);

            const finalBal = startBal + newTotal;
            const finalLedger = [...(newSupData.ledger || []), {
              date: Date.now(),
              type: "Purchase",
              amount: newTotal,
              referenceId: orderId,
              description: `Purchase Invoice (Updated): ${orderId}`
            }];
            firestoreTx.update(newSupRef, { balance: finalBal, ledger: finalLedger });
          }
        }

        const { id, ...saveData } = updatedOrder;
        saveData.updatedAt = Date.now();
        firestoreTx.set(docRef, saveData);
      });
      logAudit("purchase_updated", "purchase", orderId, `Edited purchase order · ${updatedOrder.supplier || "?"} · ฿${(updatedOrder.total || 0).toFixed(2)}`, { amount: updatedOrder.total || 0 });
    } else {
      const list = getLocalData(LS_KEY, []);
      const idx = list.findIndex((o: any) => o.id === orderId);
      if (idx !== -1) {
        const existingOrder = list[idx];
        const oldTotal = existingOrder.total || 0;
        const newTotal = updatedOrder.total || 0;
        const oldPaymentMode = existingOrder.paymentMode || "Cash";
        const newPaymentMode = updatedOrder.paymentMode || "Cash";
        const createdById = existingOrder.createdById || user?.id || "system";

        if (existingOrder.status === "received") {
          // 1. Revert Old Financials in Local Storage
          if (oldPaymentMode === "Cash") {
            const cohBalances = getLocalData("pan_coh_balances", {});
            cohBalances[createdById] = (cohBalances[createdById] || 0) + oldTotal;
            setLocalData("pan_coh_balances", cohBalances);

            const cohTxs = getLocalData("pan_coh_transactions", []);
            cohTxs.unshift({
              id: "coh_rev_" + Date.now(),
              type: "income",
              fromUserId: "supplier_" + (existingOrder.supplierId || ""),
              fromUserName: existingOrder.supplier || "Supplier",
              toUserId: createdById,
              toUserName: existingOrder.createdBy || user?.name || "System",
              amount: oldTotal,
              sign: "credit",
              note: `Reversal of Cash Purchase #${orderId} (Edited)`,
              status: "approved",
              performedBy: user?.name || "System",
              timestamp: Date.now(),
              approvedAt: Date.now(),
            });
            setLocalData("pan_coh_transactions", cohTxs);
          } else if (oldPaymentMode === "Credit" && existingOrder.supplierId) {
            const suppliers = getLocalData("pan_suppliers", []);
            const sup = suppliers.find((s: any) => s.id === existingOrder.supplierId);
            if (sup) {
              sup.balance = Math.max(0, (sup.balance || 0) - oldTotal);
              sup.ledger = [...(sup.ledger || []), {
                date: Date.now(),
                type: "Adjustment",
                amount: -oldTotal,
                referenceId: orderId,
                description: `Reversal of PO #${orderId} for edit`
              }];
              setLocalData("pan_suppliers", suppliers);
            }
          }

          // 2. Apply New Financials in Local Storage
          if (newPaymentMode === "Cash") {
            const cohBalances = getLocalData("pan_coh_balances", {});
            cohBalances[createdById] = (cohBalances[createdById] || 0) - newTotal;
            setLocalData("pan_coh_balances", cohBalances);

            const cohTxs = getLocalData("pan_coh_transactions", []);
            cohTxs.unshift({
              id: "coh_edit_" + Date.now(),
              type: "expense",
              fromUserId: createdById,
              fromUserName: existingOrder.createdBy || user?.name || "System",
              toUserId: "supplier_" + (updatedOrder.supplierId || ""),
              toUserName: updatedOrder.supplier,
              amount: newTotal,
              sign: "debit",
              note: `Cash Purchase (Edited): ${updatedOrder.supplier}`,
              status: "approved",
              performedBy: user?.name || "System",
              timestamp: Date.now(),
              approvedAt: Date.now(),
            });
            setLocalData("pan_coh_transactions", cohTxs);
          } else if (newPaymentMode === "Credit" && updatedOrder.supplierId) {
            const suppliers = getLocalData("pan_suppliers", []);
            const sup = suppliers.find((s: any) => s.id === updatedOrder.supplierId);
            if (sup) {
              sup.balance = (sup.balance || 0) + newTotal;
              sup.ledger = [...(sup.ledger || []), {
                date: Date.now(),
                type: "Purchase",
                amount: newTotal,
                referenceId: orderId,
                description: `Purchase Invoice (Updated): ${orderId}`
              }];
              setLocalData("pan_suppliers", suppliers);
            }
          }

          window.dispatchEvent(new CustomEvent("coh-changed"));
        }

        list[idx] = { ...list[idx], ...updatedOrder, updatedAt: Date.now() };
        setLocalData(LS_KEY, list);
      }
    }
  } catch (err: any) {
    logError("PURCHASE", err.message, err.stack);
    throw new Error(`Update order error: ${err.message}`);
  }
};


