# Phase 33: Insights Tab - Pattern Map

**Mapped:** 2026-04-28
**Files analyzed:** 8
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `pipeline/insights.py` | pipeline module | batch/transform | `pipeline/defcon.py` | exact |
| `pipeline/run.py` (modified) | pipeline entry point | batch/transform | existing `save('captain_picks.json', ...)` call at line 149 | exact |
| `src/app/api/insights/route.ts` | API route | request-response | `src/app/api/captain-picks/route.ts` | exact |
| `src/lib/hooks/useInsights.ts` | hook | request-response | `src/lib/hooks/useCaptainPicks.ts` | exact |
| `src/types/insights.ts` (or inline in `src/lib/types.ts`) | type definition | — | `CaptainPick` / `CaptainPicks` block in `src/lib/types.ts` lines 327–345 | exact |
| `src/components/insights/InsightsTab.tsx` | component | request-response | `src/components/captaincy/CaptainPicksPanel.tsx` | exact |
| `src/app/page.tsx` (modified) | page/routing | request-response | existing tab additions throughout `src/app/page.tsx` | exact |
| `src/components/nav/MobileNav.tsx` (modified) | navigation | — | existing `TABS` array in `src/components/nav/MobileNav.tsx` lines 5–13 | exact |

---

## Pattern Assignments

### `pipeline/insights.py` (pipeline module, batch/transform)

**Analog:** `pipeline/defcon.py`

**Module docstring + signature pattern** (defcon.py lines 1–20):
```python
"""Compute DefCon stats from FPL element-summary per-match history."""

def compute_defcon_stats(bootstrap: dict, difficulty_scores: dict, summaries: dict) -> list:
    """
    For each DEF/MID/FWD player with starts > 0, look up element-summary from
    the pre-fetched summaries dict and compute hit rate, avg per90, distance to
    threshold, and fixture correlation.

    Args:
        bootstrap: Full FPL bootstrap-static JSON
        difficulty_scores: dict mapping team_id (int) -> difficulty score (0.0-1.0)
        summaries: dict mapping player_id (int) -> element-summary response dict.
                   Pre-fetched by run.py shared cache.
    Returns:
        List of dicts matching DefConPlayer interface shape
    """
```

The new module follows the same pattern — top-level public function receives only pre-fetched dicts, returns a list. No internal fetches. No class — module-level function with private `_helper` functions below.

**Core pattern — minimum sample gate** (defcon.py lines 37–39):
```python
history = [m for m in summary.get('history', []) if m['minutes'] > 0]
games_played = len(history)
if games_played < 5:
    continue
```
For `insights.py`, adapt to D-03: gate is `sample_total < 10` rather than `games_played < 5`. Each `_pattern()` helper that returns an Insight dict must check this gate before computing a percentage and return `None` when the floor is not met. The public function skips `None` results.

**Return dict shape** — each insight is a plain dict matching the `Insight` TypeScript type (D-12):
```python
{
    'id': str,           # stable string key, e.g. 'def_cs_home_vs_away'
    'category': str,     # 'defensive' | 'attacking' | 'player' | 'captaincy'
    'statement': str,    # human-readable, specific, non-trivial
    'confidence_pct': float,  # 0–100 (round to 1 d.p.)
    'sample_n': int,     # numerator (how many times pattern held true)
    'sample_total': int, # denominator (total opportunities)
}
```

**Sorting pattern** — sort before returning, matching RESEARCH.md Pattern 1:
```python
insights.sort(key=lambda i: (i['category'], -i['confidence_pct']))
return insights
```

**Triviality gate** — hardcoded exclusion set at top of module (D-07):
```python
_TRIVIAL_PATTERN_IDS = frozenset({
    'trivial_win_more_goals',
    'trivial_bench_scores_less',
    # ... extend as needed
})
```
Check `if insight['id'] in _TRIVIAL_PATTERN_IDS: continue` in the public function before appending.

