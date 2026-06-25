import { useState } from "react";
import { dbService } from "../firebase";

export default function ReturnModal({ tx, onClose, onReturned }) {
  const [returnQtys, setReturnQtys] = useState({});
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const updateQty = (itemId, val) => {
    const num = parseInt(val) || 0;
    setReturnQtys(prev => ({ ...prev, [itemId]: Math.max(0, Math.min(num, getMaxQty(itemId))) }));
  };

  const getMaxQty = (itemId) => {
    const item = tx.items?.find(i => i.productId === itemId);
    return item ? item.quantity : 0;
  };

  const returnItems = tx.items?.filter(i => (returnQtys[i.productId] || 0) > 0).map(i => ({
    ...i,
    returnQty: returnQtys[i.productId],
  })) || [];

  const returnAmount = returnItems.reduce((sum, i) => sum + (i.sellingPrice * i.returnQty), 0);

  const handleReturn = async () => {
    if (returnItems.length === 0) { alert("Select at least one item to return."); return; }
    setProcessing(true);
    try {
      const user = JSON.parse(localStorage.getItem("pan_user") || "{}");
      await dbService.returnTransaction(tx, returnItems, reason || "Customer return", user.id, user.name);
      alert(`Return processed! Refund amount: ฿${returnAmount.toFixed(2)}`);
      onReturned?.();
      onClose();
    } catch (err) {
      alert(err.message || "Return failed");
    }
    setProcessing(false);
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>🔄 Return Items</h3>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>
        <p style={styles.billId}>Bill: #{tx.id?.replace("tx_", "").slice(-8)}</p>

        <div style={styles.itemList}>
          {tx.items?.map(item => {
            const qty = returnQtys[item.productId] || 0;
            return (
              <div key={item.productId} style={styles.itemRow}>
                <div style={styles.itemInfo}>
                  <span style={styles.itemName}>{item.name}</span>
                  <span style={styles.itemMeta}>฿{item.sellingPrice} × {item.quantity}</span>
                </div>
                <div style={styles.qtyControl}>
                  <button onClick={() => updateQty(item.productId, qty - 1)} style={styles.qtyBtn}>−</button>
                  <input type="number" value={qty} onChange={(e) => updateQty(item.productId, e.target.value)} style={styles.qtyInput} min="0" max={item.quantity} />
                  <button onClick={() => updateQty(item.productId, qty + 1)} style={styles.qtyBtn}>+</button>
                </div>
              </div>
            );
          })}
        </div>

        <input
          type="text" value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Return reason (optional)" style={styles.reasonInput}
        />

        <div style={styles.totalRow}>
          <span>Refund Total</span>
          <span style={styles.totalAmount}>฿{returnAmount.toFixed(2)}</span>
        </div>

        <div style={styles.actions}>
          <button onClick={onClose} className="btn btn-outline" style={{ flex: 1 }}>Cancel</button>
          <button onClick={handleReturn} disabled={processing || returnItems.length === 0} className="btn btn-danger" style={{ flex: 1 }}>
            {processing ? "Processing..." : "🔄 Process Return"}
          </button>
        </div>
      </div>
    </div>
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
    background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "440px",
    padding: "1.25rem", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" },
  title: { fontSize: "1rem", fontWeight: 700, color: "#1e293b", margin: 0 },
  closeBtn: { background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#64748b" },
  billId: { fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.75rem" },
  itemList: { display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.75rem" },
  itemRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "0.5rem", borderRadius: "8px", border: "1px solid #e2e8f0",
  },
  itemInfo: { display: "flex", flexDirection: "column" },
  itemName: { fontSize: "0.85rem", fontWeight: 600, color: "#1e293b" },
  itemMeta: { fontSize: "0.7rem", color: "#94a3b8" },
  qtyControl: { display: "flex", alignItems: "center", gap: "0.25rem" },
  qtyBtn: {
    width: "28px", height: "28px", borderRadius: "6px", border: "1px solid #e2e8f0",
    background: "#f8fafc", fontSize: "1rem", fontWeight: 700, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  qtyInput: {
    width: "48px", textAlign: "center", padding: "0.3rem", borderRadius: "6px",
    border: "1px solid #e2e8f0", fontSize: "0.85rem", fontWeight: 700,
  },
  reasonInput: {
    width: "100%", padding: "0.6rem 0.75rem", borderRadius: "8px",
    border: "1px solid #e2e8f0", fontSize: "0.85rem", marginBottom: "0.75rem",
  },
  totalRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "0.5rem 0", borderTop: "1px solid #e2e8f0", marginBottom: "0.75rem",
    fontSize: "0.95rem", fontWeight: 600, color: "#475569",
  },
  totalAmount: { fontSize: "1.1rem", fontWeight: 800, color: "#dc2626" },
  actions: { display: "flex", gap: "0.5rem" },
};
