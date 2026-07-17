import { isFirebaseEnabled, saveConfig, clearConfig, getConfig, migrateLocalDataToFirestore } from "./config";
import { getProducts, getLowStockCount, getLowStockProducts, saveProduct, deleteProduct } from "./products";
import { getTransactions, addTransaction, deleteTransaction, returnTransaction, updateTransactionPaymentMode } from "./transactions";
import { getCustomers, saveCustomer, updateUdhaarBalance } from "./customers";
import { login, logout, getCurrentUser, onAuthStateChangedListener, initUsersListener } from "./auth";
import { getExpenses, addExpense, deleteExpense, EXPENSE_CATEGORIES } from "./expenses";
import {
  getBalance, getAllBalances, adjustBalance,
  initiateTransfer, approveTransfer, rejectTransfer,
  getPendingForUser, getPendingCount,
  getHistoryForUser, getAllTransactions, initCOHListener,
} from "./coh";
import { recordPriceChange, getPriceHistory, getAllPriceHistory, clearPriceHistory } from "./priceHistory";
import { getPurchaseOrders, savePurchaseOrder, receivePurchaseOrder, cancelPurchaseOrder } from "./purchases";
import { getSuppliers, saveSupplier, deleteSupplier, updateSupplierBalance, recordSupplierPayment } from "./suppliers";
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
  initUsersListener,
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
  initCOHListener,
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
  updateSupplierBalance,
  recordSupplierPayment,
  migrateLocalDataToFirestore,
};
