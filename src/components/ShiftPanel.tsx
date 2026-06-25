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
    <div className="modal-overlay" style={{ alignItems: "center", padding: "1rem" }} onClick={onClose}>
      <div style={{ background: "var(--card-bg)", borderRadius: "var(--radius-lg)", width: "100%", maxWidth: "400px", padding: "1.25rem", boxShadow: "var(--shadow-lg)" }} onClick={e => e.stopPropagation()}>
        <div className="sheet-header" style={{ marginBottom: "1rem" }}>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>🛑 Shift Management</h3>
          <button onClick={onClose} className="sheet-close-btn">✕</button>
        </div>

        {msg && <div className="shift-msg">{msg}</div>}

        {!shift ? (
          <div className="shift-section">
            <p className="text-muted" style={{ fontSize: "0.9rem", marginBottom: "0.75rem", textAlign: "center" }}>No open shift for {user.name}</p>
            {mode === "open" ? (
              <div className="shift-form">
                <label className="shift-form-label">Starting Cash (฿)</label>
                <input type="number" value={startingCash} onChange={e => setStartingCash(e.target.value)} className="shift-form-input" placeholder="0" autoFocus />
                <div className="flex-btn-group">
                  <button onClick={handleOpen} className="btn btn-primary">Open Shift</button>
                  <button onClick={() => setMode("view")} className="btn btn-outline">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setMode("open")} className="btn btn-primary" style={{ width: "100%" }}>🟢 Open New Shift</button>
            )}
          </div>
        ) : (
          <div>
            <div className="shift-info-box">
              <div className="info-row"><span>Status</span><span style={{ color: "var(--primary)", fontWeight: 700 }}>🟢 Open</span></div>
              <div className="info-row"><span>Opened</span><span>{new Date(shift.openTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span></div>
              <div className="info-row"><span>Starting Cash</span><span>฿{shift.startingCash.toFixed(0)}</span></div>
            </div>

            {mode === "close" ? (
              <div className="shift-form" style={{ marginTop: "0.75rem" }}>
                <label className="shift-form-label">Actual Cash Count (฿)</label>
                <input type="number" value={closingCash} onChange={e => setClosingCash(e.target.value)} className="shift-form-input" placeholder="Enter total cash in drawer" autoFocus />
                <div className="flex-btn-group">
                  <button onClick={handleClose} className="btn btn-danger">🔴 Close Shift</button>
                  <button onClick={() => setMode("view")} className="btn btn-outline">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setMode("close")} className="btn btn-danger" style={{ width: "100%", marginTop: "0.75rem" }}>🔴 Close Shift</button>
            )}
          </div>
        )}

        {summary && (
          <div className="shift-section" style={{ marginTop: "0.75rem" }}>
            <h4 className="section-subtitle" style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>Today's Shifts</h4>
            <div className="info-row"><span>Total shifts</span><span>{summary.totalToday}</span></div>
            {summary.closeTime && (
              <>
                <div className="info-row"><span>Expected Cash</span><span>฿{summary.expectedCash?.toFixed(0)}</span></div>
                <div className="info-row"><span>Actual Cash</span><span>฿{summary.actualCash?.toFixed(0)}</span></div>
                <div className="info-row" style={{ color: summary.difference >= 0 ? "var(--primary)" : "var(--error)" }}>
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
