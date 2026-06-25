export default function MobileCartDrawer({
  cart, cartSubtotal, taxEnabled, taxRate, taxAmount, cartTotal,
  onUpdateQty, onClear, onCheckout, onClose,
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content mobile-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h3>Current Order</h3>
          <button onClick={onClose} className="sheet-close-btn">✕</button>
        </div>

        <div className="cart-items-list" style={{ maxHeight: "50vh", minHeight: "auto" }}>
          {cart.map(item => (
            <div key={item.productId} className="cart-item">
              <div className="cart-item-info">
                <div className="cart-item-name">{item.name}</div>
                <div className="cart-item-price">฿{item.sellingPrice} x {item.quantity}</div>
              </div>
              <div className="qty-controls">
                <button onClick={() => onUpdateQty(item.productId, -1)} className="qty-btn">-</button>
                <span className="qty-display">{item.quantity}</span>
                <button onClick={() => onUpdateQty(item.productId, 1)} className="qty-btn">+</button>
              </div>
            </div>
          ))}
        </div>

        <div className="cart-section-footer">
          <div className="total-row total-row-lg"><span>Subtotal:</span><span>฿{cartSubtotal.toFixed(2)}</span></div>
          {taxEnabled && (
            <div className="total-row total-row-sm"><span>VAT {taxRate}%:</span><span>฿{taxAmount.toFixed(2)}</span></div>
          )}
          <div className="total-row total-row-lg" style={{ borderTop: "1px solid var(--border)", paddingTop: "0.5rem" }}>
            <span className="total-value">Total:</span>
            <span className="total-value">฿{cartTotal.toFixed(2)}</span>
          </div>
          <div className="flex-btn-group">
            <button onClick={onClear} className="btn btn-outline">Clear All</button>
            <button onClick={() => { onClose(); onCheckout(); }} className="btn btn-primary" style={{ flex: 2 }}>Checkout</button>
          </div>
        </div>
      </div>
    </div>
  );
}
