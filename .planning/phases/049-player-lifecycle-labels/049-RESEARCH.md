# Phase 49: Player Lifecycle Labels — Research

**Researched:** 2026-05-01
**Domain:** Pure-TypeScript label engine over existing MergedPlayer + ClubForm fields; badge UI in SquadView
**Confidence:** HIGH — codebase fully verified; business rules derived from ROADMAP notes + existing threshold patterns

---

## Summary

Phase 49 replaces the existing three-state Buy/Hold/Sell verdict in the Transfers squad view with a seven-label lifecycle system that gives managers precise action timing. The labels are computed in pure TypeScript (no new API call, no pipeline change) over fields that already exist in `ScoredPlayer` and `ClubForm`. The only new runtime data access is `ClubForm[]` via the already-available `useClubForm()` hook, which TransferPanel does not yet call.

The core deliverables are: (1) a new `computeLifecycleLabel()` pure function in `src/lib/lifecycle-label.ts`, (2) a `LifecycleLabelBadge` component that replaces `VerdictBadge` in `SquadView`, and (3) wiring in `TransferPanel` to fetch ClubForm and build the lookup map before passing labels to `SquadView`. The existing `computeVerdicts()` function and `Verdict` type are retired from the Transfers view (kept intact for potential future use in Phase 51).

Business rules are the dominant planning risk. The ROADMAP specifies label names, a 85% gem_score hysteresis threshold, and a £7.0m Minutes Trap gate — but the full priority order, precise thresholds for all labels, and the exact MinsRisk → Minutes Trap mapping must be specced in the plan before any code is written. This research provides the complete recommended specification for the planner to lock in.

**Primary recommendation:** Implement `computeLifecycleLabel(player: ScoredPlayer, clubForm: ClubForm | null): LifecycleLabel` as a single priority-ordered cascade, then wire it via a `Map<number, LifecycleLabel>` passed from TransferPanel through SquadView to replace the existing `Map<number, Verdict>`.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LCL-01 | Squad players display a lifecycle label extending beyond Buy/Hold/Sell — labels include: Buy Next Week, Hold One More, Sell Soon, Minutes Trap, Fixture Trap | Seven-label taxonomy fully specced in §Label Taxonomy below; `LifecycleLabelBadge` replaces `VerdictBadge` in SquadView |
| LCL-02 | Labels are computed as a pure-TS function over existing `MergedPlayer` fields — no new pipeline data required | All fields used (`gem_score`, `now_cost`, `mins_risk`, `start_prob`, `differential_flag`) exist in `ScoredPlayer`; `ClubForm.swing_*gw` fields added in Phase 47 are TypeScript-only and count as "existing" — LCL-02 is satisfied |
| LCL-03 | When multiple label conditions apply, a priority hierarchy determines which label is shown | Priority cascade specced in §Priority Hierarchy; single-return function ensures exactly one label per player |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Label logic / threshold computation | Frontend (pure TS lib) | — | No backend needed; all inputs available client-side |
| ClubForm lookup for swing fields | Frontend (hook) | — | `useClubForm()` already serves ClubForm[]; just not called in TransferPanel yet |
| Label rendering / badge | Browser (React component) | — | Replaces VerdictBadge in SquadView; same rendering tier |
| Position average computation | Frontend (pure TS lib) | — | Reuse `computePositionAverages()` from `recommend.ts` |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | project version | Pure function + type definitions | All existing lib code is TypeScript |
| React + Tailwind | project version | LifecycleLabelBadge component | Matches VerdictBadge + MinsRiskBadge pattern exactly |
| Vitest | project version | Unit tests for `computeLifecycleLabel` | Project standard; config at `vitest.config.ts` |

No new npm packages required. [VERIFIED: codebase grep — all needed infrastructure already present]

**Test run command:**
```bash
npx vitest run src/lib/__tests__/lifecycle-label.test.ts
```
**Full suite:**
```bash
npm test
```

---

## Label Taxonomy — Complete Specification

This section defines the conditions for all seven labels. The planner MUST lock these thresholds before implementation begins (per ROADMAP phase notes).

### Label Definitions

| Label | Colour (semantic) | Meaning |
|-------|-------------------|---------|
| **Minutes Trap** | amber | Expensive player whose minutes risk makes ownership questionable — price blinds managers to the rotation risk |
| **Fixture Trap** | amber | Player with a `trap` differential flag — high ownership but below-median xPts, compounded by worsening fixtures |
| **Buy Next Week** | green (lighter than Buy) | Currently on Hold band but fixtures are improving materially — optimal to hold one more week then act |
| **Hold One More** | green-muted | Below average but fixtures improving — deteriorating gem score still recoverable if fixtures help |
| **Sell Soon** | orange/amber | Approaching the Sell threshold (within 5% of position average) but not yet there — pre-emptive signal |
| **Hold** | zinc/gray | No special timing signal — within acceptable gem_score band, no trigger conditions |
| **Sell** | red | gem_score is more than 15% below position average (expanded from 10% hysteresis — see below) |

