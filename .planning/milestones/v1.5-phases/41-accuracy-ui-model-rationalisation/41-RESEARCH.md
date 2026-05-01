# Phase 41: Accuracy UI & Model Rationalisation — Research

**Researched:** 2026-04-30
**Domain:** Next.js 16 / React 19 tab UI, TanStack Query, accuracy_backtest.json shape, GemTable column system, model removal
**Confidence:** HIGH — all findings verified from direct codebase inspection

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** New "Accuracy" sub-tab in Analyse section. Mobile label: "Acc".
- **D-02:** Single scrollable page — three stacked sections (GW summary → haulter list → player delta).
- **D-03:** GW summary table (ACC-02): 5 rows from `summary.gws[]`, Overall row from `summary.xpts_hit_rate` / `summary.proj_pts_hit_rate`.
- **D-04:** Haulter list (ACC-03): from `haulters[]`, sorted GW desc then actual_pts desc. No interactive sort.
- **D-05:** Player delta table (ACC-04): flatten `players[].gws[]`, default sort xPts Δ asc, interactive sort on all columns.
- **D-06:** Human checkpoint before model removal — `autonomous: false`, terminal prompt only.
- **D-07:** Removal = full cut — no dead code, no feature flags.
- **D-08:** Model winner determined at execution time from live data; not pre-decided here.
- **D-09:** GW{N} Pts column in GemTable — dynamic label from `gws_covered[0]`, column id `last_gw_actual_pts`.
- **D-10:** `last_gw_actual_pts` visible in Default and Analysis presets only — not Compact.
- **D-11:** `/api/gems` route (actually `/api/players`) joins `accuracy_backtest.json players[]` by `player_id` to add `last_gw_actual_pts`.

### Claude's Discretion

- Loading state: single `<p>` paragraph (no skeleton). Confirmed matches InsightsTab pattern.
- Pagination: none — all rows shown. Confirmed matches InsightsTab + GemTable patterns.
- API route structure: new `/api/accuracy` route (confirmed follows existing route pattern).
- Section ordering: GW summary → haulters → player deltas (aggregate → specific).

### Deferred Ideas (OUT OF SCOPE)

None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACC-02 | GW-by-GW accuracy table (hit rates per model per GW) | `summary.gws[]` array in accuracy_backtest.json; UI-SPEC table chrome pattern from InsightsTab |
| ACC-03 | Correctly flagged haulters list | `haulters[]` in accuracy_backtest.json; fields verified against Phase 40 CONTEXT.md D-08 |
| ACC-04 | Player-level prediction error table, sortable | `players[].gws[]` flattened; useState sort pattern (no TanStack Table needed) |
| ACC-05 | GemTable last-GW actual pts column | `ScoredPlayer` type extension; `PRESET_COLUMN_VISIBILITY.compact` addition; `/api/players` route join |
| ACC-06 | Remove loser model — human checkpoint then full cut | Pipeline fields identified in merge.py; GemTable column IDs; type fields; autonomous:false plan structure |
</phase_requirements>

---

## Summary

Phase 41 is a pure UI/data-presentation phase — no new pipeline computation. The `accuracy_backtest.json` file produced by Phase 40 is pre-aggregated; the UI simply reads and renders it. The three new AccuracyTab sub-sections map directly onto the three top-level keys in that file (`summary`, `haulters`, `players`).

The codebase has a highly consistent pattern: new data-fetching tabs follow `InsightsTab.tsx` exactly — a custom hook using TanStack Query (`useQuery`) fetches from an API route, and the component renders loading/error/empty/data states. The API routes all follow `defcon/route.ts` or `insights/route.ts` — Vercel Blob in production, local `pipeline/cache/` in dev.

The GemTable column system uses `columns.tsx` (TanStack Table column helper) and `GwToggle.tsx` (visibility maps). Adding `last_gw_actual_pts` requires: (1) a new `col.accessor` entry in `columns.tsx`, (2) `last_gw_actual_pts: false` in `PRESET_COLUMN_VISIBILITY.compact`, (3) `last_gw_actual_pts: number | null` on `ScoredPlayer` in `types.ts`, and (4) the `/api/players` route enriching each player row with the joined backtest value.

Model rationalisation (ACC-06) touches five locations: `merge.py` (remove loser computation), `types.ts` (remove loser field), `columns.tsx` (remove loser column), `GwToggle.tsx` (remove loser xPts gating if applicable), and `AccuracyTab.tsx` (remove loser column pair from delta table).

