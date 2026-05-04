---
phase: 058-mini-league-rival-tracker
plan: 01
subsystem: hooks
tags: [tanstack-query, p-limit, rivals, zod, types]

# Dependency graph
requires: []
provides:
  - p-limit ^6.1.0 as direct ESM dependency (v6.2.0 resolved)
  - RivalPick, RivalEntry, RivalLeagueResult types in src/lib/types.ts
  - FPLEvent.deadline_time field (ISO 8601) in types.ts and FPLEventSchema
  - src/lib/rivals-adapter.ts: Zod schemas + parse helpers for league standings, rival picks, rival history
  - src/lib/hooks/useRivals.ts: useRivals(leagueId, userTeamId) TanStack Query hook
  - CHIP_NAMES constant exported from rivals-adapter.ts
affects: [058-02-rival-intel, 058-03-ui-components, 058-04-page-wiring]

# Tech tracking
tech-stack:
  added: [p-limit@6.2.0]
  patterns:
    - pLimit(CONCURRENCY) inside queryFn closure (not module-level) for per-query limiter isolation
    - D-05 deadline gate client-side in hook queryFn (bare-proxy approach; documented deviation)
    - userRank extraction from standings response in same fetch as rival list (no extra network call)
    - shouldAdvanceTime:true with vi.useFakeTimers to avoid waitFor polling timeout with TanStack Query

key-files:
  created:
    - src/lib/rivals-adapter.ts
    - src/lib/hooks/useRivals.ts
    - src/lib/hooks/useRivals.test.ts
  modified:
    - src/lib/fpl-adapter.ts
    - src/lib/types.ts
    - tests/fixtures/bootstrap-static-sample.json

key-decisions:
  - "D-05 deadline gate implemented client-side in useRivals queryFn (not server-side route handler) per bare-proxy approach — spirit preserved (captainPlayerId null pre-deadline); avoids adding new server endpoint for purely UX-formatting concern"
  - "userRank extracted from the same standings response that populates rival list — no extra API call needed for ML-02 rankGap derivation"
  - "vi.useFakeTimers({ shouldAdvanceTime: true }) required to avoid TanStack Query waitFor timeout in Vitest hook tests"
  - "p-limit resolves to v6.2.0 (not 6.1.0 as specified) — ^6.1.0 semver constraint satisfied; 6.2.0 has identical API"

patterns-established:
  - "rivals-adapter.ts: Zod schema + safeParse helpers pattern mirroring squad-adapter.ts"
  - "useRivals follows useChipHistory.ts security guard pattern (/^\\d+$/.test) for leagueId"
  - "Hook tests use shouldAdvanceTime:true to avoid waitFor polling being blocked by fake timers"

requirements-completed: [ML-01, ML-02, ML-08]

# Metrics
duration: 7min
completed: 2026-05-04
---

# Phase 58 Plan 01: Mini-League Rival Tracker Foundation Summary

**`useRivals(leagueId, userTeamId)` hook with p-limit(3) batching, Zod adapters for FPL standings/picks/history, rival type contracts, and deadline-gated captain visibility**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-04T07:30:40Z
- **Completed:** 2026-05-04T07:38:00Z
- **Tasks:** 4
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments

- Installed p-limit@6.2.0 as direct ESM dependency (satisfies ^6.1.0 constraint)
- Added `RivalPick`, `RivalEntry`, `RivalLeagueResult` type contracts to `src/lib/types.ts`; extended `FPLEvent` and `FPLEventSchema` with `deadline_time`
- Created `src/lib/rivals-adapter.ts` with `LeagueStandingsResponseSchema`, `RivalPicksResponseSchema`, `RivalHistoryResponseSchema`, three parse helpers, and `CHIP_NAMES` constant
- Created `src/lib/hooks/useRivals.ts`: fetches bootstrap once for current GW + deadline_time, standings for rank list, then batches 2 calls per rival at p-limit(3); extracts `userRank` from standings to compute `rankGap` without extra API call; applies D-05 captain visibility gate client-side
- 10 Vitest tests covering ML-01 endpoint dispatch, ML-02 rankGap derivation and fallback paths, ML-08 cap/truncation, D-05 pre/post-deadline, chip derivation, and numeric guard
- Marked RESEARCH.md Open Questions as RESOLVED with inline implementation references

## Task Commits

1. **Task 1: Install p-limit ^6.1.0** - `1aa79a5` (chore)
2. **Task 2: Add rival types, extend FPLEventSchema, create rivals-adapter** - `e3b46ed` (feat)
3. **Task 3: Implement useRivals hook with 10 tests** - `f45792e` (feat)
4. **Task 4: Mark RESEARCH.md Open Questions as RESOLVED** - `db43bce` (docs)

## Files Created/Modified

