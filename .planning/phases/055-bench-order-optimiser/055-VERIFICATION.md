---
phase: 055-bench-order-optimiser
verified: 2026-05-03T09:55:00Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 55: Bench Order Optimiser Verification Report

**Phase Goal:** Suggest an autosub-optimal bench ordering (positions 1–3 outfield + GK slot) weighted by start_prob × xPts EV and respecting FPL formation-legality constraints — so the manager's bench actually maximises expected points captured via autosubs
**Verified:** 2026-05-03T09:55:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | `benchOrder()` exported from `src/lib/optimise-lineup.ts` and consumed by `optimiseLineup()` | ✓ VERIFIED | Line 174: `export function benchOrder(`; line 137: `const benchOutfield = benchOrder(benchOutfieldRaw, starterPlayers, horizon)` |
| 2  | EV ranking score = `start_prob × (player[horizonField] ?? 0) × fixtures.length` (D-03) | ✓ VERIFIED | Lines 190–191 of `optimise-lineup.ts`: `const evScore = (p: MergedPlayer): number => p.start_prob * ((p[field] as number | undefined) ?? 0) * p.fixtures.length` |
| 3  | BGW player (`fixtures.length === 0`) is unconditionally placed at slot 3 / bench[3] (D-05/D-06) | ✓ VERIFIED | Partition at lines 204–209: BGW pushed to `bgw[]`, all active players precede them in concatenation at line 227: `return [...activeSorted, ...bgwSorted]` |
| 4  | DGW player (`fixtures.length === 2`) ranks higher than otherwise-identical single-fixture player (D-07) | ✓ VERIFIED | EV formula uses `* p.fixtures.length` multiplier; test "DGW player ranks higher" at line 285 of test file passes in live suite |
| 5  | Formation-invalid bench candidates demoted (sorted after formation-valid) but never excluded (D-08/D-09) | ✓ VERIFIED | `isFormationValid` at lines 195–200; sort at lines 212–217 places valid first; function always returns same-length array; test at line 301 asserts `toHaveLength(2)` |
| 6  | `optimiseLineup()` integration: bench outfield ordering delegated to `benchOrder()` replacing old naïve sort | ✓ VERIFIED | Old `.sort((a, b) => horizonScore(b) - horizonScore(a))` absent from bench block; lines 134–137 show `starterPlayers`/`benchOutfieldRaw`/`benchOrder` call |
| 7  | All existing OPT-04 tests still pass (`benchOrder` is a superset of naïve horizonScore sort) | ✓ VERIFIED | `npm test` reports 17/17 passing; OPT-04 "bench[1..3] ordered by horizon xPts descending" passes because all `makePlayer` defaults use `fixtures: []` (BGW) — `bgwSorted` branch sorts by `xPts_horizon` desc, preserving prior behaviour |
| 8  | OptimiserPanel renders `data-testid="bb-bench-order-note"` when `chipMode === 'bench-boost'` (D-11) | ✓ VERIFIED | `OptimiserPanel.tsx` lines 496–504: `{chipMode === 'bench-boost' && (<p ... data-testid="bb-bench-order-note">Bench order doesn&apos;t affect score with Bench Boost active</p>)}` |
| 9  | Note is hidden when `chipMode !== 'bench-boost'` | ✓ VERIFIED | Guard `{chipMode === 'bench-boost' && (...)}` is strictly conditional; RTL test at line 733 asserts `queryByTestId('bb-bench-order-note')` returns null before activation |
| 10 | Existing `bb-notice` continues to render unchanged when BB active | ✓ VERIFIED | `bb-notice` block at lines 487–494 is untouched; test "activating Bench Boost shows BB notice (D-15)" at line 719 still passes in 34/34 suite |
| 11 | RTL test asserts note appears after BB chip selection and absent before | ✓ VERIFIED | `OptimiserPanel.test.tsx` lines 728–740: absence checked with `queryByTestId` returning null, then `getByTestId` after `fireEvent.click(chip-toggle-benchboost-mock)` confirms presence and exact copy |

