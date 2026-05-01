# Phase 30: Differential Tracker - Pattern Map

**Mapped:** 2026-04-28
**Files analyzed:** 6
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `pipeline/merge.py` | utility (helper + pipeline) | transform / batch | `pipeline/merge.py` `_compute_regression_signal()` (lines 331–383) | exact |
| `src/lib/types.ts` | model (interface) | — | `src/lib/types.ts` lines 154–160 (`regression_signal` / `actual_vs_xg_delta`) | exact |
| `src/components/gem-table/DifferentialBadge.tsx` | component | request-response | `src/components/gem-table/RegressionSignalBadge.tsx` | exact |
| `src/components/gem-table/columns.tsx` | config (column defs) | request-response | `src/components/gem-table/columns.tsx` lines 160–175 (Signal column) | exact |
| `src/components/gem-table/GwToggle.tsx` | config (visibility map) | — | `src/components/gem-table/GwToggle.tsx` lines 3–20 (`MOBILE_HIDDEN_COLUMNS`) | exact |
| `src/components/gem-table/GemTable.tsx` | config (visibility map) | — | `src/components/gem-table/GemTable.tsx` lines 24–41 (`HIDDEN_COLUMN_LABELS`) | exact |

---

## Pattern Assignments

### `pipeline/merge.py` — add `_compute_differential_flag()` and attach output in `merge_players()`

**Analog:** `pipeline/merge.py` — `_compute_regression_signal()` and its call-site

**Helper placement pattern** (lines 331–384) — place `_compute_differential_flag()` immediately before `merge_players()` in the same file, following the same function-before-consumer convention:

```python
def _compute_regression_signal(
    history: list,
    window_gws: int = 5,
    min_minutes: int = 900,
    threshold: float = 0.5,
) -> tuple:
    """..."""
    if not history:
        return None, None
    # ... computation ...
    return 'buy', delta   # or 'sell', delta  or  None, delta
```

**New helper to write — `_compute_differential_flag()`:**

```python
def _compute_differential_flag(
    xpts_1gw: float,
    selected_by_percent: str,
    status: str,
    position_median: float,
) -> str | None:
    """Classify player as 'diff', 'trap', or None.

    D-03: DIFF gate: xpts_1gw > position_median AND ownership < 5% AND status == 'a'.
    D-04: TRAP gate: xpts_1gw < position_median AND ownership > 15%.
           Status exclusion does NOT apply to TRAP.
    D-12: Injury/suspension excludes from DIFF only.
    """
    ownership = float(selected_by_percent)
    above_median = xpts_1gw > position_median

    if above_median and ownership < 5.0 and status == 'a':
        return 'diff'
    if not above_median and ownership > 15.0:
        return 'trap'
    return None
```

**Position-median computation pattern** (after the xPts ceiling block, lines 773–796) — compute medians across the full `result` list before the per-player flag loop, mirroring the ceiling tercile pattern:

```python
# ---- Differential flag (Phase 30 TMPL-01, TMPL-02) ----
# Position-relative median (D-01): compute per element_type across all players.
from statistics import median
pos_xpts: dict[int, list[float]] = {1: [], 2: [], 3: [], 4: []}
for p in result:
    pos_xpts[p['element_type']].append(p.get('xPts_1gw') or 0.0)
pos_median: dict[int, float] = {
    et: median(vals) if vals else 0.0
    for et, vals in pos_xpts.items()
}
for p in result:
    flag = _compute_differential_flag(
        p.get('xPts_1gw') or 0.0,
        p.get('selected_by_percent', '0'),
        p.get('status', ''),
        pos_median[p['element_type']],
    )
    if flag is not None:
        p['differential_flag'] = flag
```

**Call-site attachment pattern** (regression signal call-site, lines 747–755) — conditionally write to player dict only when the flag fires; omit field entirely when None:

```python
if summaries and fpl_id in summaries:
    reg_signal, reg_delta = _compute_regression_signal(
        summaries[fpl_id].get('history', [])
    )
    if reg_signal is not None:
        player['regression_signal'] = reg_signal
        player['actual_vs_xg_delta'] = reg_delta
```

---

### `src/lib/types.ts` — add `differential_flag?` to `MergedPlayer`

**Analog:** `src/lib/types.ts` lines 154–160

**Existing neighbors to append after** (lines 154–160):

```typescript
  // Regression signal (Phase 29 DATA-03, REG-01, REG-02).
  // Optional — absent when signal cannot be computed (player has <900 min in 5-GW window,
  // no history, or pipeline fetch failed per D-03 graceful fallback).
  regression_signal?: 'buy' | 'sell' | null
  actual_vs_xg_delta?: number | null
```

**New field to append immediately after `actual_vs_xg_delta`:**

