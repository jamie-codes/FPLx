---
phase: 45
plan: "01"
subsystem: transfer-engine
tags: [tdd, types, skeleton, wave-0]
dependency_graph:
  requires: []
  provides:
    - TransferSuggestion discriminated union (src/lib/types.ts)
    - suggestTransfers skeleton function (src/lib/suggest-transfers.ts)
    - Wave 0 RED test suite (src/lib/suggest-transfers.test.ts)
  affects:
    - Plan 02 (Wave 1 — real engine implementation must turn tests GREEN)
    - Plan 03 (Wave 2 — UI integration depends on real engine)
tech_stack:
  added: []
  patterns:
    - Pure TS engine pattern (mirrors optimise-lineup.ts: no use client, no React, no side effects)
    - TDD RED gate: skeleton returns [] so tests fail; Plan 02 implements real algorithm
key_files:
  created:
    - src/lib/suggest-transfers.ts
    - src/lib/suggest-transfers.test.ts
  modified:
    - src/lib/types.ts
decisions:
  - TransferSuggestion inserted after OptimisedLineup in types.ts (additive, no existing types changed)
  - Skeleton imports HORIZON_FIELD as _HORIZON_FIELD from optimise-lineup to satisfy IN-01 (no re-declaration)
  - Test file has 13 test cases (plan action block specified 13; plan success_criteria said 11 — plan document inconsistency; action block is authoritative)
metrics:
  duration: "~4 minutes"
  completed_date: "2026-04-30"
  tasks_completed: 3
  files_changed: 3
---

# Phase 45 Plan 01: Wave 0 TDD Infrastructure Summary

Wave 0 RED gate established: TransferSuggestion discriminated union added to types.ts, skeleton suggestTransfers engine created (returns []), and the full RED test suite written. Plan 02 cannot merge until all tests pass GREEN.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add TransferSuggestion type to types.ts | 14e2553 | src/lib/types.ts |
| 2 | Create skeleton suggest-transfers.ts | 59379bc | src/lib/suggest-transfers.ts |
| 3 | Create RED test suite | 2c91c65 | src/lib/suggest-transfers.test.ts |

## Files Created / Modified

### Modified: src/lib/types.ts

Added `TransferSuggestion` discriminated union immediately after `OptimisedLineup` (line 191). No existing types were changed. The union has two variants:
- `kind: 'single'` — one sell/buy pair with `cost: 0 | 4`, `xPtsGain`, `xPtsGainPerGw`, `breakEvenGws`
- `kind: 'combo'` — two sell/buy pairs as a tuple, same cost/gain fields

Shape is locked by 45-UI-SPEC.md §9. TypeScript compiles with zero new errors.

### Created: src/lib/suggest-transfers.ts

Skeleton pure-TS engine file following the optimise-lineup.ts pattern:
- No `'use client'` directive
- No React imports
- Exports `SuggestTransfersParams` interface and `suggestTransfers()` function
- Imports `HORIZON_FIELD as _HORIZON_FIELD` from `./optimise-lineup` (IN-01: no re-declaration)
- Returns `[]` for all inputs (Wave 0 skeleton; real algorithm in Plan 02)
- Algorithm documented in JSDoc for Plan 02 implementor

### Created: src/lib/suggest-transfers.test.ts

RED test suite with `@vitest-environment node` (pure TS, no jsdom). Covers:
- **TFR-01** (ftCount toggle): empty arrays, FREE single suggestions, 2-FT combo mode
- **TFR-02** (output shape): sell/buy/cost/xPtsGain shape, budget filter (D-10), sell prices (D-09/D-11), top-30 pool (D-03), own-squad exclusion (D-03), sorting
- **TFR-03** (break-even): formula `max(1, ceil(4 / xPtsGainPerGw))`, FREE has `null`, per-GW rate matches horizon

## Test Run Results

```
Tests: 8 failed | 5 passed (13 total)
```

