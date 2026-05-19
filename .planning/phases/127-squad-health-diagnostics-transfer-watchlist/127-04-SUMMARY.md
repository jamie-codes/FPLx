---
phase: 127
plan: 04
subsystem: integration + page wiring
tags:
  - hooks
  - components
  - page-wiring
  - health-indicator
dependency_graph:
  requires:
    - "127-01: PreSeasonSquadResponse + SquadHealth types + /api/pre-season-squad envelope"
    - "127-02: useWatchlist hook + GemTable star button props"
    - "127-03: WatchlistTab + WatchlistPlayerCard components"
  provides:
    - "src/lib/hooks/usePreSeasonSquad.ts: envelope-typed hook (PreSeasonSquadResponse | null)"
    - "src/components/next-season/NextSeasonPlannerTab.tsx: health indicator + solver badge"
    - "src/app/page.tsx: Watchlist sub-tab wiring + useWatchlist state"
  affects:
    - "Phase 128 auto-activation (reads health.min_feasible_budget_greedy)"
    - "Phase 129 budget slider (extends PreSeasonSquadResponse with inputs)"
tech_stack:
  added: []
  patterns:
    - "Envelope destructure: const squad = data?.squad ?? null pattern"
    - "Inline HealthIndicator subcomponent with three text variants"
    - "Optional solver pill appended to existing headline row"
key_files:
  created: []
  modified:
    - src/lib/hooks/usePreSeasonSquad.ts
    - src/components/next-season/NextSeasonPlannerTab.tsx
    - src/components/next-season/NextSeasonPlannerTab.test.tsx
    - src/app/page.tsx
    - src/app/page.test.tsx
decisions:
  - "HealthIndicator extracted as private subcomponent for cleaner JSX separation"
  - "solver pill appended to existing headline row gap-2 flex container — no layout change needed"
  - "tsc not run after Task 1 (expected to fail until Task 2); Task 2 gate runs tsc cleanly"
  - "page.test.tsx sub-tab order assertions updated as Rule 1 auto-fix (test was correct pre-change)"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-19"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 5
---

# Phase 127 Plan 04: Integration — Envelope Wiring + Watchlist Sub-tab Summary

Plan 04 brings all Wave 2 pieces together: updates `usePreSeasonSquad` to the envelope type, fixes `NextSeasonPlannerTab` to read `data?.squad` and render the health indicator + solver badge, and wires `useWatchlist` + WatchlistTab into `page.tsx` for full watchlist end-to-end functionality.

## What Was Built

**Task 1 — usePreSeasonSquad envelope type update**

Changed `src/lib/hooks/usePreSeasonSquad.ts`:
- Import: `PreSeasonSquad` → `PreSeasonSquadResponse`
- Generic: `useQuery<PreSeasonSquad | null>` → `useQuery<PreSeasonSquadResponse | null>`
- All other lines unchanged (queryKey, queryFn, staleTime)

Grep verification passes; tsc intentionally not run at this stage (NextSeasonPlannerTab update required first per plan design).

**Task 2 — NextSeasonPlannerTab consumer + health indicator + solver badge**

Updated `src/components/next-season/NextSeasonPlannerTab.tsx`:
- Import changed to `PreSeasonPlayer, PreSeasonSquad, SquadHealth` from `@/lib/types`
- `FormationGrid` gains optional `solver?: 'ilp' | 'greedy' | null` prop; headline row appends ILP pill (`bg-green-100`) or Greedy pill (`bg-zinc-100`) conditionally
- `NextSeasonPlannerTab` body: `const squad = data?.squad ?? null; const health = data?.health ?? null; const solver = data?.solver ?? null`
- Conditional branch updated: `data === null || data === undefined || squad === null` covers both 404 and envelope-with-null-squad
- `HealthIndicator` private subcomponent: three variants — 100% feasible, all infeasible (red `text-red-600`), partial with min budget
- Health indicator rendered after `squadSection` inside Section A wrapper, before Section B

