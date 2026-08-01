import React, { Component, ErrorInfo, ReactNode } from "react";
import { logError } from "../db/errorLog";
import { useLangStore } from "../stores/langStore";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logError("SYSTEM", error.message, `${error.stack}\nComponent Stack: ${errorInfo.componentStack}`);
    console.error("Uncaught error:", error, errorInfo);
  }

  componentDidMount() {
    // Catch general window errors
    window.addEventListener("error", this.handleWindowError);
    // Catch unhandled promise rejections
    window.addEventListener("unhandledrejection", this.handlePromiseRejection);
  }

  componentWillUnmount() {
    window.removeEventListener("error", this.handleWindowError);
    window.removeEventListener("unhandledrejection", this.handlePromiseRejection);
  }

  private handleWindowError = (event: ErrorEvent) => {
    logError("SYSTEM", event.message, `File: ${event.filename} | Line: ${event.lineno}:${event.colno}`);
  };

  private handlePromiseRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : "";
    logError("NETWORK", `Unhandled Promise Rejection: ${msg}`, stack);
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const lang = useLangStore.getState().lang;
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.iconContainer}>⚠️</div>
            <h1 style={styles.title}>
              {t("common.somethingWentWrong", lang)}
            </h1>
            <p style={styles.subtitle}>{t("common.errorSubtitle", lang)}</p>
            
            <div style={styles.errorDetails}>
              <code>{this.state.error?.message || "Unknown rendering error"}</code>
            </div>

            <button onClick={this.handleReload} style={styles.button}>
              {t("common.reloadApp", lang)}
            </button>
            <p style={styles.footer}>{t("common.contactAdmin", lang)}</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    width: "100%",
    backgroundColor: "#0f172a",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    padding: "20px",
    boxSizing: "border-box",
  },
  card: {
    maxWidth: "480px",
    width: "100%",
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "16px",
    padding: "40px 30px",
    textAlign: "center",
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)",
  },
  iconContainer: {
    fontSize: "3.5rem",
    marginBottom: "20px",
    display: "inline-block",
  },
  title: {
    color: "#f8fafc",
    fontSize: "1.75rem",
    fontWeight: 700,
    margin: "0 0 10px 0",
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: "1rem",
    margin: "0 0 24px 0",
    lineHeight: "1.5",
  },
  errorDetails: {
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "30px",
    textAlign: "left",
    overflowX: "auto",
  },
  button: {
    backgroundColor: "#10b981",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    padding: "14px 28px",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s ease",
    outline: "none",
    boxShadow: "0 4px 6px -1px rgba(16, 185, 129, 0.2)",
  },
  footer: {
    color: "#64748b",
    fontSize: "0.8rem",
    marginTop: "24px",
    margin: "24px 0 0 0",
  },
};
