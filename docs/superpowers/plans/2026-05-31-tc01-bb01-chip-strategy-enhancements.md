# TC-01 + BB-01 Chip Strategy Enhancements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a ranked player comparison table to the TC chip row and a 0–100 readiness score with component breakdown to the BB chip row — both behind an expand/collapse tap interaction in `ChipStrategyPanel`.

**Architecture:** Pure TypeScript/React — no pipeline changes, no new API routes. Two new pure functions in `chip-strategy-engine.ts`, two new leaf components, and an extended `ChipRow` that accepts an optional `detailPanel` slot. The existing `FHChipRow` expand pattern is the model to follow.

**Tech Stack:** TypeScript, React, Vitest, React Testing Library, Tailwind CSS (existing patterns only)

---

## File Map

| File | Change |
|------|--------|
| `src/lib/chip-strategy-engine.ts` | Add `TCCandidate`, `BBReadiness` types + `computeTCCandidates`, `computeBBReadiness` functions; export `DGW_TC_MULTIPLIER`, `GOOD_BENCH_XPTS_THRESHOLD` |
| `src/lib/chip-strategy-engine.test.ts` | Add TC candidates + BB readiness describe blocks |
| `src/components/planner/TCDetailPanel.tsx` | New component + co-located tests |
| `src/components/planner/BBDetailPanel.tsx` | New component + co-located tests |
| `src/components/planner/ChipStrategyPanel.tsx` | Extend `ChipRow` with optional `detailPanel`/`isExpanded`/`onToggle` props; add `expandedChip` state + `computeTCCandidates`/`computeBBReadiness` useMemos; wire panels |

---

## Task 1 — `computeTCCandidates` pure function (TDD)

**Files:**
- Modify: `src/lib/chip-strategy-engine.ts`
- Modify: `src/lib/chip-strategy-engine.test.ts`

### Step 1.1 — Write failing tests

Add this `describe` block to `src/lib/chip-strategy-engine.test.ts` (after the existing `computeTCScore` describe block, before the closing of the outer describe):

