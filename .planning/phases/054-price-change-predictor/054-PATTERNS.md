# Phase 54: Price Change Predictor - Pattern Map

**Mapped:** 2026-05-02
**Files analyzed:** 9 (6 new, 3 modified)
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `pipeline/price_changes.py` | service | transform | `pipeline/bonus.py` | exact |
| `pipeline/cache/price_changes.json` | config | — | `pipeline/cache/set_piece_changes.json` | exact |
| `pipeline/cache/price_changes_snapshot.json` | config | — | `pipeline/cache/set_pieces_snapshot.json` | exact |
| `src/app/api/price-changes/route.ts` | route | request-response | `src/app/api/set-pieces/route.ts` | exact |
| `src/lib/hooks/usePriceChanges.ts` | hook | request-response | `src/lib/hooks/useSetPieces.ts` | exact |
| `src/components/price-changes/PriceChangePanel.tsx` | component | request-response | `src/components/insights/InsightsTab.tsx` | exact |
| `pipeline/run.py` | config | batch | `pipeline/run.py` lines 215-231 (set-piece block) | exact |
| `src/app/page.tsx` | config | — | `src/app/page.tsx` lines 47-82, 194-214 | exact |
| `src/lib/types.ts` | model | — | `src/lib/types.ts` lines 466-489 (SetPieceChanges block) | exact |

---

## Pattern Assignments

### `pipeline/price_changes.py` (service, transform)

**Analog:** `pipeline/bonus.py`

**Imports pattern** (`pipeline/bonus.py` lines 1-6):
```python
"""Compute per-player bonus EV from rolling BPS history (Phase 53 BPS-01).

Mirrors pipeline/xmins.py shape: pre-merge module that reads the shared
element-summary cache and returns a dict keyed by FPL player_id. Output is
consumed by pipeline/merge.py via the bonus_predictor_enabled gate (Plan 02).
"""

import statistics
```

**Module-level constants pattern** (`pipeline/bonus.py` lines 18-28):
```python
# Position-prior fallback — matches merge.BONUS_RATE exactly (used as Bayesian prior)
POSITION_PRIOR = {1: 0.30, 2: 0.40, 3: 0.60, 4: 0.70}

# Shrinkage parameters
RECENT_WINDOW = 10        # mirror xmins.py recent[-10:] window
MIN_STARTS_GATE = 4       # below this -> position-prior only
SHRINKAGE_K = 12          # smoothing constant; w = min(1.0, n_starts / SHRINKAGE_K)
```
For `price_changes.py`: replace with `MINIMUM_CONFIDENCE_PCT = 5.0`, `STABLE_LABEL_THRESHOLD = 5.0`, etc.

**Public function signature pattern** (`pipeline/bonus.py` lines 30-51):
```python
def compute_bonus_predictions(bootstrap: dict, summaries: dict, finished_gws: int) -> dict:
    """Compute per-player bonus EV from rolling BPS history.

    Args:
        bootstrap: FPL bootstrap-static JSON (elements list).
        summaries: dict mapping player_id (int) -> element-summary dict.
                   Pre-fetched by run.py shared cache. Players absent from this dict
                   (e.g. 0-starts promoted-team players) receive the flat position prior.
        finished_gws: Number of completed gameweeks. Accepted for signature parity
                      with compute_xmins_stats but currently unused — bonus EV is
                      derived from the recent window of element-summary history alone.

    Returns:
        dict mapping player_id (int) -> {bonus_ev: float (4dp), n_starts: int,
        source: 'learned' | 'flat_default'}. Every player in bootstrap['elements']
        gets an entry.
    """
    results = {}
    for element in bootstrap.get('elements', []):
        player_id = element['id']
        results[player_id] = _compute_player_bonus_ev(element, summaries.get(player_id))
    return results
```
For `price_changes.py`: public function is `compute_price_change_predictions(bootstrap: dict, prev_snapshot: dict) -> tuple[dict, dict]`, returning `(predictions_payload, current_snapshot)`.

