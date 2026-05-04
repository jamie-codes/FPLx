# Phase 59: Manual Transfer Planner — Pattern Map

**Mapped:** 2026-05-04
**Files analyzed:** 2 (1 new component, 1 modified page)
**Analogs found:** 2 / 2

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/app/page.tsx` | config/routing | request-response | `src/app/page.tsx` (self — surgical insert) | exact |
| `src/components/planner/ManualPlanTab.tsx` | component (tab container) | CRUD + event-driven | `src/components/planner/PlannerTab.tsx` | exact |

---

## Pattern Assignments

### `src/app/page.tsx` (modify — add `'manual-plan'` SubTab and SECTIONS entry)

**Analog:** Self — surgical two-location insert.

**SubTab union** (line 49 — current value, add `'manual-plan'` to the union):
```typescript
// Line 49 (current):
export type SubTab = 'gems' | 'insights' | 'defcon' | 'set-pieces' | 'planner' | 'club-form' | 'value-gems' | 'accuracy' | 'decision' | 'transfers' | 'optimiser' | 'price-changes' | 'rivals'

// After edit — append 'manual-plan' to the union:
export type SubTab = 'gems' | 'insights' | 'defcon' | 'set-pieces' | 'planner' | 'manual-plan' | 'club-form' | 'value-gems' | 'accuracy' | 'decision' | 'transfers' | 'optimiser' | 'price-changes' | 'rivals'
```

**SECTIONS Plan subTabs array** (lines 68–73 — insert after `'planner'` entry):
```typescript
// Insert after the 'planner' entry (after line 69):
{ id: 'manual-plan' as SubTab, label: 'Manual Plan', mobileLabel: 'Manual' },
```

**Import pattern** (lines 1–27 — add ManualPlanTab import after PlannerTab import, line 18):
```typescript
import { ManualPlanTab } from '@/components/planner/ManualPlanTab'
```

**Render guard pattern** — copy from the `'rivals'` guard at line 214–216, which passes `submittedId`:
```typescript
// Lines 214-216 (rivals pattern — exact render-guard shape to copy):
{activeSection !== 'squad' && activeSubTab === 'rivals' && (
  <RivalsTab submittedId={submittedId} />
)}

// New guard to add (after the rivals guard):
{activeSection !== 'squad' && activeSubTab === 'manual-plan' && (
  <ManualPlanTab submittedId={submittedId} />
)}
```

Note: `submittedId` is already managed at page level (lines 104–112). `ManualPlanTab` receives it so it can seed the Team ID input field when a squad is already loaded, following the same pattern as `RivalsTab`.

---

### `src/components/planner/ManualPlanTab.tsx` (create — new tab component)

**Analog:** `src/components/planner/PlannerTab.tsx`

#### Imports pattern (lines 1–17 of PlannerTab.tsx):

```typescript
'use client'

import { useState, useMemo } from 'react'
import { useImmer } from 'use-immer'
import { HorizonSelector } from './HorizonSelector'
import { ChipToggle } from './ChipToggle'
import { PlayerPickerModal } from './PlayerPickerModal'
import { SquadSnapshotRow } from './SquadSnapshotRow'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { useSquad } from '@/lib/hooks/useSquad'
import { useMyTeam } from '@/lib/hooks/useMyTeam'
import { useAuthStatus } from '@/lib/hooks/useAuthStatus'
import { computeNextFTState, computeHitCost, snapshotSquad } from '@/lib/free-transfer-engine'
import type { FTState, PlannerHorizon, PlannerChip } from '@/lib/types'
```

#### localStorage read pattern (lines 24–26 of PlannerTab.tsx — team ID lazy init):

```typescript
// Read from localStorage with SSR guard — copy this pattern:
const [teamId] = useState<string | null>(() =>
  typeof window !== 'undefined' ? localStorage.getItem('fpl_team_id') : null
)

// ManualPlanTab plan-state variant (lazy initializer):
const [manualPlan, setManualPlan] = useImmer<ManualPlan>(() => {
  if (typeof window === 'undefined') return freshPlan(3)
  try {
    const raw = localStorage.getItem('fplx_manual_plan')
    if (!raw) return freshPlan(3)
    const parsed = JSON.parse(raw)
    if (parsed?.version === 1 && Array.isArray(parsed.steps)) return parsed
    return freshPlan(3)
  } catch {
    return freshPlan(3)
  }
})
```

#### Auth + squad data derivation (lines 29–57 of PlannerTab.tsx — copy verbatim):

```typescript
// Auth status — determines whether to attempt authenticated my-team fetch
const { isAuthenticated } = useAuthStatus()

// Data hooks
const { data: playersData } = usePlayers()
const { data: squadData } = useSquad(teamId)
const { data: myTeamData } = useMyTeam(isAuthenticated)

