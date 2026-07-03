import { collection, doc, writeBatch, getDocs, deleteDoc, setDoc, getDoc } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";
import { adjustBalance } from "./coh";
import { logError } from "./errorLog";

async function syncTransaction(transaction) {
  const batch = writeBatch(db);
  const newTxRef = doc(collection(db, "transactions"));
  batch.set(newTxRef, transaction);
  for (let item of transaction.items) {
    const prodRef = doc(db, "products", item.realProductId || item.productId);
    if (item.isPack) {
      batch.update(prodRef, { stock: Math.max(0, item.currentStock - item.quantity * (item.packSize || 20)) });
    } else {
      batch.update(prodRef, { stock: Math.max(0, item.currentStock - item.quantity) });
    }
  }
  await batch.commit();
  return newTxRef.id;
}

export const getTransactions = async () => {
  try {
    if (isFirebaseEnabled) {
      const snap = await getDocs(collection(db, "transactions"));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => b.timestamp - a.timestamp);
      return list;
    }
    return [];
  } catch (err) {
    logError("TRANSACTION", err.message, err.stack);
    return [];
  }
};

export const addTransaction = async (transaction) => {
  try {
    transaction.id = "tx_" + Date.now();

    if (transaction.paymentMode === "Cash") {
      await adjustBalance(transaction.cashierId || "system", transaction.totalAmount, `Cash sale: Bill ${transaction.id}`, transaction.cashierName || "System");
    }

    if (isFirebaseEnabled) {
      const fireId = await syncTransaction(transaction);
      transaction.id = fireId;
    }

    return transaction.id;
  } catch (err) {
    logError("TRANSACTION", err.message, err.stack);
    throw new Error(`Transaction error (लेन-देन समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
};

export const deleteTransaction = async (transactionId) => {
  try {
    if (isFirebaseEnabled) {
      const docSnap = await getDoc(doc(db, "transactions", transactionId));
      if (!docSnap.exists()) return;
      const targetTx = docSnap.data();

      await deleteDoc(doc(db, "transactions", transactionId));

      if (targetTx.paymentMode === "Cash") {
        await adjustBalance(targetTx.cashierId || "system", -targetTx.totalAmount, `Voided cash bill: ${transactionId}`, targetTx.cashierName || "System");
      }
    }
  } catch (err) {
    logError("TRANSACTION", err.message, err.stack);
    throw new Error(`Delete error (डिलीट समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
};

export const returnTransaction = async (originalTx, returnItems, reason, userId, userName) => {
  try {
    const returnAmount = returnItems.reduce((sum, item) => sum + (item.sellingPrice * item.returnQty), 0);

    if (originalTx.paymentMode === "Cash") {
      await adjustBalance(userId || "system", -returnAmount, `Return refund: ${returnAmount} from Bill ${originalTx.id}`, userName || "System");
    }

    const returnTx = {
      id: "ret_" + Date.now(), originalBillId: originalTx.id, type: "return", timestamp: Date.now(),
      items: returnItems.map(item => ({ ...item, quantity: item.returnQty })),
      returnAmount, reason: reason || "Customer return",
      cashierId: userId || originalTx.cashierId, cashierName: userName || originalTx.cashierName,
      originalPaymentMode: originalTx.paymentMode,
    };

    if (isFirebaseEnabled) {
      await setDoc(doc(db, "transactions", returnTx.id), returnTx);
    }

    return returnTx;
  } catch (err) {
    logError("TRANSACTION", err.message, err.stack);
    throw new Error(`Return error (रिटर्न समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
};

export const updateTransactionPaymentMode = async (transactionId, newMode, changedBy) => {
  try {
    if (isFirebaseEnabled) {
      const docRef = doc(db, "transactions", transactionId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) throw new Error("Transaction not found (लेन-देन नहीं मिला).");
      const tx = { id: docSnap.id, ...docSnap.data() };
      if (tx.paymentMode === newMode) return;

      if (tx.paymentMode === "Cash") {
        await adjustBalance(tx.cashierId || "system", -tx.totalAmount, `Changed from Cash to ${newMode}: Bill ${transactionId}`, changedBy || "System");
      } else if (newMode === "Cash") {
        await adjustBalance(tx.cashierId || "system", tx.totalAmount, `Changed from ${tx.paymentMode} to Cash: Bill ${transactionId}`, changedBy || "System");
      }

      tx.paymentMode = newMode;
      tx.editedAt = Date.now();
      tx.editedBy = changedBy || "System";

      await setDoc(doc(db, "transactions", transactionId), tx);
    }
  } catch (err) {
    logError("TRANSACTION", err.message, err.stack);
    throw new Error(`Update error (अपडेट समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
};
