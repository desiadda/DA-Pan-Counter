import { collection, doc, getDocs, addDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";
import { logError } from "./errorLog";

const LS_KEY = "pan_expenses";

const getLocalExpenses = () => {
  try {
    const data = localStorage.getItem(LS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    logError("EXPENSE", err.message, err.stack);
    console.error("getLocalExpenses: Error reading expenses from localStorage", err);
    return [];
  }
};

const EXPENSE_CATEGORIES = ["Rent", "Electricity", "Salary", "Supplies", "Maintenance", "Other"];

export { EXPENSE_CATEGORIES };

export const getExpenses = async () => {
  try {
    if (isFirebaseEnabled) {
      try {
        const q = query(collection(db, "expenses"), orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        const list = [];
        snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
        return list;
      } catch (err) {
        logError("EXPENSE", err.message, err.stack);
        console.error("Firebase getExpenses error", err);
        return getLocalExpenses();
      }
    }
    return getLocalExpenses();
  } catch (err) {
    logError("EXPENSE", err.message, err.stack);
    console.error("getExpenses: Unexpected error", err);
    return [];
  }
};

export const addExpense = async (expense) => {
  try {
    if (isFirebaseEnabled) {
      const docRef = await addDoc(collection(db, "expenses"), expense);
      return docRef.id;
    }
    const expenses = getLocalExpenses();
    expense.id = "exp_" + Date.now();
    expenses.unshift(expense);
    localStorage.setItem(LS_KEY, JSON.stringify(expenses));
    return expense.id;
  } catch (err) {
    logError("EXPENSE", err.message, err.stack);
    console.error("addExpense: Error saving expense", err);
    throw new Error(`Expense error (खर्च समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
};

export const deleteExpense = async (expenseId) => {
  try {
    if (isFirebaseEnabled) {
      await deleteDoc(doc(db, "expenses", expenseId));
    } else {
      const expenses = getLocalExpenses().filter((e) => e.id !== expenseId);
      localStorage.setItem(LS_KEY, JSON.stringify(expenses));
    }
  } catch (err) {
    logError("EXPENSE", err.message, err.stack);
    console.error("deleteExpense: Error deleting expense", err);
    throw new Error(`Delete error (डिलीट समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
};
