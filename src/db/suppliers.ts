import { collection, doc, setDoc, addDoc, deleteDoc, getDocs, runTransaction } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";
import { logError } from "./errorLog";
import { getLocalData, setLocalData } from "./storage";

const LS_KEY = "pan_suppliers";

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
        const newLedger = [...currentLedger, ledgerEntry];
        firestoreTx.update(docRef, { balance: newBal, ledger: newLedger });
      });
    }
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    throw err;
  }
};

export const recordSupplierPayment = async (supplierId, supplierName, amount, paymentMode, cashierId, cashierName) => {
  try {
    const ledgerEntry = {
      date: Date.now(),
      type: "Payment",
      amount,
      description: `Paid via ${paymentMode}. Recorded by ${cashierName}.`,
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
        const newLedger = [...currentLedger, ledgerEntry];
        firestoreTx.update(supRef, { balance: newBal, ledger: newLedger });

        if (paymentMode === "Cash") {
          const balRef = doc(db, "coh_balances", cashierId);
          const balSnap = await firestoreTx.get(balRef);
          const currentCoh = balSnap.exists() ? (balSnap.data().balance || 0) : 0;
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
            note: `Paid supplier: ${supplierName}`,
            status: "approved",
            timestamp: Date.now(),
            approvedAt: Date.now(),
          });
        }
      });
    }
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    throw err;
  }
};
