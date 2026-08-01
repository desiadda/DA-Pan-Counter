import { useState, useEffect } from "react";
import { SkeletonCard } from "./Skeleton";
import { CATEGORIES, DEFAULT_PACK_SIZE } from "../constants";
import { useLangStore } from "../stores/langStore";
import { useT } from "../lang/translations";

export default function ProductGrid({ products, onAddToCart }) {
  const lang = useLangStore((s) => s.lang);
  const tr = useT(lang);

  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredId, setHoveredId] = useState(null);

  // Favorite product IDs persisted in localStorage
  const [favIds, setFavIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("pan_favorite_product_ids");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  // Sync default favorites if empty on first load
  useEffect(() => {
    if (favIds.length === 0 && products.length > 0) {
      const defaults = products.slice(0, 6).map(p => p.id);
      setFavIds(defaults);
      try {
        localStorage.setItem("pan_favorite_product_ids", JSON.stringify(defaults));
      } catch (e) { console.error(e); }
    }
  }, [products]);

  const toggleFavorite = (productId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavIds(prev => {
      const next = prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId];
      try {
        localStorage.setItem("pan_favorite_product_ids", JSON.stringify(next));
      } catch (err) { console.error(err); }
      return next;
    });
  };

  const categories = ["All", ...CATEGORIES];

  // Get favorite products
  const favoriteProducts = products.filter(p => favIds.includes(p.id));

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
      {/* ⭐ TOP FAVORITES / FAST TAP GRID */}
      {favoriteProducts.length > 0 && (
        <div style={{
          background: "linear-gradient(135deg, var(--card-bg, #ffffff), var(--hover-bg, #f8fafc))",
          border: "1.5px solid var(--primary-light, #bbf7d0)",
          borderRadius: "14px",
          padding: "0.75rem 1rem",
          marginBottom: "1rem",
          boxShadow: "0 2px 10px rgba(0,0,0,0.04)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 800, fontSize: "0.88rem", color: "var(--primary, #047857)" }}>
              <span>⭐</span>
              <span>{tr("pos.quickTapFavorites") || "Top Favorites (Fast Tap)"}</span>
            </div>
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted, #64748b)", fontStyle: "italic" }}>
              {tr("pos.pinHint") || "Click ⭐ on item card to pin/unpin"}
            </span>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
            gap: "8px"
          }}>
            {favoriteProducts.map(p => {
              const isUnlimited = p.isNonInventory || p.stock >= 9999;
              const isOutOfStock = !isUnlimited && p.stock <= 0;
              return (
                <button
                  key={p.id}
                  onClick={() => !isOutOfStock && onAddToCart(p)}
                  disabled={isOutOfStock}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justify: "space-between",
                    padding: "0.55rem 0.75rem",
                    background: isOutOfStock ? "var(--hover-bg, #f1f5f9)" : "var(--primary-light, #f0fdf4)",
                    border: `1.5px solid ${isOutOfStock ? "var(--border, #cbd5e1)" : "var(--border, #a7f3d0)"}`,
                    borderRadius: "10px",
                    cursor: isOutOfStock ? "not-allowed" : "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                    opacity: isOutOfStock ? 0.6 : 1,
                    fontFamily: "inherit",
                  }}
                  className="quick-tap-card"
                >
                  <div style={{ fontWeight: 700, fontSize: "0.83rem", color: "var(--text, #1e293b)", width: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.displayName || p.name}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginTop: "6px" }}>
                    <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "var(--primary, #047857)" }}>
                      ฿{p.sellingPrice}
                    </span>
                    <span style={{
                      fontSize: "0.68rem", fontWeight: 700,
                      background: isOutOfStock ? "#94a3b8" : "var(--primary, #047857)",
                      color: "#ffffff", padding: "2px 7px", borderRadius: "12px",
                      whiteSpace: "nowrap"
                    }}>
                      {isOutOfStock ? "Out" : "+ Add"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* SEARCH BAR & CATEGORY TABS */}
      <div className="flex-col gap-md" style={{ marginBottom: "1rem" }}>
        <input type="text" placeholder="🔍 Search products..." value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)} className="input-field" />
        <div className="cat-tabs">
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`cat-tab ${activeCategory === cat ? "cat-tab-active" : ""}`}>{cat}</button>
          ))}
        </div>
      </div>

      {/* PRODUCT GRID */}
      {products.length === 0 ? (
        <SkeletonCard count={8} />
      ) : (
        <div className="product-grid">
          {getDisplayProducts().map(p => {
            const isUnlimited = p.isNonInventory || p.stock >= 9999;
            const isOutOfStock = !isUnlimited && p.stock <= 0;
            const isLowStock = !isUnlimited && p.stock <= p.lowStockLimit;
            const isFav = favIds.includes(p.id);

            return (
              <div key={p.id} onClick={() => !isOutOfStock && onAddToCart(p)}
                onMouseEnter={() => setHoveredId(p.id)} onMouseLeave={() => setHoveredId(null)}
                className={`product-card ${isOutOfStock ? "product-card-out" : ""}`}>
                <div className="product-card-header">
                  <span className="product-category">{p.category}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                      onClick={(e) => toggleFavorite(p.id, e)}
                      style={{
                        cursor: "pointer",
                        fontSize: "0.95rem",
                        opacity: isFav ? 1 : 0.3,
                        transition: "all 0.15s ease",
                      }}
                      title={isFav ? "Unpin from Top Favorites" : "Pin to Top Favorites"}
                    >
                      {isFav ? "⭐" : "☆"}
                    </span>
                    {isOutOfStock ? <span className="stock-badge stock-badge-out">Out</span> : isLowStock && <span className="stock-badge stock-badge-low">Low</span>}
                  </div>
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
                {!isUnlimited && (
                  <div className="product-stock-bar">
                    <div className="product-stock-fill"
                      style={{ width: `${Math.min(100, Math.max(0, (p.stock / (p.lowStockLimit * 3 || 100)) * 100))}%`, background: isOutOfStock ? "var(--error)" : isLowStock ? "var(--warning)" : "var(--success)" }} />
                  </div>
                )}
                {hoveredId === p.id && (
                  <div style={{ position: "absolute", top: "100%", left: 4, right: 4, zIndex: 100, background: "var(--text)", color: "#fff", borderRadius: 6, padding: "0.5rem", fontSize: "0.7rem", display: "flex", flexDirection: "column", gap: "0.25rem", marginTop: 2, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
                    {p.isCigarette ? (
                      <>
                        <div className="flex justify-between"><span>📦 Pack: {p.packSize || DEFAULT_PACK_SIZE} pcs/box</span></div>
                        <div className="flex justify-between"><span>📊 Stock: {(p.stockPack ?? Math.floor(p.stock / (p.packSize || DEFAULT_PACK_SIZE)))} Box + {(p.stockLoose ?? (p.stock % (p.packSize || DEFAULT_PACK_SIZE)))} Pcs</span></div>
                      </>
                    ) : (
                      <div className="flex justify-between"><span>📊 Stock: {isUnlimited ? "Unlimited" : p.stock}</span></div>
                    )}
                    <div className="flex justify-between"><span>💰 Cost: ฿{p.costPrice}</span></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
