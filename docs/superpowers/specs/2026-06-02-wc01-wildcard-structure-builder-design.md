# WC-01: Wildcard Structure Builder — Design Spec

**Date:** 2026-06-02
**Feature:** WC-01 from feature backlog
**Status:** Approved for implementation

---

## Problem

The existing Wildcard chip mode in the Planner builds one optimal squad. A manager planning a Wildcard wants to compare competing squad structures before committing — e.g. "Salah + Haaland vs Salah only, with the budget reinvested in midfield" — and see which structure produces better projected xPts and captain options across upcoming gameweeks.

---

## Scope

- Compare exactly **2** squad structures side-by-side
- Each structure is defined by **0–3 anchor players** the user pins; the engine fills the rest optimally from the full player pool
- Comparison dimensions: **xPts (1GW / 3GW / 5GW)** for the best XI, **budget remaining**, and **top-3 captain candidates**
- Lives in a new **"Wildcard"** sub-tab in the Plan section

Out of scope for this spec: chip synergy signal, transfer flexibility score, more than 2 structures, multi-GW captaincy projection (pipeline only has xPts_1gw / 3gw / 5gw, not per-GW breakdowns).

---

## Architecture

### New files

| File | Purpose |
|------|---------|
| `src/lib/anchored-squad.ts` | Pure function `buildAnchoredSquad`. No React, no side effects. `@vitest-environment node`. |
| `src/components/planner/WildcardBuilderTab.tsx` | Tab UI component |
| `src/components/planner/WildcardBuilderTab.test.tsx` | jsdom tests |

### Modified files

| File | Change |
|------|--------|
| `src/app/page.tsx` | Register "Wildcard" as a new Plan sub-tab |

No existing pure functions are modified. `buildOptimalSquad` and `optimiseLineup` are called as-is.

---

## Pure Function: `buildAnchoredSquad`

**File:** `src/lib/anchored-squad.ts`

### Signature

```typescript
export function buildAnchoredSquad(
  anchors: number[],           // 0–3 player IDs to pre-seat
  players: MergedPlayer[],     // full player pool
  budget: number,              // integer tenths of £1m
  horizon: OptimiserHorizon,   // 1 | 3 | 5
): AnchoredSquadResult | null
```

### Types

```typescript
export interface CaptainCandidate {
  id: number
  web_name: string
  xPts_1gw: number
  ceiling: number   // xPts_90th_1gw ?? xPts_1gw ?? 0
}

export interface AnchorConflict {
  playerId: number
  reason: 'not_found' | 'unavailable' | 'team_cap' | 'position_cap' | 'over_budget'
}

export interface AnchoredSquadResult {
  squad: ChipSquadPlayer[]          // all 15
  bestXI: number[]                  // 11 starter IDs
  formation: string                 // e.g. "4-3-3"
  budgetUsed: number                // integer tenths of £1m
  budgetRemaining: number           // budget − budgetUsed
  xPts1gw: number                   // sum of xPts_1gw for bestXI
  xPts3gw: number                   // sum of xPts_3gw for bestXI
  xPts5gw: number                   // sum of xPts_5gw for bestXI
  captainCandidates: CaptainCandidate[]  // top 3 from XI by ceiling desc
  anchorConflicts: AnchorConflict[]      // skipped anchors with reasons
}
```

### Algorithm

1. **Validate anchors** — for each anchor player ID in order:
   - Not in `players` → `not_found`, skip
   - `status !== 'a'` → `unavailable`, skip
   - Team already at cap (3 per team) → `team_cap`, skip
   - Position slot already at max (GK≤2, DEF≤5, MID≤5, FWD≤3) → `position_cap`, skip
   - `runningCost + player.now_cost > budget` → `over_budget`, skip
   - Otherwise: accept into squad, increment slot count + team count + running cost

2. **Greedy fill** — sort remaining eligible players (`status === 'a'`, `xPts_1gw !== 0`) by `HORIZON_FIELD[horizon]` descending. Iterate and accept each player that passes slot, team cap, and budget guards. Stop at 15.

3. **Formation validation** — if fewer than 15 players filled, or any `MIN_SLOTS` position unmet → return `null`.

4. **Best XI** — call `optimiseLineup(syntheticPicks, squadPlayers, horizon)`. If `null` returned → return `null`.

5. **xPts totals** — sum `xPts_1gw`, `xPts_3gw`, `xPts_5gw` across `bestXI` players (`?? 0` fallback).

