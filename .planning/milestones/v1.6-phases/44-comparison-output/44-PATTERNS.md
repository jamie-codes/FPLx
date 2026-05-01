# Phase 44: Comparison Output - Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 2
**Analogs found:** 2 / 2

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/optimiser/OptimiserPanel.tsx` | component (UI replacement) | request-response (client-side transform) | `src/components/planner/TransferPlanTable.tsx` | role-match (plain HTML table, same `playerMap` lookup pattern, position-grouped sections, delta/badge cells) |
| `src/components/optimiser/OptimiserPanel.test.tsx` | test | — | `src/components/gem-table/PlayerComparisonModal.test.tsx` | role-match (mocked hooks, `data-testid` assertions on comparison/badge UI) |

Secondary analog for position grouping + bench separation logic:
`src/components/planner/SquadSnapshotRow.tsx` — exact same position-group-then-bench pattern using the same GK/DEF/MID/FWD constants.

---

## Pattern Assignments

### `src/components/optimiser/OptimiserPanel.tsx` (component, client-side transform)

**Primary analog:** `src/components/planner/TransferPlanTable.tsx`
**Secondary analog (position grouping):** `src/components/planner/SquadSnapshotRow.tsx`
**Tertiary analog (badge pill shape):** `src/components/gem-table/DifferentialBadge.tsx`

---

#### Imports pattern — carry forward from existing file (lines 1–12):

```typescript
'use client'

import { useState, useMemo } from 'react'
import { useSquad } from '@/lib/hooks/useSquad'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { GwToggle } from '@/components/gem-table/GwToggle'
import { optimiseLineup } from '@/lib/optimise-lineup'
import type { OptimiserHorizon, MergedPlayer } from '@/lib/types'
```

`PlayerCircle` import is removed (sub-component is deleted in Phase 44). No new imports are required — all types already in scope.

---

#### Position constants + horizon field map — preserve unchanged (lines 21–31):

```typescript
const GK = 1
const DEF = 2
const MID = 3
const FWD = 4

const HORIZON_FIELD: Record<OptimiserHorizon, 'xPts_1gw' | 'xPts_3gw' | 'xPts_5gw'> = {
  1: 'xPts_1gw',
  3: 'xPts_3gw',
  5: 'xPts_5gw',
}
```

---

#### Position-group-then-bench pattern
**Source:** `src/components/planner/SquadSnapshotRow.tsx` lines 23–53

```typescript
// Group squad IDs by element_type, collect starters vs bench
const grouped: Record<number, Array<{ id: number; pos: number }>> = { 1: [], 2: [], 3: [], 4: [] }
for (const id of squadAfter) {
  const player = playerMap.get(id)
  if (!player) continue
  const et = player.element_type
  if (et === 1 || et === 2 || et === 3 || et === 4) {
    grouped[et].push({ id, pos: positionsAfter[id] ?? 99 })
  }
}
// Sort each group by position ascending
for (const et of [1, 2, 3, 4] as const) {
  grouped[et].sort((a, b) => a.pos - b.pos)
}
// Separate starters (pos <= 11) from bench (pos >= 12)
const startersByGroup = ...
const benchItems = ...
benchItems.sort((a, b) => a.pos - b.pos)
```

**Phase 44 adaptation:** Replace `positionsAfter` lookup with `SquadPick.position` from `squadData.picks`. Current XI = `picks.filter(p => p.position <= 11)`; current bench = `picks.filter(p => p.position >= 12).sort((a,b) => a.position - b.position)`.

---

#### Plain HTML table structure with `border-collapse`
**Source:** `src/components/planner/TransferPlanTable.tsx` lines 66–75

```typescript
<table className="w-full text-sm">
  <thead>
    <tr className="border-b border-zinc-200 dark:border-zinc-700">
      <th scope="col" className="px-2 py-2 sm:px-4 text-sm font-medium text-zinc-500 dark:text-zinc-400 text-left">GW</th>
      {/* ... more th */}
    </tr>
  </thead>
  <tbody>
    {/* rows */}
  </tbody>
