import { useLangStore } from "../stores/langStore";

export default function LanguageSwitcher() {
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const availableLangs = useLangStore((s) => s.availableLangs);

  return (
    <div style={styles.wrapper} className="lang-switcher">
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        style={styles.select}
        title="Change Language"
      >
        {availableLangs.map(l => (
          <option key={l.code} value={l.code}>{l.nativeLabel}</option>
        ))}
      </select>
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", alignItems: "center" },
  select: {
    padding: "0.2rem 0.4rem", borderRadius: "6px", border: "1px solid #e2e8f0",
    fontSize: "0.7rem", fontWeight: 600, background: "#f8fafc", color: "#475569",
    cursor: "pointer", fontFamily: "inherit",
  },
};
