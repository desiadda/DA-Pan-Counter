import { useState, useRef, useEffect } from "react";
import { dbService } from "../firebase";

export default function AuthView({ onAuthSuccess }) {
  const inputRef = useRef<HTMLInputElement>(null);
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
    } catch (err: any) {
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
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">🍃</div>
          <h2 className="auth-title">DA Pan Counter</h2>
          <p className="auth-subtitle">Premium POS & Inventory System</p>
        </div>

        <form onSubmit={handleLogin} className="auth-form">
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={handleKeyChange}
            onBlur={() => setTimeout(() => inputRef.current?.focus(), 10)}
            className="auth-hidden-input"
            autoComplete="off"
          />
          <div className="auth-pin-container" onClick={() => inputRef.current?.focus()}>
            <div className="auth-pin-dots">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`auth-pin-dot ${pin.length > idx ? "active" : ""}`}
                />
              ))}
            </div>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <div className="auth-keypad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                className="auth-key"
                onClick={() => handlePinPress(num.toString())}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              className="auth-key auth-key-clear"
              onClick={handleClear}
            >
              Clear
            </button>
            <button
              type="button"
              className="auth-key"
              onClick={() => handlePinPress("0")}
            >
              0
            </button>
            <button
              type="submit"
              disabled={pin.length < 4 || loading}
              className="auth-key auth-key-submit"
            >
              {loading ? "..." : "OK"}
            </button>
          </div>

          <div className="auth-instructions">
            Enter your 4-digit PIN to login
          </div>
        </form>
      </div>
    </div>
  );
}
