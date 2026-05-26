# ROUTES-01: Routes to Points — Rich Pill Display Design

## Goal

Replace the integer "Routes" column in GemTable with colour-coded text pills showing *which* of the five point-scoring routes each player holds, with a clear visual hierarchy between set-piece designations (bold, filled) and statistical thresholds (outline only).

## Background

Phase 76 RTP-01 added `routes_to_points` (0–5) to the pipeline and Phase 76 RTP-02 surfaced it as an integer column in GemTable. ROUTES-01 makes that column meaningful at a glance — users can immediately see *what kind* of routes a player has, not just a count.

The five routes and their derivation:

| Route | Label | Source field | Condition |
|-------|-------|-------------|-----------|
| Penalty taker | PK | `penalties_order` | `=== 1` |
| Direct FK taker | FK | `direct_freekicks_order` | `=== 1` |
| Corner taker | CK | `corners_and_indirect_freekicks_order` | `=== 1` |
| xG threat | xG | `xg_per90` | ≥ team median (non-null players only) |
| xA threat | xA | `xa_per90` | ≥ team median (non-null players only) |

## Architecture

Four pieces:

1. **`src/lib/routes.ts`** — pure utility. Exports `RouteFlags` interface and `computeRouteFlags(players: ScoredPlayer[]): Map<number, RouteFlags>`.
2. **`src/components/gem-table/RoutePillsCell.tsx`** — pure display component. Takes `flags: RouteFlags`, renders 0–5 pills.
3. **`src/components/gem-table/columns.tsx`** — `createColumns` gains a 4th optional parameter `allPlayers: ScoredPlayer[] = []`; computes flags map once per call and closes over it in the Routes cell renderer.
4. **`src/components/gem-table/GemTable.tsx`** — 1-line change: pass `scoredPlayers` as the 4th arg to `createColumns` and add it to the `useMemo` deps.

### Data flow

```
GemTable
  scoredPlayers (useMemo)
    → createColumns(handleCompare, gwN, newsFlagEnabled, scoredPlayers)
        → computeRouteFlags(scoredPlayers) → Map<id, RouteFlags>
        → Routes cell: flagsMap.get(row.original.id) → <RoutePillsCell flags={…} />
```

Both `scoredPlayers` and `columns` are already memoized — `columns` recomputes only when data changes.

## `computeRouteFlags` Logic

```typescript
export interface RouteFlags {
  pk: boolean
  fk: boolean
  ck: boolean
  xg: boolean
  xa: boolean
}

export function computeRouteFlags(players: ScoredPlayer[]): Map<number, RouteFlags> {
  // Pass 1: bucket non-null xg_per90 / xa_per90 by team
  const teamXg = new Map<number, number[]>()
  const teamXa = new Map<number, number[]>()
  for (const p of players) {
    if (p.xg_per90 !== null) append(teamXg, p.team, p.xg_per90)
    if (p.xa_per90 !== null) append(teamXa, p.team, p.xa_per90)
  }

  // Pass 2: derive flags for every player
  const result = new Map<number, RouteFlags>()
  for (const p of players) {
    const medXg = median(teamXg.get(p.team) ?? [])   // null when all null
    const medXa = median(teamXa.get(p.team) ?? [])
    result.set(p.id, {
      pk: p.penalties_order === 1,
      fk: p.direct_freekicks_order === 1,
      ck: p.corners_and_indirect_freekicks_order === 1,
      xg: p.xg_per90 !== null && medXg !== null && p.xg_per90 >= medXg,
      xa: p.xa_per90 !== null && medXa !== null && p.xa_per90 >= medXa,
    })
  }
  return result
}
```

Two private helpers used inside the file:

```typescript
// Append val to the array stored at map[key], creating the array if absent.
function append<K>(map: Map<K, number[]>, key: K, val: number) {
  const arr = map.get(key)
  if (arr) arr.push(val)
  else map.set(key, [val])
}

// Standard statistical median (average of two middle values for even-length arrays).
// Returns null for an empty array.
function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}
```

### Edge cases

| Scenario | Behaviour |
|----------|-----------|
| All players on a team have `xg_per90 = null` | `medXg = null` → `xg: false` for everyone on that team |
| Single non-null player on a team | They are at the median → `xg: true` |
| `allPlayers = []` (default) | Empty map → cell renderer gets `undefined` → renders `—` |
| Player not in the map | Cell renderer renders `—` |

## `RoutePillsCell` Component

```tsx
// Props
interface RoutePillsCellProps {
  flags: RouteFlags
}
```

### Pill spec

