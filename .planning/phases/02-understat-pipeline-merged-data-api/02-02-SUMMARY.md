---
phase: 02-understat-pipeline-merged-data-api
plan: 02
subsystem: api
tags: [typescript, nextjs, vercel-blob, route-handler, types]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: FPLElement, FPLTeam, FPLEvent, PlayerIdMapEntry, PipelineMetadata interfaces and PositionCode/PlayerStatus types
provides:
  - MergedPlayer TypeScript interface (src/lib/types.ts)
  - FixtureEntry TypeScript interface (src/lib/types.ts)
  - DifficultyTier type (src/lib/types.ts)
  - GET /api/players Route Handler serving merged_players.json from Blob or local cache
affects:
  - 02-03-usePlayers-hook
  - 03-gem-scoring
  - 04-fixture-analysis
  - 05-defcon-analysis
  - 06-value-ownership

# Tech tracking
tech-stack:
  added: ["@vercel/blob (list API for production blob reads)"]
  patterns: ["USE_BLOB env var routing (prod=Blob, dev=local cache)", "Raw string response to avoid JSON round-trip", "Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400"]

key-files:
  created:
    - src/app/api/players/route.ts
  modified:
    - src/lib/types.ts

key-decisions:
  - "D-08: USE_BLOB env var routes between Vercel Blob (prod) and pipeline/cache/ (dev) — consistent with pipeline/upload.py pattern"
  - "D-08: No Zod validation on output — pipeline is the trust boundary, not the route handler"
  - "D-08: Return raw string (not parsed+re-serialized) to avoid unnecessary JSON round-trip"
  - "D-08: Cache-Control stale-while-revalidate=86400 allows edge to serve stale data while revalidating"

patterns-established:
  - "Route Handler pattern: async GET() with try/catch, USE_BLOB routing, raw Response for non-JSON-parseable data"
  - "Types pattern: append new interfaces after PipelineMetadata; do not modify existing interfaces"

requirements-completed: [GEM-03, FFA-01, FFA-02]

# Metrics
duration: 2min
completed: 2026-03-28
---

# Phase 2 Plan 02: Merged Data API Summary

**MergedPlayer/FixtureEntry TypeScript interfaces and /api/players Route Handler serving merged_players.json via Vercel Blob (prod) or local cache (dev) with CDN caching headers**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-28T11:34:22Z
- **Completed:** 2026-03-28T11:35:42Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added MergedPlayer interface with all FPL core fields, Understat xg/xa_per90 (nullable), form metrics, and fixtures array
- Added FixtureEntry interface with opponent_team, is_home, event_id, difficulty_score, difficulty_tier fields
- Added DifficultyTier type ('easy' | 'medium' | 'hard') for fixture visualization
- Created GET /api/players Route Handler with USE_BLOB routing, proper caching headers, error handling

## Task Commits

1. **Task 1: Add MergedPlayer and FixtureEntry interfaces to types.ts** - `062d019` (feat)
2. **Task 2: Create /api/players Route Handler (D-08)** - `f6cad93` (feat)

## Files Created/Modified
- `src/lib/types.ts` - Appended DifficultyTier, FixtureEntry, and MergedPlayer interfaces after existing PipelineMetadata
- `src/app/api/players/route.ts` - GET Route Handler: USE_BLOB routing, Vercel Blob list() for prod, readFile for dev, Cache-Control headers

## Decisions Made
- D-08 implemented: USE_BLOB env var routes to Blob (prod) or pipeline/cache/merged_players.json (dev) — mirrors pipeline/upload.py pattern
- No Zod validation on route output — pipeline is the trust boundary, avoiding double-parse overhead
- Raw string response (not parsed+re-serialized) preserves exact pipeline output

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. @vercel/blob was listed in package.json but not yet installed in the worktree; ran `npm install` which resolved it (package was listed as a dependency, not a new addition).

## Known Stubs

None - route reads from actual data sources (Blob or filesystem). No hardcoded empty values.

## Next Phase Readiness
- MergedPlayer and FixtureEntry types are stable and ready for Plan 03 (usePlayers hook) to consume
- /api/players route is production-ready pending pipeline (Plan 01) writing merged_players.json to Blob
- Plans 03-06 can reference MergedPlayer for all type-safe data access

---
*Phase: 02-understat-pipeline-merged-data-api*
*Completed: 2026-03-28*
