import { collection, getDocs, doc, addDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";
import { logError } from "./errorLog";

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
    localStorage.setItem(LS_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("expenses-changed"));
  });
}

const getLocalExpenses = () => {
  try {
    const data = localStorage.getItem(LS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    logError("EXPENSE", err.message, err.stack);
    return [];
  }
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
      localStorage.setItem(LS_KEY, JSON.stringify(list));
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
      return fireId;
    }
    throw new Error("Cannot add expense: Firebase is not initialized.");
  } catch (err) {
    logError("EXPENSE", err.message, err.stack);
    throw new Error(`Expense error (खर्च समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
};

export const deleteExpense = async (expenseId) => {
  try {
    if (isFirebaseEnabled) {
      await deleteExpenseFromFirebase(expenseId);
    }
  } catch (err) {
    logError("EXPENSE", err.message, err.stack);
    throw new Error(`Delete error (डिलीट समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
};
