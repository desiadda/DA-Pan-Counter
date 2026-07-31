import { useState } from "react";
import ModalPortal from "./ModalPortal";
import { useDBStore } from "../stores/dbStore";
import { useAuthStore } from "../stores/authStore";
import { CASH_MODE, QUICK_CASH_CHIPS_POS, UDHAAR_MODE } from "../constants";

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
  const paymentModes = useDBStore((s) => s.paymentModes);
  const user = useAuthStore((s) => s.user);
  const [isCustomReason, setIsCustomReason] = useState(false);
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);

  const showDiscount = discountType && discountValue > 0;

  const itemDiscounts = cart.reduce((sum, i) => {
    const lineTotal = (i.sellingPrice || 0) * (i.quantity || 1);
    if (i.discountType === "percent") return sum + lineTotal * Math.min(i.discountValue || 0, 100) / 100;
    if (i.discountType === "fixed") return sum + Math.min(i.discountValue || 0, lineTotal);
    return sum;
  }, 0);

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
            <span>฿{(cartSubtotal + itemDiscounts).toFixed(2)}</span>
          </div>
          {itemDiscounts > 0 && (
            <div style={{...styles.totalRow, color: "#dc2626"}}>
              <span>Item Discounts:</span>
              <span>-฿{itemDiscounts.toFixed(2)}</span>
            </div>
          )}
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
        {user?.permissions?.posDiscount && (
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
        )}

        <div style={styles.paymentSelector}>
          {paymentModes.filter(m => m.enabled).map(mode => (
            <button
              key={mode.id}
              onClick={() => setPaymentMode(mode.id)}
              style={{
                ...styles.paymentTab,
                ...(paymentMode === mode.id ? styles.activePaymentTab : {}),
              }}
            >
              {mode.id === UDHAAR_MODE ? "Udhaar (Credit)" : mode.id === "Bank Transfer" ? "Bank / Online" : mode.name}
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
              {QUICK_CASH_CHIPS_POS.map(val => (
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

        {paymentMode !== CASH_MODE && paymentMode !== UDHAAR_MODE && (() => {
          const modeObj = paymentModes.find(m => m.id === paymentMode);
          if (!modeObj) return null;
          
          const qrSrc = modeObj.qrCode 
            ? modeObj.qrCode 
            : (modeObj.id === "PromptPay" && promptpayNumber
                ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=promptpay://${promptpayNumber}/${finalTotal.toFixed(2)}` 
                : "");
                
          return (
            <div style={{ ...styles.paymentSection, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem", backgroundColor: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0", gap: "0.75rem", marginTop: "1rem" }}>
              <div style={{ fontWeight: "800", color: "#1e3a8a", fontSize: "0.95rem", letterSpacing: "0.5px" }}>
                {modeObj.name.toUpperCase()} PAYMENT
              </div>
              {modeObj.id === "PromptPay" && !modeObj.qrCode && promptpayNumber && (
                <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#475569", backgroundColor: "#e2e8f0", padding: "0.25rem 0.75rem", borderRadius: "20px" }}>
                  ID: {promptpayNumber}
                </div>
              )}
              {modeObj.id === "PromptPay" && !modeObj.qrCode && !promptpayNumber && (
                <div style={{ fontSize: "0.85rem", color: "#b45309", fontWeight: "600", backgroundColor: "#fef3c7", padding: "0.25rem 0.75rem", borderRadius: "20px" }}>
                  ⚠️ PromptPay ID not set — ask Admin to configure it in Settings
                </div>
              )}
              {qrSrc ? (
                <div style={{ backgroundColor: "#ffffff", padding: "0.75rem", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", border: "1px solid #cbd5e1", display: "flex", justifyContent: "center", alignItems: "center" }}>
                  <img
                    src={qrSrc}
                    alt={`${modeObj.name} QR Code`}
                    style={{ width: "180px", height: "180px", display: "block", objectFit: "contain" }}
                  />
                </div>
              ) : (
                <div style={{ fontSize: "0.85rem", color: "#64748b", fontStyle: "italic" }}>
                  No QR code uploaded. Please scan counter QR.
                </div>
              )}
            </div>
          );
        })()}

        {paymentMode === UDHAAR_MODE && (
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
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    backgroundColor: "#f1f5f9",
    padding: "4px",
    borderRadius: "8px",
    gap: "4px",
    marginBottom: "1rem",
  },
  paymentTab: {
    padding: "0.6rem 0.25rem",
    fontSize: "0.78rem",
    fontWeight: "bold",
    color: "#64748b",
    background: "none",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    whiteSpace: "normal",
    textAlign: "center",
    lineHeight: "1.2",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  activePaymentTab: {
    backgroundColor: "#ffffff",
    color: "#047857",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
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
