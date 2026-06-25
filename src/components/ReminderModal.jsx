import { useState } from "react";
import { getLocalData, setLocalData } from "../db/storage";
import { LS_KEYS } from "../constants";

import ModalPortal from "./ModalPortal";

export default function ReminderModal({ customers, onClose }) {
  const [selected, setSelected] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const store = JSON.parse(localStorage.getItem("pan_store_settings") || "{}");
  const storeName = store.name || "Paan Counter";

  const debtors = customers.filter(c => (c.balance || 0) > 0).sort((a, b) => b.balance - a.balance);

  const toggleCustomer = (id) => {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const selectAll = () => {
    const all = {};
    debtors.forEach(c => { all[c.id] = true; });
    setSelected(all);
  };

  const deselectAll = () => setSelected({});

  const getMessage = (customer) => {
    return `Dear ${customer.name}, you have an outstanding balance of ฿${(customer.balance || 0).toFixed(0)} at ${storeName}. Kindly clear your dues at your earliest convenience. Thank you!`;
  };

  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      alert("Failed to copy. Please select and copy manually.");
    }
  };

  const openLINE = (customer) => {
    const msg = getMessage(customer);
    const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(msg)}`;
    window.open(lineUrl, "_blank");
  };

  const openSMS = (customer) => {
    if (!customer.phone) { alert("No phone number for this customer."); return; }
    const msg = getMessage(customer);
    window.open(`sms:${customer.phone}?body=${encodeURIComponent(msg)}`, "_blank");
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const selectedTotal = debtors.filter(c => selected[c.id]).reduce((sum, c) => sum + (c.balance || 0), 0);

  return (
    <ModalPortal>
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>📨 Send Reminders</h3>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <p style={styles.subtitle}>{debtors.length} customer(s) with outstanding balances</p>

        <div style={styles.bulkActions}>
          <button onClick={selectAll} style={styles.bulkBtn}>Select All</button>
          <button onClick={deselectAll} style={styles.bulkBtn}>Deselect All</button>
          {selectedCount > 0 && <span style={styles.selectedCount}>{selectedCount} selected (฿{selectedTotal.toFixed(0)})</span>}
        </div>

        <div style={styles.list}>
          {debtors.map(c => {
            const isSelected = selected[c.id];
            const lastReminder = getLocalData(LS_KEYS.CUSTOMERS, []).find(x => x.id === c.id)?.lastReminder;
            return (
              <div key={c.id} style={{ ...styles.customerCard, ...(isSelected ? styles.selected : {}) }}>
                <div style={styles.customerInfo}>
                  <label style={styles.checkboxLabel}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleCustomer(c.id)} />
                    <div>
                      <span style={styles.customerName}>{c.name}</span>
                      <span style={styles.customerBalance}>฿{(c.balance || 0).toFixed(0)}</span>
                      {c.phone && <span style={styles.customerPhone}>{c.phone}</span>}
                      {lastReminder && <span style={styles.lastReminder}>Last: {new Date(lastReminder).toLocaleDateString("en-GB")}</span>}
                    </div>
                  </label>
                </div>
                <div style={styles.actions}>
                  {c.phone && (
                    <button onClick={() => openSMS(c)} style={styles.actionBtn} title="Send SMS">
                      💬 SMS
                    </button>
                  )}
                  <button onClick={() => openLINE(c)} style={styles.actionBtn} title="Send LINE">
                      LINE
                  </button>
                  <button onClick={() => copyToClipboard(getMessage(c), c.id)} style={styles.actionBtn} title="Copy message">
                    {copiedId === c.id ? "✓" : "📋 Copy"}
                  </button>
                </div>
                <div style={styles.messagePreview}>
                  <span style={styles.previewLabel}>Message:</span>
                  <span style={styles.previewText}>{getMessage(c)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {selectedCount > 0 && (
          <div style={styles.bulkSendRow}>
            <button
              onClick={() => {
                const msgs = debtors.filter(c => selected[c.id]).map(c => getMessage(c)).join("\n\n---\n\n");
                copyToClipboard(msgs, "bulk");
              }}
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              {copiedId === "bulk" ? "✓ Copied!" : "📋 Copy All Selected"}
            </button>
            <button
              onClick={() => {
                debtors.filter(c => selected[c.id]).forEach(c => {
                  const customers = getLocalData(LS_KEYS.CUSTOMERS, []);
                  const idx = customers.findIndex(x => x.id === c.id);
                  if (idx !== -1) {
                    customers[idx].lastReminder = Date.now();
                    setLocalData(LS_KEYS.CUSTOMERS, customers);
                  }
                });
                alert(`Reminder marked for ${selectedCount} customer(s)!`);
              }}
              className="btn btn-outline"
              style={{ flex: 1 }}
            >
              ✓ Mark Sent
            </button>
          </div>
        )}
      </div>
    </div>
    </ModalPortal>
  );
}

const styles = {
  overlay: {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000, padding: "1rem",
  },
  modal: {
    background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "520px",
    maxHeight: "85vh", display: "flex", flexDirection: "column",
    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
  },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "1.25rem 1.25rem 0",
  },
  title: { fontSize: "1rem", fontWeight: 700, color: "#1e293b", margin: 0 },
  closeBtn: { background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#64748b" },
  subtitle: { fontSize: "0.8rem", color: "#64748b", padding: "0.25rem 1.25rem 0" },
  bulkActions: {
    display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap",
    padding: "0.5rem 1.25rem", borderBottom: "1px solid #f1f5f9",
  },
  bulkBtn: {
    background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px",
    padding: "0.25rem 0.5rem", fontSize: "0.7rem", fontWeight: 600, cursor: "pointer",
    color: "#475569",
  },
  selectedCount: { fontSize: "0.75rem", fontWeight: 600, color: "#047857" },
  list: {
    padding: "0.75rem 1.25rem 1.25rem", overflowY: "auto",
    display: "flex", flexDirection: "column", gap: "0.5rem",
  },
  customerCard: {
    padding: "0.75rem", borderRadius: "10px", border: "1px solid #e2e8f0",
    display: "flex", flexDirection: "column", gap: "0.35rem",
  },
  selected: { borderColor: "#047857", background: "#f0fdf4" },
  customerInfo: {},
  checkboxLabel: {
    display: "flex", alignItems: "flex-start", gap: "0.5rem", cursor: "pointer", fontSize: "0.85rem",
  },
  customerName: { fontWeight: 700, color: "#1e293b", display: "block" },
  customerBalance: { fontWeight: 700, color: "#dc2626", fontSize: "0.9rem" },
  customerPhone: { fontSize: "0.7rem", color: "#64748b", marginLeft: "0.5rem" },
  lastReminder: { fontSize: "0.65rem", color: "#94a3b8", marginLeft: "0.5rem" },
  actions: { display: "flex", gap: "0.25rem", justifyContent: "flex-end" },
  actionBtn: {
    background: "none", border: "1px solid #e2e8f0", borderRadius: "6px",
    padding: "2px 6px", fontSize: "0.65rem", fontWeight: 600, cursor: "pointer",
    color: "#475569",
  },
  messagePreview: {
    background: "#f8fafc", borderRadius: "6px", padding: "0.35rem 0.5rem",
    fontSize: "0.7rem", color: "#64748b", lineHeight: 1.3,
  },
  previewLabel: { fontWeight: 600, color: "#94a3b8" },
  previewText: { marginLeft: "0.25rem" },
  bulkSendRow: {
    display: "flex", gap: "0.5rem", padding: "0.75rem 1.25rem 1.25rem",
    borderTop: "1px solid #f1f5f9",
  },
};
