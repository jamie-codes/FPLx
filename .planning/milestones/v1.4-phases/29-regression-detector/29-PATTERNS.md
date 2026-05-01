# Phase 29: Regression Detector - Pattern Map

**Mapped:** 2026-04-28
**Files analyzed:** 7 (2 new, 5 modified)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/gem-table/RegressionSignalBadge.tsx` | component | request-response | `src/components/gem-table/VarianceBadge.tsx` | exact |
| `tests/lib/regression-signal.test.ts` | test | request-response | `tests/lib/xpts-engine.test.ts` + `tests/components/gem-table/XPtsCell.test.tsx` | exact |
| `pipeline/merge.py` | service | transform | `pipeline/merge.py` (self — Phase 28 xPts block) | exact |
| `src/lib/types.ts` | model | — | `src/lib/types.ts` (self — Phase 28 xPts optional fields) | exact |
| `src/components/gem-table/columns.tsx` | component | request-response | `src/components/gem-table/columns.tsx` (self — xPts_5gw column) | exact |
| `src/components/gem-table/GwToggle.tsx` | config | — | `src/components/gem-table/GwToggle.tsx` (self — MOBILE_HIDDEN_COLUMNS) | exact |
| `src/components/gem-table/GemTable.tsx` | component | — | `src/components/gem-table/GemTable.tsx` (self — HIDDEN_COLUMN_LABELS) | exact |

---

## Pattern Assignments

### `src/components/gem-table/RegressionSignalBadge.tsx` (component, request-response)

**Analog:** `src/components/gem-table/VarianceBadge.tsx` (primary), `src/components/shared/MinsRiskBadge.tsx` (secondary)

**Imports pattern** — no imports needed; self-contained JSX component (matches VarianceBadge.tsx which has zero imports).

**Core badge pattern** (`VarianceBadge.tsx` lines 5-25):
```tsx
export function VarianceBadge({ ceiling }: { ceiling: boolean | undefined }) {
  if (ceiling === undefined || ceiling === null) return null
  if (ceiling) {
    return (
      <span
        className="ml-1 inline-block text-xs font-normal rounded px-2 py-1 bg-violet-100 dark:bg-violet-900 text-violet-800 dark:text-violet-200"
        title="High ceiling: ..."
      >
        ⬆
      </span>
    )
  }
  return (
    <span
      className="ml-1 inline-block text-xs font-normal rounded px-2 py-1 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
      title="Consistent: ..."
    >
      =
    </span>
  )
}
```

**Multi-variant config-driven pattern** (`MinsRiskBadge.tsx` lines 1-53) — for BUY/SELL two-variant pattern, MinsRiskBadge shows how to handle multiple named variants cleanly using a `BADGE_MAP`:
```tsx
const BADGE_MAP: Record<Exclude<MinsRisk, 'injured'>, Config> = {
  nailed: {
    bg: 'bg-green-100 dark:bg-green-900',
    text: 'text-green-800 dark:text-green-200',
    label: 'Nailed',
    title: 'Nailed: high start probability (≥85%)',
  },
  rotation_risk: {
    bg: 'bg-amber-100 dark:bg-amber-900',
    text: 'text-amber-800 dark:text-amber-200',
    label: 'Rotation risk',
    title: 'Rotation risk: rotation risk identified',
  },
  // ...
}
```

**Null/dash fallback pattern** (established project convention — VarianceBadge returns `null`; RegressionSignalBadge must render `—` em-dash instead since the column cell should never be blank):
```tsx
// When signal is null/undefined, render an em-dash (not null/empty)
if (!signal) return <span className="text-zinc-400">—</span>
```

**Tailwind class envelope** (copy exactly from VarianceBadge — project standard):
```
inline-block text-xs font-normal rounded px-2 py-1
bg-{color}-100 dark:bg-{color}-900 text-{color}-800 dark:text-{color}-200
```
- BUY: color = `green`
- SELL: color = `amber`

**Tooltip pattern** — native HTML `title` attribute. No Radix. No custom Tooltip primitive. Copy exactly from VarianceBadge:
```tsx
title="Underperforming xG+xA over last 5 GW (delta {deltaStr} per match). Actual G+A below expected — may regress upward. Consider buying."
```

---

### `tests/lib/regression-signal.test.ts` (test, request-response)

**Analog:** `tests/lib/xpts-engine.test.ts` (structure, skip pattern, integration tests) + `tests/components/gem-table/XPtsCell.test.tsx` (component render tests with jsdom)

**Test file header/environment** (`XPtsCell.test.tsx` lines 1-7):
```typescript
// @vitest-environment jsdom   <-- only needed for component render tests

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VarianceBadge } from '@/components/gem-table/VarianceBadge'
```

**Pure unit test structure** (`xpts-engine.test.ts` lines 1-4, 130-133):
```typescript
import { describe, it, expect } from 'vitest'
// No jsdom annotation for pure math tests

