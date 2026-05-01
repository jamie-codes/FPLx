# Phase 39: Player Comparison Modal - Pattern Map

**Mapped:** 2026-04-29
**Files analyzed:** 4 (1 new, 3 modified)
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/gem-table/PlayerComparisonModal.tsx` | component (modal) | request-response | `src/components/planner/PlayerPickerModal.tsx` | exact |
| `src/components/gem-table/columns.tsx` | config (column defs) | event-driven | `src/components/gem-table/columns.tsx` (self — adding callback threading) | self-modification |
| `src/components/gem-table/GemTable.tsx` | component (table host) | event-driven | `src/components/gem-table/GemTable.tsx` (self — adding prop + state) | self-modification |
| `src/app/page.tsx` | component (page) | event-driven | `src/app/page.tsx` (self — adding state + modal mount) | self-modification |

---

## Pattern Assignments

### `src/components/gem-table/PlayerComparisonModal.tsx` (new component, request-response)

**Analog:** `src/components/planner/PlayerPickerModal.tsx`

**Directive and imports pattern** (lines 1–4):
```tsx
'use client'

import { useRef, useEffect, useState } from 'react'
import type { ScoredPlayer } from '@/lib/types'
```
New modal additionally imports badge components and hooks:
```tsx
import { usePlayers } from '@/lib/hooks/usePlayers'
import { computeAllGemScores } from '@/lib/gem-score'
import { FixtureBadges } from '@/components/fixtures/FixtureBadges'
import { MinsRiskBadge } from '@/components/shared/MinsRiskBadge'
import { VarianceBadge } from '@/components/gem-table/VarianceBadge'
import { RegressionSignalBadge } from '@/components/gem-table/RegressionSignalBadge'
import { DifferentialBadge } from '@/components/gem-table/DifferentialBadge'
import { XPtsCell, fmtScore, fmtScoreNull } from '@/components/gem-table/columns'
```
Note: `fmtScore`/`fmtScoreNull`/`XPtsCell` need to be exported from `columns.tsx` (currently unexported).

**Props interface pattern** (lines 13–21 of PlayerPickerModal as shape guide):
```tsx
interface PlayerComparisonModalProps {
  open: boolean
  playerA: ScoredPlayer
  onClose: () => void
}
// scoredPlayers sourced internally via usePlayers() + computeAllGemScores() — TanStack deduplicates
```

**Dialog lifecycle pattern** (lines 32–77):
```tsx
const dialogRef = useRef<HTMLDialogElement>(null)
const searchRef = useRef<HTMLInputElement>(null)
const [search, setSearch] = useState('')
const [playerB, setPlayerB] = useState<ScoredPlayer | null>(null)

// Open/close with double-open guard
useEffect(() => {
  const el = dialogRef.current
  if (!el) return
  if (open) {
    if (!el.open) el.showModal()
  } else {
    if (el.open) el.close()
  }
}, [open])

// Auto-focus search input — 50ms delay for dialog visibility
useEffect(() => {
  if (open) {
    const timer = setTimeout(() => { searchRef.current?.focus() }, 50)
    return () => clearTimeout(timer)
  }
}, [open])

// Reset search + playerB on close
useEffect(() => {
  if (!open) {
    setSearch('')
    setPlayerB(null)
  }
}, [open])

// Escape key sync via native 'close' event
useEffect(() => {
  const el = dialogRef.current
  if (!el) return
  const handleClose = () => onClose()
  el.addEventListener('close', handleClose)
  return () => el.removeEventListener('close', handleClose)
}, [onClose])

// Backdrop click to dismiss
const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
  if (e.target === dialogRef.current) onClose()
}
```

**Dialog element pattern** (line 104–107):
```tsx
<dialog
  ref={dialogRef}
  onClick={handleDialogClick}
  className="rounded-lg bg-white dark:bg-zinc-900 p-4 max-w-2xl w-full max-h-[80vh] flex flex-col border border-zinc-200 dark:border-zinc-700 shadow-lg"
