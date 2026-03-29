---
phase: 05-squad-view-transfer-suggestions
plan: 01
subsystem: squad-data-layer
tags: [zod, tanstack-query, route-handler, squad, fpl-api]
dependency_graph:
  requires: [src/lib/fpl-adapter.ts, src/lib/hooks/usePlayers.ts, src/app/api/fpl/[...proxy]/route.ts]
  provides: [src/lib/squad-adapter.ts, src/app/api/squad/[teamId]/route.ts, src/lib/hooks/useSquad.ts]
  affects: []
tech_stack:
  added: []
  patterns: [zod-safeParse, tanstack-query-useQuery, nextjs-route-handler-params-promise]
key_files:
  created:
    - src/lib/squad-adapter.ts
    - src/app/api/squad/[teamId]/route.ts
    - src/lib/hooks/useSquad.ts
    - tests/lib/squad-adapter.test.ts
  modified: []
decisions:
  - "GW resolution: is_current first, fallback to is_next — handles season boundary edge case (Pitfall 1)"
  - "Bootstrap fetch uses revalidate:3600 to cache at CDN layer — avoids per-request bootstrap fetch"
  - "Picks fetch uses revalidate:0 — squad can change mid-GW and must stay fresh"
  - "useSquad staleTime=5min vs usePlayers 6h — squad changes warrant shorter cache"
  - "enabled:!!teamId guard — hook is inert until Team ID is provided"
metrics:
  duration_seconds: 93
  completed_date: "2026-03-29"
  tasks_completed: 3
  files_created: 4
  files_modified: 0
---

# Phase 5 Plan 1: Squad Data Layer Summary

**One-liner:** Zod-validated squad adapter with FPL picks Route Handler (GW-resolving) and TanStack Query hook enabling `useSquad(teamId)` to return typed `SquadPicksResponse`.

## What Was Built

Three files form the squad data layer that all downstream squad view and transfer suggestion components depend on:

1. **`src/lib/squad-adapter.ts`** — Zod schemas (`SquadPickSchema`, `EntryHistorySchema`, `SquadPicksResponseSchema`) with `parseSquadResponse()` following the `parseFPLBootstrap` pattern from Phase 1.

2. **`src/app/api/squad/[teamId]/route.ts`** — Route Handler proxying `entry/{id}/event/{gw}/picks/`. Resolves current GW from bootstrap (is_current → is_next fallback), validates teamId as numeric, caches bootstrap at CDN (revalidate:3600), never caches picks (revalidate:0), Zod-validates response at boundary.

3. **`src/lib/hooks/useSquad.ts`** — TanStack Query hook matching `usePlayers` pattern. `enabled: !!teamId` guard, `queryKey: ['squad', teamId]`, `staleTime: 5min`, `retry: 1`.

4. **`tests/lib/squad-adapter.test.ts`** — 5 unit tests covering valid picks, missing picks field, non-integer element, null chip, and freehit chip.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | squad-adapter Zod schemas + tests (TDD) | 3d6c5e3 | src/lib/squad-adapter.ts, tests/lib/squad-adapter.test.ts |
| 2 | squad Route Handler at /api/squad/[teamId] | fee3f64 | src/app/api/squad/[teamId]/route.ts |
| 3 | useSquad TanStack Query hook | ff5e24d | src/lib/hooks/useSquad.ts |

## Verification Results

- `npx vitest run tests/lib/squad-adapter.test.ts` — 5/5 tests pass
- `npx next build` — compiles without type errors; `/api/squad/[teamId]` appears as dynamic route
- `npx vitest run` — full suite 47/47 tests pass (no regressions)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all files contain functional implementations with no placeholder data or TODO stubs.

## Self-Check: PASSED

Files exist:
- FOUND: src/lib/squad-adapter.ts
- FOUND: src/app/api/squad/[teamId]/route.ts
- FOUND: src/lib/hooks/useSquad.ts
- FOUND: tests/lib/squad-adapter.test.ts

Commits exist:
- FOUND: 3d6c5e3 (squad-adapter)
- FOUND: fee3f64 (route handler)
- FOUND: ff5e24d (useSquad hook)
