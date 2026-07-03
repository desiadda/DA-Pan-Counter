import { collection, getDocs, doc, setDoc, updateDoc, onSnapshot, getDoc } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";
import { getLocalCustomers, setLocalData } from "./storage";
import { LS_KEYS } from "../constants";
import { logError } from "./errorLog";

let customersListenerActive = false;

export function initCustomersListener() {
  if (!isFirebaseEnabled || customersListenerActive) return;
  customersListenerActive = true;

  onSnapshot(collection(db, "customers"), (snapshot) => {
    const list = [];
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() });
    });
    setLocalData(LS_KEYS.CUSTOMERS, list);
    window.dispatchEvent(new CustomEvent("customers-changed"));
  });
}

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
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLocalData(LS_KEYS.CUSTOMERS, list);
      return list;
    }
    return getLocalCustomers();
  } catch (err) {
    logError("TRANSACTION", err.message, err.stack);
    return getLocalCustomers();
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
    throw new Error(`Save error (सेव समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
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
    throw new Error(`Khata update error (खाता अपडेट समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
};
