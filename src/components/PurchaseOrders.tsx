import { useState, useEffect } from "react";
import { dbService } from "../firebase";
import { getLocalProducts } from "../db/storage";

export default function PurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { load(); }, []);

  const load = () => {
    setOrders(dbService.getPurchaseOrders());
    setProducts(getLocalProducts());
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>📦 Purchase Orders</h2>
        <button onClick={() => setShowForm(true)} className="btn btn-primary" style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem" }}>
          + New Order
        </button>
      </div>

      {showForm && <PurchaseOrderForm products={products} onSave={() => { setShowForm(false); load(); }} onCancel={() => setShowForm(false)} />}

      {orders.length === 0 ? (
        <p style={styles.empty}>No purchase orders yet.</p>
      ) : (
        <div style={styles.list}>
          {orders.map(order => (
            <div key={order.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <span style={styles.supplier}>{order.supplier}</span>
                  <span style={styles.date}>{new Date(order.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
                <span style={{
                  ...styles.status,
                  color: order.status === "completed" ? "#047857" : order.status === "cancelled" ? "#dc2626" : "#d97706",
                  background: order.status === "completed" ? "#f0fdf4" : order.status === "cancelled" ? "#fef2f2" : "#fef3c7",
                }}>
                  {order.status === "completed" ? "✓ Received" : order.status === "cancelled" ? "✕ Cancelled" : "⏳ Pending"}
                </span>
              </div>
              <div style={styles.items}>
                {order.items?.map((item, i) => (
                  <div key={i} style={styles.itemRow}>
                    <span style={styles.itemName}>{item.productName} {item.isPack ? `(×${item.packSize})` : ""}</span>
                    <span style={styles.itemQty}>×{item.quantity}</span>
                    <span style={styles.itemCost}>฿{(item.costPrice || 0).toFixed(0)}</span>
                  </div>
                ))}
              </div>
              <div style={styles.footer}>
                <span style={styles.total}>Total: ฿{order.total?.toFixed(0)}</span>
                <div style={styles.actions}>
                  {order.status === "pending" && (
                    <>
                      <button onClick={() => { dbService.receivePurchaseOrder(order.id); load(); }} className="btn btn-primary" style={{ padding: "2px 8px", fontSize: "0.7rem", borderRadius: "4px" }}>
                        Receive
                      </button>
                      <button onClick={() => { dbService.cancelPurchaseOrder(order.id); load(); }} className="btn btn-outline" style={{ padding: "2px 8px", fontSize: "0.7rem", borderRadius: "4px" }}>
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
    </div>
  );
}

function PurchaseOrderForm({ products, onSave, onCancel }) {
  const [supplier, setSupplier] = useState("");
  const [items, setItems] = useState([{ productId: "", quantity: 1 }]);
  const [notes, setNotes] = useState("");

  const addItem = () => setItems(prev => [...prev, { productId: "", quantity: 1 }]);
  const updateItem = (idx, field, val) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };
  const removeItem = (idx) => {
    setItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  };

  const handleSubmit = () => {
    if (!supplier.trim()) { alert("Enter supplier name"); return; }
    const validItems = items.filter(i => i.productId && i.quantity > 0);
    if (validItems.length === 0) { alert("Add at least one item"); return; }
    const total = validItems.reduce((sum, item) => {
      const prod = products.find(p => p.id === item.productId);
      return sum + ((item.isPack ? (prod?.costPricePack || 0) : (prod?.costPrice || 0)) * item.quantity);
    }, 0);

    const order = {
      supplier: supplier.trim(),
      items: validItems.map(item => {
        const prod = products.find(p => p.id === item.productId);
        return {
          productId: item.productId,
          productName: prod?.name || "Unknown",
          quantity: parseInt(item.quantity) || 0,
          isPack: item.isPack || false,
          packSize: prod?.packSize || 20,
          costPrice: item.isPack ? (prod?.costPricePack || 0) : (prod?.costPrice || 0),
        };
      }),
      total,
      status: "pending",
      createdAt: Date.now(),
      notes: notes.trim(),
      createdBy: JSON.parse(localStorage.getItem("pan_user") || "{}")?.name || "System",
    };
    dbService.savePurchaseOrder(order);
    onSave();
  };

  return (
    <div style={styles.formCard}>
      <h3 style={styles.formTitle}>New Purchase Order</h3>
      <div className="input-group">
        <label className="input-label">Supplier</label>
        <input type="text" value={supplier} onChange={e => setSupplier(e.target.value)} className="input-field" placeholder="Supplier name" />
      </div>

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
              <input type="number" value={item.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} style={{ width: "60px", padding: "0.4rem", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "0.8rem", textAlign: "center" }} min="1" />
              {prod?.isCigarette && (
                <label style={{ fontSize: "0.7rem", display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer" }}>
                  <input type="checkbox" checked={item.isPack || false} onChange={e => updateItem(i, "isPack", e.target.checked)} /> Box
                </label>
              )}
              {prod && <span style={{ fontSize: "0.75rem", color: "#64748b", minWidth: "50px", textAlign: "right" }}>฿{((item.isPack ? prod.costPricePack : prod.costPrice) * item.quantity).toFixed(0)}</span>}
              <button onClick={() => removeItem(i)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: "0.8rem" }}>✕</button>
            </div>
          );
        })}
        <button onClick={addItem} style={{ ...styles.addItemBtn }}>+ Add Item</button>
      </div>

      <div className="input-group">
        <label className="input-label">Notes (optional)</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="input-field" placeholder="Order notes..." />
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
        <button onClick={handleSubmit} className="btn btn-primary" style={{ flex: 1 }}>Create Order</button>
        <button onClick={onCancel} className="btn btn-outline" style={{ flex: 1 }}>Cancel</button>
      </div>
    </div>
  );
}

const styles = {
  container: { display: "flex", flexDirection: "column", gap: "1rem" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  title: { color: "#047857", fontSize: "1.1rem", fontWeight: 700, margin: 0 },
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
