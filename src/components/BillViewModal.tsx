import ModalPortal from "./ModalPortal";
import { logError } from "../db/errorLog";

export default function BillViewModal({ tx, onClose }) {
  if (!tx) return null;

  const store = JSON.parse(localStorage.getItem("pan_store_settings") || "{}");

  const formatDate = (ts) => new Date(ts).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });

  const handlePrint = () => {
    try {
      const itemRows = tx.items?.map(item => `
        <tr>
          <td style="padding:4px 0;font-size:12px">${item.name}${item.isPack ? `<br><small style="color:#94a3b8">(Pack of ${item.packSize || 20})</small>` : ""}</td>
          <td style="padding:4px 0;font-size:12px;text-align:center">×${item.quantity}</td>
          <td style="padding:4px 0;font-size:12px;text-align:right">฿${(item.isPack ? item.sellingPricePack || item.sellingPrice : item.sellingPrice).toFixed(2)}</td>
          <td style="padding:4px 0;font-size:12px;text-align:right;font-weight:600">฿${((item.isPack ? item.sellingPricePack || item.sellingPrice : item.sellingPrice) * item.quantity).toFixed(2)}</td>
        </tr>
      `).join("");

      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!doc) {
        alert("Failed to access print document");
        return;
      }

      doc.write(`
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
            <table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead>
            <tbody>${itemRows}</tbody></table>
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
        </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
    } catch (err: any) {
      logError("PRINT", err.message, err.stack);
    }
  };

  return (
    <ModalPortal>
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content bill-wrapper" onClick={e => e.stopPropagation()}>
        <div className="bill-receipt">
          <div className="bill-header">
            {store.logo && <img src={store.logo} alt="Store Logo" style={{height: "56px", marginBottom: "4px", objectFit: "contain"}} />}
            <div className="bill-store-name">{store.name || "Paan Counter"}</div>
            {store.address && <div className="bill-store-detail">{store.address}</div>}
            {store.phone && <div className="bill-store-detail">Tel: {store.phone}</div>}
            {store.taxId && <div className="bill-store-detail">Tax ID: {store.taxId}</div>}
            <div className="bill-title">SALES RECEIPT</div>
          </div>

          <div className="bill-divider" />

          <div className="bill-info-grid">
            <div className="info-row info-row-sm"><span className="info-label">Bill ID</span><span className="info-value">#{tx.id?.replace("tx_", "").slice(-8)}</span></div>
            <div className="info-row info-row-sm"><span className="info-label">Date</span><span className="info-value">{formatDate(tx.timestamp)}</span></div>
            <div className="info-row info-row-sm"><span className="info-label">Cashier</span><span className="info-value">{tx.cashierName || tx.cashierEmail || "—"}</span></div>
            <div className="info-row info-row-sm"><span className="info-label">Payment</span><span className={`info-value`} style={{ color: tx.paymentMode === "Cash" ? "var(--primary)" : tx.paymentMode === "Udhaar" ? "var(--error)" : tx.paymentMode === "Bank Transfer" ? "#2563eb" : "var(--secondary)" }}>{tx.paymentMode}</span></div>
          </div>

          <div className="bill-divider" />

          <div className="flex" style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", padding: "0.25rem 0" }}>
            <span className="bill-col-item">Item</span>
            <span className="bill-col-qty">Qty</span>
            <span className="bill-col-price">Price</span>
            <span className="bill-col-total">Total</span>
          </div>
          <div className="bill-divider-light" />
          {tx.items?.map((item, i) => {
            const unitPrice = item.isPack ? item.sellingPricePack || item.sellingPrice : item.sellingPrice;
            const lineTotal = unitPrice * item.quantity;
            const itemDisc = item.discountType === "percent"
              ? lineTotal * Math.min(item.discountValue || 0, 100) / 100
              : item.discountType === "fixed"
                ? Math.min(item.discountValue || 0, lineTotal)
                : 0;
            return (
              <div key={i} className="bill-item-row">
                <span className="bill-col-item">
                  <span className="bill-item-name">{item.name}</span>
                  {item.isPack && <span className="bill-item-pack">(Pack of {item.packSize || 20})</span>}
                  {itemDisc > 0 && (
                    <span className="bill-item-disc">−฿{itemDisc.toFixed(2)}{item.discountType === "percent" ? ` (${item.discountValue}%)` : ""}{item.discountReason ? ` · ${item.discountReason}` : ""}</span>
                  )}
                </span>
                <span className="bill-col-qty">×{item.quantity}</span>
                <span className="bill-col-price">฿{unitPrice.toFixed(2)}</span>
                <span className="bill-col-total">{itemDisc > 0 && <s style={{ color: "var(--text-muted)", marginRight: "0.2rem" }}>฿{lineTotal.toFixed(2)}</s>}฿{(lineTotal - itemDisc).toFixed(2)}</span>
              </div>
            );
          })}

          <div className="bill-divider" />

          <div className="bill-total-section">
            <div className="total-row total-row-sm"><span>Subtotal</span><span>฿{(tx.subtotal || 0).toFixed(2)}</span></div>
            {tx.discountAmount > 0 && (
              <div className="total-row total-row-sm" style={{ color: "var(--error)" }}>
                <span>Discount {tx.discountType === "percent" ? `(${tx.discountValue}%)` : ""}</span>
                <span>-฿{(tx.discountAmount || 0).toFixed(2)}</span>
              </div>
            )}
            {tx.discountReason && <div className="bill-discount-reason">Reason: {tx.discountReason}</div>}
            {tx.taxEnabled && <div className="total-row total-row-sm"><span>VAT {tx.taxRate}%</span><span>฿{(tx.taxAmount || 0).toFixed(2)}</span></div>}
            <div className="bill-divider" />
            <div className="bill-grand-total">
              <span>TOTAL</span>
              <span>฿{(tx.totalAmount || 0).toFixed(2)}</span>
            </div>
            {tx.paymentMode === "Cash" && (
              <>
                <div className="total-row total-row-sm"><span>Cash Received</span><span>฿{(tx.receivedAmount || 0).toFixed(2)}</span></div>
                <div className="total-row total-row-sm"><span>Change</span><span>฿{(tx.changeAmount || 0).toFixed(2)}</span></div>
              </>
            )}
            {tx.customerId && tx.customerName && <div className="total-row total-row-sm" style={{ color: "#7c3aed" }}><span>Customer</span><span>{tx.customerName || tx.customerId}</span></div>}
          </div>

          <div className="bill-divider" />

          <div className="bill-footer">
            <div className="bill-footer-text">Thank you for your purchase!</div>
            <div className="bill-footer-sub">Visit again 😊</div>
          </div>
        </div>

        <div className="flex-btn-group" style={{ marginTop: "1rem" }}>
          <button onClick={onClose} className="btn btn-outline">Close</button>
          <button onClick={handlePrint} className="btn btn-primary">🖨️ Print / PDF</button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