**Score:** 11/11 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/optimise-lineup.ts` | `benchOrder` pure function + integration in `optimiseLineup` | ✓ VERIFIED | Contains `export function benchOrder(` at line 174; integration call at line 137 |
| `src/lib/optimise-lineup.test.ts` | BENCH-01 unit tests (4 cases) covering EV/BGW/DGW/formation | ✓ VERIFIED | `describe('BENCH-01 benchOrder()')` at line 236; 4 `it(...)` cases confirmed |
| `src/components/optimiser/OptimiserPanel.tsx` | BB bench-order inline note | ✓ VERIFIED | `data-testid="bb-bench-order-note"` at line 500 |
| `src/components/optimiser/OptimiserPanel.test.tsx` | BENCH-01 BB bypass test | ✓ VERIFIED | `it('activating Bench Boost shows bench-order-irrelevant note (BENCH-01 / D-11)')` at line 728; `bb-bench-order-note` referenced at lines 733 and 737 |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `optimise-lineup.ts:optimiseLineup()` | `optimise-lineup.ts:benchOrder()` | function call replacing `benchOutfield.sort(...)` | ✓ WIRED | `benchOrder(benchOutfieldRaw, starterPlayers, horizon)` at line 137; old naïve sort absent |
| `optimise-lineup.test.ts` | `optimise-lineup.ts:benchOrder` | named import | ✓ WIRED | `import { optimiseLineup, benchOrder } from './optimise-lineup'` at line 5 |
| `OptimiserPanel.tsx` (BB conditional block) | `chipMode` state ('bench-boost' value) | JSX guard `{chipMode === 'bench-boost' && (...)}` | ✓ WIRED | Line 497: `{chipMode === 'bench-boost' && (` wraps the `bb-bench-order-note` paragraph |

---

## Data-Flow Trace (Level 4)

Not applicable — `benchOrder` is a pure computation function with no external data source (all inputs are in-memory `MergedPlayer[]` already validated upstream). The BB note is static text conditionally rendered from local component state (`chipMode`). No data disconnection risk.

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 17 optimise-lineup tests pass (13 OPT + 4 BENCH-01) | `npm test -- src/lib/optimise-lineup.test.ts --run` | `Tests 17 passed (17)` | ✓ PASS |
| All 34 OptimiserPanel tests pass (includes BENCH-01 RTL test) | `npm test -- src/components/optimiser/OptimiserPanel.test.tsx --run` | `Tests 34 passed (34)` | ✓ PASS |
| TypeScript compiles clean (no new errors in modified files) | `npx tsc --noEmit` | 0 errors (pre-existing `captain-picks.test.ts` errors are out of scope) | ✓ PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| BENCH-01 SC-1 | 055-01-PLAN.md | `benchOrder()` exported, ranks outfield bench by `start_prob × xPts_{horizon}` EV with GK fixed at bench[0] | ✓ SATISFIED | `export function benchOrder(` at line 174; GK fixed by caller via `benchGk` at line 133 |
| BENCH-01 SC-2 | 055-01-PLAN.md | Formation-legality validator reused — never suggests an order where top autosub candidate would be skipped | ✓ SATISFIED | `isFormationValid` replicates DEF/MID/FWD ceiling checks from `optimiseLineup`; formation demotion test passes |
| BENCH-01 SC-3 | 055-01-PLAN.md | BGW bench players sorted to slot 3 regardless of xPts; DGW bench players correctly double-weighted | ✓ SATISFIED | BGW partition forces all BGW to trail active players; EV formula `× fixtures.length` doubles DGW EV automatically |
| BENCH-01 SC-4 | 055-02-PLAN.md | BB chip mode detected; panel shows "Bench order doesn't affect score with Bench Boost active" | ✓ SATISFIED | `bb-bench-order-note` guarded by `chipMode === 'bench-boost'` in `OptimiserPanel.tsx`; RTL test confirms absence-then-presence flip |
| BENCH-01 SC-5 | 055-01-PLAN.md + 055-02-PLAN.md | `optimise-lineup.test.ts` covers formation-locked slot-1, BGW-to-slot-3, DGW double-weight, BB bypass | ✓ SATISFIED | 4 BENCH-01 tests in `optimise-lineup.test.ts` cover all 4 behavioural cases; BB bypass covered by `OptimiserPanel.test.tsx` line 728 |

**Note:** No standalone `REQUIREMENTS.md` file exists in this project. BENCH-01 is defined in `ROADMAP.md` under Phase 55 Success Criteria. All 5 success criteria are satisfied.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | No anti-patterns found |

Scanned `src/lib/optimise-lineup.ts` and `src/components/optimiser/OptimiserPanel.tsx` for TODO/FIXME/placeholder, empty implementations, `return null`/`return []` stubs, React imports in pure function, `console.log`. All clean.

---

## Human Verification Required

None — all must-haves are verifiable programmatically. The BB note is static text with no visual layout concerns that require human judgment; the RTL test fully covers the conditional rendering logic.

---

## Gaps Summary

No gaps. All 5 ROADMAP Success Criteria for Phase 55 are satisfied:

1. `benchOrder()` is exported and implements the `start_prob × xPts × fixtures.length` EV formula
2. Formation-legality validator demotes (not excludes) candidates that would exceed DEF/MID/FWD ceilings
3. BGW candidates unconditionally trail active candidates; DGW double-weighted via `fixtures.length` multiplier
4. OptimiserPanel shows the BB bench-order note when and only when `chipMode === 'bench-boost'`
5. Test suite covers all four behavioural cases plus the BB bypass scenario

Both plans executed cleanly with TDD RED/GREEN/REFACTOR discipline confirmed by commit history (`a8740df` RED, `3010550` GREEN). All 51 tests across both test files pass with 0 failures. TypeScript compiles without errors in modified files.

---

_Verified: 2026-05-03T09:55:00Z_
_Verifier: Claude (gsd-verifier)_