</table>
```

**Phase 44 adaptation:** Use `border-collapse` on `<table>` (required by 44-UI-SPEC.md — prevents double borders). Column widths via `w-[38%]` / `w-[10%]` / `w-[4%]` classes on `<th>`.

---

#### `colSpan` section header row pattern
**Source:** `src/components/planner/TransferPlanTable.tsx` lines 203–207 (the `Hold` colSpan cell)

```typescript
<td colSpan={2} className="px-2 py-2 sm:px-4">
  <span className="text-zinc-400 dark:text-zinc-500">Hold</span>
</td>
```

**Phase 44 adaptation:** Section headers use `colSpan={5}` with the section name (GK / DEF / MID / FWD / Bench):

```typescript
<tr>
  <td colSpan={5}
    className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400 pt-3 pb-1 pl-2 bg-zinc-50 dark:bg-zinc-800/40">
    {section}
  </td>
</tr>
```

Source: 44-UI-SPEC.md §3.

---

#### Badge pill shape
**Source:** `src/components/gem-table/DifferentialBadge.tsx` lines 20–27 and `src/components/shared/MinsRiskBadge.tsx` lines 43–51

```typescript
// Green badge (DIFF / nailed / Promoted):
<span className="inline-block text-xs font-normal rounded px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
  DIFF
</span>

// Zinc/muted badge (cameo / Dropped):
<span className="inline-block text-xs font-normal rounded px-2 py-1 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
  Cameo
</span>
```

**Phase 44 adaptation:** Delta pill uses `px-1 py-0.5` (tighter than existing badges) per 44-UI-SPEC.md §3. Promoted/Dropped badges match the same color semantics but with `font-semibold` instead of `font-normal`:

```typescript
// Delta pill (changed starter):
<span className="text-xs font-semibold text-green-400 bg-green-950 rounded px-1 py-0.5">
  +{delta.toFixed(1)} xPts
</span>

// Promoted badge (bench — optimised player moves into XI):
<span className="text-xs font-semibold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950 rounded px-1 py-0.5">Promoted</span>

// Dropped badge (bench — current starter demoted):
<span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded px-1 py-0.5">Dropped</span>
```

---

#### Changed-row left accent border
**Source:** 44-UI-SPEC.md §3 + CONTEXT.md D-08 (no exact existing analog in codebase — must use UI-SPEC directly)

```typescript
// Changed starter row:
<tr className="border-b border-zinc-100 dark:border-zinc-800 border-l-2 border-l-green-500">
```

**Critical detail:** `border-l-2` (width) AND `border-l-green-500` (color) must both be present. Using only `border-l-2` renders invisible border in Tailwind v4.

---

#### Headline row (single flex row, pipe-separated)
**Source:** `src/components/planner/TransferPlanTable.tsx` lines 59–63 (plan value headline pattern)

```typescript
// Plan value headline — same single-line summary pattern:
<p aria-live="polite" className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
  Plan value: {formatGain(totalNetGain)}
</p>
```

**Phase 44 adaptation:**

```typescript
// HeadlineRow sub-component:
<div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 py-2" data-testid="headline-row">
  <span><span className="font-semibold">Formation:</span> {formation}</span>
  <span className="text-zinc-400">│</span>
  <span><span className="font-semibold">Changes:</span> {changeCount} {changeCount === 1 ? 'player' : 'players'}</span>
  <span className="text-zinc-400">│</span>
  <span className="font-semibold text-green-600 dark:text-green-400">+{xPtsGain.toFixed(1)} xPts gain</span>
</div>
```

Source: 44-UI-SPEC.md §1.

---

#### Desktop/mobile toggle pattern
**Source:** `src/components/planner/TransferPlanTable.tsx` lines 159–161 (hidden sm:table-cell pattern)

```typescript
// Desktop-only column (TransferPlanTable):
<th scope="col" className="hidden sm:table-cell px-2 py-2 sm:px-4 ...">Chip</th>
<td className="hidden sm:table-cell px-2 py-2 sm:px-4">...</td>

