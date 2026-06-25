export function SkeletonCard({ count = 6 }) {
  return (
    <div style={gridStyle}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={cardStyle}>
          <div style={{ ...barStyle, width: "40%", height: "10px" }} />
          <div style={{ ...barStyle, width: "70%", height: "14px", marginTop: "12px" }} />
          <div style={{ ...barStyle, width: "30%", height: "18px", marginTop: "8px" }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ ...barStyle, width: "35%", height: "14px" }} />
          <div style={{ ...barStyle, width: "15%", height: "14px" }} />
          <div style={{ ...barStyle, width: "15%", height: "14px" }} />
          <div style={{ ...barStyle, width: "20%", height: "14px" }} />
          <div style={{ ...barStyle, width: "15%", height: "14px" }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({ rows = 4 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ ...cardStyle, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ ...barStyle, width: "120px", height: "14px" }} />
            <div style={{ ...barStyle, width: "80px", height: "10px", marginTop: "6px" }} />
          </div>
          <div style={{ ...barStyle, width: "60px", height: "16px" }} />
        </div>
      ))}
    </div>
  );
}

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
  gap: "0.75rem",
};

const cardStyle = {
  backgroundColor: "var(--card-bg)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  padding: "0.75rem",
  minHeight: "160px",
};

const barStyle = {
  backgroundColor: "var(--border)",
  borderRadius: "4px",
  animation: "pulse 1.5s ease-in-out infinite",
};

const styleId = "skeleton-keyframes";
if (!document.getElementById(styleId)) {
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }`;
  document.head.appendChild(style);
}
