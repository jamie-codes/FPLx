---
phase: 124-season-review
plan: "01"
subsystem: season-review
tags:
  - season-review
  - fpl-api
  - grade
  - types
  - tdd
dependency_graph:
  requires: []
  provides:
    - SeasonGwEntry type (src/lib/types.ts)
    - SeasonReview type (src/lib/types.ts)
    - computeDecisionGrade function (src/lib/season-review.ts)
    - GET /api/season-review route (src/app/api/season-review/route.ts)
  affects:
    - Wave 2 useSeasonReview hook (Plan 02)
    - Wave 3 SeasonReviewTab component (Plan 03)
tech_stack:
  added: []
  patterns:
    - TDD RED→GREEN per-task commit sequence
    - Non-fatal fetch helpers (season-analytics pattern)
    - SSRF teamId /^\d+$/ guard (established route pattern)
    - Promise.all parallel FPL fetch (history + bootstrap)
key_files:
  created:
    - src/lib/season-review.ts
    - src/lib/season-review.test.ts
    - src/app/api/season-review/route.ts
    - src/app/api/season-review/route.test.ts
  modified:
    - src/lib/types.ts
decisions:
  - "SeasonReview excludes captainHits/captainGwsWithData per D-04 — captain rate derived client-side"
  - "overall_rank added to local FPLHistoryCurrent interface (absent from season-analytics analog)"
  - "Bootstrap failure is non-fatal — avgManagerScore defaults to 0 per GW"
  - "Empty current[] guard returns zero payload without reduce operations (Pitfall 6)"
metrics:
  duration: "~4 minutes"
  completed: "2026-05-19"
  tasks_completed: 3
  files_created: 4
  files_modified: 1
---

# Phase 124 Plan 01: Season Review Backend Foundation Summary

Establish the season review type contract, decision grade pure function, and API route returning aggregated per-GW data from FPL history and bootstrap endpoints.

## What Was Built

### SeasonGwEntry and SeasonReview Types (Task 1)

Added to `src/lib/types.ts` after the `SeasonAnalytics` interface:

```typescript
export interface SeasonGwEntry {
  gw: number
  points: number             // user's actual GW score
  avgManagerScore: number    // FPL events[].average_entry_score for this GW
  overallRank: number        // user's overall rank after this GW
  chipPlayed: string | null  // chip slug ('bboost'|'3xc'|'freehit'|'wildcard') or null
}

export interface SeasonReview {
  totalPoints: number
  finalRank: number          // overall_rank from the last current[] entry
  bestGw: { gw: number; points: number }
  worstGw: { gw: number; points: number }
  transferNetPoints: number  // sum of -(event_transfers_cost) — negative means hits taken
  gwData: SeasonGwEntry[]    // ordered GW1..GW38 (only GWs that have played)
}
```

Per CONTEXT.md D-04: `captainHits` and `captainGwsWithData` are NOT on `SeasonReview` — captain hit rate is derived client-side via `computeSeasonSummary` on `useDecisionHistory` data to avoid 38 picks-endpoint fetches.

### computeDecisionGrade Pure Function (Task 2)

Exported from `src/lib/season-review.ts`:

```typescript
export type GradeLabel = 'A' | 'B' | 'C' | 'D'

export function computeDecisionGrade(
  captainEVRate: number,
  hitBreakEvenRate: number,
  chipROIPositiveRate: number,
  chipCount: number,
): GradeLabel
```

Branching behavior:
- `chipCount > 0`: `score = captainEVRate * 0.40 + hitBreakEvenRate * 0.35 + chipROIPositiveRate * 0.25`
- `chipCount === 0` (D-06): `score = captainEVRate * (40/75) + hitBreakEvenRate * (35/75)` — `chipROIPositiveRate` argument NOT referenced (NaN-safe)
- Thresholds: `>= 0.75 → 'A'`, `>= 0.50 → 'B'`, `>= 0.25 → 'C'`, else `'D'`

### /api/season-review Route Handler (Task 3)

`GET /api/season-review?teamId={id}` responses:

| Status | Condition |
|--------|-----------|
| 400 | `teamId` missing or non-numeric (`/^\d+$/` SSRF guard) |
| 502 | FPL `/entry/{teamId}/history/` returns non-ok response |
| 200 | Valid teamId + history fetch success — returns `SeasonReview` JSON |

Key implementation details:
- `Promise.all([fetchHistory(teamId), fetchBootstrapEvents()])` — parallel fetch
- `FPLHistoryCurrent` interface includes `overall_rank: number` (Pitfall 1 fix — absent from analog)
- `average_entry_score` exact field name used for `avgManagerScore` (Pitfall 6 protection)
- Empty `current[]` guard: returns zero/empty `SeasonReview` without `reduce` operations
- Bootstrap failure folds to `avgManagerScore: 0` per GW (non-fatal dependency)
- `Cache-Control: public, s-maxage=1800, stale-while-revalidate=86400`

## Test Results

```
npx vitest run src/lib/season-review src/app/api/season-review

Test Files  2 passed (2)
     Tests  18 passed (18)
```

- `src/lib/season-review.test.ts`: 10 tests (grade boundaries A/B/C/D, D-06 chip=0 renormalization, NaN guard, partial renormalization, standard 3-component, GradeLabel type)
- `src/app/api/season-review/route.test.ts`: 8 tests (400 validation, 502 upstream failure, aggregation shape, Cache-Control, empty current[], avgManagerScore field name, bootstrap fallback)

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 6757117 | feat | Add SeasonGwEntry and SeasonReview types to types.ts |
| 2d641f4 | test | RED — failing tests for computeDecisionGrade D-05/D-06 |
| 2dfd29f | feat | GREEN — implement computeDecisionGrade |
| 1c9e8e5 | test | RED — failing tests for /api/season-review route |
| 0551566 | feat | GREEN — implement /api/season-review |

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria met.

## Known Stubs

None — this plan creates backend infrastructure only (types, pure function, route handler). No UI stubs.

## Threat Flags

No new threat surface beyond what is documented in the plan's threat model (T-124-01 SSRF guard implemented, T-124-02 try/catch implemented).

## Self-Check

Checking created files exist and commits are present...

- FOUND: src/lib/season-review.ts
- FOUND: src/lib/season-review.test.ts
- FOUND: src/app/api/season-review/route.ts
- FOUND: src/app/api/season-review/route.test.ts
- FOUND commit: 6757117 (types)
- FOUND commit: 2d641f4 (grade tests RED)
- FOUND commit: 2dfd29f (grade implementation GREEN)
- FOUND commit: 1c9e8e5 (route tests RED)
- FOUND commit: 0551566 (route implementation GREEN)

## Self-Check: PASSED