describe('Phase 28: xPts engine pipeline output', () => {
  // ...
  it('xpts-engine test placeholder passes (pipeline cache not present in this environment)', () => {
    expect(true).toBe(true)
  })
})
```

**Integration test skip pattern** (`xpts-engine.test.ts` lines 6-19):
```typescript
it.skip('contains xPts_1gw ... (requires pipeline run)', async () => {
  const raw = await readFile(join(process.cwd(), 'pipeline', 'cache', 'merged_players.json'), 'utf-8')
  const players = JSON.parse(raw) as Record<string, unknown>[]
  expect(players.length).toBeGreaterThan(0)
  for (const p of players) {
    expect(p).toHaveProperty('xPts_1gw')
    // ...
  }
})
```

**Component render assertion pattern** (`XPtsCell.test.tsx` lines 8-47):
```typescript
describe('VarianceBadge', () => {
  it('renders ⬆ in violet envelope when ceiling=true', () => {
    const { container } = render(<VarianceBadge ceiling={true} />)
    const span = container.querySelector('span')
    expect(span).not.toBeNull()
    expect(span!.textContent).toBe('⬆')
    const cls = span!.className
    expect(cls).toContain('bg-violet-100')
    expect(cls).toContain('text-xs')
    expect(span!.getAttribute('title')).toMatch(/^High ceiling/)
  })
  it('renders nothing when ceiling=undefined', () => {
    const { container } = render(<VarianceBadge ceiling={undefined} />)
    expect(container.firstChild).toBeNull()
  })
})
```

**vitest.config.ts** — global `environment: 'jsdom'` (line 7), alias `@` → `./src` (line 16). No per-file config needed; `// @vitest-environment jsdom` annotation is used for documentation clarity only (already global).

---

### `pipeline/merge.py` — add `_compute_regression_signal()` and attach fields (service, transform)

**Analog:** `pipeline/merge.py` itself — Phase 28 xPts helper function block and field attachment.

**Helper function placement pattern** — all `_compute_*` helpers are defined at module top level, before `merge_players()`. Current last helper is `_compute_xpts_sigma` ending around line 330. New `_compute_regression_signal` slots in immediately before `def merge_players(` at line 331.

**Existing helper pattern** (`merge.py` lines 25-33):
```python
def _compute_difficulty_score(team_xga: float, min_xga: float, max_xga: float) -> float:
    """Normalise team xGA to 0.0–1.0 difficulty score.

    0.0 = easiest fixture (opponent concedes most goals — highest xGA).
    1.0 = hardest fixture (opponent concedes fewest goals — lowest xGA).
    """
    if max_xga == min_xga:
        return 0.5
    return 1.0 - (team_xga - min_xga) / (max_xga - min_xga)
```

**`_safe_float` utility** (`merge.py` lines 7-11) — use this for all float casts from FPL string fields:
```python
def _safe_float(val, default: float = 0.0) -> float:
    try:
        return float(val)
    except (TypeError, ValueError):
        return default
```

**summaries dict access pattern** (`merge.py` lines 572-580 — existing VG-01 block):
```python
if summaries and fpl_id in summaries:
    history = summaries[fpl_id].get('history', [])
    if history:
        total_gws_available = len(history)
        last3 = history[-3:] if len(history) >= 3 else history
        pts_last3gw = sum(m.get('total_points', 0) for m in last3)
```

**Field attachment pattern** (`merge.py` lines 670-686 — xPts block):
```python
# ---- xPts engine (Phase 28 DATA-02, XPTS-02, D-01..D-09) ----
xpts_1gw, xpts_components_1gw = _xpts_ngw(...)
player['xPts_1gw'] = xpts_1gw
player['xPts_3gw'] = xpts_3gw
player['xPts_5gw'] = xpts_5gw
player['xPts_components_1gw'] = xpts_components_1gw  # may be None for BGW
```

