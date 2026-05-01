# Phase 28: xPts Engine - Pattern Map

**Mapped:** 2026-04-28
**Files analyzed:** 7 new/modified files
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `pipeline/merge.py` | service | transform | `pipeline/merge.py` itself — `_proj_pts_ngw()` (lines 104–133) | exact (extension of existing function) |
| `src/lib/types.ts` | model | — | `src/lib/types.ts` itself — `FixtureEntry` Phase 27 additions (lines 76–84) + `MergedPlayer` (lines 90–140) | exact (optional-field extension pattern) |
| `src/components/gem-table/columns.tsx` | component | request-response | `src/components/gem-table/columns.tsx` itself — `proj_pts_*` columns (lines 86–100), `MinsRiskBadge` cell (lines 80–85) | exact (column accessor + cell renderer replacement) |
| `src/components/gem-table/GwToggle.tsx` | component | request-response | `src/components/gem-table/GwToggle.tsx` itself — `getColumnVisibility()` (lines 21–33) | exact (one-line key map update) |
| `src/components/gem-table/VarianceBadge.tsx` | component | request-response | `src/components/shared/MinsRiskBadge.tsx` (all 53 lines) | exact (same badge shape, same Tailwind envelope) |
| `tests/lib/xpts-engine.test.ts` | test | — | `tests/lib/gem-score.test.ts` (logic unit tests) + `tests/lib/merge.test.ts` (skip pattern for cache-dependent) | exact (same framework + skip pattern) |
| `tests/components/gem-table/XPtsCell.test.tsx` | test | — | `tests/components/club-form/FixtureEaseRankingPanel.test.tsx` (component test with vitest-environment jsdom) | exact (same `@vitest-environment jsdom` + render/screen pattern) |

---

## Pattern Assignments

### `pipeline/merge.py` — `_compute_xpts_fixture()`, `_xpts_ngw()`, `_compute_xpts_sigma()`, ceiling classification, `merge_players()` extension

**Analog:** `pipeline/merge.py` — `_proj_pts_ngw()` (lines 104–133) and difficulty-tier percentile logic (lines 251–281)

**Imports pattern** (lines 1–4 + line 116 — local import inside function):
```python
from typing import Optional
# stdlib only — no new imports for xPts:
import math      # for math.sqrt in _compute_xpts_sigma(); math.exp if P(no goal) needed
from itertools import groupby   # already imported inline in _proj_pts_ngw (line 116); reuse same pattern
```

**Core function structure pattern — `_proj_pts_ngw()` (lines 104–133):**
```python
def _proj_pts_ngw(
    ppg: float,
    start_prob: float,
    fixtures: list,
    n_gws: int,
) -> float:
    from itertools import groupby

    if not fixtures or ppg == 0 or start_prob == 0:
        return 0.0

    grouped = []
    for event_id, group in groupby(fixtures, key=lambda f: f['event_id']):
        grouped.append((event_id, list(group)))

    total = 0.0
    for _event_id, gw_fixtures in grouped[:n_gws]:
        for fix in gw_fixtures:
            difficulty_modifier = 1.0 - (fix['difficulty_score'] * 0.5)
            total += ppg * start_prob * difficulty_modifier
    return round(total, 2)
```
`_xpts_ngw()` mirrors this exactly — same guard, same groupby loop, same `grouped[:n_gws]` slice. Only the inner body changes (calls `_compute_xpts_fixture()` instead of the heuristic line).

**Cross-player percentile classification pattern — difficulty tiers (lines 251–265):**
```python
xga_values = sorted(team_xga.values())
n = len(xga_values)
if n >= 3:
    easy_idx = int(n * 2 / 3)   # top-third threshold index
    hard_idx = int(n * 1 / 3)   # bottom-third threshold index
    easy_xga_threshold = xga_values[easy_idx]
    hard_xga_threshold = xga_values[hard_idx]
else:
    easy_xga_threshold = max(xga_values) if xga_values else 1.0
    hard_xga_threshold = min(xga_values) if xga_values else 0.0
```
The xPts ceiling-flag classification uses the same `int(n * 2 / 3)` index to find the top-tercile σ threshold. Pattern: `sorted(all_sigmas)` → index `int(n * 2 / 3)` → `ceiling_threshold`.

