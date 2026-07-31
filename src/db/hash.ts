import { logError } from "./errorLog";
import { localizeError } from "./config";

const SALT = "paan_counter_pos_v1";

export async function sha256(message) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (err: any) {
    logError("SYSTEM", err.message, err.stack);
    console.error("sha256: Hashing error", err);
    throw new Error(localizeError(`Hash error: ${err.message}. Please try again.`, `हैश समस्या: ${err.message}। कृपया पुनः प्रयास करें।`));
  }
}

export async function hashPin(pin) {
  try {
    return "sha256$" + await sha256(pin + SALT);
  } catch (err) {
    logError("SYSTEM", err.message, err.stack);
    console.error("hashPin: Error hashing PIN", err);
    throw new Error(localizeError(`PIN hash error: ${err.message}. Please try again.`, `PIN हैश समस्या: ${err.message}। कृपया पुनः प्रयास करें।`));
  }
}

export async function verifyPin(pin, storedHash) {
  try {
    if (!storedHash || !storedHash.startsWith("sha256$")) {
      return pin === storedHash;
    }
    const computed = await hashPin(pin);
    return computed === storedHash;
  } catch (err) {
    logError("SYSTEM", err.message, err.stack);
    console.error("verifyPin: PIN verification error", err);
    throw new Error(localizeError(`PIN verification error: ${err.message}. Please try again.`, `PIN सत्यापन समस्या: ${err.message}। कृपया पुनः प्रयास करें।`));
  }
}

export function isPlainPin(stored) {
  try {
    if (!stored) return false;
    return !stored.startsWith("sha256$");
  } catch (err) {
    logError("SYSTEM", err.message, err.stack);
    console.error("isPlainPin: Error checking PIN format", err);
    return false;
  }
}
