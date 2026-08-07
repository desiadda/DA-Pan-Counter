import { collection, doc, setDoc, addDoc, deleteDoc, getDocs, runTransaction, onSnapshot } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";
import { logError } from "./errorLog";
import { getLocalData, setLocalData } from "./storage";
import { logAudit } from "./audit";

const LS_KEY = "pan_suppliers";

let suppliersListenerActive = false;

export function initSuppliersListener() {
  if (!isFirebaseEnabled || !db || suppliersListenerActive) return;
  suppliersListenerActive = true;

  onSnapshot(collection(db, "suppliers"), (snapshot) => {
    const list = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });
    setLocalData(LS_KEY, list);
    window.dispatchEvent(new CustomEvent("suppliers-changed"));
  }, (err) => {
    logError("STORAGE", "Suppliers listener error: " + err.message, err.stack);
  });
}

async function syncSupplierToFirebase(supplier) {
  const { id, ...data } = supplier;
  if (id) {
    await setDoc(doc(db, "suppliers", id), data);
  } else {
    const ref = await addDoc(collection(db, "suppliers"), data);
    supplier.id = ref.id;
  }
}

async function deleteSupplierFromFirebase(id) {
  await deleteDoc(doc(db, "suppliers", id));
}

export const getSuppliers = async () => {
  try {
    if (isFirebaseEnabled) {
      const snap = await getDocs(collection(db, "suppliers"));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    return getLocalData(LS_KEY, []);
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    return getLocalData(LS_KEY, []);
  }
};

export const saveSupplier = async (supplier) => {
  try {
    if (!supplier.id) {
      supplier.createdAt = Date.now();
      supplier.balance = supplier.balance || 0;
      supplier.ledger = supplier.ledger || [];
    }

    if (isFirebaseEnabled) {
      await syncSupplierToFirebase(supplier);
    } else {
      const list = getLocalData(LS_KEY, []);
      if (supplier.id) {
        const idx = list.findIndex(s => s.id === supplier.id);
        if (idx !== -1) list[idx] = supplier;
      } else {
        supplier.id = "sup_" + Date.now();
        list.push(supplier);
      }
      setLocalData(LS_KEY, list);
    }
    logAudit(supplier.id ? "supplier_updated" : "supplier_created", "supplier", supplier.id || "", `${supplier.name || "Supplier"}${supplier.phone ? " · " + supplier.phone : ""}`);
    return supplier;
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    throw new Error("Failed to save supplier");
  }
};

export const deleteSupplier = async (id) => {
  try {
    if (isFirebaseEnabled) {
      await deleteSupplierFromFirebase(id);
    } else {
      const list = getLocalData(LS_KEY, []).filter(s => s.id !== id);
      setLocalData(LS_KEY, list);
    }
    logAudit("supplier_deleted", "supplier", id, "Deleted supplier");
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    throw new Error("Failed to delete supplier");
  }
};

export const updateSupplierBalance = async (supplierId, amountChange, ledgerEntry) => {
  try {
    if (isFirebaseEnabled) {
      await runTransaction(db, async (firestoreTx) => {
        const docRef = doc(db, "suppliers", supplierId);
        const docSnap = await firestoreTx.get(docRef);
        let currentBal = 0;
        let currentLedger = [];
        if (docSnap.exists()) {
          const data = docSnap.data();
          currentBal = data.balance || 0;
          currentLedger = data.ledger || [];
        }
        const newBal = currentBal + amountChange;
        const newLedger = [...currentLedger, ledgerEntry].sort((a, b) => (a.date || 0) - (b.date || 0));
        firestoreTx.update(docRef, { balance: newBal, ledger: newLedger });
      });
    } else {
      const list = getLocalData(LS_KEY, []);
      const idx = list.findIndex(s => s.id === supplierId);
      if (idx !== -1) {
        list[idx].balance = (list[idx].balance || 0) + amountChange;
        list[idx].ledger = [...(list[idx].ledger || []), ledgerEntry].sort((a, b) => (a.date || 0) - (b.date || 0));
        setLocalData(LS_KEY, list);
      }
    }
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    throw err;
  }
};

export const adjustSupplierBalance = async (supplierId, amount, type = "Opening Balance", description = "", dateMs = Date.now()) => {
  const ledgerEntry = {
    date: dateMs,
    type: type || "Opening Balance",
    amount: Math.abs(amount),
    description: description || "Backdated adjustment",
  };
  const amountChange = type === "Payment" ? -Math.abs(amount) : amount;
  await updateSupplierBalance(supplierId, amountChange, ledgerEntry);
  logAudit("supplier_balance_adjusted", "supplier", supplierId, `Adjusted balance by ฿${amount.toFixed(2)} (${type})`, { amount, dateMs });
};

export const recordSupplierPayment = async (
  supplierId: string,
  supplierName: string,
  amount: number,
  paymentMode: string,
  cashierId: string,
  cashierName: string,
  paymentDateMs: number = Date.now(),
  note: string = ""
) => {
  try {
    const paymentTimestamp = paymentDateMs || Date.now();
    const ledgerEntry = {
      date: paymentTimestamp,
      type: "Payment",
      amount,
      description: note ? `Paid via ${paymentMode}. Note: ${note}` : `Paid via ${paymentMode}. Recorded by ${cashierName}.`,
    };
    
    if (isFirebaseEnabled) {
      await runTransaction(db, async (firestoreTx) => {
        const supRef = doc(db, "suppliers", supplierId);
        const supSnap = await firestoreTx.get(supRef);
        if (!supSnap.exists()) throw new Error("Supplier not found");
        const data = supSnap.data();
        const currentBal = data.balance || 0;
        const currentLedger = data.ledger || [];
        const newBal = currentBal - amount;
        const newLedger = [...currentLedger, ledgerEntry].sort((a, b) => (a.date || 0) - (b.date || 0));

        let currentCoh = 0;
        let balRef = null;
        if (paymentMode === "Cash") {
          balRef = doc(db, "coh_balances", cashierId);
          const balSnap = await firestoreTx.get(balRef);
          currentCoh = balSnap.exists() ? (balSnap.data().balance || 0) : 0;
        }

        // --- WRITE PHASE ---
        firestoreTx.update(supRef, { balance: newBal, ledger: newLedger });

        if (paymentMode === "Cash" && balRef) {
          const newCoh = currentCoh - amount;
          const cohTxId = "coh_" + Date.now();
          const cohTxRef = doc(db, "coh_transactions", cohTxId);

          firestoreTx.set(balRef, { balance: newCoh });
          firestoreTx.set(cohTxRef, {
            id: cohTxId,
            type: "expense",
            fromUserId: cashierId,
            fromUserName: cashierName,
            toUserId: "supplier_" + supplierId,
            toUserName: supplierName,
            amount,
            sign: "debit",
            note: note ? `Paid supplier (${supplierName}): ${note}` : `Paid supplier: ${supplierName}`,
            status: "approved",
            performedBy: cashierName || "System",
            timestamp: paymentTimestamp,
            approvedAt: paymentTimestamp,
          });
        }
      });
      logAudit("supplier_payment", "supplier", supplierId, `Paid ${supplierName} ฿${(amount || 0).toFixed(2)} via ${paymentMode}`, { amount });
    } else {
      const list = getLocalData(LS_KEY, []);
      const idx = list.findIndex((s: any) => s.id === supplierId);
      if (idx !== -1) {
        list[idx].balance = (list[idx].balance || 0) - amount;
        list[idx].ledger = [...(list[idx].ledger || []), ledgerEntry].sort((a, b) => (a.date || 0) - (b.date || 0));
        setLocalData(LS_KEY, list);
      }

      if (paymentMode === "Cash") {
        const cohBalances = getLocalData("pan_coh_balances", {});
        cohBalances[cashierId] = (cohBalances[cashierId] || 0) - amount;
        setLocalData("pan_coh_balances", cohBalances);

        const cohTxs = getLocalData("pan_coh_transactions", []);
        cohTxs.unshift({
          id: "coh_" + Date.now(),
          type: "expense",
          fromUserId: cashierId,
          fromUserName: cashierName,
          toUserId: "supplier_" + supplierId,
          toUserName: supplierName,
          amount,
          sign: "debit",
          note: note ? `Paid supplier (${supplierName}): ${note}` : `Paid supplier: ${supplierName}`,
          status: "approved",
          performedBy: cashierName || "System",
          timestamp: paymentTimestamp,
          approvedAt: paymentTimestamp,
        });
        setLocalData("pan_coh_transactions", cohTxs);
        window.dispatchEvent(new CustomEvent("coh-changed"));
      }
    }
  } catch (err: any) {
    logError("STORAGE", err.message, err.stack);
    throw err;
  }
};

