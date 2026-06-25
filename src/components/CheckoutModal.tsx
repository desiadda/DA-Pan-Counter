import { useState } from "react";
import ModalPortal from "./ModalPortal";

export default function CheckoutModal({
  cart,
  cartSubtotal,
  taxEnabled,
  taxRate,
  taxAmount,
  cartTotal,
  paymentMode,
  receivedCash,
  selectedCustomerId,
  customers,
  newCustomerName,
  newCustomerPhone,
  promptpayNumber,
  changeToReturn,
  onClose,
  setPaymentMode,
  handleCashReceived,
  handleAddQuickCash,
  setSelectedCustomerId,
  setNewCustomerName,
  setNewCustomerPhone,
  handleCreateCustomer,
  handleCheckoutSubmit,
  discountType,
  discountValue,
  discountReason,
  setDiscountType,
  setDiscountValue,
  setDiscountReason,
  discountReasons,
  discountAmount,
  finalTotal,
}) {
  const [isCustomReason, setIsCustomReason] = useState(false);
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);

  const showDiscount = discountType && discountValue > 0;

  return (
    <ModalPortal>
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={styles.checkoutModal}>
        <div style={styles.modalHeader}>
          <h3>Pay ฿{finalTotal.toFixed(2)}</h3>
          <button onClick={onClose} style={styles.closeModalBtn}>✕</button>
        </div>

        <div style={styles.priceBreakdown}>
          <div style={styles.totalRow}>
            <span>Subtotal ({itemCount} items):</span>
            <span>฿{cartSubtotal.toFixed(2)}</span>
          </div>
          {showDiscount && (
            <div style={{...styles.totalRow, color: "#dc2626"}}>
              <span>Discount ({discountType === "percent" ? `${discountValue}%` : `฿${discountValue}`}):</span>
              <span>-฿{discountAmount.toFixed(2)}</span>
            </div>
          )}
          {taxEnabled && (
            <div style={styles.totalRow}>
              <span>VAT {taxRate}%:</span>
              <span>฿{taxAmount.toFixed(2)}</span>
            </div>
          )}
          <div style={{ ...styles.totalRow, borderTop: "1px solid #e2e8f0", paddingTop: "0.5rem", marginTop: "0.25rem" }}>
            <span style={{ fontSize: "1.1rem", fontWeight: "800" }}>Total:</span>
            <span style={{ ...styles.totalValue, fontSize: "1.3rem" }}>฿{finalTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Discount Section */}
        <div style={styles.discountSection}>
          <div style={styles.discountHeader}>
            <span>🏷️ Discount</span>
            {showDiscount && <button onClick={() => { setDiscountType(""); setDiscountValue(0); setDiscountReason(""); }} style={styles.removeDiscountBtn}>Remove</button>}
          </div>
          <div style={styles.discountRow}>
            <select value={discountType} onChange={e => setDiscountType(e.target.value)} style={styles.discountSelect}>
              <option value="">No discount</option>
              <option value="percent">Percentage (%)</option>
              <option value="fixed">Fixed Amount (฿)</option>
            </select>
            {discountType && (
              <input
                type="number"
                value={discountValue || ""}
                onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
                placeholder={discountType === "percent" ? "Enter %" : "Enter amount"}
                style={styles.discountInput}
                min="0"
                max={discountType === "percent" ? 100 : cartSubtotal}
              />
            )}
          </div>
          {discountType && discountValue > 0 && (
            <div className="input-group">
              <label className="input-label">Reason</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <select value={isCustomReason ? "__custom__" : discountReason} onChange={e => {
                  if (e.target.value === "__custom__") {
                    setIsCustomReason(true);
                    setDiscountReason("__custom__");
                  } else {
                    setIsCustomReason(false);
                    setDiscountReason(e.target.value);
                  }
                }} className="input-field" style={{ flex: 1, fontFamily: "inherit" }}>
                  <option value="">Select reason...</option>
                  {discountReasons.map(r => <option key={r} value={r}>{r}</option>)}
                  <option value="__custom__">Other (type below)</option>
                </select>
              </div>
              {isCustomReason && (
                <input
                  type="text"
                  value={discountReason === "__custom__" ? "" : discountReason}
                  onChange={e => setDiscountReason(e.target.value)}
                  placeholder="Type reason..."
                  className="input-field"
                  style={{ marginTop: "0.5rem" }}
                  autoFocus
                />
              )}
            </div>
          )}
        </div>

        <div style={styles.paymentSelector}>
          {["Cash", "PromptPay", "Bank Transfer", "Udhaar"].map(mode => (
            <button
              key={mode}
              onClick={() => setPaymentMode(mode)}
              style={{
                ...styles.paymentTab,
                ...(paymentMode === mode ? styles.activePaymentTab : {}),
              }}
            >
              {mode === "Udhaar" ? "Udhaar (Credit)" : mode === "Bank Transfer" ? "Bank / Online" : mode}
            </button>
          ))}
        </div>

        {paymentMode === "Cash" && (
          <div style={styles.paymentSection}>
            <div className="input-group">
              <label className="input-label">Cash Received</label>
              <input
                type="number"
                value={receivedCash}
                onChange={(e) => handleCashReceived(e.target.value)}
                placeholder="Enter cash amount"
                className="input-field"
                style={{ fontSize: "1.2rem", fontWeight: "bold" }}
              />
            </div>

            <div style={styles.quickCashContainer}>
              {[20, 50, 100, 500, 1000].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleCashReceived(val.toString())}
                  style={styles.quickCashBtn}
                >
                  ฿{val} Note
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleCashReceived(finalTotal.toFixed(2))}
                style={{ ...styles.quickCashBtn, backgroundColor: "#ecfdf5", color: "#047857", fontWeight: "bold" }}
              >
                Exact: ฿{finalTotal.toFixed(2)}
              </button>
            </div>

            <div style={styles.changeCalculator}>
              <span>Change Return:</span>
              <span style={styles.changeValue}>฿{changeToReturn.toFixed(2)}</span>
            </div>
          </div>
        )}

        {paymentMode === "PromptPay" && (
          <div style={{ ...styles.paymentSection, textAlign: "center", padding: "1rem 0" }}>
            <div style={{ fontWeight: "bold", color: "#1e3a8a", marginBottom: "0.5rem" }}>
              PROMPTPAY BANK TRANSFER
            </div>
            <div style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "1rem" }}>
              PromptPay ID: {promptpayNumber}
            </div>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=promptpay://${promptpayNumber}/${finalTotal.toFixed(2)}`}
              alt="PromptPay QR Code"
              style={{ maxWidth: "100%", width: "180px", height: "auto", aspectRatio: 1, borderRadius: "8px", border: "1px solid #cbd5e1" }}
            />
            <div style={{ marginTop: "1rem", fontSize: "0.85rem", color: "#64748b" }}>
              Or enter custom PromptPay ID in settings
            </div>
          </div>
        )}

        {paymentMode === "Udhaar" && (
          <div style={styles.paymentSection}>
            <div className="input-group">
              <label className="input-label">Select Customer</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="input-field"
              >
                <option value="">-- Choose Debtor --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Credit Balance: ฿{c.balance || 0})
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.orSeparator}>- OR Add New Customer -</div>

            <form onSubmit={handleCreateCustomer} style={styles.customerForm}>
              <input
                type="text"
                placeholder="Customer Name"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                className="input-field"
                style={{ flex: 1 }}
              />
              <input
                type="text"
                placeholder="Phone"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                className="input-field"
                  style={{ maxWidth: "120px", width: "100%" }}
              />
              <button type="submit" className="btn btn-outline" style={{ padding: "0.5rem 1rem" }}>Add</button>
            </form>
          </div>
        )}

        <button
          onClick={handleCheckoutSubmit}
          className="btn btn-primary"
          style={{ width: "100%", marginTop: "1.5rem", padding: "1rem" }}
        >
          Complete Sale (฿{finalTotal.toFixed(2)})
        </button>
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
  priceBreakdown: {
    backgroundColor: "#f8fafc",
    borderRadius: "8px",
    padding: "0.75rem",
    border: "1px solid #e2e8f0",
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
    fontWeight: "800",
  },
  discountSection: {
    backgroundColor: "#fffbeb",
    borderRadius: "8px",
    padding: "0.75rem",
    border: "1px solid #fde68a",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  discountHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontWeight: "bold",
    fontSize: "0.9rem",
    color: "#92400e",
  },
  removeDiscountBtn: {
    background: "none",
    border: "none",
    color: "#dc2626",
    fontSize: "0.75rem",
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "underline",
    fontFamily: "inherit",
  },
  discountRow: {
    display: "flex",
    gap: "0.5rem",
  },
  discountSelect: {
    flex: 1,
    padding: "0.5rem",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    fontSize: "0.85rem",
    fontFamily: "inherit",
  },
  discountInput: {
    flex: 1,
    padding: "0.5rem",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    fontSize: "0.85rem",
    fontFamily: "inherit",
  },
  paymentSelector: {
    display: "flex",
    overflowX: "auto",
    whiteSpace: "nowrap",
    WebkitOverflowScrolling: "touch",
    backgroundColor: "#f1f5f9",
    padding: "4px",
    borderRadius: "8px",
    gap: "4px",
  },
  paymentTab: {
    flex: "0 0 auto",
    padding: "0.6rem 0.8rem",
    fontSize: "0.85rem",
    fontWeight: "bold",
    color: "#64748b",
    background: "none",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  activePaymentTab: {
    backgroundColor: "#ffffff",
    color: "#047857",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  paymentSection: {
    marginTop: "0.5rem",
  },
  quickCashContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
    gap: "0.5rem",
    marginBottom: "1rem",
  },
  quickCashBtn: {
    padding: "0.5rem",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    backgroundColor: "#ffffff",
    cursor: "pointer",
    fontSize: "0.85rem",
    fontWeight: "600",
  },
  changeCalculator: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "1.1rem",
    fontWeight: "bold",
    padding: "0.75rem",
    backgroundColor: "#f8fafc",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
  },
  changeValue: {
    color: "#047857",
  },
  orSeparator: {
    textAlign: "center",
    fontSize: "0.75rem",
    color: "#94a3b8",
    margin: "1rem 0 0.5rem 0",
    fontWeight: "bold",
  },
  customerForm: {
    display: "flex",
    gap: "0.5rem",
  },
};
