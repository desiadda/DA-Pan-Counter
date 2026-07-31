import { useMemo, useState } from "react";
import ModalPortal from "./ModalPortal";

const fmtMoney = (v) => "฿" + (v || 0).toFixed(2);

export default function AccountStatementModal({ title, subtitle, icon, balance, rows, onClose }) {
  const [filter, setFilter] = useState("all"); // all | in | out

  const posted = useMemo(
    () => rows.filter(r => r.status !== "pending" && r.status !== "rejected"),
    [rows]
  );

  const entries = useMemo(() => {
    const list = [...posted].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    let bal = balance || 0;
    return list.map(r => {
      const after = bal;
      if (r.in) bal -= r.in;
      if (r.out) bal += r.out;
      return { ...r, after };
    });
  }, [posted, balance]);

  const visible = entries.filter(r =>
    filter === "all" ? true : filter === "in" ? !!r.in : !!r.out
  );

  const totalIn = entries.reduce((s, r) => s + (r.in || 0), 0);
  const totalOut = entries.reduce((s, r) => s + (r.out || 0), 0);

  const chips = [
    { key: "all", label: "All" },
    { key: "in", label: "In" },
    { key: "out", label: "Out" },
  ];

  return (
    <ModalPortal onClose={onClose}>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content stmt-modal" onClick={e => e.stopPropagation()}>
          <div className="stmt-header">
            <button className="stmt-close" onClick={onClose}>✕</button>
            <div className="stmt-title">{icon} {title}</div>
            <div className="stmt-subtitle">{subtitle}</div>
            <div className="stmt-balance">{fmtMoney(balance)}</div>
            <div className="stmt-balance-label">Current Balance</div>
          </div>

          <div className="stmt-kpis">
            <div className="stmt-kpi">
              <div className="stmt-kpi-label">Total In</div>
              <div className="stmt-kpi-value" style={{ color: "#047857" }}>{fmtMoney(totalIn)}</div>
            </div>
            <div className="stmt-kpi">
              <div className="stmt-kpi-label">Total Out</div>
              <div className="stmt-kpi-value" style={{ color: "#dc2626" }}>{fmtMoney(totalOut)}</div>
            </div>
            <div className="stmt-kpi">
              <div className="stmt-kpi-label">Transactions</div>
              <div className="stmt-kpi-value">{entries.length}</div>
            </div>
          </div>

          <div className="filter-bar" style={{ margin: "0.5rem 0" }}>
            {chips.map(c => (
              <button
                key={c.key}
                className={`quick-chip ${filter === c.key ? "quick-chip-active" : ""}`}
                onClick={() => setFilter(c.key)}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="stmt-list">
            {visible.length === 0 ? (
              <div className="coh-empty">No transactions yet.</div>
            ) : (
              <>
                <div className="stmt-head">
                  <span className="stmt-col-desc">Date & Description</span>
                  <span className="stmt-amount-in">In</span>
                  <span className="stmt-amount-out">Out</span>
                  <span className="stmt-bal">Balance</span>
                </div>
                {visible.map(r => (
                  <div key={r.id} className="stmt-row">
                    <div className="stmt-col-desc">
                      <div className="stmt-desc">{r.description}</div>
                      <div className="stmt-date">{new Date(r.timestamp).toLocaleString()}</div>
                      {r.detail && <div className="stmt-note">{r.detail}</div>}
                    </div>
                    <span className="stmt-amount-in">{r.in ? "+" + fmtMoney(r.in) : "—"}</span>
                    <span className="stmt-amount-out">{r.out ? "-" + fmtMoney(r.out) : "—"}</span>
                    <span className="stmt-bal">{fmtMoney(r.after)}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
