import { createContext, useContext, useState, useEffect } from "react";
import { dbService } from "../firebase";
import { useConfirm } from "./ConfirmContext";
import { logError } from "../db/errorLog";
import { processSyncQueue, getQueueLength } from "../db/sync";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(0);
  const confirm = useConfirm();

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      const synced = await processSyncQueue();
      if (synced > 0) console.log(`Synced ${synced} pending items`);
      setPendingSync(getQueueLength());
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    try {
      const currentUser = dbService.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
      }
    } catch (err) {
      logError("AUTH", err.message, err.stack);
      console.error("Failed to get current user:", err);
    }

    processSyncQueue().then(n => { if (n > 0) console.log(`Synced ${n} pending items on start`); });
    setPendingSync(getQueueLength());

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleAuthSuccess = (loggedUser) => {
    setUser(loggedUser);
  };

  const handleLogout = async () => {
    try {
      const ok = await confirm("Are you sure you want to log out?", {
        title: "Logout",
        confirmLabel: "Logout",
        variant: "danger",
      });
      if (ok) {
        await dbService.logout();
        setUser(null);
      }
    } catch (err) {
      logError("AUTH", err.message, err.stack);
      alert("❌ " + (err.message || "Logout failed"));
      console.error(err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser: handleAuthSuccess, logout: handleLogout, isOnline, pendingSync }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
