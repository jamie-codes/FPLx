---
phase: 076-analytics-enhancements
plan: "03"
subsystem: ui
tags: [accuracy, drill-down, accordion, expand-row, react-fragment, single-expand, aria, tdd, vitest]

requires:
  - phase: 076-analytics-enhancements
    provides: UI design contract (076-UI-SPEC.md) specifying accordion shape, copy strings, and threshold definitions for ACC2-01

provides:
  - GwSummaryTable with expandable per-GW rows (single-expand pattern)
  - Inline drill-down panel with Haulers and xPts Flagged Misses sub-tables
  - xpts_flagged field on AccuracyPlayerGw type (types.ts) and pipeline per-player gw entries
  - 6 ACC2-01 vitest cases

affects:
  - AccuracyTab consumers (any phase adding to AccuracyTab)
  - pipeline/accuracy.py consumers (accuracy_backtest.json shape has new xpts_flagged field per player gw)

tech-stack:
  added: []
  patterns:
    - "React.Fragment accordion row pattern (row + conditional sibling drill-down row) — mirrors FixtureSwingDetector shape"
    - "Single-expand state: expandedGw: number | null (same as expandedTeamId in FixtureSwingDetector)"
    - "Flagged Misses sourced from data.players[].gws[] via flatMap — NOT data.haulters (mutually exclusive predicates)"
    - "Per-GW xpts_flagged lookup dict (xpts_flagged_by_gw_pid) in pipeline to propagate flag to all player gw entries"

key-files:
  created: []
  modified:
    - src/components/accuracy/AccuracyTab.tsx
    - src/components/accuracy/AccuracyTab.test.tsx
    - src/lib/types.ts
    - pipeline/accuracy.py

key-decisions:
  - "Flagged Misses must source from data.players[].gws[] NOT data.haulters — HAULTER_THRESHOLD=10 makes data.haulters mutually exclusive with actual_pts<=2 predicate"
  - "xpts_flagged added as optional field to AccuracyPlayerGw type (not breaking) and populated in pipeline via xpts_flagged_by_gw_pid lookup dict built in the GW ranking loop"
  - "colSpan={4} matches the 4-column GwSummaryTable header — unchanged by this plan"
  - "No useMemo inside rows.map() — inline Array.prototype.filter/flatMap per plan instructions (RESEARCH Pitfall 9)"

patterns-established:
  - "GW row accordion: each row wrapped in <Fragment key={r.gw}>; clickable <tr> + conditional drill-down <tr> as siblings"

requirements-completed: [ACC2-01]

duration: 15min
completed: 2026-05-07
---

# Phase 76 Plan 03: Analytics Enhancements — ACC2-01 Summary

**GW Accuracy Summary now has clickable expandable rows showing inline Haulers and xPts Flagged Misses sub-tables per gameweek, with single-expand, keyboard, and ARIA support**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-07T12:17:00Z
- **Completed:** 2026-05-07T12:21:00Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 4

## Accomplishments

- Extended `GwSummaryTable` in `AccuracyTab.tsx`: each per-GW row is now clickable (single-expand accordion) with aria-expanded, aria-controls, tabIndex=0, role="button", data-testid, and chevron ▾/▴
- Inline drill-down panel renders two sub-tables: Haulers (from `data.haulters` filtered by gw) and xPts Flagged Misses (from `data.players[].gws[]` via flatMap filtered by `xpts_flagged===true && actual_pts<=2`)
- Added `xpts_flagged?: boolean` to `AccuracyPlayerGw` type and populated it in `pipeline/accuracy.py` via a new `xpts_flagged_by_gw_pid` lookup dict built during the per-GW ranking pass
- 6 ACC2-01 vitest cases cover: aria-expanded toggle, drilldown testid, Haulers sub-table, Flagged Misses sub-table, single-expand, keyboard Enter — all pass; 11 pre-existing tests still green

## Threshold Definitions (UI-SPEC A2)

- **Hauler** = `data.haulters.filter(h => h.gw === r.gw)` — pipeline already gates on `actual_pts >= HAULTER_THRESHOLD (10)`
- **Flagged Miss** = `data.players.flatMap(p => p.gws.filter(g => g.gw === r.gw && g.xpts_flagged === true && g.actual_pts <= 2))` — sourced from `data.players[].gws[]` because `data.haulters` only contains `actual_pts >= 10` entries (mutually exclusive with `actual_pts <= 2`)

## Filter Source Rationale

`data.haulters` is populated in `pipeline/accuracy.py` only for `actual_pts >= HAULTER_THRESHOLD = 10`. A flagged-miss filter on `data.haulters` would always return `[]` because the predicates `actual_pts >= 10` and `actual_pts <= 2` are mutually exclusive. The Flagged Misses filter must use `data.players[].gws[]` which carries `xpts_flagged: boolean` for every player in every GW regardless of actual score.