**Guard pattern for missing/bad data** (`pipeline/bonus.py` lines 54-65):
```python
def _compute_player_bonus_ev(element: dict, summary: dict | None) -> dict:
    element_type = element.get('element_type', 3)
    prior = POSITION_PRIOR[element_type]

    # Guard 1: no element-summary at all (e.g. promoted-team player, 0 starts)
    if not summary:
        return {'bonus_ev': prior, 'n_starts': 0, 'source': 'flat_default'}

    history = summary.get('history', [])
    recent = history[-RECENT_WINDOW:]
    starts_in_recent = [m for m in recent if m.get('starts') == 1]
    n_starts = len(starts_in_recent)

    # Guard 2: insufficient sample -> flat fallback
    if n_starts < MIN_STARTS_GATE:
        return {'bonus_ev': prior, 'n_starts': n_starts, 'source': 'flat_default'}
```
For `price_changes.py`: apply this guard shape to protect against `selected_by_percent` being `''`, `'0.0'`, or missing. Use `max(1.0, float(element.get('selected_by_percent', '0') or '0') * 10)` for threshold.

---

### `pipeline/cache/price_changes.json` (seed artifact)

**Analog:** `pipeline/cache/set_piece_changes.json` (existing tracked file)

**Seed content:**
```json
{"predictions": []}
```

**CRITICAL — gitignore conflict:** `pipeline/cache/` is listed in `.gitignore` (line 43-44). Both seed files require `git add -f` to force-track them. Same situation applies to all existing `pipeline/cache/*.json` files that are currently tracked.

**Verification:** `git ls-files pipeline/cache/` confirms which cache files are currently tracked — the `set_piece_changes.json` and `set_pieces_snapshot.json` files are already tracked despite the gitignore, meaning `git add -f` is the established pattern.

---

### `pipeline/cache/price_changes_snapshot.json` (seed snapshot)

**Analog:** `pipeline/cache/set_pieces_snapshot.json` (existing tracked file)

**Seed content:**
```json
{}
```

Note: `run.py`'s `FileNotFoundError` guard handles absence of this file — but committing it as `{}` is conventional (matches the set-pieces pattern). The seed artifact (`price_changes.json`) is strictly required (SC-5); the snapshot seed is conventional only.

---

### `src/app/api/price-changes/route.ts` (route, request-response)

**Analog:** `src/app/api/set-pieces/route.ts`

**Full file pattern** (`src/app/api/set-pieces/route.ts` lines 1-33) — this is a direct clone with two substitutions:
```typescript
import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'

export async function GET() {
  try {
    let data: string

    if (USE_BLOB) {
      const { blobs } = await list({ prefix: 'set_piece_changes.json', limit: 1 })
      // ^^ CHANGE TO: prefix: 'price_changes.json'
      if (!blobs.length) {
        return Response.json({ error: 'Set-piece data not available' }, { status: 404 })
        // ^^ CHANGE TO: 'Price change data not available'
      }
      const res = await fetch(blobs[0].url)
      data = await res.text()
    } else {
      const cachePath = join(process.cwd(), 'pipeline', 'cache', 'set_piece_changes.json')
      // ^^ CHANGE TO: 'price_changes.json'
      data = await readFile(cachePath, 'utf-8')
    }

    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        // ^^ CHANGE s-maxage TO: 1800  (30 min per D-03/RESEARCH Pattern 3)
      },
    })
  } catch {
    return Response.json({ error: 'Failed to load set-piece data' }, { status: 500 })
    // ^^ CHANGE TO: 'Failed to load price change data'
  }
}
```

**Substitutions required (4 total):**
1. `'set_piece_changes.json'` (Blob prefix) → `'price_changes.json'`
2. `'Set-piece data not available'` → `'Price change data not available'`
3. `'set_piece_changes.json'` (local path) → `'price_changes.json'`
4. `s-maxage=3600` → `s-maxage=1800`

---

### `src/lib/hooks/usePriceChanges.ts` (hook, request-response)

**Analog:** `src/lib/hooks/useSetPieces.ts`

