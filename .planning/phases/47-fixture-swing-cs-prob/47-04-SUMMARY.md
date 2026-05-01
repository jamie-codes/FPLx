---
phase: 47-fixture-swing-cs-prob
plan: "04"
subsystem: ui
tags: [gem-table, column, tanstack-table, cs-probability, react]

# Dependency graph
requires:
  - phase: 47-01
    provides: "MergedPlayer.cs_prob_1gw?: number type extension"
provides:
  - "cs_prob_1gw GemTable column — GK/DEF percentage display, MID/FWD em-dash"
  - "Preset visibility wiring: hidden in Default + Compact, visible in Analysis"
  - "Mobile hidden wiring for cs_prob_1gw"
affects:
  - "47-05 (human-verify smoke test of CS% column in Analysis preset)"
  - "48 (xPts breakdown CS component uses same field)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GemTable column: accessor with position-aware cell renderer (element_type check)"
    - "PRESET_COLUMN_VISIBILITY: absent-key = visible in analysis; explicit false = hidden elsewhere"

key-files:
  created: []
  modified:
    - src/components/gem-table/columns.tsx
    - src/components/gem-table/GwToggle.tsx

key-decisions:
  - "GK/DEF positions (element_type 1/2) show CS%; MID/FWD show em-dash (not attacking-relevant)"
  - "BGW players with cs_prob_1gw=0 render '0%' not em-dash — 0% is meaningful data"
  - "Analysis preset shows CS% via absent-key convention; Default and Compact hide via explicit false"
  - "No sortingFn override needed — default numeric descending is correct for defensive picks"

patterns-established:
  - "Position-gated cell renderer: check info.row.original.element_type; 1/2 get metric, 3/4 get em-dash"
  - "New GemTable columns require entries in MOBILE_HIDDEN_COLUMNS + every non-analysis PRESET"

requirements-completed: [CS-01, CS-03]

# Metrics
duration: 8min
completed: 2026-05-01
---

# Phase 47 Plan 04: GemTable CS% Column Summary

**CS% GemTable column wiring cs_prob_1gw as a position-gated numeric with Analysis-only visibility**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-01T14:43:00Z
- **Completed:** 2026-05-01T14:51:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `cs_prob_1gw` column accessor to `columns.tsx` — GK/DEF rows display percentage (0%–100%), MID/FWD rows display em-dash; BGW players show "0%" explicitly
- Wired three preset visibility entries in `GwToggle.tsx`: `MOBILE_HIDDEN_COLUMNS`, `PRESET_COLUMN_VISIBILITY.compact`, and `PRESET_COLUMN_VISIBILITY.default` all set `cs_prob_1gw: false`; key is absent from `PRESET_COLUMN_VISIBILITY.analysis` (visible by the inverted-convention)
- All 32 GemTable tests pass; TypeScript compiles clean (captain-picks.test.ts errors are pre-existing)

## Task Commits

1. **Task 1: Add cs_prob_1gw column accessor in columns.tsx** - `2c91faa` (feat)
2. **Task 2: Wire cs_prob_1gw visibility into PRESET_COLUMN_VISIBILITY and MOBILE_HIDDEN_COLUMNS** - `8143dfa` (feat)

## Files Created/Modified

- `src/components/gem-table/columns.tsx` - New cs_prob_1gw accessor inserted after differential_flag, before trend display; uses existing H() helper and POS_LABEL pattern
- `src/components/gem-table/GwToggle.tsx` - Three cs_prob_1gw: false entries added (MOBILE_HIDDEN_COLUMNS, compact preset, default preset); absent from analysis preset

## Decisions Made

- Used existing `H()` helper for header tooltip — no new helper needed
- No `sortingFn` override — default numeric descending sort is correct (highest CS% = best defensive pick)
- Absent-key in analysis preset is the established convention vs. explicit `cs_prob_1gw: true`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None — `cs_prob_1gw` field is populated by the pipeline (Plan 03). The column renders live data from `merged_players.json`.

## Threat Flags

No new security-relevant surface beyond what was declared in the plan threat model (T-47-04-01 through T-47-04-03). Cell uses pure-text React rendering; no `dangerouslySetInnerHTML`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CS% column is complete and functional in GemTable Analysis preset
- Plan 05 (human-verify checkpoint) can now smoke-test the column in the browser
- Phase 48 (xPts breakdown CS component) can reference `cs_prob_1gw` from `MergedPlayer` directly

## Self-Check: PASSED

- `src/components/gem-table/columns.tsx` — FOUND
- `src/components/gem-table/GwToggle.tsx` — FOUND
- Commit `2c91faa` — FOUND (feat(47-04): add cs_prob_1gw column accessor to GemTable)
- Commit `8143dfa` — FOUND (feat(47-04): wire cs_prob_1gw visibility into PRESET_COLUMN_VISIBILITY and MOBILE_HIDDEN_COLUMNS)
- `grep -n "col.accessor('cs_prob_1gw'" columns.tsx` — 1 result (line 229)
- `grep -c "cs_prob_1gw" GwToggle.tsx` — 3 (mobile + compact + default; absent from analysis)
- `npx tsc --noEmit` — exits 0 (captain-picks.test.ts errors pre-existing)
- `npx vitest run src/components/gem-table` — 4 files, 32 tests passed

---
*Phase: 47-fixture-swing-cs-prob*
*Completed: 2026-05-01*
