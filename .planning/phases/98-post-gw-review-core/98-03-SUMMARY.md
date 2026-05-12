---
phase: 98-post-gw-review-core
plan: 03
subsystem: hooks/page
tags: [tanstack-query, react-hook, useEffect, localStorage, fpl-bootstrap, auto-surface, pgw-04, pgw-02]

# Dependency graph
requires:
  - phase: 98-01
    provides: "FPLEventSchema with data_checked field; FPLEvent interface parity"
  - phase: 73-post-gw-review
    provides: "GwReviewTab component accepting settledGws prop"
provides:
  - "useSettledGws hook returning number[] of last 3 settled GWs (ascending)"
  - "PGW-04 auto-surface useEffect in page.tsx (Squad > Review on first settled GW visit)"
  - "PGW-02 live-data uplift: GwReviewTab now receives live settled GWs not placeholder"
affects: [page.tsx, GwReviewTab, useSettledGws]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useQuery hook with proxy fetch + parseFPLBootstrap + filter + slice(-3) pattern"
    - "localStorage try/catch auto-surface useEffect with idempotency guard"
    - "Global beforeEach sets seen-flag in page.test.tsx to prevent auto-surface from redirecting existing tests"

key-files:
  created:
    - src/lib/hooks/useSettledGws.ts
    - src/lib/hooks/useSettledGws.test.ts
  modified:
    - src/app/page.tsx
    - src/app/page.test.tsx

key-decisions:
  - "useEffect insertion site: immediately after useSettledGws() call, before teamId state block (lines 110-131 post-edit)"
  - "localStorage key pgw-reviewed:GW{N}: no TTL, written synchronously at navigation moment, persists indefinitely — settled GW data is immutable"
  - "setSectionMemory((prev) => ({ ...prev, squad: 'review' })) not setActiveSubTab — setActiveSubTab does not exist in page.tsx (Pitfall 1 avoided)"
  - "useSettledGws uses /api/fpl/bootstrap-static/ proxy (not direct fantasy.premierleague.com) — consistent with existing client-side patterns"
  - "waitFor timeout increased to 5000ms in error test — hook retry: 1 delays error state beyond default 1000ms waitFor timeout"
  - "Global beforeEach in page.test.tsx sets pgw-reviewed:GW35 to prevent auto-surface from redirecting existing tests; Phase 98 tests manage this key themselves"

# Metrics
duration: ~15min
completed: 2026-05-12
---

# Phase 98 Plan 03: useSettledGws Hook + PGW-04 Auto-Surface Summary

**`useSettledGws` hook replacing SETTLED_GWS_PLACEHOLDER with live FPL bootstrap data; PGW-04 useEffect auto-navigating to Squad > Review on first visit after GW settles via localStorage one-time flag**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-12T10:25:00Z
- **Completed:** 2026-05-12T10:30:00Z
- **Tasks:** 2
- **Files modified:** 4 (2 new, 2 modified)

## Accomplishments

- `src/lib/hooks/useSettledGws.ts` — NEW TanStack Query hook (35 lines). Fetches `/api/fpl/bootstrap-static/` via internal proxy, validates with `parseFPLBootstrap`, filters events where `finished && data_checked`, returns last 3 IDs via `slice(-3)`. 1-hour `staleTime`, `retry: 1`.
- `src/lib/hooks/useSettledGws.test.ts` — NEW jsdom Vitest suite (92 lines, 4 cases): empty path, D-06 double-flag filter, D-07 slice(-3) ascending order, error path (non-OK status).
- `src/app/page.tsx` — `SETTLED_GWS_PLACEHOLDER` constant and 7-line comment block removed; `useSettledGws` imported and called; `GwReviewTab` receives live `settledGws` prop; PGW-04 `useEffect` added with localStorage idempotency guard + try/catch SSR safety; `useEffect` added to React import.
- `src/app/page.test.tsx` — `vi.mock` for `useSettledGws` (returns `[33, 34, 35]`) and `GwReviewTab`; 2 new auto-surface tests (first-visit navigates, second-visit does not); global `beforeEach` added to prevent redirect in existing tests.

## Task Commits

1. **Task 1: Create useSettledGws hook + jsdom test suite** — `4cb4db8`
2. **Task 2: Wire useSettledGws into page.tsx + PGW-04 auto-surface useEffect + update page.test.tsx** — `b70155c`

## Files Created/Modified

- `src/lib/hooks/useSettledGws.ts` — NEW hook (35 lines)
- `src/lib/hooks/useSettledGws.test.ts` — NEW test suite (92 lines, 4 cases)
- `src/app/page.tsx` — SETTLED_GWS_PLACEHOLDER removed; useSettledGws wired; PGW-04 useEffect added; useEffect added to React import
- `src/app/page.test.tsx` — vi.mock for useSettledGws + GwReviewTab; 2 auto-surface test cases; global beforeEach for flag management

