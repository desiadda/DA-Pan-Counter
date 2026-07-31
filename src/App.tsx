import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import { db, isFirebaseEnabled } from "./db/config";
import { useDBStore } from "./stores/dbStore";
import { useAuthStore } from "./stores/authStore";
import { useCartStore } from "./stores/cartStore";
import { useUIStore } from "./stores/uiStore";
import ErrorBoundary from "./components/ErrorBoundary";
import AuthView from "./components/AuthView";
import AdminHub from "./components/AdminHub";
import COHPanel from "./components/COHPanel";
import LanguageSwitcher from "./components/LanguageSwitcher";
import CartBottomSheet from "./components/CartBottomSheet";
import AppShell from "./components/AppShell";
import ConfirmDialog from "./components/ConfirmDialog";
import { useConfirmStore } from "./stores/confirmStore";
import { useLangStore } from "./stores/langStore";
import { getUsers } from "./db/auth";
import { dbService } from "./firebase";
import { getCriticalUnreadCount } from "./db/errorLog";
import { SkeletonCard, SkeletonTable } from "./components/Skeleton";

const POSView = lazy(() => import("./components/POSView"));
const InventoryView = lazy(() => import("./components/InventoryView"));
const KhataView = lazy(() => import("./components/KhataView"));

const navItems = [
  {
    key: "pos",
    label: "POS",
    icon: <><rect x="2" y="2" width="20" height="20" rx="4" /><path d="M6 6h12M6 12h12M6 18h6" /></>,
  },
  {
    key: "inventory",
    label: "Inventory",
    icon: <><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></>,
    perm: "stock",
  },
  {
    key: "khata",
    label: "Credit Accounts",
    icon: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5L4 5A2.5 2.5 0 0 1 6.5 2.5H20M14 6h3M14 11h3" /></>,
    perm: "khata",
  },
  {
    key: "menu",
    label: "Menu",
    icon: <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>,
  },
];

