import { useState, useEffect } from "react";
import { dbService } from "../firebase";
import { useConfirm } from "../context/ConfirmContext";
import { SkeletonTable } from "./Skeleton";
import { logError } from "../db/errorLog";
import PriceHistoryModal from "./PriceHistoryModal";
import PurchaseOrders from "./PurchaseOrders";
import BulkPriceUpdate from "./BulkPriceUpdate";
import SupplierDirectory from "./SupplierDirectory";

export default function InventoryView() {
  const confirm = useConfirm();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Form states for Add/Edit
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Paan Special");
  const [barcode, setBarcode] = useState("");
  
  // Single Pricing & Stock
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [stock, setStock] = useState("");
  const [lowStockLimit, setLowStockLimit] = useState("10");
  
  // Box/Pack Pricing & Stock (Cigarettes)
  const [isCigarette, setIsCigarette] = useState(false);
  const [packSize, setPackSize] = useState("20");
  const [costPricePack, setCostPricePack] = useState("");
  const [sellingPricePack, setSellingPricePack] = useState("");
  const [stockPack, setStockPack] = useState("");
  const [looseStock, setLooseStock] = useState("");
  const [historyProduct, setHistoryProduct] = useState(null);
  const [viewMode, setViewMode] = useState("stock");

  useEffect(() => {
    loadProducts();
  }, []);

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
    
    // Calculate box and loose from sticks
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

    // Calculate total sticks stock
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
      title: "Delete Product",
      confirmLabel: "Delete",
      variant: "danger",
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
    const updated = {
      ...p,
      stock: newStock,
    };
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
    <div style={styles.container}>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
        <h2 style={{ ...styles.viewTitle, margin: 0 }}>Inventory</h2>
        <div style={{ display: "flex", gap: "4px", marginLeft: "auto", overflowX: "auto", whiteSpace: "nowrap", WebkitOverflowScrolling: "touch" }}>
          {[
            { key: "stock", label: "📦 Stock" },
            { key: "purchases", label: "📋 Purchases" },
            { key: "suppliers", label: "📍 Suppliers" },
            { key: "bulk", label: "⚡ Bulk Price" },
          ].map(t => (
            <button key={t.key} onClick={() => setViewMode(t.key)} style={{
              ...styles.tabToggle,
              ...(viewMode === t.key ? styles.tabActive : {}),
            }}>{t.label}</button>
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
      {/* Stock Value Summary */}
      {!loading && products.length > 0 && (
        <div className="inventory-value-summary" style={styles.valueSummary}>
          <div style={styles.valueCard}>
            <span style={styles.valueLabel}>Cost Value</span>
            <span style={styles.valueAmount}>฿{products.reduce((sum, p) => sum + (p.stock * p.costPrice), 0).toLocaleString()}</span>
            <span style={styles.valueSub}>Total purchase cost</span>
          </div>
          <div style={styles.valueCard}>
            <span style={styles.valueLabel}>Sales Value</span>
            <span style={styles.valueAmountGreen}>฿{products.reduce((sum, p) => sum + (p.stock * p.sellingPrice), 0).toLocaleString()}</span>
            <span style={styles.valueSub}>If all stock sells</span>
          </div>
          <div style={styles.valueCard}>
            <span style={styles.valueLabel}>Est. Profit</span>
            <span style={styles.valueAmountProfit}>฿{products.reduce((sum, p) => sum + (p.stock * (p.sellingPrice - p.costPrice)), 0).toLocaleString()}</span>
            <span style={styles.valueSub}>Sales − Cost</span>
          </div>
        </div>
      )}

      {/* Add / Edit Form Panel */}
      <div style={styles.formCard}>
        <h3 style={styles.formTitle}>{isEditing ? "Edit Product" : "Add New Product"}</h3>
        <form onSubmit={handleSubmit} style={styles.formGrid}>
          <div className="input-group">
            <label className="input-label">Product Name</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="e.g. Meetha Paan" 
              className="input-field" 
            />
          </div>

          <div className="input-group">
            <label className="input-label">Barcode (optional)</label>
            <input
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Scan or enter barcode"
              className="input-field"
            />
          </div>

          <div className="input-group">
            <label className="input-label">Category</label>
            <select 
              value={category} 
              onChange={(e) => setCategory(e.target.value)} 
              className="input-field"
            >
              <option value="Paan Special">Paan Special</option>
              <option value="Cigarettes">Cigarettes</option>
              <option value="Mouth Freshner">Mouth Freshner</option>
              <option value="Beverages">Beverages</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">Cost Price (฿)</label>
            <input 
              type="number" 
              value={costPrice} 
              onChange={(e) => setCostPrice(e.target.value)} 
              placeholder="Store purchase price" 
              className="input-field" 
            />
          </div>

          <div className="input-group">
            <label className="input-label">Selling Price (฿)</label>
            <input 
              type="number" 
              value={sellingPrice} 
              onChange={(e) => setSellingPrice(e.target.value)} 
              placeholder="Counter selling price" 
              className="input-field" 
            />
          </div>

          {!isCigarette && (
            <div className="input-group">
              <label className="input-label">Current Stock</label>
              <input 
                type="number" 
                value={stock} 
                onChange={(e) => setStock(e.target.value)} 
                placeholder="In-stock count" 
                className="input-field" 
              />
            </div>
          )}

          <div className="input-group">
            <label className="input-label">Low Stock Alert Limit (sticks/pcs)</label>
            <input 
              type="number" 
              value={lowStockLimit} 
              onChange={(e) => setLowStockLimit(e.target.value)} 
              placeholder="Warning limit" 
              className="input-field" 
            />
          </div>

          {/* Cigarette / Pack Linkage logic */}
          <div style={styles.fullWidthCheckbox}>
            <label style={styles.checkboxLabel}>
              <input 
                type="checkbox" 
                checked={isCigarette} 
                onChange={(e) => setIsCigarette(e.target.checked)} 
              />
              {" "} Link Single / Box product variants (Cigarette items)
            </label>
          </div>

          {isCigarette && (
            <>
              <div className="input-group">
                <label className="input-label">Pcs/Sticks per Box</label>
                <input 
                  type="number" 
                  value={packSize} 
                  onChange={(e) => setPackSize(e.target.value)} 
                  className="input-field" 
                  placeholder="e.g. 20"
                />
              </div>

              <div className="input-group">
                <label className="input-label">Box Cost Price (฿)</label>
                <input 
                  type="number" 
                  value={costPricePack} 
                  onChange={(e) => setCostPricePack(e.target.value)} 
                  className="input-field" 
                  placeholder="Buy price per box"
                />
              </div>

              <div className="input-group">
                <label className="input-label">Box Selling Price (฿)</label>
                <input 
                  type="number" 
                  value={sellingPricePack} 
                  onChange={(e) => setSellingPricePack(e.target.value)} 
                  className="input-field" 
                  placeholder="Sell price per box"
                />
              </div>

              <div className="input-group">
                <label className="input-label">Current Boxes Stock</label>
                <input 
                  type="number" 
                  value={stockPack} 
                  onChange={(e) => setStockPack(e.target.value)} 
                  className="input-field" 
                  placeholder="Boxes in stock"
                />
              </div>

              <div className="input-group">
                <label className="input-label">Current Loose Pcs Stock</label>
                <input 
                  type="number" 
                  value={looseStock} 
                  onChange={(e) => setLooseStock(e.target.value)} 
                  className="input-field" 
                  placeholder="Loose pieces in stock"
                />
              </div>
            </>
          )}

          <div style={styles.formActions}>
            <button type="submit" className="btn btn-primary">{isEditing ? "Update Product" : "Add Product"}</button>
            <button type="button" onClick={handleCancel} className="btn btn-outline">Cancel</button>
          </div>
        </form>
      </div>

      {/* Stock Alerts & Inventory List */}
      <div style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <h3>Product Stock Status</h3>
          <button onClick={loadProducts} className="btn btn-outline" style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}>Refresh</button>
        </div>

        {loading ? (
          <SkeletonTable rows={5} />
        ) : (
          <div style={{...styles.tableWrapper}} className="inventory-table-wrapper">
            <table style={styles.table} className="inventory-table">
              <thead>
                <tr>
                  <th style={styles.th}>Product</th>
                  <th style={styles.th}>Category</th>
                  <th style={styles.th}>Cost</th>
                  <th style={styles.th}>Sell</th>
                  <th style={styles.th}>Stock</th>
                  <th style={styles.th}>Restock</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const isLow = p.stock <= p.lowStockLimit;
                  return (
                    <tr key={p.id} style={styles.tr}>
                      <td data-label="Product" style={styles.td}>
                        <div style={styles.prodNameContainer}>
                          <span style={styles.prodName}>{p.name}</span>
                          <span style={styles.prodId}>{p.id}</span>
                        </div>
                      </td>
                      <td data-label="Category" style={styles.td}>{p.category}</td>
                      <td data-label="Cost" style={styles.td}>
                        {p.isCigarette ? (
                          <span>฿{p.costPrice} / ฿{p.costPricePack}</span>
                        ) : (
                          <span>฿{p.costPrice}</span>
                        )}
                      </td>
                      <td data-label="Sell" style={styles.td}>
                        {p.isCigarette ? (
                          <span>฿{p.sellingPrice} / ฿{p.sellingPricePack}</span>
                        ) : (
                          <span>฿{p.sellingPrice}</span>
                        )}
                      </td>
                      <td data-label="Stock" style={styles.td}>
                        {p.isCigarette ? (
                          <span style={{ fontWeight: "bold", color: isLow ? "#ea580c" : "inherit" }}>
                            {p.stock}p / {(p.stockPack != null ? p.stockPack : Math.floor(p.stock / (p.packSize || 20)))}box
                            {isLow && <span style={styles.lowAlert}>⚠️</span>}
                          </span>
                        ) : (
                          <span style={{ ...styles.stockCount, ...(isLow ? styles.lowStockCount : {}) }}>
                            {p.stock}
                            {isLow && <span style={styles.lowAlert}>⚠️</span>}
                          </span>
                        )}
                      </td>
                      <td data-label="Restock" style={styles.td}>
                        <div style={styles.replenishGroup}>
                          <button onClick={() => quickReplenish(p, 10)} style={styles.repBtn}>+10</button>
                          <button onClick={() => quickReplenish(p, 50)} style={styles.repBtn}>+50</button>
                        </div>
                      </td>
                      <td data-label="Actions" style={styles.td}>
                        <div style={styles.actionGroup}>
                          <button onClick={() => handleEdit(p)} style={styles.editBtn}>Edit</button>
                          <button onClick={() => setHistoryProduct(p)} style={styles.histBtn}>History</button>
                          <button onClick={() => handleDelete(p.id)} style={styles.delBtn}>Delete</button>
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

const styles = {
  container: {
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  viewTitle: {
    color: "#047857",
    fontSize: "1.15rem",
    fontWeight: "bold",
  },
  tabToggle: {
    padding: "0.35rem 0.8rem", fontSize: "0.75rem", fontWeight: 600,
    border: "1px solid #e2e8f0", background: "#fff", color: "#475569",
    cursor: "pointer", borderRadius: "20px", transition: "all 0.15s",
  },
  tabActive: {
    background: "#047857", color: "#fff", borderColor: "#047857",
    boxShadow: "0 2px 6px rgba(4,120,87,0.25)",
  },
  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    padding: "1rem",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  formTitle: {
    fontSize: "1rem",
    marginBottom: "1rem",
    color: "#1e293b",
    borderBottom: "1px solid #f1f5f9",
    paddingBottom: "0.5rem",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "0.75rem",
  },
  fullWidthCheckbox: {
    gridColumn: "1 / -1",
    padding: "0.5rem 0",
  },
  checkboxLabel: {
    fontSize: "0.9rem",
    color: "#475569",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    cursor: "pointer",
  },
  formActions: {
    gridColumn: "1 / -1",
    display: "flex",
    gap: "0.5rem",
    marginTop: "0.5rem",
  },
  tableCard: {
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    padding: "1rem",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  tableHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.75rem",
  },
  loading: {
    textAlign: "center",
    padding: "2rem 0",
    color: "#64748b",
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "0.85rem",
    textAlign: "left",
  },
  th: {
    borderBottom: "2px solid #e2e8f0",
    padding: "0.6rem 0.5rem",
    color: "#64748b",
    fontWeight: "bold",
  },
  tr: {
    borderBottom: "1px solid #e2e8f0",
  },
  td: {
    padding: "0.6rem 0.5rem",
    verticalAlign: "middle",
  },
  prodNameContainer: {
    display: "flex",
    flexDirection: "column",
  },
  prodName: {
    fontWeight: "700",
    color: "#1e293b",
  },
  prodId: {
    fontSize: "0.7rem",
    color: "#94a3b8",
  },
  stockCount: {
    fontWeight: "bold",
    fontSize: "0.9rem",
  },
  lowStockCount: {
    color: "#ea580c",
  },
  lowAlert: {
    fontSize: "0.65rem",
    backgroundColor: "#fff7ed",
    color: "#ea580c",
    padding: "1px 3px",
    borderRadius: "4px",
    marginLeft: "4px",
    fontWeight: "bold",
  },
  replenishGroup: {
    display: "flex",
    gap: "0.25rem",
  },
  repBtn: {
    padding: "3px 6px",
    borderRadius: "4px",
    border: "1px solid #cbd5e1",
    backgroundColor: "#f8fafc",
    fontSize: "0.75rem",
    fontWeight: "bold",
    cursor: "pointer",
  },
  actionGroup: {
    display: "flex",
    gap: "0.5rem",
  },
  editBtn: {
    color: "#047857",
    fontWeight: "600",
    background: "none",
    border: "none",
    cursor: "pointer",
  },
  delBtn: {
    color: "#ef4444",
    fontWeight: "600",
    background: "none",
    border: "none",
    cursor: "pointer",
  },
  histBtn: {
    color: "#2563eb",
    fontWeight: "600",
    background: "none",
    border: "none",
    cursor: "pointer",
  },
  valueSummary: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "0.75rem",
  },
  valueCard: {
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    padding: "0.75rem",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  valueLabel: {
    fontSize: "0.7rem",
    fontWeight: "600",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  valueAmount: {
    fontSize: "1.1rem",
    fontWeight: "800",
    color: "#dc2626",
  },
  valueAmountGreen: {
    fontSize: "1.1rem",
    fontWeight: "800",
    color: "#047857",
  },
  valueAmountProfit: {
    fontSize: "1.1rem",
    fontWeight: "800",
    color: "#2563eb",
  },
  valueSub: {
    fontSize: "0.65rem",
    color: "#94a3b8",
  },
};