```typescript
  // Differential flag (Phase 30 TMPL-01, TMPL-02).
  // Optional — absent when neither DIFF nor TRAP condition met.
  // 'diff': low-owned (< 5%), above-median xPts, available player.
  // 'trap': high-owned (> 15%), below-median xPts (status-agnostic).
  differential_flag?: 'diff' | 'trap' | null
```

---

### `src/components/gem-table/DifferentialBadge.tsx` — NEW file

**Analog:** `src/components/gem-table/RegressionSignalBadge.tsx` (full file, 38 lines)

**Full analog to replicate** (copy structure exactly, adapt colors/text/props):

```tsx
'use client'

// Phase 29 REG-01, REG-02 — regression signal badge component.
// Visual envelope matches VarianceBadge.tsx and MinsRiskBadge.tsx (text-xs font-normal rounded px-2 py-1).
// BUY = green pill, SELL = amber pill, null/undefined = em-dash.
// Tooltip: native HTML title attribute (no Radix — project pattern from VarianceBadge.tsx).

export function RegressionSignalBadge({
  signal,
  delta,
}: {
  signal: 'buy' | 'sell' | null | undefined
  delta: number | null | undefined
}) {
  if (!signal) return <span className="text-zinc-400">—</span>

  const deltaStr = delta != null ? (delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)) : ''

  if (signal === 'buy') {
    return (
      <span
        className="inline-block text-xs font-normal rounded px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
        title={`Underperforming xG+xA over last 5 GW (delta ${deltaStr} per match). Actual G+A below expected — may regress upward. Consider buying.`}
      >
        BUY
      </span>
    )
  }

  return (
    <span
      className="inline-block text-xs font-normal rounded px-2 py-1 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200"
      title={`Overperforming xG+xA over last 5 GW (delta ${deltaStr} per match). Actual G+A above expected — may regress downward. Consider selling.`}
    >
      SELL
    </span>
  )
}
```

**New `DifferentialBadge.tsx` — adapted version:**

```tsx
'use client'

// Phase 30 TMPL-01, TMPL-02 — differential flag badge component.
// Visual envelope: text-xs font-normal rounded px-2 py-1 (matches RegressionSignalBadge, VarianceBadge).
// DIFF = green pill, TRAP = amber pill, null/undefined = em-dash.
// Tooltip: native HTML title attribute (no Radix — project pattern from VarianceBadge.tsx).

export function DifferentialBadge({
  flag,
  ownership,
}: {
  flag: 'diff' | 'trap' | null | undefined
  ownership: number | null | undefined
}) {
  if (!flag) return <span className="text-zinc-400">—</span>

  const pct = ownership != null ? ownership.toFixed(1) : '?'

  if (flag === 'diff') {
    return (
      <span
        className="inline-block text-xs font-normal rounded px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
        title={`Differential: ${pct}% owned, above-average xPts for position. Low ownership = rank gain potential.`}
      >
        DIFF
      </span>
    )
  }

  return (
    <span
      className="inline-block text-xs font-normal rounded px-2 py-1 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200"
      title={`Template trap: ${pct}% owned, below-average xPts for position. High ownership with weak projections.`}
    >
      TRAP
    </span>
  )
}
```

---

### `src/components/gem-table/columns.tsx` — add Diff column accessor

**Analog:** Signal column definition, lines 160–175

**Imports pattern** (lines 1–7) — add `DifferentialBadge` import after `RegressionSignalBadge`:

```typescript
import { createColumnHelper } from '@tanstack/react-table'
import type { ScoredPlayer } from '@/lib/types'
import { FixtureBadges } from '@/components/fixtures/FixtureBadges'
import { MinsRiskBadge } from '@/components/shared/MinsRiskBadge'
import { VarianceBadge } from '@/components/gem-table/VarianceBadge'
import { RegressionSignalBadge } from '@/components/gem-table/RegressionSignalBadge'
import { DifferentialBadge } from '@/components/gem-table/DifferentialBadge'   // ADD
```

**Signal column — exact template to replicate** (lines 160–175):

```typescript
col.accessor('regression_signal', {
  header: H('Signal', 'Regression signal: BUY = underperforming xG+xA over last 5 GW; SELL = overperforming. Min 900 min played. Sort ascending for buy candidates.'),
  cell: (info) => (
    <RegressionSignalBadge
      signal={info.getValue()}
      delta={info.row.original.actual_vs_xg_delta}
    />
  ),
  enableSorting: true,
  sortingFn: (rowA, rowB) => {
    const order: Record<string, number> = { sell: 2, buy: 0 }
    const a = order[rowA.original.regression_signal ?? ''] ?? 1
    const b = order[rowB.original.regression_signal ?? ''] ?? 1
    return a - b
  },
}),
```

