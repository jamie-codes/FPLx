---
phase: 129-squad-cost-simulator
plan: 04
subsystem: component
tags:
  - infeasibility
  - amber-track
  - phase-129
  - next-season-planner
  - COST-03
dependency_graph:
  requires:
    - "src/components/next-season/NextSeasonPlannerTab.tsx (Wave 2 slider + useDeferredValue pipeline)"
    - "src/lib/types.ts (SquadHealth.min_feasible_budget_greedy)"
    - "src/components/next-season/NextSeasonPlannerTab.test.tsx (Wave 0 RED infeasibility/gradient tests)"
  provides:
    - "trackBackground useMemo: linear-gradient from health.min_feasible_budget_greedy when non-null, #71717a fallback when null"
    - "Infeasibility paragraph with D-08 (variant A with suggestion) and D-09 (variant B no suffix)"
    - "inputs-refetch reset useEffect keyed on data?.inputs identity"
  affects:
    - "NextSeasonPlannerTab.tsx — COST-03 fully implemented; Phase 129 feature complete"
tech_stack:
  added: []
  patterns:
    - "useMemo on health?.min_feasible_budget_greedy for amber gradient (does not recompute per slider tick)"
    - "useEffect keyed on data?.inputs identity for refetch-safety reset of lastValidSquad/hasCommitted"
    - "Linear-gradient CSS inline style for dynamic amber/zinc slider track"
key_files:
  created: []
  modified:
    - src/components/next-season/NextSeasonPlannerTab.tsx
    - src/components/next-season/NextSeasonPlannerTab.test.tsx
decisions:
  - "D-11 test updated to accept jsdom-normalised rgb(113,113,122) as equivalent of #71717a — jsdom normalises plain hex colours to rgb() in style.background but not gradient strings; test intent preserved"
  - "trackBackground memo dependency is health?.min_feasible_budget_greedy — not sliderValue — so visual updates don't recompute per tick"
  - "Infeasibility paragraph uses != null (loose) to match both null and undefined per D-08/D-09"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-20"
  tasks_completed: 1
  tasks_total: 1
  files_created: 0
  files_modified: 2
---

# Phase 129 Plan 04: Infeasibility Paragraph + Amber Gradient + Refetch Reset (Wave 3) Summary

**One-liner:** Completed COST-03 by wiring trackBackground useMemo (amber gradient / zinc fallback) onto the slider, adding the infeasibility paragraph (D-08/D-09 copy variants with em-dash), and a refetch-reset useEffect keyed on data.inputs identity.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add trackBackground memo, dynamic slider style, infeasibility paragraph, and inputs-refetch reset effect | ee6f99c | src/components/next-season/NextSeasonPlannerTab.tsx, NextSeasonPlannerTab.test.tsx |

## Interface Signatures

### trackBackground useMemo

```typescript
const trackBackground = useMemo<string>(() => {
  const minFeasible = health?.min_feasible_budget_greedy
  if (minFeasible === null || minFeasible === undefined) return '#71717a'
  const threshold = ((minFeasible - 80) / 40) * 100
  return `linear-gradient(to right, #f59e0b 0%, #f59e0b ${threshold}%, #71717a ${threshold}%, #71717a 100%)`
}, [health?.min_feasible_budget_greedy])
```

Memo dependency: `health?.min_feasible_budget_greedy` — does NOT recompute on every slider tick.

### Infeasibility paragraph JSX

```tsx
{hasCommitted && clientSquad === null && (
  <p className="text-sm text-amber-600 dark:text-amber-400 py-2">
    {health?.min_feasible_budget_greedy != null
      ? `No squad possible at £${committedBudget.toFixed(1)}m — try £${health.min_feasible_budget_greedy.toFixed(1)}m+`
      : `No squad possible at £${committedBudget.toFixed(1)}m`}
  </p>
)}
```

Placement: between the slider `<div>` and `{squadSection}` (formation grid stays visible via `lastValidSquad`).

### Inputs-refetch reset useEffect

```typescript
useEffect(() => {
  setLastValidSquad(null)
  setHasCommitted(false)
}, [data?.inputs])
```

Dependency: `data?.inputs` object identity. Runs once on initial mount (when query data resolves) and again only if the server returns a different inputs payload on refetch. Safe under TanStack Query's 6h staleTime.

## Wave 0 Component Test Pass Count

**28/28 GREEN** (28 total: 13 pre-existing + 15 Wave 0)

### All Wave 0 Tests Now GREEN (15/15)

1. `does NOT render slider when envelope has no inputs field (Phase 127/128 regression)` — GREEN
2. `renders slider input when data.inputs is present` — GREEN
3. `slider initial value is £100.0m with aria-valuetext £100.0m` — GREEN
4. `slider has min=80 max=120 step=0.5 and aria-label Budget slider` — GREEN
5. `shows API squad (budgetUsed) before any commit (D-06)` — GREEN
6. `onInput updates label only (no recompute; grid still shows API squad)` — GREEN
7. `pointerUp commits to client squad (D-06)` — GREEN
8. `keyboard arrow + 300ms debounce commits once` — GREEN
9. `slider NOT rendered when isError is true` — GREEN
10. `slider NOT rendered when data is null (Prices pending)` — GREEN
11. `infeasibility variant A: shows "No squad possible at £X.Xm — try £Y.Ym+" (D-08)` — GREEN
12. `infeasibility variant B: shows "No squad possible at £X.Xm" when health is null (D-09)` — GREEN
13. `grid stays visible at infeasible budget showing lastValidSquad (D-07)` — GREEN
14. `amber gradient inline style contains #f59e0b and 10% threshold when min_feasible=84 (D-10)` — GREEN
15. `slider track is zinc #71717a only when health is null (D-11)` — GREEN

