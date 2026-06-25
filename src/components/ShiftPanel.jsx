import { useState, useEffect } from "react";
import { getOpenShift, openShift, closeShift, getTodayShiftSummary } from "../db/shifts";
import ModalPortal from "./ModalPortal";

export default function ShiftPanel({ user, onClose }) {
  const [shift, setShift] = useState(null);
  const [startingCash, setStartingCash] = useState("");
  const [closingCash, setClosingCash] = useState("");
  const [mode, setMode] = useState("view");
  const [summary, setSummary] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const s = getOpenShift(user.id);
    setShift(s);
    setSummary(getTodayShiftSummary(user.id));
    if (s) setMode("view");
  }, [user.id]);

  const handleOpen = () => {
    try {
      const s = openShift(user.id, user.name, parseFloat(startingCash) || 0);
      setShift(s);
      setMode("view");
      setMsg("Shift opened successfully!");
      setSummary(getTodayShiftSummary(user.id));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleClose = () => {
    if (closingCash === "") { alert("Enter actual cash count"); return; }
    try {
      const s = closeShift(user.id, closingCash);
      setShift(s);
      setMsg("Shift closed successfully!");
      setSummary(getTodayShiftSummary(user.id));
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <ModalPortal>
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>🛑 Shift Management</h3>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        {msg && <div style={styles.msg}>{msg}</div>}

        {!shift ? (
          <div style={styles.section}>
            <p style={styles.noShift}>No open shift for {user.name}</p>
            {mode === "open" ? (
              <div style={styles.form}>
                <label style={styles.label}>Starting Cash (฿)</label>
                <input type="number" value={startingCash} onChange={e => setStartingCash(e.target.value)} style={styles.input} placeholder="0" autoFocus />
                <div style={styles.formActions}>
                  <button onClick={handleOpen} className="btn btn-primary" style={{ flex: 1 }}>Open Shift</button>
                  <button onClick={() => setMode("view")} className="btn btn-outline" style={{ flex: 1 }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setMode("open")} className="btn btn-primary" style={{ width: "100%" }}>🟢 Open New Shift</button>
            )}
          </div>
        ) : (
          <div>
            <div style={styles.shiftInfo}>
              <div style={styles.infoRow}><span>Status</span><span style={{ color: "#047857", fontWeight: 700 }}>🟢 Open</span></div>
              <div style={styles.infoRow}><span>Opened</span><span>{new Date(shift.openTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span></div>
              <div style={styles.infoRow}><span>Starting Cash</span><span>฿{shift.startingCash.toFixed(0)}</span></div>
            </div>

            {mode === "close" ? (
              <div style={styles.form}>
                <label style={styles.label}>Actual Cash Count (฿)</label>
                <input type="number" value={closingCash} onChange={e => setClosingCash(e.target.value)} style={styles.input} placeholder="Enter total cash in drawer" autoFocus />
                <div style={styles.formActions}>
                  <button onClick={handleClose} className="btn btn-danger" style={{ flex: 1 }}>🔴 Close Shift</button>
                  <button onClick={() => setMode("view")} className="btn btn-outline" style={{ flex: 1 }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setMode("close")} className="btn btn-danger" style={{ width: "100%", marginTop: "0.75rem" }}>🔴 Close Shift</button>
            )}
          </div>
        )}

        {summary && (
          <div style={{ ...styles.section, marginTop: "0.75rem" }}>
            <h4 style={styles.subTitle}>Today's Shifts</h4>
            <div style={styles.infoRow}><span>Total shifts</span><span>{summary.totalToday}</span></div>
            {summary.closeTime && (
              <>
                <div style={styles.infoRow}><span>Expected Cash</span><span>฿{summary.expectedCash?.toFixed(0)}</span></div>
                <div style={styles.infoRow}><span>Actual Cash</span><span>฿{summary.actualCash?.toFixed(0)}</span></div>
                <div style={{ ...styles.infoRow, color: summary.difference >= 0 ? "#047857" : "#dc2626" }}>
                  <span>Difference</span>
                  <span>{summary.difference >= 0 ? "+" : ""}฿{summary.difference?.toFixed(0)}</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
    </ModalPortal>
  );
}

const styles = {
  overlay: {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem",
  },
  panel: {
    background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "400px",
    padding: "1.25rem", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" },
  title: { fontSize: "1.05rem", fontWeight: 700, color: "#1e293b", margin: 0 },
  closeBtn: { background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#64748b", padding: "0.25rem" },
  section: { marginBottom: "0.5rem" },
  noShift: { fontSize: "0.9rem", color: "#64748b", marginBottom: "0.75rem", textAlign: "center" },
  form: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  label: { fontSize: "0.8rem", fontWeight: 600, color: "#475569" },
  input: {
    padding: "0.75rem", borderRadius: "10px", border: "1px solid #e2e8f0",
    fontSize: "1.1rem", fontWeight: 700, textAlign: "center",
  },
  formActions: { display: "flex", gap: "0.5rem", marginTop: "0.25rem" },
  shiftInfo: {
    background: "#f8fafc", borderRadius: "10px", padding: "0.75rem",
    display: "flex", flexDirection: "column", gap: "0.4rem",
  },
  infoRow: {
    display: "flex", justifyContent: "space-between", fontSize: "0.85rem",
    fontWeight: 600, color: "#475569",
  },
  msg: {
    background: "#f0fdf4", color: "#065f46", padding: "0.5rem 0.75rem",
    borderRadius: "8px", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.75rem",
    textAlign: "center",
  },
  subTitle: { fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.5rem" },
};
