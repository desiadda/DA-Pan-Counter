import { collection, doc, getDocs, addDoc, setDoc, query, orderBy } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";
import { getLocalProducts, setLocalData } from "./storage";
import { LS_KEYS } from "../constants";
import { logError } from "./errorLog";
import { addToSyncQueue } from "./sync";
import { getLocalData } from "./storage";

const LS_KEY = "pan_purchase_orders";

function getLocalPurchases() { return getLocalData(LS_KEY, []); }

function syncPurchaseToFirebase(order) {
  const { id, ...data } = order;
  return id ? setDoc(doc(db, "purchases", id), data) : addDoc(collection(db, "purchases"), data);
}

export const getPurchaseOrders = async () => {
  try {
    if (isFirebaseEnabled) {
      try {
        const q = query(collection(db, "purchases"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const list = [];
        snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
        return list;
      } catch (err) {
        logError("PURCHASE", err.message, err.stack);
        return getLocalPurchases();
      }
    }
    return getLocalPurchases();
  } catch (err) {
    logError("PURCHASE", err.message, err.stack);
    return [];
  }
};

export const savePurchaseOrder = async (order) => {
  try {
    const orders = getLocalPurchases();
    if (order.id) {
      const idx = orders.findIndex(o => o.id === order.id);
      if (idx !== -1) orders[idx] = order;
    } else {
      order.id = "po_" + Date.now();
      order.status = "pending";
      orders.unshift(order);
    }
    setLocalData(LS_KEY, orders);

    if (isFirebaseEnabled) {
      syncPurchaseToFirebase(order).catch(() => addToSyncQueue({ fn: () => syncPurchaseToFirebase(order) }));
    }
  } catch (err) {
    logError("PURCHASE", err.message, err.stack);
    throw new Error(`Save error: ${err.message}`);
  }
};

export const receivePurchaseOrder = async (orderId) => {
  try {
    const orders = getLocalPurchases();
    const order = orders.find(o => o.id === orderId);
    if (!order || order.status !== "pending") return;

    const products = getLocalProducts();
    (order.items || []).forEach(item => {
      const prod = products.find(p => p.name === item.name);
      if (prod) {
        const addQty = item.packQty != null ? (item.packQty * (item.packSize || 20)) + (item.looseQty || 0) : item.quantity;
        prod.stock = (prod.stock || 0) + (addQty || item.quantity || 0);
      }
    });
    setLocalData(LS_KEYS.PRODUCTS, products);

    order.status = "received";
    order.receivedAt = Date.now();
    setLocalData(LS_KEY, orders);

    if (isFirebaseEnabled) {
      syncPurchaseToFirebase(order).catch(() => addToSyncQueue({ fn: () => syncPurchaseToFirebase(order) }));
    }
    window.dispatchEvent(new CustomEvent("stock-changed"));
  } catch (err) {
    logError("PURCHASE", err.message, err.stack);
    throw new Error(`Receive error: ${err.message}`);
  }
};

export const cancelPurchaseOrder = async (orderId) => {
  try {
    const orders = getLocalPurchases();
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    order.status = "cancelled";
    order.cancelledAt = Date.now();
    setLocalData(LS_KEY, orders);

    if (isFirebaseEnabled) {
      syncPurchaseToFirebase(order).catch(() => addToSyncQueue({ fn: () => syncPurchaseToFirebase(order) }));
    }
  } catch (err) {
    logError("PURCHASE", err.message, err.stack);
    throw new Error(`Cancel error: ${err.message}`);
  }
};
