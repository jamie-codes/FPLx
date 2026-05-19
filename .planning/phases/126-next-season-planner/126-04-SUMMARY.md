---
phase: 126-next-season-planner
plan: 04
subsystem: frontend
tags: [typescript, react, ui, tdd, pre-season, next-season-planner]

# Dependency graph
requires:
  - phase: 126-01
    provides: PreSeasonPlayer, PreSeasonSquad types; RED NextSeasonPlannerTab test scaffold
  - phase: 126-03
    provides: usePreSeasonSquad hook, HeatMapRow export from FixtureHeatMap
provides:
  - NextSeasonPlannerTab component (src/components/next-season/NextSeasonPlannerTab.tsx)
  - 'next-season' sub-tab wired in src/app/page.tsx
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Formation grid mirrors ChipSquadView.tsx pattern (position-grouped rows, bench section)
    - ppm as native title-attribute tooltip — no JS tooltip library (matches FixtureHeatMap convention)
    - TDD RED->GREEN: Wave 0 scaffold (Plan 01 Task 2) -> Wave 2 GREEN (this plan Task 1)
    - Deferred fixture data with TODO(GW1-8-FIXTURES) reference (known deferred item per CONTEXT.md)

key-files:
  created:
    - src/components/next-season/NextSeasonPlannerTab.tsx
  modified:
    - src/app/page.tsx
    - src/app/page.test.tsx

key-decisions:
  - "FormationGrid extracted to inner component to cleanly handle data !== undefined narrowing"
  - "HeatMapRow imported but fixture data hard-coded empty (GW1-8-FIXTURES deferred per CONTEXT.md D-12)"
  - "page.test.tsx sub-tab order expectations updated (Rule 1 auto-fix: test was correct, needed to reflect new sub-tab)"
  - "data===null handled separately from data===undefined: null=404 Prices pending, undefined=loading fallback"

patterns-established:
  - "Deferred fixture empty-state: nextSeasonFixtures=[] + TODO(GW1-8-FIXTURES) for future wiring"
  - "Wave 0 RED -> Wave 2 GREEN cycle completed for NextSeasonPlannerTab"

requirements-completed: [NSP-03, NSP-04]

# Metrics
duration: ~15min
completed: 2026-05-19
---

# Phase 126 Plan 04: NextSeasonPlannerTab UI + page.tsx Sub-Tab Registration Summary

**Read-only NextSeasonPlannerTab with formation grid and GW1-8 FDR empty state shipped; 'next-season' sub-tab wired into Plan section SECTIONS array and render switch; Wave 0 RED tests now GREEN**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-19T11:26:00Z
- **Completed:** 2026-05-19T11:40:55Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Created `NextSeasonPlannerTab` component with two sections:
  - **Section A — Pre-Season Squad (NSP-04):** Formation grid with position-grouped XI rows (GK/DEF/MID/FWD), bench section, headline row (Formation + Budget used). States: loading, error, null (Prices pending), populated.
  - **Section B — GW1-8 FDR Heatmap (NSP-03):** Graceful "Fixtures not yet published" empty state for the known GW1-8-FIXTURES deferred condition. HeatMapRow imported and future-ready code path exists; populated branch activates when fixture data arrives.
  - ppm exposed as `title` attribute tooltip on total-points span only (D-06 — not a visible column)
  - Read-only (D-04): no `<button>` elements with onClick mutating squad state
  - All 4 Wave 0 RTL tests (Plan 01 Task 2) now GREEN
- Registered `'next-season'` sub-tab in `src/app/page.tsx`:
  - `SubTab` union extended with `| 'next-season'`
  - Plan SECTIONS subTabs array: `{ id: 'next-season', label: 'Next Season', mobileLabel: 'Pre-Season' }` appended after `'rivals'`
  - Render condition added: `{activeSection === 'plan' && activeSubTab === 'next-season' && <NextSeasonPlannerTab />}`
  - `defaultSubTab: 'planner'` unchanged

## Task Commits