**Result dict extension pattern (lines 468–473):**
```python
player['proj_pts_1gw'] = proj_pts_1gw
player['proj_pts_3gw'] = proj_pts_3gw
player['proj_pts_5gw'] = proj_pts_5gw
player['xmins'] = player_xmins
player['start_prob'] = player_start_prob
player['mins_risk'] = player_mins_risk
```
New xPts fields slot in at the same point (after this block, before `result.append(player)`), using the same `player['xPts_1gw'] = ...` dict-assignment style.

**Guard pattern for empty fixtures / zero start_prob (line 118):**
```python
if not fixtures or ppg == 0 or start_prob == 0:
    return 0.0
```
`_xpts_ngw()` uses: `if not fixtures or start_prob == 0: return 0.0, None`

---

### `src/lib/types.ts` — `MergedPlayer` xPts field additions

**Analog:** `src/lib/types.ts` — Phase 27 optional field additions to `FixtureEntry` (lines 82–84) and the existing `proj_pts_*` fields in `MergedPlayer` (lines 133–135)

**Optional field pattern for rollout (lines 82–84):**
```typescript
attacking_difficulty?: number  // Phase 27 DATA-01 D-01 — same value as difficulty_score (additive). Optional during pipeline rollout.
defensive_difficulty?: number  // Phase 27 DATA-01 D-02 — from 3-game goals-scored rolling window.
```
New fields follow the same `?: number` (optional) pattern with inline JSDoc comment explaining phase origin.

**Existing `proj_pts_*` fields to follow as layout model (lines 133–135):**
```typescript
proj_pts_1gw: number        // expected pts next 1 GW (ep_next * availability)
proj_pts_3gw: number        // expected pts next 3 GWs (ppg-based, DGW-aware sum)
proj_pts_5gw: number        // expected pts next 5 GWs (ppg-based, DGW-aware sum)
```
New xPts fields are added after line 135, using optional `?:` rather than required (pipeline rollout convention). Object type for `xPts_components_1gw` follows the existing inline interface pattern (no separate named interface for small shapes).

---

### `src/components/gem-table/columns.tsx` — proj_pts column replacement + XPtsCell inline component

**Analog:** `src/components/gem-table/columns.tsx` — existing `proj_pts_*` columns (lines 86–100) and `col.display` with inline component (lines 80–85, `mins_risk` column)

**Imports pattern (lines 1–6):**
```typescript
import { createColumnHelper } from '@tanstack/react-table'
import type { ScoredPlayer } from '@/lib/types'
import { FixtureBadges } from '@/components/fixtures/FixtureBadges'
import { MinsRiskBadge } from '@/components/shared/MinsRiskBadge'

const col = createColumnHelper<ScoredPlayer>()
```
Add: `import { VarianceBadge } from '@/components/gem-table/VarianceBadge'` (or inline the component in this file if keeping it co-located).

**Column header with tooltip pattern (line 17):**
```typescript
const H = (label: string, tip: string) => () => <span title={tip} className="cursor-help">{label}</span>
```
All xPts column headers use `H('xPts', 'tooltip text')` — same as every other scored column.

**`proj_pts_*` column pattern to be replaced (lines 86–100):**
```typescript
col.accessor('proj_pts_1gw', {
  header: H('Proj Pts', 'Projected FPL points next gameweek (FPL expected points × availability). Blank GW or no fixture = 0'),
  cell: (info) => (info.getValue() ?? 0).toFixed(1),
  enableSorting: true,
}),
col.accessor('proj_pts_3gw', {
  header: H('Proj Pts (3)', 'Projected FPL points across next 3 gameweeks (points-per-game × start probability, DGW-aware)'),
  cell: (info) => (info.getValue() ?? 0).toFixed(1),
  enableSorting: true,
}),
col.accessor('proj_pts_5gw', {
  header: H('Proj Pts (5)', 'Projected FPL points across next 5 gameweeks (points-per-game × start probability, DGW-aware)'),
  cell: (info) => (info.getValue() ?? 0).toFixed(1),
  enableSorting: true,
}),
```
These three blocks are replaced in-place with `xPts_1gw`, `xPts_3gw`, `xPts_5gw` accessors using `XPtsCell` as the cell renderer.

