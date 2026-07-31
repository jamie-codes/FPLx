# Transfers 2-Pane Redesign + "Why X over Y?" Explainer — Design

**Date:** 2026-07-31
**Status:** Approved (design), pending implementation plan
**Part of:** the Matchday Fintech redesign (handoff §4, mockup `handoff/transfers-3b.png`).

## Problem

The Transfers mockup (3b) is a clean 2-pane — squad on the left, "Best moves" + a
new "Why X over Y?" explainer on the right. The real `TransferPanel` is a ~450-line
vertical stack that also carries the Load-Squad/auth flow, `RejectionSearchCallout`,
`HighOwnershipCallout`, and `CaptaincyPanel`. The UIX-01 keep-all-features contract
means none of those may be dropped.

## Decisions

- **Scope: 2-pane core, aux preserved** (not a full faithful rework). Make
  `[Your Squad | Best moves + Why-explainer]` the 2-column centrepiece; keep
  auth/RejectionSearch/HighOwnership/Captaincy in place around it.
- **Explainer: genuinely comparative** — a new tested `compareTransfers(x, y)` helper
  produces X-vs-Y reasons with real numbers (matches the mockup), not a reuse of the
  single-player `explainPick`.

## Design

### 1. Layout (`TransferPanel.tsx`)

The "Your Squad + OCS" region becomes a 2-column grid on `lg` (stacks on mobile):

- **Left pane** — the existing `SquadView` (already renders per-player verdict badges
  + xPts; no new squad component).
- **Right pane** — the existing `OpportunityCostTable` ("Best moves", unchanged) with
  the new `WhyOverCard` beneath it.

The Load-Squad/auth form stays at the top. `RejectionSearchCallout`,
`HighOwnershipCallout`, and `CaptaincyPanel` are preserved in place (above/below the
panes, near their current positions). Nothing is removed.

### 2. `compareTransfers(x, y)` — `src/lib/compare-transfers.ts` (new, pure, tested)

Signature: `compareTransfers(x: MergedPlayer, y: MergedPlayer): { reasons: string[]; risk: string | null }`.
`x` = preferred target, `y` = runner-up. Builds the strongest 2–3 comparative reasons
plus a risk line:

- **Ceiling** — when `x.haul_prob > y.haul_prob`:
  `"Higher ceiling: haul {round(x)}% vs {round(y)}%"` (skip when either `haul_prob` is absent).
- **Horizon** — `Δ1 = x.xPts_1gw − y.xPts_1gw`, `Δ5 = x.xPts_5gw − y.xPts_5gw`; when
  `Δ5 > Δ1` (edge grows with horizon): `"xPts gap grows: +{Δ1} (1GW) → +{Δ5} (5GW)"`.
- **Set-piece / penalty edge** — x is on pens (or a set-piece taker) and y is not:
  `"On penalties — {y.web_name} isn't"` (use existing pen/set-piece fields, same source
  as `explainPick`).
- **Differential** — x meaningfully lower-owned than y (e.g. ≥ 10 percentage-point gap):
  `"More differential ({x}% vs {y}% owned)"`.
- **Risk line** — `explainPick(x).risks[0]` (if any) + `"{y.web_name} is the safer floor pick"`.

Returns `reasons` (cap at 3, strongest first in the order above) and `risk`. If no
reasons qualify, `reasons` may be empty (the card then still shows the risk line, or
renders nothing if both are empty — see §3).

### 3. `WhyOverCard` — `src/components/transfers/WhyOverCard.tsx` (new)

Props: `{ x: MergedPlayer; y: MergedPlayer }` (the top-2 buy candidates from the
best-moves ranking). Renders:

- Header `"Why {x.web_name} over {y.web_name}?"`.
- Numbered reasons (`01`, `02`, …) from `compareTransfers(x, y).reasons`.
- An amber `!` risk line from `.risk`.

Renders nothing when `compareTransfers` yields neither reasons nor risk. The parent
(`TransferPanel`) renders `WhyOverCard` only when it has ≥ 2 distinct buy candidates.

### 4. Wiring the top-2 candidates

`TransferPanel` derives the top-2 buy candidates from the best-moves it already
computes for `OpportunityCostTable` (the OCS suggestions, ranked by gain). Map the
top-2 suggestions' buy player-ids back to their `MergedPlayer` via the existing
`playersData` cache; pass them to `WhyOverCard` as `x` (rank 1) and `y` (rank 2).

## Testing

- **`compare-transfers.test.ts`** — ceiling reason fires on higher haul_prob; horizon
  reason fires only when Δ5 > Δ1 with correct numbers; pen edge fires when x-on-pens /
  y-not; risk line composes `explainPick` risk + safer-floor note; returns empty
  reasons + null risk for two near-identical players.
- **`WhyOverCard.test.tsx`** — renders the header, numbered reasons, and risk; renders
  nothing when the comparison is empty.
- Existing `TransferPanel` / `OpportunityCostTable` / `SquadView` suites must stay
  green — the layout change is a grid wrapper + an additive card.

## Files

- **Create:** `src/lib/compare-transfers.ts` (+ test),
  `src/components/transfers/WhyOverCard.tsx` (+ test).
- **Modify:** `src/components/transfers/TransferPanel.tsx` — 2-col grid wrapper around
  `SquadView` (left) and `OpportunityCostTable` + `WhyOverCard` (right); derive + pass
  the top-2 buy candidates.

## Out of scope

- Full faithful rework (auth-into-header, callouts/captaincy into drawers).
- Replacing OCS with a flat ranked-moves list — OCS stays as the best-moves surface.
- The Planner screen (3c) — separate.
