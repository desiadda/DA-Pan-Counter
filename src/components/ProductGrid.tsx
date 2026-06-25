import { useState } from "react";

export default function ProductGrid({ products, onAddToCart }) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredId, setHoveredId] = useState(null);

  const categories = ["All", "Paan Special", "Cigarettes", "Mouth Freshner", "Beverages"];

  const getDisplayProducts = () => {
    let filtered = products;
    if (activeCategory !== "All") filtered = filtered.filter(p => p.category === activeCategory);
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
      <div className="flex-col gap-md" style={{ marginBottom: "1rem" }}>
        <input type="text" placeholder="Search products..." value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)} className="input-field" />
        <div className="cat-tabs">
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`cat-tab ${activeCategory === cat ? "cat-tab-active" : ""}`}>{cat}</button>
          ))}
        </div>
      </div>

      <div className="product-grid">
        {getDisplayProducts().map(p => {
          const isOutOfStock = p.stock <= 0;
          const isLowStock = p.stock <= p.lowStockLimit;

          return (
            <div key={p.id} onClick={() => !isOutOfStock && onAddToCart(p)}
              onMouseEnter={() => setHoveredId(p.id)} onMouseLeave={() => setHoveredId(null)}
              className={`product-card ${isOutOfStock ? "product-card-out" : ""}`}>
              <div className="product-card-header">
                <span className="product-category">{p.category}</span>
                {isOutOfStock ? <span className="stock-badge stock-badge-out">Out</span> : isLowStock && <span className="stock-badge stock-badge-low">Low</span>}
              </div>
              <div className="product-name">{p.displayName || p.name}</div>
              {p.isCigarette ? (
                <div className="flex gap-xs flex-wrap">
                  <span className="price-tag price-tag-primary">Single ฿{p.sellingPrice}</span>
                  <span className="price-tag price-tag-secondary">Box ฿{p.sellingPricePack}</span>
                </div>
              ) : (
                <div className="product-price">฿{p.sellingPrice}</div>
              )}
              <div className="product-stock-bar">
                <div className="product-stock-fill"
                  style={{ width: `${Math.min(100, Math.max(0, (p.stock / (p.lowStockLimit * 3 || 100)) * 100))}%`, background: isOutOfStock ? "var(--error)" : isLowStock ? "var(--warning)" : "var(--success)" }} />
              </div>
              {hoveredId === p.id && (
                <div style={{ position: "absolute", top: "100%", left: 4, right: 4, zIndex: 100, background: "var(--text)", color: "#fff", borderRadius: 6, padding: "0.5rem", fontSize: "0.7rem", display: "flex", flexDirection: "column", gap: "0.25rem", marginTop: 2, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
                  {p.isCigarette ? (
                    <>
                      <div className="flex justify-between"><span>📦 Pack: {p.packSize || 20} pcs/box</span></div>
                      <div className="flex justify-between"><span>📊 Stock: {(p.stockPack ?? Math.floor(p.stock / (p.packSize || 20)))} Box + {(p.stockLoose ?? (p.stock % (p.packSize || 20)))} Pcs</span></div>
                    </>
                  ) : (
                    <div className="flex justify-between"><span>📊 Stock: {p.stock}</span></div>
                  )}
                  <div className="flex justify-between"><span>💰 Cost: ฿{p.costPrice}</span></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
