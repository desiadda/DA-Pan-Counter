import { createContext, useContext, useCallback } from "react";
import { useConfirmStore } from "../stores/confirmStore";
import ConfirmDialog from "../components/ConfirmDialog";

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const open = useConfirmStore((s) => s.open);
  const title = useConfirmStore((s) => s.title);
  const message = useConfirmStore((s) => s.message);
  const confirmLabel = useConfirmStore((s) => s.confirmLabel);
  const cancelLabel = useConfirmStore((s) => s.cancelLabel);
  const variant = useConfirmStore((s) => s.variant);
  const handleConfirm = useConfirmStore((s) => s.handleConfirm);
  const handleCancel = useConfirmStore((s) => s.handleCancel);
  const confirm = useConfirmStore((s) => s.confirm);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={open}
        title={title}
        message={message}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        variant={variant}
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
