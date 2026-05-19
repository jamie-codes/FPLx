---
phase: 126-next-season-planner
plan: 01
subsystem: testing
tags: [tdd, vitest, pytest, types, typescript, python, pulp, pre-season]

# Dependency graph
requires:
  - phase: 125-summer-window-tracker
    provides: useTransferNews hook pattern, TransferNewsFeed type shape, SubTab registration
provides:
  - PreSeasonPlayer, PreSeasonSquad, SeasonArchiveEntry types in src/lib/types.ts
  - pulp>=2.7.0 in pipeline/requirements.txt (ILP solver dependency)
  - RED test scaffold for buildPreSeasonSquad (src/lib/pre-season-squad.test.ts)
  - RED test scaffold for NextSeasonPlannerTab (src/components/next-season/NextSeasonPlannerTab.test.tsx)
  - RED pytest scaffold for archive_season.py (pipeline/test_archive_season.py)
affects: [126-02, 126-03, 126-04]

# Tech tracking
tech-stack:
  added: [pulp>=2.7.0 (Python ILP solver, declared in requirements.txt)]
  patterns:
    - Wave 0 Nyquist gate — test files created RED before implementation waves
    - makePreSeasonPlayer factory mirrors chip-modes.test.ts pattern
    - vi.mock usePreSeasonSquad hook pattern mirrors OptimiserPanel.test.tsx
    - pytest monkeypatch via unittest.mock.patch, mirrors test_lineup_news.py

key-files:
  created:
    - src/lib/pre-season-squad.test.ts
    - src/components/next-season/NextSeasonPlannerTab.test.tsx
    - pipeline/test_archive_season.py
  modified:
    - pipeline/requirements.txt
    - src/lib/types.ts

key-decisions:
  - "pulp>=2.7.0 placed alphabetically after pandas in requirements.txt (between pandas and python-dotenv)"
  - "PreSeasonPlayer.element_type references existing PositionCode union (not inline 1|2|3|4)"
  - "SeasonArchiveEntry.history uses index signature [k: string]: unknown to preserve FPL fields verbatim"
  - "pytest scaffold uses unittest.mock.patch (not monkeypatch fixture) to match test_lineup_news.py convention"

patterns-established:
  - "Wave 0 RED scaffold: create test files importing non-existent modules; Wave 1 makes them GREEN"
  - "makePreSeasonPlayer factory: minimal fields only, ppm default 0.5, different team per player"
  - "vi.mock pattern for usePreSeasonSquad: module-level mock variable + factory call in vi.mock()"

requirements-completed: [NSP-01, NSP-02, NSP-03, NSP-04]

# Metrics
duration: 25min
completed: 2026-05-19
---

# Phase 126 Plan 01: Next Season Planner Wave 0 Scaffold Summary

**Nyquist gate: pulp dependency declared, PreSeason* TypeScript types published, three RED test scaffolds created (8 vitest + 4 pytest) to enforce Wave 1 contracts before any implementation lands**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-19T10:57:00Z
- **Completed:** 2026-05-19T11:22:57Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Added `pulp>=2.7.0` to `pipeline/requirements.txt` (ILP solver required by `suggest_squad.py` in Wave 1)
- Published `PreSeasonPlayer`, `PreSeasonSquad`, `SeasonArchiveEntry` interfaces to `src/lib/types.ts`; `PreSeasonPlayer.element_type` correctly references `PositionCode` alias
- Created 3 RED test scaffolds: vitest unit tests for `buildPreSeasonSquad` (4 cases), RTL integration tests for `NextSeasonPlannerTab` (4 cases), pytest scaffold for `archive_season.py` (4 cases)

## Task Commits

Each task was committed atomically:

1. **Task 1: Declare pulp dependency and create PreSeason* types** - `575c1d7` (feat)
2. **Task 2: Write RED vitest scaffolds for NSP-02, NSP-03, NSP-04** - `4618e53` (test)
3. **Task 3: Write RED pytest scaffold for NSP-01 archive_season** - `e2dd737` (test)

## Files Created/Modified
- `pipeline/requirements.txt` — Added `pulp>=2.7.0` (alphabetical placement between `pandas` and `python-dotenv`)
- `src/lib/types.ts` — Appended `PreSeasonPlayer`, `PreSeasonSquad`, `SeasonArchiveEntry` interfaces
- `src/lib/pre-season-squad.test.ts` — 4 RED vitest cases covering: 15-player squad at 100m, null on low budget, scoreMap exclusion, team cap enforcement
- `src/components/next-season/NextSeasonPlannerTab.test.tsx` — 4 RED RTL cases covering: null data state, formation grid render, fixture empty state, error state
- `pipeline/test_archive_season.py` — 4 RED pytest cases covering: idempotency, >=50% success path, <50% skip path, non-fatal per-player exception handling

## Decisions Made
- `pulp>=2.7.0` placed between `pandas` and `python-dotenv` to maintain alphabetical grouping in requirements.txt
- `SeasonArchiveEntry.history` array uses `[k: string]: unknown` index signature to preserve verbatim FPL fields without tight coupling to specific fields
- pytest scaffold uses `unittest.mock.patch` rather than monkeypatch fixture, matching `test_lineup_news.py` codebase convention
- `NextSeasonPlannerTab.test.tsx` test 3 (fixtures empty state) renders with a populated squad — the component must show "Fixtures not yet published" when no next-season fixture data is wired in (component defaults to empty fixture state in Wave 0)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Initial `git add/commit` accidentally executed in the main repo directory (`/c/Users/jamie/fplx`) instead of the worktree (`/c/Users/jamie/fplx/.claude/worktrees/agent-af894dac104fbf801`). Caught immediately, reverted via `git reset --hard HEAD~1` on main, and re-applied correctly in the worktree. No data lost.

## Next Phase Readiness
- Wave 1 (Plans 02, 03) can import `PreSeasonPlayer`, `PreSeasonSquad`, `SeasonArchiveEntry` from `@/lib/types` immediately
- `npx vitest run src/lib/pre-season-squad.test.ts` provides a failing target for `buildPreSeasonSquad` implementation
- `npx vitest run src/components/next-season/NextSeasonPlannerTab.test.tsx` provides a failing target for `NextSeasonPlannerTab` component
- `python -m pytest pipeline/test_archive_season.py` provides a failing target for `archive_season.py` implementation
- `pulp` must be installed in the pipeline virtualenv before `suggest_squad.py` can run

---
*Phase: 126-next-season-planner*
*Completed: 2026-05-19*
