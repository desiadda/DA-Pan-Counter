import { collection, doc, setDoc, addDoc, deleteDoc, getDocs, onSnapshot } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";
import { logError } from "./errorLog";
import { getLocalData, setLocalData } from "./storage";
import { logAudit } from "./audit";

const LS_ACCOUNTS = "pan_coa_accounts";
const LS_ENTRIES = "pan_coa_entries";

export const ACCOUNT_TYPES = ["asset", "liability", "equity", "income", "expense"] as const;

export const SYSTEM_ACCOUNTS = [
  { code: "1010", name: "Cash on Hand", type: "asset", source: "coh", description: "Total cash across all users" },
  { code: "1020", name: "Bank Accounts", type: "asset", source: "bank", description: "Total balance in bank accounts" },
  { code: "1030", name: "Udhaar Receivable", type: "asset", source: "receivable", description: "Money owed by customers (khata)" },
  { code: "1040", name: "Inventory Stock", type: "asset", source: "inventory", description: "Value of products in stock" },
  { code: "2010", name: "Accounts Payable", type: "liability", source: "payable", description: "Money owed to suppliers" },
  { code: "4010", name: "Sales Revenue", type: "income", source: "sales", description: "Total approved sales" },
  { code: "5010", name: "Operating Expenses", type: "expense", source: "expenses", description: "Total business expenses" },
];

const defaultAccounts = () =>
  SYSTEM_ACCOUNTS.map(a => ({
    id: "sys_" + a.code,
    ...a,
    system: true,
    openingBalance: 0,
    createdAt: Date.now(),
  }));

async function syncAccountToFirebase(account) {
  const { id, ...data } = account;
  await setDoc(doc(db, "coa_accounts", id), data);
}

export const getAccounts = async () => {
  try {
    if (isFirebaseEnabled) {
      const snap = await getDocs(collection(db, "coa_accounts"));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (list.length === 0) {
        const seeded = defaultAccounts();
        await Promise.all(seeded.map(syncAccountToFirebase));
        return seeded;
      }
      return list;
    }
    let list = getLocalData(LS_ACCOUNTS, null);
    if (!list || !Array.isArray(list) || list.length === 0) {
      list = defaultAccounts();
      setLocalData(LS_ACCOUNTS, list);
    }
    return Array.isArray(list) ? list : defaultAccounts();
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    const fallback = getLocalData(LS_ACCOUNTS, defaultAccounts());
    return Array.isArray(fallback) ? fallback : defaultAccounts();
  }
};

export const saveAccount = async (account) => {
  try {
    if (isFirebaseEnabled) {
      await syncAccountToFirebase(account);
    } else {
      let list = getLocalData(LS_ACCOUNTS, defaultAccounts());
      if (!Array.isArray(list)) list = defaultAccounts();
      if (account.id) {
        const idx = list.findIndex(a => a.id === account.id);
        if (idx !== -1) list[idx] = { ...list[idx], ...account };
        else list.push(account);
      } else {
        account.id = "acc_" + Date.now();
        account.createdAt = Date.now();
        list.push(account);
      }
      setLocalData(LS_ACCOUNTS, list);
    }
    logAudit(account.id ? "coa_account_updated" : "coa_account_created", "coa_account", account.id || "", `${account.code} · ${account.name}`);
    return account;
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    throw err;
  }
};

export const deleteAccount = async (id) => {
  try {
    if (isFirebaseEnabled) {
      await deleteDoc(doc(db, "coa_accounts", id));
      const entriesSnap = await getDocs(collection(db, "coa_entries"));
      const toDelete = entriesSnap.docs.filter(d => d.data().accountId === id);
      await Promise.all(toDelete.map(d => deleteDoc(doc(db, "coa_entries", d.id))));
    } else {
      let list = getLocalData(LS_ACCOUNTS, defaultAccounts());
      if (!Array.isArray(list)) list = defaultAccounts();
      list = list.filter(a => a.id !== id);
      setLocalData(LS_ACCOUNTS, list);
      let entries = getLocalData(LS_ENTRIES, []);
      if (!Array.isArray(entries)) entries = [];
      entries = entries.filter(e => e.accountId !== id);
      setLocalData(LS_ENTRIES, entries);
    }
    logAudit("coa_account_deleted", "coa_account", id, "Account deleted");
    return true;
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    throw err;
  }
};

export const getEntries = async () => {
  try {
    if (isFirebaseEnabled) {
      const snap = await getDocs(collection(db, "coa_entries"));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.date || 0) - (b.date || 0));
      return list;
    }
    const list = getLocalData(LS_ENTRIES, []);
    const arr = Array.isArray(list) ? list : [];
    arr.sort((a, b) => (a.date || 0) - (b.date || 0));
    return arr;
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    const list = getLocalData(LS_ENTRIES, []);
    return Array.isArray(list) ? list : [];
  }
};

export const addEntry = async (entry) => {
  try {
    entry.date = entry.date || Date.now();
    if (isFirebaseEnabled) {
      const ref = await addDoc(collection(db, "coa_entries"), entry);
      entry.id = ref.id;
    } else {
      const list = getLocalData(LS_ENTRIES, []);
      entry.id = "ce_" + Date.now();
      list.push(entry);
      setLocalData(LS_ENTRIES, list);
    }
    logAudit("coa_entry_added", "coa_entry", entry.id, `Account ${entry.accountId} · ฿${(entry.debit || 0).toFixed(2)}/฿${(entry.credit || 0).toFixed(2)} · ${entry.note || ""}`, { amount: (entry.debit || 0) + (entry.credit || 0) });
    return entry;
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    throw err;
  }
};

export const deleteEntry = async (id) => {
  try {
    if (isFirebaseEnabled) {
      await deleteDoc(doc(db, "coa_entries", id));
    } else {
      const list = getLocalData(LS_ENTRIES, []);
      setLocalData(LS_ENTRIES, list.filter(e => e.id !== id));
    }
    logAudit("coa_entry_deleted", "coa_entry", id, "Entry deleted");
    return true;
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    throw err;
  }
};

let coaListenerActive = false;

export function initCOAListener() {
  if (!isFirebaseEnabled || !db || coaListenerActive) return () => {};
  coaListenerActive = true;

  const unsub1 = onSnapshot(collection(db, "coa_accounts"), (snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (list.length > 0) {
      setLocalData(LS_ACCOUNTS, list);
    }
    window.dispatchEvent(new CustomEvent("coa-changed"));
  }, (err) => logError("STORAGE", err.message, err.stack));

  const unsub2 = onSnapshot(collection(db, "coa_entries"), (snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setLocalData(LS_ENTRIES, list);
    window.dispatchEvent(new CustomEvent("coa-changed"));
  }, (err) => logError("STORAGE", err.message, err.stack));

  return () => {
    unsub1();
    unsub2();
    coaListenerActive = false;
  };
}
