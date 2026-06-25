import { createContext, useContext, useEffect, useRef } from "react";
import { useAuthStore } from "../stores/authStore";

const SESSION_TIMEOUT = 30 * 60 * 1000;
const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const logout = useAuthStore((s) => s.logout);
  const timerRef = useRef(null);

  useEffect(() => {
    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => logout(), SESSION_TIMEOUT);
    };
    const events = ["mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer();
    return () => {
      events.forEach((event) => window.removeEventListener(event, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [logout]);

  return <SessionContext.Provider value={null}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
