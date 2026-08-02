# Planner Outlook Implementation Plan — Fixture Grid + Captain Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the mockup's fixture-outlook grid and per-GW captain-plan strip to the Planner, preserving the existing interactive transfer-plan generator.

**Architecture:** A pure `bestCaptainPerGw(steps, playerMap)` helper (uses `MergedPlayer.gw_xpts` per-GW) feeds a new `CaptainPlanStrip`; `PlannerTab` renders the existing self-contained `FixtureHeatMap` at the top and `CaptainPlanStrip` when a plan exists. No engine changes.

**Tech Stack:** React (client components), TypeScript, vitest + Testing Library.

## Global Constraints

- **Keep-all-features (UIX-01):** the existing generator (Generate button, `ChipStrategyPanel`, `TransferPlanTable` with chip toggles + manual overrides + restore, the chips `<details>`) all survive unchanged.
- Reuse: `FixtureHeatMap` (self-contained), `MergedPlayer.gw_xpts` (per-GW xPts), `getTeamColour`. No plan-engine change.
- `gw_xpts[i]` aligns with plan step index `i` (step 0 = the next GW, matching `gw_xpts[0]`). Guard `gw_xpts?.[i] ?? 0`.
- No `Co-Authored-By` trailers. Do NOT use `git stash` for verification — run `npx vitest` directly.
- Tests: `npx vitest run <path>`. Work on branch `redesign/planner-outlook`.

---

### Task 1: `bestCaptainPerGw` helper

**Files:**
- Create: `src/lib/captain-plan.ts`
- Test: `src/lib/captain-plan.test.ts`

**Interfaces:**
- Consumes: `MergedPlayer`, `PlanStep` (`@/lib/types`). `PlanStep.positionsAfter: Record<number, number>` (1-11 starters, 12-15 bench); `PlanStep.gw: number`.
- Produces: `bestCaptainPerGw(steps: PlanStep[], playerMap: Map<number, MergedPlayer>): CaptainPlanEntry[]`, `CaptainPlanEntry = { gw; playerId; name; team; opponent; xpts }`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/captain-plan.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { bestCaptainPerGw } from './captain-plan'
import type { MergedPlayer, PlanStep } from './types'

function mkP(over: Partial<MergedPlayer>): MergedPlayer {
  return {
    id: 0, web_name: 'P', team_short_name: 'ARS', gw_xpts: [], fixtures: [],
    ...over,
  } as unknown as MergedPlayer
}
function mkStep(gw: number, positionsAfter: Record<number, number>): PlanStep {
  return { gw, positionsAfter, transfersIn: [], transfersOut: [], chip: null } as unknown as PlanStep
}

