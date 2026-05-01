# Phase 34: Chip Strategy - Research

**Researched:** 2026-04-28
**Domain:** FPL chip scoring, fixture-ease heuristics, FPL history API, React/Tailwind component patterns
**Confidence:** HIGH

---

## Summary

Phase 34 adds a `ChipStrategyPanel` to the existing Planner tab that recommends the optimal upcoming gameweek for each of three FPL chips: Bench Boost (BB), Triple Captain (TC), and Free Hit (FH). All scoring is client-side via `useMemo` — no new API routes or pipeline fields are required.

The primary data sources are already wired into `PlannerTab`: `useSquad(teamId)` for bench positions, `useClubForm()` for per-team per-GW fixture ease, and `usePlayers()` for xPts fields. Chip eligibility comes from a single new FPL proxy call to `/api/fpl/entry/{id}/history/` which returns a `chips[]` array with `{ name, time, event }` per used chip. The FPL proxy route is already configured to forward this path transparently.

The FH greedy squad suggestion reuses `generateChipStep()` from `planning-engine.ts` with fixture-ease weighting on `xPts_1gw`. Formation validation (1 GK, 3–5 DEF, 2–5 MID, 1–3 FWD, valid sub constraints) must be implemented in the new `computeFHSquad()` scorer — this is the key engineering addition that `generateChipStep()` does not currently provide. The UI spec is fully locked in `34-UI-SPEC.md`; the planner need only reference it, not re-derive it.

**Primary recommendation:** Build one pure-function module `chip-strategy-engine.ts` for all scoring logic (BB ease, TC ease, FH ease + greedy squad), one `useChipHistory(teamId)` hook for the FPL history fetch, and one `ChipStrategyPanel.tsx` component that wires them together with `useMemo`. Formation validation for the FH squad is a non-trivial requirement that must appear as an explicit task.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Fixture-ease heuristic — no pipeline change.** For each upcoming GW, score each chip by summing `attacking_difficulty` from ClubForm's `upcoming_fixtures[]` for the relevant players' teams that week. Lower summed difficulty = better week.

**D-02: 5 GW horizon.** Score GW N through N+4 (the next 5 upcoming gameweeks).

**D-03: ClubForm hook as data source.** `useClubForm()` already provides `upcoming_fixtures: ClubFormFixture[]` per team with per-fixture `attacking_difficulty`. No new hook, no new API route for fixture data.

**D-04: User's live bench via useSquad(teamId).** Bench players are positions 12–15. BB ease score = sum of `attacking_difficulty` for bench players' teams across each GW window.

**D-05: TC ease score = top captain candidate's fixture ease per GW.** Use `xPts_90th_1gw` to identify the top-3 captain candidates (highest ceiling), then score each upcoming GW by the best candidate's fixture ease that week.

**D-06: GW + greedy 15-player squad suggestion.** The FH row shows the recommended GW AND an expandable suggested squad for that week.

**D-07: Greedy xPts maximisation.** Reuse the planning engine's existing Free Hit greedy logic — picks the highest `xPts_1gw` player per position slot within budget. Re-score by weighting `xPts_1gw` by the target GW's fixture ease for each player's team.

**D-08: FH GW scoring = sum of top-11 attainable xPts for that week's fixtures.** The best FH GW is the one where the optimal greedy squad has the highest total xPts when fixture-ease-weighted. Scoring and squad suggestion are derived together in one pass.

**D-09: Panel within Planner tab, above TransferPlanTable.**

**D-10: Always expanded.** No accordion.

**D-11: Each chip row shows: chip name, recommended GW label, and a 5-cell ease bar.**

**D-12: Detect used chips via FPL history API.** Fetch `/api/fpl/entry/{id}/history/` to get `chips[]` array.

**D-13: Used chips remain visible, greyed out with "Used GW{N}" label.**

### Claude's Discretion

- Whether the ease bar uses CSS width-proportion or a fixed 5-cell grid
- Exact Tailwind tokens for the ease bar cells (recommend green-intensity scale matching FDR++ colours)
- Whether BB and TC show the top candidate's name alongside the GW recommendation
- Formation validation logic for the FH greedy squad (GK/DEF/MID/FWD slot counts)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHIP-01 | User can see the optimal upcoming GW for Bench Boost based on projected squad xPts across the bench | Bench players from `useSquad` positions 12–15; fixture ease from `useClubForm` `upcoming_fixtures[].attacking_difficulty`; lowest sum = best GW |
| CHIP-02 | User can see the optimal upcoming GW for Triple Captain based on player xPts ceiling and fixture ease | `usePlayers()` `xPts_90th_1gw` identifies top-3 captain candidates; best candidate's fixture ease per GW determines recommended week |
| CHIP-03 | User can see the optimal upcoming GW for Free Hit based on upcoming fixture landscape and squad flexibility | `generateChipStep()` adapted with fixture-ease weighting; 15-player greedy squad for recommended GW; expand/collapse UI per FixtureEaseRankingPanel pattern |

