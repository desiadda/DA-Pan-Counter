import { collection, getDocs, doc, setDoc, addDoc, deleteDoc, getDoc } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";
import { logError } from "./errorLog";
import { recordPriceChange } from "./priceHistory";
import { useDBStore } from "../stores/dbStore";

export const getLowStockCount = () => {
  return useDBStore.getState().products.filter(p => p.stock <= p.lowStockLimit).length;
};

export const getLowStockProducts = () => {
  return useDBStore.getState().products.filter(p => p.stock <= p.lowStockLimit);
};

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

export const getProducts = async () => {
  try {
    if (isFirebaseEnabled) {
      const snap = await getDocs(collection(db, "products"));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    return [];
  } catch (err) {
    logError("INVENTORY", err.message, err.stack);
    return [];
  }
};

export const saveProduct = async (product) => {
  try {
    if (product.id && isFirebaseEnabled) {
      const docRef = doc(db, "products", product.id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const old = docSnap.data();
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
    } else if (!product.id) {
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
