import { collection, doc, getDocs, setDoc, addDoc, updateDoc, query } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";
import { getLocalCustomers, setLocalData } from "./storage";
import { LS_KEYS } from "../constants";
import { logError } from "./errorLog";

export const getCustomers = async () => {
  try {
    if (isFirebaseEnabled) {
      try {
        const q = query(collection(db, "customers"));
        const snapshot = await getDocs(q);
        const list = [];
        snapshot.forEach(doc => {
          list.push({ id: doc.id, ...doc.data() });
        });
        return list;
      } catch (err) {
        logError("TRANSACTION", err.message, err.stack);
        console.error("Firebase getCustomers error", err);
        return getLocalCustomers();
      }
    }
    return getLocalCustomers();
  } catch (err) {
    logError("TRANSACTION", err.message, err.stack);
    console.error("getCustomers: Unexpected error", err);
    return [];
  }
};

export const saveCustomer = async (customer) => {
  try {
    if (isFirebaseEnabled) {
      const { id, ...data } = customer;
      if (id) {
        await setDoc(doc(db, "customers", id), data);
      } else {
        await addDoc(collection(db, "customers"), data);
      }
    } else {
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
    }
  } catch (err) {
    logError("TRANSACTION", err.message, err.stack);
    console.error("saveCustomer: Error saving customer", err);
    throw new Error(`Save error (सेव समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
};

export const updateUdhaarBalance = async (customerId, amountChange, ledgerEntry) => {
  try {
    if (isFirebaseEnabled) {
      const custRef = doc(db, "customers", customerId);
      const docSnap = await getDocs(query(collection(db, "customers")));
      let currentCustomer = null;
      docSnap.forEach(d => {
        if (d.id === customerId) currentCustomer = d.data();
      });
      if (currentCustomer) {
        const newBalance = (currentCustomer.balance || 0) + amountChange;
        const newLedger = [...(currentCustomer.ledger || []), ledgerEntry];
        await updateDoc(custRef, { balance: newBalance, ledger: newLedger });
      }
    } else {
      const customers = getLocalCustomers();
      const idx = customers.findIndex(c => c.id === customerId);
      if (idx !== -1) {
        customers[idx].balance = (customers[idx].balance || 0) + amountChange;
        customers[idx].ledger = [...(customers[idx].ledger || []), ledgerEntry];
        setLocalData(LS_KEYS.CUSTOMERS, customers);
      }
    }
  } catch (err) {
    logError("TRANSACTION", err.message, err.stack);
    console.error("updateUdhaarBalance: Error updating khata balance", err);
    throw new Error(`Khata update error (खाता अपडेट समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
};
