import { collection, doc, setDoc, addDoc, deleteDoc, getDocs, onSnapshot } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";
import { getLocalData, setLocalData } from "./storage";
import { logError } from "./errorLog";

const LS_KEY = "pan_suppliers";

let suppliersListenerActive = false;

export function initSuppliersListener() {
  if (!isFirebaseEnabled || suppliersListenerActive) return;
  suppliersListenerActive = true;

  onSnapshot(collection(db, "suppliers"), (snapshot) => {
    const list = [];
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() });
    });
    setLocalData(LS_KEY, list);
    window.dispatchEvent(new CustomEvent("suppliers-changed"));
  });
}

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
    if (!supplier.id) {
      supplier.createdAt = Date.now();
    }

    if (isFirebaseEnabled) {
      await syncSupplierToFirebase(supplier);
    }
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
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    throw new Error("Failed to delete supplier");
  }
};