**Private helper function convention** (defcon.py lines 70–96):
```python
def _compute_fixture_correlation(history: list, difficulty_scores: dict, threshold: int) -> dict:
    """Split games into easy vs hard fixtures and compare hit rates."""
    easy_games = [m for m in history if difficulty_scores.get(m.get('opponent_team'), 0.5) < 0.4]
    hard_games = [m for m in history if difficulty_scores.get(m.get('opponent_team'), 0.5) > 0.6]

    if len(easy_games) < 5 or len(hard_games) < 5:
        return {
            'insufficient_data': True,
            'easy_n': len(easy_games),
            'hard_n': len(hard_games),
        }
    ...
```
Each category gets its own private helper: `_defensive_patterns()`, `_attacking_patterns()`, `_player_patterns()`, `_captaincy_patterns()`. Each returns `list[dict | None]`. Caller filters `None`.

---

### `pipeline/run.py` (modified — add compute_insights call)

**Analog:** existing `captain_picks` write call at `pipeline/run.py` lines 147–149

**Import addition** (mirrors line 17 `from defcon import compute_defcon_stats`):
```python
from insights import compute_insights
```

**Call + save pattern** (lines 147–149 for reference):
```python
merged, captain_picks = merge_players(bootstrap, fixtures, understat, id_map, xmins_stats=xmins_stats, summaries=summaries)
save('merged_players.json', merged)
save('captain_picks.json', captain_picks)  # Phase 31 CAP-03/CAP-04
```

Insert immediately after the `save('captain_picks.json', ...)` line:
```python
insights = compute_insights(merged, bootstrap, fixtures, summaries, finished_gws)
save('insights.json', insights)
```

`finished_gws` is already in scope at that point (line 138). `summaries` is already in scope (populated lines 126–135). `merged` is the list (first element of the tuple returned from `merge_players`). No new variables required.

---

### `src/app/api/insights/route.ts` (new API route, request-response)

**Analog:** `src/app/api/captain-picks/route.ts` (entire file, 33 lines)

**Full file pattern** (captain-picks/route.ts lines 1–33):
```typescript
import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'

export async function GET() {
  try {
    let data: string

    if (USE_BLOB) {
      const { blobs } = await list({ prefix: 'captain_picks.json', limit: 1 })
      if (!blobs.length) {
        return Response.json({ error: 'Captain picks not available' }, { status: 404 })
      }
      const res = await fetch(blobs[0].url)
      data = await res.text()
    } else {
      const cachePath = join(process.cwd(), 'pipeline', 'cache', 'captain_picks.json')
      data = await readFile(cachePath, 'utf-8')
    }

    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch {
    return Response.json({ error: 'Failed to load captain picks' }, { status: 500 })
  }
}
```

**Substitutions for insights:**
- `'captain_picks.json'` → `'insights.json'` (3 occurrences: `list({ prefix: ... })`, `cachePath` join, error message)
- `'Captain picks not available'` → `'Insights not available'`
- `'Failed to load captain picks'` → `'Failed to load insights'`

No other changes — the USE_BLOB toggle, headers, and error structure are identical.

---

### `src/lib/hooks/useInsights.ts` (new hook, request-response)

**Analog:** `src/lib/hooks/useCaptainPicks.ts` (entire file, 14 lines)

**Full file pattern** (useCaptainPicks.ts lines 1–14):
```typescript
import { useQuery } from '@tanstack/react-query'
import type { CaptainPicks } from '../types'

export function useCaptainPicks() {
  return useQuery<CaptainPicks>({
    queryKey: ['captain-picks'],
    queryFn: async () => {
      const res = await fetch('/api/captain-picks')
      if (!res.ok) throw new Error('Failed to fetch captain picks')
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000, // 6 hours
  })
}
```

