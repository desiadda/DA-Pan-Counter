# DA Pan Counter — Project Context

## Overview
Paan shop POS system with billing, inventory, khata (credit accounts), reports, expenses, and graphical analytics. Works offline-first (localStorage) with optional Firebase cloud sync.

## Tech Stack
- React (Vite), **React Router** (browser routing, no hash)
- **Tailwind CSS v4** (utility classes)
- **Zustand** (state — no React Context anywhere)
- **TanStack Query** (data fetching)
- **Framer Motion** (animations in ModalPortal)
- **PWA** (service worker, installable, offline)
- **TypeScript** (entry point + configs, allowJs for existing .jsx)
- Recharts (graphs in Reports)
- localStorage (default DB), Firebase (optional cloud)
- PIN-based auth (SHA-256 hashed)

## Architecture
### State Management (all Zustand stores)
| Store | File | Key State |
|-------|------|-----------|
| `useAuthStore` | `stores/authStore.ts` | user, setUser, logout, isOnline, pendingSync, init |
| `useCartStore` | `stores/cartStore.ts` | cart, addItem, updateQty, clear, subtotal, total, mobileCartOpen, openMobileCart, closeMobileCart, handleCheckout |
| `useConfirmStore` | `stores/confirmStore.ts` | confirm(message, opts) → Promise\<boolean\> |
| `useLangStore` | `stores/langStore.ts` | lang, setLang, translate, availableLangs |
| `useUIStore` | `stores/uiStore.ts` | theme (not yet used by App.jsx) |

### Auth & Roles
- Users stored in `pan_users` localStorage array
- Each user: `{ id, name, pin (hashed), role, permissions: { pos, stock, khata, reports, expenses, settings } }`
- PIN-only login (no email needed for local mode)
- Migration from old `pan_admin_pin`/`pan_staff_pin` happens automatically on first login after update
- Default users: Admin (PIN: 1234, all perms), Staff (PIN: 5555, POS only)

### Routing (React Router)
- `main.tsx` wraps app in **BrowserRouter** with `<Routes>` — `/` redirects to `/pos`, `/*` renders `<App />`
- `App.jsx` reads `location.pathname` to set `activeTab` and `subPath`
- Navigation: `useNavigate()` instead of `window.location.hash`
- Sub-paths restored on refresh (pathname-based, same as old hash behavior)
- Nav items have `key` (path segment) and `perm` (for permission check) — they can differ

### Permissions
- `pos` → POS tab (everyone)
- `stock` → Stock tab
- `khata` → Credit Accounts tab
- `reports` → Reports card in Menu
- `expenses` → Expenses card in Menu
- `settings` → User Management card, Settings tab in Reports

### User Management
- Admin menu → Users
- Admin can add/edit/delete users, toggle permissions, reset PIN
- Default admin (id: "u1") cannot be deleted

### Key Components
- `App.jsx` — layout: header + main + bottom nav, permission checks, COH badge, dark mode toggle, React Router navigation
- `AdminHub.jsx` — Menu hub with Reports/Expenses/Users/Cash on Hand cards
- `ReportsView.jsx` — 6-7 sub-tabs: Overview, Products, Customers, Hours, Staff, Bills, Settings
- `KhataView.jsx` — Credit Accounts ledger
- `InventoryView.jsx` — Stock management with stock value summary
- `UserManager.jsx` — User CRUD with permission toggles
- `AuthView.jsx` — PIN pad (keyboard + on-screen both work)
- `COHPanel.jsx` — Bottom-sheet panel for user's COH: balance, transfer, pending approvals, history
- `COHView.jsx` — Admin view: all balances grid, balance adjustment, full transaction log
- `ModalPortal.jsx` — portal to `#app-modal-layer` with Framer Motion fade-in + Escape key
- `AppShell.jsx` — fixed-position wrapper (`position: fixed; inset: 0; display: flex; flex-direction: column`)

### Database
- `db/auth.js` — login, logout, getUsers, saveUsers (exported)
- `db/coh.js` — Cash on Hand: balances, transfers, approve/reject
- `dbService` centralized in `firebase.js` → `db/index.js`
- Firebase mode uses email+password, local mode uses PIN

### Cash on Hand (COH)
- Every user has a COH balance stored in `pan_coh_balances`
- Transfers flow: sender initiates → receiver sees pending badge → receiver approves → balances update
- Header shows `💰 ฿XXXX` badge with pending count dot in red
- Admin (Menu → Cash on Hand) can adjust any user's balance with a note
- Full audit trail in `pan_coh_transactions`

## CSS Architecture
- `src/index.css` — Tailwind CSS v4 `@import "tailwindcss"` + custom design variables + component classes
- No inline `const styles = {…}` objects (all converted to CSS classes)
- Dark mode via `[data-theme="dark"]` attribute on `<html>`

## Common Fix Patterns
- Permission checks use `tab.perm` not `tab.key`
- `handleTabClick` receives tab object, uses `tab.perm || tab.key` for permission, `tab.key` for navigation
- `navItems` array is module-level (not inside component) — no rebuild on re-render
- `handleTabClick`, `handleSubNavigate`, `renderMainContent` wrapped in `useCallback` — stable references
- `activeTabRef` tracks activeTab for `handleSubNavigate` closure freshness
- Effect deps: use `user?.id`, `product?.id` not `user`, `product` (reference stability)
- `syncHelper` in `db/sync.js` was dead code (no imports) — fixed double-write pattern
- Use `useNavigate()` for navigation, not `window.location.hash`
- Use `useAuthStore()`, `useCartStore()`, `useConfirmStore()`, `useLangStore()` directly — no Context
- `fetch` calls use TanStack Query (staleTime: 30s, retry: 1)
- Modal state: COH → `useState` in App, Shift → `useState` in App, Confirm → `useConfirmStore`

## Tests
```bash
npm run build && npm run test
```
