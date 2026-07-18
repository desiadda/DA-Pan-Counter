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
import ShiftPanel from "./components/ShiftPanel";
import LanguageSwitcher from "./components/LanguageSwitcher";
import CartBottomSheet from "./components/CartBottomSheet";
import AppShell from "./components/AppShell";
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
  const setUser = useAuthStore((s) => s.setUser);
  const init = useAuthStore((s) => s.init);
  const logout = useAuthStore((s) => s.logout);
  const isOnline = useAuthStore((s) => s.isOnline);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const navigate = useNavigate();
  const location = useLocation();

  const showCOH = useUIStore((s) => s.showCOH);
  const setShowCOH = (show: boolean) => useUIStore.setState({ showCOH: show });
  const showShift = useUIStore((s) => s.showShift);
  const setShowShift = (show: boolean) => useUIStore.setState({ showShift: show });

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

  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    setActiveTab(getTabFromPath());
    setSubPath(getSubPath());
  }, [location.pathname]);

  useEffect(() => {
    // Clear all offline database caches on launch to prevent old offline data rendering
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

    dbService.initCOHListener();
    dbService.initUsersListener();
    dbService.migrateLocalDataToFirestore();

    // Direct Firestore real-time bindings
    let unsubProducts = () => {};
    let unsubCustomers = () => {};
    let unsubTransactions = () => {};

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
          alert("Your account has been logged in on another device. You will be logged out. / आपका खाता किसी अन्य डिवाइस पर लॉग इन किया गया है। आप लॉग आउट हो जाएंगे।");
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

          {(lowStockCount > 0 || (user.permissions?.settings && criticalErrors > 0)) && (
            <button onClick={() => {
              if (lowStockCount > 0) { navigate("/inventory", { replace: true }); }
              else { navigate("/admin/errors", { replace: true }); }
            }} className="notif-badge" title={`${lowStockCount} low stock, ${criticalErrors} errors`}>
              <span>🔔</span>
              <span className="notif-count">{lowStockCount + criticalErrors}</span>
            </button>
          )}

          <button onClick={() => setShowShift(true)} className="shift-badge header-shift-btn" title="Shift Management">
            <span>🛑</span>
          </button>

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
          <span>You are offline (इंटरनेट कनेक्शन नहीं है). Please check your internet connection.</span>
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
      {showShift && <ErrorBoundary><ShiftPanel user={user} onClose={() => setShowShift(false)} /></ErrorBoundary>}
      {mobileCartProps && <ErrorBoundary><CartBottomSheet {...mobileCartProps} onClose={closeMobileCart} onCheckout={handleCheckout} /></ErrorBoundary>}
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
