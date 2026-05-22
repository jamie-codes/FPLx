---
phase: 133
plan: "02"
subsystem: api
tags:
  - api
  - types
  - hook
  - typescript
  - price-reset
  - tdd
dependency_graph:
  requires:
    - "133-01 (price_baseline.json pipeline artifact)"
  provides:
    - "GET /api/price-reset — diff-based endpoint returning PriceResetResponse"
    - "PriceResetRow, ValueTargetRow, PriceResetResponse types in src/lib/types.ts"
    - "usePriceReset() TanStack Query hook"
  affects:
    - "133-03 (PriceResetTab consumes PriceResetResponse + usePriceReset)"
tech_stack:
  added:
    - "src/app/api/price-reset/route.ts — Next.js App Router GET handler"
    - "src/lib/hooks/usePriceReset.ts — TanStack Query hook"
  patterns:
    - "readBlobOrLocal helper (mirrored from pre-season-squad/route.ts)"
    - "satisfies PriceResetResponse on all return paths"
    - "merged_players graceful degradation via .catch(() => null)"
    - "TDD RED/GREEN cycle — 2 commits"
key_files:
  created:
    - src/app/api/price-reset/route.ts
    - src/app/api/price-reset/route.test.ts
    - src/lib/hooks/usePriceReset.ts
  modified:
    - src/lib/types.ts
decisions:
  - "merged_players.json read wrapped in .catch(() => null) so network/parse errors degrade to value_targets=[] without surfacing a 500 (Rule 1 auto-fix)"
  - "makeRequest() helper removed from test file (route takes no arguments); unused NextRequest import cleaned up"
metrics:
  duration: "5m 9s"
  completed: "2026-05-22"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 1
---

# Phase 133 Plan 02: API Route, Types and Hook Summary

**One-liner:** Diff-based `/api/price-reset` endpoint with position-median Value Target filtering, backed by PriceResetRow/ValueTargetRow/PriceResetResponse types and a mirrored usePriceReset TanStack Query hook.

## What Was Built

### Types (src/lib/types.ts — lines 1163–1192)

New type block appended after `PreSeasonActiveResponse` with comment header `// Price reset analysis (Phase 133 PRST-02/03/04 — pipeline/cache/price_baseline.json)`:

| Interface | Line | Description |
|-----------|------|-------------|
| `PriceResetRow` | 1166 | Per-player diff row: player_id, name, team, element_type, baseline_cost, current_cost, delta_cost |
| `ValueTargetRow extends PriceResetRow` | 1176 | Adds xPts_1gw, position_median_xPts, position_rank, position_label |
| `PriceResetResponse` | 1184 | Envelope: published, generated_at, players[], value_targets[] |

### Route (src/app/api/price-reset/route.ts)

GET handler reading three Blob/local artifacts concurrently:
- `price_baseline.json` — `Record<string, number>` baseline costs
- `fpl_bootstrap.json` — current player costs and team names
- `merged_players.json` — xPts_1gw per player (optional — errors degrade gracefully)

Key behaviours:
- **D-08**: baseline or bootstrap absent → `published: false`, HTTP 200 (no 404)
- **D-07**: all deltas zero → `published: false`
- Players sorted descending by `Math.abs(delta_cost)`
- Value Targets: fall-only (`delta_cost < 0`), `xPts_1gw` strictly above position median, sorted ascending by `delta_cost` (most negative first)
- `satisfies PriceResetResponse` used on all return paths (4 occurrences)
- `readBlobOrLocal` mirrors pre-season-squad pattern exactly

### Hook (src/lib/hooks/usePriceReset.ts)

```typescript
export function usePriceReset() {
  return useQuery<PriceResetResponse>({
    queryKey: ['price-reset'],       // confirmed
    queryFn: ...,
    staleTime: 30 * 60 * 1000,       // confirmed — mirrors usePriceChanges
  })
}
```

### Tests (src/app/api/price-reset/route.test.ts)

6/6 tests GREEN:

| # | Test Name | D-rule covered |
|---|-----------|----------------|
| 1 | `published_false_when_baseline_absent` | D-08 fallback |
| 2 | `published_false_when_all_deltas_zero` | D-07 diff detection |
| 3 | `published_true_with_sorted_deltas` | D-07, shape validation |
| 4 | `value_targets_filters_fall_above_position_median` | D-05 position median |
| 5 | `value_targets_sorted_by_largest_fall_first` | UI-SPEC sort order |
| 6 | `malformed_merged_players_does_not_break_route` | Graceful degradation |

D-07 and D-08 are exercised by Tests 1, 2, and 3 as specified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] merged_players read error propagated to outer catch returning 500**
- **Found during:** Task 2 GREEN phase (test 6 failed)
- **Issue:** `readBlobOrLocal('merged_players.json')` wrapped in `Promise.all` — a non-ENOENT error (e.g. network error, malformed read) re-threw and hit the outer catch block, returning HTTP 500
- **Fix:** Changed to `readBlobOrLocal('merged_players.json').catch(() => null)` so merged_players errors always degrade gracefully to `value_targets: []`
- **Files modified:** `src/app/api/price-reset/route.ts`
- **Commit:** 439c009

**2. [Rule 1 - Bug] Unused makeRequest() and NextRequest import in test file**
- **Found during:** ESLint check after Task 2
- **Issue:** `makeRequest()` helper created for NextRequest construction was not needed (GET() takes no arguments); resulted in lint warnings
- **Fix:** Removed `makeRequest()` function and `NextRequest` import; simplified test comments
- **Files modified:** `src/app/api/price-reset/route.test.ts`
- **Commit:** 439c009

## TDD Gate Compliance

- RED gate: `test(133-02)` commit `dd7f2f8` — 6 tests failing at module-resolution stage
- GREEN gate: `feat(133-02)` commit `439c009` — 6/6 tests passing
- No REFACTOR commit required (code was clean post-GREEN)

## Known Stubs

None — all fields are computed from real data sources.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new_network_endpoint | src/app/api/price-reset/route.ts | New unauthenticated GET endpoint reading Blob artifacts; no auth required by design (read-only aggregated public FPL data) |

## Self-Check

Files exist:
- src/app/api/price-reset/route.ts: FOUND
- src/app/api/price-reset/route.test.ts: FOUND
- src/lib/hooks/usePriceReset.ts: FOUND
- src/lib/types.ts (modified): FOUND

Commits exist:
- dd7f2f8: FOUND (test RED)
- 439c009: FOUND (feat GREEN)

Test result: 6/6 PASSED

## Self-Check: PASSED
