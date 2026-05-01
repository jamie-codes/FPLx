# Phase 31: Captaincy Ceiling — Pattern Map

**Mapped:** 2026-04-28
**Files analyzed:** 9 (5 new, 4 modified)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `pipeline/merge.py` | utility | transform | `pipeline/merge.py` `_compute_differential_flag()` lines 386–414 | self (exact) |
| `pipeline/run.py` | config | batch | `pipeline/run.py` lines 146–164 (save calls) | self (exact) |
| `pipeline/cache/captain_picks.json` | config | file-I/O | `pipeline/cache/set_piece_changes.json` | role-match |
| `src/app/api/captain-picks/route.ts` | controller | request-response | `src/app/api/set-pieces/route.ts` | exact |
| `src/lib/hooks/useCaptainPicks.ts` | hook | request-response | `src/lib/hooks/useSetPieces.ts` | exact |
| `src/lib/types.ts` | model | transform | `src/lib/types.ts` lines 298–317 (`SetPieceChanges` + `SetPieceTaker`) | self (exact) |
| `src/components/captaincy/CaptainPicksPanel.tsx` | component | request-response | `src/components/set-pieces/SetPieceTakerPanel.tsx` | role-match |
| `src/app/page.tsx` | component | request-response | `src/app/page.tsx` line 116 (`SetPieceTakerPanel`) | self (exact) |
| `tests/lib/captain-picks.test.ts` | test | request-response | `tests/lib/differential-flag.test.ts` | exact |

---

## Pattern Assignments

---

### `pipeline/merge.py` — ADD `_compute_captain_picks()` helper + post-loop block, change return to tuple

**Analog:** `pipeline/merge.py` — `_compute_differential_flag()` (lines 386–414) for helper placement; post-loop blocks at lines 802–846 for insertion point.

**Helper placement pattern** (lines 386–414 — place new helper immediately after this block, before `merge_players()` at line 415):
```python
def _compute_differential_flag(
    xpts_1gw: float,
    selected_by_percent: str,
    status: str,
    position_median: float,
) -> str | None:
    """..."""
    ownership = _safe_float(selected_by_percent, 0.0)
    above_median = xpts_1gw > position_median

    if above_median and ownership < 5.0 and status == 'a':
        return 'diff'
    if not above_median and ownership > 15.0:
        return 'trap'
    return None
```

**`_safe_float` helper** (lines 7–11) — use for all `selected_by_percent` casts:
```python
def _safe_float(val, default: float = 0.0) -> float:
    try:
        return float(val)
    except (TypeError, ValueError):
        return default
```

**Post-loop insertion point** (lines 802–848 — new captain picks block goes between line 840 and line 842):
```python
    # ---- xPts ceiling classification (Phase 28 XPTS-02 D-09) ----
    for window in (1, 3, 5):
        ...
        for p in result:
            p[ceiling_key] = bool(p[sigma_key] >= threshold) if n >= 3 else False
    # <--- INSERT captain picks block HERE (after line 840, before sigma strip) --->

    # Strip scratch sigma fields — only the boolean ceiling flags ship in JSON.
    for p in result:
        del p['_sigma_1gw']
        del p['_sigma_3gw']
        del p['_sigma_5gw']

    return result   # <--- change to: return result, captain_picks_payload
```

**Sigma fields available in post-loop** (lines 786–798) — `_sigma_1gw` is still attached when the post-loop runs:
```python
        player['_sigma_1gw'] = _compute_xpts_sigma(
            xg_per90, xa_per90, player_start_prob, player_xmins,
            element['element_type'], player_fixtures, 1,
        )
```
CRITICAL: `_sigma_1gw` is deleted at lines 842–846. The captain picks block MUST run before that strip.

**`merge_players` function signature** (line 415–422) — change return annotation from `list` to `tuple[list, dict]`:
```python
def merge_players(
    bootstrap: dict,
    fixtures: list,
    understat: dict,
    id_map: dict,
    xmins_stats: dict | None = None,
    summaries: dict | None = None,
) -> list:
```

