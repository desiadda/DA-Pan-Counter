import { collection, doc, setDoc, addDoc, getDocs, getDoc } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";
import { logError } from "./errorLog";

async function syncPurchaseToFirebase(order) {
  const { id, ...data } = order;
  if (id) {
    await setDoc(doc(db, "purchases", id), data);
  } else {
    const ref = await addDoc(collection(db, "purchases"), data);
    order.id = ref.id;
  }
}

export const getPurchaseOrders = async () => {
  try {
    if (isFirebaseEnabled) {
      const snap = await getDocs(collection(db, "purchases"));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    return [];
  } catch (err) {
    logError("PURCHASE", err.message, err.stack);
    return [];
  }
};

export const savePurchaseOrder = async (order) => {
  try {
    if (!order.id) {
      order.status = "pending";
    }

    if (isFirebaseEnabled) {
      await syncPurchaseToFirebase(order);
    }
  } catch (err) {
    logError("PURCHASE", err.message, err.stack);
    throw new Error(`Save error: ${err.message}`);
  }
};

export const receivePurchaseOrder = async (orderId) => {
  try {
    if (isFirebaseEnabled) {
      const docRef = doc(db, "purchases", orderId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return;
      const order = { id: docSnap.id, ...docSnap.data() };
      if (order.status !== "pending") return;

      order.status = "received";
      order.receivedAt = Date.now();
      await syncPurchaseToFirebase(order);
    }
  } catch (err) {
    logError("PURCHASE", err.message, err.stack);
    throw new Error(`Receive error: ${err.message}`);
  }
};

export const cancelPurchaseOrder = async (orderId) => {
  try {
    if (isFirebaseEnabled) {
      const docRef = doc(db, "purchases", orderId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return;
      const order = { id: docSnap.id, ...docSnap.data() };
      order.status = "cancelled";
      order.cancelledAt = Date.now();
      await syncPurchaseToFirebase(order);
    }
  } catch (err) {
    logError("PURCHASE", err.message, err.stack);
    throw new Error(`Cancel error: ${err.message}`);
  }
};
