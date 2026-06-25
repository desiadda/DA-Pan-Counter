import { useState, useEffect } from "react";
import { dbService } from "../firebase";

export default function SupplierDirectory() {
  const [suppliers, setSuppliers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editSup, setEditSup] = useState(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => { load(); }, []);

  const load = () => setSuppliers(dbService.getSuppliers());

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    dbService.saveSupplier(editSup ? {
      ...editSup, name: name.trim(), contact: contact.trim(),
      phone: phone.trim(), address: address.trim(),
    } : {
      name: name.trim(), contact: contact.trim(),
      phone: phone.trim(), address: address.trim(),
    });
    reset();
    load();
  };

  const handleEdit = (s) => {
    setEditSup(s); setName(s.name); setContact(s.contact || "");
    setPhone(s.phone || ""); setAddress(s.address || ""); setShowForm(true);
  };

  const reset = () => {
    setShowForm(false); setEditSup(null); setName("");
    setContact(""); setPhone(""); setAddress("");
  };

  const purchases = dbService.getPurchaseOrders();

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <h3 style={styles.title}>📍 Supplier Directory</h3>
        <button onClick={() => { reset(); setShowForm(true); }} className="btn btn-primary" style={{ padding: "0.35rem 0.7rem", fontSize: "0.8rem" }}>+ Add Supplier</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={styles.form}>
          <div className="input-group" style={{ marginBottom: "0.5rem" }}>
            <label className="input-label">Supplier Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-field" placeholder="Name" required autoFocus />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <div className="input-group" style={{ marginBottom: "0.5rem" }}>
              <label className="input-label">Contact Person</label>
              <input type="text" value={contact} onChange={e => setContact(e.target.value)} className="input-field" placeholder="Contact" />
            </div>
            <div className="input-group" style={{ marginBottom: "0.5rem" }}>
              <label className="input-label">Phone</label>
              <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="input-field" placeholder="Phone" />
            </div>
          </div>
          <div className="input-group" style={{ marginBottom: "0.5rem" }}>
            <label className="input-label">Address</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="input-field" placeholder="Address" />
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: "0.5rem", fontSize: "0.85rem" }}>{editSup ? "Update" : "Save"}</button>
            <button type="button" onClick={reset} className="btn btn-outline" style={{ flex: 1, padding: "0.5rem", fontSize: "0.85rem" }}>Cancel</button>
          </div>
        </form>
      )}

      {suppliers.length === 0 ? (
        <p style={styles.empty}>No suppliers added yet.</p>
      ) : (
        <div style={styles.list}>
          {suppliers.map(s => {
            const supPurchases = purchases.filter(p => p.supplier === s.name);
            return (
              <div key={s.id} style={styles.card}>
                <div style={styles.cardTop}>
                  <div>
                    <div style={styles.supName}>{s.name}</div>
                    {s.contact && <div style={styles.supDetail}>{s.contact}</div>}
                    {s.phone && <div style={styles.supDetail}>📞 {s.phone}</div>}
                    {s.address && <div style={styles.supDetail}>📍 {s.address}</div>}
                  </div>
                  <button onClick={() => handleEdit(s)} style={styles.editBtn}>✎</button>
                </div>
                {supPurchases.length > 0 && (
                  <div style={styles.purchases}>
                    <span style={styles.purchLabel}>Purchase Orders ({supPurchases.length})</span>
                    <div style={styles.purchList}>
                      {supPurchases.slice(0, 3).map(po => (
                        <div key={po.id} style={styles.purchRow}>
                          <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{new Date(po.createdAt).toLocaleDateString("en-GB")}</span>
                          <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>฿{po.total?.toFixed(0)}</span>
                          <span style={{
                            fontSize: "0.65rem", fontWeight: 600,
                            color: po.status === "completed" ? "#047857" : po.status === "cancelled" ? "#dc2626" : "#d97706",
                          }}>{po.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "0.75rem" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: "1rem", fontWeight: 700, color: "#1e293b", margin: 0 },
  form: {
    background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0",
    padding: "1rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  empty: { textAlign: "center", color: "#94a3b8", fontSize: "0.85rem", padding: "1.5rem" },
  list: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  card: {
    background: "#fff", borderRadius: "10px", border: "1px solid #e2e8f0",
    padding: "0.75rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  supName: { fontWeight: 700, fontSize: "0.9rem", color: "#1e293b" },
  supDetail: { fontSize: "0.75rem", color: "#64748b", marginTop: "1px" },
  editBtn: { background: "none", border: "none", fontSize: "1rem", cursor: "pointer", color: "#64748b" },
  purchases: { marginTop: "0.5rem", borderTop: "1px solid #f1f5f9", paddingTop: "0.5rem" },
  purchLabel: { fontSize: "0.7rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" },
  purchList: { marginTop: "0.25rem", display: "flex", flexDirection: "column", gap: "2px" },
  purchRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
};
