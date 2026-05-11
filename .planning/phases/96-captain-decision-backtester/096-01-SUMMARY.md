---
phase: 96-captain-decision-backtester
plan: "01"
subsystem: testing
tags: [vitest, pytest, typescript, captain, regret, red-tests, tdd]

# Dependency graph
requires:
  - phase: 96-captain-decision-backtester
    provides: Phase context, patterns map, UI spec establishing BACK-01 contracts

provides:
  - CaptainPickSnapshot, RegretEntry, DecisionHistory TypeScript types in src/lib/types.ts
  - RED test scaffolding for regret formula utility (src/lib/regret.test.ts)
  - RED test scaffolding for useDecisionHistory hook (src/lib/hooks/useDecisionHistory.test.ts)
  - RED test scaffolding for BackTab component (src/components/accuracy/BackTab.test.tsx)
  - RED test scaffolding for pipeline captain snapshot side-write (pipeline/tests/test_captain_snapshots.py)

affects:
  - 96-captain-decision-backtester/096-02 (pipeline wave — must turn test_captain_snapshots.py GREEN)
  - 96-captain-decision-backtester/096-03 (TS wave — must turn regret.test.ts + useDecisionHistory.test.ts GREEN)
  - 96-captain-decision-backtester/096-04 (UI wave — must turn BackTab.test.tsx GREEN)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - RED scaffolding pattern — test files import non-existent modules to establish a deterministic acceptance signal
    - localStorage ring-buffer key convention: decisionHistory:teamId:{id}, MAX_GWS=38
    - D-06 regret formula: ceiling_pts*2 - user_capt_pts*2 (signed captain points)

key-files:
  created:
    - src/lib/regret.test.ts
    - src/lib/hooks/useDecisionHistory.test.ts
    - src/components/accuracy/BackTab.test.tsx
    - pipeline/tests/test_captain_snapshots.py
  modified:
    - src/lib/types.ts

key-decisions:
  - "CaptainPickSnapshot = CaptainPicks alias (D-09): reuses existing schema verbatim — no new fields needed"
  - "regret: number | null uses null sentinel (not undefined) for unavailable GWs per plan patterns"
  - "hasSnapshot: boolean in RegretEntry enables D-10 pre-deployment row rendering without data gaps"
  - "DecisionHistory gwsWithData counts only GWs where regret is non-null (both sides available)"

patterns-established:
  - "RED scaffolding: test files committed before implementation files; downstream plan acceptance = turning tests GREEN"
  - "localStorage key decisionHistory:teamId:{id} — team-ID-keyed so switching FPL accounts does not corrupt cache"

requirements-completed:
  - BACK-01

# Metrics
duration: 15min
completed: "2026-05-11"
---

# Phase 96 Plan 01: Wave 1 RED Scaffolding Summary

**Three new TypeScript types (CaptainPickSnapshot / RegretEntry / DecisionHistory) plus 4 RED test files establishing the BACK-01 captain backtester contract for Plans 02-04**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-11T16:30:00Z
- **Completed:** 2026-05-11T16:40:00Z
- **Tasks:** 5
- **Files modified:** 5 (1 modified + 4 created)

## Accomplishments

- Appended CaptainPickSnapshot, RegretEntry, DecisionHistory types to src/lib/types.ts — tsc --noEmit passes with zero new errors on the types file
- Created src/lib/regret.test.ts with 8 cases (6 computeRegret + 2 computeSeasonSummary) — RED at import because ./regret does not exist yet
- Created src/lib/hooks/useDecisionHistory.test.ts with 5 cases covering null guard, non-numeric guard, fetch URL, cache-first hydration, and 38-GW ring buffer trim — RED at import
- Created src/components/accuracy/BackTab.test.tsx with 5 cases covering loading/error/empty copy, regret cell colour, no-snapshot placeholder — RED at import
- Created pipeline/tests/test_captain_snapshots.py with 4 contract tests (USE_BLOB=true, unset, false, idempotent allowOverwrite) — RED at import (ModuleNotFoundError: No module named 'captain_snapshots')
- No regressions in previously-passing tests (pre-existing failures in captain-picks.test.ts, club-form.test.ts, MobileNav.test.tsx are unchanged)

