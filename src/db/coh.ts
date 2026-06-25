import { LS_KEYS } from "../constants";
import { logError } from "./errorLog";

function getBalancesRaw() {
  try {
    const raw = localStorage.getItem(LS_KEYS.COH_BALANCES);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    logError("COH", err.message, err.stack);
    console.error("getBalancesRaw: Error reading COH balances", err);
    return {};
  }
}

function saveBalancesRaw(data) {
  try {
    localStorage.setItem(LS_KEYS.COH_BALANCES, JSON.stringify(data));
  } catch (err) {
    logError("COH", err.message, err.stack);
    console.error("saveBalancesRaw: Error saving COH balances", err);
    throw new Error(`Storage error (स्टोरेज समस्या): COH balances save failed. ${err.message}. कृपया पुनः प्रयास करें।`);
  }
}

function getTransactionsRaw() {
  try {
    const raw = localStorage.getItem(LS_KEYS.COH_TRANSACTIONS);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    logError("COH", err.message, err.stack);
    console.error("getTransactionsRaw: Error reading COH transactions", err);
    return [];
  }
}

function saveTransactionsRaw(list) {
  try {
    localStorage.setItem(LS_KEYS.COH_TRANSACTIONS, JSON.stringify(list));
  } catch (err) {
    logError("COH", err.message, err.stack);
    console.error("saveTransactionsRaw: Error saving COH transactions", err);
    throw new Error(`Storage error (स्टोरेज समस्या): COH transactions save failed. ${err.message}. कृपया पुनः प्रयास करें।`);
  }
}

export function getBalance(userId) {
  try {
    const balances = getBalancesRaw();
    return balances[userId] || 0;
  } catch (err) {
    logError("COH", err.message, err.stack);
    console.error("getBalance: Error getting COH balance", err);
    return 0;
  }
}

export function getAllBalances(users) {
  try {
    const balances = getBalancesRaw();
    return users.map(u => ({
      ...u,
      coh: balances[u.id] || 0,
    }));
  } catch (err) {
    logError("COH", err.message, err.stack);
    console.error("getAllBalances: Error getting all COH balances", err);
    return users.map(u => ({ ...u, coh: 0 }));
  }
}

export function adjustBalance(userId, amount, note, adminName) {
  try {
    const balances = getBalancesRaw();
    balances[userId] = (balances[userId] || 0) + amount;
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
  } catch (err) {
    logError("COH", err.message, err.stack);
    console.error("adjustBalance: Error adjusting COH balance", err);
    throw new Error(`COH error (COH समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
}

export function initiateTransfer(fromUser, toUserId, toUserName, amount) {
  try {
    const balance = getBalance(fromUser.id);
    if (balance < amount) throw new Error("Insufficient COH balance (पर्याप्त COH शेष नहीं).");

    const txs = getTransactionsRaw();
    txs.unshift({
      id: "coh_" + Date.now(),
      type: "transfer",
      fromUserId: fromUser.id,
      fromUserName: fromUser.name,
      toUserId,
      toUserName,
      amount,
      status: "pending",
      timestamp: Date.now(),
      approvedAt: null,
    });
    saveTransactionsRaw(txs);
  } catch (err) {
    logError("COH", err.message, err.stack);
    console.error("initiateTransfer: Error initiating transfer", err);
    throw err;
  }
}

export function approveTransfer(txId) {
  try {
    const txs = getTransactionsRaw();
    const tx = txs.find(t => t.id === txId);
    if (!tx || tx.status !== "pending") throw new Error("Transfer not found or already processed (ट्रांसफर नहीं मिला या पहले ही प्रोसेस हो चुका).");

    tx.status = "approved";
    tx.approvedAt = Date.now();
    saveTransactionsRaw(txs);

    const balances = getBalancesRaw();
    balances[tx.fromUserId] = (balances[tx.fromUserId] || 0) - tx.amount;
    balances[tx.toUserId] = (balances[tx.toUserId] || 0) + tx.amount;
    saveBalancesRaw(balances);
  } catch (err) {
    logError("COH", err.message, err.stack);
    console.error("approveTransfer: Error approving transfer", err);
    throw err;
  }
}

export function rejectTransfer(txId) {
  try {
    const txs = getTransactionsRaw();
    const tx = txs.find(t => t.id === txId);
    if (!tx || tx.status !== "pending") throw new Error("Transfer not found or already processed (ट्रांसफर नहीं मिला या पहले ही प्रोसेस हो चुका).");

    tx.status = "rejected";
    tx.approvedAt = Date.now();
    saveTransactionsRaw(txs);
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
