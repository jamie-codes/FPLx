---
phase: 99-top-10k-comparison
plan: 02
subsystem: ui-component
tags: [react-component, vitest, gw-review, ui-spec, stat-card, missed-row, benchmark, tdd]

# Dependency graph
requires:
  - phase: 99-top-10k-comparison
    plan: 01
    provides: "GwReview interface extended with benchmark_score/benchmark_label/missed_players"
provides:
  - "StatCard sub-component extended with delta? and testid? optional props"
  - "4th StatCard slot renders review.benchmark_label + review.benchmark_score with delta sub-label"
  - "Conditional 'Missed' info row below 'Best bench' when missed_players.length > 0"
  - "data-testid='gw-review-benchmark-card' on the benchmark StatCard root div"
  - "data-testid='gw-review-missed-row' on the Missed row when present"
  - "8 new Phase 99 PGW-03 component tests covering all UI-SPEC Test-Visible Contracts"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "StatCard delta prop: rendered as second <p> with text-xs mt-0.5 + same sentimentClass; only renders when truthy"
    - "StatCard testid prop: forwarded as data-testid on root div; undefined omits the attribute (React no-op)"
    - "U+2212 minus sign (not U+002D hyphen-minus) used in negative benchmarkDeltaLabel string literal"
    - "Conditional render guarded by review.missed_players.length > 0 for Missed row"
    - "withReview() local helper in Phase 99 describe — pattern for injecting partial GwReview overrides into mock"

key-files:
  created: []
  modified:
    - src/components/squad/GwReviewTab.tsx
    - src/components/squad/GwReviewTab.test.tsx

key-decisions:
  - "StatCard testid prop is optional — existing 3 StatCards receive no testid and therefore have no data-testid attribute on their root divs, preserving existing DOM shape"
  - "delta prop rendered only when truthy — passing undefined (FPL average fallback) means no delta sub-label in DOM, satisfying UI-SPEC D-09"
  - "U+2212 minus sign used in negative benchmarkDeltaLabel to match test regex /^−\\d+ vs you$/ where − is also U+2212"
  - "sampleReview extension (Phase 99 fields added in Task 2) was also done as part of Task 1 commit preparation — Rule 3 deviation since existing tests crashed on missing missed_players field"
  - "Two Phase 73 assertions updated: toContain('55') → toContain('54'), toContain('FPL average') → toContain('Dream team') to match new benchmark card content"

patterns-established:
  - "Optional testid prop pattern: pass testid string to forward data-testid to root div; omit for no DOM attribute"
  - "Sentiment-coloured StatCard with sub-label: sentimentClass applies to both value <p> and delta <p>"

requirements-completed: [PGW-03]

# Metrics
duration: 4min
completed: 2026-05-12
---

# Phase 99 Plan 02: Top-10k Comparison — UI Component Summary

**StatCard extended with delta+testid props; 4th slot rewired to benchmark card with sentiment-coloured delta sub-label; conditional Missed row below Best bench; 14/14 component tests GREEN**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-12T11:33:00Z
- **Completed:** 2026-05-12T11:37:47Z
- **Tasks:** 2 (implementation + tests)
- **Files modified:** 2

## Accomplishments

- Extended `StatCardProps` with two optional props: `delta?: string` and `testid?: string`
- Updated `StatCard` function body to forward `testid` as `data-testid` on root `<div>` and render conditional `<p>` for `delta` below the value
- Added `benchmarkDiff` / `benchmarkDeltaLabel` / `benchmarkSentimentClass` computation block in data-rendered branch, immediately after `scoreClass`
- Replaced static 4th StatCard (`label="FPL average"`) with dynamic benchmark card reading `review.benchmark_label`, `review.benchmark_score`, with conditional `delta` (omitted when `benchmark_label === 'FPL average'`) and `testid="gw-review-benchmark-card"`
- Inserted conditional Missed info row after Best bench row, guarded by `review.missed_players.length > 0`, with `data-testid="gw-review-missed-row"` and value formatted as `Name (pts), Name (pts), ...`
- Extended `sampleReview` in test file with the three new required GwReview fields: `benchmark_score: 54`, `benchmark_label: 'Dream team'`, `missed_players: [{name:'Saka',pts:12},{name:'Palmer',pts:10}]`
- Updated two stale Phase 73 assertions: `toContain('55')` → `toContain('54')` and `toContain('FPL average')` → `toContain('Dream team')`
- Added Phase 99 PGW-03 describe block with 8 component tests covering all UI-SPEC Test-Visible Contracts

## StatCard Prop Expansion

The `delta` prop is rendered as a second `<p>` element with classes `text-xs mt-0.5` plus the same `sentimentClass` as the value. The `{delta && ...}` guard means `undefined` or empty string produce no DOM element — the FPL average fallback case passes `undefined` explicitly, satisfying UI-SPEC D-09.

