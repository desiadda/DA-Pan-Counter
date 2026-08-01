import { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db, isFirebaseEnabled } from "../db/config";
import { UDHAAR_MODE } from "../constants";
import { useDBStore } from "../stores/dbStore";
import { useLangStore } from "../stores/langStore";
import { useT } from "../lang/translations";
import ModalPortal from "./ModalPortal";

interface DashboardWidgetsProps {
  onNavigate?: (tab: string) => void;
}

export default function DashboardWidgets({ onNavigate }: DashboardWidgetsProps) {
  const tr = useT(useLangStore((s) => s.lang));

  const storeProducts = useDBStore((s) => s.products);
  const storeCustomers = useDBStore((s) => s.customers);
  const storeTransactions = useDBStore((s) => s.transactions);

  const [products, setProducts] = useState<any[]>(storeProducts);
  const [customers, setCustomers] = useState<any[]>(storeCustomers);
  const [transactions, setTransactions] = useState<any[]>(storeTransactions);

  const [activeModal, setActiveModal] = useState<null | "sales" | "bills" | "khata" | "stock">(null);
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterMode, setFilterMode] = useState<string>("all");

  useEffect(() => {
    setProducts(storeProducts);
  }, [storeProducts]);

  useEffect(() => {
    setCustomers(storeCustomers);
  }, [storeCustomers]);

  useEffect(() => {
    setTransactions(storeTransactions);
  }, [storeTransactions]);

  useEffect(() => {
    if (!isFirebaseEnabled || !db) return;
    let unsubP = () => {};
    let unsubC = () => {};
    let unsubT = () => {};

    try {
      unsubP = onSnapshot(collection(db, "products"), (snap) => {
        setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      unsubC = onSnapshot(collection(db, "customers"), (snap) => {
        setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      unsubT = onSnapshot(collection(db, "transactions"), (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setTransactions(list);
      });
    } catch (_) {}

    return () => {
      unsubP();
      unsubC();
      unsubT();
    };
  }, []);

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const todayTx = useMemo(() => {
    return (transactions || []).filter(t => (t.timestamp || 0) >= todayStart);
  }, [transactions, todayStart]);

  const salesBreakdown = useMemo(() => {
    let gross = 0;
    let cash = 0;
    let promptpay = 0;
    let udhaar = 0;
    let discount = 0;
    let itemsCount = 0;

    todayTx.forEach(t => {
      const amt = t.totalAmount || t.amount || 0;
      gross += amt;
      discount += t.discountAmount || 0;

      if (t.paymentMode === "Cash") cash += amt;
      else if (t.paymentMode === "PromptPay" || t.paymentMode === "QR") promptpay += amt;
      else if (t.paymentMode === UDHAAR_MODE) udhaar += amt;
      else cash += amt;

      if (Array.isArray(t.items)) {
        itemsCount += t.items.reduce((s: number, i: any) => s + (i.quantity || 1), 0);
      }
    });

    const totalBills = todayTx.length;
    const avgBill = totalBills > 0 ? gross / totalBills : 0;

    return { gross, cash, promptpay, udhaar, discount, itemsCount, totalBills, avgBill };
  }, [todayTx]);

  const khataDueTotal = useMemo(() => {
    return (customers || []).reduce((sum, c) => sum + (c.balance || 0), 0);
  }, [customers]);

  const lowStockItems = useMemo(() => {
    return (products || []).filter(p => (p.stock || 0) <= (p.lowStockLimit ?? 5));
  }, [products]);

  const items = [
    {
      type: "sales",
      label: "Today's Sales",
      value: `฿${salesBreakdown.gross.toFixed(0)}`,
      color: "#047857",
      bg: "var(--card-bg, #f0fdf4)",
      borderColor: "#bbf7d0",
      icon: "💰",
      subtitle: `${salesBreakdown.totalBills} bills today`,
    },
    {
      type: "bills",
      label: "Bills Today",
      value: salesBreakdown.totalBills.toString(),
      color: "#2563eb",
      bg: "var(--card-bg, #eff6ff)",
      borderColor: "#bfdbfe",
      icon: "🧾",
      subtitle: `Avg: ฿${salesBreakdown.avgBill.toFixed(0)}/bill`,
    },
    {
      type: "khata",
      label: "Khata Due",
      value: `฿${khataDueTotal.toFixed(0)}`,
      color: "#dc2626",
      bg: "var(--card-bg, #fef2f2)",
      borderColor: "#fecaca",
      icon: "📋",
      subtitle: `${customers.filter(c => (c.balance || 0) > 0).length} customers due`,
    },
    {
      type: "stock",
      label: "Low Stock",
      value: lowStockItems.length.toString(),
      color: "#ea580c",
      bg: "var(--card-bg, #fff7ed)",
      borderColor: "#fed7aa",
      icon: "📦",
      subtitle: `${lowStockItems.length} items need reorder`,
    },
  ];

  const handleCardClick = (type: string) => {
    setSearchQuery("");
    setFilterMode("all");
    setActiveModal(type as any);
  };

  const filteredTodayTx = useMemo(() => {
    return todayTx.filter(t => {
      if (filterMode !== "all" && t.paymentMode !== filterMode) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const idMatch = String(t.id || "").toLowerCase().includes(q);
        const custMatch = String(t.customerName || t.customer || "").toLowerCase().includes(q);
        const modeMatch = String(t.paymentMode || "").toLowerCase().includes(q);
        const itemsMatch = Array.isArray(t.items) && t.items.some((i: any) => String(i.name || "").toLowerCase().includes(q));
        return idMatch || custMatch || modeMatch || itemsMatch;
      }
      return true;
    });
  }, [todayTx, filterMode, searchQuery]);

  const filteredKhataCustomers = useMemo(() => {
    return (customers || [])
      .filter(c => (c.balance || 0) > 0)
      .filter(c => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return String(c.name || "").toLowerCase().includes(q) || String(c.phone || "").toLowerCase().includes(q);
      })
      .sort((a, b) => (b.balance || 0) - (a.balance || 0));
  }, [customers, searchQuery]);

  const filteredLowStockProducts = useMemo(() => {
    return lowStockItems.filter(p => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return String(p.name || "").toLowerCase().includes(q) || String(p.category || "").toLowerCase().includes(q);
    });
  }, [lowStockItems, searchQuery]);

  const printReceipt = (t: any) => {
    const storeName = (() => { try { return JSON.parse(localStorage.getItem("pan_store_settings") || "{}").name || "Paan Counter POS"; } catch { return "Paan Counter POS"; } })();
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Receipt ${t.id}</title><style>
      body{font-family:monospace;padding:16px;width:280px;margin:0 auto;color:#000}
      .c{text-align:center} .b{font-weight:700} .r{text-align:right}
      table{width:100%;border-collapse:collapse;margin:8px 0;font-size:12px}
      td,th{padding:2px 0}
      .hr{border-top:1px dashed #000;margin:6px 0}
    </style></head><body>
      <div class="c b" style="font-size:16px">${storeName}</div>
      <div class="c" style="font-size:11px">Receipt #${t.id || ""}</div>
      <div class="c" style="font-size:11px">${new Date(t.timestamp || Date.now()).toLocaleString()}</div>
      <div class="hr"></div>
      <div>Cashier: ${t.cashierName || "Staff"}</div>
      ${t.customerName ? `<div>Customer: ${t.customerName}</div>` : ""}
      <div>Mode: ${t.paymentMode || "Cash"}</div>
      <div class="hr"></div>
      <table>
        <thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Amt</th></tr></thead>
        <tbody>
          ${(t.items || []).map((i: any) => `<tr><td>${i.name}</td><td class="r">${i.quantity}</td><td class="r">฿${((i.sellingPrice || 0) * (i.quantity || 1)).toFixed(2)}</td></tr>`).join("")}
        </tbody>
      </table>
      <div class="hr"></div>
      <table>
        <tr><td>Subtotal:</td><td class="r">฿${(t.subtotal || t.totalAmount || 0).toFixed(2)}</td></tr>
        ${t.discountAmount ? `<tr><td>Discount:</td><td class="r">-฿${t.discountAmount.toFixed(2)}</td></tr>` : ""}
        <tr class="b" style="font-size:14px"><td>TOTAL:</td><td class="r">฿${(t.totalAmount || t.amount || 0).toFixed(2)}</td></tr>
      </table>
      <div class="hr"></div>
      <div class="c" style="font-size:11px">Thank you for visiting! 🙏</div>
      <script>window.print();</script>
    </body></html>`);
    w.document.close();
  };

  return (
    <>
      <div style={styles.grid} className="dashboard-widgets-grid">
        {items.map((item) => (
          <div
            key={item.type}
            style={{ ...styles.card, backgroundColor: item.bg, borderColor: item.borderColor, cursor: "pointer" }}
            onClick={() => handleCardClick(item.type)}

          >
            <div style={styles.top}>
              <span style={styles.icon}>{item.icon}</span>
              <span style={styles.linkHint}>›</span>
            </div>
            <span style={{ ...styles.value, color: item.color }}>{item.value}</span>
            <span style={styles.label}>{item.label}</span>
            <span style={styles.subtitle}>{item.subtitle}</span>
          </div>
        ))}
      </div>

      {/* ── Modal 1: Today's Sales Breakdown ── */}
      {activeTabModal("sales")}
      {activeTabModal("bills")}
      {activeTabModal("khata")}
      {activeTabModal("stock")}

      {/* ── Receipt View Sub-Modal ── */}
      {selectedReceipt && (
        <ModalPortal onClose={() => setSelectedReceipt(null)}>
          <div className="modal-overlay" onClick={() => setSelectedReceipt(null)}>
            <div className="modal-content" style={{ maxWidth: 420, padding: "1.25rem" }} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 style={{ margin: 0, fontSize: "1.1rem" }}>🧾 Receipt Details (#{selectedReceipt.id})</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedReceipt(null)}>✕</button>
              </div>

              <div style={{ background: "var(--card-bg, #f8fafc)", border: "1px solid var(--border, #e2e8f0)", borderRadius: "10px", padding: "1rem", fontSize: "0.85rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", borderBottom: "1px dashed var(--border)", paddingBottom: "0.5rem" }}>
                  <span className="text-muted">Time:</span>
                  <span style={{ fontWeight: 600 }}>{new Date(selectedReceipt.timestamp).toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span className="text-muted">Payment Mode:</span>
                  <span className="badge" style={{ background: selectedReceipt.paymentMode === "Cash" ? "#dcfce7" : selectedReceipt.paymentMode === UDHAAR_MODE ? "#fee2e2" : "#dbeafe", color: selectedReceipt.paymentMode === "Cash" ? "#166534" : selectedReceipt.paymentMode === UDHAAR_MODE ? "#991b1b" : "#1e40af", fontWeight: 700 }}>{selectedReceipt.paymentMode}</span>
                </div>
                {selectedReceipt.customerName && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <span className="text-muted">Customer:</span>
                    <span style={{ fontWeight: 600 }}>{selectedReceipt.customerName}</span>
                  </div>
                )}
                {selectedReceipt.cashierName && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                    <span className="text-muted">Cashier:</span>
                    <span style={{ fontWeight: 600 }}>{selectedReceipt.cashierName}</span>
                  </div>
                )}

                <div style={{ fontWeight: 700, marginBottom: "0.4rem", borderTop: "1px solid var(--border)", paddingTop: "0.5rem" }}>Items Purchased:</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", maxHeight: "180px", overflowY: "auto", marginBottom: "0.75rem" }}>
                  {(selectedReceipt.items || []).map((item: any, idx: number) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                      <span>{item.name} × {item.quantity}</span>
                      <span className="coa-mono" style={{ fontWeight: 600 }}>฿{((item.sellingPrice || 0) * (item.quantity || 1)).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: "1px dashed var(--border)", paddingTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="text-muted">Subtotal:</span>
                    <span className="coa-mono">฿{(selectedReceipt.subtotal || selectedReceipt.totalAmount || 0).toFixed(2)}</span>
                  </div>
                  {selectedReceipt.discountAmount > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#dc2626" }}>
                      <span>Discount ({selectedReceipt.discountReason || "Offer"}):</span>
                      <span className="coa-mono">-฿{selectedReceipt.discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.1rem", fontWeight: 800, marginTop: "0.25rem", color: "var(--primary, #047857)" }}>
                    <span>Total Amount:</span>
                    <span className="coa-mono">฿{(selectedReceipt.totalAmount || selectedReceipt.amount || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", justifyContent: "flex-end" }}>
                <button className="btn btn-outline btn-sm" onClick={() => setSelectedReceipt(null)}>{tr("common.close")}</button>
                <button className="btn btn-primary btn-sm" onClick={() => printReceipt(selectedReceipt)}>🖨 Print Receipt</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );

  function activeTabModal(type: "sales" | "bills" | "khata" | "stock") {
    if (activeModal !== type) return null;

    return (
      <ModalPortal onClose={() => setActiveModal(null)}>
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content" style={{ maxWidth: 780, width: "95vw", maxHeight: "90vh", display: "flex", flexDirection: "column", padding: "1.25rem" }} onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.3rem" }}>
                  {type === "sales" ? "💰" : type === "bills" ? "🧾" : type === "khata" ? "📋" : "📦"}
                </span>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.15rem" }}>
                    {type === "sales" && tr("dashboard.salesModalTitle")}
                    {type === "bills" && tr("dashboard.billsModalTitle")}
                    {type === "khata" && tr("dashboard.khataModalTitle")}
                    {type === "stock" && tr("dashboard.stockModalTitle")}
                  </h3>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Real-time transaction & inventory analytics
                  </span>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setActiveModal(null)}>✕</button>
            </div>

            {/* Top KPI Cards inside Modal */}
            {type === "sales" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.5rem", marginBottom: "1rem" }}>
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "0.5rem 0.75rem", borderRadius: "8px" }}>
                  <span style={{ fontSize: "0.7rem", color: "#166534", fontWeight: 700 }}>GROSS SALES</span>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#047857" }}>฿{salesBreakdown.gross.toFixed(2)}</div>
                </div>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "0.5rem 0.75rem", borderRadius: "8px" }}>
                  <span style={{ fontSize: "0.7rem", color: "#475569", fontWeight: 700 }}>💵 CASH SALES</span>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#1e293b" }}>฿{salesBreakdown.cash.toFixed(2)}</div>
                </div>
                <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: "0.5rem 0.75rem", borderRadius: "8px" }}>
                  <span style={{ fontSize: "0.7rem", color: "#1e40af", fontWeight: 700 }}>📱 PROMPTPAY</span>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#2563eb" }}>฿{salesBreakdown.promptpay.toFixed(2)}</div>
                </div>
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: "0.5rem 0.75rem", borderRadius: "8px" }}>
                  <span style={{ fontSize: "0.7rem", color: "#991b1b", fontWeight: 700 }}>📋 UDHAAR</span>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#dc2626" }}>฿{salesBreakdown.udhaar.toFixed(2)}</div>
                </div>
                <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", padding: "0.5rem 0.75rem", borderRadius: "8px" }}>
                  <span style={{ fontSize: "0.7rem", color: "#c2410c", fontWeight: 700 }}>🏷️ DISCOUNTS</span>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#ea580c" }}>฿{salesBreakdown.discount.toFixed(2)}</div>
                </div>
              </div>
            )}

            {type === "bills" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.5rem", marginBottom: "1rem" }}>
                <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: "0.5rem 0.75rem", borderRadius: "8px" }}>
                  <span style={{ fontSize: "0.7rem", color: "#1e40af", fontWeight: 700 }}>TOTAL BILLS</span>
                  <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#2563eb" }}>{salesBreakdown.totalBills}</div>
                </div>
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "0.5rem 0.75rem", borderRadius: "8px" }}>
                  <span style={{ fontSize: "0.7rem", color: "#166534", fontWeight: 700 }}>AVG BILL VALUE</span>
                  <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#047857" }}>฿{salesBreakdown.avgBill.toFixed(2)}</div>
                </div>
                <div style={{ background: "#faf5ff", border: "1px solid #e9d5ff", padding: "0.5rem 0.75rem", borderRadius: "8px" }}>
                  <span style={{ fontSize: "0.7rem", color: "#6b21a8", fontWeight: 700 }}>TOTAL ITEMS SOLD</span>
                  <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#9333ea" }}>{salesBreakdown.itemsCount} pcs</div>
                </div>
              </div>
            )}

            {type === "khata" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.5rem", marginBottom: "1rem" }}>
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: "0.6rem 0.85rem", borderRadius: "8px" }}>
                  <span style={{ fontSize: "0.7rem", color: "#991b1b", fontWeight: 700 }}>TOTAL PENDING UDHAAR</span>
                  <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#dc2626" }}>฿{khataDueTotal.toFixed(2)}</div>
                </div>
                <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", padding: "0.6rem 0.85rem", borderRadius: "8px" }}>
                  <span style={{ fontSize: "0.7rem", color: "#c2410c", fontWeight: 700 }}>DUE CUSTOMERS</span>
                  <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#ea580c" }}>{filteredKhataCustomers.length} Users</div>
                </div>
              </div>
            )}

            {type === "stock" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.5rem", marginBottom: "1rem" }}>
                <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", padding: "0.6rem 0.85rem", borderRadius: "8px" }}>
                  <span style={{ fontSize: "0.7rem", color: "#c2410c", fontWeight: 700 }}>LOW STOCK ITEMS</span>
                  <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#ea580c" }}>{lowStockItems.length} Products</div>
                </div>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "0.6rem 0.85rem", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <span style={{ fontSize: "0.7rem", color: "#475569", fontWeight: 700 }}>QUICK ACTION</span>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1e293b" }}>Open Stock Manager</div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => { setActiveModal(null); onNavigate?.("inventory"); }}>
                    📦 Manage Stock
                  </button>
                </div>
              </div>
            )}

            {/* Filter & Search Bar inside Modal */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
              <input
                type="text"
                className="input-field"
                placeholder={type === "khata" ? "Search customer name or phone..." : type === "stock" ? "Search product or category..." : "Search bill #, customer or item..."}
                style={{ flex: 1, minWidth: 200, padding: "0.45rem 0.75rem", fontSize: "0.85rem" }}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />

              {(type === "sales" || type === "bills") && (
                <div style={{ display: "flex", gap: "0.3rem" }}>
                  {["all", "Cash", "PromptPay", UDHAAR_MODE].map(mode => (
                    <button
                      key={mode}
                      className={`btn btn-sm ${filterMode === mode ? "btn-primary" : "btn-outline"}`}
                      onClick={() => setFilterMode(mode)}
                      style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}
                    >
                      {mode === "all" ? "All Modes" : mode}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Body Table Container */}
            <div style={{ flex: 1, overflowY: "auto", border: "1px solid var(--border)", borderRadius: "8px" }}>
              {(type === "sales" || type === "bills") && (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead style={{ position: "sticky", top: 0, background: "var(--card-bg, #f8fafc)", borderBottom: "1px solid var(--border)", zIndex: 1 }}>
                    <tr>
                      <th style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}>Time / Bill #</th>
                      <th style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}>Customer</th>
                      <th style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}>Mode</th>
                      <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>Items</th>
                      <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>Discount</th>
                      <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>Total (฿)</th>
                      <th style={{ textAlign: "center", padding: "0.5rem 0.75rem" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTodayTx.map((t: any) => (
                      <tr key={t.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "0.5rem 0.75rem" }}>
                          <div style={{ fontWeight: 600 }}>{new Date(t.timestamp || Date.now()).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</div>
                          <div className="text-muted coa-mono" style={{ fontSize: "0.7rem" }}>#{t.id}</div>
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem" }}>{t.customerName || t.customer || "Walk-in Customer"}</td>
                        <td style={{ padding: "0.5rem 0.75rem" }}>
                          <span className="badge" style={{ fontSize: "0.7rem", padding: "2px 6px", background: t.paymentMode === "Cash" ? "#dcfce7" : t.paymentMode === UDHAAR_MODE ? "#fee2e2" : "#dbeafe", color: t.paymentMode === "Cash" ? "#166534" : t.paymentMode === UDHAAR_MODE ? "#991b1b" : "#1e40af", fontWeight: 700 }}>
                            {t.paymentMode || "Cash"}
                          </span>
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>{(t.items || []).reduce((s: number, i: any) => s + (i.quantity || 1), 0)} pcs</td>
                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", color: t.discountAmount ? "#dc2626" : "inherit" }}>
                          {t.discountAmount ? `-฿${t.discountAmount.toFixed(2)}` : "—"}
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontWeight: 700 }} className="coa-mono">
                          ฿{(t.totalAmount || t.amount || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setSelectedReceipt(t)} style={{ padding: "2px 6px", fontSize: "0.75rem" }}>
                            👁️ Receipt
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredTodayTx.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                          No matching transactions found for today.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {type === "khata" && (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead style={{ position: "sticky", top: 0, background: "var(--card-bg, #f8fafc)", borderBottom: "1px solid var(--border)", zIndex: 1 }}>
                    <tr>
                      <th style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}>Customer Name</th>
                      <th style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}>Phone Number</th>
                      <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>Outstanding Balance (฿)</th>
                      <th style={{ textAlign: "center", padding: "0.5rem 0.75rem" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredKhataCustomers.map((c: any) => (
                      <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>{c.name}</td>
                        <td style={{ padding: "0.5rem 0.75rem" }} className="text-muted">{c.phone || "—"}</td>
                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontWeight: 800, color: "#dc2626" }} className="coa-mono">
                          ฿{(c.balance || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                          <button className="btn btn-outline btn-sm" onClick={() => { setActiveModal(null); onNavigate?.("khata"); }} style={{ padding: "2px 8px", fontSize: "0.75rem" }}>
                            📋 View Khata
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredKhataCustomers.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                          No pending Udhaar customers found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {type === "stock" && (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead style={{ position: "sticky", top: 0, background: "var(--card-bg, #f8fafc)", borderBottom: "1px solid var(--border)", zIndex: 1 }}>
                    <tr>
                      <th style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}>Product Name</th>
                      <th style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}>Category</th>
                      <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>Current Stock</th>
                      <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>Alert Limit</th>
                      <th style={{ textAlign: "center", padding: "0.5rem 0.75rem" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLowStockProducts.map((p: any) => (
                      <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>{p.name}</td>
                        <td style={{ padding: "0.5rem 0.75rem" }} className="text-muted">{p.category || "General"}</td>
                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontWeight: 800, color: (p.stock || 0) <= 0 ? "#dc2626" : "#ea580c" }} className="coa-mono">
                          {p.stock || 0} {p.isCigarette ? "sticks" : "units"}
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "right" }} className="text-muted coa-mono">
                          {p.lowStockLimit ?? 5}
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                          <span className="badge" style={{ fontSize: "0.7rem", padding: "2px 6px", background: (p.stock || 0) <= 0 ? "#fee2e2" : "#ffedd5", color: (p.stock || 0) <= 0 ? "#991b1b" : "#c2410c", fontWeight: 700 }}>
                            {(p.stock || 0) <= 0 ? "Out of Stock" : "Low Stock"}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredLowStockProducts.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                          No low stock inventory warnings.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border)" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Showing {type === "sales" || type === "bills" ? filteredTodayTx.length : type === "khata" ? filteredKhataCustomers.length : filteredLowStockProducts.length} entries
              </span>
              <button className="btn btn-outline btn-sm" onClick={() => setActiveModal(null)}>
                {tr("common.close")}
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
    );
  }
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
    border: "1px solid",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
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
    color: "var(--text-muted, #94a3b8)",
    fontWeight: 700,
  },
  value: {
    fontSize: "1.1rem",
    fontWeight: 800,
    lineHeight: 1.2,
  },
  label: {
    fontSize: "0.65rem",
    fontWeight: 700,
    color: "var(--text-muted, #64748b)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  subtitle: {
    fontSize: "0.62rem",
    color: "var(--text-muted, #64748b)",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
};
