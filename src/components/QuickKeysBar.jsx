import { useState, useEffect } from "react";
import { getLocalData, setLocalData } from "../db/storage";
import { LS_KEYS } from "../constants";

const MAX_SLOTS = 9;

export default function QuickKeysBar({ products, onAddToCart }) {
  const [mappings, setMappings] = useState({});
  const [showAssign, setShowAssign] = useState(null);

  useEffect(() => {
    const saved = getLocalData(LS_KEYS.QUICK_KEYS, {});
    setMappings(saved);
  }, []);

  const saveMapping = (slot, productId, isPack) => {
    const updated = { ...mappings, [slot]: productId ? { productId, isPack: !!isPack } : null };
    if (!productId) delete updated[slot];
    setMappings(updated);
    setLocalData(LS_KEYS.QUICK_KEYS, updated);
  };

  const handleSlotClick = (slot) => {
    const mapping = mappings[slot];
    if (!mapping) return;
    const product = products.find(p => p.id === mapping.productId);
    if (!product) return;
    onAddToCart(product, mapping.isPack ? "pack" : null);
  };

  const handleSlotContext = (e, slot) => {
    e.preventDefault();
    setShowAssign(showAssign === slot ? null : slot);
  };

  const assignProduct = (productId, isPack) => {
    saveMapping(showAssign, productId, isPack);
    setShowAssign(null);
  };

  const clearSlot = () => {
    saveMapping(showAssign, null);
    setShowAssign(null);
  };

  const assignedSlots = Object.keys(mappings).filter(k => mappings[k]).length;

  return (
    <div style={styles.wrapper}>
      {assignedSlots === 0 && (
        <div style={styles.hint}>Right-click a slot to assign a product. Press 1-9 keys for instant add.</div>
      )}
      <div style={styles.grid}>
        {Array.from({ length: MAX_SLOTS }, (_, i) => {
          const slot = `slot${i + 1}`;
          const mapping = mappings[slot];
          const product = mapping ? products.find(p => p.id === mapping.productId) : null;
          return (
            <div key={slot} style={{ position: "relative" }}>
              <button
                style={{
                  ...styles.slotBtn,
                  ...(mapping ? styles.slotFilled : styles.slotEmpty),
                }}
                onClick={() => handleSlotClick(slot)}
                onContextMenu={(e) => handleSlotContext(e, slot)}
                title={product ? `${product.name}${mapping?.isPack ? " (Pack)" : ""} [Key ${i + 1}]` : `Slot ${i + 1} (unassigned)`}
              >
                <span style={styles.slotKey}>{i + 1}</span>
                {product ? (
                  <>
                    <span style={styles.slotName}>{product.name}</span>
                    {mapping?.isPack && <span style={styles.packLabel}>Pack</span>}
                  </>
                ) : (
                  <span style={styles.slotPlaceholder}>+</span>
                )}
              </button>
              {showAssign === slot && (
                <div style={styles.assignPopup}>
                  <div style={styles.assignHeader}>
                    <span style={styles.assignTitle}>Assign Slot {i + 1}</span>
                    <button onClick={clearSlot} style={styles.clearBtn}>Clear</button>
                  </div>
                  <input
                    type="text"
                    placeholder="Search products..."
                    style={styles.assignSearch}
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase();
                      const btns = popupRef?.current?.querySelectorAll("[data-pid]");
                      btns?.forEach(b => {
                        b.style.display = b.textContent.toLowerCase().includes(val) ? "" : "none";
                      });
                    }}
                    autoFocus
                  />
                  <div style={styles.assignList} ref={popupRef}>
                    {products.filter(p => p.stock > 0).map(p => (
                      <div key={p.id}>
                        <button
                          data-pid={p.id}
                          style={styles.assignProductBtn}
                          onClick={() => assignProduct(p.id, false)}
                        >
                          {p.name} (฿{p.sellingPrice})
                        </button>
                        {p.isCigarette && (
                          <button
                            data-pid={p.id}
                            style={{...styles.assignProductBtn, ...styles.assignPackBtn}}
                            onClick={() => assignProduct(p.id, true)}
                          >
                            {p.name} Pack (฿{p.sellingPricePack})
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const popupRef = { current: null };

const styles = {
  wrapper: {
    display: "flex", flexDirection: "column", gap: "0.5rem",
  },
  hint: {
    fontSize: "0.7rem", color: "#94a3b8", textAlign: "center", fontStyle: "italic",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(9, 1fr)",
    gap: "0.35rem",
  },
  slotBtn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "0.4rem 0.2rem",
    borderRadius: "10px",
    border: "1px solid #e2e8f0",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "0.65rem",
    fontWeight: 600,
    minHeight: "56px",
    gap: "0.15rem",
    position: "relative",
    transition: "all 0.15s ease",
  },
  slotFilled: {
    background: "#f0fdf4",
    color: "#065f46",
    borderColor: "#bbf7d0",
  },
  slotEmpty: {
    background: "#f8fafc",
    color: "#94a3b8",
    borderStyle: "dashed",
  },
  slotKey: {
    position: "absolute",
    top: "2px",
    left: "5px",
    fontSize: "0.55rem",
    fontWeight: 800,
    color: "#94a3b8",
    background: "#f1f5f9",
    borderRadius: "4px",
    padding: "0 3px",
  },
  slotName: {
    fontSize: "0.6rem",
    fontWeight: 700,
    lineHeight: 1.2,
    textAlign: "center",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "100%",
  },
  packLabel: {
    fontSize: "0.5rem",
    fontWeight: 700,
    color: "#d97706",
    background: "#fef3c7",
    padding: "0 4px",
    borderRadius: "4px",
  },
  slotPlaceholder: {
    fontSize: "1rem",
    fontWeight: 300,
    color: "#cbd5e1",
  },
  assignPopup: {
    position: "absolute",
    top: "100%",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
    zIndex: 100,
    width: "220px",
    maxHeight: "280px",
    display: "flex",
    flexDirection: "column",
    padding: "0.5rem",
    marginTop: "4px",
  },
  assignHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: "0.25rem",
  },
  assignTitle: { fontSize: "0.75rem", fontWeight: 700, color: "#1e293b" },
  clearBtn: {
    fontSize: "0.65rem", color: "#ef4444", background: "none", border: "none",
    fontWeight: 600, cursor: "pointer",
  },
  assignSearch: {
    padding: "0.4rem", borderRadius: "6px", border: "1px solid #e2e8f0",
    fontSize: "0.75rem", marginBottom: "0.25rem",
  },
  assignList: {
    overflowY: "auto", display: "flex", flexDirection: "column", gap: "2px",
  },
  assignProductBtn: {
    display: "block", width: "100%", textAlign: "left",
    padding: "0.4rem 0.5rem", borderRadius: "6px", border: "none",
    background: "none", fontSize: "0.72rem", fontWeight: 500, color: "#1e293b",
    cursor: "pointer",
  },
  assignPackBtn: {
    fontSize: "0.65rem", color: "#d97706", fontWeight: 600,
    paddingLeft: "1rem",
  },
};
