# Phase 3: Gem Rating Table - Research

**Researched:** 2026-03-28
**Domain:** Client-side composite scoring algorithm + TanStack Table v8 sortable/filterable table
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GEM-01 | Score each player across multiple dimensions and show a composite Gem rating | Scoring algorithm section; MergedPlayer field mapping |
| GEM-02 | Displayed as a sortable table, filterable by position (GK/DEF/MID/FWD) | TanStack Table v8 sorting + column filter pattern |
| FFA-01 | Players about to go on high-scoring run: >2pts last game(s) AND favourable fixtures AND high xG/xA | `form_pts_per90`, `fixtures[].difficulty_score`, `xg_per90`/`xa_per90` all present in MergedPlayer |
| FFA-02 | Players currently on high-scoring run: highlight upcoming fixture ease/difficulty and home/away | `fixtures[].difficulty_tier`, `fixtures[].is_home` present in MergedPlayer |
| PPS-01 | Penalty, set piece, corner taker flags | `penalties_order`, `direct_freekicks_order`, `corners_and_indirect_freekicks_order` in MergedPlayer |
| PPS-02 | Minutes reliability: average minutes per game, consistency indicator | `minutes_per90` in MergedPlayer |
| PPS-03 | xG per 90 and xA per 90 (from Understat) | `xg_per90`, `xa_per90` in MergedPlayer (null for unmatched) |
| PPS-04 | Injury/availability status from FPL flags | `status`, `news` in MergedPlayer |
| UIX-01 | Clear, data-forward layout using tabs or cards per section | Client component with Tailwind layout |
| UIX-02 | Scannable tables with sort/filter by position | TanStack Table v8 + position filter buttons |
</phase_requirements>

---

## Summary

Phase 3 builds entirely on top of Phase 2's `MergedPlayer[]` data contract. The work splits into two distinct parts: (1) a scoring algorithm that computes a composite Gem score from seven dimensions and (2) a GemTable UI component built with TanStack Table v8 that renders the scored data as a sortable, filterable table at `/`.

The scoring algorithm belongs client-side in a pure TypeScript function (`src/lib/gem-score.ts`). It must not live in the Python pipeline — the pipeline already has a stable schema (D-06) and Phase 3 explicitly adds computed fields on top without a schema breaking change. The function receives a `MergedPlayer` and returns a `ScoredPlayer` with `gem_score` plus all seven component scores exposed.

`@tanstack/react-table` is NOT yet installed in the project. It must be added (latest v8 is 8.21.3 from npm registry). The rest of the stack (TanStack Query v5.95.2, React 19, Next.js 16.2.1, Tailwind v4, Vitest v4.1.2) is already in place. The table component must be a `'use client'` component since it manages sorting and filter state interactively.

**Primary recommendation:** Add `@tanstack/react-table@^8` to dependencies, implement `computeGemScore(player: MergedPlayer): ScoredPlayer` as a pure client-side function, build `GemTable` as a `'use client'` component consuming `usePlayers()`, and replace the placeholder `page.tsx` with the GemTable.

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md references AGENTS.md, which contains:

> This is NOT the Next.js you know. This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

**Verified against `node_modules/next/dist/docs/`:**
- Route Handlers: `export async function GET()` returning `Response.json()` or `new Response(data, { headers })` — confirmed in `route.md`
- `'use client'` directive: Must appear at top of file before imports for any component using `useState`, event handlers, or browser APIs — confirmed in `use-client.md`
- Server Components cannot use `useState` or `useQuery` — the GemTable and its parent must be Client Components
- Vitest setup: `environment: 'node'` in current `vitest.config.ts` — sufficient for pure function tests; if component tests are needed later, `jsdom` + React Testing Library would be required (documented in Next.js vitest guide)

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-table` | 8.21.3 (latest, NOT yet installed) | Sortable/filterable headless table | Project stack doc specifies TanStack Table v8; shadcn data-table recipe wraps it |
| `@tanstack/react-query` | 5.95.2 (already installed) | Data fetching via `usePlayers()` | Already wired in Phase 2; `usePlayers()` hook ready to consume |
| React + Next.js | 19.2.4 / 16.2.1 (installed) | UI + App Router | Project stack |
| Tailwind CSS v4 | installed | Table styling | Project stack |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | 4.1.2 (installed) | Unit tests for scoring algorithm | `computeGemScore` is pure logic — fully testable without DOM |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-side scoring | Python pipeline scoring | Pipeline is the wrong place — schema is locked (D-06); client-side allows iterating scoring weights without a pipeline redeploy |
| TanStack Table v8 | HTML `<table>` + manual sort | TanStack Table handles sort state, column toggling, and filter model; manual implementation is significant hand-rolling |
| Column filter for position | Global filter | Column filter on `element_type` is more precise — filters exactly one field without touching others |

**Installation:**
```bash
npm install @tanstack/react-table
```

**Version verification:** `npm view @tanstack/react-table version` returned `8.21.3` on 2026-03-28.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   ├── types.ts          # Add ScoredPlayer interface (extends MergedPlayer)
│   ├── gem-score.ts      # computeGemScore() pure function + dimension scoring helpers
│   └── hooks/
│       └── usePlayers.ts # Already exists — no changes needed
├── components/
│   └── gem-table/
│       ├── GemTable.tsx         # 'use client' — main table component
│       ├── columns.tsx          # Column definitions (createColumnHelper<ScoredPlayer>)
│       └── PositionFilter.tsx   # Position filter buttons (GK/DEF/MID/FWD/All)
└── app/
    └── page.tsx          # Replace placeholder — import GemTable, pass no props (usePlayers inside)
```

