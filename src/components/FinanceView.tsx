import { useState, useEffect, useMemo } from "react";
import { dbService } from "../firebase";
import { getUsers } from "../db/auth";
import { logError } from "../db/errorLog";
import { useConfirmStore } from "../stores/confirmStore";
import AccountStatementModal from "./AccountStatementModal";
import { QUICK_CASH_CHIPS } from "../constants";

export default function FinanceView({ user }) {
  const confirm = useConfirmStore((s) => s.confirm);
  const [banks, setBanks] = useState([]);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [cohTransactions, setCohTransactions] = useState([]);

  const [activeTab, setActiveTab] = useState("overview"); // overview | banks | transfer | ledger

  const [bankName, setBankName] = useState("");
  const [bankBalance, setBankBalance] = useState("");
  const [editingBankId, setEditingBankId] = useState(null);

  const [fromType, setFromType] = useState("bank");
  const [fromId, setFromId] = useState("");
  const [toType, setToType] = useState("coh");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  // Ledger filters
  const [ledgerFilter, setLedgerFilter] = useState("all"); // all | bank | coh
  const [ledgerSearch, setLedgerSearch] = useState("");

  // Statement drill-down
  const [stmt, setStmt] = useState(null); // { type, id, name, icon, balance }

  const load = () => {
    try {
      setBanks(dbService.getBanks());
      setUsers(getUsers());
      setTransactions(dbService.getFinanceTransactions());
      setCohTransactions(dbService.getAllTransactions());
    } catch (err) {
      logError("FINANCE", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to load finance data"));
      console.error(err);
    }
  };

  useEffect(() => {
    load();
    window.addEventListener("finance-changed", load);
    window.addEventListener("coh-changed", load);
    window.addEventListener("users-changed", load);
    return () => {
      window.removeEventListener("finance-changed", load);
      window.removeEventListener("coh-changed", load);
      window.removeEventListener("users-changed", load);
    };
  }, []);

  const totalBanks = banks.reduce((sum, b) => sum + (b.balance || 0), 0);
  const totalCoh = users.reduce((sum, u) => sum + (dbService.getBalance(u.id) || 0), 0);
  const grandTotal = totalBanks + totalCoh;

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const todayTransfers = useMemo(() => {
    const unified = [...transactions, ...cohTransactions.filter(t => !t.finTxId)].sort((a, b) => b.timestamp - a.timestamp);
    return unified.filter(tx => tx.timestamp >= todayStart);
  }, [transactions, cohTransactions, todayStart]);

  const unifiedTransactions = useMemo(() => {
    return [...transactions, ...cohTransactions.filter(t => !t.finTxId)].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [transactions, cohTransactions]);

  const filteredTransactions = useMemo(() => {
    let list = unifiedTransactions;
    if (ledgerFilter === "bank") list = transactions;
    if (ledgerFilter === "coh") list = cohTransactions;
    if (ledgerSearch.trim()) {
      const q = ledgerSearch.trim().toLowerCase();
      list = list.filter(tx => {
        const isFin = !!tx.fromType;
        const from = isFin ? tx.fromName : tx.fromUserName;
        const to = isFin ? tx.toName : tx.toUserName;
        const actor = isFin ? tx.actor : tx.performedBy;
        const hay = `${from || ""} ${to || ""} ${tx.note || ""} ${actor || ""}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [unifiedTransactions, transactions, cohTransactions, ledgerFilter, ledgerSearch]);

  const handleSaveBank = async () => {
    setError("");
    setMsg("");
    try {
      if (editingBankId) {
        await dbService.updateBank(editingBankId, bankName, bankBalance);
      } else {
        await dbService.addBank(bankName, bankBalance);
      }
      setBankName("");
      setBankBalance("");
      setEditingBankId(null);
      load();
    } catch (err) {
      setError(err.message || "Failed to save bank");
      console.error(err);
    }
  };

  const handleEditBank = (bank) => {
    setEditingBankId(bank.id);
    setBankName(bank.name);
    setBankBalance(String(bank.balance || 0));
    setError("");
    setMsg("");
    setActiveTab("banks");
  };

  const handleDeleteBank = async (bank) => {
    if (await confirm(`Are you sure you want to delete "${bank.name}"? This only removes the bank account, it does not delete transactions.`, { title: "Delete Bank", confirmLabel: "Delete", variant: "danger" })) {
      try {
        await dbService.deleteBank(bank.id);
        if (editingBankId === bank.id) {
          setEditingBankId(null);
          setBankName("");
          setBankBalance("");
        }
        load();
      } catch (err) {
        setError(err.message || "Failed to delete bank");
        console.error(err);
      }
    }
  };

  const entityLabel = (type, id) => {
    if (type === "bank") {
      const b = banks.find(b => b.id === id);
      return b ? b.name : "";
    }
    const u = users.find(u => u.id === id);
    return u ? u.name : "";
  };

  const handleTransfer = async () => {
    setError("");
    setMsg("");
    const fromName = entityLabel(fromType, fromId);
    const toName = entityLabel(toType, toId);
    if (!fromName || !toName) { setError("Select valid source and target."); return; }
    try {
      await dbService.financeTransfer({ fromType, fromId, fromName, toType, toId, toName, amount, note, actor: user?.name });
      setAmount("");
      setNote("");
      setMsg("✅ Transfer completed!");
      load();
    } catch (err) {
      setError(err.message || "Transfer failed");
      console.error(err);
    }
  };

  const formatDate = (ts) => new Date(ts).toLocaleString();

  const openStatement = (type, id, name, icon, balance) => {
    const finRows = type === "bank"
      ? transactions
        .filter(t =>
          (t.fromType === type && t.fromId === id) ||
          (t.toType === type && t.toId === id)
        )
        .map(t => {
          const isOut = t.fromType === type && t.fromId === id;
          return {
            id: t.id,
            timestamp: t.timestamp,
            in: isOut ? null : t.amount,
            out: isOut ? t.amount : null,
            description: `${t.fromName || "?"} → ${t.toName || "?"}`,
            detail: [t.note, t.actor ? `by ${t.actor}` : null].filter(Boolean).join(" · "),
          };
        })
      : [];

    const bankCohRows = type === "bank"
      ? cohTransactions
        .filter(t => t.fromUserId === "bank_" + id || t.toUserId === "bank_" + id)
        .map(t => {
          const isOut = t.fromUserId === "bank_" + id;
          return {
            id: t.id,
            timestamp: t.timestamp,
            in: isOut ? null : t.amount,
            out: isOut ? t.amount : null,
            description: `${t.fromUserName || "System"} → ${t.toUserName || t.toUserId || "System"}`,
            detail: [t.performedBy ? `performed by ${t.performedBy}` : null, t.note || null].filter(Boolean).join(" · "),
          };
        })
      : [];

    const userCohRows = type === "coh"
      ? cohTransactions
        .filter(t => t.fromUserId === id || t.toUserId === id)
        .map(t => {
          const isIn = t.toUserId === id;
          return {
            id: t.id,
            timestamp: t.timestamp,
            in: isIn ? t.amount : null,
            out: isIn ? null : t.amount,
            description: `${typeLabel(t.type)} · ${t.fromUserName || "System"} → ${t.toUserName || t.toUserId || "System"}`,
            detail: [t.performedBy ? `performed by ${t.performedBy}` : null, t.note || null].filter(Boolean).join(" · "),
          };
        })
      : [];

    const rows = [...finRows, ...bankCohRows, ...userCohRows].sort((a, b) => b.timestamp - a.timestamp);
    setStmt({ title: name, subtitle: type === "bank" ? "Bank Account" : "Cash on Hand", icon, balance, rows });
  };

  const typeLabel = (t) => {
    const map = { sale: "Sale", expense: "Expense", adjustment: "Adjustment", transfer: "Transfer", payment: "Khata Payment", refund: "Refund" };
    return map[t] || "Transaction";
  };

  const renderTxRow = (tx) => {
    const isFin = !!tx.fromType;
    const src = isFin
      ? (tx.fromType === "bank" ? "🏦" : "👤")
      : (tx.fromUserId || "").startsWith("bank_") ? "🏦" : "💰";
    const dst = isFin
      ? (tx.toType === "bank" ? "🏦" : "👤")
      : (tx.toUserId || "").startsWith("bank_") ? "🏦" : "💰";
    const fromName = isFin ? tx.fromName : (tx.fromUserName || "System");
    const toName = isFin ? tx.toName : (tx.toUserName || tx.toUserId || "System");
    const actor = isFin ? tx.actor : tx.performedBy;
    const debit = !isFin && tx.sign === "debit";
    return (
      <div key={tx.id} className="coh-tx-row">
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text)" }}>
            {src} {fromName} → {dst} {toName}
            {!isFin && tx.status && tx.status !== "approved" && (
              <span style={{ fontSize: "0.65rem", fontWeight: 700, color: tx.status === "rejected" ? "var(--error)" : "#d97706", marginLeft: "0.4rem" }}>
                {tx.status === "rejected" ? "❌ rejected" : "⏳ pending"}
              </span>
            )}
          </div>
          <div className="text-muted" style={{ fontSize: "0.7rem" }}>
            {formatDate(tx.timestamp)}{actor ? ` · 👤 ${actor}` : ""}
          </div>
          {tx.note && <div className="text-muted" style={{ fontSize: "0.7rem", fontStyle: "italic" }}>{tx.note}</div>}
        </div>
        <div style={{ fontWeight: 700, fontSize: "0.95rem", color: debit ? "var(--error)" : "var(--primary)" }}>
          {debit ? "-" : "+"}฿{(tx.amount || 0).toFixed(2)}
        </div>
      </div>
    );
  };

  const tabs = [
    { key: "overview", label: "📊 Overview" },
    { key: "banks", label: "🏦 Banks" },
    { key: "transfer", label: "🔄 Transfer" },
    { key: "ledger", label: "📒 Ledger" },
  ];

  return (
    <div className="coh-container">
      <h3 className="coh-title">🏦 Finance</h3>

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

      {/* ── Overview ── */}
      {activeTab === "overview" && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card" style={{ background: "linear-gradient(135deg, #047857, #065f46)", border: "none" }} onClick={() => { setLedgerFilter("all"); setActiveTab("ledger"); }}>
              <span className="kpi-label" style={{ color: "#a7f3d0" }}>Total Assets</span>
              <span className="kpi-value" style={{ color: "#ffffff" }}>฿{grandTotal.toFixed(2)}</span>
              <span className="kpi-sub" style={{ color: "#a7f3d0" }}>Banks + All User COH</span>
            </div>
            <div className="kpi-card" onClick={() => { setLedgerFilter("bank"); setActiveTab("ledger"); }}>
              <span className="kpi-label">Bank Balance</span>
              <span className="kpi-value" style={{ color: "#2563eb" }}>฿{totalBanks.toFixed(2)}</span>
              <span className="kpi-sub">{banks.length} bank account{banks.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="kpi-card" onClick={() => { setLedgerFilter("coh"); setActiveTab("ledger"); }}>
              <span className="kpi-label">User COH</span>
              <span className="kpi-value" style={{ color: "#047857" }}>฿{totalCoh.toFixed(2)}</span>
              <span className="kpi-sub">{users.length} cashier{users.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="kpi-card" onClick={() => { setLedgerFilter("all"); setActiveTab("ledger"); }}>
              <span className="kpi-label">Today's Transfers</span>
              <span className="kpi-value" style={{ color: "#d97706" }}>{todayTransfers.length}</span>
              <span className="kpi-sub">฿{todayTransfers.reduce((s, tx) => s + (tx.amount || 0), 0).toFixed(2)} moved</span>
            </div>
          </div>

          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <h4 className="section-subtitle" style={{ margin: 0 }}>Accounts</h4>
              <button className="btn btn-outline btn-sm" onClick={() => setActiveTab("banks")}>Manage Banks</button>
            </div>
            <div className="coh-balances-grid">
              {banks.map(b => (
                <div key={b.id} className="coh-balance-card" onClick={() => openStatement("bank", b.id, b.name, "🏦", b.balance || 0)}>
                  <span className="coh-card-chevron">›</span>
                  <div className="coh-balance-name">🏦 {b.name}</div>
                  <div className="coh-balance-value">฿{(b.balance || 0).toFixed(2)}</div>
                </div>
              ))}
              {users.map(u => (
                <div key={u.id} className="coh-balance-card" onClick={() => openStatement("coh", u.id, u.name, "👤", dbService.getBalance(u.id) || 0)}>
                  <span className="coh-card-chevron">›</span>
                  <div className="coh-balance-name">👤 {u.name} <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>(COH)</span></div>
                  <div className="coh-balance-value">฿{(dbService.getBalance(u.id) || 0).toFixed(2)}</div>
                </div>
              ))}
              {banks.length === 0 && users.length === 0 && (
                <div className="coh-empty">No accounts yet. Add a bank to get started.</div>
              )}
            </div>
          </div>

          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <h4 className="section-subtitle" style={{ margin: 0 }}>Recent Activity</h4>
              <button className="btn btn-outline btn-sm" onClick={() => setActiveTab("ledger")}>View All</button>
            </div>
            <div className="coh-tx-list">
              {unifiedTransactions.length === 0 ? (
                <div className="coh-empty">No transactions yet.</div>
              ) : (
                unifiedTransactions.slice(0, 5).map(tx => renderTxRow(tx))
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Banks ── */}
      {activeTab === "banks" && (
        <>
          {error && !msg && <div className="error-inline">{error}</div>}
          {msg && <div className="success-inline">{msg}</div>}

          <div className="card">
            <h4 className="section-subtitle" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", marginBottom: "0.5rem" }}>
              {editingBankId ? "Edit Bank" : "Add Bank"}
            </h4>
            <div className="input-group">
              <label className="input-label">Bank Name</label>
              <input type="text" value={bankName} onChange={e => { setBankName(e.target.value); setError(""); setMsg(""); }} className="input-field" placeholder="e.g. Kasikorn, SCB, Bangkok Bank" />
            </div>
            <div className="input-group">
              <label className="input-label">Balance</label>
              <input type="number" value={bankBalance} onChange={e => { setBankBalance(e.target.value); setError(""); setMsg(""); }} className="input-field" placeholder="0" />
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button onClick={handleSaveBank} className="btn btn-primary">{editingBankId ? "Save Changes" : "Add Bank"}</button>
              {editingBankId && (
                <button onClick={() => { setEditingBankId(null); setBankName(""); setBankBalance(""); }} className="btn btn-outline">Cancel</button>
              )}
            </div>
          </div>

          <div className="card">
            <h4 className="section-subtitle" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", marginBottom: "0.5rem" }}>
              Bank Accounts ({banks.length})
            </h4>
            {banks.length === 0 ? (
              <div className="coh-empty">No banks yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                {banks.map(b => (
                  <div key={b.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid var(--border)", borderRadius: "8px", padding: "0.5rem 0.6rem" }}>
                    <div>
                      <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>🏦 {b.name}</span>
                      <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--primary)", marginLeft: "0.5rem" }}>฿{(b.balance || 0).toFixed(2)}</span>
                    </div>
                    <span style={{ display: "flex", gap: "0.35rem" }}>
                      <button onClick={() => handleEditBank(b)} className="btn btn-outline" style={{ padding: "2px 8px", fontSize: "0.7rem" }}>Edit</button>
                      <button onClick={() => handleDeleteBank(b)} className="btn btn-outline" style={{ padding: "2px 8px", fontSize: "0.7rem", color: "#dc2626", borderColor: "#dc2626" }}>Delete</button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Transfer ── */}
      {activeTab === "transfer" && (
        <div className="card">
          <h4 className="section-subtitle" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", marginBottom: "0.5rem" }}>Transfer Balance</h4>
          <p className="text-muted" style={{ fontSize: "0.75rem", margin: "0 0 0.5rem" }}>Move money between internal banks and user COH instantly.</p>
          {error && <div className="error-inline">{error}</div>}
          {msg && <div className="success-inline">{msg}</div>}
          <div className="input-group">
            <label className="input-label">From</label>
            <select value={fromType} onChange={e => { setFromType(e.target.value); setFromId(""); setError(""); setMsg(""); }} className="input-field" style={{ fontFamily: "inherit" }}>
              <option value="bank">🏦 Bank</option>
              <option value="coh">👤 User COH</option>
            </select>
            <select value={fromId} onChange={e => { setFromId(e.target.value); setError(""); setMsg(""); }} className="input-field" style={{ fontFamily: "inherit", marginTop: "0.35rem" }}>
              <option value="">Select source...</option>
              {fromType === "bank" ? (
                banks.map(b => <option key={b.id} value={b.id}>{b.name} (฿{(b.balance || 0).toFixed(2)})</option>)
              ) : (
                users.map(u => <option key={u.id} value={u.id}>{u.name} (฿{(dbService.getBalance(u.id) || 0).toFixed(2)})</option>)
              )}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">To</label>
            <select value={toType} onChange={e => { setToType(e.target.value); setToId(""); setError(""); setMsg(""); }} className="input-field" style={{ fontFamily: "inherit" }}>
              <option value="coh">👤 User COH</option>
              <option value="bank">🏦 Bank</option>
            </select>
            <select value={toId} onChange={e => { setToId(e.target.value); setError(""); setMsg(""); }} className="input-field" style={{ fontFamily: "inherit", marginTop: "0.35rem" }}>
              <option value="">Select target...</option>
              {toType === "bank" ? (
                banks.map(b => <option key={b.id} value={b.id}>{b.name} (฿{(b.balance || 0).toFixed(2)})</option>)
              ) : (
                users.map(u => <option key={u.id} value={u.id}>{u.name} (฿{(dbService.getBalance(u.id) || 0).toFixed(2)})</option>)
              )}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Amount (฿)</label>
            <input type="number" value={amount} onChange={e => { setAmount(e.target.value); setError(""); setMsg(""); }} className="input-field" placeholder="0" />
            <div className="filter-bar" style={{ marginTop: "0.35rem", marginBottom: 0 }}>
              {QUICK_CASH_CHIPS.map(v => (
                <button key={v} className="quick-chip" onClick={() => { setAmount(String(v)); setError(""); setMsg(""); }}>฿{v}</button>
              ))}
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Note (optional)</label>
            <input type="text" value={note} onChange={e => { setNote(e.target.value); setError(""); setMsg(""); }} className="input-field" placeholder="Reason for transfer" />
          </div>
          <button onClick={handleTransfer} className="btn btn-primary" style={{ width: "100%", padding: "0.6rem" }}>Transfer</button>
        </div>
      )}

      {/* ── Ledger ── */}
      {activeTab === "ledger" && (
        <div className="card">
          <h4 className="section-subtitle" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", marginBottom: "0.5rem" }}>
            Unified Ledger — All Money Movement ({filteredTransactions.length})
          </h4>
          <p className="text-muted" style={{ fontSize: "0.7rem", margin: "0 0 0.5rem" }}>
            Every movement across banks and cash: transfers, sales, khata payments, expenses, purchases, adjustments.
          </p>
          <div className="filter-bar">
            <select value={ledgerFilter} onChange={e => setLedgerFilter(e.target.value)} className="input-field" style={{ fontFamily: "inherit", maxWidth: "150px", padding: "0.4rem", fontSize: "0.8rem" }}>
              <option value="all">All accounts</option>
              <option value="bank">Banks only</option>
              <option value="coh">User COH only</option>
            </select>
            <input
              type="text"
              value={ledgerSearch}
              onChange={e => setLedgerSearch(e.target.value)}
              className="input-field"
              style={{ flex: 1, minWidth: "140px", padding: "0.4rem", fontSize: "0.8rem" }}
              placeholder="🔍 Search account or note..."
            />
          </div>
          <div className="ledger-list">
            {filteredTransactions.length === 0 ? (
              <div className="coh-empty">No transactions match your filters.</div>
            ) : (
              filteredTransactions.slice(0, 100).map(tx => renderTxRow(tx))
            )}
          </div>
        </div>
      )}

      {stmt && (
        <AccountStatementModal
          title={stmt.title}
          subtitle={stmt.subtitle}
          icon={stmt.icon}
          balance={stmt.balance}
          rows={stmt.rows}
          onClose={() => setStmt(null)}
        />
      )}
    </div>
  );
}