```typescript
describe('computeTCCandidates (TC-01)', () => {
  it('returns top 5 candidates sorted by tc_rating descending', () => {
    const gw = 35
    const fixtures = [makeFx({ event_id: gw, attacking_difficulty: 0.3 })]
    const map = buildClubFormMap([makeClubForm(1, fixtures)])
    const players = [1,2,3,4,5,6].map(i =>
      makePlayer({ id: i, element_type: 3, team: 1, xPts_1gw: i * 1.0, start_prob: 1.0 })
    )
    const result = computeTCCandidates(players, map, gw)
    expect(result.length).toBe(5)
    expect(result[0].player.id).toBe(6) // highest xPts
    expect(result[4].player.id).toBe(2) // 5th highest (player 1 dropped)
  })

  it('DGW player floats above non-DGW player with same base xPts', () => {
    const gw = 35
    const dgwFx = [
      makeFx({ event_id: gw, attacking_difficulty: 0.3 }),
      makeFx({ event_id: gw, attacking_difficulty: 0.3, opponent_team: 'CHE' }),
    ]
    const singleFx = [makeFx({ event_id: gw, attacking_difficulty: 0.3 })]
    const map = buildClubFormMap([
      makeClubForm(1, dgwFx),
      makeClubForm(2, singleFx),
    ])
    const dgwPlayer = makePlayer({ id: 10, element_type: 3, team: 1, xPts_1gw: 5.0, start_prob: 1.0 })
    const singlePlayer = makePlayer({ id: 20, element_type: 3, team: 2, xPts_1gw: 5.0, start_prob: 1.0 })
    const result = computeTCCandidates([dgwPlayer, singlePlayer], map, gw)
    expect(result[0].player.id).toBe(10)
    expect(result[0].is_dgw).toBe(true)
    expect(result[0].tc_xpts).toBe(10.0) // 5.0 × 2
    expect(result[1].is_dgw).toBe(false)
  })

  it('excludes GKs (element_type === 1)', () => {
    const gw = 35
    const map = buildClubFormMap([makeClubForm(1, [makeFx({ event_id: gw, attacking_difficulty: 0.3 })])])
    const gk = makePlayer({ id: 1, element_type: 1, team: 1 })
    const mid = makePlayer({ id: 2, element_type: 3, team: 1 })
    const result = computeTCCandidates([gk, mid], map, gw)
    expect(result.every(c => c.player.element_type !== 1)).toBe(true)
    expect(result.some(c => c.player.id === 2)).toBe(true)
  })

  it('excludes injured players (mins_risk === "injured")', () => {
    const gw = 35
    const map = buildClubFormMap([makeClubForm(1, [makeFx({ event_id: gw, attacking_difficulty: 0.3 })])])
    const injured = makePlayer({ id: 1, element_type: 3, team: 1, mins_risk: 'injured' as MinsRisk })
    const fit = makePlayer({ id: 2, element_type: 3, team: 1 })
    const result = computeTCCandidates([injured, fit], map, gw)
    expect(result.every(c => c.player.id !== 1)).toBe(true)
  })

  it('start_risk: low when start_prob >= 0.85', () => {
    const gw = 35
    const map = buildClubFormMap([makeClubForm(1, [makeFx({ event_id: gw, attacking_difficulty: 0.3 })])])
    const p = makePlayer({ id: 1, element_type: 3, team: 1, start_prob: 0.9 })
    const result = computeTCCandidates([p], map, gw)
    expect(result[0].start_risk).toBe('low')
  })

  it('start_risk: medium when start_prob in [0.65, 0.85)', () => {
    const gw = 35
    const map = buildClubFormMap([makeClubForm(1, [makeFx({ event_id: gw, attacking_difficulty: 0.3 })])])
    const p = makePlayer({ id: 1, element_type: 3, team: 1, start_prob: 0.7 })
    const result = computeTCCandidates([p], map, gw)
    expect(result[0].start_risk).toBe('medium')
  })

  it('start_risk: high when start_prob < 0.65', () => {
    const gw = 35
    const map = buildClubFormMap([makeClubForm(1, [makeFx({ event_id: gw, attacking_difficulty: 0.3 })])])
    const p = makePlayer({ id: 1, element_type: 3, team: 1, start_prob: 0.5 })
    const result = computeTCCandidates([p], map, gw)
    expect(result[0].start_risk).toBe('high')
  })

  it('fixture_label format: "ARS (H)" for single fixture', () => {
    const gw = 35
    const fx = makeFx({ event_id: gw, attacking_difficulty: 0.3, opponent_team: 'ARS', is_home: true })
    const map = buildClubFormMap([makeClubForm(1, [fx])])
    const p = makePlayer({ id: 1, element_type: 3, team: 1 })
    const result = computeTCCandidates([p], map, gw)
    expect(result[0].fixture_label).toBe('ARS (H)')
  })

  it('fixture_label format: "ARS (H) + CHE (A)" for DGW', () => {
    const gw = 35
    const fx1 = makeFx({ event_id: gw, attacking_difficulty: 0.3, opponent_team: 'ARS', is_home: true })
    const fx2 = makeFx({ event_id: gw, attacking_difficulty: 0.4, opponent_team: 'CHE', is_home: false })
    const map = buildClubFormMap([makeClubForm(1, [fx1, fx2])])
    const p = makePlayer({ id: 1, element_type: 3, team: 1 })
    const result = computeTCCandidates([p], map, gw)
    expect(result[0].fixture_label).toBe('ARS (H) + CHE (A)')
  })
})
```

You also need this import at the top of the test file (add to the existing import from `'./types'`):
```typescript
import type { MinsRisk } from './types'
```

- [ ] **Step 1.2 — Run tests to verify they fail**

```
npx vitest run src/lib/chip-strategy-engine.test.ts
```

Expected: 8 new test failures — `computeTCCandidates is not a function` or similar.

### Step 1.3 — Implement `computeTCCandidates`

Add to `src/lib/chip-strategy-engine.ts` (after the existing `computeTCScore` function, before `computeFHResult`):

