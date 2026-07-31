// Volatile runtime memory storage (cleared on page reload, completely online-only)
const MEMORY_DB: Record<string, any> = {
  pan_products: [],
  pan_customers: [],
  pan_transactions: [],
  pan_coh_balances: {},
  pan_coh_transactions: [],
  pan_expenses: [],
  pan_suppliers: [],
  pan_purchase_orders: [],
  pan_shifts: [],
  pan_users: [],
  pan_banks: [],
  pan_finance_transactions: [],
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
