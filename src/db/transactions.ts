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

        // --- READ PHASE ---

        // A. Read cashier COH balance if Cash
        let currentCohBal = 0;
        let balRef = null;
        if (transaction.paymentMode === "Cash") {
          const cashierId = transaction.cashierId || "system";
          balRef = doc(db, "coh_balances", cashierId);
          const balSnap = await firestoreTx.get(balRef);
          currentCohBal = balSnap.exists() ? (balSnap.data().balance || 0) : 0;
        }

        // B. Read all product states
        const prodDataList = [];
        for (let item of transaction.items) {
          const prodRef = doc(db, "products", item.realProductId || item.productId);
          const prodSnap = await firestoreTx.get(prodRef);
          prodDataList.push({ item, prodRef, prodSnap });
        }

        // --- WRITE PHASE ---

        // A. Adjust Cash on Hand
        if (transaction.paymentMode === "Cash" && balRef) {
          const newBal = currentCohBal + transaction.totalAmount;
          const cohTxId = "coh_" + Date.now();
          const cohTxRef = doc(db, "coh_transactions", cohTxId);

          firestoreTx.set(balRef, { balance: newBal });
          firestoreTx.set(cohTxRef, {
            id: cohTxId,
            type: "sale",
            fromUserId: "customer",
            fromUserName: "Customer",
            toUserId: transaction.cashierId || "system",
            toUserName: transaction.cashierName || "Cashier",
            amount: transaction.totalAmount,
            sign: "credit",
            note: `Cash sale: Bill ${txId}`,
            status: "approved",
            timestamp: Date.now(),
            approvedAt: Date.now(),
          });
        }

        // B. Update stock levels for each item and deduct from batches (FIFO)
        let totalCostOfSales = 0;
        for (const { item, prodRef, prodSnap } of prodDataList) {
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

        // C. Save the transaction invoice
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

    if (isFirebaseEnabled) {
      await runTransaction(db, async (firestoreTx) => {
        const returnTxId = "ret_" + Date.now();
        const returnTxRef = doc(db, "transactions", returnTxId);

        // --- READ PHASE ---

        // A. Read cashier COH balance if Cash
        let currentCohBal = 0;
        let balRef = null;
        if (originalTx.paymentMode === "Cash") {
          const cashierId = userId || originalTx.cashierId || "system";
          balRef = doc(db, "coh_balances", cashierId);
          const balSnap = await firestoreTx.get(balRef);
          currentCohBal = balSnap.exists() ? (balSnap.data().balance || 0) : 0;
        }

        // B. Read all product states
        const prodDataList = [];
        for (const item of returnItems) {
          const prodRef = doc(db, "products", item.realProductId || item.productId);
          const prodSnap = await firestoreTx.get(prodRef);
          prodDataList.push({ item, prodRef, prodSnap });
        }

        // --- WRITE PHASE ---

        // A. Adjust Cash on Hand
        if (originalTx.paymentMode === "Cash" && balRef) {
          const newBal = currentCohBal - returnAmount;
          const cohTxId = "coh_" + Date.now();
          const cohTxRef = doc(db, "coh_transactions", cohTxId);

          firestoreTx.set(balRef, { balance: newBal });
          firestoreTx.set(cohTxRef, {
            id: cohTxId,
            type: "expense",
            fromUserId: userId || originalTx.cashierId || "system",
            fromUserName: userName || originalTx.cashierName || "System",
            toUserId: "customer",
            toUserName: "Customer",
            amount: returnAmount,
            sign: "debit",
            note: `Refund: Bill ${originalTx.id}`,
            status: "approved",
            timestamp: Date.now(),
            approvedAt: Date.now(),
          });
        }

        // B. Restore stock levels and create return batches
        for (const { item, prodRef, prodSnap } of prodDataList) {
          if (prodSnap.exists()) {
            const prod = prodSnap.data();
            const unitQty = item.isPack ? item.returnQty * (item.packSize || 20) : item.returnQty;
            const unitCost = prod.costPrice || 0;

            const returnBatch = {
              id: "b_ret_" + returnTxId + "_" + Math.random().toString(36).substring(2),
              costPrice: unitCost,
              quantity: unitQty,
              createdAt: Date.now()
            };

            const updatedBatches = [...(prod.batches || []), returnBatch];
            const newStock = (prod.stock || 0) + unitQty;

            const updates: any = {
              batches: updatedBatches,
              stock: newStock
            };

            if (prod.isCigarette) {
              const packSize = prod.packSize || 20;
              updates.stockPack = Math.floor(newStock / packSize);
              updates.stockLoose = newStock % packSize;
            }

            firestoreTx.update(prodRef, updates);
          }
        }

        // C. Write Return invoice doc
        const returnTx = {
          id: returnTxId,
          originalBillId: originalTx.id,
          type: "return",
          timestamp: Date.now(),
          items: returnItems.map(item => ({
            productId: item.productId,
            realProductId: item.realProductId || item.productId,
            name: item.name,
            quantity: item.returnQty,
            isPack: item.isPack || false,
            packSize: item.packSize || 20,
            sellingPrice: item.sellingPrice,
          })),
          returnAmount,
          reason: reason || "Customer return",
          cashierId: userId || originalTx.cashierId,
          cashierName: userName || originalTx.cashierName,
          originalPaymentMode: originalTx.paymentMode,
        };

        firestoreTx.set(returnTxRef, returnTx);
      });
    } else {
      const returnTx = {
        id: "ret_" + Date.now(), originalBillId: originalTx.id, type: "return", timestamp: Date.now(),
        items: returnItems.map(item => ({ ...item, quantity: item.returnQty })),
        returnAmount, reason: reason || "Customer return",
        cashierId: userId || originalTx.cashierId, cashierName: userName || originalTx.cashierName,
        originalPaymentMode: originalTx.paymentMode,
      };
      return returnTx;
    }
  } catch (err) {
    logError("TRANSACTION", err.message, err.stack);
    throw new Error(localizeError(`Return error: ${err.message}. Please try again.`, `रिटर्न समस्या: ${err.message}। कृपया पुनः प्रयास करें।`));
  }
};