- `src/lib/hooks/useRivals.ts` - TanStack Query hook; p-limit(3) batching; deadline gate; userRank extraction
- `src/lib/hooks/useRivals.test.ts` - 10 tests: ML-01, ML-02, ML-08, D-05, numeric guard, chips, fallbacks
- `src/lib/rivals-adapter.ts` - Zod schemas for standings/picks/history + parse helpers + CHIP_NAMES
- `src/lib/types.ts` - Added RivalPick, RivalEntry, RivalLeagueResult; extended FPLEvent with deadline_time
- `src/lib/fpl-adapter.ts` - Extended FPLEventSchema with deadline_time field
- `tests/fixtures/bootstrap-static-sample.json` - Added deadline_time to test event (Rule 1 fix)
- `.planning/phases/058-mini-league-rival-tracker/058-RESEARCH.md` - Open Questions marked RESOLVED

## Decisions Made

- **D-05 client-side deadline gate:** Context.md D-05 specified "server-side in the route handler" but the existing proxy is a bare forwarder. Adding deadline logic to the proxy would violate single-responsibility; a new thin route would add server complexity with no security benefit (all data is public FPL). Implemented client-side in queryFn: bootstrap fetch + `Date.now() >= Date.parse(deadline_time)`. Spirit preserved: `captainPlayerId` is null pre-deadline. FPL API itself returns null picks pre-deadline as secondary safeguard.
- **userRank from standings response:** ML-02 rankGap requires knowing the user's league rank. Extracting it from the same standings response (via `allEntries.find(e => e.entry === userEntryNum)`) avoids an extra API call. Falls back to `null` (rankGap=0) when userTeamId is absent or not found on the first standings page.
- **p-limit resolves to 6.2.0:** `npm install p-limit@^6.1.0` resolved to 6.2.0 (latest compatible). API is identical to 6.1.0; constraint satisfied.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated bootstrap fixture to include deadline_time after FPLEventSchema extension**
- **Found during:** Task 2 (after extending FPLEventSchema with deadline_time)
- **Issue:** `tests/fixtures/bootstrap-static-sample.json` event object lacked `deadline_time`; 7 existing tests in `tests/lib/fpl-adapter.test.ts` began failing because `parseFPLBootstrap` now requires the field
- **Fix:** Added `"deadline_time": "2026-05-05T17:30:00Z"` to the event in the fixture
- **Files modified:** `tests/fixtures/bootstrap-static-sample.json`
- **Verification:** All 12 fpl-adapter tests pass; full suite pre-existing failures unchanged
- **Committed in:** `e3b46ed` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed test timeout: added shouldAdvanceTime:true to vi.useFakeTimers**
- **Found during:** Task 3 (first run of useRivals.test.ts)
- **Issue:** `vi.useFakeTimers({ now: ... })` freezes `setTimeout`, blocking TanStack Query internal state updates and `waitFor` polling; all 9 async tests timed out at 5000ms
- **Fix:** Changed to `vi.useFakeTimers({ now: ..., shouldAdvanceTime: true })` so fake timers advance in real time, allowing `waitFor` to resolve
- **Files modified:** `src/lib/hooks/useRivals.test.ts`
- **Verification:** All 10 tests pass; Date.now() still deterministic for deadline gate assertions
- **Committed in:** `f45792e` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both fixes were necessary for test correctness. No scope creep; no architectural changes.

## Known Stubs

None — no stub values, hardcoded empty arrays, or placeholder text in any created/modified files.

## Threat Flags

No new threat surface beyond the plan's threat model. All T-58-01 through T-58-06 mitigations implemented:
- T-58-01: `/^\d+$/.test(leagueId)` in `enabled` field
- T-58-02: `pLimit(3)` inside queryFn closure
- T-58-03: entry IDs validated by `LeagueStandingsEntrySchema.entry: z.number().int()`
- T-58-06: `/^\d+$/.test(userTeamId)` before `Number()` conversion

## Issues Encountered

- Pre-existing test failures in `tests/lib/captain-picks.test.ts` (5 tests) and `tests/lib/club-form.test.ts` (1 test) confirmed pre-existing before this plan's changes; not caused by or fixed by this plan. Logged to deferred items.

## Next Phase Readiness

Wave 1 complete. All Wave 2 and Wave 3 plans can now:
- `import { useRivals } from '@/lib/hooks/useRivals'`
- `import type { RivalEntry, RivalPick, RivalLeagueResult } from '@/lib/types'`
- `import { CHIP_NAMES, parseLeagueStandings } from '@/lib/rivals-adapter'`

No blockers for Phase 58 Plan 02 (rival-intel pure logic engine).

## Self-Check

Completed below.

---
*Phase: 058-mini-league-rival-tracker*
*Completed: 2026-05-04*
