import { useState, lazy, Suspense, useEffect } from "react";
import ErrorBoundary from "./ErrorBoundary";
import { SkeletonTable } from "./Skeleton";

const ReportsView = lazy(() => import("./ReportsView"));
const ExpensesView = lazy(() => import("./ExpensesView"));
const UserManager = lazy(() => import("./UserManager"));
const COHView = lazy(() => import("./COHView"));
const AdminSettings = lazy(() => import("./AdminSettings"));
const ErrorLogView = lazy(() => import("./ErrorLogView"));

export default function AdminHub({ subPath, onNavigate, user }) {
  const parts = subPath ? subPath.split("/") : [];
  const initialView = parts[0] || null;
  const initialSubTab = parts[1] || null;
  const [activeView, setActiveView] = useState(initialView);

  useEffect(() => {
    setActiveView(initialView);
  }, [subPath]);

  const handleNavigate = (view) => {
    setActiveView(view);
    onNavigate(view);
  };

  const handleBack = () => {
    setActiveView(null);
    onNavigate("");
  };

  const handleReportsSubTab = (tab) => {
    onNavigate(tab ? "reports/" + tab : "reports");
  };

  const perms = user?.permissions || {};

  if (activeView === "reports") {
    return (
      <div style={styles.container}>
        <div style={styles.subHeader}>
          <button onClick={handleBack} style={styles.backBtn}>
            ← Back
          </button>
          <h3 style={styles.subTitle}>Reports</h3>
        </div>
        <ErrorBoundary>
          <Suspense fallback={<SkeletonTable rows={5} />}>
            <ReportsView initialSubTab={initialSubTab} onSubTabChange={handleReportsSubTab} user={user} />
          </Suspense>
        </ErrorBoundary>
      </div>
    );
  }

  if (activeView === "expenses") {
    return (
      <div style={styles.container}>
        <div style={styles.subHeader}>
          <button onClick={handleBack} style={styles.backBtn}>
            ← Back
          </button>
          <h3 style={styles.subTitle}>Expenses</h3>
        </div>
        <ErrorBoundary>
          <Suspense fallback={<SkeletonTable rows={5} />}>
            <ExpensesView />
          </Suspense>
        </ErrorBoundary>
      </div>
    );
  }

  if (activeView === "users") {
    return (
      <div style={styles.container}>
        <div style={styles.subHeader}>
          <button onClick={handleBack} style={styles.backBtn}>
            ← Back
          </button>
          <h3 style={styles.subTitle}>User Management</h3>
        </div>
        <ErrorBoundary>
          <Suspense fallback={<SkeletonTable rows={5} />}>
            <UserManager />
          </Suspense>
        </ErrorBoundary>
      </div>
    );
  }

  if (activeView === "cash") {
    return (
      <div style={styles.container}>
        <div style={styles.subHeader}>
          <button onClick={handleBack} style={styles.backBtn}>
            ← Back
          </button>
          <h3 style={styles.subTitle}>Cash on Hand</h3>
        </div>
        <ErrorBoundary>
          <Suspense fallback={<SkeletonTable rows={5} />}>
            <COHView user={user} />
          </Suspense>
        </ErrorBoundary>
      </div>
    );
  }

  if (activeView === "store") {
    return (
      <div style={styles.container}>
        <Suspense fallback={<SkeletonTable rows={3} />}>
          <AdminSettings onBack={handleBack} />
        </Suspense>
      </div>
    );
  }

  if (activeView === "errors") {
    return (
      <div style={styles.container}>
        <Suspense fallback={<SkeletonTable rows={3} />}>
          <ErrorLogView onBack={handleBack} />
        </Suspense>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Admin Menu</h2>
      <p style={styles.subheading}>Manage your business tools</p>

      <div style={styles.grid}>
        {perms.reports && (
          <button onClick={() => handleNavigate("reports")} style={styles.card}>
            <span style={styles.cardIcon}>📊</span>
            <span style={styles.cardTitle}>Reports</span>
            <span style={styles.cardDesc}>Sales, profit & analytics</span>
          </button>
        )}

        {perms.expenses && (
          <button onClick={() => handleNavigate("expenses")} style={styles.card}>
            <span style={styles.cardIcon}>💸</span>
            <span style={styles.cardTitle}>Expenses</span>
            <span style={styles.cardDesc}>Track business expenses</span>
          </button>
        )}

        {perms.settings && (
          <button onClick={() => handleNavigate("users")} style={styles.card}>
            <span style={styles.cardIcon}>👥</span>
            <span style={styles.cardTitle}>Users</span>
            <span style={styles.cardDesc}>Manage staff & permissions</span>
          </button>
        )}

        {perms.settings && (
          <button onClick={() => handleNavigate("store")} style={styles.card}>
            <span style={styles.cardIcon}>⚙️</span>
            <span style={styles.cardTitle}>Settings</span>
            <span style={styles.cardDesc}>Store, PIN, VAT, Firebase & more</span>
          </button>
        )}

        <button onClick={() => handleNavigate("errors")} style={styles.card}>
          <span style={styles.cardIcon}>⚠️</span>
          <span style={styles.cardTitle}>Error Logs</span>
          <span style={styles.cardDesc}>Category-wise system errors</span>
        </button>

        <button onClick={() => handleNavigate("cash")} style={styles.card}>
          <span style={styles.cardIcon}>💰</span>
          <span style={styles.cardTitle}>Cash on Hand</span>
          <span style={styles.cardDesc}>Balances, transfers & adjustments</span>
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  heading: {
    fontSize: "1.25rem",
    fontWeight: "800",
    color: "#1e293b",
  },
  subheading: {
    fontSize: "0.85rem",
    color: "#64748b",
    marginTop: "-0.5rem",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "0.75rem",
  },
  card: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    padding: "1.5rem 1rem",
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    textAlign: "center",
    fontFamily: "inherit",
  },
  cardIcon: {
    fontSize: "2rem",
  },
  cardTitle: {
    fontSize: "1rem",
    fontWeight: "700",
    color: "#1e293b",
  },
  cardDesc: {
    fontSize: "0.75rem",
    color: "#64748b",
    fontWeight: "500",
  },
  subHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  subTitle: {
    fontSize: "1.1rem",
    fontWeight: "700",
    color: "#1e293b",
  },
  backBtn: {
    background: "none",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "0.4rem 0.75rem",
    cursor: "pointer",
    fontSize: "0.85rem",
    fontWeight: "600",
    color: "#64748b",
    fontFamily: "inherit",
  },
};