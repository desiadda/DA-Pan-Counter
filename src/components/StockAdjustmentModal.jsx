import { useState } from "react";
import ModalPortal from "./ModalPortal";
import { dbService } from "../firebase";
import { logError } from "../db/errorLog";
import { ADJUSTMENT_REASONS } from "../constants";

export default function StockAdjustmentModal({ product, onClose, onApplied }) {
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("Restock");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const parsed = parseFloat(qty);
    if (!parsed || parsed === 0) {
      alert("Enter a quantity (use +/- for add/remove).");
      return;
    }
    if (submitting) return;
    try {
      setSubmitting(true);
      await dbService.addStockAdjustment({ productId: product.id, qty: parsed, reason, note: note.trim() });
      onApplied?.();
      onClose();
    } catch (err) {
      logError("INVENTORY", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to adjust stock"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" style={{ maxWidth: "420px" }} onClick={e => e.stopPropagation()}>
          <h3 className="section-subtitle" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", marginBottom: "0.75rem" }}>
            Stock Adjustment
          </h3>
          <div style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>
            <div style={{ fontWeight: 700, color: "var(--text)" }}>{product.name}</div>
            <div className="text-muted">Current stock: <b>{product.stock}</b>{(product.isCigarette ? ` (${product.stockPack ?? Math.floor(product.stock / (product.packSize || 20))} box + ${product.stockLoose ?? (product.stock % (product.packSize || 20))} pcs)` : "")}</div>
          </div>
          <div className="input-group">
            <label className="input-label">Quantity (+ add / − remove)</label>
            <input type="number" value={qty} onChange={e => setQty(e.target.value)} className="input-field" placeholder="e.g. 10 or -5" autoFocus />
          </div>
          <div className="input-group">
            <label className="input-label">Reason</label>
            <select value={reason} onChange={e => setReason(e.target.value)} className="input-field">
              {ADJUSTMENT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Note (optional)</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} className="input-field" placeholder="e.g. found damaged boxes" />
          </div>
          <div className="flex-btn-group" style={{ marginTop: "1rem" }}>
            <button onClick={handleSubmit} disabled={submitting} className="btn btn-primary">{submitting ? "Saving..." : "Apply Adjustment"}</button>
            <button onClick={onClose} className="btn btn-outline">Cancel</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
