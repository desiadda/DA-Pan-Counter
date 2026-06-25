export default function MobileCartDrawer({
  cart,
  cartSubtotal,
  taxEnabled,
  taxRate,
  taxAmount,
  cartTotal,
  onUpdateQty,
  onClear,
  onCheckout,
  onClose,
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={styles.checkoutModal}>
        <div style={styles.modalHeader}>
          <h3>Current Order</h3>
          <button onClick={onClose} style={styles.closeModalBtn}>✕</button>
        </div>

        <div style={{ ...styles.cartItemsList, maxHeight: "50vh", minHeight: "auto" }}>
          {cart.map(item => (
            <div key={item.productId} style={styles.cartItem}>
              <div style={styles.cartItemDetails}>
                <div style={styles.cartItemName}>{item.name}</div>
                <div style={styles.cartItemPrice}>฿{item.sellingPrice} x {item.quantity}</div>
              </div>
              <div style={styles.qtyControls}>
                <button onClick={() => onUpdateQty(item.productId, -1)} style={styles.qtyBtn}>-</button>
                <span style={styles.qtyDisplay}>{item.quantity}</span>
                <button onClick={() => onUpdateQty(item.productId, 1)} style={styles.qtyBtn}>+</button>
              </div>
            </div>
          ))}
        </div>

        <div style={styles.cartFooter}>
          <div style={styles.totalRow}>
            <span>Subtotal:</span>
            <span>฿{cartSubtotal.toFixed(2)}</span>
          </div>
          {taxEnabled && (
            <div style={styles.totalRow}>
              <span>VAT {taxRate}%:</span>
              <span>฿{taxAmount.toFixed(2)}</span>
            </div>
          )}
          <div style={{ ...styles.totalRow, borderTop: "1px solid #e2e8f0", paddingTop: "0.5rem" }}>
            <span style={{ fontSize: "1.1rem" }}>Total:</span>
            <span style={styles.totalValue}>฿{cartTotal.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={onClear}
              className="btn btn-outline"
              style={{ flex: 1 }}
            >
              Clear All
            </button>
            <button
              onClick={() => { onClose(); onCheckout(); }}
              className="btn btn-primary"
              style={{ flex: 2 }}
            >
              Checkout
            </button>
          </div>
        </div>
      </div>
    </div>
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
  cartItemsList: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    minHeight: "150px",
  },
  cartItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cartItemDetails: {
    flex: 1,
  },
  cartItemName: {
    fontSize: "0.9rem",
    fontWeight: "600",
  },
  cartItemPrice: {
    fontSize: "0.8rem",
    color: "#64748b",
  },
  qtyControls: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  qtyBtn: {
    width: "24px",
    height: "24px",
    borderRadius: "4px",
    border: "1px solid #cbd5e1",
    backgroundColor: "#f8fafc",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
  },
  qtyDisplay: {
    fontSize: "0.9rem",
    fontWeight: "bold",
    minWidth: "20px",
    textAlign: "center",
  },
  cartFooter: {
    borderTop: "1px solid #e2e8f0",
    paddingTop: "0.75rem",
    marginTop: "0.75rem",
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "1.1rem",
    fontWeight: "bold",
    marginBottom: "0.75rem",
  },
  totalValue: {
    color: "#047857",
    fontSize: "1.3rem",
    fontWeight: "800",
  },
};
