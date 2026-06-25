export function getPlatform() {
  if (typeof window === "undefined") return "desktop";
  const ua = navigator.userAgent;
  const isIPad = /iPad/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1 && !/iPhone/.test(ua));
  const isIPhone = /iPhone|iPod/.test(ua);
  const isAndroidTablet = /Android/.test(ua) && !/Mobile/.test(ua);
  const isAndroidPhone = /Android/.test(ua) && /Mobile/.test(ua);
  if (isIPad) return "ipad";
  if (isIPhone) return "ios";
  if (isAndroidTablet) return "android-tablet";
  if (isAndroidPhone) return "android";
  return "desktop";
}
