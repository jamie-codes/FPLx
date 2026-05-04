---
phase: 59
plan: 02
subsystem: manual-plan-ui
tags:
  - manual-plan
  - planner-ui
  - localStorage
  - auth
  - tdd
dependency_graph:
  requires:
    - src/lib/manual-plan.ts          # freshPlan, deriveStepStates, computeManualPlanSummary, persistence
    - src/lib/free-transfer-engine.ts  # reused via manual-plan.ts (no direct import)
    - src/lib/types.ts                 # PlannerHorizon, PlannerChip, ScoredPlayer, FTState
    - src/components/planner/HorizonSelector.tsx
    - src/components/planner/ChipToggle.tsx
    - src/components/planner/PlayerPickerModal.tsx
    - src/components/planner/SquadSnapshotRow.tsx
    - src/lib/hooks/useAuthStatus.ts
    - src/lib/hooks/useSquad.ts
    - src/lib/hooks/useMyTeam.ts
    - src/lib/hooks/usePlayers.ts
  provides:
    - src/components/planner/ManualPlanTab.tsx
    - src/components/planner/ManualPlanTab.test.tsx
  affects:
    - src/app/page.tsx  # Plan 03 wires ManualPlanTab into the navigation
tech_stack:
  added: []
  patterns:
    - useImmer for nested plan state (mirrors PlannerTab pattern)
    - Two-stage sell→buy picker flow (custom sell list + PlayerPickerModal for buy)
    - Budget-aware affordability filter (bankBeforeStep + sellPrice → affordablePlayers)
    - localStorage persistence via mocked loadManualPlan/persistManualPlan in tests
    - Private subcomponents co-located in same file (GwStepCard, TransferRow)
    - Accordion open set (session-only, not persisted)
key_files:
  created:
    - src/components/planner/ManualPlanTab.tsx
    - src/components/planner/ManualPlanTab.test.tsx
  modified: []
decisions:
  - localStorage mock approach: vi.mock('@/lib/manual-plan') to mock loadManualPlan/persistManualPlan/clearManualPlan instead of stubbing window.localStorage directly — avoids jsdom localStorage API availability issues in vitest
  - window.location.reload() for no-squad submit: page.tsx reads fpl_team_id from localStorage on mount; ManualPlanTab writes to localStorage then reloads so page re-initialises submittedId. Trade-off noted — Plan 03 should refactor to pass a callback prop from page.tsx
  - TDD split: all 21 tests written in RED phase; both Task 1 shell + Task 2 GwStepCard/picker implemented in GREEN phase together (all tests pass in one shot)
  - data-testid="sell-stage-picker" added to sell-stage modal container for test isolation
metrics:
  duration: "~7 min"
  completed: "2026-05-04"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
  commits: 3
---

# Phase 59 Plan 02: ManualPlanTab Component Summary

`ManualPlanTab` — the full UI surface for the Manual Transfer Planner — with no-squad branch, auth caveat banner (D-13), summary header (D-11), horizon controls (D-04), GW step cards with two-stage sell→buy picker flow (D-06), accordion squad snapshots (D-10), budget-aware affordability filtering (MTP-02), and localStorage persistence (D-05, MTP-08).

## Component Structure

### `ManualPlanTab` (exported, `src/components/planner/ManualPlanTab.tsx`)

Top-level container. Owns all state and hook wiring.

**Three render branches:**
1. **Loading** (`scoredPlayers.length === 0 && submittedId`): `Loading…` text
2. **No-squad** (`picks === null`): Team ID input form + Load Squad CTA
3. **Squad-loaded**: full plan UI with caveat banner, controls row, summary header, GW step list

**Props:** `{ submittedId: string | null }` — mirrors RivalsTab pattern.

### `GwStepCard` (private subcomponent, same file)

Per-GW step card with:
- Step header row: GW label + ChipToggle + accordion toggle
- Transfer rows (0..N) via `TransferRow`
- `+ Add Transfer` button
- Step footer: bank balance (red when < 0) + FT label
- Accordion body: `SquadSnapshotRow` when open

