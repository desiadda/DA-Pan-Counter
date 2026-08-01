import { useState, useEffect } from "react";
import { dbService } from "../firebase";
import { useConfirmStore } from "../stores/confirmStore";
import { useDBStore } from "../stores/dbStore";
import { useAuthStore } from "../stores/authStore";
import { useLangStore } from "../stores/langStore";
import { useT } from "../lang/translations";
import { SkeletonTable } from "./Skeleton";
import { logError } from "../db/errorLog";
import PriceHistoryModal from "./PriceHistoryModal";
import PurchaseOrders from "./PurchaseOrders";
import BulkPriceUpdate from "./BulkPriceUpdate";
import SupplierDirectory from "./SupplierDirectory";
import StockAdjustmentModal from "./StockAdjustmentModal";
import StockMovementModal from "./StockMovementModal";
import StockCountView from "./StockCountView";
import { CATEGORIES, DEFAULT_LOW_STOCK_LIMIT, DEFAULT_PACK_SIZE, GOOD_MARGIN_PCT } from "../constants";

const escapeCSV = (val: any) => {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) return `"${str.replace(/"/g, '""')}"`;
  return str;
};

export default function InventoryView({ subPath, onNavigate }) {
  const lang = useLangStore((s) => s.lang);
  const tr = useT(lang);
  const confirm = useConfirmStore((s) => s.confirm);
  const products = useDBStore((s) => s.products);
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(false);
  const [expandedBatches, setExpandedBatches] = useState<Record<string, boolean>>({});
  
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [barcode, setBarcode] = useState("");
  
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [stock, setStock] = useState("");
  const [lowStockLimit, setLowStockLimit] = useState(String(DEFAULT_LOW_STOCK_LIMIT));
  const [isNonInventory, setIsNonInventory] = useState(false);
  
  const [isCigarette, setIsCigarette] = useState(false);
  const [packSize, setPackSize] = useState(String(DEFAULT_PACK_SIZE));
  const [costPricePack, setCostPricePack] = useState("");
  const [sellingPricePack, setSellingPricePack] = useState("");
  const [stockPack, setStockPack] = useState("");
  const [looseStock, setLooseStock] = useState("");
  const [historyProduct, setHistoryProduct] = useState(null);
  const [viewMode, setViewMode] = useState(subPath || "stock");

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortBy, setSortBy] = useState("name");
  const [adjustmentProduct, setAdjustmentProduct] = useState(null);
  const [movementProduct, setMovementProduct] = useState(null);
  const [poPrefill, setPoPrefill] = useState(null);

  useEffect(() => {
    setViewMode(subPath || "stock");
  }, [subPath]);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const list = await dbService.getProducts();
      useDBStore.getState().setProducts(list);
    } catch (err) {
      logError("INVENTORY", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to load products"));
      console.error(err);
    }
    setLoading(false);
  };

  const handleEdit = (p) => {
    const isAdmin = user?.role === "admin";
    if (user && !isAdmin && !user.permissions?.stockEdit) {
      alert("❌ You do not have permission to add/edit products.");
      return;
    }
    setIsEditing(true);
    setEditId(p.id);
    setName(p.name);
    setCategory(p.category);
    setCostPrice(p.costPrice != null ? p.costPrice.toString() : "0");
    setSellingPrice(p.sellingPrice.toString());
    setStock(p.stock.toString());
    setLowStockLimit(p.lowStockLimit.toString());
    setBarcode(p.barcode || "");
    setIsNonInventory(!!p.isNonInventory || p.stock >= 9999);
    
    setIsCigarette(p.isCigarette || false);
    setPackSize(p.packSize ? p.packSize.toString() : String(DEFAULT_PACK_SIZE));
    setCostPricePack(p.costPricePack ? p.costPricePack.toString() : "");
    setSellingPricePack(p.sellingPricePack ? p.sellingPricePack.toString() : "");
    
    if (p.isCigarette) {
      const pSize = p.packSize || DEFAULT_PACK_SIZE;
      setStockPack(p.stockPack != null ? p.stockPack.toString() : Math.floor(p.stock / pSize).toString());
      setLooseStock(p.stockLoose != null ? p.stockLoose.toString() : (p.stock % pSize).toString());
    } else {
      setStockPack("");
      setLooseStock("");
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditId(null);
    setName("");
    setCategory(CATEGORIES[0]);
    setCostPrice("");
    setSellingPrice("");
    setStock("");
    setLowStockLimit(String(DEFAULT_LOW_STOCK_LIMIT));
    setBarcode("");
    setIsNonInventory(false);
    setIsCigarette(false);
    setPackSize(String(DEFAULT_PACK_SIZE));
    setCostPricePack("");
    setSellingPricePack("");
    setStockPack("");
    setLooseStock("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isAdmin = user?.role === "admin";
    if (user && !isAdmin && !user.permissions?.stockEdit) {
      alert("❌ You do not have permission to add/edit products.");
      return;
    }
    if (!name.trim() || sellingPrice === "" || isNaN(parseFloat(sellingPrice))) {
      alert(tr("inventory.pleaseFill"));
      return;
    }
    if (!isCigarette && !isNonInventory && !stock) {
      alert(tr("inventory.pleaseFillStock"));
      return;
    }
    if (isCigarette && (!costPricePack || !sellingPricePack || !stockPack || !packSize)) {
      alert(tr("inventory.pleaseFillVariant"));
      return;
    }
    let totalStock = parseInt(stock) || 0;
    if (isNonInventory) {
      totalStock = 9999;
    } else if (isCigarette) {
      const bStock = parseInt(stockPack) || 0;
      const pSize = parseInt(packSize) || DEFAULT_PACK_SIZE;
      const lStock = parseInt(looseStock) || 0;
      totalStock = (bStock * pSize) + lStock;
    }
    const updatedProduct = {
      id: editId || undefined,
      name: name.trim(),
      category,
      barcode: barcode.trim(),
      costPrice: parseFloat(costPrice) || 0,
      sellingPrice: parseFloat(sellingPrice) || 0,
      stock: totalStock,
      lowStockLimit: isNonInventory ? 0 : (parseInt(lowStockLimit) || 0),
      isNonInventory,
      isCigarette,
      packSize: isCigarette ? parseInt(packSize) : null,
      costPricePack: isCigarette ? parseFloat(costPricePack) : null,
      sellingPricePack: isCigarette ? parseFloat(sellingPricePack) : null,
      stockPack: isCigarette ? parseInt(stockPack) : null,
      stockLoose: isCigarette ? parseInt(looseStock) : null,
    };
    try {
      await dbService.saveProduct(updatedProduct);
      handleCancel();
      loadProducts();
      alert(tr("inventory.saved"));
    } catch (err) {
      logError("INVENTORY", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to save product"));
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    const isAdmin = user?.role === "admin";
    if (user && !isAdmin && !user.permissions?.stockDelete) {
      alert("❌ You do not have permission to delete products.");
      return;
    }
    const ok = await confirm("Are you sure you want to delete this product?", {
      title: "Delete Product", confirmLabel: "Delete", variant: "danger",
    });
    if (ok) {
      try {
        await dbService.deleteProduct(id);
        loadProducts();
      } catch (err) {
        logError("INVENTORY", err.message, err.stack);
        alert("❌ " + (err.message || "Failed to delete product"));
        console.error(err);
      }
    }
  };

  const getMarginPct = (p) => {
    const cost = p.costPrice || 0;
    const sell = p.sellingPrice || 0;
    if (!sell) return null;
    return ((sell - cost) / sell) * 100;
  };

  const getMarginColor = (m) => {
    if (m === null) return "var(--text-muted)";
    if (m >= GOOD_MARGIN_PCT) return "#047857";
    if (m >= 0) return "#d97706";
    return "#ef4444";
  };

  const displayProducts = () => {
    let list = products;
    if (categoryFilter !== "All") list = list.filter(p => p.category === categoryFilter);
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.barcode || "").toLowerCase().includes(q));
    }
    const sorted = [...list];
    switch (sortBy) {
      case "name": sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "stockLow": sorted.sort((a, b) => (a.stock || 0) - (b.stock || 0)); break;
      case "stockHigh": sorted.sort((a, b) => (b.stock || 0) - (a.stock || 0)); break;
      case "priceHigh": sorted.sort((a, b) => (b.sellingPrice || 0) - (a.sellingPrice || 0)); break;
      case "marginLow": sorted.sort((a, b) => (getMarginPct(a) ?? 999) - (getMarginPct(b) ?? 999)); break;
      case "marginHigh": sorted.sort((a, b) => (getMarginPct(b) ?? -999) - (getMarginPct(a) ?? -999)); break;
      default: break;
    }
    return sorted;
  };

  const exportInventoryCSV = () => {
    const headers = ["Name", "Category", "Barcode", "Cost", "Sell", "Stock", "Low Limit", "Margin %", "Cost Value", "Sales Value"];
    const rows = displayProducts().map(p => [
      p.name, p.category, p.barcode || "", p.costPrice || 0, p.sellingPrice || 0,
      p.stock || 0, p.lowStockLimit || DEFAULT_LOW_STOCK_LIMIT,
      getMarginPct(p) === null ? "" : getMarginPct(p).toFixed(1),
      ((p.stock || 0) * (p.costPrice || 0)).toFixed(2),
      ((p.stock || 0) * (p.sellingPrice || 0)).toFixed(2),
    ]);
    const csv = "\uFEFF" + [headers.map(escapeCSV).join(","), ...rows.map(r => r.map(escapeCSV).join(","))].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `inventory-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const lowStockProducts = () => products.filter(p => p.stock <= (p.lowStockLimit || DEFAULT_LOW_STOCK_LIMIT));

  const createReorderPO = () => {
    const items = lowStockProducts().map(p => {
      const suggested = Math.max((p.lowStockLimit || DEFAULT_LOW_STOCK_LIMIT) * 2 - (p.stock || 0), (p.lowStockLimit || DEFAULT_LOW_STOCK_LIMIT));
      if (p.isCigarette) {
        return {
          productId: p.id,
          quantity: Math.ceil(suggested / (p.packSize || DEFAULT_PACK_SIZE)),
          costPrice: p.costPricePack || p.costPrice || 0,
          isPack: true,
        };
      }
      return { productId: p.id, quantity: suggested, costPrice: p.costPrice || 0, isPack: false };
    });
    setPoPrefill(items);
    setViewMode("purchases");
    onNavigate?.("purchases");
  };

  return (
    <div className="content-section">
      <div className="flex items-center gap-sm" style={{ marginBottom: "0.5rem" }}>
        <h2 className="section-title" style={{ margin: 0 }}>Inventory</h2>
        <div className="flex gap-xs" style={{ marginLeft: "auto", overflowX: "auto", whiteSpace: "nowrap" }}>
          {[
            { key: "stock", label: "📦 Stock" },
            { key: "purchases", label: "📋 Purchases" },
            { key: "suppliers", label: "📍 Suppliers" },
            { key: "bulk", label: "⚡ Bulk Price" },
            { key: "count", label: "🔢 Stock Count" },
          ].map(t => (
            <button key={t.key} onClick={() => { setViewMode(t.key); onNavigate?.(t.key === "stock" ? "" : t.key); }}
              className={`tab-toggle ${viewMode === t.key ? "tab-toggle-active" : ""}`}>{t.label}</button>
          ))}
        </div>
      </div>

      {viewMode === "purchases" ? (
        <PurchaseOrders prefill={poPrefill} onPrefillConsumed={() => setPoPrefill(null)} />
      ) : viewMode === "suppliers" ? (
        <SupplierDirectory />
      ) : viewMode === "bulk" ? (
        <BulkPriceUpdate products={products} onDone={loadProducts} />
      ) : viewMode === "count" ? (
        <StockCountView products={products} onApplied={loadProducts} />
      ) : (
      <>
      {!loading && products.length > 0 && (
        <div className="inventory-value-summary">
          <div className="value-card">
            <span className="value-label">Cost Value</span>
            <span className="value-amount value-amount-error">฿{products.reduce((sum, p) => sum + (p.stock * p.costPrice), 0).toLocaleString()}</span>
            <span className="value-sub">Total purchase cost</span>
          </div>
          <div className="value-card">
            <span className="value-label">Sales Value</span>
            <span className="value-amount value-amount-green">฿{products.reduce((sum, p) => sum + (p.stock * p.sellingPrice), 0).toLocaleString()}</span>
            <span className="value-sub">If all stock sells</span>
          </div>
          <div className="value-card">
            <span className="value-label">Est. Profit</span>
            <span className="value-amount value-amount-blue">฿{products.reduce((sum, p) => sum + (p.stock * (p.sellingPrice - p.costPrice)), 0).toLocaleString()}</span>
            <span className="value-sub">Sales − Cost</span>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="section-subtitle" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", marginBottom: "0.75rem" }}>{isEditing ? "Edit Product" : "Add New Product"}</h3>
        <form onSubmit={handleSubmit} className="form-section">
          <div className="input-group">
            <label className="input-label">Product Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Meetha Paan" className="input-field" />
          </div>
          <div className="input-group">
            <label className="input-label">Barcode (optional)</label>
            <input type="text" value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Scan or enter barcode" className="input-field" />
          </div>
          <div className="input-group">
            <label className="input-label">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Cost Price (฿)</label>
            <input type="number" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="Store purchase price (optional)" className="input-field" />
          </div>
          <div className="input-group">
            <label className="input-label">Selling Price (฿)</label>
            <input type="number" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} placeholder="Counter selling price" className="input-field" />
          </div>
          <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text)" }}>{tr("inventory.nonInventory")}</span>
            <label className="switch">
              <input type="checkbox" checked={isNonInventory} onChange={(e) => setIsNonInventory(e.target.checked)} />
              <span className="slider"></span>
            </label>
          </div>
          {!isNonInventory && !isCigarette && (
            <div className="input-group">
              <label className="input-label">Current Stock</label>
              <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="In-stock count" className="input-field" />
            </div>
          )}
          {!isNonInventory && (
            <div className="input-group">
              <label className="input-label">Low Stock Alert Limit (sticks/pcs)</label>
              <input type="number" value={lowStockLimit} onChange={(e) => setLowStockLimit(e.target.value)} placeholder="Warning limit" className="input-field" />
            </div>
          )}
          <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 0", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text)" }}>Link Single / Box product variants (Cigarette items)</span>
            <label className="switch">
              <input type="checkbox" checked={isCigarette} onChange={(e) => setIsCigarette(e.target.checked)} />
              <span className="slider"></span>
            </label>
          </div>
          {isCigarette && (
            <>
              <div className="input-group">
                <label className="input-label">Pcs/Sticks per Box</label>
                <input type="number" value={packSize} onChange={(e) => setPackSize(e.target.value)} className="input-field" placeholder="e.g. 20" />
              </div>
              <div className="input-group">
                <label className="input-label">Box Cost Price (฿)</label>
                <input type="number" value={costPricePack} onChange={(e) => setCostPricePack(e.target.value)} className="input-field" placeholder="Buy price per box" />
              </div>
              <div className="input-group">
                <label className="input-label">Box Selling Price (฿)</label>
                <input type="number" value={sellingPricePack} onChange={(e) => setSellingPricePack(e.target.value)} className="input-field" placeholder="Sell price per box" />
              </div>
              <div className="input-group">
                <label className="input-label">Current Boxes Stock</label>
                <input type="number" value={stockPack} onChange={(e) => setStockPack(e.target.value)} className="input-field" placeholder="Boxes in stock" />
              </div>
              <div className="input-group">
                <label className="input-label">Current Loose Pcs Stock</label>
                <input type="number" value={looseStock} onChange={(e) => setLooseStock(e.target.value)} className="input-field" placeholder="Loose pieces in stock" />
              </div>
            </>
          )}
          <div className="flex-btn-group" style={{ gridColumn: "1 / -1", marginTop: "0.5rem" }}>
            <button type="submit" className="btn btn-primary">{isEditing ? "Update Product" : "Add Product"}</button>
            <button type="button" onClick={handleCancel} className="btn btn-outline">Cancel</button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-sm">
          <h3>Product Stock Status</h3>
          <button onClick={loadProducts} className="btn btn-outline btn-sm">Refresh</button>
        </div>

        {lowStockProducts().length > 0 && (
          <div className="flex items-center justify-between" style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "8px", padding: "0.5rem 0.75rem", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#92400e" }}>
              ⚠️ {lowStockProducts().length} product(s) at or below reorder point
            </span>
            <button onClick={createReorderPO} className="btn btn-primary" style={{ padding: "0.3rem 0.75rem", fontSize: "0.75rem" }}>
              🛒 Create Purchase Order
            </button>
          </div>
        )}

        <div className="flex items-center" style={{ gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="🔍 Search name or barcode..."
            className="input-field"
            style={{ flex: 1, minWidth: "180px" }}
          />
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="input-field" style={{ width: "auto" }}>
            <option value="All">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="input-field" style={{ width: "auto" }}>
            <option value="name">Sort: Name A–Z</option>
            <option value="stockLow">Sort: Stock Low → High</option>
            <option value="stockHigh">Sort: Stock High → Low</option>
            <option value="priceHigh">Sort: Price High → Low</option>
            <option value="marginLow">Sort: Margin Low → High</option>
            <option value="marginHigh">Sort: Margin High → Low</option>
          </select>
          <button onClick={exportInventoryCSV} className="btn btn-outline" style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
            ⬇️ CSV
          </button>
        </div>
        {loading ? (
          <SkeletonTable rows={5} />
        ) : (
          <div className="inventory-table-wrapper" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }} className="inventory-table">
              <thead>
                <tr>
                  <th style={{ borderBottom: "2px solid var(--border)", padding: "0.6rem 0.5rem", color: "var(--text-muted)", fontWeight: "bold" }}>Product</th>
                  <th style={{ borderBottom: "2px solid var(--border)", padding: "0.6rem 0.5rem", color: "var(--text-muted)", fontWeight: "bold" }}>Category</th>
                  <th style={{ borderBottom: "2px solid var(--border)", padding: "0.6rem 0.5rem", color: "var(--text-muted)", fontWeight: "bold" }}>Cost</th>
                  <th style={{ borderBottom: "2px solid var(--border)", padding: "0.6rem 0.5rem", color: "var(--text-muted)", fontWeight: "bold" }}>Sell</th>
                  <th style={{ borderBottom: "2px solid var(--border)", padding: "0.6rem 0.5rem", color: "var(--text-muted)", fontWeight: "bold" }}>Margin</th>
                  <th style={{ borderBottom: "2px solid var(--border)", padding: "0.6rem 0.5rem", color: "var(--text-muted)", fontWeight: "bold" }}>Stock</th>
                  <th style={{ borderBottom: "2px solid var(--border)", padding: "0.6rem 0.5rem", color: "var(--text-muted)", fontWeight: "bold" }}>Adjust</th>
                  <th style={{ borderBottom: "2px solid var(--border)", padding: "0.6rem 0.5rem", color: "var(--text-muted)", fontWeight: "bold" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayProducts().map(p => {
                  const isUnlimited = p.isNonInventory || p.stock >= 9999;
                  const isLow = !isUnlimited && p.stock <= p.lowStockLimit;
                  const isExpanded = !!expandedBatches[p.id];
                  const hasBatches = p.batches && p.batches.length > 0;
                  return (
                    <tr key={p.id} style={{ display: "contents" }}>
                      <tr style={{ borderBottom: isExpanded ? "none" : "1px solid var(--border)" }}>
                        <td data-label="Product" style={{ padding: "0.6rem 0.5rem", verticalAlign: "middle" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            {hasBatches && (
                              <button onClick={() => setExpandedBatches(prev => ({ ...prev, [p.id]: !isExpanded }))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.7rem", padding: "2px", color: "var(--text-muted)" }}>
                                {isExpanded ? "▼" : "▶"}
                              </button>
                            )}
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ fontWeight: 700, color: "var(--text)" }}>{p.name}</span>
                              <span className="text-muted text-xs">{p.id}</span>
                            </div>
                          </div>
                        </td>
                        <td data-label="Category" style={{ padding: "0.6rem 0.5rem", verticalAlign: "middle" }}>{p.category}</td>
                        <td data-label="Cost" style={{ padding: "0.6rem 0.5rem", verticalAlign: "middle" }}>
                          {p.isCigarette ? <span>฿{p.costPrice} / ฿{p.costPricePack}</span> : <span>฿{p.costPrice || 0}</span>}
                        </td>
                        <td data-label="Sell" style={{ padding: "0.6rem 0.5rem", verticalAlign: "middle" }}>
                          {p.isCigarette ? <span>฿{p.sellingPrice} / ฿{p.sellingPricePack}</span> : <span>฿{p.sellingPrice}</span>}
                        </td>
                        <td data-label="Margin" style={{ padding: "0.6rem 0.5rem", verticalAlign: "middle" }}>
                          {(() => { const m = getMarginPct(p); return m === null ? <span className="text-muted">—</span> : <span style={{ fontWeight: 700, color: getMarginColor(m) }}>{m.toFixed(0)}%</span>; })()}
                        </td>
                        <td data-label="Stock" style={{ padding: "0.6rem 0.5rem", verticalAlign: "middle" }}>
                          {isUnlimited ? (
                            <span style={{ fontWeight: "bold", color: "#16a34a", fontSize: "0.85rem" }}>
                              ⚡ {tr("inventory.unlimited")}
                            </span>
                          ) : p.isCigarette ? (
                            <span style={{ fontWeight: "bold", color: isLow ? "#ea580c" : "inherit" }}>
                              {p.stock}p / {(p.stockPack != null ? p.stockPack : Math.floor(p.stock / (p.packSize || DEFAULT_PACK_SIZE)))}box
                              {isLow && <span className="stock-badge stock-badge-low" style={{ marginLeft: 4 }}>⚠️</span>}
                            </span>
                          ) : (
                            <span style={{ fontWeight: "bold", fontSize: "0.9rem", color: isLow ? "#ea580c" : "inherit" }}>
                              {p.stock}
                              {isLow && <span className="stock-badge stock-badge-low" style={{ marginLeft: 4 }}>⚠️</span>}
                            </span>
                          )}
                        </td>
                        <td data-label="Adjust" style={{ padding: "0.6rem 0.5rem", verticalAlign: "middle" }}>
                          <div className="flex gap-xs">
                            <button onClick={() => setAdjustmentProduct(p)} className="qty-btn" style={{ width: "auto", padding: "3px 6px", fontSize: "0.75rem", height: "auto" }}>+ / −</button>
                          </div>
                        </td>
                        <td data-label="Actions" style={{ padding: "0.6rem 0.5rem", verticalAlign: "middle" }}>
                          <div className="flex gap-sm">
                            <button onClick={() => handleEdit(p)} className="btn-icon" style={{ color: "var(--primary)", fontWeight: 600, fontSize: "0.8rem" }}>Edit</button>
                            <button onClick={() => setMovementProduct(p)} className="btn-icon" style={{ color: "#7c3aed", fontWeight: 600, fontSize: "0.8rem" }}>Movements</button>
                            <button onClick={() => setHistoryProduct(p)} className="btn-icon" style={{ color: "#2563eb", fontWeight: 600, fontSize: "0.8rem" }}>Price</button>
                            <button onClick={() => handleDelete(p.id)} className="btn-icon" style={{ color: "var(--error)", fontWeight: 600, fontSize: "0.8rem" }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && hasBatches && (
                        <tr style={{ background: "var(--background-alt)", borderBottom: "1px solid var(--border)" }}>
                          <td colSpan={8} style={{ padding: "0.4rem 2rem 0.6rem 2rem" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.75rem", padding: "0.5rem 1rem", border: "1px solid var(--border)", borderRadius: "6px", background: "#f8fafc", maxWidth: "450px" }}>
                              <div style={{ fontWeight: 700, color: "var(--text-muted)", display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "2px", marginBottom: "2px" }}>
                                <span>Batch ID</span>
                                <span>Cost Price</span>
                                <span>Stock Left</span>
                              </div>
                              {(p.batches || []).map(b => (
                                <div key={b.id} style={{ display: "flex", justifyContent: "space-between", fontFamily: "monospace" }}>
                                  <span style={{ color: "#0f766e" }}>{b.id}</span>
                                  <span style={{ fontWeight: 600 }}>฿{b.costPrice.toFixed(2)}</span>
                                  <span style={{ color: "#1e293b" }}>{b.quantity} units</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}
      {historyProduct && <PriceHistoryModal product={historyProduct} onClose={() => setHistoryProduct(null)} />}
      {adjustmentProduct && <StockAdjustmentModal product={adjustmentProduct} onClose={() => setAdjustmentProduct(null)} onApplied={loadProducts} />}
      {movementProduct && <StockMovementModal product={movementProduct} onClose={() => setMovementProduct(null)} />}
    </div>
  );
}
