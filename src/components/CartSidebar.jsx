export default function CartSidebar({ cart, cartSubtotal, taxEnabled, taxRate, taxAmount, cartTotal, onUpdateQty, onClear, onCheckout }) {
  return (
    <div className="pos-cart-sidebar">
      <div className="cart-section-header">
        <h3>Current Order</h3>
        <button onClick={onClear} className="btn-icon" style={{ color: "#ef4444", fontSize: "0.8rem", fontWeight: 600 }}>Clear All</button>
      </div>

      <div className="cart-items-list">
        {cart.length === 0 ? (
          <div className="cart-empty">Cart is empty. Tap items to add.</div>
        ) : (
          cart.map(item => (
            <div key={item.productId} className="cart-item">
              <div className="cart-item-info">
                <div className="cart-item-name">{item.name}</div>
                <div className="cart-item-price">฿{item.sellingPrice} x {item.quantity}</div>
              </div>
              <div className="qty-controls">
                <button onClick={() => onUpdateQty(item.productId, -1)} className="qty-btn">−</button>
                <span className="qty-display">{item.quantity}</span>
                <button onClick={() => onUpdateQty(item.productId, 1)} className="qty-btn">+</button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="cart-section-footer">
        <div className="total-row total-row-sm"><span>Subtotal:</span><span>฿{cartSubtotal.toFixed(2)}</span></div>
        {taxEnabled && <div className="total-row total-row-sm"><span>VAT {taxRate}%:</span><span>฿{taxAmount.toFixed(2)}</span></div>}
        <div className="total-row total-row-sm" style={{ borderTop: "1px solid var(--border)", paddingTop: "0.5rem" }}>
          <span>Total:</span>
          <span className="total-value">฿{cartTotal.toFixed(2)}</span>
        </div>
        <button disabled={cart.length === 0} onClick={onCheckout}
          className="btn btn-primary" style={{ width: "100%", opacity: cart.length === 0 ? 0.5 : 1 }}>
          Checkout Order
        </button>
      </div>
    </div>
  );
}
