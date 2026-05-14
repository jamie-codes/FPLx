---
phase: 106-code-quality-cleanup
plan: 01
subsystem: ui
tags: [tailwind, react, vitest, decision-severity, mobile-nav, code-quality]

# Dependency graph
requires:
  - phase: 097-heat-01
    provides: "Phase 97 D-02 moved club-form to Analyse section and established the 7-pill MobileNav row"
  - phase: 051-weekly-decision-summary
    provides: "computeDecisionSeverity pure classifier and DecisionSummaryTab component"
provides:
  - "Load Squad button with single transition-all utility (no duplicate transition-colors/transition-transform)"
  - "computeDecisionSeverity captain branch returns LOW for candidates.length < 2"
  - "NAV-05 analyse-pills click test covers all 7 pills with correct sub-tab id assertions"
  - "WR-03 acknowledged as no-op: Phase 97 D-02 already resolved the 7-pill count"
affects: [107-prompt-caching, 108-nlp-batch, 109-mc-cal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three-branch captain ternary: length < 2 -> LOW, top1 >= 2*top2 (with top2 > 0) -> HIGH, else MEDIUM"

key-files:
  created: []
  modified:
    - "src/components/squad/DecisionSummaryTab.tsx"
    - "src/lib/decision-severity.ts"
    - "src/lib/__tests__/decision-severity.test.ts"
    - "src/components/nav/MobileNav.test.tsx"

key-decisions:
  - "WR-01: Tailwind transition-all subsumes both hover-colour and active-scale — single utility is sufficient and removes the ambiguity of two overlapping transition utilities"
  - "WR-02: candidates.length < 2 returns LOW (not MEDIUM) — no-data and single-candidate cases should not signal a meaningful captaincy choice; two-candidate top2=0 edge (Test 6) stays MEDIUM per D-04 because two candidates IS a real choice with a data-quality issue"
  - "WR-03 no-op: Phase 97 D-02 already shipped the 7-pill MobileNav row; NAV-02 test description on line 40 explicitly says 'renders 7 pills' — no code change needed"
  - "WR-04: NAV-05 filter extended from 4 to 7 pills with byte-identical sub-tab ids from page.tsx lines 67-69 (club-form, accuracy, price-changes)"

patterns-established:
  - "Captain severity three-branch ternary: length guard first, then points comparison, then fallback"

requirements-completed: [WR-01, WR-02, WR-03, WR-04]

# Metrics
duration: 9min
completed: 2026-05-14
---

# Phase 106 Plan 01: Code Quality Cleanup Summary

**Four v1.16 WR carry-forward items closed: single transition-all on Load Squad button, captain LOW for <2 candidates, NAV-05 extended to 7 pills with TDD, WR-03 traced as no-op**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-05-14T08:08:07Z
- **Completed:** 2026-05-14T08:16:39Z
- **Tasks:** 4 (Tasks 1-3 committed individually; Task 4 is a verification gate with no code changes)
- **Files modified:** 4

## Accomplishments

- WR-01: Load Squad button className now has a single `transition-all` utility; `transition-colors` and `transition-transform` removed (line 481)
- WR-02: `computeDecisionSeverity` captain branch returns `'LOW'` when `args.candidates.length < 2`; Tests 4 and 5 updated to assert `'LOW'` with semantically accurate descriptions; Test 6 (two candidates, top2=0) stays `'MEDIUM'` per D-04
- WR-03: Confirmed as no-op — NAV-02 test description on line 40 of `MobileNav.test.tsx` already says "renders 7 pills with mobile labels Gems/Insights/DefCon/SP/Form/Acc/Prices in order (NAV-02, Phase97 D-02)"
- WR-04: NAV-05 analyse-pills click test extended from 4 pills to all 7 pills with `onSubTabChange` assertions for Form (`'club-form'`), Acc (`'accuracy'`), Prices (`'price-changes'`)

## Task Commits

1. **Task 1: WR-01 — Replace duplicate transition utilities** - `d5a0be8` (fix)
2. **Task 2: WR-02 — Captain severity returns LOW when candidates.length < 2** - `b68e558` (fix + TDD RED/GREEN)
3. **Task 3: WR-04 — Extend NAV-05 analyse-pills click test to all 7 pills** - `fa7b23e` (test)
4. **Task 4: Final verification gate** - no commit (verification only)

## Files Modified

- `src/components/squad/DecisionSummaryTab.tsx` — Line 481: replaced `transition-colors ... transition-transform` pair with `transition-all` (WR-01)
- `src/lib/decision-severity.ts` — Lines 44-52: updated inline comment and replaced single-line captain ternary with three-branch ternary (WR-02)
- `src/lib/__tests__/decision-severity.test.ts` — Lines 57-67: Tests 4 and 5 descriptions and assertions updated from `'MEDIUM'` to `'LOW'` (WR-02 TDD RED step)
- `src/components/nav/MobileNav.test.tsx` — Lines 123-136: NAV-05 test description updated, filter extended to 7 pills, 3 new click assertions added, `expect(pillButtons).toHaveLength(7)` added (WR-04)

## WR Requirement Status

| Req | Status | Details |
|-----|--------|---------|
| WR-01 | CLOSED | `transition-all` only; `grep -cE "transition-(colors\|transform)" src/components/squad/DecisionSummaryTab.tsx` = 0 |
| WR-02 | CLOSED | Three-branch ternary; all 21 tests in decision-severity.test.ts pass; tsc exits 0 |
| WR-03 | CLOSED (no-op) | `grep -nE "renders 7 pills" src/components/nav/MobileNav.test.tsx` returns line 40 — already resolved by Phase 97 D-02 |
| WR-04 | CLOSED | NAV-05 covers all 7 pills; all 3 new `toHaveBeenCalledWith` assertions present |

## Verification Gate Outcomes (Task 4)

### Grep gates

- `grep -nE "transition-(colors|transform)" src/components/squad/DecisionSummaryTab.tsx` → **0 matches** (WR-01 PASS)
- `grep -nE "args\.candidates\.length < 2" src/lib/decision-severity.ts` → **line 48** (WR-02 PASS)
- `grep -cE "captain: SeverityLevel = top2 > 0" src/lib/decision-severity.ts` → **0 matches** (old ternary gone)
- `grep -cE "toHaveBeenCalledWith\('(club-form|accuracy|price-changes)'\)" src/components/nav/MobileNav.test.tsx` → **3** (WR-04 PASS)
- `grep -nE "renders 7 pills" src/components/nav/MobileNav.test.tsx` → **line 40** (WR-03 no-op CONFIRMED)

### Test suites

- `npx vitest run src/lib/__tests__/decision-severity.test.ts` → **21/21 passed** (GREEN)
- Full `npx vitest run` → **25 failed / 1251 passed / 34 skipped** (same as pre-change baseline — no new regressions)
- Pre-existing failing test files (unchanged from baseline): `tests/lib/captain-picks.test.ts` (5, TEST-57), `tests/lib/club-form.test.ts` (1), `src/components/nav/MobileNav.test.tsx` (10, pre-existing QueryClient issue), `src/lib/hooks/useRivals.test.ts` (9)

### TypeScript

- `npx tsc --noEmit` → **exit 0**

### Lint

- `npm run -s lint -- src/components/squad/DecisionSummaryTab.tsx src/lib/decision-severity.ts src/lib/__tests__/decision-severity.test.ts src/components/nav/MobileNav.test.tsx` → **0 errors** (exit 0)
- Full `npm run -s lint` → exit 1 in worktree due to pre-existing errors across unrelated files (same 91 problems, 41 errors — all in files not touched by this plan)

## Decisions Made

- WR-02: `'LOW'` for `candidates.length < 2` — no-data and single-candidate cases should not surface a "captaincy urgency" signal; the D-04 two-candidate edge (top2=0, data-quality issue) stays `'MEDIUM'` because there IS a second candidate to compare against
- WR-04: Extended test uses same 7-label filter pattern as NAV-02 (line 43) rather than separate per-pill queries — consistent with the existing test style and readable at a glance

## Deviations from Plan

None — plan executed exactly as written. All four WR items addressed within the specified scope. The pre-existing MobileNav test failures (`No QueryClient set`) and lint errors are out-of-scope pre-existing issues not introduced by this plan.

## Issues Encountered

- `--reporter=basic` flag not supported by vitest v4.1.2 in this project — ran without the flag; output was equivalent
- Vitest must be run from the worktree root (`C:/Users/jamie/fplx/.claude/worktrees/agent-aa22cd16d66ad07c4`) to pick up worktree-branch file changes; running from main repo (`C:/Users/jamie/fplx`) reads the unmodified main-branch files

## Known Stubs

None — all changes are mechanical cleanups with no placeholder data.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 107 (PROMPT-CACHE: CACHE-01/02) is unblocked — this phase had no dependencies on 107
- v1.16 WR carry-forward backlog is now empty; higher-value AI phases (107-109) can proceed without the quality backlog overhead

---
*Phase: 106-code-quality-cleanup*
*Completed: 2026-05-14*