// Hybrid squad data: prefer authenticated my-team, fall back to public squad (D-12/D-13)
const picks = myTeamData?.picks ?? squadData?.picks ?? null
const bankBalance =
  myTeamData?.entry_history?.bank ?? squadData?.entry_history?.bank ?? 0

// Sell prices: exact when authenticated (D-12); undefined = use now_cost (D-13)
const sellPrices = myTeamData?.picks
  ? Object.fromEntries(myTeamData.picks.map(p => [p.element, p.selling_price]))
  : undefined
```

#### initialFTState derivation (lines 63–70 of PlannerTab.tsx — copy verbatim):

```typescript
const initialFTState: FTState = useMemo(() => {
  if (!isAuthenticated || !myTeamData) return { available: 1, banked: 0 }
  const chip = squadData?.active_chip
  if (chip === 'wildcard' || chip === 'freehit') return { available: 1, banked: 0 }
  const available: 1 | 2 = myTeamData.entry_history.event_transfers === 0 ? 2 : 1
  const banked: 0 | 1 = available === 2 ? 1 : 0
  return { available, banked }
}, [isAuthenticated, myTeamData, squadData])
```

#### Immer mutation pattern (lines 87–91 and 149–158 of PlannerTab.tsx):

```typescript
// Simple top-level set:
updatePlanResult(() => ({ ...result, originalSteps: structuredClone(result.steps) }))

// Targeted nested mutation (DO NOT reconstruct whole object — use draft):
updatePlanResult(draft => {
  if (!draft) return
  const draftStep = draft.steps[stepIndex]
  draftStep.transfersIn = [newBuyId]
  draft.steps.splice(stepIndex + 1, draft.steps.length - stepIndex - 1, ...newStepsFromXPlus1)
})
```

The ManualPlanTab equivalent: when adding/removing a transfer at step `i`, use `updateManualPlan(draft => { draft.steps[i].transfersIn.push(...) })` — never replace the whole `draft.steps` array from scratch.

#### computeNextFTState / computeHitCost call pattern (lines 15, 154, 239 of PlannerTab.tsx):

```typescript
// computeHitCost: (available, transfersUsed, chip) — chip is PlannerChip
const hitCost = computeHitCost(step.freeTransfersAvailable, step.transfersIn.length, step.chip)

// computeNextFTState: called to propagate FT state to next step
const ftNext = computeNextFTState(ftCurrent.available, step.transfersIn.length, step.chip)
```

Both are pure functions — call per step in a sequential loop when recomputing steps `i..N` after any mutation.

#### HorizonSelector wiring (lines 341–343 of PlannerTab.tsx):

```typescript
<HorizonSelector value={horizon} onChange={setHorizon} />
```

On change: truncate `steps` to new length if shrinking; append empty steps if growing (D-04). Then persist to localStorage.

#### ChipToggle wiring (lines 171–176 of PlannerTab.tsx — toggle-off behavior):

```typescript
// Toggle off: if clicked chip === current → set to null (PlannerChip null = no chip)
const newChip: PlannerChip = currentStep.chip === chip ? null : chip
```

In `ManualPlanTab`, the `ChipToggle`'s `onToggle` prop passes the clicked chip code. The component internally handles the toggle-off signal via `aria-pressed` and calls `onToggle(chipCode)` — the parent must implement the `currentChip === clicked ? null : clicked` pattern.

#### PlayerPickerModal wiring (lines 103–195 of PlayerPickerModal.tsx — modal interface):

```typescript
// Props shape (PlayerPickerModal.tsx lines 13-21):
interface PlayerPickerModalProps {
  open: boolean
  position: number              // element_type (1-4) for filtering
  squadIds: Set<number>          // exclude players already in squad
  suggestedPlayerId: number      // pinned at top; pass 0 or -1 when no suggestion
  scoredPlayers: ScoredPlayer[]
  onPick: (playerId: number) => void
  onClose: () => void
}

