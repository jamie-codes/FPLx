---
phase: 061-mc-simulation-core
plan: 03
subsystem: frontend/gem-table
tags: [monte-carlo, frontend, react, hover-card, gem-table, tdd-green]
dependency_graph:
  requires: [061-01]
  provides: [MC-02-ui]
  affects: [src/components/gem-table/columns.tsx]
tech_stack:
  added: []
  patterns: [conditional-render-guard, optional-props-threading, amber-threshold-class]
key_files:
  created: []
  modified:
    - src/components/gem-table/columns.tsx
decisions:
  - "MC rows rendered via inline JSX divs (not rows[] array) to support per-row conditional className on Haul% amber value"
  - "showMC guard placed after cardTotal computation — no cost, and keeps all conditional logic together before JSX"
  - "haulProb amber class applied only to the value span, not the label span — matches UI-SPEC.md §Color (label always muted)"
  - "xPts_3gw and xPts_5gw column cells NOT modified per D-13 — MC props only meaningful on 1GW window"
metrics:
  duration: "8 minutes"
  completed: "2026-05-05T21:16:56Z"
  tasks_completed: 1
  tasks_total: 1
  files_created: 0
  files_modified: 1
---

# Phase 61 Plan 03: XPtsCell MC Hover Card Extension Summary

Extended XPtsCell hover card with four MC stat rows (Blank%, Haul%, Floor, Ceiling) rendered conditionally between the 5-component breakdown and the Total row, with Haul% amber coloring at >= 0.40 threshold, threading MC props from xPts_1gw column cell via row.original.

## What Was Built

### Task 1: XPtsCell MC prop extension + hover card MC rows + column threading

Three edits to `src/components/gem-table/columns.tsx`:

**Edit 1: XPtsCell signature extended** (lines 27-57)

Added 4 optional props to destructuring and type annotation:
```typescript
blankProb?: number
haulProb?: number
p10Pts?: number
p90Pts?: number
```
With Phase 61 MC-02 comment block explaining the D-13 constraint (1GW only, optional pending pipeline deployment).

**Edit 2: showMC guard + MC row block** (lines 87-152)

Added `showMC` constant after existing `cardTotal`:
```typescript
const showMC = window === 1
  && blankProb !== undefined
  && haulProb !== undefined
  && p10Pts !== undefined
  && p90Pts !== undefined
```

Inserted conditional MC block between existing `<hr>` and `Total` div:
- `Blank%` row: `(blankProb! * 100).toFixed(0)%` — integer percent
- `Haul%` row: `(haulProb! * 100).toFixed(0)%` — amber class when `>= 0.40`, plain `font-mono` otherwise
- `Floor` row: `p10Pts!.toFixed(1)` — 1 decimal
- `Ceiling` row: `p90Pts!.toFixed(1)` — 1 decimal
- Trailing `<hr>` divider closing the MC section before Total

**Edit 3: xPts_1gw column cell threading** (lines 262-278)

Added 4 props to `<XPtsCell>` at the xPts_1gw column accessor:
```typescript
blankProb={info.row.original.blank_prob}
haulProb={info.row.original.haul_prob}
p10Pts={info.row.original.p10_pts}
p90Pts={info.row.original.p90_pts}
```

xPts_3gw and xPts_5gw column cells remain unchanged per D-13.

## Commits

| Task | Hash | Type |
|------|------|------|
| Task 1: XPtsCell MC extension + threading | e4b8601 | feat |

## Test Results

All 11 Vitest tests pass in `src/components/gem-table/columns.test.tsx`:

- 3 existing Phase 39 CMP-01 tests: PASS
- 4 existing Phase 48 XPT-01 tests: PASS
- 3 existing Phase 41 ACC-05 tests: PASS
- **3 new Phase 61 MC-02 tests: PASS (previously RED, now GREEN)**

The 3 MC-02 tests that turned GREEN:
1. `renders MC rows when blankProb/haulProb/p10Pts/p90Pts present and window===1`
2. `omits MC rows when window===3 (multi-GW window suppresses breakdown card entirely)`
3. `omits MC rows when window===5`

`tsc --noEmit` exits 0 — no TypeScript errors.

## Deviations from Plan

None — plan executed exactly as written. All three edits applied as specified. The inline JSX approach (vs rows[] array) was used for the MC block as prescribed in the plan action section, which correctly handles the per-row conditional className for Haul% amber coloring that the rows[].map() pattern cannot easily express.

## TDD Gate Compliance

- RED gate: established by plan 061-01 (commits 443c475 and 517553a)
- GREEN gate: established by this plan (commit e4b8601) — all 3 RED MC-02 tests now pass

## Known Stubs

None. The MC rows render from actual pipeline-computed values. When `blank_prob`, `haul_prob`, `p10_pts`, `p90_pts` are absent from `row.original` (pre-Phase-61 cache), the `showMC` guard evaluates to false and the existing 5-component card renders unchanged — correct graceful degradation per success criteria.

## Threat Flags

None. Pure UI rendering of already-validated pipeline fields. No new network endpoints, auth paths, or trust boundary changes. The `showMC && (...)` guard prevents undefined dereference via the `!== undefined` checks on all four props before the non-null assertion operators (`!`) are used.

## Self-Check

- [x] `src/components/gem-table/columns.tsx` modified with 3 edits (signature, MC block, threading)
- [x] 11/11 tests pass (`npx vitest run src/components/gem-table/columns.test.tsx`)
- [x] `tsc --noEmit` exits 0
- [x] Commit e4b8601 exists in git log
- [x] BGW guard unchanged (line 64)
- [x] showBreakdown guard unchanged (line 70)
- [x] xPts_3gw and xPts_5gw cells NOT modified

## Self-Check: PASSED