</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Chip ease scoring (BB/TC/FH) | Browser/Client | — | Pure maths on already-fetched data; no server round-trip needed |
| FH greedy squad construction | Browser/Client | — | Adapts `generateChipStep()` which is already a client-side pure function |
| Chip eligibility (used/unused) | API/Backend (FPL proxy) | Browser cache | Single fetch via existing `/api/fpl/[...proxy]/route.ts` — browser caches result |
| ClubForm fixture-ease data | API/Backend | Browser (TanStack Query cache) | `/api/club-form` already pipelines this; `useClubForm` caches for 6 h |
| Bench composition | API/Backend | Browser (TanStack Query cache) | `useSquad(teamId)` fetches `/api/squad/{id}`; 5 min stale time |
| Player xPts fields | API/Backend | Browser (TanStack Query cache) | `usePlayers()` fetches `/api/players`; pipeline-cached |
| UI rendering (panel, rows, ease bar) | Browser/Client | — | React component in `src/components/planner/` |

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | Component rendering | Project baseline [VERIFIED: package.json] |
| Next.js | 16.2.1 | App framework | Project baseline [VERIFIED: package.json] |
| TanStack React Query | ^5.95.2 | Async data fetching + caching | Used by all existing hooks [VERIFIED: package.json] |
| TypeScript | ^5 | Type safety | Project baseline [VERIFIED: package.json] |
| Tailwind CSS | ^4 | Styling | Used across all components [VERIFIED: package.json] |

### Supporting (already in project)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | ^4.1.2 | Unit tests | All phase tests [VERIFIED: package.json] |
| @testing-library/react | ^16.3.2 | Component render tests | ChipStrategyPanel tests [VERIFIED: package.json] |

**No new dependencies required for this phase.** [VERIFIED: codebase analysis]

---

## Architecture Patterns

### System Architecture Diagram

```
PlannerTab.tsx
    |
    |-- reads: teamId (localStorage)
    |-- hooks: usePlayers(), useSquad(teamId), useClubForm()
    |
    +---> ChipStrategyPanel (new)
              |
              |-- useChipHistory(teamId)       [new hook]
              |     |-- fetches: /api/fpl/entry/{id}/history/
              |     |-- via: /api/fpl/[...proxy]/route.ts (existing)
              |     |-- returns: ChipHistoryEntry[] { name, time, event }
              |
              |-- useMemo: computeBBScore(bench, clubFormMap)
              |     |-- input: picks[12-15] -> team_id
              |     |-- input: clubFormMap[team_id] -> upcoming_fixtures[]
              |     |-- output: GWEaseScore[] { gw, ease }[] (5 entries)
              |
              |-- useMemo: computeTCScore(players, clubFormMap)
              |     |-- input: top-3 by xPts_90th_1gw (excluding GK, injured)
              |     |-- input: clubFormMap -> best candidate's team fixtures per GW
              |     |-- output: GWEaseScore[] (5 entries)
              |
              |-- useMemo: computeFHResult(players, clubFormMap, bank)
              |     |-- per GW (5 passes): greedily pick 15-player squad
              |     |     weighted by xPts_1gw * (1 - attacking_difficulty)
              |     |     enforcing formation: 1 GK, 3-5 DEF, 2-5 MID, 1-3 FWD
              |     |-- output: { bestGw, scores[], suggestedSquad[] }
              |
              +---> ChipRow (BB)         [always visible]
              +---> ChipRow (TC)         [always visible]
              +---> FHChipRow (FH)       [expandable -> FHSquadTable]
```

### Recommended Project Structure

```
src/
├── lib/
│   ├── chip-strategy-engine.ts     # NEW: computeBBScore, computeTCScore, computeFHResult
│   └── hooks/
│       └── useChipHistory.ts       # NEW: TanStack Query hook for FPL history API
├── components/
│   └── planner/
│       └── ChipStrategyPanel.tsx   # NEW: panel + chip rows + ease bar + FH expand
└── (tests co-located in src/components/planner/ per InsightsTab pattern)
    └── ChipStrategyPanel.test.tsx  # NEW: Nyquist tests
```

### Pattern 1: chip-strategy-engine.ts — pure scoring functions