**Graceful omission pattern** (per D-03 — fields simply absent when signal cannot be computed; matches how D-03 describes the fallback). Contrast with xPts block which always writes the field. For regression signal: only write the field when there is a signal or a delta to report. If `reg_signal` and `reg_delta` are both None, omit the keys from the player dict entirely:
```python
# ---- Regression signal (Phase 29 DATA-03, REG-01, REG-02) ----
if summaries and fpl_id in summaries:
    reg_signal, reg_delta = _compute_regression_signal(
        summaries[fpl_id].get('history', [])
    )
    if reg_signal is not None or reg_delta is not None:
        player['regression_signal'] = reg_signal
        player['actual_vs_xg_delta'] = reg_delta
# Fields are simply absent when signal cannot be computed (D-03 graceful fallback).
```

**Insertion point in merge loop:** After `player['xPts_components_1gw'] = ...` (line 686) and before `result.append(player)` (line 702). The regression signal block belongs with the per-player field assignments, not in the post-loop ceiling classification.

---

### `src/lib/types.ts` — extend `MergedPlayer` (model)

**Analog:** `src/lib/types.ts` itself — Phase 28 xPts optional field block (lines 141-154).

**Optional field rollout convention** (`types.ts` lines 141-153):
```typescript
// xPts engine (Phase 28 DATA-02, XPTS-01, XPTS-02 — D-01..D-09).
// Optional during pipeline rollout — same convention as Phase 27 attacking_difficulty.
xPts_1gw?: number           // expected pts next 1 GW (Poisson goals/assists, Bernoulli CS, flat bonus)
xPts_3gw?: number           // expected pts next 3 GWs (DGW-aware sum)
xPts_5gw?: number           // expected pts next 5 GWs (DGW-aware sum)
xPts_ceiling_1gw?: boolean  // true = top-tercile sigma in 1 GW window (high-ceiling)
xPts_ceiling_3gw?: boolean  // true = top-tercile sigma in 3 GW window
xPts_ceiling_5gw?: boolean  // true = top-tercile sigma in 5 GW window
xPts_components_1gw?: {     // breakdown for 1 GW only (tooltip data); null for BGW
  goal_pts: number
  assist_pts: number
  cs_pts: number
  bonus_pts: number
} | null
```

**New fields to add** — insert after `xPts_components_1gw` block (line 153), before the closing `}` of `MergedPlayer`:
```typescript
// Regression signal (Phase 29 DATA-03, REG-01, REG-02).
// Optional — absent when signal cannot be computed (player has <900 min in 5-GW window,
// no history, or pipeline fetch failed per D-03 graceful fallback).
regression_signal?: 'buy' | 'sell' | null
actual_vs_xg_delta?: number | null
```

---

### `src/components/gem-table/columns.tsx` — add Signal column (component, request-response)

**Analog:** `src/components/gem-table/columns.tsx` itself — `xPts_5gw` column definition (lines 147-158), which is the column immediately before the new Signal column's insertion point.

**Import to add** at the top of the imports block (lines 1-6):
```typescript
import { RegressionSignalBadge } from '@/components/gem-table/RegressionSignalBadge'
```

**Sortable accessor column pattern with badge cell renderer** (`columns.tsx` lines 123-134 — xPts_1gw as the simplest badge+accessor example):
```typescript
col.accessor('xPts_1gw', {
  header: H('xPts', 'Expected FPL points next gameweek ...'),
  cell: (info) => (
    <XPtsCell
      value={info.getValue()}
      ceiling={info.row.original.xPts_ceiling_1gw}
      components={info.row.original.xPts_components_1gw ?? undefined}
      window={1}
    />
  ),
  enableSorting: true,
}),
```

**Header helper `H()`** (`columns.tsx` line 18):
```typescript
const H = (label: string, tip: string) => () => <span title={tip} className="cursor-help">{label}</span>
```

**Column insertion point:** After the `xPts_5gw` block (ends at line 158) and before the `col.display({ id: 'trend', ... })` block (starts at line 159). The Signal column uses `col.accessor` (not `col.display`) because it reads a real field from the row data and needs to participate in sorting.

**Custom sortingFn pattern** — no direct existing analog for custom sortingFn in columns.tsx, but the pattern is well-specified in RESEARCH.md:
```typescript
sortingFn: (rowA, rowB) => {
  const order: Record<string, number> = { sell: 2, buy: 0 }
  const a = order[rowA.original.regression_signal ?? ''] ?? 1
  const b = order[rowB.original.regression_signal ?? ''] ?? 1
  return a - b
},
```

---

### `src/components/gem-table/GwToggle.tsx` — add `signal` to MOBILE_HIDDEN_COLUMNS (config)

**Analog:** `src/components/gem-table/GwToggle.tsx` itself — `MOBILE_HIDDEN_COLUMNS` map (lines 3-19).

