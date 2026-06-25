import { LS_KEYS, DEFAULT_PRODUCTS } from "../constants";
import { logError } from "./errorLog";

export const getLocalData = (key, fallback = null) => {
  try {
    const data = localStorage.getItem(key);
    if (data === null) return fallback;
    return JSON.parse(data);
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    console.error(`getLocalData: Error reading key "${key}" from localStorage`, err);
    return fallback;
  }
};

export const setLocalData = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    console.error(`setLocalData: Error saving key "${key}" to localStorage`, err);
    throw new Error(`Storage error (स्टोरेज समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
};

export const getLocalProducts = () => {
  try {
    const data = getLocalData(LS_KEYS.PRODUCTS, null);
    return data ? data : [...DEFAULT_PRODUCTS];
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    console.error("getLocalProducts: Error loading products", err);
    return [...DEFAULT_PRODUCTS];
  }
};

export const getLocalTransactions = () => {
  try {
    return getLocalData(LS_KEYS.TRANSACTIONS, []);
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    console.error("getLocalTransactions: Error loading transactions", err);
    return [];
  }
};

export const getLocalCustomers = () => {
  try {
    return getLocalData(LS_KEYS.CUSTOMERS, []);
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    console.error("getLocalCustomers: Error loading customers", err);
    return [];
  }
};
