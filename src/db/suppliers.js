import { getLocalData, setLocalData } from "./storage";
import { logError } from "./errorLog";

const LS_KEY = "pan_suppliers";

export const getSuppliers = () => {
  try { return getLocalData(LS_KEY, []); }
  catch (err) { logError("STORAGE", err.message, err.stack); return []; }
};

export const saveSupplier = (supplier) => {
  try {
    const list = getLocalData(LS_KEY, []);
    if (supplier.id) {
      const idx = list.findIndex(s => s.id === supplier.id);
      if (idx !== -1) list[idx] = supplier;
    } else {
      supplier.id = "sup_" + Date.now();
      supplier.createdAt = Date.now();
      list.push(supplier);
    }
    setLocalData(LS_KEY, list);
    return supplier;
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    throw new Error("Failed to save supplier");
  }
};

export const deleteSupplier = (id) => {
  try {
    const list = getLocalData(LS_KEY, []).filter(s => s.id !== id);
    setLocalData(LS_KEY, list);
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    throw new Error("Failed to delete supplier");
  }
};
