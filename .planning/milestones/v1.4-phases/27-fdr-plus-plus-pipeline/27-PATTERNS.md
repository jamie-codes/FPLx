# Phase 27: FDR++ Pipeline - Pattern Map

**Mapped:** 2026-04-28
**Files analyzed:** 8 (5 modified, 3 new) + 2 test files
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `pipeline/merge.py` (MOD) | data-pipeline | batch transform | self — extend existing function | exact (in-file) |
| `src/lib/club-form.ts` (MOD) | service / pure compute | batch transform | self — extend `computeClubForm()` | exact (in-file) |
| `src/lib/types.ts` (MOD) | type definitions | n/a | self — extend `FixtureEntry`, `ClubFormFixture`, `ClubForm` | exact (in-file) |
| `src/app/page.tsx` (MOD) | page / tab mount | UI composition | self — already mounts `<ClubFormTable />` at line 109 | exact (in-file) |
| `src/components/club-form/FixtureEaseRankingPanel.tsx` (NEW) | client component / data-driven panel | request-response (read-only) | `src/components/gem-table/GemTable.tsx` (toggle + rank list) + `src/components/club-form/ClubFormTable.tsx` (mobile + hook + load/error states) | composite role-match |
| `src/components/club-form/AttDefToggle.tsx` (NEW) | client component / pill toggle | UI state | `src/components/gem-table/GwToggle.tsx` | exact (mirror) |
| `src/components/club-form/EaseBar.tsx` (NEW) | client component / presentational | UI render | `src/components/fixtures/FixtureBadges.tsx` (TIER_COLOURS palette) | role-match (color reuse) |
| `tests/lib/club-form.test.ts` (MOD) | unit test (TS, node env) | n/a | self — extend existing vitest spec | exact (in-file) |
| `tests/components/club-form/FixtureEaseRankingPanel.test.tsx` (NEW) | component test | n/a | **NO ANALOG** — see "No Analog Found" | none |

## Pattern Assignments

---

### `pipeline/merge.py` (data-pipeline, batch transform) — MODIFIED

**Analog:** self — `pipeline/merge.py` already implements the exact pattern. New code mirrors the existing `team_goals_conceded` -> `team_xga` -> `_compute_difficulty_score` chain with a parallel `team_goals_scored` -> `team_xgs` chain.

**Existing helper to reuse as-is** (lines 14–22):
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

**Existing tier helper** (lines 25–36):
```python
def _difficulty_tier(score: float, easy_threshold: float, hard_threshold: float) -> str:
    if score <= easy_threshold:
        return 'easy'
    elif score >= hard_threshold:
        return 'hard'
    else:
        return 'medium'
```

**Existing rolling loop to mirror** (lines 174–200):
```python
ROLLING_WINDOW = 6

finished = sorted(
    [f for f in fixtures if f.get('finished') and f.get('event') is not None],
    key=lambda f: f['event'],
)

team_goals_conceded: dict[int, list[int]] = {t_id: [] for t_id in teams}

for fix in finished:
    h_id = fix['team_h']
    a_id = fix['team_a']
    h_score = fix.get('team_h_score') or 0
    a_score = fix.get('team_a_score') or 0

    if h_id in team_goals_conceded:
        team_goals_conceded[h_id].append(a_score)  # home team conceded away goals
    if a_id in team_goals_conceded:
        team_goals_conceded[a_id].append(h_score)  # away team conceded home goals

# Rolling 6-game average goals conceded — this is our "xGA proxy"
team_xga: dict[int, float] = {}
for t_id, conceded_list in team_goals_conceded.items():
    last_n = conceded_list[-ROLLING_WINDOW:]
    team_xga[t_id] = sum(last_n) / len(last_n) if last_n else 0.0
```