function AppContent() {
  const user = useAuthStore((s) => s.user);
  const confirmState = useConfirmStore();
  const setUser = useAuthStore((s) => s.setUser);
  const init = useAuthStore((s) => s.init);
  const logout = useAuthStore((s) => s.logout);
  const isOnline = useAuthStore((s) => s.isOnline);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const lang = useLangStore((s) => s.lang);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const navigate = useNavigate();
  const location = useLocation();

  const showCOH = useUIStore((s) => s.showCOH);
  const setShowCOH = (show: boolean) => useUIStore.setState({ showCOH: show });

  const getTabFromPath = () => {
    const path = location.pathname;
    if (path.startsWith("/pos")) return "pos";
    if (path.startsWith("/inventory")) return "inventory";
    if (path.startsWith("/khata")) return "khata";
    if (path.startsWith("/menu")) return "menu";
    return "pos";
  };

  const getSubPath = () => {
    const path = location.pathname;
    const parts = path.split("/").filter(Boolean);
    return parts.length > 1 ? parts[1] : "";
  };

  const [activeTab, setActiveTab] = useState(getTabFromPath());
  const [subPath, setSubPath] = useState(getSubPath());

  const [cohBalance, setCohBalance] = useState(0);
  const [cohPending, setCohPending] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [criticalErrors, setCriticalErrors] = useState(getCriticalUnreadCount());
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    setActiveTab(getTabFromPath());
    setSubPath(getSubPath());
  }, [location.pathname]);
  useEffect(() => {
    dbService.initCOHListener();
    dbService.initUsersListener();
    dbService.migrateLocalDataToFirestore().finally(() => {
      // Clear all offline database caches after migration checks to prevent old offline data rendering
      const dbKeys = [
        "pan_products",
        "pan_customers",
        "pan_transactions",
        "pan_coh_balances",
        "pan_coh_transactions",
        "pan_expenses",
        "pan_suppliers",
        "pan_purchase_orders",
        "pan_shifts"
      ];
      dbKeys.forEach(k => localStorage.removeItem(k));
    });

    // Direct Firestore real-time bindings
    let unsubProducts = () => {};
    let unsubCustomers = () => {};
    let unsubTransactions = () => {};
    let unsubPaymentModes = () => {};

    if (isFirebaseEnabled && db) {
      unsubProducts = onSnapshot(collection(db, "products"), (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        useDBStore.getState().setProducts(list);
        setLowStockCount(list.filter((p: any) => p.stock <= (p.lowStockLimit || 0)).length);
      });

      unsubCustomers = onSnapshot(collection(db, "customers"), (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        useDBStore.getState().setCustomers(list);
      });

      unsubTransactions = onSnapshot(collection(db, "transactions"), (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        useDBStore.getState().setTransactions(list);
      });

      unsubPaymentModes = onSnapshot(collection(db, "payment_modes"), (snap) => {
        if (snap.empty) {
          dbService.getPaymentModes();
        } else {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          useDBStore.getState().setPaymentModes(list);
        }
      });
    } else {
      dbService.getPaymentModes().then(list => {
        useDBStore.getState().setPaymentModes(list);
      });
    }

    const onError = () => setCriticalErrors(getCriticalUnreadCount());
    window.addEventListener("error-logged", onError);
    
    const refreshCOH = () => {
      const currentUser = useAuthStore.getState().user;
      if (currentUser?.id) {
        setCohBalance(dbService.getBalance(currentUser.id));
        setCohPending(dbService.getPendingCount(currentUser.id));
      }
    };
    window.addEventListener("coh-changed", refreshCOH);
    const refreshUsers = () => {
      const currentUsers = getUsers();
      setAllUsers(currentUsers);
      const currentUser = useAuthStore.getState().user;
      if (currentUser && currentUser.sessionId) {
        const matched = currentUsers.find(u => u.id === currentUser.id);
        if (matched && matched.sessionId && matched.sessionId !== currentUser.sessionId) {
          const alertMsg = lang === "hi" 
            ? "आपका खाता किसी अन्य डिवाइस पर लॉग इन किया गया है। आप लॉग आउट हो जाएंगे।"
            : "Your account has been logged in on another device. You will be logged out.";
          alert(alertMsg);
          localStorage.removeItem("pan_user");
          useAuthStore.setState({ user: null });
        }
      }
    };
    window.addEventListener("users-changed", refreshUsers);
    const store = JSON.parse(localStorage.getItem("pan_store_settings") || "{}");
    if (store.logo) {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = store.logo;
    }
    return () => {
      unsubProducts();
      unsubCustomers();
      unsubTransactions();
      unsubPaymentModes();
      window.removeEventListener("error-logged", onError);
      window.removeEventListener("coh-changed", refreshCOH);
      window.removeEventListener("users-changed", refreshUsers);
    };
  }, [user?.id]);

  useEffect(() => {
    return init();
  }, [init]);

  const canAccessTab = useCallback((key: string) => {
    if (key === "pos") return true;
    if (key === "menu" || key === "admin") return !!(user?.permissions?.reports || user?.permissions?.expenses || user?.permissions?.settings);
    return !!user?.permissions?.[key];
  }, [user]);

  const handleTabClick = useCallback((tab) => {
    const permKey = tab.perm || tab.key;
    if (user && canAccessTab(permKey)) {
      setActiveTab(tab.key);
      setSubPath("");
      navigate("/" + tab.key);
    } else {
      alert("Access Denied! You don't have permission for this section.");
    }
  }, [navigate, user, canAccessTab]);

  const handleSubNavigate = useCallback((path) => {
    setSubPath(path);
    navigate("/" + activeTabRef.current + (path ? "/" + path : ""));
  }, [navigate]);

  const mobileCartOpen = useCartStore((s) => s.mobileCartOpen);
  const mobileCartProps = useCartStore((s) => s.mobileCartProps);
  const closeMobileCart = useCartStore((s) => s.closeMobileCart);
  const handleCheckout = useCartStore((s) => s.handleCheckout);

  const renderMainContent = useCallback(() => {
    switch (activeTab) {
      case "pos":
        return <POSView user={user} />;
      case "inventory":
        return <InventoryView subPath={subPath} onNavigate={handleSubNavigate} />;
      case "khata":
        return <KhataView subPath={subPath} onNavigate={handleSubNavigate} />;
      case "menu":
        return <AdminHub subPath={subPath} onNavigate={handleSubNavigate} user={user} />;
      default:
        return <POSView user={user} />;
    }
  }, [activeTab, subPath, user, handleSubNavigate]);

  if (!user) {
    return <AuthView onAuthSuccess={setUser} />;
  }

  // allUsers is now a state variable

  return (
    <AppShell>
      <header className="header">
        <div className="header-title">
          <span>🍃</span>
          <span style={{ fontWeight: 800, letterSpacing: "-0.5px" }}>Paan Counter</span>
        </div>
        
        <div className="header-right">
          <span className={`status-badge ${dbService.isFirebase() ? (isOnline ? 'status-online' : 'status-offline') : 'status-offline'}`}
                title={dbService.isFirebase() ? (isOnline ? `☁️ Firebase connected (${dbService.getConfig()?.projectId})` : "☁️ Firebase offline") : "💾 Local storage mode"}>
            <span className="status-dot">{dbService.isFirebase() ? (isOnline ? "☁️" : "☁️") : "💾"}</span>
            <span className="status-text">{dbService.isFirebase() ? (isOnline ? `Cloud (${dbService.getConfig()?.projectId || "Active"})` : "Cloud Offline") : "Local Storage"}</span>
          </span>

          <button onClick={() => setShowCOH(true)} className="coh-badge" title="Cash on Hand">
            <span>💰</span>
            <span className="coh-amount">฿{cohBalance.toFixed(0)}</span>
            {cohPending > 0 && <span className="coh-pending-dot">{cohPending}</span>}
          </button>

          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <button onClick={() => setShowNotifDropdown(prev => !prev)} className="notif-badge" title="Notifications">
              <span>🔔</span>
              {(lowStockCount + criticalErrors + cohPending) > 0 && (
                <span className="notif-count">{lowStockCount + criticalErrors + cohPending}</span>
              )}
            </button>

            {showNotifDropdown && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => setShowNotifDropdown(false)} />
                <div className="notif-dropdown">
                  <div className="notif-dropdown-header">Notifications</div>
                  <div className="notif-dropdown-list">
                    {lowStockCount > 0 && (
                      <div className="notif-dropdown-item" onClick={() => { navigate("/inventory", { replace: true }); setShowNotifDropdown(false); }}>
                        <span style={{ fontSize: "1.1rem" }}>⚠️</span>
                        <div>
                          <div className="notif-dropdown-title">Low Stock Warning</div>
                          <div className="notif-dropdown-desc">{lowStockCount} products are running low on stock.</div>
                        </div>
                      </div>
                    )}
                    {user.permissions?.settings && criticalErrors > 0 && (
                      <div className="notif-dropdown-item" onClick={() => { navigate("/admin/errors", { replace: true }); setShowNotifDropdown(false); }}>
                        <span style={{ fontSize: "1.1rem" }}>❌</span>
                        <div>
                          <div className="notif-dropdown-title">System Error Logs</div>
                          <div className="notif-dropdown-desc">{criticalErrors} unread critical error logs.</div>
                        </div>
                      </div>
                    )}
                    {cohPending > 0 && (
                      <div className="notif-dropdown-item" onClick={() => { setShowCOH(true); setShowNotifDropdown(false); }}>
                        <span style={{ fontSize: "1.1rem" }}>💰</span>
                        <div>
                          <div className="notif-dropdown-title">Pending Transfers</div>
                          <div className="notif-dropdown-desc">{cohPending} cash on hand transfers pending approval.</div>
                        </div>
                      </div>
                    )}
                    {lowStockCount === 0 && (!user.permissions?.settings || criticalErrors === 0) && cohPending === 0 && (
                      <div style={{ padding: "1.25rem 1rem", textAlign: "center", color: "#64748b", fontSize: "0.82rem" }}>
                        🎉 All caught up! No notifications.
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <LanguageSwitcher />
          <button onClick={toggleTheme} className="logout-btn" title="Toggle Dark Mode">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </button>

          <span className="header-role">
            {user.permissions?.settings ? "🔑" : "🧑"}
            <span className="header-role-text"> {user.name}</span>
          </span>

          <button onClick={logout} className="logout-btn" title="Log Out">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      </header>

      {!isOnline && (
        <div className="bg-red-500 text-white py-2 px-4 text-xs font-semibold text-center flex items-center justify-center gap-2">
          <span>⚠️</span>
          <span>
            {lang === "hi" 
              ? "आप ऑफ़लाइन हैं। कृपया अपना इंटरनेट कनेक्शन जांचें।" 
              : "You are offline. Please check your internet connection."}
          </span>
        </div>
      )}

      <main className="main-content">
        <ErrorBoundary>
          <Suspense fallback={activeTab === "pos" ? <SkeletonCard count={6} /> : <SkeletonTable rows={5} />}>
            {renderMainContent()}
          </Suspense>
        </ErrorBoundary>
      </main>

      <nav className="nav-bar">
        {navItems.map(tab => {
          const showTab = tab.perm ? canAccessTab(tab.perm) : true;
          if (!showTab) return null;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabClick(tab)}
              className={`nav-item ${activeTab === tab.key ? "active" : ""}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {tab.icon}
              </svg>
              {tab.label}
            </button>
          );
        })}
      </nav>

      {showCOH && <ErrorBoundary><COHPanel user={user} users={allUsers} onClose={() => setShowCOH(false)} /></ErrorBoundary>}
      {mobileCartProps && <ErrorBoundary><CartBottomSheet {...mobileCartProps} onClose={closeMobileCart} onCheckout={handleCheckout} /></ErrorBoundary>}
      
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        cancelLabel={confirmState.cancelLabel}
        variant={confirmState.variant}
        onConfirm={confirmState.handleConfirm}
        onCancel={confirmState.handleCancel}
      />
    </AppShell>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