**Full file pattern** (`src/lib/hooks/useSetPieces.ts` lines 1-14) — direct clone with three substitutions:
```typescript
import { useQuery } from '@tanstack/react-query'
import type { SetPieceChanges } from '../types'
// ^^ CHANGE TO: PriceChanges

export function useSetPieces() {
// ^^ CHANGE TO: usePriceChanges
  return useQuery<SetPieceChanges>({
  // ^^ CHANGE TO: PriceChanges
    queryKey: ['set-pieces'],
    // ^^ CHANGE TO: ['price-changes']
    queryFn: async () => {
      const res = await fetch('/api/set-pieces')
      // ^^ CHANGE TO: '/api/price-changes'
      if (!res.ok) throw new Error('Failed to fetch set-piece data')
      // ^^ CHANGE TO: 'Failed to fetch price change data'
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000, // 6 hours
    // ^^ CHANGE TO: 30 * 60 * 1000  (30 minutes per D-03)
  })
}
```

**No `'use client'` directive** — hook files do not have `'use client'`. Verified: `useSetPieces.ts` has no `'use client'`.

---

### `src/components/price-changes/PriceChangePanel.tsx` (component, request-response)

**Analog:** `src/components/insights/InsightsTab.tsx`

**File header pattern** (`src/components/insights/InsightsTab.tsx` lines 1-4):
```typescript
'use client'

import { useInsights } from '@/lib/hooks/useInsights'
import type { Insight } from '@/lib/types'
```
For `PriceChangePanel.tsx`: `import { usePriceChanges } from '@/lib/hooks/usePriceChanges'` and `import type { PriceChangePrediction, PriceChanges } from '@/lib/types'`.

**Tier/badge constants pattern** (`src/components/insights/InsightsTab.tsx` lines 7-19):
```typescript
// D-04 tier thresholds + D-05 badge colours (LOCKED by 33-UI-SPEC.md)
const TIER_CLASSES = {
  HIGH:   'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  MEDIUM: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  LOW:    'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
} as const

type Tier = keyof typeof TIER_CLASSES

function getTier(pct: number): Tier {
  if (pct >= 70) return 'HIGH'
  if (pct >= 50) return 'MEDIUM'
  return 'LOW'
}
```
For `PriceChangePanel.tsx`: rename to `CONFIDENCE_CLASSES`, use HIGH=red per D-13 severity convention (`'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'`), keep MEDIUM=amber and LOW=zinc. Threshold: HIGH ≥ 70%, MEDIUM 40–69%, LOW < 40% (per D-04 in CONTEXT.md).

**Loading / error / empty guards pattern** (`src/components/insights/InsightsTab.tsx` lines 46-74):
```typescript
export function InsightsTab() {
  const { data, isLoading, error } = useInsights()

  if (isLoading) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
        Loading insights…
      </p>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400 py-4">
        Failed to load insights. Check the pipeline output and refresh.
      </p>
    )
  }

  if (!data || data.length === 0) {
    return (
      <section className="mt-6 space-y-2" aria-label="Insights not available">
        <h2 className="text-lg font-semibold">No insights available yet</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Run the pipeline to generate pattern data for this season.
        </p>
      </section>
    )
  }
  // ... render
}
```
For `PriceChangePanel.tsx`: empty state checks `!data || data.predictions.length === 0` (not `data.length === 0`) because the shape is `{ predictions: [] }` not a plain array.

**Sectioned render pattern** (`src/components/insights/InsightsTab.tsx` lines 89-109):
```typescript
return (
  <section className="mt-6 space-y-6" aria-label="Season pattern insights">
    {CATEGORY_ORDER.map((cat) => {
      const items = byCategory[cat]
      if (items.length === 0) return null
      return (
        <div key={cat}>
          <h2 className="text-lg font-semibold mb-2">{CATEGORY_LABELS[cat]}</h2>
          <div className="space-y-3">
            {items.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </div>
      )
    })}
  </section>
)
```
For `PriceChangePanel.tsx`: two sections (`rise`, `fall`) rendered in order per D-04. Each section uses the same `h2 + space-y-3` pattern. Stable players are omitted entirely (no third section per D-04).

**Progress bar pattern** (inline style, no Tailwind JIT dynamic class — per RESEARCH.md Pattern 8):
```tsx
<div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
  <div
    className="h-full bg-emerald-500 rounded-full transition-all"
    style={{ width: `${prediction.confidence_pct}%` }}
  />
</div>
```
Use `bg-emerald-500` for rise, `bg-red-400` for fall. NEVER use `w-[${pct}%]` — Tailwind JIT does not generate dynamic class names (verified, RESEARCH.md Pitfall 4).

