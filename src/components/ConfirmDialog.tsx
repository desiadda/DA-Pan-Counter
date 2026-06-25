import ModalPortal from "./ModalPortal";

export default function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, onConfirm, onCancel, variant }) {
  if (!open) return null;

  const isDanger = variant === "danger";
  const confirmBtnClass = isDanger ? "btn btn-danger" : "btn btn-primary";

  return (
    <ModalPortal>
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "400px", textAlign: "center" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>
          {isDanger ? "⚠️" : "❓"}
        </div>
        {title && <h3 className="section-subtitle" style={{ marginBottom: "0.5rem" }}>{title}</h3>}
        <p className="text-muted" style={{ fontSize: "0.9rem", marginBottom: "1.5rem", lineHeight: "1.4" }}>
          {message}
        </p>
        <div className="flex-btn-group">
          <button onClick={onCancel} className="btn btn-outline">{cancelLabel || "Cancel"}</button>
          <button onClick={onConfirm} className={confirmBtnClass}>{confirmLabel || "Confirm"}</button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