**New Diff column — insert immediately after Signal column (before Trend at line 176):**

```typescript
col.accessor('differential_flag', {
  header: H('Diff', 'Differential flag: DIFF = low-owned (<5%), above-average xPts for position — rank gain potential. TRAP = high-owned (>15%), below-average xPts — consider selling. Sort ascending for differentials first.'),
  cell: (info) => (
    <DifferentialBadge
      flag={info.getValue()}
      ownership={parseFloat(info.row.original.selected_by_percent ?? '0')}
    />
  ),
  enableSorting: true,
  sortingFn: (rowA, rowB) => {
    const order: Record<string, number> = { diff: 0, trap: 2 }
    const a = order[rowA.original.differential_flag ?? ''] ?? 1
    const b = order[rowB.original.differential_flag ?? ''] ?? 1
    return a - b
  },
}),
```

---

### `src/components/gem-table/GwToggle.tsx` — add `differential_flag: false` to `MOBILE_HIDDEN_COLUMNS`

**Analog:** `MOBILE_HIDDEN_COLUMNS` map, lines 3–20

**Existing map** (lines 3–20) — add `differential_flag: false` after `signal: false`:

```typescript
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
  signal: false,
  differential_flag: false,   // ADD — hidden on portrait mobile (D-09)
}
```

---

### `src/components/gem-table/GemTable.tsx` — add `differential_flag: 'Diff'` to `HIDDEN_COLUMN_LABELS`

**Analog:** `HIDDEN_COLUMN_LABELS` map, lines 24–41

**Existing map** (lines 24–41) — add `differential_flag: 'Diff'` after `signal: 'Signal'`:

```typescript
const HIDDEN_COLUMN_LABELS: Record<string, string> = {
  team_short_name: 'Team',
  now_cost: 'Price',
  fdr_score: 'FDR',
  form_score: 'Form',
  xg_per90: 'xG/90',
  xa_per90: 'xA/90',
  xg_score: 'xG Score',
  xa_score: 'xA Score',
  ownership_score: 'Own Score',
  minutes_score: 'Minutes',
  set_piece_score: 'Set Piece',
  selected_by_percent: 'Owned %',
  status: 'Status',
  trend: 'Price Trend',
  fixtures: 'Next 5',
  signal: 'Signal',
  differential_flag: 'Diff',   // ADD — label shown in mobile row expansion
}
```

---

## Shared Patterns

### Null guard / em-dash
**Source:** `src/components/gem-table/RegressionSignalBadge.tsx` line 15
**Apply to:** `DifferentialBadge.tsx`
```tsx
if (!flag) return <span className="text-zinc-400">—</span>
```

### Badge visual envelope
**Source:** `src/components/gem-table/RegressionSignalBadge.tsx` lines 22, 31
**Apply to:** `DifferentialBadge.tsx` — both pill variants use identical className:
```tsx
className="inline-block text-xs font-normal rounded px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
// amber variant:
className="inline-block text-xs font-normal rounded px-2 py-1 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200"
```

### Tooltip: native HTML `title`
**Source:** `src/components/gem-table/RegressionSignalBadge.tsx` lines 23, 32
**Apply to:** `DifferentialBadge.tsx` — no Radix, no shadcn tooltip. Plain `title` attribute only.

### sortingFn order map with `?? 1` null sentinel
**Source:** `src/components/gem-table/columns.tsx` lines 169–174
**Apply to:** `differential_flag` column in `columns.tsx`:
```typescript
const order: Record<string, number> = { diff: 0, trap: 2 }
const a = order[rowA.original.differential_flag ?? ''] ?? 1
const b = order[rowB.original.differential_flag ?? ''] ?? 1
return a - b
```

### Helper-before-consumer placement in merge.py
**Source:** `pipeline/merge.py` lines 331–384 (`_compute_regression_signal` sits before `merge_players`)
**Apply to:** `_compute_differential_flag()` — must be defined before `merge_players()` in the file.

### Post-loop cross-player computation (ceiling pattern)
**Source:** `pipeline/merge.py` lines 773–796
**Apply to:** Position median + differential flag loop — runs after the per-player loop appends to `result`, before `return result`.

### Conditional dict write (omit field when None)
**Source:** `pipeline/merge.py` lines 753–755
**Apply to:** `differential_flag` attachment:
```python
if flag is not None:
    p['differential_flag'] = flag
```

---

## No Analog Found

None — all six files have exact analogs in the codebase.

---

## Metadata

**Analog search scope:** `pipeline/`, `src/components/gem-table/`, `src/lib/`
**Files scanned:** 6 (merge.py, types.ts, RegressionSignalBadge.tsx, columns.tsx, GwToggle.tsx, GemTable.tsx)
**Pattern extraction date:** 2026-04-28
