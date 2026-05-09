---
phase: 83-gk-save-point-projections
plan: "04"
subsystem: frontend
tags: [typescript, react, vitest, gk, xpts, hover-card, columns]

requires:
  - phase: 83-02
    provides: pipeline/merge.py with save_pts as sixth xPts component in xPts_components_1gw

provides:
  - src/lib/types.ts xPts_components_1gw type extended with save_pts?: number
  - src/components/gem-table/columns.tsx XPtsCell with elementType prop, cardTotal including save_pts, conditional Saves row
  - src/components/gem-table/XPtsCell-saves.test.tsx with 3 Vitest cases (D-08 invariant, GK render guard, non-GK guard)

affects:
  - GemTable hover card display — when save_predictor_enabled gate is flipped ON after 5-GW shadow run, GKs will show Saves row in xPts breakdown

tech-stack:
  added: []
  patterns:
    - "Optional prop extension pattern: save_pts?: number and elementType?: number both optional — all existing callers compile without changes"
    - "Conditional spread in rows array: ...(condition ? [entry as [string, string]] : []) for type-safe conditional row"
    - "cardTotal ?? 0 summand: (c.save_pts ?? 0) ensures backward compatibility with cached merged_players.json that pre-dates pipeline change"

key-files:
  created:
    - src/components/gem-table/XPtsCell-saves.test.tsx
  modified:
    - src/lib/types.ts
    - src/components/gem-table/columns.tsx

key-decisions:
  - "elementType=1 guard in render — not in saves.py or merge.py; defense-in-depth matches D-07"
  - "cardTotal uses (c.save_pts ?? 0) so Total row correctly sums all components for GKs when gate ON"
  - "Saves row position: after Clean sheet (index 3), before Bonus (index 4) — matches UI-SPEC ordering"
  - "3gw/5gw XPtsCell accessors NOT modified — breakdown card suppressed for those windows by existing showBreakdown guard"

requirements-completed: [GK-02]

duration: ~2min
completed: 2026-05-09
---

# Phase 83 Plan 04: GK Save-Point Projections — XPtsCell UI Extension Summary

**XPtsCell extended with optional save_pts component and elementType render guard; conditional Saves row inserted between Clean sheet and Bonus for GKs when gate ON; 3-case Vitest test file confirms D-08 invariant, GK render guard, and non-GK guard**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-09T08:51:36Z
- **Completed:** 2026-05-09T08:53:50Z
- **Tasks:** 2 (Task 1: types.ts + columns.tsx 5-change extension; Task 2: XPtsCell-saves.test.tsx new file)
- **Files modified:** 2, created: 1

## Accomplishments

### Task 1 — types.ts + columns.tsx extension (commit `fb6bce0`)

All 5 plan changes applied:

1. **types.ts Change 1** — `xPts_components_1gw` inline type gains `save_pts?: number` at line 162 (Phase 83 GK-01; comment documents pipeline writes 0.0 for non-GK / gate-OFF, >0 for gate-ON GK)

2. **columns.tsx Change 2** — `XPtsCell` signature adds `elementType?: number` to the destructured params and the inline props type; `components` inline type gains `save_pts?: number`; both fully optional so existing callers compile without changes

3. **columns.tsx Change 3** — `cardTotal` formula extended from `(a + b + c + d + e).toFixed(2)` to `(a + b + c + d + e + (c.save_pts ?? 0)).toFixed(2)` with D-06/D-08 comment

4. **columns.tsx Change 4** — `rows` array gains conditional spread after Clean sheet, before Bonus: `...(c.save_pts !== undefined && c.save_pts > 0 && elementType === 1 ? [['Saves', c.save_pts.toFixed(2)] as [string, string]] : [])`. BGW GKs suppressed by `> 0` guard; non-GKs suppressed by `elementType === 1` guard.

5. **columns.tsx Change 5** — `xPts_1gw` column accessor passes `elementType={info.row.original.element_type}` alongside existing props. The 3gw/5gw accessors were intentionally NOT modified.

**Verification:** `npx vitest run src/components/gem-table/columns.test.tsx` → 15/15 passed; `npx tsc --noEmit` → exit 0.

