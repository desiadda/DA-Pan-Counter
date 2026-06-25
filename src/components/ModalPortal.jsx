import { useEffect } from "react";
import { createPortal } from "react-dom";
import { lockBodyScroll, unlockBodyScroll } from "../utils/bodyLock";

export default function ModalPortal({ children }) {
  useEffect(() => {
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, []);

  const el = document.getElementById("app-modal-layer");
  return createPortal(children, el || document.body);
}