**NEW pattern to write — parallel `team_goals_scored` loop** (insert near line 200, before percentile thresholds at line 205):
- Add constant `OFFENSIVE_ROLLING = 3` next to existing `ROLLING_WINDOW = 6`.
- Reuse the same `finished` sorted list (do NOT re-iterate fixtures — just walk it again or build both dicts in the same `for fix in finished:` loop).
- Build `team_goals_scored[t_id].append(h_score if h_id == t_id else a_score)` per fixture.
- Compute `team_xgs[t_id]` as the mean of the last `OFFENSIVE_ROLLING` entries.
- Independently normalize across `xgs_values` (its own min/max).
- **Inversion subtlety (Pitfall A1 in research):** `_compute_difficulty_score()` returns `1.0 - (x - min)/(max - min)`. For `defensive_difficulty` we want HIGH goals scored = HIGH difficulty (NOT inverted), so either:
  - (a) write a tiny helper that returns `(x - min)/(max - min)` un-inverted, OR
  - (b) call `_compute_difficulty_score(team_xgs[t_id], max_xgs, min_xgs)` with min/max **swapped** (mathematically equivalent un-inversion).
  Pick option (a) for clarity; name it `_compute_offensive_difficulty_score` and add a docstring stating "0.0 = easiest (opponent rarely scores → easy CS), 1.0 = hardest (opponent scores often → hard CS)".

**Existing fixture-emit pattern to extend** (lines 256–275):
```python
team_fixtures[h_id].append({
    'opponent_team': teams[opp_id]['short_name'] if opp_id in teams else str(opp_id),
    'is_home': True,
    'event_id': event_id,
    'difficulty_score': difficulty_scores.get(opp_id, 0.5),
    'difficulty_tier': difficulty_tiers.get(opp_id, 'medium'),
    # NEW — additive only:
    'attacking_difficulty': difficulty_scores.get(opp_id, 0.5),         # same as difficulty_score
    'defensive_difficulty': defensive_difficulty_scores.get(opp_id, 0.5),
})
```
**Do the same in the away branch (lines 267–275).** Do not rename or remove existing keys.

**Percentile threshold pattern** (lines 208–218): mirror this block for `xgs_values` to compute `defensive_difficulty_tiers` if tiering is required (research §Open Questions Q1 says each metric computes its own thresholds). Phase 27 only needs the numeric `*_difficulty` fields per fixture entry; tiering can be derived client-side from the bar's ease value (see EaseBar pattern below) — confirm with planner whether per-fixture tier strings are also emitted.

---

### `src/lib/club-form.ts` (service, batch transform) — MODIFIED

**Analog:** self — extend `computeClubForm()`.

**Existing rolling loop pattern** (lines 44–61):
```typescript
const ROLLING = 6
const teamXga = new Map<number, number>()
for (const [tId, fxs] of teamFinished) {
  const conceded = fxs.map(f =>
    f.team_h === tId ? (f.team_a_score ?? 0) : (f.team_h_score ?? 0)
  )
  const lastN = conceded.slice(-ROLLING)
  teamXga.set(tId, lastN.length > 0 ? lastN.reduce((a, b) => a + b, 0) / lastN.length : 0)
}
const xgaValues = [...teamXga.values()].sort((a, b) => a - b)
const minXga = xgaValues.length > 0 ? Math.min(...xgaValues) : 0
const maxXga = xgaValues.length > 0 ? Math.max(...xgaValues) : 1
const diffScore = (tId: number) => {
  const xga = teamXga.get(tId) ?? 0
  if (maxXga === minXga) return 0.5
  return 1 - (xga - minXga) / (maxXga - minXga)
}
```

**Existing tier pattern** (lines 62–74):
```typescript
const n = xgaValues.length
const easyThreshScore = n >= 3
  ? 1 - ((xgaValues[Math.floor(n * 2 / 3)] ?? maxXga) - minXga) / (maxXga - minXga === 0 ? 1 : maxXga - minXga)
  : 0.33
const hardThreshScore = n >= 3
  ? 1 - ((xgaValues[Math.floor(n / 3)] ?? minXga) - minXga) / (maxXga - minXga === 0 ? 1 : maxXga - minXga)
  : 0.67
const tier = (score: number): DifficultyTier => {
  if (score >= hardThreshScore) return 'hard'
  if (score <= easyThreshScore) return 'easy'
  return 'medium'
}
```

