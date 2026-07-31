import { useState, useEffect, useMemo } from "react";
import { initAuditListener } from "../db/audit";

const ACTION_META = {
  auth_login: { icon: "🔓", label: "Login", color: "#2563eb" },
  auth_logout: { icon: "🔒", label: "Logout", color: "#64748b" },
  user_saved: { icon: "👤", label: "User Updated", color: "#7c3aed" },
  user_deleted: { icon: "🗑️", label: "User Deleted", color: "#dc2626" },
  sale_created: { icon: "🧾", label: "Sale", color: "#047857" },
  sale_voided: { icon: "🚫", label: "Bill Voided", color: "#dc2626" },
  sale_returned: { icon: "↩️", label: "Return", color: "#d97706" },
  sale_mode_edited: { icon: "✏️", label: "Mode Edited", color: "#d97706" },
  coh_transfer_initiated: { icon: "📤", label: "COH Transfer", color: "#2563eb" },
  coh_transfer_approved: { icon: "✅", label: "Transfer Approved", color: "#047857" },
  coh_transfer_rejected: { icon: "❌", label: "Transfer Rejected", color: "#dc2626" },
  coh_balance_adjusted: { icon: "⚙️", label: "COH Adjusted", color: "#d97706" },
  bank_created: { icon: "🏦", label: "Bank Created", color: "#2563eb" },
  bank_updated: { icon: "🏦", label: "Bank Updated", color: "#2563eb" },
  bank_deleted: { icon: "🏦", label: "Bank Deleted", color: "#dc2626" },
  finance_transfer: { icon: "💸", label: "Finance Transfer", color: "#047857" },
  expense_added: { icon: "💸", label: "Expense", color: "#dc2626" },
  expense_deleted: { icon: "🗑️", label: "Expense Deleted", color: "#dc2626" },
  purchase_saved: { icon: "📦", label: "Purchase", color: "#0891b2" },
  purchase_received: { icon: "📥", label: "Purchase Received", color: "#047857" },
  purchase_cancelled: { icon: "🚫", label: "Purchase Cancelled", color: "#dc2626" },
  product_saved: { icon: "📦", label: "Product Saved", color: "#0891b2" },
  product_deleted: { icon: "🗑️", label: "Product Deleted", color: "#dc2626" },
  customer_created: { icon: "🧑‍🤝‍🧑", label: "Customer Created", color: "#7c3aed" },
  customer_updated: { icon: "✏️", label: "Customer Updated", color: "#7c3aed" },
  khata_payment: { icon: "💳", label: "Khata Payment", color: "#047857" },
  khata_updated: { icon: "📒", label: "Khata Updated", color: "#7c3aed" },
  supplier_created: { icon: "🚚", label: "Supplier Created", color: "#0891b2" },
  supplier_updated: { icon: "✏️", label: "Supplier Updated", color: "#0891b2" },
  supplier_deleted: { icon: "🗑️", label: "Supplier Deleted", color: "#dc2626" },
  supplier_payment: { icon: "💰", label: "Supplier Paid", color: "#d97706" },
  settings_changed: { icon: "⚙️", label: "Settings Changed", color: "#64748b" },
  payment_mode_saved: { icon: "💳", label: "Payment Mode", color: "#0891b2" },
  payment_mode_deleted: { icon: "🗑️", label: "Payment Mode Deleted", color: "#dc2626" },
  system_reset: { icon: "☢️", label: "Factory Reset", color: "#dc2626" },
};

const metaFor = (action) => ACTION_META[action] || { icon: "📌", label: action || "Action", color: "#64748b" };

const fmtMoney = (v) => "฿" + (v || 0).toFixed(2);

