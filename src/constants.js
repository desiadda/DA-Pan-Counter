export const CATEGORIES = ["Paan Special", "Cigarettes", "Mouth Freshner", "Beverages", "Other"];

export const PAYMENT_MODES = ["Cash", "PromptPay", "Bank Transfer", "Udhaar"];

export const ROLES = {
  ADMIN: "admin",
  STAFF: "staff",
};

export const DEFAULT_PRODUCTS = [
  { id: "p1", name: "Meetha Paan", category: "Paan Special", costPrice: 15, sellingPrice: 25, stock: 50, lowStockLimit: 10, barcode: "" },
  { id: "p2", name: "Sada Paan", category: "Paan Special", costPrice: 10, sellingPrice: 20, stock: 40, lowStockLimit: 10, barcode: "" },
  { id: "p3", name: "Banarasi Paan", category: "Paan Special", costPrice: 20, sellingPrice: 35, stock: 30, lowStockLimit: 5, barcode: "" },
  { id: "p4", name: "Marlboro Lights", category: "Cigarettes", costPrice: 8, sellingPrice: 12, stock: 100, lowStockLimit: 20, isCigarette: true, packSize: 20, costPricePack: 150, sellingPricePack: 220, barcode: "" },
  { id: "p6", name: "Vimal Pan Masala", category: "Mouth Freshner", costPrice: 4, sellingPrice: 5, stock: 200, lowStockLimit: 30, barcode: "" },
  { id: "p7", name: "Rajnigandha", category: "Mouth Freshner", costPrice: 16, sellingPrice: 20, stock: 150, lowStockLimit: 20, barcode: "" },
  { id: "p8", name: "Coca Cola 325ml", category: "Beverages", costPrice: 12, sellingPrice: 18, stock: 48, lowStockLimit: 12, barcode: "" },
  { id: "p9", name: "Singha Water 600ml", category: "Beverages", costPrice: 6, sellingPrice: 10, stock: 60, lowStockLimit: 15, barcode: "" },
];

export const LS_KEYS = {
  PRODUCTS: "pan_products",
  TRANSACTIONS: "pan_transactions",
  CUSTOMERS: "pan_customers",
  USER: "pan_user",
  USERS: "pan_users",
  ADMIN_PIN: "pan_admin_pin",
  STAFF_PIN: "pan_staff_pin",
  PROMPTPAY: "pan_promptpay_number",
  FIREBASE_CONFIG: "da_pan_counter_firebase_config",
  TAX_ENABLED: "pan_tax_enabled",
  TAX_RATE: "pan_tax_rate",
  COH_BALANCES: "pan_coh_balances",
  COH_TRANSACTIONS: "pan_coh_transactions",
  DISCOUNT_REASONS: "pan_discount_reasons",
  STORE_SETTINGS: "pan_store_settings",
  PRICE_HISTORY: "pan_price_history",
  QUICK_KEYS: "pan_quick_keys",
};

export const DEFAULT_PERMISSIONS = {
  pos: true,
  stock: false,
  khata: false,
  reports: false,
  expenses: false,
  settings: false,
};

export const ADMIN_PERMISSIONS = {
  pos: true,
  stock: true,
  khata: true,
  reports: true,
  expenses: true,
  settings: true,
};

export const DEFAULT_VAT_RATE = 7;
