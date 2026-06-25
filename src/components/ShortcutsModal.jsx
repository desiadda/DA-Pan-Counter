export default function ShortcutsModal({ onClose }) {
  const groups = [
    {
      title: "POS", items: [
        { key: "1 – 9", desc: "Add assigned Quick Key product to cart" },
        { key: "F8", desc: "Open barcode scanner input" },
        { key: "Esc", desc: "Close barcode scanner / modals" },
      ],
    },
    {
      title: "Navigation", items: [
        { key: "Hash (#)", desc: "pos, inventory, credit, admin — direct URL" },
      ],
    },
    {
      title: "Inventory", items: [
        { key: "Stock / Purchases / Suppliers / Bulk", desc: "Tab toggle between views" },
        { key: "Right-click slot", desc: "Assign product to quick key slot" },
      ],
    },
    {
      title: "Khata / Credit", items: [
        { key: "Customer click", desc: "View ledger & settle payment" },
        { key: "Remind btn", desc: "Send SMS/LINE reminder" },
      ],
    },
  ];

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>⌨️ Keyboard Shortcuts</h3>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>
        <div style={styles.list}>
          {groups.map(g => (
            <div key={g.title} style={styles.group}>
              <h4 style={styles.groupTitle}>{g.title}</h4>
              {g.items.map((item, i) => (
                <div key={i} style={styles.row}>
                  <kbd style={styles.kbd}>{item.key}</kbd>
                  <span style={styles.desc}>{item.desc}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <p style={styles.footer}>Tip: Barcode scanners act as keyboard input — just focus the scan field and scan.</p>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000, padding: "1rem",
  },
  modal: {
    background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "420px",
    padding: "1.25rem", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" },
  title: { fontSize: "1rem", fontWeight: 700, color: "#1e293b", margin: 0 },
  closeBtn: { background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#64748b" },
  list: { display: "flex", flexDirection: "column", gap: "0.75rem" },
  group: {},
  groupTitle: { fontSize: "0.75rem", fontWeight: 700, color: "#047857", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "0.35rem" },
  row: { display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.25rem 0" },
  kbd: {
    display: "inline-block", padding: "0.15rem 0.4rem", fontSize: "0.7rem", fontWeight: 700,
    background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "4px",
    fontFamily: "monospace", color: "#1e293b", minWidth: "60px", textAlign: "center",
  },
  desc: { fontSize: "0.82rem", color: "#475569", flex: 1 },
  footer: { fontSize: "0.7rem", color: "#94a3b8", marginTop: "0.75rem", fontStyle: "italic", textAlign: "center" },
};
