---
phase: 97
plan: "01"
subsystem: club-form
tags:
  - ui
  - club-form
  - heat-map
  - toggle
  - tdd
dependency_graph:
  requires:
    - src/components/club-form/FixtureHeatMap.tsx
    - src/components/club-form/FixtureEaseRankingPanel.tsx
    - src/components/club-form/FixtureSwingDetector.tsx
    - src/components/club-form/ClubFormTable.tsx
  provides:
    - src/components/club-form/ClubFormViewToggle.tsx
    - src/components/club-form/ClubFormTab.tsx
  affects:
    - src/app/page.tsx (Plan 02 will wire ClubFormTab here)
tech_stack:
  added: []
  patterns:
    - Pill toggle component pattern (role=group, aria-pressed, bg-zinc-900 dark:bg-white active state)
    - TDD RED/GREEN cycle for component with conditional renders
    - vi.mock module-level mocking before component import for prop-spy capture
key_files:
  created:
    - src/components/club-form/ClubFormViewToggle.tsx
    - src/components/club-form/ClubFormTab.tsx
    - src/components/club-form/ClubFormTab.test.tsx
  modified: []
decisions:
  - "D-04/D-05: ClubFormViewToggle pill matches SetPieceViewToggle pattern exactly — role=group, aria-pressed, bg-zinc-900 dark:bg-white active state"
  - "D-08: Default view is 'form' — users opt-in to heat map via toggle"
  - "D-09: TDD RED (ClubFormTab.test.tsx) committed before any implementation; GREEN committed after all 6 tests pass"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-12"
  tasks: 2
  files: 3
requirements_satisfied:
  - HEAT-01
---

# Phase 97 Plan 01: ClubFormTab Toggle — Summary

ClubFormViewToggle pill toggle and ClubFormTab wrapper with conditional form/heat-map rendering, tested with 6 passing TDD tests.

## What Was Built

### ClubFormViewToggle.tsx
- Exports `ClubFormView = 'form' | 'heat-map'` union type
- Exports `ClubFormViewToggle({ view, onViewChange })` pill toggle component
- Pill labels: `'Form'` and `'Heat Map'`
- `role="group"`, `aria-label="Club Form view"`, `aria-pressed` on each button
- Active state: `bg-zinc-900 dark:bg-white text-white dark:text-zinc-900`
- Inactive state: `bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700`

### ClubFormTab.tsx
- Exports `ClubFormTab({ submittedId?: string | null })` component
- Owns `useState<ClubFormView>('form')` — default view is `'form'` (D-08)
- Renders `ClubFormViewToggle` above conditional content
- When `view === 'form'`: renders `FixtureEaseRankingPanel`, `FixtureSwingDetector`, `ClubFormTable`
- When `view === 'heat-map'`: renders `<FixtureHeatMap submittedId={submittedId} />`
- `submittedId` prop threaded through to `FixtureHeatMap` for owned-filter functionality

### ClubFormTab.test.tsx (TDD RED → GREEN)
6 tests, all passing:
1. Default view renders form panels and not the heat map (D-08)
2. Clicking Heat Map pill switches to heat-map view
3. Clicking Form pill returns to form view from heat-map view
4. aria-pressed inverts when toggle is clicked (D-05 contract)
5. forwards submittedId prop to FixtureHeatMap when in heat-map view
6. toggle container has role=group and aria-label="Club Form view"

## TDD Gate Compliance

- RED commit: `edc4d9f` — `test(97-01): RED — add failing tests for ClubFormTab (HEAT-01)` (exit non-zero, module not found)
- GREEN commit: `4a2397e` — `feat(97-01): GREEN — implement ClubFormViewToggle + ClubFormTab (HEAT-01)` (6/6 pass)

## Decision IDs Satisfied

- D-04: ClubFormTab owns toggle state — page.tsx stays thin
- D-05: ClubFormViewToggle pill matches SetPieceViewToggle pattern
- D-06: Toggle rendered at top of ClubFormTab, visible regardless of active view
- D-08: Default view = 'form'
- D-09: TDD pattern — failing tests committed before implementation

## Requirements Satisfied

- HEAT-01: Toggle access mechanism in place (ClubFormViewToggle + ClubFormTab created)
- HEAT-02: Already implemented in FixtureHeatMap (hover for opponent + H/A) — exposed by mounting that component from ClubFormTab

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — ClubFormTab conditionally renders real child components; no placeholder content.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. All threat model items categorised as accept (T-97-01 through T-97-05).

## Self-Check: PASSED

- [x] `src/components/club-form/ClubFormViewToggle.tsx` — exists
- [x] `src/components/club-form/ClubFormTab.tsx` — exists
- [x] `src/components/club-form/ClubFormTab.test.tsx` — exists
- [x] Commit `edc4d9f` — `test(97-01): RED` — exists on HEAD history
- [x] Commit `4a2397e` — `feat(97-01): GREEN` — exists on HEAD
- [x] 6/6 tests passing in ClubFormTab.test.tsx
- [x] 23/23 tests passing in FixtureHeatMap.test.tsx (no regression)
