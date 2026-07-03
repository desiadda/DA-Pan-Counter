import { collection, doc, setDoc, addDoc, deleteDoc, getDocs } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";
import { getLocalData, setLocalData } from "./storage";
import { logError } from "./errorLog";

const LS_KEY = "pan_suppliers";

async function syncSupplierToFirebase(supplier) {
  const { id, ...data } = supplier;
  if (id) {
    await setDoc(doc(db, "suppliers", id), data);
  } else {
    const ref = await addDoc(collection(db, "suppliers"), data);
    supplier.id = ref.id;
  }
}

async function deleteSupplierFromFirebase(id) {
  await deleteDoc(doc(db, "suppliers", id));
}

export const getSuppliers = async () => {
  try {
    if (isFirebaseEnabled) {
      const snap = await getDocs(collection(db, "suppliers"));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLocalData(LS_KEY, list);
      return list;
    }
    return getLocalData(LS_KEY, []);
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    return getLocalData(LS_KEY, []);
  }
};

export const saveSupplier = async (supplier) => {
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

    if (isFirebaseEnabled) {
      await syncSupplierToFirebase(supplier);
    }

    setLocalData(LS_KEY, list);
    return supplier;
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    throw new Error("Failed to save supplier");
  }
};

export const deleteSupplier = async (id) => {
  try {
    if (isFirebaseEnabled) {
      await deleteSupplierFromFirebase(id);
    }
    const list = getLocalData(LS_KEY, []).filter(s => s.id !== id);
    setLocalData(LS_KEY, list);
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    throw new Error("Failed to delete supplier");
  }
};
