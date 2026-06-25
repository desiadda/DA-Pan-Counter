import { createContext, useContext, useEffect, useRef, useCallback } from "react";
import { useAuth } from "./AuthContext";

const SESSION_TIMEOUT = 30 * 60 * 1000;

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const { logout } = useAuth();
  const timerRef = useRef(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      logout();
    }, SESSION_TIMEOUT);
  }, [logout]);

  useEffect(() => {
    const events = ["mousedown", "keydown", "touchstart", "scroll", "click"];

    const handleActivity = () => resetTimer();

    events.forEach((event) => window.addEventListener(event, handleActivity));

    resetTimer();

    return () => {
      events.forEach((event) => window.removeEventListener(event, handleActivity));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer]);

  return <SessionContext.Provider value={null}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
