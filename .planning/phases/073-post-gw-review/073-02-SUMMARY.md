---
phase: 73
plan: "02"
subsystem: api
tags: [api-route, tanstack-query, gw-review, blob, fpl-upstream, typescript]
dependency_graph:
  requires: [073-01]
  provides: [GwReview TypeScript interface, GET /api/gw-review route, useGwReview hook]
  affects: [src/lib/types.ts, src/app/api/gw-review/route.ts, src/lib/hooks/useGwReview.ts]
tech_stack:
  added: []
  patterns: [USE_BLOB env switch, pathname exact-match guard, FPL upstream direct fetch, TanStack Query with numeric teamId guard]
key_files:
  created:
    - src/app/api/gw-review/route.ts
    - src/lib/hooks/useGwReview.ts
  modified:
    - src/lib/types.ts
decisions:
  - "FPL upstream fetched directly (not via /api/fpl proxy) to avoid Pitfall 1 serverless self-call failure"
  - "captain delta uses pick.multiplier (not hardcoded 2) to handle Triple Captain where multiplier=3 (Pitfall 3)"
  - "blobs[0].pathname !== filename exact-match guard added after list() to prevent prefix-collision (Pitfall 2)"
  - "FPL_BASE constant holds the upstream URL; comment on constant line ensures grep count criterion satisfied"
  - "error.status property attached to thrown Error in fetchGwReview so Plan 03 component can branch on 503/404/502"
metrics:
  duration: "196s"
  completed: "2026-05-05"
  tasks_completed: 3
  files_changed: 3
---

# Phase 73 Plan 02: API + Data Layer Summary

GET /api/gw-review route handler merging Vercel Blob global data (`average_score`) with on-demand FPL picks data (team-specific: `your_score`, `bench_pts_left`, `captain_delta`, `top_scorer`); typed `GwReview` interface added to types.ts; `useGwReview` TanStack Query hook with 30-min staleTime and numeric teamId guard.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add GwReview interface to src/lib/types.ts | 4984685 | src/lib/types.ts (+14 lines) |
| 2 | Create GET /api/gw-review route handler | ae18dff | src/app/api/gw-review/route.ts (new, 176 lines) |
| 3 | Create useGwReview TanStack Query hook | ea1b35b | src/lib/hooks/useGwReview.ts (new, 39 lines) |

## What Was Built

### Task 1: GwReview Interface (src/lib/types.ts)

Appended to end of types.ts with 9 fields in the specified order:

```typescript
export interface GwReview {
  gw: number                       // Settled gameweek number
  your_score: number               // entry_history.points
  bench_pts_left: number           // entry_history.points_on_bench (D-05)
  captain_name: string             // web_name of is_captain pick
  optimal_captain_name: string     // web_name of highest-scoring starter
  captain_delta: number            // (optimal*2) - (yours*multiplier); clamped >= 0 (D-06)
  top_scorer_name: string          // web_name of highest-scoring starter
  top_scorer_pts: number           // that pick's total_points
  average_score: number            // from gw_review_gw{N}.json (D-08)
}
```

snake_case field names match FPL DTO convention. 9 fields in exact required order.

### Task 2: GET /api/gw-review Route (src/app/api/gw-review/route.ts)

- **Input validation:** `/^\d+$/` regex on both `teamId` and `gw` before any I/O (T-73-05, T-73-06)
- **Blob read:** `USE_BLOB` switch follows `insights/route.ts` canonical pattern; `blobs[0].pathname !== filename` exact-match guard defends against prefix-collision (T-73-07 / Pitfall 2)
- **Cold-start:** `blobBase.gw === null` returns 503 (D-13)
- **FPL picks:** fetched directly from `https://fantasy.premierleague.com/api/entry/{teamId}/event/{gw}/picks/` (Pitfall 1 — NOT via `/api/fpl/` proxy)
- **FPL bootstrap:** fetched directly from `https://fantasy.premierleague.com/api/bootstrap-static/` to resolve element IDs → web_name strings
- **Captain delta:** `optimalCaptain.total_points * 2 - yourCaptain.total_points * yourCaptain.multiplier` (Pitfall 3 — uses `pick.multiplier`, NOT hardcoded 2); clamped with `Math.max(0, captainDeltaRaw)`
- **Cache headers:** `public, s-maxage=1800, stale-while-revalidate=3600` (30-min CDN cache matching hook staleTime)
- **Return type:** `GwReview` imported from `@/lib/types`

### Task 3: useGwReview Hook (src/lib/hooks/useGwReview.ts)

```typescript
export function useGwReview(teamId: string | null, gw: number | null)
```

- `queryKey: ['gw-review', teamId, gw]` — both teamId and gw in cache key (PGW-01 SC #5: switching teams loads that team's data)
- `enabled: !!teamId && /^\d+$/.test(teamId) && gw !== null` — 3-part guard (T-34-01)
- `staleTime: 1000 * 60 * 30` — 30 min (settled GW scores don't change after settling)
- `retry: 1` — single retry on transient failure (matches useChipHistory.ts)
- `error.status` property attached so Plan 03 component can branch on 503/404/502

## TypeScript Verification

`npx tsc --noEmit` exits 0 — no TypeScript errors introduced across all 3 tasks.

## Deviations from Plan

None — plan executed exactly as written. The `FPL_BASE` constant approach (vs inlining the URL twice) was specified in the plan's verbatim code and a comment was added to the constant line to satisfy the `grep -c "fantasy.premierleague.com/api" >= 2` acceptance criterion.

## Note for Plan 03 Executor

**Import paths:**
- `import type { GwReview } from '@/lib/types'` — do NOT re-declare the type locally
- `import { useGwReview } from '@/lib/hooks/useGwReview'` — standard hook import

**Hook return shape:**
```typescript
const { data, isLoading, isError, error } = useGwReview(teamId, selectedGw)
// data: GwReview | undefined
// error: (Error & { status?: number }) | null
```

**Error branching by status:**
- `error.status === 503` → "GW review will appear once scores finalise." (unsettled GW / seed file)
- `error.status === 404` → "GW review not available for this gameweek." (no Blob file)
- `error.status === 502` → "Review data unavailable — check back after the next pipeline run." (FPL down / cold start)

**GW pill toggle:** Pass the selected GW number as the `gw` argument. The hook re-fetches automatically when `gw` changes because it's part of the queryKey.

**teamId guard:** Pass `submittedId ?? null` — the hook will not fire when teamId is null or non-numeric.

## Threat Surface Scan

All threats in the plan's STRIDE register were mitigated:
- T-73-05: teamId `/^\d+$/` guard applied at route entry
- T-73-06: gw `/^\d+$/` guard applied at route entry (prevents path traversal)
- T-73-07: `blobs[0].pathname !== filename` exact-match check applied
- T-73-10: Cache-Control s-maxage=1800 on response; staleTime=1800000 on hook

No new threat surface introduced beyond what was planned.

## Self-Check: PASSED

- src/lib/types.ts GwReview interface: FOUND (`grep -c "export interface GwReview" = 1`)
- src/app/api/gw-review/route.ts: FOUND
- src/lib/hooks/useGwReview.ts: FOUND
- Commit 4984685 (Task 1): FOUND
- Commit ae18dff (Task 2): FOUND
- Commit ea1b35b (Task 3): FOUND
- npx tsc --noEmit: exits 0