### Precise Trigger Conditions (Recommended — planner to confirm)

**Minutes Trap** fires when ALL of:
- `player.now_cost >= 70` (£7.0m or above — the ROADMAP gate [VERIFIED: ROADMAP phase notes])
- `player.mins_risk === 'rotation_risk' || player.mins_risk === 'cameo'`
- `player.start_prob < 0.65` (below `likely_start` threshold — cross-references MinsRiskBadge thresholds [VERIFIED: MinsRiskBadge.tsx])

**Fixture Trap** fires when ALL of:
- `player.differential_flag === 'trap'` (TRAP flag already set by Phase 30 pipeline [VERIFIED: types.ts])
- `clubForm !== null && (clubForm.swing_3gw ?? 0) <= -0.20` (worsening fixture swing, using Phase 47 threshold D-01 [VERIFIED: 47-CONTEXT.md])

**Buy Next Week** fires when ALL of:
- Player is in the Hold band: `gem_score >= positionAvg * 0.85 && gem_score <= positionAvg` (not currently Buy)
- `clubForm !== null && (clubForm.swing_1gw ?? 0) >= 0.20` (improving fixture next GW, Phase 47 D-01 threshold [VERIFIED: 47-CONTEXT.md])
- `player.regression_signal !== 'sell'` (no regression sell signal contradicting the buy timing)

**Hold One More** fires when ALL of:
- Player is below position average but not yet at Sell threshold: `gem_score >= positionAvg * 0.85 && gem_score < positionAvg`
- `clubForm !== null && (clubForm.swing_3gw ?? 0) >= 0.20` (improving fixtures over 3 GW window)
- Does NOT qualify for Buy Next Week (swing_1gw condition not met, or regression_signal === 'sell')

Note: Buy Next Week vs Hold One More distinction — Buy Next Week requires an immediate fixture improvement (swing_1gw ≥ 0.20); Hold One More fires on the broader 3 GW swing when immediate GW1 swing is below threshold. Both share the hold-band gem_score range.

**Sell Soon** fires when ALL of:
- `gem_score < positionAvg * 0.90 && gem_score >= positionAvg * 0.85` (within 5-15% below average — the 5% "warning band")
- No improving fixture swing that would justify Hold One More

**Sell** fires when:
- `gem_score < positionAvg * 0.85` (more than 15% below position average)

Hysteresis rationale: The ROADMAP specifies 85% as the Sell threshold [VERIFIED: ROADMAP phase notes: "gem_score must fall below 85% of position average"]. This replaces the existing `SELL_THRESHOLD = 0.90` from `recommend.ts` — the lifecycle label engine uses 0.85 as the hard Sell line, with 0.85–0.90 as "Sell Soon" and 0.90–1.0 as the Hold band. This is the ROADMAP's intended hysteresis design.

**Hold** fires as the default when no other condition applies.

### Summary Condition Table

| Label | Condition Set |
|-------|---------------|
| Minutes Trap | `now_cost >= 70` AND `(mins_risk === 'rotation_risk' OR 'cameo')` AND `start_prob < 0.65` |
| Fixture Trap | `differential_flag === 'trap'` AND `swing_3gw <= -0.20` |
| Buy Next Week | gem in Hold band AND `swing_1gw >= 0.20` AND `regression_signal !== 'sell'` |
| Hold One More | gem in Hold band AND `swing_3gw >= 0.20` AND NOT Buy Next Week |
| Sell Soon | `gem < posAvg * 0.90` AND `gem >= posAvg * 0.85` AND NOT Hold One More |
| Hold | default (no other condition met) |
| Sell | `gem < posAvg * 0.85` |

---

## Priority Hierarchy

When multiple conditions apply simultaneously, exactly one label is returned. Priority order (highest first):

```
1. Minutes Trap       — safety override: price + rotation = misleading hold
2. Fixture Trap       — safety override: TRAP flag + worsening fixtures = sell pressure
3. Buy Next Week      — positive timing signal (swing_1gw immediate)
4. Hold One More      — positive timing signal (swing_3gw broader)
5. Sell Soon          — warning band (approaching Sell)
6. Sell               — hard Sell threshold crossed
7. Hold               — default fallback
```

