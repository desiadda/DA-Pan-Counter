import { useState } from "react";
import { dbService } from "../firebase";

export default function BulkPriceUpdate({ products, onDone }) {
  const [selected, setSelected] = useState({});
  const [updateField, setUpdateField] = useState("sellingPrice");
  const [updateType, setUpdateType] = useState("fixed");
  const [updateValue, setUpdateValue] = useState("");

  const toggleAll = () => {
    if (Object.keys(selected).length === products.length) {
      setSelected({});
    } else {
      const all = {};
      products.forEach(p => { all[p.id] = true; });
      setSelected(all);
    }
  };

  const toggleProduct = (id) => {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const selectedProducts = products.filter(p => selected[p.id]);

  const handleApply = async () => {
    if (selectedCount === 0) { alert("Select at least one product."); return; }
    if (!updateValue || parseFloat(updateValue) <= 0) { alert("Enter a valid value."); return; }

    const val = parseFloat(updateValue);
    let updated = 0;

    for (const p of selectedProducts) {
      const newProduct = { ...p };
      if (updateField === "sellingPrice") {
        const newVal = updateType === "percent" ? p.sellingPrice * (1 + val / 100) : val;
        newProduct.sellingPrice = Math.round(newVal * 100) / 100;
      } else if (updateField === "costPrice") {
        const newVal = updateType === "percent" ? p.costPrice * (1 + val / 100) : val;
        newProduct.costPrice = Math.round(newVal * 100) / 100;
      } else if (updateField === "sellingPricePack" && p.isCigarette) {
        const newVal = updateType === "percent" ? (p.sellingPricePack || 0) * (1 + val / 100) : val;
        newProduct.sellingPricePack = Math.round(newVal * 100) / 100;
      }

      try {
        await dbService.saveProduct(newProduct);
        updated++;
      } catch (err) {
        console.error("Bulk update error:", err);
      }
    }

    alert(`Updated ${updated} product(s) successfully!`);
    onDone?.();
  };

  return (
    <div style={styles.card}>
      <h3 style={styles.title}>Bulk Price Update</h3>
      <p style={styles.desc}>Select products and apply price changes in bulk.</p>

      <div style={styles.toolbar}>
        <button onClick={toggleAll} style={styles.toggleBtn}>
          {Object.keys(selected).length === products.length ? "Deselect All" : `Select All (${products.length})`}
        </button>
        <span style={styles.count}>{selectedCount} selected</span>
      </div>

      <div style={styles.options}>
        <select value={updateField} onChange={e => setUpdateField(e.target.value)} style={styles.select}>
          <option value="sellingPrice">Selling Price</option>
          <option value="costPrice">Cost Price</option>
          {products.some(p => p.isCigarette) && <option value="sellingPricePack">Pack Selling Price</option>}
        </select>

        <select value={updateType} onChange={e => setUpdateType(e.target.value)} style={styles.select}>
          <option value="fixed">Set to (฿)</option>
          <option value="percent">Increase by (%)</option>
        </select>

        <input
          type="number"
          value={updateValue}
          onChange={e => setUpdateValue(e.target.value)}
          placeholder={updateType === "percent" ? "% increase" : "New price"}
          style={styles.input}
        />

        <button onClick={handleApply} disabled={selectedCount === 0} className="btn btn-primary" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
          Apply to {selectedCount} product(s)
        </button>
      </div>

      <div style={styles.list}>
        {products.map(p => (
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
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  toggleBtn: { background: "none", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "0.25rem 0.5rem", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", color: "#475569" },
  count: { fontSize: "0.8rem", fontWeight: 600, color: "#047857" },
  options: { display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" },
  select: { padding: "0.4rem 0.5rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.8rem", background: "#f8fafc", cursor: "pointer" },
  input: { padding: "0.4rem 0.5rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.8rem", width: "100px", textAlign: "center" },
  list: {
    display: "flex", flexDirection: "column", gap: "2px", maxHeight: "300px", overflowY: "auto",
    border: "1px solid #f1f5f9", borderRadius: "8px", padding: "0.25rem",
  },
  productRow: {
    display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0.5rem",
    borderRadius: "6px", cursor: "pointer", fontSize: "0.82rem",
  },
  selectedRow: { background: "#f0fdf4" },
  prodName: { flex: 1, fontWeight: 600, color: "#1e293b" },
  prodPrice: { color: "#64748b", fontWeight: 600 },
};
