import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ConfirmProvider } from "./context/ConfirmContext";
import { SessionProvider } from "./context/SessionContext";
import { LanguageProvider } from "./context/LanguageContext";
import { MobileCartProvider, useMobileCart } from "./context/MobileCartContext";
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
    icon: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></>,
    perm: "stock",
  },
  {
    key: "credit",
    label: "Credit Accounts",
    icon: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    perm: "khata",
  },
  {
    key: "admin",
    label: "Menu",
    icon: <><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></>,
    perm: "menu",
  },
];

function AppContent() {
  const { user, setUser, logout, isOnline } = useAuth();
  const getTabFromHash = () => {
    const hash = window.location.hash.replace("#", "").split("/")[0];
    const normalized = hash === "khata" ? "credit" : hash;
    return ["pos", "inventory", "credit", "admin"].includes(normalized) ? normalized : "pos";
  };
  const getSubPath = () => {
    const hash = window.location.hash.replace("#", "");
    const parts = hash.split("/");
    return parts.slice(1).join("/");
  };
  const [activeTab, setActiveTab] = useState(getTabFromHash());
  const [subPath, setSubPath] = useState(getSubPath());
  const [showCOH, setShowCOH] = useState(false);
  const [showShift, setShowShift] = useState(false);
  const [criticalErrors, setCriticalErrors] = useState(getCriticalUnreadCount());
  const [lowStockCount, setLowStockCount] = useState(dbService.getLowStockCount());
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const updateFavicon = (dataUrl) => {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = dataUrl;
  };

  useEffect(() => {
    const onHashChange = () => {
      setActiveTab(getTabFromHash());
      setSubPath(getSubPath());
    };
    window.addEventListener("hashchange", onHashChange);
    const onError = () => setCriticalErrors(getCriticalUnreadCount());
    window.addEventListener("error-logged", onError);
    const refreshStock = () => setLowStockCount(dbService.getLowStockCount());
    window.addEventListener("stock-changed", refreshStock);
    const store = JSON.parse(localStorage.getItem("pan_store_settings") || "{}");
    if (store.logo) updateFavicon(store.logo);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("error-logged", onError);
      window.removeEventListener("stock-changed", refreshStock);
    };
  }, []);

  if (!user) {
    return <AuthView onAuthSuccess={setUser} />;
  }

  const allUsers = getUsers();
  const cohBalance = dbService.getBalance(user.id);
  const cohPending = dbService.getPendingCount(user.id);

  const canAccessTab = (key) => {
    if (key === "pos") return true;
    if (key === "menu" || key === "admin") return user.permissions?.reports || user.permissions?.expenses || user.permissions?.settings;
    return user.permissions?.[key] === true;
  };

  const handleTabClick = useCallback((tab) => {
    const permKey = tab.perm || tab.key;
    if (canAccessTab(permKey)) {
      setActiveTab(tab.key);
      setSubPath("");
      window.location.hash = tab.key;
    } else {
      alert("Access Denied! You don't have permission for this section.");
    }
  }, []);

  const handleSubNavigate = useCallback((path) => {
    setSubPath(path);
    window.location.hash = activeTabRef.current + (path ? "/" + path : "");
  }, []);

  const { props: mobileCartProps, open: openMobileCart, close: closeMobileCart, handleCheckout } = useMobileCart();

  const renderMainContent = useCallback(() => {
    switch (activeTab) {
      case "pos":
        return <POSView user={user} onMobileCartOpen={openMobileCart} />;
      case "inventory":
        return <InventoryView />;
      case "credit":
        return <KhataView />;
      case "admin":
        return <AdminHub subPath={subPath} onNavigate={handleSubNavigate} user={user} />;
      default:
        return <POSView user={user} />;
    }
  }, [activeTab, subPath, user, openMobileCart, handleSubNavigate]);


  return (
    <AppShell>
      <header className="header">
        <div className="header-title">
          <span>🍃</span>
          <span style={{ fontWeight: 800, letterSpacing: "-0.5px" }}>Paan Counter</span>
        </div>
        
        <div className="header-right">
          <span className={`status-badge ${dbService.isFirebase() ? (isOnline ? 'status-online' : 'status-offline') : 'status-offline'}`}
                title={dbService.isFirebase() ? (isOnline ? "☁️ Firebase connected & syncing" : "☁️ Firebase configured but offline — using local") : "💾 Local storage mode"}>
            <span className="status-dot">{dbService.isFirebase() ? (isOnline ? "☁️" : "☁️") : "💾"}</span>
            <span className="status-text">{dbService.isFirebase() ? (isOnline ? "Cloud Sync" : "Cloud Offline") : "Local Storage"}</span>
          </span>

          <button onClick={() => setShowCOH(true)} className="coh-badge" title="Cash on Hand">
            <span>💰</span>
            <span className="coh-amount">฿{cohBalance.toFixed(0)}</span>
            {cohPending > 0 && <span className="coh-pending-dot">{cohPending}</span>}
          </button>

          {(lowStockCount > 0 || (user.permissions?.settings && criticalErrors > 0)) && (
            <button onClick={() => {
              if (lowStockCount > 0) { window.location.hash = "inventory"; setActiveTab("inventory"); setSubPath(""); }
              else { window.location.hash = "admin/errors"; setActiveTab("admin"); setSubPath("errors"); }
            }} className="notif-badge" title={`${lowStockCount} low stock, ${criticalErrors} errors`}>
              <span>🔔</span>
              <span className="notif-count">{lowStockCount + criticalErrors}</span>
            </button>
          )}

          <button onClick={() => setShowShift(true)} className="shift-badge header-shift-btn" title="Shift Management">
            <span>🛑</span>
          </button>

          <LanguageSwitcher />
          <button onClick={() => { const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', next); localStorage.setItem('pan_theme', next); }} className="logout-btn" title="Toggle Dark Mode">
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

      {showCOH && <COHPanel user={user} users={allUsers} onClose={() => setShowCOH(false)} />}
      {showShift && <ShiftPanel user={user} onClose={() => setShowShift(false)} />}
      {mobileCartProps && <CartBottomSheet {...mobileCartProps} onClose={closeMobileCart} onCheckout={handleCheckout} />}
    </AppShell>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <ConfirmProvider>
        <AuthProvider>
          <ErrorBoundary>
            <SessionProvider>
              <MobileCartProvider>
                <AppContent />
              </MobileCartProvider>
            </SessionProvider>
          </ErrorBoundary>
        </AuthProvider>
      </ConfirmProvider>
    </LanguageProvider>
  );
}


