import { useState, useEffect, useMemo } from "react";
import { useDBStore } from "../stores/dbStore";
import { dbService } from "../firebase";
import { useConfirmStore } from "../stores/confirmStore";
import { useUIStore } from "../stores/uiStore";
import { useLangStore } from "../stores/langStore";
import { hashPin } from "../db/hash";
import { SkeletonList, SkeletonTable } from "./Skeleton";
import BillViewModal from "./BillViewModal";
import ReturnModal from "./ReturnModal";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";
import { logError } from "../db/errorLog";
import { db, isFirebaseEnabled } from "../db/config";
import { writeBatch, doc, collection, onSnapshot } from "firebase/firestore";
import { getUsers } from "../db/auth";
import { DEFAULT_LOW_STOCK_LIMIT, DEAD_STOCK_DAYS, GOOD_MARGIN_PCT, DEFAULT_STORE_NAME, PAYMENT_MODES, UDHAAR_MODE } from "../constants";

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
          <div class="store-name">${store.name || DEFAULT_STORE_NAME}</div>
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

const COLORS = ["#047857", "#d97706", "#ef4444", "#2563eb", "#7c3aed", "#db2777", "#0891b2", "#65a30d"];
const PIE_COLORS = ["#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

export default function ReportsView({ initialSubTab, onSubTabChange, user }) {
  const confirm = useConfirmStore((s) => s.confirm);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const lang = useLangStore((s) => s.lang);

  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(false);

  const paymentModes = useDBStore((s) => s.paymentModes);

  // ── Global period filter ──
  const [period, setPeriod] = useState("all"); // all | today | yesterday | 7d | 30d | month | custom
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

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
      try { setStaffList(getUsers()); } catch (err) { setStaffList([]); }
    } catch (err) {
      logError("TRANSACTION", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to load report data"));
      console.error(err);
    }
    setLoading(false);
  };

  const getDayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };

  const inPeriod = (ts) => {
    if (!ts) return false;
    if (period === "all") return true;
    if (period === "today") return ts >= getDayStart(new Date());
    if (period === "yesterday") {
      const y = new Date(); y.setDate(y.getDate() - 1);
      return ts >= getDayStart(y) && ts < getDayStart(new Date());
    }
    if (period === "7d") { const d = new Date(); d.setDate(d.getDate() - 6); return ts >= getDayStart(d); }
    if (period === "30d") { const d = new Date(); d.setDate(d.getDate() - 29); return ts >= getDayStart(d); }
    if (period === "month") { const d = new Date(); d.setDate(1); return ts >= getDayStart(d); }
    if (period === "custom") {
      const from = customFrom ? getDayStart(new Date(customFrom + "T00:00:00")) : 0;
      const to = customTo ? new Date(customTo + "T23:59:59").getTime() : Infinity;
      return ts >= from && ts <= to;
    }
    return true;
  };

  const filteredTxs = useMemo(() => transactions.filter(tx => inPeriod(tx.timestamp)), [transactions, period, customFrom, customTo]);
  const salesTxs = useMemo(() => filteredTxs.filter(tx => tx.type !== "return"), [filteredTxs]);
  const returnTxs = useMemo(() => filteredTxs.filter(tx => tx.type === "return"), [filteredTxs]);

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
  const filteredExpenses = useMemo(() => expenses.filter(e => inPeriod(e.date || e.timestamp)), [expenses, period, customFrom, customTo]);

  // ══════════════════ Core financial helpers ══════════════════
  const getSalesTotal = () => salesTxs.reduce((sum, tx) => sum + (tx.totalAmount || 0), 0);
  const getReturnsTotal = () => returnTxs.reduce((sum, tx) => sum + (tx.returnAmount || 0), 0);
  const getCostTotal = () => salesTxs.reduce((sum, tx) => {
    const itemsCost = (tx.items || []).reduce((cs, item) => cs + ((item.costPrice || 0) * (item.quantity || 0)), 0);
    return sum + itemsCost;
  }, 0);
  const getItemDiscountTotal = () => salesTxs.reduce((sum, tx) => {
    const items = tx.items || [];
    return sum + items.reduce((s, item) => {
      const lineTotal = (item.isPack ? item.sellingPricePack || item.sellingPrice : item.sellingPrice) * (item.quantity || 1);
      if (item.discountType === "percent") return s + lineTotal * Math.min(item.discountValue || 0, 100) / 100;
      if (item.discountType === "fixed") return s + Math.min(item.discountValue || 0, lineTotal);
      return s;
    }, 0);
  }, 0);
  const getBillDiscountTotal = () => salesTxs.reduce((sum, tx) => sum + (tx.discountAmount || 0), 0);
  const getDiscountsTotal = () => getBillDiscountTotal() + getItemDiscountTotal();
  const getTotalTaxCollected = () => salesTxs.reduce((sum, tx) => sum + (tx.taxAmount || 0), 0);
  const getExpenseTotal = () => filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const getNetRevenue = () => getSalesTotal() - getReturnsTotal() - getDiscountsTotal();
  const getGrossProfit = () => getNetRevenue() - getCostTotal();
  const getNetProfit = () => getGrossProfit() - getExpenseTotal();

  // ── Product-wise Sales ──
  const getProductSales = (txs = salesTxs) => {
    const sales = {};
    txs.forEach(tx => {
      (tx.items || []).forEach(item => {
        const key = item.realProductId || item.productId;
        if (!sales[key]) {
          const product = products.find(p => p.id === key) || {};
          sales[key] = {
            name: (item.name || "").replace(" (Single)", "").replace(" (Pack)", ""),
            category: product.category || "Unknown",
            qty: 0, revenue: 0, cost: 0, discount: 0,
          };
        }
        const lineTotal = (item.sellingPrice || 0) * (item.quantity || 0);
        let lineDisc = 0;
        if (item.discountType === "percent") lineDisc = lineTotal * Math.min(item.discountValue || 0, 100) / 100;
        else if (item.discountType === "fixed") lineDisc = Math.min(item.discountValue || 0, lineTotal);
        sales[key].qty += item.quantity || 0;
        sales[key].revenue += lineTotal;
        sales[key].discount += lineDisc;
        sales[key].cost += (item.costPrice || 0) * (item.quantity || 0);
      });
    });
    return Object.values(sales).sort((a, b) => b.revenue - a.revenue);
  };

  // ── Category Analysis ──
  const getCategoryStats = (txs = salesTxs) => {
    const cats = {};
    txs.forEach(tx => {
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
  const getMonthlyData = (txs = salesTxs) => {
    const months = {};
    txs.forEach(tx => {
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
  const getPeakHours = (txs = salesTxs) => {
    const hours = {};
    for (let h = 0; h < 24; h++) hours[h] = { count: 0, revenue: 0 };
    txs.forEach(tx => {
      const d = new Date(tx.timestamp);
      const h = d.getHours();
      if (hours[h]) {
        hours[h].count += 1;
        hours[h].revenue += tx.totalAmount || 0;
      }
    });
    return Object.entries(hours).map(([hour, data]) => ({ hour: parseInt(hour), label: `${hour}:00`, ...data }));
  };

  // ── Weekday Analysis ──
  const getWeekdayStats = (txs = salesTxs) => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const stats = days.map(name => ({ name, count: 0, revenue: 0 }));
    txs.forEach(tx => {
      const d = new Date(tx.timestamp);
      stats[d.getDay()].count += 1;
      stats[d.getDay()].revenue += tx.totalAmount || 0;
    });
    return stats;
  };

  // ── Low Stock / Dead Stock / Valuation ──
  const getLowStockItems = () => {
    return products
      .filter(p => !(p.isNonInventory || p.stock >= 9999) && p.stock <= (p.lowStockLimit || DEFAULT_LOW_STOCK_LIMIT))
      .sort((a, b) => (a.stock / (a.lowStockLimit || DEFAULT_LOW_STOCK_LIMIT)) - (b.stock / (b.lowStockLimit || DEFAULT_LOW_STOCK_LIMIT)));
  };

  const getDeadStockItems = () => {
    const cutoff = Date.now() - DEAD_STOCK_DAYS * 86400000;
    const soldIds = new Set();
    transactions.forEach(tx => {
      if (tx.timestamp >= cutoff) (tx.items || []).forEach(i => soldIds.add(i.realProductId || i.productId));
    });
    return products
      .filter(p => !(p.isNonInventory || p.stock >= 9999) && !soldIds.has(p.id) && p.stock > 0)
      .sort((a, b) => (a.stock * (a.costPrice || 0)) - (b.stock * (b.costPrice || 0)));
  };

  const getStockValuation = () => products
    .filter(p => !(p.isNonInventory || p.stock >= 9999))
    .reduce((s, p) => s + (p.stock || 0) * (p.costPrice || 0), 0);

  // ── Customer Purchase History ──
  const getCustomerHistory = () => {
    return (customers || []).map(c => {
      const txForCustomer = (transactions || []).filter(tx => tx.customerId === c.id && tx.type !== "return");
      const totalSpent = txForCustomer.reduce((s, tx) => s + (tx.totalAmount || 0), 0);
      const lastPurchase = txForCustomer.reduce((max, tx) => Math.max(max, tx.timestamp || 0), 0);
      return { ...c, visits: txForCustomer.length, totalSpent, lastPurchase };
    }).filter(c => c.visits > 0 || c.balance > 0).sort((a, b) => b.totalSpent - a.totalSpent);
  };

  // ── Cash Flow ──
  const getCashFlow = () => {
    const totalSales = getSalesTotal();
    const cashReceived = salesTxs.filter(tx => tx.paymentMode === "Cash").reduce((s, tx) => s + (tx.totalAmount || 0), 0);
    const others = salesTxs.filter(tx => tx.paymentMode !== "Cash").reduce((s, tx) => s + (tx.totalAmount || 0), 0);
    return { totalSales, totalExpenses: getExpenseTotal(), cashReceived, others, netCash: cashReceived - getExpenseTotal() };
  };

  // ── Daily Register ──
  const getDailyRegister = () => {
    const days = {};
    salesTxs.forEach(tx => {
      const d = new Date(tx.timestamp);
      const key = d.toLocaleDateString("en-CA");
      if (!days[key]) days[key] = { date: key, bills: 0, gross: 0, discounts: 0, tax: 0, net: 0, returns: 0, expenses: 0 };
      days[key].bills += 1;
      days[key].gross += tx.totalAmount || 0;
      days[key].discounts += (tx.discountAmount || 0);
      days[key].tax += tx.taxAmount || 0;
    });
    returnTxs.forEach(tx => {
      const d = new Date(tx.timestamp);
      const key = d.toLocaleDateString("en-CA");
      if (!days[key]) days[key] = { date: key, bills: 0, gross: 0, discounts: 0, tax: 0, net: 0, returns: 0, expenses: 0 };
      days[key].returns += tx.returnAmount || 0;
    });
    filteredExpenses.forEach(e => {
      const d = new Date(e.date || e.timestamp);
      const key = d.toLocaleDateString("en-CA");
      if (!days[key]) days[key] = { date: key, bills: 0, gross: 0, discounts: 0, tax: 0, net: 0, returns: 0, expenses: 0 };
      days[key].expenses += e.amount || 0;
    });
    Object.values(days).forEach(day => { day.net = day.gross - day.discounts - day.returns - day.expenses; });
    return Object.values(days).sort((a, b) => b.date.localeCompare(a.date));
  };

  // ── Expenses by category ──
  const getExpenseByCategory = () => {
    const cats = {};
    filteredExpenses.forEach(e => {
      const c = e.category || "Other";
      if (!cats[c]) cats[c] = { count: 0, amount: 0 };
      cats[c].count += 1;
      cats[c].amount += e.amount || 0;
    });
    return Object.entries(cats).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.amount - a.amount);
  };

  // ── Payment Split (dynamic) ──
  const getPaymentSplit = () => {
    const split = {};
    salesTxs.forEach(tx => { const m = tx.paymentMode || "Other"; split[m] = (split[m] || 0) + (tx.totalAmount || 0); });
    return split;
  };

  // ── Staff ──
  const getStaffStats = () => {
    const staffSales = {};
    salesTxs.forEach(tx => {
      const name = tx.cashierName || tx.cashierEmail || "Unknown";
      if (!staffSales[name]) staffSales[name] = { revenue: 0, count: 0, returns: 0, discounts: 0 };
      staffSales[name].revenue += tx.totalAmount || 0;
      staffSales[name].count += 1;
      staffSales[name].discounts += (tx.discountAmount || 0);
    });
    returnTxs.forEach(tx => {
      const name = tx.cashierName || tx.cashierEmail || "Unknown";
      if (staffSales[name]) staffSales[name].returns += tx.returnAmount || 0;
    });
    return Object.entries(staffSales).map(([name, stats]) => ({ name, ...stats })).sort((a, b) => b.revenue - a.revenue);
  };

  // ── Tax report rows ──
  const getTaxRows = () => salesTxs.filter(tx => tx.taxAmount > 0);

  const handleVoidTransaction = async (txId) => { const ok = await confirm(`Are you sure you want to void Bill ID: ${txId}?`, { title: "Void Bill", message: "This will restore all items back to stock and reverse customer debt updates.", confirmLabel: "Void Bill", variant: "danger" }); if (ok) { setLoading(true); try { const u = JSON.parse(localStorage.getItem("pan_user") || "{}"); await dbService.deleteTransaction(txId, u.name || "System"); alert("Transaction voided successfully and inventory restocked!"); await loadData(); } catch (err) { logError("TRANSACTION", err.message, err.stack); alert("Failed to void transaction: " + err.message); } finally { setLoading(false); } } };
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

  const profitVal = getNetProfit();
  const grossProfitVal = getGrossProfit();
  const staffPerformance = getStaffStats();
  const totalTax = getTotalTaxCollected();
  const productSales = getProductSales();
  const categoryStats = getCategoryStats();
  const monthlyData = getMonthlyData();
  const peakHours = getPeakHours();
  const weekdayStats = getWeekdayStats();
  const lowStockItems = getLowStockItems();
  const deadStockItems = getDeadStockItems();
  const customerHistory = getCustomerHistory();
  const cashFlow = getCashFlow();
  const dailyData = getDailyRegister();
  const expenseCats = getExpenseByCategory();
  const paySplit = getPaymentSplit();
  const allPayModes = Object.keys(paySplit).filter(k => paySplit[k] > 0);
  const editModeOptions = [...new Set([...(paymentModes || []).map(m => m.name || m), ...allPayModes, ...PAYMENT_MODES])];
  const totalQtySold = productSales.reduce((s, p) => s + p.qty, 0);

  const periodLabel = () => {
    if (period === "today") return "Today";
    if (period === "yesterday") return "Yesterday";
    if (period === "7d") return "Last 7 days";
    if (period === "30d") return "Last 30 days";
    if (period === "month") return "This month";
    if (period === "custom") return `${customFrom || "start"} → ${customTo || "now"}`;
    return "All time";
  };

  const handleExportOverviewCSV = () => {
    const headers = ["Date", "Revenue (฿)", "Discounts (฿)", "Returns (฿)", "Expenses (฿)", "Net (฿)"];
    const data = dailyData.map(d => [
      d.date, d.gross.toFixed(2), d.discounts.toFixed(2), d.returns.toFixed(2), d.expenses.toFixed(2), d.net.toFixed(2)
    ]);
    exportToCSV(data, headers, `sales_overview_${Date.now()}.csv`);
  };

  const handleExportOverviewPDF = () => {
    const headers = ["Date", "Revenue", "Discounts", "Returns", "Expenses", "Net"];
    const data = dailyData.map(d => [
      d.date, `฿${d.gross.toFixed(2)}`, `฿${d.discounts.toFixed(2)}`, `฿${d.returns.toFixed(2)}`, `฿${d.expenses.toFixed(2)}`, `฿${d.net.toFixed(2)}`
    ]);
    exportToPDF("Daily Sales Register", headers, data);
  };

  const handleExportPLCSV = () => {
    const headers = ["Item", "Amount (฿)"];
    const data = [
      ["Gross Revenue (Sales)", getSalesTotal().toFixed(2)],
      ["Less: Returns", `-${getReturnsTotal().toFixed(2)}`],
      ["Less: Discounts", `-${getDiscountsTotal().toFixed(2)}`],
      ["Net Revenue", getNetRevenue().toFixed(2)],
      ["Less: Cost of Goods Sold", `-${getCostTotal().toFixed(2)}`],
      ["Gross Profit", getGrossProfit().toFixed(2)],
      ...expenseCats.map(c => [`Less: Expense — ${c.name}`, `-${c.amount.toFixed(2)}`]),
      ["Less: Total Expenses", `-${getExpenseTotal().toFixed(2)}`],
      ["Net Operating Profit", getNetProfit().toFixed(2)],
    ];
    exportToCSV(data, headers, `profit_loss_${Date.now()}.csv`);
  };

  const handleExportPLPDF = () => {
    const headers = ["Item", "Amount"];
    const data = [
      ["Gross Revenue (Sales)", `฿${getSalesTotal().toFixed(2)}`],
      ["Less: Returns", `-฿${getReturnsTotal().toFixed(2)}`],
      ["Less: Discounts", `-฿${getDiscountsTotal().toFixed(2)}`],
      ["Net Revenue", `฿${getNetRevenue().toFixed(2)}`],
      ["Less: Cost of Goods Sold", `-฿${getCostTotal().toFixed(2)}`],
      ["Gross Profit", `฿${getGrossProfit().toFixed(2)}`],
      ...expenseCats.map(c => [`Less: Expense — ${c.name}`, `-฿${c.amount.toFixed(2)}`]),
      ["Less: Total Expenses", `-฿${getExpenseTotal().toFixed(2)}`],
      ["Net Operating Profit", `฿${getNetProfit().toFixed(2)}`],
    ];
    exportToPDF("Profit & Loss Statement", headers, data);
  };

  const handleExportExpensesCSV = () => {
    const headers = ["Category", "Count", "Amount (฿)", "Share (%)"];
    const total = getExpenseTotal();
    const data = expenseCats.map(c => [c.name, c.count, c.amount.toFixed(2), total > 0 ? ((c.amount / total) * 100).toFixed(1) + "%" : "0%"]);
    exportToCSV(data, headers, `expenses_by_category_${Date.now()}.csv`);
  };

  const handleExportExpensesPDF = () => {
    const headers = ["Category", "Count", "Amount", "Share"];
    const total = getExpenseTotal();
    const data = expenseCats.map(c => [c.name, c.count, `฿${c.amount.toFixed(2)}`, total > 0 ? ((c.amount / total) * 100).toFixed(1) + "%" : "0%"]);
    exportToPDF("Expense Report by Category", headers, data);
  };

  const handleExportReturnsCSV = () => {
    const headers = ["Return ID", "Original Bill", "Date", "Cashier", "Amount (฿)", "Items", "Reason"];
    const data = returnTxs.map(tx => [
      tx.id, tx.originalBillId || "—", new Date(tx.timestamp).toLocaleString(), tx.cashierName || tx.cashierEmail || "System",
      (tx.returnAmount || 0).toFixed(2), (tx.items || []).map(i => `${i.name} (${i.quantity}x)`).join("; "), tx.reason || "—"
    ]);
    exportToCSV(data, headers, `returns_${Date.now()}.csv`);
  };

  const handleExportReturnsPDF = () => {
    const headers = ["Return ID", "Original Bill", "Date", "Cashier", "Amount", "Items", "Reason"];
    const data = returnTxs.map(tx => [
      tx.id, tx.originalBillId || "—", new Date(tx.timestamp).toLocaleString(), tx.cashierName || tx.cashierEmail || "System",
      `฿${(tx.returnAmount || 0).toFixed(2)}`, (tx.items || []).map(i => `${i.name} (${i.quantity}x)`).join("; "), tx.reason || "—"
    ]);
    exportToPDF("Returns Report", headers, data);
  };

  const handleExportTaxCSV = () => {
    const headers = ["Bill ID", "Date", "Cashier", "Net Amount (฿)", "VAT Rate", "Tax Amount (฿)"];
    const data = getTaxRows().map(tx => [
      tx.id, new Date(tx.timestamp).toLocaleString(), tx.cashierName || tx.cashierEmail || "System",
      ((tx.totalAmount || 0) - (tx.taxAmount || 0)).toFixed(2), `${tx.taxRate || 7}%`, (tx.taxAmount || 0).toFixed(2)
    ]);
    exportToCSV(data, headers, `vat_tax_report_${Date.now()}.csv`);
  };

  const handleExportProductsCSV = () => {
    const headers = ["Product Name", "Category", "Quantity Sold", "Revenue (฿)", "Discounts (฿)", "Cost (฿)", "Profit (฿)", "Margin"];
    const data = productSales.map(p => {
      const profit = p.revenue - p.cost - p.discount;
      const margin = p.revenue > 0 ? (profit / p.revenue) * 100 : 0;
      return [
        p.name, p.category, p.qty, p.revenue.toFixed(2), p.discount.toFixed(2), p.cost.toFixed(2), profit.toFixed(2), margin.toFixed(1) + "%"
      ];
    });
    exportToCSV(data, headers, `product_sales_${Date.now()}.csv`);
  };

  const handleExportProductsPDF = () => {
    const headers = ["Product Name", "Category", "Quantity Sold", "Revenue", "Discounts", "Cost", "Profit", "Margin"];
    const data = productSales.map(p => {
      const profit = p.revenue - p.cost - p.discount;
      const margin = p.revenue > 0 ? (profit / p.revenue) * 100 : 0;
      return [
        p.name, p.category, p.qty, `฿${p.revenue.toFixed(2)}`, `฿${p.discount.toFixed(2)}`, `฿${p.cost.toFixed(2)}`, `฿${profit.toFixed(2)}`, margin.toFixed(1) + "%"
      ];
    });
    exportToPDF("Product-wise Sales Report", headers, data);
  };

  const handleExportCustomersCSV = () => {
    const headers = ["Customer Name", "Phone", "Visits", "Total Spent (฿)", "Outstanding Balance (฿)", "Last Purchase"];
    const data = customerHistory.map(c => [
      c.name, c.phone || "—", c.visits, c.totalSpent.toFixed(2), c.balance.toFixed(2), c.lastPurchase ? new Date(c.lastPurchase).toLocaleDateString() : "—"
    ]);
    exportToCSV(data, headers, `customer_history_${Date.now()}.csv`);
  };

  const handleExportCustomersPDF = () => {
    const headers = ["Customer Name", "Phone", "Visits", "Total Spent", "Outstanding Balance", "Last Purchase"];
    const data = customerHistory.map(c => [
      c.name, c.phone || "—", c.visits, `฿${c.totalSpent.toFixed(2)}`, `฿${c.balance.toFixed(2)}`, c.lastPurchase ? new Date(c.lastPurchase).toLocaleDateString() : "—"
    ]);
    exportToPDF("Customer Ledger Report", headers, data);
  };

  const handleExportStaffCSV = () => {
    const headers = ["Staff Name", "Total Bills", "Total Sales (฿)", "Discounts (฿)", "Returns (฿)"];
    const data = staffPerformance.map(s => [s.name, s.count, s.revenue.toFixed(2), s.discounts.toFixed(2), s.returns.toFixed(2)]);
    exportToCSV(data, headers, `staff_performance_${Date.now()}.csv`);
  };

  const handleExportStaffPDF = () => {
    const headers = ["Staff Name", "Total Bills", "Total Sales", "Discounts", "Returns"];
    const data = staffPerformance.map(s => [s.name, s.count, `฿${s.revenue.toFixed(2)}`, `฿${s.discounts.toFixed(2)}`, `฿${s.returns.toFixed(2)}`]);
    exportToPDF("Staff Performance Report", headers, data);
  };

  const handleExportBillsCSV = () => {
    const headers = ["Bill ID", "Date", "Cashier", "Payment Mode", "Total Amount (฿)"];
    const data = filteredTxs.map(tx => [
      tx.id, new Date(tx.timestamp).toLocaleString(), tx.cashierName || tx.cashierEmail || "System", tx.paymentMode || "—", (tx.totalAmount || 0).toFixed(2)
    ]);
    exportToCSV(data, headers, `recent_bills_${Date.now()}.csv`);
  };

  const handleExportBillsPDF = () => {
    const headers = ["Bill ID", "Date", "Cashier", "Payment Mode", "Total Amount"];
    const data = filteredTxs.map(tx => [
      tx.id, new Date(tx.timestamp).toLocaleString(), tx.cashierName || tx.cashierEmail || "System", tx.paymentMode || "—", `฿${(tx.totalAmount || 0).toFixed(2)}`
    ]);
    exportToPDF("Recent Bills Report", headers, data);
  };

  const subTabs = [
    { key: "overview", label: "📊 Overview" },
    { key: "daily", label: "📅 Daily" },
    { key: "pl", label: "💰 P&L" },
    { key: "products", label: "📦 Products" },
    { key: "customers", label: "👥 Customers" },
    { key: "payments", label: "💳 Payments" },
    { key: "hours", label: "⏰ Hours" },
    { key: "staff", label: "👤 Staff" },
    { key: "expenses", label: "💸 Expenses" },
    { key: "returns", label: "↩️ Returns" },
    { key: "bills", label: "📜 Bills" }
  ];
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab || "overview");

  useEffect(() => {
    if (initialSubTab) setActiveSubTab(initialSubTab);
  }, [initialSubTab]);

  const fmt = (v) => `฿${(v || 0).toFixed(2)}`;
  const cell = { textAlign: "right", padding: "0.4rem 0.5rem", borderBottom: "1px solid #f1f5f9" } as any;
  const cellL = { textAlign: "left", padding: "0.4rem 0.5rem", borderBottom: "1px solid #f1f5f9", fontWeight: "600", color: "#1e293b" } as any;
  const head = { textAlign: "left", padding: "0.4rem 0.5rem", borderBottom: "2px solid #e2e8f0", color: "#64748b" } as any;
  const headR = { textAlign: "right", padding: "0.4rem 0.5rem", borderBottom: "2px solid #e2e8f0", color: "#64748b" } as any;
  const exportBtnStyle = { padding: "2px 8px", fontSize: "0.7rem", borderRadius: "4px" } as any;

  return (
    <div style={styles.container}>
      {/* ── Period Filter ── */}
      <div className="filter-bar" style={{ flexWrap: "wrap", gap: "0.4rem" }}>
        <select value={period} onChange={e => setPeriod(e.target.value)} className="input-field" style={{ fontFamily: "inherit", maxWidth: "160px", padding: "0.4rem", fontSize: "0.8rem" }}>
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="month">This month</option>
          <option value="custom">Custom range</option>
        </select>
        {period === "custom" && (
          <>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="input-field" style={{ padding: "0.4rem", fontSize: "0.8rem" }} />
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="input-field" style={{ padding: "0.4rem", fontSize: "0.8rem" }} />
          </>
        )}
        <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600, alignSelf: "center" }}>
          Showing: {periodLabel()} · {filteredTxs.length} bills · {fmt(getSalesTotal())} sales · {fmt(getExpenseTotal())} expenses
        </span>
      </div>

      {/* ── Sub-tab Navigation (scrollable) ── */}
      <div className="reports-subtabs" style={styles.subTabs}>
        {subTabs.map(t => (
          <button key={t.key} onClick={() => { setActiveSubTab(t.key); onSubTabChange?.(t.key); }} style={{...styles.subTab, ...(activeSubTab === t.key ? styles.activeSubTab : {})}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════ OVERVIEW ═══════════════════════ */}
      {activeSubTab === "overview" && (
        <>
          <div style={styles.statsGrid} className="stats-grid">
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Total Sales Revenue</span>
              <span style={styles.statValSales}>{fmt(getSalesTotal())}</span>
              <span style={styles.statSubText}>{salesTxs.length} Bills · {totalQtySold} Items sold</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Gross Profit</span>
              <span style={{...styles.statValProfit, ...(grossProfitVal < 0 ? { color: "#ef4444" } : {})}}>{fmt(grossProfitVal)}</span>
              <span style={styles.statSubText}>Net Revenue − COGS</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Net Operating Profit</span>
              <span style={{...styles.statValProfit, ...(profitVal < 0 ? { color: "#ef4444" } : {})}}>{fmt(profitVal)}</span>
              <span style={styles.statSubText}>Gross Profit − Expenses</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Total Expenses</span>
              <span style={{...styles.statValProfit, color: "#dc2626"}}>{fmt(getExpenseTotal())}</span>
              <span style={styles.statSubText}>Net Cash: {fmt(cashFlow.netCash)}</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Returns</span>
              <span style={{...styles.statValProfit, color: "#d97706"}}>{fmt(getReturnsTotal())}</span>
              <span style={styles.statSubText}>{returnTxs.length} return transactions</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Discounts Given</span>
              <span style={{...styles.statValProfit, color: "#d97706"}}>{fmt(getDiscountsTotal())}</span>
              <span style={styles.statSubText}>Bill: {fmt(getBillDiscountTotal())} · Items: {fmt(getItemDiscountTotal())}</span>
            </div>
          </div>

          {dailyData.length > 0 && (
            <div style={styles.reportCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
                <h3 style={styles.cardHeaderNoBorder}>📈 {period === "all" ? "Daily" : `${periodLabel()} · `}Revenue vs Expenses</h3>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <button onClick={handleExportOverviewCSV} className="btn btn-outline btn-sm" style={exportBtnStyle}>CSV</button>
                  <button onClick={handleExportOverviewPDF} className="btn btn-outline btn-sm" style={exportBtnStyle}>PDF</button>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyData.slice(0, 14).reverse()}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(val) => `฿${val}`} />
                  <Bar dataKey="gross" fill="#047857" radius={[4, 4, 0, 0]} name="Revenue" />
                  <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expense" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

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
                      <th style={head}>Month</th><th style={headR}>Bills</th><th style={headR}>Revenue</th><th style={headR}>Cost</th><th style={headR}>Profit</th><th style={headR}>Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map(m => {
                      const profit = m.revenue - m.cost;
                      const margin = m.revenue > 0 ? (profit / m.revenue) * 100 : 0;
                      return (
                        <tr key={m.month} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "0.4rem 0.5rem", fontWeight: "bold", color: "#1e293b" }}>{m.month}</td>
                          <td style={{ ...cell, color: "#64748b" }}>{m.count}</td>
                          <td style={{ ...cell, fontWeight: "600", color: "#047857" }}>{fmt(m.revenue)}</td>
                          <td style={{ ...cell, color: "#dc2626" }}>{fmt(m.cost)}</td>
                          <td style={{ ...cell, fontWeight: "600", color: profit >= 0 ? "#2563eb" : "#ef4444" }}>{fmt(profit)}</td>
                          <td style={{ ...cell, fontWeight: "600", color: margin >= 0 ? "#047857" : "#ef4444" }}>{margin.toFixed(1)}%</td>
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
                <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "#15803d" }}>{fmt(cashFlow.cashReceived)}</div>
              </div>
              <div style={{ flex: 1, minWidth: "120px", padding: "0.75rem", backgroundColor: "#eff6ff", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
                <div style={{ fontSize: "0.7rem", color: "#1e40af", fontWeight: "600", textTransform: "uppercase" }}>Non-Cash Receipts</div>
                <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "#2563eb" }}>{fmt(cashFlow.others)}</div>
              </div>
              <div style={{ flex: 1, minWidth: "120px", padding: "0.75rem", backgroundColor: "#fef2f2", borderRadius: "8px", border: "1px solid #fecaca" }}>
                <div style={{ fontSize: "0.7rem", color: "#991b1b", fontWeight: "600", textTransform: "uppercase" }}>Expenses</div>
                <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "#dc2626" }}>{fmt(cashFlow.totalExpenses)}</div>
              </div>
              <div style={{ flex: 1, minWidth: "120px", padding: "0.75rem", backgroundColor: "#fefce8", borderRadius: "8px", border: "1px solid #fef08a" }}>
                <div style={{ fontSize: "0.7rem", color: "#a16207", fontWeight: "600", textTransform: "uppercase" }}>Net Cash</div>
                <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "#ca8a04" }}>{fmt(cashFlow.netCash)}</div>
              </div>
            </div>
          </div>

          {/* Payment Split */}
          <div style={styles.reportCard}>
            <h3 style={styles.cardHeader}>Payment Modes Split</h3>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={allPayModes.map((m, i) => ({ name: m, value: paySplit[m] }))} cx="50%" cy="50%" innerRadius={35} outerRadius={70} dataKey="value">
                    {allPayModes.map((_, i) => (<Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />))}
                  </Pie>
                  <Tooltip formatter={(val) => `฿${Number(val).toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, minWidth: "120px" }}>
                {allPayModes.length === 0 && <div style={styles.splitRow}><span style={styles.splitLabel}>No sales in this period</span></div>}
                {allPayModes.map((m, i) => (
                  <div key={m} style={styles.splitRow}>
                    <span style={styles.splitLabel}>{m === "Cash" ? "💵" : m === "PromptPay" ? "📱" : m === "Bank Transfer" ? "🏦" : m === UDHAAR_MODE ? "🤝" : "💳"} {m}:</span>
                    <span style={{...styles.splitValue, color: m === UDHAAR_MODE ? "#ef4444" : PIE_COLORS[i % PIE_COLORS.length]}}>{fmt(paySplit[m])}</span>
                  </div>
                ))}
                {totalTax > 0 && <div style={{...styles.splitRow, borderBottom: "none", marginTop: "0.5rem", borderTop: "2px solid #e2e8f0", paddingTop: "0.5rem"}}><span style={styles.splitLabel}>🧾 VAT Collected:</span><span style={{...styles.splitValue, color: "#d97706"}}>{fmt(totalTax)}</span></div>}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════ DAILY SALES REGISTER ═══════════════════════ */}
      {activeSubTab === "daily" && (
        <div style={styles.reportCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: "700", color: "#1e293b", margin: 0 }}>📅 Daily Sales Register</h3>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button onClick={handleExportOverviewCSV} className="btn btn-outline btn-sm" style={exportBtnStyle}>CSV</button>
              <button onClick={handleExportOverviewPDF} className="btn btn-outline btn-sm" style={exportBtnStyle}>PDF</button>
            </div>
          </div>
          <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.75rem" }}>
            Day-by-day record: gross sales, discounts, returns, expenses and net — the standard sales register every retailer keeps.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
              <thead>
                <tr>
                  <th style={head}>Date</th><th style={headR}>Bills</th><th style={headR}>Gross Sales</th><th style={headR}>Discounts</th><th style={headR}>Returns</th><th style={headR}>Expenses</th><th style={headR}>Net</th>
                </tr>
              </thead>
              <tbody>
                {dailyData.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: "#94a3b8", padding: "1rem" }}>No data in this period.</td></tr>
                ) : dailyData.map(d => (
                  <tr key={d.date} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={cellL}>{d.date}</td>
                    <td style={{ ...cell, color: "#64748b" }}>{d.bills}</td>
                    <td style={{ ...cell, fontWeight: "600", color: "#047857" }}>{fmt(d.gross)}</td>
                    <td style={{ ...cell, color: "#dc2626" }}>−{fmt(d.discounts)}</td>
                    <td style={{ ...cell, color: "#d97706" }}>−{fmt(d.returns)}</td>
                    <td style={{ ...cell, color: "#dc2626" }}>−{fmt(d.expenses)}</td>
                    <td style={{ ...cell, fontWeight: "800", color: d.net >= 0 ? "#2563eb" : "#ef4444" }}>{fmt(d.net)}</td>
                  </tr>
                ))}
                {dailyData.length > 1 && (
                  <tr style={{ background: "#f8fafc" }}>
                    <td style={{ padding: "0.4rem 0.5rem", fontWeight: "800", color: "#1e293b" }}>TOTAL</td>
                    <td style={{ ...cell, fontWeight: "700", color: "#1e293b" }}>{dailyData.reduce((s, d) => s + d.bills, 0)}</td>
                    <td style={{ ...cell, fontWeight: "800", color: "#047857" }}>{fmt(dailyData.reduce((s, d) => s + d.gross, 0))}</td>
                    <td style={{ ...cell, fontWeight: "700", color: "#dc2626" }}>−{fmt(dailyData.reduce((s, d) => s + d.discounts, 0))}</td>
                    <td style={{ ...cell, fontWeight: "700", color: "#d97706" }}>−{fmt(dailyData.reduce((s, d) => s + d.returns, 0))}</td>
                    <td style={{ ...cell, fontWeight: "700", color: "#dc2626" }}>−{fmt(dailyData.reduce((s, d) => s + d.expenses, 0))}</td>
                    <td style={{ ...cell, fontWeight: "800", color: "#2563eb" }}>{fmt(dailyData.reduce((s, d) => s + d.net, 0))}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════ PROFIT & LOSS ═══════════════════════ */}
      {activeSubTab === "pl" && (
        <div style={styles.reportCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: "700", color: "#1e293b", margin: 0 }}>💰 Profit & Loss Statement</h3>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button onClick={handleExportPLCSV} className="btn btn-outline btn-sm" style={exportBtnStyle}>CSV</button>
              <button onClick={handleExportPLPDF} className="btn btn-outline btn-sm" style={exportBtnStyle}>PDF</button>
            </div>
          </div>
          <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.75rem" }}>
            Standard P&L for {periodLabel()}: Revenue → Returns/Discounts → Net Revenue → COGS → Gross Profit → Expenses → Net Operating Profit.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.9rem" }}>
            <div style={styles.plRow}><span>Revenue (Gross Sales)</span><span style={{ color: "#047857", fontWeight: 700 }}>{fmt(getSalesTotal())}</span></div>
            <div style={styles.plRow}><span>Less: Returns</span><span style={{ color: "#d97706", fontWeight: 600 }}>−{fmt(getReturnsTotal())}</span></div>
            <div style={styles.plRow}><span>Less: Discounts (bill + item)</span><span style={{ color: "#dc2626", fontWeight: 600 }}>−{fmt(getDiscountsTotal())}</span></div>
            <div style={{ ...styles.plRow, fontWeight: 700, borderTop: "1px solid #e2e8f0", paddingTop: "0.4rem" }}><span>Net Revenue</span><span style={{ color: "#1e293b" }}>{fmt(getNetRevenue())}</span></div>
            <div style={styles.plRow}><span>Less: Cost of Goods Sold</span><span style={{ color: "#dc2626", fontWeight: 600 }}>−{fmt(getCostTotal())}</span></div>
            <div style={{ ...styles.plRow, fontWeight: 800, borderTop: "1px solid #e2e8f0", paddingTop: "0.4rem", color: grossProfitVal >= 0 ? "#047857" : "#ef4444" }}>
              <span>GROSS PROFIT</span><span>{fmt(grossProfitVal)} ({getNetRevenue() > 0 ? ((grossProfitVal / getNetRevenue()) * 100).toFixed(1) : 0}%)</span>
            </div>
            {expenseCats.map(c => (
              <div key={c.name} style={styles.plRow}><span>Less: Expense — {c.name} ({c.count})</span><span style={{ color: "#dc2626", fontWeight: 600 }}>−{fmt(c.amount)}</span></div>
            ))}
            <div style={styles.plRow}><span>Less: Total Expenses</span><span style={{ color: "#dc2626", fontWeight: 600 }}>−{fmt(getExpenseTotal())}</span></div>
            <div style={{ ...styles.plRow, fontWeight: 800, borderTop: "2px solid #1e293b", paddingTop: "0.4rem", fontSize: "1rem", color: profitVal >= 0 ? "#047857" : "#ef4444" }}>
              <span>NET OPERATING PROFIT</span><span>{fmt(profitVal)} ({getSalesTotal() > 0 ? ((profitVal / getSalesTotal()) * 100).toFixed(1) : 0}% of sales)</span>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════ PRODUCTS ═══════════════════════ */}
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

          {deadStockItems.length > 0 && (
            <div style={{...styles.reportCard, borderLeft: "4px solid #d97706"}}>
              <h3 style={styles.cardHeader}>🧊 Dead Stock — No sales in last 30 days ({deadStockItems.length})</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {deadStockItems.slice(0, 10).map(p => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", padding: "0.3rem 0", borderBottom: "1px solid #f1f5f9" }}>
                    <span style={{ fontWeight: "600", color: "#1e293b" }}>{p.name}</span>
                    <span style={{ color: "#d97706", fontWeight: "bold" }}>{p.stock} units · {fmt((p.stock || 0) * (p.costPrice || 0))} value</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={styles.reportCard}>
            <h3 style={styles.cardHeader}>📦 Inventory Valuation</h3>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "120px", padding: "0.75rem", backgroundColor: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                <div style={{ fontSize: "0.7rem", color: "#166534", fontWeight: "600", textTransform: "uppercase" }}>Stock Value (at cost)</div>
                <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "#15803d" }}>{fmt(getStockValuation())}</div>
                <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{products.filter(p => !(p.isNonInventory || p.stock >= 9999)).length} tracked items</div>
              </div>
              <div style={{ flex: 1, minWidth: "120px", padding: "0.75rem", backgroundColor: "#eff6ff", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
                <div style={{ fontSize: "0.7rem", color: "#1e40af", fontWeight: "600", textTransform: "uppercase" }}>Total Units in Stock</div>
                <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "#2563eb" }}>{products.filter(p => !(p.isNonInventory || p.stock >= 9999)).reduce((s, p) => s + (p.stock || 0), 0)}</div>
                <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{lowStockItems.length} low stock alerts</div>
              </div>
            </div>
          </div>

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

          {productSales.length > 0 && (
            <div style={styles.reportCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: "700", color: "#1e293b", margin: 0 }}>📦 Product-wise Sales</h3>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <button onClick={handleExportProductsCSV} className="btn btn-outline btn-sm" style={exportBtnStyle}>CSV</button>
                  <button onClick={handleExportProductsPDF} className="btn btn-outline btn-sm" style={exportBtnStyle}>PDF</button>
                </div>
              </div>
              <div style={{ overflowX: "auto", maxHeight: "320px", overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                  <thead>
                    <tr>
                      <th style={{ ...head, position: "sticky", top: 0, backgroundColor: "#fff" }}>Product</th>
                      <th style={headR}>Sold</th><th style={headR}>Revenue</th><th style={headR}>Discounts</th><th style={headR}>Cost</th><th style={headR}>Profit</th><th style={headR}>Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productSales.map(p => {
                      const profit = p.revenue - p.cost - p.discount;
                      const margin = p.revenue > 0 ? (profit / p.revenue) * 100 : 0;
                      return (
                        <tr key={p.name} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={cellL}>{p.name}</td>
                          <td style={{ ...cell, color: "#64748b" }}>{p.qty}</td>
                          <td style={{ ...cell, fontWeight: "600", color: "#047857" }}>{fmt(p.revenue)}</td>
                          <td style={{ ...cell, color: "#dc2626" }}>−{fmt(p.discount)}</td>
                          <td style={{ ...cell, color: "#dc2626" }}>{fmt(p.cost)}</td>
                          <td style={{ ...cell, fontWeight: "600", color: profit >= 0 ? "#2563eb" : "#ef4444" }}>{fmt(profit)}</td>
                          <td style={{ ...cell, fontWeight: "600", color: margin >= GOOD_MARGIN_PCT ? "#047857" : margin >= 0 ? "#d97706" : "#ef4444" }}>{margin.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
                      <span style={{ fontWeight: "700", color: "#047857" }}>{fmt(c.revenue)} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div style={{ height: "8px", backgroundColor: "#f1f5f9", borderRadius: "99px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, backgroundColor: "#047857", borderRadius: "99px" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "#64748b", marginTop: "2px" }}>
                      <span>{c.qty} items · Cost: {fmt(c.cost)}</span>
                      <span>Profit: {fmt(profit)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════ CUSTOMERS ═══════════════════════ */}
      {activeSubTab === "customers" && (
        <>
          <div style={styles.reportCard}>
            <h3 style={styles.cardHeader}>👥 Customer Purchase History</h3>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              <div style={{ flex: 1, minWidth: "120px", padding: "0.75rem", backgroundColor: "#fef2f2", borderRadius: "8px", border: "1px solid #fecaca" }}>
                <div style={{ fontSize: "0.7rem", color: "#991b1b", fontWeight: "600", textTransform: "uppercase" }}>Total Receivables (A/R)</div>
                <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "#dc2626" }}>{fmt(customerHistory.reduce((s, c) => s + c.balance, 0))}</div>
                <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{customerHistory.filter(c => c.balance > 0).length} customers with balance</div>
              </div>
              <div style={{ flex: 1, minWidth: "120px", padding: "0.75rem", backgroundColor: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                <div style={{ fontSize: "0.7rem", color: "#166534", fontWeight: "600", textTransform: "uppercase" }}>Total Customer Spend</div>
                <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "#15803d" }}>{fmt(customerHistory.reduce((s, c) => s + c.totalSpent, 0))}</div>
                <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{customerHistory.length} active customers</div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.4rem", marginBottom: "0.5rem" }}>
              <button onClick={handleExportCustomersCSV} className="btn btn-outline btn-sm" style={exportBtnStyle}>CSV</button>
              <button onClick={handleExportCustomersPDF} className="btn btn-outline btn-sm" style={exportBtnStyle}>PDF</button>
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
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                          {c.phone || "—"} · {c.visits} visits{c.lastPurchase ? ` · last purchase ${new Date(c.lastPurchase).toLocaleDateString()}` : ""}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "1rem", fontWeight: "800", color: "#047857" }}>{fmt(c.totalSpent)}</div>
                        <div style={{ fontSize: "0.7rem", color: c.balance > 0 ? "#dc2626" : "#94a3b8" }}>
                          {c.balance > 0 ? `Due: ${fmt(c.balance)}` : "Settled"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════════════════ PAYMENTS / TAX ═══════════════════════ */}
      {activeSubTab === "payments" && (
        <>
          <div style={styles.reportCard}>
            <h3 style={styles.cardHeader}>💳 Payment Modes Analysis</h3>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={allPayModes.map((m, i) => ({ name: m, value: paySplit[m] }))} cx="50%" cy="50%" innerRadius={35} outerRadius={70} dataKey="value">
                    {allPayModes.map((_, i) => (<Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />))}
                  </Pie>
                  <Tooltip formatter={(val) => `฿${Number(val).toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, minWidth: "140px" }}>
                {allPayModes.map((m, i) => (
                  <div key={m} style={styles.splitRow}>
                    <span style={styles.splitLabel}>{m}:</span>
                    <span style={styles.splitValue}>{fmt(paySplit[m])} ({getSalesTotal() > 0 ? ((paySplit[m] / getSalesTotal()) * 100).toFixed(1) : 0}%)</span>
                  </div>
                ))}
                <div style={{...styles.splitRow, borderBottom: "none", marginTop: "0.5rem", borderTop: "2px solid #e2e8f0", paddingTop: "0.5rem"}}>
                  <span style={styles.splitLabel}>🧾 VAT Collected ({periodLabel()}):</span>
                  <span style={{...styles.splitValue, color: "#d97706"}}>{fmt(totalTax)}</span>
                </div>
              </div>
            </div>
          </div>

          <div style={styles.reportCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: "700", color: "#1e293b", margin: 0 }}>🧾 VAT / Tax Detail</h3>
              <button onClick={handleExportTaxCSV} className="btn btn-outline btn-sm" style={exportBtnStyle}>CSV</button>
            </div>
            <div style={{ overflowX: "auto", maxHeight: "320px", overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                <thead>
                  <tr>
                    <th style={{ ...head, position: "sticky", top: 0, backgroundColor: "#fff" }}>Bill</th>
                    <th style={headR}>Date</th><th style={headR}>Cashier</th><th style={headR}>Net Amount</th><th style={headR}>VAT</th><th style={headR}>Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {getTaxRows().length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: "center", color: "#94a3b8", padding: "1rem" }}>No taxable bills in this period.</td></tr>
                  ) : getTaxRows().map(tx => (
                    <tr key={tx.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ ...cellL, fontSize: "0.7rem" }}>#{String(tx.id).replace("tx_", "").slice(-8)}</td>
                      <td style={{ ...cell, color: "#64748b", fontSize: "0.7rem" }}>{new Date(tx.timestamp).toLocaleString()}</td>
                      <td style={{ ...cell, color: "#64748b", fontSize: "0.7rem" }}>{tx.cashierName || tx.cashierEmail || "—"}</td>
                      <td style={{ ...cell, fontWeight: "600", color: "#047857" }}>{fmt((tx.totalAmount || 0) - (tx.taxAmount || 0))}</td>
                      <td style={{ ...cell, color: "#64748b" }}>{tx.taxRate || 7}%</td>
                      <td style={{ ...cell, fontWeight: "700", color: "#d97706" }}>{fmt(tx.taxAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════ PEAK HOURS ═══════════════════════ */}
      {activeSubTab === "hours" && (
        <>
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

          <div style={styles.reportCard}>
            <h3 style={styles.cardHeader}>📆 Weekday Analysis</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weekdayStats}>
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(val, name) => [name === "count" ? val : `฿${Number(val).toFixed(2)}`, name === "count" ? "Bills" : "Revenue"]} />
                <Bar dataKey="count" fill="#2563eb" radius={[3, 3, 0, 0]} name="Bills" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* ═══════════════════════ STAFF ═══════════════════════ */}
      {activeSubTab === "staff" && (
        <div style={styles.reportCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: "700", color: "#1e293b", margin: 0 }}>👤 Staff Sales Metrics</h3>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button onClick={handleExportStaffCSV} className="btn btn-outline btn-sm" style={exportBtnStyle}>CSV</button>
              <button onClick={handleExportStaffPDF} className="btn btn-outline btn-sm" style={exportBtnStyle}>PDF</button>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {(!staffPerformance || staffPerformance.length === 0) ? (
              <div style={{ textAlign: "center", color: "#94a3b8", padding: "1rem" }}>No staff analytics available.</div>
            ) : (
              (staffPerformance || []).map(staff => (
                <div key={staff.name} style={{ padding: "0.75rem", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #cbd5e1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: "bold", color: "#1e293b" }}>{staff.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{staff.count} bills generated</div>
                    <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Discounts: {fmt(staff.discounts)} · Returns: {fmt(staff.returns)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "#047857" }}>{fmt(staff.revenue)}</div>
                    <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Total Sales Value</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════ EXPENSES ═══════════════════════ */}
      {activeSubTab === "expenses" && (
        <>
          <div style={styles.reportCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: "700", color: "#1e293b", margin: 0 }}>💸 Expense Report ({periodLabel()})</h3>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <button onClick={handleExportExpensesCSV} className="btn btn-outline btn-sm" style={exportBtnStyle}>CSV</button>
                <button onClick={handleExportExpensesPDF} className="btn btn-outline btn-sm" style={exportBtnStyle}>PDF</button>
              </div>
            </div>
            <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.75rem" }}>Total: {fmt(getExpenseTotal())} · {filteredExpenses.length} entries in this period</p>

            {expenseCats.length > 0 && (
              <>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={expenseCats} layout="vertical" margin={{ left: 10 }}>
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
                    <Tooltip formatter={(val) => `฿${val.toFixed(2)}`} />
                    <Bar dataKey="amount" fill="#ef4444" radius={[0, 4, 4, 0]} name="Amount" />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ overflowX: "auto", marginTop: "0.5rem" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                    <thead>
                      <tr>
                        <th style={head}>Category</th><th style={headR}>Entries</th><th style={headR}>Amount</th><th style={headR}>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenseCats.map(c => (
                        <tr key={c.name} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={cellL}>{c.name}</td>
                          <td style={{ ...cell, color: "#64748b" }}>{c.count}</td>
                          <td style={{ ...cell, fontWeight: "700", color: "#dc2626" }}>{fmt(c.amount)}</td>
                          <td style={{ ...cell, color: "#64748b" }}>{getExpenseTotal() > 0 ? ((c.amount / getExpenseTotal()) * 100).toFixed(1) : 0}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div style={{ overflowX: "auto", marginTop: "1rem", maxHeight: "300px", overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                <thead>
                  <tr>
                    <th style={{ ...head, position: "sticky", top: 0, backgroundColor: "#fff" }}>Date</th>
                    <th style={head}>Category</th><th style={head}>Description</th><th style={headR}>Amount</th><th style={headR}>By</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: "center", color: "#94a3b8", padding: "1rem" }}>No expenses in this period.</td></tr>
                  ) : [...filteredExpenses].sort((a, b) => (b.date || b.timestamp || 0) - (a.date || a.timestamp || 0)).map(e => (
                    <tr key={e.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ ...cellL, fontSize: "0.7rem", color: "#64748b" }}>{new Date(e.date || e.timestamp).toLocaleString()}</td>
                      <td style={{ ...cellL, fontSize: "0.75rem" }}>{e.category || "Other"}</td>
                      <td style={{ ...cellL, fontSize: "0.75rem", color: "#475569" }}>{e.description || "—"}</td>
                      <td style={{ ...cell, fontWeight: "700", color: "#dc2626" }}>{fmt(e.amount)}</td>
                      <td style={{ ...cell, color: "#64748b" }}>{e.createdBy || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════ RETURNS ═══════════════════════ */}
      {activeSubTab === "returns" && (
        <div style={styles.reportCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: "700", color: "#1e293b", margin: 0 }}>↩️ Returns Report ({periodLabel()})</h3>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button onClick={handleExportReturnsCSV} className="btn btn-outline btn-sm" style={exportBtnStyle}>CSV</button>
              <button onClick={handleExportReturnsPDF} className="btn btn-outline btn-sm" style={exportBtnStyle}>PDF</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
            <div style={{ flex: 1, minWidth: "120px", padding: "0.75rem", backgroundColor: "#fef2f2", borderRadius: "8px", border: "1px solid #fecaca" }}>
              <div style={{ fontSize: "0.7rem", color: "#991b1b", fontWeight: "600", textTransform: "uppercase" }}>Total Returns Value</div>
              <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "#dc2626" }}>{fmt(getReturnsTotal())}</div>
            </div>
            <div style={{ flex: 1, minWidth: "120px", padding: "0.75rem", backgroundColor: "#fefce8", borderRadius: "8px", border: "1px solid #fef08a" }}>
              <div style={{ fontSize: "0.7rem", color: "#a16207", fontWeight: "600", textTransform: "uppercase" }}>Return Transactions</div>
              <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "#ca8a04" }}>{returnTxs.length}</div>
            </div>
            <div style={{ flex: 1, minWidth: "120px", padding: "0.75rem", backgroundColor: "#eff6ff", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
              <div style={{ fontSize: "0.7rem", color: "#1e40af", fontWeight: "600", textTransform: "uppercase" }}>Return Rate</div>
              <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "#2563eb" }}>{getSalesTotal() > 0 ? ((getReturnsTotal() / getSalesTotal()) * 100).toFixed(1) : 0}%</div>
              <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>of sales value</div>
            </div>
          </div>
          <div style={{ overflowX: "auto", maxHeight: "320px", overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
              <thead>
                <tr>
                  <th style={{ ...head, position: "sticky", top: 0, backgroundColor: "#fff" }}>Return ID</th>
                  <th style={headR}>Original Bill</th><th style={headR}>Date</th><th style={headR}>Cashier</th><th style={headR}>Items</th><th style={headR}>Amount</th><th style={headR}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {returnTxs.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: "#94a3b8", padding: "1rem" }}>No returns in this period.</td></tr>
                ) : [...returnTxs].sort((a, b) => b.timestamp - a.timestamp).map(tx => (
                  <tr key={tx.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ ...cellL, fontSize: "0.7rem" }}>#{String(tx.id).replace("ret_", "").slice(-8)}</td>
                    <td style={{ ...cell, fontSize: "0.7rem", color: "#64748b" }}>#{String(tx.originalBillId || "—").replace("tx_", "").slice(-8)}</td>
                    <td style={{ ...cell, fontSize: "0.7rem", color: "#64748b" }}>{new Date(tx.timestamp).toLocaleString()}</td>
                    <td style={{ ...cell, fontSize: "0.7rem", color: "#64748b" }}>{tx.cashierName || tx.cashierEmail || "System"}</td>
                    <td style={{ ...cell, fontSize: "0.7rem", color: "#64748b" }}>{(tx.items || []).map(i => `${i.name} (${i.quantity}x)`).join(", ") || "—"}</td>
                    <td style={{ ...cell, fontWeight: "800", color: "#dc2626" }}>{fmt(tx.returnAmount)}</td>
                    <td style={{ ...cell, fontSize: "0.7rem", color: "#d97706" }}>{tx.reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════ BILLS ═══════════════════════ */}
      {activeSubTab === "bills" && (
        <div style={styles.reportCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: "700", color: "#1e293b", margin: 0 }}>📜 Transactions Log ({periodLabel()})</h3>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button onClick={handleExportBillsCSV} className="btn btn-outline btn-sm" style={exportBtnStyle}>CSV</button>
              <button onClick={handleExportBillsPDF} className="btn btn-outline btn-sm" style={exportBtnStyle}>PDF</button>
            </div>
          </div>
          {loading ? <SkeletonTable rows={4} /> : (
            <div style={styles.txLogContainer}>
              {filteredTxs.length === 0 ? (
                <div style={{textAlign: "center", color: "#94a3b8", padding: "1rem"}}>No bills in this period.</div>
              ) : (
                [...filteredTxs].sort((a, b) => b.timestamp - a.timestamp).map(tx => (
                  <div key={tx.id} style={styles.txRow}>
                    <div style={styles.txRowLeft}>
                      <div style={styles.txId}>Bill ID: {tx.id}{tx.type === "return" ? " · ↩️ RETURN" : ""}</div>
                      <div style={styles.txDate}>{new Date(tx.timestamp).toLocaleString()}</div>
                      <div style={styles.txPaymentMode}>Mode: <b>{tx.paymentMode || "—"}</b> | 👤 {tx.cashierName || tx.cashierEmail}</div>
                      {tx.type === "return" && <div style={{fontSize: "0.7rem", color: "#d97706", marginTop: "2px", fontWeight: "bold"}}>Returned by: {tx.cashierName || tx.cashierEmail || "System"}</div>}
                      {tx.editedBy && <div style={{fontSize: "0.7rem", color: "#2563eb", marginTop: "2px", fontWeight: "bold"}}>✏️ Mode edited by: {tx.editedBy}</div>}
                      <div style={{fontSize: "0.75rem", color: "#475569", marginTop: "4px"}}>Items: {(tx.items || []).map(item => `${item.name} (${item.quantity}x)`).join(", ") || "—"}</div>
                      {tx.taxEnabled && <div style={{fontSize: "0.7rem", color: "#d97706", marginTop: "2px", fontWeight: "bold"}}>VAT {tx.taxRate}%: {fmt(tx.taxAmount)}</div>}
                      {tx.discountAmount > 0 && <div style={{fontSize: "0.7rem", color: "#dc2626", marginTop: "2px", fontWeight: "bold"}}>Discount: {tx.discountType === "percent" ? `${tx.discountValue}%` : `฿${tx.discountValue}`} (−{fmt(tx.discountAmount)}){tx.discountReason ? ` · ${tx.discountReason}` : ""}</div>}
                      {(tx.items || []).some(i => i.discountType) && (
                        <div style={{fontSize: "0.7rem", color: "#dc2626", marginTop: "2px", fontWeight: "bold"}}>
                          Item discounts: {(tx.items || []).filter(i => i.discountType).map(i => `${i.name.split(" (")[0]} ${i.discountType === "percent" ? `${i.discountValue}%` : `฿${i.discountValue}`}`).join(", ")}
                        </div>
                      )}
                      {tx.reason && <div style={{fontSize: "0.7rem", color: "#d97706", marginTop: "2px", fontStyle: "italic"}}>Reason: {tx.reason}</div>}
                    </div>
                    <div style={styles.txRowRight}>
                      <div style={styles.txTotal}>{fmt(tx.totalAmount || tx.returnAmount)}</div>
                      <div style={{...styles.txQty, marginBottom: "6px"}}>{(tx.items || []).length} items</div>
                      {tx.type !== "return" && (editingModeTx === tx.id ? (
                        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                          <select value={editingModeVal} onChange={e => setEditingModeVal(e.target.value)} style={{ fontSize: "0.7rem", padding: "2px 4px", borderRadius: "4px", border: "1px solid #cbd5e1", fontFamily: "inherit" }}>
                            <option value="">Change to...</option>
                            {editModeOptions
                              .filter(m => m !== tx.paymentMode)
                              .filter(m => m !== UDHAAR_MODE || !!tx.customerId)
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
                      ))}
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
  statsGrid: { display: "flex", gap: "0.75rem", flexWrap: "wrap" },
  statCard: { flex: 1, minWidth: "150px", backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #cbd5e1", padding: "1rem", display: "flex", flexDirection: "column", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
  statLabel: { fontSize: "0.75rem", color: "#64748b", fontWeight: "bold" },
  statValSales: { fontSize: "1.25rem", fontWeight: "800", color: "#047857", marginTop: "0.25rem" },
  statValProfit: { fontSize: "1.25rem", fontWeight: "800", color: "#0284c7", marginTop: "0.25rem" },
  statSubText: { fontSize: "0.7rem", color: "#94a3b8", marginTop: "0.25rem" },
  subTabs: { display: "flex", gap: "4px", overflowX: "auto", paddingBottom: "4px", flexShrink: 0, scrollbarWidth: "none" },
  subTab: { flexShrink: 0, padding: "0.5rem 0.75rem", fontSize: "0.8rem", fontWeight: "600", color: "#64748b", background: "#f1f5f9", border: "none", borderRadius: "8px", cursor: "pointer", transition: "all 0.2s ease", whiteSpace: "nowrap" },
  activeSubTab: { backgroundColor: "#047857", color: "#ffffff" },
  reportCard: { backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #cbd5e1", padding: "1rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
  cardHeader: { fontSize: "0.95rem", fontWeight: "700", color: "#1e293b", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem", marginBottom: "0.75rem" },
  cardHeaderNoBorder: { fontSize: "0.95rem", fontWeight: "700", color: "#1e293b", margin: 0 },
  plRow: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.9rem", padding: "0.3rem 0" },
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