**Substitutions for insights:**
- `CaptainPicks` → `Insight[]` (the hook returns a flat array, not a wrapper object — D-12 + RESEARCH.md A1)
- `'captain-picks'` → `'insights'` (both the queryKey string and the fetch path)
- `useCaptainPicks` → `useInsights`
- Error message string: `'Failed to fetch insights'`

`staleTime: 6 * 60 * 60 * 1000` is kept identical (D-11).

---

### `src/lib/types.ts` (modified — add `Insight` interface)

**Analog:** `CaptainPick` / `CaptainPicks` block at `src/lib/types.ts` lines 327–345

**Existing type block pattern** (lines 327–345):
```typescript
// Captain picks data (Phase 31 CAP-03/CAP-04 — pipeline writes pipeline/cache/captain_picks.json)
export interface CaptainPick {
  id: number
  name: string
  team: string                 // team_short_name (e.g. "ARS")
  position: string             // GK | DEF | MID | FWD
  now_cost: number             // tenths of £m (91 = £9.1m)
  xPts_1gw: number
  xPts_90th_1gw: number        // xPts_1gw + 1.28 * sigma_1gw (D-05)
  selected_by_percent: string  // FPL returns string ("12.4")
  eo_threshold_used?: number   // present only on eo_adjusted when a threshold (25.0 or 35.0) succeeded
}

export interface CaptainPicks {
  generated_at: string
  gameweek: number | null
  ceiling: CaptainPick | null
  eo_adjusted: CaptainPick | null
}
```

**New block to append** (after line 345, following the same comment-header convention):
```typescript
// Insights data (Phase 33 INS-01/INS-02 — pipeline writes pipeline/cache/insights.json)
export interface Insight {
  id: string                                              // stable pattern key
  category: 'defensive' | 'attacking' | 'player' | 'captaincy'
  statement: string                                       // human-readable pattern text
  confidence_pct: number                                  // 0–100
  sample_n: number                                        // how many times pattern held true
  sample_total: number                                    // total opportunities observed
}
```

---

### `src/components/insights/InsightsTab.tsx` (new component, request-response)

**Analog:** `src/components/captaincy/CaptainPicksPanel.tsx` (entire file, 94 lines)

**Directive + imports pattern** (CaptainPicksPanel.tsx lines 1–5):
```typescript
'use client'

import { useCaptainPicks } from '@/lib/hooks/useCaptainPicks'
import type { CaptainPick } from '@/lib/types'
```

Substitute: `useInsights` hook, `Insight` type.

**Loading state pattern** (CaptainPicksPanel.tsx lines 53–59):
```typescript
if (isLoading) {
  return (
    <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
      Loading captain picks…
    </p>
  )
}
```

**Error state pattern** (CaptainPicksPanel.tsx lines 61–65):
```typescript
if (error) {
  return (
    <p className="text-sm text-red-600 dark:text-red-400 py-4">
      Failed to load captain picks. Check the pipeline output and refresh.
    </p>
  )
}
```

**Section heading pattern** — use `text-lg font-semibold mb-2` to match `DefConTables.tsx` lines 124/133 and `CaptainPicksPanel.tsx` line 78. (Not `text-xl font-bold` which is used only by ClubFormTable — the lighter weight matches the captaincy/defcon family better):
```typescript
<h2 className="text-lg font-semibold mb-2">Defensive Patterns</h2>
```

**Card border/background pattern** (CaptainPicksPanel.tsx lines 22–29):
```typescript
<div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 space-y-2">
```

**Tooltip via `title` attribute** (CaptainPicksPanel.tsx line 25):
```typescript
<h3 className="text-sm font-semibold" title={TOOLTIPS[kind]}>{LABELS[kind]}</h3>
```
For the confidence badge, the same `title` attribute approach applies:
```typescript
<span
  className={`inline-block text-xs font-normal rounded px-2 py-1 cursor-help ${TIER_CLASSES[tier]}`}
  title={`True in ${insight.confidence_pct}% of fixtures — ${insight.sample_n}/${insight.sample_total} matches`}
>
  {tier}
</span>
```

