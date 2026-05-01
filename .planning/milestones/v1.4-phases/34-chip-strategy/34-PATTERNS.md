# Phase 34: Chip Strategy - Pattern Map

**Mapped:** 2026-04-28
**Files analyzed:** 4 new files + 1 modified file
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/chip-strategy-engine.ts` | utility (pure scoring) | transform | `src/lib/planning-engine.ts` | role-match (same pure-function module shape, greedy scoring logic) |
| `src/lib/hooks/useChipHistory.ts` | hook | request-response | `src/lib/hooks/useSquad.ts` | exact (same shape: teamId param, `enabled: !!teamId`, `retry: 1`) |
| `src/components/planner/ChipStrategyPanel.tsx` | component | request-response + transform | `src/components/captaincy/CaptainPicksPanel.tsx` + `src/components/club-form/FixtureEaseRankingPanel.tsx` | role-match (always-expanded panel + expand-on-click row) |
| `src/components/planner/ChipStrategyPanel.test.tsx` | test | — | `src/components/insights/InsightsTab.test.tsx` | exact (same jsdom + vi.mock + render pattern) |
| `src/lib/chip-strategy-engine.test.ts` | test | — | `src/lib/squad-adapter.test.ts` + `src/lib/__tests__/planning-engine-rescore.test.ts` | exact (pure-function unit test with describe/it/expect) |
| `src/components/planner/PlannerTab.tsx` *(modified)* | component | request-response | self | — (add ChipStrategyPanel mount + prop forwarding) |

---

## Pattern Assignments

### `src/lib/chip-strategy-engine.ts` (utility, transform)

**Analog:** `src/lib/planning-engine.ts`

**Imports pattern** (`planning-engine.ts` lines 1–3):
```typescript
import type { ScoredPlayer, FTState, PlannerHorizon, PlanResult, PlanStep, ScoredTransfer } from './types'
import type { SquadPick } from './squad-adapter'
import { computeHitCost, computeNextFTState, snapshotSquad } from './free-transfer-engine'
```
New file imports pattern (adapt from the above):
```typescript
import type { ScoredPlayer, ClubForm, ClubFormFixture } from './types'
import type { SquadPick } from './squad-adapter'
```

**Module-level constant pattern** (`planning-engine.ts` lines 9–10):
```typescript
const LOOK_AHEAD_DISCOUNT = 0.8
const CANDIDATES_PER_POSITION = 20
```
Replicate this style for any engine-level constants (e.g. `BGW_NEUTRAL_EASE = 0.5`, `TC_CANDIDATE_COUNT = 3`).

**Pure-function JSDoc pattern** (`planning-engine.ts` lines 29–42):
```typescript
/**
 * Generate a multi-gameweek transfer plan using a greedy + 1-level look-ahead algorithm.
 *
 * Pure function — no hooks, no side effects.
 *
 * @param picks         Squad picks (positions 1-11 = starting XI, 12-15 = bench)
 * @param allPlayers    All scored players (used as candidate pool)
 * ...
 */
export function generatePlan(
  picks: SquadPick[],
  allPlayers: ScoredPlayer[],
  ...
```
All three exported scorers (`computeBBScore`, `computeTCScore`, `computeFHResult`) must be pure functions with a JSDoc block following this pattern.

**Player map build pattern** (`planning-engine.ts` lines 53–54):
```typescript
const playerMap = new Map<number, ScoredPlayer>(allPlayers.map(p => [p.id, p]))
```
Use identically in each scorer that needs per-player lookup by ID.

**Greedy candidate loop pattern** (`planning-engine.ts` lines 261–280) — adapt for FH squad construction:
```typescript
for (const sellId of startingXIIds) {
  const sellPlayer = playerMap.get(sellId)
  if (!sellPlayer) continue
  const sellPrice = sellPrices?.[sellId] ?? sellPlayer.now_cost
  const budget = bank + sellPrice

  const candidates = allPlayers
    .filter(p => p.element_type === sellPlayer.element_type && !squadSet.has(p.id))
    .sort((a, b) => b.gem_score - a.gem_score)
    .slice(0, CANDIDATES_PER_POSITION)

  for (const buy of candidates) {
    if (buy.now_cost > budget) continue
    const gain =
      buy.proj_pts_1gw * fixtureCountForGw(buy, targetGw) -
      sellPlayer.proj_pts_1gw * fixtureCountForGw(sellPlayer, targetGw)
    if (gain > bestGain) { ... }
  }
}
```
For `computeFHResult`, replace iterative sell→buy with direct descending sort over all players, filtered per position quota and team cap — but the `now_cost > budget` guard and `Map<number, ScoredPlayer>` lookup patterns are identical.

**ClubForm type reference** (`src/lib/types.ts` lines 211–219, 222–241):
```typescript
export interface ClubFormFixture {
  opponent_team: string
  is_home: boolean
  event_id: number           // <-- match by event_id, NOT array index (anti-pattern)
  difficulty_score: number
  difficulty_tier: DifficultyTier
  attacking_difficulty: number   // 0.0 = easiest, 1.0 = hardest
  defensive_difficulty: number
}

export interface ClubForm {
  team_id: number
  ...
  upcoming_fixtures: ClubFormFixture[]   // next 5
  attacking_ease_1gw: number | null
  ...
}
```
`ease = 1 - attacking_difficulty` — always invert before returning from scorers. BGW fixture lookup (`find(f => f.event_id === targetGw)`) returns `undefined` — apply fallback `BGW_NEUTRAL_EASE = 0.5`.

---

### `src/lib/hooks/useChipHistory.ts` (hook, request-response)

**Analog:** `src/lib/hooks/useSquad.ts`

**Full analog** (`useSquad.ts` lines 1–21):
```typescript
import { useQuery } from '@tanstack/react-query'
import type { SquadPicksResponse } from '@/lib/squad-adapter'

async function fetchSquad(teamId: string): Promise<SquadPicksResponse> {
  const res = await fetch(`/api/squad/${teamId}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Squad fetch failed: ${res.status}`)
  }
  return res.json()
}

