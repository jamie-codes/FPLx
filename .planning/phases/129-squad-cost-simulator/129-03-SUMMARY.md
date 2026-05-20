---
phase: 129-squad-cost-simulator
plan: 03
subsystem: hook+component
tags:
  - react-hooks
  - useDeferredValue
  - phase-129
  - next-season-planner
  - COST-01
  - COST-02
dependency_graph:
  requires:
    - "src/lib/types.ts (PreSeasonSquadInputs — Wave 1)"
    - "src/app/api/pre-season-squad/route.ts (?include=inputs — Wave 1)"
    - "src/components/next-season/NextSeasonPlannerTab.test.tsx (Wave 0 RED tests)"
    - "src/lib/pre-season-squad.ts (buildPreSeasonSquad)"
  provides:
    - "usePreSeasonSquad with optional includeInputs parameter and queryKey discriminator"
    - "Budget slider (min=80, max=120, step=0.5) in NextSeasonPlannerTab"
    - "useDeferredValue commit pipeline: sliderValue -> committedBudget -> deferredBudget -> clientSquad"
    - "lastValidSquad/hasCommitted state for D-06/D-07 API-squad-before-commit render"
    - "scoreMapHydrated useMemo (Record<string,number> -> Map<number,number>, D-03)"
  affects:
    - "Phase 127 watchlist — usePreSeasonSquad() no-args still produces queryKey ['pre-season-squad','default'] and URL /api/pre-season-squad (backwards compat)"
    - "Phase 129 Wave 3 — infeasibility paragraph + amber gradient to complete COST-01/COST-03"
tech_stack:
  added: []
  patterns:
    - "useDeferredValue(committedBudget) for deferred recompute on slider commit"
    - "useMemo with Math.round(deferredBudget * 10) for integer-tenths budget coercion (Pitfall 3)"
    - "keyboardTimerRef + 300ms setTimeout debounce for keyboard commit (Pitfall 4 fresh-closure)"
    - "queryKey discriminator ('with-inputs' | 'default') to prevent TanStack Query cache collision"
    - "Conditional URL in queryFn: ?include=inputs appended only when includeInputs=true"
key_files:
  created: []
  modified:
    - src/lib/hooks/usePreSeasonSquad.ts
    - src/components/next-season/NextSeasonPlannerTab.tsx
decisions:
  - "Wave 2 uses static style={{ background: '#71717a' }} placeholder — Wave 3 replaces with trackBackground useMemo + linear-gradient"
  - "Infeasibility paragraph deferred to Wave 3 — Wave 3 anchor comment inserted in JSX"
  - "displaySquad = hasCommitted ? (lastValidSquad ?? squad) : squad — API squad shown until first commit (D-06)"
  - "useDeferredValue wraps committedBudget (not sliderValue) — only committed values trigger recompute"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-20"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 2
---

# Phase 129 Plan 03: Hook Parameterisation + Slider End-to-End (Wave 2) Summary

**One-liner:** Parameterised usePreSeasonSquad with queryKey discriminator for cache isolation, then wired the budget slider + useDeferredValue + buildPreSeasonSquad pipeline into NextSeasonPlannerTab with API-squad-before-commit rendering.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Parameterise usePreSeasonSquad with optional includeInputs option | 33335cd | src/lib/hooks/usePreSeasonSquad.ts |
| 2 | Wire slider, useDeferredValue, clientSquad memo and API-squad-before-commit render into NextSeasonPlannerTab | ff6de3d | src/components/next-season/NextSeasonPlannerTab.tsx |

## Interface Signatures

### usePreSeasonSquad (updated)

```typescript
export function usePreSeasonSquad(options?: { includeInputs?: boolean }): UseQueryResult<PreSeasonSquadResponse | null>
```

queryKey: `['pre-season-squad', 'with-inputs']` when `includeInputs: true`; `['pre-season-squad', 'default']` when false/absent.

URL: `/api/pre-season-squad?include=inputs` when `includeInputs: true`; `/api/pre-season-squad` otherwise.

### New state in NextSeasonPlannerTab

```typescript
const inputs = data?.inputs ?? null                                   // const, not memo
const [sliderValue, setSliderValue] = useState<number>(100)          // £m, visual only
const [committedBudget, setCommittedBudget] = useState<number>(100)  // £m, logical
const deferredBudget = useDeferredValue(committedBudget)
const [lastValidSquad, setLastValidSquad] = useState<PreSeasonSquad | null>(null)
const [hasCommitted, setHasCommitted] = useState<boolean>(false)
const keyboardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
const scoreMapHydrated = useMemo<Map<number, number> | null>(...)    // Record -> Map hydration
const clientSquad = useMemo<PreSeasonSquad | null>(...)              // buildPreSeasonSquad(players, map, Math.round(deferredBudget*10))
```

## Wave 0 Component Test Pass Count

**23/28 GREEN** (28 total: 13 pre-existing + 15 Wave 0)

### Wave 0 Tests Now GREEN (10/15)

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

### Wave 0 Tests Still RED (5/15) — Wave 3 Handoff

1. `infeasibility variant A: shows "No squad possible at £X.Xm — try £Y.Ym+" (D-08)` — RED (infeasibility paragraph not yet rendered)
2. `infeasibility variant B: shows "No squad possible at £X.Xm" when health is null (D-09)` — RED (same)
3. `grid stays visible at infeasible budget showing lastValidSquad (D-07)` — RED (infeasibility paragraph gating required)
4. `amber gradient inline style contains #f59e0b and 10% threshold when min_feasible=84 (D-10)` — RED (Wave 2 uses #71717a placeholder)
5. `slider track is zinc #71717a only when health is null (D-11)` — RED (browser normalises #71717a to rgb(113,113,122); Wave 3 will use trackBackground useMemo that Wave 3 test expects)

## Full Test Suite Status

| Test File | Expected | Actual |
|-----------|----------|--------|
| NextSeasonPlannerTab.test.tsx (28 tests) | 23 GREEN, 5 RED | 23 GREEN, 5 RED |
| route.test.ts (6 tests) | 6 GREEN | 6 GREEN |
| pre-season-squad.test.ts (8 tests) | 8 GREEN | 8 GREEN |

## Deviations from Plan

None — plan executed exactly as written. All Wave 2 tests pass as expected; all Wave 3 tests remain RED as expected.

## Known Stubs

- `style={{ background: '#71717a' }}` — Wave 2 placeholder for slider track. Wave 3 replaces with `trackBackground` useMemo deriving `linear-gradient` from `health?.min_feasible_budget_greedy`.

## Threat Flags

No new network endpoints, auth paths, or trust boundaries. The component now calls `usePreSeasonSquad({ includeInputs: true })` which triggers a different cache key and URL — server-side handled by Wave 1 (Plan 02).

## Self-Check: PASSED

- [x] src/lib/hooks/usePreSeasonSquad.ts modified — options?: { includeInputs?: boolean } at line 9
- [x] src/components/next-season/NextSeasonPlannerTab.tsx modified — useDeferredValue at line 146, slider block at lines 272-295
- [x] Commit 33335cd exists (hook parameterisation)
- [x] Commit ff6de3d exists (component slider)
- [x] 23/28 component tests GREEN (13 pre-existing + 10 Wave 0 slider)
- [x] 5 Wave 3 tests remain RED as designed
- [x] 6/6 route tests GREEN
- [x] TypeScript: 0 new errors (1 pre-existing in decision-history/route.test.ts unchanged)
