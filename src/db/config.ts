import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, getDocs, writeBatch, doc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { LS_KEYS } from "../constants";

export let isFirebaseEnabled = false;
export let db = null;
export let auth = null;

const getSavedFirebaseConfig = () => {
  try {
    const saved = localStorage.getItem(LS_KEYS.FIREBASE_CONFIG);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    console.error("Failed to parse saved firebase config", e);
    return null;
  }
};

const HARDCODED_CONFIG = {
  apiKey: "AIzaSyAtWjwBHJi6ptVJBZS6G33aDjqnf-IEUlw",
  authDomain: "da-paan-pos.firebaseapp.com",
  projectId: "da-paan-pos",
  storageBucket: "da-paan-pos.firebasestorage.app",
  messagingSenderId: "163766615829",
  appId: "1:163766615829:web:f4af65ae95d04aff1cb31c",
  measurementId: "G-1QX1R8V5LP"
};

const savedConfig = getSavedFirebaseConfig();
const config = (savedConfig && savedConfig.apiKey && savedConfig.projectId) ? savedConfig : HARDCODED_CONFIG;

if (config && config.apiKey && config.projectId) {
  try {
    let app;
    if (getApps().length === 0) {
      app = initializeApp(config);
      console.log("Firebase initialized successfully using saved configuration.");
    } else {
      app = getApps()[0];
    }
    db = getFirestore(app);
    auth = getAuth(app);
    isFirebaseEnabled = true;
  } catch (err) {
    console.error("Error initializing Firebase, falling back to LocalStorage:", err);
  }
}

export const saveConfig = (newConfig) => {
  localStorage.setItem(LS_KEYS.FIREBASE_CONFIG, JSON.stringify(newConfig));
  window.location.reload();
};

export const clearConfig = () => {
  localStorage.removeItem(LS_KEYS.FIREBASE_CONFIG);
  window.location.reload();
};

export const getConfig = () => {
  return getSavedFirebaseConfig() || HARDCODED_CONFIG;
};

export async function migrateLocalDataToFirestore() {
  if (!isFirebaseEnabled || !db) return;
  try {
    const productsSnap = await getDocs(collection(db, "products"));
    if (productsSnap.empty) {
      console.log("Firestore products collection is empty. Initiating automatic self-healing cloud migration...");

      // 1. Migrate Products
      const localProds = JSON.parse(localStorage.getItem(LS_KEYS.PRODUCTS) || "[]");
      if (localProds.length > 0) {
        const batch = writeBatch(db);
        localProds.forEach(p => {
          batch.set(doc(db, "products", p.id), p);
        });
        await batch.commit();
        console.log(`Migrated ${localProds.length} products to Firestore.`);
      }

      // 2. Migrate Customers
      const localCusts = JSON.parse(localStorage.getItem(LS_KEYS.CUSTOMERS) || "[]");
      if (localCusts.length > 0) {
        const batch = writeBatch(db);
        localCusts.forEach(c => {
          batch.set(doc(db, "customers", c.id), c);
        });
        await batch.commit();
        console.log(`Migrated ${localCusts.length} customers to Firestore.`);
      }

      // 3. Migrate Users
      const localUsers = JSON.parse(localStorage.getItem(LS_KEYS.USERS) || "[]");
      if (localUsers.length > 0) {
        const batch = writeBatch(db);
        localUsers.forEach(u => {
          batch.set(doc(db, "users", u.id), u);
        });
        await batch.commit();
        console.log(`Migrated ${localUsers.length} users to Firestore.`);
      }
    }
  } catch (err) {
    console.error("Self-healing cloud migration failed:", err);
  }
}
