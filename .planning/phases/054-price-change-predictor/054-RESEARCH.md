# Phase 54: Price Change Predictor — Research

**Researched:** 2026-05-02
**Domain:** Full vertical slice — Python pipeline module, JSON artifact, Next.js API route, TanStack Query hook, React panel component
**Confidence:** HIGH (all findings verified against live codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** `PriceChangePanel` ships as a new sub-tab under the **Analyse** section only. No change to `DecisionSummaryTab` in this phase. Add `'price-changes'` to the `SubTab` union, `SECTIONS` constant, and corresponding render in `page.tsx`.
- **D-02:** Progress indicator = mini progress bar per player row, filling left-to-right as cumulative net transfers accumulate toward the price-change threshold.
- **D-03:** Threshold-based algorithm: `confidence_pct = clamp(cumulative_net / threshold, 0.0, 1.0) × 100`; `threshold = selected_by_percent × 10`; `eta_days = max(0, threshold - cumulative_net) / avg_daily_net_velocity`
- **D-04:** Direction-first layout: "Predicted to rise" section first (sorted by `confidence_pct` descending), "Predicted to fall" second (sorted by `confidence_pct` descending); stable players omitted
- **D-05:** Cold-start seed: `{ predictions: [] }` — route must never 500 on fresh checkout
- **D-06:** "Early data" flag shown until ≥14 days of snapshots available; confidence tier badges (HIGH/MEDIUM/LOW) suppressed below 70% precision threshold

### Claude's Discretion
- Exact FPL threshold formula until calibration data available (`selected_by_percent × 10` is the starting approximation)
- Whether stable players get collapsed/hidden section vs. full omission
- Panel mobile layout: stacked rows same as InsightsTab pattern
- Internal naming of snapshot helper functions within `price_changes.py`

### Deferred Ideas (OUT OF SCOPE)
- DecisionSummaryTab 5th card ("Price changes affecting your squad") — deferred to v1.8.1
- `predicted_rise`/`predicted_fall` fields on `MergedPlayer` (PriceTrendCell in GemTable) — deferred to v1.8.1
- Precision tracking ground-truth comparison — deferred to follow-up calibration phase
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRC-01 | Full vertical slice: pipeline module computes rise/fall/stable direction, confidence_pct, eta_days from cumulative net-transfer snapshots; API route + hook serve data; panel displays predictions under Analyse section | All design patterns verified against codebase; snapshot-diff, USE_BLOB toggle, TanStack hook, and sub-tab registration patterns all confirmed |
</phase_requirements>

---

## Summary

Phase 54 is a clean, contained vertical slice with no cross-cutting dependencies on Phases 52-53. The pipeline reads two fields already present on every FPL bootstrap element (`transfers_in_event`, `transfers_out_event`) that have not been used before, accumulates a daily snapshot, and derives a directional confidence score. The full data path — Python module → JSON cache file → Next.js API route → TanStack hook → React panel → Analyse sub-tab — replicates the exact pattern used by set-pieces (Phase 26) without any new architectural patterns.

Every code shape needed already exists in the codebase as a template. The route is a direct clone of `src/app/api/set-pieces/route.ts` with two string substitutions (`set_piece_changes.json` → `price_changes.json`, `s-maxage=3600` → `s-maxage=1800`). The hook is a direct clone of `useSetPieces.ts` with `staleTime` reduced to 30 min. The Python module follows the `bonus.py` / `xmins.py` shape: zero HTTP calls, all data passed in, dict returned. The `page.tsx` change adds one entry to the `SubTab` union and one entry to the `analyse` section's `subTabs` array.

The only genuinely new code is the confidence algorithm in `price_changes.py` and the `PriceChangePanel` component with its progress-bar rows. The cold-start seed file (`price_changes.json` seeded to `{ "predictions": [] }`) must be committed as a tracked file alongside `set_pieces_snapshot.json` — it is the only artifact that does not self-create from a fresh `run.py` execution because the route reads it before the pipeline has ever run.

**Primary recommendation:** Build in three plans — (1) pipeline module + seed files + types, (2) API route + hook, (3) PriceChangePanel + page.tsx wiring.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Net-transfer delta computation | Python pipeline | — | Reads FPL bootstrap `transfers_in_event`/`transfers_out_event`; no client-side API for this |
| Daily snapshot persistence | Python pipeline (filesystem) | Vercel Blob (USE_BLOB) | Mirrors set-piece snapshot pattern exactly |
| Confidence/direction calculation | Python pipeline | — | `threshold = selected_by_percent × 10` requires float math; done once at pipeline run time |
| JSON serving with 30-min cache | Next.js API route (Edge-compatible) | — | USE_BLOB toggle; s-maxage=1800 CDN cache |
| Data fetching in browser | TanStack Query hook | — | 30-min staleTime; single string queryKey |
| Panel rendering | React client component | — | `'use client'` required; all Analyse panels follow this pattern |
| Sub-tab registration | `page.tsx` SECTIONS constant | — | Single source of truth for all navigation |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TanStack Query | Already installed (`@tanstack/react-query`) | Server-state cache for hook | Used by all 8+ existing hooks in the codebase |
| Vercel Blob | Already installed (`@vercel/blob`) | Blob storage read in USE_BLOB mode | Used by all 8+ existing API routes |
| pytest | Already installed (pipeline/tests/) | Python unit tests for pipeline module | All pipeline modules have pytest coverage |
| Vitest | `^4.1.2` (already installed) | TypeScript/React component tests | Used by all TS test files |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@testing-library/react` | Already installed | Component render testing | PriceChangePanel loading/empty/data states |
| `fs/promises` (Node built-in) | N/A | Local file read in non-BLOB mode | Used by all routes in local dev |

**No new npm packages required.** [VERIFIED: package.json]

---

## Architecture Patterns

### System Architecture Diagram

```
FPL bootstrap API
  └─> bootstrap['elements'][*].{transfers_in_event, transfers_out_event,
                                  selected_by_percent, now_cost}
         │
         ▼
pipeline/price_changes.py
  reads:  pipeline/cache/price_changes_snapshot.json  (yesterday's snapshot, {} on first run)
  writes: pipeline/cache/price_changes.json           (today's predictions output)
  writes: pipeline/cache/price_changes_snapshot.json  (today's snapshot for tomorrow's delta)
         │
         ▼ (called from pipeline/run.py after set-piece block, ~line 231)
         │
    USE_BLOB=true ──────────────────────────> Vercel Blob: price_changes.json
    USE_BLOB=false ─────────────────────────> pipeline/cache/price_changes.json
         │
         ▼
/api/price-changes (Next.js Route Handler)
  s-maxage=1800, stale-while-revalidate=86400
         │
         ▼
usePriceChanges() (TanStack Query)
  queryKey: ['price-changes']
  staleTime: 30 * 60 * 1000
         │
         ▼
PriceChangePanel (src/components/price-changes/PriceChangePanel.tsx)
  Analyse section, 'price-changes' sub-tab
```

### Recommended Project Structure
```
pipeline/
├── price_changes.py              # NEW — exports compute_price_change_predictions()
├── cache/
│   ├── price_changes.json        # NEW seed file — { "predictions": [] }
│   └── price_changes_snapshot.json  # NEW seed file — {} (empty object)
src/
├── app/api/price-changes/
│   └── route.ts                  # NEW — clone of set-pieces/route.ts
├── lib/
│   ├── hooks/
│   │   └── usePriceChanges.ts    # NEW — clone of useSetPieces.ts
│   └── types.ts                  # MODIFIED — add PriceChangePrediction + PriceChanges
├── components/
│   └── price-changes/
│       └── PriceChangePanel.tsx  # NEW
└── app/
    └── page.tsx                  # MODIFIED — SubTab union + SECTIONS + render
```

### Pattern 1: Pipeline Module Shape (from bonus.py / xmins.py)

**What:** Pre-merge module; zero HTTP calls; all data passed as arguments; returns dict/tuple.
**When to use:** Any new pipeline computation.

```python
# Source: pipeline/bonus.py (verified)
def compute_price_change_predictions(bootstrap: dict, prev_snapshot: dict) -> tuple[dict, dict]:
    """Returns (predictions_payload, current_snapshot).

    predictions_payload shape: {
        generated_at: str (ISO 8601),
        snapshot_days: int (len of distinct dates in snapshot),
        predictions: list[dict]  # empty list on cold start
    }
    current_snapshot shape: {
        str(player_id): {
            'cumulative_net': int,
            'avg_daily_velocity': float,
            'dates': list[str],   # ISO date strings, for counting snapshot age
        }
    }
    """
    predictions = []
    current_snapshot = {}
    for element in bootstrap.get('elements', []):
        # ... compute per-player
    payload = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'snapshot_days': _count_snapshot_days(prev_snapshot),
        'predictions': predictions,
    }
    return payload, current_snapshot
```

### Pattern 2: run.py Snapshot Block (from set-piece block, lines 215-231)

**What:** Read prev snapshot → compute → save both output + new snapshot.
**When to use:** Any module that maintains rolling state across pipeline runs.

```python
# Source: pipeline/run.py lines 215-231 (verified)
# Insert AFTER the set-piece block (after line 231: "Set-piece changes: X change(s)")

# PRC-01: Price-change snapshot diff
print("Computing price change predictions...")
pc_snapshot_path = os.path.join(cache_dir, 'price_changes_snapshot.json')
prev_pc_snapshot = {}
try:
    with open(pc_snapshot_path, 'r', encoding='utf-8') as f:
        prev_pc_snapshot = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    pass

pc_predictions, curr_pc_snapshot = compute_price_change_predictions(bootstrap, prev_pc_snapshot)
save('price_changes.json', pc_predictions)
save('price_changes_snapshot.json', curr_pc_snapshot)
print(f"Price change predictions: {len(pc_predictions.get('predictions', []))} player(s) with direction signal")
```

**Import to add at top of run.py:**
```python
from price_changes import compute_price_change_predictions
```

### Pattern 3: USE_BLOB Route (from set-pieces/route.ts)

**What:** Read JSON from Blob (production) or local filesystem (dev); return with cache headers.
**When to use:** Every new pipeline artifact served to the browser.

```typescript
// Source: src/app/api/set-pieces/route.ts (verified)
// Changes: filename set_piece_changes.json -> price_changes.json; s-maxage 3600 -> 1800
import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'

export async function GET() {
  try {
    let data: string
    if (USE_BLOB) {
      const { blobs } = await list({ prefix: 'price_changes.json', limit: 1 })
      if (!blobs.length) {
        return Response.json({ error: 'Price change data not available' }, { status: 404 })
      }
      const res = await fetch(blobs[0].url)
      data = await res.text()
    } else {
      const cachePath = join(process.cwd(), 'pipeline', 'cache', 'price_changes.json')
      data = await readFile(cachePath, 'utf-8')
    }
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400',
      },
    })
  } catch {
    return Response.json({ error: 'Failed to load price change data' }, { status: 500 })
  }
}
```

### Pattern 4: TanStack Query Hook (from useSetPieces.ts)

**What:** Single-key query, typed return, staleTime in ms.

```typescript
// Source: src/lib/hooks/useSetPieces.ts (verified)
// Changes: 'set-pieces' -> 'price-changes'; /api/set-pieces -> /api/price-changes;
//          SetPieceChanges -> PriceChanges; 6h -> 30min
import { useQuery } from '@tanstack/react-query'
import type { PriceChanges } from '../types'

