import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useEffect } from "react"
import App from "./App"
import "./index.css"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
})

const savedTheme = localStorage.getItem("pan_theme")
const isDark = savedTheme === "dark" || (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)
if (isDark) {
  document.documentElement.setAttribute("data-theme", "dark")
  document.documentElement.classList.add("dark")
}

// Redirect old hash-based bookmarks to path-based routing
function HashRedirect() {
  const navigate = useNavigate()
  useEffect(() => {
    const hash = window.location.hash.replace(/^#\/?/, "")
    if (hash && hash !== "/") {
      const validRoutes = ["pos", "inventory", "khata", "credit", "admin", "menu"]
      const target = hash.split("/")[0]
      if (validRoutes.includes(target)) {
        navigate("/" + hash, { replace: true })
      }
    }
  }, [navigate])
  return null
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <HashRedirect />
        <Routes>
          <Route path="/" element={<Navigate to="/pos" replace />} />
          <Route path="/*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
