---
phase: 99-top-10k-comparison
plan: 01
subsystem: api
tags: [api-route, fpl-upstream, gw-review, dream-team, vitest, types, tdd]

# Dependency graph
requires:
  - phase: 98-post-gw-review-core
    provides: "GwReview interface, /api/gw-review route, route.test.ts with mockUpstream + node-env Vitest pattern"
provides:
  - "GwReview interface extended with benchmark_score, benchmark_label, missed_players (required fields)"
  - "/api/gw-review GET handler fetches dream-team/{gw}/ in standalone try/catch with graceful degradation"
  - "Extended mockUpstream(picks, elements, dreamTeam?, dreamTeamOk?) with backward-compatible defaults"
  - "FPLDreamTeamPick / FPLDreamTeamResponse local interfaces in route.ts"
  - "4 PGW-03 unit tests covering dream-team success, 503 failure, sort+cap, and bench-ownership rules"
affects: [99-02-plan, gw-review-tab, useGwReview]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Standalone try/catch for optional upstream fetch — dream-team failure degrades to FPL average without aborting route"
    - "useDreamTeamBenchmark boolean flag controls success vs fallback branch"
    - "new Set(picks.map(p => p.element)) cross-references all 15 picks (starters + bench) for missed-player computation"
    - "dreamTeamPayload() test helper factory mirrors starter()/bench() style for constructing FPL dream-team fixtures"
    - "mockUpstream default dreamTeam={team:[]} → empty-team triggers degraded fallback transparently for Phase 98 tests"

key-files:
  created: []
  modified:
    - src/lib/types.ts
    - src/app/api/gw-review/route.ts
    - src/app/api/gw-review/route.test.ts

key-decisions:
  - "Standalone try/catch (not Promise.all) for dream-team fetch so any failure degrades independently without aborting the route"
  - "useDreamTeamBenchmark flag set only when dtRes.ok AND dtJson.team.length > 0 — guards against empty-team success responses"
  - "User-Agent bumped to fplx/1.17 on dream-team fetch to align with phase version"
  - "mockUpstream default dreamTeam payload has empty team array — triggers degraded fallback, making Phase 98 tests transparent to the new parameter"

patterns-established:
  - "Degraded fallback pattern: standalone try/catch sets boolean flag; downstream branch reads flag to choose benchmark_label"
  - "All-15-picks ownership check: Set built from full picks array (not just starters) ensures bench ownership is counted"

requirements-completed: [PGW-03]

# Metrics
duration: 2min
completed: 2026-05-12
---

# Phase 99 Plan 01: Top-10k Comparison — Backend Summary

**dream-team/{gw}/ standalone fetch + benchmark/missed computation added to /api/gw-review; GwReview type extended with 3 required fields; 7 route tests all GREEN (3 Phase 98 + 4 Phase 99 PGW-03)**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-12T11:24:41Z
- **Completed:** 2026-05-12T11:27:01Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 3

## Accomplishments

- Extended GwReview interface in src/lib/types.ts with three required fields: `benchmark_score`, `benchmark_label`, `missed_players`
- Added `FPLDreamTeamPick` and `FPLDreamTeamResponse` local interfaces to route.ts
- Implemented standalone dream-team fetch (Step 4) in GET handler with `useDreamTeamBenchmark` degradation flag
- Dream-team success path: `benchmark_label='Dream team'`, `benchmark_score=sum(team[*].points)`, `missed_players` sorted desc by pts, capped at 3, cross-referenced against all 15 picks (starters + bench)
- Dream-team failure path (non-ok, empty team, thrown): `benchmark_label='FPL average'`, `benchmark_score=averageScore`, `missed_players=[]`
- Extended `mockUpstream` with backward-compatible `dreamTeam?` and `dreamTeamOk?` optional params (defaults preserve Phase 98 test behavior)
- Added `dreamTeamPayload()` helper factory and Phase 99 PGW-03 describe block with 4 unit tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend GwReview type + extend mockUpstream + add PGW-03 RED test cases** - `e5292e2` (test)
2. **Task 2: Implement dream-team fetch + benchmark/missed computation (GREEN)** - `cfb1216` (feat)

_TDD plan: test(RED) → feat(GREEN) pattern used._

## Files Created/Modified

- `src/lib/types.ts` - GwReview interface extended with `benchmark_score: number`, `benchmark_label: string`, `missed_players: { name: string; pts: number }[]`
- `src/app/api/gw-review/route.ts` - FPLDreamTeamPick/FPLDreamTeamResponse interfaces; Step 4 dream-team fetch block; benchmark+missed computation block; three new fields in review literal; Step 4 comment renumbered to Step 5
- `src/app/api/gw-review/route.test.ts` - Extended mockUpstream signature with dreamTeam/dreamTeamOk optional params; dreamTeamPayload() helper; Phase 99 PGW-03 describe block with 4 tests

## Decisions Made

- **Standalone try/catch (not Promise.all):** Dream-team fetch is wrapped in an isolated try/catch block so any upstream failure (network error, 503, malformed JSON) sets `useDreamTeamBenchmark=false` and the route returns 200 with the degraded fallback. This satisfies T-99-02 (DoS threat) and avoids converting dream-team failures into 502s on the entire route.
- **useDreamTeamBenchmark guard:** Flag is only set `true` when `dtRes.ok && Array.isArray(dtJson?.team) && dtJson.team.length > 0`. This implements T-99-01 mitigation (Tampering) — the runtime shape check pairs with the TypeScript assertion.
- **User-Agent fplx/1.17:** Phase-aligned User-Agent used for the new dream-team fetch (existing picks/bootstrap fetches retain fplx/1.11).
- **mockUpstream backward compatibility:** Default `dreamTeam={ top_player: { id: 999, points: 0 }, team: [] }` with `dreamTeamOk=true` means the existing 3 Phase 98 tests hit the dream-team branch and receive an empty-team response, which triggers `dtJson.team.length > 0` to fail → degraded fallback. Phase 98 tests don't assert on benchmark fields, so this is transparent.
- **Average score fallback value 55:** The mocked `fs/promises.readFile` returns `{ gw: 34, average_score: 55 }` — confirmed by the Phase 98 test at line 13 of route.test.ts.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. The `grep -c "Promise.all"` acceptance criterion technically returns 1 (the comment on line 152 mentions `Promise.all` as a pattern to avoid), but `grep -c "Promise.all\s*("` returns 0 confirming there is no actual `Promise.all(` call in the implementation.

## User Setup Required

None — no external service configuration required. The dream-team endpoint is a public FPL API; no credentials needed.

## Next Phase Readiness

- `GwReview` type now carries `benchmark_score`, `benchmark_label`, and `missed_players` on every 200 response — Plan 02 (React component) can rely on these fields existing
- All 7 route tests pass; Phase 98 contract fully preserved
- The mocked `average_score=55` is the established test fixture value for the fallback path

---
*Phase: 99-top-10k-comparison*
*Completed: 2026-05-12*
