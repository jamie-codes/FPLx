---
phase: 62
plan: 02
subsystem: frontend-hooks-math
tags: [mc-simulator, recharts, tanstack-query, trajectory-math, rank]
dependency_graph:
  requires: []
  provides:
    - recharts@3.8.1 (npm dependency for fan chart)
    - src/lib/hooks/useEntryRank.ts (FPL entry rank hook, MC-03 D-01)
    - src/lib/hooks/useGwAverage.ts (GW average hook, MC-03 D-04)
    - src/app/api/gw-average/route.ts (GW average API route, MC-03 D-04)
    - src/lib/rank-sim.ts (computeXITrajectory, computeXIPerGwStats, computeBeatTheAverageProb, ChartPoint)
    - src/lib/types.ts (MC fields: blank_prob, haul_prob, p10_pts, p90_pts added to MergedPlayer)
  affects:
    - Plan 03 (RankSimTab UI — consumes all artifacts above)
    - Plan 01 parallel (wave 1 — file-disjoint)
tech_stack:
  added:
    - recharts@^3.8.1 (ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer)
  patterns:
    - TanStack Query useQuery hook (useEntryRank mirrors useRivals.ts pattern, T-58-01 numeric guard)
    - Next.js App Router GET route (gw-average reads filesystem cache files)
    - Abramowitz & Stegun rational erf approximation for normal CDF (A&S 7.1.26, max error 1.5e-7)
    - Pure TypeScript math module (rank-sim.ts exports 3 functions + 1 type)
key_files:
  created:
    - src/lib/rank-sim.ts (168 lines — computeXITrajectory, computeXIPerGwStats, computeBeatTheAverageProb, ChartPoint, erf/normCdf)
    - src/lib/rank-sim.test.ts (162 lines — 12 unit tests covering empty input, captain doubling mean+sigma, sqrt(N) scaling, BGW zero-contribution, 3 CDF reference points)
    - src/lib/hooks/useEntryRank.ts (34 lines — TanStack Query hook, /^\d+$/ guard in enabled + queryFn)
    - src/lib/hooks/useEntryRank.test.ts (114 lines — 7 tests: 4 disabled states, fetch assertion, null-field guard, non-ok error)
    - src/app/api/gw-average/route.ts (49 lines — GW38→1 descending scan, non-zero average_score filter, null fallback)
    - src/lib/hooks/useGwAverage.ts (26 lines — TanStack Query hook, 30-min staleTime)
  modified:
    - package.json (recharts ^3.8.1 added to dependencies)
    - package-lock.json (lockfile updated)
    - src/lib/types.ts (MC fields blank_prob, haul_prob, p10_pts, p90_pts added to MergedPlayer)
decisions:
  - "useEntryRank uses /^\\d+$/ guard in BOTH enabled gate AND queryFn (defence-in-depth per T-58-01/T-62-05)"
  - "computeBeatTheAverageProb takes pre-computed cumMean, cumSigma, threshold — caller multiplies by N; no gwsAhead param"
  - "rank-sim.test.ts makeWrapper(0) overrides retry to 0 for the error test case — avoids backoff delay with fake timers"
  - "useGwAverage staleTime=30min matches /api/gw-average revalidate=1800 (30-min cache policy)"
  - "types.ts MC fields added in this plan (Phase 61 not yet executed in this worktree branch)"
metrics:
  duration: "~7 minutes"
  completed: "2026-05-06"
  tasks: 4
  files: 9
---

# Phase 62 Plan 02: Rank Simulator Data Layer & Math — Summary

One-liner: Pure-TypeScript rank trajectory math (sigma derivation, sqrt(N) cumulative band, Gaussian CDF) + FPL entry rank hook + GW average route, with Recharts 3.8.1 installed as the fan chart dependency.

## What Was Built

### Task 1: Install Recharts 3.8.1

