---
phase: 122-polish-carry-forwards
plan: "01"
subsystem: planner-ui
tags: [chip-toggle, route-tree, ui-wiring, tdd]
dependency_graph:
  requires: []
  provides: [POL-01, POL-02]
  affects:
    - src/components/planner/RouteTreeTab.tsx
tech_stack:
  added: []
  patterns:
    - useState toggle-deselect pattern (canonical: ManualPlanTab.handleChipToggle)
key_files:
  modified:
    - src/components/planner/RouteTreeTab.tsx
    - src/components/planner/RouteTreeTab.test.tsx
decisions:
  - "D-01: Inline onToggle handler (no useCallback) used — RouteTreeTab has one ChipToggle instance; no useCallback needed per ManualPlanTab analog"
  - "D-02: disabled prop omitted entirely per plan spec (not passed as false)"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-18"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 122 Plan 01: ChipToggle Wiring and Column Label Fix Summary

**One-liner:** Wired `chipMode` ReactState into RouteTreeTab's ChipToggle and renamed "Hits" column header to "Transfer Hits", resolving two long-standing carry-forwards (TRT-06 and TRT-02 from Phase 60).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire chipMode useState and enable ChipToggle (POL-01) | 3ff5689 | RouteTreeTab.tsx, RouteTreeTab.test.tsx |
| 2 | Rename "Hits" → "Transfer Hits" column header (POL-02) | d259a72 | RouteTreeTab.tsx, RouteTreeTab.test.tsx |

## What Was Built

### POL-01: Reactive chipMode in RouteTreeTab

- `const chipMode: PlannerChip = null` replaced with `const [chipMode, setChipMode] = useState<PlannerChip>(null)`
- ChipToggle now receives `activeChip={chipMode}` (live state instead of hardcoded `null`)
- `onToggle` uses the canonical toggle-deselect pattern: `(chip) => setChipMode(prev => prev === chip ? null : chip)`
- `disabled={true}` removed entirely — all 4 chip buttons (Wildcard / Freehit / Bench Boost / Triple Captain) are now interactive
- `buildTransferRouteTree` already had `chipMode` in its useMemo dependency array — no engine changes required
- 3 new TDD tests added: disabled-state absent, aria-pressed toggle on click, toggle-deselect behavior

### POL-02: "Transfer Hits" Column Header

- Changed `<th>Hits</th>` to `<th>Transfer Hits</th>` at line 269 of RouteTreeTab.tsx
- Existing header-order test updated: description and `toEqual` assertion both use "Transfer Hits"

## Verification Results

- `npx vitest run src/components/planner/RouteTreeTab.test.tsx`: 24/24 tests pass
- `npx tsc --noEmit`: No TypeScript errors in modified files (pre-existing error in `decision-history/route.test.ts` is out of scope)
- TDD cycle completed: RED (3 failing + 1 failing) → GREEN (all 24 passing) for both tasks

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. Pure client-side UI wiring: no new routes, endpoints, auth, or schema changes.

## Self-Check

- [x] `src/components/planner/RouteTreeTab.tsx` contains `useState<PlannerChip>`
- [x] `src/components/planner/RouteTreeTab.test.tsx` contains "Transfer Hits" (2 occurrences)
- [x] Commit 3ff5689 exists
- [x] Commit d259a72 exists
- [x] 24/24 tests pass

## Self-Check: PASSED