export function useSquad(teamId: string | null) {
  return useQuery<SquadPicksResponse>({
    queryKey: ['squad', teamId],
    queryFn: () => fetchSquad(teamId!),
    enabled: !!teamId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  })
}
```
`useChipHistory` copies this verbatim, substituting:
- URL: `/api/fpl/entry/${teamId}/history/`
- Return type: `ChipHistoryEntry[]` (extract `data.chips ?? []` from response body)
- `queryKey`: `['chip-history', teamId]`
- `staleTime`: `1000 * 60 * 60 * 6` (6 h — chip usage changes rarely)
- `enabled`: `!!teamId && /^\d+$/.test(teamId)` (adds numeric validation per Security Domain)
- `retry: 1` — keep identical

**FPL proxy route** (`src/app/api/fpl/[...proxy]/route.ts` lines 1–42): the proxy forwards `entry/{id}/history/` without any modification. No new route file needed.

---

### `src/components/planner/ChipStrategyPanel.tsx` (component, request-response + transform)

**Analog 1 — panel shell:** `src/components/captaincy/CaptainPicksPanel.tsx`

**Loading/error/null guard pattern** (`CaptainPicksPanel.tsx` lines 52–71):
```typescript
export function CaptainPicksPanel() {
  const { data, isLoading, error } = useCaptainPicks()

  if (isLoading) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
        Loading captain picks…
      </p>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400 py-4">
        Failed to load captain picks. Check the pipeline output and refresh.
      </p>
    )
  }

  if (!data) return null
  ...
}
```
Apply identically for `chipHistory` loading/error states in `ChipStrategyPanel`. Use `isLoading` / `error` from `useChipHistory` as the gate; other data (players, squad, clubForm) are assumed loaded by PlannerTab context.

**Section heading pattern** (`CaptainPicksPanel.tsx` lines 76–81):
```typescript
return (
  <section className="mt-6 space-y-3">
    <div className="space-y-1">
      <h2 className="text-lg font-semibold">Captain Picks — GW {data.gameweek ?? '—'}</h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Ceiling = chase rank. EO-Adjusted = protect rank.
      </p>
    </div>
    ...
  </section>
)
```
Replicate `<section>` wrapper with `mt-6 space-y-3` for `ChipStrategyPanel`.

**Chip label source** (`src/components/planner/plan-helpers.ts` lines 21–26):
```typescript
export const CHIP_LABELS: Record<string, string> = {
  wildcard: 'Wildcard',
  freehit: 'Free Hit',
  bboost: 'Bench Boost',
  '3xc': 'Triple Captain',
}
```
Import and use `CHIP_LABELS['bboost']`, `CHIP_LABELS['3xc']`, `CHIP_LABELS['freehit']` for chip row headings. No new chip label constants.

**Analog 2 — expand-on-click row:** `src/components/club-form/FixtureEaseRankingPanel.tsx`

**Expand state pattern** (`FixtureEaseRankingPanel.tsx` lines 42, 84–86):
```typescript
const [expandedTeamId, setExpandedTeamId] = useState<number | null>(null)
...
const isExpanded = isTarget && expandedTeamId === team.team_id
```
For FH row, rename to `const [fhExpanded, setFhExpanded] = useState(false)` — binary toggle, not per-ID.

**Expand toggle with keyboard support** (`FixtureEaseRankingPanel.tsx` lines 93–113):
```typescript
<li
  ...
  onClick={() => setExpandedTeamId(expandedTeamId === team.team_id ? null : team.team_id)}
  onKeyDown={(e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setExpandedTeamId(expandedTeamId === team.team_id ? null : team.team_id)
    }
  }}
  tabIndex={0}
  role="button"
  style={{ cursor: 'pointer' }}
