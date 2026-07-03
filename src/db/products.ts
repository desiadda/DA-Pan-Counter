import { collection, getDocs, doc, setDoc, addDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";
import { getLocalProducts, setLocalData } from "./storage";
import { LS_KEYS } from "../constants";
import { logError } from "./errorLog";
import { recordPriceChange } from "./priceHistory";

let productsListenerActive = false;

export function initProductsListener() {
  if (!isFirebaseEnabled || productsListenerActive) return;
  productsListenerActive = true;

  onSnapshot(collection(db, "products"), (snapshot) => {
    const list = [];
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() });
    });
    setLocalData(LS_KEYS.PRODUCTS, list);
    window.dispatchEvent(new CustomEvent("stock-changed"));
  });
}

async function syncProductToFirebase(product) {
  const { id, ...data } = product;
  if (id) {
    await setDoc(doc(db, "products", id), data);
  } else {
    const ref = await addDoc(collection(db, "products"), { ...data, id: "p_" + Date.now() });
    product.id = ref.id;
  }
}

async function deleteProductFromFirebase(productId) {
  await deleteDoc(doc(db, "products", productId));
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
    if (isFirebaseEnabled) {
      const snap = await getDocs(collection(db, "products"));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLocalData(LS_KEYS.PRODUCTS, list);
      return list;
    }
    return getLocalProducts();
  } catch (err) {
    logError("INVENTORY", err.message, err.stack);
    return getLocalProducts();
  }
};

export const saveProduct = async (product) => {
  try {
    const products = getLocalProducts();
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
      }
    } else {
      product.id = "p_" + Date.now();
    }

    if (isFirebaseEnabled) {
      await syncProductToFirebase(product);
    }
  } catch (err) {
    logError("INVENTORY", err.message, err.stack);
    throw new Error(`Save error (सेव समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
};

export const deleteProduct = async (productId) => {
  try {
    if (isFirebaseEnabled) {
      await deleteProductFromFirebase(productId);
    }
  } catch (err) {
    logError("INVENTORY", err.message, err.stack);
    throw new Error(`Delete error (डिलीट समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
};
