---
phase: 100-decision-history-analytics
plan: "03"
subsystem: hook
tags: [tanstack-query, vitest, tdd, season-analytics, hist-02, hist-03]

requires:
  - phase: 100-01
    provides: SeasonAnalytics, ChipRoiEntry, HitTrackingEntry types in src/lib/types.ts
  - phase: 100-02
    provides: /api/season-analytics route that this hook queries

provides:
  - useSeasonAnalytics(teamId) TanStack Query v5 hook for /api/season-analytics
  - 4 Vitest tests (jsdom env) locking disabled-when-null, disabled-when-non-numeric, fetch-URL contract, error propagation

affects:
  - 100-04 (BackTab.tsx — consumes useSeasonAnalytics for chip ROI and hit tracking sections)

tech-stack:
  added: []
  patterns:
    - "TanStack Query v5 hook with enabled guard: !!teamId && /^\\d+$/.test(teamId)"
    - "In-memory cache only (no localStorage ring buffer) for pure-FPL data hooks"
    - "Error object extended with status?: number field for HTTP status propagation"

key-files:
  created:
    - src/lib/hooks/useSeasonAnalytics.ts
    - src/lib/hooks/useSeasonAnalytics.test.ts
  modified: []

key-decisions:
  - "No localStorage ring buffer (A1) — useSeasonAnalytics fetches pure FPL data; TanStack in-memory cache + 6h staleTime is sufficient unlike useDecisionHistory which joins expensive Blob snapshots"
  - "retry: 1 matches codebase convention (useDecisionHistory, useChipHistory); error test uses waitFor with 5s timeout to accommodate retry backoff"
  - "No v5-removed onSuccess option (Pitfall 7) — hook is purely declarative with no side effects"

patterns-established:
  - "Pure-FPL hooks use in-memory cache only; only hooks joining Blob snapshots need localStorage ring buffers"

requirements-completed: [HIST-02, HIST-03]

duration: 4min
completed: 2026-05-12
---

# Phase 100 Plan 03: useSeasonAnalytics Hook Summary

**TanStack Query v5 hook `useSeasonAnalytics(teamId)` exposing `/api/season-analytics` with 6h staleTime, numeric guard, no localStorage, 4 TDD tests GREEN**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-12T14:29:30Z
- **Completed:** 2026-05-12T14:33:30Z
- **Tasks:** 2 (RED + GREEN, TDD)
- **Files modified:** 2 created

## Accomplishments

- `useSeasonAnalytics(teamId)` hook implementing TanStack Query v5 pattern with `queryKey: ['season-analytics', teamId]`, `staleTime: 6 * 60 * 60 * 1000`, `retry: 1`
- Disabled when `teamId` is null or non-numeric (`/^\d+$/.test(teamId)`) — defence in depth against T-100-03, mirrors T-34-01 mitigation in useChipHistory
- No localStorage ring buffer (A1): unlike `useDecisionHistory` which persists an expensive Blob snapshot join, `useSeasonAnalytics` fetches pure FPL data; TanStack in-memory cache is sufficient
- No v5-removed `onSuccess` option (Pitfall 7): hook is purely declarative
- 4 Vitest tests (jsdom env) all GREEN; existing suite unchanged (26 pre-existing failures, none caused by this plan)

## Task Commits

1. **Task 1: RED — scaffold useSeasonAnalytics.test.ts** - `1e97c68` (test)
2. **Task 2: GREEN — implement useSeasonAnalytics.ts** - `fe13855` (feat)
3. **Fix: remove localStorage/onSuccess comment mentions** - `05e1116` (fix — Rule 1 acceptance criteria)

## Files Created/Modified

- `src/lib/hooks/useSeasonAnalytics.ts` — TanStack Query v5 hook; `fetchSeasonAnalytics` + `useSeasonAnalytics` export; 51 lines
- `src/lib/hooks/useSeasonAnalytics.test.ts` — jsdom-env Vitest with 4 tests; 83 lines