Updated `NextSeasonPlannerTab.test.tsx`:
- Existing mocks wrapped in envelope shape `{ squad, health: null, solver: 'ilp' }`
- 5 new tests: ILP pill + no health paragraph; Greedy pill + health with 90%/£83.5m; 100% feasible; No feasible squad (red); null data (404) — no badge/health
- All 9 tests pass; `npx tsc --noEmit` exits with only pre-existing `decision-history/route.test.ts` error

**Task 3 — page.tsx wiring**

Updated `src/app/page.tsx`:
- Imports: `WatchlistTab` from `@/components/watchlist/WatchlistTab`, `useWatchlist` from `@/lib/hooks/useWatchlist`
- `SubTab` union extended with `'watchlist'`
- `SECTIONS` Plan `subTabs` array: `{ id: 'watchlist' as SubTab, label: 'Watchlist', mobileLabel: 'Watchlist' }` after `next-season`
- `const { watchlistIds, toggleWatchlist } = useWatchlist()` called after `planHorizon` state
- `<GemTable ... watchlistIds={watchlistIds} toggleWatchlist={toggleWatchlist} />` props added
- New render block: `{activeSection === 'plan' && activeSubTab === 'watchlist' && (<WatchlistTab watchlistIds={watchlistIds} toggleWatchlist={toggleWatchlist} />)}`

Updated `page.test.tsx`:
- Two sub-tab order assertions updated to include `'Watchlist'` at end of Plan section array
- This is a Rule 1 auto-fix — tests correctly capture the SECTIONS order and needed updating

## Verification

- Task 1: grep chain exits 0 (PreSeasonSquadResponse present, old PreSeasonSquad generic absent)
- Task 2: `npx vitest run src/components/next-season/NextSeasonPlannerTab.test.tsx` — 9/9 pass; `npx tsc --noEmit` — only pre-existing error
- Task 3: `npx tsc --noEmit` — only pre-existing error; `npx vitest run` — 1505/1505 pass (34 skipped); `python -m pytest pipeline/tests/ -x` — 288/288 pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] page.test.tsx sub-tab order assertions failed after Watchlist addition**
- **Found during:** Task 3 verification (full test suite run)
- **Issue:** Two test assertions in `page.test.tsx` hardcoded the Plan sub-tab order ending at `'Next Season'`; adding `'Watchlist'` caused them to fail
- **Fix:** Updated both assertions to include `'Watchlist'` at end, with updated comment referencing Phase 127 WATCH-04
- **Files modified:** `src/app/page.test.tsx`
- **Commit:** 0b7ae12

## Known Stubs

None. All wiring is complete:
- `usePreSeasonSquad` returns the envelope type
- `NextSeasonPlannerTab` reads `data?.squad` (not legacy `data` passthrough)
- `page.tsx` invokes `useWatchlist()` and passes props to GemTable and WatchlistTab
- WatchlistTab renders a live Watchlist sub-tab accessible via Plan section nav

## Threat Flags

T-127-14: `data?.squad` optional chaining returns undefined safely when envelope is null — verified by null-branch test case.
T-127-17: Departed player detection in WatchlistTab (Plan 03) handles spoofed localStorage IDs via set-difference approach.

## Self-Check: PASSED

Files exist:
- FOUND: src/lib/hooks/usePreSeasonSquad.ts
- FOUND: src/components/next-season/NextSeasonPlannerTab.tsx
- FOUND: src/components/next-season/NextSeasonPlannerTab.test.tsx
- FOUND: src/app/page.tsx
- FOUND: src/app/page.test.tsx

Commits exist:
- 54f6909: feat(127-04): update usePreSeasonSquad to PreSeasonSquadResponse envelope type (D-08)
- 8fa27ab: feat(127-04): update NextSeasonPlannerTab to read envelope + add solver badge + health indicator
- 0b7ae12: feat(127-04): wire useWatchlist + Watchlist sub-tab into page.tsx
