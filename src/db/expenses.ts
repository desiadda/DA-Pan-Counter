import { collection, getDocs, doc, addDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { db, isFirebaseEnabled, localizeError } from "./config";
import { logError } from "./errorLog";
import { getLocalData, setLocalData } from "./storage";
import { logAudit } from "./audit";

const LS_KEY = "pan_expenses";
const EXPENSE_CATEGORIES = ["Rent", "Electricity", "Salary", "Supplies", "Maintenance", "Other"];
export { EXPENSE_CATEGORIES };

let expensesListenerActive = false;

export function initExpensesListener() {
  if (!isFirebaseEnabled || expensesListenerActive) return;
  expensesListenerActive = true;

  onSnapshot(collection(db, "expenses"), (snapshot) => {
    const list = [];
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() });
    });
    setLocalData(LS_KEY, list);
    window.dispatchEvent(new CustomEvent("expenses-changed"));
  });
}

const getLocalExpenses = () => {
  return getLocalData(LS_KEY, []);
};

async function syncExpenseToFirebase(expense) {
  const ref = await addDoc(collection(db, "expenses"), expense);
  return ref.id;
}

async function deleteExpenseFromFirebase(id) {
  await deleteDoc(doc(db, "expenses", id));
}

export const getExpenses = async () => {
  try {
    if (isFirebaseEnabled) {
      const snap = await getDocs(collection(db, "expenses"));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLocalData(LS_KEY, list);
      return list;
    }
    return getLocalExpenses();
  } catch (err) {
    logError("EXPENSE", err.message, err.stack);
    return getLocalExpenses();
  }
};

export const addExpense = async (expense) => {
  try {
    if (isFirebaseEnabled) {
      const fireId = await syncExpenseToFirebase(expense);
      logAudit("expense_added", "expense", fireId, `${expense.category || "Other"} · ฿${(expense.amount || 0).toFixed(2)} · ${expense.description || ""}`, { amount: expense.amount || 0 });
      return fireId;
    }
    throw new Error("Cannot add expense: Firebase is not initialized.");
  } catch (err) {
    logError("EXPENSE", err.message, err.stack);
    throw new Error(localizeError(`Expense error: ${err.message}. Please try again.`, `खर्च समस्या: ${err.message}। कृपया पुनः प्रयास करें।`));
  }
};

export const deleteExpense = async (expenseId) => {
  try {
    if (isFirebaseEnabled) {
      await deleteExpenseFromFirebase(expenseId);
      logAudit("expense_deleted", "expense", expenseId, "Deleted expense entry");
    }
  } catch (err) {
    logError("EXPENSE", err.message, err.stack);
    throw new Error(localizeError(`Delete error: ${err.message}. Please try again.`, `डिलीट समस्या: ${err.message}। कृपया पुनः प्रयास करें।`));
  }
};
