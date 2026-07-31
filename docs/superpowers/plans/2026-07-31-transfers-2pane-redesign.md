# Transfers 2-Pane Redesign + "Why X over Y?" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Transfers screen to the mockup's 2-pane core (squad | best-moves + a new comparative "Why X over Y?" explainer), preserving every existing feature.

**Architecture:** A new pure `compareTransfers(x, y)` helper generates comparative reasons + a risk line from two `MergedPlayer`s; a thin `WhyOverCard` renders it; `TransferPanel` wraps its Your-Squad and OCS blocks in a 2-column grid and feeds the top-2 OCS buy candidates to the card. No engine changes.

**Tech Stack:** React (client components), TypeScript, vitest + Testing Library.

## Global Constraints

- **Keep-all-features (UIX-01):** no existing feature may be removed — auth flow, `RejectionSearchCallout`, `HighOwnershipCallout`, `CaptaincyPanel`, OCS, and `SquadView` all survive.
- Reuse existing data/engines: `explainPick` (risks), `ocsSuggestions` (the OCS list `TransferSuggestion[]`), `SquadView` (already shows verdicts + xPts). No new pipeline/engine work.
- `haul_prob` is an OPTIONAL `MergedPlayer` field (MC sim; absent off-season) — guard on presence.
- No `Co-Authored-By` trailers on commits.
- Tests run with vitest: `npx vitest run <path>`.
- Work on branch `redesign/transfers-2pane`.

---

### Task 1: `compareTransfers` helper

**Files:**
- Create: `src/lib/compare-transfers.ts`
- Test: `src/lib/compare-transfers.test.ts`

**Interfaces:**
- Consumes: `MergedPlayer` (`@/lib/types`), `explainPick` (`@/lib/explain-pick`).
- Produces: `compareTransfers(x: MergedPlayer, y: MergedPlayer): { reasons: string[]; risk: string | null }`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/compare-transfers.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { compareTransfers } from './compare-transfers'
import type { MergedPlayer } from './types'

// Minimal MergedPlayer — only the fields compareTransfers + explainPick read.
function mk(over: Partial<MergedPlayer> = {}): MergedPlayer {
  return {
    id: 1, web_name: 'X', team_short_name: 'ARS', element_type: 3,
    now_cost: 80, selected_by_percent: '10.0', status: 'a', news: '',
    mins_risk: 'nailed', rotation_risk: false, penalties_order: null,
    xPts_1gw: 5, xPts_5gw: 20, haul_prob: 0.2, fixtures: [],
    xg_per90: 0.3, xa_per90: 0.2, blank_prob: 0.1,
    ...over,
  } as unknown as MergedPlayer
}

