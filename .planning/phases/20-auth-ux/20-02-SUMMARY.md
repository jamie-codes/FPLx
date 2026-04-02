---
phase: 20-auth-ux
plan: "02"
subsystem: auth-ux
tags: [auth, modal, expiry, transfer-panel]
dependency_graph:
  requires:
    - src/lib/auth-expiry.ts (computeAuthExpiryState — from plan 20-01)
    - src/components/transfers/AuthModal.tsx (modal component — from plan 20-01)
  provides:
    - src/components/transfers/TransferPanel.tsx (integrated auth modal trigger and three-state expiry display)
  affects:
    - Squad tab auth UX (user-facing)
tech_stack:
  added: []
  patterns:
    - computeAuthExpiryState called inline with Date.now() / 1000
    - Modal handlers via useCallback (openModal, closeModal, handleAuthSuccess)
    - AuthModal always in DOM (not conditionally rendered)
key_files:
  created: []
  modified:
    - src/components/transfers/TransferPanel.tsx
decisions:
  - "handleAuthSuccess calls setAuthenticated() then closes modal — ensures TanStack Query cache invalidated before modal disappears"
  - "expiryState computed outside useMemo (no heavy deps, inline computation is idiomatic)"
  - "AuthModal rendered unconditionally inside auth div — consistent with plan 20-01 Pitfall 4 guidance"
metrics:
  duration: "5 minutes"
  completed_date: "2026-04-02"
  tasks_completed: 2
  files_created: 0
  files_modified: 1
---

# Phase 20 Plan 02: TransferPanel Auth Modal Integration Summary

**One-liner:** Replaced inline token form in TransferPanel with AuthModal trigger and three-state expiry display (normal/expiring-soon/expired) wired to computeAuthExpiryState.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Integrate AuthModal and expiry display into TransferPanel | f68b804 | src/components/transfers/TransferPanel.tsx |
| 2 | Verify complete auth UX flow | human-verify | Approved 2026-04-02 |

## What Was Built

### Task 1: TransferPanel Auth Modal Integration

Modified `src/components/transfers/TransferPanel.tsx` with:

**Imports added:**
- `import { AuthModal } from '@/components/transfers/AuthModal'`
- `import { computeAuthExpiryState } from '@/lib/auth-expiry'`

**State removed (moved to AuthModal):**
- `showTokenForm`, `tokenInput`, `loginLoading`, `loginError` — all four removed

**State added:**
- `const [isModalOpen, setIsModalOpen] = useState(false)`

**Logic removed:**
- `handleLogin` callback (36 lines) — now lives entirely in AuthModal

**Logic added:**
- `expiryState = computeAuthExpiryState(expiresAt, Math.floor(Date.now() / 1000))`
- `openModal`, `closeModal`, `handleAuthSuccess` callbacks

**JSX replaced:**
- Inline token form (multi-state conditional, ~40 lines) → single "Connect FPL account" button that calls `openModal`
- Static "FPL connected" display → three-state conditional:
  - `expiryState === 'normal'`: "FPL connected • valid until HH:MM"
  - `expiryState === 'expiring-soon'`: amber "Expires soon — valid until HH:MM"
  - `expiryState === 'expired'`: amber "Token expired — reconnect" button that calls `openModal`
- `<AuthModal open={isModalOpen} onClose={closeModal} onSuccess={handleAuthSuccess} />` always rendered in DOM

**Net change:** 48 insertions, 80 deletions (32 lines net reduction — inline form was larger than the modal integration code)

## Verification

- `npx vitest run` — 174/174 tests pass, 8 skipped (unchanged from pre-task baseline)
- No modifications to auth Route Handlers (login, status, logout)
- No modifications to useAuthStatus hook
- Inline token form completely removed from TransferPanel

## Human Verification (Task 2 — checkpoint:human-verify)

**Status: APPROVED by user on 2026-04-02**

Verified:
1. Modal opens via "Connect FPL account for exact prices" link on Squad tab
2. 7-step Chrome DevTools guide visible in modal
3. Cancel, backdrop click, and Escape all close the modal
4. Paste button fills token input from clipboard
5. Saving a valid token closes modal and shows "FPL connected • valid until HH:MM"
6. Dark mode styling correct on modal and expiry text
7. Disconnect clears auth state and "Connect FPL account" link reappears

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all auth state paths are fully wired. Three-state expiry display reads from real `expiresAt` value from `useAuthStatus`. Modal submits to real `/api/auth/login` endpoint.

## Self-Check: PASSED
