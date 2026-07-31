import { useState, useEffect } from "react";
import { dbService } from "../firebase";
import { getUsers } from "../db/auth";
import { logError } from "../db/errorLog";
import { useConfirmStore } from "../stores/confirmStore";

export default function FinanceView({ user }) {
  const confirm = useConfirmStore((s) => s.confirm);
  const [banks, setBanks] = useState([]);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);

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

  const load = () => {
    try {
      setBanks(dbService.getBanks());
      setUsers(getUsers());
      setTransactions(dbService.getFinanceTransactions());
    } catch (err) {
      logError("FINANCE", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to load finance data"));
      console.error(err);
    }
  };

  useEffect(() => {
    load();
    window.addEventListener("finance-changed", load);
    window.addEventListener("users-changed", load);
    return () => {
      window.removeEventListener("finance-changed", load);
      window.removeEventListener("users-changed", load);
    };
  }, []);

  const totalBanks = banks.reduce((sum, b) => sum + (b.balance || 0), 0);
  const totalCoh = users.reduce((sum, u) => sum + (dbService.getBalance(u.id) || 0), 0);
  const grandTotal = totalBanks + totalCoh;

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

  return (
    <div className="coh-container">
      <h3 className="coh-title">🏦 Finance — Balances Overview</h3>

      <div className="coh-balances-grid">
        {banks.map(b => (
          <div key={b.id} className="coh-balance-card">
            <div className="coh-balance-name">🏦 {b.name}</div>
            <div className="coh-balance-value">฿{(b.balance || 0).toFixed(2)}</div>
          </div>
        ))}
        {users.map(u => (
          <div key={u.id} className="coh-balance-card">
            <div className="coh-balance-name">👤 {u.name} <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>(COH)</span></div>
            <div className="coh-balance-value">฿{(dbService.getBalance(u.id) || 0).toFixed(2)}</div>
          </div>
        ))}
        {banks.length === 0 && users.length === 0 && (
          <div className="coh-empty">No accounts yet. Add a bank below.</div>
        )}
      </div>

      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="text-muted" style={{ fontSize: "0.75rem" }}>Banks: ฿{totalBanks.toFixed(2)} · User COH: ฿{totalCoh.toFixed(2)}</div>
          <div style={{ fontWeight: 800, fontSize: "1.25rem", color: "var(--primary)" }}>Total: ฿{grandTotal.toFixed(2)}</div>
        </div>
      </div>

      <div className="card">
        <h4 className="section-subtitle" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", marginBottom: "0.5rem" }}>
          {editingBankId ? "Edit Bank" : "Add Bank"}
        </h4>
        {error && !msg && <div className="error-inline">{error}</div>}
        {msg && <div className="success-inline">{msg}</div>}
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
        {banks.length > 0 && (
          <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {banks.map(b => (
              <div key={b.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid var(--border)", borderRadius: "8px", padding: "0.4rem 0.6rem" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>🏦 {b.name} — ฿{(b.balance || 0).toFixed(2)}</span>
                <span style={{ display: "flex", gap: "0.35rem" }}>
                  <button onClick={() => handleEditBank(b)} className="btn btn-outline" style={{ padding: "2px 8px", fontSize: "0.7rem" }}>Edit</button>
                  <button onClick={() => handleDeleteBank(b)} className="btn btn-outline" style={{ padding: "2px 8px", fontSize: "0.7rem", color: "#dc2626", borderColor: "#dc2626" }}>Delete</button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h4 className="section-subtitle" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", marginBottom: "0.5rem" }}>Transfer Balance</h4>
        <p className="text-muted" style={{ fontSize: "0.75rem", margin: "0 0 0.5rem" }}>Move money between internal banks and user COH instantly.</p>
        {error && <div className="error-inline">{error}</div>}
        {msg && <div className="success-inline">{msg}</div>}
        <div className="input-group">
          <label className="input-label">From</label>
          <select value={fromType} onChange={e => { setFromType(e.target.value); setFromId(""); }} className="input-field" style={{ fontFamily: "inherit" }}>
            <option value="bank">🏦 Bank</option>
            <option value="coh">👤 User COH</option>
          </select>
          <select value={fromId} onChange={e => { setFromId(e.target.value); setError(""); }} className="input-field" style={{ fontFamily: "inherit", marginTop: "0.35rem" }}>
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
          <select value={toType} onChange={e => { setToType(e.target.value); setToId(""); }} className="input-field" style={{ fontFamily: "inherit" }}>
            <option value="coh">👤 User COH</option>
            <option value="bank">🏦 Bank</option>
          </select>
          <select value={toId} onChange={e => { setToId(e.target.value); setError(""); }} className="input-field" style={{ fontFamily: "inherit", marginTop: "0.35rem" }}>
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
        </div>
        <div className="input-group">
          <label className="input-label">Note (optional)</label>
          <input type="text" value={note} onChange={e => { setNote(e.target.value); setError(""); setMsg(""); }} className="input-field" placeholder="Reason for transfer" />
        </div>
        <button onClick={handleTransfer} className="btn btn-primary">Transfer</button>
      </div>

      <div className="card">
        <h4 className="section-subtitle" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", marginBottom: "0.5rem" }}>Transaction Ledger</h4>
        <div className="coh-tx-list">
          {transactions.length === 0 ? (
            <div className="coh-empty">No transactions yet.</div>
          ) : (
            transactions.slice(0, 50).map(tx => (
              <div key={tx.id} className="coh-tx-row">
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text)" }}>
                    {tx.fromType === "bank" ? "🏦" : "👤"} {tx.fromName} → {tx.toType === "bank" ? "🏦" : "👤"} {tx.toName}
                  </div>
                  <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                    {formatDate(tx.timestamp)}{tx.actor ? ` · by ${tx.actor}` : ""}
                  </div>
                  {tx.note && <div className="text-muted" style={{ fontSize: "0.7rem", fontStyle: "italic" }}>{tx.note}</div>}
                </div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--primary)" }}>฿{tx.amount.toFixed(2)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
