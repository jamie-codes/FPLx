---
phase: 124-season-review
plan: "02"
subsystem: season-review
tags:
  - season-review
  - tanstack-query
  - hook
  - tdd
dependency_graph:
  requires:
    - SeasonReview type (src/lib/types.ts — Plan 01)
    - GET /api/season-review route (src/app/api/season-review/route.ts — Plan 01)
  provides:
    - useSeasonReview hook (src/lib/hooks/useSeasonReview.ts)
  affects:
    - Wave 3 SeasonReviewTab component (Plan 03)
tech_stack:
  added: []
  patterns:
    - TDD RED→GREEN per-task commit sequence
    - TanStack Query v5 hook (no deprecated v4 options)
    - Numeric teamId guard for SSRF defence-in-depth
    - In-memory cache only (no localStorage ring buffer)
key_files:
  created:
    - src/lib/hooks/useSeasonReview.ts
    - src/lib/hooks/useSeasonReview.test.ts
  modified: []
decisions:
  - "No localStorage ring buffer — settled season data relies on TanStack in-memory 6h cache only (mirrors useSeasonAnalytics pattern)"
  - "enabled: !!teamId && /^\\d+$/.test(teamId) — two-layer SSRF guard even though route also validates (T-124-05)"
  - "Cherry-picked Plan 01 commits into this worktree to resolve missing SeasonReview type (worktree was forked before Plan 01 was merged to main)"
metrics:
  duration: "~2 minutes"
  completed: "2026-05-19"
  tasks_completed: 1
  files_created: 2
  files_modified: 0
---

# Phase 124 Plan 02: useSeasonReview Hook Summary

TanStack Query v5 hook for the `/api/season-review` endpoint, providing the client-side data primitive for `SeasonReviewTab` (Plan 03).

## What Was Built

### useSeasonReview Hook

Exported from `src/lib/hooks/useSeasonReview.ts`:

```typescript
export function useSeasonReview(teamId: string | null): UseQueryResult<SeasonReview>
```

**Exact configuration values:**

| Option | Value |
|--------|-------|
| `queryKey` | `['season-review', teamId]` |
| `staleTime` | `6 * 60 * 60 * 1000` (6 hours) |
| `retry` | `1` |
| `enabled` | `!!teamId && /^\d+$/.test(teamId)` |

**Private fetcher:**

```typescript
async function fetchSeasonReview(teamId: string): Promise<SeasonReview>
// Fetches: /api/season-review?teamId=${teamId}
// Error: throws Error with .status = res.status on non-ok response
// Error message: `Season review fetch failed: ${res.status}`
```

**Deprecated v4 options:** NOT present — no `onSuccess`, `onError`, `onSettled`, or `placeholderData`. TanStack Query v5 compliant.

**Cache strategy:** In-memory only. No localStorage ring buffer. Settled season data is immutable within a session; TanStack's in-memory cache with 6h staleTime is sufficient. This mirrors `useSeasonAnalytics` (the canonical pattern from Phase 100).

### Hook Contract Tests

`src/lib/hooks/useSeasonReview.test.ts` — 6 tests:

| Test | Description |
|------|-------------|
| 1 | `useSeasonReview(null)` — disabled, fetch never called |
| 2 | `useSeasonReview('abc')` — non-numeric, disabled, fetch never called (T-124-05) |
| 3 | `useSeasonReview('99999')` — fetches correct URL, resolves data |
| 4 | `{ ok: false, status: 500 }` — surfaces `isError=true`, `error.status=500` |
| 5 | `queryKey: ['season-review', '99999']` — verifiable via QueryClient cache |
| 6 | Hook importable + callable with null — no crash (v5 compliance source check) |

## Test Results

```
npx vitest run src/lib/hooks/useSeasonReview

Test Files  1 passed (1)
     Tests  6 passed (6)
```

## SeasonReview Fields Available to Plan 03

The `SeasonReview` type (added in Plan 01) provides:

```typescript
interface SeasonReview {
  totalPoints: number           // for REV-01 summary card
  finalRank: number             // for REV-01 summary card
  bestGw: { gw: number; points: number }   // for REV-01
  worstGw: { gw: number; points: number }  // for REV-01
  transferNetPoints: number     // for REV-01
  gwData: SeasonGwEntry[]       // for REV-03 chart
}

interface SeasonGwEntry {
  gw: number                   // x-axis
  points: number               // user score line
  avgManagerScore: number      // avg manager overlay line
  overallRank: number          // tooltip only
  chipPlayed: string | null    // ChipDot marker trigger
}
```

Note: `captainHits` and `captainGwsWithData` are NOT on `SeasonReview` per CONTEXT.md D-04. Captain hit rate must be derived client-side in `SeasonReviewTab` via `useDecisionHistory(teamId)` + `computeSeasonSummary()`.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 9c53ab0 | test | RED — failing tests for useSeasonReview hook |
| afe1b25 | feat | GREEN — implement useSeasonReview hook per REV-03 + D-03/D-04 |

(Cherry-picked Plan 01 commits 58ee39f → da08e4f also present in this worktree to resolve the missing `SeasonReview` type dependency.)

## Deviations from Plan

**[Rule 3 - Blocking] Cherry-picked Plan 01 commits into worktree**

- **Found during:** Task 1 GREEN phase (TypeScript compile)
- **Issue:** `SeasonReview` type not in worktree's `types.ts` — worktree was forked before Plan 01 was merged to `main`. `npx tsc --noEmit` showed `Module '"../types"' has no exported member 'SeasonReview'`.
- **Fix:** Cherry-picked the 6 Plan 01 commits (types, grade tests/impl, route tests/impl, summary) into this worktree. No conflicts.
- **Impact:** No behavior change; purely additive dependency resolution.
- **Commits cherry-picked:** 6757117, 2d641f4, 2dfd29f, 1c9e8e5, 0551566, f64c876 → landed as 58ee39f → da08e4f

## Known Stubs

None — this plan creates a data hook only. No UI stubs.

## Threat Flags

No new threat surface beyond what is documented in the plan's threat model (T-124-05 SSRF guard implemented via `enabled` condition, T-124-06 error message exposes only status code).

## Self-Check

- FOUND: src/lib/hooks/useSeasonReview.ts
- FOUND: src/lib/hooks/useSeasonReview.test.ts
- FOUND commit: 9c53ab0 (test RED)
- FOUND commit: afe1b25 (feat GREEN)
- Tests: 6 passed (6)

## Self-Check: PASSED
