---
phase: 32
plan: "01"
subsystem: pipeline, types, utility
tags: [xgi, pipeline, types, utility, tdd]
dependency_graph:
  requires:
    - "Phase 27: FDR++ (attacking_difficulty on ClubFormFixture)"
    - "Phase 29: regression_signal on MergedPlayer (D-09 xG/xA source convention)"
  provides:
    - "expected_goals and expected_assists on every player in merged_players.json"
    - "MergedPlayer.expected_goals and MergedPlayer.expected_assists TypeScript fields"
    - "computeXgiInvolvement(players): Map<playerId, share> utility in src/lib/xgi.ts"
  affects:
    - "Phase 32 Plan 02: FixtureEaseRankingPanel TARGET badge + player expansion"
tech_stack:
  added: []
  patterns:
    - "Two-pass Map aggregation (team totals first, per-player share second) — same pattern as gem-score.ts"
    - "float(element.get(key, 0) or 0) guard for FPL string-decimal fields — matches _safe_float convention"
key_files:
  created:
    - path: "src/lib/xgi.ts"
      description: "computeXgiInvolvement — pure two-pass utility returning Map<playerId, 0..1 share>"
    - path: "tests/lib/xgi.test.ts"
      description: "5 Vitest unit tests covering single-team, zero-division, single-player, multi-team, zero-contribution"
  modified:
    - path: "pipeline/merge.py"
      description: "Add expected_goals and expected_assists from FPL bootstrap element to per-player dict (lines 769–772)"
    - path: "src/lib/types.ts"
      description: "Add expected_goals: number and expected_assists: number to MergedPlayer after assists field"
    - path: "tests/lib/gem-score.test.ts"
      description: "Add expected_goals: 0, expected_assists: 0 to test fixture (Rule 1 fix)"
    - path: "tests/lib/captaincy-engine.test.ts"
      description: "Add expected_goals: 0, expected_assists: 0 to test fixture (Rule 1 fix)"
    - path: "tests/lib/explain.test.ts"
      description: "Add expected_goals: 0, expected_assists: 0 to test fixture (Rule 1 fix)"
    - path: "tests/lib/planning-engine.test.ts"
      description: "Add expected_goals: 0, expected_assists: 0 to test fixture (Rule 1 fix)"
    - path: "tests/lib/recommend.test.ts"
      description: "Add expected_goals: 0, expected_assists: 0 to test fixture (Rule 1 fix)"
    - path: "tests/lib/replacement-shortlist.test.ts"
      description: "Add expected_goals: 0, expected_assists: 0 to test fixture (Rule 1 fix)"
    - path: "tests/lib/transfer-engine.test.ts"
      description: "Add expected_goals: 0, expected_assists: 0 to test fixture (Rule 1 fix)"
    - path: "src/lib/__tests__/planning-engine-rescore.test.ts"
      description: "Add expected_goals: 0, expected_assists: 0 to test fixture (Rule 1 fix)"
decisions:
  - "Non-optional fields on MergedPlayer (expected_goals: number, expected_assists: number) — matches goals_scored/assists convention; FPL element always supplies these as '0.00' string defaults"
  - "TDD RED/GREEN sequence preserved: test file committed as failing import before implementation"
  - "Pre-existing captain-picks.test.ts TypeScript errors (5x Expected 0 arguments, but got 1) are out-of-scope — predated this plan"
metrics:
  duration: "3 minutes"
  completed: "2026-04-28"
  tasks: 2
  files_created: 2
  files_modified: 10
---

# Phase 32 Plan 01: xGI Data Foundation Summary

Phase 32 Plan 01 ships the data foundation for xGI involvement %: FPL StatsBomb `expected_goals` / `expected_assists` persisted in the pipeline, declared on `MergedPlayer`, and wrapped in the pure `computeXgiInvolvement` utility with 5 passing unit tests.

## What Was Built

### Pipeline change — `pipeline/merge.py`

Lines 769–772 (post-edit): inserted `expected_goals` and `expected_assists` into the per-player dict assembly loop immediately after `'assists'` (line 767):

