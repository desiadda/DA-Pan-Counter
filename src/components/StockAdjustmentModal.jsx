import { useState } from "react";
import ModalPortal from "./ModalPortal";
import { dbService } from "../firebase";
import { logError } from "../db/errorLog";
import { ADJUSTMENT_REASONS } from "../constants";
import { useLangStore } from "../stores/langStore";
import { useT } from "../lang/translations";

export default function StockAdjustmentModal({ product, onClose, onApplied }) {
  const lang = useLangStore((s) => s.lang);
  const tr = useT(lang);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("Restock");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const parsed = parseFloat(qty);
    if (!parsed || parsed === 0) {
      alert(tr("stock.enterQty"));
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
      alert("❌ " + (err.message || tr("stock.failed")));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" style={{ maxWidth: "420px" }} onClick={e => e.stopPropagation()}>
          <h3 className="section-subtitle" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", marginBottom: "0.75rem" }}>
            {tr("stock.adjustTitle")}
          </h3>
          <div style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>
            <div style={{ fontWeight: 700, color: "var(--text)" }}>{product.name}</div>
            <div className="text-muted">Current stock: <b>{product.stock}</b>{(product.isCigarette ? ` (${product.stockPack ?? Math.floor(product.stock / (product.packSize || 20))} box + ${product.stockLoose ?? (product.stock % (product.packSize || 20))} pcs)` : "")}</div>
          </div>
          <div className="input-group">
            <label className="input-label">{tr("stock.qty")} (+ add / − remove)</label>
            <input type="number" value={qty} onChange={e => setQty(e.target.value)} className="input-field" placeholder="e.g. 10 or -5" autoFocus />
          </div>
          <div className="input-group">
            <label className="input-label">{tr("stock.reasons")}</label>
            <select value={reason} onChange={e => setReason(e.target.value)} className="input-field">
              {ADJUSTMENT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">{tr("stock.note")}</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} className="input-field" placeholder="e.g. found damaged boxes" />
          </div>
          <div className="flex-btn-group" style={{ marginTop: "1rem" }}>
            <button onClick={handleSubmit} disabled={submitting} className="btn btn-primary">{submitting ? tr("supplier.saving") : tr("stock.apply")}</button>
            <button onClick={onClose} className="btn btn-outline">{tr("common.cancel")}</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
