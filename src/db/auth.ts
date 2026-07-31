import { doc, setDoc, deleteDoc, getDocs, collection, onSnapshot, writeBatch } from "firebase/firestore";
import { db, isFirebaseEnabled, localizeError } from "./config";
import { LS_KEYS, ADMIN_PERMISSIONS, DEFAULT_PERMISSIONS } from "../constants";
import { hashPin, verifyPin, isPlainPin } from "./hash";
import { logError } from "./errorLog";
import { getLocalData, setLocalData } from "./storage";
import { logAudit } from "./audit";

let usersListenerActive = false;

export function initUsersListener() {
  if (!isFirebaseEnabled || usersListenerActive) return;
  usersListenerActive = true;

  onSnapshot(collection(db, "users"), (snapshot) => {
    const list = [];
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() });
    });
    setLocalData(LS_KEYS.USERS, list);

    // ── Auto-refresh active session permissions ──
    // If the currently logged-in user exists in the fresh list, update their
    // cached session so permissions are always up-to-date without re-login.
    try {
      const raw = localStorage.getItem(LS_KEYS.USER);
      if (raw) {
        const session = JSON.parse(raw);
        const fresh = list.find(u => u.id === session.id);
        if (fresh) {
          const updated = {
            ...session,
            name: fresh.name,
            role: fresh.role,
            permissions: fresh.permissions,
          };
          localStorage.setItem(LS_KEYS.USER, JSON.stringify(updated));
        }
      }
    } catch (_) { /* silent — session refresh is best-effort */ }

    window.dispatchEvent(new CustomEvent("users-changed"));
  });
}


function getUsers() {
  return getLocalData(LS_KEYS.USERS, []);
}

async function saveUsers(users) {
  try {
    if (isFirebaseEnabled) {
      // Merge against Firestore's current users instead of diffing against a
      // possibly-stale local list. Never delete docs here — a stale in-memory
      // cache (empty until the users snapshot arrives) must not be able to
      // wipe Firestore users or overwrite their PINs. Use deleteUsers() for
      // explicit deletions.
      const snap = await getDocs(collection(db, "users"));
      const current = new Map();
      snap.docs.forEach(docSnap => {
        current.set(docSnap.id, docSnap.data());
      });

      // Enforce unique PINs — no two users may share the same PIN
      for (const u of users) {
        if (!u.pin) continue;
        for (const [id, existing] of current) {
          if (id !== u.id && existing.pin && existing.pin === u.pin) {
            throw new Error(localizeError(
              `PIN is already assigned to "${existing.name || id}". Please choose a different PIN.`,
              `यह PIN "${existing.name || id}" को असाइन है। कृपया कोई दूसरा PIN चुनें।`
            ));
          }
        }
      }

      const merged = new Map();
      current.forEach((u, id) => {
        merged.set(id, u);
      });
      users.forEach(u => {
        merged.set(u.id, u);
      });
      const batch = writeBatch(db);
      merged.forEach(u => {
        batch.set(doc(db, "users", u.id), u);
      });
      await batch.commit();
      setLocalData(LS_KEYS.USERS, Array.from(merged.values()));
      logAudit("user_saved", "user", users.map(u => u.id).join(","), users.map(u => u.name).join(", "));
      // Firebase mode: onSnapshot listener handles session refresh automatically
    } else {
      // Local mode: refresh session immediately after save
      const localUsers = getUsers();
      for (const u of users) {
        if (!u.pin) continue;
        const dup = localUsers.find(l => l.id !== u.id && l.pin === u.pin);
        if (dup) {
          throw new Error(localizeError(
            `PIN is already assigned to "${dup.name || dup.id}". Please choose a different PIN.`,
            `यह PIN "${dup.name || dup.id}" को असाइन है। कृपया कोई दूसरा PIN चुनें।`
          ));
        }
      }
      setLocalData(LS_KEYS.USERS, users);
      logAudit("user_saved", "user", users.map(u => u.id).join(","), users.map(u => u.name).join(", "));
      try {
        const raw = localStorage.getItem(LS_KEYS.USER);
        if (raw) {
          const session = JSON.parse(raw);
          const fresh = users.find(u => u.id === session.id);
          if (fresh) {
            const updated = { ...session, name: fresh.name, role: fresh.role, permissions: fresh.permissions };
            localStorage.setItem(LS_KEYS.USER, JSON.stringify(updated));
          }
        }
      } catch (_) { /* silent */ }
      window.dispatchEvent(new CustomEvent("users-changed"));
    }
  } catch (err) {
    logError("AUTH", err.message, err.stack);
    console.error("saveUsers: Error saving users", err);
    throw new Error(localizeError(`Save error: ${err.message}. Please try again.`, `सेव समस्या: ${err.message}। कृपया पुनः प्रयास करें।`));
  }
}

