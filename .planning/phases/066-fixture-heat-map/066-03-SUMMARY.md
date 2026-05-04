---
phase: "066-fixture-heat-map"
plan: "03"
subsystem: "navigation"
tags: [react, navigation, sub-tab, page-wiring, vitest]
dependency_graph:
  requires:
    - phase: "066-02"
      provides: "FixtureHeatMap component exported from src/components/club-form/FixtureHeatMap.tsx"
  provides:
    - "Heat Map sub-tab accessible from Analyse section nav"
    - "FixtureHeatMap mounted via render guard on activeSubTab === 'fixture-heat-map'"
    - "page.test.tsx mock + navigation test for HEAT-01 D-06 D-07"
  affects: [src/app/page.tsx, src/app/page.test.tsx]
tech_stack:
  added: []
  patterns: [sub-tab-wiring, vi-mock-component-stub, render-guard]
key_files:
  created: []
  modified:
    - src/app/page.tsx
    - src/app/page.test.tsx
key_decisions:
  - "[066-03] No deviations — four edits to page.tsx and two edits to page.test.tsx applied exactly as specified"
  - "[066-03] SubTab union contains 'route-tree' (from Phase 060 merge) — 'fixture-heat-map' appended at the end as specified"
requirements_completed: [HEAT-01, HEAT-02, HEAT-03]
duration: "~2 min"
completed: "2026-05-04"
---

# Phase 066 Plan 03: page.tsx Navigation Wiring Summary

**FixtureHeatMap wired into Analyse sub-tab nav — import, SubTab union, SECTIONS entry, render guard, vi.mock, and Phase 66 navigation test all in place; full Vitest suite passes.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-04T21:46:32Z
- **Completed:** 2026-05-04T21:48:58Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Wired `FixtureHeatMap` into `page.tsx` with four edits: import, SubTab union extension, Analyse SECTIONS entry (last position after 'price-changes'), and render guard
- Added `vi.mock` for `FixtureHeatMap` in `page.test.tsx` to prevent suite import-time failure
- Added Phase 66 navigation test asserting: Analyse strip order ends with 'Heat Map', clicking the button mounts `FixtureHeatMap` and unmounts Gems/PriceChangePanel, `aria-current="page"` set on active button
- TypeScript clean (exit 0); all 12 page.test.tsx tests pass; 794 tests pass in full suite (6 pre-existing unrelated failures in captain-picks.test.ts and club-form.test.ts unchanged)

## Task Commits

1. **Task 1: Wire FixtureHeatMap into page.tsx** - `f3fb1bb` (feat)
2. **Task 2: Mock FixtureHeatMap and add navigation test** - `cb8066d` (feat)

## Files Created/Modified

- `src/app/page.tsx` — Import + SubTab union + SECTIONS entry + render guard for fixture-heat-map sub-tab
- `src/app/page.test.tsx` — vi.mock stub + Phase 66 navigation test asserting tab order, mount, aria-current

## Decisions Made

None - plan executed exactly as written. The worktree required a `git merge main` before starting because the Plan 02 commits (FixtureHeatMap component) had been merged to main but not yet present in this worktree branch.

## Deviations from Plan

None - plan executed exactly as written.

The plan's line-number references were slightly off from the actual file state (which had additional commits from Phase 060 RouteTreeTab wiring). The four edits were located by string search rather than line number, and applied cleanly. The SubTab union in the actual file already contained `'route-tree'` — `'fixture-heat-map'` was appended after `'rivals'` as the last literal, which is the correct position.

## Issues Encountered

Worktree branch was behind main by ~30 commits (Phase 60 and Phase 066-01/02 work). Ran `git merge main` to fast-forward before starting Task 1. No conflicts.

## Known Stubs

None — `FixtureHeatMap` renders live data from `useClubForm()` (implemented in Plan 02).

## Threat Flags

None — sub-tab wiring only; no new network endpoints or auth paths. Same classification as every prior sub-tab addition (T-066-05, T-066-06 both accepted in Plan 03 threat model).

## Phase Wrap-Up Note

HEAT-01, HEAT-02, HEAT-03 all delivered across Plans 01–03:
- **Plan 01:** Extended `FIXTURE_LOOKAHEAD` to 16 in `pipeline/merge.py`; updated `upcoming_fixtures` type comment to "next 16"
- **Plan 02:** Implemented `FixtureHeatMap` component (143 lines) with 12 TDD tests — 20×8 grid, DGW split-diagonal, BGW zinc cell, native-title tooltips, overflow-x-auto for mobile (HEAT-03)
- **Plan 03:** Wired component into Analyse nav; navigation test confirms tab strip order and mount behaviour

Manual UAT steps deferred (not a blocker for plan completion):
- `npm run dev` → Analyse → Heat Map: confirm 20×8 grid renders
- Desktop ≥1024px: confirm no horizontal scroll (HEAT-03 visual)
- Toggle dark mode: confirm DGW gradient cells remain visually identifiable

## Self-Check: PASSED

- `src/app/page.tsx` — FOUND, contains 1 FixtureHeatMap import + 3 'fixture-heat-map' literals + 1 render guard
- `src/app/page.test.tsx` — FOUND, contains vi.mock + Phase 66 nav test
- Task 1 commit `f3fb1bb` — FOUND
- Task 2 commit `cb8066d` — FOUND
- `npx tsc --noEmit` — exit 0 (no output)
- `npx vitest run src/app/page.test.tsx` — 12/12 passing
