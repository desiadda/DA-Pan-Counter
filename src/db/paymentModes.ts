import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";
import { logError } from "./errorLog";

export const DEFAULT_PAYMENT_MODES = [
  { id: "Cash", name: "Cash", qrCode: "", isSystem: true, enabled: true },
  { id: "PromptPay", name: "PromptPay", qrCode: "", isSystem: false, enabled: true },
  { id: "Bank Transfer", name: "Bank Transfer", qrCode: "", isSystem: false, enabled: true },
  { id: "Udhaar", name: "Udhaar", qrCode: "", isSystem: true, enabled: true }
];

export const getPaymentModes = async () => {
  try {
    if (isFirebaseEnabled && db) {
      const snap = await getDocs(collection(db, "payment_modes"));
      if (snap.empty) {
        // Initialize default payment modes
        for (const mode of DEFAULT_PAYMENT_MODES) {
          await setDoc(doc(db, "payment_modes", mode.id), mode);
        }
        return DEFAULT_PAYMENT_MODES;
      }
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    // Local storage fallback
    const local = localStorage.getItem("pan_payment_modes");
    if (local) {
      return JSON.parse(local);
    }
    localStorage.setItem("pan_payment_modes", JSON.stringify(DEFAULT_PAYMENT_MODES));
    return DEFAULT_PAYMENT_MODES;
  } catch (err: any) {
    logError("SETTINGS", err.message, err.stack);
    return DEFAULT_PAYMENT_MODES;
  }
};

export const savePaymentMode = async (mode: any) => {
  try {
    if (isFirebaseEnabled && db) {
      await setDoc(doc(db, "payment_modes", mode.id), mode);
    } else {
      const current = await getPaymentModes();
      const idx = current.findIndex((m: any) => m.id === mode.id);
      if (idx >= 0) current[idx] = mode;
      else current.push(mode);
      localStorage.setItem("pan_payment_modes", JSON.stringify(current));
    }
  } catch (err: any) {
    logError("SETTINGS", err.message, err.stack);
    throw err;
  }
};

export const deletePaymentMode = async (modeId: string) => {
  try {
    if (isFirebaseEnabled && db) {
      await deleteDoc(doc(db, "payment_modes", modeId));
    } else {
      const current = await getPaymentModes();
      const filtered = current.filter((m: any) => m.id !== modeId);
      localStorage.setItem("pan_payment_modes", JSON.stringify(filtered));
    }
  } catch (err: any) {
    logError("SETTINGS", err.message, err.stack);
    throw err;
  }
};
