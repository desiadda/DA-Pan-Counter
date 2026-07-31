import { useState } from "react";
import { dbService } from "../firebase";
import { useConfirmStore } from "../stores/confirmStore";
import { useAuthStore } from "../stores/authStore";
import { logError } from "../db/errorLog";
import { DEFAULT_PACK_SIZE } from "../constants";

export default function StockCountView({ products, onApplied }) {
  const confirm = useConfirmStore((s) => s.confirm);
  const user = useAuthStore((s) => s.user);
  const [counts, setCounts] = useState({});
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canAdjust = user?.role === "admin" || !!user?.permissions?.stockAdjust;

  const q = search.trim().toLowerCase();
  const visible = q
    ? products.filter(p => p.name.toLowerCase().includes(q) || (p.barcode || "").toLowerCase().includes(q))
    : products;

  const variances = visible
    .map(p => {
      const countedRaw = counts[p.id];
      if (countedRaw === undefined || countedRaw === "") return null;
      const counted = parseFloat(countedRaw);
      if (isNaN(counted)) return null;
      return { product: p, counted, diff: counted - (p.stock || 0) };
    })
    .filter(Boolean);

  const totalVariance = variances.reduce((s, v) => s + Math.abs(v.diff), 0);

  const handleSubmit = async () => {
    const diffs = variances.filter(v => v.diff !== 0);
    if (diffs.length === 0) {
      alert("No discrepancies — counted stock matches the system. Nothing to adjust.");
      return;
    }
    if (!canAdjust) {
      alert("❌ You do not have permission to adjust stock levels.");
      return;
    }
    const summary = diffs.slice(0, 12).map(v =>
      `• ${v.product.name}: system ${v.product.stock} → counted ${v.counted} (${v.diff > 0 ? "+" : ""}${v.diff})`
    ).join("\n") + (diffs.length > 12 ? `\n…and ${diffs.length - 12} more` : "");

    const ok = await confirm(
      `Apply ${diffs.length} stock count correction(s)?\n\n${summary}\n\nEach item is logged as an adjustment (reason: Stock Count Correction).`,
      { title: "Apply Count Adjustments", confirmLabel: "Apply", variant: "danger" }
    );
    if (!ok) return;

    setSubmitting(true);
    try {
      for (const v of diffs) {
        await dbService.addStockAdjustment({
          productId: v.product.id,
          qty: v.diff,
          reason: "Stock Count Correction",
          note: `Physical count: ${v.counted} (system was ${v.product.stock})`,
        });
      }
      setCounts({});
      onApplied?.();
      alert(`✅ ${diffs.length} adjustment(s) applied.`);
    } catch (err) {
      logError("INVENTORY", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to apply count adjustments"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <h3 className="section-subtitle" style={{ margin: 0 }}>🔢 Stock Count</h3>
          <div className="text-muted" style={{ fontSize: "0.78rem", marginTop: "0.2rem" }}>
            Enter physical counts — system will compute variance and apply corrections with full audit trail.
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <span className="text-muted" style={{ fontSize: "0.8rem" }}>
            {variances.filter(v => v.diff !== 0).length} discrepancy(ies) · ฿{totalVariance.toFixed(0)} variance
          </span>
          <button onClick={handleSubmit} disabled={submitting || variances.length === 0} className="btn btn-primary" style={{ padding: "0.4rem 0.9rem", fontSize: "0.8rem" }}>
            {submitting ? "Applying..." : "Apply Corrections"}
          </button>
        </div>
      </div>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search products to count..."
        className="input-field"
        style={{ marginTop: "0.75rem" }}
      />

      <div className="inventory-table-wrapper" style={{ overflowX: "auto", marginTop: "0.75rem" }}>
        <table className="inventory-table" style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ padding: "0.5rem", textAlign: "left", color: "var(--text-muted)" }}>Product</th>
              <th style={{ padding: "0.5rem", textAlign: "right", color: "var(--text-muted)" }}>System Stock</th>
              <th style={{ padding: "0.5rem", textAlign: "left", color: "var(--text-muted)" }}>Counted</th>
              <th style={{ padding: "0.5rem", textAlign: "right", color: "var(--text-muted)" }}>Variance</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(p => {
              const countedRaw = counts[p.id];
              const counted = countedRaw === undefined || countedRaw === "" ? null : parseFloat(countedRaw);
              const diff = counted === null || isNaN(counted) ? null : counted - (p.stock || 0);
              return (
                <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.5rem" }}>
                    <div style={{ fontWeight: 700, color: "var(--text)" }}>{p.name}</div>
                    <div className="text-muted" style={{ fontSize: "0.7rem" }}>{p.category}</div>
                  </td>
                  <td style={{ padding: "0.5rem", textAlign: "right", fontWeight: 600 }}>
                    {p.stock}{p.isCigarette ? ` (${p.stockPack ?? Math.floor(p.stock / (p.packSize || DEFAULT_PACK_SIZE))} box + ${p.stockLoose ?? (p.stock % (p.packSize || DEFAULT_PACK_SIZE))} pcs)` : ""}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    <input
                      type="number"
                      value={countedRaw === undefined ? "" : countedRaw}
                      onChange={e => setCounts(prev => ({ ...prev, [p.id]: e.target.value }))}
                      placeholder="count..."
                      className="input-field"
                      style={{ width: "100px", padding: "0.3rem 0.5rem", fontSize: "0.85rem" }}
                    />
                  </td>
                  <td style={{ padding: "0.5rem", textAlign: "right", fontWeight: 700 }}>
                    {diff === null ? <span className="text-muted">—</span> : diff === 0 ? (
                      <span style={{ color: "#047857" }}>✓ 0</span>
                    ) : (
                      <span style={{ color: diff > 0 ? "#047857" : "#dc2626" }}>{diff > 0 ? "+" : ""}{diff}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