### Task 2 — XPtsCell-saves.test.tsx (commit `cc063b0`)

New test file `src/components/gem-table/XPtsCell-saves.test.tsx` with 3 Vitest cases:

| Test | Description | Result |
|------|-------------|--------|
| D-08 invariant | `Math.abs(cardTotal - xPts_1gw) <= 0.015` for GK fixture | PASS |
| GK render guard | `elementType=1` + `save_pts=0.32` → 'Saves' text in DOM | PASS |
| Non-GK guard | `elementType=3` + `save_pts=0.32` → 'Saves' NOT in DOM | PASS |

**Full Vitest suite:** 1032 passed + 6 pre-existing failures (5 captain-picks.test.ts from Phase 57, 1 club-form.test.ts) unchanged.

## Final Line Ranges in Modified Files

| File | Change | Lines |
|------|--------|-------|
| `src/lib/types.ts` | `save_pts?: number` added | ~162 |
| `src/components/gem-table/columns.tsx` | `XPtsCell` signature (elementType + save_pts) | ~28-62 |
| `src/components/gem-table/columns.tsx` | `cardTotal` formula | ~84-90 |
| `src/components/gem-table/columns.tsx` | `rows` array (conditional spread) | ~95-109 |
| `src/components/gem-table/columns.tsx` | `xPts_1gw` accessor call site | ~279-295 |

## Vitest Test Count Delta

| File | Before | After | Delta |
|------|--------|-------|-------|
| `columns.test.tsx` | 15 | 15 | 0 (unchanged) |
| `XPtsCell-saves.test.tsx` | 0 | 3 | +3 (new) |
| Full suite | 1029 | 1032 | +3 |

## jsdom DOM Snapshot

When rendered with `elementType={1}` and `save_pts=0.32`, the XPtsCell hover card DOM includes:

```
Appearance  1.80
Goals       0.24
Assists     0.09
Clean sheet 1.44
Saves       0.32      ← new row, visible only for GKs with gate ON
Bonus       0.27
────────────────
Total       4.16
```

When rendered with `elementType={3}` (MID), the hover card contains no "Saves" text even when `save_pts=0.32` is present in the components object.

## Gate Status

The Saves row will NOT appear in production until:
1. Plan 03 (`accuracy.py` gate plumbing) ships and wires `save_predictor_enabled` into `run.py`
2. At least 5 GWs of shadow-run non-regression evidence confirms no xPts regression
3. `save_predictor_enabled` is manually flipped to `True` in `accuracy_backtest.json`

Until then, the pipeline writes `save_pts=0.0` for all players, the `> 0` render guard suppresses the row, and the existing Phase 48 Total display is identical to pre-Phase-83 output.

## Task Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | types.ts + columns.tsx 5-change extension | `fb6bce0` | src/lib/types.ts, src/components/gem-table/columns.tsx |
| 2 | XPtsCell-saves.test.tsx (3 GK-02 cases) | `cc063b0` | src/components/gem-table/XPtsCell-saves.test.tsx |

## Deviations from Plan

None — plan executed exactly as written. The exact content specified in the plan action blocks was used verbatim for all 5 changes to types.ts and columns.tsx, and the exact test file content was used for XPtsCell-saves.test.tsx.

The `--reporter=basic` flag in plan verification commands is not supported in this Vitest version (4.1.2); tests were run without the flag and produce equivalent output.

## Known Stubs

None — all code is fully implemented. The Saves row is conditionally visible based on real pipeline data (save_pts > 0) and player position (elementType === 1). No hardcoded empty values, placeholder text, or unwired data sources.

## Threat Flags

None — this plan adds a single React component prop and a conditional row render. No new network endpoints, auth paths, or I/O surfaces.

- T-83-04-01 (cardTotal drift): mitigated by Vitest invariant test asserting |cardTotal - xPts_1gw| <= 0.015
- T-83-04-02 (non-GK row disclosure): mitigated by elementType===1 render guard verified by test case 3

---
*Phase: 83-gk-save-point-projections*
*Completed: 2026-05-09*
