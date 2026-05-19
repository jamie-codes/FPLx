# Phase 122: Polish Carry-Forwards - Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 2 (modified) + 5 (verify-only)
**Analogs found:** 2 / 2 primary targets

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/planner/RouteTreeTab.tsx` | component | request-response | `src/components/planner/ManualPlanTab.tsx` | exact |
| `src/components/transfers/OpportunityCostTable.tsx` | component | request-response | `src/components/squad/SquadView.tsx` (MinsRiskBadge usage) | role-match |
| `src/components/squad/SquadView.tsx` | component | request-response | — (verify only, no change) | — |
| `src/components/gem-table/columns.tsx` | config | transform | — (verify only, no change) | — |
| `src/components/gem-table/PlayerComparisonModal.tsx` | component | request-response | — (verify only, no change) | — |

---

## Pattern Assignments

### `src/components/planner/RouteTreeTab.tsx` — POL-01 and POL-02

**Analog:** `src/components/planner/ManualPlanTab.tsx`

#### POL-01: Replace hardcoded chipMode with useState

**Current code at line 90 (to delete):**
```typescript
const chipMode: PlannerChip = null
```

**Replacement — copy useState pattern from ManualPlanTab (state declaration style):**
```typescript
const [chipMode, setChipMode] = useState<PlannerChip>(null)
```

`useState` is already imported at line 7. `PlannerChip` is already imported at line 16. No new imports needed.

#### POL-01: ChipToggle handler pattern

**Source:** `ManualPlanTab.tsx` lines 191–198 (`handleChipToggle`)

The toggle-deselect idiom — clicking the active chip sets it back to `null`:
```typescript
// ManualPlanTab.tsx lines 191–198
const handleChipToggle = useCallback(
  (stepIndex: number, chip: PlannerChip) => {
    updatePlan((draft) => {
      const cur = draft.steps[stepIndex].chip
      draft.steps[stepIndex].chip = cur === chip ? null : chip
    })
  },
  [updatePlan]
)
```

RouteTreeTab has no per-step chip — it is one chip for the whole tree. Adapt to a simpler inline form (no `useCallback` required, or wrap if desired):
```typescript
// RouteTreeTab: inline toggle passed to onToggle prop
onToggle={(chip) => setChipMode(prev => prev === chip ? null : chip)}
```

The deselect logic is identical: `prev === chip ? null : chip`.

#### POL-01: ChipToggle render — wire and un-disable

**Current code at lines 234–239 (to replace):**
```typescript
<ChipToggle
  gw={startingGw ?? 1}
  activeChip={null}
  onToggle={() => {}}
  disabled={true}
/>
```

**Replacement — wire state, remove disabled:**
```typescript
<ChipToggle
  gw={startingGw ?? 1}
  activeChip={chipMode}
  onToggle={(chip) => setChipMode(prev => prev === chip ? null : chip)}