`npm install recharts` added `recharts@^3.8.1` to `package.json`. Recharts 3.x ships its own TypeScript types — `@types/recharts` was NOT installed (it targets Recharts v1 and is incompatible with v3). Verified all 8 required exports resolve at runtime: `ComposedChart`, `Area`, `Line`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ResponsiveContainer`.

### Task 2: useEntryRank Hook + Tests (TDD)

`src/lib/hooks/useEntryRank.ts`: 34-line TanStack Query hook fetching `summary_overall_rank` and `summary_overall_points` from the existing FPL proxy at `/api/fpl/entry/${teamId}/`. Mirrors the `useRivals.ts` pattern exactly: `queryKey: ['entry-rank', teamId]`, `enabled: !!teamId && /^\d+$/.test(teamId)`, `staleTime: 1000 * 60 * 5`, `retry: 1`. Defence-in-depth: the same `/^\d+$/.test` guard runs inside `queryFn` (T-58-01/T-62-05 mitigation). Null guards return `null` for both fields when the FPL response omits them.

`src/lib/hooks/useEntryRank.test.ts`: 7 tests covering 4 disabled states (null, empty, non-numeric, mixed), correct fetch URL assertion, null-field guard, and non-ok response error.

Also added MC fields to `src/lib/types.ts` (`blank_prob`, `haul_prob`, `p10_pts`, `p90_pts`) — required for `rank-sim.ts` to compile against `MergedPlayer`. These fields are from Phase 61's `simulate.py` pipeline; they were not yet in this worktree branch.

### Task 3: /api/gw-average Route + useGwAverage Hook

`src/app/api/gw-average/route.ts`: GET route that scans `pipeline/cache/gw_review_gw{N}.json` files from GW38 down to GW1. Returns the first file with both a non-null `gw` field and a non-zero `average_score`. Falls back to `{ gw: null, average_score: null }` when no settled GW data exists (current dev state — no gw_review files in cache). Addresses Research Pitfall 3: the FPL bootstrap's `events[next].average_entry_score` is 0 pre-deadline, so this route reads from already-settled review files instead.

`src/lib/hooks/useGwAverage.ts`: Simple TanStack Query hook over `/api/gw-average` with `staleTime: 1000 * 60 * 30` (matching the route's 1800s revalidate policy).

Current dev-environment behavior against the empty cache: returns `{ gw: null, average_score: null }` — the RankSimTab will show `—` for P(rank gain/drop) stats and a disclaimer, per UI-SPEC SC-05.

### Task 4: computeXITrajectory + computeBeatTheAverageProb (TDD)

`src/lib/rank-sim.ts` (168 lines): Pure TypeScript math module with:
- `ChartPoint` interface: `{ gw, mean, p10, p90, altMean? }`
- `SIGMA_SCALE = 2.56` (two-tailed 90% normal interval constant, D-07)
- `computeXIPerGwStats(pickIds, captainId, playerMap)` returns `{ gwMean, gwSigma }`: sums xPts and variances across XI; captain's mean AND sigma both doubled (D-09); BGW zero-contribution natural via zero input fields (D-08)
- `computeXITrajectory(pickIds, captainId, playerMap)` returns `ChartPoint[6]`: origin at (Start, 0, 0, 0) then GW+1..GW+5 with `cumMean = N * gwMean` and `halfBand = sqrt(N) * gwSigma`
- `computeBeatTheAverageProb(cumMean, cumSigma, threshold)` returns probability: implements Abramowitz & Stegun 7.1.26 rational approximation for erf (max error 1.5e-7); short-circuits at `cumSigma <= 0` (T-62-10 mitigation for degenerate all-BGW squads)

`src/lib/rank-sim.test.ts` (162 lines): 12 tests verified against hand-computed values:
- Tests 1-3: empty input all-zero, correct GW labels, Start origin
- Tests 4-5: gwMean sum with and without captain doubling
- Tests 6-7: sigma_XI = sqrt(sum sigma^2) formula; captain sigma doubling adds 3*sigma^2 to varSum
- Test 8: sqrt(N) cumulative band scaling at GW+4
- Test 9: BGW player contributes 0 to mean and variance
- Tests 10-12: Phi(2)=0.9772, Phi(0)=0.5, Phi(4)=0.99997

## Test Results

| File | Pass | Total |
|------|------|-------|
| src/lib/hooks/useEntryRank.test.ts | 7 | 7 |
| src/lib/rank-sim.test.ts | 12 | 12 |

## Recharts Version

`recharts@3.8.1` — confirmed via `node -e "console.log(require('recharts/package.json').version)"` output: `3.8.1`.

`@types/recharts` was NOT installed (incompatible v1 package; Recharts v3 ships its own types).

## /api/gw-average Behavior Against Current Cache

Current `pipeline/cache/` has: `insights.json`, `price_changes.json`, `price_changes_snapshot.json` (no gw_review files).

Route returns: `{ "gw": null, "average_score": null }` — expected fallback per Research Pitfall 3. Production behavior (after `pipeline/run.py` PGW-02 runs): returns the most recent settled GW's average score.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] MC fields missing from types.ts in worktree**
- **Found during:** Task 4 setup (rank-sim.ts imports MergedPlayer and accesses p10_pts, p90_pts)
- **Issue:** This worktree branch predates Phase 61. `src/lib/types.ts` did not have `blank_prob`, `haul_prob`, `p10_pts`, `p90_pts` — causing TypeScript compile errors in rank-sim.ts
- **Fix:** Added MC fields to `MergedPlayer` in `src/lib/types.ts` (same as Phase 61's types.ts in main repo)
- **Files modified:** `src/lib/types.ts`
- **Commit:** `5b36f53`

**2. [Rule 1 - Bug] TanStack Query retry override in error test**
- **Found during:** Task 2 test execution
- **Issue:** The hook specifies `retry: 1` which overrides the QueryClient's `retry: false`. The error test for non-ok response was failing with fake timers because the retry backoff delay exceeded the waitFor timeout.
- **Fix:** `makeWrapper(retries = 0)` factory with a `retries` parameter; error test uses `makeWrapper(0)` and `waitFor({ timeout: 5000 })`. All 7 tests pass.
- **Files modified:** `src/lib/hooks/useEntryRank.test.ts`
- **Commit:** `5b36f53`

## Known Stubs

None. All functions are fully implemented with real logic (no hardcoded returns, no TODO bodies).

## Threat Flags

No new threat surface beyond what is documented in the plan's threat_model. The three mitigations are implemented:
- T-62-05: `/^\d+$/.test` in both `enabled` and `queryFn` in useEntryRank
- T-62-06: Hard-coded gw range 1..38 in /api/gw-average (no user input reaches readFile)
- T-62-10: `cumSigma <= 0` short-circuit in computeBeatTheAverageProb

## Self-Check: PASSED

All created files exist on disk. All 4 task commits verified in git history.

| Check | Result |
|-------|--------|
| src/lib/rank-sim.ts | FOUND |
| src/lib/rank-sim.test.ts | FOUND |
| src/lib/hooks/useEntryRank.ts | FOUND |
| src/lib/hooks/useEntryRank.test.ts | FOUND |
| src/app/api/gw-average/route.ts | FOUND |
| src/lib/hooks/useGwAverage.ts | FOUND |
| commit 7986410 (recharts install) | FOUND |
| commit 5b36f53 (useEntryRank + types.ts) | FOUND |
| commit c038e5d (gw-average route + hook) | FOUND |
| commit 60bf58f (rank-sim math + tests) | FOUND |
