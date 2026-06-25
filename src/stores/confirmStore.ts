import { create } from "zustand"

interface ConfirmState {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  variant: "default" | "danger"
  resolve: ((v: boolean) => void) | null
  confirm: (message: string, options?: Partial<Omit<ConfirmState, "open" | "resolve" | "confirm">>) => Promise<boolean>
  handleConfirm: () => void
  handleCancel: () => void
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  title: "",
  message: "",
  confirmLabel: "Confirm",
  cancelLabel: "Cancel",
  variant: "default",
  resolve: null,

  confirm: (message, options = {}) =>
    new Promise((resolve) => {
      set({
        open: true,
        message,
        title: options.title || "",
        confirmLabel: options.confirmLabel || "Confirm",
        cancelLabel: options.cancelLabel || "Cancel",
        variant: options.variant || "default",
        resolve,
      })
    }),

  handleConfirm: () => {
    const { resolve } = get()
    resolve?.(true)
    set({ open: false, resolve: null })
  },

  handleCancel: () => {
    const { resolve } = get()
    resolve?.(false)
    set({ open: false, resolve: null })
  },
}))
