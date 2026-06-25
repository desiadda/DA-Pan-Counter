import { useState, useEffect } from "react";
import { getPriceHistory } from "../db/priceHistory";

import ModalPortal from "./ModalPortal";

export default function PriceHistoryModal({ product, onClose }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (product) setHistory(getPriceHistory(product.id));
  }, [product]);

  if (!product) return null;

  const fieldLabels = {
    costPrice: "Cost Price",
    sellingPrice: "Selling Price",
    costPricePack: "Box Cost Price",
    sellingPricePack: "Box Selling Price",
  };

  return (
    <ModalPortal>
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>Price History: {product.name}</h3>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>
        <div style={styles.currentPrices}>
          <span>Current: ฿{product.sellingPrice} {product.isCigarette ? `/ ฿${product.sellingPricePack} (box)` : ""}</span>
          <span style={styles.cost}>Cost: ฿{product.costPrice} {product.isCigarette ? `/ ฿${product.costPricePack} (box)` : ""}</span>
        </div>
        {history.length === 0 ? (
          <p style={styles.empty}>No price changes recorded yet.</p>
        ) : (
          <div style={styles.list}>
            {history.map(h => (
              <div key={h.id} style={styles.item}>
                <div style={styles.itemHeader}>
                  <span style={styles.field}>{fieldLabels[h.field] || h.field}</span>
                  <span style={styles.date}>{new Date(h.timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div style={styles.change}>
                  <span style={styles.oldValue}>฿{h.oldValue}</span>
                  <span style={styles.arrow}>→</span>
                  <span style={styles.newValue}>฿{h.newValue}</span>
                </div>
                <span style={styles.by}>by {h.userName}</span>
              </div>
            ))}
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
    background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "480px",
    maxHeight: "80vh", display: "flex", flexDirection: "column",
    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", animation: "slideUp 0.3s ease-out",
  },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "1.25rem 1.25rem 0",
  },
  title: { fontSize: "1rem", fontWeight: 700, color: "#1e293b", margin: 0 },
  closeBtn: {
    background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer",
    color: "#64748b", padding: "0.25rem",
  },
  currentPrices: {
    display: "flex", gap: "1rem", padding: "0.5rem 1.25rem",
    fontSize: "0.85rem", color: "#047857", fontWeight: 600, flexWrap: "wrap",
  },
  cost: { color: "#64748b", fontWeight: 500 },
  list: {
    padding: "0.75rem 1.25rem 1.25rem", overflowY: "auto",
    display: "flex", flexDirection: "column", gap: "0.5rem",
  },
  item: {
    padding: "0.75rem", borderRadius: "10px", border: "1px solid #e2e8f0",
    display: "flex", flexDirection: "column", gap: "0.25rem",
  },
  itemHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  field: { fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" },
  date: { fontSize: "0.7rem", color: "#94a3b8" },
  change: { display: "flex", alignItems: "center", gap: "0.5rem" },
  oldValue: {
    fontSize: "0.95rem", color: "#ef4444", fontWeight: 600,
    textDecoration: "line-through",
  },
  arrow: { fontSize: "0.8rem", color: "#94a3b8" },
  newValue: { fontSize: "0.95rem", color: "#047857", fontWeight: 700 },
  by: { fontSize: "0.7rem", color: "#94a3b8" },
  empty: {
    padding: "1.25rem", textAlign: "center", color: "#94a3b8", fontSize: "0.9rem",
  },
};