1. **Task 1: NextSeasonPlannerTab component** — `e524167` (feat)
2. **Task 2: Register next-season sub-tab in page.tsx** — `1a69969` (feat)

## Files Created/Modified

- `src/components/next-season/NextSeasonPlannerTab.tsx` — new, 152 lines. Named export `NextSeasonPlannerTab`. Read-only formation grid + FDR heatmap empty state.
- `src/app/page.tsx` — SubTab union extended, Plan SECTIONS entry added, import + render condition added.
- `src/app/page.test.tsx` — sub-tab order expectations updated to include "Next Season" (Rule 1 auto-fix).

## Decisions Made

- `FormationGrid` extracted as inner component to cleanly narrow `data` from `PreSeasonSquad | null | undefined` to `PreSeasonSquad` without TypeScript TS18048 errors
- `HeatMapRow` is imported and the populated branch is future-ready, but `nextSeasonFixtures=[]` is hard-coded per CONTEXT.md D-12 (GW1-8-FIXTURES deferred); the empty-state branch is the expected render path at ship time
- `page.test.tsx` lines 211 and 229 updated to include "Next Season" — both tests checked the Plan sub-tab nav order and were stale after sub-tab addition (Rule 1 auto-fix, not a pre-existing unrelated failure)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] page.test.tsx sub-tab order assertions needed updating**
- **Found during:** Task 2
- **Issue:** Two tests in `page.test.tsx` asserted the exact Plan sub-tab order `['Planner', 'Manual Plan', 'Route Tree', 'Rank Sim', 'Value Gems', 'Rivals']` — these were correct before, but became stale when "Next Season" was added to SECTIONS.
- **Fix:** Updated both assertions to `[..., 'Next Season']`.
- **Files modified:** `src/app/page.test.tsx`
- **Commit:** `1a69969` (included in Task 2 commit)

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| `nextSeasonFixtures: unknown[] = []` | `src/components/next-season/NextSeasonPlannerTab.tsx` | 113 | GW1-8-FIXTURES deferred: FPL does not publish next-season fixtures until late June. The empty-state render is the correct and intended behavior at ship time. HeatMapRow is imported and the populated code path exists for when fixture data arrives. Tracked per CONTEXT.md D-12. |

Note: This stub does NOT prevent NSP-03 from being satisfied. NSP-03 requires the "Fixtures not yet published" empty state renders correctly when no next-season fixture data exists — this is what ships.

## Threat Mitigations Applied

| Threat | Mitigation |
|--------|-----------|
| T-126-04-01 Info Disclosure (tooltip) | `title=\`${p.ppm.toFixed(2)}pts/min (last season)\`` — string interpolation of a Number; React escapes the title attribute |
| T-126-04-02 Tampering (read-only) | No `<button>` elements with onClick; no mutation paths; source assertion confirmed |
| T-126-04-03 Input Validation (typed hook data) | data narrowed via explicit null/undefined/PreSeasonSquad branches; FormationGrid receives typed PreSeasonSquad |
| T-126-04-04 DoS (heatmap render) | Empty-state path at ship time; no 160-cell render occurs until fixture data arrives |

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced in this plan.

## Self-Check

- [x] `src/components/next-season/NextSeasonPlannerTab.tsx` exists
- [x] `src/app/page.tsx` — `grep -c "'next-season'"` returns 3
- [x] `src/app/page.tsx` — `grep -c "NextSeasonPlannerTab"` returns 2
- [x] `npx vitest run src/components/next-season/NextSeasonPlannerTab.test.tsx` — 4/4 passing
- [x] `npx vitest run` — 1466/1500 (34 skipped, 0 failed), 119 test files all passing
- [x] `npx tsc --noEmit` — no new errors (pre-existing: decision-history/route.test.ts TS2345)
- [x] Commits e524167, 1a69969 exist
- [x] `defaultSubTab: 'planner'` unchanged in Plan section

## Self-Check: PASSED

---

*Phase: 126-next-season-planner*
*Completed: 2026-05-19*
