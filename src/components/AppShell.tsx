import { getPlatform } from "../platform";

export default function AppShell({ children }) {
  const platform = getPlatform();
  return (
    <div id="app-shell" data-platform={platform}>
      {children}
      <div id="app-modal-layer" />
    </div>
  );
}
