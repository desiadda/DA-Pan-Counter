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
    <div style={styles.container}>
      <h3 style={styles.title}>💰 Cash on Hand — All Users</h3>

      <div style={styles.balancesGrid}>
        {balances.map(b => (
          <div key={b.id} style={styles.balanceCard}>
            <div style={styles.balanceName}>{b.name}</div>
            <div style={styles.balanceValue}>฿{(b.coh || 0).toFixed(2)}</div>
          </div>
        ))}
      </div>

      <div style={styles.card}>
        <h4 style={styles.cardTitle}>Adjust Balance</h4>
        {error && <div style={styles.error}>{error}</div>}
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
        <button onClick={handleAdjust} className="btn btn-primary" style={{ padding: "0.6rem" }}>
          Apply Adjustment
        </button>
      </div>

      <div style={styles.card}>
        <h4 style={styles.cardTitle}>All Transactions</h4>
        <div style={styles.txList}>
          {transactions.length === 0 ? (
            <div style={styles.empty}>No transactions yet.</div>
          ) : (
            transactions.map(tx => (
              <div key={tx.id} style={styles.txRow}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#1e293b" }}>
                    {tx.type === "adjustment" ? "⚙️ Adjustment" : "📤 Transfer"}
                    {" · "}
                    <span style={{ color: tx.status === "approved" ? "#047857" : tx.status === "rejected" ? "#dc2626" : "#d97706" }}>
                      {tx.status === "approved" ? "Approved" : tx.status === "rejected" ? "Rejected" : "Pending"}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "#64748b" }}>
                    {tx.type === "adjustment"
                      ? `${tx.fromUserName} → ${tx.toUserName || users.find(u => u.id === tx.toUserId)?.name || tx.toUserId}`
                      : `${tx.fromUserName} → ${tx.toUserName}`
                    }
                    {" · "}{formatDate(tx.timestamp)}
                    {tx.approvedAt && ` · Approved: ${formatDate(tx.approvedAt)}`}
                  </div>
                  {tx.note && <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontStyle: "italic" }}>{tx.note}</div>}
                </div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: tx.sign === "debit" || (tx.type === "transfer" && tx.status === "approved") ? "#dc2626" : "#047857" }}>
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

const styles = {
  container: { padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" },
  title: { fontSize: "1.1rem", fontWeight: 800, color: "#1e293b" },
  balancesGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" },
  balanceCard: {
    backgroundColor: "#f0fdf4", borderRadius: "10px", border: "1px solid #bbf7d0",
    padding: "0.75rem", textAlign: "center",
  },
  balanceName: { fontSize: "0.8rem", fontWeight: 600, color: "#166534" },
  balanceValue: { fontSize: "1.1rem", fontWeight: 800, color: "#15803d" },
  card: { backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" },
  cardTitle: { fontSize: "0.95rem", fontWeight: 700, color: "#1e293b", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem", margin: 0 },
  error: { color: "#ef4444", fontSize: "0.8rem", fontWeight: 600, backgroundColor: "#fef2f2", padding: "0.5rem", borderRadius: "6px", textAlign: "center" },
  txList: { display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "400px", overflowY: "auto" },
  txRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" },
  empty: { textAlign: "center", color: "#94a3b8", padding: "1rem", fontSize: "0.85rem" },
};
