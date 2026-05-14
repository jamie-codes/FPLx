---
phase: 110-gw-review-history-fixes-v1-20
plan: 03
subsystem: api
tags: [bugfix, decision-history, element-summary, regret, fpl-api, tdd, promise-allsettled, deduplication]

# Dependency graph
requires:
  - phase: 96-captain-decision-backtester
    provides: "decision-history/route.ts with CR-01 deferral (hardcoded null for modelCeilingPts); computeRegret in regret.ts; CaptainPickSnapshot type"
provides:
  - "FIX-06: decision-history/route.ts Step 2b — deduplicated element-summary fan-out with Promise.allSettled, populating actualPtsMap"
  - "FIX-06: modelCeilingPts now derives from actualPtsMap.get(modelCeilingId)?.get(gw) ?? null instead of hardcoded null"
  - "src/app/api/decision-history/route.test.ts — new test file (Wave 0 gap) with 4 FIX-06 TDD tests covering happy path, SC-5 503 fallback, dedup invariant, ENOENT snapshot skip"
affects: [113-transfer-regret-backtester, back-tab, decision-history, regret]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Promise.allSettled fan-out over unique ceiling IDs — individual fetch failure does not abort the others; same pattern as FIX-03/04 standalone try/catch SC-5 approach but for a set of optional fetches"
    - "Deduplication via Set<number> before fan-out — ceiling player repeated across N GWs = 1 element-summary fetch not N"
    - "Two-level Map (Map<elementId, Map<gwRound, actualPts>>) for O(1) lookup per GW in Step 3"

key-files:
  created:
    - src/app/api/decision-history/route.test.ts
  modified:
    - src/app/api/decision-history/route.ts

key-decisions:
  - "Promise.allSettled (not Promise.all) for element-summary fan-out — per CONTEXT.md D-10 and RESEARCH.md Anti-Pattern: Promise.all converts single fetch failure into route-level 502"
  - "Inline Step 2b block (not a named helper) — the block is ~25 lines, within the discretion threshold from CONTEXT.md; co-located with usage for readability"
  - "Each async map fn wrapped in its own try/catch returning null — explicit null on fetch errors keeps result narrowing predictable alongside Promise.allSettled"
  - "Test 2 asserts that element-summary/306/ was attempted exactly once even on 503 failure — this is what makes the test fail against hardcoded-null code (0 calls vs expected 1)"

patterns-established:
  - "FIX-06 Step 2b dedup pattern: Set<number> → Promise.allSettled → Map<id, Map<round, pts>> — reusable for any per-player season-history fan-out"
  - "TDD RED: test SC-5 degradation by asserting the attempt was made (call count=1), not just the null outcome — prevents tests passing vacuously against hardcoded-null code"

requirements-completed: [FIX-06]

# Metrics
duration: 25min
completed: 2026-05-14
---

# Phase 110 Plan 03: Decision History FIX-06 Summary

**FIX-06 resolved: decision-history/route.ts Step 2b deduped element-summary fan-out via Promise.allSettled populates actualPtsMap so modelCeilingPts carries real regret values instead of hardcoded null**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-14T21:30:00Z
- **Completed:** 2026-05-14T21:55:00Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 2

## Accomplishments

- Created `src/app/api/decision-history/route.test.ts` (Wave 0 gap) with 4 FIX-06 TDD tests covering: happy path (modelCeilingPts=14, regret=16), SC-5 503 fallback (graceful null with call attempt assertion), dedup invariant (Salah as ceiling in GW35+GW36 = 1 element-summary call), ENOENT snapshot skip (gw36 no snapshot → entries[1].hasSnapshot=false, count=1)
- Added Step 2b to `decision-history/route.ts` between Step 2 and Step 3: collects unique non-null ceiling IDs from snapshots, fans out element-summary fetches via Promise.allSettled, builds `actualPtsMap: Map<number, Map<number, number>>`
- Replaced CR-01 hardcoded `const modelCeilingPts: number | null = null` at line 137 with `actualPtsMap.get(modelCeilingId)?.get(gw) ?? null`, resolving the Phase 96 deferral

## Task Commits

1. **Task 1: RED — create decision-history/route.test.ts with FIX-06 failing tests** - `e861aa3` (test)
2. **Task 2: GREEN — add Step 2b element-summary fan-out and rewire modelCeilingPts** - `1dbf0a3` (feat)

## Files Created/Modified

- `src/app/api/decision-history/route.test.ts` — New file (Wave 0 gap). Node-environment vitest suite, vi.mock fs/promises, vi.stubGlobal fetch mockUpstream helper. 4 tests: happy path, SC-5, dedup, ENOENT skip. All 4 fail (RED) before implementation, all 4 pass (GREEN) after.
- `src/app/api/decision-history/route.ts` — Step 2b inserted at lines 124-160 (before Step 3 at line 162). CR-01 hardcoded null at line 137 replaced with actualPtsMap lookup at line 174-175. Step 2b uses Promise.allSettled (not Promise.all). The existing Promise.all at lines 119-122 for readSnapshot/readGwPicks is unchanged (those helpers already return null on error).

