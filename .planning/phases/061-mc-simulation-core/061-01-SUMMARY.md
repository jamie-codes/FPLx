---
phase: 061-mc-simulation-core
plan: 01
subsystem: pipeline/testing + frontend/types
tags: [monte-carlo, tdd, pipeline, frontend, types, red-tests]
dependency_graph:
  requires: []
  provides: [MC-01-tests, MC-02-tests, MergedPlayer-MC-fields]
  affects: [pipeline/tests/test_simulate.py, src/components/gem-table/columns.test.tsx, src/lib/types.ts]
tech_stack:
  added: []
  patterns: [tdd-red-phase, pytest-fixture-builder, optional-interface-fields]
key_files:
  created:
    - pipeline/tests/test_simulate.py
  modified:
    - src/components/gem-table/columns.test.tsx
    - src/lib/types.ts
decisions:
  - "RED tests written before implementation — plan 061-02 (pipeline) and 061-03 (frontend) turn them GREEN"
  - "3 test cases appended to columns.test.tsx (2 window===3/5 suppression tests pass immediately; first MC-row render test is RED until 061-03)"
  - "4 optional snake_case fields added to MergedPlayer to match pipeline JSON output verbatim"
metrics:
  duration: "17 minutes"
  completed: "2026-05-05T21:25:00Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 1
  files_modified: 2
---

# Phase 61 Plan 01: MC Simulation Core TDD Scaffolding Summary

Wave 0 RED test scaffolding: 5 pytest cases for MC-01 pipeline simulation and 3 Vitest cases for MC-02 XPtsCell hover card, plus MergedPlayer type extension with 4 optional MC fields (`blank_prob`, `haul_prob`, `p10_pts`, `p90_pts`).

## What Was Built

### Task 1: pipeline/tests/test_simulate.py (5 RED pytest cases)

Created `pipeline/tests/test_simulate.py` with the canonical 5 test functions per VALIDATION.md:

- `test_bgw_shortcircuit` — xmins=0 or start_prob=0 yields blank_prob=1.0, haul_prob=0.0, p10=0.0, p90=0.0
- `test_mc_mean_matches_analytical` — active MID outputs land in shape range (p90 > p10+1.0, 1.0 < p90 < 15.0)
- `test_dgw_sums_fixtures` — DGW player has higher p90/haul_prob and lower blank_prob than single-fixture
- `test_p90_overwrites_ceiling` — p90_pts overwrites xPts_90th_1gw; BGW overwrites with 0.0
- `test_output_value_ranges` — all 4 fields in valid ranges across 5-player mixed list

Status: **RED** (ModuleNotFoundError: `simulate` module not yet created — correct for Wave 0).

### Task 2: src/components/gem-table/columns.test.tsx (3 test cases appended)

Appended `describe('XPtsCell — Phase 61 MC-02 hover card MC rows', ...)` block at end of file:

- `renders MC rows when blankProb/haulProb/p10Pts/p90Pts present and window===1` — **RED** (XPtsCell does not accept these props yet; `getByText('Blank%')` throws)
- `omits MC rows when window===3` — passes (existing showBreakdown guard suppresses card for 3GW)
- `omits MC rows when window===5` — passes (same guard)

Existing 10 tests untouched. No new imports added.

### Task 3: src/lib/types.ts MergedPlayer extension

Added 4 optional snake_case fields immediately after `xPts_90th_1gw?: number`, before `last_gw_actual_pts`:

```typescript
// Phase 61 MC-01/MC-02: Monte Carlo simulation outputs (10,000 sims per player per GW).
blank_prob?: number     // P(total_pts <= 2) across 10k simulations; 1.0 for BGW
haul_prob?: number      // P(total_pts >= 10) across 10k simulations; 0.0 for BGW
p10_pts?: number        // 10th percentile simulated points (floor); 0.0 for BGW
p90_pts?: number        // 90th percentile simulated points (ceiling); overwrites xPts_90th_1gw
```

`tsc --noEmit` reports zero errors on the new fields. The TS errors visible in the build are from `columns.test.tsx` passing `blankProb` props to XPtsCell (which doesn't accept them yet) — that is the expected RED state for MC-02 until Plan 061-03.

## Commits

| Task | Hash | Type |
|------|------|------|
| Task 1: pipeline test cases | 443c475 | test |
| Task 2: columns.test.tsx MC rows | 517553a | test |
| Task 3: MergedPlayer type fields | 86753d7 | feat |

## Deviations from Plan

None — plan executed exactly as written. The three `it('omits MC rows when window===3/5')` tests in Task 2 pass immediately (not RED) because the existing `showBreakdown` guard already suppresses the card for multi-GW windows — this is documented in the plan's acceptance criteria as acceptable.

## TDD Gate Compliance

- RED gate: test(061-01) commits at 443c475 and 517553a establish the failing test baseline
- GREEN gate: will be established by plan 061-02 (pipeline) and 061-03 (frontend)
- No GREEN commits in this plan — correct for Wave 0

## Known Stubs

None. This plan adds only test files and type declarations; no UI stubs or placeholder data.

## Threat Flags

None. This plan adds only test code and TypeScript optional field declarations — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries.

## Self-Check

- [x] pipeline/tests/test_simulate.py exists and has 5 named test functions
- [x] src/components/gem-table/columns.test.tsx contains Phase 61 MC-02 describe block
- [x] src/lib/types.ts has blank_prob, haul_prob, p10_pts, p90_pts in MergedPlayer
- [x] Commits 443c475, 517553a, 86753d7 exist in git log

## Self-Check: PASSED
