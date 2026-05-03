---
phase: 055-bench-order-optimiser
plan: 02
subsystem: ui
tags: [optimiser, bench-boost, react, vitest, rtl]

# Dependency graph
requires:
  - phase: 055-bench-order-optimiser
    provides: benchOrder() pure function in optimise-lineup.ts (Plan 01)
provides:
  - Inline muted BB bench-order note in OptimiserPanel (data-testid="bb-bench-order-note")
  - RTL test asserting BENCH-01 SC-4: note absent before BB, present+correct copy after BB activation
affects: [OptimiserPanel, chip-mode UX, bench-boost chip flow]

# Tech tracking
tech-stack:
  added: []
  patterns: [chipMode === 'bench-boost' conditional render (third instance in OptimiserPanel)]

key-files:
  created: []
  modified:
    - src/components/optimiser/OptimiserPanel.tsx
    - src/components/optimiser/OptimiserPanel.test.tsx

key-decisions:
  - "Matched bb-notice className exactly (text-xs text-zinc-500 dark:text-zinc-400 italic) for visual consistency within OptimiserPanel rather than using the alternate shade from CONTEXT.md D-11"
  - "Used &apos; entity for apostrophe in JSX per react/no-unescaped-entities lint rule; JS string in test uses plain ASCII apostrophe (React renders &apos; as ' in textContent)"

patterns-established:
  - "queryByTestId (returns null) → getByTestId (throws if absent) for absence-then-presence test pattern"

requirements-completed: [BENCH-01]

# Metrics
duration: 8min
completed: 2026-05-03
---

# Phase 55 Plan 02: Bench Order Optimiser — BB Inline Note Summary

**Inline muted note "Bench order doesn't affect score with Bench Boost active" added to OptimiserPanel, guarded by chipMode === 'bench-boost', with RTL test asserting absence-then-presence flip**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-03T08:34:00Z
- **Completed:** 2026-05-03T08:42:40Z
- **Tasks:** 3 (2 code, 1 verification)
- **Files modified:** 2

## Accomplishments
- Added `<p data-testid="bb-bench-order-note">` immediately after the existing `bb-notice` block in OptimiserPanel.tsx, guarded by `chipMode === 'bench-boost'`
- Covered BENCH-01 SC-4 with a new RTL test asserting the note is null before BB activation and renders with exact D-11 copy after activation
- All 49 optimiser tests pass (OptimiserPanel + ChipModeToggle + ChipSquadView); no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add BB bench-order inline note to OptimiserPanel.tsx** - `dc21098` (feat)
2. **Task 2: Add RTL test for BB bench-order note** - `232e6d0` (test)
3. **Task 3: Type-check + full optimiser test suite** - verification-only, no new commit

## Files Created/Modified
- `src/components/optimiser/OptimiserPanel.tsx` - Added 10 lines: `{chipMode === 'bench-boost' && <p data-testid="bb-bench-order-note">}` block after bb-notice
- `src/components/optimiser/OptimiserPanel.test.tsx` - Added 14 lines: new `it('activating Bench Boost shows bench-order-irrelevant note (BENCH-01 / D-11)')` test

## Decisions Made
- Matched the sibling `bb-notice` className exactly (`text-xs text-zinc-500 dark:text-zinc-400 italic`) for visual consistency, per PATTERNS.md note that the alternate shade in CONTEXT.md D-11 was listed as an option but the sibling match is preferred.
- Used `&apos;` entity for the apostrophe in "doesn't" in JSX (react/no-unescaped-entities); plain ASCII `'` in the test assertion (React renders `&apos;` as `'` in `.textContent`).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Pre-existing type errors in `tests/lib/captain-picks.test.ts` (5x TS2554 "Expected 0 arguments, but got 1") confirmed to predate this plan — out of scope per deviation scope boundary rule. Logged to deferred-items.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Both Phase 55 plans complete. BENCH-01 is fully delivered: `benchOrder()` pure function (Plan 01) + BB inline note + RTL test coverage (Plan 02).
- No blockers.

---
*Phase: 055-bench-order-optimiser*
*Completed: 2026-05-03*
