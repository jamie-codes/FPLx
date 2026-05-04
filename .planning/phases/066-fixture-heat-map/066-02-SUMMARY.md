---
phase: "066"
plan: "02"
subsystem: "club-form-components"
tags: [tdd, heat-map, fixture, react, tailwind]
dependency_graph:
  requires: []
  provides: [FixtureHeatMap component, HEAT-01, HEAT-02, HEAT-03]
  affects: [src/components/club-form/FixtureHeatMap.tsx]
tech_stack:
  added: []
  patterns: [tdd-red-green, useMemo-groupby-event_id, css-linear-gradient-dgw, native-title-tooltip, overflow-x-auto-scroll]
key_files:
  created:
    - src/components/club-form/FixtureHeatMap.tsx
    - src/components/club-form/FixtureHeatMap.test.tsx
  modified: []
decisions:
  - "[066-02] Used TIER_HEX static map (light-mode hex values) for DGW gradient inline style — dark mode gradient is a documented limitation (Pitfall 2); native title tooltip exposes textual difficulty in both modes (WCAG 1.4.1 satisfied)"
  - "[066-02] Component sorts teams alphabetically by team_short_name via localeCompare"
  - "[066-02] Column event_ids derived from union of ALL teams' fixtures (flatMap), not a single team — handles BGW gaps correctly"
metrics:
  duration: "~5 min"
  completed: "2026-05-04T21:42:39Z"
  tasks_completed: 2
  files_changed: 2
---

# Phase 066 Plan 02: FixtureHeatMap Component Summary

**One-liner:** 20×8 colour-coded fixture heat map (green/amber/red cells, CSS split-diagonal DGW, zinc BGW, alphabetical sort) implemented via strict TDD with 12/12 tests passing.

## TDD Cycle

| Gate | Commit | Description |
|------|--------|-------------|
| RED | `247b417` | `test(066-02): add failing FixtureHeatMap tests for HEAT-01/02/03` — 12 test cases; suite fails with module-not-found because `FixtureHeatMap.tsx` did not yet exist |
| GREEN | `b5616c8` | `feat(066-02): implement FixtureHeatMap component (HEAT-01, HEAT-02, HEAT-03)` — all 12 tests pass; no refactor needed |

## Test Results

- **Test count:** 12 / 12 passing
- **Test file:** `src/components/club-form/FixtureHeatMap.test.tsx`
- **Coverage:** HEAT-01 (4 tests), HEAT-02 (3 tests), HEAT-03 (1 test), D-02 (1 test), loading/error/empty states (3 tests), alphabetical sort (1 test)

## Implementation

`src/components/club-form/FixtureHeatMap.tsx` (143 lines) exports `FixtureHeatMap`:

- Calls `useClubForm()` for `ClubForm[]` data
- `useMemo` builds `allEventIds` (union of all teams' event_ids, sorted ascending, first 8) and `byTeamGw` (Map: team_id → Map: event_id → ClubFormFixture[])
- Teams sorted alphabetically by `team_short_name` via `localeCompare` (immutable spread)
- `<div className="overflow-x-auto">` wrapper, `<table className="min-w-[640px] ...">` (HEAT-03)
- Single-fixture cells: `TIER_CLASSES[difficulty_tier]` Tailwind class + title `"OPP (H/A) — 0.dd"` (D-08 em-dash U+2014)
- DGW cells (`fixtures.length >= 2`): inline `style={{ background: 'linear-gradient(to bottom right, {hex1} 50%, {hex2} 50%)' }}` + title `"OPP1 (H/A) 0.dd / OPP2 (H/A) 0.dd"` (D-03, D-04)
- BGW cells (empty array for that event_id): `bg-zinc-50 dark:bg-zinc-900` + title `"No fixture (BGW)"` (HEAT-02)
- Loading/error/empty states matching locked UI-SPEC copy

## TypeScript

`npx tsc --noEmit` — zero errors in either new file.

## Full Suite Status

Full Vitest suite: 793 passed | 6 pre-existing failures in `tests/lib/captain-picks.test.ts` and `tests/lib/club-form.test.ts` — these failures exist on the base branch and are unrelated to Plan 02 changes.

## Deviations from Plan

None — plan executed exactly as written. The implementation in `066-02-PLAN.md` was used verbatim including:
- `TIER_HEX` static map with light-mode hex values for DGW gradient (Pitfall 2 documented limitation accepted per plan spec)
- `TIER_CLASSES` static map with full dark-mode Tailwind classes for single-fixture cells
- All 12 test cases from the plan's `<action>` block created without modification

## Known Stubs

None — component renders live data from `useClubForm()`.

## Threat Flags

None — read-only component over public FPL fixture data. Same classification as `FixtureEaseRankingPanel` and `PriceChangePanel`. See threat model in 066-02-PLAN.md (T-066-03, T-066-04 both accepted).

## Note for Plan 03

`FixtureHeatMap` is exported but **not yet mounted** in `page.tsx`. Plan 03 must:
1. Add `'fixture-heat-map'` to the `SubTab` union in `page.tsx`
2. Append a Heat Map entry to `SECTIONS[0].subTabs` after `'price-changes'`
3. Add `import { FixtureHeatMap } from '@/components/club-form/FixtureHeatMap'` to `page.tsx`
4. Add render guard `{activeSection !== 'squad' && activeSubTab === 'fixture-heat-map' && <FixtureHeatMap />}` after the price-changes guard
5. Add `vi.mock('@/components/club-form/FixtureHeatMap', () => ({ FixtureHeatMap: () => <div data-testid="fixture-heat-map" /> }))` to `src/app/page.test.tsx`
6. Add the Heat Map sub-tab navigation test to `page.test.tsx`

## TDD Gate Compliance

- RED gate: commit `247b417` (`test(066-02): ...`) — exists before GREEN
- GREEN gate: commit `b5616c8` (`feat(066-02): ...`) — exists after RED
- REFACTOR gate: not needed (implementation was clean on first pass)

## Self-Check: PASSED

- `src/components/club-form/FixtureHeatMap.tsx` — FOUND
- `src/components/club-form/FixtureHeatMap.test.tsx` — FOUND
- RED commit `247b417` — FOUND
- GREEN commit `b5616c8` — FOUND
- All 12 tests pass — VERIFIED
- TypeScript clean — VERIFIED
