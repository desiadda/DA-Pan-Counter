import { getLocalData, setLocalData } from "./storage";
import { logError } from "./errorLog";

const LS_KEY = "pan_purchase_orders";

export const getPurchaseOrders = () => {
  try {
    return getLocalData(LS_KEY, []);
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    return [];
  }
};

export const savePurchaseOrder = (order) => {
  try {
    const orders = getLocalData(LS_KEY, []);
    if (order.id) {
      const idx = orders.findIndex(o => o.id === order.id);
      if (idx !== -1) orders[idx] = order;
    } else {
      order.id = "po_" + Date.now();
      orders.unshift(order);
    }
    setLocalData(LS_KEY, orders);
    return order;
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    throw new Error("Failed to save purchase order");
  }
};

export const receivePurchaseOrder = (orderId) => {
  try {
    const orders = getLocalData(LS_KEY, []);
    const order = orders.find(o => o.id === orderId);
    if (!order) throw new Error("Order not found");
    if (order.status !== "pending") throw new Error("Order is not pending");

    const products = getLocalData("pan_products", []);
    order.items.forEach(item => {
      const prod = products.find(p => p.id === item.productId);
      if (prod) {
        if (item.isPack && prod.isCigarette) {
          const sticks = item.quantity * (item.packSize || 20);
          prod.stock = (prod.stock || 0) + sticks;
        } else {
          prod.stock = (prod.stock || 0) + item.quantity;
        }
      }
    });
    setLocalData("pan_products", products);

    order.status = "completed";
    order.receivedAt = Date.now();
    setLocalData(LS_KEY, orders);
    window.dispatchEvent(new CustomEvent("stock-changed"));
    return order;
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    throw new Error(err.message || "Failed to receive order");
  }
};

export const cancelPurchaseOrder = (orderId) => {
  try {
    const orders = getLocalData(LS_KEY, []);
    const order = orders.find(o => o.id === orderId);
    if (!order) throw new Error("Order not found");
    order.status = "cancelled";
    setLocalData(LS_KEY, orders);
    return order;
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    throw new Error("Failed to cancel order");
  }
};
