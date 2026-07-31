import ModalPortal from "./ModalPortal";
import ItemDiscountControl from "./ItemDiscountControl";

export default function CartBottomSheet({ cart, cartSubtotal, taxEnabled, taxRate, taxAmount, cartTotal, onUpdateQty, onClear, onCheckout, onClose, onUpdateItemDiscount, discountReasons }) {
  const lineAmount = (item) => {
    const lineTotal = (item.sellingPrice || 0) * (item.quantity || 1);
    if (item.discountType === "percent") return lineTotal * Math.min(item.discountValue || 0, 100) / 100;
    if (item.discountType === "fixed") return Math.min(item.discountValue || 0, lineTotal);
    return 0;
  };

  return (
    <ModalPortal>
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content mobile-sheet" onClick={e => e.stopPropagation()}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--border)", margin: "0 auto 4px", flexShrink: 0 }} />
        <div className="sheet-header">
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>🛒 Current Order</h2>
          {cart.length > 0 && <button onClick={onClear} className="btn-icon" style={{ color: "#ef4444", fontSize: "0.8rem", fontWeight: 600 }}>Clear All</button>}
        </div>
        <div className="cart-items-list" style={{ padding: "0 0.25rem" }}>
          {cart.length === 0 ? (
            <div className="cart-empty" style={{ padding: "1.5rem 0" }}>Cart is empty</div>
          ) : (
            cart.map(item => {
              const disc = lineAmount(item);
              const net = (item.sellingPrice * item.quantity) - disc;
              return (
                <div key={item.productId} className="cart-item">
                  <div className="cart-item-info">
                    <div className="cart-item-name">{item.name}</div>
                    <div className="cart-item-price">
                      ฿{item.sellingPrice} each
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
          <div className="total-row total-row-sm"><span>Subtotal</span><span>฿{cartSubtotal.toFixed(2)}</span></div>
          {taxEnabled && <div className="total-row total-row-sm"><span>VAT {taxRate}%</span><span>฿{taxAmount.toFixed(2)}</span></div>}
          <div className="total-row total-row-lg" style={{ borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
            <span className="total-value">Total</span>
            <span className="total-value">฿{cartTotal.toFixed(2)}</span>
          </div>
          <button disabled={cart.length === 0} onClick={onCheckout}
            className="btn btn-primary btn-lg" style={{ width: "100%", opacity: cart.length === 0 ? 0.5 : 1, marginTop: 4 }}>
            Checkout → ฿{cartTotal.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