>
```
Use `max-w-2xl` (wider than `PlayerPickerModal`'s `max-w-md`) for the two-column layout.

**Header + close button pattern** (lines 111–122):
```tsx
<div className="flex items-center justify-between">
  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
    Compare Players
  </h2>
  <button
    type="button"
    onClick={onClose}
    className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer active:scale-95 transition-transform"
    aria-label="Close"
  >
    ✕
  </button>
</div>
```

**Search input pattern** (lines 126–134):
```tsx
<input
  ref={searchRef}
  type="text"
  placeholder="Search for player B…"
  value={search}
  onChange={e => setSearch(e.target.value)}
  className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
  style={{ fontSize: '16px' }}
/>
```
The `style={{ fontSize: '16px' }}` inline style is mandatory — prevents iOS Safari auto-zoom. This is the only permitted inline style (per CONTEXT.md).

**Player B search list pattern** (lines 136–191 of PlayerPickerModal, adapted):
```tsx
<div className="overflow-y-auto max-h-40 divide-y divide-zinc-100 dark:divide-zinc-800">
  {filteredPlayers.map(player => (
    <button
      type="button"
      key={player.id}
      onClick={() => { setPlayerB(player); setSearch('') }}
      className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm text-zinc-900 dark:text-zinc-100 truncate">{player.web_name}</span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">{player.team_short_name}</span>
      </div>
    </button>
  ))}
  {filteredPlayers.length === 0 && (
    <p className="px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400 text-center">No players found</p>
  )}
</div>
```
Filter: `scoredPlayers.filter(p => p.id !== playerA.id && (search.trim() === '' || p.web_name.toLowerCase().includes(search.toLowerCase())))` — no position filter per D-04. Collapse the list when `playerB !== null && search === ''`.

**Two-column data section layout pattern** (from RESEARCH.md Pattern 4):
```tsx
<div className="overflow-y-auto flex-1 min-h-0">
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    {/* Section header spans both columns */}
    <h3 className="col-span-1 sm:col-span-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide border-b border-zinc-200 dark:border-zinc-700 pb-1 mt-3">
      xPts Projection
    </h3>
    {/* Player A column */}
    <div className="space-y-1">
      {/* A values */}
    </div>
    {/* Player B column — or placeholder */}
    <div className="space-y-1">
      {playerB ? (/* B values */) : (
        <p className="text-sm text-zinc-400 dark:text-zinc-500 italic">Search for a player to compare</p>
      )}
    </div>
  </div>
</div>
```

**xPts section — XPtsCell reuse pattern** (from columns.tsx lines 125–160):
```tsx
{/* Each row: label + XPtsCell for playerA, XPtsCell for playerB */}
<div className="flex items-center justify-between text-sm">
  <span className="text-zinc-500 dark:text-zinc-400 text-xs">1 GW</span>
  <XPtsCell
    value={player.xPts_1gw}
    ceiling={player.xPts_ceiling_1gw}
    components={player.xPts_components_1gw ?? undefined}
    window={1}
  />
</div>
```
For `xPts_90th_1gw`: use `player.xPts_90th_1gw?.toFixed(1) ?? '—'` — field is optional per types.ts line 173.

**Gem scores section — fmtScore/fmtScoreNull pattern** (from columns.tsx lines 14–16):
```tsx
// Non-null scores (gem_score, fdr_score, form_score, ownership_score, minutes_score, set_piece_score)
const display = fmtScore(player.gem_score)   // (v * 100).toFixed(0)

