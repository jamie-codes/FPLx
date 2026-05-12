---
phase: 97
plan: "02"
subsystem: page-nav
tags:
  - ui
  - nav
  - page
  - heat-map
  - integration
dependency_graph:
  requires:
    - src/components/club-form/ClubFormTab.tsx (Plan 01)
    - src/app/page.tsx
    - src/app/page.test.tsx
  provides:
    - Updated Analyse/Plan navigation in page.tsx with ClubFormTab integrated
    - Updated page.test.tsx for new nav structure
  affects:
    - src/components/nav/MobileNav.test.tsx (also updated for structural changes)
tech_stack:
  added: []
  patterns:
    - Single-component delegation: page.tsx delegates Club Form rendering to ClubFormTab
    - Import cleanup: removed four stale imports, added one new import
decisions:
  - "D-01: 'fixture-heat-map' removed from SubTab union and SECTIONS — TypeScript enforces no stale references"
  - "D-02: 'club-form' moved from Plan.subTabs to Analyse.subTabs after 'set-pieces' — new Analyse order: gems→insights→defcon→set-pieces→club-form→accuracy→price-changes"
  - "D-07: Club Form render block simplified to <ClubFormTab submittedId={submittedId} /> — submittedId forwarded for owned-filter in FixtureHeatMap"
  - "Deviation (Rule 1): MobileNav.test.tsx updated to reflect new Analyse/Plan pill structure — tests were already failing pre-Phase-97 (QueryClient issue) but assertions corrected"
key_files:
  created: []
  modified:
    - src/app/page.tsx
    - src/app/page.test.tsx
    - src/components/nav/MobileNav.test.tsx
metrics:
  duration: "~10 minutes"
  completed: "2026-05-12"
  tasks: 2
  files: 3
requirements_satisfied:
  - HEAT-01
  - HEAT-02
---

# Phase 97 Plan 02: Nav Refactor and ClubFormTab Integration — Summary

Wired ClubFormTab into page.tsx, removed the standalone Heat Map sub-tab, moved Club Form from Plan to Analyse, and updated page.test.tsx + MobileNav.test.tsx to reflect the new structure.

## What Was Built

### page.tsx changes
- **Imports cleaned up**: Removed `ClubFormTable`, `FixtureEaseRankingPanel`, `FixtureSwingDetector`, `FixtureHeatMap` imports; added `ClubFormTab` import
- **SubTab union**: Removed `'fixture-heat-map'` token — TypeScript now enforces no stale references
- **Analyse subTabs**: New order `gems → insights → defcon → set-pieces → club-form → accuracy → price-changes`; `fixture-heat-map` entry removed
- **Plan subTabs**: `club-form` entry removed; new order `planner → manual-plan → route-tree → rank-sim → value-gems → rivals`
- **Club Form render block**: Replaced three-component block (`<FixtureEaseRankingPanel /><FixtureSwingDetector /><ClubFormTable />`) with single `<ClubFormTab submittedId={submittedId} />`
- **fixture-heat-map render block**: Deleted entirely

### page.test.tsx changes
- **ClubFormTab mock added**: Module-level vi.mock renders `<div data-testid="club-form-tab" data-submitted-id={...} />`
- **Plan D-05 restore test**: Replaced Club Form navigation (no longer in Plan) with Value Gems navigation
- **MobileNav D-04 test**: Moved Form/Club Form assertions from Plan-active block to Analyse-active block
- **Plan order tests** (x2): Removed `'Club Form'` from expected `toEqual` arrays — both now assert `['Planner', 'Manual Plan', 'Route Tree', 'Rank Sim', 'Value Gems', 'Rivals']`
- **Phase 66 Heat Map test**: Replaced entirely with two Phase 97 tests:
  1. Analyse sub-tab order assertion (7 tabs, Club Form after Set Pieces, no Heat Map)
  2. Clicking Club Form mounts ClubFormTab with submittedId forwarded and no standalone FixtureHeatMap

### MobileNav.test.tsx changes (Rule 1 deviation)
- **NAV-02 test**: Updated to assert 7 Analyse pills (`Gems/Insights/DefCon/SP/Form/Acc/Prices`)
- **NAV-03 test**: Updated to assert Plan pills without Form; asserts Form is absent
- **Phase 62 test**: Updated to assert 6 Plan pills (not 7), Form absent

## Decision IDs Satisfied

- D-01: `'fixture-heat-map'` removed from SubTab union and SECTIONS
- D-02: Club Form moved from Plan to Analyse (after Set Pieces)
- D-03: Label `'Club Form'` / `'Form'` unchanged
- D-07: `<ClubFormTab submittedId={submittedId} />` is the single render block
- D-04 through D-09: End-to-end live — ClubFormTab owns toggle state, default form view, submittedId threading all work

## Requirements Satisfied

- HEAT-01: Full toggle access — users navigate Analyse → Club Form → toggle to Heat Map
- HEAT-02: Hover for opponent + H/A via existing `title` attribute on FixtureHeatMap cells (unchanged from existing implementation)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MobileNav.test.tsx updated alongside page.test.tsx**
- **Found during:** Task 2 verification (full vitest run)
- **Issue:** MobileNav.test.tsx tests Analyse/Plan pill structure derived from SECTIONS — three tests used stale Plan-side 'Form' assertion and old Analyse pill count
- **Fix:** Updated NAV-02, NAV-03, Phase 62 tests to reflect new structure
- **Files modified:** `src/components/nav/MobileNav.test.tsx`
- **Commit:** `e96b0b5` (included in Task 2 commit)
- **Note:** MobileNav tests were already failing pre-Phase-97 due to a `No QueryClient set` error (pre-existing infrastructure issue). The assertion updates are correct for when that issue is resolved.

## Known Stubs

None — ClubFormTab renders real child components. The heat map is feature-complete. No placeholder content.

## Threat Flags

None — T-97-06 through T-97-10 all categorised as `accept` (see plan threat model). Removing `'fixture-heat-map'` from SubTab union narrows valid values — TypeScript surfaces any stale reference at compile time (confirmed: `npx tsc --noEmit` exits zero).

## Self-Check: PASSED

- [x] `src/app/page.tsx` — modified, compiles clean, 1 ClubFormTab import, 0 stale imports, 1 ClubFormTab usage, 0 fixture-heat-map references
- [x] `src/app/page.test.tsx` — modified, 1 ClubFormTab mock, 2 Phase 97 HEAT-01 tests, 0 'Club Form' in Plan order arrays
- [x] `src/components/nav/MobileNav.test.tsx` — modified, NAV-02/NAV-03/Phase62 assertions updated
- [x] `npx tsc --noEmit` — exits zero
- [x] `npx vitest run src/app/page.test.tsx` — 15/15 pass
- [x] `npx vitest run src/components/club-form/ClubFormTab.test.tsx` — 6/6 pass (no regression)
- [x] `npx vitest run src/components/club-form/FixtureHeatMap.test.tsx` — 23/23 pass (no regression)
- [x] Commit `d5c8db1` — `feat(97-02): wire ClubFormTab into page.tsx...` — exists on HEAD
- [x] Commit `e96b0b5` — `test(97-02): update page.test.tsx...` — exists on HEAD
- [x] Pre-existing failures (captain-picks, club-form tier test, MobileNav QueryClient) confirmed pre-existing via git stash test — not introduced by Phase 97
