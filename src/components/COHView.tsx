import { useState, useEffect } from "react";
import { dbService } from "../firebase";
import { getUsers } from "../db/auth";
import { logError } from "../db/errorLog";

export default function COHView({ user }) {
  const [users, setUsers] = useState([]);
  const [balances, setBalances] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [adjustId, setAdjustId] = useState(null);
  const [adjustAmt, setAdjustAmt] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [error, setError] = useState("");

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

  useEffect(() => { load(); }, []);

  const handleAdjust = () => {
    setError("");
    const amt = parseFloat(adjustAmt);
    if (!adjustId || isNaN(amt) || amt === 0) { setError("Select user and enter a non-zero amount."); return; }
    try {
      dbService.adjustBalance(adjustId, amt, adjustNote || "Manual adjustment", user?.name || "Admin");
      setAdjustAmt("");
      setAdjustNote("");
      setAdjustId(null);
      load();
    } catch (err) {
      logError("COH", err.message, err.stack);
      setError(err.message || "Failed to adjust balance");
      console.error(err);
    }
  };

  const formatDate = (ts) => new Date(ts).toLocaleString();

  return (
    <div className="coh-container">
      <h3 className="coh-title">💰 Cash on Hand — All Users</h3>

      <div className="coh-balances-grid">
        {balances.map(b => (
          <div key={b.id} className="coh-balance-card">
            <div className="coh-balance-name">{b.name}</div>
            <div className="coh-balance-value">฿{(b.coh || 0).toFixed(2)}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h4 className="section-subtitle" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", marginBottom: "0.5rem" }}>Adjust Balance</h4>
        {error && <div className="error-inline">{error}</div>}
        <div className="input-group">
          <label className="input-label">User</label>
          <select value={adjustId || ""} onChange={e => setAdjustId(e.target.value)} className="input-field" style={{ fontFamily: "inherit" }}>
            <option value="">Select user...</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div className="input-group">
          <label className="input-label">Amount (use +/-, e.g. 500 or -200)</label>
          <input type="number" value={adjustAmt} onChange={e => setAdjustAmt(e.target.value)} className="input-field" placeholder="0" />
        </div>
        <div className="input-group">
          <label className="input-label">Note (optional)</label>
          <input type="text" value={adjustNote} onChange={e => setAdjustNote(e.target.value)} className="input-field" placeholder="Reason for adjustment" />
        </div>
        <button onClick={handleAdjust} className="btn btn-primary">Apply Adjustment</button>
      </div>

      <div className="card">
        <h4 className="section-subtitle" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", marginBottom: "0.5rem" }}>All Transactions</h4>
        <div className="coh-tx-list">
          {transactions.length === 0 ? (
            <div className="coh-empty">No transactions yet.</div>
          ) : (
            transactions.map(tx => (
              <div key={tx.id} className="coh-tx-row">
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text)" }}>
                    {tx.type === "adjustment" ? "⚙️ Adjustment" : "📤 Transfer"}
                    {" · "}
                    <span style={{ color: tx.status === "approved" ? "var(--primary)" : tx.status === "rejected" ? "var(--error)" : "var(--secondary)" }}>
                      {tx.status === "approved" ? "Approved" : tx.status === "rejected" ? "Rejected" : "Pending"}
                    </span>
                  </div>
                  <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                    {tx.type === "adjustment"
                      ? `${tx.fromUserName} → ${tx.toUserName || users.find(u => u.id === tx.toUserId)?.name || tx.toUserId}`
                      : `${tx.fromUserName} → ${tx.toUserName}`
                    }
                    {" · "}{formatDate(tx.timestamp)}
                    {tx.approvedAt && ` · Approved: ${formatDate(tx.approvedAt)}`}
                  </div>
                  {tx.note && <div className="text-muted" style={{ fontSize: "0.7rem", fontStyle: "italic" }}>{tx.note}</div>}
                </div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: tx.sign === "debit" || (tx.type === "transfer" && tx.status === "approved") ? "var(--error)" : "var(--primary)" }}>
                  {tx.sign === "debit" || (tx.type === "transfer" && tx.status === "approved") ? "-" : "+"}฿{tx.amount.toFixed(2)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