**Badge colour classes** (D-05, matching `RegressionSignalBadge.tsx` lines 22–23 and 31–32 for green/amber, adding zinc for LOW):
```typescript
// RegressionSignalBadge.tsx lines 22-23 (BUY = green):
className="inline-block text-xs font-normal rounded px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
// RegressionSignalBadge.tsx lines 31-32 (SELL = amber):
className="inline-block text-xs font-normal rounded px-2 py-1 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200"
```

The tier map for InsightsTab:
```typescript
const TIER_CLASSES = {
  HIGH:   'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  MEDIUM: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  LOW:    'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
} as const

function getTier(pct: number): keyof typeof TIER_CLASSES {
  if (pct >= 70) return 'HIGH'
  if (pct >= 50) return 'MEDIUM'
  return 'LOW'
}
```

**Empty state pattern** — when `data` is an empty array `[]`, render a placeholder (RESEARCH.md Pitfall 4):
```typescript
if (!data || data.length === 0) {
  return (
    <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
      No insights available yet. Run the pipeline to generate insights.
    </p>
  )
}
```

**Top-level wrapper pattern** (CaptainPicksPanel.tsx line 76):
```typescript
<section className="mt-6 space-y-3">
```

**Category grouping** — group the flat `Insight[]` array by `category` field before rendering. Ordered: `defensive` → `attacking` → `player` → `captaincy`. Category display names:
```typescript
const CATEGORY_LABELS: Record<string, string> = {
  defensive: 'Defensive Patterns',
  attacking: 'Attacking Patterns',
  player:    'Player-Specific Patterns',
  captaincy: 'Captaincy Patterns',
}
const CATEGORY_ORDER = ['defensive', 'attacking', 'player', 'captaincy'] as const
```

---

### `src/app/page.tsx` (modified — Tab union + nav button + content block)

**Analog:** existing tab additions in `src/app/page.tsx`

**Tab union type** (page.tsx line 17):
```typescript
type Tab = 'gems' | 'defcon' | 'squad' | 'club-form' | 'value-gems' | 'planner' | 'set-pieces'
```
New value `'insights'` inserts between `'set-pieces'` and `'value-gems'` (D-09):
```typescript
type Tab = 'gems' | 'defcon' | 'squad' | 'club-form' | 'set-pieces' | 'insights' | 'value-gems' | 'planner'
```

**Nav button pattern** (page.tsx lines 75–84 — set-pieces button, the one immediately before the insertion point):
```typescript
<button
  className={`pb-2 px-1 text-sm font-medium ${
    activeTab === 'set-pieces'
      ? 'border-b-2 border-zinc-900 dark:border-white text-zinc-900 dark:text-white'
      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
  }`}
  onClick={() => setActiveTab('set-pieces')}
>
  Set Pieces
</button>
```
Copy this block verbatim; replace `'set-pieces'` with `'insights'` and label with `Insights`.

**Import addition** — add alongside the other component imports at the top of the file:
```typescript
import { InsightsTab } from '@/components/insights/InsightsTab'
```

**Content block pattern** (page.tsx line 122):
```typescript
{activeTab === 'set-pieces' && <SetPieceTakerPanel />}
```
Insert after this line:
```typescript
{activeTab === 'insights' && <InsightsTab />}
```

---

### `src/components/nav/MobileNav.tsx` (modified — Tab union + TABS array)

**Analog:** `src/components/nav/MobileNav.tsx` lines 1–13 (the entire type + TABS block)

**Current Tab type + TABS** (MobileNav.tsx lines 3–13):
```typescript
type Tab = 'gems' | 'defcon' | 'squad' | 'club-form' | 'value-gems' | 'planner' | 'set-pieces'

const TABS = [
  { id: 'gems',        label: 'Gems' },
  { id: 'defcon',      label: 'DefCon' },
  { id: 'squad',       label: 'Squad' },
  { id: 'club-form',   label: 'Form' },
  { id: 'set-pieces',  label: 'SP' },
  { id: 'value-gems',  label: 'Values' },
  { id: 'planner',     label: 'Plan' },
] as const satisfies ReadonlyArray<{ id: Tab; label: string }>
```

