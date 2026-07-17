import { collection, getDocs, doc, deleteDoc, runTransaction, setDoc } from "firebase/firestore";
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
      const list = snap.docs.map(d => {
        const data = d.data();
        const id = d.id;
        let batches = data.batches || [];
        if (!data.batches && (data.stock > 0 || data.costPrice > 0)) {
          batches = [{
            id: "b_init_" + id,
            costPrice: data.costPrice || 0,
            quantity: data.stock || 0,
            createdAt: data.createdAt || Date.now(),
          }];
          const docRef = doc(db, "products", id);
          setDoc(docRef, { ...data, batches }, { merge: true }).catch(err => {
            console.error("Failed to self-heal batches for product", id, err);
          });
        }
        return { id, ...data, batches };
      });
      return list;
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
        let existingBatches = [];

        if (!isNew) {
          const docSnap = await firestoreTx.get(docRef);
          if (docSnap.exists()) {
            const old = docSnap.data();
            existingBatches = old.batches || [];
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

        // Reconcile manual stock changes with batches
        let finalBatches = [...existingBatches];
        const sumQty = finalBatches.reduce((s, b) => s + b.quantity, 0);

        if (product.stock !== sumQty) {
          const diff = product.stock - sumQty;
          if (diff > 0) {
            finalBatches.push({
              id: "b_adj_" + Date.now() + "_" + Math.random().toString(36).substring(2),
              costPrice: product.costPrice || 0,
              quantity: diff,
              createdAt: Date.now()
            });
          } else if (diff < 0) {
            let toDeduct = Math.abs(diff);
            finalBatches.sort((a, b) => a.createdAt - b.createdAt);
            for (const batch of finalBatches) {
              if (batch.quantity >= toDeduct) {
                batch.quantity -= toDeduct;
                toDeduct = 0;
                break;
              } else {
                toDeduct -= batch.quantity;
                batch.quantity = 0;
              }
            }
            finalBatches = finalBatches.filter(b => b.quantity > 0);
          }
        }
        product.batches = finalBatches;

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
