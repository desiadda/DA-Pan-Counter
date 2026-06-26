import { createRoot } from "react-dom/client"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
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

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/pos" replace />} />
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>,
)
