import { collection, doc, setDoc, addDoc, deleteDoc, getDocs } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";
import { logError } from "./errorLog";

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
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    return [];
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    return [];
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