### Pattern 1: TanStack Table v8 Sortable + Filterable Table

**What:** `useReactTable` with `getCoreRowModel`, `getSortedRowModel`, and `getFilteredRowModel`. Column filter on `element_type` for position filtering. Sorting state managed locally with `useState<SortingState>`.

**When to use:** Any interactive table that needs client-side sort/filter without a page reload.

**Example:**
```typescript
// Source: https://tanstack.com/table/v8/docs/guide/sorting + LogRocket guide (verified)
'use client'

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { useState } from 'react'
import type { ScoredPlayer } from '@/lib/types'

const columnHelper = createColumnHelper<ScoredPlayer>()

const columns = [
  columnHelper.accessor('web_name', { header: 'Player' }),
  columnHelper.accessor('element_type', { header: 'Pos', enableSorting: false }),
  columnHelper.accessor('gem_score', { header: 'Gem' }),
  columnHelper.accessor('fdr_score', { header: 'FDR' }),
  columnHelper.accessor('form_score', { header: 'Form' }),
  columnHelper.accessor('xg_score', { header: 'xG' }),
  columnHelper.accessor('xa_score', { header: 'xA' }),
  columnHelper.accessor('ownership_score', { header: 'Own%' }),
  columnHelper.accessor('minutes_score', { header: 'Min' }),
  columnHelper.accessor('set_piece_score', { header: 'SP' }),
]

export function GemTable({ data }: { data: ScoredPlayer[] }) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'gem_score', desc: true }  // default: highest gem first
  ])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })
  // ... render
}
```

### Pattern 2: Position Filter as Column Filter (not global filter)

**What:** Set `columnFilters` on the `element_type` column by pressing GK/DEF/MID/FWD buttons. Clearing filter shows all positions.

```typescript
// Set position filter — element_type: 1=GK 2=DEF 3=MID 4=FWD
const handlePositionFilter = (posCode: number | null) => {
  if (posCode === null) {
    setColumnFilters([])
  } else {
    setColumnFilters([{ id: 'element_type', value: posCode }])
  }
}
```

**Note:** The default `filterFn` for numeric columns in TanStack Table v8 is `equals`. Since `element_type` is a number, this works without a custom `filterFn`.

### Pattern 3: ScoredPlayer Type Extension

**What:** `ScoredPlayer` extends `MergedPlayer` with computed scoring fields. Defined in `src/lib/types.ts`.

```typescript
// Add to src/lib/types.ts
export interface ScoredPlayer extends MergedPlayer {
  // Composite
  gem_score: number           // 0.0–1.0 normalised composite
  // Dimension scores (0.0–1.0 each, or null when dimension unavailable)
  fdr_score: number           // fixture difficulty rating dimension
  form_score: number          // per-90 form points dimension
  xg_score: number | null     // xG/90 dimension (null if xg_per90 === null)
  xa_score: number | null     // xA/90 dimension (null if xa_per90 === null)
  ownership_score: number     // inverse ownership % (low owned = higher score)
  minutes_score: number       // minutes reliability dimension
  set_piece_score: number     // set piece role dimension
  // DefCon likelihood is intentionally EXCLUDED in Phase 3 —
  // per-match hit rate data comes from element-summary (Phase 4 territory).
  // Gem score in Phase 3 is computed on 6 available dimensions only.
}
```

