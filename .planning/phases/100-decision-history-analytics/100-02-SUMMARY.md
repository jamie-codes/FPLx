---
phase: 100-decision-history-analytics
plan: "02"
subsystem: api
tags: [api-route, fpl-upstream, season-analytics, chip-roi, hit-tracking, vitest, tdd, typescript]

# Dependency graph
requires:
  - phase: 100-01
    provides: "ChipRoiEntry, HitTrackingEntry, SeasonAnalytics types in src/lib/types.ts"
provides:
  - "GET /api/season-analytics?teamId={id} — returns SeasonAnalytics { chipRoi, hitTracking }"
  - "8 route tests covering input validation, chip ROI assembly (D-04/D-05/Pitfall 6), hit identification (Pitfall 3), break-even arithmetic (Pitfall 4), partial-failure fold"
affects:
  - 100-03
  - 100-04

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Multi-FPL-endpoint parallel fetch with only top-level fetch aborting (502); secondary fetches fold to null/empty"
    - "fetchElementSummary partial-failure fold — /^\d+$/.test(elementId) guard + try/catch return null"
    - "Pitfall 6 guard — empty current[] short-circuit before division"
    - "D-07 break-even: row.round >= event inclusive, netPts = inPts - outPts - 4, brokeEven = netPts > 0"

key-files:
  created:
    - src/app/api/season-analytics/route.ts
    - src/app/api/season-analytics/route.test.ts
  modified: []

key-decisions:
  - "history/ fetch is the only abort point (502); transfers/, bootstrap-static/, and element-summary/ all fold gracefully"
  - "Bootstrap element map fetched in parallel with history + transfers (not sequentially) to minimize wall time"
  - "FPL_UA updated to fplx/1.17 to match current phase"

patterns-established:
  - "seasonAvgPoints = sum(current[].points) / current.length; Pitfall 6 guard: if current.length === 0 return empty arrays immediately"
  - "break-even uses cumulative sum of total_points where round >= event (INCLUSIVE per Pitfall 4)"

requirements-completed: [HIST-02, HIST-03]

# Metrics
duration: 3min
completed: 2026-05-12
---

# Phase 100 Plan 02: Season Analytics Route Summary

**`/api/season-analytics` server-side route joining FPL history, transfers, and per-player element-summary to produce chip ROI (HIST-02) and hit break-even tracking (HIST-03)**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-12T14:29:20Z
- **Completed:** 2026-05-12T14:32:00Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files created:** 2

## Accomplishments

- `GET /api/season-analytics?teamId={id}` returns `{ chipRoi: ChipRoiEntry[], hitTracking: HitTrackingEntry[] }` with 200 + Cache-Control
- Chip ROI assembles BB/TC/FH entries only (D-04 — Wildcard excluded), comparing each chip GW score to season average (D-05)
- Hit tracking emits one `HitTrackingEntry` per transfer pair in a hit GW (Pitfall 3 — multi-transfer GWs), with cumulative points from transfer GW inclusive (Pitfall 4)
- Partial-failure fold: per-player `/element-summary/` failures produce null pts fields; route only 502s if top-level `/history/` fails
- 8 route tests TDD RED→GREEN, tsc --noEmit clean, existing suite unaffected

## FPL Endpoints Consumed

| Endpoint | Failure behaviour |
|----------|------------------|
| `GET /entry/{id}/history/` | Returns 502 (only abort) |
| `GET /entry/{id}/transfers/` | Folds to `[]` (graceful) |
| `GET /bootstrap-static/` | Folds to empty `Map` → player names become null |
| `GET /element-summary/{id}/` | Folds to null → pts fields null, netPts null, brokeEven null |

## Key Formulae

**seasonAvgPoints** (D-05):
```
seasonAvgPoints = sum(current[i].points for all i) / current.length
Pitfall 6 guard: if current.length === 0 → return { chipRoi: [], hitTracking: [] } immediately
```