// Mobile-only row (TransferPlanTable lines 226–234):
<tr key={`chip-mobile-${i}`} className="sm:hidden border-b border-zinc-200 dark:border-zinc-700">
  <td colSpan={6} className="px-2 py-2 sm:px-4">...</td>
</tr>
```

**Phase 44 adaptation:** Wrap entire `<table>` in `<div className="hidden sm:block">` and mobile card stack in `<div className="sm:hidden">`. Both render the same data from the same `comparisonRows` array.

---

#### Preserved useMemo pattern — carry forward unchanged (lines 80–93):

```typescript
const { playerMap, lineup, eligibleCount, totalPlayersInSquad } = useMemo(() => {
  if (!squadData || !playersData) {
    return { playerMap: new Map<number, MergedPlayer>(), lineup: null, eligibleCount: 0, totalPlayersInSquad: 0 }
  }
  const map = new Map<number, MergedPlayer>(playersData.map(p => [p.id, p]))
  const eligible = squadData.picks.filter(pick => {
    const p = map.get(pick.element)
    if (!p) return false
    return p.xPts_1gw !== 0
  }).length
  const result = optimiseLineup(squadData.picks, playersData, horizon)
  return { playerMap: map, lineup: result, eligibleCount: eligible, totalPlayersInSquad: squadData.picks.length }
}, [squadData, playersData, horizon])
```

The `comparisonRows`, `changeCount`, and `xPtsGain` derivations are added to this same `useMemo` (or a second `useMemo` that depends on `playerMap` and `lineup`).

---

#### pairSection helper — from 44-UI-SPEC.md §4 (no codebase analog — use spec directly):

```typescript
function pairSection(
  currentIds: number[],
  optimisedIds: number[],
  playerMap: Map<number, MergedPlayer>,
  horizonField: 'xPts_1gw' | 'xPts_3gw' | 'xPts_5gw',
  isBench: boolean,
): ComparisonRowData[] {
  const score = (id: number) => (playerMap.get(id)?.[horizonField] as number | undefined) ?? 0
  const sortedCurrent = [...currentIds].sort((a, b) => score(b) - score(a))
  const sortedOptimised = [...optimisedIds].sort((a, b) => score(b) - score(a))
  return sortedCurrent.map((currentId, i) => {
    const optimisedId = sortedOptimised[i]
    const isChanged = currentId !== optimisedId
    const delta = isChanged && !isBench ? score(optimisedId) - score(currentId) : 0
    return { currentId, optimisedId, isChanged, isBench, delta }
  })
}
```

**Bench pairing exception:** Bench slots pair by FPL position order (12→15), NOT by xPts sort. Sort `currentBench` by `SquadPick.position` ascending before calling this function with `isBench=true`.

---

#### Empty/loading/error states — preserve exactly (lines 96–166):

All four early-return branches (empty state, loading state, error state, no-squad-data state) are carried forward unchanged, including all `data-testid` attributes (`optimiser-panel`), copy strings, and Tailwind classes. BGW critical banner (lines 147–166) is also unchanged.

---

### `src/components/optimiser/OptimiserPanel.test.tsx` (test)

**Primary analog:** `src/components/gem-table/PlayerComparisonModal.test.tsx`
**Secondary analog (hook mock pattern):** existing `OptimiserPanel.test.tsx` lines 1–96 (mock setup, fixtures — all preserved)

---

#### Hook mock + fixture pattern — preserve exactly (lines 1–96):

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import type { MergedPlayer } from '@/lib/types'
import type { SquadPick, SquadPicksResponse } from '@/lib/squad-adapter'

const useSquadMock = vi.fn()
const usePlayersMock = vi.fn()

vi.mock('@/lib/hooks/useSquad', () => ({
  useSquad: (id: string | null) => useSquadMock(id),
}))
vi.mock('@/lib/hooks/usePlayers', () => ({
  usePlayers: () => usePlayersMock(),
}))

import { OptimiserPanel } from './OptimiserPanel'
```

