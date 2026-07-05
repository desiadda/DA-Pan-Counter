import { useState, useEffect } from "react";
import { dbService } from "../firebase";
import { db, isFirebaseEnabled } from "../db/config";
import { collection, onSnapshot } from "firebase/firestore";

export default function SupplierDirectory() {
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editSup, setEditSup] = useState(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isFirebaseEnabled && db) {
      const unsubSups = onSnapshot(collection(db, "suppliers"), (snap) => {
        setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      const unsubPurchs = onSnapshot(collection(db, "purchases"), (snap) => {
        setPurchases(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return () => {
        unsubSups();
        unsubPurchs();
      };
    } else {
      load();
    }
  }, []);

  const load = async () => {
    try {
      const [sups, purchs] = await Promise.all([
        dbService.getSuppliers(),
        dbService.getPurchaseOrders()
      ]);
      setSuppliers(sups || []);
      setPurchases(purchs || []);
    } catch (e) {
      console.error("Failed to load supplier directory data", e);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    try {
      setSubmitting(true);
      await dbService.saveSupplier(editSup ? {
        ...editSup, name: name.trim(), contact: contact.trim(),
        phone: phone.trim(), address: address.trim(),
      } : {
        name: name.trim(), contact: contact.trim(),
        phone: phone.trim(), address: address.trim(),
      });
      reset();
      load();
    } catch (err) {
      console.error(err);
      alert("❌ Failed to save supplier: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (s) => {
    setEditSup(s); setName(s.name); setContact(s.contact || "");
    setPhone(s.phone || ""); setAddress(s.address || ""); setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (submitting) return;
    if (window.confirm("Are you sure you want to delete this supplier?")) {
      try {
        setSubmitting(true);
        await dbService.deleteSupplier(id);
        load();
      } catch (err) {
        console.error(err);
        alert("❌ Failed to delete supplier: " + err.message);
      } finally {
        setSubmitting(false);
      }
    }
  };

  const reset = () => {
    setShowForm(false); setEditSup(null); setName("");
    setContact(""); setPhone(""); setAddress("");
  };

  return (
    <div className="sup-wrapper">
      <div className="sup-header">
        <h3 className="section-subtitle">📍 Supplier Directory</h3>
        <button onClick={() => { reset(); setShowForm(true); }} className="btn btn-primary btn-sm">+ Add Supplier</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Supplier Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-field" placeholder="Name" required autoFocus />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Contact Person</label>
              <input type="text" value={contact} onChange={e => setContact(e.target.value)} className="input-field" placeholder="Contact" />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Phone</label>
              <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="input-field" placeholder="Phone" />
            </div>
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Address</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="input-field" placeholder="Address" />
          </div>
          <div className="flex-btn-group">
            <button type="submit" disabled={submitting} className="btn btn-primary btn-sm">
              {submitting ? "Saving..." : (editSup ? "Update" : "Save")}
            </button>
            <button type="button" onClick={reset} className="btn btn-outline btn-sm">Cancel</button>
          </div>
        </form>
      )}

      {suppliers.length === 0 ? (
        <div className="sup-empty">No suppliers added yet.</div>
      ) : (
        <div className="coh-tx-list">
          {suppliers.map(s => {
            const supPurchases = purchases.filter(p => p.supplier === s.name);
            return (
              <div key={s.id} className="sup-card">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="sup-name">{s.name}</div>
                    {s.contact && <div className="sup-detail">{s.contact}</div>}
                    {s.phone && <div className="sup-detail">📞 {s.phone}</div>}
                    {s.address && <div className="sup-detail">📍 {s.address}</div>}
                  </div>
                  <div style={{ display: "flex", gap: "0.25rem" }}>
                    <button onClick={() => handleEdit(s)} className="sup-edit-btn" title="Edit">✎</button>
                    <button onClick={() => handleDelete(s.id)} className="sup-edit-btn" style={{ color: "#dc2626" }} title="Delete">🗑️</button>
                  </div>
                </div>
                {supPurchases.length > 0 && (
                  <div className="sup-purchases">
                    <span className="sup-purch-label">Purchase Orders ({supPurchases.length})</span>
                    <div className="flex-col gap-xs" style={{ marginTop: "0.25rem" }}>
                      {supPurchases.slice(0, 3).map(po => (
                        <div key={po.id} className="sup-purch-row">
                          <span className="text-xs text-muted">{new Date(po.createdAt).toLocaleDateString("en-GB")}</span>
                          <span className="text-sm font-semibold">฿{po.total?.toFixed(0)}</span>
                          <span className="text-xs font-semibold"
                            style={{ color: po.status === "completed" ? "var(--primary)" : po.status === "cancelled" ? "var(--error)" : "var(--secondary)" }}>{po.status}</span>
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
