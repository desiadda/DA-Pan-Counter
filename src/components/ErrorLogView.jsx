import { useState, useEffect } from "react";
import { getErrors, getCategories, markAsRead, markAllAsRead, deleteError, clearErrors } from "../db/errorLog";

export default function ErrorLogView({ onBack }) {
  const [logs, setLogs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filter, setFilter] = useState("All");

  const refresh = () => {
    setLogs(getErrors(filter));
    setCategories(getCategories());
  };

  useEffect(() => { refresh(); }, [filter]);
  useEffect(() => { window.addEventListener("error-logged", refresh); return () => window.removeEventListener("error-logged", refresh); }, [filter]);

  const severityColor = (s) => {
    switch (s) {
      case "critical": return "#dc2626";
      case "error": return "#ea580c";
      case "warning": return "#d97706";
      default: return "#64748b";
    }
  };

  const severityBg = (s) => {
    switch (s) {
      case "critical": return "#fef2f2";
      case "error": return "#fff7ed";
      case "warning": return "#fffbeb";
      default: return "#f8fafc";
    }
  };

  const formatDate = (ts) => new Date(ts).toLocaleString("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div style={styles.container}>
      <div style={styles.subHeader}>
        <button onClick={onBack} style={styles.backBtn}>← Back</button>
        <h3 style={styles.subTitle}>Error Logs</h3>
        <div style={{ flex: 1 }} />
        <button onClick={() => { markAllAsRead(); refresh(); }} className="btn btn-outline" style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}>Mark All Read</button>
        <button onClick={() => { if (confirm("Clear all error logs?")) { clearErrors(); refresh(); } }} className="btn btn-danger" style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}>Clear</button>
      </div>

      {/* Category Filter Pills */}
      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
        <button onClick={() => setFilter("All")} style={{ ...styles.pill, ...(filter === "All" ? styles.pillActive : {}) }}>All ({logs.length})</button>
        {categories.map(c => (
          <button key={c.name} onClick={() => setFilter(c.name)} style={{ ...styles.pill, ...(filter === c.name ? styles.pillActive : {}) }}>
            {c.name} ({c.count})
          </button>
        ))}
      </div>

      {/* Log List */}
      {logs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8", fontSize: "0.9rem" }}>
          ✅ No errors logged
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "60vh", overflowY: "auto" }}>
          {logs.map(e => (
            <div key={e.id} style={{ ...styles.logRow, backgroundColor: e.read ? "#ffffff" : severityBg(e.severity), borderLeft: `4px solid ${severityColor(e.severity)}` }} onClick={() => { if (!e.read) { markAsRead(e.id); refresh(); } }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flex: 1 }}>
                  <span style={{ fontSize: "0.6rem", fontWeight: 700, color: severityColor(e.severity), textTransform: "uppercase", minWidth: "48px" }}>{e.severity}</span>
                  <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "#475569", backgroundColor: "#f1f5f9", padding: "1px 6px", borderRadius: "4px" }}>{e.category}</span>
                </div>
                <span style={{ fontSize: "0.6rem", color: "#94a3b8", whiteSpace: "nowrap" }}>{formatDate(e.timestamp)}</span>
              </div>
              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#1e293b", marginTop: "4px" }}>{e.message}</div>
              {e.details && <pre style={{ fontSize: "0.6rem", color: "#64748b", marginTop: "4px", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: "80px", overflow: "hidden", background: "#f8fafc", padding: "4px", borderRadius: "4px" }}>{e.details}</pre>}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "4px" }}>
                {!e.read && <button onClick={() => { markAsRead(e.id); refresh(); }} className="btn btn-outline" style={{ padding: "0.15rem 0.4rem", fontSize: "0.6rem" }}>Mark Read</button>}
                <button onClick={() => { deleteError(e.id); refresh(); }} className="btn btn-outline" style={{ padding: "0.15rem 0.4rem", fontSize: "0.6rem", color: "#dc2626", borderColor: "#fca5a5" }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" },
  subHeader: { display: "flex", alignItems: "center", gap: "0.75rem" },
  subTitle: { fontSize: "1.1rem", fontWeight: "700", color: "#1e293b" },
  backBtn: { background: "none", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "0.4rem 0.75rem", cursor: "pointer", fontSize: "0.85rem", fontWeight: "600", color: "#64748b", fontFamily: "inherit" },
  pill: { padding: "0.3rem 0.6rem", fontSize: "0.7rem", fontWeight: 600, borderRadius: "20px", border: "1px solid #e2e8f0", background: "#ffffff", cursor: "pointer", color: "#475569", fontFamily: "inherit" },
  pillActive: { backgroundColor: "#047857", color: "#ffffff", borderColor: "#047857" },
  logRow: { padding: "0.6rem", borderRadius: "8px", border: "1px solid #e2e8f0", cursor: "pointer" },
};