export const updateTransactionPaymentMode = async (transactionId, newMode, changedBy) => {
  try {
    if (isFirebaseEnabled) {
      await runTransaction(db, async (firestoreTx) => {
        const docRef = doc(db, "transactions", transactionId);
        const docSnap = await firestoreTx.get(docRef);
        if (!docSnap.exists()) throw new Error(localizeError("Transaction not found.", "लेन-देन नहीं मिला।"));
        const tx = { id: docSnap.id, ...docSnap.data() };
        if (tx.paymentMode === newMode) return;

        // --- READ PHASE ---

        // 1. Read cashier COH balance if switching to/from Cash
        let currentBal = 0;
        let balRef = null;
        if (tx.paymentMode === "Cash" || newMode === "Cash") {
          const cashierId = tx.cashierId || "system";
          balRef = doc(db, "coh_balances", cashierId);
          const balSnap = await firestoreTx.get(balRef);
          currentBal = balSnap.exists() ? (balSnap.data().balance || 0) : 0;
        }

        // 2. Read customer credit state if switching to/from Udhaar
        let custRef = null;
        let custSnap = null;
        if ((tx.paymentMode === "Udhaar" || newMode === "Udhaar") && tx.customerId) {
          custRef = doc(db, "customers", tx.customerId);
          custSnap = await firestoreTx.get(custRef);
        }

        // --- WRITE PHASE ---

        // 1. Adjust Cash on Hand
        if (tx.paymentMode === "Cash" && balRef) {
          const newBal = currentBal - tx.totalAmount;
          const cohTxId = "coh_" + Date.now();
          const cohTxRef = doc(db, "coh_transactions", cohTxId);

          firestoreTx.set(balRef, { balance: newBal });
          firestoreTx.set(cohTxRef, {
            id: cohTxId,
            type: "expense",
            fromUserId: tx.cashierId || "system",
            fromUserName: tx.cashierName || "System",
            toUserId: "system",
            toUserName: "System",
            amount: tx.totalAmount,
            sign: "debit",
            note: `Payment mode change from Cash to ${newMode}: Bill ${transactionId}`,
            status: "approved",
            timestamp: Date.now(),
            approvedAt: Date.now(),
          });
        } else if (newMode === "Cash" && balRef) {
          const newBal = currentBal + tx.totalAmount;
          const cohTxId = "coh_" + Date.now();
          const cohTxRef = doc(db, "coh_transactions", cohTxId);

          firestoreTx.set(balRef, { balance: newBal });
          firestoreTx.set(cohTxRef, {
            id: cohTxId,
            type: "sale",
            fromUserId: "system",
            fromUserName: "System",
            toUserId: tx.cashierId || "system",
            toUserName: tx.cashierName || "System",
            amount: tx.totalAmount,
            sign: "credit",
            note: `Payment mode change from ${tx.paymentMode} to Cash: Bill ${transactionId}`,
            status: "approved",
            timestamp: Date.now(),
            approvedAt: Date.now(),
          });
        }

        // 2. Adjust customer's credit balance
        if (tx.paymentMode === "Udhaar" && custRef && custSnap && custSnap.exists()) {
          const custData = custSnap.data();
          const curCustBal = custData.balance || 0;
          const currentLedger = custData.ledger || [];
          const newBal = curCustBal - tx.totalAmount;
          const newLedger = [...currentLedger, {
            date: Date.now(),
            type: "Adjustment",
            amount: -tx.totalAmount,
            description: `Payment mode changed from Udhaar to ${newMode} for Bill ${transactionId}`
          }];
          firestoreTx.update(custRef, { balance: newBal, ledger: newLedger });
        } else if (newMode === "Udhaar" && custRef && custSnap && custSnap.exists()) {
          const custData = custSnap.data();
          const curCustBal = custData.balance || 0;
          const currentLedger = custData.ledger || [];
          const newBal = curCustBal + tx.totalAmount;
          const newLedger = [...currentLedger, {
            date: Date.now(),
            type: "Purchase",
            amount: tx.totalAmount,
            description: `Payment mode changed from ${tx.paymentMode} to Udhaar for Bill ${transactionId}`
          }];
          firestoreTx.update(custRef, { balance: newBal, ledger: newLedger });
        }

        // 3. Update the transaction
        tx.paymentMode = newMode;
        tx.editedAt = Date.now();
        tx.editedBy = changedBy || "System";

        firestoreTx.set(docRef, tx);
      });
    }
  } catch (err) {
    logError("TRANSACTION", err.message, err.stack);
    throw new Error(localizeError(`Update error: ${err.message}. Please try again.`, `अपडेट समस्या: ${err.message}। कृपया पुनः प्रयास करें।`));
  }
};
