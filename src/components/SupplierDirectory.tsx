import { useState, useEffect, useMemo } from "react";
import { dbService } from "../firebase";
import { db, isFirebaseEnabled } from "../db/config";
import { collection, onSnapshot } from "firebase/firestore";
import { useLangStore } from "../stores/langStore";
import { useConfirmStore } from "../stores/confirmStore";
import { useDBStore } from "../stores/dbStore";
import { UDHAAR_MODE } from "../constants";
import SupplierStatementModal from "./SupplierStatementModal";
import { useT } from "../lang/translations";

export default function SupplierDirectory() {
  const lang = useLangStore((s) => s.lang);
  const tr = useT(lang);
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
  const [openingBalance, setOpeningBalance] = useState("");
  const [openingBalanceDate, setOpeningBalanceDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [statementSup, setStatementSup] = useState(null);

  // Supplier Khata & Adjust States
  const [selectedLedgerSup, setSelectedLedgerSup] = useState(null);
  const [paymentSup, setPaymentSup] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("Cash");
  const [payDate, setPayDate] = useState("");
  const [payNote, setPayNote] = useState("");

  const [adjustSup, setAdjustSup] = useState(null);
  const [adjustAmt, setAdjustAmt] = useState("");
  const [adjustDate, setAdjustDate] = useState("");
  const [adjustDesc, setAdjustDesc] = useState("");
  const [adjustType, setAdjustType] = useState("Opening Balance");

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
    const ob = parseFloat(openingBalance) || 0;
    const obDateMs = openingBalanceDate ? new Date(openingBalanceDate + "T12:00:00").getTime() : Date.now();
    try {
      setSubmitting(true);
      if (editSup) {
        await dbService.saveSupplier({
          ...editSup, name: name.trim(), contact: contact.trim(),
          phone: phone.trim(), address: address.trim(),
        });
        if (ob > 0) {
          await dbService.adjustSupplierBalance(
            editSup.id,
            ob,
            "Opening Balance",
            "Opening balance adjustment",
            obDateMs
          );
        }
      } else {
        await dbService.saveSupplier({
          name: name.trim(), contact: contact.trim(),
          phone: phone.trim(), address: address.trim(),
          balance: ob,
          ledger: ob > 0 ? [{
            date: obDateMs,
            type: "Opening Balance",
            amount: ob,
            description: "Opening balance (initial udhaar)",
          }] : [],
        });
      }
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
    setPhone(s.phone || ""); setAddress(s.address || ""); setOpeningBalance("");
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (submitting) return;
    if (await confirm(tr("supplier.deleteQ"), { title: tr("common.delete"), confirmLabel: tr("common.delete"), variant: "danger" })) {
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
      const paymentDateMs = payDate ? new Date(payDate + "T12:00:00").getTime() : Date.now();
      await dbService.recordSupplierPayment(
        paymentSup.id,
        paymentSup.name,
        amount,
        payMode,
        user.id || "system",
        user.name || "System",
        paymentDateMs,
        payNote.trim()
      );
      setPaymentSup(null);
      setPayAmount("");
      setPayDate("");
      setPayNote("");
      alert("✅ Payment recorded successfully!");
      load();
    } catch (err) {
      console.error(err);
      alert("❌ Failed to record payment: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(adjustAmt);
    if (!amt || isNaN(amt) || !adjustSup || submitting) return;
    try {
      setSubmitting(true);
      const dateMs = adjustDate ? new Date(adjustDate + "T12:00:00").getTime() : Date.now();
      await dbService.adjustSupplierBalance(
        adjustSup.id,
        amt,
        adjustType || "Opening Balance",
        adjustDesc.trim() || "Backdated Opening Balance adjustment",
        dateMs
      );
      setAdjustSup(null);
      setAdjustAmt("");
      setAdjustDesc("");
      setAdjustDate("");
      alert("✅ " + tr("supplier.applyAdjust") + "!");
      load();
    } catch (err) {
      console.error(err);
      alert("❌ Failed to adjust balance: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setShowForm(false); setEditSup(null); setName("");
    setContact(""); setPhone(""); setAddress(""); setOpeningBalance(""); setOpeningBalanceDate("");
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
        <h3 className="section-subtitle">📍 {tr("supplier.title")}</h3>
        <button onClick={() => { reset(); setShowForm(true); }} className="btn btn-primary btn-sm">{tr("supplier.addSupplier")}</button>
      </div>

      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <span style={styles.statValue}>{suppliers.length}</span>
          <span style={styles.statLabel}>{tr("supplier.suppliers")}</span>
        </div>
        <div style={styles.statCard}>
          <span style={{ ...styles.statValue, color: totalCredit > 0 ? "#dc2626" : "#047857" }}>฿{totalCredit.toFixed(0)}</span>
          <span style={styles.statLabel}>{tr("supplier.creditOutstanding")}</span>
        </div>
        <div style={styles.statCard}>
          <span style={{ ...styles.statValue, color: pendingPos > 0 ? "#d97706" : "#64748b" }}>{pendingPos}</span>
          <span style={styles.statLabel}>{tr("supplier.pendingPos")}</span>
        </div>
      </div>

      <div style={styles.filterBar}>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={tr("supplier.searchPlaceholder")}
          style={styles.searchInput}
        />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={styles.sortSelect}>
          <option value="name">{tr("supplier.sortName")}</option>
          <option value="balance">{tr("supplier.sortCredit")}</option>
        </select>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">{tr("supplier.name")}</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-field" placeholder={tr("supplier.name")} required autoFocus />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">{tr("supplier.contact")}</label>
              <input type="text" value={contact} onChange={e => setContact(e.target.value)} className="input-field" placeholder={tr("supplier.contact")} />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">{tr("supplier.phone")}</label>
              <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="input-field" placeholder={tr("supplier.phone")} />
            </div>
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">{tr("supplier.address")}</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="input-field" placeholder={tr("supplier.address")} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: openingBalance && parseFloat(openingBalance) > 0 ? "1fr 1fr" : "1fr", gap: "0.5rem" }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">{tr("supplier.openingBalance")} <span style={{ fontWeight: 400, color: "#94a3b8" }}>— {tr("supplier.openingBalanceHint")}</span></label>
              <input
                type="number"
                value={openingBalance}
                onChange={e => setOpeningBalance(e.target.value)}
                className="input-field"
                placeholder="0.00"
                min="0"
              />
            </div>
            {openingBalance && parseFloat(openingBalance) > 0 && (
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">{tr("supplier.entryDate")}</label>
                <input
                  type="date"
                  value={openingBalanceDate}
                  onChange={e => setOpeningBalanceDate(e.target.value)}
                  className="input-field"
                />
              </div>
            )}
          </div>
          <div className="flex-btn-group">
            <button type="submit" disabled={submitting} className="btn btn-primary btn-sm">
              {submitting ? tr("supplier.saving") : (editSup ? tr("supplier.update") : tr("supplier.save"))}
            </button>
            <button type="button" onClick={reset} className="btn btn-outline btn-sm">{tr("supplier.cancel")}</button>
          </div>
        </form>
      )}

      {/* Record Payment Form Sheet */}
      {paymentSup && (
        <form onSubmit={handleRecordPayment} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", border: "1.5px solid var(--primary)" }}>
          <h4 style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "var(--primary)" }}>{tr("supplier.recordPaymentTo")} {paymentSup.name}</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">{tr("supplier.amount")}</label>
              <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="input-field" placeholder="0.00" min="1" max={paymentSup.balance} required autoFocus />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">{tr("purchase.payMode")}</label>
              <select value={payMode} onChange={e => setPayMode(e.target.value)} className="input-field" style={{ fontFamily: "inherit" }}>
                {payModeOptions.map(m => (
                  <option key={m.id} value={m.id === UDHAAR_MODE ? "Credit" : m.id === "Cash" ? "Cash" : m.id}>
                    {m.id === UDHAAR_MODE ? "Credit (Khata)" : m.id === "Cash" ? "Cash (COH)" : m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">{tr("supplier.entryDate")}</label>
              <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="input-field" required />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">{tr("coh.noteRequired")}</label>
              <input type="text" value={payNote} onChange={e => setPayNote(e.target.value)} className="input-field" placeholder="Note / voucher / cheque no..." />
            </div>
          </div>
          <div className="flex-btn-group">
            <button type="submit" disabled={submitting} className="btn btn-primary btn-sm">{tr("supplier.submitPayment")}</button>
            <button type="button" onClick={() => setPaymentSup(null)} className="btn btn-outline btn-sm">{tr("supplier.cancel")}</button>
          </div>
        </form>
      )}

      {/* Adjust Balance / Backdate Form Sheet */}
      {adjustSup && (
        <form onSubmit={handleAdjustSubmit} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", border: "1.5px solid #6366f1" }}>
          <h4 style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "#4f46e5" }}>⚙️ {tr("supplier.adjustBalance")}: {adjustSup.name}</h4>
          <p style={{ margin: 0, fontSize: "0.72rem", color: "#64748b" }}>{tr("supplier.backdateHint")}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">{tr("supplier.amount")}</label>
              <input type="number" value={adjustAmt} onChange={e => setAdjustAmt(e.target.value)} className="input-field" placeholder="0.00" step="0.01" required autoFocus />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">{tr("supplier.entryDate")}</label>
              <input type="date" value={adjustDate} onChange={e => setAdjustDate(e.target.value)} className="input-field" required />
            </div>
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">{tr("coh.noteRequired")}</label>
            <input type="text" value={adjustDesc} onChange={e => setAdjustDesc(e.target.value)} className="input-field" placeholder="e.g. Opening Balance (Old register B/F)" />
          </div>
          <div className="flex-btn-group">
            <button type="submit" disabled={submitting} className="btn btn-primary btn-sm">{tr("supplier.applyAdjust")}</button>
            <button type="button" onClick={() => setAdjustSup(null)} className="btn btn-outline btn-sm">{tr("supplier.cancel")}</button>
          </div>
        </form>
      )}

      {suppliers.length === 0 ? (
        <div className="sup-empty">{tr("supplier.noSuppliers")}</div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="sup-empty">{tr("supplier.noMatchQ")} "{searchQuery}"</div>
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
                      <div style={{ fontSize: "0.7rem", color: "#64748b" }}>{tr("supplier.udhaarCredit")}</div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 800, color: (s.balance || 0) > 0 ? "#dc2626" : "#047857" }}>
                        ฿{(s.balance || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
                  <button onClick={() => setStatementSup(s)} className="btn btn-outline" style={{ padding: "3px 8px", fontSize: "0.7rem", borderRadius: "6px" }}>
                    📄 {tr("supplier.statement")}
                  </button>
                  <button onClick={() => {
                    setAdjustSup(s);
                    setAdjustAmt("");
                    setAdjustDate(new Date().toISOString().split("T")[0]);
                    setAdjustDesc("Opening balance (initial udhaar)");
                    setAdjustType("Opening Balance");
                  }} className="btn btn-outline" style={{ padding: "3px 8px", fontSize: "0.7rem", borderRadius: "6px" }}>
                    ⚙️ {tr("supplier.adjustBalance")}
                  </button>
                  {(s.balance || 0) > 0 && (
                    <button onClick={() => {
                      setPaymentSup(s);
                      setPayAmount("");
                      setPayDate(new Date().toISOString().split("T")[0]);
                      setPayNote("");
                    }} className="btn btn-primary" style={{ padding: "3px 8px", fontSize: "0.7rem", borderRadius: "6px" }}>
                      💸 {tr("supplier.paySupplier")}
                    </button>
                  )}
                  {s.ledger && s.ledger.length > 0 && (
                    <button onClick={() => setSelectedLedgerSup(selectedLedgerSup === s.id ? null : s.id)} className="btn btn-outline" style={{ padding: "3px 8px", fontSize: "0.7rem", borderRadius: "6px" }}>
                      {selectedLedgerSup === s.id ? tr("supplier.hideLedger") : tr("supplier.viewLedger")}
                    </button>
                  )}
                </div>

                {/* Ledger View */}
                {selectedLedgerSup === s.id && s.ledger && (
                  <div style={{ marginTop: "0.5rem", borderTop: "1px solid #f1f5f9", paddingTop: "0.5rem" }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#64748b" }}>
                      {tr("supplier.ledger")}
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginTop: "0.25rem" }}>
                      {(() => {
                        let running = 0;
                        return (s.ledger || []).map((item, idx) => {
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
                        {tr("supplier.closingBalance")}: ฿{(s.balance || 0).toFixed(0)}
                      </div>
                    </div>
                  </div>
                )}

                {(supPurchases || []).length > 0 && !selectedLedgerSup && (
                  <div className="sup-purchases" style={{ marginTop: "0.25rem", borderTop: "1px solid #f1f5f9", paddingTop: "0.25rem" }}>
                    <span className="sup-purch-label">{tr("supplier.purchases")} ({supPurchases.length})</span>
                    <div className="flex-col gap-xs" style={{ marginTop: "0.25rem" }}>
                      {(supPurchases || []).slice(0, 3).map(po => (
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
      {statementSup && (
        <SupplierStatementModal supplier={statementSup} onClose={() => setStatementSup(null)} />
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
