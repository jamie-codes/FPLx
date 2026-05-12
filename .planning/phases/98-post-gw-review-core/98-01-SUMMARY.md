---
phase: 98-post-gw-review-core
plan: 01
subsystem: api
tags: [zod-schema, typescript, types, fpl-bootstrap, gw-review]

# Dependency graph
requires:
  - phase: 73-post-gw-review
    provides: "GwReview interface (9 fields), /api/gw-review route, useGwReview hook"
  - phase: 58-rival-captain
    provides: "deadline_time on FPLEvent / FPLEventSchema (Phase 58 D-05)"
provides:
  - "FPLEventSchema with data_checked: z.boolean() as 6th required field"
  - "FPLEvent interface with data_checked: boolean as 6th field"
  - "GwReview interface with best_bench_player_name: string and best_bench_player_pts: number (fields 10-11)"
  - "Stubs in /api/gw-review/route.ts and GwReviewTab.test.tsx to keep TypeScript clean until Plan 02"
affects: [98-02, 98-03, useSettledGws, /api/gw-review, GwReviewTab]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zod schema is source of truth — FPLEventSchema and FPLEvent always kept in parity"
    - "Non-optional contract fields on GwReview — empty-bench fallback handled at API layer not via optional types"
    - "Wave-1 type-only plan unblocks Wave-2 parallel plans (02 and 03)"

key-files:
  created: []
  modified:
    - src/lib/fpl-adapter.ts
    - src/lib/types.ts
    - src/app/api/gw-review/route.ts
    - src/components/squad/GwReviewTab.test.tsx
    - tests/fixtures/bootstrap-static-sample.json

key-decisions:
  - "data_checked treated as required (not optional) in FPLEventSchema — fails closed on malformed FPL response per D-06"
  - "best_bench_player_name and best_bench_player_pts are non-optional on GwReview — empty-bench fallback ('—' / 0) is API layer concern, not type layer"
  - "Stub values added to route.ts and test fixture to maintain TypeScript clean build — Plan 02 replaces with real computation"

patterns-established:
  - "FPL contract field additions: add to Zod schema first, propagate to matching TS interface, update test fixture if needed"

requirements-completed: [PGW-01, PGW-04]

# Metrics
duration: 10min
completed: 2026-05-12
---

# Phase 98 Plan 01: Zod Schema + TypeScript Types Extension Summary

**`data_checked: boolean` added to FPLEventSchema/FPLEvent (settled-GW gate); `best_bench_player_name` + `best_bench_player_pts` added to GwReview interface (11 fields total, all non-optional)**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-12T09:10:00Z
- **Completed:** 2026-05-12T09:20:26Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- `FPLEventSchema` extended with `data_checked: z.boolean()` as 6th required field (Phase 98 D-06 gate for settled GW detection)
- `FPLEvent` interface extended with matching `data_checked: boolean` field, maintaining schema/interface parity
- `GwReview` interface extended with two non-optional bench fields (`best_bench_player_name: string`, `best_bench_player_pts: number`), raising field count from 9 to 11
- All downstream files (route.ts, test fixture) updated to compile cleanly against the new type contracts
- 7 previously-passing fpl-adapter tests kept passing after fixture update

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend FPLEventSchema with data_checked and propagate to FPLEvent interface** - `fa3a4c8` (feat)
2. **Task 2: Extend GwReview interface with best_bench_player_name and best_bench_player_pts** - `cf67d16` (feat)

## Files Created/Modified
- `src/lib/fpl-adapter.ts` - Added `data_checked: z.boolean()` to FPLEventSchema (6 fields now)
- `src/lib/types.ts` - Added `data_checked: boolean` to FPLEvent; added two bench fields to GwReview (11 fields)
- `src/app/api/gw-review/route.ts` - Added stub values for `best_bench_player_name` / `best_bench_player_pts` to satisfy TypeScript (Plan 02 replaces with real computation)
- `src/components/squad/GwReviewTab.test.tsx` - Added bench fields to sampleReview fixture to satisfy TypeScript
- `tests/fixtures/bootstrap-static-sample.json` - Added `data_checked: false` to event object (Rule 1 auto-fix)

## Decisions Made
- `data_checked` is required (not `.optional()`) in FPLEventSchema per D-06 — fails closed if FPL omits the field, which is the intended behaviour
- Both GwReview bench fields are non-optional — the empty-bench fallback (`'—'` / `0`) is explicitly an API route concern, not a type concern (matches RESEARCH.md anti-pattern warning)
- Stub values written to route.ts and test fixture rather than making types optional — keeps the type contract strict and documents the TODO clearly for Plan 02

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test fixture missing `data_checked` field after schema extension**
- **Found during:** Task 1 verification (fpl-adapter tests)
- **Issue:** `tests/fixtures/bootstrap-static-sample.json` event object lacked `data_checked`, causing `parseFPLBootstrap` to return `success: false` in all 7 fixture-dependent tests
- **Fix:** Added `"data_checked": false` to the event object in the fixture
- **Files modified:** `tests/fixtures/bootstrap-static-sample.json`
- **Verification:** All 12 fpl-adapter tests pass after fix
- **Committed in:** `eb00435` (separate fix commit)

**2. [Rule 2 - Missing Critical] Downstream TypeScript errors from non-optional GwReview fields**
- **Found during:** Task 2 verification (tsc --noEmit)
- **Issue:** `/api/gw-review/route.ts` and `GwReviewTab.test.tsx` constructed `GwReview` objects missing the two new required fields, causing TS2739 errors
- **Fix:** Added stub values (`best_bench_player_name: '—'`, `best_bench_player_pts: 0`) to route.ts; added representative values to sampleReview in test; both files are owned by Plan 02 which will replace stubs with real computation
- **Files modified:** `src/app/api/gw-review/route.ts`, `src/components/squad/GwReviewTab.test.tsx`
- **Verification:** `npx tsc --noEmit` produces no errors mentioning GwReview or best_bench
- **Committed in:** `cf67d16` (part of Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both fixes necessary for test correctness and TypeScript build cleanliness. No scope creep — Plan 02 owns the real implementation.

## Issues Encountered
None — type-only plan executed cleanly with two minor downstream-compat fixes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 02 (`/api/gw-review` computation + `GwReviewTab` bench row) can compile against the new types immediately
- Plan 03 (`useSettledGws` hook + auto-surface) can compile against `FPLEvent.data_checked` immediately
- Stub values in route.ts (`best_bench_player_name: '—'`, `best_bench_player_pts: 0`) are clearly marked TODO for Plan 02 replacement

## Self-Check: PASSED

- `src/lib/fpl-adapter.ts` — exists, contains `data_checked:  z.boolean()`
- `src/lib/types.ts` — exists, contains `data_checked: boolean` (FPLEvent) and both bench fields (GwReview)
- Commit `fa3a4c8` — FOUND (Task 1: FPLEventSchema + FPLEvent)
- Commit `cf67d16` — FOUND (Task 2: GwReview extension + downstream stubs)
- Commit `eb00435` — FOUND (Rule 1 fix: test fixture)
- `npx tsc --noEmit` produces no errors mentioning fpl-adapter, FPLEvent, data_checked, GwReview, or best_bench

---
*Phase: 98-post-gw-review-core*
*Completed: 2026-05-12*
