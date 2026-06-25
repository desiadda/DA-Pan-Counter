import { create } from "zustand"
import { LANGUAGES, DEFAULT_LANG, LS_LANG_KEY, t } from "../lang/translations"

interface LangState {
  lang: string
  setLang: (lang: string) => void
  translate: (key: string) => string
  availableLangs: string[]
}

export const useLangStore = create<LangState>((set, get) => ({
  lang: localStorage.getItem(LS_LANG_KEY) || DEFAULT_LANG,
  availableLangs: LANGUAGES,

  setLang: (lang) => {
    localStorage.setItem(LS_LANG_KEY, lang)
    document.documentElement.lang = lang
    set({ lang })
  },

  translate: (key) => t(key, get().lang),
}))
