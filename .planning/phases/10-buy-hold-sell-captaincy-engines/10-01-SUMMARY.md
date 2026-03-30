---
phase: 10-buy-hold-sell-captaincy-engines
plan: "01"
subsystem: recommendation-engine
tags: [tdd, pure-function, gem-score, verdicts, buy-hold-sell]
dependency_graph:
  requires:
    - src/lib/types.ts (ScoredPlayer)
    - src/lib/squad-adapter.ts (SquadPick)
  provides:
    - src/lib/recommend.ts (computeVerdicts, computePositionAverages)
  affects:
    - Plan 02 (captaincy-engine.ts reuses computePositionAverages)
    - Squad UI (verdicts consumed by Buy/Hold/Sell badges)
tech_stack:
  added: []
  patterns:
    - TDD red/green/refactor cycle
    - Pure function with exported helper for reuse
    - Position-average classification with BUY/SELL thresholds
key_files:
  created:
    - src/lib/recommend.ts
    - tests/lib/recommend.test.ts
  modified: []
decisions:
  - "Position averages computed from full allPlayers population (not squad members only) — prevents false Buy verdicts when all squad players are poor"
  - "BUY_THRESHOLD=1.0 (strictly above avg), SELL_THRESHOLD=0.90 (>10% below avg) — Hold band is 0-10% below average"
  - "computePositionAverages extracted as named export for reuse by captaincy-engine.ts in Plan 02"
  - "gem_score used exclusively — no access to raw xg_per90/xa_per90 dimensions (consistent with transfer-engine.ts)"
metrics:
  duration: "90 seconds"
  completed_date: "2026-03-30"
  tasks_completed: 3
  files_created: 2
  files_modified: 0
requirements:
  - REC-01
---

# Phase 10 Plan 01: Buy/Hold/Sell Verdict Engine Summary

**One-liner:** Pure `computeVerdicts` function classifying squad players as Buy/Hold/Sell using gem_score against full-population position averages, with BUY (above avg) / SELL (>10% below avg) / HOLD (within 10%) thresholds.

## What Was Built

`src/lib/recommend.ts` — a pure TypeScript module with zero side effects:

- `computeVerdicts(squadPicks, allPlayers): Map<number, Verdict>` — the main export
- `computePositionAverages(allPlayers): Map<number, number>` — extracted helper for Plan 02 reuse
- `Verdict` type (`'buy' | 'hold' | 'sell'`)
- `BUY_THRESHOLD = 1.0` and `SELL_THRESHOLD = 0.90` — exported constants

**Classification algorithm:**
1. Build lookup map from allPlayers by id
2. Compute position averages (element_type 1-4) across the full population, with 0.5 fallback
3. For each starting-XI pick (position < 12), compare gem_score to positionAvg:
   - Buy: `gem_score > positionAvg` (strictly above)
   - Sell: `gem_score < positionAvg * 0.90` (more than 10% below)
   - Hold: everything else (0 to 10% below)
4. Bench picks (position >= 12) are silently excluded

## Test Results

All 8 tests pass; full suite 112/112 green.

| Test | Verdict |
|------|---------|
| MID gem 0.80 vs avg 0.50 | Buy |
| MID gem 0.30 vs avg 0.50 | Sell |
| MID gem 0.48 vs avg 0.50 | Hold |
| Bench player (position 12) | Excluded |
| No contradictory verdicts | Sell gem < Buy gem |
| Null xG/xA player | Valid verdict |
| Empty picks array | Empty map |
| Full population averages | Correct (not squad-only) |

## Commits

| Hash | Message |
|------|---------|
| 7ecd94e | test(10-01): add failing tests for computeVerdicts |
| 6a733d6 | feat(10-01): implement computeVerdicts Buy/Hold/Sell engine |

## Deviations from Plan

None — plan executed exactly as written. The REFACTOR step (extract `computePositionAverages`) was implemented inline during GREEN phase since the helper was needed from the start of implementation.

## Known Stubs

None — `computeVerdicts` is fully functional. Position averages computed from real data. No placeholder text or hardcoded empty values.

## Self-Check: PASSED

- `src/lib/recommend.ts` exists: FOUND
- `tests/lib/recommend.test.ts` exists: FOUND
- Commit 7ecd94e (RED): FOUND
- Commit 6a733d6 (GREEN): FOUND
- All 8 tests pass: VERIFIED (npx vitest run tests/lib/recommend.test.ts → 8 passed)
- Full suite green: VERIFIED (112 passed, 0 failures)