Pills always render in fixed order: **PK → FK → CK → xG → xA**. Only present pills for `true` flags. Zero truthy flags → render `—`.

| Pill | Label | Style | `title` tooltip |
|------|-------|-------|----------------|
| PK | `PK` | `bg-red-500 text-white font-bold` (solid fill) | `Penalty taker` |
| FK | `FK` | `bg-orange-500 text-white font-bold` (solid fill) | `Direct FK taker` |
| CK | `CK` | `bg-emerald-500 text-white font-bold` (solid fill) | `Corner taker` |
| xG | `xG` | `border border-blue-500 text-blue-400 font-semibold` (outline, no fill) | `Above-median xG in team` |
| xA | `xA` | `border border-violet-500 text-violet-400 font-semibold` (outline, no fill) | `Above-median xA in team` |

All pills: `text-[9px] px-[5px] py-[2px] rounded-[3px] leading-[1.4]` with a `3px` gap between pills via `inline-flex gap-[3px] flex-wrap items-center` on the container.

Set-piece pills (PK/FK/CK) use solid vivid fills to signal explicit designation. Statistical pills (xG/xA) use outline-only to signal a softer, relative threshold.

## `columns.tsx` integration

```typescript
// Signature change (backward-compatible — allPlayers defaults to [])
export function createColumns(
  onCompare: (player: ScoredPlayer) => void,
  gwN: number | null = null,
  newsFlagEnabled: boolean = false,
  allPlayers: ScoredPlayer[] = [],           // ← new
) {
  const routeFlagsMap = computeRouteFlags(allPlayers)   // ← new

  return [
    // … existing columns unchanged …

    // Routes column: replace integer renderer
    col.accessor('routes_to_points', {
      header: H('Routes', 'Point-scoring routes: PK = penalty taker, FK = direct FK taker, CK = corner taker, xG = above-median xG in team, xA = above-median xA in team.'),
      cell: (info) => {
        const flags = routeFlagsMap.get(info.row.original.id)
        if (!flags) return <span className="text-zinc-400">—</span>
        return <RoutePillsCell flags={flags} />
      },
      enableSorting: true,   // still sortable by count via routes_to_points
    }),
  ]
}
```

## `GemTable.tsx` change

```typescript
// Before
const columns = useMemo(
  () => createColumns(handleCompare, lastGwActualGwN, newsFlagEnabled),
  [handleCompare, lastGwActualGwN, newsFlagEnabled]
)

// After
const columns = useMemo(
  () => createColumns(handleCompare, lastGwActualGwN, newsFlagEnabled, scoredPlayers),
  [handleCompare, lastGwActualGwN, newsFlagEnabled, scoredPlayers]
)
```

## Testing

### `src/lib/routes.test.ts`

- `penalties_order === 1` → `pk: true`; any other value (2, null) → `pk: false`
- `direct_freekicks_order === 1` → `fk: true`
- `corners_and_indirect_freekicks_order === 1` → `ck: true`
- Player with `xg_per90` strictly above team median → `xg: true`
- Player with `xg_per90` equal to team median → `xg: true` (≥, not >)
- Player with `xg_per90` below team median → `xg: false`
- Player with `xg_per90 = null` → `xg: false`
- Team where all players have `xg_per90 = null` → `xg: false` for everyone
- Two teams with different medians computed independently
- Same tests mirrored for `xa_per90` / `xa`
- Empty input → empty map

### `src/components/gem-table/RoutePillsCell.test.tsx`

- All 5 flags true → renders exactly PK, FK, CK, xG, xA (in that order in the DOM)
- Only `pk: true`, rest false → renders exactly one pill "PK", nothing else
- All flags false → renders "—", no pill elements
- PK/FK/CK pills do **not** have an outline/border class
- xG/xA pills do **not** have a solid background class
- Each pill has the correct `title` attribute

### `src/components/gem-table/columns.test.tsx` (addition)

- `createColumns` called with a `ScoredPlayer[]` containing a player with `penalties_order === 1` → Routes cell renders a "PK" pill for that player's row.

## Files changed

| File | Action |
|------|--------|
| `src/lib/routes.ts` | Create |
| `src/lib/routes.test.ts` | Create |
| `src/components/gem-table/RoutePillsCell.tsx` | Create |
| `src/components/gem-table/RoutePillsCell.test.tsx` | Create |
| `src/components/gem-table/columns.tsx` | Modify (add `allPlayers` param, replace Routes cell renderer, import new files) |
| `src/components/gem-table/columns.test.tsx` | Modify (add one test case) |
| `src/components/gem-table/GemTable.tsx` | Modify (pass `scoredPlayers` to `createColumns`) |