6. **Captain candidates** — filter `bestXI` players, sort by `ceiling` descending, take top 3.

### Constants

- `MIN_SLOTS` / `MAX_SLOTS` — redeclare locally (not exported from `chip-modes.ts`; codebase pattern is local redeclaration)
- `HORIZON_FIELD` — import from `optimise-lineup.ts`
- `CHIP_DEFAULT_BUDGET_TENTHS` — import from `chip-modes.ts`

---

## UI: `WildcardBuilderTab`

### Data dependencies

- `usePlayers()` — full MergedPlayer pool
- `useSquad(submittedId)` — current picks + `entry_history.bank` (bank balance)
- `useMyTeam(!!submittedId)` — `picks[].selling_price` for exact sell prices

Budget calculation (mirrors `OptimiserPanel`):
- Authenticated: `squadData.entry_history.bank + sum(myTeamData selling_price ?? player.now_cost)` for each squad pick
- Unauthenticated / no squad: falls back to `CHIP_DEFAULT_BUDGET_TENTHS` (£100m)

### Layout

**Loading / error states:** same pattern as `OptimiserPanel` — spinner paragraph or red error paragraph, no structure panels rendered.

**Main layout:** two structure panels. Stacked vertically on mobile, side-by-side (`md:grid-cols-2`) on desktop.

**Per structure panel:**
- Header: "Structure A" / "Structure B"
- Up to 3 anchor slots. Each slot: `PlayerSearchInput` with an ✕ clear button. "+ Add anchor" button appears below when fewer than 3 anchors are set.
- 0 anchors is valid — engine picks freely (equivalent to an unconstrained optimal squad).
- Build is **reactive** — triggers automatically on any anchor change. No explicit "Build" button needed; computation is pure in-memory.
- **Squad display** (after build): players listed in position groups (GK / DEF / MID / FWD / Bench). Anchor players carry a visual badge (e.g. pin icon or coloured ring). Formation string shown in panel header.
- **Conflict callout** (when any anchor was skipped): small amber notice per skipped player — e.g. "Haaland skipped — team cap exceeded".
- **Null result** (squad couldn't be filled): "Could not build a valid squad — try removing an anchor or checking budget."

### Comparison table

Rendered **below both panels**, only when both structures have a non-null result.

| Metric | Structure A | Structure B |
|--------|-------------|-------------|
| xPts next GW | — | — |
| xPts next 3 GWs | — | — |
| xPts next 5 GWs | — | — |
| Budget remaining | — | — |
| Captain options | name, name, name | name, name, name |

- For xPts rows and budget remaining: the cell with the higher value gets `bg-green-50 dark:bg-green-950`.
- Captain options row: no winner highlighted (subjective). Shows top-3 `web_name` values comma-separated.
- Ties: no highlight on either cell.

---

## Tab Registration

Add "Wildcard" as a sub-tab in the Plan section in `src/app/page.tsx`, alongside Planner, Chip Strategy, Transfer Tree, and Manual Plan.

Pass `submittedId` as a prop so the component can load squad data.

---

## Tests

### `buildAnchoredSquad` (`@vitest-environment node`)

- 0 anchors → builds valid 15-player squad (same behaviour as `buildOptimalSquad`)
- All 3 valid anchors appear in `squad`
- Anchor with `status !== 'a'` → skipped, `anchorConflicts` entry with `reason: 'unavailable'`
- Anchor not in player pool → skipped, `reason: 'not_found'`
- 4th player from same team as 3 existing anchors → skipped, `reason: 'team_cap'`
- Anchor pushes position over max cap → skipped, `reason: 'position_cap'`
- Anchor cost exceeds remaining budget → skipped, `reason: 'over_budget'`
- `xPts1gw/3gw/5gw` sum XI only (not all 15)
- `captainCandidates` ordered by ceiling descending, length ≤ 3
- Returns `null` when fewer than 15 eligible players available
- GK anchor: fills GK slot, greedy doesn't overfill GK (max 2)

### `WildcardBuilderTab` (`@vitest-environment jsdom`)

- Renders two panels with "+ Add anchor" buttons
- Adding an anchor player triggers rebuild and shows squad list
- Comparison table absent when only one structure has a result
- Comparison table present when both structures have results
- Winning xPts cell carries `bg-green-50` class; losing cell does not
- Conflict message renders for skipped anchor
- Null-result message renders when `buildAnchoredSquad` returns null
- Loading state from `usePlayers` renders loading copy, no panels
- Error state from `usePlayers` renders error copy, no panels
