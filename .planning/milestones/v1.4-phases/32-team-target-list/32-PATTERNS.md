# Phase 32: Team Target List - Pattern Map

**Mapped:** 2026-04-28
**Files analyzed:** 3 (1 existing extension + 1 new utility + 1 existing type extension)
**Analogs found:** 3 / 3

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/club-form/FixtureEaseRankingPanel.tsx` | component (extend) | request-response, CRUD | `src/components/club-form/FixtureEaseRankingPanel.tsx` itself | exact — self-extension |
| `src/lib/xgi.ts` | utility | transform | `src/lib/gem-score.ts` + `src/lib/value-gems.ts` | role-match |
| `src/lib/types.ts` | types (extend) | — | `src/lib/types.ts` itself | exact — self-extension |

---

## Pattern Assignments

### `src/components/club-form/FixtureEaseRankingPanel.tsx` (component, extend)

**Analog:** itself — all new logic is additive inside this file.
**Badge pattern analogs:** `src/components/gem-table/RegressionSignalBadge.tsx`, `src/components/gem-table/DifferentialBadge.tsx`

#### Current imports pattern (lines 1–8):
```typescript
'use client'

import { useState } from 'react'
import { useClubForm } from '@/lib/hooks/useClubForm'
import { GwToggle } from '@/components/gem-table/GwToggle'
import { AttDefToggle } from './AttDefToggle'
import { EaseBar } from './EaseBar'
import type { ClubForm } from '@/lib/types'
```

**Extension adds:** `usePlayers` import, `computeXgiInvolvement` import, badge component imports, and `MergedPlayer` type import.

```typescript
// Additions to existing import block:
import { usePlayers } from '@/lib/hooks/usePlayers'
import { computeXgiInvolvement } from '@/lib/xgi'
import { RegressionSignalBadge } from '@/components/gem-table/RegressionSignalBadge'
import { DifferentialBadge } from '@/components/gem-table/DifferentialBadge'
import type { MergedPlayer } from '@/lib/types'
```

#### Expand state pattern (add after existing `const [mode, setMode] = useState<Mode>('ATT')`):
```typescript
const [expandedTeamId, setExpandedTeamId] = useState<number | null>(null)
```

One state value, `number | null`. Toggling: if the clicked team is already expanded, collapse it (`null`); otherwise set to the new team ID. Only one team open at a time.

#### TARGET qualification pattern (derives from `upcoming_fixtures`, always 5-GW, always ATT):
```typescript
// Inside the ranked.map() — per-team TARGET check
// CONTEXT D-03: attacking_difficulty < 0.5 counts as favourable; 4+ out of 5 = TARGET
const isTarget = (
  team.upcoming_fixtures
    .slice(0, 5)
    .filter((f) => f.attacking_difficulty < 0.5).length >= 4
)
```

`team.upcoming_fixtures` is always available because `computeClubForm` always produces it (see `src/lib/types.ts` line 226: `upcoming_fixtures: ClubFormFixture[]`). The check is computed on every render — no memoisation required for 20 teams.

#### TARGET badge pattern — copy from `RegressionSignalBadge.tsx` lines 21–27:
```typescript
// RegressionSignalBadge.tsx lines 21–27 — the badge envelope to copy:
<span
  className="inline-block text-xs font-normal rounded px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
  title={`Underperforming xG+xA...`}
>
  BUY
</span>

// TARGET badge — same envelope, different content and title:
<span
  className="inline-block text-xs font-normal rounded px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
  title="4+ favourable fixtures in the next 5 GWs (attacking difficulty < 0.5). Click to see top players."
>
  TARGET
</span>
```

#### Row interaction pattern (extend existing `<li>` at line 58–68):

Current `<li>` (lines 58–69):
```typescript
<li
  key={team.team_id}
  className="flex items-center gap-2 text-sm"
  data-testid={`ease-row-${team.team_short_name}`}
>
  <span className="w-6 text-right text-zinc-500">{i + 1}</span>
  <span className="w-12 font-mono">{team.team_short_name}</span>
  <EaseBar ease={ease} />
  <span className="w-10 text-right text-xs text-zinc-500">{pct}</span>
