---
plan: 063-04
phase: 063
subsystem: accuracy-ui
tags: [accuracy, calibration, versioning, react, recharts, ui, ver-02, cal-01, cal-02]
dependency_graph:
  requires:
    - 063-03  # TypeScript types for VersionRecord, VersionGateFlags, CalibrationBucket, CalibrationData
  provides:
    - VersionHistoryTable component (VER-02)
    - CalibrationSection component (CAL-01)
    - PositionTabSelector component (CAL-02)
    - GwSummaryTable + HaulterList sortable columns (preserved from main branch)
  affects:
    - src/components/accuracy/AccuracyTab.tsx
tech_stack:
  added:
    - recharts (ComposedChart, Line, ReferenceLine, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer)
    - recharts TooltipContentProps type import
  patterns:
    - Recharts ComposedChart + ResponsiveContainer (from RankSimTab precedent)
    - XAxis type="number" domain=[0,1] for numeric calibration axis (Pitfall 4 guard)
    - ReferenceLine segment=[{x:0,y:0},{x:1,y:1}] for y=x diagonal (recharts v3 pattern)
    - role="tablist" / role="tab" / aria-selected pill pattern
    - isAnimationActive={false} on recharts data elements (project convention)
    - connectNulls={false} for sparse-bucket gaps (Pitfall 5 guard)
key_files:
  modified:
    - src/components/accuracy/AccuracyTab.tsx  # +341 -13 lines; 6 new inline components
decisions:
  - Used CalibrationTooltip as function reference (content={CalibrationTooltip}) not JSX element — TooltipContentProps<number,string> caused TS2739 when passed as JSX; function reference matches RankSimTab precedent
  - Preserved sortable-column additions (GwSummaryTable shCls/arrow, HaulterList shCls/arrow) from main branch unstaged changes — these were not in the worktree so incorporated into the full file write
metrics:
  duration: ~10 minutes
  completed_date: "2026-05-06"
  tasks_total: 2
  tasks_completed: 2
  files_changed: 1
---

# Phase 063 Plan 04 Summary: React UI — VersionHistoryTable + CalibrationSection

## What Was Built

Extended `src/components/accuracy/AccuracyTab.tsx` with three new inline components (VersionHistoryTable, CalibrationSection, PositionTabSelector) plus supporting helpers (GateFlagsCell, CalibrationTooltip, formatRecordedAt, GATE_LABEL, POSITION_PILLS, positionLabel) that deliver VER-02, CAL-01, and CAL-02. Recharts ComposedChart with ReferenceLine y=x diagonal renders the calibration reliability diagram. Both new sections are suppressed via conditional render guards for legacy-cache backward compatibility. Also incorporated sortable-column additions to GwSummaryTable and HaulterList (present in main branch but not yet in the worktree).

## One-Liner

Version history table with HitRateBadge + DeltaCell + gate-flag chips, and recharts calibration reliability diagram with 5-position pill tab selector and y=x reference diagonal.

## Changes Made

### src/components/accuracy/AccuracyTab.tsx

Full file rewrite incorporating:

**New imports:**
- `VersionRecord, VersionGateFlags, CalibrationBucket, CalibrationData` from `@/lib/types`
- `ComposedChart, Line, ReferenceLine, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer` from `recharts`
- `TooltipContentProps` type from `recharts`

**New module-scoped helpers:**
- `formatRecordedAt(iso)` — YYYY-MM-DD slice, drops time-of-day noise
- `GATE_LABEL` record mapping gate flag keys to display strings ('xmins v2', 'bonus predictor', 'form signal')
- `CalibrationPosition` type alias
- `POSITION_PILLS` constant array (All/GK/DEF/MID/FWD)
- `positionLabel(p)` — returns label for empty-state overlay copy

**New inline components:**
- `GateFlagsCell` — renders zinc chips for enabled gate flags, em-dash when all off
- `VersionHistoryTable` — 5-column table (Version/Recorded/Hit Rate/Δ/Active Gates); (current) marker on last row; DeltaCell reuse for delta column; single-row helper text
- `PositionTabSelector` — role=tablist / role=tab / aria-selected; min-h-[44px] WCAG touch targets
- `CalibrationTooltip` — decile range header, predicted/actual/n rows
- `CalibrationSection` — useState CalibrationPosition='all'; useMemo chartData filtered by sample_n>=5; recharts ComposedChart with ReferenceLine y=x diagonal; empty-state overlay

