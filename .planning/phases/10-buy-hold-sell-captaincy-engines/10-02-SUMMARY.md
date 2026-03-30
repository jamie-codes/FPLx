---
phase: 10-buy-hold-sell-captaincy-engines
plan: 02
subsystem: api
tags: [typescript, vitest, tdd, captaincy, fpl, pure-function]

# Dependency graph
requires:
  - phase: 10-buy-hold-sell-captaincy-engines
    provides: ScoredPlayer type and SquadPick type from types.ts and squad-adapter.ts
provides:
  - CaptaincyCandidate interface (projected_captain_pts, captain_type safe/upside)
  - computeCaptaincyCandidates pure function: filters starting-XI, excludes injured/zero-proj, classifies captain type
affects:
  - 10-03 (UI integration will consume computeCaptaincyCandidates)
  - captaincy panel components

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pure function with no side effects for engine logic
    - Position average computed from full allPlayers pool (not just squad)
    - TDD red-green cycle: 13 tests written before implementation

key-files:
  created:
    - src/lib/captaincy-engine.ts
    - tests/lib/captaincy-engine.test.ts
  modified: []

key-decisions:
  - "Position averages computed from ALL allPlayers (full pool), not just squad picks — same pattern as recommend.ts"
  - "captain_type is 'safe' only when mins_risk === 'nailed' AND gem_score >= position average; everything else is 'upside'"
  - "projected_captain_pts = proj_pts_1gw * 2; normalise() must NOT be applied"
  - "computePositionAverages helper is inline (not imported from recommend.ts) since plan 01 ran in parallel — plan 03 will deduplicate if needed"

patterns-established:
  - "Engine pattern: pure function accepts (squadPicks, allPlayers, topN?) and returns typed candidates array"
  - "Filter-then-classify: filter first (position, injured, zero-proj) then compute derived fields"

requirements-completed: [CAP-01, CAP-02]

# Metrics
duration: 3min
completed: 2026-03-30
---

# Phase 10 Plan 02: Captaincy Engine Summary

**Pure TypeScript captaincy ranking engine using TDD — returns top-5 candidates with projected_captain_pts and safe/upside classification**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-30T13:06:20Z
- **Completed:** 2026-03-30T13:09:00Z
- **Tasks:** 2 (RED + GREEN TDD phases)
- **Files modified:** 2

## Accomplishments

- 13 unit tests written in RED phase covering all filtering, sorting, and classification rules
- computeCaptaincyCandidates pure function implemented — filters starting-XI only, excludes injured/zero-projection, doubles proj_pts_1gw for captain score
- captain_type classification: 'safe' = nailed + gem_score >= position average; 'upside' = everything else
- Full test suite remains green (117 passed, 8 skipped across 12 test files)

## Task Commits

1. **RED Phase: failing tests** - `2d354c3` (test)
2. **GREEN Phase: implementation** - `4b1fee4` (feat)

## Files Created/Modified

- `src/lib/captaincy-engine.ts` - CaptaincyCandidate interface and computeCaptaincyCandidates function
- `tests/lib/captaincy-engine.test.ts` - 13 unit tests using makeScoredPlayer/makeSquadPick factories

## Decisions Made

- `computePositionAverages` is implemented inline rather than imported from recommend.ts — plan 02 runs in the same wave as plan 01 and cannot depend on it; plan 03 will deduplicate if needed
- Position averages use ALL players in the allPlayers pool (not filtered to squad picks) to ensure representative averages, consistent with the gem-score computation pattern
- topN defaults to 5 matching the UI spec for captaincy rankings

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `computeCaptaincyCandidates` is ready for UI consumption in plan 03 (CaptaincyPanel component)
- Exports `CaptaincyCandidate` interface and `computeCaptaincyCandidates` function as specified in UI-SPEC
- No blockers

---
*Phase: 10-buy-hold-sell-captaincy-engines*
*Completed: 2026-03-30*
