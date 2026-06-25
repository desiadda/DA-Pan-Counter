import { collection, doc, setDoc, addDoc, deleteDoc } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";
import { getLocalData, setLocalData } from "./storage";
import { logError } from "./errorLog";
import { addToSyncQueue } from "./sync";

const LS_KEY = "pan_suppliers";

function syncSupplierToFirebase(supplier) {
  const { id, ...data } = supplier;
  return id ? setDoc(doc(db, "suppliers", id), data) : addDoc(collection(db, "suppliers"), data);
}

function deleteSupplierFromFirebase(id) {
  return deleteDoc(doc(db, "suppliers", id));
}

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

    if (isFirebaseEnabled) {
      syncSupplierToFirebase(supplier).catch(() => addToSyncQueue({ fn: () => syncSupplierToFirebase(supplier) }));
    }
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
    if (isFirebaseEnabled) {
      deleteSupplierFromFirebase(id).catch(() => addToSyncQueue({ fn: () => deleteSupplierFromFirebase(id) }));
    }
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    throw new Error("Failed to delete supplier");
  }
};