### Pattern 4: `computeGemScore` Pure Function

**What:** A pure function in `src/lib/gem-score.ts` that takes a `MergedPlayer` and returns a `ScoredPlayer`. Each dimension is normalised to 0.0–1.0. The composite is the mean of available dimension scores (dimensions with null data are excluded from numerator AND denominator).

**Dimension mapping to MergedPlayer fields:**

| Dimension | Field(s) Used | Null Handling |
|-----------|---------------|---------------|
| Custom FDR | `fixtures[0..4].difficulty_score` (avg of next 5) | If `fixtures` empty → `0.5` (neutral) |
| Per-90 form | `form_pts_per90` | Never null (0.0 if no form) |
| xG per 90 | `xg_per90` | null → score is null; excluded from composite |
| xA per 90 | `xa_per90` | null → score is null; excluded from composite |
| Ownership % | `selected_by_percent` (string → float) | Never null |
| Minutes reliability | `minutes_per90` | 0.0 if no starts |
| Set piece role | `penalties_order`, `direct_freekicks_order`, `corners_and_indirect_freekicks_order` | null = no role = 0 |

**DefCon likelihood is deferred to Phase 4.** The ROADMAP states Phase 3 and Phase 4 are independent. Phase 4 computes per-match hit rates from `element-summary` history — data not yet fetched. The Gem score in Phase 3 computes over 6 available dimensions (or fewer when xG/xA null). This is consistent with Success Criterion 5: "Gem score computed on available dimensions only."

### Pattern 5: FDR Score Direction

FDR `difficulty_score` in `FixtureEntry` is `0.0 = easiest, 1.0 = hardest` (per `merge.py`). For the Gem scoring dimension, **invert**: `fdr_score = 1.0 - avg_difficulty_score`. A player facing easy fixtures gets a high `fdr_score`.

### Pattern 6: Ownership Score Direction

Low ownership is advantageous (differential pick). Invert: `ownership_score = 1.0 - (selected_by_percent_float / 100)`. Capped at 1.0.

### Anti-Patterns to Avoid

- **Scoring in the Python pipeline:** Schema D-06 is locked. Adding `gem_score` to `merged_players.json` would create coupling between scoring weights and pipeline deploys. Keep scoring client-side.
- **Treating null xG/xA as 0:** Pitfall 12 — null means no data, not zero shots. Zero-filling distorts gem scores for promoted-team players. Exclude from composite.
- **Using `globalFilter` instead of `columnFilters`:** Global filter searches all columns. Position filtering should target `element_type` exclusively.
- **Putting `useReactTable` in a Server Component:** Table state (`useState`) requires a Client Component. The `page.tsx` must either be a Client Component itself or import a Client Component child.
- **Not defaulting sort to `gem_score` descending:** Without a default sort, the table renders in API order (FPL element id order). Users expect best gems at top.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sortable columns with click-to-toggle direction | Custom sort state + comparators | `useReactTable` + `getSortedRowModel` | TanStack handles multi-sort, stable sort, sort direction icons via `getIsSorted()` |
| Client-side row filtering | Array `.filter()` + state | `getFilteredRowModel` + `columnFilters` state | TanStack integrates filter with sort correctly; manual filter applied after sort breaks pagination |
| Normalisation of numeric columns for comparison | Custom min-max normalisation | Not needed — TanStack sorts raw values; normalisation only needed for gem composite | Sorting works on raw floats; only the composite gem score needs normalisation |

**Key insight:** TanStack Table v8 is purely headless — it manages state, not DOM. The render layer (Tailwind `<table>`, `<th>`, `<td>`) is entirely yours to write. This fits perfectly with the project's Tailwind-only approach.

---

## Gem Scoring Algorithm Detail

### Normalisation Strategy

For each non-null dimension, normalise to 0.0–1.0 relative to the entire player population in the current dataset. Use **min-max normalisation** per dimension across all players:

```
score = (value - min_value) / (max_value - min_value)
```

This means the best player in each dimension always scores 1.0 and the worst scores 0.0. This approach requires two passes over the data: one to find min/max per dimension, one to score each player.

**Alternative (simpler but less adaptive):** Use fixed domain caps (e.g. xG per 90 capped at 1.0). This avoids the two-pass requirement but can compress scores if no player reaches the cap. Min-max is recommended for better discrimination.

