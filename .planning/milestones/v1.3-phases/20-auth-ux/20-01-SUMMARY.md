---
phase: 20-auth-ux
plan: "01"
subsystem: auth-ux
tags: [auth, modal, tdd, pure-function, clipboard]
dependency_graph:
  requires: []
  provides:
    - src/lib/auth-expiry.ts (computeAuthExpiryState pure function)
    - src/components/transfers/AuthModal.tsx (modal component with guide + token form)
  affects:
    - src/components/transfers/TransferPanel.tsx (consumed in plan 20-02)
tech_stack:
  added: []
  patterns:
    - native <dialog> element for modal (no external library)
    - TDD red-green for pure utility functions
    - navigator.clipboard.readText() in user-gesture handler
key_files:
  created:
    - src/lib/auth-expiry.ts
    - tests/lib/auth-expiry.test.ts
    - src/components/transfers/AuthModal.tsx
  modified:
    - src/app/globals.css (added dialog::backdrop CSS)
decisions:
  - "dialog::backdrop styled via globals.css (not Tailwind backdrop: prefix) — Tailwind v4 backdrop: support unverified in this config; CSS rule is guaranteed to work"
  - "AuthModal always rendered in DOM (not conditionally) — prevents showModal() null ref on first open (Pitfall 4)"
  - "Clipboard failure is always silent — navigator.clipboard.readText() permission denied is expected in Firefox and some browser configs; manual paste still works"
metrics:
  duration: "2 minutes"
  completed_date: "2026-04-02"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 20 Plan 01: Auth Expiry Utility and AuthModal Component Summary

**One-liner:** Pure expiry threshold function with 8 boundary tests (TDD) and native `<dialog>` AuthModal with Chrome DevTools guide, clipboard paste, and token form submission.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Create computeAuthExpiryState pure function with TDD | 46251f2 | src/lib/auth-expiry.ts, tests/lib/auth-expiry.test.ts |
| 2 | Create AuthModal component | 01c56d1 | src/components/transfers/AuthModal.tsx, src/app/globals.css |

## What Was Built

### Task 1: computeAuthExpiryState (TDD)

Followed full TDD cycle:
- RED: Wrote `tests/lib/auth-expiry.test.ts` with 8 boundary tests covering all threshold cases. Tests failed as expected (module not found).
- GREEN: Created `src/lib/auth-expiry.ts` with `computeAuthExpiryState(expiresAt, nowSeconds)` implementing the `>= 3600 = normal`, `>= 900 = expiring-soon`, `< 900 or undefined = expired` thresholds. All 8 tests pass.

Boundary cases covered:
- `undefined` expiresAt → `expired`
- `> 3600s` remaining → `normal`
- `=== 3600s` remaining → `normal` (boundary: exactly 1hr is normal)
- `=== 3599s` remaining → `expiring-soon` (just under 1hr)
- `=== 900s` remaining → `expiring-soon` (exactly 15min)
- `=== 899s` remaining → `expired` (just under 15min)
- `=== 0s` remaining → `expired`
- `< 0s` remaining → `expired`

### Task 2: AuthModal Component

Created `src/components/transfers/AuthModal.tsx` as a `'use client'` component with:
- Native `<dialog>` element controlled via `showModal()` / `close()` in a `useEffect` keyed on `open` prop
- Always rendered in DOM (avoids Pitfall 4: null ref on first open)
- Escape key sync via `close` event listener (Pitfall 1 fix)
- Backdrop click dismiss via `e.target === dialogRef.current` check (Pitfall 2 fix)
- 7-step numbered Chrome DevTools guide mentioning `fantasy.premierleague.com`, `F12`, `Network` tab, `x-api-authorization`
- Clipboard paste button with `navigator.clipboard.readText()` in try/catch (silent failure per Pitfall 3)
- Token input with `font-mono` class and `placeholder="Paste Bearer token here..."`
- Form submission to `POST /api/auth/login` matching existing `handleLogin` pattern from TransferPanel
- Loading state: submit disabled, shows "Saving..."
- Error display: `{loginError && <span className="text-sm text-red-600">{loginError}</span>}`
- State reset (`tokenInput`, `loginError`) when `open` changes to `false`
- Dark mode aware: `dark:bg-zinc-900`, `dark:border-zinc-700`, `dark:text-zinc-100`, `dark:bg-zinc-800` throughout
- `active:scale-95 transition-transform` on submit and paste buttons

Added `dialog::backdrop { background: rgba(0, 0, 0, 0.5); }` to `globals.css` as the reliable fallback for backdrop styling (Tailwind `backdrop:` prefix support not verified in this project config).

## Verification

- `npx vitest run tests/lib/auth-expiry.test.ts` — 8/8 tests pass
- `npx tsc --noEmit` — no type errors (entire project)
- No modifications to existing auth Route Handlers or hooks

## Deviations from Plan

None — plan executed exactly as written.

The `dialog::backdrop` fallback in globals.css was called out in the plan itself as the recommended approach if Tailwind's `backdrop:` prefix doesn't compile, so this is not a deviation.

## Known Stubs

None — AuthModal is a complete implementation. All props (`open`, `onClose`, `onSuccess`) are wired through. The component is ready for integration in plan 20-02.

## Self-Check: PASSED
