---
phase: 128-pre-season-auto-activation
plan: "03"
subsystem: api
tags: [nextjs, typescript, route-handler, pre-season, types, vercel-blob]

requires:
  - phase: 128-pre-season-auto-activation
    provides: PreSeasonSquadResponse type and readBlobOrLocal pattern from pre-season-squad/route.ts

provides:
  - PreSeasonActiveResponse TypeScript interface exported from src/lib/types.ts
  - GET /api/pre-season-active route handler returning 404/200/500 per AUTO-03 contract

affects:
  - 128-04 (usePreSeasonActive hook and NextSeasonPlannerTab UI consume this type and endpoint)

tech-stack:
  added: []
  patterns:
    - readBlobOrLocal helper copied verbatim from pre-season-squad/route.ts (Blob/local dual-path read)
    - Response.json() per Next.js 16 convention (not NextResponse.json())
    - 5-minute CDN cache (s-maxage=300, stale-while-revalidate=60) for activation-state endpoints

key-files:
  created:
    - src/app/api/pre-season-active/route.ts
  modified:
    - src/lib/types.ts

key-decisions:
  - "Cache-Control uses s-maxage=300 (not 3600s) — activation state can flip during pre-season window; shorter TTL reduces stale Awaiting display"
  - "readBlobOrLocal helper copied verbatim (not extracted/shared) — mirrors pre-season-squad pattern; two independent routes, no shared module coupling"
  - "Response.json() used throughout — matches Next.js 16.2.1 project convention; NextResponse.json() explicitly avoided"

patterns-established:
  - "Pre-season artifact API: GET-only, readBlobOrLocal, 404 when absent, 200 with typed payload, 500 on error"

requirements-completed: [AUTO-03]

duration: 8min
completed: 2026-05-20
---

# Phase 128 Plan 03: Pre-Season Active Type and API Route Summary

**`PreSeasonActiveResponse` TypeScript interface plus `/api/pre-season-active` GET route reading `pre_season_active.json` via the project's Blob/local dual-path pattern, returning 404/200/500 per the AUTO-03 contract**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-20T06:58:00Z
- **Completed:** 2026-05-20T07:06:24Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `PreSeasonActiveResponse` interface to `src/lib/types.ts` immediately after `PreSeasonSquadResponse` (D-08 data contract); two fields `activated_at: string` and `season_id: string`
- Created `src/app/api/pre-season-active/route.ts` — GET-only handler with verbatim `readBlobOrLocal` helper from pre-season-squad route; returns 404 when absent, 200 with typed payload and 5-min CDN cache, 500 on unexpected errors
- All acceptance criteria verified: single export, exact error strings, no `NextResponse` import, `s-maxage=300` only, TypeScript clean (pre-existing unrelated error in decision-history test excluded)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add PreSeasonActiveResponse interface to src/lib/types.ts** - `4752d47` (feat)
2. **Task 2: Create src/app/api/pre-season-active/route.ts** - `09b1693` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/lib/types.ts` — Added `PreSeasonActiveResponse` interface after `PreSeasonSquadResponse` (line 1144)
- `src/app/api/pre-season-active/route.ts` — New GET route handler; 48 lines; mirrors pre-season-squad/route.ts structure

## Decisions Made
- Cache-Control set to `s-maxage=300, stale-while-revalidate=60` (5 min) rather than the 3600s used by pre-season-squad — activation state may change during the pre-season window and users benefit from fresher feedback
- `readBlobOrLocal` copied verbatim per plan instruction (not extracted to a shared module) to maintain independence between routes and match the project's established copy-and-specialise pattern
- `fplx_` localStorage key prefix left to Plan 04 (where the banner implementation lives)

## Deviations from Plan

None - plan executed exactly as written.

The pre-existing TypeScript error in `src/app/api/decision-history/route.test.ts` (Buffer type mismatch in Node 25) is out of scope — it exists before and after this plan's changes and is unrelated to the files modified here.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `PreSeasonActiveResponse` type is available for Plan 04's `usePreSeasonActive()` hook
- `/api/pre-season-active` endpoint is live and returns the documented 404/200/500 contract
- Plan 04 can call `usePreSeasonActive()` and consume the returned `PreSeasonActiveResponse | null`
- No blockers

---
*Phase: 128-pre-season-auto-activation*
*Completed: 2026-05-20*
