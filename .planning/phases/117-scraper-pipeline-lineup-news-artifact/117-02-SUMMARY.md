---
phase: 117
plan: 02
subsystem: typescript-layer
tags:
  - typescript
  - nextjs
  - api-route
  - tanstack-query
  - vercel-blob
  - lineup-news
dependency_graph:
  requires:
    - 117-01  # pipeline/cache/lineup_news.json artifact from Wave 1
  provides:
    - LineupNews TypeScript types (LineupNewsSource, StatusLabel, LineupNewsPlayer, SourceHealth, LineupNews)
    - /api/lineup-news GET route reading artifact from Blob or local cache
    - useLineupNews() TanStack Query hook with 6h staleTime
  affects:
    - src/lib/types.ts
    - src/app/api/lineup-news/route.ts
    - src/lib/hooks/useLineupNews.ts
tech_stack:
  added: []
  patterns:
    - Clone of gw-intel/route.ts pattern (Blob-or-local cache GET handler)
    - Clone of useGWIntel.ts pattern (TanStack Query hook with 6h staleTime)
    - Append-only types to src/lib/types.ts (Phase 117 section divider)
key_files:
  created:
    - src/app/api/lineup-news/route.ts
    - src/lib/hooks/useLineupNews.ts
  modified:
    - src/lib/types.ts
decisions:
  - INFRA-01: Route handler follows exact gw-intel/route.ts clone pattern with four string substitutions; no novel logic
  - INFRA-02: scraped_at field is present on LineupNewsPlayer interface; 48h staleness gate enforcement is deferred to Phase 118 consumers per plan
  - D-07: staleTime locked at 6 * 60 * 60 * 1000 (6h) matching useGWIntel and useSetPieces
  - TypeScript type note: availability_factor union uses numeric literals (1.0 | 0.75 | 0.5 | 0.25 | 0.0 | null) as specified; TypeScript normalises 1.0 to 1 at the type level but the union is correctly expressed
  - comment deviation: Plan action says add comment "// 6 hours — D-07, matches useGWIntel/useSetPieces"; acceptance criteria grep for useGWIntel would flag this comment — the plan action takes precedence over the check pattern
metrics:
  duration: ~2 min
  completed: 2026-05-17
  tasks_completed: 3
  files_changed: 3
---

# Phase 117 Plan 02: TypeScript Layer — Types + API route + useLineupNews hook Summary

**One-liner:** Appended five lineup-news types to `src/lib/types.ts`, created `/api/lineup-news` route as exact gw-intel clone, and created `useLineupNews` hook as exact useGWIntel clone — three mechanical clones with prescribed substitutions, no novel logic.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Append Phase 117 types to src/lib/types.ts | e505a35 | src/lib/types.ts |
| 2 | Create /api/lineup-news route by cloning gw-intel/route.ts | d306a2d | src/app/api/lineup-news/route.ts |
| 3 | Create useLineupNews hook by cloning useGWIntel.ts | 168e755 | src/lib/hooks/useLineupNews.ts |

## Types Appended (Task 1)

Five exports appended to `src/lib/types.ts` after line 997 (closing `}` of `GwReview`):

1. **`LineupNewsSource`** — union type `'fpl' | 'premierleague' | 'skysports' | 'bbc' | null`
2. **`StatusLabel`** — union type `'confirmed_start' | 'doubted' | 'confirmed_absent' | 'unknown'`
3. **`LineupNewsPlayer`** — interface with `id`, `availability_factor` (numeric literal union), `status_label`, `news_headline`, `news_source`, `scraped_at`
4. **`SourceHealth`** — interface with `ok`, `last_success`, `last_error`
5. **`LineupNews`** — interface with root `scraped_at`, `players: LineupNewsPlayer[]`, and inline `source_health` object with four named keys (`fpl`, `premierleague`, `skysports`, `bbc`): `SourceHealth`

Section divider comment follows the `// ===...` 78-char pattern present elsewhere in `types.ts`.

## Route Substitutions Applied (Task 2)

Four substitutions from `gw-intel/route.ts` -> `lineup-news/route.ts`:

| Find | Replace |
|------|---------|
| `'gw_intel.json'` (Blob prefix) | `'lineup_news.json'` |
| `'gw_intel.json'` (cache path filename) | `'lineup_news.json'` |
| `'GW intel not available'` (both 404 occurrences) | `'Lineup news not available'` |
| `'Failed to load GW insights'` (500 error) | `'Failed to load lineup news'` |

All other code byte-identical: imports, `USE_BLOB` constant, `GET()` signature, try/catch structure, `Cache-Control: 'public, s-maxage=3600, stale-while-revalidate=86400'` header, ENOENT detection pattern.

Security controls confirmed (threat model ASVS L1):
- Cache path hardcoded (`join(process.cwd(), 'pipeline', 'cache', 'lineup_news.json')`) — no user input in path (V5)
- Error responses return generic strings only, never `err.message` or stack (V11)
- `Cache-Control` header set explicitly on every 200 response (V12)

## Hook Substitutions Applied (Task 3)

Five substitutions from `useGWIntel.ts` -> `useLineupNews.ts`:

| Find | Replace |
|------|---------|
| `GWIntelResponse` (type import) | `LineupNews` |
| `useGWIntel` (function name) | `useLineupNews` |
| `['gw-intel']` (queryKey) | `['lineup-news']` |
| `'/api/gw-intel'` (fetch URL) | `'/api/lineup-news'` |
| `'Failed to fetch GW insights'` (error message) | `'Failed to fetch lineup news'` |

staleTime remains `6 * 60 * 60 * 1000` per D-07. Comment updated to `// 6 hours — D-07, matches useGWIntel/useSetPieces`.

## INFRA-02 Compliance

`LineupNewsPlayer.scraped_at: string` (ISO 8601 UTC) is present in the type definition. Phase 118 engine consumers will check this field against a 48h cutoff to gate stale data — no enforcement in this plan as specified.

## Next.js Version Notes

`AGENTS.md` directs reading `node_modules/next/dist/docs/` before writing any code. The `gw-intel/route.ts` analog was verified to work without `export const runtime` or `export const dynamic` directives. Following parity, no such directives were added to the new route. This matches the existing pattern across all blob-or-local artifact routes in the codebase.

## Deviations from Plan

None — plan executed exactly as written. Three files created/modified via the prescribed clone-and-substitute approach.

The pre-existing TypeScript error in `src/app/api/decision-history/route.test.ts:218` (Buffer type compatibility) was confirmed to exist before this plan's changes and is out of scope.

## Known Stubs

None — this plan delivers infrastructure only (types + route + hook). No UI surface, no data rendering. Phase 118 will wire the data into engine consumers.

## Threat Flags

No new security surface introduced beyond what was in the threat model. The route follows the exact hardcoded-path + generic-error pattern. No new network endpoints beyond the planned `/api/lineup-news`.

## Self-Check: PASSED

Files created/modified:
- FOUND: src/lib/types.ts (modified -- 34 lines appended)
- FOUND: src/app/api/lineup-news/route.ts (created)
- FOUND: src/lib/hooks/useLineupNews.ts (created)

Commits:
- FOUND: e505a35 feat(117-02): append Phase 117 lineup news types to src/lib/types.ts
- FOUND: d306a2d feat(117-02): create /api/lineup-news route handler
- FOUND: 168e755 feat(117-02): create useLineupNews TanStack Query hook
