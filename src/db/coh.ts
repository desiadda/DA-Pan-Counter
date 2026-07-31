import { doc, setDoc, getDoc, onSnapshot, collection, runTransaction } from "firebase/firestore";
import { db, isFirebaseEnabled, localizeError } from "./config";
import { LS_KEYS } from "../constants";
import { logError } from "./errorLog";
import { getLocalData, setLocalData } from "./storage";

function getBalancesRaw() {
  return getLocalData(LS_KEYS.COH_BALANCES, {});
}

function saveBalancesRaw(data) {
  setLocalData(LS_KEYS.COH_BALANCES, data);
}

function getTransactionsRaw() {
  return getLocalData(LS_KEYS.COH_TRANSACTIONS, []);
}

function saveTransactionsRaw(list) {
  setLocalData(LS_KEYS.COH_TRANSACTIONS, list);
}

let cohListenerActive = false;

export function initCOHListener() {
  if (!isFirebaseEnabled || cohListenerActive) return;
  cohListenerActive = true;

  onSnapshot(collection(db, "coh_balances"), (snapshot) => {
    const balances = {};
    snapshot.forEach(doc => {
      balances[doc.id] = doc.data().balance || 0;
    });
    saveBalancesRaw(balances);
    window.dispatchEvent(new CustomEvent("coh-changed"));
  }, (err) => {
    logError("COH_SYNC", "Balances listener error: " + err.message, err.stack);
  });

  onSnapshot(collection(db, "coh_transactions"), (snapshot) => {
    const txs = [];
    snapshot.forEach(doc => {
      txs.push({ id: doc.id, ...doc.data() });
    });
    txs.sort((a, b) => b.timestamp - a.timestamp);
    saveTransactionsRaw(txs);
    window.dispatchEvent(new CustomEvent("coh-changed"));
  }, (err) => {
    logError("COH_SYNC", "Transactions listener error: " + err.message, err.stack);
  });
}

export function getBalance(userId) {
  const balances = getBalancesRaw();
  return balances[userId] || 0;
}

export function setBalanceLocal(userId, balance) {
  const balances = getBalancesRaw();
  balances[userId] = balance;
  saveBalancesRaw(balances);
}

export function getAllBalances(users) {
  const balances = getBalancesRaw();
  return users.map(u => ({
    id: u.id,
    name: u.name,
    role: u.role,
    coh: balances[u.id] || 0,
  }));
}

export async function adjustBalance(userId, amount, note, adminName) {
  try {
    if (isFirebaseEnabled) {
      await runTransaction(db, async (transaction) => {
        const balRef = doc(db, "coh_balances", userId);
        const balSnap = await transaction.get(balRef);
        const currentBal = balSnap.exists() ? (balSnap.data().balance || 0) : 0;
        const newBal = currentBal + amount;

        const txId = "coh_" + Date.now();
        const txRef = doc(db, "coh_transactions", txId);

        transaction.set(balRef, { balance: newBal });
        transaction.set(txRef, {
          id: txId,
          type: "adjustment",
          fromUserId: "system",
          fromUserName: adminName || "Admin",
          toUserId: userId,
          toUserName: "",
          amount: Math.abs(amount),
          sign: amount >= 0 ? "credit" : "debit",
          note: note || "",
          status: "approved",
          timestamp: Date.now(),
          approvedAt: Date.now(),
        });
      });
    } else {
      const balances = getBalancesRaw();
      const currentBal = balances[userId] || 0;
      const newBal = currentBal + amount;
      balances[userId] = newBal;
      saveBalancesRaw(balances);
      const txs = getTransactionsRaw();
      txs.unshift({
        id: "coh_" + Date.now(),
        type: "adjustment",
        fromUserId: "system",
        fromUserName: adminName || "Admin",
        toUserId: userId,
        toUserName: "",
        amount: Math.abs(amount),
        sign: amount >= 0 ? "credit" : "debit",
        note: note || "",
        status: "approved",
        timestamp: Date.now(),
        approvedAt: Date.now(),
      });
      saveTransactionsRaw(txs);
    }
  } catch (err) {
    logError("COH", err.message, err.stack);
    console.error("adjustBalance: Error adjusting balance", err);
    throw err;
  }
}

export async function initiateTransfer(fromUser, toUserId, toUserName, amount) {
  try {
    const balance = getBalance(fromUser.id);
    if (balance < amount) throw new Error(localizeError("Insufficient COH balance.", "पर्याप्त COH शेष नहीं।"));

    const txId = "coh_" + Date.now();
    const txData = {
      id: txId,
      type: "transfer",
      fromUserId: fromUser.id,
      fromUserName: fromUser.name,
      toUserId,
      toUserName,
      amount,
      status: "pending",
      timestamp: Date.now(),
      approvedAt: null,
    };

    if (isFirebaseEnabled) {
      await setDoc(doc(db, "coh_transactions", txId), txData);
    } else {
      const txs = getTransactionsRaw();
      txs.unshift(txData);
      saveTransactionsRaw(txs);
    }
  } catch (err) {
    logError("COH", err.message, err.stack);
    console.error("initiateTransfer: Error initiating transfer", err);
    throw err;
  }
}

