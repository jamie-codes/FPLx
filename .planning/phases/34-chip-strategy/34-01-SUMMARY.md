---
phase: 34-chip-strategy
plan: 01
subsystem: analytics
tags: [fpl, chip-strategy, scoring-engine, tanstack-query, tdd, pure-functions]

requires:
  - phase: 31-captaincy-ceiling
    provides: xPts_90th_1gw per player (used by TC candidate ranking in computeTCScore)
  - phase: 27-fdr-plus-plus-pipeline
    provides: attacking_difficulty per ClubFormFixture (ease polarity source)
  - phase: 28-xpts-engine
    provides: xPts_1gw per player (used by FH weighted scoring and TC fallback)

provides:
  - Pure scoring functions: buildClubFormMap, computeBBScore, computeTCScore, computeFHResult
  - Types: GWEaseScore, FHResult, FHSquadPlayer exported from chip-strategy-engine.ts
  - Constants: BGW_NEUTRAL_EASE=0.5, TC_CANDIDATE_COUNT=3, FH_HORIZON=5, FH_TEAM_CAP=3
  - TanStack Query hook: useChipHistory(teamId) with ChipHistoryEntry type
  - 28 unit tests covering all 3 scorers + helper + edge cases
  - Wave 0 test stub for ChipStrategyPanel.test.tsx (consumed by Plan 02)

affects: [34-02, ChipStrategyPanel]

tech-stack:
  added: []
  patterns:
    - "pure-function chip scoring: separate chip-strategy-engine.ts from React components for testability"
    - "numeric teamId validation: /^\\d+$/.test(teamId) in enabled guard (T-34-01 ASVS V5)"
    - "BGW neutral ease: BGW_NEUTRAL_EASE=0.5 fallback when team has no fixture for target GW"
    - "FH formation greedy: slot-fill 15 players with position quotas + FH_TEAM_CAP=3 team cap"
    - "TC fallback chain: xPts_90th_1gw ?? xPts_1gw ?? proj_pts_1gw ?? 0"

key-files:
  created:
    - src/lib/chip-strategy-engine.ts
    - src/lib/chip-strategy-engine.test.ts
    - src/lib/hooks/useChipHistory.ts
    - src/components/planner/ChipStrategyPanel.test.tsx
  modified: []

key-decisions:
  - "D-01 fixture-ease heuristic: ease = 1 - attacking_difficulty at engine boundary (polarity inversion done once, consistently)"
  - "D-02 5 GW horizon: deriveHorizonGws uses union of event_ids from clubFormMap, falls back to [startGw..startGw+4]"
  - "D-04 BB ease = mean ease across bench players; BGW player contributes BGW_NEUTRAL_EASE=0.5 to the average"
  - "D-05 TC ease = max ease of top-3 candidates per GW (not sum); tie-break: earliest GW via > not >="
  - "D-07 FH greedy: sort all eligible players by weighted DESC; fill slots in order respecting minSlots/maxSlots/teamCap/budget"
  - "D-08 FH score = sum of top-11 weighted (1 GK + 10 best outfield); bestGw has highest score"
  - "T-34-01 mitigated: /^\\d+$/.test(teamId) guard in useChipHistory.enabled prevents URL injection"

patterns-established:
  - "Pattern: chip-strategy-engine.ts module shape mirrors planning-engine.ts (pure functions, JSDoc, playerMap, no hooks)"
  - "Pattern: useChipHistory mirrors useSquad.ts exactly with teamId, staleTime, retry=1"
  - "Pattern: Wave 0 test stubs in both engine and component test files per 34-VALIDATION.md Nyquist rule"

requirements-completed:
  - CHIP-01
  - CHIP-02
  - CHIP-03

duration: 6min
completed: 2026-04-28
---

# Phase 34 Plan 01: Chip Strategy Engine Summary

**Pure BB/TC/FH scoring functions + useChipHistory hook with numeric teamId guard; 28 unit tests covering all 3 scorers and 5 Common Pitfalls from RESEARCH**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-28T21:14:07Z
- **Completed:** 2026-04-28T21:20:00Z
- **Tasks:** 4
- **Files modified:** 4 created

## Accomplishments
- `chip-strategy-engine.ts` exports 4 pure functions (buildClubFormMap, computeBBScore, computeTCScore, computeFHResult), 4 constants, 3 types — zero React imports (purity verified)
- `useChipHistory.ts` hook with T-34-01 mitigation: `/^\d+$/.test(teamId)` in `enabled` guard prevents URL injection through FPL proxy
- 28 deterministic unit tests passing; covers ease polarity (Pitfall 1), BGW neutral ease (Pitfall 2), TC fallback chain (Pitfall 3), FH team cap (Pitfall 4), FH budget (Pitfall 5)
- Wave 0 test stubs in both `chip-strategy-engine.test.ts` and `ChipStrategyPanel.test.tsx` ready for Plan 02

## Task Commits

