import { createRoot } from "react-dom/client"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import App from "./App"
import GlobalErrorBoundary from "./components/GlobalErrorBoundary"
import "./index.css"

// ── Anti-Caching & Instant Cache Invalidation ──
// Unregister all legacy service workers & wipe CacheStorage on startup so clients always fetch fresh code
if (typeof window !== "undefined") {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    }).catch(() => {});
  }
  if ("caches" in window) {
    caches.keys().then((keys) => {
      for (const key of keys) {
        caches.delete(key);
      }
    }).catch(() => {});
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 0, retry: 1, refetchOnWindowFocus: true },
  },
})

const savedTheme = localStorage.getItem("pan_theme")
const isDark = savedTheme === "dark" || (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)
if (isDark) {
  document.documentElement.setAttribute("data-theme", "dark")
  document.documentElement.classList.add("dark")
}

createRoot(document.getElementById("root")!).render(
  <GlobalErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/pos" replace />} />
          <Route path="/*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </GlobalErrorBoundary>,
)