export async function approveTransfer(txId) {
  try {
    if (isFirebaseEnabled) {
      await runTransaction(db, async (transaction) => {
        const txRef = doc(db, "coh_transactions", txId);
        const txSnap = await transaction.get(txRef);
        if (!txSnap.exists()) throw new Error("Transfer not found.");
        const tx = txSnap.data();
        if (tx.status !== "pending") throw new Error(localizeError("Transfer not found or already processed.", "ट्रांसफर नहीं मिला या पहले ही प्रोसेस हो चुका।"));

        const fromRef = doc(db, "coh_balances", tx.fromUserId);
        const toRef = doc(db, "coh_balances", tx.toUserId);

        const [fromSnap, toSnap] = await Promise.all([transaction.get(fromRef), transaction.get(toRef)]);

        const currentFromBal = fromSnap.exists() ? (fromSnap.data().balance || 0) : 0;
        const currentToBal = toSnap.exists() ? (toSnap.data().balance || 0) : 0;

        const newFromBal = currentFromBal - tx.amount;
        const newToBal = currentToBal + tx.amount;

        transaction.set(fromRef, { balance: newFromBal });
        transaction.set(toRef, { balance: newToBal });
        transaction.update(txRef, {
          status: "approved",
          approvedAt: Date.now(),
        });
      });
    } else {
      const txs = getTransactionsRaw();
      const localTx = txs.find(t => t.id === txId);
      if (!localTx || localTx.status !== "pending") throw new Error(localizeError("Transfer not found or already processed.", "ट्रांसफर नहीं मिला या पहले ही प्रोसेस हो चुका।"));
      
      localTx.status = "approved";
      localTx.approvedAt = Date.now();
      saveTransactionsRaw(txs);

      const balances = getBalancesRaw();
      balances[localTx.fromUserId] = (balances[localTx.fromUserId] || 0) - localTx.amount;
      balances[localTx.toUserId] = (balances[localTx.toUserId] || 0) + localTx.amount;
      saveBalancesRaw(balances);
    }
  } catch (err) {
    logError("COH", err.message, err.stack);
    console.error("approveTransfer: Error approving transfer", err);
    throw err;
  }
}

export async function rejectTransfer(txId) {
  try {
    let tx;
    if (isFirebaseEnabled) {
      const txSnap = await getDoc(doc(db, "coh_transactions", txId));
      if (txSnap.exists()) {
        tx = { id: txSnap.id, ...txSnap.data() };
      }
    } else {
      const txs = getTransactionsRaw();
      tx = txs.find(t => t.id === txId);
    }

    if (!tx || tx.status !== "pending") throw new Error(localizeError("Transfer not found or already processed.", "ट्रांसफर नहीं मिला या पहले ही प्रोसेस हो चुका।"));

    if (isFirebaseEnabled) {
      await setDoc(doc(db, "coh_transactions", txId), {
        ...tx,
        status: "rejected",
        approvedAt: Date.now(),
      });
    } else {
      const txs = getTransactionsRaw();
      const localTx = txs.find(t => t.id === txId);
      if (localTx) {
        localTx.status = "rejected";
        localTx.approvedAt = Date.now();
        saveTransactionsRaw(txs);
      }
    }
  } catch (err) {
    logError("COH", err.message, err.stack);
    console.error("rejectTransfer: Error rejecting transfer", err);
    throw err;
  }
}

export function getPendingForUser(userId) {
  try {
    return getTransactionsRaw().filter(t => t.toUserId === userId && t.status === "pending");
  } catch (err) {
    logError("COH", err.message, err.stack);
    console.error("getPendingForUser: Error getting pending transfers", err);
    return [];
  }
}

export function getPendingCount(userId) {
  try {
    return getPendingForUser(userId).length;
  } catch (err) {
    logError("COH", err.message, err.stack);
    console.error("getPendingCount: Error getting pending count", err);
    return 0;
  }
}

export function getHistoryForUser(userId) {
  try {
    return getTransactionsRaw().filter(t =>
      t.fromUserId === userId || t.toUserId === userId
    );
  } catch (err) {
    logError("COH", err.message, err.stack);
    console.error("getHistoryForUser: Error getting COH history", err);
    return [];
  }
}

export function getAllTransactions() {
  try {
    return getTransactionsRaw();
  } catch (err) {
    logError("COH", err.message, err.stack);
    console.error("getAllTransactions: Error getting all COH transactions", err);
    return [];
  }
}