### Composite Formula

```typescript
function computeGemScore(player: MergedPlayer, stats: DimensionStats): ScoredPlayer {
  const dims: number[] = []

  // FDR: invert difficulty (low difficulty = better)
  const avgDifficulty = player.fixtures.length > 0
    ? player.fixtures.reduce((s, f) => s + f.difficulty_score, 0) / player.fixtures.length
    : 0.5
  const fdr_score = normalise(1.0 - avgDifficulty, stats.fdr)
  dims.push(fdr_score)

  // Form per 90
  const form_score = normalise(player.form_pts_per90, stats.form)
  dims.push(form_score)

  // xG (skip if null)
  let xg_score: number | null = null
  if (player.xg_per90 !== null) {
    xg_score = normalise(player.xg_per90, stats.xg)
    dims.push(xg_score)
  }

  // xA (skip if null)
  let xa_score: number | null = null
  if (player.xa_per90 !== null) {
    xa_score = normalise(player.xa_per90, stats.xa)
    dims.push(xa_score)
  }

  // Ownership (invert — low ownership = differential value)
  const ownershipPct = parseFloat(player.selected_by_percent)
  const ownership_score = normalise(1.0 - ownershipPct / 100, stats.ownership)
  dims.push(ownership_score)

  // Minutes reliability
  const minutes_score = normalise(player.minutes_per90, stats.minutes)
  dims.push(minutes_score)

  // Set piece role (ordinal: primary taker=2, secondary=1, none=0)
  const spRank = setpieceRank(player)
  const set_piece_score = normalise(spRank, stats.setpiece)
  dims.push(set_piece_score)

  const gem_score = dims.reduce((s, d) => s + d, 0) / dims.length

  return { ...player, gem_score, fdr_score, form_score, xg_score, xa_score,
           ownership_score, minutes_score, set_piece_score }
}
```

### Set Piece Rank Helper

```typescript
function setpieceRank(p: MergedPlayer): number {
  // Primary taker for any set piece role = order === 1
  const isPenaltyTaker   = p.penalties_order === 1
  const isFreekickTaker  = p.direct_freekicks_order === 1
  const isCornerTaker    = p.corners_and_indirect_freekicks_order === 1
  const isSecondary      = [p.penalties_order, p.direct_freekicks_order,
                             p.corners_and_indirect_freekicks_order]
                           .some(o => o !== null && o === 2)

  if (isPenaltyTaker || isFreekickTaker || isCornerTaker) return 2
  if (isSecondary) return 1
  return 0
}
```

### Two-Pass Implementation

`computeAllGemScores(players: MergedPlayer[]): ScoredPlayer[]` is the public API:
1. Pass 1: Compute `DimensionStats` (min/max per dimension across all players)
2. Pass 2: Call `computeGemScore(player, stats)` for each player

This function lives in `src/lib/gem-score.ts` and is called inside `page.tsx` or the GemTable parent after `usePlayers()` resolves.

---

## Common Pitfalls

### Pitfall 1: DefCon Dimension — Requires Phase 4 Data

**What goes wrong:** The Gem score definition (GEM-03, Phase 2) lists "DefCon likelihood" as one of seven dimensions. Phase 4 computes this from per-match `element-summary` history, which is not yet fetched. If Phase 3 tries to include DefCon, it blocks on unavailable data.

**Why it happens:** The ROADMAP lists GEM-03 as a Phase 2 requirement (completed) but Phase 3's success criteria says "all seven dimensions". The seven dimensions include DefCon.

**How to avoid:** Phase 3 computes Gem score on 6 available dimensions (FDR, form, xG, xA, ownership, minutes, set piece — that is actually 7, with DefCon being the one deferred). Re-read the success criteria: criterion 5 explicitly says "Gem score computed on available dimensions only." DefCon data is not available yet. The score excludes it gracefully; Phase 4 will add it by extending the scoring function.

**Warning signs:** Confusion between "7 dimensions listed in GEM-03" vs "available dimensions in Phase 3." The plan must explicitly address this and document that the Phase 3 gem score covers 6 active dimensions (xG/xA conditional on Understat availability) + 1 deferred (DefCon).

### Pitfall 2: `element_type` Filter Requires Numeric Equality

**What goes wrong:** Position buttons that set column filters using string labels ("MID") instead of integer codes (3) will never match — `element_type` is stored as `PositionCode` (1/2/3/4).