```typescript
// ── TC-01: Candidate table ────────────────────────────────────────────────────

export const DGW_TC_MULTIPLIER = 1.3

export interface TCCandidate {
  player: ScoredPlayer
  fixture_label: string       // e.g. "ARS (H)" or "ARS (H) + CHE (A)"
  is_dgw: boolean
  tc_xpts: number             // xPts_1gw × (is_dgw ? 2 : 1)
  ceiling: number             // (xPts_90th_1gw ?? xPts_1gw ?? 0) × (is_dgw ? 2 : 1)
  start_risk: 'low' | 'medium' | 'high'
  tc_rating: number           // tc_xpts × start_prob × (is_dgw ? DGW_TC_MULTIPLIER : 1)
}

function buildFixtureLabel(fixtures: ClubFormFixture[], gw: number): string {
  const gwFx = fixtures.filter(f => f.event_id === gw)
  if (gwFx.length === 0) return 'No fixture'
  return gwFx.map(f => `${f.opponent_team} (${f.is_home ? 'H' : 'A'})`).join(' + ')
}

/**
 * Returns the top-5 TC candidates for startGw, sorted by tc_rating descending.
 * DGW players naturally float to the top due to DGW_TC_MULTIPLIER.
 * GKs and injured players are excluded. Unavailable (status !== 'a') players excluded.
 */
export function computeTCCandidates(
  players: ScoredPlayer[],
  clubFormMap: Map<number, ClubFormFixture[]>,
  startGw: number,
): TCCandidate[] {
  const eligible = players.filter(
    p => p.status === 'a' && p.element_type !== 1 && p.mins_risk !== 'injured',
  )

  const candidates: TCCandidate[] = eligible.map(player => {
    const fixtures = clubFormMap.get(player.team) ?? []
    const gwFx = fixtures.filter(f => f.event_id === startGw)
    const is_dgw = gwFx.length >= 2
    const fixture_label = buildFixtureLabel(fixtures, startGw)
    const mult = is_dgw ? 2 : 1
    const tc_xpts = (player.xPts_1gw ?? 0) * mult
    const ceiling = (player.xPts_90th_1gw ?? player.xPts_1gw ?? 0) * mult
    const start_risk: TCCandidate['start_risk'] =
      player.start_prob >= 0.85 ? 'low'
      : player.start_prob >= 0.65 ? 'medium'
      : 'high'
    const tc_rating = tc_xpts * player.start_prob * (is_dgw ? DGW_TC_MULTIPLIER : 1)
    return { player, fixture_label, is_dgw, tc_xpts, ceiling, start_risk, tc_rating }
  })

  return candidates.sort((a, b) => b.tc_rating - a.tc_rating).slice(0, 5)
}
```

Also add `ClubFormFixture` to the existing type import at the top of `chip-strategy-engine.ts` if not already present:
```typescript
import type { ScoredPlayer, ClubFormFixture } from './types'
```

- [ ] **Step 1.4 — Run tests to verify they pass**

```
npx vitest run src/lib/chip-strategy-engine.test.ts
```

Expected: all existing tests pass + 8 new TC tests pass.

- [ ] **Step 1.5 — Commit**

```
git add src/lib/chip-strategy-engine.ts src/lib/chip-strategy-engine.test.ts
git commit -m "feat(tc-01): add computeTCCandidates to chip-strategy-engine"
```

---

## Task 2 — `computeBBReadiness` pure function (TDD)

**Files:**
- Modify: `src/lib/chip-strategy-engine.ts`
- Modify: `src/lib/chip-strategy-engine.test.ts`

- [ ] **Step 2.1 — Write failing tests**

Add this `describe` block to `src/lib/chip-strategy-engine.test.ts` (after the TC candidates describe block):

