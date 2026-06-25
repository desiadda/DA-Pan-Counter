import { createContext, useContext, useState, useCallback, useRef } from "react";

const MobileCartContext = createContext(null);

export function MobileCartProvider({ children }) {
  const [props, setProps] = useState(null);
  const checkoutRef = useRef(null);
  const open = useCallback((p, onCheckout) => {
    setProps(p);
    checkoutRef.current = onCheckout || null;
  }, []);
  const close = useCallback(() => {
    setProps(null);
    checkoutRef.current = null;
  }, []);
  const handleCheckout = useCallback(() => {
    checkoutRef.current?.();
    setProps(null);
    checkoutRef.current = null;
  }, []);
  return (
    <MobileCartContext.Provider value={{ props, open, close, handleCheckout }}>
      {children}
    </MobileCartContext.Provider>
  );
}

export function useMobileCart() {
  return useContext(MobileCartContext);
}
