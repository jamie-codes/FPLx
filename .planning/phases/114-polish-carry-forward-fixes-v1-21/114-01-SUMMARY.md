---
phase: 114
plan: 01
subsystem: planner-ui
tags: [chip-toggle, route-tree, ui-fix, disabled-state]
dependency_graph:
  requires: []
  provides: [ChipToggle.disabled-prop, RouteTreeTab.totalHits-cell, RouteTreeTab.disabled-chip-toggle]
  affects: [src/components/planner/ChipToggle.tsx, src/components/planner/RouteTreeTab.tsx]
tech_stack:
  added: []
  patterns: [disabled-wrapper-div, pointer-events-none-opacity-50, aria-disabled]
key_files:
  created: []
  modified:
    - src/components/planner/ChipToggle.tsx
    - src/components/planner/RouteTreeTab.tsx
decisions:
  - ChipToggle disabled wraps the role=group div (not individual buttons) — matches GwToggle precedent, pointer-events-none on wrapper sufficient
  - totalHits ?? 0 defensive fallback per UI-SPEC §TRT-01 (field is always 0 per D-01 but ?? 0 guards undefined)
  - chipMode constant kept in scope (engine dep array unchanged); only stale comment removed
metrics:
  duration: ~2 min
  completed: 2026-05-16
  tasks_completed: 2
  files_changed: 2
---

# Phase 114 Plan 01: RouteTreeTab Hits Fix + Disabled ChipToggle Stub Summary

**One-liner:** Fixed Hits column data source from totalTransfers to totalHits, and added a disabled ChipToggle stub above the route summary table using the GwToggle outer-div pattern.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add disabled prop to ChipToggle | 8c0b159 | src/components/planner/ChipToggle.tsx |
| 2 | Fix TRT-01 Hits cell + render disabled ChipToggle in RouteTreeTab | 45635a6 | src/components/planner/RouteTreeTab.tsx |

## What Was Built

**Task 1 — ChipToggle disabled prop (TRT-02 prerequisite):**
- Extended `ChipToggleProps` with `disabled?: boolean`
- Added outer `<div className={disabled ? 'pointer-events-none opacity-50' : undefined}>` wrapper wrapping the existing `role="group"` div
- Added `aria-disabled={disabled}` to the `role="group"` div
- Individual button `onClick` handlers unchanged — unreachable via pointer-events-none wrapper
- Pattern matches GwToggle.tsx (Phase 46 D-08) exactly

**Task 2 — RouteTreeTab corrections:**
- **TRT-01:** Changed `{path.totalTransfers}` to `{path.totalHits ?? 0}` in the Hits `<td>` cell. `totalHits` is the correct semantic field (count of transfer hits); `totalTransfers` is the count of transfer legs. The `?? 0` fallback guards against undefined per UI-SPEC.
- **TRT-02 import:** Added `import { ChipToggle } from './ChipToggle'` to the import block
- **TRT-02 render:** Inserted disabled ChipToggle in squad-loaded branch only, immediately after `</header>`, wrapped in `<div>` for `space-y-4` gap compatibility:
  ```tsx
  <ChipToggle gw={startingGw ?? 1} activeChip={null} onToggle={() => {}} disabled={true} />
  ```
- Removed stale multi-line comment above `const chipMode: PlannerChip = null`; constant itself preserved for engine dep array

## Verification Results

1. `grep -n "totalHits" src/components/planner/RouteTreeTab.tsx` — shows line 308 with `{path.totalHits ?? 0}` PASS
2. `grep -c "totalTransfers" src/components/planner/RouteTreeTab.tsx` — returns 0 (no occurrences) PASS
3. `grep -n "disabled" src/components/planner/ChipToggle.tsx` — shows prop definition, wrapper class, aria-disabled PASS
4. `grep -n "ChipToggle" src/components/planner/RouteTreeTab.tsx` — shows import (line 17) + render (line 234) PASS
5. TypeScript: pre-existing error in `src/app/api/decision-history/route.test.ts` (Buffer type issue, unrelated to this plan); no new errors introduced by this plan's changes PASS (new errors: 0)

## Deviations from Plan

None — plan executed exactly as written.

The TypeScript compilation reports one pre-existing error in `route.test.ts` (Buffer/SharedArrayBuffer type). This error existed before this plan's changes (confirmed via git stash test) and is out of scope per the scope boundary rule.

## Known Stubs

None — `ChipToggle` renders with `activeChip={null}` intentionally; this is the documented deferred state (D-06/D-09). The onToggle noop is explicit per spec. No data is being stubbed — chip interaction is intentionally suppressed, not deferred for wiring.

## Threat Flags

None — all changes are read-only UI rendering of existing data fields. No new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

- [x] `src/components/planner/ChipToggle.tsx` — FOUND
- [x] `src/components/planner/RouteTreeTab.tsx` — FOUND
- [x] Commit 8c0b159 — FOUND
- [x] Commit 45635a6 — FOUND
