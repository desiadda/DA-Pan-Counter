import { useState, useEffect, useRef } from "react";

export default function ScanBarcode({ products, onAddToCart }) {
  const [code, setCode] = useState("");
  const [active, setActive] = useState(false);
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "F8") {
        e.preventDefault();
        setActive(true);
        setTimeout(() => inputRef.current?.focus(), 100);
        return;
      }
      if (e.key === "Escape" && active) {
        setActive(false);
        setCode("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;

    const product = products.find(p => p.barcode && p.barcode === trimmed);
    if (product) {
      onAddToCart(product);
      setCode("");
      if (inputRef.current) inputRef.current.focus();
    } else {
      alert(`Product with barcode "${trimmed}" not found.`);
      setCode("");
    }
  };

  return (
    <div style={styles.wrapper}>
      {active ? (
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <span style={styles.icon}>📷</span>
            <input
              ref={inputRef}
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Scan barcode or type & press Enter..."
              style={styles.input}
              autoFocus
              onBlur={() => setTimeout(() => setActive(false), 200)}
            />
            {code && <button type="submit" style={styles.goBtn}>Go</button>}
            <button type="button" onClick={() => { setActive(false); setCode(""); }} style={styles.closeBtn}>✕</button>
          </div>
        </form>
      ) : (
        <button onClick={() => { setActive(true); setTimeout(() => inputRef.current?.focus(), 100); }} style={styles.triggerBtn} title="Scan Barcode (F8)">
          📷 <span style={styles.shortcut}>F8</span>
        </button>
      )}
    </div>
  );
}

const styles = {
  wrapper: {
    display: "flex", alignItems: "center",
  },
  triggerBtn: {
    background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: "8px",
    padding: "0.4rem 0.6rem", cursor: "pointer", fontFamily: "inherit",
    fontSize: "0.8rem", color: "#475569", fontWeight: 600,
    display: "flex", alignItems: "center", gap: "0.35rem",
    transition: "all 0.15s ease",
  },
  shortcut: {
    fontSize: "0.6rem", color: "#94a3b8", fontWeight: 500,
    background: "#f1f5f9", padding: "0 4px", borderRadius: "4px",
  },
  form: {
    width: "100%",
  },
  inputGroup: {
    display: "flex", alignItems: "center", gap: "0.35rem",
    background: "#fff", border: "2px solid #10b981", borderRadius: "10px",
    padding: "0.25rem 0.5rem",
    boxShadow: "0 0 0 3px rgba(16,185,129,0.15)",
  },
  icon: { fontSize: "1rem" },
  input: {
    flex: 1, border: "none", outline: "none", fontFamily: "inherit",
    fontSize: "0.95rem", padding: "0.35rem 0", background: "transparent",
    color: "#1e293b", letterSpacing: "1px",
  },
  goBtn: {
    background: "#047857", color: "#fff", border: "none", borderRadius: "6px",
    padding: "0.3rem 0.6rem", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer",
  },
  closeBtn: {
    background: "none", border: "none", fontSize: "1rem", color: "#94a3b8",
    cursor: "pointer", padding: "0.2rem",
  },
};