// Single shared modal instance at tab root (mount once, control via pickerState):
const [pickerState, setPickerState] = useState<{
  open: boolean
  stepIndex: number
  stage: 'sell' | 'buy'
  position: number
  squadIds: Set<number>
  pendingSellId: number | null
} | null>(null)
```

Note: `PlayerPickerModal` requires `position` for its internal filtering. ManualPlanTab needs a two-stage flow (sell first → buy filtered by sell's element_type). Open picker for sell with `position` = 0 is NOT supported — show all 15 squad players in a custom list first, then re-open for buy with the sell player's `element_type`.

#### SquadSnapshotRow props (lines 7-13 of SquadSnapshotRow.tsx):

```typescript
interface SquadSnapshotRowProps {
  squadAfter: number[]                  // 15 player IDs
  positionsAfter: Record<number, number> // playerId → FPL squad position (1-15)
  transfersIn: number[]                 // player IDs newly in (shown with 'IN' label)
  chip: PlannerChip
  playerMap: Map<number, ScoredPlayer>
}
```

For ManualPlanTab: `squadAfter` and `positionsAfter` must be derived from the initial picks + accumulated transfers per step. Build `playerMap` once from `scoredPlayers` via `new Map(scoredPlayers.map(p => [p.id, p]))`.

#### No-squad empty state pattern (RivalsTab.tsx lines 112–130):

```typescript
// When submittedLeagueId === null (no ID yet) — plain space-y-6 with header + form:
if (submittedLeagueId === null) {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">...</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">...</p>
      </header>
      {/* input form */}
    </div>
  )
}
```

ManualPlanTab no-squad branch: same structure, but with Team ID input + "Load Squad" CTA. Team ID state is local to ManualPlanTab (not lifted to page.tsx — D-09 says it is accessible but shows a prompt).

#### Team ID input pattern (TransferPanel.tsx lines 140–154):

```typescript
<form onSubmit={(e) => { e.preventDefault(); handleLoadSquad() }} className="flex flex-col sm:flex-row gap-2 sm:items-end">
  <div className="flex flex-col gap-1">
    <label htmlFor="teamId" className="text-sm text-zinc-600 dark:text-zinc-400">
      FPL Team ID
    </label>
    <input
      id="teamId"
      type="text"
      pattern="[0-9]*"
      inputMode="numeric"
      value={teamId}
      onChange={e => setTeamId(e.target.value)}
      placeholder="e.g. 1234567"
      className="border border-zinc-300 dark:border-zinc-600 rounded px-3 py-1.5 text-base sm:text-sm text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-400 w-full sm:w-40"
    />
  </div>
  <button
    type="submit"
    className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold rounded min-h-[44px] px-3 py-2 text-sm cursor-pointer"
  >
    Load Squad
  </button>
</form>
```

The Load Squad button uses the zinc-inverse accent style (per UI-SPEC) — same as the Rivals "Load Rivals" button pattern.

#### localStorage persist pattern (RivalsTab.tsx lines 46–51):

```typescript
// Write to localStorage on state change — use try/catch, SSR guard:
try { localStorage.setItem(LEAGUE_ID_KEY, trimmed) } catch {}

// ManualPlanTab equivalent (call after every steps/horizon mutation):
function persistManualPlan(plan: ManualPlan) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem('fplx_manual_plan', JSON.stringify(plan)) } catch {}
}
```

#### Unauthenticated caveat banner pattern (amber, from UI-SPEC):

No direct codebase analog exists for the amber banner. Copy the color tokens from the UI-SPEC:

```typescript
// Amber caveat banner — informational, NOT error red:
<div className="rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 px-4 py-3 mb-4">
  <p className="text-sm text-amber-800 dark:text-amber-200">
    Sell prices are approximate — log in to FPL for exact selling prices.
  </p>
</div>

// Render condition (D-13):
{!isAuthenticated && picks !== null && <CaveatBanner />}
```

#### Free / Hit badge pattern (OpportunityCostTable.tsx lines 30–52):

```typescript
// Source badges (OpportunityCostTable.tsx):
'single-free': {
  bg: 'bg-green-100 dark:bg-green-900',
  // text: 'text-green-800 dark:text-green-200' (inferred from file context)
}
'single-hit': {
  bg: 'bg-red-100 dark:bg-red-900',
}

// ManualPlanTab TransferRow badge (per UI-SPEC):
const badgeClass = hitCost === 0
  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
  : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
const badgeLabel = hitCost === 0 ? 'Free' : 'Hit −4 pts'
```

#### formatGain / minus sign convention (plan-helpers.ts lines 32–38):

```typescript
// U+2212 (minus sign) for negative values — NOT hyphen-minus '-':
if (value < 0) {
  return `−${abs} pts`
}
// Apply same convention to Hit badge label and Hit cost summary:
// 'Hit −4 pts'  →  'Hit −4 pts'
// '−{N} pts'   →  '−N pts' in summary header
```

#### Dark-mode class pattern (PlannerTab.tsx / SquadSnapshotRow.tsx / throughout):

```typescript
// Page/card surface:
'bg-white dark:bg-zinc-900'
// Secondary surface (summary band, accordion, hover):
'bg-zinc-50 dark:bg-zinc-800'
// Primary text:
'text-zinc-900 dark:text-zinc-100'
// Muted / helper text:
'text-zinc-500 dark:text-zinc-400'
// Border:
'border-zinc-200 dark:border-zinc-700'
// Inner row divider:
'border-zinc-100 dark:border-zinc-700'
```

---

## New Types Required

`ManualPlanTab.tsx` needs types that do NOT exist in `src/lib/types.ts`. Define them locally in the component file (or a co-located `manual-plan-types.ts`). Prefer extending existing shapes.

**Guidance:** `GWStep` (types.ts line 419) is close but carries `scoredTransfers` / `squadAfter` / `positionsAfter` only on `PlanStep`. ManualPlanTab step shape is simpler — no engine scoring.

```typescript
// Define locally in ManualPlanTab.tsx (or manual-plan-types.ts):