**Required changes — must match `page.tsx` atomically** (RESEARCH.md Pitfall 3):
1. `Tab` type: add `'insights'` between `'set-pieces'` and `'value-gems'`
2. `TABS` array: insert `{ id: 'insights', label: 'Insights' }` between `set-pieces` and `value-gems` entries

Result:
```typescript
type Tab = 'gems' | 'defcon' | 'squad' | 'club-form' | 'set-pieces' | 'insights' | 'value-gems' | 'planner'

const TABS = [
  { id: 'gems',        label: 'Gems' },
  { id: 'defcon',      label: 'DefCon' },
  { id: 'squad',       label: 'Squad' },
  { id: 'club-form',   label: 'Form' },
  { id: 'set-pieces',  label: 'SP' },
  { id: 'insights',    label: 'Insights' },
  { id: 'value-gems',  label: 'Values' },
  { id: 'planner',     label: 'Plan' },
] as const satisfies ReadonlyArray<{ id: Tab; label: string }>
```

Note: mobile nav now has 8 tabs. All tabs use `flex-1` (MobileNav.tsx line 30) so they auto-divide width — no layout change required.

---

## Shared Patterns

### Loading / Error / Empty States
**Source:** `src/components/captaincy/CaptainPicksPanel.tsx` lines 53–70
**Apply to:** `InsightsTab.tsx`
```typescript
if (isLoading) {
  return (
    <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
      Loading…
    </p>
  )
}
if (error) {
  return (
    <p className="text-sm text-red-600 dark:text-red-400 py-4">
      Failed to load. Check the pipeline output and refresh.
    </p>
  )
}
if (!data) return null
```

### Badge Shape
**Source:** `src/components/gem-table/RegressionSignalBadge.tsx` lines 20–27
**Apply to:** confidence tier badge inside `InsightsTab.tsx`
```typescript
className="inline-block text-xs font-normal rounded px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
```
The `inline-block` prefix is the production pattern; RESEARCH.md's examples omit it — use `inline-block` to match the existing badge components.

### Tooltip via `title` Attribute
**Source:** `src/components/captaincy/CaptainPicksPanel.tsx` line 25
**Apply to:** confidence tier badge `<span>` in `InsightsTab.tsx`
```typescript
title={`True in ${insight.confidence_pct}% of fixtures — ${insight.sample_n}/${insight.sample_total} matches`}
```

### Pipeline Module Interface (no external fetches)
**Source:** `pipeline/defcon.py` lines 6–20 + `pipeline/xmins.py` lines 6–17
**Apply to:** `pipeline/insights.py`
All data passed as arguments. No `import requests`, no `get_element_summary()` calls inside the module. Any data needed must be available from the `merged`, `bootstrap`, `fixtures`, `summaries`, `finished_gws` arguments already passed.

### `save()` Call Convention
**Source:** `pipeline/run.py` lines 148–149
**Apply to:** `pipeline/run.py` modification
```python
save('captain_picks.json', captain_picks)  # existing
save('insights.json', insights)            # new — same pattern, flat list
```
`save()` accepts any JSON-serialisable Python value (list, dict). Flat list `[]` on first pipeline run produces valid JSON that the API route can serve without a 500 error.

---

## No Analog Found

All 8 files have close analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `src/app/`, `src/lib/hooks/`, `src/lib/types.ts`, `src/components/`, `pipeline/*.py`
**Files scanned:** 10 (captain-picks/route.ts, useCaptainPicks.ts, CaptainPicksPanel.tsx, page.tsx, MobileNav.tsx, run.py, defcon.py, xmins.py, types.ts, RegressionSignalBadge.tsx)
**Pattern extraction date:** 2026-04-28