**Early-data flag pattern** — no direct analog; use conditional rendering:
```tsx
{data.snapshot_days < 14 && (
  <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">
    Early data — less than 14 days of snapshots. Confidence scores are estimates only.
  </p>
)}
```
Suppress confidence tier badges (HIGH/MEDIUM/LOW) when `snapshot_days < 14` per D-06.

---

### `pipeline/run.py` (modified — add price-changes block)

**Analog:** `pipeline/run.py` lines 215-231 (existing set-piece block)

**Insertion point:** After line 231 (`print(f"Set-piece changes: {sp_changes['change_count']} change(s)")`), before line 233 (`# Compute DefCon stats`).

**Import to add** (after `from bonus import compute_bonus_predictions` at line ~20):
```python
from price_changes import compute_price_change_predictions
```

**Block to insert** (`pipeline/run.py` lines 215-231 as template):
```python
# SP-02: Set-piece snapshot diff
print("Computing set-piece snapshot diff...")
curr_snapshot = _extract_sp_snapshot(merged)

# Read previous snapshot (first run: empty dict)
sp_snapshot_path = os.path.join(cache_dir, 'set_pieces_snapshot.json')
prev_snapshot = {}
try:
    with open(sp_snapshot_path, 'r', encoding='utf-8') as f:
        prev_snapshot = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    pass

sp_changes = _diff_sp_snapshots(prev_snapshot, curr_snapshot, bootstrap)
save('set_piece_changes.json', sp_changes)
save('set_pieces_snapshot.json', curr_snapshot)
print(f"Set-piece changes: {sp_changes['change_count']} change(s)")
```
Replicate the `try/except (FileNotFoundError, json.JSONDecodeError): pass` pattern exactly. Use the same `save()` call pattern (two saves: output artifact + snapshot).

**Gate pattern for feature flags** (`pipeline/run.py` lines 179-196 — for reference only; price changes has no gate flag):
```python
form_signal_enabled = False
# ...
try:
    with open(backtest_path, 'r', encoding='utf-8') as f:
        prev_backtest = json.load(f)
    form_signal_enabled = prev_backtest.get('summary', {}).get('form_signal_enabled', False)
except (FileNotFoundError, json.JSONDecodeError):
    pass
```
Price changes does NOT use a gate flag in Phase 54 — always runs unconditionally, like the set-piece block.

---

### `src/app/page.tsx` (modified — SubTab union + SECTIONS + render)

**Analog:** `src/app/page.tsx` lines 47-82, 194-214

**SubTab union** (`src/app/page.tsx` line 47):
```typescript
export type SubTab = 'gems' | 'insights' | 'defcon' | 'set-pieces' | 'planner' | 'club-form' | 'value-gems' | 'accuracy' | 'decision' | 'transfers' | 'optimiser'
```
Add `| 'price-changes'` at the end of the union.

**SECTIONS constant — analyse subTabs** (`src/app/page.tsx` lines 53-60):
```typescript
subTabs: [
  { id: 'gems' as SubTab,       label: 'Gem Ratings',     mobileLabel: 'Gems'     },
  { id: 'insights' as SubTab,   label: 'Insights',        mobileLabel: 'Insights' },
  { id: 'defcon' as SubTab,     label: 'DefCon Analysis', mobileLabel: 'DefCon'   },
  { id: 'set-pieces' as SubTab, label: 'Set Pieces',      mobileLabel: 'SP'       },
  { id: 'accuracy' as SubTab,   label: 'Accuracy',        mobileLabel: 'Acc'      },
],
```
Append after `accuracy` entry: `{ id: 'price-changes' as SubTab, label: 'Price Changes', mobileLabel: 'Prices' }`.

**Render block pattern** (`src/app/page.tsx` lines 205-207 — surrounding render lines):
```typescript
{activeSection !== 'squad' && activeSubTab === 'set-pieces' && <SetPieceTakerPanel />}
{activeSection !== 'squad' && activeSubTab === 'insights' && <InsightsTab />}
{activeSection !== 'squad' && activeSubTab === 'accuracy' && <AccuracyTab />}
```
Add after the `accuracy` line: `{activeSection !== 'squad' && activeSubTab === 'price-changes' && <PriceChangePanel />}`

