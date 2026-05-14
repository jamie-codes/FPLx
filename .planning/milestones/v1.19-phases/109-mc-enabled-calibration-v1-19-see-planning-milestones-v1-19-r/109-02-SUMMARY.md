---
phase: 109
plan: 02
subsystem: frontend
tags: [ui, react, calibration, monte-carlo, badge, tdd, accessibility, bug-fix]
dependency_graph:
  requires: [109-01]
  provides: [CalibrationHealthIndicator mode badge, AccuracySummary.calibration_mode type, D-11 bug fix]
  affects: [DecisionSummaryTab, AccuracyTab]
tech_stack:
  added: []
  patterns: [Record-lookup badge pattern, TDD RED-GREEN cycle, optional-field null-render]
key_files:
  created: []
  modified:
    - src/lib/types.ts
    - src/components/squad/CalibrationHealthIndicator.tsx
    - src/components/squad/CalibrationHealthIndicator.test.tsx
decisions:
  - "MODE_BADGE_CLASSES/MODE_BADGE_LABEL Records mirror the established TIER_BADGE_CLASSES pattern for consistent badge rendering"
  - "calibrationMode cast as CalibrationMode | undefined handles legacy cache (undefined) via falsy conditional"
  - "D-11 fix is behaviour-preserving in analytical mode (predicted_rate===bucket_mid) and corrective in MC mode"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-14T13:01:23Z"
  tasks: 2
  files_changed: 3
---

# Phase 109 Plan 02: MC Mode Badge + D-11 Bug Fix Summary

**One-liner:** Teal `MC` / zinc `Analytical` mode badge added to `CalibrationHealthIndicator` via TDD RED-GREEN cycle, plus one-line `maxDeviation` bug fix switching from `b.bucket_mid` to `b.predicted_rate`.

## What Was Built

### Task 1 — RED tests (test commit dd30352)

Added `makeMcBucket` helper and 5 new tests to `CalibrationHealthIndicator.test.tsx`:

1. `renders MC badge in teal when calibration_mode is mc` — asserts `aria-label="Calibration mode: MC"`, teal classes
2. `renders Analytical badge in zinc when calibration_mode is analytical` — asserts zinc classes
3. `mode badge absent when calibration_mode is undefined (legacy cache)` — asserts null-render + tier still renders
4. `mode badge not rendered in cold-start branch` — asserts cold-start omission
5. `maxDeviation uses predicted_rate not bucket_mid (D-11 bug fix)` — bucket with diverging `predicted_rate`/`bucket_mid` forces tier='good' only if fix is in place

RED confirmation: 3 tests failed (badge presence + tier mismatch), 2 correctly passed (absence assertions), 9 existing tests unaffected.

### Task 2 — GREEN implementation (feat commit c0b0122)

**`src/lib/types.ts`:**
- `AccuracySummary` gains `calibration_mode?: 'mc' | 'analytical'` after `mc_enabled`
- `CalibrationBucket.predicted_rate` comment updated: `// analytical: equals bucket_mid; MC mode (Phase 109): mean(haul_prob) per bucket`

**`src/components/squad/CalibrationHealthIndicator.tsx`:**
- `CalibrationMode` type alias (`'mc' | 'analytical'`)
- `MODE_BADGE_CLASSES` Record: `mc` → teal (`text-teal-700 dark:text-teal-400 bg-teal-100 dark:bg-teal-900`), `analytical` → zinc (`text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800`)
- `MODE_BADGE_LABEL` Record: `mc: 'MC'`, `analytical: 'Analytical'`
- D-11 bug fix: `maxDeviation` now uses `b.predicted_rate` (not `b.bucket_mid`)
- `calibrationMode` read from `data.summary?.calibration_mode as CalibrationMode | undefined`
- Conditional mode badge `<span>` after tier badge in populated branch; cold-start branch unchanged

## Test Results

| Suite | Before | After |
|-------|--------|-------|
| CalibrationHealthIndicator (targeted) | 9 pass | 14 pass (9 + 5 new) |
| Full vitest suite | 1261 pass / 25 pre-existing fail | 1261 pass / 25 pre-existing fail |
| TypeScript compile | clean | clean |

Pre-existing 25 failures are in `captain-picks.test.ts`, `club-form.test.ts`, `MobileNav.test.tsx`, `useRivals.test.ts` — unrelated to this plan.

## TDD Gate Compliance

- RED gate confirmed: `test(109-02)` commit dd30352 — 3 tests failing before implementation
- GREEN gate confirmed: `feat(109-02)` commit c0b0122 — all 14 tests pass after implementation

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 (RED) | dd30352 | `test(109-02)`: add failing RED tests for mode badge + D-11 bug fix |
| 2 (GREEN) | c0b0122 | `feat(109-02)`: add MC/Analytical mode badge to CalibrationHealthIndicator + D-11 fix |

## Deviations from Plan

None — plan executed exactly as written. The 5 expected RED tests split as 3 fail + 2 pass (absence assertions); this is correct behavior since the component already correctly omits badges for undefined/cold-start cases even before the implementation.

## Known Stubs

None — mode badge is fully wired to `data.summary.calibration_mode` from the existing `useAccuracy` hook payload. No stub data paths.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes beyond the optional `calibration_mode` field on the existing `AccuracySummary` interface. Threat model coverage in plan frontmatter (T-109-04/05/06) applies.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| CalibrationHealthIndicator.tsx exists | FOUND |
| types.ts exists | FOUND |
| CalibrationHealthIndicator.test.tsx exists | FOUND |
| 109-02-SUMMARY.md exists | FOUND |
| Commit dd30352 (RED gate) | FOUND |
| Commit c0b0122 (GREEN gate) | FOUND |
