import { useState, useMemo } from "react";
import { dbService } from "../firebase";
import { useConfirmStore } from "../stores/confirmStore";
import { useLangStore } from "../stores/langStore";
import { useT } from "../lang/translations";
import { CATEGORIES } from "../constants";

export default function BulkPriceUpdate({ products, onDone }) {
  const lang = useLangStore((s) => s.lang);
  const tr = useT(lang);
  const confirm = useConfirmStore((s) => s.confirm);
  const [selected, setSelected] = useState({});
  const [updateField, setUpdateField] = useState("sellingPrice");
  const [updateType, setUpdateType] = useState("fixed");
  const [updateValue, setUpdateValue] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [applying, setApplying] = useState(false);

  const categories = useMemo(() => ["All", ...CATEGORIES], []);

  const q = searchQuery.trim().toLowerCase();
  const visibleProducts = useMemo(() => {
    return products.filter(p =>
      (categoryFilter === "All" || p.category === categoryFilter) &&
      (!q || (p.name || "").toLowerCase().includes(q))
    );
  }, [products, categoryFilter, q]);

  const toggleAll = () => {
    const selectedInView = visibleProducts.filter(p => selected[p.id]).length;
    if (selectedInView === visibleProducts.length) {
      setSelected(prev => {
        const next = { ...prev };
        visibleProducts.forEach(p => { delete next[p.id]; });
        return next;
      });
    } else {
      const all = { ...selected };
      visibleProducts.forEach(p => { all[p.id] = true; });
      setSelected(all);
    }
  };

  const toggleProduct = (id) => {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const selectedProducts = products.filter(p => selected[p.id]);

  const computeNewPrice = (p) => {
    if (updateField === "sellingPrice") {
      const base = p.sellingPrice || 0;
      return updateType === "percent" ? base * (1 + val() / 100) : val();
    }
    if (updateField === "costPrice") {
      const base = p.costPrice || 0;
      return updateType === "percent" ? base * (1 + val() / 100) : val();
    }
    if (updateField === "sellingPricePack" && p.isCigarette) {
      const base = p.sellingPricePack || 0;
      return updateType === "percent" ? base * (1 + val() / 100) : val();
    }
    return null;
  };

  const val = () => parseFloat(updateValue) || 0;
  const valid = selectedCount > 0 && updateValue !== "" && !isNaN(val()) && val() > 0;

  const previewRows = useMemo(() => {
    if (!valid) return [];
    return selectedProducts.slice(0, 5).map(p => {
      const current = updateField === "sellingPrice" ? p.sellingPrice : updateField === "costPrice" ? p.costPrice : p.sellingPricePack;
      const newPrice = computeNewPrice(p);
      return {
        name: p.name,
        current: updateField === "sellingPricePack" ? p.sellingPricePack : current,
        new: newPrice,
      };
    });
  }, [selectedProducts, valid, updateField, updateType, updateValue]);

  const inventoryImpact = useMemo(() => {
    if (!valid) return 0;
    return selectedProducts.reduce((sum, p) => {
      const diff = (computeNewPrice(p) || 0) - p[updateField === "sellingPricePack" ? "sellingPricePack" : updateField];
      return sum + diff * (p.quantity || 0);
    }, 0);
  }, [selectedProducts, valid, updateField, updateType, updateValue]);

  const handleApply = async () => {
    if (!valid) { alert(tr("bulk.selectAtLeastOne")); return; }
    const ok = await confirm(
      `${tr("bulk.confirmQ")} ${selectedCount} ${tr("bulk.products")}?\n${tr("bulk.confirmImpact")}: ${inventoryImpact >= 0 ? "+" : "−"}฿${Math.abs(inventoryImpact).toFixed(0)}`,
      { title: tr("bulk.title"), confirmLabel: tr("bulk.apply"), cancelLabel: tr("bulk.back") }
    );
    if (!ok) return;

    let updated = 0;
    setApplying(true);
    for (const p of selectedProducts) {
      const newProduct = { ...p };
      if (updateField === "sellingPrice") {
        const newVal = updateType === "percent" ? p.sellingPrice * (1 + val() / 100) : val();
        newProduct.sellingPrice = Math.round(newVal * 100) / 100;
      } else if (updateField === "costPrice") {
        const newVal = updateType === "percent" ? p.costPrice * (1 + val() / 100) : val();
        newProduct.costPrice = Math.round(newVal * 100) / 100;
      } else if (updateField === "sellingPricePack" && p.isCigarette) {
        const newVal = updateType === "percent" ? (p.sellingPricePack || 0) * (1 + val() / 100) : val();
        newProduct.sellingPricePack = Math.round(newVal * 100) / 100;
      }

      try {
        await dbService.saveProduct(newProduct);
        updated++;
      } catch (err) {
        console.error("Bulk update error:", err);
      }
    }

    alert(`${tr("bulk.updated")} ${updated} ${tr("bulk.products")}`);
    setApplying(false);
    onDone?.();
  };

  return (
    <div style={styles.card}>
      <h3 style={styles.title}>{tr("bulk.title")}</h3>
      <p style={styles.desc}>{tr("bulk.desc")}</p>

      <div style={styles.filterBar}>
        <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); }} style={styles.filterSelect}>
          {categories.map(c => <option key={c} value={c}>{c === "All" ? tr("bulk.allCategories") : c}</option>)}
        </select>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={tr("bulk.searchProducts")}
          style={styles.filterInput}
        />
      </div>

      <div style={styles.toolbar}>
        <button onClick={toggleAll} style={styles.toggleBtn}>
          {visibleProducts.length > 0 && visibleProducts.every(p => selected[p.id]) ? tr("bulk.deselectAll") : `${tr("bulk.selectVisible")} (${visibleProducts.length})`}
        </button>
        <span style={styles.count}>{selectedCount} {tr("bulk.selected")}</span>
      </div>

      <div style={styles.options}>
        <select value={updateField} onChange={e => setUpdateField(e.target.value)} style={styles.select}>
          <option value="sellingPrice">{tr("bulk.sellingPrice")}</option>
          <option value="costPrice">{tr("bulk.costPrice")}</option>
          {products.some(p => p.isCigarette) && <option value="sellingPricePack">{tr("bulk.packSelling")}</option>}
        </select>

        <select value={updateType} onChange={e => setUpdateType(e.target.value)} style={styles.select}>
          <option value="fixed">{tr("bulk.setTo")}</option>
          <option value="percent">{tr("bulk.increaseBy")}</option>
        </select>

        <input
          type="number"
          value={updateValue}
          onChange={e => setUpdateValue(e.target.value)}
          placeholder={updateType === "percent" ? tr("bulk.pctIncrease") : tr("bulk.newPrice")}
          style={styles.input}
        />

        <button onClick={handleApply} disabled={!valid || applying} className="btn btn-primary" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
          {applying ? tr("purchase.processing") : `${tr("bulk.applyTo")} ${selectedCount} ${tr("bulk.products")}`}
        </button>
      </div>

      {valid && (
        <div style={styles.preview}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={styles.previewTitle}>{tr("bulk.preview")} ({selectedCount})</span>
            <span style={{ ...styles.previewImpact, color: inventoryImpact >= 0 ? "#047857" : "#dc2626" }}>
              {tr("bulk.invImpact")}: {inventoryImpact >= 0 ? "+" : "−"}฿{Math.abs(inventoryImpact).toFixed(0)}
            </span>
          </div>
          <div style={styles.previewList}>
            {previewRows.map((r, i) => (
              <div key={i} style={styles.previewRow}>
                <span style={styles.previewName}>{r.name}</span>
                <span style={styles.previewOld}>฿{(r.current || 0).toFixed(2)}</span>
                <span style={styles.previewArrow}>→</span>
                <span style={styles.previewNew}>฿{(r.new || 0).toFixed(2)}</span>
              </div>
            ))}
            {selectedCount > 5 && (
              <div style={styles.previewMore}>+ {selectedCount - 5} {tr("bulk.moreProducts")}</div>
            )}
          </div>
          {updateField === "costPrice" && selectedProducts.some(p => (p.sellingPrice || 0) > 0 && val() >= p.sellingPrice) && (
            <div style={styles.warn}>
              ⚠️ {tr("bulk.warnCost")}
            </div>
          )}
          {updateField === "sellingPrice" && selectedProducts.some(p => (p.costPrice || 0) > 0 && val() <= p.costPrice) && (
            <div style={styles.warn}>
              ⚠️ {tr("bulk.warnSelling")}
            </div>
          )}
        </div>
      )}

      <div style={styles.list}>
        {visibleProducts.length === 0 ? (
          <div style={styles.emptyList}>{tr("bulk.noMatch")}</div>
        ) : visibleProducts.map(p => (
          <label key={p.id} style={{ ...styles.productRow, ...(selected[p.id] ? styles.selectedRow : {}) }}>
            <input type="checkbox" checked={!!selected[p.id]} onChange={() => toggleProduct(p.id)} />
            <span style={styles.prodName}>{p.name}</span>
            <span style={styles.prodPrice}>฿{p.sellingPrice}{p.isCigarette ? ` / ฿${p.sellingPricePack}` : ""}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "1rem",
    display: "flex", flexDirection: "column", gap: "0.75rem",
  },
  title: { fontSize: "1rem", fontWeight: 700, color: "#1e293b", margin: 0 },
  desc: { fontSize: "0.8rem", color: "#64748b", margin: 0 },
  filterBar: { display: "flex", gap: "0.5rem", flexWrap: "wrap" },
  filterSelect: { padding: "0.4rem 0.5rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.8rem", background: "#f8fafc", cursor: "pointer", flex: "0 1 140px" },
  filterInput: { padding: "0.4rem 0.5rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.8rem", flex: "1", minWidth: "120px" },
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  toggleBtn: { background: "none", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "0.25rem 0.5rem", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", color: "#475569" },
  count: { fontSize: "0.8rem", fontWeight: 600, color: "#047857" },
  options: { display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" },
  select: { padding: "0.4rem 0.5rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.8rem", background: "#f8fafc", cursor: "pointer" },
  input: { padding: "0.4rem 0.5rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.8rem", width: "100px", textAlign: "center" },
  preview: { border: "1px solid #d1fae5", background: "#f0fdf4", borderRadius: "8px", padding: "0.5rem 0.65rem", display: "flex", flexDirection: "column", gap: "0.4rem" },
  previewTitle: { fontSize: "0.68rem", fontWeight: 800, color: "#047857", letterSpacing: "0.04em" },
  previewImpact: { fontSize: "0.72rem", fontWeight: 800 },
  previewList: { display: "flex", flexDirection: "column", gap: "2px" },
  previewRow: { display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem" },
  previewName: { flex: 1, fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  previewOld: { color: "#94a3b8", textDecoration: "line-through", fontWeight: 600 },
  previewArrow: { color: "#64748b" },
  previewNew: { color: "#047857", fontWeight: 800 },
  previewMore: { fontSize: "0.7rem", color: "#64748b", fontStyle: "italic" },
  warn: { fontSize: "0.7rem", color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "6px", padding: "0.3rem 0.5rem" },
  list: {
    display: "flex", flexDirection: "column", gap: "2px", maxHeight: "300px", overflowY: "auto",
    border: "1px solid #f1f5f9", borderRadius: "8px", padding: "0.25rem",
  },
  emptyList: { textAlign: "center", padding: "1rem", color: "#94a3b8", fontSize: "0.8rem" },
  productRow: {
    display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0.5rem",
    borderRadius: "6px", cursor: "pointer", fontSize: "0.82rem",
  },
  selectedRow: { background: "#f0fdf4" },
  prodName: { flex: 1, fontWeight: 600, color: "#1e293b" },
  prodPrice: { color: "#64748b", fontWeight: 600 },
};