**Primary recommendation:** Follow the InsightsTab/useInsights/insights-route triple as the canonical implementation scaffold for the AccuracyTab. Every deviation from that pattern should be justified by a specific requirement.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Accuracy data serving | API / Backend (`/api/accuracy`) | — | Blob/local file read; JSON pass-through |
| last_gw_actual_pts join | API / Backend (`/api/players`) | — | Server-side join before data leaves the route; no client-side merge of two fetches |
| AccuracyTab rendering | Browser / Client | — | 'use client'; React state for sort |
| GW Summary Table | Browser / Client | — | Pure render from fetched data |
| Haulter List | Browser / Client | — | Pure render; no local state needed |
| Player Delta Table sort | Browser / Client | — | `useState` for sort key/direction |
| Model checkpoint UI | Terminal (executor script) | — | `autonomous: false` plan task — no browser surface |
| GemTable column visibility | Browser / Client (`GwToggle.tsx`) | — | PRESET_COLUMN_VISIBILITY drives TanStack columnVisibility state |

---

## Standard Stack

### Core (verified from package.json and codebase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | UI | Project baseline [VERIFIED: package.json] |
| Next.js | 16.2.1 | Framework (App Router) | Project baseline [VERIFIED: package.json] |
| @tanstack/react-query | ^5.95.2 | Data fetching / caching | Used by all existing hooks (`useInsights`, `usePlayers`, etc.) [VERIFIED: package.json + hooks] |
| @tanstack/react-table | ^8.21.3 | GemTable only | GemTable already uses it; AccuracyTab tables are plain HTML tables, not TanStack Table [VERIFIED: package.json + GemTable.tsx] |
| Tailwind CSS | ^4 | Styling | Project standard; no shadcn [VERIFIED: package.json + UI-SPEC] |
| TypeScript | ^5 | Types | Project baseline [VERIFIED: package.json] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vercel/blob | ^2.3.1 | Blob storage | Production API routes [VERIFIED: defcon/route.ts, insights/route.ts] |
| vitest | ^4.1.2 | Testing | All tests use vitest run [VERIFIED: vitest.config.ts] |
| @testing-library/react | ^16.3.2 | Component tests | All existing component tests [VERIFIED: InsightsTab.test.tsx] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain HTML `<table>` for AccuracyTab | TanStack Table | AccuracyTab tables have simple sort state; TanStack Table adds bundle weight for no benefit at this scale |
| `useQuery` hook | `useEffect` + `useState` | useQuery already used everywhere; provides caching, deduplication, and consistent error/loading state |

**Installation:** No new packages required. All dependencies are already in `package.json`.

---

## Architecture Patterns

### System Architecture Diagram

```
accuracy_backtest.json (pipeline/cache/ or Vercel Blob)
        |
        v
/api/accuracy  ──────────────────────────────> AccuracyTab.tsx
  (new route)       useAccuracy() hook              |
  returns raw JSON  (TanStack Query)           ┌────┴────────────────────┐
                                               |    |                    |
                                         GwSummaryTable  HaulterList  PlayerDeltaTable
                                         (summary.gws)  (haulters[]) (players[].gws[])

merged_players.json (pipeline/cache/ or Vercel Blob)
accuracy_backtest.json players[] ────────────>
        |              (player_id join)
        v
/api/players  ──────────────────────────────> GemTable.tsx
  (existing route,      usePlayers() hook         |
  modified to join)     (TanStack Query)      last_gw_actual_pts column
                                              (PRESET: default + analysis only)
```

### Recommended Project Structure

```
src/
├── app/api/accuracy/
│   └── route.ts               # New — mirrors defcon/route.ts
├── components/accuracy/
│   └── AccuracyTab.tsx         # New — mirrors InsightsTab.tsx structure
├── lib/hooks/
│   └── useAccuracy.ts          # New — mirrors useInsights.ts
└── [modified]
    ├── app/page.tsx             # Add 'accuracy' SubTab
    ├── lib/types.ts             # Add last_gw_actual_pts to ScoredPlayer
    ├── components/gem-table/columns.tsx    # Add last_gw_actual_pts column; ACC-06 removal
    └── components/gem-table/GwToggle.tsx  # Add compact hide for last_gw_actual_pts
```

### Pattern 1: Data-Fetching Tab (canonical — InsightsTab / useInsights)

**What:** Custom hook wraps `useQuery`; component renders 4 states: loading / error / empty / data.

**When to use:** Every new tab that fetches JSON from an API route.

```typescript
// Source: src/lib/hooks/useInsights.ts (verified)
import { useQuery } from '@tanstack/react-query'

export function useAccuracy() {
  return useQuery<AccuracyBacktest>({
    queryKey: ['accuracy'],
    queryFn: async () => {
      const res = await fetch('/api/accuracy')
      if (!res.ok) throw new Error('Failed to fetch accuracy data')
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000, // 6 hours — matches useInsights
  })
}
```