---

### `pipeline/run.py` — receive tuple, add `save('captain_picks.json', ...)`

**Analog:** `pipeline/run.py` lines 146–164 — `save()` call pattern.

**Existing save pattern** (lines 146–165):
```python
        # Merge FPL + Understat data (per-90 normalisation, custom FDR, fixtures)
        merged = merge_players(bootstrap, fixtures, understat, id_map, xmins_stats=xmins_stats, summaries=summaries)
        save('merged_players.json', merged)

        # SP-02: Set-piece snapshot diff
        ...
        save('set_piece_changes.json', sp_changes)
        save('set_pieces_snapshot.json', curr_snapshot)
```

**New pattern** — change line 146 to unpack tuple and add parallel save on line 148:
```python
        merged, captain_picks = merge_players(
            bootstrap, fixtures, understat, id_map, xmins_stats=xmins_stats, summaries=summaries
        )
        save('merged_players.json', merged)
        save('captain_picks.json', captain_picks)   # Phase 31 CAP-03/CAP-04
```

**`save()` import** (line 14) — already imported:
```python
from upload import save
```

---

### `src/app/api/captain-picks/route.ts` (controller, request-response) — NEW FILE

**Analog:** `src/app/api/set-pieces/route.ts` (all 33 lines — copy verbatim, swap filename)

**Full file pattern** (lines 1–33):
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
      if (!blobs.length) {
        return Response.json({ error: 'Set-piece data not available' }, { status: 404 })
      }
      const res = await fetch(blobs[0].url)
      data = await res.text()
    } else {
      const cachePath = join(process.cwd(), 'pipeline', 'cache', 'set_piece_changes.json')
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
    return Response.json({ error: 'Failed to load set-piece data' }, { status: 500 })
  }
}
```

**Substitution map** — replace exactly:
- `'set_piece_changes.json'` (Blob prefix and local path) → `'captain_picks.json'`
- `'Set-piece data not available'` → `'Captain picks not available'`
- `'Failed to load set-piece data'` → `'Failed to load captain picks'`

No other changes. Route handler exports only `GET` (App Router convention).

---

### `src/lib/hooks/useCaptainPicks.ts` (hook, request-response) — NEW FILE

**Analog:** `src/lib/hooks/useSetPieces.ts` (all 14 lines — near-clone)

**Full file pattern** (lines 1–14):
```typescript
import { useQuery } from '@tanstack/react-query'
import type { SetPieceChanges } from '../types'