// Nullable scores (xg_score, xa_score) — use fmtScoreNull
const display = fmtScoreNull(player.xg_score)  // v === null ? '—' : (v * 100).toFixed(0)
```
Fields and their null-safety:
- `gem_score`, `fdr_score`, `form_score`, `ownership_score`, `minutes_score`, `set_piece_score` — `number` — use `fmtScore`
- `xg_score`, `xa_score` — `number | null` — use `fmtScoreNull`

**Signals section — badge component usage** (from RESEARCH.md Code Examples):
```tsx
<RegressionSignalBadge signal={player.regression_signal} delta={player.actual_vs_xg_delta} />
<DifferentialBadge flag={player.differential_flag} ownership={parseFloat(player.selected_by_percent ?? '0')} />
<MinsRiskBadge minsRisk={player.mins_risk} />
```
All three handle `null`/`undefined` gracefully with an em-dash fallback — no null guards needed at call site.

**Fixtures section — FixtureBadges usage** (from columns.tsx line 226):
```tsx
<FixtureBadges fixtures={player.fixtures.slice(0, 5)} />
```

**Internal data source pattern** (from RESEARCH.md Open Question 1):
```tsx
// Inside PlayerComparisonModal — TanStack Query deduplicates the fetch
const { data } = usePlayers()
const scoredPlayers = useMemo(() => computeAllGemScores(data ?? []), [data])
```

---

### `src/components/gem-table/columns.tsx` (modified — add callback factory + exports)

**Analog:** `src/components/gem-table/columns.tsx` (self-modification)

**Current export pattern** (line 58):
```tsx
export const columns = [
  col.accessor('web_name', { header: 'Player', enableSorting: true }),
  // ...
]
```

**Target pattern — factory function** (from RESEARCH.md Pattern 2):
```tsx
export function createColumns(onCompare: (player: ScoredPlayer) => void) {
  return [
    col.accessor('web_name', {
      header: 'Player',
      enableSorting: true,
      cell: ({ row }) => (
        <div className="relative group/name flex items-center gap-1">
          <span>{row.original.web_name}</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCompare(row.original) }}
            className="opacity-0 group-hover/name:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 ml-1 text-xs cursor-pointer"
            aria-label={`Compare ${row.original.web_name}`}
          >
            ⊞
          </button>
        </div>
      ),
    }),
    // ... remaining columns unchanged
  ]
}
```
Critical: keep `col.accessor('web_name', ...)` (not `col.display`) to preserve TanStack Table's automatic sort on `web_name`. A custom `cell` on an accessor column is valid in TanStack Table v8.

**Exports to add** (currently unexported, needed by `PlayerComparisonModal`):
```tsx
export const fmtScore = (v: number) => (v * 100).toFixed(0)
export const fmtScoreNull = (v: number | null) => (v === null ? '—' : (v * 100).toFixed(0))
// XPtsCell is already exported (line 23: export function XPtsCell)
```

**Mobile action sheet trigger on player name cell** (inside `createColumns` web_name cell, RESEARCH.md Pattern 3):
```tsx
// Mobile tap: show inline action sheet below the name
// Uses a separate onMobileAction prop or the same onCompare — keep it the same callback
// e.stopPropagation() prevents row expand (tr onClick handler)
onClick={(e) => { e.stopPropagation(); onCompare(row.original) }}
```
The mobile action sheet state (`actionSheetPlayer`) lives in `GemTable.tsx`, not in columns. The columns cell only fires `onCompare` — the action sheet is rendered elsewhere.

---

### `src/components/gem-table/GemTable.tsx` (modified — thread onCompare prop + mobile action sheet)

**Analog:** `src/components/gem-table/GemTable.tsx` (self-modification)

**Current props interface** (lines 45–48):
```tsx
interface GemTableProps {
  preset?: ViewPreset
  onPresetChange?: (p: ViewPreset) => void
}
```

**Target props interface:**
```tsx
interface GemTableProps {
  preset?: ViewPreset
  onPresetChange?: (p: ViewPreset) => void
  onCompare?: (player: ScoredPlayer) => void
}
```

**columns import change** (line 19):
```tsx
// Before:
import { columns } from './columns'

// After:
import { createColumns } from './columns'
```

**columns useMemo with callback stability** (from RESEARCH.md Pitfall 2):
```tsx
// Stable callback via useCallback to prevent column array recreation on every render
const handleCompare = useCallback((player: ScoredPlayer) => {
  onCompare?.(player)
}, [onCompare])

const columns = useMemo(() => createColumns(handleCompare), [handleCompare])
```

**Table instantiation change** (line 89–101):
```tsx
const table = useReactTable({
  data: scoredPlayers,
  columns,   // now from useMemo above, not static import
  // ...rest unchanged
})
```

**Mobile action sheet state** (new local state, alongside existing `isMobile`):
```tsx
const [actionSheetPlayer, setActionSheetPlayer] = useState<ScoredPlayer | null>(null)
```
Render the action sheet inline in the expanded row or as a floating div when `actionSheetPlayer !== null`. Action sheet "Compare" button calls `onCompare?.(actionSheetPlayer)` then `setActionSheetPlayer(null)`.

**Row onClick — stop propagation guard** (line 180, existing):
```tsx
// Existing:
onClick={() => { if (isMobile) row.toggleExpanded() }}

