import { useState } from "react";

export default function ProductGrid({ products, onAddToCart }) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredId, setHoveredId] = useState(null);

  const categories = ["All", "Paan Special", "Cigarettes", "Mouth Freshner", "Beverages"];

  const getDisplayProducts = () => {
    let filtered = products;
    if (activeCategory !== "All") {
      filtered = filtered.filter(p => p.category === activeCategory);
    }
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q));
    }
    const displayList = [];
    const processedIds = new Set();
    filtered.forEach(p => {
      if (p.isCigarette && p.siblingId) {
        const sibling = products.find(s => s.id === p.siblingId);
        const singleVariant = p.name.includes("Single") ? p : sibling;
        const packVariant = p.name.includes("Pack") ? p : sibling;
        if (singleVariant && !processedIds.has(singleVariant.id)) {
          processedIds.add(singleVariant.id);
          if (packVariant) processedIds.add(packVariant.id);
          displayList.push({ ...singleVariant, displayName: singleVariant.name.replace(" (Single)", "").replace(" (Pack)", "") });
        }
      } else if (!processedIds.has(p.id)) {
        processedIds.add(p.id);
        displayList.push(p);
      }
    });
    return displayList;
  };

  return (
    <div>
      <div style={styles.searchBarContainer}>
        <input type="text" placeholder="Search products..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={styles.searchInput} />
        <div style={styles.categoriesContainer}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              style={{ ...styles.categoryTab, ...(activeCategory === cat ? styles.activeCategoryTab : {}) }}>{cat}</button>
          ))}
        </div>
      </div>

      <div style={styles.gridContainer}>
        {getDisplayProducts().map(p => {
          const isOutOfStock = p.stock <= 0;
          const isLowStock = p.stock <= p.lowStockLimit;

          return (
            <div key={p.id} onClick={() => !isOutOfStock && onAddToCart(p)}
              onMouseEnter={() => setHoveredId(p.id)} onMouseLeave={() => setHoveredId(null)}
              style={{ ...styles.productCard, ...(isOutOfStock ? styles.outOfStockCard : {}) }}>
              <div style={styles.cardHeader}>
                <span style={styles.catLabel}>{p.category}</span>
                {isOutOfStock ? <span style={styles.outStockBadge}>Out</span> : isLowStock && <span style={styles.lowStockBadge}>Low</span>}
              </div>
              <div style={styles.productName}>{p.displayName || p.name}</div>
              {p.isCigarette ? (
                <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                  <span style={styles.priceCig}>Single ฿{p.sellingPrice}</span>
                  <span style={styles.priceBox}>Box ฿{p.sellingPricePack}</span>
                </div>
              ) : (
                <div style={styles.productPrice}>฿{p.sellingPrice}</div>
              )}
              <div style={styles.stockBar}>
                <div style={{ ...styles.stockFill, width: `${Math.min(100, (p.stock / (p.lowStockLimit * 3 || 100)) * 100)}%`,
                  background: isOutOfStock ? "#ef4444" : isLowStock ? "#f59e0b" : "#10b981" }} />
              </div>
              {hoveredId === p.id && (
                <div style={styles.popover}>
                  {p.isCigarette ? (
                    <>
                      <div style={styles.popRow}>📦 Pack: {p.packSize || 20} pcs/box</div>
                      <div style={styles.popRow}>📊 Stock: {(p.stockPack ?? Math.floor(p.stock / (p.packSize || 20)))} Box + {(p.stockLoose ?? (p.stock % (p.packSize || 20)))} Pcs</div>
                    </>
                  ) : (
                    <div style={styles.popRow}>📊 Stock: {p.stock}</div>
                  )}
                  <div style={styles.popRow}>💰 Cost: ฿{p.costPrice}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  searchBarContainer: { display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" },
  searchInput: { padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.875rem", width: "100%", outline: "none" },
  categoriesContainer: { display: "flex", gap: "0.5rem", overflowX: "auto", paddingBottom: "4px" },
  categoryTab: { padding: "0.5rem 1rem", borderRadius: "20px", border: "1px solid #cbd5e1", backgroundColor: "#fff", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, color: "#64748b", whiteSpace: "nowrap" },
  activeCategoryTab: { backgroundColor: "#047857", color: "#fff", border: "1px solid #047857" },
  gridContainer: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "0.75rem" },
  productCard: { backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "0.75rem", cursor: "pointer", display: "flex", flexDirection: "column", gap: "0.35rem", position: "relative", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" },
  outOfStockCard: { opacity: 0.45, cursor: "not-allowed" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  catLabel: { fontSize: "0.65rem", color: "#94a3b8", fontWeight: 600 },
  lowStockBadge: { fontSize: "0.6rem", backgroundColor: "#fff7ed", color: "#ea580c", padding: "1px 5px", borderRadius: "4px", fontWeight: 700 },
  outStockBadge: { fontSize: "0.6rem", backgroundColor: "#fef2f2", color: "#dc2626", padding: "1px 5px", borderRadius: "4px", fontWeight: 700 },
  productName: { fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", lineHeight: "1.3", wordBreak: "break-word", minHeight: "2.2em" },
  productPrice: { fontSize: "1rem", fontWeight: 800, color: "#047857" },
  priceCig: { fontSize: "0.75rem", fontWeight: 700, color: "#047857", background: "#f0fdf4", padding: "2px 6px", borderRadius: "4px" },
  priceBox: { fontSize: "0.75rem", fontWeight: 700, color: "#b45309", background: "#fffbeb", padding: "2px 6px", borderRadius: "4px" },
  stockBar: { height: "4px", background: "#f1f5f9", borderRadius: "2px", overflow: "hidden", marginTop: "2px" },
  stockFill: { height: "100%", borderRadius: "2px", transition: "width 0.3s" },
  popover: { position: "absolute", top: "100%", left: "4px", right: "4px", zIndex: 10, background: "#1e293b", color: "#fff", borderRadius: "6px", padding: "0.5rem", fontSize: "0.7rem", display: "flex", flexDirection: "column", gap: "0.25rem", marginTop: "2px", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" },
  popRow: { display: "flex", justifyContent: "space-between" },
};
