import { useState, useEffect } from "react";
import ModalPortal from "./ModalPortal";
import { dbService } from "../firebase";
import { useDBStore } from "../stores/dbStore";
import { db, isFirebaseEnabled } from "../db/config";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { logError } from "../db/errorLog";
import { DEFAULT_PACK_SIZE } from "../constants";

const toUnitQty = (item) => {
  const q = item.isPack ? (item.quantity || item.returnQty || 0) * (item.packSize || DEFAULT_PACK_SIZE) : (item.quantity || item.returnQty || 0);
  return q;
};

export default function StockMovementModal({ product, onClose }) {
  const transactions = useDBStore((s) => s.transactions);
  const [purchases, setPurchases] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isFirebaseEnabled && db) {
      const unsubPurch = onSnapshot(collection(db, "purchases"), (snap) => {
        setPurchases(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (err) => logError("INVENTORY", err.message, err.stack));
      const unsubAdj = onSnapshot(query(collection(db, "stock_adjustments"), orderBy("timestamp", "desc")), (snap) => {
        setAdjustments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (err) => logError("INVENTORY", err.message, err.stack));
      setLoading(false);
      return () => { unsubPurch(); unsubAdj(); };
    } else {
      Promise.all([dbService.getPurchaseOrders(), dbService.getStockAdjustments()])
        .then(([p, a]) => { setPurchases(p || []); setAdjustments(a || []); })
        .catch(err => logError("INVENTORY", err.message, err.stack))
        .finally(() => setLoading(false));
    }
  }, []);

  const movements = [];
  transactions.forEach(tx => {
    if (tx.type === "return") {
      (tx.items || []).forEach(i => {
        if ((i.realProductId || i.productId) === product.id) {
          movements.push({ ts: tx.timestamp, type: "Return", qty: toUnitQty(i), actor: tx.cashierName || "System", ref: tx.id || "" });
        }
      });
    } else {
      (tx.items || []).forEach(i => {
        if ((i.realProductId || i.productId) === product.id) {
          movements.push({ ts: tx.timestamp, type: "Sale", qty: -toUnitQty(i), actor: tx.cashierName || "System", ref: tx.id || "" });
        }
      });
    }
  });
  purchases.forEach(o => {
    if (o.status !== "received") return;
    (o.items || []).forEach(i => {
      if (i.productId === product.id) {
        movements.push({ ts: o.receivedAt || o.createdAt || 0, type: "Purchase", qty: toUnitQty(i), actor: o.createdBy || "System", ref: o.id || "" });
      }
    });
  });
  adjustments.forEach(a => {
    if (a.productId !== product.id) return;
    movements.push({ ts: a.timestamp, type: "Adjustment", qty: a.qty, actor: a.actorName || "System", ref: a.reason || "", note: a.note || "" });
  });

  movements.sort((a, b) => a.ts - b.ts);

  const openingBatch = (product.batches || [])
    .filter(b => b.quantity > 0)
    .sort((a, b) => a.createdAt - b.createdAt)[0];

  let running = 0;
  const rows = movements.map(m => {
    running += m.qty;
    return { ...m, running };
  });

  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" style={{ maxWidth: "520px", maxHeight: "80vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
          <div style={{ paddingBottom: "0.5rem", borderBottom: "1px solid var(--border)" }}>
            <h3 className="section-subtitle" style={{ margin: 0 }}>📈 Stock Movement — {product.name}</h3>
            <div className="text-muted" style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
              Current: <b>{product.stock}</b> · Opening batch: {openingBatch ? `฿${openingBatch.costPrice.toFixed(2)} × ${openingBatch.quantity} (${new Date(openingBatch.createdAt).toLocaleDateString()})` : "—"}
            </div>
          </div>

          <div style={{ overflowY: "auto", flex: 1, marginTop: "0.5rem" }}>
            {loading ? (
              <div className="text-muted" style={{ textAlign: "center", padding: "2rem" }}>Loading...</div>
            ) : rows.length === 0 ? (
              <div className="coh-empty">No movements recorded yet for this product.</div>
            ) : (
              <table className="inventory-table" style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "0.4rem 0.4rem", textAlign: "left", color: "var(--text-muted)" }}>Date</th>
                    <th style={{ padding: "0.4rem 0.4rem", textAlign: "left", color: "var(--text-muted)" }}>Type</th>
                    <th style={{ padding: "0.4rem 0.4rem", textAlign: "right", color: "var(--text-muted)" }}>Qty</th>
                    <th style={{ padding: "0.4rem 0.4rem", textAlign: "right", color: "var(--text-muted)" }}>Balance</th>
                    <th style={{ padding: "0.4rem 0.4rem", textAlign: "left", color: "var(--text-muted)" }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{new Date(r.ts).toLocaleDateString("en-GB")}</td>
                      <td style={{ padding: "0.4rem" }}>
                        <span style={{
                          fontSize: "0.7rem", fontWeight: 700, padding: "2px 6px", borderRadius: "4px",
                          background: r.type === "Sale" ? "#fef2f2" : r.type === "Purchase" ? "#f0fdf4" : r.type === "Return" ? "#eff6ff" : "#fef3c7",
                          color: r.type === "Sale" ? "#dc2626" : r.type === "Purchase" ? "#047857" : r.type === "Return" ? "#2563eb" : "#b45309",
                        }}>{r.type}</span>
                      </td>
                      <td style={{ padding: "0.4rem", textAlign: "right", fontWeight: 600, color: r.qty >= 0 ? "#047857" : "#dc2626" }}>
                        {r.qty > 0 ? "+" : ""}{r.qty}
                      </td>
                      <td style={{ padding: "0.4rem", textAlign: "right", fontWeight: 700 }}>{r.running}</td>
                      <td style={{ padding: "0.4rem", color: "var(--text-muted)", fontSize: "0.72rem" }}>
                        {r.note || r.ref || r.actor ? `${r.actor}${r.note ? ` · ${r.note}` : ""}${r.ref && r.type !== "Adjustment" ? ` · #${r.ref.replace(/^tx_/, "").slice(-6)}` : ""}` : "—"}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={3} style={{ padding: "0.5rem 0.4rem", fontWeight: 700, borderTop: "2px solid var(--border)" }}>Closing balance (computed)</td>
                    <td style={{ padding: "0.5rem 0.4rem", textAlign: "right", fontWeight: 800, borderTop: "2px solid var(--border)", color: running === product.stock ? "#047857" : "#dc2626" }}>
                      {running}
                    </td>
                    <td style={{ padding: "0.5rem 0.4rem", fontSize: "0.72rem", borderTop: "2px solid var(--border)", color: "var(--text-muted)" }}>
                      {running === product.stock ? "✓ matches system stock" : `⚠️ system shows ${product.stock}`}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          <div style={{ marginTop: "1rem" }}>
            <button onClick={onClose} className="btn btn-outline" style={{ width: "100%" }}>Close</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
