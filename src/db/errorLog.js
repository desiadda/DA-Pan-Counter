const LS_KEY = "pan_error_logs";
const MAX_LOGS = 500;

const CATEGORIES = {
  STORAGE: "Storage",
  NETWORK: "Network",
  AUTH: "Authentication",
  TRANSACTION: "Transaction",
  INVENTORY: "Inventory",
  EXPENSE: "Expense",
  CREDIT: "Credit Account",
  EXPORT_IMPORT: "Backup/Restore",
  COH: "Cash on Hand",
  SETTINGS: "Settings",
  SYSTEM: "System",
};

const SEVERITY = {
  INFO: "info",
  WARNING: "warning",
  ERROR: "error",
  CRITICAL: "critical",
};

function getLogsRaw() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLogsRaw(logs) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(logs));
  } catch {
    // silently fail — can't log if storage is full
  }
}

export function logError(category, message, details, severity = SEVERITY.ERROR) {
  try {
    const logs = getLogsRaw();
    logs.unshift({
      id: Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      category: CATEGORIES[category] || category,
      severity,
      message,
      details: details || "",
      timestamp: Date.now(),
      read: false,
    });
    if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
    saveLogsRaw(logs);
    // Dispatch custom event so UI can react
    window.dispatchEvent(new CustomEvent("error-logged", { detail: { category: CATEGORIES[category] || category, severity } }));
  } catch {
    // total fallback
  }
}

export function getErrors(category) {
  const logs = getLogsRaw();
  if (category && category !== "All") return logs.filter(e => e.category === category);
  return logs;
}

export function getCategories() {
  const logs = getLogsRaw();
  const cats = {};
  logs.forEach(e => {
    if (!cats[e.category]) cats[e.category] = 0;
    cats[e.category]++;
  });
  return Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
}

export function getUnreadCount(severity) {
  const logs = getLogsRaw();
  if (severity) return logs.filter(e => !e.read && e.severity === severity).length;
  return logs.filter(e => !e.read).length;
}

export function getCriticalUnreadCount() {
  return getUnreadCount(SEVERITY.CRITICAL);
}

export function markAsRead(id) {
  const logs = getLogsRaw();
  const found = logs.find(e => e.id === id);
  if (found) { found.read = true; saveLogsRaw(logs); }
}

export function markAllAsRead() {
  const logs = getLogsRaw();
  logs.forEach(e => { e.read = true; });
  saveLogsRaw(logs);
  window.dispatchEvent(new CustomEvent("error-logged"));
}

export function clearErrors() {
  saveLogsRaw([]);
  window.dispatchEvent(new CustomEvent("error-logged"));
}

export function deleteError(id) {
  const logs = getLogsRaw().filter(e => e.id !== id);
  saveLogsRaw(logs);
}

export { CATEGORIES, SEVERITY };