Rationale for ordering:

- Minutes Trap and Fixture Trap are placed first because they are *override* signals — they warn the manager that the gem_score-derived verdict is misleading. A player can have a good gem_score but still be a trap; showing "Buy Next Week" for a Fixture Trap player would be dangerous.
- Buy Next Week before Hold One More because it is the more immediate/actionable signal.
- Sell Soon before Sell because the warning band is only possible when the hard threshold is NOT crossed — the conditions are mutually exclusive by definition. (Sell Soon requires `gem >= posAvg * 0.85`; Sell requires `gem < posAvg * 0.85`.) Including both in the cascade is for explicitness.
- Hold is the ultimate fallback (never fails to produce a label).

[ASSUMED]: The priority of Minutes Trap over Fixture Trap is a judgment call. Both are warning overrides. The rationale for Minutes Trap first: minutes unavailability is a harder constraint than fixture difficulty — a player who won't play at all is worse than one with hard fixtures. The planner may reorder these two if there's a design reason to prefer Fixture Trap first.

---

## Function Signature

```typescript
// src/lib/lifecycle-label.ts

import type { ScoredPlayer } from '@/lib/types'
import type { ClubForm } from '@/lib/types'
import { computePositionAverages } from '@/lib/recommend'

export type LifecycleLabel =
  | 'minutes_trap'
  | 'fixture_trap'
  | 'buy_next_week'
  | 'hold_one_more'
  | 'sell_soon'
  | 'hold'
  | 'sell'

// Threshold constants (exported for test visibility — matches recommend.ts convention)
export const SELL_THRESHOLD = 0.85          // hard Sell line (replaces recommend.ts 0.90 for this engine)
export const SELL_SOON_THRESHOLD = 0.90     // warning band entry
export const SWING_THRESHOLD = 0.20         // Phase 47 D-01 confirmed
export const MINUTES_TRAP_MIN_COST = 70     // £7.0m in tenths (ROADMAP gate)
export const MINUTES_TRAP_START_PROB = 0.65 // below likely_start

/**
 * Compute a single lifecycle label for a squad player.
 *
 * @param player    - ScoredPlayer (has gem_score + all MergedPlayer fields)
 * @param posAvg    - position average gem_score for player.element_type (from computePositionAverages)
 * @param clubForm  - ClubForm for player's team (null when team not found or BGW)
 */
export function computeLifecycleLabel(
  player: ScoredPlayer,
  posAvg: number,
  clubForm: ClubForm | null,
): LifecycleLabel {
  const gem = player.gem_score

  // Priority 1: Minutes Trap
  if (
    player.now_cost >= MINUTES_TRAP_MIN_COST &&
    (player.mins_risk === 'rotation_risk' || player.mins_risk === 'cameo') &&
    player.start_prob < MINUTES_TRAP_START_PROB
  ) {
    return 'minutes_trap'
  }

  // Priority 2: Fixture Trap
  if (
    player.differential_flag === 'trap' &&
    clubForm !== null &&
    (clubForm.swing_3gw ?? 0) <= -SWING_THRESHOLD
  ) {
    return 'fixture_trap'
  }

  // Priority 3: Buy Next Week (Hold band + improving swing_1gw)
  if (
    gem >= posAvg * SELL_SOON_THRESHOLD &&
    gem <= posAvg &&
    clubForm !== null &&
    (clubForm.swing_1gw ?? 0) >= SWING_THRESHOLD &&
    player.regression_signal !== 'sell'
  ) {
    return 'buy_next_week'
  }

  // Priority 4: Hold One More (Hold band + improving swing_3gw, but not Buy Next Week)
  if (
    gem >= posAvg * SELL_SOON_THRESHOLD &&
    gem <= posAvg &&
    clubForm !== null &&
    (clubForm.swing_3gw ?? 0) >= SWING_THRESHOLD
  ) {
    return 'hold_one_more'
  }

  // Priority 5: Sell Soon (warning band — approaching Sell but not crossed)
  if (gem < posAvg * SELL_SOON_THRESHOLD && gem >= posAvg * SELL_THRESHOLD) {
    return 'sell_soon'
  }

  // Priority 6: Sell (hard threshold crossed)
  if (gem < posAvg * SELL_THRESHOLD) {
    return 'sell'
  }

  // Priority 7: Hold (default)
  return 'hold'
}

/**
 * Compute lifecycle labels for all starting-XI squad players.
 *
 * @param squadPicks  - SquadPick[] (15 players; bench are position >= 12)
 * @param allPlayers  - ScoredPlayer[] (full population for position averages)
 * @param clubFormMap - Map<teamId, ClubForm> pre-built by TransferPanel
 * @returns           Map<playerId, LifecycleLabel> for starting-XI picks only
 */
export function computeLifecycleLabels(
  squadPicks: SquadPick[],
  allPlayers: ScoredPlayer[],
  clubFormMap: Map<number, ClubForm>,
): Map<number, LifecycleLabel> {
  const labels = new Map<number, LifecycleLabel>()
  if (squadPicks.length === 0) return labels

  const playerById = new Map<number, ScoredPlayer>(allPlayers.map(p => [p.id, p]))
  const positionAverages = computePositionAverages(allPlayers)

  for (const pick of squadPicks) {
    if (pick.position >= 12) continue  // bench excluded, matching computeVerdicts convention
    const player = playerById.get(pick.element)
    if (!player) continue
    const posAvg = positionAverages.get(player.element_type) ?? 0.5
    const clubForm = clubFormMap.get(player.team) ?? null
    labels.set(pick.element, computeLifecycleLabel(player, posAvg, clubForm))
  }

  return labels
}
```