```typescript
describe('computeBBReadiness (BB-01)', () => {
  it('score is weighted sum: bench_xpts_score×0.4 + start_prob_score×0.3 + doublers_score×0.3', () => {
    const gw = 35
    // bench_xpts = 12.0 → bench_xpts_score = 100 (at threshold)
    // avg_start_prob = 1.0 → start_prob_score = 100
    // doublers = 0 → doublers_score = 0
    // score = 100×0.4 + 100×0.3 + 0×0.3 = 70
    const map = buildClubFormMap([makeClubForm(1, [makeFx({ event_id: gw, attacking_difficulty: 0.3 })])])
    const players = [12,13,14,15].map(pos =>
      makePlayer({ id: pos, element_type: 3, team: 1, xPts_1gw: 3.0, start_prob: 1.0 })
    )
    const bench = [12,13,14,15].map(pos => makeBenchPick(pos, pos as 12|13|14|15))
    const result = computeBBReadiness(bench, players, map, gw)
    expect(result.score).toBe(70)
    expect(result.bench_xpts).toBeCloseTo(12.0)
    expect(result.avg_start_prob).toBeCloseTo(1.0)
    expect(result.doublers).toBe(0)
  })

  it('bench_xpts_score is capped at 100 when bench exceeds GOOD_BENCH_XPTS_THRESHOLD', () => {
    const gw = 35
    const map = buildClubFormMap([makeClubForm(1, [makeFx({ event_id: gw, attacking_difficulty: 0.3 })])])
    const players = [12,13,14,15].map(pos =>
      makePlayer({ id: pos, element_type: 3, team: 1, xPts_1gw: 10.0, start_prob: 1.0 }) // 40 total >> 12
    )
    const bench = [12,13,14,15].map(pos => makeBenchPick(pos, pos as 12|13|14|15))
    const result = computeBBReadiness(bench, players, map, gw)
    expect(result.bench_xpts_score).toBe(100)
  })

  it('doublers_score > 0 when bench player has DGW fixture', () => {
    const gw = 35
    const dgwFx = [
      makeFx({ event_id: gw, attacking_difficulty: 0.3 }),
      makeFx({ event_id: gw, attacking_difficulty: 0.3, opponent_team: 'CHE' }),
    ]
    const singleFx = [makeFx({ event_id: gw, attacking_difficulty: 0.3 })]
    const map = buildClubFormMap([
      makeClubForm(1, dgwFx),   // team 1 has DGW
      makeClubForm(2, singleFx),
    ])
    const players = [
      makePlayer({ id: 12, element_type: 3, team: 1 }), // doubler
      makePlayer({ id: 13, element_type: 3, team: 2 }),
      makePlayer({ id: 14, element_type: 3, team: 2 }),
      makePlayer({ id: 15, element_type: 3, team: 2 }),
    ]
    const bench = [12,13,14,15].map(pos => makeBenchPick(pos, pos as 12|13|14|15))
    const result = computeBBReadiness(bench, players, map, gw)
    expect(result.doublers).toBe(1)
    expect(result.doublers_score).toBeCloseTo(25) // (1/4) × 100
  })

  it('returns zero readiness when bench is empty', () => {
    const gw = 35
    const map = buildClubFormMap([makeClubForm(1, [makeFx({ event_id: gw, attacking_difficulty: 0.3 })])])
    const result = computeBBReadiness([], [], map, gw)
    expect(result.score).toBe(0)
    expect(result.bench_xpts).toBe(0)
    expect(result.doublers).toBe(0)
  })

  it('ignores picks with position < 12 (starters)', () => {
    const gw = 35
    const map = buildClubFormMap([makeClubForm(1, [makeFx({ event_id: gw, attacking_difficulty: 0.3 })])])
    const players = [1,12].map(pos =>
      makePlayer({ id: pos, element_type: 3, team: 1, xPts_1gw: 5.0, start_prob: 1.0 })
    )
    const allPicks = [
      makeBenchPick(1, 12), // position 12 but element is player id 1 — fine, just testing position filter
      { element: 1, position: 1, multiplier: 1, is_captain: true, is_vice_captain: false }, // starter — should be ignored
      makeBenchPick(12, 12),
    ]
    // Only position >= 12 should count
    // allPicks[1] has position 1 — should be excluded
    const result = computeBBReadiness(allPicks, players, map, gw)
    // positions 12 from allPicks: element 1 (pos 12) and element 12 (pos 12) → 2 bench players
    expect(result.bench_xpts).toBeCloseTo(10.0) // 2 × 5.0
  })
})
```

- [ ] **Step 2.2 — Run tests to verify they fail**

```
npx vitest run src/lib/chip-strategy-engine.test.ts
```

Expected: 5 new failures — `computeBBReadiness is not a function`.

- [ ] **Step 2.3 — Implement `computeBBReadiness`**

Add to `src/lib/chip-strategy-engine.ts` (after `computeTCCandidates`, before `computeFHResult`):

```typescript
// ── BB-01: Readiness score ────────────────────────────────────────────────────

export const GOOD_BENCH_XPTS_THRESHOLD = 12.0

export interface BBReadiness {
  score: number             // 0–100 weighted composite, rounded
  bench_xpts: number        // sum of xPts_1gw for bench picks (position ≥ 12)
  bench_xpts_score: number  // min(100, bench_xpts / GOOD_BENCH_XPTS_THRESHOLD × 100)
  avg_start_prob: number    // mean start_prob of bench picks
  start_prob_score: number  // avg_start_prob × 100
  doublers: number          // bench picks whose team has ≥ 2 fixtures at startGw
  doublers_score: number    // (doublers / 4) × 100
}

/**
 * Computes BB readiness from bench picks (position ≥ 12).
 * benchPicks may include all 15 picks — positions < 12 are silently ignored.
 */
export function computeBBReadiness(
  benchPicks: SquadPick[],
  players: ScoredPlayer[],
  clubFormMap: Map<number, ClubFormFixture[]>,
  startGw: number,
): BBReadiness {
  const empty: BBReadiness = { score: 0, bench_xpts: 0, bench_xpts_score: 0, avg_start_prob: 0, start_prob_score: 0, doublers: 0, doublers_score: 0 }
  const bench = benchPicks.filter(p => p.position >= 12)
  if (bench.length === 0 || players.length === 0) return empty

  const playerMap = new Map<number, ScoredPlayer>(players.map(p => [p.id, p]))
  let totalXpts = 0, totalStartProb = 0, doublerCount = 0, counted = 0

  for (const pick of bench) {
    const player = playerMap.get(pick.element)
    if (!player) continue
    counted++
    totalXpts += player.xPts_1gw ?? 0
    totalStartProb += player.start_prob
    const gwFx = (clubFormMap.get(player.team) ?? []).filter(f => f.event_id === startGw)
    if (gwFx.length >= 2) doublerCount++
  }

  if (counted === 0) return empty

  const bench_xpts = totalXpts
  const bench_xpts_score = Math.min(100, (bench_xpts / GOOD_BENCH_XPTS_THRESHOLD) * 100)
  const avg_start_prob = totalStartProb / counted
  const start_prob_score = avg_start_prob * 100
  const doublers = doublerCount
  const doublers_score = (doublers / 4) * 100
  const score = Math.round(bench_xpts_score * 0.4 + start_prob_score * 0.3 + doublers_score * 0.3)

  return { score, bench_xpts, bench_xpts_score, avg_start_prob, start_prob_score, doublers, doublers_score }
}
```

