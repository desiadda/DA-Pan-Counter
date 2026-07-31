import { doc, setDoc, deleteDoc, getDocs, onSnapshot, collection, runTransaction, writeBatch } from "firebase/firestore";
import { db, isFirebaseEnabled, localizeError } from "./config";
import { LS_KEYS } from "../constants";
import { logError } from "./errorLog";
import { getLocalData, setLocalData } from "./storage";
import { getBalance, setBalanceLocal } from "./coh";

function getBanksRaw() {
  return getLocalData(LS_KEYS.BANKS, []);
}

function saveBanksRaw(list) {
  setLocalData(LS_KEYS.BANKS, list);
}

function getTxRaw() {
  return getLocalData(LS_KEYS.FINANCE_TRANSACTIONS, []);
}

function saveTxRaw(list) {
  setLocalData(LS_KEYS.FINANCE_TRANSACTIONS, list);
}

let financeListenerActive = false;

export function initFinanceListener() {
  if (!isFirebaseEnabled || financeListenerActive) return;
  financeListenerActive = true;

  onSnapshot(collection(db, "banks"), (snapshot) => {
    const list = [];
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() });
    });
    saveBanksRaw(list);
    window.dispatchEvent(new CustomEvent("finance-changed"));
  }, (err) => {
    logError("FINANCE", "Banks listener error: " + err.message, err.stack);
  });

  onSnapshot(collection(db, "finance_transactions"), (snapshot) => {
    const txs = [];
    snapshot.forEach(doc => {
      txs.push({ id: doc.id, ...doc.data() });
    });
    txs.sort((a, b) => b.timestamp - a.timestamp);
    saveTxRaw(txs);
    window.dispatchEvent(new CustomEvent("finance-changed"));
  }, (err) => {
    logError("FINANCE", "Transactions listener error: " + err.message, err.stack);
  });
}

export function getBanks() {
  return getBanksRaw();
}

export function getFinanceTransactions() {
  return getTxRaw();
}

export async function addBank(name, balance) {
  try {
    const trimmed = (name || "").trim();
    if (!trimmed) throw new Error(localizeError("Bank name is required.", "बैंक का नाम आवश्यक है।"));
    const bal = parseFloat(balance);
    if (isNaN(bal) || bal < 0) throw new Error(localizeError("Enter a valid opening balance.", "मान्य शुरुआती बैलेंस डालें।"));

    if (isFirebaseEnabled) {
      await setDoc(doc(db, "banks", "bank_" + Date.now()), {
        name: trimmed,
        balance: bal,
        createdAt: Date.now(),
      });
    } else {
      const list = getBanksRaw();
      list.push({ id: "bank_" + Date.now(), name: trimmed, balance: bal, createdAt: Date.now() });
      saveBanksRaw(list);
      window.dispatchEvent(new CustomEvent("finance-changed"));
    }
  } catch (err) {
    logError("FINANCE", err.message, err.stack);
    console.error("addBank: Error adding bank", err);
    throw err;
  }
}

export async function updateBank(id, name, balance) {
  try {
    const trimmed = (name || "").trim();
    if (!trimmed) throw new Error(localizeError("Bank name is required.", "बैंक का नाम आवश्यक है।"));
    const bal = parseFloat(balance);
    if (isNaN(bal) || bal < 0) throw new Error(localizeError("Enter a valid balance.", "मान्य बैलेंस डालें।"));

    if (isFirebaseEnabled) {
      await setDoc(doc(db, "banks", id), { name: trimmed, balance: bal }, { merge: true });
    } else {
      const list = getBanksRaw();
      const idx = list.findIndex(b => b.id === id);
      if (idx !== -1) {
        list[idx].name = trimmed;
        list[idx].balance = bal;
        saveBanksRaw(list);
        window.dispatchEvent(new CustomEvent("finance-changed"));
      }
    }
  } catch (err) {
    logError("FINANCE", err.message, err.stack);
    console.error("updateBank: Error updating bank", err);
    throw err;
  }
}

