import { useState, useEffect } from "react";
import { getUsers, saveUsers } from "../db/auth";
import { hashPin } from "../db/hash";
import { DEFAULT_PERMISSIONS } from "../constants";
import { logError } from "../db/errorLog";

const PERM_CATEGORIES = [
  {
    title: "POS Controls",
    perms: [
      { key: "pos", label: "Access POS Screen" },
      { key: "posDiscount", label: "Apply Discounts" },
      { key: "posCustomPrice", label: "Custom Item Prices" },
      { key: "posVoidCart", label: "Clear/Void Cart Items" },
    ]
  },
  {
    title: "Stock & Inventory",
    perms: [
      { key: "stock", label: "Access Inventory Screen" },
      { key: "stockEdit", label: "Add/Edit Products" },
      { key: "stockDelete", label: "Delete Products" },
      { key: "stockAdjust", label: "Adjust Stock Levels" },
    ]
  },
  {
    title: "Khata Credit Accounts",
    perms: [
      { key: "khata", label: "Access Khata Screen" },
      { key: "khataPay", label: "Clear Customer Debts" },
      { key: "khataDelete", label: "Delete Khata Accounts/Records" },
    ]
  },
  {
    title: "Financials & Administration",
    perms: [
      { key: "expenses", label: "Manage Expenses" },
      { key: "reports", label: "View Reports & Analytics" },
      { key: "cohApprove", label: "Approve COH Transfers" },
      { key: "cohAdjust", label: "Directly Adjust COH Balances" },
      { key: "settings", label: "Access Settings Panel" },
      { key: "settingsManageUsers", label: "Create & Manage Users" },
      { key: "settingsReset", label: "Perform Factory Reset" },
    ]
  }
];

export default function UserManager() {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: "", pin: "", permissions: { ...DEFAULT_PERMISSIONS } });
  const [error, setError] = useState("");

  const load = () => { try { setUsers(getUsers()); } catch (err) { logError("AUTH", err.message, err.stack); alert("❌ " + (err.message || "Failed to load users")); console.error(err); } };

  useEffect(() => {
    load();
    window.addEventListener("users-changed", load);
    return () => {
      window.removeEventListener("users-changed", load);
    };
  }, []);

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

      await saveUsers(list);
      load();
      setShowForm(false);
      resetForm();
    } catch (err) {
      logError("AUTH", err.message, err.stack);
      setError(err.message || "Failed to save user");
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (id === "u1") { setError("Cannot delete the default Admin user."); return; }
    try {
      const list = getUsers().filter(u => u.id !== id);
      await saveUsers(list);
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
    <div className="content-section">
      {!showForm ? (
        <>
          <div className="sup-header">
            <span className="user-count">{users.length} user{users.length !== 1 ? "s" : ""}</span>
            <button onClick={() => { resetForm(); setShowForm(true); }} className="btn btn-primary btn-sm">
              + Add User
            </button>
          </div>

          {error && <div className="error-inline">{error}</div>}

          <div className="coh-tx-list">
            {users.map(u => (
              <div key={u.id} className="user-card">
                <div className="user-card-top">
                  <div>
                    <div className="user-name">{u.name}</div>
                  </div>
                  <div className="user-perm-badge">{permCount(u.permissions)}/{ALL_PERMS.length} perms</div>
                </div>
                <div className="user-perm-row">
                  {ALL_PERMS.map(p => (
                    <span key={p.key} className={`user-perm-chip ${u.permissions?.[p.key] ? "user-perm-on" : "user-perm-off"}`}>
                      {p.label}
                    </span>
                  ))}
                </div>
                <div className="user-card-actions">
                  <button onClick={() => openEdit(u)} className="user-btn-sm user-btn-edit">Edit</button>
                  {u.id !== "u1" && (
                    <button onClick={() => handleDelete(u.id)} className="user-btn-sm user-btn-delete">Delete</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <h3 className="section-subtitle" style={{ fontSize: "1.1rem" }}>{editingId ? "Edit User" : "Add User"}</h3>

          {error && <div className="error-inline">{error}</div>}

          <div className="input-group">
            <label className="input-label">Name</label>
            <input type="text" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              className="input-field" placeholder="User name" />
          </div>

          <div className="input-group">
            <label className="input-label">PIN {editingId ? "(leave blank to keep current)" : "(4 digits)"}</label>
            <input type="text" maxLength={4} value={form.pin}
              onChange={e => setForm(prev => ({ ...prev, pin: e.target.value.replace(/\D/g, "") }))}
              className="input-field" placeholder={editingId ? "Leave blank to keep" : "Enter 4-digit PIN"} />
          </div>

          <div className="input-group">
            <label className="input-label" style={{marginBottom: "0.75rem"}}>Permissions Control</label>
            <div style={{display: "flex", flexDirection: "column", gap: "1rem"}}>
              {PERM_CATEGORIES.map(cat => (
                <div key={cat.title} style={{border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden"}}>
                  <div style={{backgroundColor: "var(--bg-hover, #f8fafc)", padding: "0.5rem 0.75rem", borderBottom: "1px solid var(--border)", fontSize: "0.8rem", fontWeight: "bold", color: "var(--text-muted)"}}>{cat.title}</div>
                  <div style={{display: "flex", flexDirection: "column", padding: "0.25rem 0.75rem"}}>
                    {cat.perms.map(p => (
                      <div key={p.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 0", borderBottom: "1px solid var(--border)", lastChild: { borderBottom: "none" } } as any}>
                        <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text)" }}>{p.label}</span>
                        <label className="switch">
                          <input type="checkbox" checked={form.permissions[p.key] || false} onChange={() => togglePerm(p.key)} />
                          <span className="slider"></span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-btn-group">
            <button onClick={handleSave} className="btn btn-primary">{editingId ? "Save Changes" : "Add User"}</button>
            <button onClick={() => { setShowForm(false); resetForm(); }} className="btn btn-outline">Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}