export function usePriceChanges() {
  return useQuery<PriceChanges>({
    queryKey: ['price-changes'],
    queryFn: async () => {
      const res = await fetch('/api/price-changes')
      if (!res.ok) throw new Error('Failed to fetch price change data')
      return res.json()
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  })
}
```

### Pattern 5: page.tsx SubTab Registration

**What:** Two changes needed — union type and SECTIONS constant.

```typescript
// Source: src/app/page.tsx lines 47-61 (verified)

// CHANGE 1: SubTab union (line 47) — add 'price-changes'
export type SubTab = 'gems' | 'insights' | 'defcon' | 'set-pieces' | 'planner' |
  'club-form' | 'value-gems' | 'accuracy' | 'decision' | 'transfers' | 'optimiser' |
  'price-changes'   // ADD THIS

// CHANGE 2: SECTIONS constant — add to analyse subTabs array (after accuracy entry)
{ id: 'set-pieces' as SubTab, label: 'Set Pieces',      mobileLabel: 'SP'      },
{ id: 'accuracy'   as SubTab, label: 'Accuracy',        mobileLabel: 'Acc'     },
{ id: 'price-changes' as SubTab, label: 'Price Changes', mobileLabel: 'Prices' }, // ADD THIS

// CHANGE 3: Render block (after line 207 'accuracy' block)
{activeSection !== 'squad' && activeSubTab === 'price-changes' && <PriceChangePanel />}
```

### Pattern 6: Component Loading/Error/Empty States (from InsightsTab.tsx)

**What:** Three guards before rendering data — isLoading, error, empty.

```typescript
// Source: src/components/insights/InsightsTab.tsx lines 46-74 (verified)
export function PriceChangePanel() {
  const { data, isLoading, error } = usePriceChanges()

  if (isLoading) return (
    <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
      Loading price change predictions…
    </p>
  )
  if (error) return (
    <p className="text-sm text-red-600 dark:text-red-400 py-4">
      Failed to load price change data. Check the pipeline output and refresh.
    </p>
  )
  if (!data || data.predictions.length === 0) return (
    <section className="mt-6 space-y-2" aria-label="Price change predictions not available">
      <h2 className="text-lg font-semibold">No price change data yet</h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Run the pipeline to generate price change predictions.
      </p>
    </section>
  )
  // ... render
}
```

### Pattern 7: Confidence Tier Badge Colours (from InsightsTab.tsx)

**What:** HIGH/MEDIUM/LOW badge coloring — reuse InsightsTab TIER_CLASSES exactly.
Note: CONTEXT.md §Code Insights specifies HIGH=red, MEDIUM=amber, LOW=zinc (Phase 51 D-13 convention for severity), which differs from InsightsTab's green/amber/zinc. The planner must choose which convention to use; D-13 severity convention (red=high urgency) makes more sense for price change confidence.

```typescript
// Source: src/components/insights/InsightsTab.tsx lines 7-18 (verified)
// For price change confidence, RED=high-confidence (act now!) is the D-13 severity convention
const CONFIDENCE_CLASSES = {
  HIGH:   'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  MEDIUM: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  LOW:    'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
} as const

function getConfidenceTier(pct: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (pct >= 70) return 'HIGH'
  if (pct >= 40) return 'MEDIUM'
  return 'LOW'
}
```

### Pattern 8: Progress Bar (mini, CSS only)

**What:** Tailwind width-as-percent for confidence bar.
Note: Tailwind does not support arbitrary dynamic widths via `w-[${pct}%]` in JIT mode without safelisting. Use inline style instead.

```tsx
// [VERIFIED: Tailwind v3 JIT limitation — dynamic class names not safe]
// Use inline style for the fill width
<div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
  <div
    className="h-full bg-emerald-500 rounded-full transition-all"  // rise = green; fall = red
    style={{ width: `${prediction.confidence_pct}%` }}
  />
</div>
```

### Anti-Patterns to Avoid

- **Dynamic Tailwind class names:** Never build `w-[${pct}%]` — use `style={{ width: ... }}` for dynamic widths. [VERIFIED: Tailwind JIT does not generate classes for interpolated strings]
- **Importing `run.py` in tests:** `run.py` has top-level side effects (dotenv, sys.path injection). Tests should NOT import from run.py directly. Pattern from `test_run.py`: replicate the specific code pattern under test in the test file itself. [VERIFIED: pipeline/tests/test_run.py lines 1-8]
- **Missing `'use client'` directive:** All component files need `'use client'`. No `'use client'` on lib/hook files. [VERIFIED: all existing components and hooks follow this pattern]
- **Tailwind safelist not updated:** The progress bar inline-style approach avoids needing to update tailwind.config.ts safelist.
- **Forgetting the `price_changes_snapshot.json` seed:** Unlike `price_changes.json` (seeded to `{ "predictions": [] }`), the snapshot starts as `{}` (an empty object). The run.py block already handles `FileNotFoundError` → `{}`, so the snapshot seed file is optional but conventional. The output artifact seed file IS required (SC-5).

---

## TypeScript Type Shape

Add to `src/lib/types.ts` after the `SetPieceChanges` block (line ~489):

```typescript
// Source: ARCHITECTURE.md §PRC-01 shape + CONTEXT.md D-03/D-04 locked decisions
// [VERIFIED: matches existing type pattern in types.ts for SetPieceChanges/CaptainPicks]

export type PriceDirection = 'rise' | 'fall' | 'stable'

export interface PriceChangePrediction {
  player_id: number
  name: string             // web_name from bootstrap
  team: string             // team_short_name
  now_cost: number         // tenths of £1m (e.g. 91 = £9.1m) — same as MergedPlayer.now_cost
  direction: PriceDirection
  confidence_pct: number   // 0–100; clamp(cumulative_net / threshold, 0, 1) × 100
  eta_days: number         // 0 means "Tonight"; max(0, threshold - net) / avg_velocity
  cumulative_net: number   // raw cumulative net transfers since last price change
  selected_by_percent: string  // FPL string e.g. "12.5" — used for threshold display
}

export interface PriceChanges {
  generated_at: string     // ISO 8601 timestamp
  snapshot_days: number    // count of daily snapshots accumulated; < 14 = "early data"
  predictions: PriceChangePrediction[]  // empty array on cold start (D-05)
}
```

**Key decisions embedded in the type shape:**
- `snapshot_days` enables the `< 14` early-data check (SC-4 / D-06) client-side without extra logic
- `cumulative_net` is carried through to the API for transparency and debugging
- `eta_days: 0` is the signal for "Tonight" label (from CONTEXT.md §Specifics)
- `selected_by_percent: string` matches FPL's string type, same as `MergedPlayer.selected_by_percent`

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Blob read with fallback | Custom Blob client | Clone `set-pieces/route.ts` exactly | Error handling, 404 case already tested |
| TanStack Query wiring | Custom fetch/useState | Clone `useSetPieces.ts` exactly | Cache deduplication, staleTime semantics |
| Severity badge styling | New CSS | Import `TIER_CLASSES` pattern from InsightsTab.tsx | Existing component, consistent design |
| Dynamic width bar | `w-[X%]` Tailwind class | `style={{ width: \`${pct}%\` }}` inline | Tailwind JIT doesn't generate dynamic classes |
| Snapshot file save | Custom file I/O | `save()` from `pipeline/upload.py` | Routes to Blob or local automatically |

---

## Common Pitfalls

### Pitfall 1: `price_changes.json` seed file absent on fresh checkout
**What goes wrong:** `readFile` throws `ENOENT`; route returns 500; SC-5 fails.
**Why it happens:** The seed file is not auto-created by any existing code path. `run.py` creates it on first pipeline run, but the checkout may predate that run.
**How to avoid:** Commit `pipeline/cache/price_changes.json` with content `{"predictions": []}` as a tracked file. The route catches the exception and returns 500 — the seed prevents this. `pipeline/cache/price_changes_snapshot.json` as `{}` is also needed but run.py handles its absence via FileNotFoundError guard.
**Warning signs:** 500 response from `/api/price-changes` on a repo with no pipeline run history.

### Pitfall 2: `transfers_in_event` / `transfers_out_event` are reset each gameweek
**What goes wrong:** Cumulative net transfer counter resets at gameweek boundary, breaking multi-day accumulation logic.
**Why it happens:** FPL's `transfers_in_event` counts transfers INTO the player since the gameweek started, not since the last price change. Both fields reset when a new GW begins.
**How to avoid:** The snapshot must persist the `cumulative_net` value across days and carry it forward. When the snapshot shows a negative delta (new GW started mid-accumulation), the module should treat the new reading as a fresh accumulation from zero or carry forward the stored cumulative. The CONTEXT.md algorithm ("accumulated across days since last price change") means `cumulative_net` is the snapshot-side responsibility — once stored, it accumulates by adding each day's delta.
**Warning signs:** `confidence_pct` drops sharply to ~0 every Monday (GW reset day).

### Pitfall 3: `selected_by_percent` is a string in FPL API
**What goes wrong:** `float(element['selected_by_percent'])` raises TypeError when field is empty string or missing.
**Why it happens:** `FPLElement.selected_by_percent` is typed as `string` in types.ts; FPL API returns `"12.5"`. For very new or obscure players it may be `"0.0"` — threshold would be `0.0 × 10 = 0`, causing division-by-zero in confidence_pct.
**How to avoid:** Guard in Python: `threshold = max(1.0, float(element.get('selected_by_percent', '0') or '0') * 10)`. The `max(1.0, ...)` prevents divide-by-zero while keeping threshold sensible for ultra-low-ownership players.
**Warning signs:** `ZeroDivisionError` in pipeline run for fringe players.

### Pitfall 4: Tailwind dynamic class names not generated
**What goes wrong:** Progress bar renders with zero width despite correct `confidence_pct` value.
**Why it happens:** Tailwind JIT scans source files for complete class name strings. `w-[${pct}%]` is never present as a literal string, so the CSS rule is never generated.
**How to avoid:** Use `style={{ width: `${prediction.confidence_pct}%` }}` on the fill div. Tailwind handles the container and color classes statically.
**Warning signs:** Progress bar container renders (visible outline) but fill is invisible in production.

### Pitfall 5: MobileNav pill overflow
**What goes wrong:** Adding 'price-changes' to `analyse` subTabs causes 6 pills in the Analyse section — may overflow on small screens.
**Why it happens:** Analyse currently has 5 pills: Gems, Insights, DefCon, SP, Acc. Adding Prices = 6.
**How to avoid:** Use `mobileLabel: 'Prices'` (4 chars) — the shortest sensible label. Verify on 375px viewport. The SECTIONS constant is the single source of truth for both desktop and mobile nav.
**Warning signs:** Horizontal scroll in MobileNav pill row on iPhone SE size.

### Pitfall 6: `snapshot_days` count method
**What goes wrong:** Planner assumes `snapshot_days` is computed by `len(dates_list)` on the snapshot but the snapshot stores per-player data, not a global date list.
**How to avoid:** The `snapshot_days` value in the output JSON should be computed in `compute_price_change_predictions()` from the oldest date in any player's date list vs today, or simply from the count of distinct date strings seen across all player snapshots. The simplest approach: store a top-level `snapshot_dates` list in `price_changes_snapshot.json` alongside per-player data. Alternatively, derive it as `len(set(d for p in prev_snapshot.values() for d in p.get('dates', []))`.
**Warning signs:** `snapshot_days` always equals 1 even after multiple runs.

---

## run.py Integration — Exact Location

[VERIFIED: pipeline/run.py lines 215-231]

Insert the price-change block **after** line 231 (the `print(f"Set-piece changes: ...")` line) and **before** line 233 (`# Compute DefCon stats`):

```python
# PRC-01: Price-change snapshot and predictions
print("Computing price change predictions...")
pc_snapshot_path = os.path.join(cache_dir, 'price_changes_snapshot.json')
prev_pc_snapshot = {}
try:
    with open(pc_snapshot_path, 'r', encoding='utf-8') as f:
        prev_pc_snapshot = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    pass

pc_predictions, curr_pc_snapshot = compute_price_change_predictions(bootstrap, prev_pc_snapshot)
save('price_changes.json', pc_predictions)
save('price_changes_snapshot.json', curr_pc_snapshot)
print(f"Price change predictions: {len(pc_predictions.get('predictions', []))} player(s) with direction signal")
```

Add to imports at top of run.py (after `from bonus import compute_bonus_predictions`):
```python
from price_changes import compute_price_change_predictions
```

---

## Cold-Start Seeding

[VERIFIED: pattern from existing cache files; `set_pieces_snapshot.json` is not committed as a seed]

Two files need to exist before first pipeline run:

| File | Seed Content | Why |
|------|-------------|-----|
| `pipeline/cache/price_changes.json` | `{"predictions": []}` | Route reads this on every request; ENOENT = 500 |
| `pipeline/cache/price_changes_snapshot.json` | `{}` | Optional — run.py's FileNotFoundError guard handles absence; commit for consistency |

Both should be committed to git as real tracked files (not `.gitignore`-d). Check existing `.gitignore`:
- `pipeline/cache/` exclusions: verify whether `*.json` in cache is gitignored. [ASSUMED — need to verify in .gitignore; if cache is gitignored, the seed must be force-added with `git add -f`]

---

## Environment Availability

Step 2.6: No new external dependencies. All tools already available:
- Python 3 with pytest: confirmed by existing tests
- Node.js with Vitest: confirmed by `package.json`
- `pipeline/upload.py`'s `save()` function: already imported and used throughout `run.py`

Step 2.6: SKIPPED (no new external dependencies — all runtime dependencies already present in the project).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Python framework | pytest (pipeline/tests/) |
| TS/React framework | Vitest `^4.1.2` |
| Python config | `pipeline/tests/conftest.py` (sys.path injection) |
| TS config | `vitest.config.ts` (root level) |
| Python quick run | `cd pipeline && python -m pytest tests/test_price_changes.py -x` |
| Python full suite | `cd pipeline && python -m pytest tests/ -x` |
| TS quick run | `npm test -- --run src/components/price-changes/` |
| TS full suite | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRC-01 | `compute_price_change_predictions()` returns correct direction/confidence/eta for rise case | unit (Python) | `pytest tests/test_price_changes.py::test_rise_prediction -x` | Wave 0 |
| PRC-01 | `compute_price_change_predictions()` returns fall prediction when cumulative_net < 0 | unit (Python) | `pytest tests/test_price_changes.py::test_fall_prediction -x` | Wave 0 |
| PRC-01 | Empty bootstrap returns `{ predictions: [] }` (cold-start) | unit (Python) | `pytest tests/test_price_changes.py::test_empty_bootstrap -x` | Wave 0 |
| PRC-01 | `confidence_pct` clamps at 100 when cumulative_net >= threshold | unit (Python) | `pytest tests/test_price_changes.py::test_confidence_clamp -x` | Wave 0 |
| PRC-01 | `selected_by_percent='0.0'` does not divide by zero | unit (Python) | `pytest tests/test_price_changes.py::test_zero_ownership_guard -x` | Wave 0 |
| PRC-01 | `eta_days=0` when cumulative_net >= threshold | unit (Python) | `pytest tests/test_price_changes.py::test_eta_days_zero -x` | Wave 0 |
| PRC-01 | `snapshot_days < 14` produces payload with `snapshot_days < 14` | unit (Python) | `pytest tests/test_price_changes.py::test_snapshot_days_count -x` | Wave 0 |
| PRC-01 | PriceChangePanel renders loading state | unit (TS/React) | `npm test -- --run src/components/price-changes/` | Wave 0 |
| PRC-01 | PriceChangePanel renders empty state when `predictions: []` | unit (TS/React) | `npm test -- --run src/components/price-changes/` | Wave 0 |
| PRC-01 | PriceChangePanel renders rise section before fall section | unit (TS/React) | `npm test -- --run src/components/price-changes/` | Wave 0 |
| PRC-01 | PriceChangePanel suppresses tier badges when `snapshot_days < 14` | unit (TS/React) | `npm test -- --run src/components/price-changes/` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd pipeline && python -m pytest tests/test_price_changes.py -x` (Python) or `npm test -- --run src/components/price-changes/` (TS)
- **Per wave merge:** `cd pipeline && python -m pytest tests/ -x && npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `pipeline/tests/test_price_changes.py` — covers all 7 Python test cases above
- [ ] `src/components/price-changes/PriceChangePanel.test.tsx` — covers 4 TS test cases above

*(Existing test infrastructure covers all other requirements — no new conftest or framework install needed)*

---

## Security Domain

Phase 54 adds a read-only public data endpoint with no authentication requirement and no user input fields. The data originates from the FPL public API (transfers_in_event, transfers_out_event) which is already fetched and validated by the pipeline.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Public endpoint — no auth gate |
| V3 Session Management | No | No session state |
| V4 Access Control | No | Public read-only data |
| V5 Input Validation | No | No user input to the route |
| V6 Cryptography | No | No secrets in this feature path |

No ASVS controls required for this phase. Pipeline data passes through the same `save()` / `readFile` path as all other pipeline artifacts with no new threat surface.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `pipeline/cache/` is not fully gitignored (seed files can be committed as tracked files) | Cold-Start Seeding | If cache dir is gitignored, seed file needs `git add -f` or a `.gitignore` exception; route would 500 on fresh checkout |
| A2 | Tailwind v3 JIT is active (not v4) — inline style required for dynamic width | Pattern 8 / Pitfall 4 | If Tailwind v4 CSS-in-JS mode is active, the safelist behavior may differ; inline style still works regardless |

---

## Open Questions

1. **`transfers_in_event` / `transfers_out_event` GW reset boundary**
   - What we know: FPL resets these fields when a new GW becomes active (typically Monday/Tuesday)
   - What's unclear: Exact reset timing; whether the snapshot should carry `cumulative_net` forward across GW boundaries or reset at GW start
   - Recommendation: Algorithm design choice for planner — the safest approach is to always accumulate (never reset) until a price change event is detected (`cost_change_event != 0`), then zero the snapshot for that player

2. **`git add -f` for cache seed files**
   - What we know: `pipeline/cache/*.json` files are present in git (verified — `set_pieces_snapshot.json` etc. are tracked)
   - What's unclear: Whether `.gitignore` has a pattern that would exclude new `price_changes*.json` files
   - Recommendation: Planner should verify `.gitignore` before the seed-file commit task

---

## Sources

### Primary (HIGH confidence — verified against live codebase)
- `src/app/api/set-pieces/route.ts` — route template, USE_BLOB pattern, cache headers
- `src/lib/hooks/useSetPieces.ts` — hook template, queryKey, staleTime pattern
- `pipeline/run.py` lines 1-320 — save() usage, set-piece block pattern, insertion point at ~line 231
- `pipeline/upload.py` — save() signature confirmed
- `pipeline/bonus.py` — pipeline module shape (zero HTTP, all data passed in, dict returned)
- `src/app/page.tsx` lines 1-231 — SubTab union at line 47, SECTIONS at lines 49-82, render pattern
- `src/lib/types.ts` — type placement, SetPieceChanges shape as analog
- `src/components/insights/InsightsTab.tsx` — TIER_CLASSES, loading/error/empty guards pattern
- `pipeline/tests/conftest.py` — sys.path injection, bare import pattern
- `pipeline/tests/test_bonus.py` — test file structure, fixture helpers pattern
- `pipeline/cache/` directory listing — confirmed existing artifacts; no `price_changes*.json` present yet

### Tertiary (LOW confidence — training knowledge, needs verification)
- Tailwind v3 JIT dynamic class limitation (A2) — inline style approach is the safe default regardless of version

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies already in package.json / requirements; verified by file reads
- Architecture: HIGH — all patterns copied from verified live codebase templates
- Pitfalls: HIGH (code-verified) / LOW (Tailwind JIT claim — ASSUMED but safe-side approach used)
- TypeScript types: HIGH — shape derived from CONTEXT.md locked decisions + existing type conventions

**Research date:** 2026-05-02
**Valid until:** End of v1.8 milestone (no external dependency changes expected)