The `testid` prop is forwarded as `data-testid={testid}` on the root `<div>`. React omits `data-testid` from the DOM when the value is `undefined`, so the 3 existing StatCards (GW Score, Bench pts left, Captain delta) retain their current DOM shape with no test-ID attribute.

## U+2212 vs U+002D Distinction

The negative delta branch uses `−` (Unicode MINUS SIGN, U+2212), not `-` (ASCII HYPHEN-MINUS, U+002D). The source literal `−${Math.abs(benchmarkDiff)} vs you` is saved with the actual U+2212 character. The test asserts `.toMatch(/−15 vs you/)` where `−` is also U+2212, and has a negative assertion `.not.toMatch(/^-15 vs you$/)` confirming the ASCII variant is absent.

## Phase 73 Assertion Updates

The two stale assertions in the Phase 73 happy-path test were updated to reflect the new 4th card content:
- `toContain('55')` → `toContain('54')` — the 4th card now shows `benchmark_score` (54), not `average_score` (55)
- `toContain('FPL average')` → `toContain('Dream team')` — the 4th card now shows `benchmark_label` ('Dream team'), not the static 'FPL average' literal

## Phase 99 PGW-03 Component Tests (8 new)

| Test | UI-SPEC Contract |
|------|-----------------|
| renders benchmark StatCard with label and value | benchmark card exists with data-testid; shows 'Dream team' and '54' |
| renders delta "+N vs you" when your_score > benchmark_score | +12 vs you text present |
| renders delta "−N vs you" (U+2212) when your_score < benchmark_score | −15 vs you with U+2212, not ASCII hyphen |
| renders delta "on par" when your_score === benchmark_score | 'on par' text present |
| does NOT render delta when benchmark_label === "FPL average" | 'vs you' and 'on par' absent from card |
| renders Missed row when missed_players.length > 0 | testid present; Saka (12), Palmer (10) |
| Missed row absent from DOM when missed_players.length === 0 | testid null; 'Missed' text absent |
| Missed row formats players as "Name (pts)" joined by ", " (3 misses) | exact text 'Saka (14), Palmer (12), Foden (10)' |

## Task Commits

1. **Task 1: GwReviewTab.tsx implementation** — `04545ff` (feat)
2. **Task 2: GwReviewTab.test.tsx — sampleReview + 8 Phase 99 tests** — `a0daa04` (test)

## Files Created/Modified

- `src/components/squad/GwReviewTab.tsx` — StatCard delta+testid props; benchmark delta/sentiment computation; 4th-slot replacement; Missed row
- `src/components/squad/GwReviewTab.test.tsx` — sampleReview extended with 3 new fields; 2 stale Phase 73 assertions updated; 8 new Phase 99 PGW-03 tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] sampleReview missing required GwReview fields caused runtime crash**

- **Found during:** Task 1 verification (`npx vitest run`)
- **Issue:** The existing `sampleReview` fixture in `GwReviewTab.test.tsx` was typed as `GwReview` but lacked the three new required fields (`benchmark_score`, `benchmark_label`, `missed_players`). The component's `review.missed_players.length > 0` check threw `TypeError: Cannot read properties of undefined (reading 'length')` at runtime, failing 3 existing Phase 73 tests.
- **Fix:** Extended `sampleReview` with Phase 99 fields during Task 1 (rather than waiting for Task 2) and updated the two stale Phase 73 assertions (`'55'` → `'54'`, `'FPL average'` → `'Dream team'`). These changes are logically part of Task 2 per the plan, but were applied early to satisfy Task 1's acceptance criteria.
- **Files modified:** `src/components/squad/GwReviewTab.test.tsx` (staged with Task 2 commit `a0daa04`)
- **Impact:** None — Task 2 still covers the full sampleReview extension and Phase 73 assertion updates as intended.

## Known Stubs

None — the benchmark card, delta sub-label, and Missed row all read from real `review.*` fields provided by Plan 01's route implementation. No hardcoded placeholder values.

## Threat Flags

No new security-relevant surface introduced beyond what is documented in the plan's threat model (T-99-06 through T-99-09). All new player name and benchmark label rendering uses React text-node auto-escaping. No `dangerouslySetInnerHTML` introduced.

## Self-Check: PASSED

- `src/components/squad/GwReviewTab.tsx` — FOUND
- `src/components/squad/GwReviewTab.test.tsx` — FOUND
- `.planning/phases/99-top-10k-comparison/99-02-SUMMARY.md` — FOUND
- Commit `04545ff` (feat) — FOUND
- Commit `a0daa04` (test) — FOUND
- `npx vitest run src/components/squad/GwReviewTab.test.tsx` — 14/14 PASSED
