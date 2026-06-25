import { collection, doc, getDocs, addDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";
import { logError } from "./errorLog";
import { addToSyncQueue } from "./sync";

const LS_KEY = "pan_expenses";
const EXPENSE_CATEGORIES = ["Rent", "Electricity", "Salary", "Supplies", "Maintenance", "Other"];
export { EXPENSE_CATEGORIES };

const getLocalExpenses = () => {
  try {
    const data = localStorage.getItem(LS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    logError("EXPENSE", err.message, err.stack);
    return [];
  }
};

function syncExpenseToFirebase(expense) {
  return addDoc(collection(db, "expenses"), expense);
}

function deleteExpenseFromFirebase(id) {
  return deleteDoc(doc(db, "expenses", id));
}

export const getExpenses = async () => {
  try {
    if (isFirebaseEnabled) {
      try {
        const q = query(collection(db, "expenses"), orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        const list = [];
        snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
        return list;
      } catch (err) {
        logError("EXPENSE", err.message, err.stack);
        return getLocalExpenses();
      }
    }
    return getLocalExpenses();
  } catch (err) {
    logError("EXPENSE", err.message, err.stack);
    return [];
  }
};

export const addExpense = async (expense) => {
  try {
    const expenses = getLocalExpenses();
    expense.id = "exp_" + Date.now();
    expenses.unshift(expense);
    localStorage.setItem(LS_KEY, JSON.stringify(expenses));

    if (isFirebaseEnabled) {
      syncExpenseToFirebase(expense).catch(() => addToSyncQueue({ fn: () => syncExpenseToFirebase(expense) }));
    }
    return expense.id;
  } catch (err) {
    logError("EXPENSE", err.message, err.stack);
    throw new Error(`Expense error (खर्च समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
};

export const deleteExpense = async (expenseId) => {
  try {
    const expenses = getLocalExpenses().filter(e => e.id !== expenseId);
    localStorage.setItem(LS_KEY, JSON.stringify(expenses));

    if (isFirebaseEnabled) {
      deleteExpenseFromFirebase(expenseId).catch(() => addToSyncQueue({ fn: () => deleteExpenseFromFirebase(expenseId) }));
    }
  } catch (err) {
    logError("EXPENSE", err.message, err.stack);
    throw new Error(`Delete error (डिलीट समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
};
