import { getLocalData, setLocalData } from "./storage";
import { LS_KEYS } from "../constants";
import { logError } from "./errorLog";

export const recordPriceChange = (productId, productName, field, oldValue, newValue, userId, userName) => {
  try {
    if (oldValue === newValue) return;
    const history = getLocalData(LS_KEYS.PRICE_HISTORY, []);
    history.unshift({
      id: "ph_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      productId,
      productName,
      field,
      oldValue,
      newValue,
      userId: userId || "system",
      userName: userName || "System",
      timestamp: Date.now(),
    });
    setLocalData(LS_KEYS.PRICE_HISTORY, history.slice(0, 500));
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
  }
};

export const getPriceHistory = (productId) => {
  try {
    const history = getLocalData(LS_KEYS.PRICE_HISTORY, []);
    return history.filter(h => h.productId === productId);
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    return [];
  }
};

export const getAllPriceHistory = () => {
  try {
    return getLocalData(LS_KEYS.PRICE_HISTORY, []);
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
    return [];
  }
};

export const clearPriceHistory = () => {
  try {
    setLocalData(LS_KEYS.PRICE_HISTORY, []);
  } catch (err) {
    logError("STORAGE", err.message, err.stack);
  }
};
