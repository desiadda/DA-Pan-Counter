import { create } from "zustand"
import { dbService } from "../firebase"
import { logError } from "../db/errorLog"
import { useConfirmStore } from "./confirmStore"
import { ADMIN_PERMISSIONS, DEFAULT_PERMISSIONS } from "../constants"

interface User {
  id: string
  name: string
  pin?: string
  role: string
  permissions: Record<string, boolean>
  sessionId?: string
}

interface AuthState {
  user: User | null
  isOnline: boolean
  pendingSync: number
  setUser: (user: User) => void
  logout: () => Promise<void>
  init: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isOnline: navigator.onLine,
  pendingSync: 0,

  setUser: (user) => set({ user }),

  logout: async () => {
    try {
      const ok = await useConfirmStore.getState().confirm(
        "Are you sure you want to log out?",
        { title: "Log Out", confirmLabel: "Log Out", variant: "danger" }
      )
      if (!ok) return
      try {
        await dbService.logout()
      } catch (e: any) {
        // Even if server logout fails, clear local session
        logError("AUTH", e.message, e.stack)
      }
      localStorage.removeItem("pan_user")
      set({ user: null })
    } catch (err: any) {
      logError("AUTH", err.message, err.stack)
      alert("❌ " + (err.message || "Logout failed"))
    }
  },

  init: () => {
    const handleOnline = () => set({ isOnline: true })
    const handleOffline = () => set({ isOnline: false })
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    try {
      const currentUser = dbService.getCurrentUser()
      if (currentUser) set({ user: currentUser })
    } catch (err: any) {
      logError("AUTH", err.message, err.stack)
    }

    // Single Active Session Auto-Logout Listener
    const handleSessionTerminated = () => {
      set({ user: null })
      localStorage.removeItem("pan_user")
      alert("⚠️ Your account has been logged in on another device or browser. This session has been automatically logged out.")
    }
    window.addEventListener("session-terminated", handleSessionTerminated)

    // Auto-refresh current user's permissions when Firestore syncs user list
    const handleUsersChanged = () => {
      try {
        const { user } = get()
        if (!user) return
        const raw = localStorage.getItem("pan_users")
        if (!raw) return
        const allUsers: User[] = JSON.parse(raw)
        const fresh = allUsers.find(u => u.id === user.id)
        if (fresh) {
          // If session mismatch detected, terminate old session!
          if (fresh.sessionId && user.sessionId && fresh.sessionId !== user.sessionId) {
            handleSessionTerminated()
            return
          }
          if (fresh.permissions) {
            const roleDefaults = fresh.role === "admin" ? ADMIN_PERMISSIONS : DEFAULT_PERMISSIONS
            const permissions = { ...roleDefaults, ...fresh.permissions }
            const updated = { ...user, name: fresh.name, permissions, role: fresh.role, sessionId: fresh.sessionId || user.sessionId }
            set({ user: updated })
            localStorage.setItem("pan_user", JSON.stringify(updated))
          }
        }
      } catch (err: any) {
        logError("AUTH", err.message, err.stack)
      }
    }
    window.addEventListener("users-changed", handleUsersChanged)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      window.removeEventListener("users-changed", handleUsersChanged)
      window.removeEventListener("session-terminated", handleSessionTerminated)
    }
  },
}))
