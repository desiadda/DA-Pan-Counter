import { isFirebaseEnabled, saveConfig, clearConfig, getConfig } from "./config";
import { getProducts, getLowStockCount, getLowStockProducts, saveProduct, deleteProduct } from "./products";
import { getTransactions, addTransaction, deleteTransaction, returnTransaction, updateTransactionPaymentMode } from "./transactions";
import { getCustomers, saveCustomer, updateUdhaarBalance } from "./customers";
import { login, logout, getCurrentUser, onAuthStateChangedListener } from "./auth";
import { getExpenses, addExpense, deleteExpense, EXPENSE_CATEGORIES } from "./expenses";
import {
  getBalance, getAllBalances, adjustBalance,
  initiateTransfer, approveTransfer, rejectTransfer,
  getPendingForUser, getPendingCount,
  getHistoryForUser, getAllTransactions,
} from "./coh";
import { recordPriceChange, getPriceHistory, getAllPriceHistory, clearPriceHistory } from "./priceHistory";
import { getPurchaseOrders, savePurchaseOrder, receivePurchaseOrder, cancelPurchaseOrder } from "./purchases";
import { getSuppliers, saveSupplier, deleteSupplier } from "./suppliers";
import { getOpenShift, getAllShifts, openShift, closeShift, getTodayShiftSummary } from "./shifts";

export const dbService = {
  isFirebase: () => isFirebaseEnabled,
  saveConfig,
  clearConfig,
  getConfig,
  getProducts,
  getLowStockCount,
  getLowStockProducts,
  getPurchaseOrders,
  savePurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder,
  saveProduct,
  deleteProduct,
  getTransactions,
  addTransaction,
  deleteTransaction,
  returnTransaction,
  updateTransactionPaymentMode,
  getCustomers,
  saveCustomer,
  updateUdhaarBalance,
  getExpenses,
  addExpense,
  deleteExpense,
  EXPENSE_CATEGORIES,
  login,
  logout,
  getCurrentUser,
  onAuthStateChangedListener,
  getBalance,
  getAllBalances,
  adjustBalance,
  initiateTransfer,
  approveTransfer,
  rejectTransfer,
  getPendingForUser,
  getPendingCount,
  getHistoryForUser,
  getAllTransactions: getAllTransactions,
  recordPriceChange,
  getPriceHistory,
  getAllPriceHistory,
  clearPriceHistory,
  getOpenShift,
  getAllShifts,
  openShift,
  closeShift,
  getTodayShiftSummary,
  getSuppliers,
  saveSupplier,
  deleteSupplier,
};
