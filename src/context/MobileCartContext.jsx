import { createContext, useContext } from "react";
import { useCartStore } from "../stores/cartStore";

const MobileCartContext = createContext(null);

export function MobileCartProvider({ children }) {
  const cart = useCartStore((s) => s.cart);
  const addItem = useCartStore((s) => s.addItem);
  const updateQty = useCartStore((s) => s.updateQty);
  const clear = useCartStore((s) => s.clear);
  const subtotal = useCartStore((s) => s.subtotal);

  const open = (cartProps, onCheckoutFn) => {
    window.__mobileCartCheckout = onCheckoutFn || null;
    window.__mobileCartProps = cartProps;
  };

  const close = () => {
    window.__mobileCartCheckout = null;
    window.__mobileCartProps = null;
  };

  const handleCheckout = () => {
    window.__mobileCartCheckout?.();
    close();
  };

  const props = window.__mobileCartProps || null;

  return (
    <MobileCartContext.Provider value={{ props, open, close, handleCheckout, cart, addItem, updateQty, clear, subtotal }}>
      {children}
    </MobileCartContext.Provider>
  );
}

export function useMobileCart() {
  return useContext(MobileCartContext);
}