**Existing upcoming-fixture build pattern** (lines 76–109): each upcoming fixture pushes a `ClubFormFixture` with `difficulty_score` + `difficulty_tier`. Extend BOTH home (lines 84–96) and away (lines 97–108) push blocks with the new `attacking_difficulty` and `defensive_difficulty` fields.

**Existing result-build loop** (lines 112–135): the per-team aggregation loop where the new ease fields are appended to each `ClubForm` row.

**NEW pattern to write — parallel `teamGoalsScored` + `defScore`** (insert after line 61, mirror of teamXga block):
```typescript
const OFFENSIVE_ROLLING = 3
const teamGoalsScored = new Map<number, number>()
for (const [tId, fxs] of teamFinished) {
  const scored = fxs.map(f =>
    f.team_h === tId ? (f.team_h_score ?? 0) : (f.team_a_score ?? 0)
  )
  const lastN = scored.slice(-OFFENSIVE_ROLLING)
  teamGoalsScored.set(tId, lastN.length > 0 ? lastN.reduce((a, b) => a + b, 0) / lastN.length : 0)
}
const xgsValues = [...teamGoalsScored.values()].sort((a, b) => a - b)
const minXgs = xgsValues.length > 0 ? Math.min(...xgsValues) : 0
const maxXgs = xgsValues.length > 0 ? Math.max(...xgsValues) : 1
// NOT inverted — high goals scored = HIGH difficulty for opponent's defenders
const defScore = (tId: number) => {
  const xgs = teamGoalsScored.get(tId) ?? 0
  if (maxXgs === minXgs) return 0.5
  return (xgs - minXgs) / (maxXgs - minXgs)
}
```

**NEW pattern to write — `meanEase()` helper** (insert before the result loop or as a top-level function):
```typescript
function meanEase(
  fixtures: ClubFormFixture[],
  n: number,
  key: 'attacking_difficulty' | 'defensive_difficulty'
): number | null {
  const slice = fixtures.slice(0, n)
  const present = slice.filter(f => typeof f[key] === 'number')
  if (present.length === 0) return null
  const meanDifficulty = present.reduce((acc, f) => acc + (f[key] as number), 0) / present.length
  return 1 - meanDifficulty   // invert to ease so higher = easier
}
```

**NEW pattern — extend the result push** (line 126–134, in the per-team `for ... of teams` loop):
```typescript
result.push({
  team_id: tId,
  team_name: t.name,
  team_short_name: t.short_name,
  wins, draws, losses,
  goals_scored: gs,
  goals_conceded: gc,
  upcoming_fixtures: teamUpcoming.get(tId) ?? [],
  // NEW — six aggregates, null when window has zero fixtures (BGW handling)
  attacking_ease_1gw: meanEase(teamUpcoming.get(tId) ?? [], 1, 'attacking_difficulty'),
  attacking_ease_3gw: meanEase(teamUpcoming.get(tId) ?? [], 3, 'attacking_difficulty'),
  attacking_ease_5gw: meanEase(teamUpcoming.get(tId) ?? [], 5, 'attacking_difficulty'),
  defensive_ease_1gw: meanEase(teamUpcoming.get(tId) ?? [], 1, 'defensive_difficulty'),
  defensive_ease_3gw: meanEase(teamUpcoming.get(tId) ?? [], 3, 'defensive_difficulty'),
  defensive_ease_5gw: meanEase(teamUpcoming.get(tId) ?? [], 5, 'defensive_difficulty'),
})
```

**Naming convention reminder:** pipeline emits `*_difficulty` (0=easy, 1=hard). The aggregate exposed in `ClubForm` is `*_ease` (1=easy, 0=hard) — converted at the aggregation step via `1 - meanDifficulty`. JSDoc this on the type.

