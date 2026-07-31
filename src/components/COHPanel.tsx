import { useState, useEffect } from "react";
import { dbService } from "../firebase";
import { logError } from "../db/errorLog";
import { useLangStore } from "../stores/langStore";
import ModalPortal from "./ModalPortal";

export default function COHPanel({ user, users, onClose }) {
  const lang = useLangStore((s) => s.lang);
  const [balance, setBalance] = useState(0);
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState("balance");
  const [transferTo, setTransferTo] = useState("");
  const [transferAmt, setTransferAmt] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [statementPeriod, setStatementPeriod] = useState("today");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  const [physicalCount, setPhysicalCount] = useState("");
  const [reconcileNote, setReconcileNote] = useState("");

  const handleReconcile = async () => {
    if (submitting || physicalCount.trim() === "") return;
    setError("");
    setMsg("");
    const entered = parseFloat(physicalCount);
    if (isNaN(entered) || entered < 0) {
      alert("Please enter a valid cash amount.");
      return;
    }
    const diff = entered - balance;
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
      setTab("balance");
      load();
    } catch (e) {
      logError("COH", e.message, e.stack);
      alert("Reconciliation failed: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

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

  useEffect(() => {
    load();
    window.addEventListener("coh-changed", load);
    return () => {
      window.removeEventListener("coh-changed", load);
    };
  }, [user?.id]);

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
      console.error(err);
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
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const getPeriodTimestamps = (period, customStart, customEnd) => {
    const start = new Date();
    const end = new Date();

    if (period === "today") {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (period === "yesterday") {
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (period === "week") {
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (period === "custom") {
      if (customStart) {
        const s = new Date(customStart);
        s.setHours(0, 0, 0, 0);
        start.setTime(s.getTime());
      } else {
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
      }
      if (customEnd) {
        const e = new Date(customEnd);
        e.setHours(23, 59, 59, 999);
        end.setTime(e.getTime());
      } else {
        end.setHours(23, 59, 59, 999);
      }
    }

    return { startTs: start.getTime(), endTs: end.getTime() };
  };

  const getStatementData = () => {
    const { startTs, endTs } = getPeriodTimestamps(statementPeriod, startDate, endDate);
    let openingBalance = balance;

    history.forEach(tx => {
      if (tx.status !== "approved") return;
      if (tx.timestamp >= startTs) {
        if (tx.fromUserId === user.id) {
          openingBalance += tx.amount;
        } else if (tx.toUserId === user.id) {
          if (tx.type === "adjustment") {
            if (tx.sign === "credit") {
              openingBalance -= tx.amount;
            } else {
              openingBalance += tx.amount;
            }
          } else {
            openingBalance -= tx.amount;
          }
        }
      }
    });

    const txsInPeriod = history.filter(tx => {
      if (tx.status !== "approved") return false;
      return tx.timestamp >= startTs && tx.timestamp <= endTs;
    });

    let totalInflow = 0;
    let totalOutflow = 0;

    txsInPeriod.forEach(tx => {
      if (tx.fromUserId === user.id) {
        totalOutflow += tx.amount;
      } else if (tx.toUserId === user.id) {
        if (tx.type === "adjustment") {
          if (tx.sign === "credit") {
            totalInflow += tx.amount;
          } else {
            totalOutflow += tx.amount;
          }
        } else {
          totalInflow += tx.amount;
        }
      }
    });

    const closingBalance = openingBalance + totalInflow - totalOutflow;

    return {
      openingBalance,
      totalInflow,
      totalOutflow,
      closingBalance,
      txs: txsInPeriod,
      startTs,
      endTs
    };
  };

  const handlePrint = (data) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const formattedTxs = data.txs.map(tx => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
        <td style="padding: 8px 0;">${new Date(tx.timestamp).toLocaleString()}</td>
        <td style="padding: 8px 0;">
          ${tx.type === "adjustment" ? "Adjustment" : tx.fromUserId === user.id ? `Transfer to ${tx.toUserName || tx.toUserId}` : `Transfer from ${tx.fromUserName}`}
          ${tx.note ? `<br/><small style="color: #64748b; font-style: italic;">Note: ${tx.note}</small>` : ""}
        </td>
        <td style="padding: 8px 0; text-align: right; font-weight: bold; color: ${tx.fromUserId === user.id ? '#dc2626' : '#047857'}">
          ${tx.fromUserId === user.id ? "-" : "+"}฿${tx.amount.toFixed(2)}
        </td>
      </tr>
    `).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Cash on Hand Statement - ${user.name}</title>
          <style>
            body { font-family: 'Inter', system-ui, sans-serif; color: #1e293b; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; }
            .meta-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; }
            .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 40px; }
            .summary-card { border: 1px solid #e2e8f0; padding: 15px; border-radius: 10px; text-align: center; }
            .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .table th { border-bottom: 2px solid #cbd5e1; text-align: left; padding: 10px 0; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2 style="margin: 0; color: #047857;">🍃 Paan Counter</h2>
            <h3 style="margin: 5px 0 0 0; color: #475569;">Cash on Hand Statement</h3>
          </div>
          <div class="meta-grid">
            <div class="meta-card">
              <strong>User:</strong> ${user.name}<br/>
              <strong>Role:</strong> ${user.role}
            </div>
            <div class="meta-card" style="text-align: right;">
              <strong>Statement Period:</strong><br/>
              ${new Date(data.startTs).toLocaleDateString()} - ${new Date(data.endTs).toLocaleDateString()}
            </div>
          </div>
          <div class="summary-grid">
            <div class="summary-card" style="background: #f8fafc;">
              <div style="font-size: 12px; color: #64748b;">Opening Balance</div>
              <div style="font-size: 18px; font-weight: 800; margin-top: 5px;">฿${data.openingBalance.toFixed(2)}</div>
            </div>
            <div class="summary-card" style="background: #f0fdf4; border-color: #bbf7d0;">
              <div style="font-size: 12px; color: #166534;">Total Inflow (+)</div>
              <div style="font-size: 18px; font-weight: 800; margin-top: 5px; color: #15803d;">฿${data.totalInflow.toFixed(2)}</div>
            </div>
            <div class="summary-card" style="background: #fef2f2; border-color: #fecaca;">
              <div style="font-size: 12px; color: #991b1b;">Total Outflow (-)</div>
              <div style="font-size: 18px; font-weight: 800; margin-top: 5px; color: #b91c1c;">฿${data.totalOutflow.toFixed(2)}</div>
            </div>
            <div class="summary-card" style="background: #ecfdf5; border-color: #a7f3d0;">
              <div style="font-size: 12px; color: #065f46;">Closing Balance</div>
              <div style="font-size: 18px; font-weight: 800; margin-top: 5px; color: #047857;">฿${data.closingBalance.toFixed(2)}</div>
            </div>
          </div>
          <h3>Transactions Log</h3>
          <table class="table">
            <thead>
              <tr>
                <th style="width: 25%;">Timestamp</th>
                <th style="width: 55%;">Details</th>
                <th style="width: 20%; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${formattedTxs || `<tr><td colspan="3" style="text-align: center; padding: 20px; color: #94a3b8;">No transactions found in this period.</td></tr>`}
            </tbody>
          </table>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
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
          {["balance", "transfer", "pending", "history", "statement", "reconcile"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{...styles.tab, ...(tab === t ? styles.activeTab : {})}}>
              {t === "balance" ? "Balance" : t === "transfer" ? "Transfer" : t === "pending" ? `Pending${pending.length > 0 ? ` (${pending.length})` : ""}` : t === "history" ? "History" : t === "statement" ? "Statement" : "Verify Cash"}
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
                    {tx.actedBy && <span style={{ fontSize: "0.7rem", color: "#047857" }}>✓ processed by {tx.actedBy}</span>}
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

            <button onClick={handleTransfer} disabled={submitting} className="btn btn-primary" style={{ padding: "0.6rem", fontSize: "0.9rem" }}>
              {submitting ? "Sending..." : "Send for Approval"}
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

        {tab === "statement" && (() => {
          const data = getStatementData();
          return (
            <div style={styles.section}>
              <div style={{ display: "flex", gap: "4px", marginBottom: "0.25rem", overflowX: "auto" }}>
                {["today", "yesterday", "week", "custom"].map(p => (
                  <button
                    key={p}
                    onClick={() => setStatementPeriod(p)}
                    style={{
                      flex: 1,
                      padding: "0.4rem 0.25rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      background: statementPeriod === p ? "var(--primary)" : "#f8fafc",
                      color: statementPeriod === p ? "#fff" : "#475569",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {p === "today" ? "Today" : p === "yesterday" ? "Yesterday" : p === "week" ? "Last 7 Days" : "Custom"}
                  </button>
                ))}
              </div>

              {statementPeriod === "custom" && (
                <div style={{ display: "flex", gap: "8px", marginBottom: "0.5rem" }}>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#64748b" }}>Start Date</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      style={{ padding: "0.35rem", fontSize: "0.75rem", borderRadius: "6px", border: "1px solid #cbd5e1", fontFamily: "inherit" }}
                    />
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#64748b" }}>End Date</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      style={{ padding: "0.35rem", fontSize: "0.75rem", borderRadius: "6px", border: "1px solid #cbd5e1", fontFamily: "inherit" }}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", margin: "0.25rem 0" }}>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "0.5rem", borderRadius: "8px" }}>
                  <div style={{ fontSize: "0.65rem", color: "#64748b" }}>Opening Balance</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800 }}>฿{data.openingBalance.toFixed(2)}</div>
                </div>
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "0.5rem", borderRadius: "8px" }}>
                  <div style={{ fontSize: "0.65rem", color: "#166534" }}>Total Inflow (+)</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#15803d" }}>฿{data.totalInflow.toFixed(2)}</div>
                </div>
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: "0.5rem", borderRadius: "8px" }}>
                  <div style={{ fontSize: "0.65rem", color: "#991b1b" }}>Total Outflow (-)</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#b91c1c" }}>฿{data.totalOutflow.toFixed(2)}</div>
                </div>
                <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "0.5rem", borderRadius: "8px" }}>
                  <div style={{ fontSize: "0.65rem", color: "#065f46" }}>Closing Balance</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#047857" }}>฿{data.closingBalance.toFixed(2)}</div>
                </div>
              </div>

              <button
                onClick={() => handlePrint(data)}
                className="btn btn-primary"
                style={{ padding: "0.5rem", fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
              >
                🖨️ Print Statement
              </button>

              <div style={{ maxHeight: "250px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", marginTop: "0.25rem" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Transactions Log</span>
                {data.txs.map(tx => (
                  <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: "0.75rem" }}>
                        {tx.type === "adjustment" ? "⚙️ Adjustment" : tx.fromUserId === user.id ? "📤 Sent" : "📥 Received"}
                      </span>
                      <span style={{ display: "block", fontSize: "0.6rem", color: "#94a3b8", marginTop: "1px" }}>
                        {tx.fromUserId === user.id ? `To: ${tx.toUserName || tx.toUserId}` : `From: ${tx.fromUserName}`}
                        {" · "}{formatDate(tx.timestamp)}
                      </span>
                      {tx.note && <span style={{ display: "block", fontSize: "0.65rem", color: "#64748b", fontStyle: "italic" }}>{tx.note}</span>}
                    </div>
                    <span style={{ fontWeight: 700, fontSize: "0.85rem", color: tx.fromUserId === user.id ? "#dc2626" : "#047857" }}>
                      {tx.fromUserId === user.id ? "-" : "+"}฿{tx.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
                {data.txs.length === 0 && <div style={styles.empty}>No transactions in this period.</div>}
              </div>
            </div>
          );
        })()}

        {tab === "reconcile" && (
          <div style={styles.section}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--text)", marginBottom: "0.75rem" }}>
              {lang === "hi" ? "गल्ला मिलान करें" : "Verify Counter Cash"}
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                <span>{lang === "hi" ? "System Balance (कागजी कैश):" : "System Balance:"}</span>
                <span style={{ fontWeight: "700", color: "var(--text)" }}>฿{balance.toFixed(2)}</span>
              </div>
 
              <div className="input-group">
                <label className="input-label">
                  {lang === "hi" ? "Actual Drawer Cash / गल्ले में नकद रूपये" : "Actual Drawer Cash"}
                </label>
                <input
                  type="number"
                  placeholder="Enter physical cash..."
                  value={physicalCount}
                  onChange={e => setPhysicalCount(e.target.value)}
                  className="input-field"
                />
              </div>
 
              <div className="input-group">
                <label className="input-label">
                  {lang === "hi" ? "Note / टिप्पणी (वैकल्पिक)" : "Note (optional)"}
                </label>
                <input
                  type="text"
                  placeholder="e.g. End of day matching, change discrepancy..."
                  value={reconcileNote}
                  onChange={e => setReconcileNote(e.target.value)}
                  className="input-field"
                />
              </div>
 
              {physicalCount.trim() !== "" && (() => {
                const diff = (parseFloat(physicalCount) || 0) - balance;
                const absDiff = Math.abs(diff);
                return (
                  <div style={{ 
                    padding: "0.75rem", 
                    borderRadius: "8px", 
                    backgroundColor: diff === 0 ? "#ecfdf5" : diff < 0 ? "#fef2f2" : "#fef9c3",
                    border: `1px solid ${diff === 0 ? "#10b981" : diff < 0 ? "#ef4444" : "#eab308"}`,
                    fontSize: "0.82rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "700" }}>
                      <span>{lang === "hi" ? "Difference / अंतर:" : "Difference:"}</span>
                      <span style={{ color: diff === 0 ? "#10b981" : diff < 0 ? "#ef4444" : "#ca8a04" }}>
                        {diff === 0 ? "฿0.00 (Perfect Match)" : `${diff < 0 ? "-" : "+"}฿${absDiff.toFixed(2)}`}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                      {diff === 0 
                        ? (lang === "hi" ? "✅ Everything is correct! गल्ला पूरी तरह सही है।" : "✅ Everything is correct! Perfect Match.") 
                        : diff < 0 
                          ? (lang === "hi" ? `⚠️ Shortage: You are short of ฿${absDiff.toFixed(2)}! गल्ले में पैसे कम हैं।` : `⚠️ Shortage: You are short of ฿${absDiff.toFixed(2)}!`)
                          : (lang === "hi" ? `📈 Surplus: You have ฿${absDiff.toFixed(2)} extra! गल्ले में पैसे ज़्यादा हैं।` : `📈 Surplus: You have ฿${absDiff.toFixed(2)} extra!`)
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
                {submitting ? "Saving..." : (lang === "hi" ? "Confirm & Reconcile / मिलान पक्का करें" : "Confirm & Reconcile")}
              </button>
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
