import { useState, useEffect } from "react";
import { getUsers, saveUsers } from "../db/auth";
import { hashPin } from "../db/hash";
import { DEFAULT_PERMISSIONS, ADMIN_PERMISSIONS } from "../constants";
import { logError } from "../db/errorLog";

const ALL_PERMS = [
  { key: "pos", label: "POS" },
  { key: "stock", label: "Stock" },
  { key: "khata", label: "Credit Accounts" },
  { key: "reports", label: "Reports" },
  { key: "expenses", label: "Expenses" },
  { key: "settings", label: "Settings" },
];

export default function UserManager() {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: "", pin: "", permissions: { ...DEFAULT_PERMISSIONS } });
  const [error, setError] = useState("");

  const load = () => { try { setUsers(getUsers()); } catch (err) { logError("AUTH", err.message, err.stack); alert("❌ " + (err.message || "Failed to load users")); console.error(err); } };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({ name: "", pin: "", permissions: { ...DEFAULT_PERMISSIONS } });
    setEditingId(null);
    setError("");
  };

  const openEdit = (u) => {
    setForm({ name: u.name, pin: "", permissions: { ...u.permissions } });
    setEditingId(u.id);
    setShowForm(true);
  };

  const togglePerm = (key) => {
    setForm(prev => ({
      ...prev,
      permissions: { ...prev.permissions, [key]: !prev.permissions[key] },
    }));
  };

  const handleSave = async () => {
    setError("");
    if (!form.name.trim()) { setError("Name is required."); return; }

    try {
      const list = getUsers();

      if (editingId) {
        const idx = list.findIndex(u => u.id === editingId);
        if (idx === -1) return;
        list[idx].name = form.name.trim();
        list[idx].permissions = { ...form.permissions };
        if (form.pin.length === 4) {
          list[idx].pin = await hashPin(form.pin);
        }
      } else {
        if (form.pin.length !== 4) { setError("PIN must be exactly 4 digits."); return; }
        list.push({
          id: "u" + Date.now(),
          name: form.name.trim(),
          pin: await hashPin(form.pin),
          role: "staff",
          permissions: { ...form.permissions },
        });
      }

      saveUsers(list);
      load();
      setShowForm(false);
      resetForm();
    } catch (err) {
      logError("AUTH", err.message, err.stack);
      setError(err.message || "Failed to save user");
      console.error(err);
    }
  };

  const handleDelete = (id) => {
    if (id === "u1") { setError("Cannot delete the default Admin user."); return; }
    try {
      const list = getUsers().filter(u => u.id !== id);
      saveUsers(list);
      load();
    } catch (err) {
      logError("AUTH", err.message, err.stack);
      setError(err.message || "Failed to delete user");
      console.error(err);
    }
  };

  const permCount = (perms) => {
    const p = perms || {};
    return Object.values(p).filter(Boolean).length;
  };

  return (
    <div style={styles.container}>
      {!showForm ? (
        <>
          <div style={styles.headerRow}>
            <span style={styles.count}>{users.length} user{users.length !== 1 ? "s" : ""}</span>
            <button onClick={() => { resetForm(); setShowForm(true); }} className="btn btn-primary" style={{ padding: "0.4rem 0.75rem", fontSize: "0.85rem" }}>
              + Add User
            </button>
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.list}>
            {users.map(u => (
              <div key={u.id} style={styles.card}>
                <div style={styles.cardTop}>
                  <div>
                    <div style={styles.name}>{u.name}</div>
                  </div>
                  <div style={styles.badge}>{permCount(u.permissions)}/{ALL_PERMS.length} perms</div>
                </div>
                <div style={styles.permRow}>
                  {ALL_PERMS.map(p => (
                    <span key={p.key} style={{ ...styles.permChip, ...(u.permissions?.[p.key] ? styles.permOn : styles.permOff) }}>
                      {p.label}
                    </span>
                  ))}
                </div>
                <div style={styles.cardActions}>
                  <button onClick={() => openEdit(u)} style={styles.editBtn}>Edit</button>
                  {u.id !== "u1" && (
                    <button onClick={() => handleDelete(u.id)} style={styles.deleteBtn}>Delete</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <h3 style={styles.formTitle}>{editingId ? "Edit User" : "Add User"}</h3>

          {error && <div style={styles.error}>{error}</div>}

          <div className="input-group">
            <label className="input-label">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              className="input-field"
              placeholder="User name"
            />
          </div>

          <div className="input-group">
            <label className="input-label">PIN {editingId ? "(leave blank to keep current)" : "(4 digits)"}</label>
            <input
              type="text"
              maxLength={4}
              value={form.pin}
              onChange={e => setForm(prev => ({ ...prev, pin: e.target.value.replace(/\D/g, "") }))}
              className="input-field"
              placeholder={editingId ? "Leave blank to keep" : "Enter 4-digit PIN"}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Permissions</label>
            <div style={styles.permGrid}>
              {ALL_PERMS.map(p => (
                <label key={p.key} style={styles.permToggle}>
                  <input
                    type="checkbox"
                    checked={form.permissions[p.key] || false}
                    onChange={() => togglePerm(p.key)}
                  />
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={styles.formActions}>
            <button onClick={handleSave} className="btn btn-primary" style={{ flex: 1, padding: "0.6rem" }}>
              {editingId ? "Save Changes" : "Add User"}
            </button>
            <button onClick={() => { setShowForm(false); resetForm(); }} className="btn btn-outline" style={{ flex: 1, padding: "0.6rem" }}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  container: { display: "flex", flexDirection: "column", gap: "1rem" },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  count: { fontSize: "0.85rem", fontWeight: "600", color: "#64748b" },
  error: { color: "#ef4444", fontSize: "0.8rem", fontWeight: "600", backgroundColor: "#fef2f2", padding: "0.5rem", borderRadius: "6px", textAlign: "center" },
  list: { display: "flex", flexDirection: "column", gap: "0.75rem" },
  card: { backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "0.75rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" },
  name: { fontWeight: "700", color: "#1e293b", fontSize: "0.95rem" },
  badge: { fontSize: "0.7rem", fontWeight: "700", color: "#047857", backgroundColor: "#f0fdf4", padding: "2px 8px", borderRadius: "99px" },
  permRow: { display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "0.5rem" },
  permChip: { fontSize: "0.65rem", fontWeight: "600", padding: "2px 8px", borderRadius: "99px" },
  permOn: { backgroundColor: "#f0fdf4", color: "#166534" },
  permOff: { backgroundColor: "#f1f5f9", color: "#94a3b8" },
  cardActions: { display: "flex", gap: "0.5rem", justifyContent: "flex-end", borderTop: "1px solid #f1f5f9", paddingTop: "0.5rem" },
  editBtn: { background: "none", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "0.3rem 0.6rem", fontSize: "0.75rem", fontWeight: "600", color: "#475569", cursor: "pointer" },
  deleteBtn: { background: "none", border: "1px solid #fecaca", borderRadius: "6px", padding: "0.3rem 0.6rem", fontSize: "0.75rem", fontWeight: "600", color: "#dc2626", cursor: "pointer" },
  formTitle: { fontSize: "1.1rem", fontWeight: "700", color: "#1e293b" },
  permGrid: { display: "flex", flexDirection: "column", gap: "0.4rem" },
  permToggle: { display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", fontWeight: "500", color: "#1e293b", cursor: "pointer" },
  formActions: { display: "flex", gap: "0.5rem" },
};
