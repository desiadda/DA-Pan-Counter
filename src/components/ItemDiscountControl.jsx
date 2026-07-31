import { useState } from "react";

export default function ItemDiscountControl({ item, onUpdate, reasons = [] }) {
  const [open, setOpen] = useState(false);
  const lineTotal = (item.sellingPrice || 0) * (item.quantity || 1);
  const value = item.discountValue || 0;
  const amount = item.discountType === "percent"
    ? lineTotal * Math.min(value, 100) / 100
    : item.discountType === "fixed"
      ? Math.min(value, lineTotal)
      : 0;

  const apply = (patch) => {
    onUpdate(item.productId, {
      type: patch.type !== undefined ? patch.type : item.discountType || null,
      value: patch.value !== undefined ? parseFloat(patch.value) || 0 : item.discountValue || 0,
      reason: patch.reason !== undefined ? patch.reason : item.discountReason || null,
    });
  };

  return (
    <div className="item-discount-wrap">
      <button
        className={`item-discount-chip ${amount > 0 ? "item-discount-chip-active" : ""}`}
        onClick={() => setOpen(!open)}
        type="button"
      >
        🏷️ {amount > 0 ? `−฿${amount.toFixed(2)}${item.discountType === "percent" ? ` (${value}%)` : ""}` : "Discount"}
      </button>
      {open && (
        <div className="item-discount-panel" onClick={(e) => e.stopPropagation()}>
          <select
            value={item.discountType || ""}
            onChange={(e) => apply({ type: e.target.value, value: e.target.value === "" ? 0 : value })}
            className="input-field"
            style={{ fontFamily: "inherit", padding: "0.3rem", fontSize: "0.75rem" }}
          >
            <option value="">No discount</option>
            <option value="percent">Percent (%)</option>
            <option value="fixed">Fixed (฿)</option>
          </select>
          {item.discountType && (
            <>
              <input
                type="number"
                min="0"
                max={item.discountType === "percent" ? 100 : lineTotal}
                value={value || ""}
                placeholder={item.discountType === "percent" ? "% off" : "฿ off"}
                onChange={(e) => apply({ value: e.target.value })}
                className="input-field"
                style={{ fontFamily: "inherit", padding: "0.3rem", fontSize: "0.75rem", maxWidth: "90px" }}
              />
              <select
                value={item.discountReason || ""}
                onChange={(e) => apply({ reason: e.target.value })}
                className="input-field"
                style={{ fontFamily: "inherit", padding: "0.3rem", fontSize: "0.75rem", flex: 1 }}
              >
                <option value="">No reason</option>
                {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </>
          )}
          <button
            onClick={() => { apply({ type: "", value: 0, reason: null }); setOpen(false); }}
            className="btn btn-outline"
            style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem" }}
            type="button"
          >
            ✕ Clear
          </button>
        </div>
      )}
    </div>
  );
}