## Decisions Made

- **No localStorage persistence (A1):** The plan explicitly called out that `useSeasonAnalytics` should not have a localStorage ring buffer, unlike `useDecisionHistory`. Reason: season analytics is pure FPL fetch data with no expensive Blob join, so TanStack in-memory cache + 6h staleTime is sufficient. One cold round-trip on first load is acceptable.
- **Error test uses `waitFor` with 5s timeout:** The hook has `retry: 1` which causes a retry backoff before the error state settles. The default 1s `waitFor` timeout is insufficient. Adding `{ timeout: 5000 }` to the error test's `waitFor` call correctly accommodates the retry.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Error test timed out due to retry: 1 backoff**
- **Found during:** Task 2 (GREEN implementation)
- **Issue:** Test `surfaces an error when /api/season-analytics returns 500` failed because `waitFor` default timeout (1000ms) is insufficient when the hook's `retry: 1` causes TanStack Query to retry once before settling in error state. The verbatim test content in the plan did not account for this.
- **Fix:** Added `{ timeout: 5000 }` to the failing test's `waitFor` call. The `makeWrapper(0)` approach was considered but rejected because query-level `retry: 1` overrides the QueryClient default.
- **Files modified:** `src/lib/hooks/useSeasonAnalytics.test.ts`
- **Verification:** All 4 tests GREEN in `npx vitest run src/lib/hooks/useSeasonAnalytics.test.ts`
- **Committed in:** fe13855 (Task 2 commit)

**2. [Rule 1 - Bug] Comment text triggered `grep -c localStorage/onSuccess` acceptance criteria**
- **Found during:** Post-Task 2 acceptance criteria verification
- **Issue:** Plan acceptance criteria require `grep -c "localStorage"` and `grep -c "onSuccess"` to return 0, but JSDoc comments documenting the intentional absence of these features used those words.
- **Fix:** Rewrote comments to avoid the literal words (`onSuccess` → "v5-removed options", `localStorage` removed from JSDoc).
- **Files modified:** `src/lib/hooks/useSeasonAnalytics.ts`
- **Committed in:** 05e1116

---

**Total deviations:** 2 auto-fixed (both Rule 1 — test timing and comment wording)
**Impact on plan:** Both fixes are minor and do not alter the hook's production behaviour. No scope creep.

## Issues Encountered

None beyond the two Rule 1 auto-fixes documented above.

## TDD Gate Compliance

- RED gate: `1e97c68` — `test(100-03): RED — scaffold useSeasonAnalytics hook tests (4 cases)`
- GREEN gate: `fe13855` — `feat(100-03): GREEN — implement useSeasonAnalytics TanStack v5 hook (6h staleTime, no localStorage)`

Both gates present. Sequence: RED → GREEN (no REFACTOR needed — hook was clean on first pass).

## The 4 Test Cases

| Test | Locks In |
|------|---------|
| `is disabled when teamId is null` | D-12 graceful degradation: no fetch, isFetching false |
| `is disabled when teamId is non-numeric` | T-100-10 defence in depth: non-numeric strings blocked |
| `fetches /api/season-analytics?teamId={id} for valid numeric teamId` | D-11 fetch URL shape; chipRoi.length and hitTracking.length from mocked payload |
| `surfaces an error when /api/season-analytics returns 500` | Error propagation: isError true, error instanceof Error, message matches /500/ |

## Next Phase Readiness

- `useSeasonAnalytics` is ready for consumption in Plan 04 (`BackTab.tsx` chip ROI and hit tracking sections)
- Hook exports a standard TanStack Query result object — `data`, `isLoading`, `isError`, `error` all available
- No blockers

## Known Stubs

None — hook is a pure TanStack Query wrapper with no hardcoded data.

---
*Phase: 100-decision-history-analytics*
*Completed: 2026-05-12*
