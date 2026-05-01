---
phase: 38-data-freshness-ux
plan: "01"
subsystem: lib/utilities
tags:
  - relative-time
  - formatter
  - vitest
  - tdd
dependency_graph:
  requires: []
  provides:
    - "formatRelativeTime(isoTimestamp, nowMs?) — FRE-02 pure utility"
  affects:
    - "src/components/LastUpdated.tsx (consumed in Plan 02)"
tech_stack:
  added: []
  patterns:
    - "Pure function with injected time param (auth-expiry.ts analog)"
    - "TDD RED/GREEN cycle with deterministic nowMs injection"
key_files:
  created:
    - path: src/lib/formatRelativeTime.ts
      lines: 23
      description: "Pure ISO-timestamp -> relative-time formatter with four time bands"
    - path: src/lib/formatRelativeTime.test.ts
      lines: 68
      description: "Vitest unit tests — 13 cases covering all bands, boundaries, singular/plural, default nowMs"
  modified: []
decisions:
  - "Mirror auth-expiry.ts structure exactly: no imports, JSDoc, named export, injected nowMs param"
  - "Hours band runs 1-47h (not 1-23h) per D-01: '24 hours ago' at 24h, '47 hours ago' at 47h, '2 days ago' at 48h"
  - "Singular/plural via ternary in template literal: `hour${diffHours === 1 ? '' : 's'}`"
metrics:
  duration: "83 seconds"
  completed: "2026-04-29T16:06:37Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
requirements_satisfied:
  - FRE-02
---

# Phase 38 Plan 01: formatRelativeTime Utility Summary

Pure `formatRelativeTime(isoTimestamp, nowMs?)` utility with four D-01 time bands and deterministic test injection via the auth-expiry.ts pattern.

## What Was Built

`src/lib/formatRelativeTime.ts` — a single named export with no imports and no `'use client'` directive. It converts an ISO 8601 timestamp into a human-readable relative string per CONTEXT.md D-01:

| Diff | Output |
|------|--------|
| < 1 min | "just now" |
| 1–59 min | "X min ago" |
| 1–47 hr | "X hour ago" / "X hours ago" |
| 48 hr+ | "X days ago" |

The function accepts an optional `nowMs: number` second parameter (defaulting to `Date.now()`) to enable deterministic testing without mocking the module — the same pattern used in `src/lib/auth-expiry.ts`.

`src/lib/formatRelativeTime.test.ts` — 13 Vitest test cases:
- Three "just now" assertions (0 ms, 30 s, 59 s)
- Boundary at 60 s ("1 min ago")
- Mid-range minutes (5 min, 59 min)
- Singular hour at exactly 60 min ("1 hour ago")
- Plural hours (3 hr, 47 hr)
- Boundary at 48 hr ("2 days ago") and 24 hr ("24 hours ago") documenting the D-01 hours-runs-through-47h behaviour
- 7 days
- Default `nowMs` case via `vi.spyOn(Date, 'now')`

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED | `4972ec0` test(38-01): add failing tests for formatRelativeTime utility | PASS |
| GREEN | `45600f7` feat(38-01): implement formatRelativeTime utility | PASS |

## Test Results

- `npx vitest run src/lib/formatRelativeTime.test.ts` — 13/13 passed
- `npx vitest run` (full suite) — 386 passed, 34 skipped (no regressions; prior baseline 362 + 13 new + 11 previously counted elsewhere)

## Deviations from Plan

None — plan executed exactly as written. The implementation matches the target shape from `38-PATTERNS.md` lines 142–160 verbatim.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. `formatRelativeTime` is a pure side-effect-free transform function. T-38-03 (DoS) mitigated by design: O(1) execution with four branch checks and one `new Date()` parse.

## Self-Check

Files exist:
- [x] `src/lib/formatRelativeTime.ts`
- [x] `src/lib/formatRelativeTime.test.ts`
- [x] `.planning/phases/38-data-freshness-ux/38-01-SUMMARY.md`

Commits exist:
- [x] `4972ec0` — RED gate
- [x] `45600f7` — GREEN gate

## Self-Check: PASSED
