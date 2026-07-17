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

  // Supplier Khata States
  const [selectedLedgerSup, setSelectedLedgerSup] = useState(null);
  const [paymentSup, setPaymentSup] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("Cash");

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
        balance: 0,
        ledger: []
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

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0 || !paymentSup || submitting) return;
    try {
      setSubmitting(true);
      const user = JSON.parse(localStorage.getItem("pan_user") || "{}");
      await dbService.recordSupplierPayment(
        paymentSup.id,
        paymentSup.name,
        amount,
        payMode,
        user.id || "system",
        user.name || "System"
      );
      setPaymentSup(null);
      setPayAmount("");
      alert("✅ Payment recorded successfully!");
      load();
    } catch (err) {
      console.error(err);
      alert("❌ Failed to record payment: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setShowForm(false); setEditSup(null); setName("");
    setContact(""); setPhone(""); setAddress("");
  };

  return (
    <div className="sup-wrapper">
      <div className="sup-header">
        <h3 className="section-subtitle">📍 Supplier Directory & Khata</h3>
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

      {/* Record Payment Form Sheet */}
      {paymentSup && (
        <form onSubmit={handleRecordPayment} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", border: "1.5px solid var(--primary)" }}>
          <h4 style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "var(--primary)" }}>Record Payment to {paymentSup.name}</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Amount (฿)</label>
              <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="input-field" placeholder="0.00" min="1" max={paymentSup.balance} required autoFocus />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Payment Mode</label>
              <select value={payMode} onChange={e => setPayMode(e.target.value)} className="input-field" style={{ fontFamily: "inherit" }}>
                <option value="Cash">Cash (COH)</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>
          </div>
          <div className="flex-btn-group">
            <button type="submit" disabled={submitting} className="btn btn-primary btn-sm">Submit Payment</button>
            <button type="button" onClick={() => setPaymentSup(null)} className="btn btn-outline btn-sm">Cancel</button>
          </div>
        </form>
      )}

      {suppliers.length === 0 ? (
        <div className="sup-empty">No suppliers added yet.</div>
      ) : (
        <div className="coh-tx-list">
          {suppliers.map(s => {
            const supPurchases = purchases.filter(p => p.supplierId === s.id);
            return (
              <div key={s.id} className="sup-card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.75rem", border: "1px solid #e2e8f0", borderRadius: "10px", background: "#fff" }}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="sup-name" style={{ fontWeight: 700, fontSize: "0.9rem" }}>{s.name}</div>
                    {s.contact && <div className="sup-detail">{s.contact}</div>}
                    {s.phone && <div className="sup-detail">📞 {s.phone}</div>}
                    {s.address && <div className="sup-detail">📍 {s.address}</div>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.3rem" }}>
                    <div style={{ display: "flex", gap: "0.25rem" }}>
                      <button onClick={() => handleEdit(s)} className="sup-edit-btn" title="Edit">✎</button>
                      <button onClick={() => handleDelete(s.id)} className="sup-edit-btn" style={{ color: "#dc2626" }} title="Delete">🗑️</button>
                    </div>
                    <div style={{ textAlign: "right", marginTop: "0.25rem" }}>
                      <div style={{ fontSize: "0.7rem", color: "#64748b" }}>Udhaar / Credit</div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 800, color: (s.balance || 0) > 0 ? "#dc2626" : "#047857" }}>
                        ฿{(s.balance || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                  {(s.balance || 0) > 0 && (
                    <button onClick={() => setPaymentSup(s)} className="btn btn-primary" style={{ padding: "3px 8px", fontSize: "0.7rem", borderRadius: "6px" }}>
                      💸 Pay Supplier
                    </button>
                  )}
                  {s.ledger && s.ledger.length > 0 && (
                    <button onClick={() => setSelectedLedgerSup(selectedLedgerSup === s.id ? null : s.id)} className="btn btn-outline" style={{ padding: "3px 8px", fontSize: "0.7rem", borderRadius: "6px" }}>
                      {selectedLedgerSup === s.id ? "Hide Ledger" : "View Ledger"}
                    </button>
                  )}
                </div>

                {/* Ledger View */}
                {selectedLedgerSup === s.id && s.ledger && (
                  <div style={{ marginTop: "0.5rem", borderTop: "1px solid #f1f5f9", paddingTop: "0.5rem" }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#64748b" }}>TRANSACTION LEDGER / खाता विवरण</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginTop: "0.25rem" }}>
                      {s.ledger.map((item, idx) => (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", borderBottom: "1px dashed #f1f5f9", paddingBottom: "2px" }}>
                          <div>
                            <span style={{ color: "#94a3b8", marginRight: "0.4rem" }}>{new Date(item.date).toLocaleDateString("en-GB")}</span>
                            <span style={{ fontWeight: 600, color: item.type === "Payment" ? "#047857" : "#b91c1c" }}>{item.type}</span>
                            <span style={{ color: "#64748b", marginLeft: "0.4rem", fontSize: "0.68rem" }}>{item.description}</span>
                          </div>
                          <span style={{ fontWeight: 700, color: item.type === "Payment" ? "#047857" : "#b91c1c" }}>
                            {item.type === "Payment" ? "-" : "+"}฿{item.amount?.toFixed(0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {supPurchases.length > 0 && !selectedLedgerSup && (
                  <div className="sup-purchases" style={{ marginTop: "0.25rem", borderTop: "1px solid #f1f5f9", paddingTop: "0.25rem" }}>
                    <span className="sup-purch-label">Purchases ({supPurchases.length})</span>
                    <div className="flex-col gap-xs" style={{ marginTop: "0.25rem" }}>
                      {supPurchases.slice(0, 2).map(po => (
                        <div key={po.id} className="sup-purch-row" style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem" }}>
                          <span className="text-xs text-muted">{new Date(po.createdAt).toLocaleDateString("en-GB")}</span>
                          <span className="text-sm font-semibold">฿{po.total?.toFixed(0)}</span>
                          <span className="text-xs font-semibold"
                            style={{ color: po.status === "received" ? "var(--primary)" : po.status === "cancelled" ? "var(--error)" : "var(--secondary)" }}>
                            {po.status === "received" ? "Received" : po.status}
                          </span>
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
