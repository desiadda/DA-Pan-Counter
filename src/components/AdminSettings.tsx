import { useState, useEffect } from "react";
import { dbService } from "../firebase";
import { sha256 } from "../db/hash";
import { useConfirmStore } from "../stores/confirmStore";
import { useUIStore } from "../stores/uiStore";
import { useLangStore } from "../stores/langStore";
import { getErrors, getCategories, markAllAsRead, clearErrors } from "../db/errorLog";
import { logError } from "../db/errorLog";
import { useDBStore } from "../stores/dbStore";
import { useAuthStore } from "../stores/authStore";
import { getUsers } from "../db/auth";
import { db, isFirebaseEnabled } from "../db/config";
import { writeBatch, doc } from "firebase/firestore";

const LS = localStorage;

const getStore = () => {
  try {
    const raw = LS.getItem("pan_store_settings");
    return raw ? JSON.parse(raw) : { name: "Paan Counter", address: "", phone: "", taxId: "", logo: "" };
  } catch (err: any) {
    logError("SETTINGS", err.message, err.stack);
    console.error(err);
    return { name: "Paan Counter", address: "", phone: "", taxId: "", logo: "" };
  }
};

export default function AdminSettings({ onBack }) {
  const lang = useLangStore((s) => s.lang);
  const confirm = useConfirmStore((s) => s.confirm);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const paymentModes = useDBStore((s) => s.paymentModes);
  const user = useAuthStore((s) => s.user);

  // DB Data for Backup
  const products = useDBStore((s) => s.products);
  const transactions = useDBStore((s) => s.transactions);
  const customers = useDBStore((s) => s.customers);

  const [activeTab, setActiveTab] = useState("general"); // general, payments, security, database
  const [isRestoring, setIsRestoring] = useState(false);
  const [resetConfirmPin, setResetConfirmPin] = useState("");
  const [resetStep, setResetStep] = useState(0); // 0=idle, 1=typed-confirm, 2=executing
  const [resetTyped, setResetTyped] = useState("");
  const [resetError, setResetError] = useState("");

  // Step 1: verify secret password
  const handleResetStep1 = async () => {
    setResetError("");
    if (user && user.permissions && !user.permissions.settingsReset) {
      setResetError("❌ You do not have permission to perform a Factory Reset.");
      return;
    }
    try {
      const inputHash = await sha256(resetConfirmPin.trim());
      const masterHash = "956bea7e18228cf06bd92f62abf36bebfca5a608f43af333fec57a719774653d";
      if (inputHash !== masterHash) {
        setResetError("❌ Invalid Secret Reset Password! Please try again.");
        return;
      }
      setResetStep(1);
      setResetTyped("");
    } catch (err: any) {
      setResetError("Error: " + err.message);
    }
  };

  // Step 2: typed confirmation → execute
  const handleResetExecute = async () => {
    setResetError("");
    if (resetTyped !== "RESET") {
      setResetError("❌ Please type RESET exactly to confirm.");
      return;
    }
    try {
      setResetStep(2);
      setIsRestoring(true);
      await (dbService as any).factoryReset();
      alert("✅ App successfully reset to factory settings! Reloading...");
      window.location.reload();
    } catch (err: any) {
      logError("SYSTEM", err.message, err.stack);
      setResetError("Failed to reset: " + err.message);
      setResetStep(1);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleResetCancel = () => {
    setResetStep(0);
    setResetConfirmPin("");
    setResetTyped("");
    setResetError("");
  };

  const handleExportBackup = () => {
    try {
      const backupData = { products, transactions, customers, exportDate: Date.now(), version: "1.0.0" };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `paan_pos_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err: any) {
      logError("SETTINGS", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to export backup"));
      console.error(err);
    }
  };

  const restoreToFirestore = async (collectionName, items) => {
    let batch = writeBatch(db);
    let count = 0;
    for (const item of items) {
      const { id, ...data } = item;
      const ref = doc(db, collectionName, id);
      batch.set(ref, data);
      count++;
      if (count === 500) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }
    if (count > 0) {
      await batch.commit();
    }
  };

  const handleImportBackup = (e) => {
    const fileReader = new FileReader();
    const file = e.target.files[0];
    if (!file) return;
    fileReader.onload = async (event: any) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.products && parsed.transactions) {
          const ok = await confirm(
            isFirebaseEnabled
              ? "Do you want to restore this backup? This will overwrite your Cloud Firestore database."
              : "Do you want to restore this backup? This will overwrite the local database.",
            { title: "Restore Backup", confirmLabel: "Restore", variant: "danger" }
          );
          if (ok) {
            setIsRestoring(true);
            if (isFirebaseEnabled && db) {
              if (parsed.products) await restoreToFirestore("products", parsed.products);
              if (parsed.transactions) await restoreToFirestore("transactions", parsed.transactions);
              if (parsed.customers) await restoreToFirestore("customers", parsed.customers);
            } else {
              localStorage.setItem("pan_products", JSON.stringify(parsed.products));
              localStorage.setItem("pan_transactions", JSON.stringify(parsed.transactions));
              if (parsed.customers) localStorage.setItem("pan_customers", JSON.stringify(parsed.customers));
            }
            alert("Database successfully restored!");
          }
        } else {
          alert("Invalid backup file format!");
        }
      } catch (err: any) {
        logError("SETTINGS", err.message, err.stack);
        alert("Failed to restore backup: " + err.message);
      } finally {
        setIsRestoring(false);
      }
    };
    fileReader.readAsText(file);
  };

  // Store
  const [store, setStore] = useState(getStore);

  // PIN management is handled entirely in User Management (UserManager)

  // PromptPay
  const [promptpayNumber, setPromptpayNumber] = useState(LS.getItem("pan_promptpay_number") || "0912345678");

  // VAT
  const [taxEnabled, setTaxEnabled] = useState(LS.getItem("pan_tax_enabled") === "true");
  const [taxRate, setTaxRate] = useState(LS.getItem("pan_tax_rate") || "7");

  // Firebase
  const [firebaseConfigInput, setFirebaseConfigInput] = useState(JSON.stringify(dbService.getConfig(), null, 2));

  // Payment Mode
  const [newModeName, setNewModeName] = useState("");
  const [editingModeId, setEditingModeId] = useState<string | null>(null);
  const [editingModeNameVal, setEditingModeNameVal] = useState("");

  // Discount reasons
  const [discountReasons, setDiscountReasons] = useState(() => {
    try {
      const raw = LS.getItem("pan_discount_reasons");
      return raw ? JSON.parse(raw) : ["Loyalty Discount", "Festival Offer", "Damaged Product", "Bulk Purchase", "Staff Discount"];
    } catch (err: any) {
      logError("SETTINGS", err.message, err.stack);
      console.error(err);
      return ["Loyalty Discount", "Festival Offer", "Damaged Product", "Bulk Purchase", "Staff Discount"];
    }
  });
  const [newReason, setNewReason] = useState("");
  const [editReasonIdx, setEditReasonIdx] = useState(-1);
  const [editReasonVal, setEditReasonVal] = useState("");

  const saveReasons = (list) => { try { LS.setItem("pan_discount_reasons", JSON.stringify(list)); setDiscountReasons(list); } catch (err: any) { logError("SETTINGS", err.message, err.stack); alert("❌ " + (err.message || "Failed to save discount reasons")); console.error(err); } };

  // Error logs
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [errorFilter, setErrorFilter] = useState("All");
  const refreshLogs = () => setErrorLogs(getErrors(errorFilter));
  useEffect(() => { refreshLogs(); window.addEventListener("error-logged", refreshLogs); return () => window.removeEventListener("error-logged", refreshLogs); }, [errorFilter]);
  const errorCats = getCategories();

  const handleSaveStore = () => {
    try {
      const str = JSON.stringify(store);
      if (str.length > 4_500_000) { alert("Logo image too large! Please use a smaller image (under ~4.5MB)."); return; }
      LS.setItem("pan_store_settings", str);
      const link = document.querySelector("link[rel~='icon']");
      if (link) link.href = store.logo;
      alert("Store details saved!");
    } catch (e: any) {
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
    } catch (err: any) {
      logError("SETTINGS", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to save tax settings"));
      console.error(err);
    }
  };

  const handleSaveFirebaseConfig = () => {
    try { const parsed = JSON.parse(firebaseConfigInput); dbService.saveConfig(parsed); alert("Firebase Config updated! Refreshing..."); }
    catch (e: any) { logError("SETTINGS", e.message, e.stack); alert("Invalid JSON format!"); }
  };
  const handleClearFirebaseConfig = async () => {
    try {
      const ok = await confirm("Delete Firebase credentials? App will revert to LocalStorage.", { title: "Disconnect Cloud", confirmLabel: "Disconnect", variant: "danger" });
      if (ok) dbService.clearConfig();
    } catch (err: any) {
      logError("SETTINGS", err.message, err.stack);
      alert("❌ " + (err.message || "Failed to disconnect cloud"));
      console.error(err);
    }
  };

  const tabs = [
    { key: "general", label: "🏪 General" },
    { key: "payments", label: "💳 Payments" },
    { key: "security", label: "🔒 Security" },
    { key: "database", label: "💾 Database" }
  ];

  return (
    <div style={styles.container}>
      <div style={styles.subHeader}>
        <button onClick={onBack} style={styles.backBtn}>← Back</button>
        <h3 style={styles.subTitle}>Settings</h3>
      </div>

      {/* Tabs */}
      <div className="reports-subtabs" style={styles.subTabs}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{...styles.subTab, ...(activeTab === t.key ? styles.activeSubTab : {})}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content: General ── */}
      {activeTab === "general" && (
        <div style={{display: "flex", flexDirection: "column", gap: "1rem"}}>
          {/* Store */}
          <div style={styles.card}>
            <h3 style={styles.cardHeader}>🏪 Store Details</h3>
            <div className="input-group"><label className="input-label">Store Name</label><input type="text" value={store.name} onChange={e => setStore({...store, name: e.target.value})} className="input-field" /></div>
            <div className="input-group"><label className="input-label">Address</label><textarea value={store.address} onChange={e => setStore({...store, address: e.target.value})} className="input-field" rows={2} /></div>
            <div className="input-group"><label className="input-label">Phone</label><input type="text" value={store.phone} onChange={e => setStore({...store, phone: e.target.value})} className="input-field" /></div>
            <div className="input-group"><label className="input-label">Tax ID</label><input type="text" value={store.taxId} onChange={e => setStore({...store, taxId: e.target.value})} className="input-field" /></div>
            <div className="input-group">
              <label className="input-label">Store Logo</label>
              <input type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = (ev: any) => setStore({...store, logo: ev.target.result}); reader.readAsDataURL(file); }} />
              {store.logo && <div style={{marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem"}}><img src={store.logo} alt="Logo" style={{height: "48px", borderRadius: "8px", objectFit: "contain"}} /><button onClick={() => setStore({...store, logo: ""})} className="btn btn-outline" style={{padding: "0.2rem 0.5rem", fontSize: "0.75rem"}}>Remove</button></div>}
            </div>
            <button onClick={handleSaveStore} className="btn btn-primary" style={{padding: "0.6rem", width: "100%"}}>Save Store Details</button>
          </div>

          {/* Dark Mode */}
          <div style={styles.card}>
            <h3 style={styles.cardHeader}>Appearance</h3>
            <label style={{fontSize: "0.9rem", fontWeight: "600", color: "var(--text)", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer"}}>
              <span>Dark Mode</span>
              <label className="switch">
                <input type="checkbox" checked={theme === "dark"} onChange={toggleTheme} />
                <span className="slider"></span>
              </label>
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
                    <span style={{flex: 1, fontSize: "0.85rem", color: "var(--text)"}}>• {r}</span>
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
        </div>
      )}

      {/* ── Tab Content: Payments ── */}
      {activeTab === "payments" && (
        <div style={{display: "flex", flexDirection: "column", gap: "1rem"}}>
          {/* Payment Modes */}
          <div style={styles.card}>
            <h3 style={styles.cardHeader}>💳 Payment Modes</h3>
            <p style={{fontSize: "0.8rem", color: "#64748b", marginBottom: "0.75rem"}}>
              Toggle, add, upload QR code images, or delete payment modes.
            </p>
            <div style={{display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem"}}>
              {paymentModes.map((mode) => (
                <div key={mode.id} style={{display: "flex", flexDirection: "column", padding: "0.75rem", backgroundColor: "var(--bg-hover, #f8fafc)", borderRadius: "8px", border: "1px solid var(--border)", gap: "0.5rem"}}>
                  <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                    <div>
                      {editingModeId === mode.id ? (
                        <div style={{display: "flex", gap: "0.25rem", alignItems: "center"}}>
                          <input
                            type="text"
                            value={editingModeNameVal}
                            onChange={(e) => setEditingModeNameVal(e.target.value)}
                            className="input-field"
                            style={{padding: "2px 6px", fontSize: "0.8rem", width: "120px"}}
                          />
                          <button
                            onClick={async () => {
                              const trimmed = editingModeNameVal.trim();
                              if (!trimmed) return;
                              await dbService.savePaymentMode({ ...mode, name: trimmed });
                              setEditingModeId(null);
                            }}
                            className="btn btn-primary"
                            style={{padding: "2px 6px", fontSize: "0.75rem"}}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingModeId(null)}
                            className="btn btn-outline"
                            style={{padding: "2px 6px", fontSize: "0.75rem"}}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{display: "flex", alignItems: "center", gap: "0.35rem"}}>
                          <span style={{fontWeight: "bold", color: "var(--text)"}}>{mode.name}</span>
                          {!mode.isSystem && (
                            <button
                              onClick={() => {
                                setEditingModeId(mode.id);
                                setEditingModeNameVal(mode.name);
                              }}
                              className="btn btn-outline"
                              style={{padding: "2px 6px", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.25rem"}}
                              title="Rename Payment Mode"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: "12px", height: "12px"}}>
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/>
                              </svg>
                              Rename
                            </button>
                          )}
                          {mode.isSystem && <span style={{fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "0.5rem"}}>(System Mode)</span>}
                        </div>
                      )}
                    </div>
                    <div style={{display: "flex", gap: "0.5rem", alignItems: "center"}}>
                      <label style={{fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", color: "var(--text)"}}>
                        <span>Enabled</span>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={mode.enabled}
                            disabled={mode.id === "Cash" || mode.id === "Udhaar"}
                            onChange={async (e) => {
                              await dbService.savePaymentMode({ ...mode, enabled: e.target.checked });
                            }}
                          />
                          <span className="slider"></span>
                        </label>
                      </label>
                      {!mode.isSystem && (
                        <button
                          onClick={async () => {
                            if (window.confirm(`Are you sure you want to delete ${mode.name}?`)) {
                              await dbService.deletePaymentMode(mode.id);
                            }
                          }}
                          className="btn btn-outline"
                          style={{padding: "2px 6px", fontSize: "0.7rem", color: "#dc2626", borderColor: "#dc2626"}}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{display: "flex", alignItems: "center", gap: "1rem"}}>
                    <div style={{flex: 1}}>
                      <label className="qr-upload-zone">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: "20px", height: "20px", color: "var(--text-muted)"}}>
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                        </svg>
                        <span style={{fontSize: "0.8rem", fontWeight: "600", color: "var(--text-muted)"}}>
                          {mode.qrCode ? "Replace QR Image" : "Upload QR Code Image"}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = async (ev: any) => {
                              const base64 = ev.target?.result as string;
                              if (base64.length > 3_000_000) {
                                alert("QR Image is too large! Please use a smaller file under ~3MB.");
                                return;
                              }
                              await dbService.savePaymentMode({ ...mode, qrCode: base64 });
                              alert("QR Code updated successfully!");
                            };
                            reader.readAsDataURL(file);
                          }}
                          style={{display: "none"}}
                        />
                      </label>
                    </div>
                    {mode.qrCode && (
                      <div style={{display: "flex", alignItems: "center", gap: "0.25rem"}}>
                        <img src={mode.qrCode} alt="QR Preview" style={{width: "40px", height: "40px", objectFit: "contain", border: "1px solid var(--border)", borderRadius: "4px"}} />
                        <button
                          onClick={async () => {
                            await dbService.savePaymentMode({ ...mode, qrCode: "" });
                          }}
                          style={{border: "none", background: "none", color: "#dc2626", cursor: "pointer", fontSize: "0.75rem"}}
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add Payment Mode Form */}
            <div style={{padding: "0.75rem", backgroundColor: "#eff6ff", borderRadius: "8px", border: "1px solid #bfdbfe", display: "flex", flexDirection: "column", gap: "0.5rem"}}>
              <h4 style={{fontSize: "0.85rem", fontWeight: "bold", color: "#1e40af", margin: 0}}>Add Custom Payment Mode</h4>
              <div style={{display: "flex", gap: "0.5rem"}}>
                <input
                  type="text"
                  placeholder="e.g. GPay, Card, Gulla..."
                  value={newModeName}
                  onChange={(e) => setNewModeName(e.target.value)}
                  className="input-field"
                  style={{flex: 1, fontSize: "0.8rem", padding: "0.4rem"}}
                />
                <button
                  onClick={async () => {
                    const name = newModeName.trim();
                    if (!name) return;
                    const id = name.replace(/\s+/g, '_').toLowerCase();
                    if (paymentModes.some((m: any) => m.id === id || m.name.toLowerCase() === name.toLowerCase())) {
                      alert("A payment mode with this name already exists.");
                      return;
                    }
                    const newMode = {
                      id,
                      name,
                      qrCode: "",
                      isSystem: false,
                      enabled: true
                    };
                    await dbService.savePaymentMode(newMode);
                    setNewModeName("");
                    alert("Payment mode added!");
                  }}
                  className="btn btn-primary"
                  style={{padding: "0.4rem 0.8rem", fontSize: "0.8rem"}}
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* PromptPay */}
          <div style={styles.card}>
            <h3 style={styles.cardHeader}>Merchant Payment</h3>
            <div className="input-group">
              <label className="input-label">PromptPay Phone / Tax ID</label>
              <div style={{display: "flex", gap: "0.5rem"}}>
                <input type="text" value={promptpayNumber} onChange={e => setPromptpayNumber(e.target.value)} className="input-field" style={{flex: 1}} />
                <button onClick={() => { try { LS.setItem("pan_promptpay_number", promptpayNumber.trim()); alert("PromptPay saved!"); } catch (err: any) { logError("SETTINGS", err.message, err.stack); alert("❌ " + (err.message || "Failed to save PromptPay")); console.error(err); } }} className="btn btn-primary" style={{padding: "0.5rem 1rem"}}>Save</button>
              </div>
            </div>
          </div>

          {/* VAT */}
          <div style={styles.card}>
            <h3 style={styles.cardHeader}>VAT Configuration</h3>
            <p style={{fontSize: "0.8rem", color: "#64748b", marginBottom: "0.75rem"}}>Thailand VAT is 7%. Businesses with annual revenue under 1.8M THB are exempt.</p>
            <label style={{fontSize: "0.9rem", fontWeight: "600", color: "var(--text)", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", marginBottom: "0.75rem"}}>
              <span>Enable VAT</span>
              <label className="switch">
                <input type="checkbox" checked={taxEnabled} onChange={e => setTaxEnabled(e.target.checked)} />
                <span className="slider"></span>
              </label>
            </label>
            {taxEnabled && <div className="input-group"><label className="input-label">VAT Rate (%)</label><input type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)} className="input-field" style={{maxWidth: "120px"}} min="0" max="100" step="0.5" /></div>}
            <button onClick={handleSaveTaxSettings} className="btn btn-primary" style={{padding: "0.6rem", width: "100%"}}>Save Tax Settings</button>
          </div>
        </div>
      )}

      {/* ── Tab Content: Security ── */}
      {activeTab === "security" && (
        <div style={{display: "flex", flexDirection: "column", gap: "1rem"}}>
          {/* PIN managed in User Management */}
          <div style={styles.card}>
            <h3 style={styles.cardHeader}>🔐 User PINs</h3>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "0.25rem 0" }}>
              <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>ℹ️</span>
              <div>
                <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text)", margin: 0 }}>PINs are managed in User Management</p>
                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "0.3rem", lineHeight: 1.5 }}>
                  Each user has their own individual PIN. To set or change a PIN, go to
                  <strong> Menu → Users</strong> and click <strong>Edit</strong> on any user.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab Content: Database ── */}
      {activeTab === "database" && (
        <div style={{display: "flex", flexDirection: "column", gap: "1rem"}}>
          {/* Firebase */}
          <div style={styles.card}>
            <h3 style={styles.cardHeader}>Cloud Database (Firebase)</h3>
            <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "0.75rem"}}>
              <span style={{color: "var(--text)"}}>Current Database:</span>
              <span className={`status-badge ${dbService.isFirebase() ? 'status-online' : 'status-offline'}`}>{dbService.isFirebase() ? '☁️ Cloud Firestore' : '💾 Local Storage'}</span>
            </div>
            <div className="input-group"><label className="input-label">Firebase Web Config (JSON)</label><textarea value={firebaseConfigInput} onChange={e => setFirebaseConfigInput(e.target.value)} className="input-field" style={{fontFamily: "monospace", fontSize: "0.75rem", minHeight: "150px"}} /></div>
            <div style={{display: "flex", gap: "0.5rem"}}>
              <button onClick={handleSaveFirebaseConfig} className="btn btn-primary" style={{flex: 1, padding: "0.6rem"}}>Save & Connect Cloud</button>
              {dbService.isFirebase() && <button onClick={handleClearFirebaseConfig} className="btn btn-danger" style={{flex: 1, padding: "0.6rem"}}>Disconnect Cloud</button>}
            </div>
          </div>

          {/* Backup & Restore */}
          <div style={styles.card}>
            <h3 style={styles.cardHeader}>💾 Backup & Restore</h3>
            <p style={{fontSize: "0.8rem", color: "#64748b", marginBottom: "1rem"}}>Download current shop data as a JSON file or import a backup file to restore records.</p>
            {isRestoring && <div style={{ fontSize: "0.85rem", color: "#047857", fontWeight: "bold", marginBottom: "0.5rem" }}>🔄 Restoring backup, please wait...</div>}
            <div style={{display: "flex", gap: "0.5rem"}}>
              <button onClick={handleExportBackup} className="btn btn-outline" style={{flex: 1, padding: "0.5rem"}}>📥 Export Backup</button>
              <label className="btn btn-outline" style={{flex: 1, padding: "0.5rem", textAlign: "center", cursor: "pointer", display: "flex", alignItems: "center", justifyViewport: "center", justifyContent: "center"}}>
                📤 Import Restore
                <input type="file" accept=".json" onChange={handleImportBackup} style={{display: "none"}} />
              </label>
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
                    <div key={e.id} style={{ padding: "0.4rem", backgroundColor: "var(--bg-hover, #f8fafc)", borderRadius: "6px", borderLeft: `3px solid ${sevColor}`, fontSize: "0.7rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontWeight: 700, color: sevColor, textTransform: "uppercase" }}>{e.severity}</span>
                        <span style={{ color: "#94a3b8" }}>{new Date(e.timestamp).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <div style={{ fontWeight: 600, color: "var(--text)", marginTop: "2px" }}>{e.message}</div>
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

          {/* Factory Reset */}
          <div style={{ ...styles.card, border: "1px solid #fee2e2", backgroundColor: theme === "dark" ? "#2d1515" : "#fff5f5" }}>
            <h3 style={{ ...styles.cardHeader, color: "#991b1b", borderBottom: "1px solid #fee2e2" }}>
              {lang === "hi" ? "🚨 फ़ैक्टरी रीसेट" : "🚨 Factory Reset"}
            </h3>
            <p style={{ fontSize: "0.8rem", color: "#b91c1c", marginBottom: "1rem", fontWeight: "600", lineHeight: 1.5 }}>
              ⚠️ Warning: This will permanently delete ALL transactions, products, stock history, credit accounts, suppliers, and expenses. This cannot be undone.
            </p>

            {resetError && (
              <div style={{ background: "#fee2e2", color: "#991b1b", padding: "0.5rem 0.75rem", borderRadius: "6px", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.75rem" }}>
                {resetError}
              </div>
            )}

            {/* Step 0: Enter secret password */}
            {resetStep === 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "#991b1b" }}>Step 1 of 2 — Enter Secret Reset Password</label>
                <input
                  type="password"
                  placeholder="Secret password..."
                  value={resetConfirmPin}
                  onChange={e => { setResetConfirmPin(e.target.value); setResetError(""); }}
                  onKeyDown={e => e.key === "Enter" && resetConfirmPin && handleResetStep1()}
                  className="input-field"
                  style={{ maxWidth: "260px", fontSize: "0.85rem" }}
                />
                <button
                  onClick={handleResetStep1}
                  disabled={!resetConfirmPin}
                  className="btn btn-danger"
                  style={{ alignSelf: "flex-start", opacity: !resetConfirmPin ? 0.5 : 1 }}
                >
                  Verify Password →
                </button>
              </div>
            )}

            {/* Step 1: Type RESET to confirm */}
            {resetStep === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "8px", padding: "0.75rem", marginBottom: "0.25rem" }}>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#7f1d1d", fontWeight: 700 }}>✅ Password verified. Final confirmation required.</p>
                  <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "#991b1b" }}>Type <strong>RESET</strong> below to permanently delete all data:</p>
                </div>
                <input
                  type="text"
                  placeholder='Type RESET here...'
                  value={resetTyped}
                  onChange={e => { setResetTyped(e.target.value); setResetError(""); }}
                  onKeyDown={e => e.key === "Enter" && resetTyped === "RESET" && handleResetExecute()}
                  className="input-field"
                  style={{ maxWidth: "260px", fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.1em" }}
                  autoFocus
                />
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    onClick={handleResetExecute}
                    disabled={resetTyped !== "RESET" || isRestoring}
                    className="btn btn-danger"
                    style={{ opacity: resetTyped !== "RESET" ? 0.5 : 1 }}
                  >
                    {isRestoring ? "⏳ Resetting..." : "🗑️ DELETE EVERYTHING"}
                  </button>
                  <button onClick={handleResetCancel} className="btn btn-outline" disabled={isRestoring}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Executing */}
            {resetStep === 2 && (
              <div style={{ textAlign: "center", padding: "1rem", color: "#991b1b", fontWeight: 700 }}>
                ⏳ Performing factory reset... Please wait.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" },
  subHeader: { display: "flex", alignItems: "center", gap: "0.75rem" },
  subTitle: { fontSize: "1.1rem", fontWeight: "700", color: "var(--text)" },
  backBtn: { background: "none", border: "1px solid var(--border)", borderRadius: "8px", padding: "0.4rem 0.75rem", cursor: "pointer", fontSize: "0.85rem", fontWeight: "600", color: "var(--text-muted)", fontFamily: "inherit" },
  card: { backgroundColor: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border)", padding: "1rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
  cardHeader: { fontSize: "0.95rem", fontWeight: "700", color: "var(--text)", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", marginBottom: "0.75rem" },
  pill: { padding: "0.2rem 0.5rem", fontSize: "0.65rem", fontWeight: 600, borderRadius: "20px", border: "1px solid var(--border)", background: "var(--bg-card)", cursor: "pointer", color: "var(--text-muted)", fontFamily: "inherit" },
  pillActive: { backgroundColor: "#047857", color: "#ffffff", borderColor: "#047857" },
  subTabs: { display: "flex", gap: "4px", overflowX: "auto" as const, paddingBottom: "4px", flexShrink: 0, scrollbarWidth: "none" as const },
  subTab: { flexShrink: 0, padding: "0.5rem 0.75rem", fontSize: "0.8rem", fontWeight: "600", color: "var(--text-muted)", background: "var(--bg-hover, #f1f5f9)", border: "none", borderRadius: "8px", cursor: "pointer", transition: "all 0.2s ease", whiteSpace: "nowrap" as const },
  activeSubTab: { backgroundColor: "#047857", color: "#ffffff" },
};
