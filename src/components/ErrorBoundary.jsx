import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.icon}>⚠️</div>
            <h2 style={styles.title}>Something went wrong</h2>
            <p style={styles.message}>
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button onClick={this.handleReset} style={styles.button}>
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const styles = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "200px",
    padding: "2rem",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    padding: "2rem",
    textAlign: "center",
    maxWidth: "400px",
  },
  icon: { fontSize: "2.5rem", marginBottom: "0.5rem" },
  title: { color: "#dc2626", fontSize: "1.25rem", fontWeight: "700", marginBottom: "0.5rem" },
  message: { color: "#64748b", fontSize: "0.9rem", marginBottom: "1.5rem" },
  button: {
    padding: "0.6rem 1.5rem",
    backgroundColor: "#047857",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    fontWeight: "600",
    cursor: "pointer",
  },
};
