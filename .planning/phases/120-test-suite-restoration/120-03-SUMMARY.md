---
phase: 120
plan: "03"
subsystem: test-suite
tags: [test-fix, vitest, hooks, schema]
dependency_graph:
  requires: []
  provides: [useRivals-tests-green]
  affects: [src/lib/hooks/useRivals.test.ts]
tech_stack:
  added: []
  patterns: [fixture-schema-sync, react-query-test-harness]
key_files:
  created: []
  modified:
    - src/lib/hooks/useRivals.test.ts
decisions:
  - "Added data_checked: false to bootstrapPayload() event fixture to match FPLEventSchema added in Phase 98"
  - "Changed retry: false to retry: 0 (integer) in makeWrapper() to avoid potential boolean coercion issues in react-query"
metrics:
  duration: "3m"
  completed: "2026-05-18"
  tasks_completed: 1
  files_changed: 1
---

# Phase 120 Plan 03: useRivals Test Fixture Fix Summary

Fixed 8 pre-existing `useRivals` test failures by syncing the test fixture with the `FPLEventSchema` shape introduced in Phase 98.

## What Was Built

Two minimal surgical changes to `src/lib/hooks/useRivals.test.ts`:

1. **(D-07) bootstrapPayload fixture** — Added `data_checked: false` to the event object. Phase 98 added `data_checked: z.boolean()` as a required field in `FPLEventSchema`. Without it, `parseFPLBootstrap` returned `success: false`, causing the queryFn to throw `'bootstrap shape invalid'`, and all tests that awaited `isSuccess` timed out.

2. **(D-08) makeWrapper retry hardening** — Changed `retry: false` to `retry: 0` (integer) in the `QueryClient` `defaultOptions`. This is more explicit and avoids any boolean-vs-number coercion edge cases in react-query's retry logic.

## Tasks

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add data_checked to bootstrapPayload; harden retry | 0a2959c | src/lib/hooks/useRivals.test.ts |

## Test Results

- **Before:** 8 failures (all tests awaiting `isSuccess` timed out due to schema mismatch)
- **After:** 10/10 tests pass, exits 0
- `useRivals.ts` (the hook) was NOT modified

## Acceptance Criteria Verification

- `grep -c "data_checked: false" src/lib/hooks/useRivals.test.ts` → 1 (pass)
- `grep -c "retry: false" src/lib/hooks/useRivals.test.ts` → 0 (pass)
- `grep -c "retry: 0" src/lib/hooks/useRivals.test.ts` → 1 (pass)
- `npx vitest run src/lib/hooks/useRivals.test.ts` → exits 0, 10 passed (pass)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — test-only changes, no new network endpoints or auth paths.

## Self-Check: PASSED

- [x] `src/lib/hooks/useRivals.test.ts` modified with both changes
- [x] Commit `0a2959c` exists
- [x] All 10 useRivals tests pass
- [x] `useRivals.ts` unmodified
- [x] STATE.md and ROADMAP.md not modified