## Single-Expand Pattern

`expandedGw: number | null` (matching `FixtureSwingDetector`'s `expandedTeamId` pattern). Clicking a GW row when it is expanded collapses it (sets to `null`); clicking a different row sets it to the new GW number, collapsing the previous row automatically. Rows are wrapped in `<Fragment key={r.gw}>` so the conditional drill-down `<tr>` is a sibling inside the same `<tbody>`.

## Task Commits

1. **Task 1: Extend AccuracyTab.test.tsx with 6 ACC2-01 failing cases (RED)** - `e14625e` (test)
2. **Task 2: Make GW rows clickable + render inline drill-down panel (GREEN)** - `378ed70` (feat)

## Files Created/Modified

- `src/components/accuracy/AccuracyTab.tsx` — Added `Fragment` import, `expandedGw` state, expandable row wrapping, drill-down panel with Haulers + Flagged Misses sub-tables
- `src/components/accuracy/AccuracyTab.test.tsx` — Extended fixture with `xpts_flagged` on `players[].gws[]`, added 6 ACC2-01 test cases
- `src/lib/types.ts` — Added `xpts_flagged?: boolean` to `AccuracyPlayerGw` interface
- `pipeline/accuracy.py` — Added `xpts_flagged_by_gw_pid` lookup dict; populated in GW ranking loop for all players; written to `per_player[pid]['gws']` entries

## Decisions Made

- Flagged Misses use `data.players[].gws[]` flatMap, not `data.haulters` — mutually exclusive predicates (HAULTER_THRESHOLD=10)
- `xpts_flagged` added as optional (`?`) to avoid breaking existing code paths that don't set it
- Pipeline change adds a 5-line lookup dict in the second-pass GW loop — no new HTTP calls, no data source changes
- No `useMemo` inside `rows.map()` — inline filter/flatMap per RESEARCH Pitfall 9 (max ~500 player entries total, trivially cheap per render)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added xpts_flagged to AccuracyPlayerGw type and pipeline**
- **Found during:** Task 2 (AccuracyTab.tsx implementation)
- **Issue:** `AccuracyPlayerGw` in `types.ts` lacked `xpts_flagged: boolean`. The plan acknowledged runtime data carries it but the type didn't reflect it. The pipeline's `per_player[pid]['gws']` entries also didn't write the field, so it would be `undefined` in production — making the Flagged Misses filter always return `[]`.
- **Fix:** Added `xpts_flagged?: boolean` to `AccuracyPlayerGw`; added `xpts_flagged_by_gw_pid` lookup dict in pipeline second pass; wrote `xpts_flagged` to each `per_player[pid]['gws']` entry.
- **Files modified:** `src/lib/types.ts`, `pipeline/accuracy.py`
- **Verification:** 6 ACC2-01 tests pass including the Flagged Misses sub-table test
- **Committed in:** `378ed70`

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical field for filter correctness)
**Impact on plan:** Essential for the Flagged Misses sub-table to function at all in production. No scope creep.

## Issues Encountered

None. Existing test failures (captain-picks 5, club-form 1) are pre-existing per STATE.md deferred items and were not introduced by this plan.

## Known Stubs

None — all filters wire directly to loaded `data.haulters` / `data.players[].gws[]` from the `useAccuracy` hook.

## Threat Flags

No new trust boundaries or network endpoints introduced. The drill-down renders `{h.player_name}` via React's default escaping (T-076-07 accepted in plan threat model). No new fields beyond what AccuracyTab already displayed.

## Next Phase Readiness

- ACC2-01 complete; GW row drill-down fully functional with Haulers and Flagged Misses sub-tables
- `pipeline/accuracy.py` now writes `xpts_flagged` to per-player gw entries; next pipeline run will produce correct data for production
- Ready for Phase 076 Plan 04 (OPT-01 — LineupTab captain/VC override)

## Self-Check

- [x] `src/components/accuracy/AccuracyTab.tsx` — modified (Fragment, expandedGw, drill-down)
- [x] `src/components/accuracy/AccuracyTab.test.tsx` — modified (6 ACC2-01 cases)
- [x] `src/lib/types.ts` — modified (xpts_flagged on AccuracyPlayerGw)
- [x] `pipeline/accuracy.py` — modified (xpts_flagged_by_gw_pid lookup + per_player write)
- [x] Commit `e14625e` (RED) exists in git log
- [x] Commit `378ed70` (GREEN) exists in git log
- [x] 17/17 AccuracyTab tests pass; no new failures in full suite

## Self-Check: PASSED

---
*Phase: 076-analytics-enhancements*
*Completed: 2026-05-07*
