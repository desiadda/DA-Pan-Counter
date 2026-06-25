export default function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, onConfirm, onCancel, variant }) {
  if (!open) return null;

  const isDanger = variant === "danger";

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "400px", textAlign: "center" }}
      >
        <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>
          {isDanger ? "⚠️" : "❓"}
        </div>
        {title && <h3 style={{ marginBottom: "0.5rem", color: "#1e293b" }}>{title}</h3>}
        <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "1.5rem", lineHeight: "1.4" }}>
          {message}
        </p>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            onClick={onCancel}
            className="btn btn-outline"
            style={{ flex: 1 }}
          >
            {cancelLabel || "Cancel"}
          </button>
          <button
            onClick={onConfirm}
            className="btn"
            style={{
              flex: 1,
              backgroundColor: isDanger ? "#ef4444" : "#047857",
              color: "#ffffff",
              border: "none",
            }}
          >
            {confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
