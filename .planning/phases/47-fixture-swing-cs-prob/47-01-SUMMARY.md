---
phase: 47-fixture-swing-cs-prob
plan: 01
subsystem: types
tags: [typescript, types, club-form, merged-player, fixture-swing, clean-sheet]

# Dependency graph
requires:
  - phase: 46-chip-modes
    provides: MergedPlayer and ClubForm interfaces that this plan extends
provides:
  - ClubForm interface with past_ease_3gw, swing_1gw, swing_3gw, swing_5gw fields
  - MergedPlayer interface with cs_prob_1gw optional field
  - computeClubForm() extended to compute swing fields from finished fixtures
affects:
  - 47-02 (engine — reads ClubForm swing fields)
  - 47-03 (pipeline — writes cs_prob_1gw to merged_players.json)
  - 47-04 (GemTable — consumes MergedPlayer.cs_prob_1gw)
  - 47-05 (component — consumes ClubForm swing fields)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Non-optional ClubForm fields always computed by computeClubForm(); null when data unavailable"
    - "Optional MergedPlayer fields (cs_prob_1gw?) follow pipeline rollout convention of xPts_1gw"

key-files:
  created: []
  modified:
    - src/lib/types.ts
    - src/lib/club-form.ts
    - src/lib/chip-strategy-engine.test.ts
    - src/components/planner/ChipStrategyPanel.test.tsx
    - tests/components/club-form/FixtureEaseRankingPanel.test.tsx

key-decisions:
  - "ClubForm swing fields are non-optional (null when data unavailable, never absent) — computeClubForm() always writes them"
  - "cs_prob_1gw on MergedPlayer is optional (?) following same pipeline rollout pattern as xPts_1gw"
  - "past_ease_3gw uses meanEase() helper reused from upcoming-fixture computation, with finished=true filter and 3-fixture minimum"
  - "Swing deltas null when either operand is null — safe arithmetic for BGW and early-season teams"

patterns-established:
  - "Test fixtures for ClubForm must always include the four swing fields (past_ease_3gw, swing_1gw, swing_3gw, swing_5gw)"

requirements-completed:
  - CS-01
  - SWG-01
  - SWG-02
  - SWG-03

# Metrics
duration: 20min
completed: 2026-05-01
---

# Phase 47 Plan 01: Type Extensions Summary

**ClubForm extended with four fixture-swing fields and MergedPlayer with cs_prob_1gw, providing the stable contract for all downstream Phase 47 plans**

## Performance

- **Duration:** 20 min
- **Started:** 2026-05-01T00:00:00Z
- **Completed:** 2026-05-01T00:20:00Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments

- Added `past_ease_3gw`, `swing_1gw`, `swing_3gw`, `swing_5gw` to `ClubForm` interface (SWG-01..SWG-03)
- Added `cs_prob_1gw?: number` to `MergedPlayer` interface (CS-01)
- Extended `computeClubForm()` to compute swing fields from the last 3 finished fixtures using the existing `meanEase()` helper
- Fixed all downstream test fixtures to include the new required `ClubForm` fields

## Task Commits

1. **Task 1: Extend ClubForm and MergedPlayer interfaces** - `b1be98f` (feat)

## Files Created/Modified

- `src/lib/types.ts` - Extended ClubForm (4 swing fields) and MergedPlayer (cs_prob_1gw) interfaces
- `src/lib/club-form.ts` - computeClubForm() extended to compute past_ease_3gw and swing deltas from finished fixtures
- `src/lib/chip-strategy-engine.test.ts` - Test fixture updated to include new ClubForm fields
- `src/components/planner/ChipStrategyPanel.test.tsx` - Test fixture updated to include new ClubForm fields
- `tests/components/club-form/FixtureEaseRankingPanel.test.tsx` - Test fixture updated to include new ClubForm fields

## Decisions Made

- ClubForm swing fields are non-optional (always written by `computeClubForm()`, null when insufficient finished-fixture data). This is consistent with how `attacking_ease_*gw` fields work.
- `cs_prob_1gw` on `MergedPlayer` is optional (`?`) following the same pipeline rollout pattern as `xPts_1gw` — absent before pipeline has run the CS% computation.
- `past_ease_3gw` requires exactly 3 finished fixtures minimum (returns null when fewer than 3 available); uses FPL official difficulty ratings (same `fplToAttDiff()` path used for upcoming fixtures).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated consumers of ClubForm to include new required fields**
- **Found during:** Task 1 (tsc --noEmit verification)
- **Issue:** Adding non-optional fields to `ClubForm` caused `tsc --noEmit` failures in three test files and `src/lib/club-form.ts` itself, which returned an incomplete `ClubForm` literal
- **Fix:** Extended `computeClubForm()` result object with swing field computation; updated three test fixture helper functions (`makeClubForm`) to include `past_ease_3gw: null, swing_1gw: null, swing_3gw: null, swing_5gw: null`
- **Files modified:** `src/lib/club-form.ts`, `src/lib/chip-strategy-engine.test.ts`, `src/components/planner/ChipStrategyPanel.test.tsx`, `tests/components/club-form/FixtureEaseRankingPanel.test.tsx`
- **Verification:** `npx tsc --noEmit` passes (only pre-existing captain-picks test errors remain, confirmed pre-existing before my changes)
- **Committed in:** `b1be98f` (part of task commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — downstream consumer breakage from new required fields)
**Impact on plan:** Required to satisfy the plan's own `tsc --noEmit` success criterion. The `computeClubForm()` extension also implements core swing computation logic that Plan 47-02 depends on. No scope creep.

## Issues Encountered

- Pre-existing TypeScript errors in `tests/lib/captain-picks.test.ts` (5 errors, "Expected 0 arguments but got 1") — confirmed pre-existing before this plan's changes. Out of scope per scope boundary rules. Logged to deferred items.

## Known Stubs

None — type extensions are complete contracts with no placeholder values.

## Next Phase Readiness

- Plan 47-02 (engine/club-form.ts extension) can import ClubForm.past_ease_3gw, swing_1gw/3gw/5gw directly — the computeClubForm() computation is already wired
- Plan 47-03 (pipeline/merge.py) can target MergedPlayer.cs_prob_1gw as the destination field name
- Plan 47-04 (GemTable column) can use MergedPlayer.cs_prob_1gw for the CS% column
- Plan 47-05 (FixtureSwingDetector component) can consume ClubForm swing fields from useClubForm hook

---
*Phase: 47-fixture-swing-cs-prob*
*Completed: 2026-05-01*
