import { useState, useEffect } from "react";
import { useDBStore } from "../stores/dbStore";
import { dbService } from "../firebase";
import { useConfirmStore } from "../stores/confirmStore";
import { useUIStore } from "../stores/uiStore";
import { hashPin } from "../db/hash";
import { SkeletonList, SkeletonTable } from "./Skeleton";
import BillViewModal from "./BillViewModal";
import ReturnModal from "./ReturnModal";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";
import { logError } from "../db/errorLog";
import { db, isFirebaseEnabled } from "../db/config";
import { writeBatch, doc, collection, onSnapshot } from "firebase/firestore";
import { useLangStore } from "../stores/langStore";

const exportToCSV = (data: any[][], headers: string[], filename: string) => {
  const escapeCSV = (val: any) => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent = "\uFEFF" + [
    headers.map(escapeCSV).join(","), 
    ...data.map(row => row.map(escapeCSV).join(","))
  ].join("\r\n");
  
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const exportToPDF = (title: string, headers: string[], data: any[][]) => {
  const w = window.open("", "_blank", "width=800,height=600");
  if (!w) {
    alert("Popup blocked! Please allow popups to export PDF.");
    return;
  }
  const store = JSON.parse(localStorage.getItem("pan_store_settings") || "{}");
  const tableHeaders = headers.map(h => `<th>${h}</th>`).join("");
  const tableRows = data.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("");
  
  w.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: sans-serif; font-size: 12px; padding: 20px; color: #1e293b; }
          .header { text-align: center; margin-bottom: 20px; }
          .store-name { font-size: 18px; font-weight: 800; color: #047857; }
          .report-title { font-size: 14px; font-weight: 700; margin-top: 5px; }
          .date { font-size: 10px; color: #64748b; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th { background: #f1f5f9; padding: 8px; font-size: 10px; text-transform: uppercase; text-align: left; border-bottom: 2px solid #cbd5e1; }
          td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
          tr:nth-child(even) { background-color: #f8fafc; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="store-name">${store.name || "Paan Counter"}</div>
          <div class="report-title">${title}</div>
          <div class="date">Generated on: ${new Date().toLocaleString()}</div>
        </div>
        <table>
          <thead><tr>${tableHeaders}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        <script>
          window.onload = function() {
            window.print();
            window.close();
          };
        </script>
      </body>
    </html>
  `);
  w.document.close();
};

export default function ReportsView({ initialSubTab, onSubTabChange, user }) {
  const confirm = useConfirmStore((s) => s.confirm);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const lang = useLangStore((s) => s.lang);

  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);

  const paymentModes = useDBStore((s) => s.paymentModes);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const txList = await dbService.getTransactions();
      const prodList = await dbService.getProducts();
      const custList = await dbService.getCustomers();
      setTransactions(txList);
      setProducts(prodList);
      setCustomers(custList);
    } catch (err) {
      logError("TRANSACTION", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to load report data"));
      console.error(err);
    }
    setLoading(false);
  };

  const getSalesTotal = () => transactions.reduce((sum, tx) => sum + (tx.totalAmount || 0), 0);
  const getCostTotal = () => transactions.reduce((sum, tx) => {
    const itemsCost = tx.items.reduce((cs, item) => cs + ((item.costPrice || 0) * item.quantity), 0);
    return sum + itemsCost;
  }, 0);
  const getProfitTotal = () => getSalesTotal() - getCostTotal();
  const getTotalTaxCollected = () => transactions.reduce((sum, tx) => sum + (tx.taxAmount || 0), 0);

  // ── Product-wise Sales ──
  const getProductSales = () => {
    const sales = {};
    transactions.forEach(tx => {
      (tx.items || []).forEach(item => {
        const key = item.realProductId || item.productId;
        if (!sales[key]) {
          const product = products.find(p => p.id === key) || {};
          sales[key] = {
            name: (item.name || "").replace(" (Single)", "").replace(" (Pack)", ""),
            category: product.category || "Unknown",
            qty: 0, revenue: 0, cost: 0,
          };
        }
        sales[key].qty += item.quantity || 0;
        sales[key].revenue += (item.sellingPrice || 0) * (item.quantity || 0);
        sales[key].cost += (item.costPrice || 0) * (item.quantity || 0);
      });
    });
    return Object.values(sales).sort((a, b) => b.revenue - a.revenue);
  };

  // ── Category Analysis ──
  const getCategoryStats = () => {
    const cats = {};
    transactions.forEach(tx => {
      (tx.items || []).forEach(item => {
        const product = products.find(p => (p.id === (item.realProductId || item.productId)));
        const cat = product?.category || "Other";
        if (!cats[cat]) cats[cat] = { revenue: 0, cost: 0, qty: 0 };
        cats[cat].revenue += (item.sellingPrice || 0) * (item.quantity || 0);
        cats[cat].cost += (item.costPrice || 0) * (item.quantity || 0);
        cats[cat].qty += item.quantity || 0;
      });
    });
    return Object.entries(cats).map(([name, data]) => ({ name, ...data }));
  };

  // ── Monthly P&L ──
  const getMonthlyData = () => {
    const months = {};
    transactions.forEach(tx => {
      const d = new Date(tx.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!months[key]) months[key] = { revenue: 0, cost: 0, count: 0 };
      months[key].revenue += tx.totalAmount || 0;
      months[key].cost += tx.items ? tx.items.reduce((s, i) => s + ((i.costPrice || 0) * (i.quantity || 0)), 0) : 0;
      months[key].count += 1;
    });
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([month, data]) => ({ month, ...data }));
  };

  // ── Peak Hours ──
  const getPeakHours = () => {
    const hours = {};
    for (let h = 0; h < 24; h++) hours[h] = { count: 0, revenue: 0 };
    transactions.forEach(tx => {
      const d = new Date(tx.timestamp);
      const h = d.getHours();
      if (hours[h]) {
        hours[h].count += 1;
        hours[h].revenue += tx.totalAmount || 0;
      }
    });
    return Object.entries(hours).map(([hour, data]) => ({ hour: parseInt(hour), label: `${hour}:00`, ...data }));
  };

  // ── Low Stock / Dead Stock ──
  const getLowStockItems = () => {
    return products.filter(p => p.stock <= (p.lowStockLimit || 10)).sort((a, b) => (a.stock / (a.lowStockLimit || 10)) - (b.stock / (b.lowStockLimit || 10)));
  };

  // ── Customer Purchase History ──
  const getCustomerHistory = () => {
    return customers.map(c => {
      const txForCustomer = transactions.filter(tx => tx.customerId === c.id);
      const totalSpent = txForCustomer.reduce((s, tx) => s + (tx.totalAmount || 0), 0);
      return { ...c, visits: txForCustomer.length, totalSpent };
    }).filter(c => c.visits > 0 || c.balance > 0).sort((a, b) => b.totalSpent - a.totalSpent);
  };

  // ── Cash Flow ──
  const getCashFlow = () => {
    const totalSales = getSalesTotal();
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const cashReceived = transactions.filter(tx => tx.paymentMode === "Cash").reduce((s, tx) => s + (tx.totalAmount || 0), 0);
    const promptPay = transactions.filter(tx => tx.paymentMode === "PromptPay").reduce((s, tx) => s + (tx.totalAmount || 0), 0);
    return { totalSales, totalExpenses, cashReceived, promptPay, netCash: cashReceived + promptPay - totalExpenses };
  };

  const getTotalDiscount = () => transactions.reduce((sum, tx) => sum + (tx.discountAmount || 0), 0);

  // ── Existing helpers ──
  const getDailyData = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayStart = new Date(dateStr).getTime();
      const dayEnd = dayStart + 86400000;
      const revenue = transactions.filter(tx => tx.timestamp >= dayStart && tx.timestamp < dayEnd).reduce((s, tx) => s + tx.totalAmount, 0);
      const label = d.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" });
      days.push({ label, revenue, date: dateStr });
    }
    return days;
  };

  const [expenses, setExpenses] = useState([]);
  useEffect(() => {
    if (isFirebaseEnabled && db) {
      const unsub = onSnapshot(collection(db, "expenses"), (snap) => {
        setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (err) => {
        logError("REPORTS_SYNC", "Expenses reports listener error: " + err.message, err.stack);
      });
      return unsub;
    } else {
      dbService.getExpenses().then(setExpenses).catch(console.error);
    }
  }, []);

  const getDailyExpenses = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayStart = new Date(dateStr).getTime();
      const dayEnd = dayStart + 86400000;
      const total = expenses.filter(e => e.date >= dayStart && e.date < dayEnd).reduce((s, e) => s + e.amount, 0);
      days.push(total);
    }
    return days;
  };

  const getPaymentSplit = () => {
    const split = { Cash: 0, PromptPay: 0, "Bank Transfer": 0, Udhaar: 0 };
    transactions.forEach(tx => { if (split[tx.paymentMode] !== undefined) split[tx.paymentMode] += tx.totalAmount; });
    return split;
  };

  const handleVoidTransaction = async (txId) => { const ok = await confirm(`Are you sure you want to void Bill ID: ${txId}?`, { title: "Void Bill", message: "This will restore all items back to stock and reverse customer debt updates.", confirmLabel: "Void Bill", variant: "danger" }); if (ok) { setLoading(true); try { await dbService.deleteTransaction(txId); alert("Transaction voided successfully and inventory restocked!"); await loadData(); } catch (err) { logError("TRANSACTION", err.message, err.stack); alert("Failed to void transaction: " + err.message); } finally { setLoading(false); } } };
  const [editingModeTx, setEditingModeTx] = useState(null);
  const [editingModeVal, setEditingModeVal] = useState("");
  const [viewBillTx, setViewBillTx] = useState(null);
  const [returnTx, setReturnTx] = useState(null);

  const handleEditMode = async (txId) => {
    const ok = await confirm(`Change payment mode to "${editingModeVal}" for Bill ${txId}? COH will be adjusted automatically.`, { title: "Edit Payment Mode", confirmLabel: "Change", variant: "warning" });
    if (!ok) { setEditingModeTx(null); return; }
    try {
      await dbService.updateTransactionPaymentMode(txId, editingModeVal, user?.name || "Admin");
      alert("Payment mode updated and COH adjusted.");
      setEditingModeTx(null);
      await loadData();
    } catch (err) { logError("TRANSACTION", err.message, err.stack); alert("Failed to update: " + err.message); }
  };
  const getStaffStats = () => { const staffSales = {}; transactions.forEach(tx => { const email = tx.cashierEmail || "staff@pan.com"; if (!staffSales[email]) staffSales[email] = { revenue: 0, count: 0 }; staffSales[email].revenue += tx.totalAmount; staffSales[email].count += 1; }); return Object.entries(staffSales).map(([email, stats]) => ({ email, name: email === "admin@pan.com" ? "Owner (Admin)" : "Cashier (Staff)", ...stats })); };

  const paySplit = getPaymentSplit();
  const profitVal = getProfitTotal();
  const staffPerformance = getStaffStats();
  const totalTax = getTotalTaxCollected();
  const productSales = getProductSales();
  const categoryStats = getCategoryStats();
  const monthlyData = getMonthlyData();
  const peakHours = getPeakHours();
  const lowStockItems = getLowStockItems();
  const customerHistory = getCustomerHistory();
  const cashFlow = getCashFlow();
  const dailyData = getDailyData();
  const dailyExp = getDailyExpenses();

  const handleExportOverviewCSV = () => {
    const headers = ["Date", "Revenue (฿)", "Expenses (฿)"];
    const data = dailyData.map((d, i) => [
      d.label,
      d.revenue.toFixed(2),
      (dailyExp[i] || 0).toFixed(2)
    ]);
    exportToCSV(data, headers, `sales_overview_${Date.now()}.csv`);
  };

  const handleExportOverviewPDF = () => {
    const headers = ["Date", "Revenue (฿)", "Expenses (฿)"];
    const data = dailyData.map((d, i) => [
      d.label,
      `฿${d.revenue.toFixed(2)}`,
      `฿${(dailyExp[i] || 0).toFixed(2)}`
    ]);
    exportToPDF("Sales Overview Report", headers, data);
  };

  const handleExportProductsCSV = () => {
    const headers = ["Product Name", "Category", "Quantity Sold", "Revenue (฿)", "Cost (฿)", "Profit (฿)", "Margin"];
    const data = productSales.map(p => {
      const profit = p.revenue - p.cost;
      const margin = p.revenue > 0 ? (profit / p.revenue) * 100 : 0;
      return [
        p.name,
        p.category,
        p.qty,
        p.revenue.toFixed(2),
        p.cost.toFixed(2),
        profit.toFixed(2),
        margin.toFixed(1) + "%"
      ];
    });
    exportToCSV(data, headers, `product_sales_${Date.now()}.csv`);
  };

  const handleExportProductsPDF = () => {
    const headers = ["Product Name", "Category", "Quantity Sold", "Revenue", "Cost", "Profit", "Margin"];
    const data = productSales.map(p => {
      const profit = p.revenue - p.cost;
      const margin = p.revenue > 0 ? (profit / p.revenue) * 100 : 0;
      return [
        p.name,
        p.category,
        p.qty,
        `฿${p.revenue.toFixed(2)}`,
        `฿${p.cost.toFixed(2)}`,
        `฿${profit.toFixed(2)}`,
        margin.toFixed(1) + "%"
      ];
    });
    exportToPDF("Product-wise Sales Report", headers, data);
  };

  const handleExportCustomersCSV = () => {
    const headers = ["Customer Name", "Phone", "Visits", "Total Spent (฿)", "Outstanding Balance (฿)"];
    const data = customerHistory.map(c => [
      c.name,
      c.phone || "—",
      c.visits,
      c.totalSpent.toFixed(2),
      c.balance.toFixed(2)
    ]);
    exportToCSV(data, headers, `customer_history_${Date.now()}.csv`);
  };

  const handleExportCustomersPDF = () => {
    const headers = ["Customer Name", "Phone", "Visits", "Total Spent", "Outstanding Balance"];
    const data = customerHistory.map(c => [
      c.name,
      c.phone || "—",
      c.visits,
      `฿${c.totalSpent.toFixed(2)}`,
      `฿${c.balance.toFixed(2)}`
    ]);
    exportToPDF("Customer Ledger Report", headers, data);
  };

  const handleExportStaffCSV = () => {
    const headers = ["Staff Name", "Email", "Total Bills", "Total Sales (฿)"];
    const data = staffPerformance.map(s => [
      s.name,
      s.email,
      s.count,
      s.revenue.toFixed(2)
    ]);
    exportToCSV(data, headers, `staff_performance_${Date.now()}.csv`);
  };

  const handleExportStaffPDF = () => {
    const headers = ["Staff Name", "Email", "Total Bills", "Total Sales"];
    const data = staffPerformance.map(s => [
      s.name,
      s.email,
      s.count,
      `฿${s.revenue.toFixed(2)}`
    ]);
    exportToPDF("Staff Performance Report", headers, data);
  };

  const handleExportBillsCSV = () => {
    const headers = ["Bill ID", "Date", "Cashier", "Payment Mode", "Total Amount (฿)"];
    const data = transactions.map(tx => [
      tx.id,
      new Date(tx.timestamp).toLocaleString(),
      tx.cashierName || tx.cashierEmail || "System",
      tx.paymentMode,
      tx.totalAmount.toFixed(2)
    ]);
    exportToCSV(data, headers, `recent_bills_${Date.now()}.csv`);
  };

  const handleExportBillsPDF = () => {
    const headers = ["Bill ID", "Date", "Cashier", "Payment Mode", "Total Amount"];
    const data = transactions.map(tx => [
      tx.id,
      new Date(tx.timestamp).toLocaleString(),
      tx.cashierName || tx.cashierEmail || "System",
      tx.paymentMode,
      `฿${tx.totalAmount.toFixed(2)}`
    ]);
    exportToPDF("Recent Bills Report", headers, data);
  };

  const COLORS = ["#047857", "#d97706", "#ef4444", "#2563eb", "#7c3aed", "#db2777", "#0891b2"];
  const PIE_COLORS = ["#10b981", "#f59e0b", "#3b82f6", "#ef4444"];

  const subTabs = [
    { key: "overview", label: "📊 Overview" },
    { key: "products", label: "📦 Products" },
    { key: "customers", label: "👥 Customers" },
    { key: "hours", label: "⏰ Hours" },
    { key: "staff", label: "👤 Staff" },
    { key: "bills", label: "📜 Bills" }
  ];
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab || "overview");

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // ── Helpers for summary stats ──
  const totalQtySold = productSales.reduce((s, p) => s + p.qty, 0);

  return (
    <div style={styles.container}>
      {/* ── Sub-tab Navigation (scrollable) ── */}
      <div className="reports-subtabs" style={styles.subTabs}>
        {subTabs.map(t => (
          <button key={t.key} onClick={() => { setActiveSubTab(t.key); onSubTabChange?.(t.key); }} style={{...styles.subTab, ...(activeSubTab === t.key ? styles.activeSubTab : {})}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════ OVERVIEW ══════════════════════════════════════════════════ */}
      {activeSubTab === "overview" && (
        <>
          <div style={styles.statsGrid} className="stats-grid">
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Total Sales Revenue</span>
              <span style={styles.statValSales}>฿{getSalesTotal().toFixed(2)}</span>
              <span style={styles.statSubText}>{transactions.length} Bills · {totalQtySold} Items sold</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Net Store Profit</span>
              <span style={{...styles.statValProfit, ...(profitVal < 0 ? { color: "#ef4444" } : {})}}>
                ฿{profitVal.toFixed(2)}
              </span>
              <span style={styles.statSubText}>Margin: {getSalesTotal() > 0 ? ((profitVal / getSalesTotal()) * 100).toFixed(1) : 0}%</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Total Expenses</span>
              <span style={{...styles.statValProfit, color: "#dc2626"}}>฿{cashFlow.totalExpenses.toFixed(2)}</span>
              <span style={styles.statSubText}>Net Cash: ฿{cashFlow.netCash.toFixed(2)}</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Total Discounts Given</span>
              <span style={{...styles.statValProfit, color: "#d97706"}}>฿{getTotalDiscount().toFixed(2)}</span>
              <span style={styles.statSubText}>{transactions.filter(tx => tx.discountAmount > 0).length} bills discounted</span>
            </div>
          </div>

          {/* 7-Day Revenue Chart (Recharts) */}
          <div style={styles.reportCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: "700", color: "#1e293b", margin: 0 }}>📈 Last 7 Days Revenue vs Expenses</h3>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <button onClick={handleExportOverviewCSV} className="btn btn-outline btn-sm" style={{ padding: "2px 8px", fontSize: "0.7rem", borderRadius: "4px" }}>CSV</button>
                <button onClick={handleExportOverviewPDF} className="btn btn-outline btn-sm" style={{ padding: "2px 8px", fontSize: "0.7rem", borderRadius: "4px" }}>PDF</button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyData.map((d, i) => ({ ...d, expense: dailyExp[i] || 0 }))}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(val) => `฿${val}`} />
                <Bar dataKey="revenue" fill="#047857" radius={[4, 4, 0, 0]} name="Revenue" />
                <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expense" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly P&L */}
          {monthlyData.length > 0 && (
            <div style={styles.reportCard}>
              <h3 style={styles.cardHeader}>📅 Monthly P&L</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthlyData}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(val) => `฿${val.toFixed(2)}`} />
                  <Bar dataKey="revenue" fill="#047857" radius={[4, 4, 0, 0]} name="Revenue" />
                  <Bar dataKey="cost" fill="#ef4444" radius={[4, 4, 0, 0]} name="Cost" />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ overflowX: "auto", marginTop: "0.5rem" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "0.4rem 0.5rem", borderBottom: "2px solid #e2e8f0", color: "#64748b" }}>Month</th>
                      <th style={{ textAlign: "right", padding: "0.4rem 0.5rem", borderBottom: "2px solid #e2e8f0", color: "#64748b" }}>Bills</th>
                      <th style={{ textAlign: "right", padding: "0.4rem 0.5rem", borderBottom: "2px solid #e2e8f0", color: "#64748b" }}>Revenue</th>
                      <th style={{ textAlign: "right", padding: "0.4rem 0.5rem", borderBottom: "2px solid #e2e8f0", color: "#64748b" }}>Cost</th>
                      <th style={{ textAlign: "right", padding: "0.4rem 0.5rem", borderBottom: "2px solid #e2e8f0", color: "#64748b" }}>Profit</th>
                      <th style={{ textAlign: "right", padding: "0.4rem 0.5rem", borderBottom: "2px solid #e2e8f0", color: "#64748b" }}>Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map(m => {
                      const profit = m.revenue - m.cost;
                      const margin = m.revenue > 0 ? (profit / m.revenue) * 100 : 0;
                      return (
                        <tr key={m.month} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "0.4rem 0.5rem", fontWeight: "bold", color: "#1e293b" }}>{m.month}</td>
                          <td style={{ padding: "0.4rem 0.5rem", textAlign: "right", color: "#64748b" }}>{m.count}</td>
                          <td style={{ padding: "0.4rem 0.5rem", textAlign: "right", fontWeight: "600", color: "#047857" }}>฿{m.revenue.toFixed(2)}</td>
                          <td style={{ padding: "0.4rem 0.5rem", textAlign: "right", color: "#dc2626" }}>฿{m.cost.toFixed(2)}</td>
                          <td style={{ padding: "0.4rem 0.5rem", textAlign: "right", fontWeight: "600", color: profit >= 0 ? "#2563eb" : "#ef4444" }}>฿{profit.toFixed(2)}</td>
                          <td style={{ padding: "0.4rem 0.5rem", textAlign: "right", fontWeight: "600", color: margin >= 0 ? "#047857" : "#ef4444" }}>{margin.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Cash Flow */}
          <div style={styles.reportCard}>
            <h3 style={styles.cardHeader}>💰 Cash Flow Summary</h3>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "120px", padding: "0.75rem", backgroundColor: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                <div style={{ fontSize: "0.7rem", color: "#166534", fontWeight: "600", textTransform: "uppercase" }}>Cash Received</div>
                <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "#15803d" }}>฿{cashFlow.cashReceived.toFixed(2)}</div>
              </div>
              <div style={{ flex: 1, minWidth: "120px", padding: "0.75rem", backgroundColor: "#fefce8", borderRadius: "8px", border: "1px solid #fef08a" }}>
                <div style={{ fontSize: "0.7rem", color: "#a16207", fontWeight: "600", textTransform: "uppercase" }}>PromptPay</div>
                <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "#ca8a04" }}>฿{cashFlow.promptPay.toFixed(2)}</div>
              </div>
              <div style={{ flex: 1, minWidth: "120px", padding: "0.75rem", backgroundColor: "#fef2f2", borderRadius: "8px", border: "1px solid #fecaca" }}>
                <div style={{ fontSize: "0.7rem", color: "#991b1b", fontWeight: "600", textTransform: "uppercase" }}>Expenses</div>
                <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "#dc2626" }}>฿{cashFlow.totalExpenses.toFixed(2)}</div>
              </div>
              <div style={{ flex: 1, minWidth: "120px", padding: "0.75rem", backgroundColor: "#eff6ff", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
                <div style={{ fontSize: "0.7rem", color: "#1e40af", fontWeight: "600", textTransform: "uppercase" }}>Net Cash</div>
                <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "#2563eb" }}>฿{cashFlow.netCash.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Payment Split */}
          <div style={styles.reportCard}>
            <h3 style={styles.cardHeader}>Payment Modes Split</h3>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={[
                    { name: "Cash", value: paySplit.Cash },
                    { name: "PromptPay", value: paySplit["PromptPay"] },
                    { name: "Bank Transfer", value: paySplit["Bank Transfer"] },
                    { name: "Udhaar", value: paySplit.Udhaar },
                  ].filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={35} outerRadius={70} dataKey="value">
                    {[paySplit.Cash, paySplit["PromptPay"], paySplit["Bank Transfer"], paySplit.Udhaar].filter(v => v > 0).map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => `฿${val.toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, minWidth: "120px" }}>
                <div style={styles.splitRow}><span style={styles.splitLabel}>💵 Cash:</span><span style={styles.splitValue}>฿{paySplit.Cash.toFixed(2)}</span></div>
                <div style={styles.splitRow}><span style={styles.splitLabel}>📱 PromptPay:</span><span style={styles.splitValue}>฿{paySplit["PromptPay"].toFixed(2)}</span></div>
                <div style={styles.splitRow}><span style={styles.splitLabel}>🏦 Bank Transfer:</span><span style={styles.splitValue}>฿{paySplit["Bank Transfer"].toFixed(2)}</span></div>
                <div style={styles.splitRow}><span style={styles.splitLabel}>🤝 Udhaar:</span><span style={{...styles.splitValue, color: "#ef4444"}}>฿{paySplit.Udhaar.toFixed(2)}</span></div>
                {totalTax > 0 && <div style={{...styles.splitRow, borderBottom: "none", marginTop: "0.5rem", borderTop: "2px solid #e2e8f0", paddingTop: "0.5rem"}}><span style={styles.splitLabel}>🧾 VAT:</span><span style={{...styles.splitValue, color: "#d97706"}}>฿{totalTax.toFixed(2)}</span></div>}
              </div>
            </div>
          </div>

          {/* Backup */}
          <div style={styles.reportCard}>
            <h3 style={styles.cardHeader}>Database Backup & Restore</h3>
            <p style={{fontSize: "0.8rem", color: "#64748b", marginBottom: "1rem"}}>Download current shop data as a JSON file or import a backup file to restore records.</p>
            <div style={styles.backupActions}>
              <button onClick={handleExportBackup} className="btn btn-outline" style={{flex: 1, padding: "0.5rem"}}>📥 Export Backup</button>
              <label style={{...styles.fileUploadLabel, flex: 1}}>📤 Import Restore<input type="file" accept=".json" onChange={handleImportBackup} style={{display: "none"}} /></label>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════ PRODUCTS ══════════════════════════════════════════════════ */}
      {activeSubTab === "products" && (
        <>
          {lowStockItems.length > 0 && (
            <div style={{...styles.reportCard, borderLeft: "4px solid #ef4444"}}>
              <h3 style={styles.cardHeader}>⚠️ Low Stock Alerts ({lowStockItems.length})</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {lowStockItems.slice(0, 10).map(p => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", padding: "0.3rem 0", borderBottom: "1px solid #f1f5f9" }}>
                    <span style={{ fontWeight: "600", color: "#1e293b" }}>{p.name}</span>
                    <span style={{ color: "#dc2626", fontWeight: "bold" }}>{p.stock} / {p.lowStockLimit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Products Chart */}
          {productSales.length > 0 && (
            <div style={styles.reportCard}>
              <h3 style={styles.cardHeader}>🏆 Top Products by Revenue</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={[...productSales].sort((a, b) => b.revenue - a.revenue).slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={90} />
                  <Tooltip formatter={(val) => `฿${val.toFixed(2)}`} />
                  <Bar dataKey="revenue" fill="#047857" radius={[0, 4, 4, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Product Sales Table */}
          {productSales.length > 0 && (
            <div style={styles.reportCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: "700", color: "#1e293b", margin: 0 }}>📦 Product-wise Sales</h3>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <button onClick={handleExportProductsCSV} className="btn btn-outline btn-sm" style={{ padding: "2px 8px", fontSize: "0.7rem", borderRadius: "4px" }}>CSV</button>
                  <button onClick={handleExportProductsPDF} className="btn btn-outline btn-sm" style={{ padding: "2px 8px", fontSize: "0.7rem", borderRadius: "4px" }}>PDF</button>
                </div>
              </div>
              <div style={{ overflowX: "auto", maxHeight: "320px", overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                  <thead>
                    <tr><th style={{ textAlign: "left", padding: "0.4rem 0.5rem", borderBottom: "2px solid #e2e8f0", color: "#64748b", position: "sticky", top: 0, backgroundColor: "#fff" }}>Product</th><th style={{ textAlign: "right", padding: "0.4rem 0.5rem", borderBottom: "2px solid #e2e8f0", color: "#64748b" }}>Sold</th><th style={{ textAlign: "right", padding: "0.4rem 0.5rem", borderBottom: "2px solid #e2e8f0", color: "#64748b" }}>Revenue</th><th style={{ textAlign: "right", padding: "0.4rem 0.5rem", borderBottom: "2px solid #e2e8f0", color: "#64748b" }}>Cost</th><th style={{ textAlign: "right", padding: "0.4rem 0.5rem", borderBottom: "2px solid #e2e8f0", color: "#64748b" }}>Profit</th><th style={{ textAlign: "right", padding: "0.4rem 0.5rem", borderBottom: "2px solid #e2e8f0", color: "#64748b" }}>Margin</th></tr>
                  </thead>
                  <tbody>
                    {productSales.map(p => {
                      const profit = p.revenue - p.cost;
                      const margin = p.revenue > 0 ? (profit / p.revenue) * 100 : 0;
                      return (
                        <tr key={p.name} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "0.4rem 0.5rem", fontWeight: "600", color: "#1e293b" }}>{p.name}</td>
                          <td style={{ padding: "0.4rem 0.5rem", textAlign: "right", color: "#64748b" }}>{p.qty}</td>
                          <td style={{ padding: "0.4rem 0.5rem", textAlign: "right", fontWeight: "600", color: "#047857" }}>฿{p.revenue.toFixed(2)}</td>
                          <td style={{ padding: "0.4rem 0.5rem", textAlign: "right", color: "#dc2626" }}>฿{p.cost.toFixed(2)}</td>
                          <td style={{ padding: "0.4rem 0.5rem", textAlign: "right", fontWeight: "600", color: profit >= 0 ? "#2563eb" : "#ef4444" }}>฿{profit.toFixed(2)}</td>
                          <td style={{ padding: "0.4rem 0.5rem", textAlign: "right", fontWeight: "600", color: margin >= 15 ? "#047857" : margin >= 0 ? "#d97706" : "#ef4444" }}>{margin.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Category Breakdown */}
          {categoryStats.length > 0 && (
            <div style={styles.reportCard}>
              <h3 style={styles.cardHeader}>🏷️ Category Breakdown</h3>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={categoryStats} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip formatter={(val) => `฿${val.toFixed(2)}`} />
                  <Bar dataKey="revenue" fill="#047857" radius={[0, 4, 4, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
              {categoryStats.map(c => {
                const profit = c.revenue - c.cost;
                const pct = getSalesTotal() > 0 ? (c.revenue / getSalesTotal()) * 100 : 0;
                return (
                  <div key={c.name} style={{ marginBottom: "0.75rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.25rem" }}>
                      <span style={{ fontWeight: "700", color: "#1e293b" }}>{c.name}</span>
                      <span style={{ fontWeight: "700", color: "#047857" }}>฿{c.revenue.toFixed(2)} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div style={{ height: "8px", backgroundColor: "#f1f5f9", borderRadius: "99px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, backgroundColor: "#047857", borderRadius: "99px" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "#64748b", marginTop: "2px" }}>
                      <span>{c.qty} items · Cost: ฿{c.cost.toFixed(2)}</span>
                      <span>Profit: ฿{profit.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════ CUSTOMERS ══════════════════════════════════════════════════ */}
      {activeSubTab === "customers" && (
        <div style={styles.reportCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: "700", color: "#1e293b", margin: 0 }}>👥 Customer Purchase History</h3>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button onClick={handleExportCustomersCSV} className="btn btn-outline btn-sm" style={{ padding: "2px 8px", fontSize: "0.7rem", borderRadius: "4px" }}>CSV</button>
              <button onClick={handleExportCustomersPDF} className="btn btn-outline btn-sm" style={{ padding: "2px 8px", fontSize: "0.7rem", borderRadius: "4px" }}>PDF</button>
            </div>
          </div>
          {customerHistory.length === 0 ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: "1rem" }}>No customer purchase data available.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {customerHistory.map(c => (
                <div key={c.id} style={{ padding: "0.75rem", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: "bold", color: "#1e293b" }}>{c.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{c.phone || "—"} · {c.visits} visits</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "1rem", fontWeight: "800", color: "#047857" }}>฿{c.totalSpent.toFixed(2)}</div>
                      <div style={{ fontSize: "0.7rem", color: c.balance > 0 ? "#dc2626" : "#94a3b8" }}>
                        {c.balance > 0 ? `Due: ฿${c.balance}` : "Settled"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════ PEAK HOURS ══════════════════════════════════════════════════ */}
      {activeSubTab === "hours" && (
          <div style={styles.reportCard}>
            <h3 style={styles.cardHeader}>⏰ Peak Business Hours</h3>
            <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.75rem" }}>
              Hourly transaction count — higher bars mean busier hours.
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={peakHours}>
                <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={2} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(val, name) => [val, name === "count" ? "Bills" : "Revenue"]} />
                <Bar dataKey="count" fill="#047857" radius={[3, 3, 0, 0]} name="Bills" />
              </BarChart>
            </ResponsiveContainer>
          <div style={{ marginTop: "0.75rem", display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
            {(() => {
              const top = [...peakHours].sort((a, b) => b.count - a.count).slice(0, 3).filter(h => h.count > 0);
              return top.map((h, i) => (
                <span key={h.hour} style={{ fontSize: "0.8rem", fontWeight: "600", color: "#047857" }}>
                  🏆 #{i + 1}: {h.label} ({h.count} bills)
                </span>
              ));
            })()}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ STAFF ══════════════════════════════════════════════════ */}
      {activeSubTab === "staff" && (
        <div style={styles.reportCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: "700", color: "#1e293b", margin: 0 }}>👤 Staff Sales Metrics</h3>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button onClick={handleExportStaffCSV} className="btn btn-outline btn-sm" style={{ padding: "2px 8px", fontSize: "0.7rem", borderRadius: "4px" }}>CSV</button>
              <button onClick={handleExportStaffPDF} className="btn btn-outline btn-sm" style={{ padding: "2px 8px", fontSize: "0.7rem", borderRadius: "4px" }}>PDF</button>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {staffPerformance.length === 0 ? (
              <div style={{ textAlign: "center", color: "#94a3b8", padding: "1rem" }}>No staff analytics available.</div>
            ) : (
              staffPerformance.map(staff => (
                <div key={staff.email} style={{ padding: "0.75rem", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #cbd5e1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: "bold", color: "#1e293b" }}>{staff.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{staff.email}</div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "2px" }}>{staff.count} bills generated</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "#047857" }}>฿{staff.revenue.toFixed(2)}</div>
                    <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Total Sales Value</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ BILLS ══════════════════════════════════════════════════ */}
      {activeSubTab === "bills" && (
        <div style={styles.reportCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: "700", color: "#1e293b", margin: 0 }}>📜 Recent Transactions Log</h3>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button onClick={handleExportBillsCSV} className="btn btn-outline btn-sm" style={{ padding: "2px 8px", fontSize: "0.7rem", borderRadius: "4px" }}>CSV</button>
              <button onClick={handleExportBillsPDF} className="btn btn-outline btn-sm" style={{ padding: "2px 8px", fontSize: "0.7rem", borderRadius: "4px" }}>PDF</button>
            </div>
          </div>
          {loading ? <SkeletonTable rows={4} /> : (
            <div style={styles.txLogContainer}>
              {transactions.length === 0 ? (
                <div style={{textAlign: "center", color: "#94a3b8", padding: "1rem"}}>No bills processed yet.</div>
              ) : (
                transactions.map(tx => (
                  <div key={tx.id} style={styles.txRow}>
                    <div style={styles.txRowLeft}>
                      <div style={styles.txId}>Bill ID: {tx.id}</div>
                      <div style={styles.txDate}>{new Date(tx.timestamp).toLocaleString()}</div>
                      <div style={styles.txPaymentMode}>Mode: <b>{tx.paymentMode}</b> | {tx.cashierEmail}</div>
                      <div style={{fontSize: "0.75rem", color: "#475569", marginTop: "4px"}}>Items: {tx.items.map(item => `${item.name} (${item.quantity}x)`).join(", ")}</div>
                      {tx.taxEnabled && <div style={{fontSize: "0.7rem", color: "#d97706", marginTop: "2px", fontWeight: "bold"}}>VAT {tx.taxRate}%: ฿{(tx.taxAmount || 0).toFixed(2)}</div>}
                      {tx.discountAmount > 0 && <div style={{fontSize: "0.7rem", color: "#dc2626", marginTop: "2px", fontWeight: "bold"}}>Discount: {tx.discountType === "percent" ? `${tx.discountValue}%` : `฿${tx.discountValue}`} (-฿{tx.discountAmount.toFixed(2)}){tx.discountReason ? ` · ${tx.discountReason}` : ""}</div>}
                    </div>
                    <div style={styles.txRowRight}>
                      <div style={styles.txTotal}>฿{(tx.totalAmount || 0).toFixed(2)}</div>
                      <div style={{...styles.txQty, marginBottom: "6px"}}>{tx.items.length} items</div>
                      {editingModeTx === tx.id ? (
                        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                          <select value={editingModeVal} onChange={e => setEditingModeVal(e.target.value)} style={{ fontSize: "0.7rem", padding: "2px 4px", borderRadius: "4px", border: "1px solid #cbd5e1", fontFamily: "inherit" }}>
                            <option value="">Change to...</option>
                            {["Cash", "PromptPay", "Bank Transfer", "Udhaar"]
                              .filter(m => m !== tx.paymentMode)
                              .filter(m => m !== "Udhaar" || !!tx.customerId)
                              .map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                          <button onClick={() => handleEditMode(tx.id)} disabled={!editingModeVal} className="btn btn-primary" style={{padding: "2px 6px", fontSize: "0.65rem", borderRadius: "4px"}}>Save</button>
                          <button onClick={() => setEditingModeTx(null)} className="btn btn-outline" style={{padding: "2px 6px", fontSize: "0.65rem", borderRadius: "4px"}}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: "4px", flexDirection: "column" }}>
                          <button onClick={() => setViewBillTx(tx)} className="btn btn-primary" style={{padding: "2px 8px", fontSize: "0.7rem", borderRadius: "4px"}}>View Bill</button>
                          <button onClick={() => setReturnTx(tx)} className="btn btn-secondary" style={{padding: "2px 8px", fontSize: "0.7rem", borderRadius: "4px"}}>Return</button>
                          <button onClick={() => handleVoidTransaction(tx.id)} className="btn btn-danger" style={{padding: "2px 8px", fontSize: "0.7rem", borderRadius: "4px"}}>Void Bill</button>
                          {user?.permissions?.settings && (
                            <button onClick={() => { setEditingModeTx(tx.id); setEditingModeVal(""); }} className="btn btn-outline" style={{padding: "2px 8px", fontSize: "0.7rem", borderRadius: "4px"}}>Edit Mode</button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}



      {viewBillTx && <BillViewModal tx={viewBillTx} onClose={() => setViewBillTx(null)} />}
      {returnTx && <ReturnModal tx={returnTx} onClose={() => setReturnTx(null)} onReturned={loadData} />}
    </div>
  );
}

const styles = {
  container: { padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" },
  viewTitle: { color: "#047857", fontSize: "1.25rem", fontWeight: "bold" },
  statsGrid: { display: "flex", gap: "0.75rem" },
  statCard: { flex: 1, backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #cbd5e1", padding: "1rem", display: "flex", flexDirection: "column", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
  statLabel: { fontSize: "0.75rem", color: "#64748b", fontWeight: "bold" },
  statValSales: { fontSize: "1.25rem", fontWeight: "800", color: "#047857", marginTop: "0.25rem" },
  statValProfit: { fontSize: "1.25rem", fontWeight: "800", color: "#0284c7", marginTop: "0.25rem" },
  statSubText: { fontSize: "0.7rem", color: "#94a3b8", marginTop: "0.25rem" },
  subTabs: { display: "flex", gap: "4px", overflowX: "auto", paddingBottom: "4px", flexShrink: 0, scrollbarWidth: "none" },
  subTab: { flexShrink: 0, padding: "0.5rem 0.75rem", fontSize: "0.8rem", fontWeight: "600", color: "#64748b", background: "#f1f5f9", border: "none", borderRadius: "8px", cursor: "pointer", transition: "all 0.2s ease", whiteSpace: "nowrap" },
  activeSubTab: { backgroundColor: "#047857", color: "#ffffff" },
  reportCard: { backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #cbd5e1", padding: "1rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
  cardHeader: { fontSize: "0.95rem", fontWeight: "700", color: "#1e293b", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem", marginBottom: "0.75rem" },
  splitRow: { display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px dashed #f1f5f9", fontSize: "0.85rem" },
  splitLabel: { color: "#475569", fontWeight: "600" },
  splitValue: { fontWeight: "bold", color: "#0f172a" },
  backupActions: { display: "flex", gap: "0.5rem" },
  fileUploadLabel: { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0.5rem", fontSize: "0.95rem", fontWeight: "600", borderRadius: "8px", border: "1px solid #cbd5e1", cursor: "pointer", backgroundColor: "#ffffff", textAlign: "center" },
  statusRow: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", fontWeight: "bold" },
  txLogContainer: { display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "300px", overflowY: "auto" },
  txRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" },
  txRowLeft: { display: "flex", flexDirection: "column" },
  txId: { fontSize: "0.75rem", fontWeight: "bold", color: "#475569" },
  txDate: { fontSize: "0.65rem", color: "#94a3b8", marginTop: "2px" },
  txPaymentMode: { fontSize: "0.7rem", color: "#64748b" },
  txRowRight: { textAlign: "right" },
  txTotal: { fontSize: "0.95rem", fontWeight: "bold", color: "#047857" },
  txQty: { fontSize: "0.7rem", color: "#94a3b8" },
  chartCard: { backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #cbd5e1", padding: "1rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
  chartContainer: { display: "flex", alignItems: "flex-end", gap: "0.5rem", height: "160px", padding: "0.5rem 0" },
  chartCol: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", height: "100%" },
  chartBars: { flex: 1, display: "flex", alignItems: "flex-end", gap: "3px", width: "100%", justifyContent: "center" },
  chartBar: { width: "12px", borderRadius: "4px 4px 0 0", minHeight: "4px", transition: "height 0.3s ease" },
  chartLabel: { fontSize: "0.6rem", color: "#64748b", fontWeight: "600", textAlign: "center" },
  chartValue: { fontSize: "0.55rem", color: "#94a3b8", textAlign: "center" },
};
