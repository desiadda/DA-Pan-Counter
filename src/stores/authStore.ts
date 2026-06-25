import { create } from "zustand"
import { dbService } from "../firebase"
import { processSyncQueue, getQueueLength } from "../db/sync"
import { logError } from "../db/errorLog"

interface User {
  id: string
  name: string
  pin: string
  role: string
  permissions: Record<string, boolean>
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
      const ok = window.confirm("Are you sure you want to log out?")
      if (ok) {
        await dbService.logout()
        set({ user: null })
      }
    } catch (err: any) {
      logError("AUTH", err.message, err.stack)
      alert("❌ " + (err.message || "Logout failed"))
    }
  },

  init: () => {
    const handleOnline = async () => {
      set({ isOnline: true })
      const synced = await processSyncQueue()
      if (synced > 0) console.log(`Synced ${synced} pending items`)
      set({ pendingSync: getQueueLength() })
    }
    const handleOffline = () => set({ isOnline: false })
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    try {
      const currentUser = dbService.getCurrentUser()
      if (currentUser) set({ user: currentUser })
    } catch (err: any) {
      logError("AUTH", err.message, err.stack)
    }

    processSyncQueue().then((n) => {
      if (n > 0) console.log(`Synced ${n} items on start`)
    })
    set({ pendingSync: getQueueLength() })

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  },
}))
