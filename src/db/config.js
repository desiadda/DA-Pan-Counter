import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
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

const config = getSavedFirebaseConfig() || HARDCODED_CONFIG;

if (config && config.apiKey && config.projectId) {
  try {
    if (getApps().length === 0) {
      const app = initializeApp(config);
      db = getFirestore(app);
      auth = getAuth(app);
      isFirebaseEnabled = true;
      console.log("Firebase initialized successfully using saved configuration.");
    }
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