export default function AuditLogView({ onBack }) {
  const [logs, setLogs] = useState([]);
  const [actorFilter, setActorFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsub = initAuditListener((list) => setLogs(list));
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  const actors = useMemo(() => {
    const map = {};
    logs.forEach(l => {
      if (!map[l.actorId]) map[l.actorId] = { id: l.actorId, name: l.actorName, count: 0 };
      map[l.actorId].count++;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [logs]);

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (actorFilter !== "all" && l.actorId !== actorFilter) return false;
      if (actionFilter !== "all" && l.action !== actionFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${l.details || ""} ${l.entityId || ""} ${metaFor(l.action).label}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [logs, actorFilter, actionFilter, search]);

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const todayCount = logs.filter(l => l.timestamp >= todayStart).length;
  const actionCounts = useMemo(() => {
    const map = {};
    logs.forEach(l => { map[l.action] = (map[l.action] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [logs]);

  return (
    <div className="coh-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <h3 className="coh-title">🕵️ Activity Log</h3>
        <button className="btn btn-outline btn-sm" onClick={onBack}>Back</button>
      </div>
      <p className="text-muted" style={{ fontSize: "0.75rem", margin: "0 0 0.75rem" }}>
        Every action across the system — who did what, when, and on which device.
      </p>

      <div className="kpi-grid">
        <div className="kpi-card" style={{ background: "linear-gradient(135deg, #1e3a8a, #1e40af)", border: "none" }}>
          <span className="kpi-label" style={{ color: "#bfdbfe" }}>Total Actions</span>
          <span className="kpi-value" style={{ color: "#ffffff" }}>{logs.length}</span>
          <span className="kpi-sub" style={{ color: "#bfdbfe" }}>Last 500 recorded</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Today</span>
          <span className="kpi-value" style={{ color: "#2563eb" }}>{todayCount}</span>
          <span className="kpi-sub">Actions today</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Active Users</span>
          <span className="kpi-value" style={{ color: "#047857" }}>{actors.length}</span>
          <span className="kpi-sub">Distinct actors</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Top Actor</span>
          <span className="kpi-value" style={{ color: "#d97706", fontSize: "1.05rem" }}>{actors[0]?.name || "—"}</span>
          <span className="kpi-sub">{actors[0]?.count || 0} actions</span>
        </div>
      </div>

      <div className="card" style={{ marginTop: "0.75rem" }}>
        <div className="filter-bar">
          <select value={actorFilter} onChange={e => setActorFilter(e.target.value)} className="input-field" style={{ fontFamily: "inherit", maxWidth: "150px", padding: "0.4rem", fontSize: "0.8rem" }}>
            <option value="all">All users</option>
            {actors.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.count})</option>
            ))}
          </select>
          <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="input-field" style={{ fontFamily: "inherit", maxWidth: "170px", padding: "0.4rem", fontSize: "0.8rem" }}>
            <option value="all">All actions</option>
            {actionCounts.map(([action, count]) => (
              <option key={action} value={action}>{metaFor(action).label} ({count})</option>
            ))}
          </select>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field"
            style={{ flex: 1, minWidth: "140px", padding: "0.4rem", fontSize: "0.8rem" }}
            placeholder="🔍 Search details or ID..."
          />
        </div>

        <div className="ledger-list">
          {filtered.length === 0 ? (
            <div className="coh-empty">No activity recorded yet.</div>
          ) : (
            filtered.slice(0, 150).map(l => {
              const meta = metaFor(l.action);
              return (
                <div key={l.id} className="audit-row">
                  <span className="audit-icon" style={{ background: (l.action === "system_reset" || l.action.includes("deleted") || l.action.includes("voided") || l.action.includes("rejected")) ? "#fee2e2" : "#dcfce7" }}>
                    {meta.icon}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <span style={{ color: meta.color }}>{meta.label}</span> · {l.details || l.entityId || "—"}
                    </div>
                    <div className="text-muted" style={{ fontSize: "0.68rem", marginTop: "1px" }}>
                      {l.actorName} {l.role === "admin" ? "🛡️" : "👷"} · {new Date(l.timestamp).toLocaleString()}
                      {l.device ? ` · ${l.device}` : ""}
                    </div>
                  </div>
                  {l.amount != null && (
                    <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--primary)", flexShrink: 0 }}>{fmtMoney(l.amount)}</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
