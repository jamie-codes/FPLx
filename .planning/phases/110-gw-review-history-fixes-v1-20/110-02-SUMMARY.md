---
phase: 110
plan: "02"
subsystem: api/gw-review
tags: [bugfix, api, fpl-live-endpoint, gw-review, tdd, fix-03, fix-04]
dependency_graph:
  requires: []
  provides: [liveMap-lookup, top_scorer_pts-fix, best_bench_player_pts-fix]
  affects: [src/app/api/gw-review/route.ts, src/app/api/gw-review/route.test.ts]
tech_stack:
  added: []
  patterns:
    - Standalone try/catch for optional FPL fetch (SC-5 graceful degradation)
    - liveMap (Map<number, number>) keyed by element id from event/{gw}/live/
    - liveMap.get(element) ?? 0 fallback pattern for settled GW points
key_files:
  created: []
  modified:
    - src/app/api/gw-review/route.ts
    - src/app/api/gw-review/route.test.ts
decisions:
  - Standalone try/catch for Step 4b — mirrors the dream-team block exactly, never wraps with Promise.all
  - Default live mock synthesised from pick.total_points so baseline tests remain deterministic without changes
  - topScorer derivation changed to use liveMap, then optimalCaptain = topScorer (field remains semantically correct)
metrics:
  duration: ~8 minutes
  completed: "2026-05-14"
  tasks: 2
  files: 2
---

# Phase 110 Plan 02: GW Review Live Points Fix (FIX-03 + FIX-04) Summary

**One-liner:** Standalone try/catch Step 4b fetches `event/{gw}/live/` to build `liveMap<id, pts>`; Step 5 reductions and output fields rewired to use `liveMap.get(element) ?? 0` instead of `pick.total_points` (which is 0 for settled GWs).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | RED — add FIX-03/04 TDD tests | d907cff | route.test.ts |
| 2 | GREEN — add Step 4b live-endpoint fetch and rewire Step 5 | e512420 | route.ts, route.test.ts |

## Implementation Details

### Step 4b Insertion (route.ts)

Inserted immediately after Step 4 (dream-team try/catch block, ending at line ~169), before Step 5. The new block:

```typescript
let liveMap: Map<number, number> = new Map()
try {
  const liveRes = await fetch(`${FPL_BASE}/event/${gw}/live/`, {
    headers: { 'User-Agent': 'fplx/1.17 (+https://fplx.app)' },
  })
  if (liveRes.ok) {
    const liveJson = (await liveRes.json()) as {
      elements?: Array<{ id: number; stats: { total_points: number } }>
    }
    if (Array.isArray(liveJson?.elements)) {
      liveMap = new Map(liveJson.elements.map((e) => [e.id, e.stats.total_points]))
    }
  }
} catch {
  // Degrade silently — liveMap stays empty → top_scorer_pts and best_bench_player_pts fall back to 0
}
```

Confirmed standalone (NOT wrapped in any `Promise.all`). The pitfall comment at lines 152-153 and 173 explicitly documents why.

### Step 5 Rewiring (route.ts)

- `topScorer` reduction: replaced `p.total_points > best.total_points` with `(liveMap.get(p.element) ?? 0) > (liveMap.get(best.element) ?? 0)`
- `bestBench` reduction: same swap for bench picks
- `optimalCaptain` is now derived from `topScorer` (same semantics — highest-scoring starter)
- Output `top_scorer_pts`: `liveMap.get(topScorer.element) ?? 0`
- Output `best_bench_player_pts`: `bestBench != null ? (liveMap.get(bestBench.element) ?? 0) : 0`

### Test Results

- `npx vitest run src/app/api/gw-review/route.test.ts`: **10/10 passed** (7 baseline + 3 new FIX-03/04)
- Full suite: 4 pre-existing failing test files unrelated to this plan (captain-picks, club-form, MobileNav, useRivals — all pre-Phase 110, documented in STATE.md deferred items)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Auto-add] Baseline test compatibility for liveMap**

- **Found during:** Task 2 GREEN — after implementing liveMap, 2 baseline PGW-01 tests failed because mock returned empty live data by default
- **Issue:** `mockUpstream` with no `live` argument returned `{ elements: [] }`, making `liveMap` empty — bench reduce with all-zero scores returned first pick instead of highest
- **Fix:** Updated `mockUpstream` to synthesise a default `effectiveLive` payload from `picks.total_points` when no explicit `live` param provided; baseline tests receive deterministic live data matching their pick setup without any test body changes
- **Files modified:** `src/app/api/gw-review/route.test.ts` (mockUpstream only)
- **Commit:** e512420

## TDD Gate Compliance

- RED gate: `test(110-02)` commit d907cff — 3 failing FIX-03/04 tests, 7 baseline passing
- GREEN gate: `feat(110-02)` commit e512420 — all 10 tests passing, no regressions
- REFACTOR: No cleanup needed — implementation matches plan exactly

## Known Stubs

None. The liveMap lookup is wired end-to-end. In production, `event/{gw}/live/` returns real data; in tests, the mock provides controlled values.

## Threat Surface Scan

No new threat surface added. The only new FPL fetch is `event/{gw}/live/` constructed from `FPL_BASE` (hardcoded constant) + `gw` (validated `/^\d+$/` upstream). Matches T-110-02-01 and T-110-02-02 mitigations in the plan threat register. No new endpoints, no new auth paths, no schema changes.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/app/api/gw-review/route.ts | FOUND |
| src/app/api/gw-review/route.test.ts | FOUND |
| 110-02-SUMMARY.md | FOUND |
| Commit d907cff (RED tests) | FOUND |
| Commit e512420 (GREEN implementation) | FOUND |
| 10/10 tests passing in route.test.ts | VERIFIED |