export function useSetPieces() {
  return useQuery<SetPieceChanges>({
    queryKey: ['set-pieces'],
    queryFn: async () => {
      const res = await fetch('/api/set-pieces')
      if (!res.ok) throw new Error('Failed to fetch set-piece data')
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000, // 6 hours
  })
}
```

**Substitution map:**
- `SetPieceChanges` → `CaptainPicks`
- `import type { SetPieceChanges } from '../types'` → `import type { CaptainPicks } from '../types'`
- `useSetPieces` → `useCaptainPicks`
- `['set-pieces']` → `['captain-picks']`
- `'/api/set-pieces'` → `'/api/captain-picks'`
- `'Failed to fetch set-piece data'` → `'Failed to fetch captain picks'`

NOTE: Do NOT fetch `/pipeline/cache/captain_picks.json` directly. Always fetch through the `/api/captain-picks` route handler. All hooks in the project use `/api/*` routes (verified against `usePlayers.ts` line 5 and `useSetPieces.ts` line 8).

---

### `src/lib/types.ts` — ADD `xPts_90th_1gw` to `MergedPlayer`, ADD `CaptainPick` + `CaptainPicks` interfaces

**Analog:** `src/lib/types.ts` lines 140–165 (xPts optional fields pattern) and lines 298–317 (SetPieceChanges interface cluster).

**xPts optional field pattern** (lines 140–165 — additive-rollout convention; new field follows same `?:` optional style):
```typescript
  // xPts engine (Phase 28 DATA-02, XPTS-01, XPTS-02 — D-01..D-09).
  // Optional during pipeline rollout — same convention as Phase 27 attacking_difficulty.
  xPts_1gw?: number           // expected pts next 1 GW (Poisson goals/assists, Bernoulli CS, flat bonus)
  xPts_3gw?: number           // expected pts next 3 GWs (DGW-aware sum)
  xPts_5gw?: number           // expected pts next 5 GWs (DGW-aware sum)
  xPts_ceiling_1gw?: boolean  // true = top-tercile sigma in 1 GW window (high-ceiling)
  xPts_ceiling_3gw?: boolean  // true = top-tercile sigma in 3 GW window
  xPts_ceiling_5gw?: boolean  // true = top-tercile sigma in 5 GW window
  xPts_components_1gw?: { ... } | null
  // Regression signal (Phase 29 DATA-03, REG-01, REG-02).
  regression_signal?: 'buy' | 'sell' | null
  actual_vs_xg_delta?: number | null
  // Differential flag (Phase 30 TMPL-01, TMPL-02).
  differential_flag?: 'diff' | 'trap' | null
```
Add after line 165: `xPts_90th_1gw?: number  // 90th-percentile ceiling per Phase 31 (D-11)`

**Interface cluster pattern** (lines 298–317 — how SetPieceChanges cluster is organised):
```typescript
// Set-piece changes data (SP-01/SP-02)
export interface SetPieceTaker {
  id: number | null
  name: string
  changed: boolean
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
Mirror this pattern for `CaptainPick` + `CaptainPicks` (append after line 317):
```typescript
// Captain picks data (Phase 31 CAP-03/CAP-04)
export interface CaptainPick {
  id: number
  name: string
  team: string
  position: string
  now_cost: number
  xPts_1gw: number
  xPts_90th_1gw: number
  selected_by_percent: string
  eo_threshold_used?: number   // only present on eo_adjusted pick
}

export interface CaptainPicks {
  generated_at: string
  gameweek: number | null
  ceiling: CaptainPick | null
  eo_adjusted: CaptainPick | null
}
```

---

### `src/components/captaincy/CaptainPicksPanel.tsx` (component, request-response) — NEW FILE

**Primary analog:** `src/components/set-pieces/SetPieceTakerPanel.tsx` (all 75 lines) — structural panel pattern.
**Secondary analog:** `src/components/captaincy/CaptaincyPanel.tsx` (all 93 lines) — existing captaincy card pattern in same directory.

**Panel structure pattern** (`SetPieceTakerPanel.tsx` lines 1–75):
```typescript
'use client'

import { useSetPieces } from '@/lib/hooks/useSetPieces'
import type { SetPieceTaker } from '@/lib/types'
import { SetPieceChangeAlert } from './SetPieceChangeAlert'

function TakerRow({ ... }) { ... }

export function SetPieceTakerPanel() {
  const { data, isLoading, error } = useSetPieces()

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-1">Set-Piece Takers</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">...</p>
      </div>

      {isLoading && (
        <p className="text-zinc-500 dark:text-zinc-400 text-center py-8">Loading...</p>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 py-4">
          Failed to load set-piece data. ...
        </p>
      )}

      {data && data.teams.length === 0 && ( ... empty state ... )}

      {data && data.teams.length > 0 && (
        <>
          ...
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.teams.map((team) => (
              <div
                key={team.team_id}
                className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3"
              >
                ...
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
```

**Card border/background token** (line 63):
```typescript
className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3"
```

**Grid layout for two-column side-by-side** (line 58 — SetPieceTakerPanel uses 3-col; CaptainPicksPanel uses 2-col):
```typescript
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
```

**Tooltip pattern from `DifferentialBadge.tsx`** (lines 8–38) — native `title` attribute, no Radix:
```typescript
<span
  className="inline-block text-xs font-normal rounded px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
  title={`Differential: ${pct}% owned, above-average xPts for position. Low ownership = rank gain potential.`}
>
  DIFF
</span>
```
Apply same `title` attribute directly on heading or container element for captain card tooltips.

**Badge type pattern from `CaptaincyPanel.tsx`** (lines 6–38) — type badge with `bg-*` + `text-*` token pairs, `title` attribute:
```typescript
const TYPE_MAP: Record<'safe' | 'upside', CaptainTypeBadgeConfig> = {
  safe: {
    bg: 'bg-blue-100 dark:bg-blue-900',
    text: 'text-blue-800 dark:text-blue-200',
    label: 'Safe',
    title: 'Safe pick: nailed starter with consistent high floor',
  },
  upside: {
    bg: 'bg-amber-100 dark:bg-amber-900',
    text: 'text-amber-800 dark:text-amber-200',
    label: 'Upside',
    title: 'Upside pick: differential or high ceiling — higher variance',
  },
}
```
Use similar palette split for ceiling vs EO badges if desired (at Claude's discretion per CONTEXT).

**File location:** `src/components/captaincy/CaptainPicksPanel.tsx` — use existing `captaincy/` directory, NOT a new `captain/` directory. See RESEARCH.md Pitfall 6: CONTEXT D-13 says `captain/` but existing dir is `captaincy/`; co-locating with `CaptaincyPanel.tsx` is the recommended deviation.

---

### `src/app/page.tsx` — MODIFY: render `<CaptainPicksPanel />` in gems branch

**Analog:** `src/app/page.tsx` line 116 — `{activeTab === 'set-pieces' && <SetPieceTakerPanel />}` pattern; and lines 110–115 showing fragment wrapping for multi-component branches.

**Current gems branch** (line 107):
```typescript
        {activeTab === 'gems' && <GemTable />}
```

**Fragment wrapping pattern** (lines 110–115 — club-form does this):
```typescript
        {activeTab === 'club-form' && (
          <>
            <FixtureEaseRankingPanel />
            <ClubFormTable />
          </>
        )}
```

**Required change:**
```typescript
        {activeTab === 'gems' && (
          <>
            <GemTable />
            <CaptainPicksPanel />
          </>
        )}
```

**Import to add** (after line 14, following the existing import block pattern):
```typescript
import { CaptainPicksPanel } from '@/components/captaincy/CaptainPicksPanel'
```

---

### `tests/lib/captain-picks.test.ts` (test) — NEW FILE

**Analog:** `tests/lib/differential-flag.test.ts` (all 123 lines — exact structural template)

**File header pattern** (lines 1–11):
```typescript
// Phase 30: Differential Tracker — test stubs
// Wave 0: stubs created before implementation to satisfy Nyquist rule.
// Integration tests are skipped (require pipeline run).
// Component tests filled in Wave 2 Task 1 of 30-02-PLAN.md.
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { DifferentialBadge } from '@/components/gem-table/DifferentialBadge'
```
Adjust: change component import to `CaptainPicksPanel` from `@/components/captaincy/CaptainPicksPanel`.

**`it.skip` integration test pattern** (lines 13–23 — reads pipeline cache file):
```typescript
  it.skip('differential_flag values are diff, trap, or absent (requires pipeline run)', async () => {
    const raw = await readFile(join(process.cwd(), 'pipeline', 'cache', 'merged_players.json'), 'utf-8')
    const players = JSON.parse(raw) as Record<string, unknown>[]
    expect(players.length).toBeGreaterThan(0)
    for (const p of players) {
      if ('differential_flag' in p) {
        const flag = p.differential_flag
        expect(flag === 'diff' || flag === 'trap').toBe(true)
      }
    }
  })
```
Apply same `it.skip` + `readFile(join(process.cwd(), 'pipeline', 'cache', 'captain_picks.json'), 'utf-8')` pattern for pipeline integration tests. Also read `merged_players.json` for per-player `xPts_90th_1gw` checks.

**Component render pattern** (lines 67–76 — DifferentialBadge component tests):
```typescript
describe('Phase 30: DifferentialBadge component', () => {
  it('renders green DIFF pill for flag="diff"', () => {
    const { container } = render(DifferentialBadge({ flag: 'diff', ownership: 3.4 }))
    const span = container.querySelector('span')
    expect(span).not.toBeNull()
    expect(span!.textContent).toBe('DIFF')
    expect(span!.className).toContain('bg-green-100')
    expect(span!.getAttribute('title')).toMatch(/^Differential:/)
  })
```
For `CaptainPicksPanel` component tests: mock `useCaptainPicks` at module level (vitest `vi.mock`), render with `@testing-library/react`, assert on player name text content and loading/error states.

**Wave 0 bottom stub** (line 120–122 — always include this so the test file passes immediately):
```typescript
it('Wave 0 stub file created — replace with real tests after implementation', () => {
  expect(true).toBe(true)
})
```

---

## Shared Patterns

### `'use client'` directive
**Source:** `src/components/set-pieces/SetPieceTakerPanel.tsx` line 1; `src/components/captaincy/CaptaincyPanel.tsx` line 1; `src/components/gem-table/DifferentialBadge.tsx` line 1
**Apply to:** `CaptainPicksPanel.tsx`
```typescript
'use client'
```
All leaf components that consume React hooks must have this directive on line 1.

### Blob/local toggle
**Source:** `src/app/api/set-pieces/route.ts` lines 5, 11–21
**Apply to:** `src/app/api/captain-picks/route.ts`
```typescript
const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'

if (USE_BLOB) {
  const { blobs } = await list({ prefix: 'filename.json', limit: 1 })
  ...
  const res = await fetch(blobs[0].url)
  data = await res.text()
} else {
  const cachePath = join(process.cwd(), 'pipeline', 'cache', 'filename.json')
  data = await readFile(cachePath, 'utf-8')
}
```

### React Query staleTime
**Source:** `src/lib/hooks/useSetPieces.ts` line 12; `src/lib/hooks/usePlayers.ts` line 16
**Apply to:** `useCaptainPicks.ts`
```typescript
staleTime: 6 * 60 * 60 * 1000, // 6 hours
```

### Error + loading state in panels
**Source:** `src/components/set-pieces/SetPieceTakerPanel.tsx` lines 36–44
**Apply to:** `CaptainPicksPanel.tsx`
```typescript
{isLoading && (
  <p className="text-zinc-500 dark:text-zinc-400 text-center py-8">Loading...</p>
)}
{error && (
  <p className="text-sm text-red-600 dark:text-red-400 py-4">
    Failed to load data. Check the pipeline output and refresh.
  </p>
)}
```

### Native `title` tooltip (no Radix)
**Source:** `src/components/gem-table/DifferentialBadge.tsx` lines 22–27; `src/components/captaincy/CaptaincyPanel.tsx` lines 30–37
**Apply to:** `CaptainPicksPanel.tsx` card headings
```typescript
<h3 className="text-sm font-semibold" title="Tooltip text here">Label</h3>
```

### `_safe_float` for string-typed ownership
**Source:** `pipeline/merge.py` lines 7–11
**Apply to:** `_compute_captain_picks()` — ownership comparison gate
```python
_safe_float(p.get('selected_by_percent'), 0.0) < threshold
```
Never compare `p.get('selected_by_percent')` directly — FPL returns `"12.5"` (string), raises `TypeError` in numeric comparison.

### Optional field convention in `MergedPlayer`
**Source:** `src/lib/types.ts` lines 140–165
**Apply to:** `xPts_90th_1gw?: number` addition to `MergedPlayer`
All Phase 28+ additions use `?:` optional (absent during pipeline rollout). Follow same pattern.

---

## No Analog Found

All 9 files have strong analogs. No file requires falling back to RESEARCH.md patterns exclusively.

---

## Metadata

**Analog search scope:** `pipeline/`, `src/app/api/`, `src/lib/hooks/`, `src/lib/types.ts`, `src/components/`, `src/app/page.tsx`, `tests/lib/`
**Files scanned:** 13 analog files read
**Pattern extraction date:** 2026-04-28
