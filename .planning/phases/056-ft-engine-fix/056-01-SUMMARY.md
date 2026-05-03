---
phase: 056-ft-engine-fix
plan: "01"
subsystem: free-transfer-engine
tags: [tdd, bug-fix, engine, free-transfers, wildcard, regression]
dependency_graph:
  requires: []
  provides: [FTX-02, engine-wildcard-bank-preservation]
  affects: [phase-059-manual-planner, phase-060-transfer-route-tree]
tech_stack:
  added: []
  patterns: [bank-preservation formula, TDD RED-GREEN cycle]
key_files:
  created: []
  modified:
    - src/lib/free-transfer-engine.ts
    - tests/lib/free-transfer-engine.test.ts
    - src/lib/planning-engine.ts
decisions:
  - "Wildcard branch mirrors Free Hit branch verbatim — same bank-preservation formula (Math.min(1, currentAvailable - 1))"
  - "D-07 resolved as no-op — null chip at planning-engine.ts:203 is intentional; AI plans never auto-select chips"
  - "Pre-existing captain-picks.test.ts TS errors confirmed out of scope (exist on base commit)"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-03"
  tasks_completed: 2
  files_changed: 3
---

# Phase 056 Plan 01: FT Engine Fix — Wildcard Bank Preservation Summary

**One-liner:** Wildcard branch of `computeNextFTState` now uses `Math.min(1, currentAvailable - 1)` bank-preservation formula instead of hardcoded `{ available: 1, banked: 0 }` reset, with 9 test cases added/updated and D-07 comment placed at `planning-engine.ts:203`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | RED — update wildcard tests + add D-08 regression block | b31287f | tests/lib/free-transfer-engine.test.ts |
| 2 | GREEN — fix Wildcard branch + D-07 comment | 00f8640 | src/lib/free-transfer-engine.ts, src/lib/planning-engine.ts |

## Changes Made

### src/lib/free-transfer-engine.ts — Wildcard branch fix

**Before (bug):**
```typescript
// Wildcard: resets bank to 1 next GW
if (chip === 'wildcard') {
  return { available: 1, banked: 0 }
}
```

**After (fix):**
```typescript
// Wildcard: bank preserved (same rule as Free Hit — chip does not reset FTs) — FTX-02
if (chip === 'wildcard') {
  const banked = Math.min(1, currentAvailable - 1)
  const nextAvailable = 1 + banked
  return { available: nextAvailable, banked }
}
```

Lines changed: 4 lines replaced with 5 lines. The Wildcard path now uses the identical formula to the Free Hit path. `Math.min(1, currentAvailable - 1)` now appears twice in the file (once per chip path) — confirmed by `grep -c`.

### tests/lib/free-transfer-engine.test.ts — Test updates

9 test cases changed or added:

**Updated (3) — wildcard chip describe block (lines 38–52):**
- `resets FT bank to 1 next GW regardless of transfers used` → `preserves bank when entering with 2 available (banked 1) → next GW also 2` (assertion changed from `{ available: 1, banked: 0 }` to `{ available: 2, banked: 1 }`)
- `resets FT bank even with 0 transfers used` → `preserves bank with 0 transfers used and 2 available` (same assertion change)
- New case added: `preserves bank when entering with 1 available (banked 0) → next GW stays 1` (asserts `{ available: 1, banked: 0 }` — correct for the 1-entering path)

**Added (6) — D-08 regression: multi-GW FT banking sequences block:**
1. `rolling 1 FT → 2 available next GW` — `computeNextFTState(1, 0, null)` → `{ available: 2, banked: 1 }`
2. `rolling 2 GWs → still 2 (cap respected)` — chained null calls, cap at 2 verified
3. `Wildcard mid-plan preserves bank when entering with 2 available` — `(2, 11, 'wildcard')` → `{ available: 2, banked: 1 }`
4. `Wildcard mid-plan preserves bank when entering with 1 available` — `(1, 11, 'wildcard')` → `{ available: 1, banked: 0 }`
5. `FH mid-plan preserves bank when entering with 2 available` — `(2, 11, 'freehit')` → `{ available: 2, banked: 1 }` (regression sentinel)
6. `FH mid-plan preserves bank when entering with 1 available` — `(1, 11, 'freehit')` → `{ available: 1, banked: 0 }` (regression sentinel)

**Unchanged:** End-to-end sequence test (GW4 wildcard step enters with `available: 1`, so `{ available: 1, banked: 0 }` is still the correct expected value and requires no change).

### src/lib/planning-engine.ts — D-07 explanatory comment

Added 2-line comment before `computeNextFTState(currentFT.available, transfersUsed, null)` call at line 203:

```typescript
// D-07: AI-generated plans never auto-select chips — chip handling flows only through
// PlannerTab.handleChipToggle. Passing `null` here is intentional and correct.
currentFT = computeNextFTState(currentFT.available, transfersUsed, null)
```

No behaviour change — comment only.

## Test Results

**RED phase (Task 1):** 38 tests, 3 failed | 35 passed — wildcard-bank-preservation cases correctly failed against buggy engine.

**GREEN phase (Task 2):** 38 tests, 38 passed — all cases pass including new wildcard and D-08 block.

**Full suite:** 612 passed | 34 skipped | 1 pre-existing failure in `club-form.test.ts` (unrelated to this plan — `assigns difficulty tier correctly` — exists on base commit, out of scope).

## Type Check

`npx tsc --noEmit` reports 5 errors in `tests/lib/captain-picks.test.ts` — confirmed pre-existing on base commit (f82ba2d), unrelated to this plan's files. No new type errors introduced.

## Requirements Coverage

- **FTX-02** (wildcard preserves bank): Fully addressed by this plan — the engine now returns the correct `{ available: nextAvailable, banked }` for all wildcard inputs.
- **FTX-01** (banking cap): Partially addressed — the engine's normal-GW banking formula was already correct; the initial FT state derivation in PlannerTab (plan 02) is the remaining half.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all changes are complete implementations with no placeholder values.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. This plan modifies only a pure TypeScript function and its tests.

## Self-Check: PASSED

- `src/lib/free-transfer-engine.ts` exists and contains `Math.min(1, currentAvailable - 1)` twice: FOUND
- `tests/lib/free-transfer-engine.test.ts` exists and contains `D-08 regression` once: FOUND
- `src/lib/planning-engine.ts` exists and contains D-07 comment: FOUND
- Commit b31287f exists: FOUND (`test(056-01): RED — assert wildcard preserves bank (FTX-02) and D-08 regression scenarios`)
- Commit 00f8640 exists: FOUND (`fix(056-01): preserve FT bank across Wildcard chip (FTX-02) + D-07 comment`)