## TDD Gate Compliance

- RED gate: `e861aa3` — `test(110-03): add failing FIX-06 tests...` (4 failing, 0 passing)
- GREEN gate: `1dbf0a3` — `feat(110-03): implement FIX-06 element-summary fan-out...` (4 passing, 0 failing)
- REFACTOR gate: not needed (implementation is clean at ~25 lines, within discretion threshold)

## Dedup Proof (from Test 3 and Test 4)

- **Test 3:** Two finished GWs (35, 36), both with `ceiling.id=306` (Salah). After GET /api/decision-history: `fetchMock.mock.calls.filter(url.includes('/element-summary/306/')).length === 1`. `entries[0].modelCeilingPts=14` and `entries[1].modelCeilingPts=18` both populated from the single response.
- **Test 4:** GW35 has snapshot (ceiling.id=306); GW36 throws ENOENT. After GET: `elementSummaryCalls.length === 1` (only for 306 from gw35). `entries[0].modelCeilingPts=14`; `entries[1].modelCeilingPts=null`, `entries[1].hasSnapshot=false`.

## Promise.allSettled Confirmation

Step 2b uses `await Promise.allSettled([...uniqueCeilingIds].map(async (id) => { ... }))`. The existing `Promise.all` at lines 119-122 is retained (for readSnapshot/readGwPicks which already return null on error). The new fan-out correctly uses `Promise.allSettled` — individual element-summary 503 or throw does not abort the others (SC-5 compliance).

## Test Results

- `src/app/api/decision-history/route.test.ts`: 4 passed (all FIX-06 tests green)
- `src/app/api/gw-review/route.test.ts`: 7 passed (no regression)
- Full suite: 25 pre-existing failures (captain-picks.test.ts 5 from Phase 57, MobileNav.test.tsx, useRivals.test.ts, club-form.test.ts) — all unrelated to this plan; 0 new failures introduced.

## Decisions Made

- Promise.allSettled (not Promise.all) for element-summary fan-out — individual failures must not abort the others (CONTEXT.md D-10, RESEARCH.md Anti-Pattern)
- Inline Step 2b block not a named helper — co-located with usage, within ~25 line discretion threshold from CONTEXT.md
- Each async map fn has its own try/catch returning null — keeps result narrowing predictable alongside Promise.allSettled
- Test 2 SC-5 assertion: asserts element-summary call count=1 even on 503 failure (not just null outcome) — prevents test passing vacuously against hardcoded-null code which makes 0 calls

## Deviations from Plan

None - plan executed exactly as written. Step 2b code shape matches PATTERNS.md. Tests match PATTERNS.md mockUpstream helper structure. All acceptance criteria met.

## Issues Encountered

- Vitest exclude pattern `.claude/**` in `vitest.config.ts` meant tests could not be run from the main repo directory. Resolution: run vitest binary directly from the worktree root (`/c/Users/jamie/fplx/node_modules/.bin/vitest run <path>` executed with cwd=worktree). This is the established pattern for worktree-based execution.
- First test file version used `await import('fs/promises')` inside `beforeEach` (not async context at top level) causing parse error. Resolution: removed beforeEach override, used `vi.mock` at file level (sufficient for most tests) and per-test `vi.mocked(await import(...))` for Test 4 where ENOENT behavior needed to differ.

## Known Stubs

None. The fix is complete end-to-end: element-summary is fetched, actualPtsMap is built, modelCeilingPts is populated, computeRegret produces real values. The captain delta column in the Back tab will show actual regret values for GWs with captain_picks_gw{N}.json snapshots (GW35+).

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes beyond those in the plan's threat_model. The element-summary URL construction uses server-trusted numeric IDs from snapshot files (not user input) — T-110-03-01 mitigated as designed.

## Next Phase Readiness

- FIX-06 resolved. The captain delta column in BackTab renders real regret values for GW35+ (snapshot boundary).
- Manual UAT deferred to /gsd-uat-phase: hit /api/decision-history?teamId={real_team_id} with curl, confirm entries[].regret is non-null for GWs with captain_picks_gw{N}.json in pipeline/cache.
- Phase 113 (BACK-02 Transfer Regret Backtester) may use the same element-summary dedup pattern for hindsight scoring.

## Self-Check: PASSED

- FOUND: `src/app/api/decision-history/route.test.ts`
- FOUND: `src/app/api/decision-history/route.ts`
- FOUND: `.planning/phases/110-gw-review-history-fixes-v1-20/110-03-SUMMARY.md`
- FOUND: commit `e861aa3` (test RED)
- FOUND: commit `1dbf0a3` (feat GREEN)
- `Promise.allSettled` in code: 1 occurrence (line 136) + 1 in comment
- `element-summary/${id}/`: FOUND (line 139)
- `actualPtsMap.get(modelCeilingId)`: FOUND (line 175)
- CR-01 hardcoded null: REMOVED (correct)

---
*Phase: 110-gw-review-history-fixes-v1-20*
*Completed: 2026-05-14*