// The compare button in the cell handles its own e.stopPropagation() — no change to <tr> onClick needed.
```

**Existing isMobile/isPortrait detection pattern** (lines 62–76) — no change needed, already in place.

---

### `src/app/page.tsx` (modified — add comparePlayer state + modal mount)

**Analog:** `src/app/page.tsx` (self-modification)

**Existing state pattern to mirror** (line 59):
```tsx
const [gemPreset, setGemPreset] = useState<ViewPreset>('default')
```

**New state additions** (after line 59):
```tsx
const [comparePlayer, setComparePlayer] = useState<ScoredPlayer | null>(null)
const [compareOpen, setCompareOpen] = useState(false)
```

**New import additions** (alongside existing imports):
```tsx
import type { ScoredPlayer } from '@/lib/types'
import { PlayerComparisonModal } from '@/components/gem-table/PlayerComparisonModal'
```

**handleCompare callback — useCallback for stability** (per RESEARCH.md Pitfall 2):
```tsx
const handleCompare = useCallback((player: ScoredPlayer) => {
  setComparePlayer(player)
  setCompareOpen(true)
}, [])
```

**GemTable call site change** (line 124):
```tsx
// Before:
<GemTable preset={gemPreset} onPresetChange={setGemPreset} />

// After:
<GemTable preset={gemPreset} onPresetChange={setGemPreset} onCompare={handleCompare} />
```

**Modal mount at page level** (after the GemTable block, still inside `activeSubTab === 'gems'` guard):
```tsx
{activeSection !== 'squad' && activeSubTab === 'gems' && (
  <>
    <GemTable preset={gemPreset} onPresetChange={setGemPreset} onCompare={handleCompare} />
    <CaptainPicksPanel />
  </>
)}
{comparePlayer && (
  <PlayerComparisonModal
    open={compareOpen}
    playerA={comparePlayer}
    onClose={() => setCompareOpen(false)}
  />
)}
```
Modal is rendered outside the `activeSubTab === 'gems'` guard so it remains mounted when the user navigates away while the modal is open. `scoredPlayers` is NOT passed as prop — modal fetches internally via `usePlayers()`.

---

## Shared Patterns

### `'use client'` directive
**Source:** `src/components/planner/PlayerPickerModal.tsx` line 1; `src/components/gem-table/GemTable.tsx` line 1
**Apply to:** `PlayerComparisonModal.tsx` (uses `useState`/`useEffect`/`useRef`)
```tsx
'use client'
```
Required at top of file before any imports. Next.js 16 App Router default is Server Component; opt-in to Client Component with this directive.

### Badge visual convention
**Source:** `src/components/gem-table/RegressionSignalBadge.tsx` lines 19–27; `VarianceBadge.tsx` lines 7–24; `MinsRiskBadge.tsx` lines 47–52
**Apply to:** All badge usages in `PlayerComparisonModal.tsx`

Common badge envelope across all badge components:
```tsx
className="inline-block text-xs font-normal rounded px-2 py-1 bg-{color}-100 dark:bg-{color}-900 text-{color}-800 dark:text-{color}-200"
```
Tooltip via native `title` attribute — no Radix/custom tooltip components.

### Dark mode Tailwind pattern
**Source:** `src/components/planner/PlayerPickerModal.tsx` line 107
**Apply to:** All new UI elements in `PlayerComparisonModal.tsx`
```
bg-white dark:bg-zinc-900
text-zinc-900 dark:text-zinc-100
border-zinc-200 dark:border-zinc-700
text-zinc-500 dark:text-zinc-400
hover:text-zinc-700 dark:hover:text-zinc-200
```
Every Tailwind colour class must have a `dark:` counterpart. No inline styles except `fontSize: '16px'` on the search input.

### `e.stopPropagation()` on interactive cells
**Source:** `src/components/gem-table/GemTable.tsx` line 180 (row `onClick` pattern); RESEARCH.md Pitfall 3
**Apply to:** Compare icon button in `columns.tsx` web_name cell, mobile action sheet trigger
```tsx
onClick={(e) => { e.stopPropagation(); onCompare(row.original) }}
```
Required because `<tr onClick={() => row.toggleExpanded()}>` is the parent event handler on mobile.

### TanStack Table `useMemo` + `useCallback` stability
**Source:** `src/components/gem-table/GemTable.tsx` lines 51–53 (`scoredPlayers` useMemo); RESEARCH.md Pitfall 2
**Apply to:** `createColumns(handleCompare)` call in `GemTable.tsx`; `handleCompare` definition in `page.tsx`
```tsx
// GemTable.tsx
const handleCompare = useCallback((player: ScoredPlayer) => { onCompare?.(player) }, [onCompare])
const columns = useMemo(() => createColumns(handleCompare), [handleCompare])