```typescript
// Source: src/components/insights/InsightsTab.tsx (verified)
export function AccuracyTab() {
  const { data, isLoading, error } = useAccuracy()

  if (isLoading) return <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">Loading accuracy data…</p>
  if (error) return <p className="text-sm text-red-600 dark:text-red-400 py-4">Failed to load accuracy data. Run the pipeline and refresh.</p>
  if (!data) return (
    <section className="mt-6 space-y-2" aria-label="Accuracy not available">
      <h2 className="text-lg font-semibold">No accuracy data yet</h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Run the pipeline to generate backtest data.</p>
    </section>
  )

  return (
    <section className="mt-6 space-y-8" aria-label="Projection accuracy">
      {/* GwSummaryTable, HaulterList, PlayerDeltaTable */}
    </section>
  )
}
```

### Pattern 2: API Route (canonical — defcon/route.ts + insights/route.ts)

**What:** GET handler reads file from Blob (production) or local cache (dev). Returns raw JSON or `Response.json()`.

```typescript
// Source: src/app/api/insights/route.ts + defcon/route.ts (verified)
import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'

export async function GET() {
  try {
    let data: string
    if (USE_BLOB) {
      const { blobs } = await list({ prefix: 'accuracy_backtest.json', limit: 1 })
      if (!blobs.length) return Response.json({ error: 'Accuracy data not available' }, { status: 404 })
      const res = await fetch(blobs[0].url)
      if (!res.ok) return Response.json({ error: `Blob fetch failed: ${res.status}` }, { status: 502 })
      data = await res.text()
    } else {
      const cachePath = join(process.cwd(), 'pipeline', 'cache', 'accuracy_backtest.json')
      data = await readFile(cachePath, 'utf-8')
    }
    const parsed = JSON.parse(data)
    return Response.json(parsed, {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    })
  } catch {
    return Response.json({ error: 'Failed to load accuracy data' }, { status: 500 })
  }
}
```

**Note on `/api/players` join for ACC-05:** The existing route at `src/app/api/players/route.ts` returns raw `merged_players.json` as a string. To inject `last_gw_actual_pts`, the route must: (1) parse both files, (2) build a `Map<player_id, last_gw_actual_pts>` from `accuracy_backtest.json players[]`, (3) merge into each player row, (4) return `Response.json(merged)`. This is the only route that changes for ACC-05 — no changes to `usePlayers` or `GemTable` data fetching.

**Graceful fallback:** If `accuracy_backtest.json` is absent (pipeline not yet run), treat every player's `last_gw_actual_pts` as `null`. Do not throw — a missing backtest file must not break the main GemTable.

### Pattern 3: SubTab Registration (canonical — page.tsx)

**What:** Adding a sub-tab requires changes in exactly two places.

```typescript
// Source: src/app/page.tsx line 22 (verified)
// 1. Extend the union type:
export type SubTab = 'gems' | 'insights' | 'defcon' | 'set-pieces' | 'planner' | 'club-form' | 'value-gems' | 'accuracy'

// 2. Add to analyse section subTabs array (after 'set-pieces'):
{ id: 'accuracy' as SubTab, label: 'Accuracy', mobileLabel: 'Acc' }

// 3. Add content render guard (after set-pieces line 141):
{activeSection !== 'squad' && activeSubTab === 'accuracy' && <AccuracyTab />}
```

**MobileNav auto-update:** MobileNav reads `SECTIONS` directly from page.tsx — no separate change needed. [VERIFIED: MobileNav.tsx lines 3, 20]

### Pattern 4: GemTable Column Addition

**What:** Adding a column to GemTable requires exactly three file edits.

```typescript
// Source: src/components/gem-table/columns.tsx (verified)
// 1. In columns.tsx, add after xPts_1gw column:
col.accessor('last_gw_actual_pts', {
  header: () => <span title={`Actual FPL points scored in GW${gwN} — from backtest data`}>{`GW${gwN} Pts`}</span>,
  cell: (info) => {
    const v = info.getValue()
    return v === null ? <span className="text-zinc-400">—</span> : Math.round(v).toString()
  },
  enableSorting: true,
})
```

**Column header dynamic label:** The GW number must be baked in when `columns.tsx` exports `createColumns`. Two options: (a) pass `gwN` as a parameter to `createColumns` alongside `onCompare`, or (b) compute it inside the cell from the data. Option (a) is cleaner — `GemTable.tsx` already calls `createColumns(handleCompare)` and can pass the GW number once data loads.

```typescript
// Source: src/components/gem-table/GwToggle.tsx lines 25-65 (verified)
// 2. In GwToggle.tsx PRESET_COLUMN_VISIBILITY.compact, add:
compact: {
  // ... existing entries ...
  last_gw_actual_pts: false,   // NEW — D-10: hidden in Compact
}
// default and analysis maps: DO NOT add last_gw_actual_pts — absence = visible (TanStack default)
```

```typescript
// Source: src/lib/types.ts line 199-208 (verified)
// 3. In types.ts, add to ScoredPlayer interface (or to MergedPlayer — see pitfall below):
last_gw_actual_pts?: number | null   // from accuracy_backtest.json join; null = not in backtest
```

