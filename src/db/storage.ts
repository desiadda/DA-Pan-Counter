import { LS_KEYS } from "../constants";

// Volatile runtime memory storage (cleared on page reload, completely online-only)
const MEMORY_DB: Record<string, any> = {
  [LS_KEYS.PRODUCTS]: [],
  [LS_KEYS.CUSTOMERS]: [],
  [LS_KEYS.TRANSACTIONS]: [],
  [LS_KEYS.COH_BALANCES]: {},
  [LS_KEYS.COH_TRANSACTIONS]: [],
  "pan_expenses": [],
  "pan_suppliers": [],
  "pan_purchase_orders": [],
  "pan_shifts": [],
  "pan_users": []
};

export const getLocalData = (key: string, fallback: any = null) => {
  if (key in MEMORY_DB) {
    return MEMORY_DB[key] ?? fallback;
  }
  return fallback;
};

export const setLocalData = (key: string, data: any) => {
  MEMORY_DB[key] = data;
};

export const getLocalProducts = () => {
  return MEMORY_DB[LS_KEYS.PRODUCTS] || [];
};

export const getLocalTransactions = () => {
  return MEMORY_DB[LS_KEYS.TRANSACTIONS] || [];
};

export const getLocalCustomers = () => {
  return MEMORY_DB[LS_KEYS.CUSTOMERS] || [];
};
