---
phase: 60
plan: 02
subsystem: transfer-route-tree
tags: [route-tree-ui, plan-section, manual-plan-bridge, react, rtl-tests]
dependency_graph:
  requires:
    - src/lib/transfer-route-tree.ts    # Plan 01 engine (buildTransferRouteTree)
    - src/lib/manual-plan.ts            # persistManualPlan, loadManualPlan, ManualPlan types
    - src/components/planner/HorizonSelector.tsx  # local horizon selector
    - src/lib/hooks/usePlayers.ts
    - src/lib/hooks/useSquad.ts
    - src/lib/hooks/useMyTeam.ts
    - src/lib/hooks/useAuthStatus.ts
    - src/lib/gem-score.ts
    - src/app/page.tsx                  # SubTab union + SECTIONS + render guard (modified)
  provides:
    - src/components/planner/RouteTreeTab.tsx   # new Plan sub-tab body component
    - src/components/planner/RouteTreeTab.test.tsx  # co-located RTL tests
  affects:
    - src/app/page.tsx                  # SubTab union + Plan section subTabs + render guard
    - src/app/page.test.tsx             # mock + integration test
tech_stack:
  added: []
  patterns:
    - ManualPlanTab analog: auth/data composition via usePlayers/useSquad/useMyTeam/useAuthStatus
    - Local HorizonSelector (matches PlannerTab/ManualPlanTab pattern; D-07 UI-SPEC override)
    - useMemo keyed on engine inputs for TRT-07 horizon recomputation
    - Fragment-based table rows with expand/collapse via Set<number> state
    - Inline confirm (confirmingLoadIndex: number | null) — no modal, no popover
    - localStorage bridge via persistManualPlan + onSwitchSubTab callback prop
key_files:
  created:
    - src/components/planner/RouteTreeTab.tsx    # 429 lines — Route Tree Plan sub-tab UI
    - src/components/planner/RouteTreeTab.test.tsx  # 509 lines — 21 RTL tests across 7 describe blocks
  modified:
    - src/app/page.tsx    # +5 lines: import + SubTab union + subTabs entry + render guard
    - src/app/page.test.tsx  # +16 lines: RouteTreeTab mock + Route Tree navigation test
decisions:
  - "D-07 override: RouteTreeTab renders its own local HorizonSelector (matches PlannerTab/ManualPlanTab pattern). UI-SPEC.md section 'Reused Components' note overridden — page.tsx has no section-level HorizonSelector today. Zero regression risk."
  - "chipMode hard-coded null: TRT-06 satisfied at engine level (Plan 01); UI ChipToggle for RouteTreeTab deferred per RESEARCH.md A3."
  - "Bridge payload chip: null per step (D-09). User sets chips manually in Manual Plan after loading."
metrics:
  duration: "~16 minutes"
  completed: "2026-05-04T12:15:21Z"
  tasks_completed: 2
  files_created: 2
  files_modified: 2
status: partial  # stopped at Task 3 checkpoint:human-verify
---

# Phase 60 Plan 02: Route Tree UI Summary (Partial — Tasks 1-2 of 3)

## One-Liner

Route Tree Plan sub-tab (RouteTreeTab.tsx) consuming the Plan 01 engine: side-by-side summary table with recommended-path green ring, expand-to-GW-breakdown, inline confirm bridge to Manual Plan via persistManualPlan + onSwitchSubTab, and local HorizonSelector for TRT-07 recomputation.

## Files Created

| File | Lines | Key Exports |
|------|-------|-------------|
| `src/components/planner/RouteTreeTab.tsx` | 429 | `RouteTreeTab` (props: `submittedId`, `onSwitchSubTab`) |
| `src/components/planner/RouteTreeTab.test.tsx` | 509 | 21 test cases across 7 describe blocks |

## Files Modified

| File | Delta | Change |
|------|-------|--------|
| `src/app/page.tsx` | +5 lines | RouteTreeTab import, 'route-tree' in SubTab union + SECTIONS subTabs, render guard |
| `src/app/page.test.tsx` | +16 lines | RouteTreeTab mock + 1 new integration test + updated Plan sub-tab order test |

## Test Counts Per Describe Block

| Describe Block | Cases | Requirements Covered |
|---------------|-------|---------------------|
| no-squad branch | 2 | TRT-01, D-09 |
| caveat banner (MTP-07 mirror) | 2 | MTP-07, D-13 |
| summary table — TRT-04 | 5 | TRT-04 |
| expand breakdown — TRT-03 | 3 | TRT-03 |
| horizon recompute — TRT-07 | 2 | TRT-07 |
| bridge — TRT-05 | 6 | TRT-05, D-08, D-09 |
| empty tree fallback | 1 | defensive case |
| **page.test.tsx new tests** | 2 | D-05, D-06 |
| **Total** | **23** | |

## Architecture Decision: RouteTreeTab Local HorizonSelector (D-07 UI-SPEC Override)

**UI-SPEC.md §Reused Components** states: "Route Tree does NOT render its own HorizonSelector. The Plan section's existing section-level HorizonSelector (rendered in page.tsx) is the single instance per D-07."

**Override rationale:** `page.tsx` does NOT have a section-level HorizonSelector. PlannerTab (line 341) and ManualPlanTab (line 327) each render their own local HorizonSelector inside the tab body. RouteTreeTab follows the same established pattern:

1. Zero regression risk — no sibling Plan sub-tabs are touched.
2. TRT-07 satisfied: `useMemo` keys on local `horizon` state — recomputes synchronously on toggle.
3. Future enhancement path: if user wants cross-tab horizon sync, lift `horizon` state to `page.tsx` and pass as prop — this can be done in a future phase without breaking RouteTreeTab.

