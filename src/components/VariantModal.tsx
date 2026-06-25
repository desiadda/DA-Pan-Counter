import ModalPortal from "./ModalPortal";

export default function VariantModal({ product, onSelect, onClose }) {
  if (!product) return null;
  const availableBoxes = product.stockPack != null ? product.stockPack : Math.floor(product.stock / (product.packSize || 20));

  return (
    <ModalPortal>
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={styles.checkoutModal}>
        <div style={styles.modalHeader}>
          <h3 style={{ color: "#047857" }}>{product.name}</h3>
          <button onClick={onClose} style={styles.closeModalBtn}>✕</button>
        </div>

        <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "-0.5rem 0 0.5rem 0" }}>
          Select packing size / variant for billing:
        </p>

        <div style={styles.variantSelectorGrid}>
          <button
            onClick={() => { onSelect(product, "single"); onClose(); }}
            style={{
              ...styles.variantSelectBtn,
              ...(product.stock <= 0 ? styles.variantSelectBtnDisabled : {}),
            }}
            disabled={product.stock <= 0}
          >
            <div style={styles.variantBtnLabel}>☝️ SINGLE / STICK</div>
            <div style={styles.variantBtnPrice}>฿{product.sellingPrice}</div>
            <div style={styles.variantBtnStock}>Stock: {product.stock} pcs</div>
          </button>

          <button
            onClick={() => { onSelect(product, "pack"); onClose(); }}
            style={{
              ...styles.variantSelectBtn,
              ...styles.variantSelectBtnBox,
              ...(availableBoxes <= 0 ? styles.variantSelectBtnDisabled : {}),
            }}
            disabled={availableBoxes <= 0}
          >
            <div style={styles.variantBtnLabel}>📦 BOX / PACK ({product.packSize} sticks)</div>
            <div style={styles.variantBtnPrice}>฿{product.sellingPricePack}</div>
            <div style={styles.variantBtnStock}>Stock: {availableBoxes} boxes</div>
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

const styles = {
  checkoutModal: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #e2e8f0",
    paddingBottom: "0.5rem",
  },
  closeModalBtn: {
    background: "none",
    border: "none",
    fontSize: "1.2rem",
    cursor: "pointer",
    color: "#64748b",
  },
  variantSelectorGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    marginTop: "0.5rem",
  },
  variantSelectBtn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "1.25rem",
    borderRadius: "12px",
    border: "2px solid #047857",
    backgroundColor: "#ecfdf5",
    color: "#047857",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  variantSelectBtnBox: {
    border: "2px solid #d97706",
    backgroundColor: "#fffbeb",
    color: "#b45309",
  },
  variantSelectBtnDisabled: {
    border: "2px solid #cbd5e1",
    backgroundColor: "#f1f5f9",
    color: "#94a3b8",
    cursor: "not-allowed",
  },
  variantBtnLabel: {
    fontSize: "0.95rem",
    fontWeight: "bold",
    marginBottom: "0.25rem",
  },
  variantBtnPrice: {
    fontSize: "1.5rem",
    fontWeight: "800",
    marginBottom: "0.25rem",
  },
  variantBtnStock: {
    fontSize: "0.75rem",
    fontWeight: "600",
  },
};
