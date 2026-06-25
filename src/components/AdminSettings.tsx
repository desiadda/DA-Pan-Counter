import { useState, useEffect } from "react";
import { dbService } from "../firebase";
import { hashPin } from "../db/hash";
import { useConfirmStore } from "../stores/confirmStore";
import { getErrors, getCategories, getUnreadCount, markAsRead, markAllAsRead, deleteError, clearErrors } from "../db/errorLog";
import { logError } from "../db/errorLog";

const LS = localStorage;

const getStore = () => {
  try {
    const raw = LS.getItem("pan_store_settings");
    return raw ? JSON.parse(raw) : { name: "Paan Counter", address: "", phone: "", taxId: "", logo: "" };
  } catch (err) {
    logError("SETTINGS", err.message, err.stack);
    console.error(err);
    return { name: "Paan Counter", address: "", phone: "", taxId: "", logo: "" };
  }
};

export default function AdminSettings({ onBack }) {
  const confirm = useConfirmStore((s) => s.confirm);

  // Store
  const [store, setStore] = useState(getStore);

  // PIN
  const [adminPin, setAdminPin] = useState(LS.getItem("pan_admin_pin") || "1234");
  const [staffPin, setStaffPin] = useState(LS.getItem("pan_staff_pin") || "5555");

  // PromptPay
  const [promptpayNumber, setPromptpayNumber] = useState(LS.getItem("pan_promptpay_number") || "0912345678");

  // VAT
  const [taxEnabled, setTaxEnabled] = useState(LS.getItem("pan_tax_enabled") === "true");
  const [taxRate, setTaxRate] = useState(LS.getItem("pan_tax_rate") || "7");

  // Firebase
  const [firebaseConfigInput, setFirebaseConfigInput] = useState(JSON.stringify(dbService.getConfig(), null, 2));

  // Discount reasons
  const [discountReasons, setDiscountReasons] = useState(() => {
    try {
      const raw = LS.getItem("pan_discount_reasons");
      return raw ? JSON.parse(raw) : ["Loyalty Discount", "Festival Offer", "Damaged Product", "Bulk Purchase", "Staff Discount"];
    } catch (err) {
      logError("SETTINGS", err.message, err.stack);
      console.error(err);
      return ["Loyalty Discount", "Festival Offer", "Damaged Product", "Bulk Purchase", "Staff Discount"];
    }
  });
  const [newReason, setNewReason] = useState("");
  const [editReasonIdx, setEditReasonIdx] = useState(-1);
  const [editReasonVal, setEditReasonVal] = useState("");

  const saveReasons = (list) => { try { LS.setItem("pan_discount_reasons", JSON.stringify(list)); setDiscountReasons(list); } catch (err) { logError("SETTINGS", err.message, err.stack); alert("❌ " + (err.message || "Failed to save discount reasons")); console.error(err); } };

  // Error logs
  const [errorLogs, setErrorLogs] = useState([]);
  const [errorFilter, setErrorFilter] = useState("All");
  const refreshLogs = () => setErrorLogs(getErrors(errorFilter));
  useEffect(() => { refreshLogs(); window.addEventListener("error-logged", refreshLogs); return () => window.removeEventListener("error-logged", refreshLogs); }, [errorFilter]);
  const errorCats = getCategories();

  const handleSavePins = async () => {
    if (adminPin.length !== 4 || staffPin.length !== 4 || isNaN(adminPin) || isNaN(staffPin)) { alert("PIN codes must be exactly 4 digits."); return; }
    try {
      LS.setItem("pan_admin_pin", await hashPin(adminPin.trim()));
      LS.setItem("pan_staff_pin", await hashPin(staffPin.trim()));
      alert("PIN codes saved!");
    } catch (err) {
      logError("SETTINGS", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to save PIN codes"));
      console.error(err);
    }
  };

  const handleSaveStore = () => {
    try {
      const str = JSON.stringify(store);
      if (str.length > 4_500_000) { alert("Logo image too large! Please use a smaller image (under ~4.5MB)."); return; }
      LS.setItem("pan_store_settings", str);
      const link = document.querySelector("link[rel~='icon']");
      if (link) link.href = store.logo;
      alert("Store details saved!");
    } catch (e) {
      logError("SETTINGS", e.message, e.stack);
      alert("Failed to save: " + (e.name === "QuotaExceededError" ? "Storage full. Try a smaller logo image." : e.message));
    }
  };

  const handleSaveTaxSettings = () => {
    const rate = parseFloat(taxRate);
    if (isNaN(rate) || rate < 0 || rate > 100) { alert("Tax rate must be between 0 and 100."); return; }
    try {
      LS.setItem("pan_tax_enabled", taxEnabled ? "true" : "false");
      LS.setItem("pan_tax_rate", rate.toString());
      alert(`VAT ${taxEnabled ? "enabled" : "disabled"} at ${rate}%`);
    } catch (err) {
      logError("SETTINGS", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to save tax settings"));
      console.error(err);
    }
  };

  const handleSaveFirebaseConfig = () => {
    try { const parsed = JSON.parse(firebaseConfigInput); dbService.saveConfig(parsed); alert("Firebase Config updated! Refreshing..."); }
    catch (e) { logError("SETTINGS", e.message, e.stack); alert("Invalid JSON format!"); }
  };
  const handleClearFirebaseConfig = async () => {
    try {
      const ok = await confirm("Delete Firebase credentials? App will revert to LocalStorage.", { title: "Disconnect Cloud", confirmLabel: "Disconnect", variant: "danger" });
      if (ok) dbService.clearConfig();
    } catch (err) {
      logError("SETTINGS", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to disconnect cloud"));
      console.error(err);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.subHeader}>
        <button onClick={onBack} style={styles.backBtn}>← Back</button>
        <h3 style={styles.subTitle}>Settings</h3>
      </div>

      {/* Store */}
      <div style={styles.card}>
        <h3 style={styles.cardHeader}>🏪 Store Details</h3>
        <div className="input-group"><label className="input-label">Store Name</label><input type="text" value={store.name} onChange={e => setStore({...store, name: e.target.value})} className="input-field" /></div>
        <div className="input-group"><label className="input-label">Address</label><textarea value={store.address} onChange={e => setStore({...store, address: e.target.value})} className="input-field" rows={2} /></div>
        <div className="input-group"><label className="input-label">Phone</label><input type="text" value={store.phone} onChange={e => setStore({...store, phone: e.target.value})} className="input-field" /></div>
        <div className="input-group"><label className="input-label">Tax ID</label><input type="text" value={store.taxId} onChange={e => setStore({...store, taxId: e.target.value})} className="input-field" /></div>
        <div className="input-group">
          <label className="input-label">Store Logo</label>
          <input type="file" accept="image/*" onChange={e => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (ev) => setStore({...store, logo: ev.target.result}); reader.readAsDataURL(file); }} />
          {store.logo && <div style={{marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem"}}><img src={store.logo} alt="Logo" style={{height: "48px", borderRadius: "8px", objectFit: "contain"}} /><button onClick={() => setStore({...store, logo: ""})} className="btn btn-outline" style={{padding: "0.2rem 0.5rem", fontSize: "0.75rem"}}>Remove</button></div>}
        </div>
        <button onClick={handleSaveStore} className="btn btn-primary" style={{padding: "0.6rem"}}>Save Store Details</button>
      </div>

      {/* PIN */}
      <div style={styles.card}>
        <h3 style={styles.cardHeader}>Security (PIN Setup)</h3>
        <div className="input-group"><label className="input-label">Admin Pin (4 digits)</label><input type="text" maxLength={4} value={adminPin} onChange={e => setAdminPin(e.target.value.replace(/\D/g, ''))} className="input-field" /></div>
        <div className="input-group"><label className="input-label">Staff Pin (4 digits)</label><input type="text" maxLength={4} value={staffPin} onChange={e => setStaffPin(e.target.value.replace(/\D/g, ''))} className="input-field" /></div>
        <button onClick={handleSavePins} className="btn btn-primary" style={{padding: "0.6rem"}}>Save PIN Codes</button>
      </div>

      {/* PromptPay */}
      <div style={styles.card}>
        <h3 style={styles.cardHeader}>Merchant Payment</h3>
        <div className="input-group">
          <label className="input-label">PromptPay Phone / Tax ID</label>
          <div style={{display: "flex", gap: "0.5rem"}}>
            <input type="text" value={promptpayNumber} onChange={e => setPromptpayNumber(e.target.value)} className="input-field" style={{flex: 1}} />
            <button onClick={() => { try { LS.setItem("pan_promptpay_number", promptpayNumber.trim()); alert("PromptPay saved!"); } catch (err) { logError("SETTINGS", err.message, err.stack); alert("❌ " + (err.message || "Failed to save PromptPay")); console.error(err); } }} className="btn btn-primary" style={{padding: "0.5rem 1rem"}}>Save</button>
          </div>
        </div>
      </div>

      {/* Dark Mode */}
      <div style={styles.card}>
        <h3 style={styles.cardHeader}>Appearance</h3>
        <label style={{fontSize: "0.9rem", fontWeight: "600", color: "#1e293b", display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer"}}>
          <input type="checkbox" checked={document.documentElement.getAttribute("data-theme") === "dark"} onChange={(e) => { try { if (e.target.checked) { document.documentElement.setAttribute("data-theme", "dark"); LS.setItem("pan_dark_mode", "true"); } else { document.documentElement.removeAttribute("data-theme"); LS.setItem("pan_dark_mode", "false"); } } catch (err) { logError("SETTINGS", err.message, err.stack); console.error(err); } }} />
          Dark Mode
        </label>
      </div>

      {/* Discount Reasons */}
      <div style={styles.card}>
        <h3 style={styles.cardHeader}>🏷️ Discount Reasons</h3>
        <p style={{fontSize: "0.8rem", color: "#64748b", marginBottom: "0.75rem"}}>Manage predefined reasons for giving discounts.</p>
        {discountReasons.map((r, i) => (
          <div key={i} style={{display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem"}}>
            {editReasonIdx === i ? (
              <>
                <input value={editReasonVal} onChange={e => setEditReasonVal(e.target.value)} className="input-field" style={{flex: 1, fontSize: "0.85rem"}} />
                <button onClick={() => { if (editReasonVal.trim()) { const u = [...discountReasons]; u[i] = editReasonVal.trim(); saveReasons(u); setEditReasonIdx(-1); } }} className="btn btn-primary" style={{padding: "0.3rem 0.6rem", fontSize: "0.75rem"}}>Save</button>
                <button onClick={() => setEditReasonIdx(-1)} className="btn btn-outline" style={{padding: "0.3rem 0.6rem", fontSize: "0.75rem"}}>Cancel</button>
              </>
            ) : (
              <>
                <span style={{flex: 1, fontSize: "0.85rem", color: "#1e293b"}}>• {r}</span>
                <button onClick={() => { setEditReasonIdx(i); setEditReasonVal(r); }} style={{background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: "0.75rem"}}>✎</button>
                <button onClick={() => { saveReasons(discountReasons.filter((_, j) => j !== i)); }} style={{background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: "0.75rem"}}>✕</button>
              </>
            )}
          </div>
        ))}
        <div style={{display: "flex", gap: "0.5rem", marginTop: "0.5rem"}}>
          <input value={newReason} onChange={e => setNewReason(e.target.value)} className="input-field" style={{flex: 1, fontSize: "0.85rem"}} placeholder="New reason..." />
          <button onClick={() => { if (newReason.trim()) { saveReasons([...discountReasons, newReason.trim()]); setNewReason(""); } }} className="btn btn-primary" style={{padding: "0.4rem 0.75rem", fontSize: "0.8rem"}}>Add</button>
        </div>
      </div>

      {/* VAT */}
      <div style={styles.card}>
        <h3 style={styles.cardHeader}>VAT Configuration</h3>
        <p style={{fontSize: "0.8rem", color: "#64748b", marginBottom: "0.75rem"}}>Thailand VAT is 7%. Businesses with annual revenue under 1.8M THB are exempt.</p>
        <label style={{fontSize: "0.9rem", fontWeight: "600", color: "#1e293b", display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", marginBottom: "0.75rem"}}>
          <input type="checkbox" checked={taxEnabled} onChange={e => setTaxEnabled(e.target.checked)} /> Enable VAT
        </label>
        {taxEnabled && <div className="input-group"><label className="input-label">VAT Rate (%)</label><input type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)} className="input-field" style={{maxWidth: "120px"}} min="0" max="100" step="0.5" /></div>}
        <button onClick={handleSaveTaxSettings} className="btn btn-primary" style={{padding: "0.6rem"}}>Save Tax Settings</button>
      </div>

      {/* Firebase */}
      <div style={styles.card}>
        <h3 style={styles.cardHeader}>Cloud Database (Firebase)</h3>
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "0.75rem"}}>
          <span>Current Database:</span>
          <span className={`status-badge ${dbService.isFirebase() ? 'status-online' : 'status-offline'}`}>{dbService.isFirebase() ? '☁️ Cloud Firestore' : '💾 Local Storage'}</span>
        </div>
        <div className="input-group"><label className="input-label">Firebase Web Config (JSON)</label><textarea value={firebaseConfigInput} onChange={e => setFirebaseConfigInput(e.target.value)} className="input-field" style={{fontFamily: "monospace", fontSize: "0.75rem", minHeight: "150px"}} /></div>
        <div style={{display: "flex", gap: "0.5rem"}}>
          <button onClick={handleSaveFirebaseConfig} className="btn btn-primary" style={{flex: 1, padding: "0.6rem"}}>Save & Connect Cloud</button>
          {dbService.isFirebase() && <button onClick={handleClearFirebaseConfig} className="btn btn-danger" style={{flex: 1, padding: "0.6rem"}}>Disconnect Cloud</button>}
        </div>
      </div>

      {/* Error Logs */}
      <div style={styles.card}>
        <h3 style={styles.cardHeader}>⚠️ Error Logs ({errorLogs.length})</h3>
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "0.5rem" }}>
          <button onClick={() => setErrorFilter("All")} style={{ ...styles.pill, ...(errorFilter === "All" ? styles.pillActive : {}) }}>All</button>
          {errorCats.map(c => (
            <button key={c.name} onClick={() => setErrorFilter(c.name)} style={{ ...styles.pill, ...(errorFilter === c.name ? styles.pillActive : {}) }}>
              {c.name} ({c.count})
            </button>
          ))}
        </div>
        {errorLogs.length === 0 ? (
          <div style={{ fontSize: "0.8rem", color: "#94a3b8", textAlign: "center", padding: "0.5rem" }}>✅ No errors</div>
        ) : (
          <div style={{ maxHeight: "250px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            {errorLogs.slice(0, 30).map(e => {
              const sevColor = e.severity === "critical" ? "#dc2626" : e.severity === "error" ? "#ea580c" : "#d97706";
              return (
                <div key={e.id} style={{ padding: "0.4rem", backgroundColor: "#f8fafc", borderRadius: "6px", borderLeft: `3px solid ${sevColor}`, fontSize: "0.7rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 700, color: sevColor, textTransform: "uppercase" }}>{e.severity}</span>
                    <span style={{ color: "#94a3b8" }}>{new Date(e.timestamp).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div style={{ fontWeight: 600, color: "#1e293b", marginTop: "2px" }}>{e.message}</div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
          <button onClick={() => { markAllAsRead(); refreshLogs(); }} className="btn btn-outline" style={{ flex: 1, padding: "0.4rem", fontSize: "0.75rem" }}>Mark All Read</button>
          <button onClick={() => { if (confirm("Clear all logs?")) { clearErrors(); refreshLogs(); } }} className="btn btn-danger" style={{ flex: 1, padding: "0.4rem", fontSize: "0.75rem" }}>Clear</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" },
  subHeader: { display: "flex", alignItems: "center", gap: "0.75rem" },
  subTitle: { fontSize: "1.1rem", fontWeight: "700", color: "#1e293b" },
  backBtn: { background: "none", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "0.4rem 0.75rem", cursor: "pointer", fontSize: "0.85rem", fontWeight: "600", color: "#64748b", fontFamily: "inherit" },
  card: { backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #cbd5e1", padding: "1rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
  cardHeader: { fontSize: "0.95rem", fontWeight: "700", color: "#1e293b", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem", marginBottom: "0.75rem" },
  pill: { padding: "0.2rem 0.5rem", fontSize: "0.65rem", fontWeight: 600, borderRadius: "20px", border: "1px solid #e2e8f0", background: "#ffffff", cursor: "pointer", color: "#475569", fontFamily: "inherit" },
  pillActive: { backgroundColor: "#047857", color: "#ffffff", borderColor: "#047857" },
};