### Pattern 5: Interactive Sort in Plain HTML Table

**What:** PlayerDeltaTable needs column-header-click sort without TanStack Table. Use React `useState`.

```typescript
// No existing canonical example in codebase — standard React pattern [ASSUMED]
type SortKey = 'player_name' | 'gw' | 'actual_pts' | 'xpts_predicted' | 'xpts_delta' | 'proj_pts_predicted' | 'proj_pts_delta'
type SortDir = 'asc' | 'desc'

const [sortKey, setSortKey] = useState<SortKey>('xpts_delta')
const [sortDir, setSortDir] = useState<SortDir>('asc')  // asc = most negative first

function handleSort(key: SortKey) {
  if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
  else { setSortKey(key); setSortDir('asc') }
}
```

### Anti-Patterns to Avoid

- **Using `useEffect` + `useState` for data fetching instead of `useQuery`:** All existing hooks use TanStack Query. Diverging breaks cache consistency and error handling.
- **Adding `last_gw_actual_pts` to the GW toggle visibility switch in `getColumnVisibility`:** The gw toggle only gates `xPts_1gw / xPts_3gw / xPts_5gw`. The `last_gw_actual_pts` column is NOT horizon-gated. Adding it to the `gwVisibility` object would cause it to vanish when toggling horizons.
- **Reading both `merged_players.json` and `accuracy_backtest.json` in the browser:** All joining must happen server-side in `/api/players`. The GemTable only ever calls `usePlayers()` — one data source.
- **Putting `last_gw_actual_pts` on `MergedPlayer` instead of `ScoredPlayer`:** The field comes from a join in the API route — it is not computed by the pipeline and does not belong in the pipeline type. Keep it on `ScoredPlayer` (or add it as optional on `MergedPlayer` since `ScoredPlayer extends MergedPlayer` and the API returns it as part of the player row).

---

## accuracy_backtest.json — Exact Shape

**Status:** File does not exist yet (`pipeline/cache/` confirmed — only: defcon_stats.json, fpl_bootstrap.json, fpl_fixtures.json, insights.json, last_updated.json, merged_players.json, understat_current.json). [VERIFIED: filesystem]

**Specified shape from Phase 40 CONTEXT.md D-08:** [VERIFIED: 40-CONTEXT.md]

```json
{
  "generated_at": "ISO timestamp",
  "gws_covered": [32, 31, 30, 29, 28],
  "summary": {
    "xpts_hit_rate": 0.42,
    "proj_pts_hit_rate": 0.35,
    "gws": [
      {
        "gw": 32,
        "haulter_count": 8,
        "xpts_flagged": 3,
        "proj_pts_flagged": 2,
        "xpts_hit_rate": 0.375,
        "proj_pts_hit_rate": 0.25
      }
    ]
  },
  "haulters": [
    {
      "gw": 32,
      "player_id": 123,
      "player_name": "Salah",
      "actual_pts": 18,
      "xpts_predicted": 8.2,
      "xpts_rank": 2,
      "xpts_flagged": true,
      "proj_pts_predicted": 6.1,
      "proj_pts_rank": 4,
      "proj_pts_flagged": true
    }
  ],
  "players": [
    {
      "player_id": 123,
      "player_name": "Salah",
      "team": "LIV",
      "gws": [
        {
          "gw": 32,
          "actual_pts": 18,
          "xpts_predicted": 8.2,
          "xpts_delta": -9.8,
          "proj_pts_predicted": 6.1,
          "proj_pts_delta": -11.9
        }
      ]
    }
  ]
}
```

**Delta convention (from Phase 40 CONTEXT.md "Claude's discretion"):** `actual - predicted` (positive = player over-performed). So `xpts_delta = -9.8` means model predicted 27.8 but player scored 18 — the model over-predicted. The UI-SPEC default sort of xPts Δ ascending puts most negative (biggest over-predictions) first. [VERIFIED: 40-CONTEXT.md]

**Field name case:** All fields in `accuracy_backtest.json` use lowercase snake_case (`xpts_predicted`, `proj_pts_predicted`) — NOT camelCase. The UI-SPEC and CONTEXT.md both use this naming. Type definitions for `AccuracyBacktest` must match this casing.

**ACC-05 join key:** `players[].player_id` (integer) must match FPL player `id` in `merged_players.json`. [VERIFIED: field names in both CONTEXT.md specs]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data fetching with caching | Custom fetch+useState | `useQuery` from @tanstack/react-query | Already used everywhere; provides staleTime, deduplication, error/loading state |
| Table with sort | Custom sort system from scratch | Plain `useState` sort on flat array — sufficient for 25–75 rows | TanStack Table is overkill for non-paginated, non-filtered plain tables |
| File reading | Custom blob abstraction | Existing pattern from `defcon/route.ts` | Pattern handles local/production branching via `USE_BLOB` env var |
| Hit-rate badge colours | New colour classes | Reuse `TIER_CLASSES` from `InsightsTab.tsx` verbatim | UI-SPEC explicitly instructs reuse of those exact classes |

