import { useState, useMemo } from "react";
import ModalPortal from "./ModalPortal";

export default function SupplierStatementModal({ supplier, onClose }) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const store = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("pan_store_settings") || "{}");
    } catch {
      return {};
    }
  }, []);

  const { rows, openingBalance, closingBalance } = useMemo(() => {
    const entries = [...(supplier.ledger || [])].sort((a, b) => (a.date || 0) - (b.date || 0));
    const fromTs = fromDate ? new Date(fromDate + "T00:00:00").getTime() : -Infinity;
    const toTs = toDate ? new Date(toDate + "T23:59:59").getTime() : Infinity;
    let opening = 0;
    let running = 0;
    const rows = [];
    for (const e of entries) {
      const ts = e.date || 0;
      const change = e.type === "Payment" ? -Math.abs(e.amount || 0) : Math.abs(e.amount || 0);
      if (ts < fromTs) { opening += change; continue; }
      if (ts > toTs) break;
      running += change;
      rows.push({ ...e, ts, change, running });
    }
    return { rows, openingBalance: opening, closingBalance: opening + running };
  }, [supplier.ledger, fromDate, toDate]);

  const fmtDate = (ts) =>
    new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  const exportCSV = () => {
    const header = "Date,Type,Description,Debit (฿),Credit (฿),Balance (฿)";
    const lines = [
      `,,Opening Balance (B/F),${openingBalance > 0 ? openingBalance.toFixed(2) : ""},${openingBalance < 0 ? Math.abs(openingBalance).toFixed(2) : ""},${openingBalance.toFixed(2)}`,
      ...rows.map(r => [
        fmtDate(r.ts),
        r.type,
        `"${(r.description || "").replace(/"/g, '""')}"`,
        r.change > 0 ? r.change.toFixed(2) : "",
        r.change < 0 ? Math.abs(r.change).toFixed(2) : "",
        r.running.toFixed(2),
      ].join(",")),
      `,,Closing Balance (C/F),,,${closingBalance.toFixed(2)}`,
    ];
    const csv = [header, ...lines].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `statement_${(supplier.name || "supplier").replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printStatement = () => {
    const w = window.open("", "_blank", "width=800,height=600");
    if (!w) { alert("Popup blocked — print karne ke liye popup allow karein."); return; }
    const rangeLabel = fromDate || toDate
      ? `${fromDate || "Start"} → ${toDate || "Today"}`
      : "Full History";
    const tr = (d, t, desc, debit, credit, bal) =>
      `<tr>
        <td>${d}</td><td>${t}</td><td>${desc}</td>
        <td style="text-align:right">${debit}</td><td style="text-align:right">${credit}</td>
        <td style="text-align:right;font-weight:700">${bal}</td>
      </tr>`;
    const rowsHtml = [
      tr(fromDate ? fmtDate(new Date(fromDate).getTime()) : "—", "Opening Balance", "Balance B/F",
        openingBalance > 0 ? openingBalance.toFixed(2) : "",
        openingBalance < 0 ? Math.abs(openingBalance).toFixed(2) : "",
        openingBalance.toFixed(2)),
      ...rows.map(r => tr(fmtDate(r.ts), r.type, r.description || "",
        r.change > 0 ? r.change.toFixed(2) : "",
        r.change < 0 ? Math.abs(r.change).toFixed(2) : "",
        r.running.toFixed(2))),
      tr("", "", "Closing Balance (C/F)", "", "", closingBalance.toFixed(2)),
    ].join("");

    w.document.write(`<!DOCTYPE html>
<html>
<head><title>Supplier Statement — ${supplier.name}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 24px; }
  h2 { margin: 0 0 2px; font-size: 16px; }
  .sub { color: #555; margin-bottom: 4px; font-size: 11px; }
  .meta { display: flex; justify-content: space-between; margin: 12px 0 6px; font-size: 11px; color: #333; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; }
  th { background: #eee; font-size: 11px; }
  tfoot td { font-weight: 700; background: #f6f6f6; }
</style></head>
<body>
  <h2>${store.name || "Dukaan"}</h2>
  <div class="sub">Supplier Statement / Khata</div>
  <div class="meta">
    <div><strong>${supplier.name}</strong><br>
      ${supplier.contact || ""}${supplier.contact && supplier.phone ? " · " : ""}${supplier.phone || ""}<br>
      ${supplier.address || ""}
    </div>
    <div style="text-align:right">Period: ${rangeLabel}<br>Generated: ${new Date().toLocaleString("en-GB")}</div>
  </div>
  <table>
    <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Debit (฿)</th><th>Credit (฿)</th><th>Balance (฿)</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot><tr><td colspan="6" style="text-align:right">Outstanding Balance: ฿${closingBalance.toFixed(2)}</td></tr></tfoot>
  </table>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };</script>
</body></html>`);
    w.document.close();
    w.focus();
  };

  return (
    <ModalPortal onClose={onClose}>
      <div
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: "#fff", borderRadius: "14px", width: "100%", maxWidth: "560px",
            maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden",
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ padding: "1rem 1rem 0.5rem", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#1e293b" }}>📄 {supplier.name}</h3>
                <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "2px" }}>
                  {[supplier.contact, supplier.phone && `📞 ${supplier.phone}`, supplier.address].filter(Boolean).join(" · ") || "Statement"}
                </div>
              </div>
              <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.1rem", cursor: "pointer", color: "#64748b" }}>✕</button>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.6rem", alignItems: "center" }}>
              <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "#475569", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                From
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ padding: "0.3rem 0.4rem", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "0.75rem" }} />
              </label>
              <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "#475569", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                To
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ padding: "0.3rem 0.4rem", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "0.75rem" }} />
              </label>
              <div style={{ marginLeft: "auto", display: "flex", gap: "0.4rem" }}>
                <button onClick={exportCSV} className="btn btn-outline" style={{ padding: "0.3rem 0.6rem", fontSize: "0.72rem", borderRadius: "6px" }}>⬇ CSV</button>
                <button onClick={printStatement} className="btn btn-primary" style={{ padding: "0.3rem 0.6rem", fontSize: "0.72rem", borderRadius: "6px" }}>🖨 Print</button>
              </div>
            </div>
          </div>

          <div style={{ padding: "0.5rem 1rem", overflowY: "auto", flex: 1 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem" }}>
              <thead>
                <tr style={{ color: "#64748b", textTransform: "uppercase", fontSize: "0.62rem", letterSpacing: "0.03em" }}>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Description</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Debit ฿</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Credit ฿</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ background: "#f8fafc" }}>
                  <td colSpan={3} style={tdStyle}><strong>Opening Balance (B/F)</strong></td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{openingBalance > 0 ? openingBalance.toFixed(2) : ""}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{openingBalance < 0 ? Math.abs(openingBalance).toFixed(2) : ""}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800 }}>{openingBalance.toFixed(2)}</td>
                </tr>
                {rows.length === 0 && (
                  <tr><td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "#94a3b8", padding: "1rem" }}>Is range mein koi entry nahi.</td></tr>
                )}
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={tdStyle}>{fmtDate(r.ts)}</td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: r.change < 0 ? "#047857" : "#b91c1c" }}>{r.type}</td>
                    <td style={{ ...tdStyle, color: "#64748b" }}>{r.description}</td>
                    <td style={{ ...tdStyle, textAlign: "right", color: r.change > 0 ? "#b91c1c" : "inherit" }}>{r.change > 0 ? r.change.toFixed(2) : ""}</td>
                    <td style={{ ...tdStyle, textAlign: "right", color: r.change < 0 ? "#047857" : "inherit" }}>{r.change < 0 ? Math.abs(r.change).toFixed(2) : ""}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: r.running > 0 ? "#dc2626" : "#047857" }}>{r.running.toFixed(2)}</td>
                  </tr>
                ))}
                <tr style={{ background: "#f0fdf4" }}>
                  <td colSpan={5} style={tdStyle}><strong>Closing Balance</strong></td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: closingBalance > 0 ? "#dc2626" : "#047857" }}>{closingBalance.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

const thStyle = { padding: "5px 6px", borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#64748b", fontWeight: 700, whiteSpace: "nowrap" };
const tdStyle = { padding: "5px 6px", borderBottom: "1px solid #f1f5f9", color: "#1e293b" };