>
```
Apply identically to the FH chip row, with `aria-expanded={fhExpanded}`.

**Expanded inline content wrapper** (`FixtureEaseRankingPanel.tsx` lines 136–200):
```tsx
{isExpanded && (
  <li className="mt-1 mb-2 pl-8 bg-zinc-50 dark:bg-zinc-800 rounded list-none">
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
            <th className="py-1 pr-3 text-left w-28">Player</th>
            ...
          </tr>
        </thead>
        <tbody>
          {topPlayers.map((p) => (
            <tr key={p.id} data-testid={`player-row-${p.id}`}>
              <td className="py-1 pr-3 font-semibold truncate max-w-[7rem]">{p.web_name}</td>
              ...
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </li>
)}
```
FHSquadTable reuses this exact pattern: `mt-1 mb-2 pl-8 bg-zinc-50 dark:bg-zinc-800 rounded list-none` wrapper, `w-full text-xs` table, `py-1 pr-3` cell padding. Columns: Player, Pos, xPts, Ease.

**useMemo pattern** (`PlannerTab.tsx` lines 35–38):
```typescript
const scoredPlayers = useMemo(
  () => computeAllGemScores(playersData ?? []),
  [playersData]
)
```
All three chip scorers are called via `useMemo` with this exact structure. Dependencies must be explicit (`[benchPicks, scoredPlayers, clubFormMap]` etc.).

**PlannerTab data available as props** (`PlannerTab.tsx` lines 44–49):
```typescript
const picks = myTeamData?.picks ?? squadData?.picks ?? null
const bankBalance =
  myTeamData?.entry_history?.bank ?? squadData?.entry_history?.bank ?? 0
const sellPrices = myTeamData?.picks
  ? Object.fromEntries(myTeamData.picks.map(p => [p.element, p.selling_price]))
  : undefined
```
`ChipStrategyPanel` receives `bankBalance`, `sellPrices`, `picks`, `scoredPlayers`, `clubFormData` as props from PlannerTab. PlannerTab already owns all these values — no new hooks needed inside the panel for those data sources.

**PlannerTab mount point** (`PlannerTab.tsx` lines 301–303):
```tsx
return (
  <div className="space-y-6">
    <div>
      <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
        Planning Horizon
      </h2>
```
`ChipStrategyPanel` mounts as the first child of `<div className="space-y-6">`, before the `<div>` containing `HorizonSelector`. No layout restructuring needed; `space-y-6` already provides separation.

---

### `src/components/planner/ChipStrategyPanel.test.tsx` (test, component)

**Analog:** `src/components/insights/InsightsTab.test.tsx`

**File header + vi.mock pattern** (`InsightsTab.test.tsx` lines 1–16):
```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('@/lib/hooks/useInsights', () => ({
  useInsights: vi.fn(),
}))

import { InsightsTab } from '@/components/insights/InsightsTab'
import { useInsights } from '@/lib/hooks/useInsights'

const mockedUseInsights = vi.mocked(useInsights)
```
Apply identically — mock `useChipHistory`, `usePlayers`, `useSquad`, `useClubForm` (all hooks consumed inside `ChipStrategyPanel`). Import after `vi.mock` calls. Use `vi.mocked(hook)` helpers.

**beforeEach reset pattern** (`InsightsTab.test.tsx` lines 18–20):
```typescript
beforeEach(() => {
  mockedUseInsights.mockReset()
})
```
Call `mockReset()` on all mocked hooks in `beforeEach`.

**Loading/error/data state test pattern** (`InsightsTab.test.tsx` lines 178–200):
```typescript
it('renders loading state with locked copy and Unicode ellipsis (INS-01)', () => {
  mockedUseInsights.mockReturnValue({
    data: undefined,
    isLoading: true,
    error: null,
  } as unknown as ReturnType<typeof useInsights>)
  const { container } = render(<InsightsTab />)
  expect(container.textContent).toContain('Loading insights…')
})

it('renders error state with locked copy (INS-01)', () => {
  mockedUseInsights.mockReturnValue({
    data: undefined,
    isLoading: false,
    error: new Error('boom'),
  } as unknown as ReturnType<typeof useInsights>)
  ...
})
```
Apply identical structure for chip loading/error states. Use `as unknown as ReturnType<typeof useChipHistory>` cast for partial mock shapes.

**data-testid querying pattern** (`InsightsTab.test.tsx` lines 84–98):
```typescript
const badge = container.querySelector('span[title]')
expect(badge?.textContent).toBe('HIGH')
expect(badge?.className).toContain('bg-green-100')
```
Use `container.querySelector('[data-testid="..."]')` for chip row, ease cells, and FH squad table. Assign `data-testid` props in the component to enable this.

---

### `src/lib/chip-strategy-engine.test.ts` (test, pure function)

**Analog:** `src/lib/squad-adapter.test.ts` + `src/lib/__tests__/planning-engine-rescore.test.ts`

**Pure function test structure** (`squad-adapter.test.ts` lines 1–6):
```typescript
import { describe, it, expect } from 'vitest'
import { MyTeamPickSchema, MyTeamResponseSchema, parseMyTeamResponse } from './squad-adapter'
```
No `vi.mock` needed — pure functions have no side effects. Import directly from `./chip-strategy-engine`.

**Fixture helper pattern** (`planning-engine-rescore.test.ts` lines 10–60):
```typescript
function makePlayer(overrides: Partial<ScoredPlayer> & { id: number; element_type: 1 | 2 | 3 | 4 }): ScoredPlayer {
  return {
    id: overrides.id,
    web_name: overrides.web_name ?? `Player${overrides.id}`,
    ...
    fixtures: overrides.fixtures ?? [
      { opponent_team: 'OPP', is_home: true, event_id: 30, difficulty_score: 0.3, difficulty_tier: 'easy' },
    ],
    proj_pts_1gw: overrides.proj_pts_1gw ?? 5.0,
    ...
  }
}
```
Define equivalent `makePlayer` and `makeClubForm` fixture builders that produce minimal valid objects. Tests call `computeBBScore(benchPicks, players, clubFormMap)` with synthetic inputs and assert deterministic outputs.

---

### `src/components/planner/PlannerTab.tsx` *(modified)*

**Mount location** (`PlannerTab.tsx` lines 301–309):
```tsx
return (
  <div className="space-y-6">
    {/* INSERT ChipStrategyPanel HERE — first child */}
    <div>
      <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
        Planning Horizon
      </h2>
      <HorizonSelector value={horizon} onChange={setHorizon} />
    </div>
```

**Props to forward** (`PlannerTab.tsx` lines 44–49 — already in scope):
```typescript
// These four are already derived in PlannerTab — pass as props:
bankBalance     // line 45-46
sellPrices      // line 47-49
picks           // line 44
scoredPlayers   // line 35-38
// Plus pass through:
// clubFormData — add useClubForm() call alongside the others (line 30-32 pattern)
// teamId       — already in scope (line 22-24)
```

---

## Shared Patterns

### Loading / error guard
**Source:** `src/components/captaincy/CaptainPicksPanel.tsx` lines 52–71
**Apply to:** `ChipStrategyPanel.tsx` (gate on `useChipHistory` result)
```typescript
if (isLoading) {
  return <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">Loading chip strategy…</p>
}
if (error) {
  return <p className="text-sm text-red-600 dark:text-red-400 py-4">Failed to load chip history. {error.message}</p>
}
```

### TanStack Query hook shape
**Source:** `src/lib/hooks/useSquad.ts` lines 13–21
**Apply to:** `src/lib/hooks/useChipHistory.ts`
```typescript
return useQuery<T>({
  queryKey: [...],
  queryFn: () => fetchFn(param!),
  enabled: !!param && /^\d+$/.test(param),
  staleTime: ...,
  retry: 1,
})
```

### useMemo wrapping pure functions
**Source:** `src/components/planner/PlannerTab.tsx` lines 35–38
**Apply to:** `ChipStrategyPanel.tsx` — all three `compute*` calls
```typescript
const bbScores = useMemo(
  () => computeBBScore(benchPicks, scoredPlayers, clubFormMap),
  [benchPicks, scoredPlayers, clubFormMap],
)
```

### Badge / label Tailwind tokens
**Source:** `src/components/club-form/FixtureEaseRankingPanel.tsx` lines 119–126
```typescript
className="inline-block text-xs font-normal rounded px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
```
**Apply to:** Used-chip "Used GW{N}" badge (use `bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400` for greyed-out state), and ease bar cell fill classes from `34-UI-SPEC.md`.

### Pure function module structure
**Source:** `src/lib/planning-engine.ts` lines 1–10
**Apply to:** `src/lib/chip-strategy-engine.ts`
- No imports of hooks, React, or side-effectful modules
- All exports are named pure functions or interface/type exports
- Constants block at top, before function definitions

---

## No Analog Found

All files have close codebase analogs. No entries needed.

---

## Metadata

**Analog search scope:** `src/lib/hooks/`, `src/lib/`, `src/components/planner/`, `src/components/captaincy/`, `src/components/club-form/`, `src/components/insights/`, `src/app/api/fpl/`
**Files scanned:** 11 source files read, 2 test files read
**Pattern extraction date:** 2026-04-28
