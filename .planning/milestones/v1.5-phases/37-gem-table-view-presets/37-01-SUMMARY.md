---
phase: 37-gem-table-view-presets
plan: 01
subsystem: ui
tags: [tanstack-table, vitest, column-visibility, typescript, tdd]

# Dependency graph
requires:
  - phase: 36-navigation-consolidation
    provides: page.tsx section/sub-tab state patterns used by Plan 02 wiring
provides:
  - ViewPreset type exported from GwToggle.tsx
  - PRESET_COLUMN_VISIBILITY constant with compact/default/analysis maps
  - Extended getColumnVisibility(horizon, isMobile, preset) function
  - Full test coverage for all 3 presets and mobile-ignores-preset invariant
affects:
  - 37-02 (Plan 02 wires ViewPreset into GemTable.tsx and page.tsx)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ViewPreset as third optional param with default — backward-compatible function extension"
    - "Spread merge order: { ...PRESET_COLUMN_VISIBILITY[preset], ...gwVisibility } — gwVisibility always wins"
    - "isMobile guard bypasses preset entirely — D-07 invariant"
    - "toEqual(expect.objectContaining(...)) for partial object matching when function return shape grows"

key-files:
  created: []
  modified:
    - src/components/gem-table/GwToggle.tsx
    - src/components/gem-table/GwToggle.test.ts

key-decisions:
  - "ViewPreset type declared in GwToggle.tsx (not a shared types file) — keeps all column-visibility concerns co-located"
  - "Existing 1-arg and 2-arg call sites unchanged — preset defaults to 'default'"
  - "Updated three existing toEqual assertions to expect.objectContaining to accommodate extra keys from default preset map"

patterns-established:
  - "PRESET_COLUMN_VISIBILITY[preset] as pure data lookup — no conditional logic inside getColumnVisibility body"
  - "Mobile path always bypasses preset — isMobile guard is first, preset parameter is irrelevant on mobile"

requirements-completed: [GEM-01, GEM-02, GEM-03, GEM-04]

# Metrics
duration: 15min
completed: 2026-04-29
---

# Phase 37 Plan 01: GemTable View Presets — Logic Foundation Summary

**ViewPreset type and PRESET_COLUMN_VISIBILITY maps added to GwToggle.tsx; getColumnVisibility extended with optional preset param; 6 new preset tests pass alongside all 9 existing tests**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-29T14:04:00Z
- **Completed:** 2026-04-29T14:19:40Z
- **Tasks:** 1 (TDD)
- **Files modified:** 2

## Accomplishments
- Exported `ViewPreset = 'default' | 'compact' | 'analysis'` type from `GwToggle.tsx`
- Added `PRESET_COLUMN_VISIBILITY` constant with three preset maps matching UI-SPEC §Column Visibility Maps exactly
- Extended `getColumnVisibility` to accept optional `preset` third parameter — all existing 1-arg and 2-arg call sites unchanged
- Added `describe('getColumnVisibility presets')` block with 6 tests covering all three presets plus mobile-ignores-preset invariant
- All 12 tests pass; zero new TypeScript errors introduced

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ViewPreset type, PRESET_COLUMN_VISIBILITY maps, extend getColumnVisibility** - `fcd9179` (feat)

_TDD cycle: RED (3 failing tests) → GREEN (12/12 passing) → no refactor needed_

## Files Created/Modified
- `src/components/gem-table/GwToggle.tsx` — Added ViewPreset type export, PRESET_COLUMN_VISIBILITY constant export, updated getColumnVisibility signature and body
- `src/components/gem-table/GwToggle.test.ts` — Added 6-test describe('getColumnVisibility presets') block; updated 3 existing toEqual assertions to expect.objectContaining

## Decisions Made
- `ViewPreset` declared in `GwToggle.tsx` rather than a shared types file — keeps all column-visibility concerns co-located (same rationale as MOBILE_HIDDEN_COLUMNS living here)
- Updated three existing desktop `toEqual` assertions to `expect.objectContaining(...)` — necessary because `getColumnVisibility(horizon)` now returns additional keys from the default preset map, but the xPts invariant still holds
- Pre-existing TypeScript errors in `tests/lib/captain-picks.test.ts` (5 errors, unrelated to this plan) confirmed as baseline — zero new errors introduced

## Deviations from Plan

None — plan executed exactly as written. The plan explicitly documented the need to update existing `toEqual` assertions and this was followed as specified.

## Issues Encountered
None — TDD cycle proceeded cleanly. RED phase confirmed 3 failing tests; GREEN phase brought all 12 to passing on first implementation attempt.

## Known Stubs
None — this plan delivers pure logic (types, constants, function) with no UI rendering. No data flows to stub.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- `ViewPreset` type, `PRESET_COLUMN_VISIBILITY`, and extended `getColumnVisibility` are exported and ready for Plan 02 wiring
- Plan 02 can import `ViewPreset` from `GwToggle.tsx` without any additional changes to this plan's output
- No blockers

---
*Phase: 37-gem-table-view-presets*
*Completed: 2026-04-29*