/>
```

`disabled` prop omitted entirely (ChipToggle interface: `disabled?: boolean`, so omitting = not disabled).

#### POL-01: useMemo dependency array

`chipMode` is already listed in the `tree` useMemo dependency array at line 108. No change needed there — the reactive binding is already correct once `chipMode` becomes state.

#### POL-02: Column header label fix

**Current code at line 269:**
```typescript
<th scope="col" className="px-3 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide text-left">Hits</th>
```

**Replacement — change inner text only:**
```typescript
<th scope="col" className="px-3 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide text-left">Transfer Hits</th>
```

---

### `src/components/transfers/OpportunityCostTable.tsx` — POL-04

**Analog:** `src/components/squad/SquadView.tsx` (MinsRiskBadge call at line 224), `src/components/gem-table/PlayerComparisonModal.tsx` (line 172)

#### POL-04: Import addition

`MinsRiskBadge` is **not** currently imported in `OpportunityCostTable.tsx`. Current import block (lines 1–18) ends with `StatusLabelBadge`. Add the import after it:

```typescript
import { MinsRiskBadge } from '@/components/shared/MinsRiskBadge'
```

#### POL-04: Badge insertion in buy-player cluster

**Current buy-player badge cluster in `PlayerMoveCell` (lines 140–143):**
```typescript
<RotationRiskBadge rotationRisk={t.buy.rotation_risk ?? false} />
{/* Phase 119 UI-02: StatusLabelBadge for buy candidate (D-09): after RotationRiskBadge, before NewsBanner */}
<StatusLabelBadge statusLabel={lineupNewsMap?.get(t.buy.id)?.status_label} />
{/* Phase 88 SCRAPER-01: news banner for buy candidate (D-07) */}
<NewsBanner ...
```

**Replacement — append MinsRiskBadge after StatusLabelBadge, before NewsBanner:**
```typescript
<RotationRiskBadge rotationRisk={t.buy.rotation_risk ?? false} />
{/* Phase 119 UI-02: StatusLabelBadge for buy candidate (D-09): after RotationRiskBadge, before NewsBanner */}
<StatusLabelBadge statusLabel={lineupNewsMap?.get(t.buy.id)?.status_label} />
{/* Phase 122 POL-04: MinsRiskBadge for buy candidate — minutes confidence signal */}
<MinsRiskBadge minsRisk={t.buy.mins_risk} />
{/* Phase 88 SCRAPER-01: news banner for buy candidate (D-07) */}
<NewsBanner ...
```

**Data field:** `t.buy` is typed as `ScoredPlayer` (confirmed via `computeFragility(t.buy, true, ...)` at line 127). `ScoredPlayer.mins_risk: MinsRisk` is defined in `src/lib/types.ts` line 150. The field is always present — no optional chaining required, matching the usage in `SquadView.tsx:224` (`player.mins_risk`) and `PlayerComparisonModal.tsx:172` (`p.mins_risk`).

**MinsRiskBadge component contract** (from `src/components/shared/MinsRiskBadge.tsx` lines 42–65):
```typescript
export function MinsRiskBadge({
  minsRisk,
  mins60Prob,
}: {
  minsRisk: MinsRisk | undefined
  mins60Prob?: number
}) {
  // Returns null when minsRisk is undefined or 'injured' — safe to render unconditionally
}
```

Pass only `minsRisk={t.buy.mins_risk}` — `mins60Prob` is optional and not required here (OCS table does not have that field on the transfer leg).

---

## Shared Patterns

### ChipToggle component interface
**Source:** `src/components/planner/ChipToggle.tsx` lines 8–13
```typescript
interface ChipToggleProps {
  gw: number
  activeChip: PlannerChip      // PlannerChip = 'wildcard' | 'freehit' | 'bboost' | '3xc' | null
  onToggle: (chip: PlannerChip) => void
  disabled?: boolean            // omit to enable; present + true = pointer-events-none + opacity-50
}
```
Apply to: RouteTreeTab POL-01 wiring.

### MinsRiskBadge null-safety
**Source:** `src/components/shared/MinsRiskBadge.tsx` lines 37–40
```typescript
export function getMinsRiskConfig(minsRisk: MinsRisk | undefined): Config | null {
  if (!minsRisk || minsRisk === 'injured') return null
  return BADGE_MAP[minsRisk] ?? null
}
```
The component already handles `undefined` and `'injured'` by returning `null`. Render it unconditionally — no wrapping `if` guard needed. Apply to: OpportunityCostTable POL-04.

### Badge cluster left-to-right ordering in OpportunityCostTable
**Source:** `src/components/transfers/OpportunityCostTable.tsx` lines 140–148 (existing order)
Order established: `RotationRiskBadge` → `StatusLabelBadge` → `(MinsRiskBadge)` → `NewsBanner`
MinsRiskBadge slots between StatusLabelBadge and NewsBanner per CONTEXT.md D-05 and D-36 signal ordering.

---

## Verify-Only Reference Points

Files that require no code change — downstream agent confirms visibility only:

| File | Line | What to confirm |
|---|---|---|
| `src/components/squad/SquadView.tsx` | 224 | `<MinsRiskBadge minsRisk={player.mins_risk} />` present and renders in Transfers tab player rows |
| `src/components/gem-table/columns.tsx` | 271–276 | `mins_risk` column defined in `createColumns`; not in any hidden-columns preset; visible on desktop |
| `src/components/gem-table/PlayerComparisonModal.tsx` | 172 | `<MinsRiskBadge minsRisk={p.mins_risk} />` inside `renderSignalsColumn`, shown for both compared players |

---

## No Analog Found

None — all modified files have strong analogs in the codebase.

---

## Metadata

**Analog search scope:** `src/components/planner/`, `src/components/transfers/`, `src/components/squad/`, `src/components/gem-table/`, `src/components/shared/`
**Files scanned:** 8 (5 read in full, 3 read in targeted ranges)
**Pattern extraction date:** 2026-05-18