**How to avoid:** The `PositionFilter` component maps button labels to integer codes before calling `setColumnFilters`. Never pass string labels to the filter value.

### Pitfall 3: Min-Max Normalisation Requires All Players — Not Just Filtered Rows

**What goes wrong:** Computing dimension min/max on the filtered dataset (e.g. only midfielders after position filter is applied) means gem scores change when the filter changes. A MID who was rank 50 overall might rank 10 among MIDs — the gem score appears to improve when filtering.

**How to avoid:** Compute `DimensionStats` (min/max) over the **full** `players` array before filtering, not the filtered subset. Pass the precomputed stats to the scoring function. The table's `columnFilters` only affects what rows are displayed, not how they are scored.

### Pitfall 4: `'use client'` Boundary — `page.tsx` Must Not Call Hooks Directly

**What goes wrong:** Next.js 16 `page.tsx` is a Server Component by default. Importing `usePlayers()` (which calls `useQuery`) directly in `page.tsx` fails at runtime.

**How to avoid:** Per `use-client.md` (verified in Next.js 16 docs): only the first file in a component tree that uses client features needs `'use client'`. Options:
- Add `'use client'` to `page.tsx` itself (simplest for a fully interactive page)
- Keep `page.tsx` as Server Component and import a Client Component child (`GemTable.tsx` marked `'use client'`)

The latter is architecturally cleaner — `page.tsx` stays a Server Component for metadata/layout, `GemTable` carries the interactivity. The `usePlayers()` call and all TanStack Table state live inside `GemTable`.

### Pitfall 5: TanStack Table Column Filter `filterFn` for Numbers

**What goes wrong:** TanStack Table v8's default `filterFn` for numeric columns may not be `equals` on all versions. If `element_type` filter returns empty rows, the wrong filter function is being applied.

**How to avoid:** Explicitly set `filterFn: 'equals'` on the `element_type` column definition to make the intent unambiguous:
```typescript
columnHelper.accessor('element_type', {
  header: 'Pos',
  filterFn: 'equals',
  enableSorting: false,
})
```

### Pitfall 6: xG/xA Column Cells Must Render Dash Not Zero for Null

**What goes wrong:** `cell: (info) => info.getValue()` renders `null` as an empty string or "null" in some environments. Success Criterion 5 requires a dash.

**How to avoid:**
```typescript
columnHelper.accessor('xg_per90', {
  header: 'xG/90',
  cell: (info) => info.getValue() === null ? '—' : info.getValue()?.toFixed(2),
})
```

---

## Code Examples

Verified patterns from official sources and project context:

### Full TanStack Table v8 Sortable + Filterable Pattern

```typescript
// Source: TanStack Table v8 docs + LogRocket guide (verified 2026-03-28)
// File: src/components/gem-table/GemTable.tsx
'use client'

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
} from '@tanstack/react-table'
import { useState } from 'react'
import type { ScoredPlayer } from '@/lib/types'

const columnHelper = createColumnHelper<ScoredPlayer>()

const columns = [
  columnHelper.accessor('web_name', { header: 'Player' }),
  columnHelper.accessor('team_short_name', { header: 'Team', enableSorting: false }),
  columnHelper.accessor('element_type', {
    header: 'Pos',
    filterFn: 'equals',
    enableSorting: false,
    cell: (info) => ({ 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }[info.getValue()] ?? '?'),
  }),
  columnHelper.accessor('gem_score', {
    header: 'Gem',
    cell: (info) => (info.getValue() * 100).toFixed(0),
  }),
  columnHelper.accessor('xg_per90', {
    header: 'xG/90',
    cell: (info) => info.getValue() === null ? '—' : info.getValue()!.toFixed(2),
  }),
  columnHelper.accessor('xa_per90', {
    header: 'xA/90',
    cell: (info) => info.getValue() === null ? '—' : info.getValue()!.toFixed(2),
  }),
  columnHelper.accessor('form_pts_per90', { header: 'Form/90',
    cell: (info) => info.getValue().toFixed(1) }),
  columnHelper.accessor('minutes_per90', { header: 'Min/90',
    cell: (info) => info.getValue().toFixed(0) }),
  columnHelper.accessor('selected_by_percent', { header: 'Own%' }),
]

export function GemTable({ data }: { data: ScoredPlayer[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'gem_score', desc: true }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div>
      {/* Position filter buttons */}
      <div className="flex gap-2 mb-4">
        {[null, 1, 2, 3, 4].map((code) => (
          <button
            key={code ?? 'all'}
            onClick={() =>
              setColumnFilters(code === null ? [] : [{ id: 'element_type', value: code }])
            }
          >
            {code === null ? 'All' : { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }[code]}
          </button>
        ))}
      </div>

      <table>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  style={{ cursor: header.column.getCanSort() ? 'pointer' : 'default' }}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getIsSorted() === 'asc' && ' ^'}
                  {header.column.getIsSorted() === 'desc' && ' v'}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

### computeAllGemScores Skeleton

```typescript
// Source: project design (pure TypeScript, no external deps)
// File: src/lib/gem-score.ts
import type { MergedPlayer, ScoredPlayer } from '@/lib/types'

