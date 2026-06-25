let lockCount = 0;

export function lockBodyScroll() {
  if (lockCount === 0) {
    document.body.style.overflow = "hidden";
  }
  lockCount++;
}

export function unlockBodyScroll() {
  lockCount--;
  if (lockCount <= 0) {
    lockCount = 0;
    document.body.style.overflow = "";
  }
}
