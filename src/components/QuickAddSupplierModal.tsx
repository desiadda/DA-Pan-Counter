import { useState } from "react";
import ModalPortal from "./ModalPortal";
import { dbService } from "../firebase";
import { useLangStore } from "../stores/langStore";
import { useT } from "../lang/translations";

interface QuickAddSupplierModalProps {
  onClose: () => void;
  onSuccess: (newSupplier: any) => void;
  initialName?: string;
}

export default function QuickAddSupplierModal({ onClose, onSuccess, initialName = "" }: QuickAddSupplierModalProps) {
  const lang = useLangStore((s) => s.lang);
  const tr = useT(lang);

  const [name, setName] = useState(initialName);
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;

    const ob = parseFloat(openingBalance) || 0;
    const obDateMs = Date.now();

    const newSupplier = {
      name: name.trim(),
      contact: contact.trim(),
      phone: phone.trim(),
      address: address.trim(),
      balance: ob,
      ledger: ob > 0 ? [{
        date: obDateMs,
        type: "Opening Balance",
        amount: ob,
        description: "Opening balance (initial udhaar)",
      }] : [],
    };

    try {
      setSubmitting(true);
      const savedSup = await dbService.saveSupplier(newSupplier);
      const resultSup = savedSup || { id: "sup_" + Date.now(), ...newSupplier };
      onSuccess(resultSup);
      onClose();
    } catch (err: any) {
      console.error(err);
      alert("❌ Failed to save supplier: " + (err.message || "Unknown error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal onClose={onClose}>
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.5)",
          zIndex: 200,
          display: "flex",
          alignItems: "center",
          justify: "center",
          padding: "1rem",
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            width: "100%",
            maxWidth: "440px",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.5rem" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#047857" }}>
              📍 {tr("purchase.quickAddSupplierTitle")}
            </h3>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "#64748b" }}>✕</button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">{tr("supplier.name")} *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bangkok Wholesale Co."
                className="input-field"
                required
                autoFocus
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">{tr("supplier.contact")}</label>
                <input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="Person name"
                  className="input-field"
                />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">{tr("supplier.phone")}</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="081..."
                  className="input-field"
                />
              </div>
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">{tr("supplier.address")}</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="City / Area"
                className="input-field"
              />
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">{tr("supplier.openingBalance")} <span style={{ fontWeight: 400, color: "#94a3b8" }}>— {tr("supplier.openingBalanceHint")}</span></label>
              <input
                type="number"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0.00"
                className="input-field"
                min="0"
                step="0.01"
              />
            </div>

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button type="submit" disabled={submitting} className="btn btn-primary" style={{ flex: 1, padding: "0.6rem" }}>
                {submitting ? tr("supplier.saving") : tr("supplier.save")}
              </button>
              <button type="button" onClick={onClose} className="btn btn-outline" style={{ flex: 1, padding: "0.6rem" }}>
                {tr("common.cancel")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
