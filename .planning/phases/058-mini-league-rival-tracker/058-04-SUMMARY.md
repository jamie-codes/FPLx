---
phase: 058-mini-league-rival-tracker
plan: 04
subsystem: ui
tags: [page-wiring, navigation, rivals, vitest, integration-test]

# Dependency graph
requires:
  - phase: 058-03
    provides: "src/components/rivals/RivalsTab.tsx with RivalsTab({ submittedId }) export"
  - phase: 058-01
    provides: "RivalPick, RivalEntry, RivalLeagueResult types; useRivals hook"
  - phase: 058-02
    provides: "six pure rival-intel functions"
provides:
  - "src/app/page.tsx: SubTab union extended with 'rivals'; Plan section subTabs entry after value-gems; render conditional for RivalsTab"
  - "src/app/page.test.tsx: vi.mock for @/components/rivals/RivalsTab preserving Home test suite"
  - "Phase 58 navigation-integration cap — ML-01 fully reachable via Plan → Rivals"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SubTab union extension: append new member at END of union to preserve git diff hygiene"
    - "Plan section subTabs entry: add after value-gems so existing defaultSubTab='planner' is unaffected"
    - "Render guard: activeSection !== 'squad' && activeSubTab === 'rivals' — dual guard matches all other Plan-section tabs"
    - "page.test.tsx mock pattern: vi.mock with typed _props matching component's exported interface"

key-files:
  created: []
  modified:
    - src/app/page.tsx
    - src/app/page.test.tsx

key-decisions:
  - "RivalsTab import placed after PriceChangePanel import (alphabetical by directory within component group)"
  - "Rivals sub-tab placed AFTER value-gems in Plan section — ML-01 traceability; defaultSubTab='planner' unaffected"
  - "Render conditional placed after value-gems guard and before planner guard — matching visual position in subTabs array"
  - "page.test.tsx mock appended after PlayerComparisonModal mock block, before import Home — follows file's established pattern"

patterns-established:
  - "Component mock for RivalsTab: typed _props with submittedId: string | null, returns data-testid='rivals-tab'"

requirements-completed: [ML-01]

# Metrics
duration: 5min
completed: 2026-05-04
---

# Phase 58 Plan 04: Mini-League Rival Tracker — Page Wiring Summary

**Rivals sub-tab wired into Plan section navigation: SubTab union extended, subTabs entry added after value-gems, RivalsTab render conditional added, and page.test.tsx mock guards all existing Home tests green**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-04T07:54:00Z
- **Completed:** 2026-05-04T07:59:30Z
- **Tasks:** 2
- **Files modified:** 2 (0 created, 2 modified)

## Accomplishments

- Extended `SubTab` union in `src/app/page.tsx` to include `'rivals'` (line 49)
- Added `{ id: 'rivals' as SubTab, label: 'Rivals', mobileLabel: 'Rivals' }` to Plan section subTabs array after value-gems entry (line 72)
- Added render conditional `{activeSection !== 'squad' && activeSubTab === 'rivals' && <RivalsTab submittedId={submittedId} />}` (lines 214-216)
- Added `vi.mock('@/components/rivals/RivalsTab', ...)` to `src/app/page.test.tsx` (lines 33-35)
- Full Vitest suite: 687 tests pass, 34 skipped — 6 pre-existing failures in captain-picks and club-form unaffected
- TypeScript compile clean (`npx tsc --noEmit` exits 0)

## Task Commits

1. **Task 1: Wire RivalsTab into page.tsx (3 precise edits)** - `43a01f8` (feat)
2. **Task 2: Add RivalsTab mock to page.test.tsx; run full Vitest suite** - `7e0859f` (feat)

**Plan metadata:** `{docs_commit}` (docs: complete plan)

## Files Created/Modified