</li>
```

Extended pattern — TARGET rows gain click handler, badge, and chevron; non-TARGET rows are unchanged:
```typescript
<li
  key={team.team_id}
  className="flex items-center gap-2 text-sm"
  data-testid={`ease-row-${team.team_short_name}`}
  // TARGET rows only: add cursor + keyboard accessibility
  {...(isTarget ? {
    onClick: () => setExpandedTeamId(expandedTeamId === team.team_id ? null : team.team_id),
    onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedTeamId(expandedTeamId === team.team_id ? null : team.team_id) } },
    tabIndex: 0,
    role: 'button',
    style: { cursor: 'pointer' },
  } : {})}
>
  <span className="w-6 text-right text-zinc-500">{i + 1}</span>
  <span className="w-12 font-mono">{team.team_short_name}</span>
  <EaseBar ease={ease} />
  <span className="w-10 text-right text-xs text-zinc-500">{pct}</span>
  {isTarget && (
    <>
      <span
        className="inline-block text-xs font-normal rounded px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
        title="4+ favourable fixtures in the next 5 GWs (attacking difficulty < 0.5). Click to see top players."
      >
        TARGET
      </span>
      <span
        className="ml-auto text-zinc-400 dark:text-zinc-500 w-4 h-4"
        title={expandedTeamId === team.team_id ? 'Hide player list' : 'Show top players for this team'}
      >
        {expandedTeamId === team.team_id ? '▴' : '▾'}
      </span>
    </>
  )}
