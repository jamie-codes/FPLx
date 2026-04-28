---
phase: 31-captaincy-ceiling
plan: 02
subsystem: ui
tags: [react-query, nextjs-route, captaincy, tailwind, vitest, testing-library]

# Dependency graph
requires:
  - phase: 31-01
    provides: pipeline/cache/captain_picks.json with ceiling + eo_adjusted picks

provides:
  - CaptainPick and CaptainPicks TypeScript interfaces in src/lib/types.ts
  - xPts_90th_1gw field on MergedPlayer interface
  - /api/captain-picks route handler with USE_BLOB toggle
  - useCaptainPicks React Query hook (6h staleTime, ['captain-picks'] queryKey)
  - CaptainPicksPanel component (two-card UI per UI-SPEC verbatim)
  - CaptainPicksPanel mounted on Gems tab below GemTable
  - 5 active component tests for CaptainPicksPanel (loading, error, ceiling, EO, same-player note)

affects: [phase-32-team-target, phase-33-insights, gsd-verify-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - API route + hook + panel triad for cache-file-backed UI sections (re-applied from Phase 26 set-pieces)
    - Function-call render pattern for JSX components in .ts test files (render(Component({})) instead of JSX syntax)

key-files:
  created:
    - src/app/api/captain-picks/route.ts
    - src/lib/hooks/useCaptainPicks.ts
    - src/components/captaincy/CaptainPicksPanel.tsx
  modified:
    - src/lib/types.ts
    - src/app/page.tsx
    - tests/lib/captain-picks.test.ts

key-decisions:
  - "D-12: Used existing src/components/captaincy/ directory instead of creating src/components/captain/ — avoids two confusingly-similar dirs"
  - "D-13: Function-call render pattern (render(CaptainPicksPanel({}))) in .ts test files — oxc transform cannot parse JSX in .ts extensions"
  - "UI-SPEC verbatim compliance: all Tailwind tokens, copy strings, em-dash/middle-dot/ellipsis characters locked"

patterns-established:
  - "API route (USE_BLOB toggle) + React Query hook (6h staleTime) + panel component: re-usable triad for pipeline-cache-backed UI"
  - "render(Component({})) in .ts test files to avoid oxc JSX parse error — matches DifferentialBadge test convention"

requirements-completed: [CAP-03, CAP-04]

# Metrics
duration: ~15min
completed: 2026-04-28
---

# Phase 31 Plan 02: Frontend Stack Summary

**Captain picks UI shipped end-to-end: /api/captain-picks route, useCaptainPicks hook, two-card CaptainPicksPanel (Ceiling + EO-Adjusted) mounted on Gems tab with verbatim UI-SPEC Tailwind tokens and locked copy strings**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-28T15:49:00Z
- **Completed:** 2026-04-28T15:51:30Z
- **Tasks:** 6/6 (Task 6 human-verify checkpoint: approved 2026-04-28)
- **Files modified:** 6

## Accomplishments
- TypeScript type contract established: `xPts_90th_1gw` on `MergedPlayer`, plus exported `CaptainPick` and `CaptainPicks` interfaces
- App Router GET handler at `/api/captain-picks` with USE_BLOB env toggle (verbatim clone of set-pieces)
- `useCaptainPicks` hook with `['captain-picks']` queryKey, 6h staleTime, typed `CaptainPicks` response
- `CaptainPicksPanel` with `PickCard` helper: loading/error/null states, grid layout, same-player note, native title tooltips — all UI-SPEC verbatim
- `<CaptainPicksPanel />` mounted in Gems tab fragment below `<GemTable />`; full suite 284 passed, 34 skipped

## Task Commits

Each task was committed atomically:

1. **Task 1: Add xPts_90th_1gw to MergedPlayer + CaptainPick/CaptainPicks interfaces** - `3d26122` (feat)
2. **Task 2: Create API route handler + useCaptainPicks hook** - `ec98954` (feat)
3. **Task 3: Create CaptainPicksPanel component** - `dc44846` (feat)
4. **Task 4: Mount CaptainPicksPanel in page.tsx Gems branch** - `dbc06e9` (feat)
5. **Task 5: Add component tests to captain-picks.test.ts** - `fa80be6` (test)

## Files Created/Modified
- `src/lib/types.ts` — added `xPts_90th_1gw?: number` to MergedPlayer; appended `CaptainPick` and `CaptainPicks` interfaces
- `src/app/api/captain-picks/route.ts` — App Router GET handler; USE_BLOB toggle; serves pipeline/cache/captain_picks.json
- `src/lib/hooks/useCaptainPicks.ts` — React Query hook; queryKey ['captain-picks']; staleTime 6h; fetches /api/captain-picks
- `src/components/captaincy/CaptainPicksPanel.tsx` — PickCard helper + CaptainPicksPanel export; loading/error/data branches; grid-cols-1 sm:grid-cols-2; native tooltips; same-player note
- `src/app/page.tsx` — import added after SetPieceTakerPanel; Gems branch wrapped in fragment with CaptainPicksPanel below GemTable
- `tests/lib/captain-picks.test.ts` — 5 new active component tests (ceiling, EO, same-player, loading, error); 8 it.skip preserved; 1 placeholder preserved

## Decisions Made
- Followed existing `src/components/captaincy/` directory (CaptaincyPanel already there) — avoids creating a confusingly-similar `src/components/captain/` dir
- Used function-call render pattern (`render(CaptainPicksPanel({}))`) instead of JSX in `.ts` test file — consistent with `DifferentialBadge` test convention; oxc transform in Vite 4 does not parse JSX in `.ts` files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced JSX render syntax with function-call pattern in .ts test file**
- **Found during:** Task 5 (component tests)
- **Issue:** The plan's prescribed `render(<CaptainPicksPanel />)` JSX syntax causes oxc parse error in `.ts` files — `Expected > but found /`. The existing codebase uses `render(DifferentialBadge({...}))` function-call pattern in `.ts` test files.
- **Fix:** Replaced all `render(<CaptainPicksPanel />)` calls with `render(CaptainPicksPanel({}))` — identical test behavior, matches codebase convention
- **Files modified:** tests/lib/captain-picks.test.ts
- **Verification:** `npx vitest run tests/lib/captain-picks.test.ts` — 6 passed, 8 skipped; full suite 284 passed
- **Committed in:** fa80be6 (Task 5 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking issue)
**Impact on plan:** Fix necessary for test suite to run. No behavior change — function-call and JSX renders produce identical output. Consistent with existing codebase test convention.

## Issues Encountered
- oxc transform in Vitest 4 / Vite rejects JSX syntax in `.ts` files — resolved by matching existing `DifferentialBadge` test pattern

## Known Stubs
None — all data flows from real pipeline output via /api/captain-picks. No hardcoded or mock data in production code.

## Threat Flags
None — all threat mitigations from plan's threat model applied:
- T-31-07: route returns raw JSON string; malformed JSON throws in hook and shows error state
- T-31-08: path is hard-coded, no user input
- T-31-09: staleTime 6h applied
- T-31-11: all player data rendered via React text nodes (no dangerouslySetInnerHTML)

## Human Verification

**Task 6 (human-verify checkpoint): approved 2026-04-28**

Verified: CaptainPicksPanel renders correctly in Gems tab; Ceiling and EO-Adjusted cards display as per UI-SPEC; loading/error/null states confirmed.

## Next Phase Readiness
- CAP-03 and CAP-04 are fully implemented and human-verified
- Phase 31 complete — ready for `/gsd-verify-work`
- Phase 32 (Team Target List) and Phase 33 (Insights) are unblocked

---
*Phase: 31-captaincy-ceiling*
*Completed: 2026-04-28*
