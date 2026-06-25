import { collection, doc, getDocs, addDoc, writeBatch, query, orderBy } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";
import { getLocalProducts, getLocalTransactions, setLocalData, getLocalCustomers } from "./storage";
import { LS_KEYS } from "../constants";
import { adjustBalance } from "./coh";
import { logError } from "./errorLog";

export const getTransactions = async () => {
  try {
    if (isFirebaseEnabled) {
      try {
        const q = query(collection(db, "transactions"), orderBy("timestamp", "desc"));
        const snapshot = await getDocs(q);
        const list = [];
        snapshot.forEach(doc => {
          list.push({ id: doc.id, ...doc.data() });
        });
        return list;
      } catch (err) {
        logError("TRANSACTION", err.message, err.stack);
        console.error("Firebase getTransactions error", err);
        return getLocalTransactions();
      }
    }
    return getLocalTransactions();
  } catch (err) {
    logError("TRANSACTION", err.message, err.stack);
    console.error("getTransactions: Unexpected error", err);
    return [];
  }
};

export const addTransaction = async (transaction) => {
  try {
    if (isFirebaseEnabled) {
      const batch = writeBatch(db);
      const newTxRef = doc(collection(db, "transactions"));
      batch.set(newTxRef, transaction);

      for (let item of transaction.items) {
        const prodRef = doc(db, "products", item.realProductId || item.productId);
        if (item.isPack) {
          const decrementSticks = item.quantity * (item.packSize || 20);
          const newStock = Math.max(0, item.currentStock - decrementSticks);
          batch.update(prodRef, { stock: newStock });
        } else {
          const newStock = Math.max(0, item.currentStock - item.quantity);
          batch.update(prodRef, { stock: newStock });
        }
      }

      await batch.commit();
      if (transaction.paymentMode === "Cash") {
        adjustBalance(transaction.cashierId || "system", transaction.totalAmount, `Cash sale: Bill ${newTxRef.id}`, transaction.cashierName || "System");
      }
      return newTxRef.id;
    } else {
      const transactions = getLocalTransactions();
      transaction.id = "tx_" + Date.now();
      transactions.unshift(transaction);
      setLocalData(LS_KEYS.TRANSACTIONS, transactions);

      const products = getLocalProducts();
      transaction.items.forEach(item => {
        const prod = products.find(p => p.id === (item.realProductId || item.productId));
        if (prod) {
          if (item.isPack) {
            const decrementSticks = item.quantity * (prod.packSize || 20);
            prod.stock = Math.max(0, prod.stock - decrementSticks);
          } else {
            prod.stock = Math.max(0, prod.stock - item.quantity);
          }
        }
      });
      setLocalData(LS_KEYS.PRODUCTS, products);

      if (transaction.paymentMode === "Cash") {
        adjustBalance(transaction.cashierId || "system", transaction.totalAmount, `Cash sale: Bill ${transaction.id}`, transaction.cashierName || "System");
      }
      window.dispatchEvent(new CustomEvent("stock-changed"));
      return transaction.id;
    }
  } catch (err) {
    logError("TRANSACTION", err.message, err.stack);
    console.error("addTransaction: Error saving transaction", err);
    throw new Error(`Transaction error (लेन-देन समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
};

export const deleteTransaction = async (transactionId) => {
  try {
    if (isFirebaseEnabled) {
      const txDocRef = doc(db, "transactions", transactionId);
      const docSnap = await getDocs(query(collection(db, "transactions")));
      let targetTx = null;
      docSnap.forEach(d => {
        if (d.id === transactionId) {
          targetTx = d.data();
        }
      });

      if (!targetTx) return;

      const batch = writeBatch(db);
      batch.delete(txDocRef);

      const prodSnap = await getDocs(query(collection(db, "products")));
      const currentProducts = {};
      prodSnap.forEach(d => {
        currentProducts[d.id] = d.data();
      });

      for (let item of targetTx.items) {
        const prodId = item.realProductId || item.productId;
        const prodData = currentProducts[prodId];
        if (prodData) {
          const prodRef = doc(db, "products", prodId);
          const addSticks = item.isPack ? item.quantity * (item.packSize || 20) : item.quantity;
          const restoredStock = (prodData.stock || 0) + addSticks;
          batch.update(prodRef, { stock: restoredStock });
        }
      }

      if (targetTx.paymentMode === "Udhaar" && targetTx.customerId) {
        const custRef = doc(db, "customers", targetTx.customerId);
        const custSnap = await getDocs(query(collection(db, "customers")));
        let currentCustomer = null;
        custSnap.forEach(d => {
          if (d.id === targetTx.customerId) currentCustomer = d.data();
        });
        if (currentCustomer) {
          const newBalance = Math.max(0, (currentCustomer.balance || 0) - targetTx.totalAmount);
          const newLedger = [...(currentCustomer.ledger || []), {
            date: Date.now(),
            type: "Void Bill",
            amount: -targetTx.totalAmount,
            description: `Bill ${transactionId} was voided.`,
          }];
          batch.update(custRef, { balance: newBalance, ledger: newLedger });
        }
      }

      if (targetTx.paymentMode === "Cash") {
        adjustBalance(targetTx.cashierId || "system", -targetTx.totalAmount, `Voided cash bill: ${transactionId}`, targetTx.cashierName || "System");
      }

      await batch.commit();
    } else {
      const transactions = getLocalTransactions();
      const targetTx = transactions.find(t => t.id === transactionId);
      if (!targetTx) return;

      const newTransactions = transactions.filter(t => t.id !== transactionId);
      setLocalData(LS_KEYS.TRANSACTIONS, newTransactions);

      const products = getLocalProducts();
      targetTx.items.forEach(item => {
        const prod = products.find(p => p.id === (item.realProductId || item.productId));
        if (prod) {
          const addSticks = item.isPack ? item.quantity * (item.packSize || 20) : item.quantity;
          prod.stock = (prod.stock || 0) + addSticks;
        }
      });
      setLocalData(LS_KEYS.PRODUCTS, products);

      if (targetTx.paymentMode === "Udhaar" && targetTx.customerId) {
        const customers = getLocalCustomers();
        const idx = customers.findIndex(c => c.id === targetTx.customerId);
        if (idx !== -1) {
          customers[idx].balance = Math.max(0, (customers[idx].balance || 0) - targetTx.totalAmount);
          customers[idx].ledger = [...(customers[idx].ledger || []), {
            date: Date.now(),
            type: "Void Bill",
            amount: -targetTx.totalAmount,
            description: `Bill ${transactionId} was voided.`,
          }];
          setLocalData(LS_KEYS.CUSTOMERS, customers);
        }
      }

      if (targetTx.paymentMode === "Cash") {
        adjustBalance(targetTx.cashierId || "system", -targetTx.totalAmount, `Voided cash bill: ${transactionId}`, targetTx.cashierName || "System");
      }
      window.dispatchEvent(new CustomEvent("stock-changed"));
    }
  } catch (err) {
    logError("TRANSACTION", err.message, err.stack);
    console.error("deleteTransaction: Error deleting transaction", err);
    throw new Error(`Delete error (डिलीट समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
};

export const returnTransaction = async (originalTx, returnItems, reason, userId, userName) => {
  try {
    if (isFirebaseEnabled) return;
    const products = getLocalProducts();
    const returnAmount = returnItems.reduce((sum, item) => sum + (item.sellingPrice * item.returnQty), 0);

    returnItems.forEach(item => {
      const prod = products.find(p => p.id === (item.realProductId || item.productId));
      if (prod) {
        const restQty = item.isPack ? item.returnQty * (item.packSize || 20) : item.returnQty;
        prod.stock = (prod.stock || 0) + restQty;
      }
    });
    setLocalData(LS_KEYS.PRODUCTS, products);

    if (originalTx.paymentMode === "Cash") {
      adjustBalance(userId || "system", -returnAmount, `Return refund: ${returnAmount} from Bill ${originalTx.id}`, userName || "System");
    }
    if (originalTx.paymentMode === "Udhaar" && originalTx.customerId) {
      const customers = getLocalCustomers();
      const idx = customers.findIndex(c => c.id === originalTx.customerId);
      if (idx !== -1) {
        customers[idx].balance = Math.max(0, (customers[idx].balance || 0) - returnAmount);
        customers[idx].ledger = [...(customers[idx].ledger || []), {
          date: Date.now(),
          type: "Return",
          amount: -returnAmount,
          description: `Return of items from Bill ${originalTx.id}: ${reason}`,
        }];
        setLocalData(LS_KEYS.CUSTOMERS, customers);
      }
    }

    const transactions = getLocalTransactions();
    const returnTx = {
      id: "ret_" + Date.now(),
      originalBillId: originalTx.id,
      type: "return",
      timestamp: Date.now(),
      items: returnItems.map(item => ({ ...item, quantity: item.returnQty })),
      returnAmount,
      reason: reason || "Customer return",
      cashierId: userId || originalTx.cashierId,
      cashierName: userName || originalTx.cashierName,
      originalPaymentMode: originalTx.paymentMode,
    };
    transactions.unshift(returnTx);
    setLocalData(LS_KEYS.TRANSACTIONS, transactions);

    window.dispatchEvent(new CustomEvent("stock-changed"));
    return returnTx;
  } catch (err) {
    logError("TRANSACTION", err.message, err.stack);
    console.error("returnTransaction: Error processing return", err);
    throw new Error(`Return error (रिटर्न समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
};

export const updateTransactionPaymentMode = async (transactionId, newMode, changedBy) => {
  try {
    if (isFirebaseEnabled) return;
    const transactions = getLocalTransactions();
    const tx = transactions.find(t => t.id === transactionId);
    if (!tx) throw new Error("Transaction not found (लेन-देन नहीं मिला).");

    const oldMode = tx.paymentMode;
    if (oldMode === newMode) return;

    if (oldMode === "Cash") {
      adjustBalance(tx.cashierId || "system", -tx.totalAmount, `Changed from Cash to ${newMode}: Bill ${transactionId}`, changedBy || "System");
    } else if (newMode === "Cash") {
      adjustBalance(tx.cashierId || "system", tx.totalAmount, `Changed from ${oldMode} to Cash: Bill ${transactionId}`, changedBy || "System");
    }

    tx.paymentMode = newMode;
    tx.editedAt = Date.now();
    tx.editedBy = changedBy || "System";
    setLocalData(LS_KEYS.TRANSACTIONS, transactions);
  } catch (err) {
    logError("TRANSACTION", err.message, err.stack);
    console.error("updateTransactionPaymentMode: Error updating payment mode", err);
    throw new Error(`Update error (अपडेट समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
};
