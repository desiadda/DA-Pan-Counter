import { collection, getDocs, doc, deleteDoc, runTransaction } from "firebase/firestore";
import { db, isFirebaseEnabled, localizeError } from "./config";
import { logError } from "./errorLog";
import { useDBStore } from "../stores/dbStore";

export const getLowStockCount = () => {
  return useDBStore.getState().products.filter(p => p.stock <= p.lowStockLimit).length;
};

export const getLowStockProducts = () => {
  return useDBStore.getState().products.filter(p => p.stock <= p.lowStockLimit);
};

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
    if (isFirebaseEnabled) {
      await runTransaction(db, async (firestoreTx) => {
        let isNew = !product.id;
        let finalId = product.id;

        if (isNew) {
          const newDocRef = doc(collection(db, "products"));
          finalId = newDocRef.id;
          product.id = finalId;
        }

        const docRef = doc(db, "products", finalId);

        if (!isNew) {
          const docSnap = await firestoreTx.get(docRef);
          if (docSnap.exists()) {
            const old = docSnap.data();
            const userId = product._userId;
            const userName = product._userName;

            const queuePriceChange = (field, oldVal, newVal) => {
              if (parseFloat(oldVal) === parseFloat(newVal)) return;
              const histRef = doc(collection(db, "price_history"));
              firestoreTx.set(histRef, {
                productId: finalId,
                productName: product.name,
                field,
                oldValue: oldVal,
                newValue: newVal,
                userId: userId || "system",
                userName: userName || "System",
                timestamp: Date.now(),
              });
            };

            queuePriceChange("costPrice", old.costPrice, product.costPrice);
            queuePriceChange("sellingPrice", old.sellingPrice, product.sellingPrice);
            if (product.isCigarette) {
              queuePriceChange("costPricePack", old.costPricePack || 0, product.costPricePack);
              queuePriceChange("sellingPricePack", old.sellingPricePack || 0, product.sellingPricePack);
            }
          }
        }

        const { id, _userId, _userName, ...data } = product;
        firestoreTx.set(docRef, { ...data, id: finalId });
      });
    }
  } catch (err) {
    logError("INVENTORY", err.message, err.stack);
    throw new Error(localizeError(`Save error: ${err.message}. Please try again.`, `सेव समस्या: ${err.message}। कृपया पुनः प्रयास करें।`));
  }
};

export const deleteProduct = async (productId) => {
  try {
    if (isFirebaseEnabled) {
      await deleteProductFromFirebase(productId);
    }
  } catch (err) {
    logError("INVENTORY", err.message, err.stack);
    throw new Error(localizeError(`Delete error: ${err.message}. Please try again.`, `डिलीट समस्या: ${err.message}। कृपया पुनः प्रयास करें।`));
  }
};