**Key insight:** The entire AccuracyTab is a display component — no new computation, no new algorithms. Every non-trivial problem (data fetching, routing, styling) already has a solved pattern in the codebase.

---

## Common Pitfalls

### Pitfall 1: SubTab Union Type — Forgotten `as const` Inference

**What goes wrong:** The `SECTIONS` array in `page.tsx` is declared `as const`. If you add `'accuracy'` to the `SubTab` union type but forget to add the new sub-tab entry in `SECTIONS[0].subTabs`, TypeScript won't error at compile time — but the tab won't render. Conversely, if you add the entry in `SECTIONS` but forget to update the `SubTab` union, TypeScript WILL error.

**Why it happens:** The `as const` assertion means `SECTIONS[0].subTabs[N].id` has a literal type, not `SubTab`. The sub-tab entry just needs to typecheck against `{ id: SubTab; label: string; mobileLabel: string }`.

**How to avoid:** Update both the `SubTab` union type (line 22) AND the `SECTIONS` array (line 24+) in the same edit. Also add the content render guard (`activeSubTab === 'accuracy' && <AccuracyTab />`). Three edits, one file, one commit. [VERIFIED: page.tsx lines 22-52]

**Warning signs:** TypeScript error "Argument of type 'accuracy' is not assignable to type SubTab" means the union wasn't updated.

### Pitfall 2: `last_gw_actual_pts` in GwToggle — Don't Gate by Horizon

**What goes wrong:** The `getColumnVisibility` function in `GwToggle.tsx` has a `gwVisibility` object that gates `xPts_1gw`, `xPts_3gw`, `xPts_5gw`. These entries are **spread last** (overriding preset visibility). Adding `last_gw_actual_pts` to `gwVisibility` would hide it when not on horizon 1. [VERIFIED: GwToggle.tsx lines 72-83]

**How to avoid:** Only add `last_gw_actual_pts: false` to `PRESET_COLUMN_VISIBILITY.compact`. Do NOT touch `gwVisibility`. The column is always visible in default/analysis regardless of GW horizon (D-10). [VERIFIED: UI-SPEC]

**Warning signs:** Column disappears when switching from 1GW to 3GW horizon.

### Pitfall 3: `/api/players` Route Failure When Backtest File Missing

**What goes wrong:** Naively reading `accuracy_backtest.json` in `/api/players` with `readFile` will throw `ENOENT` if Phase 40 hasn't run yet. This breaks the entire GemTable, not just the actuals column.

**How to avoid:** Wrap the backtest file read in a try/catch that defaults to an empty map. If backtest is unavailable, all players get `last_gw_actual_pts: null`. GemTable still loads. [VERIFIED: requirement from D-11 + UI-SPEC null handling]

```typescript
// Source: pattern derived from /api/players graceful fallback requirement
let backtestMap: Map<number, number | null> = new Map()
try {
  const bt = JSON.parse(await readFile(backtestPath, 'utf-8'))
  for (const p of bt.players ?? []) {
    const gw0 = p.gws?.[0]  // most recent GW
    backtestMap.set(p.player_id, gw0?.actual_pts ?? null)
  }
} catch { /* backtest not yet generated — all null */ }
```

**Warning signs:** GemTable fails to load entirely after this change is merged.

### Pitfall 4: Which GW's `actual_pts` to Use for `last_gw_actual_pts`

**What goes wrong:** `players[].gws[]` contains entries for all 5 covered GWs. The column header says "GW{N} Pts" where N = `gws_covered[0]` (the most recent GW). The join must use only the `gws[]` entry matching `gws_covered[0]`, not sum all 5.

**How to avoid:** When building the `backtestMap` in `/api/players`, find the `gws[]` entry where `gw === bt.gws_covered[0]`. [VERIFIED: UI-SPEC "GW{N} Pts where N = gws_covered[0]"]

**Warning signs:** Players who hauled in GW28 but not GW32 show a value when they should show `—`.

### Pitfall 5: ACC-06 Scope of Removal — What to Cut

**What goes wrong:** Partial removal leaves dead references. TypeScript won't catch every case (e.g., a string literal `'proj_pts_1gw'` in a comment or tooltip text).

**Full cut checklist for the loser model (e.g., if `proj_pts` loses):** [VERIFIED: merge.py, columns.tsx, types.ts]