Key design decisions in the signature:
- `posAvg` is passed in (not computed inside `computeLifecycleLabel`) so the function is easily unit-testable with exact values.
- `clubForm: ClubForm | null` handles BGW teams and the early-season null case gracefully — all swing comparisons use `?? 0` so null means "no swing signal" (treated as neutral).
- The public-facing `computeLifecycleLabels()` wrapper mirrors `computeVerdicts()` in structure — same bench exclusion logic, same `playerById` + `positionAverages` pattern.

[VERIFIED: recommend.ts — `computeVerdicts` and `computePositionAverages` patterns confirmed]
[VERIFIED: types.ts — all referenced MergedPlayer fields (now_cost, mins_risk, start_prob, differential_flag, regression_signal, team) confirmed present]
[VERIFIED: types.ts — ClubForm.swing_1gw, swing_3gw confirmed present as Phase 47 additions]

---

## Architecture Patterns

### System Architecture Diagram

```
TransferPanel
  |
  |-- useClubForm() -----------> ClubForm[]
  |-- usePlayers() / computeAllGemScores() --> ScoredPlayer[]
  |-- useSquad() --> squadPicks[]
  |
  +--> useMemo: build clubFormMap (Map<teamId, ClubForm>)
  |
  +--> useMemo: computeLifecycleLabels(picks, scoredPlayers, clubFormMap)
       --> Map<number, LifecycleLabel>
            |
            v
         SquadView
            |
            +--> per starting-XI player:
                  LifecycleLabelBadge (replaces VerdictBadge)
```

The existing `computeVerdicts` / `verdicts` map is removed from TransferPanel. The `verdicts` prop on SquadView is replaced with `lifecycleLabels`.

### Recommended Project Structure

New files:
```
src/
├── lib/
│   ├── lifecycle-label.ts          # computeLifecycleLabel + computeLifecycleLabels + type + constants
│   └── __tests__/
│       └── lifecycle-label.test.ts # unit tests for the pure function
└── components/
    └── shared/
        └── LifecycleLabelBadge.tsx # replaces VerdictBadge in SquadView
```

Modified files:
```
src/
├── components/
│   ├── transfers/
│   │   └── TransferPanel.tsx       # add useClubForm, build clubFormMap, call computeLifecycleLabels
│   └── squad/
│       └── SquadView.tsx           # swap verdicts prop for lifecycleLabels; VerdictBadge → LifecycleLabelBadge
```

No pipeline changes, no new API routes, no changes to types.ts.

### Pattern: Badge Component

LifecycleLabelBadge follows the exact same pattern as VerdictBadge and MinsRiskBadge:

```typescript
// src/components/shared/LifecycleLabelBadge.tsx
'use client'

import type { LifecycleLabel } from '@/lib/lifecycle-label'

interface Config {
  bg: string
  text: string
  label: string
  title: string
}

const LABEL_MAP: Record<LifecycleLabel, Config> = {
  minutes_trap: {
    bg: 'bg-amber-100 dark:bg-amber-900',
    text: 'text-amber-800 dark:text-amber-200',
    label: 'Minutes Trap',
    title: 'Minutes Trap: high-price player with rotation risk — minutes reliability not matching price',
  },
  fixture_trap: {
    bg: 'bg-orange-100 dark:bg-orange-900',
    text: 'text-orange-800 dark:text-orange-200',
    label: 'Fixture Trap',
    title: 'Fixture Trap: widely-owned player facing worsening fixtures — consider selling',
  },
  buy_next_week: {
    bg: 'bg-emerald-100 dark:bg-emerald-900',
    text: 'text-emerald-800 dark:text-emerald-200',
    label: 'Buy Next Week',
    title: 'Buy Next Week: fixtures improving next GW — hold this week, then consider buying',
  },
  hold_one_more: {
    bg: 'bg-teal-100 dark:bg-teal-900',
    text: 'text-teal-800 dark:text-teal-200',
    label: 'Hold One More',
    title: 'Hold One More: fixture run improving over 3 GWs — worth holding short-term',
  },
  sell_soon: {
    bg: 'bg-amber-100 dark:bg-amber-900',
    text: 'text-amber-700 dark:text-amber-300',
    label: 'Sell Soon',
    title: 'Sell Soon: gem score approaching sell threshold — plan your exit',
  },
  hold: {
    bg: 'bg-zinc-100 dark:bg-zinc-700',
    text: 'text-zinc-700 dark:text-zinc-300',
    label: 'Hold',
    title: 'Hold: gem score within acceptable range — no urgent action needed',
  },
  sell: {
    bg: 'bg-red-100 dark:bg-red-900',
    text: 'text-red-700 dark:text-red-300',
    label: 'Sell',
    title: 'Sell: gem score materially below position average — replace this player',
  },
}

export function LifecycleLabelBadge({ label }: { label: LifecycleLabel | null }) {
  if (!label) return null
  const config = LABEL_MAP[label]
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

[VERIFIED: VerdictBadge.tsx — exact className + pattern replicated]

### TransferPanel Wiring

TransferPanel needs two changes:

1. Add `useClubForm()` import and call
2. Replace `computeVerdicts` with `computeLifecycleLabels`

```typescript
// Add import
import { useClubForm } from '@/lib/hooks/useClubForm'
import { computeLifecycleLabels } from '@/lib/lifecycle-label'

// In component body — add hook call
const { data: clubFormData } = useClubForm()

// Add useMemo for clubFormMap
const clubFormMap = useMemo(() => {
  if (!clubFormData) return new Map<number, ClubForm>()
  return new Map(clubFormData.map(cf => [cf.team_id, cf]))
}, [clubFormData])

// Replace verdicts useMemo
const lifecycleLabels = useMemo(() => {
  if (!squadData || scoredPlayers.length === 0) return new Map()
  return computeLifecycleLabels(squadData.picks, scoredPlayers, clubFormMap)
}, [squadData, scoredPlayers, clubFormMap])
```

[VERIFIED: useClubForm.ts — hook confirmed present; TransferPanel.tsx — existing useMemo pattern confirmed]

### SquadView Prop Change

```typescript
// Old interface
interface SquadViewProps {
  ...
  verdicts?: Map<number, Verdict>
  ...
}

// New interface
interface SquadViewProps {
  ...
  lifecycleLabels?: Map<number, LifecycleLabel>
  ...
}
```

In the render loop, replace `VerdictBadge` with `LifecycleLabelBadge`:
```tsx
// Old
<VerdictBadge verdict={verdicts.get(pick.element)!} />

// New
<LifecycleLabelBadge label={lifecycleLabels?.get(pick.element) ?? null} />
```

Also remove the `VerdictBadge` import from SquadView.tsx and the `Verdict` import from `recommend`.

The `ExplainPanel` / shortlist logic in SquadView currently branches on `verdict === 'sell'` to show replacement shortlist. With the label system, this should branch on `label === 'sell' || label === 'sell_soon'`:

```tsx
const label = lifecycleLabels?.get(pick.element)
const shortlist = (label === 'sell' || label === 'sell_soon')
  ? computeReplacementShortlist(player, allPlayers, squadIds, entryHistory.bank)
  : null
