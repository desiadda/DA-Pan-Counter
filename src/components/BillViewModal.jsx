import ModalPortal from "./ModalPortal";

export default function BillViewModal({ tx, onClose }) {
  if (!tx) return null;

  const store = JSON.parse(localStorage.getItem("pan_store_settings") || "{}");

  const formatDate = (ts) => new Date(ts).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });

  const handlePrint = () => {
    const printWin = window.open("", "_blank", "width=400,height=600");
    const itemRows = tx.items?.map(item => `
      <tr>
        <td style="padding:4px 0;font-size:12px">${item.name}${item.isPack ? `<br><small style="color:#94a3b8">(Pack of ${item.packSize || 20})</small>` : ""}</td>
        <td style="padding:4px 0;font-size:12px;text-align:center">×${item.quantity}</td>
        <td style="padding:4px 0;font-size:12px;text-align:right">฿${(item.isPack ? item.sellingPricePack || item.sellingPrice : item.sellingPrice).toFixed(2)}</td>
        <td style="padding:4px 0;font-size:12px;text-align:right;font-weight:600">฿${((item.isPack ? item.sellingPricePack || item.sellingPrice : item.sellingPrice) * item.quantity).toFixed(2)}</td>
      </tr>
    `).join("");

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt #${tx.id?.replace("tx_", "").slice(-8)}</title>
        <style>
          @page { margin: 10mm; }
          body { font-family: 'Courier New', monospace; font-size: 12px; color: #1e293b; margin: 0; padding: 0; }
          .receipt { max-width: 300px; margin: 0 auto; padding: 10px; }
          .header { text-align: center; margin-bottom: 10px; }
          .store-name { font-size: 16px; font-weight: 800; color: #047857; }
          .store-detail { font-size: 10px; color: #64748b; }
          .receipt-title { font-size: 10px; font-weight: 700; color: #64748b; letter-spacing: 2px; margin-top: 4px; text-transform: uppercase; }
          hr { border: none; border-top: 1px dashed #cbd5e1; margin: 8px 0; }
          .info { display: flex; justify-content: space-between; font-size: 11px; margin: 2px 0; }
          .info-label { color: #94a3b8; font-weight: 600; }
          .info-value { color: #1e293b; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; padding: 2px 0; text-align: left; }
          th:nth-child(2) { text-align: center; }
          th:nth-child(3) { text-align: right; }
          th:nth-child(4) { text-align: right; }
          .total-row { display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; color: #475569; margin: 3px 0; }
          .grand-total { display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; color: #047857; margin: 8px 0; }
          .footer { text-align: center; margin-top: 10px; }
          .footer-text { font-size: 11px; font-weight: 700; color: #047857; }
          .footer-sub { font-size: 10px; color: #94a3b8; }
          @media print { body { margin: 0; padding: 0; } }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            ${store.logo ? `<img src="${store.logo}" style="height:56px;object-fit:contain;margin-bottom:4px">` : ""}
            <div class="store-name">${store.name || "Paan Counter"}</div>
            ${store.address ? `<div class="store-detail">${store.address}</div>` : ""}
            ${store.phone ? `<div class="store-detail">Tel: ${store.phone}</div>` : ""}
            ${store.taxId ? `<div class="store-detail">Tax ID: ${store.taxId}</div>` : ""}
            <div class="receipt-title">SALES RECEIPT</div>
          </div>
          <hr>
          <div class="info"><span class="info-label">Bill ID</span><span class="info-value">#${tx.id?.replace("tx_", "").slice(-8)}</span></div>
          <div class="info"><span class="info-label">Date</span><span class="info-value">${formatDate(tx.timestamp)}</span></div>
          <div class="info"><span class="info-label">Cashier</span><span class="info-value">${tx.cashierName || tx.cashierEmail || "—"}</span></div>
          <div class="info"><span class="info-label">Payment</span><span class="info-value">${tx.paymentMode}</span></div>
          <hr>
          <table>
            <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead>
            <tbody>${itemRows}</tbody>
          </table>
          <hr>
          <div class="total-row"><span>Subtotal</span><span>฿${(tx.subtotal || 0).toFixed(2)}</span></div>
          ${tx.discountAmount > 0 ? `<div class="total-row" style="color:#dc2626"><span>Discount${tx.discountType === "percent" ? ` (${tx.discountValue}%)` : ""}</span><span>-฿${(tx.discountAmount || 0).toFixed(2)}</span></div>` : ""}
          ${tx.discountReason ? `<div style="font-size:10px;color:#92400e;font-style:italic;text-align:right">Reason: ${tx.discountReason}</div>` : ""}
          ${tx.taxEnabled ? `<div class="total-row"><span>VAT ${tx.taxRate}%</span><span>฿${(tx.taxAmount || 0).toFixed(2)}</span></div>` : ""}
          <hr>
          <div class="grand-total"><span>TOTAL</span><span>฿${(tx.totalAmount || 0).toFixed(2)}</span></div>
          ${tx.paymentMode === "Cash" ? `
            <div class="total-row"><span>Cash Received</span><span>฿${(tx.receivedAmount || 0).toFixed(2)}</span></div>
            <div class="total-row"><span>Change</span><span>฿${(tx.changeAmount || 0).toFixed(2)}</span></div>
          ` : ""}
          ${tx.customerId ? `<div class="total-row" style="color:#7c3aed"><span>Customer</span><span>${tx.customerName || tx.customerId}</span></div>` : ""}
          <hr>
          <div class="footer">
            <div class="footer-text">Thank you for your purchase!</div>
            <div class="footer-sub">Visit again 😊</div>
          </div>
        </div>
        <script>window.onload = function() { window.print(); window.close(); }<${""}/script>
      </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <ModalPortal>
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={styles.wrapper}>
        <div style={styles.receipt}>
          {/* Header */}
          <div style={styles.header}>
            {store.logo && <img src={store.logo} alt="Store Logo" style={{height: "56px", marginBottom: "4px", objectFit: "contain"}} />}
            <div style={styles.storeName}>{store.name || "Paan Counter"}</div>
            {store.address && <div style={styles.storeDetail}>{store.address}</div>}
            {store.phone && <div style={styles.storeDetail}>Tel: {store.phone}</div>}
            {store.taxId && <div style={styles.storeDetail}>Tax ID: {store.taxId}</div>}
            <div style={styles.receiptTitle}>SALES RECEIPT</div>
          </div>

          <div style={styles.divider} />

          {/* Bill Info */}
          <div style={styles.infoGrid}>
            <div style={styles.infoRow}><span style={styles.infoLabel}>Bill ID</span><span style={styles.infoValue}>#{tx.id?.replace("tx_", "").slice(-8)}</span></div>
            <div style={styles.infoRow}><span style={styles.infoLabel}>Date</span><span style={styles.infoValue}>{formatDate(tx.timestamp)}</span></div>
            <div style={styles.infoRow}><span style={styles.infoLabel}>Cashier</span><span style={styles.infoValue}>{tx.cashierName || tx.cashierEmail || "—"}</span></div>
            <div style={styles.infoRow}><span style={styles.infoLabel}>Payment</span><span style={{...styles.infoValue, ...styles.paymentBadge(tx.paymentMode)}}>{tx.paymentMode}</span></div>
          </div>

          <div style={styles.divider} />

          {/* Items */}
          <div style={styles.itemsHeader}>
            <span style={styles.colItem}>Item</span>
            <span style={styles.colQty}>Qty</span>
            <span style={styles.colPrice}>Price</span>
            <span style={styles.colTotal}>Total</span>
          </div>
          <div style={styles.dividerLight} />
          {tx.items?.map((item, i) => (
            <div key={i} style={styles.itemRow}>
              <span style={styles.colItem}>
                <span style={styles.itemName}>{item.name}</span>
                {item.isPack && <span style={styles.itemPack}>(Pack of {item.packSize || 20})</span>}
              </span>
              <span style={styles.colQty}>×{item.quantity}</span>
              <span style={styles.colPrice}>฿{(item.isPack ? item.sellingPricePack || item.sellingPrice : item.sellingPrice).toFixed(2)}</span>
              <span style={styles.colTotal}>฿{((item.isPack ? item.sellingPricePack || item.sellingPrice : item.sellingPrice) * item.quantity).toFixed(2)}</span>
            </div>
          ))}

          <div style={styles.divider} />

          {/* Totals */}
          <div style={styles.totalSection}>
            <div style={styles.totalRow}><span>Subtotal</span><span>฿{(tx.subtotal || 0).toFixed(2)}</span></div>
            {tx.discountAmount > 0 && (
              <div style={{...styles.totalRow, color: "#dc2626"}}>
                <span>Discount {tx.discountType === "percent" ? `(${tx.discountValue}%)` : ""}</span>
                <span>-฿{(tx.discountAmount || 0).toFixed(2)}</span>
              </div>
            )}
            {tx.discountReason && <div style={styles.discountReason}>Reason: {tx.discountReason}</div>}
            {tx.taxEnabled && <div style={styles.totalRow}><span>VAT {tx.taxRate}%</span><span>฿{(tx.taxAmount || 0).toFixed(2)}</span></div>}
            <div style={styles.divider} />
            <div style={styles.grandTotal}>
              <span>TOTAL</span>
              <span>฿{(tx.totalAmount || 0).toFixed(2)}</span>
            </div>
            {tx.paymentMode === "Cash" && (
              <>
                <div style={styles.totalRow}><span>Cash Received</span><span>฿{(tx.receivedAmount || 0).toFixed(2)}</span></div>
                <div style={styles.totalRow}><span>Change</span><span>฿{(tx.changeAmount || 0).toFixed(2)}</span></div>
              </>
            )}
            {tx.customerId && tx.customerName && <div style={{...styles.totalRow, color: "#7c3aed"}}><span>Customer</span><span>{tx.customerName || tx.customerId}</span></div>}
          </div>

          <div style={styles.divider} />

          {/* Footer */}
          <div style={styles.footer}>
            <div style={styles.footerText}>Thank you for your purchase!</div>
            <div style={styles.footerSub}>Visit again 😊</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
          <button onClick={onClose} className="btn btn-outline" style={{ flex: 1, padding: "0.75rem" }}>
            Close
          </button>
          <button onClick={handlePrint} className="btn btn-primary" style={{ flex: 1, padding: "0.75rem" }}>
            🖨️ Print / PDF
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

const styles = {
  wrapper: {
    maxWidth: "400px",
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    padding: "1.5rem",
  },
  receipt: {
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    padding: "1.25rem",
  },
  header: { textAlign: "center", marginBottom: "0.75rem" },
  storeName: { fontSize: "1.25rem", fontWeight: 800, color: "#047857", letterSpacing: "-0.5px" },
  storeDetail: { fontSize: "0.7rem", color: "#64748b", marginTop: "2px", lineHeight: "1.3" },
  receiptTitle: { fontSize: "0.7rem", fontWeight: 700, color: "#64748b", letterSpacing: "2px", marginTop: "4px", textTransform: "uppercase" },
  divider: { height: "1px", backgroundColor: "#e2e8f0", margin: "0.5rem 0" },
  dividerLight: { height: "1px", backgroundColor: "#f1f5f9", margin: "0.25rem 0" },
  infoGrid: { display: "flex", flexDirection: "column", gap: "0.3rem" },
  infoRow: { display: "flex", justifyContent: "space-between", fontSize: "0.75rem" },
  infoLabel: { color: "#94a3b8", fontWeight: 600 },
  infoValue: { color: "#1e293b", fontWeight: 700 },
  paymentBadge: (mode) => ({
    color: mode === "Cash" ? "#047857" : mode === "Udhaar" ? "#dc2626" : mode === "Bank Transfer" ? "#2563eb" : "#d97706",
  }),
  itemsHeader: {
    display: "flex", fontSize: "0.65rem", fontWeight: 700, color: "#64748b",
    textTransform: "uppercase", letterSpacing: "0.5px", padding: "0.25rem 0",
  },
  colItem: { flex: 2, textAlign: "left" },
  colQty: { width: "36px", textAlign: "center" },
  colPrice: { width: "60px", textAlign: "right" },
  colTotal: { width: "68px", textAlign: "right" },
  itemRow: {
    display: "flex", alignItems: "center", fontSize: "0.78rem",
    padding: "0.35rem 0", borderBottom: "1px solid #f8fafc",
  },
  itemName: { fontWeight: 600, color: "#1e293b" },
  itemPack: { display: "block", fontSize: "0.6rem", color: "#94a3b8", fontWeight: 500 },
  totalSection: { display: "flex", flexDirection: "column", gap: "0.35rem" },
  totalRow: { display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: 600, color: "#475569" },
  discountReason: { fontSize: "0.65rem", color: "#92400e", fontStyle: "italic", textAlign: "right" },
  grandTotal: {
    display: "flex", justifyContent: "space-between",
    fontSize: "1.1rem", fontWeight: 800, color: "#047857",
  },
  footer: { textAlign: "center", padding: "0.5rem 0 0" },
  footerText: { fontSize: "0.8rem", fontWeight: 700, color: "#047857" },
  footerSub: { fontSize: "0.7rem", color: "#94a3b8", marginTop: "2px" },
};