**Inline display component pattern (lines 80–85, `mins_risk` column):**
```typescript
col.display({
  id: 'mins_risk',
  header: H('Risk', '...'),
  enableSorting: false,
  cell: ({ row }) => <MinsRiskBadge minsRisk={row.original.mins_risk} />,
}),
```
`XPtsCell` is called from `cell: (info) => <XPtsCell value={info.getValue()} ceiling={info.row.original.xPts_ceiling_1gw} components={info.row.original.xPts_components_1gw} window={1} />`. Note: `col.accessor` (not `col.display`) is used for xPts so the column remains sortable; `info.row.original` accesses related fields.

**Null-safe value pattern (line 88):**
```typescript
cell: (info) => (info.getValue() ?? 0).toFixed(1),
```
`XPtsCell` uses `const display = (value ?? 0).toFixed(1)` — same `?? 0` null-coalescing guard.

---

### `src/components/gem-table/GwToggle.tsx` — `getColumnVisibility()` key map update

**Analog:** `src/components/gem-table/GwToggle.tsx` — `getColumnVisibility()` (lines 21–33)

**Current `gwVisibility` block to update (lines 22–26):**
```typescript
const gwVisibility = {
  proj_pts_1gw: horizon === 1,
  proj_pts_3gw: horizon === 3,
  proj_pts_5gw: horizon === 5,
}
```
Replace `proj_pts_*gw` keys with `xPts_*gw`. The rest of `getColumnVisibility()` (the `isMobile` spread) is unchanged.

**`MOBILE_HIDDEN_COLUMNS` — no change needed (lines 3–19):**
```typescript
export const MOBILE_HIDDEN_COLUMNS: Record<string, boolean> = {
  team_short_name: false,
  now_cost: false,
  fdr_score: false,
  // ... (proj_pts_* keys are NOT present here)
}
```
The `proj_pts_*` columns were never listed in `MOBILE_HIDDEN_COLUMNS` (they remain visible on mobile). `xPts_*` columns inherit the same behaviour — no entry needed in this map.

---

### `src/components/gem-table/VarianceBadge.tsx` — new badge component

**Analog:** `src/components/shared/MinsRiskBadge.tsx` (lines 1–53) — exact same shape

**Full analog to copy structure from (lines 42–53):**
```typescript
export function MinsRiskBadge({ minsRisk }: { minsRisk: MinsRisk }) {
  const config = getMinsRiskConfig(minsRisk)
  if (!config) return null
  return (
    <span
      className={`inline-block text-xs font-normal ${config.text} ${config.bg} rounded px-2 py-1`}
      title={config.title}
    >
      {config.label}
    </span>
  )
}
```

**Tailwind class envelope to reuse (from MinsRiskBadge.tsx lines 46–51):**
```
inline-block text-xs font-normal rounded px-2 py-1
```
This exact Tailwind envelope (`px-2 py-1`, `text-xs font-normal`, `rounded`) is the established badge pattern used across `MinsRiskBadge`, the SetPieceTakerPanel "Changed" badge, and GemTable cells. `VarianceBadge` uses `ml-1` for the inline-after-number gap.

**Color tokens to use:**
- High-ceiling (`ceiling=true`): `bg-violet-100 dark:bg-violet-900 text-violet-800 dark:text-violet-200` (distinct from existing green/blue/amber/zinc badges)
- Consistent (`ceiling=false`): `bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300` (matches `cameo` variant in MinsRiskBadge)

**Import pattern (MinsRiskBadge.tsx line 1):**
```typescript
import type { MinsRisk } from '@/lib/types'
```
`VarianceBadge.tsx` needs no type import — its prop is `ceiling: boolean | undefined`, a plain TypeScript type.

