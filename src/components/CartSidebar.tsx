import ItemDiscountControl from "./ItemDiscountControl";

export default function CartSidebar({ cart, cartSubtotal, taxEnabled, taxRate, taxAmount, cartTotal, onUpdateQty, onClear, onCheckout, onUpdateItemDiscount, discountReasons }) {
  const lineAmount = (item) => {
    const lineTotal = (item.sellingPrice || 0) * (item.quantity || 1);
    if (item.discountType === "percent") return lineTotal * Math.min(item.discountValue || 0, 100) / 100;
    if (item.discountType === "fixed") return Math.min(item.discountValue || 0, lineTotal);
    return 0;
  };

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
          cart.map(item => {
            const disc = lineAmount(item);
            const net = (item.sellingPrice * item.quantity) - disc;
            return (
              <div key={item.productId} className="cart-item">
                <div className="cart-item-info">
                  <div className="cart-item-name">{item.name}</div>
                  <div className="cart-item-price">
                    ฿{item.sellingPrice} x {item.quantity}
                    {disc > 0 && <span className="line-discount-label">−฿{disc.toFixed(2)}{item.discountType === "percent" ? ` (${item.discountValue}%)` : ""}</span>}
                    {item.discountReason && <span className="line-discount-reason">· {item.discountReason}</span>}
                  </div>
                  <ItemDiscountControl item={item} onUpdate={onUpdateItemDiscount} reasons={discountReasons} />
                </div>
                <div className="qty-controls">
                  <button onClick={() => onUpdateQty(item.productId, -1)} className="qty-btn">−</button>
                  <span className="qty-display">{item.quantity}</span>
                  <button onClick={() => onUpdateQty(item.productId, 1)} className="qty-btn">+</button>
                </div>
                {disc > 0 ? (
                  <span className="cart-item-total"><s className="line-discount-strike">฿{(item.sellingPrice * item.quantity).toFixed(2)}</s> ฿{net.toFixed(2)}</span>
                ) : (
                  <span className="cart-item-total">฿{(item.sellingPrice * item.quantity).toFixed(2)}</span>
                )}
              </div>
            );
          })
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
