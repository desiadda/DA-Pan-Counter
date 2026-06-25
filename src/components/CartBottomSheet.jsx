import ModalPortal from "./ModalPortal";

export default function CartBottomSheet({ cart, cartSubtotal, taxEnabled, taxRate, taxAmount, cartTotal, onUpdateQty, onClear, onCheckout, onClose }) {
  return (
    <ModalPortal>
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.sheet} onClick={e => e.stopPropagation()}>
        <div style={styles.handle} />
        <div style={styles.header}>
          <h2 style={styles.title}>🛒 Current Order</h2>
          {cart.length > 0 && <button onClick={onClear} style={styles.clearBtn}>Clear All</button>}
        </div>
        <div style={styles.list}>
          {cart.length === 0 ? (
            <div style={styles.empty}>Cart is empty</div>
          ) : (
            cart.map(item => (
              <div key={item.productId} style={styles.item}>
                <div style={styles.itemInfo}>
                  <div style={styles.itemName}>{item.name}</div>
                  <div style={styles.itemPrice}>฿{item.sellingPrice} each</div>
                </div>
                <div style={styles.qtyWrap}>
                  <button onClick={() => onUpdateQty(item.productId, -1)} style={styles.qtyBtn}>−</button>
                  <span style={styles.qtyNum}>{item.quantity}</span>
                  <button onClick={() => onUpdateQty(item.productId, 1)} style={styles.qtyBtn}>+</button>
                </div>
                <span style={styles.itemTotal}>฿{(item.sellingPrice * item.quantity).toFixed(2)}</span>
              </div>
            ))
          )}
        </div>
        <div style={styles.footer}>
          <div style={styles.totalRow}><span>Subtotal</span><span>฿{cartSubtotal.toFixed(2)}</span></div>
          {taxEnabled && <div style={styles.totalRow}><span>VAT {taxRate}%</span><span>฿{taxAmount.toFixed(2)}</span></div>}
          <div style={{ ...styles.totalRow, borderTop: "1px solid #e2e8f0", paddingTop: "8px" }}>
            <span style={styles.grandTotal}>Total</span>
            <span style={styles.grandTotal}>฿{cartTotal.toFixed(2)}</span>
          </div>
          <button disabled={cart.length === 0} onClick={onCheckout}
            style={{ ...styles.checkoutBtn, opacity: cart.length === 0 ? 0.5 : 1 }}>
            Checkout → ฿{cartTotal.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

const styles = {
  overlay: {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(15,23,42,0.4)", zIndex: 1000,
    display: "flex", alignItems: "flex-end",
  },
  sheet: {
    width: "100%", maxHeight: "85%", background: "#fff",
    borderRadius: "24px 24px 0 0", display: "flex", flexDirection: "column",
    animation: "slideUp 0.25s ease",
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, background: "#cbd5e1",
    margin: "10px auto 4px", flexShrink: 0,
  },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "8px 20px 12px", borderBottom: "1px solid #f1f5f9",
  },
  title: { fontSize: "1.1rem", fontWeight: 700, margin: 0 },
  clearBtn: { fontSize: "0.8rem", color: "#ef4444", background: "none", border: "none", fontWeight: 600, cursor: "pointer" },
  list: { flex: 1, overflowY: "auto", padding: "12px 20px", display: "flex", flexDirection: "column", gap: 10 },
  empty: { textAlign: "center", color: "#94a3b8", padding: "2rem 0", fontSize: "0.9rem" },
  item: { display: "flex", alignItems: "center", gap: 10 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: "0.85rem", fontWeight: 600 },
  itemPrice: { fontSize: "0.75rem", color: "#64748b" },
  qtyWrap: { display: "flex", alignItems: "center", gap: 6 },
  qtyBtn: {
    width: 36, height: 36, borderRadius: 10, border: "1px solid #e2e8f0",
    background: "#fff", fontSize: "1rem", fontWeight: 700, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", color: "#475569",
  },
  qtyNum: { fontSize: "0.9rem", fontWeight: 700, minWidth: 20, textAlign: "center" },
  itemTotal: { fontWeight: 700, fontSize: "0.85rem", minWidth: 50, textAlign: "right" },
  footer: { padding: "12px 20px calc(20px + env(safe-area-inset-bottom, 8px))", borderTop: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: 6 },
  totalRow: { display: "flex", justifyContent: "space-between", fontWeight: 600, fontSize: "0.85rem" },
  grandTotal: { fontSize: "1.1rem", fontWeight: 800, color: "#047857" },
  checkoutBtn: {
    width: "100%", padding: "14px", borderRadius: "12px", border: "none",
    background: "linear-gradient(135deg, #047857, #10b981)", color: "#fff",
    fontSize: "1rem", fontWeight: 700, cursor: "pointer", marginTop: 4,
  },
};
