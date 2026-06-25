import { createContext, useContext, useState, useCallback } from "react";
import ConfirmDialog from "../components/ConfirmDialog";

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState({
    open: false,
    title: "",
    message: "",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    variant: "default",
    resolve: null,
  });

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setState({
        open: true,
        message,
        title: options.title || "",
        confirmLabel: options.confirmLabel || "Confirm",
        cancelLabel: options.cancelLabel || "Cancel",
        variant: options.variant || "default",
        resolve,
      });
    });
  }, []);

  const handleConfirm = () => {
    state.resolve(true);
    setState((s) => ({ ...s, open: false, resolve: null }));
  };

  const handleCancel = () => {
    state.resolve(false);
    setState((s) => ({ ...s, open: false, resolve: null }));
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={state.open}
        title={state.title}
        message={state.message}
        confirmLabel={state.confirmLabel}
        cancelLabel={state.cancelLabel}
        variant={state.variant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
