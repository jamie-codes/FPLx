---
phase: 101
plan: "01"
subsystem: transfers-engine
tags: [transfers, xpts, gw-targeted, typescript-port, tdd]
dependency_graph:
  requires: []
  provides: [computeGwXpts, suggestTransfers-targetGw]
  affects: [src/lib/suggest-transfers.ts, src/lib/gw-xpts.ts]
tech_stack:
  added: [src/lib/gw-xpts.ts]
  patterns: [pure-function, tdd-red-green, vitest-node-environment]
key_files:
  created:
    - src/lib/gw-xpts.ts
    - src/lib/gw-xpts.test.ts
  modified:
    - src/lib/suggest-transfers.ts
    - src/lib/suggest-transfers.test.ts
decisions:
  - "scorePlayer local function used as single dispatch point so only 1 conditional check (targetGw !== undefined) exists in the entire function — avoids scattering the check across all 4 scoring sites"
  - "denominator=1 when targetGw is set; this is semantically correct (single-GW basis) and avoids the UI having to compensate for horizon-scaling"
  - "horizonScore function retained intact — still called via scorePlayer for the non-GWT path; avoids any regression"
  - "Comment in file header updated from 'xPtsGain / horizon' to 'xPtsGain / denominator' to match implementation"
metrics:
  duration: ~15 min
  completed: "2026-05-12"
  tasks: 2
  files: 4
---

# Phase 101 Plan 01: GWT-01 Engine — computeGwXpts + suggestTransfers targetGw Wiring Summary

**One-liner:** GW-targeted transfer engine: TypeScript port of Python `_xpts_per_gw` as `computeGwXpts`, wired into `suggestTransfers` via optional `targetGw` parameter routing all 4 scoring sites through a `scorePlayer` dispatch function.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | computeGwXpts pure helper + unit tests | f601f2e | src/lib/gw-xpts.ts (new), src/lib/gw-xpts.test.ts (new) |
| 2 | suggestTransfers targetGw parameter + tests | 9eedde9 | src/lib/suggest-transfers.ts, src/lib/suggest-transfers.test.ts |

## What Was Built

### Task 1: `src/lib/gw-xpts.ts` (new)

TypeScript port of Python `pipeline/merge.py` `_xpts_per_gw` logic as a pure function:

- **Constants** (verbatim match to Python): `GOAL_PTS {1:6,2:6,3:5,4:4}`, `ASSIST_PTS=3`, `CS_PTS {1:6,2:6,3:1,4:0}`, `BONUS_RATE {1:0.30,2:0.40,3:0.60,4:0.70}`
- **`csProb(defensiveDifficulty, xmins)`**: `max(0.10, min(0.65, 0.40 - dd * 0.30)) * min(1.0, xmins/60.0)` — direction verified (high dd = low CS chance)
- **`fixtureXpts(...)`**: `appearance_pts = start_prob * 2` (per START, NOT per minute — D-07 pitfall avoided), `xmins/90` scaling for goal/assist/bonus
- **`computeGwXpts(player, targetGw)`**: filters fixtures by `event_id === targetGw`, sums across DGW fixtures, returns 0 for BGW; top-level guards `start_prob <= 0 || xmins <= 0`; defensive fallbacks `xg_per90 ?? 0`, `xa_per90 ?? 0`, `defensive_difficulty ?? 0.5`

### Task 2: `src/lib/suggest-transfers.ts` (modified)

Changes to support optional `targetGw?: number` parameter:

**Lines added/changed:**
- Line 30: `import { computeGwXpts } from './gw-xpts'`
- Line 49: `targetGw?: number` added to `SuggestTransfersParams`
- Lines 92–94: `scorePlayer` dispatch + `denominator` locals
- Line 119: in-pool sort changed from `horizonScore(b, field) - horizonScore(a, field)` → `scorePlayer(b) - scorePlayer(a)`
- Lines 133, 141: 1-FT sell/buy scoring: `sellHorizonPts` → `sellScore = scorePlayer(sell)`, gain uses `scorePlayer(buy) - sellScore`
- Line 148: `xPtsGain / horizon` → `xPtsGain / denominator`
- Lines 190, 197, 201, 205: 2-FT sell1/sell2/gain1/gain2 all switched to `scorePlayer`
- Line 213: 2-FT `xPtsGain / horizon` → `xPtsGain / denominator`

**`horizonScore` retained** at function definition (line 53) and called once via `scorePlayer` (line 93). Not present in any sort or gain calculation.

## Test Counts

| File | Before | After | New tests |
|------|--------|-------|-----------|
| src/lib/gw-xpts.test.ts | 0 (new) | 8 | 8 (BGW, single, DGW sum, xmins guard, start_prob guard, dd fallback, GK vs MID CS, null xg/xa) |
| src/lib/suggest-transfers.test.ts | 22 | 25 | 3 (routes through computeGwXpts, denominator=1, no regression) |

Total: 31 tests, all passing. `npx tsc --noEmit` exits 0.

## Scoring Site Confirmation

All 4 scoring sites switched to `scorePlayer`, verified by `grep -c "scorePlayer(" src/lib/suggest-transfers.ts` → 7:

1. In-pool sort (line 119): `scorePlayer(b) - scorePlayer(a)`
2. 1-FT sell score (line 139): `const sellScore = scorePlayer(sell)`
3. 1-FT buy score (line 141): `scorePlayer(buy) - sellScore`
4. 2-FT sell1 score (line 190): `const sell1Pts = scorePlayer(sell1)`
5. 2-FT sell2 score (line 197): `const sell2Pts = scorePlayer(sell2)`
6. 2-FT buy1 gain (line 201): `scorePlayer(buy1) - sell1Pts`
7. 2-FT buy2 gain (line 205): `scorePlayer(buy2) - sell2Pts`

Both denominator sites switched (`/denominator` appears 2 times as required).

## Deviations from Plan

None — plan executed exactly as written. The comment on line 14 of suggest-transfers.ts was updated from `xPtsGain / horizon` to `xPtsGain / denominator` to accurately reflect the implementation (cosmetic alignment, not a functional deviation).

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/lib/gw-xpts.ts exists | FOUND |
| src/lib/gw-xpts.test.ts exists | FOUND |
| src/lib/suggest-transfers.ts exists | FOUND |
| src/lib/suggest-transfers.test.ts exists | FOUND |
| SUMMARY.md exists | FOUND |
| Commit f601f2e (Task 1) | FOUND |
| Commit 9eedde9 (Task 2) | FOUND |