</li>
```

#### Expanded player block pattern (sibling after the `<li>`, inside `<ul>`):

Per UI-SPEC Layout Contract: expanded block is a sibling `<div>` immediately after the `<li>`, not inside it.

```typescript
{isTarget && expandedTeamId === team.team_id && (
  <div className="mt-1 mb-2 pl-8 bg-zinc-50 dark:bg-zinc-800 rounded">
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
            <th className="py-1 pr-3 text-left w-28">Player</th>
            <th className="py-1 pr-3 text-left w-8">Pos</th>
            <th className="py-1 pr-3 text-right w-10">xGI%</th>
            <th className="py-1 pr-3 text-right w-10">xPts</th>
            <th className="py-1 pr-3 w-14">Signal</th>
            <th className="py-1 pr-3 w-14">Diff</th>
          </tr>
        </thead>
        <tbody>
          {topPlayers(team.team_id, players, xgiMap).map((p) => (
            <tr key={p.id}>
              <td className="py-1 pr-3 font-semibold truncate max-w-[7rem]">{p.web_name}</td>
              <td className="py-1 pr-3">{posLabel(p.element_type)}</td>
              <td className="py-1 pr-3 text-right">
                {xgiMap.get(p.id) != null
                  ? `${((xgiMap.get(p.id) as number) * 100).toFixed(0)}%`
                  : <span className="text-zinc-400">—</span>}
              </td>
              <td className="py-1 pr-3 text-right">{p.xPts_1gw?.toFixed(1) ?? '—'}</td>
              <td className="py-1 pr-3">
                <RegressionSignalBadge signal={p.regression_signal} delta={p.actual_vs_xg_delta} />
              </td>
              <td className="py-1 pr-3">
                <DifferentialBadge flag={p.differential_flag} ownership={parseFloat(p.selected_by_percent)} />
              </td>
            </tr>
          ))}
          {topPlayers(team.team_id, players, xgiMap).length === 0 && (
            <tr>
              <td colSpan={6} className="text-xs text-zinc-500 dark:text-zinc-400 py-1">
                No available players with xGI data for this team.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
)}
```

#### `usePlayers` integration — call inside the panel (no prop-drilling):
```typescript
// Same pattern as existing useClubForm() call at line 19
const { data: players } = usePlayers()
```

Note: `players` may be `undefined` while loading; the expanded block should guard `players ?? []` before passing to `computeXgiInvolvement`.

#### Error/loading states — copy exactly from lines 27–37:
```typescript
// lines 27–29 — loading state string is locked:
if (isLoading) {
  return <p className="text-gray-500 dark:text-zinc-400">Loading fixture ease...</p>
}
// lines 30–35 — error state string is locked:
if (error) {
  return (
    <p className="text-red-500">
      Failed to load fixture ease: {error instanceof Error ? error.message : String(error)}
    </p>
  )
}
```

---

### `src/lib/xgi.ts` (utility, transform)

**Analog:** `src/lib/gem-score.ts` (multi-pass aggregation over `MergedPlayer[]`) and `src/lib/value-gems.ts` (simple per-player utility functions with `Pick<MergedPlayer>` inputs).

#### Imports pattern — copy from `gem-score.ts` line 1:
```typescript
import type { MergedPlayer } from '@/lib/types'
```

No other imports needed — pure computation, no React, no hooks.

#### Core aggregation pattern — copy two-pass approach from `gem-score.ts` lines 47–65:

`gem-score.ts` pass-1 pattern (collect team totals, then compute per-player ratios):
```typescript
// gem-score.ts lines 47–65 — two-pass: gather stats first, then score each player
export function computeAllGemScores(players: MergedPlayer[]): ScoredPlayer[] {
  // Pass 1: compute raw values and collect stats
  const rawFdr = players.map(p => 1.0 - avgDifficulty(p))
  // ...
  const stats: DimensionStats = { fdr: minMax(rawFdr), ... }

  // Pass 2: score each player
  return players.map((player) => { ... normalise(value, stats) ... })
}
```

`computeXgiInvolvement` uses the same two-pass structure — accumulate team totals first, then compute each player's share:
```typescript
/**
 * Groups MergedPlayer[] by team (player.team), sums expected_goals + expected_assists
 * per team, then returns a Map<playerId, xgi_involvement_pct>.
 *
 * D-09: uses FPL expected_goals + expected_assists season-total fields.
 * Zero-division guard: if teamTotal === 0, player is omitted from the map
 * (caller renders "—" for absent entries).
 */
export function computeXgiInvolvement(players: MergedPlayer[]): Map<number, number> {
  // Pass 1: sum (expected_goals + expected_assists) per team
  const teamTotals = new Map<number, number>()
  for (const p of players) {
    const xgi = (p.expected_goals ?? 0) + (p.expected_assists ?? 0)
    teamTotals.set(p.team, (teamTotals.get(p.team) ?? 0) + xgi)
  }

  // Pass 2: compute each player's share
  const result = new Map<number, number>()
  for (const p of players) {
    const total = teamTotals.get(p.team) ?? 0
    if (total > 0) {
      const xgi = (p.expected_goals ?? 0) + (p.expected_assists ?? 0)
      result.set(p.id, xgi / total)
    }
  }
  return result
}
```

**CRITICAL NOTE on `expected_goals`/`expected_assists` fields:** These fields currently do NOT exist on `MergedPlayer` in the pipeline output (confirmed by inspecting `pipeline/cache/merged_players.json` — they are absent from all player objects). They DO exist on the FPL bootstrap `elements` objects (`fpl_bootstrap.json`). The executor MUST add `expected_goals` and `expected_assists` to the pipeline merge step (`pipeline/merge.py`) by reading them from `element` dict (same pattern as `goals_scored`, `assists` at line ~800), AND declare them on `MergedPlayer` in `src/lib/types.ts`. Without this, `computeXgiInvolvement` will always receive 0 for every player.

#### `value-gems.ts` pattern for simple utility shape (lines 1–11):
```typescript
// value-gems.ts lines 1–11 — simple named export, Pick<MergedPlayer> inputs
import type { MergedPlayer } from '@/lib/types'

export function isCheapGem(player: Pick<MergedPlayer, 'now_cost'>): boolean {
  return player.now_cost / 10 <= 6.0
}
```

`computeXgiInvolvement` is a named export taking the full `MergedPlayer[]` array — same shape.

---

### `src/lib/types.ts` (types, extend)

**Change:** Add `expected_goals` and `expected_assists` optional fields to `MergedPlayer`. Also optionally add `xgi_involvement_pct?: number` (executor discretion per CONTEXT).

#### Insertion point — after line 106 (FPL scoring fields block):

Current lines 104–106:
```typescript
  // FPL scoring fields (used by DQ-01 xG proxy in gem-score.ts)
  goals_scored: number
  assists: number
```

Insert after `assists`:
```typescript
  // FPL StatsBomb season-total xG/xA (Phase 32 DATA-01, D-09).
  // Source: bootstrap elements.expected_goals / expected_assists.
  // Used to compute per-player xGI involvement % in computeXgiInvolvement().
  expected_goals: number
  expected_assists: number
```

Non-optional (same convention as `goals_scored`/`assists` — always present on FPL element).

---

## Shared Patterns

### Badge Envelope
**Source:** `src/components/gem-table/RegressionSignalBadge.tsx` lines 21–27 and `DifferentialBadge.tsx` lines 19–27
**Apply to:** TARGET badge in `FixtureEaseRankingPanel`

```typescript
// Canonical badge envelope — used by RegressionSignalBadge, DifferentialBadge, and new TARGET badge
className="inline-block text-xs font-normal rounded px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
```

Green variant only for TARGET and BUY/DIFF signals; amber variant (`bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200`) for SELL/TRAP signals.

### Null/em-dash fallback
**Source:** `RegressionSignalBadge.tsx` line 15, `DifferentialBadge.tsx` line 15
**Apply to:** xGI% zero-division case, xPts_1gw absent case

```typescript
// Both badge components — null guard with em-dash span:
if (!signal) return <span className="text-zinc-400">—</span>
```

Use `<span className="text-zinc-400">—</span>` for any absent/zero-division display case.

### Tooltip pattern
**Source:** `RegressionSignalBadge.tsx` line 22, `DifferentialBadge.tsx` line 23
**Apply to:** TARGET badge title, chevron title

```typescript
// Native HTML title attribute — no Radix, no custom tooltip component:
title="descriptive string here"
```

### Dark-mode paired colours
**Source:** Throughout `RegressionSignalBadge.tsx` and `DifferentialBadge.tsx`
**Apply to:** All new elements in `FixtureEaseRankingPanel`

Every colour declaration must include its `dark:` pair. Pattern: `text-zinc-500 dark:text-zinc-400`, `bg-zinc-50 dark:bg-zinc-800`, `border-zinc-100 dark:border-zinc-800`.

### 'use client' directive
**Source:** `FixtureEaseRankingPanel.tsx` line 1, `RegressionSignalBadge.tsx` line 1
**Apply to:** Any component file using `useState`

```typescript
'use client'
```

Must be first line. `src/lib/xgi.ts` is a pure utility — does NOT need `'use client'`.

### `useState<T | null>` toggle pattern
**Source:** `FixtureEaseRankingPanel.tsx` lines 20–21 — existing `useState<Win>` and `useState<Mode>`
**Apply to:** `expandedTeamId` state

```typescript
// Existing toggle state pattern in the panel:
const [win, setWin] = useState<Win>(3)
const [mode, setMode] = useState<Mode>('ATT')

// New — same pattern:
const [expandedTeamId, setExpandedTeamId] = useState<number | null>(null)
```

---

## Pipeline Change Required

**File:** `pipeline/merge.py`
**Nature:** Add `expected_goals` and `expected_assists` season-total fields from the FPL bootstrap element to the merged player dict.

**Insertion pattern** — same location as `goals_scored`/`assists` (~line 800 area, inside the per-player assembly loop):

Existing pattern to copy:
```python
# Already in merge.py — pattern for reading FPL element fields:
player['goals_scored'] = element.get('goals_scored', 0)
player['assists'] = element.get('assists', 0)

# Add alongside these (confirmed present on FPL bootstrap element):
player['expected_goals'] = float(element.get('expected_goals', 0) or 0)
player['expected_assists'] = float(element.get('expected_assists', 0) or 0)
```

The FPL bootstrap `elements` already contain `expected_goals` and `expected_assists` as season-total strings (e.g. `"3.50"`) — use `float()` with `or 0` guard to match the pipeline's `_safe_float` convention.

---

## No Analog Found

None — all three file changes have strong analogs in the codebase.

---

## Metadata

**Analog search scope:** `src/components/club-form/`, `src/components/gem-table/`, `src/components/captaincy/`, `src/lib/`, `pipeline/merge.py`
**Files scanned:** 11 source files + 1 JSON cache file
**Pattern extraction date:** 2026-04-28