- [ ] **Step 2.4 — Run tests to verify they pass**

```
npx vitest run src/lib/chip-strategy-engine.test.ts
```

Expected: all tests pass (existing + 8 TC + 5 BB).

- [ ] **Step 2.5 — Commit**

```
git add src/lib/chip-strategy-engine.ts src/lib/chip-strategy-engine.test.ts
git commit -m "feat(bb-01): add computeBBReadiness to chip-strategy-engine"
```

---

## Task 3 — `TCDetailPanel` component (TDD)

**Files:**
- Create: `src/components/planner/TCDetailPanel.tsx`
- Create: `src/components/planner/TCDetailPanel.test.tsx`

- [ ] **Step 3.1 — Write failing tests**

Create `src/components/planner/TCDetailPanel.test.tsx`:

```typescript
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TCDetailPanel } from './TCDetailPanel'
import type { TCCandidate } from '@/lib/chip-strategy-engine'
import type { ScoredPlayer } from '@/lib/types'

function makeCandidate(overrides: Partial<TCCandidate> & { id: number }): TCCandidate {
  const player = { id: overrides.id, web_name: `P${overrides.id}` } as ScoredPlayer
  return {
    player,
    fixture_label: overrides.fixture_label ?? 'ARS (H)',
    is_dgw: overrides.is_dgw ?? false,
    tc_xpts: overrides.tc_xpts ?? 10.0,
    ceiling: overrides.ceiling ?? 15.0,
    start_risk: overrides.start_risk ?? 'low',
    tc_rating: overrides.tc_rating ?? 10.0,
    ...overrides,
  }
}

describe('TCDetailPanel', () => {
  it('renders player name, fixture, tc_xpts, and rating columns', () => {
    const candidates = [makeCandidate({ id: 1, fixture_label: 'ARS (H)', tc_xpts: 12.0, tc_rating: 12.0 })]
    render(<TCDetailPanel candidates={candidates} />)
    expect(screen.getByText('P1')).toBeInTheDocument()
    expect(screen.getByText('ARS (H)')).toBeInTheDocument()
    expect(screen.getByText('12.0')).toBeInTheDocument() // TC xPts
  })

  it('shows 2× badge on DGW row', () => {
    const candidates = [makeCandidate({ id: 1, is_dgw: true, fixture_label: 'ARS (H) + CHE (A)' })]
    render(<TCDetailPanel candidates={candidates} />)
    expect(screen.getByText('2×')).toBeInTheDocument()
  })

  it('does not show 2× badge on non-DGW row', () => {
    const candidates = [makeCandidate({ id: 1, is_dgw: false })]
    render(<TCDetailPanel candidates={candidates} />)
    expect(screen.queryByText('2×')).not.toBeInTheDocument()
  })

  it('renders start-risk dot with correct data-risk attribute', () => {
    const candidates = [
      makeCandidate({ id: 1, start_risk: 'low' }),
      makeCandidate({ id: 2, start_risk: 'medium' }),
      makeCandidate({ id: 3, start_risk: 'high' }),
    ]
    render(<TCDetailPanel candidates={candidates} />)
    expect(document.querySelector('[data-risk="low"]')).toBeInTheDocument()
    expect(document.querySelector('[data-risk="medium"]')).toBeInTheDocument()
    expect(document.querySelector('[data-risk="high"]')).toBeInTheDocument()
  })

  it('renders empty state when candidates array is empty', () => {
    render(<TCDetailPanel candidates={[]} />)
    expect(screen.getByText('No player data available')).toBeInTheDocument()
  })

  it('renders at most 5 rows', () => {
    const candidates = [1,2,3,4,5,6].map(i => makeCandidate({ id: i }))
    render(<TCDetailPanel candidates={candidates} />)
    // 5 player names max (6th player id=6 not shown)
    const rows = document.querySelectorAll('[data-testid="tc-candidate-row"]')
    expect(rows.length).toBeLessThanOrEqual(5)
  })
})
```