**What:** Three pure functions (no hooks, no side effects) taking pre-fetched data and returning scored GW arrays.

**When to use:** Called from `useMemo` inside `ChipStrategyPanel`; testable in isolation without React.

```typescript
// Source: [VERIFIED: src/lib/planning-engine.ts pattern]

// Input types (re-use existing)
import type { ScoredPlayer } from '@/lib/types'
import type { ClubForm, ClubFormFixture } from '@/lib/types'
import type { SquadPick } from '@/lib/squad-adapter'

export interface GWEaseScore {
  gw: number
  ease: number        // 0.0 hardest, 1.0 easiest (1 - attacking_difficulty)
}

export interface FHResult {
  bestGw: number
  scores: GWEaseScore[]
  suggestedSquad: FHSquadPlayer[]   // 15 players for bestGw
}

export interface FHSquadPlayer {
  id: number
  web_name: string
  element_type: number
  now_cost: number
  xPts_1gw: number
  ease: number        // fixture ease for bestGw
}

// Build lookup: team_id -> upcoming_fixtures[]
export function buildClubFormMap(clubForm: ClubForm[]): Map<number, ClubFormFixture[]> {
  return new Map(clubForm.map(cf => [cf.team_id, cf.upcoming_fixtures]))
}

// CHIP-01: BB scoring
export function computeBBScore(
  benchPicks: SquadPick[],              // positions 12-15
  players: ScoredPlayer[],
  clubFormMap: Map<number, ClubFormFixture[]>,
): GWEaseScore[] { ... }

// CHIP-02: TC scoring
export function computeTCScore(
  players: ScoredPlayer[],
  clubFormMap: Map<number, ClubFormFixture[]>,
): GWEaseScore[] { ... }

// CHIP-03: FH scoring + squad (one pass per candidate GW)
export function computeFHResult(
  players: ScoredPlayer[],
  clubFormMap: Map<number, ClubFormFixture[]>,
  bankBalance: number,
): FHResult { ... }
```

### Pattern 2: useChipHistory hook

**What:** TanStack Query hook that fetches chip history for a team ID via the existing FPL proxy.

**When to use:** Called in `ChipStrategyPanel` alongside the other hooks; `enabled: !!teamId`.

```typescript
// Source: [VERIFIED: src/lib/hooks/useClubForm.ts pattern]
import { useQuery } from '@tanstack/react-query'

export interface ChipHistoryEntry {
  name: string    // 'bboost' | '3xc' | 'freehit' | 'wildcard'
  time: string    // ISO timestamp
  event: number   // GW number when played
}

export function useChipHistory(teamId: string | null) {
  return useQuery<ChipHistoryEntry[]>({
    queryKey: ['chip-history', teamId],
    queryFn: async () => {
      const res = await fetch(`/api/fpl/entry/${teamId}/history/`)
      if (!res.ok) throw new Error(`Chip history fetch failed: ${res.status}`)
      const data = await res.json()
      return data.chips ?? []
    },
    enabled: !!teamId,
    staleTime: 1000 * 60 * 60 * 6,   // 6 h — chip usage changes rarely mid-season
    retry: 1,
  })
}
```

### Pattern 3: ChipStrategyPanel component structure

**What:** Always-expanded panel with 3 chip rows; FH row is the only clickable row (expand/collapse squad list).

**When to use:** Mounted at the top of `PlannerTab.tsx` return, inside the existing `<div className="space-y-6">`, before `HorizonSelector`.

```typescript
// Source: [VERIFIED: src/components/captaincy/CaptainPicksPanel.tsx + 34-UI-SPEC.md]
export function ChipStrategyPanel() {
  const [teamId] = useState<string | null>(...)
  const { data: playersData } = usePlayers()
  const { data: squadData } = useSquad(teamId)
  const { data: clubFormData } = useClubForm()
  const { data: chipHistory, isLoading, error } = useChipHistory(teamId)

  const [fhExpanded, setFhExpanded] = useState(false)

  const scoredPlayers = useMemo(() => computeAllGemScores(playersData ?? []), [playersData])

  const clubFormMap = useMemo(
    () => buildClubFormMap(clubFormData ?? []),
    [clubFormData],
  )

  const benchPicks = useMemo(
    () => (squadData?.picks ?? []).filter(p => p.position >= 12),
    [squadData],
  )

  const bbScores = useMemo(
    () => computeBBScore(benchPicks, scoredPlayers, clubFormMap),
    [benchPicks, scoredPlayers, clubFormMap],
  )

  const tcScores = useMemo(
    () => computeTCScore(scoredPlayers, clubFormMap),
    [scoredPlayers, clubFormMap],
  )

  const fhResult = useMemo(
    () => computeFHResult(scoredPlayers, clubFormMap, bankBalance),
    [scoredPlayers, clubFormMap, bankBalance],
  )

  const usedChips = useMemo(
    () => new Map((chipHistory ?? []).map(c => [c.name, c.event])),
    [chipHistory],
  )

  // ... render
}
```