## Task Commits

Each task was committed atomically:

1. **Task 1: CaptainPickSnapshot / RegretEntry / DecisionHistory types** - `9cb6894` (feat)
2. **Task 2: regret.test.ts RED scaffolding** - `0ef16f8` (test)
3. **Task 3: useDecisionHistory.test.ts RED scaffolding** - `76fecc2` (test)
4. **Task 4: BackTab.test.tsx RED scaffolding** - `2766eb7` (test)
5. **Task 5: test_captain_snapshots.py RED scaffolding** - `fb37f64` (test)

## Files Created/Modified

- `src/lib/types.ts` — Added CaptainPickSnapshot (type alias for CaptainPicks), RegretEntry (per-GW timeline entry), DecisionHistory (API response shape)
- `src/lib/regret.test.ts` — 8 test cases (6 computeRegret + 2 computeSeasonSummary); RED at import
- `src/lib/hooks/useDecisionHistory.test.ts` — 5 test cases covering hook guards, fetch URL, cache-first, ring-buffer; RED at import
- `src/components/accuracy/BackTab.test.tsx` — 5 test cases covering UI contract; RED at import
- `pipeline/tests/test_captain_snapshots.py` — 4 pytest contract tests covering Blob upload behaviour; RED at import

## RED Test Counts

| File | Tests | RED Cause |
|------|-------|-----------|
| src/lib/regret.test.ts | 8 | `./regret` module missing (Plan 03 creates it) |
| src/lib/hooks/useDecisionHistory.test.ts | 5 | `./useDecisionHistory` module missing (Plan 03 creates it) |
| src/components/accuracy/BackTab.test.tsx | 5 | `./BackTab` component missing (Plan 04 creates it) |
| pipeline/tests/test_captain_snapshots.py | 4 | `captain_snapshots` module missing (Plan 02 creates it) |
| **Total** | **22** | |

## Decisions Made

- D-06 regret formula encoded as inline JSDoc on RegretEntry.regret: `ceiling_pts*2 − user_capt_pts*2`
- hasSnapshot boolean field added to RegretEntry enables Plan 04 to render "No model snapshot" without null-checking every model field
- gwsWithData on DecisionHistory counts non-null regret entries (both sides must be available), consistent with D-10 pre-deployment row handling
- CaptainPickSnapshot is a type alias (not a new interface) because D-09 specifies verbatim reuse of the existing CaptainPicks schema

## Deviations from Plan

None - plan executed exactly as written. All 5 files created with exact specified content.

## Issues Encountered

One navigational error: first commit accidentally landed on the main branch (`cd /c/Users/jamie/fplx` instead of worktree directory). Immediately reverted with `git revert` on main and re-applied the edit + commit in the correct worktree directory. No lasting impact.

## Known Stubs

None - this is a pure type + RED test plan. No production code was created.

## Threat Flags

None - Wave 1 creates only types and test files. No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries.

## Next Phase Readiness

Plans 02, 03, and 04 are now fully unblocked and can proceed in parallel:
- Plan 02 (pipeline wave): create `pipeline/captain_snapshots.py` with `write_captain_snapshot()` and wire into `run.py` → turns test_captain_snapshots.py GREEN
- Plan 03 (TS wave): create `src/lib/regret.ts` and `src/lib/hooks/useDecisionHistory.ts` → turns regret.test.ts + useDecisionHistory.test.ts GREEN
- Plan 04 (UI wave): create `src/components/accuracy/BackTab.tsx` and restructure AccuracyTab → turns BackTab.test.tsx GREEN

Each downstream plan has a deterministic acceptance signal: the specific failing test files turning GREEN.

---
*Phase: 96-captain-decision-backtester*
*Completed: 2026-05-11*
