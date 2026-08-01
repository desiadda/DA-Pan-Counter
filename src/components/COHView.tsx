import { useState, useEffect, useMemo } from "react";
import { dbService } from "../firebase";
import { getUsers } from "../db/auth";
import { logError } from "../db/errorLog";
import { useLangStore } from "../stores/langStore";
import { useT } from "../lang/translations";
import AccountStatementModal from "./AccountStatementModal";
import { QUICK_CASH_CHIPS } from "../constants";

export default function COHView({ user }) {
  const lang = useLangStore((s) => s.lang);
  const tr = useT(lang);

  const [users, setUsers] = useState([]);
  const [balances, setBalances] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [pending, setPending] = useState([]);
  
  // Forms & Actions
  const [activeTab, setActiveTab] = useState("balances"); // balances | transfer | pending | adjust | history | reconcile
  const [adjustId, setAdjustId] = useState(null);
  const [adjustAmt, setAdjustAmt] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  
  const [transferTo, setTransferTo] = useState("");
  const [transferAmt, setTransferAmt] = useState("");
  const [transferNote, setTransferNote] = useState("");
  
  const [physicalCount, setPhysicalCount] = useState("");
  const [reconcileNote, setReconcileNote] = useState("");
  
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // History filters
  const [typeFilter, setTypeFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Statement drill-down
  const [stmt, setStmt] = useState(null);

  const load = () => {
    try {
      const allUsers = getUsers();
      setUsers(allUsers);
      setBalances(dbService.getAllBalances(allUsers));
      setTransactions(dbService.getAllTransactions());
      if (user?.id) {
        setPending(dbService.getPendingForUser(user.id));
      }
    } catch (err) {
      logError("COH", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to load COH data"));
      console.error(err);
    }
  };

  useEffect(() => {
    load();
    window.addEventListener("coh-changed", load);
    return () => {
      window.removeEventListener("coh-changed", load);
    };
  }, [user?.id]);

  const handleAdjust = async () => {
    if (submitting) return;
    setError("");
    setMsg("");
    const amt = parseFloat(adjustAmt);
    if (!adjustId || isNaN(amt) || amt === 0) { setError("Select user and enter a non-zero amount."); return; }
    try {
      setSubmitting(true);
      await dbService.adjustBalance(adjustId, amt, adjustNote || "Manual adjustment", user?.name || "Admin");
      setAdjustAmt("");
      setAdjustNote("");
      setAdjustId(null);
      setMsg(`✅ Balance adjusted for ${users.find(u => u.id === adjustId)?.name || adjustId}.`);
      load();
    } catch (err) {
      logError("COH", err.message, err.stack);
      setError(err.message || "Failed to adjust balance");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransfer = async () => {
    if (submitting) return;
    setError("");
    setMsg("");
    const amt = parseFloat(transferAmt);
    if (!transferTo || !amt || amt <= 0) { setError("Select user and enter valid amount."); return; }
    try {
      setSubmitting(true);
      await dbService.initiateTransfer(user, transferTo, users.find(u => u.id === transferTo)?.name || "", amt);
      setMsg(`Transfer of ฿${amt.toFixed(2)} sent for approval.`);
      setTransferAmt("");
      setTransferNote("");
      load();
    } catch (e) {
      logError("COH", e.message, e.stack);
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (txId) => {
    if (submitting) return;
    try {
      setSubmitting(true);
      await dbService.approveTransfer(txId, user.name || "System");
      load();
    } catch (err) {
      logError("COH", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to approve transfer"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (txId) => {
    if (submitting) return;
    try {
      setSubmitting(true);
      await dbService.rejectTransfer(txId, user.name || "System");
      load();
    } catch (err) {
      logError("COH", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to reject transfer"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReconcile = async () => {
    if (submitting || physicalCount.trim() === "") return;
    setError("");
    setMsg("");
    const entered = parseFloat(physicalCount);
    if (isNaN(entered) || entered < 0) {
      alert("Please enter a valid cash amount.");
      return;
    }
    const myBalance = dbService.getBalance(user.id) || 0;
    const diff = entered - myBalance;
    try {
      setSubmitting(true);
      await dbService.adjustBalance(
        user.id, 
        diff, 
        `Physical Verification: ${reconcileNote.trim() || "Regular drawer audit"}${diff !== 0 ? ` (Discrepancy: ${diff < 0 ? "-" : "+"}฿${Math.abs(diff).toFixed(2)})` : ""}`,
        user.name
      );
      alert("Counter cash successfully reconciled!");
      setPhysicalCount("");
      setReconcileNote("");
      setActiveTab("balances");
      load();
    } catch (e) {
      logError("COH", e.message, e.stack);
      alert("Reconciliation failed: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const totalCoh = balances.reduce((s, b) => s + (b.coh || 0), 0);
  const pendingCount = transactions.filter(t => t.status === "pending").length;
  const userBalance = dbService.getBalance(user?.id) || 0;

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);
  const todayTx = transactions.filter(tx => tx.timestamp >= todayStart);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (typeFilter !== "all" && tx.type !== typeFilter) return false;
      if (statusFilter !== "all" && tx.status !== statusFilter) return false;
      if (userFilter !== "all" && tx.fromUserId !== userFilter && tx.toUserId !== userFilter) return false;
      return true;
    });
  }, [transactions, typeFilter, userFilter, statusFilter]);

  const formatDate = (ts) => new Date(ts).toLocaleString();

  const openStatement = (u) => {
    const typeLabel = (t) =>
      t === "adjustment" ? "⚙️ Adjustment" : t === "sale" ? "🧾 Sale" : t === "payment" ? "💳 Khata Payment" : t === "expense" ? "💸 Expense" : "📤 Transfer";
    const rows = transactions
      .filter(t => t.fromUserId === u.id || t.toUserId === u.id)
      .map(t => {
        const isIn = t.toUserId === u.id;
        return {
          id: t.id,
          timestamp: t.timestamp,
          in: isIn ? t.amount : null,
          out: isIn ? null : t.amount,
          description: `${typeLabel(t.type)} · ${t.fromUserName} → ${t.toUserName || t.toUserId || "System"}`,
          detail: [t.performedBy || t.actedBy ? `performed by ${t.performedBy || t.actedBy}` : null, t.note || null].filter(Boolean).join(" · "),
          status: t.status,
        };
      });
    setStmt({ name: u.name, balance: dbService.getBalance(u.id) || 0, rows });
  };

  const canAdjust = user?.role === "admin" || !!user?.permissions?.settings;

  const tabs = [
    { key: "balances", label: `💰 ${tr("coh.balance")}` },
    { key: "transfer", label: `📤 ${tr("coh.transfer")}` },
    { key: "pending", label: `📩 ${tr("coh.pending")}${pending.length > 0 ? ` (${pending.length})` : ""}` },
    ...(canAdjust ? [{ key: "adjust", label: `⚙️ ${tr("coh.adjust")}` }] : []),
    { key: "history", label: `📒 ${tr("coh.history")}` },
    { key: "reconcile", label: `🔍 ${tr("coh.verifyCash")}` },
  ];

  const availableUsers = (users && Array.isArray(users) && users.length > 0) ? users : getUsers();
  const otherUsers = (availableUsers || []).filter(u => u?.id !== user?.id);

  return (
    <div className="coh-container">
      <h3 className="coh-title">💰 {tr("coh.title")}</h3>

      {pending.length > 0 && (
        <div style={{ background: "var(--card-bg, #fffbebf5)", border: "2px solid #f59e0b", borderRadius: "12px", padding: "12px", marginBottom: "14px" }}>
          <div style={{ fontWeight: 700, color: "#b45309", marginBottom: "8px", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "6px" }}>
            <span>📩</span> <span>Pending Transfer Received (स्वीकृति लंबित):</span>
          </div>
          {pending.map(tx => (
            <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg, #ffffff)", padding: "10px 12px", borderRadius: "8px", border: "1px solid #fde68a", marginTop: "6px" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>From: {tx.fromUserName}</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#047857" }}>฿{(tx.amount || 0).toFixed(2)}</div>
                {tx.note && <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{tx.note}</div>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <button onClick={() => handleApprove(tx.id)} disabled={submitting} className="btn btn-primary" style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                  {submitting ? "..." : "✓ Approve"}
                </button>
                <button onClick={() => handleReject(tx.id)} disabled={submitting} className="btn btn-danger" style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                  ✕ Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="view-tabs">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`view-tab ${activeTab === t.key ? "view-tab-active" : ""}`}
            onClick={() => { setActiveTab(t.key); setError(""); setMsg(""); }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Balances ── */}
      {activeTab === "balances" && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card" style={{ background: "linear-gradient(135deg, #047857, #065f46)", border: "none" }} onClick={() => { setTypeFilter("all"); setStatusFilter("all"); setActiveTab("history"); }}>
              <span className="kpi-label" style={{ color: "#a7f3d0" }}>Total Cash on Hand</span>
              <span className="kpi-value" style={{ color: "#ffffff" }}>฿{totalCoh.toFixed(2)}</span>
              <span className="kpi-sub" style={{ color: "#a7f3d0" }}>Across {balances.length} user{balances.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="kpi-card" onClick={() => { setTypeFilter("transfer"); setStatusFilter("pending"); setActiveTab("history"); }}>
              <span className="kpi-label">Pending Transfers</span>
              <span className="kpi-value" style={{ color: pendingCount > 0 ? "#d97706" : "var(--text)" }}>{pendingCount}</span>
              <span className="kpi-sub">{pendingCount > 0 ? "Awaiting approval" : "All clear"}</span>
            </div>
            <div className="kpi-card" onClick={() => { setTypeFilter("all"); setStatusFilter("all"); setActiveTab("history"); }}>
              <span className="kpi-label">Today's Activity</span>
              <span className="kpi-value" style={{ color: "#2563eb" }}>{todayTx.length}</span>
              <span className="kpi-sub">฿{todayTx.reduce((s, tx) => s + (tx.amount || 0), 0).toFixed(2)} moved</span>
            </div>
            <div className="kpi-card" onClick={() => { setTypeFilter("transfer"); setStatusFilter("approved"); setActiveTab("history"); }}>
              <span className="kpi-label">Approved Transfers</span>
              <span className="kpi-value" style={{ color: "#047857" }}>{transactions.filter(t => t.status === "approved" && t.type === "transfer").length}</span>
              <span className="kpi-sub">Lifetime</span>
            </div>
          </div>

          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <h4 className="section-subtitle" style={{ margin: 0 }}>User Balances</h4>
              <button className="btn btn-outline btn-sm" onClick={() => setActiveTab("adjust")}>Adjust</button>
            </div>
            <div className="coh-balances-grid">
              {(balances || []).map(b => (
                <div key={b.id} className="coh-balance-card" onClick={() => openStatement(b)}>
                  <span className="coh-card-chevron">›</span>
                  <div className="coh-balance-name">{b.name}</div>
                  <div className="coh-balance-value">฿{(b.coh || 0).toFixed(2)}</div>
                </div>
              ))}
              {(!balances || balances.length === 0) && <div className="coh-empty">No users found.</div>}
            </div>
          </div>
        </>
      )}

      {/* ── Transfer ── */}
      {activeTab === "transfer" && (
        <div className="card">
          <h4 className="section-subtitle" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", marginBottom: "0.5rem" }}>
            Transfer Cash
          </h4>
          {error && <div className="error-inline">{error}</div>}
          {msg && <div className="success-inline">{msg}</div>}

          <div className="input-group">
            <label className="input-label">Transfer To</label>
            <select value={transferTo} onChange={e => setTransferTo(e.target.value)} className="input-field" style={{ fontFamily: "inherit" }}>
              <option value="">Select user...</option>
              {(otherUsers || []).map(u => (
                <option key={u.id} value={u.id}>{u.name} (฿{(dbService.getBalance(u.id) || 0).toFixed(2)})</option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">Amount (฿)</label>
            <input type="number" value={transferAmt} onChange={e => setTransferAmt(e.target.value)} className="input-field" placeholder="0.00" min="0" step="0.01" />
          </div>

          <button onClick={handleTransfer} disabled={submitting} className="btn btn-primary" style={{ width: "100%", padding: "0.6rem", fontSize: "0.9rem" }}>
            {submitting ? "Sending..." : "Send for Approval"}
          </button>
        </div>
      )}

      {/* ── Pending ── */}
      {activeTab === "pending" && (
        <div className="card">
          <h4 className="section-subtitle" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", marginBottom: "0.5rem" }}>
            Pending Transfers ({pending.length})
          </h4>
          {(!pending || pending.length === 0) ? (
            <div className="coh-empty">No pending transfers.</div>
          ) : (
            (pending || []).map(tx => (
              <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem", backgroundColor: "var(--warning-light, #fffbeb)", borderRadius: "12px", border: "1px solid var(--border, #fde68a)", marginBottom: "0.5rem" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: "var(--text)", fontSize: "0.9rem" }}>From: {tx.fromUserName}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{formatDate(tx.timestamp)}</div>
                  <div style={{ fontWeight: 800, color: "var(--primary)", fontSize: "1.1rem", marginTop: "0.25rem" }}>฿{tx.amount.toFixed(2)}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <button onClick={() => handleApprove(tx.id)} disabled={submitting} className="btn btn-primary" style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem" }}>
                    {submitting ? "Processing..." : "✓ Approve"}
                  </button>
                  <button onClick={() => handleReject(tx.id)} disabled={submitting} className="btn btn-danger" style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem" }}>
                    ✕ Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Adjust ── */}
      {activeTab === "adjust" && (
        <div className="card">
          <h4 className="section-subtitle" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", marginBottom: "0.5rem" }}>Adjust Balance</h4>
          <p className="text-muted" style={{ fontSize: "0.75rem", margin: "0 0 0.5rem" }}>
            Use positive amounts to add cash, negative amounts to deduct. A note is required for audit.
          </p>
          {error && <div className="error-inline">{error}</div>}
          {msg && <div className="success-inline">{msg}</div>}
          <div className="input-group">
            <label className="input-label">User</label>
            <select value={adjustId || ""} onChange={e => { setAdjustId(e.target.value); setError(""); setMsg(""); }} className="input-field" style={{ fontFamily: "inherit" }}>
              <option value="">Select user...</option>
              {(users || []).map(u => (
                <option key={u.id} value={u.id}>{u.name} (฿{(dbService.getBalance(u.id) || 0).toFixed(2)})</option>
              ))}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Amount (use +/-, e.g. 500 or -200)</label>
            <input type="number" value={adjustAmt} onChange={e => { setAdjustAmt(e.target.value); setError(""); setMsg(""); }} className="input-field" placeholder="0" />
            <div className="filter-bar" style={{ marginTop: "0.35rem", marginBottom: 0 }}>
              {QUICK_CASH_CHIPS.map(v => (
                <button key={v} className="quick-chip" onClick={() => { setAdjustAmt(String(v)); setError(""); setMsg(""); }}>+฿{v}</button>
              ))}
              {QUICK_CASH_CHIPS.map(v => (
                <button key={"n" + v} className="quick-chip" onClick={() => { setAdjustAmt(String(-v)); setError(""); setMsg(""); }}>-฿{v}</button>
              ))}
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Note (required for audit)</label>
            <input type="text" value={adjustNote} onChange={e => { setAdjustNote(e.target.value); setError(""); setMsg(""); }} className="input-field" placeholder="Reason for adjustment" />
          </div>
          <button onClick={handleAdjust} disabled={submitting} className="btn btn-primary" style={{ width: "100%", padding: "0.6rem" }}>
            {submitting ? "Saving..." : "Apply Adjustment"}
          </button>
        </div>
      )}

      {/* ── History ── */}
      {activeTab === "history" && (
        <div className="card">
          <h4 className="section-subtitle" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", marginBottom: "0.5rem" }}>
            Transaction History ({filteredTransactions.length})
          </h4>
          <p className="text-muted" style={{ fontSize: "0.7rem", margin: "0 0 0.5rem" }}>
            Cash movements only — bank↔cash transfers included here too. Full multi-account ledger: Finance tab.
          </p>
          <div className="filter-bar">
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input-field" style={{ fontFamily: "inherit", maxWidth: "140px", padding: "0.4rem", fontSize: "0.8rem" }}>
              <option value="all">All types</option>
              <option value="transfer">Transfers</option>
              <option value="adjustment">Adjustments</option>
              <option value="sale">Sales</option>
              <option value="payment">Khata payments</option>
              <option value="expense">Expenses</option>
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field" style={{ fontFamily: "inherit", maxWidth: "130px", padding: "0.4rem", fontSize: "0.8rem" }}>
              <option value="all">Any status</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
            <select value={userFilter} onChange={e => setUserFilter(e.target.value)} className="input-field" style={{ fontFamily: "inherit", maxWidth: "150px", padding: "0.4rem", fontSize: "0.8rem" }}>
              <option value="all">All users</option>
              {(users || []).map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div className="ledger-list">
            {(!filteredTransactions || filteredTransactions.length === 0) ? (
              <div className="coh-empty">No transactions match your filters.</div>
            ) : (
              (filteredTransactions || []).slice(0, 100).map(tx => (
                <div key={tx.id} className="coh-tx-row">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text)" }}>
                      {tx.type === "adjustment" ? "⚙️ Adjustment" : tx.type === "sale" ? "🧾 Sale" : tx.type === "payment" ? "💳 Khata Payment" : tx.type === "expense" ? "💸 Expense" : "📤 Transfer"}
                      {" · "}
                      <span style={{ color: tx.status === "approved" ? "var(--primary)" : tx.status === "rejected" ? "var(--error)" : "var(--secondary)" }}>
                        {tx.status === "approved" ? "Approved" : tx.status === "rejected" ? "Rejected" : "Pending"}
                      </span>
                    </div>
                    <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                      {tx.fromUserName} → {tx.toUserName || users.find(u => u.id === tx.toUserId)?.name || tx.toUserId || "System"}
                      {" · "}{formatDate(tx.timestamp)}
                    </div>
                    {(tx.performedBy || tx.actedBy) && <div className="text-muted" style={{ fontSize: "0.7rem" }}>👤 performed by <b>{tx.performedBy || tx.actedBy}</b></div>}
                    {tx.note && <div className="text-muted" style={{ fontSize: "0.7rem", fontStyle: "italic" }}>{tx.note}</div>}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", color: tx.sign === "debit" ? "var(--error)" : "var(--primary)" }}>
                    {tx.sign === "debit" ? "-" : "+"}฿{(tx.amount || 0).toFixed(2)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Reconcile / Verify Cash ── */}
      {activeTab === "reconcile" && (
        <div className="card">
          <h4 className="section-subtitle" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", marginBottom: "0.5rem" }}>
            {tr("coh.verifyCash")}
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              <span>System Balance:</span>
              <span style={{ fontWeight: "700", color: "var(--text)" }}>฿{userBalance.toFixed(2)}</span>
            </div>

            <div className="input-group">
              <label className="input-label">Actual Drawer Cash</label>
              <input
                type="number"
                placeholder="Enter physical cash..."
                value={physicalCount}
                onChange={e => setPhysicalCount(e.target.value)}
                className="input-field"
              />
            </div>

            <div className="input-group">
              <label className="input-label">Note (optional)</label>
              <input
                type="text"
                placeholder="e.g. End of day matching, change discrepancy..."
                value={reconcileNote}
                onChange={e => setReconcileNote(e.target.value)}
                className="input-field"
              />
            </div>

            {physicalCount.trim() !== "" && (() => {
              const diff = (parseFloat(physicalCount) || 0) - userBalance;
              const absDiff = Math.abs(diff);
              return (
                <div style={{ 
                  padding: "0.75rem", 
                  borderRadius: "8px", 
                  backgroundColor: diff === 0 ? "var(--primary-light, #ecfdf5)" : diff < 0 ? "var(--error-light, #fef2f2)" : "var(--warning-light, #fef9c3)",
                  border: `1px solid ${diff === 0 ? "var(--primary, #10b981)" : diff < 0 ? "var(--error, #ef4444)" : "var(--warning, #eab308)"}`,
                  fontSize: "0.82rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "700" }}>
                    <span>Difference:</span>
                    <span style={{ color: diff === 0 ? "var(--primary, #10b981)" : diff < 0 ? "var(--error, #ef4444)" : "var(--warning, #ca8a04)" }}>
                      {diff === 0 ? "฿0.00 (Perfect Match)" : `${diff < 0 ? "-" : "+"}฿${absDiff.toFixed(2)}`}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {diff === 0 
                      ? "✅ Everything is correct! Perfect Match." 
                      : diff < 0 
                        ? `⚠️ Shortage: You are short of ฿${absDiff.toFixed(2)}!`
                        : `📈 Surplus: You have ฿${absDiff.toFixed(2)} extra!`
                    }
                  </div>
                </div>
              );
            })()}

            <button 
              onClick={handleReconcile}
              disabled={submitting || physicalCount.trim() === ""}
              className="btn btn-primary"
              style={{ width: "100%", padding: "0.6rem", marginTop: "0.5rem" }}
            >
              {submitting ? "Saving..." : "Confirm & Reconcile"}
            </button>
          </div>
        </div>
      )}

      {stmt && (
        <AccountStatementModal
          title={stmt.name}
          subtitle="User Cash on Hand"
          icon="👤"
          balance={stmt.balance}
          rows={stmt.rows}
          onClose={() => setStmt(null)}
        />
      )}
    </div>
  );
}
