---
phase: 120-test-suite-restoration
verified: 2026-05-18T13:20:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification: null
gaps: []
deferred: []
---

# Phase 120: Test Suite Restoration — Verification Report

**Phase Goal:** The test suite is fully green with all 25 pre-existing failures resolved across four test files
**Verified:** 2026-05-18T13:20:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | captain-picks test file exits clean with all 5 tests passing (CAP-03/CAP-04 CaptainPicksPanel rendering) | VERIFIED | `npx vitest run tests/lib/captain-picks.test.tsx` → 6 passed, 8 skipped (0 failed). File renamed .ts→.tsx; 5 JSX renders confirmed |
| 2 | MobileNav test file exits clean with all 10 tests passing (NAV-01 through NAV-05, Lineup tab drift from Phase 119 resolved) | VERIFIED | `npx vitest run src/components/nav/MobileNav.test.tsx` → 10 passed (0 failed). `makeWrapper()` present, 10 `wrapper: makeWrapper()` call sites confirmed |
| 3 | useRivals test file exits clean with all 8 tests passing (ML-01/02/08, D-05 sub-tab memory) | VERIFIED | `npx vitest run src/lib/hooks/useRivals.test.ts` → 10 passed (0 failed). `data_checked: false` in fixture, `retry: 0` in makeWrapper confirmed |
| 4 | club-form test file exits clean with all 1 failing test now passing (difficulty-tier classification assertion) | VERIFIED | `npx vitest run tests/lib/club-form.test.ts` → 13 passed (0 failed). Line 24 now `team_h_difficulty: 2`; `fplToAttDiff(2)=0.25 < 0.5` satisfies assertion |
| 5 | Full vitest suite passes with no new failures introduced by the fixes | VERIFIED | `npx vitest run` → 110 test files passed, 1400 tests passed, 34 skipped (0 failed) |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/lib/captain-picks.test.tsx` | 5 passing CaptainPicksPanel component tests (CAP-03/CAP-04) | VERIFIED | File exists; renamed from .ts to .tsx (required for JSX syntax). 5 `render(<CaptainPicksPanel />)` calls confirmed. 0 `render(CaptainPicksPanel({` calls remain |
| `src/components/nav/MobileNav.test.tsx` | 10 passing MobileNav tests wrapped in QueryClientProvider | VERIFIED | File exists. `QueryClientProvider` appears 2 times (import + JSX). `makeWrapper()` appears 11 times (1 definition + 10 call sites). No `vi.mock('@/components/LastUpdated'` present |
| `src/lib/hooks/useRivals.test.ts` | Passing useRivals suite with corrected bootstrap fixture | VERIFIED | `data_checked: false` present in bootstrapPayload event. `retry: false` → 0 matches; `retry: 0` present |
| `tests/lib/club-form.test.ts` | Passing club-form suite with corrected difficulty fixture for event 32 | VERIFIED | Line 24: `team_h_difficulty: 2`. Source file `src/lib/club-form.ts` unmodified (confirmed via git diff) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `tests/lib/captain-picks.test.tsx` | `src/components/captaincy/CaptainPicksPanel.tsx` | `render(<CaptainPicksPanel />)` in React Testing Library | VERIFIED | 5 JSX render call sites found; component renders through React reconciler so useState resolves correctly |
| `src/components/nav/MobileNav.test.tsx` | `@tanstack/react-query QueryClientProvider` | `makeWrapper()` helper passed as `{ wrapper: makeWrapper() }` | VERIFIED | All 10 render calls pass `{ wrapper: makeWrapper() }`. QueryClientProvider wraps every render |
| `src/lib/hooks/useRivals.test.ts (bootstrapPayload)` | `src/lib/fpl-adapter.ts (FPLEventSchema)` | Schema validation of mocked bootstrap-static response | VERIFIED | `data_checked: false` present in event fixture; FPLEventSchema validation succeeds; no "bootstrap shape invalid" timeout |
| `tests/lib/club-form.test.ts (event 32 fixture)` | `src/lib/club-form.ts (fplToAttDiff)` | FPL difficulty rating → `difficulty_score = (fpl - 1) / 4` | VERIFIED | `team_h_difficulty: 2` → `fplToAttDiff(2) = 0.25` satisfies `toBeLessThan(0.5)` |

### Data-Flow Trace (Level 4)

Not applicable — this phase modifies only test files. No dynamic data rendering was added or changed.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 5 captain-picks component tests pass | `npx vitest run tests/lib/captain-picks.test.tsx` | 6 passed, 8 skipped | PASS |
| 10 MobileNav tests pass | `npx vitest run src/components/nav/MobileNav.test.tsx` | 10 passed | PASS |
| 10 useRivals tests pass | `npx vitest run src/lib/hooks/useRivals.test.ts` | 10 passed | PASS |
| 13 club-form tests pass | `npx vitest run tests/lib/club-form.test.ts` | 13 passed | PASS |
| No regressions in full suite | `npx vitest run` | 110 files, 1400 passed, 34 skipped, 0 failed | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TH-01 | 120-01-PLAN.md | All 5 captain-picks failures pass | SATISFIED | `tests/lib/captain-picks.test.tsx` exits 0; 5 component tests pass; JSX render confirmed |
| TH-02 | 120-02-PLAN.md | All 10 MobileNav failures pass | SATISFIED | `src/components/nav/MobileNav.test.tsx` exits 0; 10 tests pass; makeWrapper present |
| TH-03 | 120-03-PLAN.md | All 8 useRivals failures pass | SATISFIED | `src/lib/hooks/useRivals.test.ts` exits 0; 10 tests pass; data_checked: false present |
| TH-04 | 120-04-PLAN.md | club-form difficulty-tier test passes | SATISFIED | `tests/lib/club-form.test.ts` exits 0; 13 tests pass; team_h_difficulty: 2 on line 24 |

All four v1.23 Test Health requirements assigned to Phase 120 are satisfied. DOC-01 and VER-01 are Phase 121 requirements and are out of scope for this phase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No anti-patterns found. All changes are surgical test-file-only fixes with real implementations:
- `captain-picks.test.tsx`: mocks are comprehensive (6 hooks mocked), assertions check actual rendered content
- `MobileNav.test.tsx`: real QueryClient wraps real component tree; no mocking of LastUpdated or useLastUpdated
- `useRivals.test.ts`: fixture updated to match schema; no test logic altered
- `club-form.test.ts`: one value changed on one fixture line; assertion unchanged

### Plan Deviations

One deviation from Plan 02's stated must-have:

**Plan 02 stated:** "Existing NAV-04 assertion (5 Squad pills, 8 total buttons including the Lineup pill) continues to pass without test-side structural changes."

**Actual:** The NAV-04 assertion was corrected from `toHaveLength(8)` to `toHaveLength(9)`. ThemeToggle renders a `<button>` in the MobileNav header that was not counted in the original pre-fix assertion. When the QueryClientProvider was in place and the real component tree rendered, the count was correctly 9. The original `toHaveLength(8)` was a latent bug in the test, masked because the tests were failing at the QueryClient level before ThemeToggle could render. The executor treated this as a Rule 1 bug fix (correct the test to match reality). This is the right call — the production component was always correct.

### Human Verification Required

None. All must-haves are programmatically verifiable and have been verified.

### Gaps Summary

No gaps. All 5 ROADMAP success criteria are satisfied:
1. captain-picks: 5 tests pass (6 total including the Wave 0 stub), 8 pipeline tests remain skipped
2. MobileNav: 10 tests pass
3. useRivals: 10 tests pass (8 previously failing + 2 already passing)
4. club-form: 13 tests pass (1 previously failing, 12 already passing)
5. Full suite: 110 test files, 1400 tests passed, 34 skipped, 0 failures

---

_Verified: 2026-05-18T13:20:00Z_
_Verifier: Claude (gsd-verifier)_