1. **Task 1: Wave 0 test stubs** - `9b355c3` (test)
2. **Task 2: chip-strategy-engine pure functions** - `c332bd3` (feat)
3. **Task 3: Fill engine tests with deterministic fixtures** - `4ac2174` (test)
4. **Task 4: useChipHistory hook + test TypeScript fixes** - `6669bf3` (feat)

## Files Created/Modified
- `src/lib/chip-strategy-engine.ts` — Pure scoring module: buildClubFormMap, computeBBScore (CHIP-01), computeTCScore (CHIP-02), computeFHResult (CHIP-03) + types GWEaseScore/FHResult/FHSquadPlayer
- `src/lib/chip-strategy-engine.test.ts` — 28 unit tests with makePlayer/makeClubForm/makeFx fixture builders; covers all 5 Common Pitfalls
- `src/lib/hooks/useChipHistory.ts` — TanStack Query hook with numeric teamId guard, 6h staleTime, `data.chips ?? []` extraction
- `src/components/planner/ChipStrategyPanel.test.tsx` — Wave 0 stub with jsdom env, render import, 9 it.todo placeholders for Plan 02

## Decisions Made

- **Ease polarity inversion at engine boundary:** `ease = 1 - attacking_difficulty` applied in `easeForTeamGw` helper — used by all three scorers consistently (D-01)
- **BGW neutral ease = 0.5 for BB averaging:** when a bench player's team has no fixture, their contribution to the BB average is 0.5 (not skipped, not 0) — keeps the average well-defined for mixed BGW/non-BGW benches
- **FH budget fallback:** when `currentSquadIds` is undefined, budget = `bankBalance + FH_DEFAULT_BUDGET_TENTHS` (not `FH_DEFAULT_BUDGET_TENTHS` alone) — caller always controls bankBalance
- **isBest tie-break: earliest GW wins** — implemented via `>` (strict) not `>=` when scanning scores array; first index stays if equal scores

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed duplicate property keys in makePlayer test fixture**
- **Found during:** Task 4 (TypeScript compile check after adding useChipHistory.ts)
- **Issue:** `makePlayer` had `id`, `element_type`, `team`, `now_cost` listed both in the explicit fields and in the `...overrides` spread, causing TS2783 duplicate property errors
- **Fix:** Rewrote `makePlayer` to build a `base` object first, then spread `...overrides` on top — no duplicate keys
- **Files modified:** src/lib/chip-strategy-engine.test.ts
- **Verification:** `npx tsc --noEmit` exits with only pre-existing errors (InsightsTab.test.tsx, captain-picks.test.ts)
- **Committed in:** 6669bf3 (Task 4 commit)

**2. [Rule 1 - Bug] Fixed MinsRisk type in makePlayer**
- **Found during:** Task 4 (TypeScript compile check)
- **Issue:** `mins_risk: 'starter'` is not a valid `MinsRisk` value — correct values are `'nailed' | 'likely_start' | 'rotation_risk' | 'cameo' | 'injured'`
- **Fix:** Changed default to `mins_risk: 'nailed'`
- **Files modified:** src/lib/chip-strategy-engine.test.ts
- **Committed in:** 6669bf3 (Task 4 commit)

**3. [Rule 1 - Bug] Fixed budget test using bankBalance-only budget**
- **Found during:** Task 3 (test run after implementing computeFHResult)
- **Issue:** Budget test passed `budget=500` as `bankBalance` with no `currentSquadIds`, but without currentSquadIds the budget = bankBalance + FH_DEFAULT_BUDGET_TENTHS = 1500, not 500 — test assertion failed
- **Fix:** Rewrote test to use explicit `currentSquadIds` + low `sellPrices` to produce a controlled tight budget
- **Files modified:** src/lib/chip-strategy-engine.test.ts
- **Committed in:** 6669bf3 (Task 4 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 bugs found during TypeScript compile / test run)
**Impact on plan:** All fixes in test file only; production code unchanged. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in `src/components/insights/InsightsTab.test.tsx` and `tests/lib/captain-picks.test.ts` — these are out-of-scope, pre-existing, and documented as deferred. Not introduced by this plan.

## Threat Surface Scan
No new network endpoints, auth paths, file access patterns, or schema changes introduced.
`useChipHistory` calls an existing FPL proxy route (`/api/fpl/[...proxy]`) — no new surface.
T-34-01 mitigation (`/^\d+$/.test(teamId)`) is in place per threat register.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 02 (ChipStrategyPanel component) has all it needs: typed pure functions exported from chip-strategy-engine.ts, useChipHistory hook, Wave 0 test stub ready to fill
- `ChipStrategyPanel.test.tsx` has jsdom env + render import pre-loaded — Plan 02 only needs to add vi.mock calls and real test bodies
- All data shapes locked: GWEaseScore, FHResult, FHSquadPlayer, ChipHistoryEntry

## Self-Check: PASSED

All 4 production/test files created and verified. All 4 task commits verified in git log.

---
*Phase: 34-chip-strategy*
*Completed: 2026-04-28*