**Break-even arithmetic** (D-07, Pitfall 4 inclusive):
```
inPts  = sum(history[round >= event].total_points)   // transfer GW INCLUSIVE
outPts = sum(history[round >= event].total_points)
netPts = inPts - outPts - 4
brokeEven = netPts > 0
```

**Hit identification** (D-08, Pitfall 3):
```
hitGws = Set of events where event_transfers_cost > 0
hitTransfers = transfers.filter(t => hitGws.has(t.event))
// Each transfer pair in a hit GW → one HitTrackingEntry row
```

## Task Commits

1. **Task 1: RED — scaffold /api/season-analytics route tests (8 cases, 4 contracts)** — `a42366a` (test)
2. **Task 2: GREEN — implement /api/season-analytics route for chip ROI + hit break-even** — `27aa429` (feat)

## Files Created

- `src/app/api/season-analytics/route.ts` — GET handler; parallel FPL fetch (history + transfers + bootstrap); chip ROI assembly (D-04 filter, D-05 delta); hit identification (D-08); per-player element-summary in parallel with partial-failure fold; break-even arithmetic (D-07 inclusive, Pitfall 4); Cache-Control header; User-Agent `fplx/1.17 (+https://fplx.app)`
- `src/app/api/season-analytics/route.test.ts` — 8 node-env Vitest tests covering: 400 on invalid teamId (T-100-03), wildcard exclusion (D-04), season average + delta (D-05), empty current guard (Pitfall 6), multi-transfer hit GW (Pitfall 3), inclusive break-even (Pitfall 4), partial-failure fold

## Decisions Made

- History fetch is the single abort point (502); all other FPL calls degrade gracefully — mirrors decision-history/route.ts pattern where bootstrap was the abort point
- Bootstrap element map fetched in parallel with history + transfers via `Promise.all([fetchHistory, fetchTransfers, fetchBootstrapElementMap])` to minimize wall time
- `FPL_UA` updated to `fplx/1.17` matching the current phase (v1.16 route used `fplx/1.11`)

## Deviations from Plan

None — plan executed exactly as written. The route implementation mirrors the plan's action block verbatim. All 8 tests pass GREEN. tsc --noEmit clean.

## Issues Encountered

Pre-existing test failures in `tests/lib/captain-picks.test.ts` (5 failures — TEST-57 deferred item), `src/components/nav/MobileNav.test.tsx` (10 failures — WR-03/04 deferred item), `tests/lib/club-form.test.ts` (1 failure), and `src/lib/hooks/useRivals.test.ts` (9 failures) are pre-existing issues listed in STATE.md deferred items. None are caused by this plan's changes.

## Security / Threat Model

- T-100-03: `teamId` validated against `/^\d+$/` at route entry (returns 400); same guard applied to `elementId` before `/element-summary/` URL construction (belt-and-braces per T-100-08)
- T-100-04/05: Untrusted FPL JSON guarded with `Array.isArray` and `typeof` checks before arithmetic
- No proxy usage (`/api/fpl/[...proxy]` never called — Pitfall 2) — FPL_BASE direct fetch only

## Next Phase Readiness

- `GET /api/season-analytics` is ready for Plan 03 (`useSeasonAnalytics` hook) and Plan 04 (BackTab UI extension)
- Route returns Cache-Control `public, s-maxage=1800, stale-while-revalidate=86400`
- SeasonAnalytics type is fully defined in src/lib/types.ts (from Plan 01)

## Self-Check

- [x] `src/app/api/season-analytics/route.ts` exists
- [x] `src/app/api/season-analytics/route.test.ts` exists
- [x] Commit `a42366a` (test RED) exists
- [x] Commit `27aa429` (feat GREEN) exists
- [x] 8 tests pass, tsc --noEmit clean

## Self-Check: PASSED

---
*Phase: 100-decision-history-analytics*
*Completed: 2026-05-12*
