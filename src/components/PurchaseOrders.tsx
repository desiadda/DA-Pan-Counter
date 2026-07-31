import { useState, useEffect } from "react";
import { dbService } from "../firebase";
import { db, isFirebaseEnabled } from "../db/config";
import { collection, onSnapshot } from "firebase/firestore";
import { useLangStore } from "../stores/langStore";
import { useDBStore } from "../stores/dbStore";
import { useConfirmStore } from "../stores/confirmStore";
import { DEFAULT_PACK_SIZE, UDHAAR_MODE } from "../constants";
import ModalPortal from "./ModalPortal";

export default function PurchaseOrders({ prefill, onPrefillConsumed }) {
  const lang = useLangStore((s) => s.lang);
  const confirm = useConfirmStore((s) => s.confirm);
  const paymentModes = useDBStore((s) => s.paymentModes);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [isDirectPurchase, setIsDirectPurchase] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [receivingOrder, setReceivingOrder] = useState(null);
  const [receivePaymentMode, setReceivePaymentMode] = useState("Credit");

  useEffect(() => {
    if (prefill && prefill.length > 0) {
      setIsDirectPurchase(false);
      setShowForm(true);
      setFormKey(k => k + 1);
    }
  }, [prefill]);

  useEffect(() => {
    if (isFirebaseEnabled && db) {
      const unsubPurchs = onSnapshot(collection(db, "purchases"), (snap) => {
        setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      const unsubProds = onSnapshot(collection(db, "products"), (snap) => {
        setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      const unsubSups = onSnapshot(collection(db, "suppliers"), (snap) => {
        setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return () => {
        unsubPurchs();
        unsubProds();
        unsubSups();
      };
    } else {
      load();
    }
  }, []);

  const load = async () => {
    const [ordersList, productsList, suppliersList] = await Promise.all([
      dbService.getPurchaseOrders(),
      dbService.getProducts(),
      dbService.getSuppliers()
    ]);
    setOrders(ordersList || []);
    setProducts(productsList || []);
    setSuppliers(suppliersList || []);
  };

  const receiveOrder = async (order) => {
    setReceivePaymentMode("Credit");
    setReceivingOrder(order);
  };

  const confirmReceive = async () => {
    if (!receivingOrder || !receivePaymentMode) return;
    await dbService.receivePurchaseOrder(receivingOrder.id, receivePaymentMode);
    setReceivingOrder(null);
    load();
  };

  const cancelOrder = async (order) => {
    const ok = await confirm(
      `Cancel PO from ${order.supplier}?`,
      { title: "Cancel Purchase Order", confirmLabel: "Cancel PO", cancelLabel: "Back" }
    );
    if (!ok) return;
    await dbService.cancelPurchaseOrder(order.id);
    load();
  };

  const receiveModes = (paymentModes || []).filter(m => m.enabled);
  const receiveModeLabel = (id) => {
    const m = receiveModes.find(x => x.id === id);
    if (!m) return id === UDHAAR_MODE ? "Credit (Khata)" : id;
    return m.id === UDHAAR_MODE ? "Credit (Khata)" : m.id === "Cash" ? "Cash (COH)" : m.name;
  };
  const receiveSettlementHint = receivePaymentMode === "Credit"
    ? "💳 Supplier khata (balance) mein add hoga — baad mein '💸 Pay Supplier' se settle karenge."
    : receivePaymentMode === "Cash"
      ? "💰 Cash drawer (COH) se payment hoga — COH balance se kat jayega."
      : "🏦 Is mode se payment record hoga — COH aur supplier balance change nahi hoga.";

  const sortedOrders = [...orders].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const q = searchQuery.trim().toLowerCase();
  const filteredOrders = sortedOrders.filter(o =>
    (statusFilter === "all" || o.status === statusFilter) &&
    (!q || (o.supplier || "").toLowerCase().includes(q))
  );

  const pendingCount = orders.filter(o => o.status === "pending").length;
  const receivedTotal = orders
    .filter(o => o.status === "received")
    .reduce((sum, o) => sum + (o.total || 0), 0);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>📦 Purchases & POs</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={() => { setIsDirectPurchase(false); setShowForm(true); }} className="btn btn-primary" style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem" }}>
            + New PO
          </button>
          <button onClick={() => { setIsDirectPurchase(true); setShowForm(true); }} className="btn btn-outline" style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem", color: "var(--primary-color)" }}>
            + Direct Purchase
          </button>
        </div>
      </div>

      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <span style={styles.statValue}>{orders.length}</span>
          <span style={styles.statLabel}>Total POs</span>
        </div>
        <div style={styles.statCard}>
          <span style={{ ...styles.statValue, color: "#d97706" }}>{pendingCount}</span>
          <span style={styles.statLabel}>Pending</span>
        </div>
        <div style={styles.statCard}>
          <span style={{ ...styles.statValue, color: "#047857" }}>฿{receivedTotal.toFixed(0)}</span>
          <span style={styles.statLabel}>Received Value</span>
        </div>
      </div>

      <div style={styles.filterBar}>
        <div style={styles.filterTabs}>
          {[
            { key: "all", label: `All (${orders.length})` },
            { key: "pending", label: `⏳ Pending (${orders.filter(o => o.status === "pending").length})` },
            { key: "received", label: `✓ Received (${orders.filter(o => o.status === "received").length})` },
            { key: "cancelled", label: `✕ Cancelled (${orders.filter(o => o.status === "cancelled").length})` },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setStatusFilter(t.key)}
              style={{ ...styles.filterTab, ...(statusFilter === t.key ? styles.filterTabActive : {}) }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search supplier..."
          style={styles.searchInput}
        />
      </div>

      {showForm && (
        <PurchaseOrderForm
          key={formKey}
          initialItems={prefill && prefill.length > 0 ? prefill : null}
          products={products}
          suppliers={suppliers}
          orders={orders}
          paymentModes={paymentModes}
          lang={lang}
          isDirect={isDirectPurchase}
          onSave={() => { setShowForm(false); onPrefillConsumed?.(); load(); }}
          onCancel={() => { setShowForm(false); onPrefillConsumed?.(); }}
        />
      )}

      {orders.length === 0 ? (
        <p style={styles.empty}>No purchase orders yet.</p>
      ) : filteredOrders.length === 0 ? (
        <p style={styles.empty}>No orders match the current filter.</p>
      ) : (
        <div style={styles.list}>
          {filteredOrders.map(order => (
            <div key={order.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <span style={styles.supplier}>{order.supplier}</span>
                  {order.paymentMode && (
                    <span style={{ fontSize: "0.7rem", color: "#475569", background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px", marginLeft: "0.5rem", fontWeight: 600 }}>
                      {order.paymentMode}
                    </span>
                  )}
                  <span style={styles.date}>{new Date(order.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
                <span style={{
                  ...styles.status,
                  color: order.status === "received" ? "#047857" : order.status === "cancelled" ? "#dc2626" : "#d97706",
                  background: order.status === "received" ? "#f0fdf4" : order.status === "cancelled" ? "#fef2f2" : "#fef3c7",
                }}>
                  {order.status === "received" ? "✓ Received" : order.status === "cancelled" ? "✕ Cancelled" : "⏳ Pending"}
                </span>
              </div>
              <div style={styles.items}>
                {order.items?.map((item, i) => (
                  <div key={i} style={styles.itemRow}>
                    <span style={styles.itemName}>{item.productName} {item.isPack ? `(×${item.packSize})` : ""}</span>
                    <span style={styles.itemQty}>×{item.quantity}</span>
                    <span style={styles.itemCost}>฿{(item.costPrice * item.quantity).toFixed(0)}</span>
                  </div>
                ))}
              </div>
              <div style={styles.footer}>
                <span style={styles.total}>Total: ฿{order.total?.toFixed(0)}</span>
                <div style={styles.actions}>
                  {order.status === "pending" && (
                    <>
                      <button onClick={() => receiveOrder(order)} className="btn btn-primary" style={{ padding: "2px 8px", fontSize: "0.7rem", borderRadius: "4px" }}>
                        Receive
                      </button>
                      <button onClick={() => cancelOrder(order)} className="btn btn-outline" style={{ padding: "2px 8px", fontSize: "0.7rem", borderRadius: "4px" }}>
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {receivingOrder && (
        <ModalPortal onClose={() => setReceivingOrder(null)}>
          <div
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100,
              display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
            }}
            onClick={() => setReceivingOrder(null)}
          >
            <div
              style={{
                background: "#fff", borderRadius: "14px", width: "100%", maxWidth: "420px",
                display: "flex", flexDirection: "column", gap: "0.75rem", padding: "1rem",
              }}
              onClick={e => e.stopPropagation()}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#1e293b" }}>📦 Receive PO</h3>
                <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px" }}>
                  {receivingOrder.supplier} · {receivingOrder.items?.length || 0} item(s) · Total: <strong>฿{(receivingOrder.total || 0).toFixed(0)}</strong>
                </div>
              </div>

              <div>
                <label className="input-label">Payment Mode</label>
                <select
                  value={receivePaymentMode}
                  onChange={e => setReceivePaymentMode(e.target.value)}
                  className="input-field"
                  style={{ fontFamily: "inherit" }}
                >
                  {receiveModes.map(m => (
                    <option key={m.id} value={m.id === UDHAAR_MODE ? "Credit" : m.id}>
                      {m.id === UDHAAR_MODE ? "Credit (Khata)" : m.id === "Cash" ? "Cash (COH)" : m.name}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: "0.75rem", color: "#475569", marginTop: "0.4rem", background: "#f8fafc", borderRadius: "8px", padding: "0.5rem 0.65rem" }}>
                  {receiveSettlementHint}
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button onClick={confirmReceive} className="btn btn-primary" style={{ flex: 1, padding: "0.5rem", fontSize: "0.8rem" }}>
                  ✅ Confirm Receive ({receiveModeLabel(receivePaymentMode)})
                </button>
                <button onClick={() => setReceivingOrder(null)} className="btn btn-outline" style={{ flex: 1, padding: "0.5rem", fontSize: "0.8rem" }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}

function PurchaseOrderForm({ initialItems, products, suppliers, orders, paymentModes, lang, isDirect, onSave, onCancel }) {
  const [supplierId, setSupplierId] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [items, setItems] = useState(initialItems && initialItems.length > 0 ? initialItems : [{ productId: "", quantity: 1, costPrice: 0, isPack: false }]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedSupplier = suppliers.find(s => s.id === supplierId);

  const addItem = () => setItems(prev => [...prev, { productId: "", quantity: 1, costPrice: 0, isPack: false }]);
  
  const updateItem = (idx, field, val) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: val };

      if (field === "productId") {
        const prod = products.find(p => p.id === val);
        if (prod) {
          // Look up last purchase cost for this supplier and product in history
          const lastOrderWithProd = [...orders]
            .sort((a, b) => b.createdAt - a.createdAt)
            .find(o => o.supplierId === supplierId && o.status === "received" && o.items?.some(it => it.productId === val));

          if (lastOrderWithProd) {
            const lastItem = lastOrderWithProd.items.find(it => it.productId === val);
            updated.costPrice = lastItem.costPrice || 0;
            updated.isPack = lastItem.isPack || false;
          } else {
            updated.isPack = false;
            updated.costPrice = prod.costPrice || 0;
          }
        } else {
          updated.costPrice = 0;
          updated.isPack = false;
        }
      }

      if (field === "isPack") {
        const prod = products.find(p => p.id === item.productId);
        if (prod) {
          const lastOrderWithProd = [...orders]
            .sort((a, b) => b.createdAt - a.createdAt)
            .find(o => o.supplierId === supplierId && o.status === "received" && o.items?.some(it => it.productId === item.productId && it.isPack === val));

          if (lastOrderWithProd) {
            const lastItem = lastOrderWithProd.items.find(it => it.productId === item.productId && it.isPack === val);
            updated.costPrice = lastItem.costPrice || 0;
          } else {
            updated.costPrice = val ? (prod.costPricePack || 0) : (prod.costPrice || 0);
          }
        }
      }

      return updated;
    }));
  };

  const removeItem = (idx) => {
    setItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  };

  const handleSubmit = async () => {
    if (!supplierId || !selectedSupplier) { alert("Please select a supplier first."); return; }
    if (submitting) return;
    const validItems = items.filter(i => i.productId && i.quantity > 0);
    if (validItems.length === 0) { alert("Add at least one item"); return; }
    
    const total = validItems.reduce((sum, item) => sum + ((item.costPrice || 0) * item.quantity), 0);
    const user = JSON.parse(localStorage.getItem("pan_user") || "{}");

    const order = {
      supplier: selectedSupplier.name,
      supplierId: selectedSupplier.id,
      ...(isDirect ? { paymentMode } : {}),
      items: validItems.map(item => {
        const prod = products.find(p => p.id === item.productId);
        return {
          productId: item.productId,
          productName: prod?.name || "Unknown",
          quantity: parseInt(item.quantity) || 0,
          isPack: item.isPack || false,
          packSize: prod?.packSize || DEFAULT_PACK_SIZE,
          costPrice: parseFloat(item.costPrice) || 0,
        };
      }),
      total,
      status: isDirect ? "received" : "pending",
      createdAt: Date.now(),
      notes: notes.trim(),
      createdById: user.id || "system",
      createdBy: user.name || "System",
    };

    try {
      setSubmitting(true);
      await dbService.savePurchaseOrder(order);
      onSave();
    } catch (e) {
      alert("❌ Failed to create purchase record: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.formCard}>
      <h3 style={styles.formTitle}>{isDirect ? "Direct Purchase / Bill Entry" : "New Purchase Order"}</h3>
      
      <div className="input-group" style={{ display: "flex", gap: "1rem" }}>
        <div style={{ flex: isDirect ? 2 : 1 }}>
          <label className="input-label">Supplier</label>
          <select value={supplierId} onChange={e => { setSupplierId(e.target.value); setItems([{ productId: "", quantity: 1, costPrice: 0, isPack: false }]); }} className="input-field" style={{ fontFamily: "inherit" }}>
            <option value="">Select supplier...</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {isDirect && (
          <div style={{ flex: 1 }}>
            <label className="input-label">Payment Mode</label>
            <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} className="input-field" style={{ fontFamily: "inherit" }}>
              {paymentModes.filter(m => m.enabled).map(m => (
                <option key={m.id} value={m.id === UDHAAR_MODE ? "Credit" : m.id}>
                  {m.id === UDHAAR_MODE ? "Credit (Khata)" : m.id === "Cash" ? "Cash (COH)" : m.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!isDirect && (
        <div style={{ padding: "0.5rem 0.75rem", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", fontSize: "0.75rem", color: "#92400e" }}>
          📌 PO bina payment ke banega — goods receive karte time payment mode choose karenge. Credit (Khata) hua to baad mein Pay Supplier se settle hoga.
        </div>
      )}

      {!supplierId ? (
        <div style={{ padding: "1rem", textAlign: "center", color: "#64748b", border: "1px dashed #cbd5e1", borderRadius: "8px", margin: "1rem 0", fontSize: "0.85rem" }}>
          {lang === "hi" 
            ? "⚠️ कृपया आइटम जोड़ने के लिए पहले सप्लायर चुनें।"
            : "⚠️ Please select a supplier first to add items."}
        </div>
      ) : (
        <div style={styles.itemsSection}>
          <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569" }}>Items</label>
          {items.map((item, i) => {
            const prod = products.find(p => p.id === item.productId);
            return (
              <div key={i} style={styles.formItemRow}>
                <select value={item.productId} onChange={e => updateItem(i, "productId", e.target.value)} className="input-field" style={{ flex: 1, fontSize: "0.8rem", padding: "0.4rem" }}>
                  <option value="">Select product...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                
                <input
                  type="number"
                  value={item.quantity}
                  onChange={e => updateItem(i, "quantity", e.target.value)}
                  style={{ width: "60px", padding: "0.4rem", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "0.8rem", textAlign: "center" }}
                  min="1"
                />

                {prod?.isCigarette && (
                  <label style={{ fontSize: "0.7rem", display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer", whiteSpace: "nowrap" }}>
                    <input type="checkbox" checked={item.isPack || false} onChange={e => updateItem(i, "isPack", e.target.checked)} /> Box
                  </label>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: "0.15rem" }}>
                  <span style={{ fontSize: "0.8rem", color: "#64748b" }}>฿</span>
                  <input
                    type="number"
                    value={item.costPrice || ""}
                    onChange={e => updateItem(i, "costPrice", parseFloat(e.target.value) || 0)}
                    style={{ width: "70px", padding: "0.4rem", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "0.8rem", textAlign: "right" }}
                    placeholder="Cost"
                  />
                </div>

                {prod && <span style={{ fontSize: "0.75rem", color: "#64748b", minWidth: "50px", textAlign: "right" }}>฿{((item.costPrice || 0) * item.quantity).toFixed(0)}</span>}
                <button onClick={() => removeItem(i)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: "0.8rem" }}>✕</button>
              </div>
            );
          })}
          <button onClick={addItem} style={{ ...styles.addItemBtn }}>+ Add Item</button>
        </div>
      )}

      <div className="input-group">
        <label className="input-label">Notes (optional)</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="input-field" placeholder="Order notes..." />
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
        <button onClick={handleSubmit} disabled={submitting || !supplierId} className="btn btn-primary" style={{ flex: 1 }}>
          {submitting ? "Processing..." : isDirect ? "Record Purchase" : "Create PO"}
        </button>
        <button onClick={onCancel} className="btn btn-outline" style={{ flex: 1 }}>Cancel</button>
      </div>
    </div>
  );
}

const styles = {
  container: { display: "flex", flexDirection: "column", gap: "1rem" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  title: { color: "#047857", fontSize: "1.1rem", fontWeight: 700, margin: 0 },
  statsRow: { display: "flex", gap: "0.5rem", flexWrap: "wrap" },
  statCard: {
    flex: 1, minWidth: "100px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px",
    padding: "0.5rem 0.75rem", display: "flex", flexDirection: "column", gap: "2px",
  },
  statValue: { fontSize: "1.05rem", fontWeight: 800, color: "#1e293b" },
  statLabel: { fontSize: "0.68rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em" },
  filterBar: { display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" },
  filterTabs: { display: "flex", gap: "0.35rem", flexWrap: "wrap" },
  filterTab: {
    background: "#fff", border: "1px solid #e2e8f0", borderRadius: "9999px",
    padding: "0.3rem 0.65rem", fontSize: "0.72rem", fontWeight: 600, color: "#64748b", cursor: "pointer",
  },
  filterTabActive: { background: "#047857", borderColor: "#047857", color: "#fff" },
  searchInput: {
    padding: "0.4rem 0.65rem", borderRadius: "8px", border: "1px solid #e2e8f0",
    fontSize: "0.8rem", minWidth: "150px", flex: "0 1 200px",
  },
  empty: { textAlign: "center", color: "#94a3b8", fontSize: "0.9rem", padding: "2rem" },
  list: { display: "flex", flexDirection: "column", gap: "0.75rem" },
  card: {
    background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0",
    padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem",
  },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  supplier: { fontSize: "0.9rem", fontWeight: 700, color: "#1e293b" },
  date: { fontSize: "0.65rem", color: "#94a3b8", marginLeft: "0.5rem" },
  status: { fontSize: "0.65rem", fontWeight: 700, padding: "2px 8px", borderRadius: "9999px" },
  items: { display: "flex", flexDirection: "column", gap: "2px" },
  itemRow: { display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.78rem" },
  itemName: { flex: 1, color: "#475569", fontWeight: 500 },
  itemQty: { width: "40px", textAlign: "center", fontWeight: 600, color: "#1e293b" },
  itemCost: { width: "60px", textAlign: "right", fontWeight: 600, color: "#64748b" },
  footer: { display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: "0.5rem" },
  total: { fontSize: "0.85rem", fontWeight: 800, color: "#047857" },
  actions: { display: "flex", gap: "0.25rem" },
  formCard: {
    background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0",
    padding: "1rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  formTitle: { fontSize: "0.9rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.75rem" },
  itemsSection: { marginBottom: "0.75rem" },
  formItemRow: { display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.35rem" },
  addItemBtn: {
    background: "none", border: "1px dashed #cbd5e1", borderRadius: "6px",
    padding: "0.3rem", fontSize: "0.75rem", color: "#047857", fontWeight: 600,
    cursor: "pointer", width: "100%", marginTop: "0.25rem",
  },
};