export async function deleteUsers(ids) {
  try {
    if (!ids || ids.length === 0) return;
    if (isFirebaseEnabled) {
      const batch = writeBatch(db);
      ids.forEach(id => {
        batch.delete(doc(db, "users", id));
      });
      await batch.commit();
    }
    const localUsers = getUsers();
    const remaining = localUsers.filter(u => !ids.includes(u.id));
    setLocalData(LS_KEYS.USERS, remaining);
    logAudit("user_deleted", "user", ids.join(","), ids.map(id => localUsers.find(u => u.id === id)?.name || id).join(", "));
    window.dispatchEvent(new CustomEvent("users-changed"));
  } catch (err) {
    logError("AUTH", err.message, err.stack);
    console.error("deleteUsers: Error deleting users", err);
    throw new Error(localizeError(`Delete error: ${err.message}. Please try again.`, `हटाने में समस्या: ${err.message}। कृपया पुनः प्रयास करें।`));
  }
}

async function migrateOldPins() {
  try {
    if (isFirebaseEnabled) {
      const snap = await getDocs(collection(db, "users"));
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setLocalData(LS_KEYS.USERS, list);
        return;
      }
    } else {
      const existing = getUsers();
      if (existing.length > 0) return;
    }

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

    await saveUsers(users);
  } catch (err) {
    logError("AUTH", err.message, err.stack);
    console.error("migrateOldPins: Migration error", err);
    throw new Error(localizeError(`Migration error: ${err.message}. Please try again.`, `माइग्रेशन समस्या: ${err.message}। कृपया पुनः प्रयास करें।`));
  }
}

export const login = async (email, password) => {
  try {
    await migrateOldPins();

    let users = [];
    if (isFirebaseEnabled) {
      const snap = await getDocs(collection(db, "users"));
      users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLocalData(LS_KEYS.USERS, users);
    } else {
      users = getUsers();
    }

    for (const u of users) {
      if (await verifyPin(password, u.pin)) {
        // Backfill missing permission keys from role defaults so older user
        // records (pre settingsManageUsers/settingsReset) keep working.
        const roleDefaults = u.role === "admin" ? ADMIN_PERMISSIONS : DEFAULT_PERMISSIONS;
        u.permissions = { ...roleDefaults, ...(u.permissions || {}) };
        const sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        
        if (isFirebaseEnabled) {
          const userRef = doc(db, "users", u.id);
          await setDoc(userRef, { sessionId }, { merge: true });
        }
        
        u.sessionId = sessionId;
        const localUsers = getUsers();
        const localIdx = localUsers.findIndex(lu => lu.id === u.id);
        if (localIdx !== -1) {
          localUsers[localIdx].sessionId = sessionId;
          setLocalData(LS_KEYS.USERS, localUsers);
        }

        const user = {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          permissions: u.permissions,
          sessionId: sessionId,
        };
        localStorage.setItem(LS_KEYS.USER, JSON.stringify(user));
        logAudit("auth_login", "user", u.id, `Logged in as ${u.name} (${u.role})`, { actorId: u.id, actorName: u.name, role: u.role });
        return user;
      }
    }

    // Fallback self-healing: if verification fails but password is a default PIN (1234 or 5555), re-hash and update
    if (password === "1234" || password === "5555") {
      const targetRole = password === "1234" ? "admin" : "staff";
      const idx = users.findIndex(u => u.role === targetRole);
      if (idx !== -1) {
        const updatedHash = await hashPin(password);
        users[idx].pin = updatedHash;
        const sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        
        if (isFirebaseEnabled) {
          const userRef = doc(db, "users", users[idx].id);
          await setDoc(userRef, { pin: updatedHash, sessionId }, { merge: true });
        }
        
        users[idx].sessionId = sessionId;
        setLocalData(LS_KEYS.USERS, users);

        const u = users[idx];
        const roleDefaults = u.role === "admin" ? ADMIN_PERMISSIONS : DEFAULT_PERMISSIONS;
        u.permissions = { ...roleDefaults, ...(u.permissions || {}) };
        const user = {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          permissions: u.permissions,
          sessionId: sessionId,
        };
        localStorage.setItem(LS_KEYS.USER, JSON.stringify(user));
        logAudit("auth_login", "user", u.id, `Logged in as ${u.name} (${u.role})`, { actorId: u.id, actorName: u.name, role: u.role });
        return user;
      }
    }

    throw new Error(localizeError(
      "Invalid PIN. Please enter the correct PIN and try again. If it still fails, ask the Admin to reset your PIN in User Management.",
      "अमान्य PIN। कृपया सही PIN डालें और पुनः प्रयास करें। यदि फिर भी न हो तो Admin से User Management में PIN रीसेट करवाएं।"
    ));
  } catch (err) {
    logError("AUTH", err.message, err.stack);
    console.error("login error", err);
    throw new Error(localizeError(`Login failed: ${err.message}`, `लॉगिन विफल: ${err.message}`));
  }
};

export const logout = async () => {
  try {
    const session = localStorage.getItem(LS_KEYS.USER);
    const u = session ? JSON.parse(session) : null;
    logAudit("auth_logout", "user", u?.id || "", u ? `Logged out ${u.name}` : "Logged out", u ? { actorId: u.id, actorName: u.name, role: u.role } : {});
    localStorage.removeItem(LS_KEYS.USER);
  } catch (err) {
    logError("AUTH", err.message, err.stack);
    console.error("logout error", err);
    throw new Error(localizeError(`Logout error: ${err.message}. Please try again.`, `लॉगआउट समस्या: ${err.message}। कृपया पुनः प्रयास करें।`));
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
