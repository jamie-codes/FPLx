---
phase: 126-next-season-planner
plan: 03
subsystem: api
tags: [typescript, react-query, api-route, tdd, pre-season, greedy, squad-builder]

# Dependency graph
requires:
  - phase: 126-01
    provides: PreSeasonPlayer, PreSeasonSquad, SeasonArchiveEntry types; RED test scaffold
  - phase: 126-02
    provides: suggest_squad.py ILP pre-compute writes pre_season_squad.json to Blob
provides:
  - buildPreSeasonSquad function in src/lib/pre-season-squad.ts
  - GET /api/pre-season-squad route in src/app/api/pre-season-squad/route.ts
  - usePreSeasonSquad hook in src/lib/hooks/usePreSeasonSquad.ts
  - HeatMapRow and HeatMapRowProps exported from src/components/club-form/FixtureHeatMap.tsx
affects: [126-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - scoreMap.has(p.id) eligibility (no status check) — off-season signal isolation
    - Resolution order: ILP precompute → archive fallback → 404 graceful state
    - 404 → null hook contract (distinguishes archive absent from network error)

key-files:
  created:
    - src/lib/pre-season-squad.ts
    - src/app/api/pre-season-squad/route.ts
    - src/lib/hooks/usePreSeasonSquad.ts
  modified:
    - src/components/club-form/FixtureHeatMap.tsx

key-decisions:
  - "buildPreSeasonSquad eligibility = scoreMap.has(p.id) only; no status === 'a' filter (D-02)"
  - "Route resolution order: pre_season_squad.json first (ILP precompute), then season_archive_gw38.json, then 404"
  - "Archive fallback requires fpl_bootstrap.json for player metadata (web_name/team/now_cost); returns 503 if absent"
  - "usePreSeasonSquad returns null on 404 (not throw) to enable Prices pending graceful state"
  - "HeatMapRow exported in-place from FixtureHeatMap.tsx (D-11: do NOT move to separate file)"

# Metrics
duration: ~3min
completed: 2026-05-19
---

# Phase 126 Plan 03: TypeScript/API Layer (Wave 1) Summary

**buildPreSeasonSquad greedy squad builder, /api/pre-season-squad route, usePreSeasonSquad hook, and HeatMapRow export shipped; Wave 0 RED tests now GREEN**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-19T11:26:58Z
- **Completed:** 2026-05-19T11:29:48Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Implemented `buildPreSeasonSquad(players, scoreMap, budget=1000, teamCap=3)` pure greedy squad builder:
  - Eligibility: `scoreMap.has(p.id)` only — no `status === 'a'` filter (D-02/Pitfall 3)
  - Sort: `scoreMap.get(p.id)` desc; tie-break: cheaper wins
  - Local `MIN_SLOTS`/`MAX_SLOTS` constants (D-07 pattern — no import from chip-modes)
  - Starters derived via greedy two-pass (fill position minimums, then fill to 11)
  - Formation string as `{DEF}-{MID}-{FWD}`; bench: GK first then score desc
  - All 4 Wave 0 RED tests now GREEN
- Created `/api/pre-season-squad` GET route with three-tier resolution:
  1. `pre_season_squad.json` (ILP precompute) — returned directly
  2. `season_archive_gw38.json` + `fpl_bootstrap.json` — computes ppm, excludes <500 min, builds squad via greedy
  3. 404 when neither artifact exists ("Prices pending" trigger, D-03)
  - Wraps JSON.parse in outer try/catch (T-126-03-04 mitigation)
  - Greedy is O(n log n) at request time only (T-126-03-03 — ILP never runs at request time)
- Created `usePreSeasonSquad()` TanStack Query hook:
  - `if (res.status === 404) return null` — distinguishes archive absent from error
  - `staleTime: 6 * 60 * 60 * 1000` (6h — matches pipeline cadence)
- Added `export` to `HeatMapRow` and `HeatMapRowProps` in FixtureHeatMap.tsx (D-11: two tokens only, no structural change)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement buildPreSeasonSquad()** - `387a072` (feat)
2. **Task 2: API route + usePreSeasonSquad hook** - `d37b3dd` (feat)
3. **Task 3: Export HeatMapRow and HeatMapRowProps** - `0ab9601` (feat)

## Files Created/Modified

- `src/lib/pre-season-squad.ts` — pure greedy squad builder (125 lines)
- `src/app/api/pre-season-squad/route.ts` — Blob-backed GET route (140 lines)
- `src/lib/hooks/usePreSeasonSquad.ts` — TanStack Query hook with 404→null contract (17 lines)
- `src/components/club-form/FixtureHeatMap.tsx` — `export` added to HeatMapRowProps and HeatMapRow (+2 tokens)

## Decisions Made

- `buildPreSeasonSquad` uses two-pass greedy for formation derivation: first pass fills MIN_SLOTS per position (3 DEF, 2 MID, 1 FWD), second pass fills remaining slots to 10 outfield starters by score desc
- Route fetches `fpl_bootstrap.json` alongside the archive to populate player metadata; returns 503 if bootstrap unavailable (the squad cannot be built without it)
- The `readBlobOrLocal` helper extracted internally to reduce duplication across the three Blob reads (pre_season_squad.json, season_archive_gw38.json, fpl_bootstrap.json)

## Deviations from Plan

None - plan executed exactly as written.

## Threat Mitigations Applied

| Threat | Mitigation |
|--------|-----------|
| T-126-03-03 DoS (ILP at request time) | Route only calls greedy `buildPreSeasonSquad` — ILP never runs at request time |
| T-126-03-04 Input Validation (archive parse) | `JSON.parse` wrapped in outer try/catch; malformed payload returns 500 |

## Known Stubs

None — all data flows are wired. The route correctly handles absent Blob artifacts with 404/503 sentinel responses.

## Self-Check

- [x] `src/lib/pre-season-squad.ts` exists
- [x] `src/app/api/pre-season-squad/route.ts` exists
- [x] `src/lib/hooks/usePreSeasonSquad.ts` exists
- [x] `grep -c "^export function HeatMapRow" FixtureHeatMap.tsx` = 1
- [x] `grep -c "^export interface HeatMapRowProps" FixtureHeatMap.tsx` = 1
- [x] `npx vitest run src/lib/pre-season-squad.test.ts` — 4/4 passing
- [x] `npx tsc --noEmit` — no new errors (pre-existing: decision-history test, NextSeasonPlannerTab.test.tsx Wave 2 RED)
- [x] Commits 387a072, d37b3dd, 0ab9601 exist

## Self-Check: PASSED

---

*Phase: 126-next-season-planner*
*Completed: 2026-05-19*