// page.tsx
const handleCompare = useCallback((player: ScoredPlayer) => {
  setComparePlayer(player)
  setCompareOpen(true)
}, [])
```

### Test mock pattern
**Source:** `src/app/page.test.tsx` lines 6–17
**Apply to:** `src/app/page.test.tsx` (new mock for `PlayerComparisonModal`)
```tsx
vi.mock('@/components/gem-table/PlayerComparisonModal', () => ({
  PlayerComparisonModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="comparison-modal" /> : null,
}))
```
Also mock `GemTable` to capture `onCompare` prop:
```tsx
vi.mock('@/components/gem-table/GemTable', () => ({
  GemTable: ({ onCompare }: { onCompare?: (p: unknown) => void }) => (
    <div data-testid="gem-table">
      <button onClick={() => onCompare?.({ id: 1, web_name: 'Test' } as never)}>compare</button>
    </div>
  ),
}))
```

### RTL + Vitest test file structure
**Source:** `src/components/gem-table/PresetToggle.test.tsx` lines 1–41; `src/app/page.test.tsx` lines 1–20
**Apply to:** `PlayerComparisonModal.test.tsx`, `columns.test.tsx`
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
```
Mock heavy dependencies (TanStack Query, `usePlayers`) at top of test file. Assert on `data-testid` attributes or ARIA roles/labels, not on implementation internals.

---

## ScoredPlayer Fields Reference for Modal Sections

**Source:** `src/lib/types.ts` lines 199–208 (`ScoredPlayer`), lines 90–174 (`MergedPlayer`)

| Section | Fields | Null-safety |
|---------|--------|-------------|
| xPts | `xPts_1gw`, `xPts_3gw`, `xPts_5gw` | `?: number` — use `?? 0` or `XPtsCell` which guards internally |
| xPts ceiling | `xPts_90th_1gw` | `?: number` — use `?.toFixed(1) ?? '—'` |
| xPts ceiling badge | `xPts_ceiling_1gw` | `?: boolean` — `VarianceBadge` handles `undefined` |
| Gem composite | `gem_score` | `number` — use `fmtScore` |
| Gem components | `fdr_score`, `form_score`, `ownership_score`, `minutes_score`, `set_piece_score` | `number` — use `fmtScore` |
| Gem components (nullable) | `xg_score`, `xa_score` | `number \| null` — use `fmtScoreNull` |
| Fixtures | `fixtures` | `FixtureEntry[]` — always present, `.slice(0,5)` |
| Signal | `regression_signal`, `actual_vs_xg_delta` | `?: 'buy' \| 'sell' \| null` — `RegressionSignalBadge` handles all |
| Differential | `differential_flag`, `selected_by_percent` | `?: 'diff' \| 'trap' \| null` — `DifferentialBadge` handles all |
| Mins risk | `mins_risk` | `MinsRisk` — `MinsRiskBadge` returns null for 'injured' |

---

## No Analog Found

All files have close analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `src/components/`, `src/app/`, `src/lib/`
**Files read:** 12
**Pattern extraction date:** 2026-04-29
