---
phase: "080"
plan: "02"
subsystem: frontend
tags: [frontend, types, api, hook, badge, react-query, typescript, gw-intel]
dependency_graph:
  requires:
    - phase: "080-01"
      provides: [pipeline/gw_intel.py compute_gw_intel() schema, rotation_risk field in merged_players.json]
  provides:
    - src/lib/types.ts GWInsight discriminated union (4 variants) + GWIntelResponse + TableStakesLabel + rotation_risk on MergedPlayer
    - src/app/api/gw-intel/route.ts GET endpoint serving gw_intel.json via blob or local cache
    - src/lib/hooks/useGWIntel.ts React Query hook typed as GWIntelResponse
    - src/components/shared/RotationRiskBadge.tsx warning-token pill component
    - src/components/shared/RotationRiskBadge.test.tsx 4 passing unit tests
  affects: [080-03 (InsightsTab GW intel section), 080-04 (SetPieceTakerPanel + TransferPanel badge integration)]
tech-stack:
  added: []
  patterns:
    - "Discriminated union on type field: GWInsight = PositionOpportunityCard | RotationRiskCard | DGWBGWCard | FixtureRunCard"
    - "API route mirrors insights/route.ts exactly (USE_BLOB flag, blob list+fetch, readFile fallback, Cache-Control header)"
    - "React Query hook mirrors useInsights.ts (queryKey string array, 6h staleTime, typed response)"
    - "Single-variant badge: no BADGE_MAP, no config object — if/null gate is sufficient"
key-files:
  created:
    - src/app/api/gw-intel/route.ts
    - src/lib/hooks/useGWIntel.ts
    - src/components/shared/RotationRiskBadge.tsx
    - src/components/shared/RotationRiskBadge.test.tsx
  modified:
    - src/lib/types.ts
key-decisions:
  - "GWInsight discriminated union keyed on 'type' field — TypeScript narrows correctly with card.type === 'fixture_run'"
  - "rotation_risk?: boolean is optional (?) — pipeline may not have run when frontend deploys; UI defaults to false"
  - "RotationRiskBadge has no BADGE_MAP — single visual variant does not warrant config object"
  - "TableStakesLabel is a string literal union of exactly 4 values matching pipeline taxonomy"
  - "GWIntelResponse wraps { cards, team_stakes, generated_at } matching compute_gw_intel() Python dict exactly"
patterns-established:
  - "New JSON cache API route: copy insights/route.ts, swap prefix string + error messages only"
  - "New React Query hook: copy useInsights.ts, swap type + queryKey + URL"
  - "Warning-token badge (bg-warning/10 text-warning border-warning/30): established pattern for GW-context risk signals"
requirements-completed: [GWI-01, GWI-02, GWI-05]
duration: ~10min
completed: "2026-05-08"
---

# Phase 080 Plan 02: Types/API/Hook/Badge (GWI-01/GWI-02/GWI-05) Summary

**GWInsight TypeScript discriminated union + /api/gw-intel route + useGWIntel hook + RotationRiskBadge warning-token pill — all Plan 03/04 compile dependencies resolved**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-05-08
- **Tasks:** 3/3
- **Files modified:** 5 (1 modified, 4 created)

## Accomplishments

- Added `GWInsight` discriminated union (4 card variants) + `GWIntelResponse` wrapper + `TableStakesLabel` union to `src/lib/types.ts`
- Added `rotation_risk?: boolean` to `MergedPlayer` interface (GWI-01 D-04)
- Created `/api/gw-intel` GET route mirroring `/api/insights` pattern (blob + local cache)
- Created `useGWIntel()` React Query hook (queryKey `['gw-intel']`, 6h staleTime, typed as `GWIntelResponse`)
- Created `RotationRiskBadge` warning-token pill component with 4 passing unit tests

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add GWInsight types + rotation_risk field | bce36ae | src/lib/types.ts |
| 2 | Create gw-intel API route + useGWIntel hook | e8bd05a | src/app/api/gw-intel/route.ts, src/lib/hooks/useGWIntel.ts |
| 3 | Create RotationRiskBadge component + tests | 9995ee0 | src/components/shared/RotationRiskBadge.tsx, src/components/shared/RotationRiskBadge.test.tsx |