export interface ManualTransfer {
  sellId: number      // player ID sold
  buyId: number       // player ID bought
  hitCost: number     // 0 or -4 (derived, not stored — recompute on render)
  // xPts delta for break-even: (scoredPlayers.get(buyId)?.xPts_1gw ?? 0) - (scoredPlayers.get(sellId)?.xPts_1gw ?? 0)
}

export interface ManualStep {
  gw: number
  chip: PlannerChip           // re-use existing union from types.ts
  transfers: ManualTransfer[] // unlimited per D-07
  // squadAfter / positionsAfter are DERIVED on render — not serialized to localStorage
}

export interface ManualPlan {
  version: 1
  horizon: PlannerHorizon     // re-use existing type from types.ts
  steps: ManualStep[]
}
```

Serialization to localStorage: only `ManualPlan` is persisted. `squadAfter` / `positionsAfter` are derived at render time by replaying transfers on top of `initialSquad` picks.

---

## Shared Patterns

### Authentication
**Source:** `src/lib/hooks/useAuthStatus.ts` (lines 14–41)  
**Apply to:** `ManualPlanTab.tsx`
```typescript
const { isAuthenticated } = useAuthStatus()
// isAuthenticated: boolean — false until auth-status query resolves
// useMyTeam(isAuthenticated) — pass boolean directly as the `enabled` arg
```

### Sell Price Derivation
**Source:** `src/components/planner/PlannerTab.tsx` (lines 55–57)  
**Apply to:** `ManualPlanTab.tsx`
```typescript
const sellPrices = myTeamData?.picks
  ? Object.fromEntries(myTeamData.picks.map(p => [p.element, p.selling_price]))
  : undefined
// When undefined: fall back to now_cost for sell price calculations (D-13)
// When authenticated: exact selling_price per pick (D-12)
```

### Bank Balance Starting Point
**Source:** `src/components/planner/PlannerTab.tsx` (lines 53–54)  
**Apply to:** `ManualPlanTab.tsx`
```typescript
const bankBalance =
  myTeamData?.entry_history?.bank ?? squadData?.entry_history?.bank ?? 0
// Units: tenths of £1m (divide by 10 for display: £X.Xm)
```

### initialFTState
**Source:** `src/components/planner/PlannerTab.tsx` (lines 63–70)  
**Apply to:** `ManualPlanTab.tsx` — copy verbatim (identical derivation required)
```typescript
const initialFTState: FTState = useMemo(() => {
  if (!isAuthenticated || !myTeamData) return { available: 1, banked: 0 }
  const chip = squadData?.active_chip
  if (chip === 'wildcard' || chip === 'freehit') return { available: 1, banked: 0 }
  const available: 1 | 2 = myTeamData.entry_history.event_transfers === 0 ? 2 : 1
  const banked: 0 | 1 = available === 2 ? 1 : 0
  return { available, banked }
}, [isAuthenticated, myTeamData, squadData])
```

### SSR Guard for localStorage
**Source:** `src/app/page.tsx` (lines 102–105), `src/components/rivals/RivalsTab.tsx` (line 35)  
**Apply to:** `ManualPlanTab.tsx` — all localStorage reads and writes
```typescript
// Read (lazy initializer):
typeof window !== 'undefined' ? localStorage.getItem('fpl_team_id') : null

// Write (persist helper):
if (typeof window === 'undefined') return
try { localStorage.setItem(key, value) } catch {}
```

### Error Handling for Hook Data
**Source:** `src/components/planner/PlannerTab.tsx` (lines 73–74) — canGenerate guard  
**Apply to:** `ManualPlanTab.tsx` — guard all derived computations on `picks != null`
```typescript
// Never derive bank/FT/snapshot without confirming picks are loaded:
const picks = myTeamData?.picks ?? squadData?.picks ?? null
if (!picks) { /* render no-squad branch */ }
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| (none) | — | — | All patterns have close analogs in the codebase |

The amber caveat banner (D-13) has no existing codebase instance, but its color tokens are fully specified in the UI-SPEC and are derivable from the project's Tailwind config. No analog search needed — implement from spec.

---

## Metadata

**Analog search scope:** `src/app/`, `src/components/planner/`, `src/components/rivals/`, `src/components/transfers/`, `src/lib/hooks/`, `src/lib/types.ts`, `src/lib/free-transfer-engine.ts`, `src/lib/plan-helpers.ts`
**Files scanned:** 14
**Pattern extraction date:** 2026-05-04
