import { collection, doc, setDoc, addDoc, getDocs, getDoc } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";
import { logError } from "./errorLog";
import { getLocalData, setLocalData } from "./storage";

const LS_KEY = "pan_purchase_orders";

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
    return getLocalData(LS_KEY, []);
  } catch (err) {
    logError("PURCHASE", err.message, err.stack);
    return getLocalData(LS_KEY, []);
  }
};

export const savePurchaseOrder = async (order) => {
  try {
    if (!order.id) {
      order.status = "pending";
    }

    if (isFirebaseEnabled) {
      await syncPurchaseToFirebase(order);
    } else {
      const list = getLocalData(LS_KEY, []);
      if (order.id) {
        const idx = list.findIndex(o => o.id === order.id);
        if (idx !== -1) list[idx] = order;
      } else {
        order.id = "po_" + Date.now();
        list.push(order);
      }
      setLocalData(LS_KEY, list);
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
    } else {
      const list = getLocalData(LS_KEY, []);
      const order = list.find(o => o.id === orderId);
      if (!order || order.status !== "pending") return;
      order.status = "received";
      order.receivedAt = Date.now();
      setLocalData(LS_KEY, list);
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
    } else {
      const list = getLocalData(LS_KEY, []);
      const order = list.find(o => o.id === orderId);
      if (!order) return;
      order.status = "cancelled";
      order.cancelledAt = Date.now();
      setLocalData(LS_KEY, list);
    }
  } catch (err) {
    logError("PURCHASE", err.message, err.stack);
    throw new Error(`Cancel error: ${err.message}`);
  }
};
