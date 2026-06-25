import { useState, useEffect } from "react";
import { dbService } from "../firebase";
import { logError } from "../db/errorLog";
import ModalPortal from "./ModalPortal";

export default function COHPanel({ user, users, onClose }) {
  const [balance, setBalance] = useState(0);
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState("balance");
  const [transferTo, setTransferTo] = useState("");
  const [transferAmt, setTransferAmt] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = () => {
    try {
      setBalance(dbService.getBalance(user.id));
      setPending(dbService.getPendingForUser(user.id));
      setHistory(dbService.getHistoryForUser(user.id));
    } catch (err) {
      logError("COH", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to load COH data"));
      console.error(err);
    }
  };

  useEffect(() => { load(); }, [user]);

  const handleTransfer = () => {
    setError("");
    setMsg("");
    const amt = parseFloat(transferAmt);
    if (!transferTo || !amt || amt <= 0) { setError("Select user and enter valid amount."); return; }
    try {
      dbService.initiateTransfer(user, transferTo, users.find(u => u.id === transferTo)?.name || "", amt);
      setMsg(`Transfer of ฿${amt.toFixed(2)} sent for approval.`);
      setTransferAmt("");
      setTransferNote("");
      load();
    } catch (e) { logError("COH", e.message, e.stack); setError(e.message); }
  };

  const handleApprove = (txId) => {
    try {
      dbService.approveTransfer(txId);
      load();
    } catch (err) {
      logError("COH", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to approve transfer"));
      console.error(err);
    }
  };

  const handleReject = (txId) => {
    try {
      dbService.rejectTransfer(txId);
      load();
    } catch (err) {
      logError("COH", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to reject transfer"));
      console.error(err);
    }
  };

  const otherUsers = users.filter(u => u.id !== user.id);
  const formatDate = (ts) => new Date(ts).toLocaleString();

  return (
    <ModalPortal>
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>💰 Cash on Hand</h3>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <div style={styles.balanceBar}>
          <span style={styles.balanceLabel}>Your Balance</span>
          <span style={styles.balanceValue}>฿{balance.toFixed(2)}</span>
        </div>

        {pending.length > 0 && (
          <button onClick={() => setTab("pending")} style={styles.pendingBadge}>
            📩 {pending.length} pending transfer{pending.length > 1 ? "s" : ""}
          </button>
        )}

        <div style={styles.tabs}>
          {["balance", "transfer", "pending", "history"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{...styles.tab, ...(tab === t ? styles.activeTab : {})}}>
              {t === "balance" ? "Balance" : t === "transfer" ? "Transfer" : t === "pending" ? `Pending${pending.length > 0 ? ` (${pending.length})` : ""}` : "History"}
            </button>
          ))}
        </div>

        {tab === "balance" && (
          <div style={styles.section}>
            <div style={styles.recentList}>
              {history.slice(0, 10).map(tx => (
                <div key={tx.id} style={styles.historyItem}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                      {tx.type === "adjustment" ? "⚙️ Adjustment" : tx.fromUserId === user.id ? "📤 Sent" : "📥 Received"}
                    </span>
                    <span style={styles.historyMeta}>
                      {tx.fromUserId === user.id ? `To: ${tx.toUserName || tx.toUserId}` : `From: ${tx.fromUserName}`}
                      {" · "}{formatDate(tx.timestamp)}
                    </span>
                    {tx.note && <span style={styles.historyNote}>{tx.note}</span>}
                  </div>
                  <span style={{ fontWeight: 700, color: tx.fromUserId === user.id ? "#dc2626" : "#047857", fontSize: "0.9rem" }}>
                    {tx.fromUserId === user.id ? "-" : "+"}฿{tx.amount.toFixed(2)}
                  </span>
                </div>
              ))}
              {history.length === 0 && <div style={styles.empty}>No transactions yet.</div>}
            </div>
          </div>
        )}

        {tab === "transfer" && (
          <div style={styles.section}>
            {error && <div style={styles.error}>{error}</div>}
            {msg && <div style={styles.success}>{msg}</div>}

            <div className="input-group">
              <label className="input-label">Transfer To</label>
              <select value={transferTo} onChange={e => setTransferTo(e.target.value)} className="input-field" style={{ fontFamily: "inherit" }}>
                <option value="">Select user...</option>
                {otherUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name} (฿{dbService.getBalance(u.id).toFixed(2)})</option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Amount (฿)</label>
              <input type="number" value={transferAmt} onChange={e => setTransferAmt(e.target.value)} className="input-field" placeholder="0.00" min="0" step="0.01" />
            </div>

            <button onClick={handleTransfer} className="btn btn-primary" style={{ padding: "0.6rem", fontSize: "0.9rem" }}>
              Send for Approval
            </button>
          </div>
        )}

        {tab === "pending" && (
          <div style={styles.section}>
            {pending.length === 0 ? (
              <div style={styles.empty}>No pending transfers.</div>
            ) : (
              pending.map(tx => (
                <div key={tx.id} style={styles.pendingCard}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.9rem" }}>From: {tx.fromUserName}</div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{formatDate(tx.timestamp)}</div>
                    <div style={{ fontWeight: 800, color: "#047857", fontSize: "1.1rem", marginTop: "0.25rem" }}>฿{tx.amount.toFixed(2)}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    <button onClick={() => handleApprove(tx.id)} className="btn btn-primary" style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem" }}>✓ Approve</button>
                    <button onClick={() => handleReject(tx.id)} className="btn btn-danger" style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem" }}>✕ Reject</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "history" && (
          <div style={styles.section}>
            <div style={styles.recentList}>
              {history.map(tx => (
                <div key={tx.id} style={styles.historyItem}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                      {tx.status === "pending" ? "⏳ " : tx.status === "rejected" ? "❌ " : ""}
                      {tx.type === "adjustment" ? "⚙️ Adjustment" : tx.fromUserId === user.id ? "📤 Sent" : "📥 Received"}
                    </span>
                    <span style={styles.historyMeta}>
                      {tx.fromUserId === user.id ? `To: ${tx.toUserName || tx.toUserId}` : `From: ${tx.fromUserName}`}
                      {" · "}{formatDate(tx.timestamp)}
                      {tx.status === "pending" && " · ⏳ Pending"}
                      {tx.status === "rejected" && " · ❌ Rejected"}
                      {tx.status === "approved" && " · ✅ Approved"}
                    </span>
                    {tx.note && <span style={styles.historyNote}>{tx.note}</span>}
                  </div>
                  <span style={{
                    fontWeight: 700, fontSize: "0.9rem",
                    color: tx.status === "rejected" ? "#94a3b8" : tx.fromUserId === user.id ? "#dc2626" : "#047857",
                  }}>
                    {tx.fromUserId === user.id ? "-" : "+"}฿{tx.amount.toFixed(2)}
                  </span>
                </div>
              ))}
              {history.length === 0 && <div style={styles.empty}>No transactions yet.</div>}
            </div>
          </div>
        )}
      </div>
    </div>
    </ModalPortal>
  );
}

const styles = {
  overlay: {
    position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)",
    display: "flex", alignItems: "flex-end", justifyContent: "center",
    zIndex: 1000,
  },
  panel: {
    backgroundColor: "#fff", width: "100%", maxWidth: "480px",
    borderRadius: "16px 16px 0 0", padding: "1.25rem",
    display: "flex", flexDirection: "column", gap: "0.75rem",
    maxHeight: "85vh", overflowY: "auto",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: "1.1rem", fontWeight: 800, color: "#1e293b" },
  closeBtn: { background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#64748b" },
  balanceBar: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#f0fdf4", padding: "0.75rem 1rem", borderRadius: "12px",
    border: "1px solid #bbf7d0",
  },
  balanceLabel: { fontSize: "0.85rem", fontWeight: 600, color: "#166534" },
  balanceValue: { fontSize: "1.35rem", fontWeight: 800, color: "#15803d" },
  pendingBadge: {
    backgroundColor: "#fefce8", border: "1px solid #fef08a", borderRadius: "8px",
    padding: "0.5rem", fontSize: "0.85rem", fontWeight: 600, color: "#a16207",
    cursor: "pointer", fontFamily: "inherit", textAlign: "center",
  },
  tabs: { display: "flex", gap: "4px", overflowX: "auto" },
  tab: {
    flex: 1, padding: "0.5rem 0", fontSize: "0.8rem", fontWeight: 600,
    color: "#64748b", background: "#f1f5f9", border: "none", borderRadius: "8px",
    cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
  },
  activeTab: { backgroundColor: "#047857", color: "#fff" },
  section: { display: "flex", flexDirection: "column", gap: "0.75rem" },
  error: { color: "#ef4444", fontSize: "0.8rem", fontWeight: 600, backgroundColor: "#fef2f2", padding: "0.5rem", borderRadius: "6px", textAlign: "center" },
  success: { color: "#15803d", fontSize: "0.8rem", fontWeight: 600, backgroundColor: "#f0fdf4", padding: "0.5rem", borderRadius: "6px", textAlign: "center" },
  pendingCard: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "0.75rem", backgroundColor: "#fffbeb", borderRadius: "12px",
    border: "1px solid #fde68a",
  },
  recentList: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  historyItem: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "0.6rem", backgroundColor: "#f8fafc", borderRadius: "8px",
    border: "1px solid #e2e8f0",
  },
  historyMeta: { display: "block", fontSize: "0.65rem", color: "#94a3b8", marginTop: "1px" },
  historyNote: { display: "block", fontSize: "0.7rem", color: "#64748b", fontStyle: "italic" },
  empty: { textAlign: "center", color: "#94a3b8", padding: "1rem", fontSize: "0.85rem" },
};
