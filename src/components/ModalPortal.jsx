import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { lockBodyScroll, unlockBodyScroll } from "../utils/bodyLock";

export default function ModalPortal({ children, onClose }) {
  const [mountNode, setMountNode] = useState(null);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape" && onClose) onClose();
  }, [onClose]);

  useEffect(() => {
    lockBodyScroll();
    setMountNode(document.getElementById("app-modal-layer") || document.body);
    if (onClose) window.addEventListener("keydown", handleKeyDown);
    return () => {
      unlockBodyScroll();
      if (onClose) window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown, onClose]);

  if (!mountNode) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
    >
      {children}
    </motion.div>,
    mountNode,
  );
}
