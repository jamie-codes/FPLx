---
phase: 110
plan: "01"
subsystem: gw-review-ui
tags: [bugfix, ui, sign-flip, gw-review, tdd, fix-05]
dependency_graph:
  requires: []
  provides: [FIX-05]
  affects: [GwReviewTab, gw-review-benchmark-card]
tech_stack:
  added: []
  patterns: [TDD RED→GREEN, vitest jsdom component test]
key_files:
  modified:
    - src/components/squad/GwReviewTab.tsx
    - src/components/squad/GwReviewTab.test.tsx
decisions:
  - "[D-06] benchmarkDiff = benchmark_score - your_score (was your_score - benchmark_score)"
  - "[D-07] benchmarkDiff > 0 → amber; benchmarkDiff < 0 → green; === 0 → green"
  - "[D-08] Label format: +N vs you / −N vs you (U+2212) / on par — unchanged"
metrics:
  duration: "~7 minutes"
  completed: "2026-05-14T20:38:05Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 110 Plan 01: FIX-05 Dream Team Delta Sign Correction Summary

**One-liner:** Flipped `benchmarkDiff` subtraction order and swapped sentiment classes so dream-team-beats-user shows +N amber and user-beats-dream-team shows −N green.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | RED — write FIX-05 TDD tests + update broken PGW-03 assertions | 8a46b5f | src/components/squad/GwReviewTab.test.tsx |
| 2 | GREEN — flip benchmarkDiff sign + swap sentiment classes | cf3030f | src/components/squad/GwReviewTab.tsx |

## What Changed

### GwReviewTab.tsx (line 172)

**Before (broken):**
```typescript
const benchmarkDiff = review.your_score - review.benchmark_score
```

**After (FIX-05):**
```typescript
const benchmarkDiff = review.benchmark_score - review.your_score
```

### Sentiment class swaps (lines 177, 183)

| Branch | Before | After |
|--------|--------|-------|
| `benchmarkDiff > 0` (dream team won) | `text-green-600` | `text-amber-700` |
| `benchmarkDiff === 0` (on par) | `text-green-600` | `text-green-600` (unchanged) |
| `benchmarkDiff < 0` (user won) | `text-amber-700` | `text-green-600` |

### GwReviewTab.test.tsx

**Updated PGW-03 assertions:**

1. Line 180 (was `renders delta sub-label "+N vs you" when your_score > benchmark_score`):
   - Renamed to clarify corrected convention: user won → `−N vs you` (green)
   - Assertion changed from `/\+12 vs you/` to `/−12 vs you/`

2. Line 187 (was `renders delta sub-label "−N vs you" when your_score < benchmark_score`):
   - Renamed: dream team won → `+N vs you` (amber)
   - Assertion changed from `/−15 vs you/` to `/\+15 vs you/`

**New FIX-05 describe block (3 tests):**
- `shows "+50 vs you" and amber sentiment when dream team (122) > user (72)` — canonical D-06 example
- `shows "−15 vs you" and green sentiment when user (95) > dream team (80)` — canonical D-06 example
- `shows "on par" and green sentiment when user (88) equals dream team (88)` — equal case

## Verification Results

### GwReviewTab.test.tsx final run
```
Tests  17 passed (17)
```

### Full suite comparison
Pre-Phase-110 baseline: 25 failing tests (4 files: captain-picks, club-form, MobileNav, useRivals)
Post-Phase-110-01: 25 failing tests (same 4 files — all pre-existing, no regressions introduced)

## Deviations from Plan

### Auto-adjusted — TDD RED count (4 failures, not 5)

**Rule 1 (deviation avoided — plan expectation clarified):**
- Plan acceptance criteria states "≥5 failing tests (3 new RED + ≥2 updated PGW-03 assertions)"
- Actual: 4 failures (2 new RED + 2 updated PGW-03 assertions)
- Reason: The "on par" test (your_score=88, benchmark_score=88) passes even against the broken component — `88 - 88 = 0` under both formulae, so "on par" renders correctly regardless of operand order. This is correct behaviour, not a test defect.
- Impact: None — the on-par test still correctly documents and locks the on-par invariant.

## Known Stubs

None — all data flows correctly from hook to component. No hardcoded empty values.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes. Changes are limited to in-component arithmetic and class string literals.

## Self-Check: PASSED

- [x] `src/components/squad/GwReviewTab.tsx` exists and contains `review.benchmark_score - review.your_score`
- [x] `src/components/squad/GwReviewTab.test.tsx` exists and contains `Phase 110 FIX-05`
- [x] Commit 8a46b5f exists (test RED)
- [x] Commit cf3030f exists (feat GREEN)
- [x] 17/17 GwReviewTab tests pass
- [x] Full suite: 0 regressions introduced vs pre-Phase-110 baseline
