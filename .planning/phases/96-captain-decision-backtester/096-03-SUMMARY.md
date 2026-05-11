---
phase: 96-captain-decision-backtester
plan: "03"
subsystem: backtester-ts
tags: [typescript, regret, tanstack-query, localstorage, api-route, vercel-blob, tdd, green]

# Dependency graph
requires:
  - phase: 96-captain-decision-backtester
    plan: "01"
    provides: "Types (CaptainPickSnapshot, RegretEntry, DecisionHistory) + RED tests"

provides:
  - computeRegret / computeSeasonSummary pure functions in src/lib/regret.ts
  - RING_BUFFER_SIZE=38 constant + ringBufferKey / loadCachedHistory / persistHistory localStorage helpers
  - GET /api/decision-history route joining Blob snapshots with FPL picks
  - useDecisionHistory(teamId) TanStack Query hook with cache-first localStorage hydration
  - vitest.setup.ts Node 25 localStorage compatibility patch

affects:
  - 96-captain-decision-backtester/096-04 (UI wave — BackTab imports useDecisionHistory + computeSeasonSummary)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pure TS utility with JSDoc and named exports only (mirrors setPieceLeague.ts)
    - TanStack Query v5 useEffect persistence pattern (replaces deprecated v4 onSuccess)
    - Route handler joining two async data sources (Blob + FPL API) via Promise.all
    - localStorage ring buffer with SSR guard + try/catch (mirrors manual-plan.ts)
    - vitest setupFiles for test infrastructure compatibility (Node 25 + jsdom)

key-files:
  created:
    - src/lib/regret.ts
    - src/app/api/decision-history/route.ts
    - src/lib/hooks/useDecisionHistory.ts
    - vitest.setup.ts
  modified:
    - vitest.config.ts

key-decisions:
  - "D-06 formula uses ceiling.xPts_1gw (rounded to 1dp) as model side; user side is cap.total_points / cap.multiplier to recover raw pts from Triple Captain multiplier"
  - "SC-5 graceful degradation: single missing snapshot or picks failure folds to null fields in RegretEntry, never 502s the whole route; only FPL bootstrap failure 502s"
  - "TanStack Query v5 persistence: onSuccess is deprecated — useEffect reacting on [teamId, query.isSuccess, query.data] is the modern replacement"
  - "Rule 3 deviation: vitest.setup.ts patches window.localStorage/sessionStorage with jsdom-backed objects to fix Node v25 experimental WebStorage stub incompatibility"
  - "D-10: ENOENT / missing-blob / malformed JSON all collapse to hasSnapshot=false rather than 404 or 500"

# Metrics
duration: ~8min
completed: "2026-05-11"
---

# Phase 96 Plan 03: Wave 2 GREEN (TypeScript arm) Summary

**Pure regret computation utilities, Blob+FPL API joining route, and TanStack Query hook with localStorage ring-buffer — turning 13 Wave 1 RED tests GREEN**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-11T15:41:06Z
- **Completed:** 2026-05-11T15:49:00Z
- **Tasks:** 3
- **Files created:** 4 (+ 1 modified)

## Accomplishments

- Created `src/lib/regret.ts`: pure module with `computeRegret` (D-06 signed regret formula), `computeSeasonSummary`, `RING_BUFFER_SIZE=38`, `ringBufferKey`, `loadCachedHistory` (SSR-safe + shape validation), `persistHistory` (ring buffer trim). All 8 regret.test.ts tests GREEN.
- Created `src/app/api/decision-history/route.ts`: GET handler that validates teamId (`/^\d+$/`), fetches FPL bootstrap for finished events + element map, runs parallel Promise.all for per-GW Blob snapshot reads + FPL picks fetches, assembles RegretEntry[] with Triple Captain handling, returns DecisionHistory with cache headers. SC-5 graceful degradation: only FPL bootstrap failure 502s; per-GW failures fold to null fields.
- Created `src/lib/hooks/useDecisionHistory.ts`: TanStack Query v5 hook with 6h staleTime, enabled guard (`/^\d+$/`), cache-first `placeholderData` from `loadCachedHistory`, useEffect persistence via `persistHistory`. All 5 useDecisionHistory.test.ts tests GREEN.
- Created `vitest.setup.ts` + updated `vitest.config.ts` (Rule 3 deviation): Node v25 ships a broken `localStorage` stub that shadows jsdom's proper Storage interface in the vitest environment; setup file patches `window.localStorage/sessionStorage` with `globalThis.jsdom.window.localStorage` before each test.

