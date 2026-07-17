import { collection, doc, writeBatch, getDocs, deleteDoc, setDoc, getDoc, runTransaction } from "firebase/firestore";
import { db, isFirebaseEnabled, localizeError } from "./config";
import { adjustBalance } from "./coh";
import { logError } from "./errorLog";

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
    if (isFirebaseEnabled) {
      const fireId = await runTransaction(db, async (firestoreTx) => {
        // 1. Generate Transaction ID
        const newTxRef = doc(collection(db, "transactions"));
        const txId = newTxRef.id;
        transaction.id = txId;

        // 2. If Cash payment, adjust Cash on Hand balance in same transaction
        if (transaction.paymentMode === "Cash") {
          const cashierId = transaction.cashierId || "system";
          const balRef = doc(db, "coh_balances", cashierId);
          const balSnap = await firestoreTx.get(balRef);
          const currentBal = balSnap.exists() ? (balSnap.data().balance || 0) : 0;
          const newBal = currentBal + transaction.totalAmount;

          const cohTxId = "coh_" + Date.now();
          const cohTxRef = doc(db, "coh_transactions", cohTxId);

          firestoreTx.set(balRef, { balance: newBal });
          firestoreTx.set(cohTxRef, {
            id: cohTxId,
            type: "sale",
            fromUserId: "customer",
            fromUserName: "Customer",
            toUserId: cashierId,
            toUserName: transaction.cashierName || "Cashier",
            amount: transaction.totalAmount,
            sign: "credit",
            note: `Cash sale: Bill ${txId}`,
            status: "approved",
            timestamp: Date.now(),
            approvedAt: Date.now(),
          });
        }

        // 3. Update stock levels for each item and deduct from batches (FIFO)
        let totalCostOfSales = 0;
        for (let item of transaction.items) {
          const prodRef = doc(db, "products", item.realProductId || item.productId);
          const prodSnap = await firestoreTx.get(prodRef);
          if (prodSnap.exists()) {
            const prodData = prodSnap.data();
            const currentStock = prodData.stock || 0;
            const deductQty = item.isPack ? item.quantity * (item.packSize || 20) : item.quantity;
            const newStock = Math.max(0, currentStock - deductQty);

            let batches = [...(prodData.batches || [])];
            if (batches.length === 0 && currentStock > 0) {
              batches = [{
                id: "b_init_" + prodSnap.id,
                costPrice: prodData.costPrice || 0,
                quantity: currentStock,
                createdAt: prodData.createdAt || Date.now(),
              }];
            }

            batches.sort((a, b) => a.createdAt - b.createdAt);
            let remainingToDeduct = deductQty;
            let itemCostTotal = 0;

            for (const batch of batches) {
              if (remainingToDeduct <= 0) break;
              if (batch.quantity <= 0) continue;

              const deductAmt = Math.min(batch.quantity, remainingToDeduct);
              batch.quantity -= deductAmt;
              remainingToDeduct -= deductAmt;
              itemCostTotal += deductAmt * (batch.costPrice || 0);
            }

            const updatedBatches = batches.filter(b => b.quantity > 0);
            totalCostOfSales += itemCostTotal;

            const updates: any = {
              stock: newStock,
              batches: updatedBatches,
            };

            if (prodData.isCigarette) {
              const packSize = prodData.packSize || 20;
              updates.stockPack = Math.floor(newStock / packSize);
              updates.stockLoose = newStock % packSize;
            }

            firestoreTx.update(prodRef, updates);
          }
        }
        transaction.totalCostOfSales = totalCostOfSales;

        // 4. Save the transaction invoice
        firestoreTx.set(newTxRef, transaction);

        return txId;
      });
      return fireId;
    } else {
      transaction.id = "tx_" + Date.now();
      return transaction.id;
    }
  } catch (err) {
    logError("TRANSACTION", err.message, err.stack);
    throw new Error(localizeError(`Transaction error: ${err.message}. Please try again.`, `लेन-देन समस्या: ${err.message}। कृपया पुनः प्रयास करें।`));
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
    throw new Error(localizeError(`Delete error: ${err.message}. Please try again.`, `डिलीट समस्या: ${err.message}। कृपया पुनः प्रयास करें।`));
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
    throw new Error(localizeError(`Return error: ${err.message}. Please try again.`, `रिटर्न समस्या: ${err.message}। कृपया पुनः प्रयास करें।`));
  }
};

export const updateTransactionPaymentMode = async (transactionId, newMode, changedBy) => {
  try {
    if (isFirebaseEnabled) {
      const docRef = doc(db, "transactions", transactionId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) throw new Error(localizeError("Transaction not found.", "लेन-देन नहीं मिला।"));
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
    throw new Error(localizeError(`Update error: ${err.message}. Please try again.`, `अपडेट समस्या: ${err.message}। कृपया पुनः प्रयास करें।`));
  }
};