```

[VERIFIED: SquadView.tsx lines 210-223 — `computeReplacementShortlist` conditional confirmed]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Position average computation | Custom averages loop | `computePositionAverages()` from `recommend.ts` — already exported for this purpose |
| Fixture swing detection | Custom swing calculation | `ClubForm.swing_1gw`, `swing_3gw` from Phase 47 — already computed in `club-form.ts` |
| Club form data fetching | Custom fetch | `useClubForm()` hook — already wired to `/api/club-form` with 6h stale time |
| Badge rendering | Custom styled span | Follow `VerdictBadge` pattern verbatim — same className structure, same null guard |

---

## Common Pitfalls

### Pitfall 1: Buy Next Week fires on Sell-band players
**What goes wrong:** The gem_score condition for Buy Next Week is `gem <= posAvg` (upper bound) but without a lower bound, it could theoretically fire for a player in the Sell band if swing_1gw is strong.
**Why it happens:** Missing lower bound on the Hold-band check.
**How to avoid:** Buy Next Week lower bound is `gem >= posAvg * SELL_SOON_THRESHOLD` (0.90). Players below this are in Sell Soon / Sell territory — the priority cascade ensures Minutes Trap / Fixture Trap resolve first, then Sell Soon / Sell before Buy Next Week is ever reached for gem < 0.90 * posAvg. The cascade structure makes this impossible in practice, but the explicit lower bound in the condition is defensive.

### Pitfall 2: ClubForm lookup fails for a player's team
**What goes wrong:** `clubFormMap.get(player.team)` returns `undefined` — all swing-dependent conditions get `(null.swing_1gw ?? 0)` which would throw.
**Why it happens:** clubFormMap built from `ClubForm[]` may not contain every team_id if ClubForm data is partial.
**How to avoid:** Always use `clubFormMap.get(player.team) ?? null` and pass `null` to `computeLifecycleLabel`. The function uses `clubForm !== null` guards on every swing condition. [VERIFIED: design reflected in function signature above]

### Pitfall 3: Minutes Trap fires on a cheap midfielder who is a known rotator
**What goes wrong:** A £4.5m budget option who starts 65% of games gets labelled "Minutes Trap" — confusing, since managers consciously pick cheap rotators.
**Why it happens:** Minutes Trap conditions check `mins_risk` and `start_prob` but not price.
**How to avoid:** The £7.0m (`now_cost >= 70`) price gate from the ROADMAP prevents this. [VERIFIED: ROADMAP §Phase 49 phase notes: "Minutes trap should be gated at £7.0m+ price to avoid misfiring on cheap rotators"]

### Pitfall 4: Fixture Trap fires without a worsening swing (just the TRAP flag)
**What goes wrong:** A player with `differential_flag === 'trap'` but neutral/improving fixtures gets "Fixture Trap" — misleading since it implies the fixture situation worsens the trap.
**Why it happens:** Using only the TRAP flag without the swing condition.
**How to avoid:** Both conditions must be true: `differential_flag === 'trap'` AND `swing_3gw <= -0.20`. If TRAP flag is set but fixtures are neutral, the player falls through to Hold/Sell via gem_score alone.

### Pitfall 5: SquadView replacement shortlist stops showing for "Sell Soon" players
**What goes wrong:** Managers see "Sell Soon" but click the expand arrow and see no replacement shortlist — because the shortlist only triggered on `verdict === 'sell'`.
**Why it happens:** Forgetting to update the shortlist condition in SquadView after the prop rename.
**How to avoid:** Update the condition to `label === 'sell' || label === 'sell_soon'` as documented in §SquadView Prop Change above.

### Pitfall 6: useClubForm() loading state not guarded
**What goes wrong:** `clubFormData` is `undefined` while loading — `computeLifecycleLabels` receives an empty map and every player shows "Hold" or "Sell" with no swing signal.
**Why it happens:** TransferPanel already guards on `squadData` and `scoredPlayers.length > 0` but not on `clubFormData`.
**How to avoid:** The `clubFormMap` useMemo returns `new Map()` when `clubFormData` is undefined — swing conditions will all resolve to null club form (no swing signal), which degrades gracefully. Labels will still show correct gem-score-based labels (Sell, Sell Soon, Hold) — just without fixture-timing refinement. This is acceptable degraded behaviour, not a crash.

---

## File Changes — Complete List

### New Files

| File | Purpose |
|------|---------|
| `src/lib/lifecycle-label.ts` | `LifecycleLabel` type, threshold constants, `computeLifecycleLabel()`, `computeLifecycleLabels()` |
| `src/lib/__tests__/lifecycle-label.test.ts` | Unit tests for the pure function (see §Validation Architecture) |
| `src/components/shared/LifecycleLabelBadge.tsx` | Seven-state badge replacing VerdictBadge |

### Modified Files

| File | Change |
|------|--------|
| `src/components/transfers/TransferPanel.tsx` | Add `useClubForm`, `clubFormMap` useMemo, replace `computeVerdicts` with `computeLifecycleLabels`, update `verdicts` → `lifecycleLabels` prop pass |
| `src/components/squad/SquadView.tsx` | Rename prop `verdicts` → `lifecycleLabels`, swap `VerdictBadge` for `LifecycleLabelBadge`, update shortlist condition |

### Files That Stay Unchanged

| File | Reason |
|------|--------|
| `src/lib/recommend.ts` | `computeVerdicts` and `computePositionAverages` stay intact — Phase 51 (Decision Summary) may consume them; lifecycle engine reuses `computePositionAverages` via import |
| `src/lib/types.ts` | No new fields needed — all inputs already present |
| `src/lib/club-form.ts` | Phase 47 swing fields already implemented |
| `src/lib/hooks/useClubForm.ts` | Already exists and works correctly |
| `pipeline/merge.py` | No pipeline changes — LCL-02 explicitly requires no new pipeline data |

---

## Runtime State Inventory

Step 2.6 SKIPPED — this is a greenfield TypeScript feature addition. No rename/refactor/migration scope. No stored data, live service config, OS-registered state, secrets, or stale build artifacts are affected.

---

## Environment Availability

Step 2.6 SKIPPED — Phase 49 has no external dependencies beyond the project's own Next.js / TypeScript stack. All required hooks, utilities, and type definitions are already present in the codebase.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (project standard) |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/lib/__tests__/lifecycle-label.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LCL-01 | Each label fires under correct conditions | unit | `npx vitest run src/lib/__tests__/lifecycle-label.test.ts` | Wave 0 |
| LCL-02 | Function accepts only existing MergedPlayer + ClubForm fields (no new API fields) | type-check | `npx tsc --noEmit` | exists (tsconfig) |
| LCL-03 | When multiple conditions apply, exactly one label returned; priority order correct | unit | `npx vitest run src/lib/__tests__/lifecycle-label.test.ts` | Wave 0 |

### Planned Unit Test Cases

Tests for `computeLifecycleLabel(player, posAvg, clubForm)`:

```
Test suite: lifecycle-label.ts

