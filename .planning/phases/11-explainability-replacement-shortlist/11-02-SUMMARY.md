---
phase: 11-explainability-replacement-shortlist
plan: "02"
subsystem: replacement-shortlist
tags: [tdd, pure-function, shortlist, budget-arithmetic, pts-delta]
dependency_graph:
  requires: []
  provides: [computeReplacementShortlist, ShortlistEntry]
  affects: [replacement shortlist UI consumers]
tech_stack:
  added: []
  patterns: [TDD red-green, pure function, budget arithmetic mirroring transfer-engine]
key_files:
  created:
    - src/lib/replacement-shortlist.ts
    - tests/lib/replacement-shortlist.test.ts
  modified: []
decisions:
  - "Ranked by pts_delta (proj_pts_1gw delta) descending per D-05 — NOT gem_delta"
  - "Budget arithmetic mirrors transfer-engine.ts exactly: available_budget = bankBalance/10 + sellPlayer.now_cost/10"
  - "Pitfall 5 guard: candidate.proj_pts_1gw > 0 (strict) excludes zero-projection players"
  - "sellPlayer excluded via id comparison independent of squadIds membership"
metrics:
  duration_minutes: 2
  completed_date: "2026-03-30"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 11 Plan 02: Replacement Shortlist Summary

TDD implementation of `computeReplacementShortlist` — a pure function returning ranked replacement alternatives for Sell-verdicted players, with projected points delta and affordability indicator mirroring `transfer-engine.ts` budget arithmetic.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | RED — Write failing tests for computeReplacementShortlist | 4deb8ea | tests/lib/replacement-shortlist.test.ts, src/lib/replacement-shortlist.ts (stub) |
| 2 | GREEN — Implement computeReplacementShortlist to pass all tests | 7d0d71f | src/lib/replacement-shortlist.ts |

## What Was Built

`src/lib/replacement-shortlist.ts` exports:

- `ShortlistEntry` interface: `{ player: ScoredPlayer, pts_delta: number, budget_sufficient: boolean }`
- `computeReplacementShortlist(sellPlayer, allPlayers, squadIds, bankBalance, count=5): ShortlistEntry[]`

The function filters the player population to same-position candidates not in the squad and with positive proj_pts_1gw, computes pts_delta and budget_sufficient for each, sorts by pts_delta descending, and returns up to `count` entries.

`tests/lib/replacement-shortlist.test.ts` has 11 test cases covering all specified behaviors: sort order, pts_delta arithmetic, squad exclusion, zero-projection exclusion, position filtering, budget affordability (true/false), partial results, empty results, count limiting, and sellPlayer self-exclusion.

## Test Results

- Shortlist test file: 11/11 passed
- Full suite: 157 passed, 8 skipped, 0 failed (15 test files)

## Deviations from Plan

None — plan executed exactly as written. TDD RED/GREEN cycle followed. Implementation matches the plan's reference code verbatim.

## Known Stubs

None — `computeReplacementShortlist` is fully implemented and all tests pass.