## Full Test Suite Status

| Test File | Expected | Actual |
|-----------|----------|--------|
| NextSeasonPlannerTab.test.tsx (28 tests) | 28 GREEN | 28 GREEN |
| route.test.ts (6 tests) | 6 GREEN | 6 GREEN |

## Manual Smoke Checklist

- [ ] Open `npm run dev` → Plan → Next Season tab
- [ ] Verify slider track shows amber zone left of `min_feasible_budget_greedy` when health is populated
- [ ] Drag slider from £100m to £80m → confirm `No squad possible at £80.0m — try £83.5m+` appears above the (still-visible) formation grid
- [ ] Confirm formation grid stays visible with lastValidSquad from previous feasible budget
- [ ] Drag back to £100m → confirm infeasibility message disappears and a feasible client squad renders
- [ ] With health=null env → confirm flat zinc slider track (no amber gradient)
- [ ] With health=null env → confirm `No squad possible at £80.0m` (no suggestion suffix) renders at infeasible budget

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] D-11 test assertion incompatible with jsdom colour normalisation**
- **Found during:** Task 1 — first test run
- **Issue:** The Wave 0 test for D-11 checked `slider.style.background.toContain('#71717a')`. jsdom normalises plain hex background colours to rgb() (`#71717a` → `rgb(113, 113, 122)`), causing the assertion to always fail even with the correct implementation.
- **Fix:** Updated test assertion to `toMatch(/#71717a|rgb\(113,\s*113,\s*122\)/)` — accepts either the literal hex or its normalised rgb equivalent. The companion assertion `not.toContain('linear-gradient')` is preserved unchanged.
- **Files modified:** src/components/next-season/NextSeasonPlannerTab.test.tsx
- **Commit:** ee6f99c

## Known Stubs

None — Phase 129 COST-03 is fully implemented. All three interlocking pieces (COST-01 slider, COST-02 inputs API, COST-03 infeasibility) are complete.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. Component reads from existing `data?.health?.min_feasible_budget_greedy` — no new API surface.

## Self-Check: PASSED

- [x] src/components/next-season/NextSeasonPlannerTab.tsx modified — trackBackground at line 169, infeasibility paragraph at line 308, reset useEffect at line 163
- [x] src/components/next-season/NextSeasonPlannerTab.test.tsx modified — D-11 assertion fixed
- [x] Commit ee6f99c exists
- [x] `grep -n "linear-gradient(to right, #f59e0b" NextSeasonPlannerTab.tsx` — 1 hit (line 173)
- [x] `grep -n "return '#71717a'" NextSeasonPlannerTab.tsx` — 1 hit (line 171)
- [x] `grep -n "trackBackground" NextSeasonPlannerTab.tsx` — 2 hits (lines 169, 299)
- [x] `grep -n "style={{ background: trackBackground }}" NextSeasonPlannerTab.tsx` — 1 hit (line 299)
- [x] `grep -c "background: '#71717a'" NextSeasonPlannerTab.tsx` — 0 hits (Wave 2 placeholder removed)
- [x] `grep -n "No squad possible at £" NextSeasonPlannerTab.tsx` — 2 hits (lines 311, 312)
- [x] `grep -n " — try £" NextSeasonPlannerTab.tsx` — 1 hit with em-dash (line 311)
- [x] `grep -n "text-amber-600 dark:text-amber-400 py-2" NextSeasonPlannerTab.tsx` — 1 hit (line 309)
- [x] `grep -n "Phase 129 Wave 3: infeasibility" NextSeasonPlannerTab.tsx` — 0 hits (anchor comment replaced)
- [x] 28/28 component tests GREEN (13 pre-existing + 15 Wave 0)
- [x] 6/6 route tests GREEN
- [x] TypeScript: 0 new errors (1 pre-existing in decision-history/route.test.ts unchanged)