## Task Commits

Each task was committed atomically:

1. **Task 1: regret.ts** - `452a27f` (feat)
2. **Task 2: decision-history/route.ts** - `122ca0a` (feat)
3. **Task 3: useDecisionHistory.ts + vitest Node 25 fix** - `d1a1b5c` (feat)

## Files Created/Modified

- `src/lib/regret.ts` — 6 exports + SeasonSummary interface; pure, no React, no fetch
- `src/app/api/decision-history/route.ts` — GET handler, Blob+FPL join, graceful degradation
- `src/lib/hooks/useDecisionHistory.ts` — TanStack Query v5 hook with cache-first + ring buffer persistence
- `vitest.setup.ts` — Node 25 localStorage compatibility patch
- `vitest.config.ts` — setupFiles entry pointing to vitest.setup.ts

## Test Counts Turned GREEN

| File | Tests | Status |
|------|-------|--------|
| src/lib/regret.test.ts | 8 | GREEN |
| src/lib/hooks/useDecisionHistory.test.ts | 5 | GREEN |
| **Total** | **13** | **GREEN** |

## Decisions Made

- **Regret formula model side**: `ceiling.xPts_1gw` rounded to 1 decimal place (D-08: snapshot value at decision time, not retrospective max)
- **Triple Captain handling**: `cap.total_points / cap.multiplier` recovers raw player points (handles TC multiplier=3); if multiplier=0 (edge case), falls back to raw total_points
- **SC-5 graceful degradation**: `readGwPicks` returns null on any failure (non-OK response, network error, shape mismatch); user-side fields fall back to null rather than erroring the whole route
- **Bootstrap-only 502**: only the FPL bootstrap failure 502s the route (needed to know which GWs are finished); per-GW failures are folded into null fields
- **TanStack Query v5 persistence**: `onSuccess` on `useQuery` is deprecated in v5; used `useEffect([teamId, query.isSuccess, query.data])` pattern instead
- **Node 25 localStorage fix scope**: patched via `setupFiles` (infrastructure fix) rather than modifying test files (which are locked from Plan 01)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Node v25 experimental localStorage stub breaks useDecisionHistory.test.ts**
- **Found during:** Task 3 verification
- **Issue:** Node v25.8.1 ships a global `localStorage` stub that doesn't implement the Storage interface (`getItem`/`setItem`/`clear` all undefined). vitest's `populateGlobal` helper skips `localStorage` when it detects it already exists in the Node global — so the jsdom-backed Storage never gets installed into `window.localStorage`.
- **Fix:** Created `vitest.setup.ts` with a `beforeEach` that detects `globalThis.jsdom` (vitest's jsdom fixture) and replaces `window.localStorage`/`window.sessionStorage` with the proper jsdom-backed Storage objects. Added `setupFiles: ['./vitest.setup.ts']` to `vitest.config.ts`.
- **Files modified:** `vitest.setup.ts` (new), `vitest.config.ts` (setupFiles entry)
- **Commits:** `d1a1b5c`
- **Regression check:** Full test suite run confirmed zero new failures; all pre-existing failures unchanged (captain-picks.test.ts 5, MobileNav.test.tsx 10, club-form.test.ts 1).

## Known Stubs

None — all three production files have fully-wired implementations. No placeholder values or TODO markers.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: input-validation | src/app/api/decision-history/route.ts | teamId param validated with `/^\d+$/` — matches threat T-96-09 (defence-in-depth against reflection XSS) |
| threat_flag: data-trust-boundary | src/app/api/decision-history/route.ts | Blob JSON parsed with try/catch; ceiling fields accessed with optional chaining; FPL picks validated Array.isArray — mitigates T-96-10, T-96-11 |

All threat flags match mitigations specified in the plan's threat model (T-96-09 through T-96-16). No new threat surface introduced beyond what was planned.

## Next Phase Readiness

Plan 04 (BackTab component + AccuracyTab restructure) is now unblocked:
- `useDecisionHistory` hook is available at `src/lib/hooks/useDecisionHistory.ts`
- `computeSeasonSummary` is available at `src/lib/regret.ts`
- `/api/decision-history` route is available for the BackTab to call
- SC-2, SC-4, SC-5 are all satisfied

---
*Phase: 96-captain-decision-backtester*
*Completed: 2026-05-11*