describe('bestCaptainPerGw', () => {
  it('picks the highest-gw_xpts STARTER for each step (not bench, not by xPts_1gw)', () => {
    const players = new Map<number, MergedPlayer>([
      [1, mkP({ id: 1, web_name: 'Starter8', gw_xpts: [8] })],
      [2, mkP({ id: 2, web_name: 'Starter5', gw_xpts: [5] })],
      [3, mkP({ id: 3, web_name: 'Bench10', gw_xpts: [10] })], // higher, but benched
    ])
    const steps = [mkStep(1, { 1: 1, 2: 2, 3: 12 })] // p1 & p2 start (pos 1,2); p3 benched (pos 12)
    const r = bestCaptainPerGw(steps, players)
    expect(r).toHaveLength(1)
    expect(r[0].name).toBe('Starter8')
    expect(r[0].xpts).toBe(8)
    expect(r[0].gw).toBe(1)
  })

  it('indexes gw_xpts by step position across the horizon', () => {
    const players = new Map<number, MergedPlayer>([
      [1, mkP({ id: 1, web_name: 'A', gw_xpts: [8, 3] })],
      [2, mkP({ id: 2, web_name: 'B', gw_xpts: [5, 9] })],
    ])
    const steps = [mkStep(1, { 1: 1, 2: 2 }), mkStep(2, { 1: 1, 2: 2 })]
    const r = bestCaptainPerGw(steps, players)
    expect(r.map((e) => e.name)).toEqual(['A', 'B']) // GW1: A(8>5); GW2: B(9>3)
  })

  it('formats the opponent from the step-GW fixture', () => {
    const players = new Map<number, MergedPlayer>([
      [1, mkP({ id: 1, web_name: 'A', gw_xpts: [8], fixtures: [{ event_id: 1, opponent_team: 'MUN', is_home: true } as never] })],
    ])
    const r = bestCaptainPerGw([mkStep(1, { 1: 1 })], players)
    expect(r[0].opponent).toBe('vs MUN (H)')
  })

  it('returns [] for empty steps', () => {
    expect(bestCaptainPerGw([], new Map())).toEqual([])
  })

  it('treats a missing gw_xpts[i] as 0', () => {
    const players = new Map<number, MergedPlayer>([
      [1, mkP({ id: 1, web_name: 'A', gw_xpts: [] })], // no entry for index 0
      [2, mkP({ id: 2, web_name: 'B', gw_xpts: [2] })],
    ])
    const r = bestCaptainPerGw([mkStep(1, { 1: 1, 2: 2 })], players)
    expect(r[0].name).toBe('B') // A scores 0, B scores 2
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/captain-plan.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

Create `src/lib/captain-plan.ts`:

```ts
// Planner outlook: the best captain per gameweek along the generated plan. For
// each step, scores the STARTERS (positionsAfter 1-11) by their per-GW xPts
// (gw_xpts, indexed by step position) and picks the max.
import type { MergedPlayer, PlanStep } from './types'

export interface CaptainPlanEntry {
  gw: number
  playerId: number
  name: string
  team: string
  opponent: string
  xpts: number
}

export function bestCaptainPerGw(
  steps: PlanStep[],
  playerMap: Map<number, MergedPlayer>,
): CaptainPlanEntry[] {
  const out: CaptainPlanEntry[] = []
  steps.forEach((step, i) => {
    let best: { p: MergedPlayer; xpts: number } | null = null
    for (const [idStr, pos] of Object.entries(step.positionsAfter)) {
      if (pos < 1 || pos > 11) continue // starters only
      const p = playerMap.get(Number(idStr))
      if (!p) continue
      const xpts = p.gw_xpts?.[i] ?? 0
      if (best === null || xpts > best.xpts) best = { p, xpts }
    }
    if (best === null) return // no starter resolvable this GW → skip
    const p = best.p
    const fx = p.fixtures?.find((f) => f.event_id === step.gw)
    const opponent = fx ? `${fx.is_home ? 'vs' : 'at'} ${fx.opponent_team} (${fx.is_home ? 'H' : 'A'})` : ''
    out.push({ gw: step.gw, playerId: p.id, name: p.web_name, team: p.team_short_name, opponent, xpts: best.xpts })
  })
  return out
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/captain-plan.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/captain-plan.ts src/lib/captain-plan.test.ts
git commit -m "feat(planner): bestCaptainPerGw helper (per-GW best captain from gw_xpts)"
```

---

### Task 2: `CaptainPlanStrip` component

**Files:**
- Create: `src/components/planner/CaptainPlanStrip.tsx`
- Test: `src/components/planner/CaptainPlanStrip.test.tsx`

**Interfaces:**
- Consumes: `bestCaptainPerGw` (Task 1), `getTeamColour` (`@/lib/team-colours`), `MergedPlayer`/`PlanStep`.
- Produces: `CaptainPlanStrip({ steps, playerMap })`. Renders `null` when `bestCaptainPerGw` returns `[]`.

- [ ] **Step 1: Write the failing test**

Create `src/components/planner/CaptainPlanStrip.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import type { MergedPlayer, PlanStep } from '@/lib/types'
import { CaptainPlanStrip } from './CaptainPlanStrip'

function mkP(over: Partial<MergedPlayer>): MergedPlayer {
  return { id: 0, web_name: 'P', team_short_name: 'ARS', gw_xpts: [], fixtures: [], ...over } as unknown as MergedPlayer
}
function mkStep(gw: number, positionsAfter: Record<number, number>): PlanStep {
  return { gw, positionsAfter, transfersIn: [], transfersOut: [], chip: null } as unknown as PlanStep
}

describe('CaptainPlanStrip', () => {
  it('renders a card per GW with name and xPts', () => {
    const players = new Map<number, MergedPlayer>([
      [1, mkP({ id: 1, web_name: 'Saka', team_short_name: 'ARS', gw_xpts: [7.1, 3] })],
      [2, mkP({ id: 2, web_name: 'Haaland', team_short_name: 'MCI', gw_xpts: [5, 8.4] })],
    ])
    const steps = [mkStep(1, { 1: 1, 2: 2 }), mkStep(2, { 1: 1, 2: 2 })]
    const { container } = render(<CaptainPlanStrip steps={steps} playerMap={players} />)
    expect(container.textContent).toContain('Captain plan')
    expect(container.textContent).toContain('GW1')
    expect(container.textContent).toContain('Saka')
    expect(container.textContent).toContain('7.1')
    expect(container.textContent).toContain('Haaland')
  })

  it('renders nothing when there are no steps', () => {
    const { container } = render(<CaptainPlanStrip steps={[]} playerMap={new Map()} />)
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/planner/CaptainPlanStrip.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `src/components/planner/CaptainPlanStrip.tsx`:

```tsx
'use client'

// Planner outlook: horizontal per-GW captain strip ("model's best route"),
// from bestCaptainPerGw over the generated plan. Renders nothing without a plan.
import type { MergedPlayer, PlanStep } from '@/lib/types'
import { bestCaptainPerGw } from '@/lib/captain-plan'
import { getTeamColour } from '@/lib/team-colours'

export function CaptainPlanStrip({ steps, playerMap }: {
  steps: PlanStep[]
  playerMap: Map<number, MergedPlayer>
}) {
  const entries = bestCaptainPerGw(steps, playerMap)
  if (entries.length === 0) return null

  return (
    <section className="rounded border border-line p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-ink">Captain plan</h2>
        <span className="text-data text-ink-muted">model&apos;s best route</span>
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {entries.map((e) => {
          const c = getTeamColour(e.team)
          return (
            <div key={e.gw} className="shrink-0 w-28 rounded border border-line bg-surface-2 p-2 text-center">
              <div className="text-data text-ink-muted">GW{e.gw}</div>
              <div className="flex items-center justify-center mt-1">
                <span
                  className="text-[10px] font-semibold px-1 py-0.5 rounded-full tabular"
                  style={{ background: c.primary, color: c.text }}>
                  {e.team}
                </span>
              </div>
              <div className="text-body font-semibold text-ink truncate mt-0.5">{e.name}</div>
              <div className="text-data text-ink-muted truncate">{e.opponent}</div>
              <div className="text-body font-semibold text-accent tabular mt-0.5">{e.xpts.toFixed(1)}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/components/planner/CaptainPlanStrip.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/planner/CaptainPlanStrip.tsx src/components/planner/CaptainPlanStrip.test.tsx
git commit -m "feat(planner): CaptainPlanStrip per-GW captain cards"
```

---

### Task 3: Wire into `PlannerTab` (fixture outlook + captain strip)

**Files:**
- Modify: `src/components/planner/PlannerTab.tsx`

**Interfaces:**
- Consumes: `FixtureHeatMap` (`@/components/club-form/FixtureHeatMap`, props `{ submittedId?: string | null }`), `CaptainPlanStrip` (Task 2). `PlannerTab` has local `teamId: string | null`, `scoredPlayers: ScoredPlayer[]`, `planResult: PlanResult | null` with `planResult.steps: PlanStep[]`.

- [ ] **Step 1: Add imports**

In `src/components/planner/PlannerTab.tsx`, with the other component imports (near `import { TransferPlanTable } from './TransferPlanTable'`), add:

```tsx
import { FixtureHeatMap } from '@/components/club-form/FixtureHeatMap'
import { CaptainPlanStrip } from './CaptainPlanStrip'
```

Ensure `useMemo` is imported from `'react'` (it already is — `scoredPlayers` uses it). If not, add it.

- [ ] **Step 2: Add a component-level playerMap memo**

The handlers build `new Map(scoredPlayers.map(p => [p.id, p]))` locally; the render needs one too. Add near the other derived values (after `scoredPlayers` is defined, before the `return`):

```tsx
  const playerMapForStrip = useMemo(
    () => new Map(scoredPlayers.map((p) => [p.id, p])),
    [scoredPlayers],
  )
```

- [ ] **Step 3: Render FixtureHeatMap at the top + CaptainPlanStrip above the route**

In the render, the block is:

```tsx
  return (
    <div className="space-y-6">
      <ChipStrategyPanel ... />
      <button ...>Generate Plan</button>
      <details ...>...</details>

      {planResult && (
        <TransferPlanTable ... />
      )}
    </div>
  )
```

Change it to render the fixture outlook first, and the captain strip above the route:

```tsx
  return (
    <div className="space-y-6">
      {/* Redesign §4: fixture outlook (self-contained; owned rows highlighted via teamId) */}
      <FixtureHeatMap submittedId={teamId} />

      <ChipStrategyPanel ...unchanged... />
      <button ...unchanged...>Generate Plan</button>
      <details ...unchanged...>...</details>

      {planResult && (
        <>
          {/* Redesign §4: per-GW captain plan along the generated route */}
          <CaptainPlanStrip steps={planResult.steps} playerMap={playerMapForStrip} />
          <TransferPlanTable ...unchanged... />
        </>
      )}
    </div>
  )
```

Keep `ChipStrategyPanel`, the Generate button, the `<details>`, and `TransferPlanTable` with ALL their existing props exactly as they are — only add the two new elements and wrap the `planResult` block in a fragment.

- [ ] **Step 4: Run the planner suite + page sweep**

Run: `npx vitest run src/components/planner/ src/app/page.test.tsx`
Expected: PASS. If a `PlannerTab` test asserted the exact first-child/order that `FixtureHeatMap` now precedes, update it to match (the existing elements are unchanged; one element was prepended). Note any such change in your report.

Note: `FixtureHeatMap` fetches its own hooks; if the `PlannerTab` test env doesn't mock them it will fall back to its loading/empty state (harmless — it renders no crash). If it causes noise, mock `@/components/club-form/FixtureHeatMap` to a stub in the `PlannerTab` test file.

- [ ] **Step 5: tsc check**

Run: `npx tsc --noEmit`
Expected: 0 errors (vitest does not type-check — confirm the new code + wiring is type-clean).

- [ ] **Step 6: Commit**

```bash
git add src/components/planner/PlannerTab.tsx
git commit -m "feat(planner): fixture outlook + captain plan strip (outlook redesign)"
```

---

## Notes for the implementer

- `gw_xpts` is indexed by plan-step position (`i`), which equals the offset from the next GW — the planner's `startingGw` is the next unfinished GW, so `gw_xpts[0]` is step 0. Do not index by `step.gw` directly.
- Do not touch the plan engine, `ChipStrategyPanel`, `TransferPlanTable`, or the handlers — this is purely additive rendering.
- `FixtureHeatMap` is the same component already used in `NextSeasonPlannerTab`; reuse verbatim.