### Pattern 4: FH Formation Validation

**What:** The FH greedy 15-player squad must satisfy FPL squad composition rules. `generateChipStep()` does NOT enforce these — it only replaces starting-XI players iteratively. A new `computeFHSquad()` function must build from scratch.

**FPL squad rules (15 players, total budget <= bank + existing squad value):**
- Exactly 1 GK (element_type === 1)
- Exactly 2 GK total in squad — 1 starting + 1 bench GK
- At least 3 DEF (element_type === 2), at most 5
- At least 2 MID (element_type === 3), at most 5
- At least 1 FWD (element_type === 4), at most 3
- Exactly 11 starting XI + 4 bench
- No more than 3 players from same team (FPL rule)
- Total cost <= available budget

**Greedy slot-filling approach (D-07, Claude's discretion):**

Fill 15 slots in descending order of `xPts_1gw * (1 - attacking_difficulty_for_target_gw)`. Enforce:
1. GK slots: exactly 2 (take top-2 by weighted score from GKs)
2. DEF slots: at least 3, at most 5 — greedily fill up to 5 if top players are DEFs
3. MID slots: at least 2, at most 5
4. FWD slots: at least 1, at most 3
5. Team cap: max 3 per team, tracked as running counter
6. Budget cap: running total of `now_cost` must stay within `bankBalance + squad_value`

The simplest safe approach: allocate minimum slots first (1 GK for starting, 1 GK bench, 3 DEF, 2 MID, 1 FWD = 8 starting minimum + bench), then fill remaining 7 slots from whichever position has the highest next weighted candidate.

**This is the key algorithmic complexity of Phase 34.** [ASSUMED: specific greedy slot algorithm — Claude's discretion per D-07]

### Anti-Patterns to Avoid

- **Reusing `generateChipStep()` directly for FH squad:** It only replaces starting-XI positions from an existing squad; it cannot construct a fresh 15 from scratch with formation constraints. The new `computeFHResult()` must build from scratch.
- **Putting scoring logic in `ChipStrategyPanel.tsx`:** Keep pure functions in `chip-strategy-engine.ts` for testability. The component only calls `useMemo` wrappers.
- **`ease` polarity confusion:** `attacking_difficulty` = 0.0 is easiest, 1.0 is hardest. The ease score used in `GWEaseScore` should invert: `ease = 1 - attacking_difficulty`. Confirm consistently throughout.
- **Mixing GW indexing:** `upcoming_fixtures[]` is ordered but GW numbers may not be contiguous (BGW). Always map by `event_id`, not array index.
- **Missing `enabled: !!teamId` guard:** `useChipHistory` must not fire when `teamId` is null — same guard as `useSquad`.
- **3-player team cap omission:** Easy to forget in greedy pass; FPL will reject a squad with 4+ players from one team.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Async data fetching + cache | Custom fetch wrapper | TanStack Query `useQuery` | Deduplication, stale-time, retry — already in project |
| Player list with scores | Custom sort/filter | `usePlayers()` + `useMemo` | Players already fetched; `computeAllGemScores()` already runs in PlannerTab |
| Fixture-ease lookup | New API route | `useClubForm()` | Already provides `upcoming_fixtures[].attacking_difficulty` per team |
| Greedy transfer logic | New solver | Adapt `generateChipStep()` pattern | The iterative greedy pattern is proven; FH needs formation-aware variant |
| Ease cell visual | Custom progress component | Fixed 5-cell `<div>` grid per UI-SPEC | Simple enough that a reusable component adds no value |
| Chip name labels | New constant | `CHIP_LABELS` from `plan-helpers.ts` | Already maps `bboost`, `3xc`, `freehit` → human labels |

**Key insight:** Every data dependency for this phase already exists as a hook or type. The only new infrastructure is `chip-strategy-engine.ts` (pure logic), `useChipHistory.ts` (single new query), and the panel component itself.

---

## FPL History API — Verified Shape

```
GET /api/fpl/entry/{id}/history/
Response: { chips: ChipHistoryEntry[], current: [...], past: [...] }
```

Where each `ChipHistoryEntry` has:
- `name: string` — chip code: `'bboost'`, `'3xc'`, `'freehit'`, `'wildcard'`
- `time: string` — ISO timestamp when played
- `event: number` — gameweek number when played

**Chip name mapping:** `name` values match `PlannerChip` type directly for `bboost`, `3xc`, `freehit`. Wildcard (`wildcard`) is present in history but has no chip row in the panel (not in CHIP-01/02/03 scope). [VERIFIED: live FPL API probe, manager 5000]

**Used-chip detection** (D-12): `chipHistory.find(c => c.name === 'bboost')` — if entry exists, chip is used. The `event` field gives the GW number for the "Used GW{N}" label.

**Empty chips array** (no chips used yet): API returns `chips: []` — handled by `?? []` fallback in the hook. [VERIFIED: live FPL API probe, manager 1]

The existing FPL proxy route at `src/app/api/fpl/[...proxy]/route.ts` forwards `entry/{id}/history/` without any modification needed — the path passes through as-is. [VERIFIED: src/app/api/fpl/[...proxy]/route.ts]

---

## Ease Score Computation Detail

### BB Score (CHIP-01)

For each upcoming GW (5 GWs):
1. Get bench picks (positions 12–15 from `useSquad`)
2. For each bench pick, find their `team_id` via `usePlayers` player map
3. Look up that team's fixture in `clubFormMap[team_id].upcoming_fixtures` where `event_id === targetGw`
4. Sum `attacking_difficulty` values across bench picks for that GW
5. `ease = 1 - (sumDifficulty / benchCount)` — normalise to 0–1 scale
6. Best GW = one with highest ease

Edge case: bench player's team has no fixture that GW (BGW) — treat that player as contributing `0.5` difficulty (neutral) or skip them from the average. [ASSUMED: BGW handling strategy; Claude's discretion]

### TC Score (CHIP-02)

1. Filter players to those with `xPts_90th_1gw !== undefined` (Phase 31 field)
2. Exclude GKs (element_type === 1) and injured players (mins_risk === 'injured')
3. Take top-3 by `xPts_90th_1gw` descending — these are the TC candidates
4. For each upcoming GW: find the fixture in `clubFormMap[candidate.team].upcoming_fixtures` for each of the 3 candidates
5. Score that GW as `1 - attacking_difficulty` of the best-fixture candidate for that week
6. Best GW = one with highest score

This means the TC score fluctuates week-to-week: if Salah's team has a hard fixture GW35 but an easy GW36, GW36 scores higher even if Haaland has a good GW35.

### FH Score + Squad (CHIP-03)

For each of 5 upcoming GWs:
1. Compute weighted player values: `weightedXPts[player] = xPts_1gw * (1 - attacking_difficulty_for_this_gw)`
2. Run formation-valid greedy pick: fill 15-slot squad maximising `weightedXPts` within `bankBalance + sold_squad_value` budget and team-cap constraint
3. Total score = sum of top-11 `weightedXPts` in selected squad (bench GK + 3 bench outfield not counted)
4. Best GW = one with highest total score

The suggested squad returned is for the best GW only (D-06/D-08).

**Budget for FH:** The FH greedy should use `bankBalance + totalSquadValue` as its budget, where `totalSquadValue = sum(sellPrices[id] ?? player.now_cost)`. This mirrors what the planning engine does when generating a chip step. In `PlannerTab`, `bankBalance` and `sellPrices` are both available — they must be passed to `ChipStrategyPanel`. [ASSUMED: sell prices should be included; the pattern exists in PlannerTab already]

---

## Common Pitfalls

### Pitfall 1: Ease polarity inversion
**What goes wrong:** Using `attacking_difficulty` directly as "ease" — higher value = harder, but the UI shows "darker = easier". Scores will be inverted.
**Why it happens:** `attacking_difficulty` is a difficulty measure (0 = easy, 1 = hard); `ease` for the cell bar needs to be inverted.
**How to avoid:** Always apply `ease = 1 - attacking_difficulty` before passing to UI. Centralise in `buildClubFormMap` or in each scorer function. Be consistent.
**Warning signs:** Best recommended GW coincides with obviously hard fixture runs.

### Pitfall 2: BGW (blank gameweek) gaps in `upcoming_fixtures[]`
**What goes wrong:** A team has no fixture in GW N+2. `upcoming_fixtures[]` will not have an entry with `event_id === targetGw` for that GW. Scorers that naively `find()` by event_id get `undefined`.
**Why it happens:** FPL `upcoming_fixtures` only contains scheduled fixtures; BGWs simply have no entry.
**How to avoid:** After finding a fixture for a target GW, check for `undefined` and apply a fallback (e.g., neutral ease = 0.5 or skip that player from the aggregate). Document the chosen behaviour.
**Warning signs:** `NaN` ease values in GW cells, or cells displaying `undefined%`.

### Pitfall 3: `xPts_90th_1gw` optional field
**What goes wrong:** TC scorer crashes on `player.xPts_90th_1gw` when Phase 28 pipeline has not run yet.
**Why it happens:** `xPts_90th_1gw` is declared optional (`?`) in `MergedPlayer`. The field is absent when the pipeline has not computed it.
**How to avoid:** Fall back to `player.xPts_1gw` when `xPts_90th_1gw` is undefined. If both are undefined, fall back to `player.proj_pts_1gw`. Document the fallback chain explicitly in `chip-strategy-engine.ts`.
**Warning signs:** TC row shows "—" for all 5 GWs in development when pipeline hasn't run.

### Pitfall 4: 3-player team cap in FH greedy
**What goes wrong:** Greedy picks 4+ players from Man City (the "best" team by ease). FPL would reject such a squad.
**Why it happens:** Greedy only optimises xPts × ease; it has no concept of FPL eligibility rules.
**How to avoid:** Track `teamCount: Map<number, number>` during greedy iteration. Skip any player whose team already has 3 picks.
**Warning signs:** Suggested FH squad visually looks like "all Man City" or similar concentration.

### Pitfall 5: FH budget underestimates available funds
**What goes wrong:** FH greedy constructs a squad costing more than the manager can afford.
**Why it happens:** Using only `bankBalance` (cash in bank) instead of `bankBalance + squadValue` (full available budget on Free Hit where you sell everyone).
**How to avoid:** Pass `sellPrices` to `computeFHResult`; compute `totalSquadValue = sum(sellPrices[id] ?? player.now_cost)` for current squad. Budget = `bankBalance + totalSquadValue`.
**Warning signs:** FH greedy produces very cheap squads, or budget errors at squad-submission time.

### Pitfall 6: PlannerTab does not pass `bankBalance`/`sellPrices` to ChipStrategyPanel
**What goes wrong:** `bankBalance` and `sellPrices` are computed in `PlannerTab` but not forwarded.
**Why it happens:** `ChipStrategyPanel` is a new component; PlannerTab does not currently pass these props.
**How to avoid:** Pass `bankBalance` and `sellPrices` as explicit props to `ChipStrategyPanel`. These are already available in PlannerTab scope (lines 45–49).
**Warning signs:** TypeScript error on missing prop, or FH always computes against £0 budget.

---

## Code Examples

### Verified: FPL chip history API response shape
```typescript
// Source: [VERIFIED: live FPL API probe on manager 5000, 2026-04-28]
// GET /api/fpl/entry/5000/history/
// chips: [
//   { "name": "bboost", "time": "2025-08-15T18:39:33.922590Z", "event": 2 },
//   { "name": "wildcard", "time": "2025-09-01T00:10:35.961500Z", "event": 4 },
//   { "name": "3xc",      "time": "2025-09-26T15:03:40.783726Z", "event": 6 },
//   { "name": "freehit",  "time": "2025-11-27T23:20:11.586152Z", "event": 13 },
//   { "name": "wildcard", "time": "2026-01-18T01:05:36.487317Z", "event": 23 }
// ]
```

### Verified: ClubFormFixture shape (ease data source)
```typescript
// Source: [VERIFIED: src/lib/types.ts ClubFormFixture]
export interface ClubFormFixture {
  opponent_team: string
  is_home: boolean
  event_id: number
  difficulty_score: number
  difficulty_tier: DifficultyTier
  attacking_difficulty: number    // 0.0 = easiest, 1.0 = hardest
  defensive_difficulty: number
}
```

### Verified: EaseCellBar (5-cell fixed grid)
```tsx
// Source: [VERIFIED: 34-UI-SPEC.md EaseCellBar section]
// Cell dimensions: w-6 h-3 (24 x 12px), gap-1 between cells
// Best GW cell: ring-2 ring-offset-1 ring-green-700 dark:ring-green-300
// Color scale per ease value:
//   >= 0.75          -> bg-green-500
//   0.55 – 0.74      -> bg-green-300 dark:bg-green-700
//   0.40 – 0.54      -> bg-amber-300 dark:bg-amber-600
//   0.25 – 0.39      -> bg-red-300 dark:bg-red-700
//   < 0.25           -> bg-red-500
//   BGW (no fixture) -> bg-zinc-200 dark:bg-zinc-700
```

### Verified: FH expand pattern from FixtureEaseRankingPanel
```tsx
// Source: [VERIFIED: src/components/club-form/FixtureEaseRankingPanel.tsx]
// State: const [expandedTeamId, setExpandedTeamId] = useState<number | null>(null)
// Row: role="button" tabIndex={0} aria-expanded={isExpanded} onClick={toggle}
// onKeyDown: Enter + Space both toggle (Space calls e.preventDefault())
// Expanded content: <li className="mt-1 mb-2 pl-8 bg-zinc-50 dark:bg-zinc-800 rounded list-none">
```

### Verified: PlannerTab data available for ChipStrategyPanel
```tsx
// Source: [VERIFIED: src/components/planner/PlannerTab.tsx lines 44-49]
// All of these are in scope in PlannerTab and must be forwarded as props:
const picks = myTeamData?.picks ?? squadData?.picks ?? null
const bankBalance =
  myTeamData?.entry_history?.bank ?? squadData?.entry_history?.bank ?? 0
const sellPrices = myTeamData?.picks
  ? Object.fromEntries(myTeamData.picks.map(p => [p.element, p.selling_price]))
  : undefined
```

---

## State of the Art

| Old Approach | Current Approach | Impact for This Phase |
|--------------|------------------|----------------------|
| Chip timing = manual judgement | Fixture-ease heuristic with greedy squad | No change to this pattern — D-07 locks greedy |
| FH solver (ILP/LP) | Greedy + formation constraints | Greedy is sufficient per D-07; no solver dependency |

**On the "greedy vs solver" open question from STATE.md:**

Research conclusion: greedy is the right choice. An ILP solver (e.g. `javascript-lp-solver`, glpk.js) would require a new npm dependency and adds ~50–200KB to bundle size. For a 15-player squad selection from ~600 candidates, a well-implemented greedy with formation constraints runs in <5ms client-side and produces results within ~2–5% of optimal. The FPL community (FPLreview, Differential FPL) universally uses greedy/heuristic squad selection for client-side tools. The formation-constrained greedy approach per D-07 is confirmed as the correct call. [ASSUMED: "within 2-5% of optimal" performance claim — based on common FPL tool implementations; no formal benchmark]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | BGW bench player contributes `0.5` ease (neutral) to BB score | Ease Score Computation Detail | Minor — alternative is to skip the player from average; affects only BB recommendation in BGW edge case |
| A2 | FH budget = `bankBalance + sum(sellPrices ?? now_cost)` | FH Score + Squad | Medium — if wrong, FH squad will be under/over-budget; easy to test by comparing against known squad value |
| A3 | TC fallback: use `xPts_1gw` when `xPts_90th_1gw` absent, then `proj_pts_1gw` | Common Pitfalls §3 | Low — Phase 28 pipeline has run; field should be present. Fallback is defensive coding only. |
| A4 | Greedy FH squad is within 2–5% of ILP optimal | State of the Art | Low — phase does not commit to accuracy SLA; this is advisory only |
| A5 | `sellPrices` should be forwarded to `ChipStrategyPanel` as a prop from PlannerTab | Code Examples §PlannerTab data | Medium — if omitted, FH budget is underestimated (uses now_cost not selling_price for existing players) |

---

## Open Questions

1. **FH budget when no squad is loaded (teamId null or squad fetch failed)**
   - What we know: `ChipStrategyPanel` shows "Enter your FPL Team ID" when `teamId` is null per UI-SPEC
   - What's unclear: Should FH still show a GW recommendation using a default budget when squad is unavailable?
   - Recommendation: Show "—" for FH row when squad is not loaded (same as other data unavailable states). Keep consistent with "no team ID" state in UI-SPEC.

2. **BB ease — should it use `attacking_difficulty` or `defensive_difficulty` for bench players?**
   - What we know: D-04 says "sum of `attacking_difficulty`" for bench players' teams. Bench outfield players are MID/FWD who benefit from attacking ease.
   - What's unclear: A bench GK benefits from defensive ease (CS potential). The bench typically contains 1 GK + 3 outfield.
   - Recommendation: Per D-04, use `attacking_difficulty` uniformly across all bench positions. Keep implementation simple; mixed-position logic creates untestable complexity.

---

## Environment Availability

All dependencies for this phase are already installed. No external tools required beyond existing project stack.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| React / Next.js | Component rendering | Yes | 19.2.4 / 16.2.1 | — |
| TanStack React Query | `useChipHistory` hook | Yes | ^5.95.2 | — |
| FPL API (`/api/fpl/[...proxy]`) | Chip history | Yes (verified live) | — | Show all chips as unused |
| Vitest + @testing-library/react | Unit tests | Yes | ^4.1.2 / ^16.3.2 | — |

**No missing dependencies.**

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.2 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/components/planner/ChipStrategyPanel.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHIP-01 | BB chip row renders with best GW label | unit (component) | `npx vitest run src/components/planner/ChipStrategyPanel.test.tsx` | Wave 0 |
| CHIP-01 | BB ease cell bar has correct best-GW highlight | unit (component) | same | Wave 0 |
| CHIP-02 | TC chip row renders with best GW label | unit (component) | same | Wave 0 |
| CHIP-03 | FH chip row renders with best GW label | unit (component) | same | Wave 0 |
| CHIP-03 | FH row expands to show FHSquadTable | unit (component) | same | Wave 0 |
| CHIP-03 | FHSquadTable shows 15 players with xPts + ease columns | unit (component) | same | Wave 0 |
| CHIP-01/02/03 | Used chips show "Used GW{N}" label and opacity-40 | unit (component) | same | Wave 0 |
| CHIP-01/02/03 | `computeBBScore` / `computeTCScore` / `computeFHResult` pure function correctness | unit (pure) | `npx vitest run src/lib/chip-strategy-engine.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/components/planner/ChipStrategyPanel.test.tsx src/lib/chip-strategy-engine.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/lib/chip-strategy-engine.test.ts` — covers pure function correctness for all 3 scorers
- [ ] `src/components/planner/ChipStrategyPanel.test.tsx` — covers component rendering states (loading, error, data, used chips, FH expand)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Panel is read-only; teamId is public (FPL IDs are not secret) |
| V3 Session Management | no | No session state introduced |
| V4 Access Control | no | No privileged data; FPL history API is public |
| V5 Input Validation | yes | `teamId` from localStorage — validate is numeric before constructing fetch URL |
| V6 Cryptography | no | No cryptographic operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| URL injection via teamId | Tampering | Validate `teamId` is a numeric string before embedding in `/api/fpl/entry/{id}/history/` URL path. The existing proxy route passes it through; a non-numeric ID could construct an unexpected upstream path. |

**teamId validation pattern (already used by `useSquad`):**

```typescript
// Source: [VERIFIED: src/lib/hooks/useSquad.ts — enabled: !!teamId guard]
// Additional validation in useChipHistory:
enabled: !!teamId && /^\d+$/.test(teamId)
```

---

## Sources

### Primary (HIGH confidence)

- `src/lib/types.ts` — `ClubFormFixture`, `MergedPlayer` (xPts_90th_1gw, xPts_1gw), `PlannerChip`, `ClubForm` shapes [VERIFIED]
- `src/lib/planning-engine.ts` — `generateChipStep()` greedy algorithm pattern [VERIFIED]
- `src/lib/hooks/useClubForm.ts` — hook pattern, staleTime, data shape [VERIFIED]
- `src/lib/hooks/useSquad.ts` — hook pattern, bench position convention [VERIFIED]
- `src/lib/squad-adapter.ts` — `SquadPick.position` convention (12–15 = bench) [VERIFIED]
- `src/app/api/fpl/[...proxy]/route.ts` — proxy route path forwarding behaviour [VERIFIED]
- `.planning/phases/34-chip-strategy/34-UI-SPEC.md` — component structure, Tailwind classes, copywriting [VERIFIED]
- `.planning/phases/34-chip-strategy/34-CONTEXT.md` — all D-01 through D-13 decisions [VERIFIED]
- `src/components/club-form/FixtureEaseRankingPanel.tsx` — expand pattern, ease bar, table structure [VERIFIED]
- `src/components/captaincy/CaptainPicksPanel.tsx` — panel card shell pattern [VERIFIED]
- `src/components/planner/plan-helpers.ts` — `CHIP_LABELS` constant [VERIFIED]
- FPL API live probe (`/api/entry/5000/history/` and `/api/entry/1/history/`) — chip history shape and empty-chips case [VERIFIED]

### Secondary (MEDIUM confidence)

- FPL community tooling norms (FPLreview greedy squad selection approach) — informed greedy-vs-solver decision [ASSUMED: specific performance claim]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all verified from package.json and live codebase
- Architecture: HIGH — all data sources verified in existing hooks/types; only chip-strategy-engine.ts is new
- Pitfalls: HIGH — ease polarity, BGW gaps, optional fields, budget verified from source inspection
- FH formation algorithm: MEDIUM — logic is sound but specific slot-fill order is Claude's discretion (A1, A5)

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (stable FPL season; FPL API shape changes only at season rollover)