| File | What to Remove |
|------|---------------|
| `pipeline/merge.py` | `proj_pts_1gw`, `proj_pts_3gw`, `proj_pts_5gw` fields in player dict (lines 829-833); `_proj_pts_ngw()` call at lines 815-816 |
| `src/lib/types.ts` | `proj_pts_1gw`, `proj_pts_3gw`, `proj_pts_5gw` from `MergedPlayer` (lines 138-140) |
| `src/components/gem-table/columns.tsx` | No existing `proj_pts_1gw` column — the GemTable only shows `xPts_*` columns. Check `columns.tsx` — **`proj_pts_1gw` does NOT appear as a GemTable column**. [VERIFIED: columns.tsx full read] |
| `src/components/accuracy/AccuracyTab.tsx` | Remove `proj_pts_*` column pair from PlayerDeltaTable; remove `proj_pts_*` columns from HaulterList |
| `src/lib/types.ts` (AccuracyBacktest) | Remove `proj_pts_predicted`, `proj_pts_delta`, `proj_pts_rank`, `proj_pts_flagged` from haulter/player types |

**Critical finding:** `proj_pts_1gw` is NOT currently a GemTable column. Looking at `columns.tsx`, the GemTable shows `xPts_1gw`, `xPts_3gw`, `xPts_5gw` — never `proj_pts_*`. The `proj_pts_*` fields exist in `merged_players.json` (from `merge.py`) but are not rendered in the GemTable. [VERIFIED: columns.tsx full read]

This means: if `proj_pts` is the loser, there is NO GemTable column to remove — only the pipeline computation, the type fields, and the AccuracyTab columns. If `xPts` is the loser, there ARE GemTable columns to remove (`xPts_1gw`, `xPts_3gw`, `xPts_5gw`) plus the xPts engine functions (`_xpts_ngw`, `_compute_xpts_fixture`, `_compute_xpts_sigma`, `_cs_prob`) in `merge.py`.

**This asymmetry must be surfaced in the checkpoint prompt so the executor knows the scope of each choice.**

### Pitfall 6: `createColumns` Signature — Adding `gwN` Parameter

**What goes wrong:** The column definition for `last_gw_actual_pts` needs the GW number to render the header ("GW32 Pts"). But `createColumns` currently takes only `onCompare: (player: ScoredPlayer) => void`. Adding `gwN` changes the signature, which means all callers must be updated.

**How to avoid:** Add `gwN: number | null = null` as a second parameter with a default. When `gwN` is null, render header as "GW Pts" (fallback). `GemTable.tsx` calls `createColumns(handleCompare)` — with a default parameter, this still type-checks. [VERIFIED: GemTable.tsx line 60, columns.tsx line 58]

**Warning signs:** TypeScript error "Expected 2 arguments, but got 1" at `GemTable.tsx` line 60.

---

## Code Examples

### AccuracyBacktest Type Definition

```typescript
// Source: Phase 40 CONTEXT.md D-08 (verified field names)
export interface AccuracyGwSummary {
  gw: number
  haulter_count: number
  xpts_flagged: number
  proj_pts_flagged: number
  xpts_hit_rate: number   // 0.0-1.0
  proj_pts_hit_rate: number
}

export interface AccuracySummary {
  xpts_hit_rate: number
  proj_pts_hit_rate: number
  gws: AccuracyGwSummary[]
}

export interface AccuracyHaulter {
  gw: number
  player_id: number
  player_name: string
  actual_pts: number
  xpts_predicted: number
  xpts_rank: number
  xpts_flagged: boolean
  proj_pts_predicted: number
  proj_pts_rank: number
  proj_pts_flagged: boolean
}

export interface AccuracyPlayerGw {
  gw: number
  actual_pts: number
  xpts_predicted: number
  xpts_delta: number   // actual - predicted; negative = over-prediction
  proj_pts_predicted: number
  proj_pts_delta: number
}

export interface AccuracyPlayer {
  player_id: number
  player_name: string
  team: string
  gws: AccuracyPlayerGw[]
}

export interface AccuracyBacktest {
  generated_at: string
  gws_covered: number[]   // [32, 31, 30, 29, 28] — most recent first
  summary: AccuracySummary
  haulters: AccuracyHaulter[]
  players: AccuracyPlayer[]
}
```

### Hit-Rate Badge (reusing InsightsTab TIER_CLASSES)

```typescript
// Source: src/components/insights/InsightsTab.tsx lines 7-10 (verified)
const TIER_CLASSES = {
  HIGH:   'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  MEDIUM: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  LOW:    'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
} as const

// UI-SPEC threshold for accuracy tab (different from InsightsTab — percentage not decimal):
function getHitRateTier(rate: number): keyof typeof TIER_CLASSES {
  if (rate >= 0.50) return 'HIGH'
  if (rate >= 0.30) return 'MEDIUM'
  return 'LOW'
}

// Render:
<span className={`inline-block text-xs rounded px-2 py-0.5 ${TIER_CLASSES[getHitRateTier(rate)]}`}>
  {(rate * 100).toFixed(1)}%
</span>
```

### Flagged Cell Indicator

