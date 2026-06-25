---
status: resolved
trigger: "Full app health check before Vercel deployment"
created: "2026-06-26T00:55:00Z"
updated: "2026-06-26T00:55:00Z"
---

# Pre-Vercel Deep Audit

## Symptoms
- **Expected behavior**: App works correctly in production build with PWA, all views/routes function, no console errors, no runtime crashes, proper offline support
- **Actual behavior**: Need to verify all systems before Vercel push
- **Timeline**: Pre-deployment audit
- **Reproduction**: Build → serve → test each view, route, and feature

## Current Focus
- **Hypothesis**: (resolved) All findings investigated and fixed
- **Testing**: Verified with build + 29/29 tests passing
- **Next action**: Ready for Vercel deployment

## Evidence
- timestamp: 2026-06-26T01:00:00Z — Build passes (no errors) but 1006KB index chunk exceeds 500KB limit
- timestamp: 2026-06-26T01:00:10Z — PWA manifest references nonexistent PNG icons (only SVGs exist in public/)
- timestamp: 2026-06-26T01:00:15Z — Dark mode: app uses `data-theme="dark"` but ShadCN expects `.dark` class — causes CSS variable mismatch
- timestamp: 2026-06-26T01:00:20Z — Duplicate PWA files: public/manifest.json and public/sw.js conflict with vite-plugin-pwa generated versions
- timestamp: 2026-06-26T01:00:25Z — No hash redirect handling — old hash-style bookmarks (#/pos) will break
- timestamp: 2026-06-26T01:00:30Z — useUIStore has showCOH/showShift but App.tsx uses local useState instead (state duplication)
- timestamp: 2026-06-26T01:00:35Z — ErrorBoundary uses inline styles instead of Tailwind; only wraps main content, not panels
- timestamp: 2026-06-26T01:00:40Z — App.css is dead code (Vite template leftovers, not imported anywhere)
- timestamp: 2026-06-26T01:00:45Z — next-themes package installed but never used; sonner.tsx imports it
- timestamp: 2026-06-26T01:00:50Z — TypeScript deprecation warning: baseUrl deprecated in TS 7.0
- timestamp: 2026-06-26T01:01:00Z — AdminSettings and ErrorLogView imported statically (not lazy) in AdminHub
- timestamp: 2026-06-26T01:01:30Z — All fixes applied: build ✅ (no warnings, split chunks), 29/29 tests ✅

## Eliminated
- hypothesis: Zustand store hydration issues on page refresh — stores use localStorage directly (no hydration race condition)
- hypothesis: React Router catch-all conflict — `/*` → App, `/` → /pos redirect work correctly
- hypothesis: Mobile responsive breakpoints — extensive media queries in index.css cover all breakpoints
- hypothesis: localStorage schema compatibility — migrateOldPins() handles old PIN format; storage.ts has proper fallbacks
- hypothesis: Firebase offline/online — authStore.init() handles online/offline events and sync queue

## Resolution
- **root_cause**: Pre-deployment audit identified 11 issues across PWA, bundling, dark mode, state management, dead code, and error handling
- **fix**: 
  1. PWA manifest: Fixed icon references from nonexistent PNGs to existing SVGs; removed duplicate manifest.json/sw.js from public/ conflicting with vite-plugin-pwa
  2. Chunk splitting: Reduced main index chunk from 1006KB → 89KB (91% smaller) by splitting vendor libs (React, Firebase, UI, state) and lazy-loading AdminSettings/ErrorLogView
  3. Dark mode: Fixed ShadCN/Tailwind conflict — now sets both `data-theme="dark"` and `.dark` class simultaneously
  4. Hash redirect: Added HashRedirect component for old hash-based bookmarks
  5. State consolidation: useUIStore showCOH/showShift now used instead of local useState (removed duplication)
  6. Error boundary: Converted from inline styles to Tailwind classes; wrapped COHPanel/ShiftPanel/CartBottomSheet
  7. Dead code: Removed App.css (unused Vite template), removed `next-themes` dep, removed public/sw.js + public/manifest.json
  8. TypeScript: Added `ignoreDeprecations: "6.0"` for baseUrl deprecation warning
- **verification**: Build passes (no warnings), 29/29 tests pass, PWA precaches 34 entries
- **files_changed**: vite.config.ts, index.html, src/main.tsx, src/App.tsx, src/components/ErrorBoundary.tsx, src/components/AdminHub.tsx, src/components/ui/sonner.tsx, src/stores/uiStore.ts, src/App.css (deleted), public/manifest.json (deleted), public/sw.js (deleted), tsconfig.json, package.json (removed next-themes), package-lock.json
