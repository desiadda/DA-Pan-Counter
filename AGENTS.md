# DA Pan Counter — Project Context

## Overview
Paan shop POS system with billing, inventory, khata (credit accounts), reports, expenses, and graphical analytics. Works offline-first (localStorage) with optional Firebase cloud sync.

## Tech Stack
- React (Vite)
- Recharts (graphs)
- localStorage (default DB), Firebase (optional cloud)
- PIN-based auth (SHA-256 hashed)

## Architecture
### Auth & Roles
- Users stored in `pan_users` localStorage array
- Each user: `{ id, name, pin (hashed), role, permissions: { pos, stock, khata, reports, expenses, settings } }`
- PIN-only login (no email needed for local mode)
- Migration from old `pan_admin_pin`/`pan_staff_pin` happens automatically on first login after update
- Default users: Admin (PIN: 1234, all perms), Staff (PIN: 5555, POS only)

### Navigation
4 tabs: **POS**, **Stock**, **Credit Accounts**, **Menu**
- URL hash tracks full path: `#credit`, `#admin/reports/products`, etc.
- Sub-paths restored on refresh (e.g., `#admin/reports/products` opens Reports → Products tab)
- Old `#khata` hash auto-normalized to `#credit`
- Nav items have `key` (for URL) and `perm` (for permission check) — they can differ

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
- `App.jsx` — main nav, hash routing, permission checks, COH badge in header
- `AdminHub.jsx` — Menu hub with Reports/Expenses/Users/Cash on Hand cards
- `ReportsView.jsx` — 6-7 sub-tabs: Overview, Products, Customers, Hours, Staff, Bills, Settings
- `KhataView.jsx` — Credit Accounts ledger
- `InventoryView.jsx` — Stock management with stock value summary
- `UserManager.jsx` — User CRUD with permission toggles
- `AuthView.jsx` — PIN pad (keyboard + on-screen both work)
- `COHPanel.jsx` — Bottom-sheet panel for user's COH: balance, transfer, pending approvals, history
- `COHView.jsx` — Admin view: all balances grid, balance adjustment, full transaction log

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

## Common Fix Patterns
- Permission checks use `tab.perm` not `tab.key`
- `handleTabClick` receives tab object, uses `tab.perm || tab.key` for permission, `tab.key` for navigation
- Styles object must be included when rewriting components
- Always verify build + tests after changes

## Tests
```bash
npm run build && npm run test
```
