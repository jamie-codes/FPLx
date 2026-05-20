---
phase: 129-squad-cost-simulator
plan: 01
subsystem: test-scaffolding
tags:
  - tdd
  - wave-0
  - pre-season-squad
  - slider
  - infeasibility
  - COST-01
  - COST-02
  - COST-03
dependency_graph:
  requires:
    - "src/app/api/pre-season-squad/route.ts (existing)"
    - "src/components/next-season/NextSeasonPlannerTab.tsx (existing)"
    - "src/lib/types.ts (PreSeasonPlayer, PreSeasonSquadResponse)"
    - "src/lib/pre-season-squad.ts (buildPreSeasonSquad)"
  provides:
    - "src/app/api/pre-season-squad/route.test.ts (COST-02 route contract tests)"
    - "src/components/next-season/NextSeasonPlannerTab.test.tsx (COST-01, COST-03 component tests)"
  affects:
    - "Phase 129 Wave 1 (route extension) — must make 3 route RED tests GREEN"
    - "Phase 129 Wave 2 (component slider) — must make 7 component RED tests GREEN"
    - "Phase 129 Wave 3 (infeasibility+amber) — must make 4 component RED tests GREEN"
tech_stack:
  added: []
  patterns:
    - "@vitest-environment node route test with vi.mock hoist before import"
    - "makeInputs helper with 20-player pool tuned for budget=950 feasible / budget=800 infeasible"
    - "PreSeasonSquadInputs forward-reference in test file (type added in Wave 1)"
key_files:
  created:
    - src/app/api/pre-season-squad/route.test.ts
  modified:
    - src/components/next-season/NextSeasonPlannerTab.test.tsx
decisions:
  - "Greedy test fixture uses 2GK + 5DEF + 6MID + 7FWD across 7 teams (max 3 per team) to satisfy teamCap=3 and budget constraints"
  - "4 of 15 new component tests pass at Wave 0 (gate tests asserting absence of features); 11 fail RED as expected"
  - "makeInputs uses players with ppm = 0.51–0.70 for deterministic greedy ranking"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-20"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 129 Plan 01: Test Scaffolding (Wave 0 RED) Summary

**One-liner:** Wave 0 TDD RED scaffolding — 6 route tests for ?include=inputs contract + 15 component tests for slider/infeasibility/amber-track; all new tests fail RED against unimplemented Wave 1-3 production code.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create RED route-level test scaffold | 0070db2 | src/app/api/pre-season-squad/route.test.ts (created) |
| 2 | Extend NextSeasonPlannerTab.test.tsx with RED slider tests | 123e669 | src/components/next-season/NextSeasonPlannerTab.test.tsx (modified) |

## New Tests Created

### Route Tests (6 RED) — src/app/api/pre-season-squad/route.test.ts

| Test | Status | Failure Mode |
|------|--------|--------------|
| omits inputs field when ?include=inputs is absent (Resolution 1 ILP path) | GREEN | N/A — regression guard passes at Wave 0 |
| attaches inputs on ILP path when ?include=inputs is present | RED | `body.inputs` is undefined (route has no inputs logic) |
| attaches inputs on greedy path when ?include=inputs is present | RED | `body.inputs` is undefined (route has no inputs logic) |
| scoreMap serialises as Record<string,number> with non-empty keys | RED | `body.inputs` is undefined |
| returns 404 when archive absent (both with and without ?include=inputs) | GREEN | N/A — 404 path already works |
| degrades gracefully when ?include=inputs is set but archive missing (no 503) | GREEN | N/A — degradation test passes at Wave 0 |

### Component Tests (15 new) — src/components/next-season/NextSeasonPlannerTab.test.tsx

| Test | Status | Failure Mode |
|------|--------|--------------|
| does NOT render slider when envelope has no inputs field (Phase 127/128 regression) | GREEN | N/A — regression guard passes at Wave 0 |
| renders slider input when data.inputs is present | RED | `null !== null` (no slider rendered) |
| slider initial value is £100.0m with aria-valuetext £100.0m | RED | `Cannot read properties of null ('value')` |
| slider has min=80 max=120 step=0.5 and aria-label Budget slider | RED | `Cannot read properties of null ('min')` |
| shows API squad (budgetUsed) before any commit (D-06) | GREEN | N/A — API squad already shown |
| onInput updates label only (no recompute; grid still shows API squad) | RED | Unable to fire input event (no slider) |
| pointerUp commits to client squad (D-06) | RED | Unable to fire input event (no slider) |
| infeasibility variant A: "No squad possible at £80.0m — try £83.5m+" (D-08) | RED | Unable to fire input event (no slider) |
| infeasibility variant B: "No squad possible at £80.0m" when health null (D-09) | RED | Unable to fire input event (no slider) |
| grid stays visible at infeasible budget showing lastValidSquad (D-07) | RED | Unable to fire input event (no slider) |
| amber gradient inline style contains #f59e0b and 10% threshold (D-10) | RED | `Cannot read properties of null ('style')` |
| slider track is zinc #71717a only when health is null (D-11) | RED | `Cannot read properties of null ('style')` |
| keyboard arrow + 300ms debounce commits once | RED | Unable to fire input event (no slider) |
| slider NOT rendered when isError is true | GREEN | N/A — no slider already |
| slider NOT rendered when data is null (Prices pending) | GREEN | N/A — no slider already |

## Test Counts

| File | Existing | New | RED | GREEN |
|------|----------|-----|-----|-------|
| route.test.ts (new) | 0 | 6 | 3 | 3 |
| NextSeasonPlannerTab.test.tsx | 13 | 15 | 11 | 17 |
| **Total** | **13** | **21** | **14** | **20** |

## Existing Tests Status

All 13 pre-existing component tests in NextSeasonPlannerTab.test.tsx pass GREEN (no regression).

## Deviations from Plan

### Deviation 1 — 4 new component tests pass at Wave 0 instead of all 15 failing

**Found during:** Task 2 verification
**Issue:** 4 of the 15 new tests logically pass at Wave 0 because they assert the absence of a feature (no slider in error/null state) or the presence of existing behavior (API squad shown before commit). These were always going to pass at Wave 0.
**Impact:** None — the tests are correct behavioral contracts. They will continue to pass after Wave 2 ships (the gate tests are designed to be stable).
**Acceptance:** The plan states "Acceptable failure modes for new tests: assertion failures on missing slider element / missing copy" — the 11 that DO fail match this.

### Deviation 2 — Route tests: 3 pass + 3 fail (not 6 fail)

**Found during:** Task 1 verification
**Issue:** Tests 1 (omit inputs regression), 5 (404 path), and 6 (graceful degradation) pass at Wave 0 because they test behaviors already in the production route (no-inputs path, 404 path, degradation when archive missing). Only tests 2, 3, 4 fail RED (the new inputs functionality).
**Impact:** None — this is the correct TDD RED state for the existing vs new behavior boundary.

## Known Stubs

None — this is a test scaffolding plan; no production code written.

## Self-Check: PASSED

- [x] src/app/api/pre-season-squad/route.test.ts exists
- [x] src/components/next-season/NextSeasonPlannerTab.test.tsx modified with makeInputs + 15 new tests
- [x] Commits 0070db2 and 123e669 exist in git log
- [x] All 13 pre-existing component tests pass GREEN
- [x] 14 new tests fail RED for correct reasons (missing production code)
