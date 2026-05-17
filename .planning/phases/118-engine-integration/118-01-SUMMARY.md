---
phase: 118-engine-integration
plan: "01"
subsystem: hooks
tags:
  - tanstack-query
  - select-transform
  - staleness-gate
  - phase-117-gap
dependency_graph:
  requires:
    - "117-02: useLineupNews hook (Phase 117 gap — hook existed but lacked select transform)"
    - "src/lib/types.ts: LineupNews, LineupNewsPlayer, StatusLabel, SourceHealth (Phase 117 Plan 02)"
  provides:
    - "useLineupNews returns Map<number, LineupNewsPlayer> | undefined (undefined when scraped_at >48h)"
    - "lineupNewsSelect named export for direct testing and future reuse"
  affects:
    - "118-02 and 118-03: engine modifications consume this hook's output as lineupNewsMap"
tech_stack:
  added: []
  patterns:
    - "TanStack Query select transform (data: T) => U pattern for reshaping query output"
    - "Named export of select function for pure-function unit testing without React/hook infrastructure"
key_files:
  created:
    - src/lib/hooks/useLineupNews.test.ts
  modified:
    - src/lib/hooks/useLineupNews.ts
decisions:
  - "Export lineupNewsSelect as a named const so tests import the pure function directly — avoids renderHook/QueryClient boilerplate, aligns with engine-test node-environment pattern"
  - "Strict > (not >=) boundary: exactly-48h-old data returns Map, only >48h returns undefined (matches CONTEXT.md D-09 spec)"
metrics:
  duration: "~2 minutes"
  completed: "2026-05-17"
  tasks_completed: 2
  files_changed: 2
---

# Phase 118 Plan 01: useLineupNews Staleness Gate Summary

**One-liner:** 48h staleness select transform added to `useLineupNews` — returns `Map<number, LineupNewsPlayer> | undefined` via named `lineupNewsSelect` export, with 4 Vitest cases covering fresh/stale/boundary/identity.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add 48h staleness select transform to useLineupNews hook | f869572 | src/lib/hooks/useLineupNews.ts |
| 2 | Add Vitest unit tests for the 48h staleness select transform | fc1f0fb | src/lib/hooks/useLineupNews.test.ts |

## What Was Built

**Task 1 — Hook update** (`src/lib/hooks/useLineupNews.ts`):
- Added named export `lineupNewsSelect: (data: LineupNews) => Map<number, LineupNewsPlayer> | undefined`
- Computes `ageMs = Date.now() - new Date(data.scraped_at).getTime()`
- Returns `undefined` when `ageMs > 48 * 60 * 60 * 1000` (stale)
- Returns `new Map(data.players.map(p => [p.id, p]))` when fresh
- Updated `useQuery` generic to `<LineupNews, Error, Map<number, LineupNewsPlayer> | undefined>`
- Added `select: lineupNewsSelect` option; `queryKey`, `queryFn`, `staleTime` unchanged

**Task 2 — Tests** (`src/lib/hooks/useLineupNews.test.ts`):
- `// @vitest-environment node` (pure engine test, no React)
- `makeLineupNews / makeLineupNewsPlayer / makeSourceHealth` factory helpers
- 4 test cases: fresh data returns Map, 49h-stale returns undefined, exactly-48h boundary returns Map, Map values are reference-identical to original objects
- All 4 tests pass

## Verification

- `npx vitest run src/lib/hooks/useLineupNews.test.ts`: 4/4 passed
- `npx tsc --noEmit`: no errors introduced by this plan
- `npm run lint -- src/lib/hooks/useLineupNews.ts src/lib/hooks/useLineupNews.test.ts`: clean
- `grep "48 * 60 * 60 * 1000" src/lib/hooks/useLineupNews.ts`: line 8 (threshold)
- `grep "select:" src/lib/hooks/useLineupNews.ts`: line 21 (wired)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — this plan adds no new network endpoints, auth paths, or file access patterns.

## Self-Check: PASSED

- `src/lib/hooks/useLineupNews.ts` — FOUND
- `src/lib/hooks/useLineupNews.test.ts` — FOUND
- Commit f869572 — FOUND (Task 1)
- Commit fc1f0fb — FOUND (Task 2)
