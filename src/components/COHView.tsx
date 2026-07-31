import { useState, useEffect, useMemo } from "react";
import { dbService } from "../firebase";
import { getUsers } from "../db/auth";
import { logError } from "../db/errorLog";
import AccountStatementModal from "./AccountStatementModal";

export default function COHView({ user }) {
  const [users, setUsers] = useState([]);
  const [balances, setBalances] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [adjustId, setAdjustId] = useState(null);
  const [adjustAmt, setAdjustAmt] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const [activeTab, setActiveTab] = useState("balances"); // balances | adjust | history

  // History filters
  const [typeFilter, setTypeFilter] = useState("all"); // all | transfer | adjustment | sale | payment | expense
  const [userFilter, setUserFilter] = useState("all"); // all | userId
  const [statusFilter, setStatusFilter] = useState("all"); // all | approved | pending | rejected

  // Statement drill-down
  const [stmt, setStmt] = useState(null); // { name, balance, rows }

  const load = () => {
    try {
      const allUsers = getUsers();
      setUsers(allUsers);
      setBalances(dbService.getAllBalances(allUsers));
      setTransactions(dbService.getAllTransactions());
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
  }, []);

  const handleAdjust = async () => {
    setError("");
    setMsg("");
    const amt = parseFloat(adjustAmt);
    if (!adjustId || isNaN(amt) || amt === 0) { setError("Select user and enter a non-zero amount."); return; }
    try {
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
    }
  };

  const totalCoh = balances.reduce((s, b) => s + (b.coh || 0), 0);
  const pendingCount = transactions.filter(t => t.status === "pending").length;
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
          detail: [t.actedBy ? `processed by ${t.actedBy}` : null, t.note || null].filter(Boolean).join(" · "),
          status: t.status,
        };
      });
    setStmt({ name: u.name, balance: dbService.getBalance(u.id) || 0, rows });
  };

  const tabs = [
    { key: "balances", label: "💰 Balances" },
    { key: "adjust", label: "⚙️ Adjust" },
    { key: "history", label: "📒 History" },
  ];

  return (
    <div className="coh-container">
      <h3 className="coh-title">💰 Cash on Hand</h3>

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
              {balances.map(b => (
                <div key={b.id} className="coh-balance-card" onClick={() => openStatement(b)}>
                  <span className="coh-card-chevron">›</span>
                  <div className="coh-balance-name">{b.name}</div>
                  <div className="coh-balance-value">฿{(b.coh || 0).toFixed(2)}</div>
                </div>
              ))}
              {balances.length === 0 && <div className="coh-empty">No users found.</div>}
            </div>
          </div>
        </>
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
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} (฿{(dbService.getBalance(u.id) || 0).toFixed(2)})</option>
              ))}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Amount (use +/-, e.g. 500 or -200)</label>
            <input type="number" value={adjustAmt} onChange={e => { setAdjustAmt(e.target.value); setError(""); setMsg(""); }} className="input-field" placeholder="0" />
            <div className="filter-bar" style={{ marginTop: "0.35rem", marginBottom: 0 }}>
              {[100, 500, 1000, 5000].map(v => (
                <button key={v} className="quick-chip" onClick={() => { setAdjustAmt(String(v)); setError(""); setMsg(""); }}>+฿{v}</button>
              ))}
              {[100, 500, 1000, 5000].map(v => (
                <button key={"n" + v} className="quick-chip" onClick={() => { setAdjustAmt(String(-v)); setError(""); setMsg(""); }}>-฿{v}</button>
              ))}
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Note (required for audit)</label>
            <input type="text" value={adjustNote} onChange={e => { setAdjustNote(e.target.value); setError(""); setMsg(""); }} className="input-field" placeholder="Reason for adjustment" />
          </div>
          <button onClick={handleAdjust} className="btn btn-primary" style={{ width: "100%", padding: "0.6rem" }}>Apply Adjustment</button>
        </div>
      )}

      {/* ── History ── */}
      {activeTab === "history" && (
        <div className="card">
          <h4 className="section-subtitle" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", marginBottom: "0.5rem" }}>
            Transaction History ({filteredTransactions.length})
          </h4>
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
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div className="ledger-list">
            {filteredTransactions.length === 0 ? (
              <div className="coh-empty">No transactions match your filters.</div>
            ) : (
              filteredTransactions.slice(0, 100).map(tx => (
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
                    {tx.actedBy && <div className="text-muted" style={{ fontSize: "0.7rem" }}>✓ processed by <b>{tx.actedBy}</b></div>}
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
