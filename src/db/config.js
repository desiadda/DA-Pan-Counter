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

const config = getSavedFirebaseConfig();

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
  return getSavedFirebaseConfig() || {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
  };
};