describe('compareTransfers', () => {
  it('adds a ceiling reason when x has higher haul_prob', () => {
    const r = compareTransfers(mk({ web_name: 'Marmoush', haul_prob: 0.28 }), mk({ web_name: 'Gordon', haul_prob: 0.19 }))
    expect(r.reasons).toContain('Higher ceiling: haul 28% vs 19%')
  })

  it('adds a horizon reason only when the edge grows over 5 GW', () => {
    const r = compareTransfers(
      mk({ xPts_1gw: 6, xPts_5gw: 25 }),   // Δ1 = +1.1, Δ5 = +3.2 vs y below
      mk({ xPts_1gw: 4.9, xPts_5gw: 21.8, haul_prob: 0.2 }),
    )
    expect(r.reasons.some(s => s.startsWith('xPts gap grows'))).toBe(true)
  })

  it('adds a penalty reason when x is on pens and y is not', () => {
    const r = compareTransfers(mk({ penalties_order: 1 }), mk({ web_name: 'Gordon', penalties_order: null }))
    expect(r.reasons).toContain('On penalties — Gordon isn’t')
  })

  it('adds a differential reason when x is >=10pp lower owned', () => {
    const r = compareTransfers(mk({ selected_by_percent: '3.0' }), mk({ web_name: 'Gordon', selected_by_percent: '18.0' }))
    expect(r.reasons.some(s => s.startsWith('More differential'))).toBe(true)
  })

  it('composes the risk line from explainPick + safer-floor note', () => {
    const r = compareTransfers(mk({ mins_risk: 'rotation_risk' }), mk({ web_name: 'Gordon' }))
    expect(r.risk).toBe('Rotation risk — Gordon is the safer floor pick')
  })

  it('yields no reasons for two near-identical players', () => {
    const r = compareTransfers(mk({ haul_prob: 0.2 }), mk({ haul_prob: 0.2 }))
    expect(r.reasons).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/compare-transfers.test.ts`
Expected: FAIL — `Cannot find module './compare-transfers'`.

- [ ] **Step 3: Implement the helper**

Create `src/lib/compare-transfers.ts`:

```ts
// Redesign §4: comparative "why X over Y" reasons for the Transfers explainer.
// Pure — given the preferred target x and runner-up y, returns the strongest 2-3
// comparative reasons plus a risk line (x's top risk + y as the safer floor).
import type { MergedPlayer } from './types'
import { explainPick } from './explain-pick'

export interface TransferComparison {
  reasons: string[]
  risk: string | null
}

export function compareTransfers(x: MergedPlayer, y: MergedPlayer): TransferComparison {
  const reasons: string[] = []

  // Ceiling — needs MC haul_prob on both (absent off-season → skip).
  if (x.haul_prob != null && y.haul_prob != null && x.haul_prob > y.haul_prob) {
    reasons.push(`Higher ceiling: haul ${Math.round(x.haul_prob * 100)}% vs ${Math.round(y.haul_prob * 100)}%`)
  }

  // Horizon — the edge grows over the 5-GW window.
  const d1 = (x.xPts_1gw ?? 0) - (y.xPts_1gw ?? 0)
  const d5 = (x.xPts_5gw ?? 0) - (y.xPts_5gw ?? 0)
  if (d5 > d1 && d5 > 0) {
    reasons.push(`xPts gap grows: +${d1.toFixed(1)} (1GW) → +${d5.toFixed(1)} (5GW)`)
  }

  // Penalty edge.
  if (x.penalties_order === 1 && y.penalties_order !== 1) {
    reasons.push(`On penalties — ${y.web_name} isn’t`)
  }

  // Differential — x meaningfully lower-owned.
  const xOwn = parseFloat(x.selected_by_percent)
  const yOwn = parseFloat(y.selected_by_percent)
  if (Number.isFinite(xOwn) && Number.isFinite(yOwn) && yOwn - xOwn >= 10) {
    reasons.push(`More differential (${xOwn.toFixed(1)}% vs ${yOwn.toFixed(1)}% owned)`)
  }

  const topRisk = explainPick(x).risks[0]
  const risk = topRisk ? `${topRisk} — ${y.web_name} is the safer floor pick` : null

  return { reasons: reasons.slice(0, 3), risk }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/compare-transfers.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/compare-transfers.ts src/lib/compare-transfers.test.ts
git commit -m "feat(transfers): compareTransfers helper for the Why-over-Y explainer"
```

---

### Task 2: `WhyOverCard` component

**Files:**
- Create: `src/components/transfers/WhyOverCard.tsx`
- Test: `src/components/transfers/WhyOverCard.test.tsx`

**Interfaces:**
- Consumes: `compareTransfers` (Task 1), `MergedPlayer`.
- Produces: `WhyOverCard({ x, y }: { x: MergedPlayer; y: MergedPlayer })`. Renders `null` when the comparison has neither reasons nor risk.

- [ ] **Step 1: Write the failing test**

Create `src/components/transfers/WhyOverCard.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import type { MergedPlayer } from '@/lib/types'
import { WhyOverCard } from './WhyOverCard'

function mk(over: Partial<MergedPlayer> = {}): MergedPlayer {
  return {
    id: 1, web_name: 'X', team_short_name: 'ARS', element_type: 3, now_cost: 80,
    selected_by_percent: '10.0', status: 'a', news: '', mins_risk: 'nailed',
    rotation_risk: false, penalties_order: null, xPts_1gw: 5, xPts_5gw: 20,
    haul_prob: 0.2, fixtures: [], xg_per90: 0.3, xa_per90: 0.2, blank_prob: 0.1,
    ...over,
  } as unknown as MergedPlayer
}

describe('WhyOverCard', () => {
  it('renders the header, a numbered reason, and the risk line', () => {
    const { container } = render(
      <WhyOverCard
        x={mk({ web_name: 'Marmoush', haul_prob: 0.28, mins_risk: 'rotation_risk' })}
        y={mk({ web_name: 'Gordon', haul_prob: 0.19 })}
      />,
    )
    expect(container.textContent).toContain('Why Marmoush over Gordon?')
    expect(container.textContent).toContain('Higher ceiling: haul 28% vs 19%')
    expect(container.textContent).toContain('Gordon is the safer floor pick')
    expect(container.textContent).toContain('01')
  })

  it('renders nothing when the comparison is empty', () => {
    const { container } = render(<WhyOverCard x={mk({ haul_prob: 0.2 })} y={mk({ haul_prob: 0.2 })} />)
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/transfers/WhyOverCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `src/components/transfers/WhyOverCard.tsx`:

```tsx
'use client'

// Redesign §4 (Transfers): the "Why X over Y?" explainer — numbered comparative
// reasons + an amber risk line, from compareTransfers(). Renders nothing when
// there is nothing to say (e.g. two near-identical candidates).
import type { MergedPlayer } from '@/lib/types'
import { compareTransfers } from '@/lib/compare-transfers'

export function WhyOverCard({ x, y }: { x: MergedPlayer; y: MergedPlayer }) {
  const { reasons, risk } = compareTransfers(x, y)
  if (reasons.length === 0 && !risk) return null

  return (
    <div className="rounded-lg border border-line bg-surface-1 p-4">
      <h3 className="text-h4 font-semibold text-ink mb-2">
        Why {x.web_name} over {y.web_name}?
      </h3>
      <ul className="space-y-1.5">
        {reasons.map((r, i) => (
          <li key={r} className="flex gap-2 text-data text-ink">
            <span className="tabular text-accent font-semibold shrink-0">{String(i + 1).padStart(2, '0')}</span>
            <span>{r}</span>
          </li>
        ))}
        {risk && (
          <li className="flex gap-2 text-data text-ink-muted">
            <span className="text-warning font-semibold shrink-0">!</span>
            <span>Risk: {risk}</span>
          </li>
        )}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/components/transfers/WhyOverCard.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/transfers/WhyOverCard.tsx src/components/transfers/WhyOverCard.test.tsx
git commit -m "feat(transfers): WhyOverCard explainer component"
```

---

### Task 3: `TransferPanel` — 2-pane layout + wire the explainer

**Files:**
- Modify: `src/components/transfers/TransferPanel.tsx`

**Interfaces:**
- Consumes: `WhyOverCard` (Task 2), the existing `ocsSuggestions: TransferSuggestion[]` and `SquadView`/`OpportunityCostTable`/`CaptaincyPanel`/`HighOwnershipCallout`.
- `TransferSuggestion` is a union; `kind: 'single'` has `buy: MergedPlayer` + `xPtsGain`.

- [ ] **Step 1: Import WhyOverCard**

In `src/components/transfers/TransferPanel.tsx`, with the other `@/components/transfers/*` imports (near `import { OpportunityCostTable } ...`), add:

```tsx
import { WhyOverCard } from '@/components/transfers/WhyOverCard'
```

- [ ] **Step 2: Derive the top-2 buy candidates**

Add a memo near the other derived memos (after `ocsSuggestions` is defined, ~line 137). It picks the two highest-gain SINGLE suggestions' buy players:

```tsx
  // Redesign §4: top-2 distinct buy candidates for the Why-over-Y explainer.
  const [whyX, whyY] = useMemo(() => {
    const buys = ocsSuggestions
      .filter((s): s is Extract<TransferSuggestion, { kind: 'single' }> => s.kind === 'single')
      .sort((a, b) => b.xPtsGain - a.xPtsGain)
      .map((s) => s.buy)
    const first = buys[0]
    const second = buys.find((b) => b.id !== first?.id)
    return [first, second] as const
  }, [ocsSuggestions])
```

- [ ] **Step 3: Wrap Your-Squad + OCS in a 2-column grid and render WhyOverCard**

In the render, the block currently reads (verbatim, ~line 388-455, condensed for the anchor):

```tsx
      {squadData && scoredPlayers.length > 0 && (
        <>
          {/* Squad display */}
          <div className="rounded border border-line p-4">
            <h2 className="text-base font-semibold text-ink mb-3">Your Squad</h2>
            <SquadView ... />
          </div>

          {/* Captaincy picks */}
          {captaincyCandidates.length > 0 && (
            <CaptaincyPanel candidates={captaincyCandidates} nextGw={nextGw} />
          )}

          {/* Phase 65 WHY-02: callout above OCS section (D-11) — visible only when entries non-empty. */}
          <HighOwnershipCallout entries={highOwnershipAbsent} />

          {/* OCS section */}
          <div className="rounded border border-line p-4 space-y-3">
            ... OCS header + OpportunityCostTable ...
          </div>
        </>
      )}
```

Restructure it to a 2-column grid — **left pane** = Your Squad + Captaincy; **right pane** = HighOwnership + OCS + WhyOverCard. Keep every child element identical; only the wrapping/order changes:

```tsx
      {squadData && scoredPlayers.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          {/* Left pane: your squad + captaincy */}
          <div className="space-y-4">
            <div className="rounded border border-line p-4">
              <h2 className="text-base font-semibold text-ink mb-3">Your Squad</h2>
              <SquadView ...unchanged props... />
            </div>
            {captaincyCandidates.length > 0 && (
              <CaptaincyPanel candidates={captaincyCandidates} nextGw={nextGw} />
            )}
          </div>

          {/* Right pane: high-ownership callout + best moves (OCS) + why-over-Y */}
          <div className="space-y-4">
            <HighOwnershipCallout entries={highOwnershipAbsent} />
            <div className="rounded border border-line p-4 space-y-3">
              ...OCS header + OpportunityCostTable unchanged...
            </div>
            {whyX && whyY && <WhyOverCard x={whyX} y={whyY} />}
          </div>
        </div>
      )}
```

Keep the `SquadView` props, the OCS header (GwToggle, Target-GW select, italics), and `OpportunityCostTable` props exactly as they are — only the surrounding `<>` becomes the grid and the blocks are grouped into the two panes. Do NOT touch anything above this block (Load-Squad form, auth, `RejectionSearchCallout`).

- [ ] **Step 4: Run the Transfers suite + related**

Run: `npx vitest run src/components/transfers/`
Expected: PASS — existing `TransferPanel`, `OpportunityCostTable`, `HighOwnershipCallout`, `WhyOverCard` tests all green. If a `TransferPanel` test asserted a specific single-column DOM order that the grid changes, update that assertion to match the new pane grouping (the elements still exist; only nesting changed).

- [ ] **Step 5: Run the page render sweep**

Run: `npx vitest run src/app/page.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/transfers/TransferPanel.tsx
git commit -m "feat(transfers): 2-pane layout (squad | moves + Why-over-Y)"
```

---

## Notes for the implementer

- `TransferSuggestion.buy` is already a full `MergedPlayer` — no `playersData` lookup is needed for the explainer.
- `haul_prob` may be absent (off-season, no MC) — `compareTransfers` already guards; the explainer then leans on the horizon/pen/differential reasons.
- Do not remove or relocate the auth flow or `RejectionSearchCallout` (they sit above this block); the keep-all-features contract is binding.
