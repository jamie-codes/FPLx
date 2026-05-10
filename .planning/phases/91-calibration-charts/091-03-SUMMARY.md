---
phase: 91
plan: "03"
subsystem: calibration-charts
tags: [calibration, types, typescript, phase-91, CAL-01]
dependency_graph:
  requires:
    - "091-01: fixtureWithXptsMeans in AccuracyTab.test.tsx (forward-compat cast resolved by this plan)"
  provides:
    - "src/lib/types.ts: CalibrationBucket with predicted_mean? and actual_mean? optional fields"
  affects:
    - "src/components/accuracy/AccuracyTab.tsx (Plan 091-04 CalibrationSection consumes the new fields)"
    - "src/components/accuracy/AccuracyTab.test.tsx (fixtureWithXptsMeans cast can be removed once 091-04 ships)"
tech_stack:
  added: []
  patterns:
    - "Optional TypeScript fields (?: number) for legacy-cache compat (D-06)"
    - "Additive-only interface extension — zero deletions, zero renames"
key_files:
  created: []
  modified:
    - path: src/lib/types.ts
      description: "CalibrationBucket extended with 2 optional fields + 1 comment (3 lines added, 0 deleted)"
decisions:
  - "Fields declared as optional (?: number) per D-06: legacy accuracy_backtest.json caches (Phase 63) lack these fields; UI consumers must null-guard at runtime (Plan 091-04 Pitfall 5 filter)"
  - "Comment block included inline explaining CAL-01 / D-06 rationale for future maintainers"
  - "CalibrationData and AccuracyBacktest left byte-identical — only CalibrationBucket was the target of this plan"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-10"
  tasks_completed: 1
  files_modified: 1
---

# Phase 91 Plan 03: CalibrationBucket Type Extension Summary

Two new optional TypeScript fields (`predicted_mean?: number`, `actual_mean?: number`) added to `CalibrationBucket` in `src/lib/types.ts`, locking the type contract that Plan 091-04 will consume in `CalibrationSection`. Legacy Phase 63 caches remain type-safe via the `?:` optional marker (D-06).

## Tasks Completed

### Task 1: Add predicted_mean? and actual_mean? optional fields to CalibrationBucket

**Commit:** `ec17b10` — `feat(91): add optional predicted_mean/actual_mean to CalibrationBucket (CAL-01)`

**Lines added:** 3 (1 comment line + 2 field declarations)
**Lines deleted:** 0

**Change summary:**
- `predicted_mean?: number` — mean xpts_predicted within decile (rounded 2dp by pipeline)
- `actual_mean?: number` — mean actual_pts within decile (rounded 2dp by pipeline)
- Comment: `// Phase 91 CAL-01 (D-06): optional for legacy-cache compat — Phase 63 caches lack these fields.`

**Interfaces unchanged (byte-identical):**
- `CalibrationData` — no modification
- `AccuracyBacktest` — no modification

**TypeScript check result:** `npx tsc --noEmit` — zero errors

**Vitest result:**
- 18 tests PASSED (all pre-Plan-91 tests — no regression)
- 4 tests FAILED (Phase 91 CAL-01 RED tests — correctly still RED; interface change alone does not render the new chart)
- Note: test 5 (empty-state overlay) continues to PASS in RED phase as documented in 091-01 SUMMARY (existing haul-rate chart already satisfies the `>= 1` assertion)

**Acceptance criteria verification:**
- `grep -c "predicted_mean?: number" src/lib/types.ts` → 1
- `grep -c "actual_mean?: number" src/lib/types.ts` → 1
- `grep -c "Phase 91 CAL-01 (D-06): optional for legacy-cache compat"` → 1
- New fields inside CalibrationBucket only → confirmed (CalibrationData grep returns 0)
- All 4 existing fields unchanged (bucket_mid, predicted_rate, actual_rate, sample_n) → confirmed
- `npx tsc --noEmit` → zero errors
- git diff shows 3 insertions, 0 deletions

## Deviations from Plan

None — plan executed exactly as written. The single-file, two-field change was localized to `CalibrationBucket` with zero side-effects.

## Known Stubs

None — this plan is a pure type-system declaration change with no runtime code.

## Threat Flags

None — this plan introduces no new runtime code, no I/O boundaries, and no new trust surfaces. The `?:` optional marker per D-06 satisfies T-91-08 (the runtime null-guard requirement is delegated to Plan 091-04's `useMemo` filter).

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `src/lib/types.ts` modified | FOUND |
| `predicted_mean?: number` in CalibrationBucket | FOUND (count=1) |
| `actual_mean?: number` in CalibrationBucket | FOUND (count=1) |
| CalibrationData unchanged | CONFIRMED (grep returns 0) |
| `npx tsc --noEmit` | PASSED (zero errors) |
| Vitest: 18 passed, 4 Phase-91 RED still failing | CONFIRMED |
| Commit `ec17b10` | FOUND |