**Import to add** (after `import { AccuracyTab } from '@/components/accuracy/AccuracyTab'` at line ~23):
```typescript
import { PriceChangePanel } from '@/components/price-changes/PriceChangePanel'
```

---

### `src/lib/types.ts` (modified — add PriceChangePrediction + PriceChanges)

**Analog:** `src/lib/types.ts` lines 466-489 (SetPieceChanges block)

**Insertion point:** After line 489 (end of `SetPieceChanges` interface), before the `// Captain picks data` comment at line 491.

**Existing analog shape** (`src/lib/types.ts` lines 466-489):
```typescript
// Set-piece changes data (SP-01/SP-02)
export interface SetPieceTaker {
  id: number | null
  name: string
  changed: boolean
  now_cost?: number
  selected_by_percent?: string
  fixtures?: FixtureEntry[]
  roles?: string[]
}

export interface SetPieceTeam {
  team_id: number
  team_short_name: string
  penalty_taker: SetPieceTaker
  fk_taker: SetPieceTaker
  corner_taker: SetPieceTaker
}

export interface SetPieceChanges {
  has_changes: boolean
  change_count: number
  teams: SetPieceTeam[]
}
```

**New types to insert** (modeled on the above — single-interface scalar data shape):
```typescript
// Price change predictions (Phase 54 PRC-01 — pipeline/cache/price_changes.json)
export type PriceDirection = 'rise' | 'fall' | 'stable'

export interface PriceChangePrediction {
  player_id: number
  name: string             // web_name from bootstrap
  team: string             // team_short_name
  now_cost: number         // tenths of £1m (e.g. 91 = £9.1m)
  direction: PriceDirection
  confidence_pct: number   // 0–100; clamp(cumulative_net / threshold, 0, 1) × 100
  eta_days: number         // 0 = "Tonight"; max(0, threshold - net) / avg_velocity
  cumulative_net: number   // raw cumulative net transfers since last price change
  selected_by_percent: string  // FPL string e.g. "12.5"
}

export interface PriceChanges {
  generated_at: string     // ISO 8601 timestamp
  snapshot_days: number    // count of daily snapshots; < 14 = "early data" (D-06)
  predictions: PriceChangePrediction[]  // empty array on cold start (D-05)
}
```

---

## Pipeline Test Pattern

### `pipeline/tests/test_price_changes.py` (test, unit)

**Analog:** `pipeline/tests/test_bonus.py`

**conftest.py pattern** (`pipeline/tests/conftest.py` lines 1-15 — already handles sys.path; no changes needed):
```python
import os
import sys

PIPELINE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PIPELINE_DIR not in sys.path:
    sys.path.insert(0, PIPELINE_DIR)
```

**Test file structure** (`pipeline/tests/test_bonus.py` lines 1-57):
```python
"""Pytest unit tests for compute_bonus_predictions and _compute_player_bonus_ev (Phase 53 BPS-01)."""

import pytest

from bonus import _compute_player_bonus_ev, compute_bonus_predictions


def _element(element_type=3, player_id=1):
    return {'id': player_id, 'element_type': element_type}


def _hist(bonus_pts, starts_field=1, minutes=90, clean_sheet=0):
    """One element-summary history row."""
    return {
        'minutes': minutes,
        'starts': starts_field,
        'bonus': bonus_pts,
        'clean_sheets': clean_sheet,
        'round': 1,
    }


def _summary(entries):
    return {'history': entries}


def test_returns_per_player_dict():
    """Return dict has keys {'bonus_ev', 'n_starts', 'source'}."""
    history = [_hist(1)] * 10
    result = _compute_player_bonus_ev(_element(), _summary(history))
    assert set(result.keys()) == {'bonus_ev', 'n_starts', 'source'}
```
For `test_price_changes.py`: import `from price_changes import compute_price_change_predictions`. Build minimal `_bootstrap_element()` and `_snapshot()` helpers. Cover the 7 test cases from RESEARCH.md Validation Architecture table.

**Do NOT import from `run.py`** — it has top-level side effects. Replicate tested logic in the test fixture directly.

---

## Shared Patterns

