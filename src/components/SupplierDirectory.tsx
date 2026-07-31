import { useState, useEffect, useMemo } from "react";
import { dbService } from "../firebase";
import { db, isFirebaseEnabled } from "../db/config";
import { collection, onSnapshot } from "firebase/firestore";
import { useLangStore } from "../stores/langStore";
import { useConfirmStore } from "../stores/confirmStore";
import { useDBStore } from "../stores/dbStore";
import { UDHAAR_MODE } from "../constants";

export default function SupplierDirectory() {
  const lang = useLangStore((s) => s.lang);
  const confirm = useConfirmStore((s) => s.confirm);
  const paymentModes = useDBStore((s) => s.paymentModes);
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editSup, setEditSup] = useState(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");

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
    if (await confirm("Are you sure you want to delete this supplier?", { title: "Delete Supplier", confirmLabel: "Delete", variant: "danger" })) {
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

  const payModeOptions = useMemo(() => {
    const modes = (paymentModes && paymentModes.length ? paymentModes : []).filter(m => m.enabled);
    if (modes.length === 0) return [{ id: "Cash", name: "Cash (COH)" }, { id: "Bank Transfer", name: "Bank Transfer" }];
    return modes;
  }, [paymentModes]);

  const q = searchQuery.trim().toLowerCase();
  const filteredSuppliers = useMemo(() => {
    const list = suppliers.filter(s =>
      !q ||
      (s.name || "").toLowerCase().includes(q) ||
      (s.phone || "").toLowerCase().includes(q) ||
      (s.contact || "").toLowerCase().includes(q)
    );
    if (sortBy === "balance") return [...list].sort((a, b) => (b.balance || 0) - (a.balance || 0));
    if (sortBy === "purchases") {
      return [...list].sort((a, b) => (b.balance || 0) === (a.balance || 0)
        ? (a.name || "").localeCompare(b.name || "") : 0);
    }
    return [...list].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [suppliers, q, sortBy]);

  const totalCredit = suppliers.reduce((sum, s) => sum + (s.balance || 0), 0);
  const pendingPos = purchases.filter(p => p.status === "pending").length;

  return (
    <div className="sup-wrapper">
      <div className="sup-header">
        <h3 className="section-subtitle">📍 Supplier Directory & Khata</h3>
        <button onClick={() => { reset(); setShowForm(true); }} className="btn btn-primary btn-sm">+ Add Supplier</button>
      </div>

      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <span style={styles.statValue}>{suppliers.length}</span>
          <span style={styles.statLabel}>Suppliers</span>
        </div>
        <div style={styles.statCard}>
          <span style={{ ...styles.statValue, color: totalCredit > 0 ? "#dc2626" : "#047857" }}>฿{totalCredit.toFixed(0)}</span>
          <span style={styles.statLabel}>Credit Outstanding</span>
        </div>
        <div style={styles.statCard}>
          <span style={{ ...styles.statValue, color: pendingPos > 0 ? "#d97706" : "#64748b" }}>{pendingPos}</span>
          <span style={styles.statLabel}>Pending POs</span>
        </div>
      </div>

      <div style={styles.filterBar}>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search name, phone, contact..."
          style={styles.searchInput}
        />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={styles.sortSelect}>
          <option value="name">Sort: Name (A–Z)</option>
          <option value="balance">Sort: Highest Credit</option>
        </select>
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
                {payModeOptions.map(m => (
                  <option key={m.id} value={m.id === UDHAAR_MODE ? "Credit" : m.id === "Cash" ? "Cash" : m.id}>
                    {m.id === UDHAAR_MODE ? "Credit (Khata)" : m.id === "Cash" ? "Cash (COH)" : m.name}
                  </option>
                ))}
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
      ) : filteredSuppliers.length === 0 ? (
        <div className="sup-empty">No suppliers match "{searchQuery}".</div>
      ) : (
        <div className="coh-tx-list">
          {filteredSuppliers.map(s => {
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
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#64748b" }}>
                      {lang === "hi" ? "खाता विवरण" : "TRANSACTION LEDGER"}
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginTop: "0.25rem" }}>
                      {(() => {
                        let running = 0;
                        return s.ledger.map((item, idx) => {
                          running += item.type === "Payment" ? -Math.abs(item.amount || 0) : Math.abs(item.amount || 0);
                          return (
                            <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", borderBottom: "1px dashed #f1f5f9", paddingBottom: "2px", gap: "0.5rem" }}>
                              <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                <span style={{ color: "#94a3b8", marginRight: "0.4rem" }}>{new Date(item.date).toLocaleDateString("en-GB")}</span>
                                <span style={{ fontWeight: 600, color: item.type === "Payment" ? "#047857" : "#b91c1c" }}>{item.type}</span>
                                <span style={{ color: "#64748b", marginLeft: "0.4rem", fontSize: "0.68rem" }}>{item.description}</span>
                              </div>
                              <div style={{ display: "flex", gap: "0.5rem", whiteSpace: "nowrap" }}>
                                <span style={{ fontWeight: 700, color: item.type === "Payment" ? "#047857" : "#b91c1c" }}>
                                  {item.type === "Payment" ? "-" : "+"}฿{Math.abs(item.amount || 0).toFixed(0)}
                                </span>
                                <span style={{ fontWeight: 800, color: running > 0 ? "#dc2626" : "#047857" }}>
                                  ฿{running.toFixed(0)}
                                </span>
                              </div>
                            </div>
                          );
                        });
                      })()}
                      <div style={{ display: "flex", justifyContent: "flex-end", fontSize: "0.72rem", fontWeight: 800, color: (s.balance || 0) > 0 ? "#dc2626" : "#047857", paddingTop: "4px" }}>
                        Closing Balance: ฿{(s.balance || 0).toFixed(0)}
                      </div>
                    </div>
                  </div>
                )}

                {supPurchases.length > 0 && !selectedLedgerSup && (
                  <div className="sup-purchases" style={{ marginTop: "0.25rem", borderTop: "1px solid #f1f5f9", paddingTop: "0.25rem" }}>
                    <span className="sup-purch-label">Purchases ({supPurchases.length})</span>
                    <div className="flex-col gap-xs" style={{ marginTop: "0.25rem" }}>
                      {supPurchases.slice(0, 3).map(po => (
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

const styles = {
  statsRow: { display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" },
  statCard: {
    flex: 1, minWidth: "100px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px",
    padding: "0.5rem 0.75rem", display: "flex", flexDirection: "column", gap: "2px",
  },
  statValue: { fontSize: "1.05rem", fontWeight: 800, color: "#1e293b" },
  statLabel: { fontSize: "0.68rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em" },
  filterBar: { display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.5rem" },
  searchInput: {
    padding: "0.4rem 0.65rem", borderRadius: "8px", border: "1px solid #e2e8f0",
    fontSize: "0.8rem", flex: "1", minWidth: "160px",
  },
  sortSelect: {
    padding: "0.4rem 0.65rem", borderRadius: "8px", border: "1px solid #e2e8f0",
    fontSize: "0.8rem", background: "#fff", cursor: "pointer",
  },
};
