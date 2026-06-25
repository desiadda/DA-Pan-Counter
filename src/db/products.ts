import { doc, setDoc, addDoc, deleteDoc } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";
import { getLocalProducts, setLocalData } from "./storage";
import { LS_KEYS } from "../constants";
import { logError } from "./errorLog";
import { recordPriceChange } from "./priceHistory";
import { addToSyncQueue } from "./sync";

function syncProductToFirebase(product) {
  const { id, ...data } = product;
  if (id) return setDoc(doc(db, "products", id), data);
  return addDoc(collection(db, "products"), { ...data, id: "p_" + Date.now() });
}

function deleteProductFromFirebase(productId) {
  return deleteDoc(doc(db, "products", productId));
}

export const getLowStockCount = () => {
  try {
    return getLocalProducts().filter(p => p.stock <= p.lowStockLimit).length;
  } catch (err) {
    logError("INVENTORY", err.message, err.stack);
    return 0;
  }
};

export const getLowStockProducts = () => {
  try {
    return getLocalProducts().filter(p => p.stock <= p.lowStockLimit);
  } catch (err) {
    logError("INVENTORY", err.message, err.stack);
    return [];
  }
};

export const getProducts = async () => {
  try {
    return getLocalProducts();
  } catch (err) {
    logError("INVENTORY", err.message, err.stack);
    return [];
  }
};

export const saveProduct = async (product) => {
  try {
    const products = getLocalProducts();
    let isNew = false;
    if (product.id) {
      const idx = products.findIndex(p => p.id === product.id);
      if (idx !== -1) {
        const old = products[idx];
        const userId = product._userId;
        const userName = product._userName;
        if (parseFloat(old.costPrice) !== parseFloat(product.costPrice))
          recordPriceChange(product.id, product.name, "costPrice", old.costPrice, product.costPrice, userId, userName);
        if (parseFloat(old.sellingPrice) !== parseFloat(product.sellingPrice))
          recordPriceChange(product.id, product.name, "sellingPrice", old.sellingPrice, product.sellingPrice, userId, userName);
        if (product.isCigarette) {
          if (parseFloat(old.costPricePack||0) !== parseFloat(product.costPricePack||0))
            recordPriceChange(product.id, product.name, "costPricePack", old.costPricePack||0, product.costPricePack, userId, userName);
          if (parseFloat(old.sellingPricePack||0) !== parseFloat(product.sellingPricePack||0))
            recordPriceChange(product.id, product.name, "sellingPricePack", old.sellingPricePack||0, product.sellingPricePack, userId, userName);
        }
        products[idx] = product;
      }
    } else {
      product.id = "p_" + Date.now();
      isNew = true;
      products.push(product);
    }
    setLocalData(LS_KEYS.PRODUCTS, products);

    if (isFirebaseEnabled) {
      syncProductToFirebase(product).catch(() => addToSyncQueue({ fn: () => syncProductToFirebase(product) }));
    }
    window.dispatchEvent(new CustomEvent("stock-changed"));
  } catch (err) {
    logError("INVENTORY", err.message, err.stack);
    throw new Error(`Save error (सेव समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
};

export const deleteProduct = async (productId) => {
  try {
    const products = getLocalProducts().filter(p => p.id !== productId);
    setLocalData(LS_KEYS.PRODUCTS, products);
    if (isFirebaseEnabled) {
      deleteProductFromFirebase(productId).catch(() => addToSyncQueue({ fn: () => deleteProductFromFirebase(productId) }));
    }
    window.dispatchEvent(new CustomEvent("stock-changed"));
  } catch (err) {
    logError("INVENTORY", err.message, err.stack);
    throw new Error(`Delete error (डिलीट समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
};
