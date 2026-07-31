import { collection, doc, setDoc, onSnapshot, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./config";

const getDeviceLabel = () => {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iPhone/iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Macintosh|Mac OS/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown device";
};

// Read the active session directly from localStorage — keeps the audit module
// free of heavy imports (stores → firebase → dbService) so tests and startup stay light.
const getActor = () => {
  try {
    const raw = localStorage.getItem("pan_user");
    if (raw) {
      const u = JSON.parse(raw);
      return { actorId: u.id || "system", actorName: u.name || "System", role: u.role || "system" };
    }
  } catch (_) { /* ignore */ }
  return { actorId: "system", actorName: "System", role: "system" };
};

export async function logAudit(action, entityType, entityId = "", details = "", extra = {}) {
  try {
    if (!isFirebaseEnabled || !db) return;
    const actor = getActor();
    const actorId = extra.actorId || actor.actorId;
    const actorName = extra.actorName || actor.actorName;
    const role = extra.role || actor.role;
    delete extra.actorId;
    delete extra.actorName;
    delete extra.role;
    const id = "aud_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    await setDoc(doc(db, "audit_log", id), {
      id,
      action,
      entityType,
      entityId: entityId || "",
      details: details || "",
      actorId,
      actorName,
      role,
      device: getDeviceLabel(),
      timestamp: Date.now(),
      ...extra,
    });
  } catch (err) {
    // Audit must never break the core flow — fail silently
    console.warn("logAudit failed:", err);
  }
}

export function initAuditListener(callback) {
  if (!isFirebaseEnabled || !db) return () => {};
  const q = query(collection(db, "audit_log"), orderBy("timestamp", "desc"), limit(500));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(list);
  });
}

export async function getAuditLogs() {
  try {
    if (!isFirebaseEnabled || !db) return [];
    const snap = await getDocs(query(collection(db, "audit_log"), orderBy("timestamp", "desc"), limit(500)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("getAuditLogs failed:", err);
    return [];
  }
}
