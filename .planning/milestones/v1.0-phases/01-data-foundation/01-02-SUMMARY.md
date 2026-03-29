---
phase: 01-data-foundation
plan: "02"
subsystem: api
tags: [zod, fpl-api, validation, proxy, route-handler, typescript]

# Dependency graph
requires:
  - phase: 01-data-foundation/01-01
    provides: TypeScript interfaces (FPLElement, FPLTeam, FPLEvent, FPLBootstrap) and test fixtures
provides:
  - Zod schema adapter (FPLElementSchema, FPLBootstrapSchema) that validates FPL API responses at ingestion boundary
  - parseFPLBootstrap function returning structured success/failure (never throws uncontrolled)
  - Catch-all FPL proxy route at /api/fpl/[...proxy] for CORS-free browser-side FPL calls
  - 12 passing unit tests covering all PPS requirements (PPS-01, PPS-02, PPS-04)
affects:
  - All phases that fetch FPL API data via /api/fpl/ proxy
  - All phases that ingest bootstrap-static data through parseFPLBootstrap
  - Pipeline phases that need validated FPLBootstrap type

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zod safeParse pattern: always return { success, data } or { success, error } — never throw at validation boundary"
    - "Catch-all Next.js route handler: src/app/api/fpl/[...proxy]/route.ts proxies any FPL API path"
    - "params is a Promise in Next.js 16 route handlers — must be awaited"

key-files:
  created:
    - src/lib/fpl-adapter.ts
    - src/app/api/fpl/[...proxy]/route.ts
  modified:
    - tests/lib/fpl-adapter.test.ts

key-decisions:
  - "Zod strips unknown fields by default (no explicit .strip() needed in Zod 4) — satisfies D-04"
  - "parseFPLBootstrap wraps FPLBootstrapSchema.safeParse — callers decide throw-vs-stale-cache (D-06)"
  - "Proxy URL pattern appends trailing slash: FPL_BASE/path/ — matches FPL API convention"

patterns-established:
  - "Adapter pattern: all FPL API responses pass through parseFPLBootstrap before use"
  - "Proxy pattern: browser never calls FPL API directly — always /api/fpl/[path]"

requirements-completed: [PPS-01, PPS-02, PPS-04]

# Metrics
duration: 4min
completed: 2026-03-27
---

# Phase 1 Plan 02: FPL Zod Adapter and Proxy Route Summary

**Zod schema adapter validating FPL bootstrap-static at ingestion boundary, plus catch-all server-side proxy route eliminating CORS for all FPL API calls**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-27T18:58:06Z
- **Completed:** 2026-03-27T19:01:23Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Zod adapter (`fpl-adapter.ts`) validates all consumed FPL fields including set piece order fields (PPS-01), strips unknown fields (D-04), returns structured result (D-06)
- 12 unit tests covering all PPS requirements: nullable defensive contributions, set piece taker orders, integer minutes/starts, all 6 status codes, news string
- FPL catch-all proxy at `/api/fpl/[...proxy]` forwards any FPL API path server-side with query string forwarding, upstream error handling (4xx/5xx), and network failure handling (502)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Add failing tests for Zod adapter** - `7d5a6b2` (test)
2. **Task 1 GREEN: Implement Zod adapter** - `6e7731b` (feat)
3. **Task 2: Create FPL catch-all proxy route handler** - `437863c` (feat)

_Note: TDD task has two commits (test RED → feat GREEN)_

## Files Created/Modified

- `src/lib/fpl-adapter.ts` - Zod schemas (FPLElementSchema, FPLTeamSchema, FPLEventSchema, FPLBootstrapSchema) and parseFPLBootstrap function
- `src/app/api/fpl/[...proxy]/route.ts` - Catch-all Next.js route handler for server-side FPL API proxying
- `tests/lib/fpl-adapter.test.ts` - 12 unit tests replacing all it.todo stubs with real assertions

## Decisions Made

- Zod 4 strips unknown fields by default (verified with node -e test) — no explicit configuration needed
- Proxy URL appends trailing slash before query string to match FPL API URL convention
- parseFPLBootstrap is a thin wrapper returning safeParse result — caller decides whether to throw or serve stale cache

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- FPL adapter is ready for all bootstrap-static ingestion in subsequent pipeline phases
- Proxy route is ready for any FPL API path (`/api/fpl/bootstrap-static`, `/api/fpl/fixtures?event=38`, etc.)
- No blockers for Phase 1 Plan 03

---
*Phase: 01-data-foundation*
*Completed: 2026-03-27*

## Self-Check: PASSED

- FOUND: src/lib/fpl-adapter.ts
- FOUND: src/app/api/fpl/[...proxy]/route.ts
- FOUND: tests/lib/fpl-adapter.test.ts
- FOUND: .planning/phases/01-data-foundation/01-02-SUMMARY.md
- FOUND commit 7d5a6b2: test(01-02): add failing tests for FPL Zod adapter
- FOUND commit 6e7731b: feat(01-02): implement Zod adapter for FPL bootstrap-static
- FOUND commit 437863c: feat(01-02): create FPL catch-all proxy route handler