## Decisions Made

- **useEffect insertion site:** Immediately after the `const { data: settledGws = [] } = useSettledGws()` line, inside `Home()` before the teamId state block. React guarantees `setActiveSection` and `setSectionMemory` are stable references, so they are excluded from the dep array.
- **localStorage key format:** `pgw-reviewed:GW{N}` where N is the integer GW number (e.g. `pgw-reviewed:GW35`). No TTL — settled GW data is immutable. Written synchronously at navigation moment before next render (D-04).
- **`setSectionMemory` not `setActiveSubTab`:** `setActiveSubTab` does not exist in `page.tsx`. The sub-tab state lives in `sectionMemory: Record<Section, SubTab | null>`. Used `setSectionMemory((prev) => ({ ...prev, squad: 'review' }))` per PATTERNS.md critical pitfall note.
- **Proxy URL:** `useSettledGws` fetches `/api/fpl/bootstrap-static/` (internal Next.js proxy), NOT `fantasy.premierleague.com` directly. Matches the existing client-side hook pattern (`useRivals` line 55).
- **Error test timeout:** Increased `waitFor` timeout to 5000ms in the error test case because the hook's `retry: 1` (which overrides `defaultOptions.queries.retry: 0` per TanStack Query v5 merge order) delays the error state by ~1000ms beyond the default `waitFor` timeout.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PGW-04 useEffect redirected existing page.test.tsx tests away from default Analyse landing**
- **Found during:** Task 2 verification (npx vitest run src/app/page.test.tsx)
- **Issue:** The `useSettledGws` mock returns `[33, 34, 35]`; on mount the PGW-04 useEffect fires and navigates to Squad > Review (localStorage had no `pgw-reviewed:GW35` flag). This broke the "default landing is Analyse" test and several others.
- **Fix:** Added a global `beforeEach` at the top of `page.test.tsx` that sets `pgw-reviewed:GW35` = `'1'` — simulating "user has already seen GW35 review". The Phase 98 auto-surface describe block uses its own `beforeEach(() => window.localStorage.clear())` to reset state for its own tests.
- **Files modified:** `src/app/page.test.tsx`
- **Verification:** All 17 pre-existing page.test.tsx tests pass; all 2 new auto-surface tests pass.

**2. [Rule 2 - Missing Critical] waitFor timeout insufficient for error path due to hook retry**
- **Found during:** Task 1 verification (first test run of useSettledGws.test.ts)
- **Issue:** `waitFor(() => expect(result.current.isError).toBe(true))` timed out (1000ms default). TanStack Query v5 merges per-query options LAST — so the hook's `retry: 1` overrides `defaultOptions.queries.retry: 0` set in the test wrapper. With retry delay ~1000ms, error state not reached within 1000ms timeout.
- **Fix:** Added `{ timeout: 5000 }` to the `waitFor` call in the error test case.
- **Files modified:** `src/lib/hooks/useSettledGws.test.ts`
- **Verification:** All 4 useSettledGws tests pass.

---

**Total deviations:** 2 auto-fixed (1 test isolation bug, 1 test timeout)
**Impact on plan:** Both fixes required for test correctness. No scope creep. Final test count matches plan spec (4 hook tests + 2 new page tests).

## Known Stubs

None — no hardcoded values flow to UI rendering from this plan's changes. `useSettledGws` returns live bootstrap data; the `settledGws = []` default is a safe loading fallback, not a stub.

## Threat Flags

No new security-relevant surface introduced. The `pgw-reviewed:GW{N}` localStorage key stores only an integer GW number + sentinel `'1'`. No PII. No new network endpoints. Matches threat model T-98-08 through T-98-12 documented in the plan.

## Self-Check: PASSED

- `src/lib/hooks/useSettledGws.ts` — EXISTS, 35 lines, contains `export function useSettledGws`
- `src/lib/hooks/useSettledGws.test.ts` — EXISTS, 92 lines, 4 test cases
- `src/app/page.tsx` — EXISTS, SETTLED_GWS_PLACEHOLDER removed, useSettledGws imported and called
- `src/app/page.test.tsx` — EXISTS, useSettledGws mock present, 2 new test cases
- Commit `4cb4db8` — FOUND (Task 1: useSettledGws hook + tests)
- Commit `b70155c` — FOUND (Task 2: page.tsx wiring + page.test.tsx updates)
- `npx tsc --noEmit` — no errors
- `npx vitest run src/app/page.test.tsx src/lib/hooks/useSettledGws.test.ts` — 21 passed, 0 failed

---
*Phase: 98-post-gw-review-core*
*Completed: 2026-05-12*