export async function deleteBank(id) {
  try {
    if (isFirebaseEnabled) {
      await deleteDoc(doc(db, "banks", id));
    } else {
      saveBanksRaw(getBanksRaw().filter(b => b.id !== id));
      window.dispatchEvent(new CustomEvent("finance-changed"));
    }
  } catch (err) {
    logError("FINANCE", err.message, err.stack);
    console.error("deleteBank: Error deleting bank", err);
    throw err;
  }
}

export async function financeTransfer({ fromType, fromId, fromName, toType, toId, toName, amount, note, actor }) {
  try {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) throw new Error(localizeError("Enter a valid amount.", "मान्य राशि डालें।"));
    if (fromType === toType && fromId === toId) throw new Error(localizeError("Source and target cannot be the same.", "स्रोत और लक्ष्य एक जैसे नहीं हो सकते।"));
    if (!fromId || !toId || !fromName || !toName) throw new Error(localizeError("Select valid source and target.", "मान्य स्रोत और लक्ष्य चुनें।"));

    const txId = "fin_" + Date.now();
    const txData = {
      id: txId,
      type: "transfer",
      fromType,
      fromId,
      fromName,
      toType,
      toId,
      toName,
      amount: amt,
      note: note || "",
      timestamp: Date.now(),
      actor: actor || "Admin",
    };

    if (isFirebaseEnabled) {
      await runTransaction(db, async (transaction) => {
        const fromRef = fromType === "bank" ? doc(db, "banks", fromId) : doc(db, "coh_balances", fromId);
        const toRef = toType === "bank" ? doc(db, "banks", toId) : doc(db, "coh_balances", toId);

        const [fromSnap, toSnap] = await Promise.all([transaction.get(fromRef), transaction.get(toRef)]);

        const fromBal = fromSnap.exists() ? (fromSnap.data().balance || 0) : 0;
        const toBal = toSnap.exists() ? (toSnap.data().balance || 0) : 0;

        if (fromBal < amt) throw new Error(localizeError("Insufficient balance in source.", "स्रोत में पर्याप्त बैलेंस नहीं।"));

        transaction.set(fromRef, { balance: fromBal - amt }, { merge: true });
        transaction.set(toRef, { balance: toBal + amt }, { merge: true });
        transaction.set(doc(db, "finance_transactions", txId), txData);
      });
    } else {
      let fromBal, toBal;
      if (fromType === "bank") {
        const bank = getBanksRaw().find(b => b.id === fromId);
        fromBal = bank ? bank.balance : 0;
      } else {
        fromBal = getBalance(fromId);
      }
      if (toType === "bank") {
        const bank = getBanksRaw().find(b => b.id === toId);
        toBal = bank ? bank.balance : 0;
      } else {
        toBal = getBalance(toId);
      }

      if (fromBal < amt) throw new Error(localizeError("Insufficient balance in source.", "स्रोत में पर्याप्त बैलेंस नहीं।"));

      if (fromType === "bank") {
        const banks = getBanksRaw();
        const idx = banks.findIndex(b => b.id === fromId);
        if (idx !== -1) {
          banks[idx].balance = fromBal - amt;
          saveBanksRaw(banks);
        }
      } else {
        setBalanceLocal(fromId, fromBal - amt);
      }

      if (toType === "bank") {
        const banks = getBanksRaw();
        const idx = banks.findIndex(b => b.id === toId);
        if (idx !== -1) {
          banks[idx].balance = toBal + amt;
          saveBanksRaw(banks);
        }
      } else {
        setBalanceLocal(toId, toBal + amt);
      }

      const txs = getTxRaw();
      txs.unshift(txData);
      saveTxRaw(txs);
      window.dispatchEvent(new CustomEvent("coh-changed"));
      window.dispatchEvent(new CustomEvent("finance-changed"));
    }
  } catch (err) {
    logError("FINANCE", err.message, err.stack);
    console.error("financeTransfer: Error transferring", err);
    throw err;
  }
}
