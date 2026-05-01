# Phase 37: GemTable View Presets - Pattern Map

**Mapped:** 2026-04-29
**Files analyzed:** 4
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/gem-table/GwToggle.tsx` | utility + component | request-response | itself (extending) | exact |
| `src/components/gem-table/GemTable.tsx` | component | request-response | itself (extending) | exact |
| `src/components/gem-table/columns.tsx` | config | — | itself (read-only ref) | exact |
| `src/app/page.tsx` | provider/orchestrator | event-driven | itself (extending) | exact |

---

## Pattern Assignments

### `src/components/gem-table/GwToggle.tsx` (utility + component, extending)

**Analog:** itself — `src/components/gem-table/GwToggle.tsx`

**Current exports** (lines 1–35):
```typescript
'use client'

export const MOBILE_HIDDEN_COLUMNS: Record<string, boolean> = {
  team_short_name: false,
  now_cost: false,
  fdr_score: false,
  form_score: false,
  xg_per90: false,
  xa_per90: false,
  xg_score: false,
  xa_score: false,
  ownership_score: false,
  minutes_score: false,
  set_piece_score: false,
  selected_by_percent: false,
  status: false,
  trend: false,
  fixtures: false,
  regression_signal: false,
  differential_flag: false,
}

export function getColumnVisibility(horizon: 1 | 3 | 5, isMobile = false): Record<string, boolean> {
  const gwVisibility = {
    xPts_1gw: horizon === 1,
    xPts_3gw: horizon === 3,
    xPts_5gw: horizon === 5,
  }
  if (!isMobile) {
    return gwVisibility
  }
  return { ...MOBILE_HIDDEN_COLUMNS, ...gwVisibility }
}
```

**GwToggle segmented button pattern** (lines 42–65) — PresetToggle must copy this exactly:
```tsx
export function GwToggle({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Projected points horizon"
      className="flex rounded overflow-hidden border border-zinc-300 dark:border-zinc-600"
    >
      {([1, 3, 5] as const).map((gw) => (
        <button
          key={gw}
          onClick={() => onChange(gw)}
          aria-pressed={value === gw}
          className={`px-3 py-2.5 sm:py-1 text-sm font-medium transition-all cursor-pointer active:scale-95 min-h-[44px] ${
            value === gw
              ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
              : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700'
          }`}
        >
          {gw} GW
        </button>
      ))}
    </div>
  )
}
```

**Key extension points:**

1. Add a `ViewPreset = 'default' | 'compact' | 'analysis'` type (can be exported from this file or a shared types file).

2. Add `PRESET_COLUMN_VISIBILITY` maps as `Record<ViewPreset, Record<string, boolean>>`. From the column IDs verified below:

   **Compact** (D-01) — only these 5 columns visible; all others must be explicitly `false`:
   ```typescript
   compact: {
     // visible
     web_name: true,         // Player
     element_type: true,     // Pos
     gem_score: true,        // Gem
     // xPts_Xgw: true — handled by gwVisibility spread, so omit or set true
     mins_risk: true,        // Risk
     // everything else false:
     team_short_name: false,
     now_cost: false,
     fdr_score: false,
     form_score: false,
     xg_per90: false,
     xa_per90: false,
     xg_score: false,
     xa_score: false,
     ownership_score: false,
     minutes_score: false,
     set_piece_score: false,
     selected_by_percent: false,
     status: false,
     regression_signal: false,
     differential_flag: false,
     trend: false,
     fixtures: false,
   }
   ```

   **Default** (D-02) — hides the 9 granular sub-score columns:
   ```typescript
   default: {
     fdr_score: false,
     form_score: false,
     xg_per90: false,
     xa_per90: false,
     xg_score: false,
     xa_score: false,
     ownership_score: false,
     minutes_score: false,
     set_piece_score: false,
   }
   ```

   **Analysis** (D-03) — Default minus hiding xg_per90/xa_per90:
   ```typescript
   analysis: {
     fdr_score: false,
     form_score: false,
     // xg_per90 and xa_per90 are visible — NOT in this map
     xg_score: false,
     xa_score: false,
     ownership_score: false,
     minutes_score: false,
     set_piece_score: false,
   }
   ```

3. Extend or replace `getColumnVisibility` to accept `preset`:
   ```typescript
   export function getColumnVisibility(
     horizon: 1 | 3 | 5,
     isMobile = false,
     preset: ViewPreset = 'default'
   ): Record<string, boolean>
   ```
   Merge order: `{ ...PRESET_COLUMN_VISIBILITY[preset], ...gwVisibility }` (gwVisibility always wins over preset so Compact still gets the active xPts column). On mobile, `isMobile` path bypasses preset (MOBILE_HIDDEN_COLUMNS already handles it) — or mobile always ignores preset per D-07.

   **Important:** The existing `getColumnVisibility(horizon)` and `getColumnVisibility(horizon, isMobile)` call signatures must continue to work — `preset` must be a third optional param with default `'default'`. The existing tests at lines 6–90 of `GwToggle.test.ts` call only the 1-arg and 2-arg forms and must keep passing unchanged.

4. **PresetToggle component** — either inline in `GemTable` or a sibling file. The segmented button group above is the exact pattern to copy. Labels: `Default`, `Compact`, `Analysis`. Wrap in `<div className="hidden sm:flex ...">` per D-07.

---

### `src/components/gem-table/GemTable.tsx` (component, extending)

**Analog:** itself — `src/components/gem-table/GemTable.tsx`

**Current prop interface** (line 44): `GemTable()` takes no props. New interface:
```typescript
type ViewPreset = 'default' | 'compact' | 'analysis'  // or imported