```python
# FPL StatsBomb season-total xG/xA (Phase 32 TGT-02, D-09).
# Source: bootstrap elements.expected_goals / expected_assists (string decimals).
# Used by src/lib/xgi.ts computeXgiInvolvement for per-player team-share %.
'expected_goals': float(element.get('expected_goals', 0) or 0),
'expected_assists': float(element.get('expected_assists', 0) or 0),
```

`float(... or 0)` guard matches the codebase's `_safe_float` convention; handles empty strings and None.

### Type extension — `src/lib/types.ts`

Lines 107–110 (post-edit): two non-optional fields added after `assists: number`:

```typescript
// FPL StatsBomb season totals (Phase 32 TGT-02, D-09).
// Source: bootstrap elements.expected_goals / expected_assists (string decimals,
// converted to float in pipeline/merge.py). Used by src/lib/xgi.ts.
expected_goals: number
expected_assists: number
```

Non-optional matches `goals_scored`/`assists` convention — FPL element always supplies "0.00".

### Utility — `src/lib/xgi.ts` (new file)

Exports `computeXgiInvolvement(players: MergedPlayer[]): Map<number, number>`:

- Pass 1: sum `(expected_goals ?? 0) + (expected_assists ?? 0)` per `player.team`
- Pass 2: compute each player's share; skip teams with zero total (zero-division guard)
- Returns `Map<playerId, share>` where share is a 0..1 ratio
- Caller multiplies by 100 for display as %

### Test results

```
npx vitest run tests/lib/xgi.test.ts

Test Files  1 passed (1)
Tests  5 passed (5)
```

All test suite (22 files, 245 tests passing, 34 skipped).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated 8 test fixture helper objects to include new non-optional fields**

- **Found during:** Task 2 GREEN phase (`npx tsc --noEmit` revealed type errors)
- **Issue:** Adding `expected_goals: number` and `expected_assists: number` as non-optional to `MergedPlayer` caused 8 existing test fixture factories to fail type-checking because they were constructed without these new fields
- **Fix:** Added `expected_goals: 0, expected_assists: 0` after `assists: 3` in the `makeScoredPlayer` / `makeMergedPlayer` / `makePlayer` helpers in:
  - `tests/lib/gem-score.test.ts`
  - `tests/lib/captaincy-engine.test.ts`
  - `tests/lib/explain.test.ts`
  - `tests/lib/planning-engine.test.ts`
  - `tests/lib/recommend.test.ts`
  - `tests/lib/replacement-shortlist.test.ts`
  - `tests/lib/transfer-engine.test.ts`
  - `src/lib/__tests__/planning-engine-rescore.test.ts`
- **Files modified:** 8 test files (all committed in feat(32-01) commit)
- **Commit:** `99a266d`

## Deferred Items

**Pre-existing TypeScript errors in `tests/lib/captain-picks.test.ts`** (5 errors: `Expected 0 arguments, but got 1` for `CaptainPicksPanel({})`): Present before this plan's changes (confirmed via `git stash`). Out of scope per deviation scope boundary — logged here for future resolution. File not created or modified by this plan.

## Known Stubs

None — this plan is purely a data foundation (pipeline + types + utility). No UI wired yet. Plan 02 will consume `computeXgiInvolvement` in `FixtureEaseRankingPanel`.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes introduced. `expected_goals`/`expected_assists` are already present in the FPL bootstrap JSON which the pipeline processes. The `float(... or 0)` guard satisfies T-32-01 (Tampering mitigation) from the plan's threat register.

## Self-Check: PASSED

- `src/lib/xgi.ts` exists: FOUND
- `tests/lib/xgi.test.ts` exists: FOUND
- Commits exist: 812b646, 21f2bb0, 99a266d — all present in git log
- `npx tsc --noEmit` exits 0 (excluding pre-existing captain-picks errors): CONFIRMED
- `npx vitest run tests/lib/xgi.test.ts`: 5/5 PASSING