### USE_BLOB Toggle
**Source:** `src/app/api/set-pieces/route.ts` lines 5, 11-21
**Apply to:** `src/app/api/price-changes/route.ts`
```typescript
const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'
// ...
if (USE_BLOB) {
  const { blobs } = await list({ prefix: 'price_changes.json', limit: 1 })
  if (!blobs.length) {
    return Response.json({ error: '...' }, { status: 404 })
  }
  const res = await fetch(blobs[0].url)
  data = await res.text()
} else {
  const cachePath = join(process.cwd(), 'pipeline', 'cache', 'price_changes.json')
  data = await readFile(cachePath, 'utf-8')
}
```

### Snapshot Read + FileNotFoundError Guard
**Source:** `pipeline/run.py` lines 220-226
**Apply to:** `pipeline/run.py` (price-changes block) and `pipeline/price_changes.py` internal helpers
```python
prev_snapshot = {}
try:
    with open(sp_snapshot_path, 'r', encoding='utf-8') as f:
        prev_snapshot = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    pass
```

### `save()` Dual-Target (Blob / local)
**Source:** `pipeline/run.py` lines 229-230
**Apply to:** `pipeline/run.py` price-changes block
```python
save('set_piece_changes.json', sp_changes)
save('set_pieces_snapshot.json', curr_snapshot)
```
`save()` routes to Blob or local automatically based on `USE_BLOB` env var. Use two `save()` calls: one for the output artifact, one for the snapshot.

### `'use client'` Directive
**Source:** `src/components/insights/InsightsTab.tsx` line 1, `src/components/set-pieces/SetPieceTakerPanel.tsx` line 1
**Apply to:** `src/components/price-changes/PriceChangePanel.tsx`
All component files must start with `'use client'`. Hook files (`usePriceChanges.ts`) must NOT have `'use client'`.

### Loading / Error / Empty State Guards
**Source:** `src/components/insights/InsightsTab.tsx` lines 46-74; `src/components/set-pieces/SetPieceTakerPanel.tsx` lines 36-50
**Apply to:** `src/components/price-changes/PriceChangePanel.tsx`
Three guards before rendering data: `if (isLoading)` → spinner text, `if (error)` → red error text, `if (!data || data.predictions.length === 0)` → empty state section.

### TanStack Query Hook Shape
**Source:** `src/lib/hooks/useSetPieces.ts` lines 1-14
**Apply to:** `src/lib/hooks/usePriceChanges.ts`
Single string `queryKey`, typed generic `useQuery<T>`, `staleTime` in milliseconds. No manual refetch needed.

---

## No Analog Found

All files for Phase 54 have close analogs in the codebase. No files require fallback to RESEARCH.md patterns alone.

---

## Critical Implementation Notes

1. **`pipeline/cache/` is gitignored** (`.gitignore` lines 43-44: `pipeline/cache/`). Both seed files require `git add -f pipeline/cache/price_changes.json` and `git add -f pipeline/cache/price_changes_snapshot.json` to be tracked. Existing cache files (`set_piece_changes.json`, `set_pieces_snapshot.json`) confirm this is the established pattern.

2. **Progress bar must use inline style** — `style={{ width: `${prediction.confidence_pct}%` }}`. Never `w-[${pct}%]`. Tailwind JIT does not generate dynamic class names from interpolated strings.

3. **`selected_by_percent` divide-by-zero guard** in `price_changes.py`: `threshold = max(1.0, float(element.get('selected_by_percent', '0') or '0') * 10)`. Prevents crash on 0.0% ownership players.

4. **Confidence badge suppression** when `snapshot_days < 14` (D-06): show raw `confidence_pct` value but do not render HIGH/MEDIUM/LOW tier badge. The `snapshot_days` field is on the `PriceChanges` wrapper object, accessible as `data.snapshot_days`.

5. **`eta_days === 0` label**: render "Tonight" text instead of "0 days". Per CONTEXT.md §Specifics.

---

## Metadata

**Analog search scope:** `pipeline/`, `src/app/api/`, `src/lib/hooks/`, `src/lib/types.ts`, `src/components/insights/`, `src/components/set-pieces/`, `src/app/page.tsx`
**Files scanned:** 11 source files read directly
**Pattern extraction date:** 2026-05-02