### `TransferRow` (private subcomponent, same file)

Per-transfer row with:
- Sell → Buy player names (React text nodes only — T-59-08)
- Free (green) or Hit −4 pts (red) badge
- Break-even display when Hit: `{N.N} GWs` or `∞` (U+221E)
- Remove ✕ button (aria-label="Remove transfer", min-h-[44px])

## State Model

```typescript
// Immer plan state (persisted to fplx_manual_plan)
const [plan, updatePlan] = useImmer<ManualPlan>(() => loadManualPlan() ?? freshPlan(3, 0))

// Open accordion indices (session-only)
const [openSet, setOpenSet] = useState<Set<number>>(() => new Set())

// Two-stage picker state
const [pickerState, setPickerState] = useState<{
  stepIndex: number
  stage: 'sell' | 'buy'
  pendingSellId: number | null
  sellPosition: number | null
} | null>(null)
```

## Two-Stage Picker Flow

1. User clicks `+ Add Transfer` → `pickerState.stage = 'sell'`
2. **Sell stage**: custom inline dialog lists all 15 players in the step's squad snapshot. `PlayerPickerModal` cannot be used here (it filters by `position` which we don't know yet).
3. User picks a sell → `pickerState.stage = 'buy'` with `pendingSellId` + `sellPosition`
4. **Buy stage**: `PlayerPickerModal` opens with pre-filtered `scoredPlayers` (budget-aware, see below)
5. User picks a buy → transfer appended to `plan.steps[stepIndex].transfers`; picker closes

## Budget-Aware Affordability Filter (D-06, MTP-02)

Computed in the buy-stage IIFE before passing to `PlayerPickerModal`:

```typescript
const bankBeforeStep = stepIdx === 0 ? bankBalance : derived[stepIdx - 1].bankAfter
const sellPriceTenths = sellPriceMap?.get(pendingSellId) ?? playerMap.get(pendingSellId)?.now_cost ?? 0
const bankAfterSell = bankBeforeStep + sellPriceTenths
const affordablePlayers = scoredPlayers.filter(p => p.now_cost <= bankAfterSell)
// Passed as scoredPlayers={affordablePlayers} to PlayerPickerModal
```

- Authenticated path: uses exact `selling_price` from `sellPriceMap` (D-12)
- Unauthenticated path: falls back to `now_cost` (D-13 caveat)
- Units: all values in tenths of £1m — no unit conversion needed

## Test Coverage

21/21 tests passing (Vitest, jsdom environment):

| Tests | What they verify |
|-------|-----------------|
| S1 | Loading branch when picks/players pending |
| S2 | No-squad branch with Team ID input |
| S3–S4 | Summary header metrics: Hits, Hit cost, Avg break-even |
| S5–S6 | Caveat banner present/absent based on auth state |
| S7 | HorizonSelector horizon change (1 GW truncates steps) |
| S8 | Reset Plan confirm → clearManualPlan called on accept only |
| S9 | Plan state restored via loadManualPlan mock |
| S10–S11 | 3-step plan renders 3 GwStepCards with headers + Add buttons |
| S12–S13 | Two-stage picker: sell list shown; buy modal at sell element_type |
| S14 | Transfer row appears after buy pick; Free badge shown |
| S15 | Remove ✕ button removes transfer from plan |
| S16 | ChipToggle sets/unsets chip (toggle-off pattern) |
| S17 | Accordion toggle mounts/unmounts SquadSnapshotRow |
| S18–S19 | Break-even: N.N GWs (positive delta) vs ∞ (negative delta) |
| S20 | Bank < 0 renders text-red-700 class |
| S21 | Budget-aware filter: id=102 (over budget) excluded; id=100, 101 included |

