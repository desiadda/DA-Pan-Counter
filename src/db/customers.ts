import { collection, getDocs, doc, setDoc, updateDoc } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";
import { getLocalCustomers, setLocalData } from "./storage";
import { LS_KEYS } from "../constants";
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
    const customers = getLocalCustomers();
    if (customer.id) {
      const idx = customers.findIndex(c => c.id === customer.id);
      if (idx !== -1) customers[idx] = customer;
    } else {
      customer.id = "c_" + Date.now();
      customer.balance = customer.balance || 0;
      customer.ledger = customer.ledger || [];
      customers.push(customer);
    }

    if (isFirebaseEnabled) {
      await syncCustomerToFirebase(customer);
    }

    setLocalData(LS_KEYS.CUSTOMERS, customers);
  } catch (err) {
    logError("TRANSACTION", err.message, err.stack);
    throw new Error(`Save error (सेव समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
};

export const updateUdhaarBalance = async (customerId, amountChange, ledgerEntry) => {
  try {
    const customers = getLocalCustomers();
    const idx = customers.findIndex(c => c.id === customerId);
    if (idx === -1) return;
    customers[idx].balance = (customers[idx].balance || 0) + amountChange;
    customers[idx].ledger = [...(customers[idx].ledger || []), ledgerEntry];

    if (isFirebaseEnabled) {
      await syncUdhaarToFirebase(customerId, customers[idx].balance, customers[idx].ledger);
    }

    setLocalData(LS_KEYS.CUSTOMERS, customers);
  } catch (err) {
    logError("TRANSACTION", err.message, err.stack);
    throw new Error(`Khata update error (खाता अपडेट समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
};
