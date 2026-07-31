import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";
import { logError } from "./errorLog";
import { logAudit } from "./audit";

const SETTINGS_DOC = "app_settings";

function applySettingsToLocal(data) {
  if (!data) return;
  try {
    if (data.store) localStorage.setItem("pan_store_settings", JSON.stringify(data.store));
  } catch (err) {
    logError("SETTINGS", "Store settings too large for local cache: " + err.message, err.stack);
  }
  if (typeof data.taxEnabled === "boolean") localStorage.setItem("pan_tax_enabled", data.taxEnabled ? "true" : "false");
  if (data.taxRate != null) localStorage.setItem("pan_tax_rate", String(data.taxRate));
  if (data.promptpayNumber != null) localStorage.setItem("pan_promptpay_number", String(data.promptpayNumber));
  if (data.discountReasons != null) localStorage.setItem("pan_discount_reasons", JSON.stringify(data.discountReasons));
  window.dispatchEvent(new CustomEvent("settings-changed"));
}

let settingsListenerActive = false;

export function initSettingsListener() {
  if (!isFirebaseEnabled || settingsListenerActive) return;
  settingsListenerActive = true;

  onSnapshot(doc(db, "settings", SETTINGS_DOC), (docSnap) => {
    if (docSnap.exists()) applySettingsToLocal(docSnap.data());
  }, (err) => {
    logError("SETTINGS", "Settings listener error: " + err.message, err.stack);
  });
}

export async function saveAppSettings(patch) {
  applySettingsToLocal(patch);
  if (isFirebaseEnabled && db) {
    try {
      await setDoc(doc(db, "settings", SETTINGS_DOC), patch, { merge: true });
      logAudit("settings_changed", "settings", SETTINGS_DOC, `Updated: ${Object.keys(patch).join(", ")}`);
    } catch (err) {
      logError("SETTINGS", "Cloud settings save failed: " + err.message, err.stack);
      throw err;
    }
  }
}