---

### `src/lib/types.ts` — MODIFIED

**Analog:** self. Three interface extensions, all backwards-compatible (new fields, no renames).

**Existing `FixtureEntry`** (lines 76–82) — add two optional fields (optional during pipeline rollout, becomes required after pipeline regen):
```typescript
export interface FixtureEntry {
  opponent_team: string
  is_home: boolean
  event_id: number
  difficulty_score: number       // existing — DO NOT REMOVE
  difficulty_tier: DifficultyTier
  attacking_difficulty?: number  // NEW — same value as difficulty_score
  defensive_difficulty?: number  // NEW — from goals-scored 3-game window
}
```

**Existing `ClubFormFixture`** (lines 175–181) — same shape extension, but **required** (computed locally by `computeClubForm`, never optional):
```typescript
export interface ClubFormFixture {
  opponent_team: string
  is_home: boolean
  event_id: number
  difficulty_score: number
  difficulty_tier: DifficultyTier
  attacking_difficulty: number   // NEW — populated by computeClubForm, always present
  defensive_difficulty: number
}
```

**Existing `ClubForm`** (lines 184–194) — add six aggregate fields, all `number | null` to handle BGW:
```typescript
export interface ClubForm {
  team_id: number
  team_name: string
  team_short_name: string
  wins: number
  draws: number
  losses: number
  goals_scored: number
  goals_conceded: number
  upcoming_fixtures: ClubFormFixture[]
  // NEW — per-team ease aggregates (null when team has 0 fixtures in window — BGW)
  // 1.0 = easiest, 0.0 = hardest
  attacking_ease_1gw: number | null
  attacking_ease_3gw: number | null
  attacking_ease_5gw: number | null
  defensive_ease_1gw: number | null
  defensive_ease_3gw: number | null
  defensive_ease_5gw: number | null
}
```

**Existing convention to preserve:** Phase-marker comments (e.g. `// (D-01)`, `// FFA-03`) appear throughout types.ts. New fields should reference Phase 27 / DATA-01 / FIX-01 in JSDoc.

---

### `src/app/page.tsx` — MODIFIED

**Analog:** self — line 109 currently mounts `{activeTab === 'club-form' && <ClubFormTable />}`.

**Existing tab-content pattern** (lines 105–112):
```tsx
{/* Tab content */}
{activeTab === 'gems' && <GemTable />}
{activeTab === 'defcon' && <DefConTables />}
{activeTab === 'squad' && <TransferPanel />}
{activeTab === 'club-form' && <ClubFormTable />}
{activeTab === 'set-pieces' && <SetPieceTakerPanel />}
```

**NEW pattern — wrap the club-form branch with the new panel above** (replace line 109):
```tsx
{activeTab === 'club-form' && (
  <>
    <FixtureEaseRankingPanel />
    <ClubFormTable />
  </>
)}
```

**Import to add** (alongside line 7):
```typescript
import { FixtureEaseRankingPanel } from '@/components/club-form/FixtureEaseRankingPanel'
```

---

### `src/components/club-form/FixtureEaseRankingPanel.tsx` (NEW)

**Analogs (composite):**
- `src/components/gem-table/GemTable.tsx` — toggle layout in sticky header (lines 116–124), `usePlayers` -> `useClubForm` substitution, mobile detection effect (lines 54–68).
- `src/components/club-form/ClubFormTable.tsx` — hook usage, load/error states, mobile pattern (the simpler version).

**Imports pattern** (mirror `ClubFormTable.tsx` lines 1–14, simplified — no react-table needed since this is a `<ul>` not a sortable table):
```typescript
'use client'

import { useState, useEffect } from 'react'
import { useClubForm } from '@/lib/hooks/useClubForm'
import { GwToggle } from '@/components/gem-table/GwToggle'   // REUSED as-is
import { AttDefToggle } from './AttDefToggle'                 // NEW
import { EaseBar } from './EaseBar'                           // NEW
```
Note: the `getColumnVisibility` export from `GwToggle.tsx` is for table use only — ignore it here. Importing `GwToggle` named export alone is fine (verified A3 in research).