---

### `tests/lib/xpts-engine.test.ts` — new pipeline logic unit tests

**Analog:** `tests/lib/gem-score.test.ts` (pure logic tests) + `tests/lib/merge.test.ts` (skip pattern for cache-dependent tests)

**Test file structure pattern from `gem-score.test.ts` (lines 1–32):**
```typescript
import { describe, it, expect } from 'vitest'
import { computeAllGemScores } from '@/lib/gem-score'
import type { MergedPlayer } from '@/lib/types'

function makeMergedPlayer(overrides: Partial<MergedPlayer> = {}): MergedPlayer {
  return {
    id: 1, web_name: 'Test', team: 1, team_short_name: 'TST',
    element_type: 3, now_cost: 70, selected_by_percent: '10.0',
    // ... all required fields with sensible defaults
    ...overrides,
  }
}

describe('computeAllGemScores', () => {
  it('returns ScoredPlayer with gem_score between 0.0 and 1.0', () => {
    const player = makeMergedPlayer()
    const [scored] = computeAllGemScores([player])
    expect(scored.gem_score).toBeGreaterThanOrEqual(0.0)
  })
})
```
`xpts-engine.test.ts` follows the same pattern: no factory function needed (pure Python logic tested via Python test, or the test imports the TypeScript utility if one exists). For the pipeline Python functions, the tests are in TypeScript using `.skip()` with cache guards — same as `merge.test.ts`.

**Skip pattern for cache-dependent tests from `merge.test.ts` (lines 6–16):**
```typescript
it.skip('contains xPts_1gw on every player (requires pipeline run)', async () => {
  // Skipped: pipeline/cache/merged_players.json requires `cd pipeline && python run.py`
  const raw = await readFile(join(process.cwd(), 'pipeline', 'cache', 'merged_players.json'), 'utf-8')
  const players = JSON.parse(raw) as Record<string, unknown>[]
  expect(players.length).toBeGreaterThan(0)
  for (const p of players) {
    expect(p).toHaveProperty('xPts_1gw')
    expect(typeof p.xPts_1gw).toBe('number')
    expect(p.xPts_1gw as number).toBeGreaterThanOrEqual(0)
  }
})
```
Fast non-skip tests validate pure logic (e.g. the TypeScript `XPtsCell` rendering logic, or a thin wrapper around the Python math if exposed). A placeholder always-pass test confirms file presence (see `merge.test.ts` line 30–34 pattern).

---

### `tests/components/gem-table/XPtsCell.test.tsx` — new component unit tests

**Analog:** `tests/components/club-form/FixtureEaseRankingPanel.test.tsx` (lines 1–62)

**Test file header pattern (lines 1–16):**
```typescript
// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FixtureEaseRankingPanel } from '@/components/club-form/FixtureEaseRankingPanel'
import type { ClubForm } from '@/lib/types'
```
`XPtsCell.test.tsx` uses the same `// @vitest-environment jsdom` pragma and `render/screen` imports. No `vi.mock` needed (XPtsCell and VarianceBadge have no hook dependencies).

**Minimal render test pattern (lines 35–46):**
```typescript
describe('FixtureEaseRankingPanel', () => {
  it('renders the heading "Fixture Ease Ranking"', () => {
    mockState = { isLoading: false, error: null, data: [...] }
    render(<FixtureEaseRankingPanel />)
    expect(screen.getByText('Fixture Ease Ranking')).toBeTruthy()
  })
```
`XPtsCell.test.tsx` follows: `render(<XPtsCell value={4.5} ceiling={true} components={...} window={1} />)` then `screen.getByText('4.5')` and badge assertions.

---

## Shared Patterns

