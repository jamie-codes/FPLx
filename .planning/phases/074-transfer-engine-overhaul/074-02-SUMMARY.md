---
phase: "074"
plan: "02"
subsystem: transfer-engine
tags: [engine, suggest-transfers, team-cap, dedup, tdd, wave-1]
dependency_graph:
  requires:
    - "074-01 — TransferSuggestion combo cost: 0|4|8 type extension"
  provides:
    - "suggestTransfers() enforces FPL 3-player-per-team cap (TFX-01)"
    - "suggestTransfers() 2-FT combos deduplicate both buy-side and sell-side (TFX-02)"
    - "suggestTransfers() always emits combos regardless of ftCount (D-06)"
    - "breakEven() accepts cost: 0|4|8 (Plan 03 will use cost:8 for -8 hit row)"
    - "7 new unit tests documenting TFX-01, TFX-02, D-06, TFX-05 invariants"
  affects:
    - "src/lib/suggest-transfers.ts — engine behaviour changed"
    - "src/lib/suggest-transfers.test.ts — 7 new describe blocks added"
    - "Plans 03 and 04 — combo always-emit is prerequisite for -8 Hit row derivation"
tech_stack:
  added: []
  patterns:
    - "Team cap filter via teamCountMap + cappedTeams Set (playerById lookup, not SquadPick.team)"
    - "Always-emit combo enumeration with ftCount-driven cost (0 or 4)"
    - "Sell-side dedup guard: sell2.id !== sell1.id within combo loop"
    - "makeValidSquad team rotation (teams 1-8, max 2/team) to preserve test compatibility"
key_files:
  modified:
    - path: src/lib/suggest-transfers.ts
      change: "breakEven widened (line 77), team cap filter inserted (lines 92-105), inPoolByPosition cap guard (line 112), combo loop always-emit + sell-side dedup (lines 171-225)"
    - path: src/lib/suggest-transfers.test.ts
      change: "makeValidSquad team rotation (line 70), 7 new it() tests in 4 new describe blocks (lines 342-522)"
decisions:
  - "makeValidSquad updated to use team rotation 1-8 (not all team:1) so existing tests remain compatible with TFX-01 cap filter — this is a test fixture fix, not a behaviour change"
  - "sell-side dedup guard added at outer loop level (sell2.id === sell1.id) plus redundant inner guard for defence-in-depth"
  - "-8 Hit row NOT emitted by engine — per D-07 it is derived from best cost:0 combo in computeOpportunityCostRows (Plan 03)"
  - "TFX-02 scope confirmed as within-combo dedup only (not cross-row per RESEARCH.md Pitfall 8)"
metrics:
  duration: "12 minutes"
  completed_date: "2026-05-06"
  tasks_completed: 2
  files_changed: 2
---

# Phase 074 Plan 02: Wave 1 — Engine Fixes Summary

Engine-tier implementation of TFX-01 (3-per-team cap), TFX-02 (sell-side dedup), D-06 (always-emit combos), and breakEven cost:8 widening in `suggestTransfers()`, with 7 new unit tests covering all new invariants.

## Tasks Completed

### Task 02-01: TFX-01 Team Cap Filter + Widen breakEven Cost Union

**Commit:** 9d06d49

**Changes in `src/lib/suggest-transfers.ts`:**

1. **`breakEven` signature widened** (line 77): `cost: 0 | 4` → `cost: 0 | 4 | 8`. Formula changed from hardcoded `ceil(4 / x)` to `ceil(cost / x)` so it generalises correctly to cost=8.

2. **Team cap filter block inserted** (lines 92-105), after `ownedIds` construction and before `inPoolByPosition` build:
   - Iterates `currentPicks`, looks up each player's team via `playerById.get(pick.element)?.team` (not `pick.team` — SquadPick has no team field per Pitfall 1 in RESEARCH.md)
   - Builds `teamCountMap: Map<number, number>` keyed on team ID
   - Derives `cappedTeams: Set<number>` for teams with count >= 3

3. **`inPoolByPosition` filter updated** (line 112): Added `&& !cappedTeams.has(p.team)` to the candidate filter predicate.

**Changes in `src/lib/suggest-transfers.test.ts`:**

- `makeValidSquad()` updated to assign teams via `(i % 8) + 1` rotation (teams 1-8, max 2 players per team). This is a fixture fix required by the cap filter — the original all-team-1 default would have capped all candidates from team 1 in every existing test.

