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

  useEffect(() => {
    loadCustomers();
  }, []);

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
    loadCustomers(); // Reload list
  };

  const handleSettlePayment = async (e) => {
    e.preventDefault();
    if (!selectedCust || !payAmount || parseFloat(payAmount) <= 0) return;

    const paymentVal = parseFloat(payAmount);
    if (paymentVal > selectedCust.balance) {
      alert("Payment cannot be greater than the current balance.");
      return;
    }

    const ledgerEntry = {
      date: Date.now(),
      type: "Payment",
      amount: paymentVal,
      description: "Cash payment settled at counter"
    };

    // Deducting balance (-paymentVal)
    try {
      await dbService.updateUdhaarBalance(selectedCust.id, -paymentVal, ledgerEntry);
    } catch (err) {
      logError("CREDIT", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to record payment"));
      console.error(err);
      return;
    }

    // Refresh selected customer state
    const updatedCust = {
      ...selectedCust,
      balance: selectedCust.balance - paymentVal,
      ledger: [...(selectedCust.ledger || []), ledgerEntry]
    };
    setSelectedCust(updatedCust);
    setPayAmount("");
    alert("Payment of ฿" + paymentVal + " recorded successfully!");
  };

  const getFilteredCustomers = () => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)));
  };

  const getTotalOutstanding = () => {
    return customers.reduce((sum, c) => sum + (c.balance || 0), 0);
  };

  return (
    <div style={styles.container}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={styles.viewTitle}>Credit Accounts</h2>
        {!selectedCust && (
          <button onClick={() => setShowReminders(true)} className="btn btn-outline" style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}>
            📨 Remind
          </button>
        )}
      </div>

      {selectedCust ? (
        /* Detailed Customer Ledger View */
        <div style={styles.card}>
          <div style={styles.backHeader}>
            <button onClick={handleDeselect} style={styles.backBtn}>← Back to List</button>
            <span style={styles.customerNameTitle}>{selectedCust.name}</span>
            <button onClick={() => {
              const store = JSON.parse(localStorage.getItem("pan_store_settings") || "{}");
              const w = window.open("", "_blank", "width=500,height=700");
              const ledger = selectedCust.ledger || [];
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
                <html><head><title>Statement - ${selectedCust.name}</title>
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
                    <div class="info">${selectedCust.name}${selectedCust.phone ? " | "+selectedCust.phone : ""}</div>
                  </div>
                  <table><thead><tr><th>Date</th><th>Type</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th>Description</th></tr></thead>
                  <tbody>${rows}</tbody></table>
                  <div class="total"><span>Outstanding Balance</span><span>฿${(selectedCust.balance || 0).toFixed(2)}</span></div>
                  <script>window.onload=function(){window.print();window.close();}<${""}/script>
                </body></html>
              `); w.document.close();
            }} style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "0.2rem 0.5rem", fontSize: "0.7rem", fontWeight: 600, cursor: "pointer", color: "#475569" }}>🖨️ Statement</button>
          </div>

          <div style={styles.detailGrid}>
            <div style={styles.detailStats}>
              <div style={styles.statBox}>
                <span style={styles.statLabel}>Pending Balance</span>
                <span style={styles.statValueCredit}>฿{(selectedCust.balance || 0).toFixed(2)}</span>
              </div>
              <div style={styles.statBox}>
                <span style={styles.statLabel}>Phone Number</span>
                <span style={styles.statValue}>{selectedCust.phone || "No phone added"}</span>
              </div>
            </div>

            {/* Settle Payment Form */}
            {selectedCust.balance > 0 && (
              <form onSubmit={handleSettlePayment} style={styles.settleForm}>
                <h4>Record Settle Payment</h4>
                <div style={styles.settleInputGroup}>
                  <input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="Enter amount to pay"
                    className="input-field"
                    style={{ flex: 1 }}
                  />
                  <button type="button" onClick={() => setPayAmount(selectedCust.balance.toString())} style={styles.payMaxBtn}>Pay All</button>
                  <button type="submit" className="btn btn-primary" style={{ padding: "0.6rem 1.2rem" }}>Record</button>
                </div>
              </form>
            )}
          </div>

          {/* Ledger History List */}
          <div style={styles.historySection}>
            <h4 style={{ marginBottom: "0.5rem" }}>Ledger History</h4>
            <div style={styles.ledgerList}>
              {(!selectedCust.ledger || selectedCust.ledger.length === 0) ? (
                <div style={styles.emptyHistory}>No transaction history found.</div>
              ) : (
                selectedCust.ledger.map((log, idx) => (
                  <div key={idx} style={styles.ledgerItem}>
                    <div style={styles.ledgerMeta}>
                      <span style={{
                        ...styles.ledgerType,
                        ...(log.type === "Payment" ? styles.typePayment : styles.typePurchase)
                      }}>
                        {log.type}
                      </span>
                      <span style={styles.ledgerDate}>
                        {new Date(log.date).toLocaleString()}
                      </span>
                    </div>
                    <div style={styles.ledgerInfo}>
                      <span style={styles.ledgerDesc}>{log.description}</span>
                      <span style={{
                        ...styles.ledgerAmount,
                        ...(log.type === "Payment" ? styles.amountPayment : styles.amountPurchase)
                      }}>
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
        /* Customers List View */
        <div style={styles.card}>
          <div style={styles.outstandingBanner}>
            <span>Total Shop Outstanding credit:</span>
            <span style={styles.outstandingTotal}>฿{getTotalOutstanding().toFixed(2)}</span>
          </div>

          <input
            type="text"
            placeholder="Search customer by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />

          {loading ? (
            <SkeletonList rows={4} />
          ) : (
            <div style={styles.customerGrid}>
              {getFilteredCustomers().length === 0 ? (
                <div style={styles.emptyList}>No customers found in ledger.</div>
              ) : (
                getFilteredCustomers().map(c => (
                  <div 
                    key={c.id} 
                    onClick={() => handleSelectCustomer(c)}
                    style={styles.customerCard}
                  >
                    <div style={styles.customerCardLeft}>
                      <div style={styles.customerName}>{c.name}</div>
                      <div style={styles.customerPhone}>{c.phone || "No phone"}</div>
                    </div>
                    <div style={styles.customerCardRight}>
                      <div style={styles.custBalLabel}>Due Balance:</div>
                      <div style={{
                        ...styles.custBalVal,
                        ...(c.balance > 0 ? styles.activeDebt : {})
                      }}>
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

const styles = {
  container: {
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  viewTitle: {
    color: "#047857",
    fontSize: "1.25rem",
    fontWeight: 800,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    padding: "1rem",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  backHeader: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    borderBottom: "1px solid #f1f5f9",
    paddingBottom: "0.75rem",
    marginBottom: "1rem",
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#047857",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: "0.85rem",
    padding: "0.35rem",
  },
  customerNameTitle: {
    fontSize: "1.1rem",
    fontWeight: 800,
    color: "#1e293b",
  },
  detailGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    marginBottom: "1.5rem",
  },
  detailStats: {
    display: "flex",
    gap: "0.75rem",
  },
  statBox: {
    flex: 1,
    padding: "0.75rem",
    backgroundColor: "#f8fafc",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    display: "flex",
    flexDirection: "column",
  },
  statLabel: { fontSize: "0.7rem", color: "#64748b", fontWeight: 700 },
  statValue: { fontSize: "0.85rem", fontWeight: 700, color: "#334155", marginTop: "0.25rem" },
  statValueCredit: { fontSize: "1rem", fontWeight: 800, color: "#dc2626", marginTop: "0.25rem" },
  settleForm: { backgroundColor: "#fffbeb", border: "1px solid #fef3c7", borderRadius: "8px", padding: "0.75rem" },
  settleInputGroup: { display: "flex", gap: "0.5rem", marginTop: "0.5rem", alignItems: "center" },
  payMaxBtn: { padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #b45309",
    backgroundColor: "transparent",
    color: "#b45309",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  historySection: {
    borderTop: "1px solid #f1f5f9",
    paddingTop: "1rem",
  },
  ledgerList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    maxHeight: "220px",
    overflowY: "auto",
  },
  emptyHistory: {
    textAlign: "center",
    color: "#94a3b8",
    padding: "1rem 0",
    fontSize: "0.85rem",
  },
  ledgerItem: { backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "0.5rem 0.75rem" },
  ledgerMeta: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" },
  ledgerType: { fontSize: "0.65rem", fontWeight: 700, padding: "2px 6px", borderRadius: "4px" },
  typePayment: { backgroundColor: "#ecfdf5", color: "#065f46" },
  typePurchase: { backgroundColor: "#fef2f2", color: "#991b1b" },
  ledgerDate: { fontSize: "0.65rem", color: "#94a3b8" },
  ledgerInfo: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  ledgerDesc: { fontSize: "0.8rem", color: "#475569" },
  ledgerAmount: { fontWeight: 700, fontSize: "0.85rem" },
  amountPayment: {
    color: "#10b981",
  },
  amountPurchase: {
    color: "#ef4444",
  },
  outstandingBanner: { backgroundColor: "#fef2f2", border: "1px solid #fee2e2", borderRadius: "8px", padding: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700, fontSize: "0.85rem", marginBottom: "1rem", color: "#991b1b" },
  outstandingTotal: { fontSize: "1.1rem", color: "#ef4444", fontWeight: 800 },
  searchInput: { padding: "0.65rem 0.85rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.85rem", width: "100%", outline: "none", marginBottom: "1rem" },
  loading: {
    textAlign: "center",
    padding: "2rem 0",
    color: "#64748b",
  },
  emptyList: {
    textAlign: "center",
    color: "#94a3b8",
    padding: "2rem 0",
    fontSize: "0.9rem",
  },
  customerGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  customerCard: { border: "1px solid #cbd5e1", borderRadius: "8px", padding: "0.75rem", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" },
  customerCardLeft: { display: "flex", flexDirection: "column", gap: "2px" },
  customerName: { fontWeight: 700, fontSize: "0.85rem", color: "#1e293b" },
  customerPhone: { fontSize: "0.75rem", color: "#64748b" },
  customerCardRight: { textAlign: "right" },
  custBalLabel: { fontSize: "0.65rem", color: "#94a3b8" },
  custBalVal: { fontWeight: 800, fontSize: "0.9rem", color: "#475569" },
  activeDebt: { color: "#ef4444" }
};
