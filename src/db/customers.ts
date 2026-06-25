import { doc, setDoc, updateDoc } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";
import { getLocalCustomers, setLocalData } from "./storage";
import { LS_KEYS } from "../constants";
import { logError } from "./errorLog";
import { addToSyncQueue } from "./sync";

function syncCustomerToFirebase(customer) {
  const { id, ...data } = customer;
  if (id) return setDoc(doc(db, "customers", id), data);
  return setDoc(doc(collection(db, "customers")), { ...data, id: "c_" + Date.now() });
}

function syncUdhaarToFirebase(customerId, balance, ledger) {
  return updateDoc(doc(db, "customers", customerId), { balance, ledger });
}

export const getCustomers = async () => {
  try {
    return getLocalCustomers();
  } catch (err) {
    logError("TRANSACTION", err.message, err.stack);
    return [];
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
    setLocalData(LS_KEYS.CUSTOMERS, customers);

    if (isFirebaseEnabled) {
      syncCustomerToFirebase(customer).catch(() => addToSyncQueue({ fn: () => syncCustomerToFirebase(customer) }));
    }
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
    setLocalData(LS_KEYS.CUSTOMERS, customers);

    if (isFirebaseEnabled) {
      syncUdhaarToFirebase(customerId, customers[idx].balance, customers[idx].ledger)
        .catch(() => addToSyncQueue({ fn: () => syncUdhaarToFirebase(customerId, customers[idx].balance, customers[idx].ledger) }));
    }
  } catch (err) {
    logError("TRANSACTION", err.message, err.stack);
    throw new Error(`Khata update error (खाता अपडेट समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
};
