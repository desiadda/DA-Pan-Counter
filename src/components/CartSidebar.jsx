export default function CartSidebar({ cart, cartSubtotal, taxEnabled, taxRate, taxAmount, cartTotal, onUpdateQty, onClear, onCheckout }) {
  return (
    <div className="pos-cart-sidebar">
      <div style={styles.cartHeader}>
        <h3>Current Order</h3>
        <button onClick={onClear} style={styles.clearCartBtn}>Clear All</button>
      </div>

      <div style={styles.cartItemsList}>
        {cart.length === 0 ? (
          <div style={styles.emptyCart}>Cart is empty. Tap items to add.</div>
        ) : (
          cart.map(item => (
            <div key={item.productId} style={styles.cartItem}>
              <div style={styles.cartItemDetails}>
                <div style={styles.cartItemName}>{item.name}</div>
                <div style={styles.cartItemPrice}>฿{item.sellingPrice} x {item.quantity}</div>
              </div>
              <div style={styles.qtyControls}>
                <button onClick={() => onUpdateQty(item.productId, -1)} style={styles.qtyBtn}>−</button>
                <span style={styles.qtyDisplay}>{item.quantity}</span>
                <button onClick={() => onUpdateQty(item.productId, 1)} style={styles.qtyBtn}>+</button>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={styles.cartFooter}>
        <div style={styles.totalRow}><span>Subtotal:</span><span>฿{cartSubtotal.toFixed(2)}</span></div>
        {taxEnabled && <div style={styles.totalRow}><span>VAT {taxRate}%:</span><span>฿{taxAmount.toFixed(2)}</span></div>}
        <div style={{ ...styles.totalRow, borderTop: "1px solid #e2e8f0", paddingTop: "0.5rem" }}>
          <span style={{ fontSize: "0.875rem" }}>Total:</span>
          <span style={styles.totalValue}>฿{cartTotal.toFixed(2)}</span>
        </div>
        <button disabled={cart.length === 0} onClick={onCheckout}
          style={{ ...styles.checkoutBtn, ...(cart.length === 0 ? styles.disabledCheckoutBtn : {}) }}>
          Checkout Order
        </button>
      </div>
    </div>
  );
}

const styles = {
  cartHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.75rem", marginBottom: "0.75rem" },
  clearCartBtn: { background: "none", border: "none", color: "#ef4444", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", padding: "0.35rem" },
  cartItemsList: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.75rem", minHeight: "150px" },
  emptyCart: { textAlign: "center", color: "#94a3b8", padding: "2rem 0", fontSize: "0.8rem" },
  cartItem: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  cartItemDetails: { flex: 1 },
  cartItemName: { fontSize: "0.85rem", fontWeight: 600 },
  cartItemPrice: { fontSize: "0.75rem", color: "#64748b" },
  qtyControls: { display: "flex", alignItems: "center", gap: "0.35rem" },
  qtyBtn: { width: "36px", height: "36px", borderRadius: "8px", border: "1px solid #cbd5e1", backgroundColor: "#f8fafc", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "1rem" },
  qtyDisplay: { fontSize: "0.875rem", fontWeight: 700, minWidth: "24px", textAlign: "center" },
  cartFooter: { borderTop: "1px solid #e2e8f0", paddingTop: "0.75rem", marginTop: "0.75rem" },
  totalRow: { display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.5rem" },
  totalValue: { color: "#047857", fontSize: "1.1rem", fontWeight: 800 },
  checkoutBtn: { width: "100%", padding: "0.85rem", backgroundColor: "#047857", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "0.875rem", cursor: "pointer" },
  disabledCheckoutBtn: { backgroundColor: "#cbd5e1", cursor: "not-allowed" },
};
