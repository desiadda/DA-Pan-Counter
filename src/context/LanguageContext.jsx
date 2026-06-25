import { createContext, useContext, useState, useEffect } from "react";
import { LANGUAGES, DEFAULT_LANG, LS_LANG_KEY, t } from "../lang/translations";

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem(LS_LANG_KEY) || DEFAULT_LANG;
  });

  useEffect(() => {
    localStorage.setItem(LS_LANG_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const translate = (key) => t(key, lang);
  const availableLangs = LANGUAGES;

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
