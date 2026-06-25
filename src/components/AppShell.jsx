import { getPlatform } from "../platform";

export default function AppShell({ children }) {
  const platform = getPlatform();
  return (
    <div id="app-shell" data-platform={platform} style={{
      position: "fixed", inset: 0,
      display: "flex", flexDirection: "column",
    }}>
      {children}
      <div id="app-modal-layer" style={{
        position: "absolute", inset: 0,
        pointerEvents: "none",
        zIndex: 9999,
      }} />
    </div>
  );
}