All three factory functions (`makePick`, `makePlayer`, `makeValidSquad`) are preserved unchanged. The `beforeEach` mock reset block is preserved unchanged.

---

#### Assertion pattern for `data-testid` elements
**Source:** `src/components/gem-table/PlayerComparisonModal.test.tsx` lines 174–200 and existing `OptimiserPanel.test.tsx` lines 131–148

```typescript
// Presence assertion (existing pattern — carry forward):
expect(container.querySelector('[data-testid="comparison-table"]')).not.toBeNull()
expect(container.querySelector('[data-testid="headline-row"]')).not.toBeNull()

// className assertion (existing pattern from lines 142–149):
const el = container.querySelector('[data-testid="comparison-row-changed"]')
expect(el?.className).toContain('border-l-green-500')

// Text content assertion (existing pattern from lines 138, 243):
expect(container.querySelector('[data-testid="headline-row"]')!.textContent).toContain('Formation:')
expect(container.querySelector('[data-testid="delta-pill"]')!.textContent).toMatch(/\+\d+\.\d xPts/)
```

---

#### Test groups to REMOVE (pitch-specific — Phase 43 only):

| Describe block | Reason for removal |
|---|---|
| `OPT-01 pitch + formation render` (lines 130–159) | `[data-testid="pitch"]`, `[data-testid="formation-label"]`, `[data-testid="bench-row"]` no longer exist |
| `OPT-03 captain / VC badges` (lines 210–234) | `[data-testid^="captain-badge-"]`, `[data-testid^="vc-badge-"]` deleted with `PlayerCircle` |
| `OPT-04 bench row layout` (lines 236–248) | `[data-testid="bench-gk-slot"]`, `[data-testid="bench-divider"]`, `[data-testid^="bench-outfield-"]` deleted |

---

#### Test groups to ADD (Phase 44):

```typescript
describe('CMP-01 comparison table renders', () => {
  it('renders comparison-table and all 5 section headers when lineup is valid', () => {
    // assert: data-testid="comparison-table" present
    // assert: section-header-gk / section-header-def / section-header-mid / section-header-fwd / section-header-bench all present
  })
  it('changed starter rows have border-l-green-500 class and a delta pill', () => {
    // needs a squad fixture where player swap is forced (same technique as OPT-02 — distinct xPts_1gw values)
    // assert: data-testid="comparison-row-changed" has className containing 'border-l-green-500'
    // assert: data-testid="delta-pill" textContent matches /\+\d+\.\d xPts/
  })
  it('unchanged rows have no border-l-green-500 and no delta-pill', () => {
    // squad where all players identical between current and optimised
    // assert: no element with className containing 'border-l-green-500' in table rows
    // assert: no data-testid="delta-pill" present
  })
  it('bench changed rows show Promoted or Dropped badge, not numeric delta', () => {
    // assert: data-testid="badge-promoted" or data-testid="badge-dropped" present
    // assert: no data-testid="delta-pill" in bench section rows
  })
})

describe('CMP-02 headline row', () => {
  it('renders headline row with Formation / Changes / xPts gain copy', () => {
    // assert: data-testid="headline-row" textContent contains 'Formation:'
    // assert: textContent contains 'Changes:'
    // assert: textContent contains 'xPts gain'
  })
  it('change count and xPts gain exclude bench slots', () => {
    // fixture: force bench swap only; assert changeCount = 0 in headline
  })
})

describe('CMP-03 mobile layout structure', () => {
  it('both hidden sm:block table and sm:hidden card stack exist in DOM', () => {
    // assert: container.querySelector('.hidden.sm\\:block table') present
    // assert: container.querySelector('.sm\\:hidden') present
  })
})
```

---

#### OPT-02 horizon toggle — partial rewrite (lines 163–207):

Keep the fixture setup (divergent `xPts_1gw` vs `xPts_5gw` players) and `fireEvent.click(fiveGwBtn)`. Replace the player-circle assertion with a table cell content assertion:

```typescript
// OLD (to remove):
const getStarterCircleIds = () => {
  return Array.from(container.querySelectorAll('[data-testid^="player-circle-"]'))
    .filter(n => !benchRow?.contains(n))
    .map(n => n.getAttribute('data-testid'))
}
expect(initialStarterIds).toContain('player-circle-7')

// NEW (replace with):
// Assert the comparison table shows player name "P7" in a starter row before toggle
// and "P3" in a starter row after toggle — using textContent or data-testid="comparison-table" child lookup
const tableText = () => container.querySelector('[data-testid="comparison-table"]')!.textContent ?? ''
expect(tableText()).toContain('P7')   // P7 is optimised starter at 1GW
expect(tableText()).not.toContain('P3 is a starter') // P3 benched at 1GW
fireEvent.click(fiveGwBtn!)
expect(tableText()).toContain('P3')   // P3 becomes optimised starter at 5GW
```

---

#### OPT-05 BGW critical/soft banners — preserve exactly (lines 250–303):

Both tests only assert on `data-testid="bgw-banner-critical"` and `data-testid="bgw-banner-soft"` — these survive unchanged. The existing `expect(container.querySelector('[data-testid="pitch"]')).toBeNull()` assertion in the critical-banner test must be replaced with `expect(container.querySelector('[data-testid="comparison-table"]')).toBeNull()` (since the comparison table also does not render when `lineup === null`).

---

## Shared Patterns

### useMemo + playerMap derivation
**Source:** `src/components/optimiser/OptimiserPanel.tsx` lines 80–93
**Apply to:** The new `comparisonRows`, `changeCount`, and `xPtsGain` derivations — add to the same memo or a dependent `useMemo(..., [lineup, playerMap, horizonField, squadData])`. Mirrors the existing pattern of computing derived state from `squadData + playersData`.

### Dark mode color pair convention
**Source:** `src/components/gem-table/DifferentialBadge.tsx` and `src/components/shared/MinsRiskBadge.tsx`
**Apply to:** All badge and table cell color classes in Phase 44
**Pattern:** Every color class has a `dark:` variant:
- `bg-green-100 dark:bg-green-950` (not `dark:bg-green-900`)
- `text-green-700 dark:text-green-400`
- `bg-zinc-100 dark:bg-zinc-800` (muted badge)
- `text-zinc-500 dark:text-zinc-400` (secondary text)
- `border-zinc-100 dark:border-zinc-800` (row borders)

### Section header typography
**Source:** `src/components/planner/SquadSnapshotRow.tsx` lines 82–84 and `src/components/gem-table/PlayerComparisonModal.tsx` lines 218–222
**Apply to:** All position-group section headers (GK / DEF / MID / FWD / Bench)
**Pattern:** `text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase`

```typescript
// PlayerComparisonModal:
<h3 className="col-span-full text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide border-b border-zinc-200 dark:border-zinc-700 pb-1 mb-2">

// SquadSnapshotRow:
<h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">GK</h4>
```

Phase 44 uses `<tr><td colSpan={5}>` wrapper instead of `<h4>`, but the typography classes are the same.

### `?? 0` xPts fallback
**Source:** `src/components/optimiser/OptimiserPanel.tsx` line 48 (in deleted `PlayerCircle`)
**Apply to:** All `playerMap.get(id)?.[horizonField]` reads in the `pairSection` helper and `ComparisonRow` renderer

```typescript
const score = (id: number) => (playerMap.get(id)?.[horizonField] as number | undefined) ?? 0
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| n/a | — | — | All patterns have codebase analogs |

The `pairSection` algorithm and `isPromoted` logic are novel to Phase 44 but are fully specified in `44-UI-SPEC.md §4` and `44-RESEARCH.md §Pattern 5`. No codebase analog exists; executor must implement from spec.

---

## Metadata

**Analog search scope:** `src/components/optimiser/`, `src/components/planner/`, `src/components/gem-table/`, `src/components/shared/`
**Files scanned:** 10 source files + 3 phase planning documents
**Pattern extraction date:** 2026-04-30