**13 tests total** (plan action block specified exactly 13 tests; the plan's `success_criteria` said 11 — a documentation inconsistency in the plan itself. The action block is authoritative, so 13 tests are correct).

**5 pass** (against the skeleton returning []):
- `returns empty array when squad and players are empty` — trivially passes ([] === [])
- `returns empty array when no candidate improves xPts` — trivially passes ([] === [])
- `hard-filters suggestions where bank + sellValue < buyCost` — trivially passes (no suggestions bought player 20)
- `excludes currently-owned players from the In pool` — trivially passes (no buy IDs in result)
- `respects top-30-per-position filtering (DEF rank 41 not surfaced)` — trivially passes (rank41 not in result)

**8 fail RED** (expected — skeleton returns []):
- FREE single suggestion returns `length > 0` — fails (length is 0)
- Sorting by xPtsGain — fails (length < 2)
- Break-even formula — fails (no hit found)
- FREE breakEvenGws is null — fails (no free found)
- xPtsGainPerGw / horizon — fails (length is 0)
- sellPrices Map (buy20 defined) — fails (no result)
- now_cost fallback (buy20 defined) — fails (no result)
- 2-FT combo suggestion — fails (no combo found)

No import errors, no "Cannot find module" errors. TypeScript compiles cleanly.

## Deviations from Plan

### Plan document test count inconsistency

**Found during:** Task 3

**Issue:** The plan's `success_criteria` and `acceptance_criteria` say "exactly 11 tests" and "reports exactly 11 tests." However, the plan's `action` block says to write "EXACTLY this content" and that content has 13 distinct `it()` test cases across the 6 describe blocks.

**Fix (auto-applied — Rule 1):** Wrote the 13 tests as specified in the action block (the authoritative content to implement). The 13-test file is correct — the "11" references in success_criteria were a counting error in the plan document.

**Impact:** Plan 02's GREEN gate will require 13 tests passing (not 11). The plan document is the source of truth for WHAT to test; the count discrepancy is a harmless documentation error.

**Files modified:** None beyond what was already planned (the test file itself is the resolution).

## Verification

- `npx tsc --noEmit` — zero new errors (pre-existing errors in `tests/lib/captain-picks.test.ts` are unrelated)
- `npx vitest run src/lib/suggest-transfers.test.ts` — 13 tests discovered, 8 failing RED
- `export type TransferSuggestion` — present in src/lib/types.ts
- `export function suggestTransfers` — present in src/lib/suggest-transfers.ts
- `export interface SuggestTransfersParams` — present in src/lib/suggest-transfers.ts
- No `'use client'` in suggest-transfers.ts
- No React imports in suggest-transfers.ts

## Threat Surface Scan

Wave 0 introduces no new attack surface. No new endpoints, no new auth paths, no new data flows, no new I/O. All files are pure-TS: a type definition, a stub returning `[]`, and a test file. All threats deferred to Plan 02/03 review per the plan's threat register.

## Known Stubs

`src/lib/suggest-transfers.ts` is intentionally a stub (skeleton) returning `[]`. This is by design — Plan 02 (Wave 1) implements the real algorithm. The stub prevents false test passes.

## Self-Check: PASSED

- [x] `src/lib/types.ts` exists and contains `export type TransferSuggestion` — FOUND
- [x] `src/lib/suggest-transfers.ts` exists and contains `export function suggestTransfers` — FOUND
- [x] `src/lib/suggest-transfers.test.ts` exists and contains `describe('Phase 45: suggestTransfers engine'` — FOUND
- [x] Commit 14e2553 exists — FOUND (types.ts modification)
- [x] Commit 59379bc exists — FOUND (skeleton engine)
- [x] Commit 2c91c65 exists — FOUND (RED test suite)
- [x] 8 tests fail RED (skeleton returns []) — CONFIRMED
- [x] No new TypeScript errors in modified files — CONFIRMED
