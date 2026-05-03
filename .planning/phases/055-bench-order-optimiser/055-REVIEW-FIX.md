---
phase: 055-bench-order-optimiser
fixed_at: 2026-05-03T00:00:00Z
review_path: .planning/phases/055-bench-order-optimiser/055-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 055: Code Review Fix Report

**Fixed at:** 2026-05-03T00:00:00Z
**Source review:** .planning/phases/055-bench-order-optimiser/055-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: `benchOrder()` passes `start_prob` unguarded to multiplication

**Files modified:** `src/lib/optimise-lineup.ts`
**Commit:** 2d0a765
**Applied fix:** Added `?? 0` guard to `p.start_prob` in the `evScore` lambda inside `benchOrder()`. Changed `p.start_prob * (...)` to `(p.start_prob ?? 0) * (...)` at line 191.

### CR-01: OPT-04 bench ordering test silently validates wrong code path

**Files modified:** `src/lib/optimise-lineup.test.ts`
**Commit:** e3b7879
**Applied fix:** Replaced the bare `makeSquad()` call in the OPT-04 "bench[1..3] ordered by horizon xPts" test with a `playersWithFixtures` array that maps every player to include a single fixture entry. This ensures `benchOrder()` routes bench outfield players through the active EV path (fixtures.length === 1) rather than the BGW fallback (fixtures.length === 0). The assertion is preserved: with uniform `start_prob` across all players, EV rank equals xPts rank, so the descending-xPts assertion remains meaningful. Added explanatory comment.

### WR-02: `computeBenchBoostXPts` called twice per render in BB headline

**Files modified:** `src/components/optimiser/OptimiserPanel.tsx`
**Commit:** 47c24e5
**Applied fix:** Extracted `computeBenchBoostXPts(lineup.bench, playersData, horizon)` to a `const bbBenchXPts` variable declared before the `return (` statement (after the `xPtsGain` computation). The variable is conditionally computed — `chipMode === 'bench-boost' ? computeBenchBoostXPts(...) : 0` — so it incurs no cost when BB is not active. Both JSX usages (Bench xPts display and Total display) now reference `bbBenchXPts` directly.

---

_Fixed: 2026-05-03T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
