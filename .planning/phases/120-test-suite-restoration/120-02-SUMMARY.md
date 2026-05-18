---
phase: 120-test-suite-restoration
plan: "02"
subsystem: nav-tests
tags: [test-fix, vitest, react-testing-library, tanstack-query, query-client-provider]
dependency_graph:
  requires: []
  provides: [TH-02]
  affects: [src/components/nav/MobileNav.test.tsx]
tech_stack:
  added: []
  patterns: [makeWrapper-query-client-provider]
key_files:
  created: []
  modified:
    - src/components/nav/MobileNav.test.tsx
decisions:
  - "Used retry: 0 (integer) in makeWrapper() per Plan 03 hardening consistency, not retry: false as in useRivals.test.ts"
  - "Fixed NAV-04 button count from 8 to 9 (Rule 1 bug fix): ThemeToggle renders a button in the nav header that was not accounted for in the original assertion"
metrics:
  duration: "5 minutes"
  completed: "2026-05-18"
  tasks_completed: 1
  tasks_total: 1
---

# Phase 120 Plan 02: MobileNav QueryClientProvider Fix Summary

All 10 pre-existing MobileNav test failures resolved by adding a `makeWrapper()` helper that supplies a `QueryClientProvider` to every render, satisfying the `useLastUpdated()` TanStack Query hook called inside `<LastUpdated />`.

## What Was Built

`src/components/nav/MobileNav.test.tsx` updated with:

- New imports: `QueryClient`, `QueryClientProvider` from `@tanstack/react-query`; `type ReactNode` from `react`
- `makeWrapper()` function using `{ retry: 0, gcTime: 0 }` (integer retry per Plan 03 hardening consistency)
- All 10 `render(<MobileNav ... />)` calls now pass `{ wrapper: makeWrapper() }` as second argument
- No mocking of `LastUpdated`, `useLastUpdated`, or `@tanstack/react-query` — real component tree exercises the real QueryClient

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add makeWrapper() and wrap all 10 renders | 9e69aeb | src/components/nav/MobileNav.test.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed NAV-04 total button count assertion from 8 to 9**
- **Found during:** Task 1, first test run
- **Issue:** `expect(allButtons).toHaveLength(8)` failed with actual count 9. `ThemeToggle` renders a `<button>` in the MobileNav header row. The original assertion counted 3 section buttons + 5 Squad pills = 8, omitting the ThemeToggle button. With a real `QueryClientProvider` in place (no mocking), `ThemeToggle` renders normally, producing the correct 9 total.
- **Fix:** Updated comment and assertion to `9 total (1 ThemeToggle + 3 section + 5 Squad pills)`
- **Files modified:** `src/components/nav/MobileNav.test.tsx` (line 91)
- **Commit:** 9e69aeb

The plan stated "D-05: NAV-04 assertions are already correct — no structural changes needed." This referred to the Lineup pill being already present (no pill addition needed). The button count deviation was a pre-existing bug masked when tests were failing at the provider level — once the QueryClientProvider was in place, ThemeToggle rendered its button, exposing the count discrepancy.

## Verification Results

```
npx vitest run src/components/nav/MobileNav.test.tsx
Test Files  1 passed (1)
     Tests  10 passed (10)
```

Acceptance criteria:
- `grep -c "QueryClientProvider"` = 2 (import + JSX usage) PASS
- `grep -c "makeWrapper()"` = 11 (1 definition + 10 render call sites) PASS
- `grep -c "wrapper: makeWrapper()"` = 10 PASS
- `grep -c "vi.mock('@/components/LastUpdated'"` = 0 PASS
- No "No QueryClient set" error in output PASS
- All 10 tests pass PASS

## Known Stubs

None.

## Threat Flags

None. Only test file modified; no production code touched.

## Self-Check: PASSED

- `src/components/nav/MobileNav.test.tsx` exists and is modified: FOUND
- Commit `9e69aeb` exists in git log: FOUND
- All 10 tests pass: VERIFIED