**Hook + load/error pattern** (verbatim from `ClubFormTable.tsx` lines 17 + 44–54):
```typescript
const { data, isLoading, error } = useClubForm()

if (isLoading) {
  return <p className="text-gray-500">Loading club form...</p>
}
if (error) {
  return (
    <p className="text-red-500">
      Failed to load club form: {error instanceof Error ? error.message : String(error)}
    </p>
  )
}
```
**Match the existing copy and class strings** so the panel is visually consistent with the table below.

**Mobile detection pattern** (verbatim from `ClubFormTable.tsx` lines 19–25):
```typescript
const [isMobile, setIsMobile] = useState(false)
useEffect(() => {
  const check = () => setIsMobile(window.innerWidth < 640)
  check()
  window.addEventListener('resize', check)
  return () => window.removeEventListener('resize', check)
}, [])
```

**Toggle header layout** (mirror `GemTable.tsx` lines 119–122 — `flex justify-between` row with toggles on the right):
```tsx
<div className="flex items-center justify-between mb-3 flex-wrap gap-2">
  <h2 className="text-xl font-bold">Fixture Ease Ranking</h2>
  <div className="flex gap-2 items-center">
    <AttDefToggle value={mode} onChange={setMode} />
    <GwToggle value={window} onChange={setWindow} />
  </div>
</div>
```
Note: `ClubFormTable.tsx` uses `text-xl font-bold mb-4` for its `<h2>` (line 58). Mirror that exactly so the two headings align visually.