**Modified components (sortable columns):**
- `GwSummaryTable` — added GwSortKey type, sortKey/sortDir state, useMemo sort, shCls(), arrow() helpers, sortable column headers
- `HaulterList` — added HaulterSortKey type, sortKey/sortDir state, useMemo sort, shCls(), arrow() helpers, sortable column headers with "Lower rank = higher xPts prediction" title

**Modified render block:**
```tsx
return (
  <section className="mt-6 space-y-8" aria-label="Projection accuracy">
    {data.versions && data.versions.length >= 1 && <VersionHistoryTable data={data} />}
    {data.calibration && <CalibrationSection data={data} />}
    <GwSummaryTable data={data} />
    <HaulterList data={data} />
    <PlayerDeltaTable data={data} />
  </section>
)
```

## Verification

- `npm test -- --run AccuracyTab`: 11/11 PASS (5 Phase 41 + 6 Phase 63)
- `npx tsc --noEmit`: no errors in AccuracyTab.tsx
- `npm run build`: production build passes, no errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CalibrationTooltip content prop TypeScript error**
- **Found during:** Task 2 tsc check
- **Issue:** `TooltipContentProps<number, string>` caused TS2739 when `<CalibrationTooltip />` passed as JSX to `<Tooltip content={...} />` — TypeScript sees props as `{}` which doesn't satisfy the full TooltipContentProps shape
- **Fix:** Changed function signature to `TooltipContentProps` (no generics, matching RankSimTab precedent) AND changed `content={<CalibrationTooltip />}` to `content={CalibrationTooltip}` (function reference, not JSX element) — both changes together eliminate the type error
- **Files modified:** `src/components/accuracy/AccuracyTab.tsx`
- **Commit:** 278d3e7

**2. [Rule 2 - Preservation] Sortable columns from main branch incorporated**
- **Found during:** Context reading — main repo AccuracyTab.tsx had sortable GwSummaryTable + HaulterList; worktree's committed version did not
- **Fix:** Full file write incorporated sortable-column additions (GwSortKey, HaulterSortKey, shCls/arrow helpers, useMemo sort) from main branch alongside Phase 63 additions
- **Files modified:** `src/components/accuracy/AccuracyTab.tsx`
- **Commit:** 278d3e7

## Known Stubs

None — all components render from live `data.versions` and `data.calibration` fields; no hardcoded placeholders.

## Threat Flags

None — all rendered strings come from pre-computed read-only JSON via existing `/api/accuracy` route. React auto-escapes all interpolated values. `n&lt;5` HTML entity used correctly in JSX.

## Self-Check: PASSED

- [x] `src/components/accuracy/AccuracyTab.tsx` exists and contains `function VersionHistoryTable`
- [x] `src/components/accuracy/AccuracyTab.tsx` contains `function CalibrationSection`
- [x] `src/components/accuracy/AccuracyTab.tsx` contains `function PositionTabSelector`
- [x] `src/components/accuracy/AccuracyTab.tsx` contains `Model Version History`
- [x] `src/components/accuracy/AccuracyTab.tsx` contains `Calibration Reliability`
- [x] `src/components/accuracy/AccuracyTab.tsx` contains `segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}`
- [x] `src/components/accuracy/AccuracyTab.tsx` contains `isAnimationActive={false}`
- [x] `src/components/accuracy/AccuracyTab.tsx` contains `.filter((b) => b.sample_n >= 5)`
- [x] `src/components/accuracy/AccuracyTab.tsx` contains `function shCls(key: GwSortKey)` (sortable columns preserved)
- [x] `src/components/accuracy/AccuracyTab.tsx` contains `function shCls(key: HaulterSortKey)` (sortable columns preserved)
- [x] Commit 278d3e7 exists in git log
- [x] 11/11 tests GREEN
- [x] tsc --noEmit: no errors
- [x] npm run build: passes