**Full current map** (`GwToggle.tsx` lines 3-19):
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
}
```

**Addition:** Append `signal: false` as the last entry before the closing `}`. Convention: `false` means hidden on mobile portrait. Every column hidden on portrait mobile has `false` here — never `true`.

---

### `src/components/gem-table/GemTable.tsx` — add `signal` to HIDDEN_COLUMN_LABELS (component)

**Analog:** `src/components/gem-table/GemTable.tsx` itself — `HIDDEN_COLUMN_LABELS` map (lines 24-40).

**Full current map** (`GemTable.tsx` lines 24-40):
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
}
```

**Addition:** Append `signal: 'Signal'` as the last entry before the closing `}`. The string value is the human-readable label shown in the tap-to-expand detail panel on mobile (lines 181-196 of GemTable.tsx use this map to render the `<dl>` detail rows).

---

## Shared Patterns

### Null/absent field rendering (em-dash)
**Source:** `src/components/gem-table/columns.tsx` lines 14-15
**Apply to:** `RegressionSignalBadge.tsx`, Signal column cell
```typescript
const fmtDec2 = (v: number | null) => (v === null ? '—' : v.toFixed(2))
```
When a field is absent/null, render `—` (em-dash `—`), not 0 or empty string. RegressionSignalBadge renders `<span className="text-zinc-400">—</span>` when signal is null/undefined.

### Native title tooltip (no Radix)
**Source:** `src/components/gem-table/VarianceBadge.tsx` lines 9-11 and `src/components/shared/MinsRiskBadge.tsx` line 47
**Apply to:** `RegressionSignalBadge.tsx`, Signal column header
```tsx
<span title="...explanation text..." className="...">label</span>
```
Project pattern is always native HTML `title` attribute. No Radix Tooltip, no custom Tooltip primitive.

### Optional field convention in TypeScript (`?:`)
**Source:** `src/lib/types.ts` lines 141-154
**Apply to:** `src/lib/types.ts` new fields
```typescript
xPts_1gw?: number           // expected pts next 1 GW
xPts_ceiling_1gw?: boolean
xPts_components_1gw?: { ... } | null
```
New pipeline fields are `?:` (optional) until stable. Use `?: 'buy' | 'sell' | null` and `?: number | null` for the new fields, matching the `xPts_components_1gw?: ... | null` pattern.

### `_safe_float` for FPL string-to-float casts
**Source:** `pipeline/merge.py` lines 7-11
**Apply to:** `_compute_regression_signal()` function in `merge.py`
```python
def _safe_float(val, default: float = 0.0) -> float:
    try:
        return float(val)
    except (TypeError, ValueError):
        return default
```
FPL returns `expected_goals` and `expected_assists` as strings. Always cast via `_safe_float()` or the equivalent `float(h.get('expected_goals', 0) or 0)` guard. The `or 0` handles both `None` and empty string `''`.

### Graceful field omission (no hard-fail, no null-fill)
**Source:** `pipeline/merge.py` lines 572-580 (summaries guard) and CONTEXT.md D-03
**Apply to:** Regression signal block in `merge_players()`
```python
if summaries and fpl_id in summaries:
    # compute and conditionally attach fields
    if reg_signal is not None or reg_delta is not None:
        player['regression_signal'] = reg_signal
        player['actual_vs_xg_delta'] = reg_delta
# If block not entered, keys are simply absent from player dict
```
Fields are absent (not null) in the JSON when signal cannot be computed. The UI renders `—` for absent optional fields.

### Column visibility — two-map update rule
**Source:** `src/components/gem-table/GwToggle.tsx` lines 3-19 + `src/components/gem-table/GemTable.tsx` lines 24-40
**Apply to:** Both files whenever adding a mobile-hidden column
Rule: Every mobile-hidden column must appear in BOTH `MOBILE_HIDDEN_COLUMNS` (GwToggle.tsx) AND `HIDDEN_COLUMN_LABELS` (GemTable.tsx). Missing either map causes either the column to be visible in portrait mode or absent from the tap-to-expand detail panel.

---

## No Analog Found

All files for Phase 29 have close analogs in the existing codebase. No file requires fallback to RESEARCH.md patterns only.

---

## Metadata

**Analog search scope:** `src/components/gem-table/`, `src/components/shared/`, `src/lib/`, `pipeline/`, `tests/lib/`, `tests/components/`
**Files scanned:** 9 source files + vitest.config.ts
**Pattern extraction date:** 2026-04-28
