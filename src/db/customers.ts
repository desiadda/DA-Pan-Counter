import { collection, getDocs, doc, setDoc, updateDoc, getDoc, runTransaction } from "firebase/firestore";
import { db, isFirebaseEnabled, localizeError } from "./config";
import { logError } from "./errorLog";

async function syncCustomerToFirebase(customer) {
  const { id, ...data } = customer;
  if (id) {
    await setDoc(doc(db, "customers", id), data);
  } else {
    const ref = doc(collection(db, "customers"));
    customer.id = ref.id;
    await setDoc(ref, { ...data, id: ref.id });
  }
}

async function syncUdhaarToFirebase(customerId, balance, ledger) {
  await updateDoc(doc(db, "customers", customerId), { balance, ledger });
}

export const getCustomers = async () => {
  try {
    if (isFirebaseEnabled) {
      const snap = await getDocs(collection(db, "customers"));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    return [];
  } catch (err) {
    logError("TRANSACTION", err.message, err.stack);
    return [];
  }
};

export const saveCustomer = async (customer) => {
  try {
    if (!customer.id) {
      customer.balance = customer.balance || 0;
      customer.ledger = customer.ledger || [];
    }

    if (isFirebaseEnabled) {
      await syncCustomerToFirebase(customer);
    }
  } catch (err) {
    logError("TRANSACTION", err.message, err.stack);
    throw new Error(localizeError(`Save error: ${err.message}. Please try again.`, `सेव समस्या: ${err.message}। कृपया पुनः प्रयास करें।`));
  }
};

export const updateUdhaarBalance = async (
  customerId: string,
  amountChange: number,
  ledgerEntry: any,
  cashierId?: string,
  cashierName?: string,
  paymentMode?: string
) => {
  try {
    if (isFirebaseEnabled && db) {
      await runTransaction(db, async (firestoreTx) => {
        const docRef = doc(db, "customers", customerId);
        const docSnap = await firestoreTx.get(docRef);
        if (!docSnap.exists()) throw new Error("Customer not found.");

        const data = docSnap.data();
        const currentBal = data.balance || 0;
        const currentLedger = data.ledger || [];
        const newBal = currentBal + amountChange;
        const newLedger = [...currentLedger, ledgerEntry];

        // --- READ PHASE ---
        // Read cashier COH balance if paymentMode is Cash BEFORE writing anything
        let currentCohBal = 0;
        let balRef = null;
        if (paymentMode === "Cash" && cashierId) {
          balRef = doc(db, "coh_balances", cashierId);
          const balSnap = await firestoreTx.get(balRef);
          currentCohBal = balSnap.exists() ? (balSnap.data().balance || 0) : 0;
        }

        // --- WRITE PHASE ---
        // 1. Update customer balance and ledger
        firestoreTx.update(docRef, { balance: newBal, ledger: newLedger });

        // 2. If paymentMode is Cash, adjust cashier COH balance and log transfer
        if (paymentMode === "Cash" && cashierId && balRef) {
          const newCohBal = currentCohBal + Math.abs(amountChange);

          const cohTxId = "coh_" + Date.now();
          const cohTxRef = doc(db, "coh_transactions", cohTxId);

          firestoreTx.set(balRef, { balance: newCohBal });
          firestoreTx.set(cohTxRef, {
            id: cohTxId,
            type: "payment",
            fromUserId: "customer",
            fromUserName: data.name || "Customer",
            toUserId: cashierId,
            toUserName: cashierName || "Cashier",
            amount: Math.abs(amountChange),
            sign: "credit",
            note: `Khata Payment: Customer ${data.name || "Unknown"}`,
            status: "approved",
            timestamp: Date.now(),
            approvedAt: Date.now(),
          });
        }
      });
    }
  } catch (err) {
    logError("TRANSACTION", err.message, err.stack);
    throw new Error(localizeError(`Khata update error: ${err.message}. Please try again.`, `खाता अपडेट समस्या: ${err.message}। कृपया पुनः प्रयास करें।`));
  }
};