interface GemTableProps {
  preset?: ViewPreset         // controlled from page.tsx (D-08)
  onPresetChange?: (p: ViewPreset) => void
}

export function GemTable({ preset = 'default', onPresetChange }: GemTableProps) {
```

**Current columnVisibility wiring** (lines 81–95):
```typescript
const columnVisibility: VisibilityState = getColumnVisibility(gwHorizon, isMobile)

const table = useReactTable({
  data: scoredPlayers,
  columns,
  state: { sorting, columnFilters, columnVisibility, expanded },
  onSortingChange: setSorting,
  onColumnFiltersChange: setColumnFilters,
  onExpandedChange: setExpanded,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getExpandedRowModel: getExpandedRowModel(),
  getRowCanExpand: () => isMobile,
})
```

Change line 81 to pass preset (and skip preset on mobile per D-07):
```typescript
const columnVisibility: VisibilityState = getColumnVisibility(gwHorizon, isMobile, isMobile ? 'default' : preset)
```

**Current sticky controls bar** (lines 121–124):
```tsx
<div className="sticky top-0 sm:static z-40 bg-white dark:bg-zinc-900 py-2 -mx-4 px-4 flex justify-between items-center mb-2 border-b border-gray-100 dark:border-zinc-800 sm:border-0">
  <PositionFilter active={activePosition} onChange={handlePositionChange} />
  <GwToggle value={gwHorizon} onChange={setGwHorizon} />
</div>
```

New layout per D-05 — insert PresetToggle between PositionFilter and GwToggle:
```tsx
<div className="sticky top-0 sm:static z-40 bg-white dark:bg-zinc-900 py-2 -mx-4 px-4 flex justify-between items-center mb-2 border-b border-gray-100 dark:border-zinc-800 sm:border-0">
  <PositionFilter active={activePosition} onChange={handlePositionChange} />
  <div className="flex items-center gap-2">
    <PresetToggle value={preset} onChange={onPresetChange ?? (() => {})} />  {/* hidden sm:flex inside */}
    <GwToggle value={gwHorizon} onChange={setGwHorizon} />
  </div>
</div>
```

---

### `src/components/gem-table/columns.tsx` (config, read-only reference)

**Analog:** itself — `src/components/gem-table/columns.tsx`

**Complete column ID inventory** (derived from `accessorKey` and `id` fields, lines 58–228):

| Column ID | Type | Header label | Notes |
|---|---|---|---|
| `web_name` | accessor | Player | always visible |
| `team_short_name` | accessor | Team | |
| `element_type` | accessor | Pos | |
| `now_cost` | accessor | Price | |
| `gem_score` | accessor | Gem | always visible |
| `fdr_score` | accessor | FDR | sub-score |
| `form_score` | accessor | Form | sub-score |
| `xg_per90` | accessor | xG/90 | sub-score; visible in Analysis |
| `xa_per90` | accessor | xA/90 | sub-score; visible in Analysis |
| `xg_score` | accessor | xG Sc | sub-score; hidden in Analysis too |
| `xa_score` | accessor | xA Sc | sub-score; hidden in Analysis too |
| `ownership_score` | accessor | Own | sub-score |
| `minutes_score` | accessor | Min | sub-score |
| `set_piece_score` | accessor | SP | sub-score |
| `selected_by_percent` | accessor | Own% | |
| `status` | accessor | Status | |
| `mins_risk` | display (id) | Risk | always visible |
| `xPts_1gw` | accessor | xPts | GW-toggle driven |
| `xPts_3gw` | accessor | xPts (3) | GW-toggle driven |
| `xPts_5gw` | accessor | xPts (5) | GW-toggle driven |
| `regression_signal` | accessor | Signal | |
| `differential_flag` | accessor | Diff | |
| `trend` | display (id) | Trend | |
| `fixtures` | display (id) | Next 5 | |

**Total: 24 columns.** No new columns introduced in this phase.

**Note on `regression_signal` / `signal` discrepancy:** `HIDDEN_COLUMN_LABELS` in `GemTable.tsx` (line 41) uses key `signal`, but `columns.tsx` defines `col.accessor('regression_signal', ...)` (line 161). The accessor key `regression_signal` is the correct TanStack column ID. The `HIDDEN_COLUMN_LABELS` entry uses `signal` which appears to be a stale label key that does not match any column ID — planner should use `regression_signal` in all VisibilityState maps.

---

### `src/app/page.tsx` (provider/orchestrator, extending)

**Analog:** itself — `src/app/page.tsx`

**sectionMemory pattern to mirror for gemPreset** (lines 52–64):
```typescript
// D-08 mirror: sectionMemory is lifted state that survives tab switches
const [sectionMemory, setSectionMemory] = useState<Record<Section, SubTab | null>>({
  analyse: 'gems',
  plan: 'planner',
  squad: null,
})

const activeSubTab = sectionMemory[activeSection]

function handleSubTabChange(subTab: SubTab) {
  setSectionMemory(prev => ({ ...prev, [activeSection]: subTab }))
}
```

**New gemPreset state** (add alongside existing state, lines 52–57 area):
```typescript
const [gemPreset, setGemPreset] = useState<ViewPreset>('default')
```

No reset on tab/section change — `gemPreset` simply holds the last value for the session (D-09).

**GemTable render site** (lines 120–125) — add props:
```tsx
{activeSection !== 'squad' && activeSubTab === 'gems' && (
  <>
    <GemTable preset={gemPreset} onPresetChange={setGemPreset} />
    <CaptainPicksPanel />
  </>
)}
```

**ViewPreset type placement:** Either declare in `page.tsx` and import into `GemTable.tsx`, or declare in `GwToggle.tsx` (alongside the functions that use it) and import into both `page.tsx` and `GemTable.tsx`. The latter keeps all column-visibility concerns co-located.

---

## Shared Patterns

### Segmented Button Group (active/inactive styling)
**Source:** `src/components/gem-table/GwToggle.tsx` lines 42–65
**Apply to:** PresetToggle component
```tsx
// Outer wrapper
className="flex rounded overflow-hidden border border-zinc-300 dark:border-zinc-600"

// Active button
className="... bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"

// Inactive button
className="... bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"

// Common button classes
className="px-3 py-2.5 sm:py-1 text-sm font-medium transition-all cursor-pointer active:scale-95 min-h-[44px]"

// Accessibility
role="group"
aria-label="..."
aria-pressed={value === item}
```

### Desktop-only via CSS breakpoint
**Source:** `GwToggle.tsx` and `GemTable.tsx` pattern (`sm:hidden` / `hidden sm:flex`)
**Apply to:** PresetToggle wrapper (D-07)
```tsx
<div className="hidden sm:flex ...">
  {/* PresetToggle content */}
</div>
```

### VisibilityState merge order
**Source:** `GwToggle.tsx` line 34 (`{ ...MOBILE_HIDDEN_COLUMNS, ...gwVisibility }`)
**Apply to:** extended `getColumnVisibility`
```typescript
// gwVisibility spreads last so xPts columns always override preset maps
return { ...PRESET_COLUMN_VISIBILITY[preset], ...gwVisibility }
```

### Test structure for getColumnVisibility
**Source:** `src/components/gem-table/GwToggle.test.ts`
**Apply to:** new preset test cases (add to the same file)
```typescript
import { describe, it, expect } from 'vitest'
import { getColumnVisibility, MOBILE_HIDDEN_COLUMNS } from '@/components/gem-table/GwToggle'

// New describe block to add:
describe('getColumnVisibility presets', () => {
  it('compact preset hides all non-priority columns', () => { ... })
  it('default preset hides 9 sub-score columns', () => { ... })
  it('analysis preset keeps xg_per90 and xa_per90 visible', () => { ... })
  it('preset is ignored on mobile', () => { ... })
  // Existing tests must continue to pass unchanged (no third arg = default preset)
})
```

---

## No Analog Found

None — all four files are self-analogs (extensions of existing files).

---

## Metadata

**Analog search scope:** `src/components/gem-table/`, `src/app/page.tsx`
**Files scanned:** 5 (GwToggle.tsx, GwToggle.test.ts, GemTable.tsx, columns.tsx, page.tsx)
**Pattern extraction date:** 2026-04-29
