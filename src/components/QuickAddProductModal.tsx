import { useState } from "react";
import ModalPortal from "./ModalPortal";
import { dbService } from "../firebase";
import { useLangStore } from "../stores/langStore";
import { useT } from "../lang/translations";
import { CATEGORIES, DEFAULT_LOW_STOCK_LIMIT, DEFAULT_PACK_SIZE } from "../constants";
import { logError } from "../db/errorLog";

interface QuickAddProductModalProps {
  onClose: () => void;
  onSuccess: (newProduct: any) => void;
  initialName?: string;
}

export default function QuickAddProductModal({ onClose, onSuccess, initialName = "" }: QuickAddProductModalProps) {
  const lang = useLangStore((s) => s.lang);
  const tr = useT(lang);

  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState(CATEGORIES[0] || "Paan");
  const [barcode, setBarcode] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [lowStockLimit, setLowStockLimit] = useState(String(DEFAULT_LOW_STOCK_LIMIT));
  const [isNonInventory, setIsNonInventory] = useState(false);

  const [isCigarette, setIsCigarette] = useState(false);
  const [packSize, setPackSize] = useState(String(DEFAULT_PACK_SIZE));
  const [costPricePack, setCostPricePack] = useState("");
  const [sellingPricePack, setSellingPricePack] = useState("");
  const [stockPack, setStockPack] = useState("0");
  const [looseStock, setLooseStock] = useState("0");

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || sellingPrice === "" || isNaN(parseFloat(sellingPrice))) {
      alert(tr("inventory.pleaseFill"));
      return;
    }
    if (!isCigarette && !isNonInventory && stock === "") {
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

    const newProduct = {
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
      setSubmitting(true);
      const savedProd = await dbService.saveProduct(newProduct);
      const resultProd = savedProd || { id: "p_" + Date.now(), ...newProduct };
      onSuccess(resultProd);
      onClose();
    } catch (err: any) {
      logError("INVENTORY", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to save product"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal onClose={onClose}>
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.5)",
          zIndex: 200,
          display: "flex",
          alignItems: "center",
          justify: "center",
          padding: "1rem",
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            width: "100%",
            maxWidth: "480px",
            maxHeight: "90vh",
            overflowY: "auto",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.5rem" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#047857" }}>
              📦 {tr("purchase.quickAddProductTitle")}
            </h3>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "#64748b" }}>✕</button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">{tr("inventory.productName")}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Special Meetha Paan"
                className="input-field"
                required
                autoFocus
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">{tr("inventory.category")}</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field">
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">{tr("inventory.barcode")}</label>
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Barcode"
                  className="input-field"
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">{tr("inventory.costPrice")}</label>
                <input
                  type="number"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  placeholder="0.00"
                  className="input-field"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">{tr("inventory.sellingPrice")} *</label>
                <input
                  type="number"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  placeholder="0.00"
                  className="input-field"
                  required
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.4rem 0.6rem", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#334155" }}>{tr("inventory.nonInventory")}</span>
              <label className="switch">
                <input type="checkbox" checked={isNonInventory} onChange={(e) => setIsNonInventory(e.target.checked)} />
                <span className="slider"></span>
              </label>
            </div>

            {!isNonInventory && !isCigarette && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">{tr("inventory.currentStock")}</label>
                  <input
                    type="number"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="input-field"
                    min="0"
                  />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">{tr("inventory.lowStockLimit")}</label>
                  <input
                    type="number"
                    value={lowStockLimit}
                    onChange={(e) => setLowStockLimit(e.target.value)}
                    className="input-field"
                    min="0"
                  />
                </div>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.4rem 0.6rem", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#334155" }}>{tr("inventory.linkVariants")}</span>
              <label className="switch">
                <input type="checkbox" checked={isCigarette} onChange={(e) => setIsCigarette(e.target.checked)} />
                <span className="slider"></span>
              </label>
            </div>

            {isCigarette && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", background: "#f1f5f9", padding: "0.5rem", borderRadius: "8px" }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">{tr("inventory.packSize")}</label>
                  <input type="number" value={packSize} onChange={(e) => setPackSize(e.target.value)} className="input-field" placeholder="20" />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">{tr("inventory.boxCostPrice")}</label>
                  <input type="number" value={costPricePack} onChange={(e) => setCostPricePack(e.target.value)} className="input-field" placeholder="0.00" />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">{tr("inventory.boxSellingPrice")}</label>
                  <input type="number" value={sellingPricePack} onChange={(e) => setSellingPricePack(e.target.value)} className="input-field" placeholder="0.00" />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">{tr("inventory.boxStock")}</label>
                  <input type="number" value={stockPack} onChange={(e) => setStockPack(e.target.value)} className="input-field" placeholder="0" />
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button type="submit" disabled={submitting} className="btn btn-primary" style={{ flex: 1, padding: "0.6rem" }}>
                {submitting ? tr("supplier.saving") : tr("inventory.addProductBtn")}
              </button>
              <button type="button" onClick={onClose} className="btn btn-outline" style={{ flex: 1, padding: "0.6rem" }}>
                {tr("common.cancel")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