Priority cascade tests:
1. Minutes Trap wins over Buy Next Week — now_cost=80, rotation_risk, swing_1gw=+0.30 → minutes_trap
2. Fixture Trap wins over Hold One More — trap flag + swing_3gw=-0.25 + improving swing_3gw → fixture_trap
3. Buy Next Week wins over Hold One More — swing_1gw=+0.25 + swing_3gw=+0.25 → buy_next_week
4. Hold One More when swing_1gw below threshold — swing_1gw=+0.10, swing_3gw=+0.30 → hold_one_more

Individual label tests:
5. Sell fires at 84% of posAvg — gem=0.84*posAvg → sell
6. Sell Soon fires at 88% of posAvg — gem=0.88*posAvg → sell_soon
7. Hold fires at 92% of posAvg with no swing — → hold
8. Buy Next Week blocked by regression_signal='sell' — swing_1gw=+0.30 but regression → hold
9. Minutes Trap blocked by price gate — now_cost=65, rotation_risk → hold (not minutes_trap)
10. Fixture Trap blocked without worsening swing — trap flag but swing_3gw=0.00 → gem-based label
11. Null clubForm gracefully degrades — all swing labels skip, gem-score labels still work
12. Bench player excluded — pick.position=12 → not in map (tested via computeLifecycleLabels)
13. BGW player (attacking_ease_1gw=null, swing_1gw=null) → Hold or Sell, no crash
```

### Sampling Rate

- Per task commit: `npx vitest run src/lib/__tests__/lifecycle-label.test.ts`
- Per wave merge: `npm test`
- Phase gate: Full suite green before verification

### Wave 0 Gaps

- [ ] `src/lib/__tests__/lifecycle-label.test.ts` — covers LCL-01, LCL-03 (13+ test cases above)
- [ ] `src/lib/lifecycle-label.ts` — the pure function itself (obviously Wave 0 for the function, Wave 1+ for the UI)

*(No framework install needed — Vitest already configured)*

---

## Security Domain

Phase 49 introduces no authentication, data persistence, user input handling, or external API calls. All computation is over data already fetched by existing hooks. The `useClubForm()` hook makes an internal `/api/club-form` call that is already in production and not modified by this phase.

ASVS categories: not applicable to this phase. No new attack surface introduced.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Buy/Hold/Sell (3 states from gem_score only) | 7-label lifecycle with fixture swing + minutes risk awareness | Managers get timing precision — not just direction |
| `SELL_THRESHOLD = 0.90` (10% below average) | `SELL_THRESHOLD = 0.85` (15% below average) + `SELL_SOON_THRESHOLD = 0.90` | Hysteresis prevents premature sell signals; "Sell Soon" gives advance warning |
| No price-gating on risk labels | Minutes Trap gated at £7.0m | Prevents misfiring on budget rotators |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Minutes Trap priority is higher than Fixture Trap | Priority Hierarchy | Could show Fixture Trap on a player the manager should sell due to minutes, not fixtures — user confusion rather than data corruption |
| A2 | Buy Next Week lower bound is `gem >= posAvg * 0.90` (SELL_SOON_THRESHOLD) | Label Taxonomy | If set lower, Buy Next Week could fire on players in the warning band — dilutes the "buy timing" signal |
| A3 | Hold One More requires `gem >= posAvg * 0.90` as lower bound (same as Buy Next Week) | Label Taxonomy | If Hold One More fires in the Sell Soon band, the timing signal conflicts with the sell warning |
| A4 | The existing `computePositionAverages()` function is imported and reused | Function Signature | If function signature changes in a future phase, `lifecycle-label.ts` needs updating — low risk since it's stable |

**If this table has entries:** These four items are the only assumed details. Everything else is verified directly from the codebase (types, functions, patterns) or from planning documents (thresholds, hook availability).

---

## Open Questions

1. **Should the `verdicts` prop on SquadView be kept alongside `lifecycleLabels`?**
   - What we know: Phase 51 (Decision Summary) may want to show verdicts independently.
   - What's unclear: Whether Phase 51 will consume the lifecycle labels or the raw verdicts.
   - Recommendation: Remove `verdicts` from SquadView in Phase 49; Phase 51 can re-introduce a prop if needed, since `computeVerdicts` is kept in `recommend.ts`.

2. **Should Fixture Trap require BOTH `differential_flag === 'trap'` AND worsening swing, or is just the TRAP flag sufficient?**
   - What we know: The ROADMAP lists "Fixture Trap" as a distinct label from "Minutes Trap" — both are warning labels. The TRAP flag from Phase 30 already encodes "high ownership + below-median xPts."
   - Recommendation: Require both conditions (TRAP flag AND swing_3gw <= -0.20). Without the swing condition, Fixture Trap is a synonym for the TRAP badge already shown in GemTable — no new information. The swing condition is what makes it a *lifecycle timing* signal.

3. **Should SquadView show lifecycle labels for bench players?**
   - What we know: The existing `VerdictBadge` is only shown for `!isBench` (starting XI). The ROADMAP success criterion specifies "squad players" but the existing pattern excludes bench.
   - Recommendation: Match existing behaviour — labels for starting XI only. Bench opacity already signals "less relevant." Extending to bench is a future scope item.

---

## Sources

### Primary (HIGH confidence)
- `src/lib/recommend.ts` — `computeVerdicts`, `computePositionAverages`, `SELL_THRESHOLD`, `BUY_THRESHOLD` [VERIFIED via Read]
- `src/lib/types.ts` — `MergedPlayer`, `ScoredPlayer`, `ClubForm`, `MinsRisk` type definitions [VERIFIED via Read]
- `src/components/shared/VerdictBadge.tsx` — badge pattern to replicate [VERIFIED via Read]
- `src/components/squad/SquadView.tsx` — full prop interface and render loop [VERIFIED via Read]
- `src/components/transfers/TransferPanel.tsx` — current hook usage and data flow [VERIFIED via Read]
- `src/lib/club-form.ts` — `computeClubForm`, `meanEase`, swing field computation [VERIFIED via Read]
- `src/lib/hooks/useClubForm.ts` — hook exists, returns `ClubForm[]` [VERIFIED via Read]
- `.planning/phases/47-fixture-swing-cs-prob/47-CONTEXT.md` — D-01 swing threshold 0.20 confirmed [VERIFIED via Read]
- `.planning/ROADMAP.md` §Phase 49 — label taxonomy, 85% threshold, £7.0m gate [VERIFIED via Read]

### Secondary (MEDIUM confidence)
- `src/lib/explain.ts` — `START_PROB_HIGH = 0.85`, `START_PROB_LOW = 0.65` cross-reference for MinsRisk thresholds
- `src/components/shared/MinsRiskBadge.tsx` — `likely_start` 65-84% band confirms `start_prob < 0.65` threshold for Minutes Trap

### Tertiary
- None — all claims sourced from project codebase or planning documents.

---

## Metadata

**Confidence breakdown:**
- Label taxonomy: HIGH — derived directly from ROADMAP notes + existing threshold patterns in codebase
- Priority hierarchy: MEDIUM-HIGH — Priority 1-4 ordering is strongly motivated; Minutes Trap vs Fixture Trap ordering is [ASSUMED]
- Function signature: HIGH — mirrors existing `computeVerdicts` pattern exactly
- UI integration: HIGH — follows VerdictBadge pattern verbatim; TransferPanel wiring pattern well-established
- Test strategy: HIGH — pure function makes all 13+ cases straightforwardly testable

**Research date:** 2026-05-01
**Valid until:** 2026-06-01 (stable codebase; no external dependencies)