**State pattern (panel-scoped — Pitfall #5 in research):**
```typescript
type Window = 1 | 3 | 5
type Mode = 'ATT' | 'DEF'

const [window, setWindow] = useState<Window>(3)   // default 3GW (matches GemTable horizon=1; pick per UX)
const [mode, setMode] = useState<Mode>('ATT')     // D-09: ATT default
```
**Critical:** state lives ONLY in this component. Do NOT lift to parent. Do NOT pass to `ClubFormTable`.

**Sort + filter pattern** (BGW handling per Pitfall #2 — filter null teams):
```typescript
const key = `${mode === 'ATT' ? 'attacking' : 'defensive'}_ease_${window}gw` as const
const ranked = [...(data ?? [])]
  .filter(t => t[key] != null)
  .sort((a, b) => (b[key] as number) - (a[key] as number))   // easiest first (descending ease)
```

**Render pattern** — `<ul>` of 20 rows; each row passes ease value into `<EaseBar>`:
```tsx
<section className="mb-6">
  {/* header from above */}
  <ul className="space-y-1">
    {ranked.map((team, i) => (
      <li key={team.team_id} className="flex items-center gap-2 text-sm">
        <span className="w-6 text-right text-zinc-500">{i + 1}</span>
        <span className="w-12 font-mono">{team.team_short_name}</span>
        <EaseBar ease={team[key] as number} />
        <span className="w-10 text-right text-xs text-zinc-500">
          {((team[key] as number) * 100).toFixed(0)}
        </span>
      </li>
    ))}
  </ul>
</section>
```

**Mobile responsiveness:** match `ClubFormTable`'s `< 640px` breakpoint. Consider narrowing rank/short-name columns or hiding the percentage label on mobile.

---

### `src/components/club-form/AttDefToggle.tsx` (NEW)

**Analog:** `src/components/gem-table/GwToggle.tsx` — **mirror its structure verbatim** (Pattern 3 in research). Same wrapper div, same button styling, same `aria-pressed`, same `min-h-[44px]`.

**Imports + props pattern** (mirror `GwToggle.tsx` lines 35–38):
```typescript
'use client'

interface Props {
  value: 'ATT' | 'DEF'
  onChange: (v: 'ATT' | 'DEF') => void
}
```

**Component pattern** (mirror `GwToggle.tsx` lines 40–63 — same wrapper classes, same button classes verbatim):
```tsx
export function AttDefToggle({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Fixture ease position view"
      className="flex rounded overflow-hidden border border-zinc-300 dark:border-zinc-600"
    >
      {(['ATT', 'DEF'] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          aria-pressed={value === m}
          className={`px-3 py-2.5 sm:py-1 text-sm font-medium transition-colors cursor-pointer active:scale-95 transition-transform min-h-[44px] ${
            value === m
              ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
              : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700'
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  )
}
```

**Why mirror exactly:** the two pills (`AttDefToggle` and `GwToggle`) sit next to each other in the panel header — any deviation in padding/border/radius shows up immediately as visual inconsistency.

**Why NOT mirror `PositionFilter.tsx`:** `PositionFilter` uses `gap-2` between separate buttons with `bg-blue-600` for active state. `GwToggle` uses a single bordered "rounded overflow-hidden" wrapper with monochrome active state. The phase decision (D-07) explicitly says "same pill-toggle style as the existing 1GW/3GW/5GW toggle" — that's `GwToggle`, not `PositionFilter`.

---

### `src/components/club-form/EaseBar.tsx` (NEW)

**Analog:** `src/components/fixtures/FixtureBadges.tsx` — color palette source (lines 5–9).

**Existing color palette to reuse** (`FixtureBadges.tsx` lines 5–9):
```typescript
const TIER_COLOURS: Record<string, string> = {
  easy:   'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700',
  medium: 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700',
  hard:   'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700',
}
```

**Recommendation per research §"Don't Hand-Roll":** extract a stripped-down `TIER_BG` (just background classes) into a shared module `src/lib/difficulty-colors.ts` and have BOTH `FixtureBadges` and `EaseBar` import from it. This is the "single source of truth" pattern called out in research Pattern 4. **However**, this is a small refactor — confirm with planner whether to do it in this phase or keep palette duplicated for now.

**Component pattern** (NEW — small presentational, mirrors `FixtureBadges.tsx` style of inline tier->class mapping):
```typescript
'use client'

import type { DifficultyTier } from '@/lib/types'

const TIER_BG: Record<DifficultyTier, string> = {
  easy:   'bg-green-500',
  medium: 'bg-amber-500',
  hard:   'bg-red-500',
}

function tierFromEase(ease: number): DifficultyTier {
  if (ease >= 0.66) return 'easy'
  if (ease <= 0.33) return 'hard'
  return 'medium'
}

interface Props {
  ease: number   // 0.0 = hardest, 1.0 = easiest
}

export function EaseBar({ ease }: Props) {
  const tier = tierFromEase(ease)
  return (
    <div
      className="flex-1 h-3 bg-zinc-100 dark:bg-zinc-800 rounded overflow-hidden"
      role="img"
      aria-label={`Ease ${(ease * 100).toFixed(0)}%`}
    >
      <div
        className={`h-full ${TIER_BG[tier]}`}
        style={{ width: `${ease * 100}%` }}
      />
    </div>
  )
}
```

**Pitfall #6 alignment:** the bar's WIDTH is continuous (proportional to ease) but its COLOR is discrete (tier-based). Both are derived from the same `ease` value via the same `tierFromEase()` function — no conflicting encodings.

---

### `tests/lib/club-form.test.ts` — MODIFIED

**Analog:** self — extend existing vitest spec.

**Imports pattern** (lines 1–2):
```typescript
import { describe, it, expect } from 'vitest'
import { computeClubForm } from '@/lib/club-form'
```

**Existing fixture-builder pattern** (lines 4–26): `bootstrap` constant + `makeFixtures()` factory returning a hand-built fixtures array with both finished and upcoming entries. Reuse this exact pattern for new tests; extend `makeFixtures()` if a BGW scenario needs an additional team-with-no-upcoming case.

**Existing assertion pattern** (lines 92–103 — closest to new tests):
```typescript
it('upcoming fixtures are populated with opponent, is_home, difficulty_tier', () => {
  const result = computeClubForm(bootstrap, makeFixtures())
  const ars = result.find(r => r.team_id === 1)!
  expect(ars.upcoming_fixtures.length).toBeGreaterThan(0)
  for (const f of ars.upcoming_fixtures) {
    expect(f.opponent_team).toBeTruthy()
    expect(typeof f.is_home).toBe('boolean')
    expect(['easy', 'medium', 'hard']).toContain(f.difficulty_tier)
    expect(f.event_id).toBeGreaterThan(0)
  }
})
```

**Existing direction-of-difficulty assertion pattern** (lines 105–133 — closest analog for the inversion-direction test on `defensive_difficulty`):
```typescript
it('assigns difficulty tier correctly — strong team is hard, weak team is easy', () => {
  const result = computeClubForm(bootstrap, makeFixtures())
  const ars = result.find(r => r.team_id === 1)!
  const vsBur = ars.upcoming_fixtures.find(f => f.opponent_team === 'BUR')
  // ... directional assertions
  expect(vsBur!.difficulty_score).toBeLessThan(0.5)
})
```
**Mirror this exactly** for the FDR++ direction tests — particularly Assumption A1: "high goals-scored opponent yields LOW defensive_ease (hard to keep CS)".

**NEW test cases to add** (per research §Wave 0 Gaps, all using the existing `describe('computeClubForm')` block):
1. `'FDR++ — emits attacking_difficulty and defensive_difficulty per upcoming fixture'`
2. `'FDR++ — defensive_difficulty uses 3-game goals-scored window (not 6)'` — requires hand-crafted fixtures where 3-game and 6-game means diverge.
3. `'FDR++ — ease arrays present for 1GW/3GW/5GW windows on each ClubForm row'`
4. `'FDR++ — BGW: team with no upcoming fixture in window returns null ease'`
5. `'FDR++ — high-scoring opponent yields low defensive_ease (hard to keep CS)'` — direction test.

---

### `tests/components/club-form/FixtureEaseRankingPanel.test.tsx` (NEW)

**Analog:** **NONE.** See "No Analog Found" section below.

---

## Shared Patterns

### 1. Mirror Pipeline Math in TypeScript

**Source:** `pipeline/merge.py` ↔ `src/lib/club-form.ts` (existing parallel implementations of `_compute_difficulty_score` and `diffScore`).

**Why:** `src/app/api/club-form/route.ts` lines 26–32 reads `fpl_fixtures.json` + `fpl_bootstrap.json` directly — NOT `merged_players.json`. So `computeClubForm()` must independently re-derive any new fixture-difficulty fields from raw fixtures. The two files MUST stay in sync.

**Apply to:** `pipeline/merge.py` and `src/lib/club-form.ts` — must be edited as a pair in the same plan task. Both files declare `ROLLING_WINDOW = 6` / `ROLLING = 6` independently; both must declare `OFFENSIVE_ROLLING = 3` independently.

### 2. Independent Normalization

**Source:** `pipeline/merge.py` `_compute_difficulty_score()` lines 14–22 + the per-team min/max loop at lines 220–229.

**Apply to:** Both `attacking_difficulty` (uses xga min/max — unchanged from existing) and `defensive_difficulty` (uses xgs min/max — independent). NEVER share min/max across the two metrics. NEVER combine them numerically (Pitfall #3).

### 3. Tier Color Palette Reuse

**Source:** `src/components/fixtures/FixtureBadges.tsx` lines 5–9 — the `TIER_COLOURS` constant.

**Apply to:** `EaseBar.tsx` (background colors), and any other Phase 27 visualization. Do NOT invent new green/amber/red shades.

### 4. Mobile Breakpoint Convention

**Source:** `src/components/club-form/ClubFormTable.tsx` lines 19–25 (`window.innerWidth < 640`) + `src/components/gem-table/GemTable.tsx` lines 54–68 (resize + orientationchange listeners).

**Apply to:** `FixtureEaseRankingPanel.tsx` — match `< 640px` exactly. Do NOT use Tailwind `md:` (768px) — would create misaligned layouts (Pitfall #7).

### 5. React Query Hook Reuse

**Source:** `src/lib/hooks/useClubForm.ts` — `useQuery({ queryKey: ['club-form'], staleTime: 6h })`.

**Apply to:** `FixtureEaseRankingPanel.tsx` calls `useClubForm()` — does NOT create a new hook or new route. The existing 6h cache is shared with `ClubFormTable`, so toggling between them is free.

### 6. Pill Toggle Wrapper Style

**Source:** `src/components/gem-table/GwToggle.tsx` lines 41–62 — `flex rounded overflow-hidden border border-zinc-300 dark:border-zinc-600` wrapper, `min-h-[44px]` mobile tap target, monochrome active state (`bg-zinc-900 dark:bg-white`).

**Apply to:** `AttDefToggle.tsx` — mirror byte-for-byte except for the option labels (`ATT`/`DEF` vs `1 GW`/`3 GW`/`5 GW`). NOT applicable to `PositionFilter.tsx` style (which uses gap-separated `bg-blue-600` buttons).

### 7. State Scoping Discipline

**Source:** Decision D-10 + Pitfall #5.

**Apply to:** `FixtureEaseRankingPanel.tsx` — `useState` for `window` and `mode` lives INSIDE the component. Do NOT lift to `page.tsx`. Do NOT pass to `ClubFormTable`. The state must be invisible to siblings.

---

## No Analog Found

| File | Role | Data Flow | Reason | Recommended Action |
|------|------|-----------|--------|---------------------|
| `tests/components/club-form/FixtureEaseRankingPanel.test.tsx` | component test | n/a | **No `.test.tsx` files exist in the repo.** `tests/` has only `.test.ts` files (verified via Glob). `vitest.config.ts` line 7 sets `environment: 'node'` — there is no jsdom/happy-dom configured. `package.json` has no `@testing-library/react`, no `@testing-library/jest-dom`. | **Wave 0 tooling decision required by planner:** either (a) add `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` (or `happy-dom`) as devDependencies + add a `vitest.config.tsx` per-project override to set `environment: 'jsdom'` for `**/*.test.tsx`, OR (b) defer component tests for this phase and rely on the manual visual smoke check in `27-VALIDATION.md` + the unit tests in `tests/lib/club-form.test.ts` for ease-array correctness. Research §Wave 0 Gaps flagged this exact issue. |

---

## Metadata

**Analog search scope:**
- `pipeline/merge.py` (full file, 428 lines)
- `src/lib/club-form.ts` (full file, 138 lines)
- `src/lib/types.ts` (full file, 279 lines)
- `src/lib/hooks/useClubForm.ts` (full file)
- `src/app/page.tsx` (full file, 118 lines)
- `src/app/api/club-form/route.ts` (full file)
- `src/components/club-form/ClubFormTable.tsx` (full file, 103 lines)
- `src/components/club-form/columns.tsx` (full file, 29 lines)
- `src/components/gem-table/GwToggle.tsx` (full file, 64 lines)
- `src/components/gem-table/GemTable.tsx` (lines 1–130)
- `src/components/gem-table/PositionFilter.tsx` (full file, 37 lines — verified non-match for ATT/DEF)
- `src/components/fixtures/FixtureBadges.tsx` (full file, 39 lines)
- `tests/lib/club-form.test.ts` (full file, 134 lines)
- `tests/components/planner/plan-helpers.test.ts` (header — confirmed `.test.ts` not `.test.tsx`)
- `vitest.config.ts` + `package.json` (tooling check)

**Files scanned:** 15

**Pattern extraction date:** 2026-04-28
