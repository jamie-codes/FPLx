---
phase: 132
plan: "01"
subsystem: hooks
tags: [react, tanstack-query, hook, fpl-bootstrap, tdd]
dependency_graph:
  requires:
    - src/lib/fpl-adapter.ts (parseFPLBootstrap, FPLEventSchema)
    - src/lib/hooks/useSettledGws.ts (structural template)
  provides:
    - src/lib/hooks/useNextDeadline.ts (useNextDeadline hook, NextDeadline type)
  affects:
    - src/components/DeadlineBanner.tsx (Plan 02 consumer)
tech_stack:
  added: []
  patterns:
    - TanStack Query useQuery wrapping bootstrap-static fetch (mirrors useSettledGws)
    - events.find(e => e.is_next) ?? null selection (D-02)
    - Typed error with status field on !res.ok
key_files:
  created:
    - src/lib/hooks/useNextDeadline.ts
    - src/lib/hooks/useNextDeadline.test.ts
  modified: []
decisions:
  - "queryKey ['next-deadline'] separates from useSettledGws ['settled-gws'] for independent cache"
  - "NextDeadline type alias exported for Plan 02 DeadlineBanner consumer"
  - "null returned (not thrown) when no is_next event — D-10 off-season contract"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-22"
  tasks_completed: 2
  files_count: 2
---

# Phase 132 Plan 01: useNextDeadline Hook Summary

One-liner: TanStack Query hook extracting `{ id, deadline_time }` from bootstrap `is_next` event, mirroring `useSettledGws` pattern with null return for off-season.

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/hooks/useNextDeadline.ts` | 37 | Hook implementation — fetchNextDeadline fetcher + useNextDeadline export + NextDeadline type alias |
| `src/lib/hooks/useNextDeadline.test.ts` | 114 | 4 contract tests covering null case, is_next found case, is_current discrimination, non-OK error |

## Test Results

**4 passed, 0 failed**

| Test | Status |
|------|--------|
| returns null when no event has is_next === true | PASS |
| returns { id, deadline_time } when exactly one event has is_next === true | PASS |
| selects the is_next event even when surrounded by is_current and finished events | PASS |
| reaches isError when bootstrap returns non-OK status | PASS |

TDD cycle completed: RED (import error, 1 failed file) → GREEN (4/4 passing).

## Hook Signature

```typescript
export type NextDeadline = { id: number; deadline_time: string } | null
export function useNextDeadline(): UseQueryResult<NextDeadline>
```

Consumer usage in Plan 02:
```typescript
const { data, isLoading, isError } = useNextDeadline()
// data: { id: number; deadline_time: string } | null | undefined
```

## Patterns Established for Downstream Consumers

- Import `NextDeadline` type from `@/lib/hooks/useNextDeadline` for typing `data`
- `data === null` means off-season / no upcoming GW (render null banner)
- `data === undefined` means loading or error state
- `isError` surfaces bootstrap fetch failures (502, parse errors)
- `staleTime: 60 * 60 * 1000` — no re-fetch needed within a session for banner

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] `src/lib/hooks/useNextDeadline.ts` exists
- [x] `src/lib/hooks/useNextDeadline.test.ts` exists
- [x] Commit `1aa481f` — test(132-01): add failing tests
- [x] Commit `7f86987` — feat(132-01): implement useNextDeadline hook
- [x] `npx vitest run src/lib/hooks/useNextDeadline.test.ts` — 4 passed
- [x] `npx tsc --noEmit` — no errors attributable to useNextDeadline.ts
