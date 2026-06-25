import React, { useState, useEffect } from "react";
import { dbService } from "../firebase";
import { SkeletonList } from "./Skeleton";
import { logError } from "../db/errorLog";
import ReminderModal from "./ReminderModal";

export default function KhataView() {
  const [customers, setCustomers] = useState([]);
  const [selectedCust, setSelectedCust] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReminders, setShowReminders] = useState(false);

  useEffect(() => { loadCustomers(); }, []);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const list = await dbService.getCustomers();
      setCustomers(list);
    } catch (err) {
      logError("CREDIT", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to load customers"));
      console.error(err);
    }
    setLoading(false);
  };

  const handleSelectCustomer = (c) => {
    setSelectedCust(c);
    setPayAmount("");
  };

  const handleDeselect = () => {
    setSelectedCust(null);
    loadCustomers();
  };

  const handleSettlePayment = async (e) => {
    e.preventDefault();
    if (!selectedCust || !payAmount || parseFloat(payAmount) <= 0) return;
    const paymentVal = parseFloat(payAmount);
    if (paymentVal > selectedCust.balance) {
      alert("Payment cannot be greater than the current balance.");
      return;
    }
    const ledgerEntry = { date: Date.now(), type: "Payment", amount: paymentVal, description: "Cash payment settled at counter" };
    try {
      await dbService.updateUdhaarBalance(selectedCust.id, -paymentVal, ledgerEntry);
    } catch (err) {
      logError("CREDIT", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to record payment"));
      console.error(err);
      return;
    }
    const updatedCust = { ...selectedCust, balance: selectedCust.balance - paymentVal, ledger: [...(selectedCust.ledger || []), ledgerEntry] };
    setSelectedCust(updatedCust);
    setPayAmount("");
    alert("Payment of ฿" + paymentVal + " recorded successfully!");
  };

  const getFilteredCustomers = () => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)));
  };

  const getTotalOutstanding = () => customers.reduce((sum, c) => sum + (c.balance || 0), 0);

  const openStatement = (cust) => {
    const store = JSON.parse(localStorage.getItem("pan_store_settings") || "{}");
    const w = window.open("", "_blank", "width=500,height=700");
    if (!w) { alert("Popup blocked! Please allow popups for this site."); return; }
    const ledger = cust.ledger || [];
    const rows = ledger.map(e => `
      <tr>
        <td style="padding:4px 6px;font-size:11px">${new Date(e.date).toLocaleDateString("en-GB")}</td>
        <td style="padding:4px 6px;font-size:11px">${e.type}</td>
        <td style="padding:4px 6px;font-size:11px;text-align:right">${e.amount > 0 ? "฿"+e.amount.toFixed(2) : ""}</td>
        <td style="padding:4px 6px;font-size:11px;text-align:right;color:#dc2626">${e.amount < 0 ? "฿"+(Math.abs(e.amount)).toFixed(2) : ""}</td>
        <td style="padding:4px 6px;font-size:11px">${e.description || ""}</td>
      </tr>
    `).join("");
    w.document.write(`
      <html><head><title>Statement - ${cust.name}</title>
      <style>
        body { font-family: 'Courier New', monospace; font-size: 12px; padding: 20px; color: #1e293b; }
        .header { text-align: center; margin-bottom: 16px; }
        .name { font-size: 18px; font-weight: 800; color: #047857; }
        .info { font-size: 11px; color: #64748b; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { background: #f1f5f9; padding: 6px; font-size: 10px; text-transform: uppercase; text-align: left; }
        th:nth-child(3), th:nth-child(4) { text-align: right; }
        tr { border-bottom: 1px solid #f1f5f9; }
        .total { display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; color: #047857; margin-top: 12px; padding-top: 8px; border-top: 2px solid #1e293b; }
        @media print { body { padding: 10px; } }
      </style></head>
      <body>
        <div class="header">
          <div class="name">${store.name || "Paan Counter"}</div>
          <div class="info">Customer Statement</div>
          <div class="info">${cust.name}${cust.phone ? " | "+cust.phone : ""}</div>
        </div>
        <table><thead><tr><th>Date</th><th>Type</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th>Description</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <div class="total"><span>Outstanding Balance</span><span>฿${(cust.balance || 0).toFixed(2)}</span></div>
        <script>window.onload=function(){window.print();window.close();}<${""}/script>
      </body></html>
    `); w.document.close();
  };

  return (
    <div className="content-section">
      <div className="flex items-center justify-between">
        <h2 className="section-title" style={{ fontSize: "1.25rem" }}>Credit Accounts</h2>
        {!selectedCust && (
          <button onClick={() => setShowReminders(true)} className="btn btn-outline btn-sm">📨 Remind</button>
        )}
      </div>

      {selectedCust ? (
        <div className="card">
          <div className="flex items-center gap-lg" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem", marginBottom: "1rem" }}>
            <button onClick={handleDeselect} className="back-link">← Back to List</button>
            <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text)" }}>{selectedCust.name}</span>
            <button onClick={() => openStatement(selectedCust)} className="user-btn-sm user-btn-edit" style={{ marginLeft: "auto" }}>🖨️ Statement</button>
          </div>

          <div className="flex-col gap-lg" style={{ marginBottom: "1.5rem" }}>
            <div className="stat-grid">
              <div className="stat-card">
                <span className="stat-label">Pending Balance</span>
                <span className="stat-value stat-value-error">{selectedCust.balance ? `฿${selectedCust.balance.toFixed(2)}` : "฿0.00"}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Phone Number</span>
                <span className="stat-value" style={{ fontSize: "0.85rem" }}>{selectedCust.phone || "No phone added"}</span>
              </div>
            </div>
            {selectedCust.balance > 0 && (
              <form onSubmit={handleSettlePayment} style={{ background: "var(--warning-light)", border: "1px solid #fef3c7", borderRadius: "var(--radius-sm)", padding: "0.75rem" }}>
                <h4 style={{ marginBottom: "0.5rem" }}>Record Settle Payment</h4>
                <div className="flex items-center gap-sm">
                  <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="Enter amount to pay" className="input-field" style={{ flex: 1 }} />
                  <button type="button" onClick={() => setPayAmount(selectedCust.balance.toString())}
                    className="user-btn-sm user-btn-edit" style={{ borderColor: "var(--secondary)", color: "var(--secondary)" }}>Pay All</button>
                  <button type="submit" className="btn btn-primary">Record</button>
                </div>
              </form>
            )}
          </div>

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
            <h4 className="section-subtitle" style={{ marginBottom: "0.5rem" }}>Ledger History</h4>
            <div className="coh-tx-list" style={{ maxHeight: "220px" }}>
              {(!selectedCust.ledger || selectedCust.ledger.length === 0) ? (
                <div className="coh-empty">No transaction history found.</div>
              ) : (
                selectedCust.ledger.map((log, idx) => (
                  <div key={idx} className="ledger-item">
                    <div className="ledger-meta">
                      <span className={`ledger-type ${log.type === "Payment" ? "ledger-type-payment" : "ledger-type-purchase"}`}>
                        {log.type}
                      </span>
                      <span className="ledger-date">{new Date(log.date).toLocaleString()}</span>
                    </div>
                    <div className="ledger-info">
                      <span className="ledger-desc">{log.description}</span>
                      <span className={`ledger-amount ${log.type === "Payment" ? "ledger-amount-credit" : "ledger-amount-debit"}`}>
                        {log.type === "Payment" ? "-" : "+"}฿{log.amount}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div style={{ background: "var(--error-light)", border: "1px solid #fee2e2", borderRadius: "var(--radius-sm)", padding: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700, fontSize: "0.85rem", marginBottom: "1rem", color: "#991b1b" }}>
            <span>Total Shop Outstanding credit:</span>
            <span style={{ fontSize: "1.1rem", color: "var(--error)", fontWeight: 800 }}>฿{getTotalOutstanding().toFixed(2)}</span>
          </div>

          <input type="text" placeholder="Search customer by name or phone..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field" style={{ marginBottom: "1rem" }} />

          {loading ? (
            <SkeletonList rows={4} />
          ) : (
            <div className="coh-tx-list">
              {getFilteredCustomers().length === 0 ? (
                <div className="coh-empty">No customers found in ledger.</div>
              ) : (
                getFilteredCustomers().map(c => (
                  <div key={c.id} onClick={() => handleSelectCustomer(c)} className="customer-card">
                    <div className="customer-card-left">
                      <div className="customer-name">{c.name}</div>
                      <div className="customer-phone">{c.phone || "No phone"}</div>
                    </div>
                    <div className="customer-card-right">
                      <div className="customer-bal-label">Due Balance:</div>
                      <div className={`customer-bal-value ${c.balance > 0 ? "customer-bal-debt" : ""}`}>
                        ฿{(c.balance || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
      {showReminders && <ReminderModal customers={customers} onClose={() => setShowReminders(false)} />}
    </div>
  );
}