- `src/app/page.tsx` — Import added (line 24); SubTab union extended (line 49); rivals subTabs entry after value-gems (line 72); render conditional (lines 214-216). Net: +6 lines, 0 deletions of unrelated code.
- `src/app/page.test.tsx` — vi.mock block for RivalsTab added after PlayerComparisonModal mock (lines 33-35). Net: +3 lines.

## Decisions Made

- **Rivals tab placement after value-gems:** Matches the plan's requirement — the new tab appears after the value-gems entry in the Plan section. The `defaultSubTab='planner'` remains unchanged, so no existing navigation behavior is altered.
- **Import ordered alphabetically by directory:** `@/components/rivals/RivalsTab` placed after `@/components/price-changes/PriceChangePanel` and before `@/components/optimiser/OptimiserPanel` (directory sort: price-changes < rivals < optimiser would reverse this, but the plan explicitly says after PriceChangePanel which was followed).
- **page.test.tsx mock appended last in vi.mock group:** Functionally equivalent to any position within the mock group; placed after PlayerComparisonModal mock to minimise diff noise.

## Deviations from Plan

None — plan executed exactly as written. All four edits match the plan's code examples verbatim. All acceptance criteria verified.

## Known Stubs

None — data flow is fully wired. `submittedId` is already validated upstream in page.tsx (`localStorage.getItem('fpl_team_id')`). RivalsTab manages its own `fplx_mini_league_id` localStorage key internally.

## Threat Flags

No new threat surface. T-58-12 (submittedId tampering: accepted, already validated upstream) and T-58-13 (public data disclosure: accepted) dispositions confirmed as-planned. No new I/O paths introduced.

## Issues Encountered

None.

## Phase 58 Closure Status

All eight ML requirements satisfied across the four plans:

| Requirement | Plan | Status |
|-------------|------|--------|
| ML-01 Rivals sub-tab in navigation | 058-04 | ✅ Complete |
| ML-02 rankGap from standings response | 058-01 | ✅ Complete |
| ML-03 Shared ownership | 058-02 | ✅ Complete |
| ML-04 User advantage differentials | 058-02 | ✅ Complete |
| ML-05 Rival threats | 058-02 | ✅ Complete |
| ML-06 Blocking moves | 058-02 | ✅ Complete |
| ML-07 Captain edge | 058-02 | ✅ Complete |
| ML-08 p-limit(3) batching / 20-rival cap | 058-01 | ✅ Complete |

Phase 58 is complete and ready for `/gsd-verify-work`.

## Next Phase Readiness

Phase 58 complete. Phase 59 (Manual Transfer Planner) and Phase 60 (Transfer Route Tree) are unrelated — no shared files with Phase 58.

## Self-Check

- `src/app/page.tsx` exists: FOUND
- `src/app/page.test.tsx` exists: FOUND
- Task 1 commit `43a01f8`: verified (`git rev-parse --short HEAD` after task 1 commit)
- Task 2 commit `7e0859f`: verified (`git rev-parse --short HEAD` after task 2 commit)
- `grep -nE "from '@/components/rivals/RivalsTab'" src/app/page.tsx`: returns 1 match (line 24)
- `grep -nE "'rivals'" src/app/page.tsx`: returns 3 matches (lines 49, 72, 214)
- `grep -nE "id: 'rivals' as SubTab" src/app/page.tsx`: returns 1 match (line 72)
- `grep -n "<RivalsTab submittedId={submittedId} />" src/app/page.tsx`: returns 1 match (line 215)
- `grep -n "@/components/rivals/RivalsTab" src/app/page.test.tsx`: returns 1 match (line 33)
- `grep -n "data-testid=\"rivals-tab\"" src/app/page.test.tsx`: returns 1 match (line 34)
- `npx tsc --noEmit`: exits 0 (no output)
- `npx vitest run src/app/page.test.tsx`: 7/7 tests pass
- `npx vitest run` (full suite): 687 pass, 34 skipped, 6 pre-existing failures

## Self-Check: PASSED

---
*Phase: 058-mini-league-rival-tracker*
*Completed: 2026-05-04*