Requirements satisfied: MTP-01, MTP-02 (budget-aware filter), MTP-03 (bank display), MTP-04 (FT/hit propagation), MTP-05 (summary header), MTP-06 (accordion snapshot), MTP-07 (caveat banner), MTP-08 (localStorage)

## Open Issues

### window.location.reload() no-squad submit hack

When the user submits a Team ID in the no-squad branch, `ManualPlanTab` writes to `localStorage('fpl_team_id')` and calls `window.location.reload()`. This causes a full page reload so `page.tsx` re-reads `fpl_team_id` from localStorage in its `useState` initialiser.

**Trade-off:** Works correctly but forces a full reload. Plan 03 (navigation wiring) should refactor this: expose a `onTeamIdSubmit` callback prop from `page.tsx` to `ManualPlanTab` so the tab can call `setSubmittedId(trimmedId)` directly without a page reload.

**Impact:** No user-facing bug — correct behaviour, just a UX trade-off. The reload shows a brief flash before the squad loads.

### loadManualPlan mock in tests

Tests mock `@/lib/manual-plan` partially (loadManualPlan, persistManualPlan, clearManualPlan) to avoid `window.localStorage` API availability issues in jsdom. The actual storage functions are tested in `src/lib/manual-plan.test.ts` which uses `window.localStorage` directly via the `globalThis.window` jsdom setup. This split is intentional: component tests test React behaviour; unit tests test localStorage behaviour.

## TDD Gate Compliance

- RED commit: `696ee21` — `test(59-02): RED — failing tests for ManualPlanTab shell + GwStepCard + picker flow` (21 failing — import error since file didn't exist)
- GREEN commit (Task 1): `d6cbdb6` — `feat(59-02): ManualPlanTab shell — no-squad, caveat, summary, horizon, persistence` (21 passing)
- GREEN commit (Task 2): `d95823e` — `feat(59-02): GwStepCard + TransferRow + two-stage picker` (21 still passing, sell-stage testid added)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] localStorage API unavailable in jsdom test environment**
- **Found during:** Task 1 GREEN phase
- **Issue:** `window.localStorage.clear()` and `window.localStorage.setItem()` throw "not a function" in this vitest/jsdom configuration. Tests that seed localStorage state before render would all fail.
- **Fix:** Changed test approach: vi.mock `@/lib/manual-plan` to replace `loadManualPlan`, `persistManualPlan`, `clearManualPlan` with vi.fn() stubs. Tests control returned plan state via `mU(loadManualPlan).mockReturnValue(...)`. Actual localStorage functions are tested in the unit test suite (`manual-plan.test.ts`).
- **Files modified:** `src/components/planner/ManualPlanTab.test.tsx`
- **Commit:** `d6cbdb6`

## Known Stubs

**window.location.reload() in no-squad submit handler** (`src/components/planner/ManualPlanTab.tsx`, line 251):
- Reason: `ManualPlanTab` receives `submittedId` as read-only prop; no callback to update page-level state.
- Workaround: Writes `fpl_team_id` to localStorage then reloads; `page.tsx` reads it on next mount.
- Future: Plan 03 should add `onTeamIdSubmit?: (id: string) => void` prop or elevate the Team ID input to page.tsx level.

## Threat Flags

No new network endpoints introduced. Security mitigations from threat model applied:
- T-59-05: Team ID input uses `pattern="[0-9]*"` + `inputMode="numeric"` (client-side guard)
- T-59-06: Caveat banner rendered only when `!isAuthenticated && picks !== null`
- T-59-08: All player names rendered as React text nodes — no `dangerouslySetInnerHTML`

## Self-Check: PASSED

- `src/components/planner/ManualPlanTab.tsx` exists: FOUND
- `src/components/planner/ManualPlanTab.test.tsx` exists: FOUND
- RED commit `696ee21`: FOUND
- GREEN commit (Task 1) `d6cbdb6`: FOUND
- GREEN commit (Task 2) `d95823e`: FOUND
- 21/21 tests passing: CONFIRMED
- 0 TypeScript errors: CONFIRMED