### Task 02-02: Always-Emit Combos + TFX-02 Sell-Side Dedup + 7 New Tests

**Commit:** b068589

**Changes in `src/lib/suggest-transfers.ts` (combo loop, lines 171-225):**

1. **Outer `if (ftCount === 2)` guard removed** — combo loop now always runs (D-06). Plan 03's mapper can derive the −8 Hit row from combos regardless of the user's FT count.

2. **Cost is now ftCount-dependent** (line 211): `const cost: 0 | 4 = ftCount === 2 ? 0 : 4`. When ftCount=2, both transfers are free (cost:0). When ftCount=1, the second transfer is a hit (cost:4).

3. **Sell-side dedup guard added** at outer loop level (line 189): `if (sell2.id === sell1.id) continue`. A redundant inner guard also added at line 199 for defence-in-depth.

**New test describe blocks in `src/lib/suggest-transfers.test.ts` (lines 342-522):**

| Block | Tests | Coverage |
|-------|-------|----------|
| `Phase 74: Team cap filter (TFX-01)` | 2 | Excludes team-capped buys; allows buys when only 2 owned |
| `Phase 74: Sell-side dedup in 2-FT combos (TFX-02)` | 2 | sell1.id !== sell2.id; buy1.id !== buy2.id regression |
| `Phase 74: Combos always emitted (D-06)` | 2 | cost:0 combo when ftCount=2; cost:4 combo when ftCount=1 |
| `Phase 74: Bank constraint (TFX-05)` | 1 | Over-budget buy filtered; equal-cost buy allowed |

**Total tests: 13 original → 20 (7 new it() blocks across 4 describe blocks)**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed makeValidSquad team fixture incompatibility with TFX-01 cap filter**
- **Found during:** Task 02-01 implementation (8 tests failed after cap filter added)
- **Issue:** `makeValidSquad()` previously set all 15 players to `team: 1` (the `makePlayer` default). After adding the cap filter, any outsider candidate also defaulting to `team: 1` was filtered out by the cap (15 owned players on team 1 → cap triggered). All existing tests that add candidates with default `team: 1` returned 0 results.
- **Fix:** Updated `makeValidSquad()` to rotate teams 1-8 (formula: `(i % 8) + 1`), ensuring no team exceeds 2 players in the base squad. This is a pure fixture fix — no assertion changes, no behaviour changes. Out-of-squad candidates still default to `team: 1` which is now safely below the cap (only 2 squad players on team 1).
- **Files modified:** `src/lib/suggest-transfers.test.ts` (line 70 team assignment)
- **Commit:** 9d06d49

**2. [Rule 1 - Bug] Fixed TFX-01 test for "2 owned on same team" using ambiguous team IDs**
- **Found during:** Task 02-02 test writing (1 test failed)
- **Issue:** The "allows buy candidates when user owns only 2 players" test originally overrode players 3 and 4 to team 5. But in the new `makeValidSquad()` rotation, player ID 5 naturally lands on team `(5-1)%8+1 = 5`. So there were actually 3 players on team 5 (ids 3, 4, 5), triggering the cap.
- **Fix:** Changed the test to use team 99 (absent from the 1-8 rotation) and override players 1 and 3 (which are teams 1 and 3 naturally). Only 2 squad players end up on team 99, cap not triggered, candidate from team 99 is allowed.
- **Files modified:** `src/lib/suggest-transfers.test.ts` (TFX-01 second test body)
- **Commit:** b068589

## Threat Flags

None — pure TypeScript engine logic with no I/O, no user input crossing trust boundaries, no auth surface. The T-074-02 mitigation from the plan's threat model is satisfied: the cap filter applies unconditionally inside `suggestTransfers()` before the candidate pool is built. No caller can bypass it via params.

## Known Stubs

None — all new logic is fully implemented. The `breakEven` formula for cost:8 is ready; Plan 03 will use it when building the -8 Hit row in `computeOpportunityCostRows`.

## Self-Check: PASSED

- FOUND: src/lib/suggest-transfers.ts
- FOUND: src/lib/suggest-transfers.test.ts
- FOUND: .planning/phases/074-transfer-engine-overhaul/074-02-SUMMARY.md
- FOUND: commit 9d06d49 (feat(074-02): TFX-01 team cap filter + widen breakEven)
- FOUND: commit b068589 (feat(074-02): always-emit combos + TFX-02 sell-side dedup + 7 new tests)