## TypeScript Exports Added

From `src/lib/types.ts`:
- `type TableStakesLabel` — `'title battle' | 'European chase' | 'relegation battle' | 'nothing-to-play-for'`
- `interface PositionOpportunityCard` — `{ type: 'position_opportunity', id, gw_label, position, narrative }`
- `interface RotationRiskCard` — `{ type: 'rotation_risk', id, gw_label, team_id, team_short_name, competition, table_stakes_label }`
- `interface DGWBGWCard` — `{ type: 'dgw_bgw', id, gw_label, team_id, team_short_name, is_dgw }`
- `interface FixtureRunCard` — `{ type: 'fixture_run', id, gw_label, player_id, web_name, narrative, gw_xpts, gw_numbers, is_dgw }`
- `type GWInsight` — discriminated union of the 4 card interfaces above
- `interface GWIntelResponse` — `{ cards: GWInsight[], team_stakes: [...], generated_at: string }`
- `rotation_risk?: boolean` added to `MergedPlayer` interface

From `src/components/shared/RotationRiskBadge.tsx`:
- `function RotationRiskBadge({ rotationRisk: boolean })` — renders warning pill or null

From `src/lib/hooks/useGWIntel.ts`:
- `function useGWIntel()` — React Query hook typed as `GWIntelResponse`

## Test Results

- `src/components/shared/RotationRiskBadge.test.tsx`: **4/4 tests pass**
  - renders label + icon when `rotationRisk=true`
  - applies warning token classes (`bg-warning/10 text-warning border-warning/30`)
  - icon span has `aria-hidden="true"`
  - returns null when `rotationRisk=false`
- Full pipeline: `npx tsc --noEmit` exits 0 (no TypeScript errors)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all exports are fully implemented. `RotationRiskBadge` renders real data-driven output (not placeholders). API route serves real cache file.

## Threat Flags

New endpoint `/api/gw-intel` (GET, read-only). Already covered by plan's threat model:
- T-080-08: Information Disclosure — accept (public FPL data, no PII, matches /api/insights model)
- T-080-09: Tampering — mitigate (JSON.parse in try/catch, 500 with generic error, no stack trace leak)
- T-080-12: Path traversal — accept (static hardcoded path, no user input)
- T-080-13: Cache poisoning — mitigate (`if (!res.ok)` guard returns 502)

No new threat surface beyond plan's threat model.

## Next Phase Readiness

Plan 03 unblocked:
- `useGWIntel` importable from `src/lib/hooks/useGWIntel`
- `GWInsight`, `GWIntelResponse` exportable from `src/lib/types`
- `RotationRiskBadge` importable from `src/components/shared/RotationRiskBadge`
- `/api/gw-intel` ready to serve once `pipeline/cache/gw_intel.json` exists (written by Plan 01 pipeline run)

Plan 04 unblocked:
- `RotationRiskBadge` + `MergedPlayer.rotation_risk` field both available

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/lib/types.ts modified | FOUND |
| src/app/api/gw-intel/route.ts created | FOUND |
| src/lib/hooks/useGWIntel.ts created | FOUND |
| src/components/shared/RotationRiskBadge.tsx created | FOUND |
| src/components/shared/RotationRiskBadge.test.tsx created | FOUND |
| commit bce36ae (Task 1) | FOUND |
| commit e8bd05a (Task 2) | FOUND |
| commit 9995ee0 (Task 3) | FOUND |
| 4/4 RotationRiskBadge tests pass | PASS |
| tsc --noEmit exits 0 | PASS |
