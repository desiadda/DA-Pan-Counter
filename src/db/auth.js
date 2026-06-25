import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { auth, isFirebaseEnabled } from "./config";
import { LS_KEYS, ADMIN_PERMISSIONS, DEFAULT_PERMISSIONS } from "../constants";
import { hashPin, verifyPin, isPlainPin } from "./hash";
import { logError } from "./errorLog";

function getUsers() {
  try {
    const raw = localStorage.getItem(LS_KEYS.USERS);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    logError("AUTH", err.message, err.stack);
    console.error("getUsers: Error reading users from localStorage", err);
    return [];
  }
}

function saveUsers(users) {
  try {
    localStorage.setItem(LS_KEYS.USERS, JSON.stringify(users));
  } catch (err) {
    logError("AUTH", err.message, err.stack);
    console.error("saveUsers: Error saving users to localStorage", err);
    throw new Error(`Save error (सेव समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
}

async function migrateOldPins() {
  try {
    const existing = getUsers();
    if (existing.length > 0) return;

    const users = [];
    const adminRaw = localStorage.getItem(LS_KEYS.ADMIN_PIN);
    const staffRaw = localStorage.getItem(LS_KEYS.STAFF_PIN);

    const adminPin = isPlainPin(adminRaw) ? await hashPin(adminRaw) : (adminRaw || await hashPin("1234"));
    const staffPin = isPlainPin(staffRaw) ? await hashPin(staffRaw) : (staffRaw || await hashPin("5555"));

    users.push({
      id: "u1",
      name: "Admin",
      email: "admin@pan.com",
      pin: adminPin,
      role: "admin",
      permissions: { ...ADMIN_PERMISSIONS },
    });

    users.push({
      id: "u2",
      name: "Staff",
      email: "staff@pan.com",
      pin: staffPin,
      role: "staff",
      permissions: { ...DEFAULT_PERMISSIONS },
    });

    saveUsers(users);
  } catch (err) {
    logError("AUTH", err.message, err.stack);
    console.error("migrateOldPins: Migration error", err);
    throw new Error(`Migration error (माइग्रेशन समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
}

export const login = async (email, password) => {
  try {
    await migrateOldPins();

    const users = getUsers();
    for (const u of users) {
      if (await verifyPin(password, u.pin)) {
        const user = {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          permissions: u.permissions,
        };
        localStorage.setItem(LS_KEYS.USER, JSON.stringify(user));
        if (isFirebaseEnabled) {
          try { await signInWithEmailAndPassword(auth, user.email, password); } catch (_) {}
        }
        return user;
      }
    }

    throw new Error("Invalid PIN. कृपया सही PIN डालें और पुनः प्रयास करें।");
  } catch (err) {
    logError("AUTH", err.message, err.stack);
    console.error("login error", err);
    throw new Error(`Login failed (लॉगिन विफल): ${err.message}`);
  }
};

export const logout = async () => {
  try {
    localStorage.removeItem(LS_KEYS.USER);
    if (isFirebaseEnabled) {
      try { await signOut(auth); } catch (_) {}
    }
  } catch (err) {
    logError("AUTH", err.message, err.stack);
    console.error("logout error", err);
    throw new Error(`Logout error (लॉगआउट समस्या): ${err.message}. कृपया पुनः प्रयास करें।`);
  }
};

export const getCurrentUser = () => {
  try {
    const u = localStorage.getItem(LS_KEYS.USER);
    return u ? JSON.parse(u) : null;
  } catch (err) {
    logError("AUTH", err.message, err.stack);
    console.error("getCurrentUser: Error reading current user", err);
    return null;
  }
};

export const onAuthStateChangedListener = (callback) => {
  try {
    const u = localStorage.getItem(LS_KEYS.USER);
    callback(u ? JSON.parse(u) : null);
    return () => {};
  } catch (err) {
    logError("AUTH", err.message, err.stack);
    console.error("onAuthStateChangedListener: Error", err);
    callback(null);
    return () => {};
  }
};

export { getUsers, saveUsers };