### Null / undefined guard
**Source:** `src/components/gem-table/columns.tsx` line 88 + `src/components/shared/MinsRiskBadge.tsx` lines 37–39
**Apply to:** `XPtsCell`, `VarianceBadge`, any new cell renderer
```typescript
// columns.tsx line 88 — numeric value guard
(info.getValue() ?? 0).toFixed(1)

// MinsRiskBadge.tsx lines 37-39 — prop guard (return null for undefined/invalid)
export function getMinsRiskConfig(minsRisk: MinsRisk): Config | null {
  if (!minsRisk || minsRisk === 'injured') return null
  return BADGE_MAP[minsRisk] ?? null
}
```

### Tailwind dark-mode badge
**Source:** `src/components/shared/MinsRiskBadge.tsx` lines 10–35
**Apply to:** `VarianceBadge.tsx`
```typescript
// Pattern: always pair light and dark variants
bg: 'bg-green-100 dark:bg-green-900',
text: 'text-green-800 dark:text-green-200',
```
Every colour token in the codebase is paired: `bg-{colour}-100 dark:bg-{colour}-900` / `text-{colour}-800 dark:text-{colour}-200`. `VarianceBadge` uses `violet-*` (high-ceiling) and `zinc-*` (consistent) with the same pairing.

### Native `title` tooltip
**Source:** `src/components/gem-table/columns.tsx` line 17 (`H()` helper) + `src/components/shared/MinsRiskBadge.tsx` line 48
**Apply to:** `VarianceBadge.tsx`, `XPtsCell` breakdown tooltip
```typescript
// columns.tsx line 17 — header tooltip
const H = (label: string, tip: string) => () => <span title={tip} className="cursor-help">{label}</span>

// MinsRiskBadge.tsx line 47 — badge-level tooltip
<span ... title={config.title}>

// XPtsCell breakdown tooltip (new, same pattern):
<span title={breakdownTip} className={breakdownTip ? 'cursor-help' : undefined}>
```
All tooltips in this project use the native `title` attribute. No Radix or custom Tooltip primitive.

### Pipeline result dict field assignment
**Source:** `pipeline/merge.py` lines 468–473
**Apply to:** xPts field additions in `merge_players()`
```python
player['proj_pts_1gw'] = proj_pts_1gw
player['proj_pts_3gw'] = proj_pts_3gw
player['proj_pts_5gw'] = proj_pts_5gw
player['xmins'] = player_xmins
player['start_prob'] = player_start_prob
player['mins_risk'] = player_mins_risk
result.append(player)
```
New fields (`xPts_1gw`, `xPts_3gw`, `xPts_5gw`, `xPts_ceiling_1gw`, `xPts_ceiling_3gw`, `xPts_ceiling_5gw`, `xPts_components_1gw`) are added in this same block before `result.append(player)`.

### `groupby` DGW loop
**Source:** `pipeline/merge.py` lines 116–133
**Apply to:** `_xpts_ngw()` inner loop
```python
from itertools import groupby
grouped = []
for event_id, group in groupby(fixtures, key=lambda f: f['event_id']):
    grouped.append((event_id, list(group)))
total = 0.0
for _event_id, gw_fixtures in grouped[:n_gws]:
    for fix in gw_fixtures:
        # inner body
        total += ...
return round(total, 2)
```

### Percentile threshold (top-tercile classification)
**Source:** `pipeline/merge.py` lines 251–264
**Apply to:** `_classify_ceiling()` in `merge_players()` post-loop phase
```python
sorted_vals = sorted(all_values)
n = len(sorted_vals)
if n >= 3:
    idx = int(n * 2 / 3)   # top-third starts here
    threshold = sorted_vals[idx]
else:
    threshold = 0.0
```

---

## No Analog Found

None — all files have direct analogs in the codebase.

---

## Metadata

**Analog search scope:** `pipeline/`, `src/lib/`, `src/components/gem-table/`, `src/components/shared/`, `tests/lib/`, `tests/components/`
**Files scanned:** 10 (merge.py, types.ts, columns.tsx, GwToggle.tsx, MinsRiskBadge.tsx, gem-score.ts, merge.test.ts, gem-score.test.ts, FixtureEaseRankingPanel.test.tsx, 28-UI-SPEC.md)
**Pattern extraction date:** 2026-04-28
