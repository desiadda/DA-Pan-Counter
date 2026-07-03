import { collection, doc, setDoc, addDoc, getDocs } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";
import { getLocalProducts, setLocalData, getLocalData } from "./storage";
import { LS_KEYS } from "../constants";
import { logError } from "./errorLog";

const LS_KEY = "pan_purchase_orders";

function getLocalPurchases() { return getLocalData(LS_KEY, []); }

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
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLocalData(LS_KEY, list);
      return list;
    }
    return getLocalPurchases();
  } catch (err) {
    logError("PURCHASE", err.message, err.stack);
    return getLocalPurchases();
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

    if (isFirebaseEnabled) {
      await syncPurchaseToFirebase(order);
    }

    setLocalData(LS_KEY, orders);
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

    order.status = "received";
    order.receivedAt = Date.now();

    if (isFirebaseEnabled) {
      await syncPurchaseToFirebase(order);
    }

    setLocalData(LS_KEYS.PRODUCTS, products);
    setLocalData(LS_KEY, orders);

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

    if (isFirebaseEnabled) {
      await syncPurchaseToFirebase(order);
    }

    setLocalData(LS_KEY, orders);
  } catch (err) {
    logError("PURCHASE", err.message, err.stack);
    throw new Error(`Cancel error: ${err.message}`);
  }
};
