---
phase: 12-fpl-auth-exact-selling-price
plan: "02"
subsystem: auth
tags: [tanstack-query, react, fpl-auth, selling-price, ux]

# Dependency graph
requires:
  - phase: 12-fpl-auth-exact-selling-price-01
    provides: Auth Route Handlers (login/logout/status/my-team), squad-adapter MyTeamResponse type
provides:
  - useAuthStatus TanStack Query hook with setAuthenticated/clearAuthenticated helpers
  - useMyTeam TanStack Query hook gated on auth state, invalidates auth on 401
  - TransferPanel login nudge (inline form), auth state wiring, exactSellPrices prop passing
  - SquadView tilde-prefixed approximate prices (unauthenticated) and exact prices (authenticated)
affects: [squad-view, transfers, captaincy, phase-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Auth query invalidation: useMyTeam 401 response clears auth-status via setQueryData without refetch"
    - "Optional auth enrichment: all props optional, unauthenticated path is default, auth only enriches"
    - "Tilde prefix convention: ~£X.Xm with (approx) label and tooltip for unauthenticated sell prices"

key-files:
  created:
    - src/lib/hooks/useAuthStatus.ts
    - src/lib/hooks/useMyTeam.ts
  modified:
    - src/components/transfers/TransferPanel.tsx
    - src/components/squad/SquadView.tsx

key-decisions:
  - "exactSellPrices and isAuthenticated passed as optional props to SquadView — unauthenticated path unchanged"
  - "effectiveEntryHistory in TransferPanel uses my-team entry_history when authenticated (exact bank balance per D-06)"
  - "useMyTeam enabled only when isAuthenticated && !!submittedId — avoids unnecessary 401 fetches"

patterns-established:
  - "Auth hook pattern: useAuthStatus returns isAuthenticated + optimistic setAuthenticated/clearAuthenticated"
  - "Login nudge placement: inline below squad heading, not modal — reduces friction per D-01"

requirements-completed: [AUTH-01, AUTH-02]

# Metrics
duration: 35min
completed: 2026-03-30
---

# Phase 12 Plan 02: FPL Auth Client UX Summary

**Inline FPL login form with TanStack Query auth hooks delivering exact sell prices (£X.Xm) and tilde-prefixed approximate prices (~£X.Xm) toggled by auth state, without gating any squad features**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-03-30T21:40:00Z
- **Completed:** 2026-03-30T22:20:00Z
- **Tasks:** 3 (2 auto + 1 human-verify)
- **Files modified:** 4

## Accomplishments

- Created useAuthStatus hook with optimistic setAuthenticated/clearAuthenticated helpers using TanStack Query's setQueryData
- Created useMyTeam hook that invalidates auth-status on 401, handling session expiry gracefully
- Wired inline login form into TransferPanel with email/password, error display, loading state, and logout button
- SquadView now shows ~£X.Xm (approx) for unauthenticated and exact £X.Xm for authenticated sell prices and bank balance
- Human end-to-end verification passed across all 13 verification steps

## Task Commits

Each task was committed atomically:

1. **Task 1: useAuthStatus and useMyTeam hooks** - `c1cfce1` (feat)
2. **Task 2: TransferPanel login nudge + SquadView price display** - `2f691d7` (feat)
3. **Task 3: Verify auth flow end-to-end** - `bdc1c70` (chore - human-verified)

## Files Created/Modified

- `src/lib/hooks/useAuthStatus.ts` - TanStack Query hook for /api/auth/status with optimistic setAuthenticated/clearAuthenticated
- `src/lib/hooks/useMyTeam.ts` - TanStack Query hook for /api/fpl/my-team, gated on auth state, invalidates auth on 401
- `src/components/transfers/TransferPanel.tsx` - Login nudge (form + logged-in indicator), exactSellPrices map from my-team data, effectiveEntryHistory
- `src/components/squad/SquadView.tsx` - Optional exactSellPrices/isAuthenticated props, tilde prefix for unauthenticated prices, exact prices for authenticated

## Decisions Made

- exactSellPrices and isAuthenticated are optional props to SquadView — unauthenticated path completely unchanged, auth only enriches
- effectiveEntryHistory uses my-team entry_history when authenticated, giving exact bank balance per D-06
- useMyTeam gated on `isAuthenticated && !!submittedId` — avoids unnecessary authenticated fetch attempts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. All 163 tests passed throughout execution.

## User Setup Required

None - no external service configuration required. FPL credentials are entered by the user in the inline login form at runtime.

## Known Stubs

None. All data flows are wired: exactSellPrices sourced from useMyTeam picks, isAuthenticated from useAuthStatus, effectiveEntryHistory from myTeamData.

## Next Phase Readiness

- Phase 12 complete: FPL auth server layer (Plan 01) and client UX (Plan 02) both shipped
- AUTH-01 and AUTH-02 requirements fulfilled
- Sell prices shown are exact when authenticated, approximate with clear labelling when not
- No feature gates — all squad functionality works without login

---
*Phase: 12-fpl-auth-exact-selling-price*
*Completed: 2026-03-30*
