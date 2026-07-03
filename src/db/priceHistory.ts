import { collection, addDoc, getDocs, query, where, deleteDoc, doc, writeBatch } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";
import { logError } from "./errorLog";

export const recordPriceChange = async (productId, productName, field, oldValue, newValue, userId, userName) => {
  try {
    if (oldValue === newValue) return;
    if (isFirebaseEnabled) {
      await addDoc(collection(db, "price_history"), {
        productId,
        productName,
        field,
        oldValue,
        newValue,
        userId: userId || "system",
        userName: userName || "System",
        timestamp: Date.now(),
      });
    }
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
  }
};

export const getPriceHistory = async (productId) => {
  try {
    if (isFirebaseEnabled) {
      const q = query(collection(db, "price_history"), where("productId", "==", productId));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => b.timestamp - a.timestamp);
      return list;
    }
    return [];
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    return [];
  }
};

export const getAllPriceHistory = async () => {
  try {
    if (isFirebaseEnabled) {
      const snap = await getDocs(collection(db, "price_history"));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => b.timestamp - a.timestamp);
      return list;
    }
    return [];
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    return [];
  }
};

export const clearPriceHistory = async () => {
  try {
    if (isFirebaseEnabled) {
      const snap = await getDocs(collection(db, "price_history"));
      const batch = writeBatch(db);
      snap.docs.forEach(docSnap => {
        batch.delete(doc(db, "price_history", docSnap.id));
      });
      await batch.commit();
    }
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
  }
};
