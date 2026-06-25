import { createContext, useContext, useEffect } from "react";
import { useAuthStore } from "../stores/authStore";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const init = useAuthStore((s) => s.init);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const isOnline = useAuthStore((s) => s.isOnline);
  const pendingSync = useAuthStore((s) => s.pendingSync);

  useEffect(() => { const c = init(); return c; }, [init]);

  return (
    <AuthContext.Provider value={{ user, setUser, logout, isOnline, pendingSync }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
