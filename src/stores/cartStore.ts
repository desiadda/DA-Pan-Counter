import { create } from "zustand"

interface CartItem {
  productId: string
  name: string
  sellingPrice: number
  quantity: number
  isPack?: boolean
  packSize?: number
  sellingPricePack?: number
}

interface CartState {
  cart: CartItem[]
  mobileCartOpen: boolean
  mobileCartProps: Record<string, any> | null
  addItem: (item: Omit<CartItem, "quantity">) => void
  updateQty: (productId: string, delta: number) => void
  clear: () => void
  subtotal: () => number
  total: (taxEnabled: boolean, taxRate: number, discountAmount: number) => number
  openMobileCart: (props: Record<string, any>, onCheckout?: () => void) => void
  closeMobileCart: () => void
  handleCheckout: () => void
}

export const useCartStore = create<CartState>((set, get) => ({
  cart: [],
  mobileCartOpen: false,
  mobileCartProps: null,

  addItem: (item) => {
    const { cart } = get()
    const existing = cart.find((i) => i.productId === item.productId)
    if (existing) {
      set({
        cart: cart.map((i) =>
          i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i
        ),
      })
    } else {
      set({ cart: [...cart, { ...item, quantity: 1 }] })
    }
  },

  updateQty: (productId, delta) => {
    const { cart } = get()
    const newCart = cart
      .map((i) =>
        i.productId === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i
      )
      .filter((i) => i.quantity > 0)
    set({ cart: newCart })
  },

  clear: () => set({ cart: [] }),

  subtotal: () => get().cart.reduce((s, i) => s + i.sellingPrice * i.quantity, 0),

  total: (taxEnabled, taxRate, discountAmount) => {
    const sub = get().subtotal()
    const tax = taxEnabled ? sub * (taxRate / 100) : 0
    return sub + tax - discountAmount
  },

  openMobileCart: (props, onCheckout) => {
    set({ mobileCartOpen: true, mobileCartProps: props })
    if (onCheckout) window.__mobileCartCheckout = onCheckout
  },

  closeMobileCart: () => {
    set({ mobileCartOpen: false, mobileCartProps: null })
    delete window.__mobileCartCheckout
  },

  handleCheckout: () => {
    window.__mobileCartCheckout?.()
    set({ mobileCartOpen: false, mobileCartProps: null })
    delete window.__mobileCartCheckout
  },
}))