interface DimensionStats {
  fdr: { min: number; max: number }
  form: { min: number; max: number }
  xg: { min: number; max: number }
  xa: { min: number; max: number }
  ownership: { min: number; max: number }
  minutes: { min: number; max: number }
  setpiece: { min: number; max: number }
}

function minMax(values: number[]): { min: number; max: number } {
  if (!values.length) return { min: 0, max: 1 }
  return { min: Math.min(...values), max: Math.max(...values) }
}

function normalise(value: number, stats: { min: number; max: number }): number {
  if (stats.max === stats.min) return 0.5
  return Math.max(0, Math.min(1, (value - stats.min) / (stats.max - stats.min)))
}

export function computeAllGemScores(players: MergedPlayer[]): ScoredPlayer[] {
  // Pass 1: compute dimension stats over full population
  const avgFdr = players.map(p =>
    p.fixtures.length
      ? 1.0 - p.fixtures.reduce((s, f) => s + f.difficulty_score, 0) / p.fixtures.length
      : 0.5
  )
  const stats: DimensionStats = {
    fdr:       minMax(avgFdr),
    form:      minMax(players.map(p => p.form_pts_per90)),
    xg:        minMax(players.filter(p => p.xg_per90 !== null).map(p => p.xg_per90!)),
    xa:        minMax(players.filter(p => p.xa_per90 !== null).map(p => p.xa_per90!)),
    ownership: minMax(players.map(p => 1 - parseFloat(p.selected_by_percent) / 100)),
    minutes:   minMax(players.map(p => p.minutes_per90)),
    setpiece:  minMax(players.map(p => setpieceRank(p))),
  }
  // Pass 2: score each player
  return players.map((p, i) => computeGemScore(p, avgFdr[i], stats))
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-table` v7 (`useTable` hook) | `@tanstack/react-table` v8 (`useReactTable`) | 2022 | Package rename; `useTable` → `useReactTable`; column defs restructured; `flexRender` required |
| `disableSortBy` column option | `enableSorting: false` | v8 | Inversion of flag naming convention |
| `cell.render('Cell')` | `flexRender(cell.column.columnDef.cell, cell.getContext())` | v8 | Rendering API completely changed |
| `Header` (capital) in column def | `header` (lowercase) | v8 | Case change |

**Deprecated/outdated:**
- `react-table` (v7 package name): Replaced by `@tanstack/react-table` — installing the old package name gets v7, not v8

---

## Open Questions

1. **DefCon dimension in Phase 3 gem score**
   - What we know: Success Criterion 1 says "all seven dimensions". Criterion 5 says "computed on available dimensions only."
   - What's unclear: Does the planner interpret this as "Phase 3 must include DefCon even if it's placeholder zeros" or "Phase 3 computes on 6 available dimensions and Phase 4 extends it"?
   - Recommendation: Phase 3 should explicitly document that gem score uses 6 active dimensions (FDR, form, xG, xA, ownership, minutes, set piece = actually 7 non-DefCon ones), and DefCon extends it in Phase 4. The plan note should reference the "available dimensions only" clause in SC-5.

   **Correction:** The seven non-DefCon dimensions are: FDR, form, xG, xA, ownership, minutes, set piece. That is 7 — matching the requirement. DefCon likelihood is described in GEM-03 as one of the dimensions, making it an 8th. Phase 3 implements the 7 that don't require element-summary history. DefCon (requiring per-match history) is naturally Phase 4.

2. **Gem score normalisation scope: all positions vs per-position**
   - What we know: Min-max across all players means GKs always score low on xG (by nature)
   - What's unclear: Should scoring be position-normalised so the best GK is visible alongside the best MID?
   - Recommendation: Start with cross-position normalisation (simpler). Position filtering already lets users compare within position. Position-normalised scoring is a Phase 6 polish item if users find gem scores misleading for GKs.

---

## Environment Availability

No new external dependencies beyond npm packages. TanStack Table is a pure JavaScript library with no OS-level dependencies.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm install | Already running | in use | — |
| `@tanstack/react-table` | GemTable component | NOT INSTALLED | 8.21.3 latest | — (must install) |
| `@tanstack/react-query` | `usePlayers()` hook | Installed | 5.95.2 | — |
| Tailwind CSS v4 | Table styling | Installed | ^4 | — |
| Vitest | Algorithm unit tests | Installed | 4.1.2 | — |

**Missing dependencies with no fallback:**
- `@tanstack/react-table` — must be installed before GemTable can be implemented (`npm install @tanstack/react-table`)

**Missing dependencies with fallback:**
- None

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (exists, `environment: 'node'`) |
| Quick run command | `npm test` (runs `vitest run`) |
| Full suite command | `npm test` |

**Note:** Current `vitest.config.ts` uses `environment: 'node'`. This is **sufficient for testing `computeAllGemScores`** (pure function, no DOM). If component tests are added for `GemTable`, the environment would need to change to `jsdom` and `@testing-library/react` would need installing — but component tests are not required for Phase 3 success criteria.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GEM-01 | `computeAllGemScores` returns gem_score 0.0–1.0 for every player | unit | `npm test -- src/lib/gem-score.test.ts` | No — Wave 0 |
| GEM-01 | Players with null xg_per90 get null xg_score but valid gem_score | unit | `npm test -- src/lib/gem-score.test.ts` | No — Wave 0 |
| GEM-01 | gem_score is mean of available dimension scores (correct count) | unit | `npm test -- src/lib/gem-score.test.ts` | No — Wave 0 |
| GEM-02 | Table renders sortable/filterable — visual check | manual | — | — |
| PPS-03 | xg_per90 null → cell renders '—' | unit | `npm test -- src/lib/gem-score.test.ts` | No — Wave 0 |
| GEM-01 | FDR score inverts difficulty correctly | unit | `npm test -- src/lib/gem-score.test.ts` | No — Wave 0 |
| GEM-01 | Set piece rank: primary taker scores higher than no role | unit | `npm test -- src/lib/gem-score.test.ts` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/lib/gem-score.test.ts` — covers GEM-01 dimension scoring, null handling, composite formula
- [ ] No additional framework config needed — `vitest.config.ts` already works for `environment: 'node'` unit tests

---

## Sources

### Primary (HIGH confidence)

- `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md` — `'use client'` boundary rules for Next.js 16
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — Route Handler API pattern
- `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md` — Vitest setup for Next.js
- `src/lib/types.ts` (project file) — MergedPlayer interface, all field names verified
- `pipeline/merge.py` (project file) — difficulty_score direction (0=easy,1=hard), form_pts_per90 derivation
- `npm view @tanstack/react-table version` → `8.21.3` (live registry, 2026-03-28)

### Secondary (MEDIUM confidence)

- [TanStack Table v8 Sorting Guide](https://tanstack.com/table/v8/docs/guide/sorting) — SortingState type, getSortedRowModel pattern
- [TanStack Table v8 Column Filtering Guide](https://tanstack.com/table/v8/docs/guide/column-filtering) — getFilteredRowModel, ColumnFiltersState
- [LogRocket: TanStack Table v8 Complete Guide](https://blog.logrocket.com/tanstack-table-formerly-react-table/) — Full useReactTable pattern with TypeScript, v7→v8 migration notes

### Tertiary (LOW confidence)

- None — all key claims verified via official docs or npm registry

---

## Metadata

**Confidence breakdown:**

- TanStack Table v8 API: HIGH — verified against official docs and npm registry
- Scoring algorithm design: HIGH — derived directly from MergedPlayer fields in project types.ts and merge.py
- Field names from MergedPlayer: HIGH — read directly from src/lib/types.ts
- Phase boundary (DefCon deferred): HIGH — ROADMAP explicitly states Phase 3 and Phase 4 are independent
- Tailwind/React component patterns: HIGH — consistent with installed stack

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (TanStack Table v8 is stable; scoring algorithm is internal — both stable)