**CONTEXT.md D-07** referenced a "section-level HorizonSelector in page.tsx" that does not exist. The RESEARCH.md Open Question 1 / Pitfall 4 / A2 explicitly identified this gap. The architecture decision (from 060-02-PLAN.md §architecture_decision) resolves it in favor of local state.

## chipMode Handling (TRT-06)

`chipMode: PlannerChip = null` is a constant in RouteTreeTab. The engine receives `chipMode: null` and respects it (test suite E1-E4 from Plan 01 verified chip-aware behavior). No UI ChipToggle is rendered in RouteTreeTab per RESEARCH.md A3 (deferred). TRT-06 is satisfied at the engine level only.

## Bridge Payload Contract (D-08/D-09)

Verified by `bridge — TRT-05` test case "bridge payload":

```typescript
const bridge: ManualPlan = {
  version: 1,
  horizon,             // matches RouteTreeTab's current horizon state
  steps: path.nodes.map(n => ({
    gw: n.gw,
    chip: null,        // D-09: chip = null per step; user sets chips in Manual Plan
    transfers: n.transfers,
  })),
}
persistManualPlan(bridge)
onSwitchSubTab('manual-plan')  // parent page.tsx flips activeSubTab
```

Inline confirm fires only when `loadManualPlan()` returns a plan with `steps.some(s => s.transfers.length > 0)`. Silent overwrite when plan is null or empty.

## Phase 56/59/Plan 01 Contract Invariants

No modifications were made to:
- `src/lib/transfer-route-tree.ts` (Plan 01 engine — used verbatim)
- `src/lib/manual-plan.ts` (Phase 59 bridge target — used verbatim)
- `src/components/planner/ManualPlanTab.tsx` (Phase 59 sibling — not touched)
- `src/lib/free-transfer-engine.ts` (Phase 56 FT engine — not touched)

## Sub-Tab Order (D-05/D-06)

Plan section subTabs array (verified by page.test.tsx):
`Planner | Manual Plan | Route Tree | Club Form | Value Gems | Rivals`

Mobile labels: `Planner | Manual | Routes | Form | Values | Rivals`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript TS2352 type assertion in RouteTreeTab.test.tsx**

- **Found during:** Post-commit `npx tsc --noEmit` verification
- **Issue:** `useMyTeam` mock return value needed `as unknown as ReturnType<typeof useMyTeam>` — direct cast was rejected because TanStack Query's `QueryObserverResult` has 20+ required properties not in the mock shape.
- **Fix:** Added `as unknown as` two-step assertion.
- **Files modified:** `src/components/planner/RouteTreeTab.test.tsx`
- **Commit:** `87c3806`

**2. [Rule 1 - Bug] Hit cost display had extra '4' character**

- **Found during:** Task 1 implementation review
- **Issue:** Template literal `\`−4${Math.abs(path.totalHitCostPts)} pts\`` would render `−40 pts` instead of `−4 pts` for a single hit.
- **Fix:** Corrected to `\`−${Math.abs(path.totalHitCostPts)} pts\`` (since `totalHitCostPts` is already the total pts cost).
- **Files modified:** `src/components/planner/RouteTreeTab.tsx`
- **Commit:** `14f4d34` (fixed before commit)

### Out-of-Scope Pre-Existing Failures

Two pre-existing test failures confirmed unrelated to this plan's changes:
- `tests/lib/captain-picks.test.ts` — 5 failures (Phase 31 component tests)
- `tests/lib/club-form.test.ts` — 1 failure (computeClubForm difficulty tier)

These failures exist on the base commit `a952bcd` before any Plan 02 changes. Logged as deferred items.

## Human-Verify Checkpoint (Task 3)

Status: **PENDING** — awaiting user approval of TRT-01..TRT-07 + D-07 cross-tab horizon sharing via the dev server.

## Threat Surface Scan

No new security-relevant surfaces introduced:
- `RouteTreeTab` writes to `fplx_manual_plan` localStorage via existing `persistManualPlan` helper (T-60-02-01 mitigation: shape validation via `loadManualPlan` on every read)
- `RouteTreeTab` reads from `fplx_manual_plan` via `loadManualPlan` (T-60-02-02 mitigation: returns null on invalid shape)
- DOM exposes only public FPL data (T-60-02-03: accepted)
- No new network endpoints, no auth paths, no file access patterns

## Known Stubs

None. All data wiring is live:
- `buildTransferRouteTree` engine is called with real squad/player data
- `persistManualPlan` writes real `ManualPlan` to localStorage
- `HorizonSelector` triggers real `useMemo` recomputation

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `src/components/planner/RouteTreeTab.tsx` exists (429 lines) | FOUND |
| `src/components/planner/RouteTreeTab.test.tsx` exists (509 lines) | FOUND |
| `src/app/page.tsx` modified with route-tree SubTab | FOUND |
| `src/app/page.test.tsx` modified with mock + test | FOUND |
| Commit `14f4d34` (Task 1: RouteTreeTab + tests) | FOUND |
| Commit `d22624e` (Task 2: page.tsx + page.test.tsx) | FOUND |
| Commit `87c3806` (Rule 1 fix: TS2352) | FOUND |
| 21/21 RouteTreeTab tests pass | CONFIRMED |
| 10/10 page tests pass | CONFIRMED |
| 83/83 combined test suite passes | CONFIRMED |
| `npx tsc --noEmit` exits 0 | CONFIRMED |
