# Planner Outlook Redesign — Fixture Grid + Captain Plan Strip — Design

**Date:** 2026-08-02
**Status:** Approved (design), pending implementation plan
**Part of:** the Matchday Fintech redesign (handoff §4, mockup `handoff/planner-3c.png`).

## Problem

The Planner mockup (3c) is a 3-section outlook: a fixture-outlook grid (clubs × GWs),
a per-GW captain-plan strip ("model's best route"), and a GW-keyed transfer route. The
real `PlannerTab` is a 373-line interactive transfer-plan *generator* (Generate button,
per-step chip toggles, manual overrides via `PlayerPickerModal`, `ChipStrategyPanel`,
`CaptainPicksPanel`). The UIX-01 keep-all-features contract means all of that survives.

## Decision

**Additive, generator preserved.** Add two sections — the fixture-outlook grid and a
new captain-plan strip — around the existing generator, which serves as the "transfer
route". No engine changes; nothing removed.

Data source (corrected 2026-08-03): per-GW xPts is NOT currently on `MergedPlayer` —
`gw_xpts` at types.ts:949 belongs to `FixtureRunCard`, and `merge.py::merge_players`
never attaches a per-GW array to the player (the `gw_xpts` at merge.py:521 `_xpts_per_gw`
helper exists but is only consumed by gw_intel). Per the owner's decision, a
prerequisite pipeline task adds real per-GW xPts to the player (`player['gw_xpts']` via
`_xpts_per_gw`, + `MergedPlayer.gw_xpts?: number[]`), so the captain strip uses genuine
per-GW projections. See the plan's Task 1.

## Design

### 1. Layout (`PlannerTab.tsx`)

In render order (the section-level horizon toggle already exists in page.tsx):
- **Fixture outlook** — `<FixtureHeatMap submittedId={submittedId} />` near the top.
  Self-contained (fetches its own club-form/players/squad); shows clubs × GWs FDR with
  owned-team highlighting. Always visible (no plan needed).
- **Generate Plan** (existing button + flow) → when `planResult` is non-null:
  - **Captain plan strip** (new `CaptainPlanStrip`) — appears above the route.
  - **Transfer route** — the existing `TransferPlanTable` (unchanged).
  - existing `ChipStrategyPanel` / `CaptainPicksPanel` (unchanged).

All existing interactivity (Generate, chip toggles, manual overrides, restore) is
preserved. The captain strip requires a generated plan (the squad evolves per GW) — the
fixture outlook shows immediately; the strip appears after Generate.

### 2. `bestCaptainPerGw` helper (`src/lib/captain-plan.ts`, new, pure, tested)

`bestCaptainPerGw(steps: PlanStep[], playerMap: Map<number, MergedPlayer>): CaptainPlanEntry[]`
where `CaptainPlanEntry = { gw: number; playerId: number; name: string; team: string; opponent: string; xpts: number }`.

For each step at index `i`:
- Candidates = starters (`positionsAfter` value in 1..11).
- Score each candidate by `player.gw_xpts[i] ?? 0` (precise per-GW xPts, aligned to the
  plan step index — step 0 is the next GW).
- Pick the max; `opponent` from the player's `fixtures` entry with `event_id === step.gw`
  formatted `"{vs|at} {opponent_team} ({H|A})"` (empty string if no fixture).
- Skip a step if it has no starter with a positive score, or emit it with the best
  available (decision: emit best-available so every GW in the horizon has a card; if no
  candidate at all, skip that step).
- Empty `steps` → `[]`.

### 3. `CaptainPlanStrip` component (`src/components/planner/CaptainPlanStrip.tsx`, new)

Props: `{ steps: PlanStep[]; playerMap: Map<number, MergedPlayer> }`. Calls
`bestCaptainPerGw`; renders a horizontal, wrapping/scrolling strip of per-GW cards (GW
label, team-colour monogram + `web_name`, `vs OPP (H)`, xPts) under a "Captain plan"
heading with a "model's best route" sub-label. Renders `null` when the helper returns
`[]`.

### 4. Fixture outlook

Reuse `FixtureHeatMap` unchanged (owned-team highlighting via `submittedId`). The
mockup's literal "your clubs first" row ordering is an optional `FixtureHeatMap`
enhancement — OUT OF SCOPE here; the existing owned-row highlight is the v1.

## Testing

- **`captain-plan.test.ts`** — picks the max-`gw_xpts` starter per step (not the bench,
  not by `xPts_1gw`); indexes `gw_xpts` by step position; formats the opponent from the
  step-GW fixture; returns `[]` for empty steps; handles a missing `gw_xpts[i]` as 0.
- **`CaptainPlanStrip.test.tsx`** — renders a card per returned entry with GW/name/xPts;
  renders nothing for empty steps.
- Existing `PlannerTab` suite must stay green — the two additions are additive; no
  existing element/prop changes.

## Files

- **Create:** `src/lib/captain-plan.ts` (+ test),
  `src/components/planner/CaptainPlanStrip.tsx` (+ test).
- **Modify:** `src/components/planner/PlannerTab.tsx` — render `FixtureHeatMap` near the
  top and `CaptainPlanStrip` (with `planResult.steps` + the player map) when a plan
  exists.

## Out of scope

- Full faithful 3-section reorg / relocating the generator.
- "Your clubs first" fixture-row sorting in `FixtureHeatMap`.
- Any plan-engine change.
