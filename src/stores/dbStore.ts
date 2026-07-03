import { create } from "zustand";

interface DBState {
  products: any[];
  customers: any[];
  transactions: any[];
  setProducts: (list: any[]) => void;
  setCustomers: (list: any[]) => void;
  setTransactions: (list: any[]) => void;
}

export const useDBStore = create<DBState>((set) => ({
  products: [],
  customers: [],
  transactions: [],
  setProducts: (list) => set({ products: list }),
  setCustomers: (list) => set({ customers: list }),
  setTransactions: (list) => set({ transactions: list }),
}));
