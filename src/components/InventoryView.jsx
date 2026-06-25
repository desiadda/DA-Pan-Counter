import { useState, useEffect } from "react";
import { dbService } from "../firebase";
import { useConfirmStore } from "../stores/confirmStore";
import { SkeletonTable } from "./Skeleton";
import { logError } from "../db/errorLog";
import PriceHistoryModal from "./PriceHistoryModal";
import PurchaseOrders from "./PurchaseOrders";
import BulkPriceUpdate from "./BulkPriceUpdate";
import SupplierDirectory from "./SupplierDirectory";

export default function InventoryView() {
  const confirm = useConfirmStore((s) => s.confirm);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Paan Special");
  const [barcode, setBarcode] = useState("");
  
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [stock, setStock] = useState("");
  const [lowStockLimit, setLowStockLimit] = useState("10");
  
  const [isCigarette, setIsCigarette] = useState(false);
  const [packSize, setPackSize] = useState("20");
  const [costPricePack, setCostPricePack] = useState("");
  const [sellingPricePack, setSellingPricePack] = useState("");
  const [stockPack, setStockPack] = useState("");
  const [looseStock, setLooseStock] = useState("");
  const [historyProduct, setHistoryProduct] = useState(null);
  const [viewMode, setViewMode] = useState("stock");

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const list = await dbService.getProducts();
      setProducts(list);
    } catch (err) {
      logError("INVENTORY", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to load products"));
      console.error(err);
    }
    setLoading(false);
  };

  const handleEdit = (p) => {
    setIsEditing(true);
    setEditId(p.id);
    setName(p.name);
    setCategory(p.category);
    setCostPrice(p.costPrice.toString());
    setSellingPrice(p.sellingPrice.toString());
    setStock(p.stock.toString());
    setLowStockLimit(p.lowStockLimit.toString());
    setBarcode(p.barcode || "");
    
    setIsCigarette(p.isCigarette || false);
    setPackSize(p.packSize ? p.packSize.toString() : "20");
    setCostPricePack(p.costPricePack ? p.costPricePack.toString() : "");
    setSellingPricePack(p.sellingPricePack ? p.sellingPricePack.toString() : "");
    
    if (p.isCigarette) {
      const pSize = p.packSize || 20;
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
    setCategory("Paan Special");
    setCostPrice("");
    setSellingPrice("");
    setStock("");
    setLowStockLimit("10");
    setBarcode("");
    setIsCigarette(false);
    setPackSize("20");
    setCostPricePack("");
    setSellingPricePack("");
    setStockPack("");
    setLooseStock("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !costPrice || !sellingPrice) {
      alert("Please fill all pricing fields.");
      return;
    }
    if (!isCigarette && !stock) {
      alert("Please fill stock amount.");
      return;
    }
    if (isCigarette && (!costPricePack || !sellingPricePack || !stockPack || !packSize)) {
      alert("Please fill all box/pack variant fields.");
      return;
    }
    let totalStock = parseInt(stock) || 0;
    if (isCigarette) {
      const bStock = parseInt(stockPack) || 0;
      const pSize = parseInt(packSize) || 20;
      const lStock = parseInt(looseStock) || 0;
      totalStock = (bStock * pSize) + lStock;
    }
    const updatedProduct = {
      id: editId || undefined,
      name: name.trim(),
      category,
      barcode: barcode.trim(),
      costPrice: parseFloat(costPrice),
      sellingPrice: parseFloat(sellingPrice),
      stock: totalStock,
      lowStockLimit: parseInt(lowStockLimit),
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
      alert("Product saved successfully!");
    } catch (err) {
      logError("INVENTORY", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to save product"));
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
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

  const quickReplenish = async (p, qty) => {
    const newStock = p.stock + qty;
    const updated = { ...p, stock: newStock };
    if (p.isCigarette) {
      const pSize = p.packSize || 20;
      updated.stockPack = Math.floor(newStock / pSize);
      updated.stockLoose = newStock % pSize;
    }
    try {
      await dbService.saveProduct(updated);
      loadProducts();
    } catch (err) {
      logError("INVENTORY", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to replenish stock"));
      console.error(err);
    }
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
          ].map(t => (
            <button key={t.key} onClick={() => setViewMode(t.key)}
              className={`tab-toggle ${viewMode === t.key ? "tab-toggle-active" : ""}`}>{t.label}</button>
          ))}
        </div>
      </div>

      {viewMode === "purchases" ? (
        <PurchaseOrders />
      ) : viewMode === "suppliers" ? (
        <SupplierDirectory />
      ) : viewMode === "bulk" ? (
        <BulkPriceUpdate products={products} onDone={loadProducts} />
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
              <option value="Paan Special">Paan Special</option>
              <option value="Cigarettes">Cigarettes</option>
              <option value="Mouth Freshner">Mouth Freshner</option>
              <option value="Beverages">Beverages</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Cost Price (฿)</label>
            <input type="number" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="Store purchase price" className="input-field" />
          </div>
          <div className="input-group">
            <label className="input-label">Selling Price (฿)</label>
            <input type="number" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} placeholder="Counter selling price" className="input-field" />
          </div>
          {!isCigarette && (
            <div className="input-group">
              <label className="input-label">Current Stock</label>
              <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="In-stock count" className="input-field" />
            </div>
          )}
          <div className="input-group">
            <label className="input-label">Low Stock Alert Limit (sticks/pcs)</label>
            <input type="number" value={lowStockLimit} onChange={(e) => setLowStockLimit(e.target.value)} placeholder="Warning limit" className="input-field" />
          </div>
          <div style={{ gridColumn: "1 / -1", padding: "0.5rem 0" }}>
            <label className="user-perm-toggle">
              <input type="checkbox" checked={isCigarette} onChange={(e) => setIsCigarette(e.target.checked)} />
              {" "} Link Single / Box product variants (Cigarette items)
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
                  <th style={{ borderBottom: "2px solid var(--border)", padding: "0.6rem 0.5rem", color: "var(--text-muted)", fontWeight: "bold" }}>Stock</th>
                  <th style={{ borderBottom: "2px solid var(--border)", padding: "0.6rem 0.5rem", color: "var(--text-muted)", fontWeight: "bold" }}>Restock</th>
                  <th style={{ borderBottom: "2px solid var(--border)", padding: "0.6rem 0.5rem", color: "var(--text-muted)", fontWeight: "bold" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const isLow = p.stock <= p.lowStockLimit;
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td data-label="Product" style={{ padding: "0.6rem 0.5rem", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: 700, color: "var(--text)" }}>{p.name}</span>
                          <span className="text-muted text-xs">{p.id}</span>
                        </div>
                      </td>
                      <td data-label="Category" style={{ padding: "0.6rem 0.5rem", verticalAlign: "middle" }}>{p.category}</td>
                      <td data-label="Cost" style={{ padding: "0.6rem 0.5rem", verticalAlign: "middle" }}>
                        {p.isCigarette ? <span>฿{p.costPrice} / ฿{p.costPricePack}</span> : <span>฿{p.costPrice}</span>}
                      </td>
                      <td data-label="Sell" style={{ padding: "0.6rem 0.5rem", verticalAlign: "middle" }}>
                        {p.isCigarette ? <span>฿{p.sellingPrice} / ฿{p.sellingPricePack}</span> : <span>฿{p.sellingPrice}</span>}
                      </td>
                      <td data-label="Stock" style={{ padding: "0.6rem 0.5rem", verticalAlign: "middle" }}>
                        {p.isCigarette ? (
                          <span style={{ fontWeight: "bold", color: isLow ? "#ea580c" : "inherit" }}>
                            {p.stock}p / {(p.stockPack != null ? p.stockPack : Math.floor(p.stock / (p.packSize || 20)))}box
                            {isLow && <span className="stock-badge stock-badge-low" style={{ marginLeft: 4 }}>⚠️</span>}
                          </span>
                        ) : (
                          <span style={{ fontWeight: "bold", fontSize: "0.9rem", color: isLow ? "#ea580c" : "inherit" }}>
                            {p.stock}
                            {isLow && <span className="stock-badge stock-badge-low" style={{ marginLeft: 4 }}>⚠️</span>}
                          </span>
                        )}
                      </td>
                      <td data-label="Restock" style={{ padding: "0.6rem 0.5rem", verticalAlign: "middle" }}>
                        <div className="flex gap-xs">
                          <button onClick={() => quickReplenish(p, 10)} className="qty-btn" style={{ width: "auto", padding: "3px 6px", fontSize: "0.75rem", height: "auto" }}>+10</button>
                          <button onClick={() => quickReplenish(p, 50)} className="qty-btn" style={{ width: "auto", padding: "3px 6px", fontSize: "0.75rem", height: "auto" }}>+50</button>
                        </div>
                      </td>
                      <td data-label="Actions" style={{ padding: "0.6rem 0.5rem", verticalAlign: "middle" }}>
                        <div className="flex gap-sm">
                          <button onClick={() => handleEdit(p)} className="btn-icon" style={{ color: "var(--primary)", fontWeight: 600, fontSize: "0.8rem" }}>Edit</button>
                          <button onClick={() => setHistoryProduct(p)} className="btn-icon" style={{ color: "#2563eb", fontWeight: 600, fontSize: "0.8rem" }}>History</button>
                          <button onClick={() => handleDelete(p.id)} className="btn-icon" style={{ color: "var(--error)", fontWeight: 600, fontSize: "0.8rem" }}>Delete</button>
                        </div>
                      </td>
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
    </div>
  );
}
