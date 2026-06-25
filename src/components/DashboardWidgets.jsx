import { useState, useEffect } from "react";
import { getLocalTransactions, getLocalData } from "../db/storage";
import { LS_KEYS, DEFAULT_PRODUCTS } from "../constants";

export default function DashboardWidgets({ onNavigate }) {
  const [widgets, setWidgets] = useState({
    todaySales: 0,
    todayCount: 0,
    pendingKhata: 0,
    lowStock: 0,
  });

  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener("stock-changed", h);
    window.addEventListener("hashchange", h);
    return () => {
      window.removeEventListener("stock-changed", h);
      window.removeEventListener("hashchange", h);
    };
  }, []);

  const refresh = () => {
    const transactions = getLocalTransactions();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTx = transactions.filter(t => t.timestamp >= today.getTime());
    const sales = todayTx.reduce((sum, t) => t.paymentMode !== "Udhaar" ? sum + (t.totalAmount || 0) : sum, 0);

    const customers = getLocalData(LS_KEYS.CUSTOMERS, []);
    const khataDue = customers.reduce((sum, c) => sum + (c.balance || 0), 0);

    const products = getLocalData(LS_KEYS.PRODUCTS, null) || DEFAULT_PRODUCTS;
    const low = products.filter(p => p.stock <= p.lowStockLimit).length;

    setWidgets({ todaySales: sales, todayCount: todayTx.length, pendingKhata: khataDue, lowStock: low });
  };

  const items = [
    { label: "Today's Sales", value: `฿${widgets.todaySales.toFixed(0)}`, color: "#047857", bg: "#f0fdf4", icon: "💰" },
    { label: "Bills Today", value: widgets.todayCount.toString(), color: "#2563eb", bg: "#eff6ff", icon: "🧾" },
    { label: "Khata Due", value: `฿${widgets.pendingKhata.toFixed(0)}`, color: "#dc2626", bg: "#fef2f2", icon: "📋" },
    { label: "Low Stock", value: widgets.lowStock.toString(), color: "#ea580c", bg: "#fff7ed", icon: "📦", onClick: () => onNavigate?.("inventory"), clickable: true },
  ];

  return (
    <div style={styles.grid}>
      {items.map((item, i) => (
        <div
          key={i}
          style={{ ...styles.card, backgroundColor: item.bg, cursor: item.clickable ? "pointer" : "default" }}
          onClick={item.onClick}
        >
          <div style={styles.top}>
            <span style={styles.icon}>{item.icon}</span>
            {item.clickable && <span style={styles.linkHint}>›</span>}
          </div>
          <span style={{ ...styles.value, color: item.color }}>{item.value}</span>
          <span style={styles.label}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

const styles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "0.5rem",
  },
  card: {
    borderRadius: "12px",
    padding: "0.65rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.15rem",
    border: "1px solid #e2e8f0",
  },
  top: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  icon: {
    fontSize: "0.9rem",
  },
  linkHint: {
    fontSize: "0.85rem",
    color: "#94a3b8",
    fontWeight: 700,
  },
  value: {
    fontSize: "1.1rem",
    fontWeight: 800,
    lineHeight: 1.2,
  },
  label: {
    fontSize: "0.65rem",
    fontWeight: 600,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
};
