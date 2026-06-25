import { collection, doc, getDocs, setDoc, addDoc, deleteDoc, query } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";
import { getLocalProducts, setLocalData } from "./storage";
import { LS_KEYS } from "../constants";
import { logError } from "./errorLog";
import { recordPriceChange } from "./priceHistory";

export const getLowStockCount = () => {
  try {
    const products = getLocalProducts();
    return products.filter(p => p.stock <= p.lowStockLimit).length;
  } catch (err) {
    logError("INVENTORY", err.message, err.stack);
    return 0;
  }
};

export const getLowStockProducts = () => {
  try {
    const products = getLocalProducts();
    return products.filter(p => p.stock <= p.lowStockLimit);
  } catch (err) {
    logError("INVENTORY", err.message, err.stack);
    return [];
  }
};

export const getProducts = async () => {
  try {
    if (isFirebaseEnabled) {
      try {
        const q = query(collection(db, "products"));
        const snapshot = await getDocs(q);
        const products = [];
        snapshot.forEach(doc => {
          products.push({ id: doc.id, ...doc.data() });
        });
        if (products.length === 0) {
          const defaults = getLocalProducts();
          for (let p of defaults) {
            const { id, ...data } = p;
            await setDoc(doc(db, "products", id), data);
            products.push(p);
          }
        }
        return products;
      } catch (err) {
        logError("INVENTORY", err.message, err.stack);
        console.error("Firebase getProducts error, loading local fallback", err);
        return getLocalProducts();
      }
    }
    return getLocalProducts();
  } catch (err) {
    logError("INVENTORY", err.message, err.stack);
    console.error("getProducts: Unexpected error", err);
    return [];
  }
};

export const saveProduct = async (product) => {
  try {
    if (isFirebaseEnabled) {
      const { id, ...data } = product;
      if (id) {
        await setDoc(doc(db, "products", id), data);
      } else {
        await addDoc(collection(db, "products"), data);
      }
    } else {
      const products = getLocalProducts();
      if (product.id) {
        const idx = products.findIndex(p => p.id === product.id);
        if (idx !== -1) {
          const old = products[idx];
          const userId = product._userId;
          const userName = product._userName;
          if (parseFloat(old.costPrice) !== parseFloat(product.costPrice)) {
            recordPriceChange(product.id, product.name, "costPrice", old.costPrice, product.costPrice, userId, userName);
          }
          if (parseFloat(old.sellingPrice) !== parseFloat(product.sellingPrice)) {
            recordPriceChange(product.id, product.name, "sellingPrice", old.sellingPrice, product.sellingPrice, userId, userName);
          }
          if (product.isCigarette) {
            if (parseFloat(old.costPricePack||0) !== parseFloat(product.costPricePack||0)) {
              recordPriceChange(product.id, product.name, "costPricePack", old.costPricePack||0, product.costPricePack, userId, userName);
            }
            if (parseFloat(old.sellingPricePack||0) !== parseFloat(product.sellingPricePack||0)) {
              recordPriceChange(product.id, product.name, "sellingPricePack", old.sellingPricePack||0, product.sellingPricePack, userId, userName);
            }
          }
          products[idx] = product;
        }
      } else {
        product.id = "p_" + Date.now();
        products.push(product);
      }
      setLocalData(LS_KEYS.PRODUCTS, products);
    }
    window.dispatchEvent(new CustomEvent("stock-changed"));
  } catch (err) {
    logError("INVENTORY", err.message, err.stack);
    console.error("saveProduct: Error saving product", err);
    throw new Error(`Save error (सेव समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
};

export const deleteProduct = async (productId) => {
  try {
    if (isFirebaseEnabled) {
      await deleteDoc(doc(db, "products", productId));
    } else {
      const products = getLocalProducts().filter(p => p.id !== productId);
      setLocalData(LS_KEYS.PRODUCTS, products);
    }
    window.dispatchEvent(new CustomEvent("stock-changed"));
  } catch (err) {
    logError("INVENTORY", err.message, err.stack);
    console.error("deleteProduct: Error deleting product", err);
    throw new Error(`Delete error (डिलीट समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
};
