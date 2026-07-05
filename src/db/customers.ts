import { collection, getDocs, doc, setDoc, updateDoc, getDoc } from "firebase/firestore";
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

export const updateUdhaarBalance = async (customerId, amountChange, ledgerEntry) => {
  try {
    let currentBal = 0;
    let currentLedger = [];

    if (isFirebaseEnabled) {
      const docRef = doc(db, "customers", customerId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        currentBal = data.balance || 0;
        currentLedger = data.ledger || [];
      }
      
      const newBal = currentBal + amountChange;
      const newLedger = [...currentLedger, ledgerEntry];
      await syncUdhaarToFirebase(customerId, newBal, newLedger);
    }
  } catch (err) {
    logError("TRANSACTION", err.message, err.stack);
    throw new Error(localizeError(`Khata update error: ${err.message}. Please try again.`, `खाता अपडेट समस्या: ${err.message}। कृपया पुनः प्रयास करें।`));
  }
};
