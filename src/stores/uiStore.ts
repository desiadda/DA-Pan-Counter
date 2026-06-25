import { create } from "zustand"

interface UIState {
  theme: "light" | "dark"
  showCOH: boolean
  showShift: boolean
  toggleTheme: () => void
  setShowCOH: (v: boolean) => void
  setShowShift: (v: boolean) => void
}

export const useUIStore = create<UIState>((set, get) => ({
  theme: (localStorage.getItem("pan_theme") as "light" | "dark") || "light",
  showCOH: false,
  showShift: false,

  toggleTheme: () => {
    const next = get().theme === "light" ? "dark" : "light"
    localStorage.setItem("pan_theme", next)
    document.documentElement.setAttribute("data-theme", next)
    document.documentElement.classList.toggle("dark", next === "dark")
    set({ theme: next })
  },

  setShowCOH: (v) => set({ showCOH: v }),
  setShowShift: (v) => set({ showShift: v }),
}))