- [ ] **Step 3.2 — Run tests to verify they fail**

```
npx vitest run src/components/planner/TCDetailPanel.test.tsx
```

Expected: all fail — `TCDetailPanel` does not exist.

- [ ] **Step 3.3 — Implement `TCDetailPanel`**

Create `src/components/planner/TCDetailPanel.tsx`:

```typescript
import type { TCCandidate } from '@/lib/chip-strategy-engine'

const RISK_CLASSES: Record<TCCandidate['start_risk'], string> = {
  low: 'bg-green-500',
  medium: 'bg-amber-400',
  high: 'bg-red-500',
}

interface Props {
  candidates: TCCandidate[]
}

export function TCDetailPanel({ candidates }: Props) {
  if (candidates.length === 0) {
    return (
      <div className="px-1 py-2 text-xs text-zinc-400 dark:text-zinc-500">
        No player data available
      </div>
    )
  }

  const rows = candidates.slice(0, 5)

  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-zinc-400 dark:text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
            <th className="text-left py-1 pr-2 font-medium">Player</th>
            <th className="text-left py-1 pr-2 font-medium">Fixture</th>
            <th className="text-right py-1 pr-2 font-medium">TC xPts</th>
            <th className="text-right py-1 font-medium">Rating</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(c => (
            <tr
              key={c.player.id}
              data-testid="tc-candidate-row"
              className="border-b border-zinc-50 dark:border-zinc-800/60 last:border-0"
            >
              <td className="py-1.5 pr-2">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${RISK_CLASSES[c.start_risk]}`}
                    data-risk={c.start_risk}
                    title={`Start risk: ${c.start_risk}`}
                  />
                  <span className="font-medium text-zinc-800 dark:text-zinc-100 truncate max-w-[80px]">
                    {c.player.web_name}
                  </span>
                </span>
              </td>
              <td className="py-1.5 pr-2 text-zinc-600 dark:text-zinc-400">
                <span className="flex items-center gap-1 flex-wrap">
                  {c.fixture_label}
                  {c.is_dgw && (
                    <span className="inline-block px-1 py-0.5 text-[10px] font-semibold rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                      2×
                    </span>
                  )}
                </span>
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-800 dark:text-zinc-100">
                {c.tc_xpts.toFixed(1)}
              </td>
              <td className="py-1.5 text-right tabular-nums font-semibold text-zinc-800 dark:text-zinc-100">
                {c.tc_rating.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3.4 — Run tests to verify they pass**

```
npx vitest run src/components/planner/TCDetailPanel.test.tsx
```

Expected: all 6 tests pass.

- [ ] **Step 3.5 — Commit**

```
git add src/components/planner/TCDetailPanel.tsx src/components/planner/TCDetailPanel.test.tsx
git commit -m "feat(tc-01): add TCDetailPanel component"
```

---

## Task 4 — `BBDetailPanel` component (TDD)

**Files:**
- Create: `src/components/planner/BBDetailPanel.tsx`
- Create: `src/components/planner/BBDetailPanel.test.tsx`

- [ ] **Step 4.1 — Write failing tests**

Create `src/components/planner/BBDetailPanel.test.tsx`:

```typescript
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { BBDetailPanel } from './BBDetailPanel'
import type { BBReadiness } from '@/lib/chip-strategy-engine'

function makeReadiness(overrides: Partial<BBReadiness> = {}): BBReadiness {
  return {
    score: 65,
    bench_xpts: 9.6,
    bench_xpts_score: 80,
    avg_start_prob: 0.85,
    start_prob_score: 85,
    doublers: 1,
    doublers_score: 25,
    ...overrides,
  }
}

describe('BBDetailPanel', () => {
  it('renders the score badge with correct value', () => {
    render(<BBDetailPanel readiness={makeReadiness({ score: 72 })} />)
    expect(screen.getByText('72 / 100')).toBeInTheDocument()
  })

  it('renders three component bars with labels', () => {
    render(<BBDetailPanel readiness={makeReadiness()} />)
    expect(screen.getByText('Bench xPts')).toBeInTheDocument()
    expect(screen.getByText('Start Prob')).toBeInTheDocument()
    expect(screen.getByText('Doublers')).toBeInTheDocument()
  })

  it('renders bench xPts value label', () => {
    render(<BBDetailPanel readiness={makeReadiness({ bench_xpts: 9.6 })} />)
    expect(screen.getByText('9.6 pts')).toBeInTheDocument()
  })

  it('renders avg start prob as percentage', () => {
    render(<BBDetailPanel readiness={makeReadiness({ avg_start_prob: 0.85 })} />)
    expect(screen.getByText('85% avg')).toBeInTheDocument()
  })

  it('renders doublers count', () => {
    render(<BBDetailPanel readiness={makeReadiness({ doublers: 2 })} />)
    expect(screen.getByText('2 of 4')).toBeInTheDocument()
  })

  it('renders hitCostLabel when provided', () => {
    render(<BBDetailPanel readiness={makeReadiness()} hitCostLabel="−4pt hit needed" />)
    expect(screen.getByText('−4pt hit needed')).toBeInTheDocument()
  })

  it('does not render hit cost section when hitCostLabel is absent', () => {
    render(<BBDetailPanel readiness={makeReadiness()} />)
    expect(screen.queryByText(/hit needed/i)).not.toBeInTheDocument()
  })

  it('shows no-squad message when score is 0', () => {
    render(<BBDetailPanel readiness={makeReadiness({ score: 0, bench_xpts: 0, bench_xpts_score: 0, avg_start_prob: 0, start_prob_score: 0 })} />)
    expect(screen.getByText(/load your squad/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 4.2 — Run tests to verify they fail**

```
npx vitest run src/components/planner/BBDetailPanel.test.tsx
```

Expected: all fail — `BBDetailPanel` does not exist.

- [ ] **Step 4.3 — Implement `BBDetailPanel`**

Create `src/components/planner/BBDetailPanel.tsx`:

```typescript
import type { BBReadiness } from '@/lib/chip-strategy-engine'

interface Props {
  readiness: BBReadiness
  hitCostLabel?: string
}

function ScoreBar({ value, label, valueLabel }: { value: number; label: string; valueLabel: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 text-zinc-500 dark:text-zinc-400">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div
          className="h-1.5 rounded-full bg-blue-500 dark:bg-blue-400"
          style={{ width: `${Math.min(100, Math.round(value))}%` }}
        />
      </div>
      <span className="w-14 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{valueLabel}</span>
    </div>
  )
}

function scoreBadgeClass(score: number): string {
  if (score >= 80) return 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30'
  if (score >= 50) return 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
  return 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30'
}

export function BBDetailPanel({ readiness, hitCostLabel }: Props) {
  if (readiness.score === 0 && readiness.bench_xpts === 0) {
    return (
      <div className="px-1 py-2 text-xs text-zinc-400 dark:text-zinc-500">
        Load your squad to see BB readiness
      </div>
    )
  }

  return (
    <div className="mt-2 space-y-2.5">
      {/* Score badge */}
      <div className="flex items-center gap-2">
        <span
          className={`text-xl font-bold tabular-nums px-2 py-0.5 rounded ${scoreBadgeClass(readiness.score)}`}
        >
          {readiness.score} / 100
        </span>
      </div>

      {/* Component bars */}
      <div className="space-y-1.5">
        <ScoreBar
          value={readiness.bench_xpts_score}
          label="Bench xPts"
          valueLabel={`${readiness.bench_xpts.toFixed(1)} pts`}
        />
        <ScoreBar
          value={readiness.start_prob_score}
          label="Start Prob"
          valueLabel={`${Math.round(readiness.avg_start_prob * 100)}% avg`}
        />
        <ScoreBar
          value={readiness.doublers_score}
          label="Doublers"
          valueLabel={`${readiness.doublers} of 4`}
        />
      </div>

      {/* Hit cost label */}
      {hitCostLabel && (
        <p className="text-xs text-amber-600 dark:text-amber-400">{hitCostLabel}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4.4 — Run tests to verify they pass**

```
npx vitest run src/components/planner/BBDetailPanel.test.tsx
```

Expected: all 8 tests pass.

- [ ] **Step 4.5 — Commit**

```
git add src/components/planner/BBDetailPanel.tsx src/components/planner/BBDetailPanel.test.tsx
git commit -m "feat(bb-01): add BBDetailPanel component"
```

---

## Task 5 — Wire panels into `ChipStrategyPanel`

**Files:**
- Modify: `src/components/planner/ChipStrategyPanel.tsx`

- [ ] **Step 5.1 — Extend `ChipRow` with optional expand props**

In `ChipStrategyPanel.tsx`, update the `ChipRowProps` interface and `ChipRow` function:

```typescript
interface ChipRowProps {
  chip: ChipCode
  scores: GWEaseScore[]
  usedAtGw?: number
  // Optional expand slot — when provided (and chip not yet used), row becomes interactive
  detailPanel?: React.ReactNode
  isExpanded?: boolean
  onToggle?: () => void
}
```

Replace the existing `ChipRow` function body with:

```typescript
function ChipRow({ chip, scores, usedAtGw, detailPanel, isExpanded, onToggle }: ChipRowProps) {
  const isUsed = usedAtGw !== undefined
  const isExpandable = !isUsed && detailPanel !== undefined

  const badgeClasses = isUsed
    ? 'inline-block text-xs font-normal rounded px-2 py-1 bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 w-24'
    : 'inline-block text-xs font-normal rounded px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 w-24'
  const bestGw = scores.find(s => s.isBest)?.gw

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isExpandable) return
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.key === ' ') e.preventDefault()
      onToggle?.()
    }
  }

  return (
    <React.Fragment>
      <li
        className={`flex items-center gap-2 text-sm min-h-[44px]${isUsed ? ' opacity-40' : ''}${isExpandable ? ' cursor-pointer' : ''}`}
        data-testid={`chip-row-${chip}`}
        onClick={isExpandable ? onToggle : undefined}
        onKeyDown={isExpandable ? handleKeyDown : undefined}
        role={isExpandable ? 'button' : undefined}
        tabIndex={isExpandable ? 0 : undefined}
        aria-expanded={isExpandable ? isExpanded : undefined}
        {...(isUsed ? { 'aria-disabled': true } : {})}
      >
        <span className={badgeClasses}>{CHIP_LABELS[chip]}</span>
        {isUsed ? (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">Used GW{usedAtGw}</span>
        ) : bestGw !== undefined ? (
          <span className="text-sm text-zinc-700 dark:text-zinc-300">Best: GW{bestGw}</span>
        ) : (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">—</span>
        )}
        <EaseCellBar
          chip={chip}
          scores={scores}
          ariaLabelPrefix={`${CHIP_LABELS[chip]} ease across next 5 GWs`}
          forceMuted={isUsed}
        />
        {isExpandable && (
          <span
            className={`ml-auto text-zinc-400 dark:text-zinc-500 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            ▾
          </span>
        )}
      </li>
      {isExpandable && isExpanded && (
        <li className="px-1 pb-2" aria-label={`${CHIP_LABELS[chip]} detail`}>
          {detailPanel}
        </li>
      )}
    </React.Fragment>
  )
}
```

- [ ] **Step 5.2 — Add imports and state + useMemos**

At the top of `ChipStrategyPanel.tsx`, add to the existing import from `chip-strategy-engine`:
```typescript
import {
  buildClubFormMap,
  computeBBScore,
  computeTCScore,
  computeFHResult,
  computeTCCandidates,
  computeBBReadiness,
  BGW_NEUTRAL_EASE,
  TC_CANDIDATE_COUNT,
} from '@/lib/chip-strategy-engine'
```

Add the new component imports after existing imports:
```typescript
import { TCDetailPanel } from './TCDetailPanel'
import { BBDetailPanel } from './BBDetailPanel'
```

Inside `ChipStrategyPanel` (after the existing `benchPicks` and `currentSquadIds` useMemos, before `bbScores`):
```typescript
const [expandedChip, setExpandedChip] = useState<'bboost' | '3xc' | null>(null)

const tcCandidates = useMemo(
  () => computeTCCandidates(scoredPlayers, clubFormMap, startingGw ?? 0),
  [scoredPlayers, clubFormMap, startingGw],
)

const bbReadiness = useMemo(
  () => computeBBReadiness(benchPicks, scoredPlayers, clubFormMap, startingGw ?? 0),
  [benchPicks, scoredPlayers, clubFormMap, startingGw],
)
```

- [ ] **Step 5.3 — Wire panels into the JSX**

Replace the two existing `<ChipRow>` calls in the `return` block with:

```tsx
<ChipRow
  chip="bboost"
  scores={bbScores}
  usedAtGw={usedChips.get('bboost')}
  detailPanel={<BBDetailPanel readiness={bbReadiness} />}
  isExpanded={expandedChip === 'bboost'}
  onToggle={() => setExpandedChip(prev => prev === 'bboost' ? null : 'bboost')}
/>
<ChipRow
  chip="3xc"
  scores={tcScores}
  usedAtGw={usedChips.get('3xc')}
  detailPanel={<TCDetailPanel candidates={tcCandidates} />}
  isExpanded={expandedChip === '3xc'}
  onToggle={() => setExpandedChip(prev => prev === '3xc' ? null : '3xc')}
/>
```

- [ ] **Step 5.4 — Run full test suite**

```
npx vitest run
```

Expected: all tests pass. Fix any type errors before proceeding.

- [ ] **Step 5.5 — Commit**

```
git add src/components/planner/ChipStrategyPanel.tsx
git commit -m "feat(tc-01,bb-01): wire TCDetailPanel and BBDetailPanel into ChipStrategyPanel"
```
