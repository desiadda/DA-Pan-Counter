import { useState, useRef, useEffect } from "react";
import { dbService } from "../firebase";

export default function AuthView({ onAuthSuccess }) {
  const inputRef = useRef(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = await dbService.login("", pin);
      onAuthSuccess(user);
    } catch (err) {
      setError(err.message || "Invalid PIN code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePinPress = (num) => {
    if (pin.length < 4) {
      const next = pin + num;
      setPin(next);
      if (next.length < 4) inputRef.current?.focus();
    }
  };

  const handleClear = () => {
    setPin("");
    inputRef.current?.focus();
  };

  const handleKeyChange = (e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 4);
    setPin(val);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.brandContainer}>
          <div style={styles.logo}>🍃</div>
          <h2 style={styles.title}>DA Pan Counter</h2>
          <p style={styles.subtitle}>Premium POS & Inventory System</p>
        </div>

        <form onSubmit={handleLogin} style={styles.form}>
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={handleKeyChange}
            onBlur={() => setTimeout(() => inputRef.current?.focus(), 10)}
            style={styles.hiddenInput}
            autoComplete="off"
          />
          <div style={styles.pinDisplayContainer} onClick={() => inputRef.current?.focus()}>
            <div style={styles.pinDots}>
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  style={{
                    ...styles.dot,
                    ...(pin.length > idx ? styles.activeDot : {})
                  }}
                />
              ))}
            </div>
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.keypad}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                style={styles.key}
                onClick={() => handlePinPress(num.toString())}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              style={{...styles.key, ...styles.clearKey}}
              onClick={handleClear}
            >
              Clear
            </button>
            <button
              type="button"
              style={styles.key}
              onClick={() => handlePinPress("0")}
            >
              0
            </button>
            <button
              type="submit"
              disabled={pin.length < 4 || loading}
              style={{
                ...styles.key,
                ...styles.submitKey,
                ...((pin.length < 4 || loading) ? styles.disabledSubmitKey : {})
              }}
            >
              {loading ? "..." : "OK"}
            </button>
          </div>

          <div style={styles.instructions}>
            Enter your 4-digit PIN to login
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100svh",
    backgroundColor: "#f8fafc",
    padding: "1rem",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    width: "100%",
    maxWidth: "400px",
    padding: "2rem",
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)",
    border: "1px solid #e2e8f0",
  },
  brandContainer: {
    textAlign: "center",
    marginBottom: "1.5rem",
  },
  logo: {
    fontSize: "2.5rem",
    marginBottom: "0.5rem",
  },
  title: {
    color: "#047857",
    fontSize: "1.5rem",
    fontWeight: "700",
    letterSpacing: "-0.5px",
  },
  subtitle: {
    color: "#64748b",
    fontSize: "0.85rem",
    marginTop: "0.25rem",
  },
  form: {
    display: "flex",
    flexDirection: "column",
  },
  pinDisplayContainer: {
    backgroundColor: "#f8fafc",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    padding: "1rem",
    marginBottom: "1rem",
    display: "flex",
    justifyContent: "center",
  },
  pinDots: {
    display: "flex",
    gap: "1.25rem",
  },
  dot: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    backgroundColor: "#cbd5e1",
    transition: "all 0.15s ease",
  },
  activeDot: {
    backgroundColor: "#047857",
    transform: "scale(1.2)",
  },
  error: {
    color: "#ef4444",
    fontSize: "0.8rem",
    fontWeight: "600",
    textAlign: "center",
    backgroundColor: "#fef2f2",
    padding: "0.5rem",
    borderRadius: "6px",
    marginBottom: "1rem",
  },
  keypad: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "0.75rem",
    marginBottom: "1.25rem",
  },
  key: {
    padding: "1rem",
    fontSize: "1.25rem",
    fontWeight: "600",
    color: "#1e293b",
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "all 0.1s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    outline: "none",
  },
  clearKey: {
    color: "#dc2626",
    fontSize: "0.95rem",
    backgroundColor: "#fef2f2",
  },
  submitKey: {
    backgroundColor: "#047857",
    color: "#ffffff",
    border: "none",
    fontSize: "1rem",
  },
  disabledSubmitKey: {
    backgroundColor: "#94a3b8",
    cursor: "not-allowed",
  },
  instructions: {
    textAlign: "center",
    fontSize: "0.8rem",
    color: "#64748b",
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    width: 0,
    height: 0,
    pointerEvents: "none",
  },
};