```typescript
// Source: UI-SPEC (verified field name xpts_flagged / proj_pts_flagged from 40-CONTEXT.md)
function FlaggedCell({ flagged }: { flagged: boolean }) {
  return flagged
    ? <span className="text-green-600 dark:text-green-400" aria-label="Flagged: yes">✓</span>
    : <span className="text-zinc-400 dark:text-zinc-500" aria-label="Flagged: no">✗</span>
}
```

### Delta Formatting

```typescript
// Source: UI-SPEC (verified)
function DeltaCell({ delta }: { delta: number }) {
  const formatted = delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)
  const cls = delta < 0
    ? 'text-red-600 dark:text-red-400'
    : delta > 0
      ? 'text-green-600 dark:text-green-400'
      : 'text-zinc-500'
  return <span className={cls}>{formatted}</span>
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| `useEffect` + `useState` for fetch | `useQuery` (TanStack Query v5) | useQuery used throughout codebase since Phase 28+ |
| SWR | TanStack Query | The project uses TanStack Query, NOT SWR. InsightsTab uses `useInsights` which is a `useQuery` wrapper. [VERIFIED: useInsights.ts, usePlayers.ts] |

**Confirmed:** The codebase does NOT use SWR. All data fetching is TanStack Query `useQuery`. [VERIFIED: useInsights.ts, usePlayers.ts, useDefCon.ts]

---

## Environment Availability

Step 2.6: All external dependencies are present. No new packages required.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js API routes | Yes | v25.8.1 | — |
| @tanstack/react-query | useAccuracy hook | Yes (in package.json) | ^5.95.2 | — |
| @vercel/blob | /api/accuracy production | Yes (in package.json) | ^2.3.1 | — |
| vitest | Test runner | Yes (in package.json) | ^4.1.2 | — |
| accuracy_backtest.json | /api/accuracy, /api/players | **Not yet generated** | — | Graceful null fallback (see Pitfall 3) |

**Missing dependencies with fallback:**
- `pipeline/cache/accuracy_backtest.json` — not yet generated (Phase 40 must run first). The `/api/accuracy` route returns 404/500, and `/api/players` falls back to all-null for `last_gw_actual_pts`. This is expected state until Phase 40 pipeline runs in the execution environment.

---

## Validation Architecture

Nyquist validation is enabled (`workflow.nyquist_validation` not set to false in config.json).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/components/accuracy/ src/lib/hooks/useAccuracy.ts src/app/api/accuracy/ src/components/gem-table/GwToggle.test.ts src/components/gem-table/columns.test.tsx src/app/page.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ACC-02 | GW summary table renders 5 rows + Overall row from backtest data | unit (RTL) | `npx vitest run src/components/accuracy/AccuracyTab.test.tsx` | Wave 0 |
| ACC-02 | Hit-rate badge applies correct tier class (HIGH/MEDIUM/LOW) | unit (RTL) | same | Wave 0 |
| ACC-03 | Haulter list renders flagged ✓/✗ correctly | unit (RTL) | same | Wave 0 |
| ACC-04 | PlayerDeltaTable default sort is xPts Δ ascending | unit (RTL) | same | Wave 0 |
| ACC-04 | Clicking column header toggles sort direction | unit (RTL) | same | Wave 0 |
| ACC-05 | `last_gw_actual_pts` visible in default/analysis presets | unit | `npx vitest run src/components/gem-table/GwToggle.test.ts` | Exists — needs new cases |
| ACC-05 | `last_gw_actual_pts` hidden in compact preset | unit | same | Exists — needs new cases |
| ACC-05 | column renders `—` for null values | unit (RTL) | `npx vitest run src/components/gem-table/columns.test.tsx` | Exists — needs new cases |
| ACC-06 | After removal: loser model fields absent from page.tsx render | unit (RTL) | `npx vitest run src/app/page.test.tsx` | Exists — needs mock update |
| ACC-06 | After removal: SubTab union compiles (TypeScript) | compile-time | `npx tsc --noEmit` | N/A — CI |

### Sampling Rate

- **Per task commit:** `npx vitest run src/components/accuracy/ src/components/gem-table/GwToggle.test.ts src/components/gem-table/columns.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/components/accuracy/AccuracyTab.test.tsx` — covers ACC-02, ACC-03, ACC-04
- [ ] `src/lib/hooks/useAccuracy.ts` — needed by AccuracyTab
- [ ] `src/app/api/accuracy/route.ts` — needed by useAccuracy

*(Existing test infrastructure — `vitest.config.ts`, `@testing-library/react`, jsdom — covers all phase requirements. No new test framework setup needed.)*

---

## Project Constraints (from CLAUDE.md)

- **Do not add `Co-Authored-By` trailers to git commits.** [VERIFIED: CLAUDE.md]
- **Read `node_modules/next/dist/docs/` before writing Next.js code.** This version (16.2.1) has breaking changes. API routes, App Router conventions may differ from training data. [VERIFIED: AGENTS.md]
- No shadcn — confirmed `shadcn_initialized: false` in UI-SPEC frontmatter. [VERIFIED: 41-UI-SPEC.md]
- Two font weights only: 400 and 600. No `font-medium`. [VERIFIED: UI-SPEC]
- Spacing multiples of 4px. Badge pill vertical padding exception: `py-0.5`. [VERIFIED: UI-SPEC]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `useState` sort in a plain `<table>` is the correct pattern for PlayerDeltaTable — no TanStack Table | Architecture Patterns: Pattern 5 | Low risk: if TanStack Table is expected, refactor adds boilerplate but no logic change |
| A2 | Adding `gwN` as a second parameter with default to `createColumns` is the best way to pass dynamic GW label | Pitfall 6 | Low risk: alternative is to read from context/data inside the cell renderer — either works |
| A3 | `last_gw_actual_pts` should be optional on `MergedPlayer` (not required) since pipeline doesn't produce it | Code Examples | Medium: if the planner puts it on `ScoredPlayer` only, the `/api/players` route must cast the return type. Either location works — confirm in plan. |

**Assumptions requiring user confirmation before execution:** None. All three assumptions are low-stakes implementation decisions within Claude's discretion.

---

## Open Questions

1. **Which model wins (ACC-06)?**
   - What we know: Both models exist; `accuracy_backtest.json` will show the winner at checkpoint time.
   - What's unclear: Cannot pre-decide — this is intentional (D-08).
   - Recommendation: The Plan 03 checkpoint task must read `accuracy_backtest.json`, display both models' hit rates, prompt the user, and then proceed with the appropriate removal. The plan should provide separate checklists for each scenario (remove xPts vs remove proj_pts) given the asymmetric scope (see Pitfall 5).

2. **Should `last_gw_actual_pts` be on `MergedPlayer` or `ScoredPlayer`?**
   - What we know: `ScoredPlayer extends MergedPlayer`. The field is added by the API join, not the pipeline. `computeAllGemScores` in `GemTable.tsx` takes `MergedPlayer[]` and returns `ScoredPlayer[]` — if the field is on `MergedPlayer`, it flows through automatically.
   - What's unclear: The UI-SPEC says "Add `last_gw_actual_pts: number | null` to `ScoredPlayer`" but the join happens in `/api/players` which returns `MergedPlayer[]`. Putting it on `MergedPlayer` is simpler.
   - Recommendation: Add to `MergedPlayer` as `last_gw_actual_pts?: number | null`. It will be present on `ScoredPlayer` by inheritance. The optional `?` handles players absent from backtest without a null union on every field.

---

## Sources

### Primary (HIGH confidence)

- Direct codebase reads — all findings verified from source files
  - `src/app/page.tsx` — SubTab union type, SECTIONS array, content render guards
  - `src/components/gem-table/columns.tsx` — all column definitions, fmtScoreNull, createColumns signature
  - `src/components/gem-table/GwToggle.tsx` — PRESET_COLUMN_VISIBILITY maps, getColumnVisibility function
  - `src/lib/types.ts` — MergedPlayer, ScoredPlayer type definitions
  - `src/components/insights/InsightsTab.tsx` — canonical tab pattern, TIER_CLASSES
  - `src/lib/hooks/useInsights.ts` — TanStack Query hook pattern (NOT SWR)
  - `src/app/api/players/route.ts` — player data route, Blob/local pattern
  - `src/app/api/insights/route.ts` + `defcon/route.ts` — canonical API route patterns
  - `src/components/nav/MobileNav.tsx` — reads SECTIONS from page.tsx, no separate SubTab list
  - `pipeline/merge.py` — full proj_pts and xPts field locations
  - `.planning/phases/40-accuracy-pipeline/40-CONTEXT.md` — accuracy_backtest.json exact shape (D-08)
  - `.planning/phases/41-accuracy-ui-model-rationalisation/41-CONTEXT.md` — all locked decisions
  - `.planning/phases/41-accuracy-ui-model-rationalisation/41-UI-SPEC.md` — visual contracts, component inventory
  - `vitest.config.ts`, `package.json` — test framework confirmed (Vitest 4.1.2, jsdom, RTL)
  - `src/components/insights/InsightsTab.test.tsx` — test pattern for new AccuracyTab tests

### Secondary (MEDIUM confidence)

- None required — all research needs were met by codebase reads.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — verified from package.json and existing hooks
- Architecture patterns: HIGH — verified from 5+ existing parallel implementations
- accuracy_backtest.json shape: HIGH — verified from Phase 40 CONTEXT.md D-08 specification (file doesn't exist yet, but spec is authoritative)
- Pitfalls: HIGH — all verified from direct code inspection
- ACC-06 removal scope: HIGH — verified from merge.py and columns.tsx full reads
- Test infrastructure: HIGH — verified from vitest.config.ts, existing test files

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (stable stack — 30 days)
