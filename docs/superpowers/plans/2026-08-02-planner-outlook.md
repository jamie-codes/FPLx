# Planner Outlook Implementation Plan — Fixture Grid + Captain Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the mockup's fixture-outlook grid and per-GW captain-plan strip to the Planner, preserving the existing interactive transfer-plan generator.

**Architecture:** A pure `bestCaptainPerGw(steps, playerMap)` helper (uses `MergedPlayer.gw_xpts` per-GW) feeds a new `CaptainPlanStrip`; `PlannerTab` renders the existing self-contained `FixtureHeatMap` at the top and `CaptainPlanStrip` when a plan exists. No engine changes.

**Tech Stack:** React (client components), TypeScript, vitest + Testing Library.

## Global Constraints

- **Keep-all-features (UIX-01):** the existing generator (Generate button, `ChipStrategyPanel`, `TransferPlanTable` with chip toggles + manual overrides + restore, the chips `<details>`) all survive unchanged.
- Reuse: `FixtureHeatMap` (self-contained), `getTeamColour`. No plan-engine change (the pipeline change in Task 1 is a xPts-exposure add, not an engine change).
- **`MergedPlayer.gw_xpts` does NOT exist yet** — Task 1 adds it (per-GW xPts via merge.py's existing `_xpts_per_gw`). Downstream, `gw_xpts[i]` aligns with plan step index `i` (step 0 = the next GW, matching `gw_xpts[0]`). Guard `gw_xpts?.[i] ?? 0`.
- No `Co-Authored-By` trailers. Do NOT use `git stash` for verification — run `npx vitest`/`pytest` directly.
- JS tests: `npx vitest run <path>`. Python tests: `cd pipeline && PYTHONIOENCODING=utf-8 python -m pytest <path>`. Work on branch `redesign/planner-outlook`.

---

### Task 1: Attach per-GW xPts (`gw_xpts`) to merged players [pipeline]

**Files:**
- Modify: `pipeline/merge.py` (call `_xpts_per_gw`, attach `player['gw_xpts']`, after the `xPts_5gw` assignment ~line 1570)
- Modify: `src/lib/types.ts` (add `gw_xpts?: number[]` to `MergedPlayer`)
- Test: `pipeline/tests/test_merge.py` (append a gw_xpts test)

**Interfaces:**
- Consumes: `_xpts_per_gw(xg_per90, xa_per90, start_prob, xmins, element_type, fixtures, n_gws, ...) -> list[float]` (merge.py:521; per-GW xPts, DGW-combined; length ≤ n_gws).
- Produces: `player['gw_xpts']: list[float]` (per-GW xPts, next 5 GWs); `MergedPlayer.gw_xpts?: number[]`.

- [ ] **Step 1: Write the failing test**

Append to `pipeline/tests/test_merge.py` (reuse the existing `_build_minimal_inputs` + `_hist` helpers; players get fixtures over the finished+5 GWs):

```python
def test_merge_writes_gw_xpts_per_gw():
    """GWI-04: each merged player gets a gw_xpts list — per-GW xPts, len <= 5."""
    history = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 11)]
    bootstrap, fixtures, understat, id_map, xmins_stats, summaries = _build_minimal_inputs({1: history})
    merged, _ = merge_players(bootstrap, fixtures, understat, id_map,
                              xmins_stats=xmins_stats, summaries=summaries)
    p = next(pl for pl in merged if pl['id'] == 1)
    assert 'gw_xpts' in p
    assert isinstance(p['gw_xpts'], list)
    assert 0 < len(p['gw_xpts']) <= 5
    assert all(isinstance(x, (int, float)) for x in p['gw_xpts'])
    assert p['gw_xpts'][0] > 0
```

- [ ] **Step 2: Run to verify fail**

Run: `cd pipeline && PYTHONIOENCODING=utf-8 python -m pytest tests/test_merge.py::test_merge_writes_gw_xpts_per_gw -v`
Expected: FAIL — `'gw_xpts' not in p`.

- [ ] **Step 3: Attach gw_xpts in merge.py**

In `pipeline/merge.py`, immediately after `player['xPts_5gw'] = xpts_5gw` (~line 1570), add a call to `_xpts_per_gw` mirroring the `_xpts_ngw` per-player variables and attach the rounded result:

```python
        gw_xpts = _xpts_per_gw(
            xpts_xg_per90, xpts_xa_per90, player_start_prob, player_xmins,
            element['element_type'], player_fixtures, 5,
            xmins_v2_enabled=xmins_v2_enabled, mins_60_prob=player_mins_60_prob,
            bonus_predictor_enabled=bonus_predictor_enabled, bonus_ev=player_bonus_ev,
            save_predictor_enabled=save_predictor_enabled,
            cs_prob_base=cs_prob_base, cs_prob_slope=cs_prob_slope,
            sub_appear_prob=player_sub_appear_prob,
            cs_team_form_slope=cs_team_form_slope,
            atf_slope=atf_slope, fas_slope=fas_slope,
            defcon_rate=player_defcon_rate, defcon_scale=defcon_scale,
        )
        player['gw_xpts'] = [round(x, 4) for x in gw_xpts]
```

`_xpts_per_gw` has NO `odds_lookup`/`team_id` params — do not pass them; the per-GW breakdown omits the ODDS-01 blend, which is acceptable for the captain-plan use. Confirm the per-player variable names against the adjacent `_xpts_ngw` calls (`player_start_prob`, `player_xmins`, `player_fixtures`, `player_mins_60_prob`, `player_bonus_ev`, `player_sub_appear_prob`, `player_defcon_rate`) before editing; if any differ, STOP and report.

- [ ] **Step 4: Add the type field**

In `src/lib/types.ts`, inside the `MergedPlayer` interface (near `xPts_5gw?`), add:

```ts
  gw_xpts?: number[]          // per-GW xPts, next 5 GWs (DGW-combined). GWI-04 helper; absent pre-merge.
```

- [ ] **Step 5: Run tests + tsc**

Run: `cd pipeline && PYTHONIOENCODING=utf-8 python -m pytest tests/test_merge.py -q` → PASS (new + existing merge tests).
Run: `npx tsc --noEmit` → 0 errors.

- [ ] **Step 6: Commit**

```bash
git add pipeline/merge.py src/lib/types.ts pipeline/tests/test_merge.py
git commit -m "feat(pipeline): expose per-GW xPts (gw_xpts) on merged players"
```

Note: production `merged_players.json` gains `gw_xpts` on the next pipeline run; the frontend guards on absence (`gw_xpts?.[i] ?? 0`), so nothing breaks before then.

---

### Task 2: `bestCaptainPerGw` helper

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

### Task 3: `CaptainPlanStrip` component

**Files:**
- Create: `src/components/planner/CaptainPlanStrip.tsx`
- Test: `src/components/planner/CaptainPlanStrip.test.tsx`

**Interfaces:**
- Consumes: `bestCaptainPerGw` (Task 2), `getTeamColour` (`@/lib/team-colours`), `MergedPlayer`/`PlanStep`.
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

### Task 4: Wire into `PlannerTab` (fixture outlook + captain strip)

**Files:**
- Modify: `src/components/planner/PlannerTab.tsx`

**Interfaces:**
- Consumes: `FixtureHeatMap` (`@/components/club-form/FixtureHeatMap`, props `{ submittedId?: string | null }`), `CaptainPlanStrip` (Task 3). `PlannerTab` has local `teamId: string | null`, `scoredPlayers: ScoredPlayer[]`, `planResult: PlanResult | null` with `planResult.steps: PlanStep[]`.

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
