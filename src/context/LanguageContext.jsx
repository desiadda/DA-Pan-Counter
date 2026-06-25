import { createContext, useContext } from "react";
import { useLangStore } from "../stores/langStore";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const translate = useLangStore((s) => s.translate);
  const availableLangs = useLangStore((s) => s.availableLangs);

  return (
    <LanguageContext.Provider value={{ lang, setLang, translate, availableLangs }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function useT() {
  const { translate } = useLanguage();
  return translate;
}
