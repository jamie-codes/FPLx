---
phase: 60
plan: 02
subsystem: transfer-route-tree
status: complete
completed: 2026-05-04
tags: [route-tree-ui, plan-section, manual-plan-bridge, react, rtl-tests, d07-horizon-lift]
---

# Phase 60 Plan 02: Route Tree UI + D-07 Horizon Lift

## One-Liner

Route Tree Plan sub-tab (RouteTreeTab.tsx) + full D-07 horizon lift: planHorizon state lifted to page.tsx, shared section-level HorizonSelector drives all three Plan sub-tabs simultaneously.

## Files Created

| File | Lines | Key Exports |
|------|-------|-------------|
| `src/components/planner/RouteTreeTab.tsx` | 429 | `RouteTreeTab` (props: `submittedId`, `horizon`, `onSwitchSubTab`) |
| `src/components/planner/RouteTreeTab.test.tsx` | 509 | 21 RTL tests across 6 describe blocks |

## Files Modified

| File | Change |
|------|--------|
| `src/app/page.tsx` | `[planHorizon, setPlanHorizon]` state; section-level `<HorizonSelector>` (desktop + mobile, `data-testid="plan-section-horizon"`); `'route-tree'` in SubTab union + Plan subTabs; render guards pass `horizon={planHorizon}` to PlannerTab, ManualPlanTab, RouteTreeTab |
| `src/components/planner/PlannerTab.tsx` | Accepts `horizon: PlannerHorizon` prop; removed local `useState<PlannerHorizon>` and local `<HorizonSelector>` import + render |
| `src/components/planner/ManualPlanTab.tsx` | Accepts `horizon: PlannerHorizon` prop; D-07 sync effect mirrors prop → `plan.horizon`; removed local `<HorizonSelector>` |
| `src/components/planner/ManualPlanTab.test.tsx` | `renderManualPlan()` helper; S7 uses `rerender`; S9 tests persisted plan steps; S14–S21 pass `horizon: 1` to match single-step fixtures |
| `src/app/page.test.tsx` | Mocks expose `data-horizon`; D-07 cross-tab test; Route Tree sub-tab navigation test |

## D-07 Horizon Lift

`page.tsx` owns `[planHorizon, setPlanHorizon]` initialised from `loadManualPlan()?.horizon ?? 3` (page reload restores persisted horizon).

Section-level `<HorizonSelector>` renders above the Plan sub-tab nav only when `activeSection === 'plan'`. Both desktop (`hidden sm:flex`) and mobile (`sm:hidden flex`) copies are bound to the same state.

**PlannerTab** — accepts `horizon` prop, no local state, no local selector.

**ManualPlanTab** — D-07 sync effect:
```typescript
useEffect(() => {
  if (plan.horizon === horizon) return
  updatePlan((draft) => {
    draft.horizon = horizon
    draft.steps = truncateOrExtendSteps(draft.steps, horizon, startingGw ?? draft.steps[0]?.gw ?? 0)
  })
}, [horizon, startingGw, plan.horizon, updatePlan])
```
Keeps `plan.horizon` (the localStorage mirror) in sync with the prop without breaking Phase 59 persistence.

**RouteTreeTab** — accepts `horizon` prop; `buildTransferRouteTree` `useMemo` keys on `horizon`. `useEffect` keyed on `[horizon]` resets `expandedPaths` and `confirmingLoadIndex` on change (TRT-07).

## Test Counts

### RouteTreeTab.test.tsx (21 tests, 6 describe blocks)
| Describe | Tests | Requirements |
|----------|-------|--------------|
| no-squad branch | 2 | TRT-01, D-09 |
| caveat banner (MTP-07 mirror) | 2 | MTP-07 |
| summary table — TRT-04 | 5 | TRT-04 |
| expand breakdown — TRT-03 | 3 | TRT-03 |
| horizon recompute — TRT-07 | 2 | TRT-07 — uses `rerender` with `horizon={5}` prop |
| bridge — TRT-05 | 6 | TRT-05, D-08, D-09 |
| empty tree fallback | 1 | defensive |

### ManualPlanTab.test.tsx — key updated tests
- **S7**: `rerender(<ManualPlanTab horizon={1} />)` asserts plan truncation (D-07 sync effect)
- **S9**: passes `horizon={1}` to match persisted plan's horizon; tests step visibility
- **S14–S21**: pass `horizon: 1` to `renderManualPlan()` — single-step fixtures avoid D-07 sync extension causing ambiguous element queries

### page.test.tsx — new tests
- `'inserts Route Tree sub-tab after Manual Plan in Plan section nav (D-05/D-06)'`
- `'D-07: section-level HorizonSelector shares horizon across all Plan sub-tabs'`

## Bridge Payload Contract (D-08, D-09)

```typescript
const bridge: ManualPlan = {
  version: 1,
  horizon,          // matches current section-level planHorizon prop
  steps: path.nodes.map(n => ({
    gw: n.gw,
    chip: null,     // D-09: chip always null in TRT bridge
    transfers: n.transfers,
  })),
}
persistManualPlan(bridge)
onSwitchSubTab('manual-plan')
```

Inline confirm fires only when `loadManualPlan()` returns a plan with any `step.transfers.length > 0`. Silent overwrite when plan is null or all steps are empty.

## chipMode Handling

`chipMode: PlannerChip = null` (constant). Engine receives `chipMode: null`. UI ChipToggle deferred per RESEARCH.md Open Question 2.

## Phase 56/59/Plan 01 Contract Invariants

No modifications to:
- `src/lib/transfer-route-tree.ts` (Plan 01 engine)
- `src/lib/manual-plan.ts` (Phase 59 bridge target)
- `src/lib/free-transfer-engine.ts` (Phase 56 FT engine)

## Sub-Tab Order (D-05/D-06)

`Planner | Manual Plan | Route Tree | Club Form | Value Gems | Rivals`
Mobile: `Planner | Manual | Routes | Form | Values | Rivals`

## Full Test Suite

- 42/42: ManualPlanTab + RouteTreeTab tests
- 53/53: above + page.test
- 787/821 total (6 pre-existing failures in captain-picks + club-form; 0 Phase 60 regressions)

## Human-Verify Checkpoint (Task 4)

Status: **PENDING** — awaiting user approval of TRT-01..TRT-07 + D-07 cross-tab horizon sharing via the dev server.

See plan Task 4 for the 17-step verification checklist.
