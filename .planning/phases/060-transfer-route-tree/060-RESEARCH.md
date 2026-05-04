# Phase 60: Transfer Route Tree — Research

**Researched:** 2026-05-04
**Domain:** Pure-TypeScript greedy multi-branch transfer engine + React presentation tab + bridge to Phase 59 Manual Plan
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Greedy algorithm**

- **D-01:** Per-GW rule — **0 or 1 transfer per step, skip if no positive xPts gain.** Each step checks for the best position-matched transfer; if no player improves xPts over the current squad member, the step is a hold (no transfer). FTs bank when held.
- **D-02:** FT banking — use `computeNextFTState` from `free-transfer-engine.ts` exactly as-is. A held GW banks the unused FT (up to 2 available max). Reuse the same engine Phase 59 uses, without modification.
- **D-03:** Sell roots — the **3 squad players with the lowest `xPts_1gw`** across all 15 picks (regardless of position). Each root becomes the player sold in GW1 of its branch. Position-matched replacement (the best available buy for that position) is applied immediately as the root transfer.
- **D-04:** When 2 FTs are available — make 2 transfers **only if both individually produce a positive xPts gain**. Position-matched and budget-checked independently.

**Route Tree placement**

- **D-05:** New Plan sub-tab id `'route-tree'`, label `'Route Tree'`, mobileLabel `'Routes'`. Inserted **after `'manual-plan'`** in the Plan section's `subTabs` array.
- **D-06:** Sub-tab order — `Planner | Manual Plan | Route Tree | Club Form | Value Gems | Rivals`.
- **D-07:** Horizon — **shared with the section-level `HorizonSelector` in `page.tsx`** (same prop passed down from the Plan section header). Changing the horizon in any Plan sub-tab affects all of them. TRT-07 recalculation is automatic (same state re-triggers `useMemo`).

**Bridge behavior (TRT-05)**

- **D-08:** If the existing `fplx_manual_plan` localStorage has **any steps with transfers**, show an inline confirm: *"Replace current plan?"* (Yes / Cancel). If the plan is empty or doesn't exist, overwrite silently. On confirm: write to localStorage, then switch `activeSubTab` to `'manual-plan'`.
- **D-09:** Bridge payload — writes `ManualStep[]` with the path's `(sellId, buyId)` pairs per GW, sets `horizon` to match the Route Tree's active horizon, and sets `chip = null` on every step. The user sets chips manually in Manual Plan after loading.

**Mobile layout**

- **D-10:** Summary table container uses `overflow-x-auto`, matching `TransferPlanTable` (Phase 59 D-10).
- **D-11:** Expandable GW-by-GW breakdown rows (TRT-03) stay inside the table — `<tr>` rows spanning all columns, scrolling horizontally with the parent.

### Claude's Discretion

- Exact column headers (e.g., "Hits", "Hit cost", "Net xPts", "Chips"). UI-SPEC has already locked these — see Component Inventory table.
- Visual highlight style for the recommended path (UI-SPEC selected `ring-2 ring-inset ring-green-700 dark:ring-green-300` with `bg-zinc-50 dark:bg-zinc-800` tint).
- Whether "Load into Manual Planner" is in the row or below each path's expanded breakdown. UI-SPEC chose **per-row Action column** (default state).
- Empty/no-squad state messaging (mirrors Phase 59 D-09).
- Skeleton/loading state while the tree computes (`useMemo` is sync, so it is essentially trivial — UI-SPEC names it "Computing routes…").

### Deferred Ideas (OUT OF SCOPE)

- **LLM-generated branches (NLP-01):** AI-driven branching paths with narrative explanations — deferred to v1.12. Phase 60 is pure TypeScript, no LLM.
- **Wildcard squad builder in Route Tree:** Generating a full 15-player squad via the tree (not just single transfers) — deferred. Standard transfer-swap mode covers v1.9 scope.
- **Save/favourite a route:** Persisting a particular path without loading it into Manual Plan — deferred. A separate "saved routes" store is v2.x scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRT-01 | Generate 2–3 branching transfer paths in pure TypeScript: top-3 distinct sell-player roots each with greedy continuation (no LLM) | Pure engine in `src/lib/transfer-route-tree.ts` mirroring `suggest-transfers.ts` and `planning-engine.ts` patterns. Sell roots = 3 lowest `xPts_1gw` across 15 picks (D-03). Greedy continuation per branch reuses the per-step "best positive-gain transfer" loop from `planning-engine.ts:69–177` |
| TRT-02 | Each path displays a summary row: total hits, total hit cost, net projected xPts, chips preserved vs consumed | All four metrics are pure-derivable: total transfers using a hit (`step.hitCost === -4`), `totalHitCostPts = sum(step.hitCost)`, `netXpts = sum(buy.xPts_h - sell.xPts_h) + totalHitCostPts`, `chipsConsumed = step[i].chip != null` |
| TRT-03 | Each path expandable to show GW-by-GW breakdown: transfer out / in, FT bank at GW, projected xPts contribution | Breakdown row consumes the per-step `RouteNode` shape — already maps 1:1 to existing `DerivedStep` from manual-plan.ts. Reuse the `Free` / `Hit −4 pts` badge classes from Phase 59 `TransferRow` |
| TRT-04 | Side-by-side summary table; highest net-xPts path highlighted as recommended | Single `<table>` with `overflow-x-auto`. Recommended highlight follows existing pattern: `ChipStrategyPanel.tsx:56` (`ring-2 ring-offset-1 ring-green-700 dark:ring-green-300`) and `DecisionSummaryTab.tsx:108`. Modified for `<tr>` substrate to `ring-inset` (UI-SPEC §Layout choice) |
| TRT-05 | "Load into Manual Planner" button pre-populates the MTP-01 plan with that path's GW transfers | Bridge writes via `persistManualPlan(plan)` from `manual-plan.ts:221` (already MTP-08-tested). Inline confirm only when `loadManualPlan()` returns non-empty plan with `transfers.length > 0`. Sub-tab switch via `onSwitchSubTab('manual-plan')` callback prop from page.tsx (page-owns activeSubTab state) |
| TRT-06 | Tree generation respects active chip mode (Wildcard / Free Hit / Bench Boost) when set in Planner section header | **GAP:** No section-level `chipMode` exists today. Plan section sub-tabs (PlannerTab, ManualPlanTab) each manage chips per-step locally. Engine accepts a `chip` parameter on the **first node only** (Wildcard removes hit costs and may lift FT to allow up to 3 transfers — handled by `computeNextFTState`/`computeHitCost`). See Open Question 1 |
| TRT-07 | Tree recalculates when GW horizon toggle changes (1 / 3 / 5 GW) | `useMemo` on `buildTransferRouteTree({...horizon})` recomputes synchronously when `horizon` changes (D-07). Note that the **existing `HorizonSelector` renders 1/2/3/4/5 buttons**, not 1/3/5 — see Open Question 2 |

</phase_requirements>

---

## Summary

Phase 60 adds a pure-TypeScript route-tree engine and a Plan-section sub-tab that consumes it. Architecturally it sits between Phase 56 (the corrected FT engine — reused verbatim) and Phase 59 (the Manual Plan target — already shipped). All data plumbing already exists: squad picks via `useMyTeam`/`useSquad`, scored players via `usePlayers` + `computeAllGemScores`, sell prices via the `myTeamData.picks → selling_price` map, bank balance via `entry_history.bank`, and the FT engine via `computeNextFTState`/`computeHitCost`. The bridge target — `persistManualPlan` writing to `fplx_manual_plan` localStorage — is already MTP-08-tested.

The engine is a thin layer over the existing `planning-engine.ts:69–177` per-step loop: instead of running it once from the current squad with the single best sell-target chosen organically, run it three times — each branch forced to start with one of the three lowest-`xPts_1gw` squad players sold in step 1, then continue greedily from that altered squad. Each branch's continuation uses the same "best position-matched transfer with positive xPts gain" rule that Phase 56's planner already implements. Per D-04, when 2 FTs are available, both legs of a 2-transfer step must individually be positive-gain (mirrors the existing `suggest-transfers.ts:175–179` per-leg `gain <= 0` filter). Per D-01, hit transfers are **not** considered — the greedy loop bails when no positive-gain free transfer exists. This makes the engine simpler than the existing `generatePlan` (which does evaluate `netGain = totalScore + hitCost` for hit-paying transfers).

The biggest research findings are two latent gaps that the planner must surface to the user before execution:

1. **No section-level `HorizonSelector` or `chipMode` state exists in `page.tsx` today.** D-07/D-08 reference a "Plan section header" that doesn't exist. Either Phase 60 lifts horizon (and chip mode) state up to `page.tsx` (a structural change that touches PlannerTab and ManualPlanTab), or the Route Tree manages its own local state and reads `chipMode` as a non-existent prop. The UI-SPEC explicitly says "Route Tree does NOT render its own HorizonSelector" — but the alternative (lifting state) is currently unspecified.
2. **The horizon-button mismatch.** Existing `HorizonSelector` renders five buttons (1/2/3/4/5 GW) but TRT-07 spec text and 060-UI-SPEC.md §Color §Accent both reference "1 / 3 / 5 GW" — the three values that have backing `xPts_*gw` fields. Horizons 2 and 4 have no `xPts_2gw` / `xPts_4gw` field on `MergedPlayer` and existing `planning-engine.ts` only consumes `xPts_1gw` for per-GW scoring (multiplied across the horizon). The route tree engine can score correctly at any horizon 1–5 by summing per-GW contributions, but the UI text needs to acknowledge whichever buttons are shown.

**Primary recommendation:** Build in two waves — Wave 1 (TDD) ships the pure engine `src/lib/transfer-route-tree.ts` + comprehensive `tests/lib/transfer-route-tree.test.ts`; Wave 2 ships `RouteTreeTab.tsx` + co-located `RouteTreeTab.test.tsx` + `src/app/page.tsx` wiring + human-verify checkpoint. Resolve the section-level horizon/chipMode gaps before Wave 2 starts (likely as discuss-phase clarifications).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Sell-root selection (3 lowest `xPts_1gw` from 15 picks) | Browser / Client (pure lib) | — | Pure derivation from `picks[]` + `playerMap`; no API needed |
| Per-branch greedy continuation (FT propagation + transfer scoring) | Browser / Client (pure lib) | — | Mirrors `planning-engine.ts:69–177`; reuses `computeNextFTState`/`computeHitCost`/`snapshotSquad` |
| Highest-net-xPts path selection | Browser / Client (pure lib) | — | Pure max-by `netXpts` over branches; engine returns `recommendedPathIndex` so UI doesn't recompute |
| Squad data fetch (picks, sell prices, bank) | API / Next.js server proxy | Browser / Client | `useMyTeam` (auth path) and `useSquad` (public path) — already shipped, reused as-is |
| Player data fetch (`MergedPlayer[]` + xPts) | API / Next.js server proxy | Browser / Client | `usePlayers` + `computeAllGemScores` — already shipped |
| Tab navigation (`'route-tree'` SubTab) | Browser / Client | — | `SubTab` union + `SECTIONS` const in `src/app/page.tsx` |
| Bridge to Manual Plan (`ManualPlan` write + sub-tab switch) | Browser / Client | — | `persistManualPlan` writes localStorage; `setActiveSubTab('manual-plan')` is a parent-owned setter passed as callback prop |
| Recommended-path highlight | Browser / Client (component) | — | CSS-only `ring-inset` class application; no JS layout calc |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | 19.2.4 (installed) | UI rendering | Already the project standard |
| use-immer | ^0.11.0 (installed) | Local mutable plan state when needed | Used in PlannerTab + ManualPlanTab; established pattern |
| Tailwind CSS | ^4 (installed) | Styling | All Phase 47–59 components use Tailwind classes only |
| Vitest + @testing-library/react | ^4.1.2 / ^16.3.2 (installed) | Unit + RTL component tests | Project test stack |

[VERIFIED: package.json — react 19.2.4, use-immer ^0.11.0, vitest ^4.1.2, @testing-library/react ^16.3.2 already installed]

**No new npm dependencies are required for Phase 60.** This is the most important stack-level finding: the pure engine reuses `computeNextFTState` / `computeHitCost` / `snapshotSquad` from `src/lib/free-transfer-engine.ts` (Phase 56) and the sell-value / xPts-lookup pattern from `src/lib/suggest-transfers.ts` (Phase 45). The UI reuses `HorizonSelector`, `ChipToggle` (at the Plan section level — gap noted above), the `ring-2 ring-green-700 dark:ring-green-300` recommended pattern from `ChipStrategyPanel.tsx:56`, and the `<table className="overflow-x-auto">` pattern from `TransferPlanTable.tsx` and ManualPlanTab.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-query | ^5.95.2 (installed) | Already used by `usePlayers` / `useSquad` / `useMyTeam` | Reused indirectly; do not call directly in Phase 60 |
| zod | ^4.3.6 (installed) | Runtime validation in adapter layer | Not needed for Phase 60 (no new API responses) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reuse `planning-engine.ts:generatePlan` recursively | Custom standalone engine in `transfer-route-tree.ts` | Reusing `generatePlan` would force every branch through identical logic — but D-01 (skip if no positive xPts gain, NEVER take a hit) differs from `generatePlan`'s `netGain = totalScore + hitCost` rule (which **does** take hits when net-positive). Custom engine is cleaner and correctly enforces D-01. [CITED: src/lib/planning-engine.ts:151 `bestTransfer = allScoredTransfers.find(t => t.netGain > 0)`] |
| Forking root selection per position (e.g., lowest GK + lowest DEF + lowest MID) | All-position lowest-3 by `xPts_1gw` (D-03) | Locked by CONTEXT.md D-03. The lowest-3 might cluster in one position — that's acceptable; the per-branch greedy continuation explores other positions in subsequent steps |
| Storing tree results in `useMemo` keyed by squad+horizon+chip | Recomputing on every render | `useMemo` is already the established pattern (PlannerTab line 38, ManualPlanTab lines 49-156). Tree is small (3 branches × 5 GWs × ~20 candidates per step) so recompute is fast (<10ms per UI-SPEC §loading state expectation), but memoising prevents unnecessary table re-render |

**Installation:** None required.

**Version verification:** All dependencies already installed and verified at expected versions. Most recently: p-limit ^6.2.0 was added for Phase 58 (commit 6e8ea0e in main). [VERIFIED: package.json + node_modules]

---

## Architecture Patterns

### System Architecture Diagram

```
User clicks "Route Tree" sub-tab
        |
        v
RouteTreeTab.tsx (mounts)
        |
        |-- reads: picks (from useMyTeam → useSquad), playerMap (from usePlayers + computeAllGemScores),
        |            initialFTState (lift from PlannerTab pattern), bankBalance, sellPrices,
        |            horizon (D-07 prop from page.tsx), chipMode (D-08 prop from page.tsx)
        |
        |-- early-return guards:
        |     - !picks → no-squad branch (Team ID input + Load Squad button — mirror Phase 59 D-09)
        |     - scoredPlayers.length === 0 → "Computing routes…"
        |
        v
buildTransferRouteTree({ picks, playerMap, horizon, chipMode, initialFTState, bankBalance, sellPrices })
   --- pure engine in src/lib/transfer-route-tree.ts ---
        |
        |-- step 1: identify 3 sell roots (lowest xPts_1gw across 15 picks per D-03)
        |
        |-- for each root r in roots:
        |     |-- branch state: squad = picks (sell r already chosen for GW1)
        |     |                 ft     = initialFTState
        |     |                 bank   = bankBalance
        |     |                 chip   = chipMode (first GW only)
        |     |                 chipsConsumed = []
        |     |-- step 1: position-matched best buy for r → first transfer
        |     |   (greedy: max xPts_h gain among same-position pool, budget-checked)
        |     |   (if no positive-gain match, branch holds GW1 — produces empty branch, dropped from results)
        |     |-- for h in 2..horizon:
        |     |     |-- compute ft = computeNextFTState(prev_ft.available, prev_transfers, prev_chip)
        |     |     |-- if ft.available === 1: greedy 0/1 transfer (D-01)
        |     |     |-- if ft.available === 2: greedy 0/1/2 transfer (D-04)
        |     |     |     - 1st transfer: best positive-gain across all positions
        |     |     |     - 2nd transfer: best positive-gain at any other squad slot
        |     |     |       (must individually be positive — D-04)
        |     |     |-- record RouteNode { gw, ftBefore, transfers[], hitCost: 0, xPtsContribution }
        |     |-- aggregate: totalTransfers, totalHits=0 (D-01), totalHitCostPts=0,
        |     |              netXpts = sum(node.xPtsContribution), chipsConsumed[]
        |
        |-- recommendedPathIndex = argmax_i(branches[i].netXpts)
        |
        v
TransferRouteTree { paths: RoutePath[], recommendedPathIndex: number }
        |
        v
Summary table (overflow-x-auto)
   |-- One <tr> per path
   |-- Recommended row: ring-inset ring-green-700 + bg-zinc-50 + Recommended badge
   |-- Expand chevron → reveals breakdown <tr> with colSpan={6}
   |-- Action column: "Load into Manual Planner" button OR inline confirm (3 states)
        |
        v
On "Load into Manual Planner" click:
   |-- check loadManualPlan() — if any step has transfers.length > 0 → confirm prompt
   |-- on confirm: build ManualPlan { version: 1, horizon, steps: routePath.nodes.map(n => ({
   |                gw: n.gw, chip: null, transfers: n.transfers
   |              })) }
   |-- persistManualPlan(plan) [from src/lib/manual-plan.ts]
   |-- onSwitchSubTab('manual-plan') prop callback → page.tsx setActiveSubTab
```

### Recommended Project Structure

```
src/
├── lib/
│   └── transfer-route-tree.ts        # NEW — pure engine (no React, no side effects)
├── components/
│   └── planner/
│       └── RouteTreeTab.tsx          # NEW — UI container
│       └── RouteTreeTab.test.tsx     # NEW — RTL tests, co-located (matches ManualPlanTab.test.tsx)
└── app/
    └── page.tsx                      # MODIFY — SubTab union + SECTIONS Plan subTabs + render guard

tests/
└── lib/
    └── transfer-route-tree.test.ts   # NEW — engine unit tests (matches free-transfer-engine.test.ts pattern)
```

### Pattern 1: Pure-Engine Module (mirrors `suggest-transfers.ts` + `planning-engine.ts`)

**What:** A pure-function TypeScript module exporting `buildTransferRouteTree(args)` plus typed helpers. No React imports. No `'use client'`. No side effects. Importable by Vitest in `node` or `jsdom` environment.

**When to use:** Any computation that can be expressed as input → output without DOM/React. The engine for Phase 60 is exactly this shape.

**Example skeleton:**

```typescript
// Source: pattern from src/lib/suggest-transfers.ts:81 (function signature shape)
//         + src/lib/planning-engine.ts:69–177 (per-step greedy loop)
import type { ScoredPlayer, FTState, PlannerHorizon, PlannerChip } from './types'
import type { SquadPick } from './squad-adapter'
import { computeNextFTState, computeHitCost, snapshotSquad } from './free-transfer-engine'
import { fixtureCountForGw } from './planning-engine'  // reusable DGW/BGW helper

export interface RouteNode {
  gw: number
  ftBefore: FTState
  transfers: { sellId: number; buyId: number }[]   // 0, 1, or 2 entries
  hitCost: 0                                         // always 0 per D-01 (no hits taken)
  chip: PlannerChip                                  // null except possibly node[0] when chipMode supplied
  xPtsContribution: number                           // sum of (buy.xPts_1gw - sell.xPts_1gw) * fixtureCount across legs
  squadAfter: number[]                               // 15 player IDs after applying this node's transfers
}

export interface RoutePath {
  rootSellId: number                                 // identifies which root (one of 3) this branch started from
  nodes: RouteNode[]                                 // length = horizon
  totalTransfers: number
  totalHits: 0                                       // always 0 per D-01
  totalHitCostPts: 0                                 // always 0 per D-01
  netXpts: number                                    // sum(node.xPtsContribution)
  chipsConsumed: PlannerChip[]                       // chips applied across the path (max 1 if chipMode set)
}

export interface TransferRouteTree {
  paths: RoutePath[]                                 // 0–3 entries (drop branches where root holds GW1)
  recommendedPathIndex: number                       // argmax of paths[i].netXpts; -1 when paths is empty
}

export interface BuildTransferRouteTreeArgs {
  picks: SquadPick[]
  players: ScoredPlayer[]
  horizon: PlannerHorizon
  initialFT: FTState
  initialBank: number
  sellPrices: Map<number, number> | undefined
  chipMode: PlannerChip                              // active chip from Plan section header (TRT-06)
  startingGw: number
}

export function buildTransferRouteTree(args: BuildTransferRouteTreeArgs): TransferRouteTree {
  // ... see Algorithmic Pseudocode below
}
```

### Pattern 2: Component with Two-Stage State (mirrors ManualPlanTab.tsx)

**What:** A React function component using `useState` for transient UI state (open accordions, confirm-row index) and `useMemo` for derived engine output keyed on inputs.

**When to use:** Any tab component that consumes hooks for data + renders a table + reacts to user clicks.

**Example skeleton:**

```typescript
// Source: pattern from src/components/planner/ManualPlanTab.tsx:38–115
'use client'

import { useState, useMemo, useCallback } from 'react'
import { usePlayers, useSquad, useMyTeam, useAuthStatus } from '@/lib/hooks/...'
import { computeAllGemScores } from '@/lib/gem-score'
import { buildTransferRouteTree } from '@/lib/transfer-route-tree'
import { persistManualPlan, loadManualPlan } from '@/lib/manual-plan'
import type { PlannerHorizon, PlannerChip } from '@/lib/types'

interface RouteTreeTabProps {
  submittedId: string | null
  horizon: PlannerHorizon                    // lifted from page.tsx (D-07) — see Open Question 1
  chipMode: PlannerChip                      // lifted from page.tsx (D-08) — see Open Question 1
  onSwitchSubTab: (tab: 'manual-plan') => void
}

export function RouteTreeTab({ submittedId, horizon, chipMode, onSwitchSubTab }: RouteTreeTabProps) {
  // ... hooks (mirror ManualPlanTab.tsx:42–56)
  // ... initialFTState (mirror ManualPlanTab.tsx:75–82 verbatim)
  // ... sellPriceMap (mirror ManualPlanTab.tsx:85–91)

  const [expandedPaths, setExpandedPaths] = useState<Set<number>>(() => new Set())
  const [confirmingLoadIndex, setConfirmingLoadIndex] = useState<number | null>(null)

  const tree = useMemo(() => {
    if (!picks || !startingGw || playerMap.size === 0) return null
    return buildTransferRouteTree({
      picks,
      players: scoredPlayers,
      horizon,
      initialFT: initialFTState,
      initialBank: bankBalance,
      sellPrices: sellPriceMap,
      chipMode,
      startingGw,
    })
  }, [picks, scoredPlayers, horizon, initialFTState, bankBalance, sellPriceMap, chipMode, startingGw, playerMap])

  // ... render branches (mirror UI-SPEC §States Required)
}
```

### Pattern 3: Bridge via `persistManualPlan` + Sub-Tab Switch Callback

**What:** Write the bridge payload through `persistManualPlan` (already shipped + tested in Phase 59) and trigger the tab switch via a callback prop owned by `page.tsx`. The component never directly mutates URL or page state.

**When to use:** When one Plan sub-tab needs to hand off state to another. Phase 60 → Phase 59 is the first use.

**Example:**

```typescript
// Source: src/lib/manual-plan.ts:221–228 (persistManualPlan)
//         src/app/page.tsx:128–130 (handleSubTabChange)
const handleConfirmLoad = useCallback(() => {
  if (!tree || confirmingLoadIndex === null) return
  const path = tree.paths[confirmingLoadIndex]
  const bridgePlan: ManualPlan = {
    version: 1,
    horizon,
    steps: path.nodes.map(n => ({
      gw: n.gw,
      chip: null,                    // D-09: chip = null per step
      transfers: n.transfers,
    })),
  }
  persistManualPlan(bridgePlan)
  setConfirmingLoadIndex(null)
  onSwitchSubTab('manual-plan')      // parent (page.tsx) flips activeSubTab
}, [tree, confirmingLoadIndex, horizon, onSwitchSubTab])
```

### Anti-Patterns to Avoid

- **Hand-rolling FT bank logic.** Use `computeNextFTState` from `free-transfer-engine.ts`. It already handles wildcard preserve (FTX-02), free-hit pass-through, and the cap of 2 available + 1 banked. Reimplementing it risks regressing Phase 56's locked behaviour. [VERIFIED: src/lib/free-transfer-engine.ts:3–25]
- **Hand-rolling sell-price fallback.** Use the established `sellPrices?.get(id) ?? player.now_cost ?? 0` cascade. [VERIFIED: src/lib/suggest-transfers.ts:59–67, src/lib/manual-plan.ts:122]
- **Mutating `picks` or `players` arrays.** All branches must work from `snapshotSquad(currentSquad)` copies — multiple branches share the same input squad and any mutation would corrupt sibling branches.
- **Recomputing `playerMap` per branch.** Build it once outside the branch loop (Map<number, ScoredPlayer>); reuse across all 3 branches and all H steps.
- **Calling `generatePlan` per branch.** It applies a different rule (`netGain = totalScore + hitCost`, accepts hits if net-positive). Phase 60 D-01 forbids hits entirely. Use a custom per-step loop that filters `xPtsGain > 0` only. [CITED: src/lib/planning-engine.ts:151]
- **Persisting `expandedPaths` to localStorage.** UI-SPEC §Interaction Contracts: session-only.
- **Writing the bridge payload synchronously inside the same handler that switches sub-tabs without a layout-flush check.** The current Phase 59 `loadManualPlan` reads localStorage on mount, so the order is: (1) `persistManualPlan(...)`, (2) `onSwitchSubTab('manual-plan')` — Phase 59's `useImmer` lazy initialiser then re-runs on mount of `ManualPlanTab` and reads the new value. **Verified by reading ManualPlanTab.tsx:97–101** — `useImmer<ManualPlan>(() => { const restored = loadManualPlan(); ... })` is a lazy initialiser that runs on mount.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FT bank propagation across GWs | Custom `computeNextFTState` | `computeNextFTState` from `src/lib/free-transfer-engine.ts` | Phase 56 already covers FTX-01 (cap of 2 available + 1 banked) and FTX-02 (WC/FH preserve). Hand-rolling breaks the regression contract |
| Hit cost computation | Custom hit-cost math | `computeHitCost` from `src/lib/free-transfer-engine.ts` | Same as above. Phase 60 doesn't take hits per D-01 but should still call `computeHitCost(ft.available, transfers.length, chip)` for consistency and to render `0` correctly when `ft.available >= transfers.length` |
| Squad array deep-copy | `JSON.parse(JSON.stringify(...))` or manual loop | `snapshotSquad` from `src/lib/free-transfer-engine.ts` | Already uses `structuredClone` — handles primitives correctly with no transferable-object concerns |
| Sell-value lookup | Custom price-fallback logic | The `sellPrices?.get(id) ?? player.now_cost ?? 0` cascade from `suggest-transfers.ts:59–67` | Standard pattern across Phase 45 / 50 / 59. Handles authenticated vs unauthenticated users transparently |
| Position-matched candidate filter | Custom filter loop | The `inPoolByPosition` Map pattern from `suggest-transfers.ts:90–98` | Caps top-N per position by xPts (D-03 of Phase 45 mirrors D-04 of Phase 60) — already proven |
| GW DGW/BGW fixture-count multiplier | Custom counting | `fixtureCountForGw` from `src/lib/planning-engine.ts:21` | Returns 0 (BGW) / 1 (normal) / 2 (DGW) with a single-line filter; correctly handles the GW score multiplier per Phase 28 D-XX |
| localStorage write/read for the bridge payload | Custom JSON.stringify + try/catch | `persistManualPlan` / `loadManualPlan` from `src/lib/manual-plan.ts:221, 230` | Already MTP-08-tested with version validation, horizon range check, chip enum check, and SSR `typeof window` guard |
| Recommended-path ring style | Custom ring CSS | The `ring-2 ring-offset-1 ring-green-700 dark:ring-green-300` pattern from `ChipStrategyPanel.tsx:56` (modified to `ring-inset` for `<tr>` per UI-SPEC §Layout choice) | Established codebase pattern; reusing preserves visual continuity |
| Free / Hit −4 pts badges in the breakdown | Custom badge | The exact classes from Phase 59 `TransferRow` | UI-SPEC §Component Inventory specifies "Badges reuse the exact classes from Phase 59 `TransferRow`" |
| No-squad empty-state | Custom empty-state | The Team ID input + Load Squad button block from `ManualPlanTab.tsx:269–311` | Mirrors Phase 59 D-09 verbatim per UI-SPEC §States Required |

**Key insight:** Phase 60 is **almost entirely composition** of Phases 56 / 45 / 59 primitives. The only genuinely new code is (a) the 3-root sell selection, (b) the per-branch greedy continuation orchestration, and (c) the side-by-side summary table presentation. Treat anything beyond these three concerns as a sign the implementer is reinventing instead of reusing.

---

## Algorithmic Pseudocode

This section is research — not the plan — but it establishes the engine's correctness shape so the planner can split tasks cleanly.

```text
function buildTransferRouteTree(args):
    playerMap = Map(args.players.map(p => [p.id, p]))
    field    = HORIZON_FIELD[args.horizon]            // 'xPts_1gw' | 'xPts_3gw' | 'xPts_5gw'
                                                       //   from optimise-lineup.ts

    # --- Step A: pick 3 sell roots (D-03) ---
    pickedPlayers = args.picks.map(pk => playerMap.get(pk.element)).filter(p => p)
    sortedAsc     = pickedPlayers.sort((a,b) => (a.xPts_1gw ?? 0) - (b.xPts_1gw ?? 0))
    rootIds       = sortedAsc.slice(0, 3).map(p => p.id)

    # --- Step B: build each branch ---
    paths = []
    for rootId in rootIds:
        branch = buildBranch(rootId, args, playerMap, field)
        if branch.nodes.length > 0 AND branch.nodes[0].transfers.length > 0:
            # only include branches where the root sell actually fired
            paths.push(branch)

    # --- Step C: recommend the highest-net-xPts path ---
    if paths.length === 0:
        return { paths: [], recommendedPathIndex: -1 }
    best = paths.reduce((bi, p, i, arr) => p.netXpts > arr[bi].netXpts ? i : bi, 0)
    return { paths, recommendedPathIndex: best }


function buildBranch(rootId, args, playerMap, field):
    squad     = snapshotSquad(args.picks.map(p => p.element))
    positions = Map(args.picks.map(p => [p.element, p.position]))
    bank      = args.initialBank
    ft        = { ...args.initialFT }
    chipForGw = args.chipMode    // applied to GW1 only — TRT-06

    nodes = []

    for h in 0..args.horizon-1:
        gw = args.startingGw + h
        chip = (h === 0) ? chipForGw : null

        if h === 0:
            # forced root transfer (D-03)
            sellPlayer = playerMap.get(rootId)
            buyPlayer  = bestPositionMatchedBuy(sellPlayer, squad, args, playerMap, field, bank, gw)
            transfers  = buyPlayer ? [{ sellId: rootId, buyId: buyPlayer.id }] : []
        else:
            # greedy continuation (D-01 / D-04)
            transfers = greedyTransfersForStep(squad, positions, ft, bank, args, playerMap, field, gw, chip)

        # apply transfers to mutable state
        for t in transfers:
            sellPrice = sellValueFor(t.sellId, args.sellPrices, playerMap)
            buyCost   = playerMap.get(t.buyId).now_cost
            bank      = bank + sellPrice - buyCost
            squad     = squad.map(id => id === t.sellId ? t.buyId : id)
            pos       = positions.get(t.sellId); positions.delete(t.sellId); positions.set(t.buyId, pos)

        # compute xPts contribution (sum of per-leg deltas, fixture-count adjusted)
        xPtsContribution = sum_over_legs(
          (buy.xPts_1gw ?? 0) * fixtureCountForGw(buy, gw)
          - (sell.xPts_1gw ?? 0) * fixtureCountForGw(sell, gw)
        )
        # NOTE: for horizons > 1, the per-leg delta is computed per-GW with xPts_1gw and the
        #       per-fixture multiplier; the horizon roll-up sums xPtsContribution across nodes.
        #       This matches planning-engine.ts:120 (gwScore) and is the canonical pattern.

        ft_next = computeNextFTState(ft.available, transfers.length, chip)
        hitCost = computeHitCost(ft.available, transfers.length, chip)   // expected 0 per D-01

        nodes.push({
            gw, ftBefore: { ...ft }, transfers,
            hitCost, chip, xPtsContribution,
            squadAfter: snapshotSquad(squad)
        })

        ft = ft_next

    netXpts        = sum(nodes.map(n => n.xPtsContribution))
    totalTransfers = sum(nodes.map(n => n.transfers.length))
    chipsConsumed  = nodes.filter(n => n.chip != null).map(n => n.chip)

    return { rootSellId: rootId, nodes, totalTransfers, totalHits: 0, totalHitCostPts: 0,
             netXpts, chipsConsumed }


function greedyTransfersForStep(squad, positions, ft, bank, args, playerMap, field, gw, chip):
    transfers = []
    workingSquad = [...squad]
    workingBank  = bank

    # If chip is wildcard or freehit (only possible on h===0), the root path branch handled
    # transfer 0; this function handles h>=1, where chip is null. (TRT-06 chip mode is a
    # GW-1-only concept per D-08 / UI-SPEC §States.)

    maxTransfers = ft.available           // 1 or 2 — never take a hit per D-01
    for slot in 0..maxTransfers-1:
        best = pickBestPositiveGain(workingSquad, positions, args, playerMap, field, workingBank, gw, exclude=transfers)
        if !best: break                   // D-01: skip if no positive gain
        transfers.push(best)
        workingSquad = workingSquad.map(id => id === best.sellId ? best.buyId : id)
        workingBank  = workingBank + sellValueFor(best.sellId, args.sellPrices, playerMap) - playerMap.get(best.buyId).now_cost

    return transfers


function pickBestPositiveGain(squad, positions, args, playerMap, field, bank, gw, exclude):
    bestGain     = 0
    bestTransfer = null
    excludedSells = Set(exclude.map(t => t.sellId))
    excludedBuys  = Set(exclude.map(t => t.buyId))

    for sellId in squad:
        if excludedSells.has(sellId): continue
        sellPlayer = playerMap.get(sellId); if !sellPlayer: continue
        sellPrice  = sellValueFor(sellId, args.sellPrices, playerMap)
        candidates = topNPerPosition(args.players, sellPlayer.element_type, ownedIds=Set(squad), n=20, sortField=field)
                       .filter(c => !excludedBuys.has(c.id))

        for buy in candidates:
            if buy.now_cost > bank + sellPrice: continue   // budget guard
            gain = (buy.xPts_1gw ?? 0) * fixtureCountForGw(buy, gw)
                 - (sellPlayer.xPts_1gw ?? 0) * fixtureCountForGw(sellPlayer, gw)
            if gain > bestGain:
                bestGain     = gain
                bestTransfer = { sellId, buyId: buy.id, gain }

    return bestTransfer
```

**Complexity** (worst-case for horizon=5, 3 roots):
- 3 branches × 5 GWs × (15 squad slots × 20 candidates per position) ≈ **1,500 candidate evaluations per branch**
- 3 branches × 5 GWs × 1500 = **22,500 ops total**
- ~10ms in V8 — well under the `useMemo` re-render budget. UI-SPEC §loading-state confirms: "useMemo is sync, so this rarely renders for more than one frame."

---

## Runtime State Inventory

> Greenfield-style additive feature — no rename, refactor, or migration.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `fplx_manual_plan` localStorage key — Phase 59 owns it; Phase 60 **writes** to it via `persistManualPlan` (D-08 bridge); the `MANUAL_PLAN_KEY` is a Phase 59 constant exported from `src/lib/manual-plan.ts:5` and reused as-is | None — write through the existing helper. Phase 60 does NOT introduce its own localStorage key |
| Live service config | None — Phase 60 makes no API calls of its own (no FPL proxy calls, no blob-store writes) | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | TypeScript transpilation produces `.next/` artifacts as usual; no special handling | None |

**Nothing found in any non-trivial category.** Phase 60 is purely additive: 1 new pure-lib file, 1 new component file, 1 co-located test, and surgical edits to `src/app/page.tsx`. The only existing storage it touches is Phase 59's `fplx_manual_plan`, and only via the published helpers `persistManualPlan` / `loadManualPlan`.

---

## Common Pitfalls

### Pitfall 1: D-01 vs `generatePlan`'s `netGain > 0` rule
**What goes wrong:** Implementer copies `planning-engine.ts:151` (`bestTransfer = allScoredTransfers.find(t => t.netGain > 0)`) thinking it matches D-01. It doesn't — `generatePlan` accepts hits when `netGain = totalScore - 4 > 0`. Phase 60 D-01 says **never take a hit** ("0 or 1 transfer per step, skip if no positive xPts gain").
**Why it happens:** The two engines look superficially identical; the difference is one `+ hitCost` term.
**How to avoid:** The greedy function must use `xPtsGain > 0` as the gate (not `netGain`), and `maxTransfers = ft.available` (never exceed FTs). [CITED: src/lib/suggest-transfers.ts:175 `if (gain1 <= 0) continue` — Phase 45's per-leg positive-only filter is the correct shape]
**Warning signs:** Tree generates a path with `totalHits > 0` or `totalHitCostPts !== 0`. Both must be 0 for every path under D-01.

### Pitfall 2: D-04 "individually positive" misread as "additively positive"
**What goes wrong:** When 2 FTs are available, implementer scores combos by `gain1 + gain2 > 0`, which can pass when `gain1 = +5, gain2 = -2`. D-04 says **both legs must individually be positive**.
**Why it happens:** This is the same confusion that motivated the explicit per-leg filter in `suggest-transfers.ts:175,179`.
**How to avoid:** Greedy loop applies one transfer at a time, refusing to add a second if no second `gain > 0` candidate exists. [CITED: src/lib/suggest-transfers.ts:175,179 — exact pattern]
**Warning signs:** A 2-transfer step where one of the buys has lower `xPts_1gw` than the player it replaced.

### Pitfall 3: Sell-root chosen by `xPts_1gw` but engine scores branches by horizon-window xPts
**What goes wrong:** D-03 says "3 squad players with the lowest `xPts_1gw`" — but if horizon=5, a player with low `xPts_1gw` might have high `xPts_5gw` (e.g., a player whose first GW is a BGW). Selecting on `xPts_1gw` is correct **for root selection** but the engine still scores the path's net xPts using per-GW contributions over the horizon.
**Why it happens:** Looks inconsistent — different fields used at different stages.
**How to avoid:** Document explicitly in the engine: "Roots are selected by `xPts_1gw` per CONTEXT D-03 (worst-immediate-week target). Path xPts is summed using per-GW `xPts_1gw * fixtureCount` to correctly handle DGW/BGW within the horizon." This is the canonical pattern from `planning-engine.ts:120` (`gwScore = (buy.xPts_1gw ?? 0) * fixtureCountForGw(buy, targetGw) - ...`).
**Warning signs:** A test asserts that root selection respects horizon — that test would be wrong; D-03 locks `xPts_1gw`.

### Pitfall 4: Section-level `HorizonSelector` doesn't exist yet (D-07)
**What goes wrong:** UI-SPEC says Route Tree reads `horizon` as a prop "from the Plan section header" — but the Plan section doesn't yet have a header-level horizon selector. Each Plan sub-tab manages its own horizon today.
**Why it happens:** D-07 anticipates a structural change (lifting horizon state to `page.tsx` at the Plan-section level) that has not been spec'd as a separate task.
**How to avoid:** Resolve in discuss-phase BEFORE planning. Two viable options:
  - (a) **Lift horizon to `page.tsx`** — add `[planHorizon, setPlanHorizon]` state in `page.tsx`, render a `HorizonSelector` in the Plan section header before the sub-tab nav, and pass `planHorizon` to PlannerTab / ManualPlanTab / RouteTreeTab as a prop. Removes the local horizon state from PlannerTab and ManualPlanTab. (Touches 3 component files.)
  - (b) **Keep horizon local in RouteTreeTab** — Route Tree manages its own `useState<PlannerHorizon>(3)` and renders its own HorizonSelector at the top of its tab body. Cheapest change, but contradicts UI-SPEC §Reused Components which says "Route Tree does NOT render its own HorizonSelector".
**Warning signs:** A plan task that says "read `horizon` prop from `page.tsx`" without also adding a corresponding `[planHorizon, setPlanHorizon]` state + section-level `HorizonSelector` element.

### Pitfall 5: `chipMode` prop shape mismatch (TRT-06)
**What goes wrong:** UI-SPEC §Pre-Population Sources says "Active chip respected by tree engine — CONTEXT.md D-08 (renamed from `chipMode` prop)". But CONTEXT.md D-08 is about the bridge confirm prompt — it has nothing to do with `chipMode`. The `chipMode` of a Plan-section header doesn't currently exist (PlannerTab and ManualPlanTab both manage chips per-step, not at the section level).
**Why it happens:** Same root cause as Pitfall 4 — UI-SPEC anticipates section-level state that doesn't exist.
**How to avoid:** Resolve in discuss-phase. Most consistent with existing patterns: **TRT-06 reads chip state from each path's GW1 step locally** (i.e., user selects WC/FH/BB inside Manual Plan after loading the route, not before). The Route Tree engine accepts an optional `chipMode: PlannerChip` arg defaulting to `null`. The UI exposes a `ChipToggle` only at the section level if/when option (a) from Pitfall 4 is taken. Otherwise, TRT-06 can be implemented but is effectively unused until section-level chip state lands.
**Warning signs:** A plan that asserts "chip changes affect the tree" without specifying where the chip state lives.

### Pitfall 6: Existing `HorizonSelector` shows 5 buttons but UI-SPEC text says "1 / 3 / 5"
**What goes wrong:** UI-SPEC §Color §Accent reads "Active state of `HorizonSelector` segments (1 / 3 / 5 GW)". But `HorizonSelector.tsx:5` declares `const HORIZONS: PlannerHorizon[] = [1, 2, 3, 4, 5]`.
**Why it happens:** Phase 60 spec author may have been thinking of the `OptimiserHorizon` (1 / 3 / 5) which corresponds to the available `xPts_*gw` fields.
**How to avoid:** The engine works for horizons 1–5 (per-GW xPts is summed). The UI reads whichever values the existing 5-button `HorizonSelector` provides. **No change to `HorizonSelector` is needed**, and TRT-07 ("recalculates when GW horizon toggle changes — 1 / 3 / 5 GW") is satisfied by the existing 5-button selector triggering recompute on any change.
**Warning signs:** A plan task that proposes editing `HorizonSelector.tsx` to remove buttons 2 and 4 — that would regress PlannerTab and ManualPlanTab which already use 5 buttons.

### Pitfall 7: Bridge fires before `loadManualPlan` lazy-init has rerun
**What goes wrong:** `RouteTreeTab` calls `persistManualPlan(plan)` then `onSwitchSubTab('manual-plan')`. `ManualPlanTab` is mounted on tab switch — its `useImmer<ManualPlan>(() => { const restored = loadManualPlan(); ... })` lazy initialiser then runs. If the order is somehow reversed (e.g., `ManualPlanTab` was already mounted earlier and its state isn't re-read), the user sees stale plan.
**Why it happens:** Tab visibility in the current `page.tsx` is render-conditional — `ManualPlanTab` is **only rendered** when `activeSection === 'plan' && activeSubTab === 'manual-plan'` is true. So on first visit it mounts fresh and reads localStorage. But if the user has visited Manual Plan once already, then visits Route Tree, then loads a route and goes back to Manual Plan, **`ManualPlanTab` will unmount and re-mount** because of the conditional rendering — its state is reset, the lazy initialiser re-runs, and it picks up the fresh localStorage write. Verified by reading `page.tsx:179–227` — every sub-tab is conditionally rendered, no `display: none` retention.
**How to avoid:** This is actually safe given the current `page.tsx` structure. Plan task should add a Vitest test asserting the order: (1) `persistManualPlan` is called with the bridge payload; (2) `onSwitchSubTab` is called with `'manual-plan'`. Add an integration test that mounts `<Home />`, navigates Route Tree → Load → Manual Plan, and asserts the plan content is present. [VERIFIED: src/app/page.tsx:179–227 — render-conditional structure]
**Warning signs:** A plan that suggests storing the bridge payload in React state passed via prop rather than localStorage. That would break Phase 59's MTP-08 contract (state survives page navigation).

### Pitfall 8: Float ordering instability for sell-root selection
**What goes wrong:** Sorting by `xPts_1gw` ascending — if two players have identical `xPts_1gw` (e.g., both BGW with `xPts_1gw === 0`), JavaScript's sort is stable in modern engines but the input order is non-deterministic if `picks` order differs across runs.
**Why it happens:** FPL's `picks` array order is by `position` (1–15), so the order is deterministic for a given user. But across users, two players with `xPts_1gw === 0` could be sorted in any order.
**How to avoid:** Add a secondary sort key (e.g., `now_cost` ascending for tie-break) so the tree is deterministic given a fixed input squad. This makes tests reproducible. Document explicitly: "Tie-break by `now_cost` ascending, then `id` ascending, for determinism."
**Warning signs:** A test that sometimes produces 2 paths and sometimes 3 with the same input.

### Pitfall 9: Empty branches when root has no positive-gain replacement
**What goes wrong:** D-03 says the root is the player sold in GW1. But what if no position-matched buy with `xPts_1gw` higher than the root exists in the candidate pool? The branch's GW1 transfer would be a hold, contradicting "the root becomes the player sold in GW1".
**Why it happens:** Possible for a low-xPts root that is at the very top of its position (e.g., root is the cheapest GK and no GK has higher xPts AND fits the budget).
**How to avoid:** Two options — (i) drop branches where the root's GW1 transfer fails to fire (returns 0–3 paths in `tree.paths`); (ii) force the root sell anyway and pick the best (even non-improving) replacement. **CONTEXT.md D-03 says "Position-matched replacement (the best available buy for that position) is applied immediately as the root transfer"** — this implies (ii): force the sell. But D-01 says "skip if no positive xPts gain" for greedy continuation, which is option (i)-flavoured. The safest reading: **GW1 force-sells the root with the best available buy (even non-positive); GW2..H apply D-01 (skip on no-positive-gain).** Document this explicitly in the engine.
**Warning signs:** Test asserts a branch whose root has no positive-gain match has no GW1 transfer — engine should produce a non-positive transfer in that case (or drop the branch — discuss-phase decision).

### Pitfall 10: Em-dash vs hyphen in negative xPts display
**What goes wrong:** UI-SPEC §Copywriting Contract uses `−` (U+2212 minus sign) for negative values, NOT the hyphen-minus `-` (U+002D). Easy to forget.
**Why it happens:** Both characters render similarly but search/replace and copy-paste from terminal output produce hyphens.
**How to avoid:** Reuse the exact display patterns from Phase 58 / 59. ManualPlanTab.tsx:351 uses `−${Math.abs(...)} pts` with U+2212 already. [VERIFIED: src/components/planner/ManualPlanTab.tsx:351]
**Warning signs:** Snapshot test that captures `-4 pts` instead of `−4 pts`.

---

## Code Examples

### Example 1: Building a position-matched candidate pool (per-step within branch)

```typescript
// Source: src/lib/suggest-transfers.ts:90–98 (verified pattern)
const inPoolByPosition = new Map<1 | 2 | 3 | 4, ScoredPlayer[]>()
const ownedIds = new Set<number>(currentSquad)
for (const pos of [1, 2, 3, 4] as const) {
  const candidates = scoredPlayers
    .filter(p => p.element_type === pos && !ownedIds.has(p.id))
    .sort((a, b) => (b[field] as number ?? 0) - (a[field] as number ?? 0))
    .slice(0, 20)  // top-20 per position by horizon xPts (D-03 of Phase 45)
  inPoolByPosition.set(pos, candidates)
}
```

### Example 2: Recommended-row highlight on `<tr>`

```typescript
// Source: pattern from src/components/planner/ChipStrategyPanel.tsx:56,
//         adapted to <tr> per UI-SPEC §Layout choice (ring-inset required for table substrate)
<tr className={isRecommended
  ? 'ring-2 ring-offset-0 ring-inset ring-green-700 dark:ring-green-300 bg-zinc-50 dark:bg-zinc-800'
  : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}>
  <td>{/* path label */}</td>
  {/* ... */}
</tr>
```

### Example 3: Inline confirm state (3-state button)

```typescript
// Source: derived from UI-SPEC §"Load into Manual Planner" button — three states
{confirmingLoadIndex === i ? (
  <div className="flex items-center gap-2">
    <span className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
      Replace current plan?
    </span>
    <button onClick={() => handleConfirmLoad(i)}
      className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold rounded min-h-[44px] px-3 py-2 text-sm cursor-pointer">
      Yes, replace
    </button>
    <button onClick={() => setConfirmingLoadIndex(null)}
      className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 underline-offset-2 hover:underline cursor-pointer min-h-[44px] px-2">
      Cancel
    </button>
  </div>
) : (
  <button onClick={() => handleClickLoad(i)}
    className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold rounded min-h-[44px] px-3 py-2 text-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer whitespace-nowrap">
    Load into Manual Planner
  </button>
)}
```

### Example 4: Bridge payload write + tab switch

```typescript
// Source: composition of src/lib/manual-plan.ts:221 (persistManualPlan)
//         + src/app/page.tsx:128–130 (handleSubTabChange)
const handleClickLoad = useCallback((i: number) => {
  if (!tree) return
  const existing = loadManualPlan()
  const hasTransfers = existing?.steps.some(s => s.transfers.length > 0) ?? false
  if (hasTransfers) {
    setConfirmingLoadIndex(i)
  } else {
    handleConfirmLoad(i)  // silent overwrite per D-08
  }
}, [tree])

const handleConfirmLoad = useCallback((i: number) => {
  if (!tree) return
  const path = tree.paths[i]
  const bridge: ManualPlan = {
    version: 1,
    horizon,
    steps: path.nodes.map(n => ({
      gw: n.gw,
      chip: null,                        // D-09
      transfers: n.transfers,
    })),
  }
  persistManualPlan(bridge)
  setConfirmingLoadIndex(null)
  onSwitchSubTab('manual-plan')          // page.tsx flips activeSubTab; ManualPlanTab re-mounts and reads bridge from localStorage
}, [tree, horizon, onSwitchSubTab])
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manually compute FT bank in each component | `computeNextFTState` in `free-transfer-engine.ts` | Phase 56 (FTX-01/02) | Phase 60 must reuse it; do not reimplement |
| Sell prices read from `now_cost` only | Hybrid: `selling_price` from `myTeamData.picks` when authenticated, falls back to `now_cost` (`sellPrices?.get(id) ?? player.now_cost`) | Phase 45 / 50 / 59 | Phase 60 uses the established Map-based fallback |
| Per-tab horizon state | Was about to be section-level per CONTEXT D-07 — but **this lift has not happened yet** in `page.tsx` | (proposed by Phase 60) | Discuss-phase decision before planning Wave 2 |
| Per-step chip toggle (PlannerTab + ManualPlanTab) | Per-section `chipMode` per CONTEXT D-08 — but **section-level chip state does not exist yet** in `page.tsx` | (proposed by Phase 60) | Same as above |
| 3-button OptimiserHorizon (1/3/5) for transfer-related computations | 5-button `HorizonSelector` (1–5) used everywhere now | Phase 21+ | Phase 60 can score any horizon 1–5; no `HorizonSelector` change needed despite UI-SPEC's "1 / 3 / 5" wording |

**Deprecated/outdated:**
- `recommend.ts` `computeVerdicts` is still alive (reused by Phase 51) — do NOT remove.
- The `proj_pts` field was removed in Phase 41 — Phase 60 must use `xPts_1gw / xPts_3gw / xPts_5gw` (already standard in all Phase 56–59 code).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | When a sell root has no positive-gain replacement, GW1 still force-sells the root with the best (even non-positive) replacement and adds the branch | Pitfall 9 | If the spec intends branches to drop entirely, there could be 0–2 paths shown when 3 expected — UX degraded but not broken |
| A2 | Section-level horizon state lives in `page.tsx` (option (a) from Pitfall 4) | Pitfall 4 | If option (b) is chosen, the planner's task list is one fewer file edit but UI-SPEC §Reused Components contradiction must be acknowledged |
| A3 | TRT-06 chip mode is read via a not-yet-existing section-level `chipMode` prop. Until that prop exists, the engine accepts `chipMode = null` and the UI shows no chip-toggle effect | Pitfall 5 | If user expectation is "chip changes the tree on the same screen", that won't happen until section-level chip state lands. Likely v1.10 polish item |
| A4 | The horizon-button discrepancy ("1/3/5" in UI-SPEC vs 1/2/3/4/5 in the actual selector) is benign — the engine handles all 5 horizons, and UI-SPEC text should be read as illustrative | Pitfall 6 | If the spec author intended to **change** the selector to 3 buttons, a separate task is needed |
| A5 | Engine determinism is achieved with `xPts_1gw asc → now_cost asc → id asc` tie-break for sell roots | Pitfall 8 | Without tie-break, snapshot tests may flake on identical-xPts squads |
| A6 | xPts contribution per node is `Σ_legs (buy.xPts_1gw - sell.xPts_1gw) × fixtureCountForGw(gw)` summed across H nodes — matches `planning-engine.ts:120` pattern | Algorithmic Pseudocode | If the spec author expected horizon-window xPts (`xPts_3gw / xPts_5gw`) instead, net values would differ. The per-GW `xPts_1gw × fixtureCount` approach correctly handles DGW/BGW |
| A7 | Bridge writes `chip: null` literally per CONTEXT D-09 (not the active chipMode of the path's first GW) | D-09 | If the spec intended chip carry-through, user has to redo the chip after load — minor UX |
| A8 | Test files split: pure engine in `tests/lib/transfer-route-tree.test.ts`; component tests co-located at `src/components/planner/RouteTreeTab.test.tsx` | Recommended Project Structure | Existing repo split (verified by `tests/lib/free-transfer-engine.test.ts` + `src/components/planner/ManualPlanTab.test.tsx`) — would be surprising to deviate |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed. **It is not empty** — A2, A3, A4 in particular need user / discuss-phase resolution before planning Wave 2.

---

## Open Questions

1. **Where does section-level `horizon` state live?** (Pitfall 4 / A2)
   - What we know: D-07 says "shared with the section-level `HorizonSelector` in `page.tsx`". No such selector exists today. Each Plan sub-tab manages its own horizon.
   - What's unclear: Whether Phase 60 should lift horizon to `page.tsx` (and refactor PlannerTab + ManualPlanTab to consume it as a prop) or keep its own local horizon (and contradict UI-SPEC).
   - Recommendation: **Lift to `page.tsx`**. Add `[planHorizon, setPlanHorizon]` state + render `<HorizonSelector value={planHorizon} onChange={setPlanHorizon} />` in the Plan section header (above the sub-tab nav, only when `activeSection === 'plan'`). Pass `planHorizon` to PlannerTab, ManualPlanTab, RouteTreeTab. This ships D-07 fully; it also makes D-06 ordering meaningful (the user sees the same horizon across all 6 sub-tabs). Effort: ~2 small edits to PlannerTab and ManualPlanTab (replace local `useState<PlannerHorizon>` with prop; remove local `<HorizonSelector>` render in those tabs — but Phase 59 pattern keeps a local one inside ManualPlanTab.tsx:327, so its removal is a Phase-59-touching diff).

2. **Where does section-level `chipMode` state live?** (Pitfall 5 / A3)
   - What we know: TRT-06 says the tree respects active chip mode "set in the Planner section header". No such header element exists.
   - What's unclear: Whether Phase 60 also lifts chip-mode state, or accepts that TRT-06 is implementable but inert until later phases.
   - Recommendation: **Defer section-level chip state to a follow-up phase.** Engine accepts `chipMode: PlannerChip = null` arg; UI does not render a `ChipToggle` at the section level in this phase. Document in plan task: "TRT-06 satisfied by engine accepting and respecting `chipMode`; UI exposure deferred."

3. **For unauthenticated users, are sell-root sell prices accurate enough?** (Implicit)
   - What we know: Phase 59 D-13 / MTP-07 already handles this with the caveat banner. Phase 60 reuses the same banner per UI-SPEC §States Required.
   - What's unclear: Whether the route tree should suppress the bridge button for unauthenticated users (since prices are approximate, the bridge might be misleading).
   - Recommendation: **Show the bridge button regardless** — Phase 59 already handles approximate prices in Manual Plan with the same caveat banner. Consistency with Phase 59 trumps over-cautious gating.

4. **Does dropping a branch (when root has no positive-gain GW1 replacement) leave fewer than 3 paths visible?** (Pitfall 9 / A1)
   - What we know: D-03 implies the root's sell happens; Pitfall 9 documents the contradiction.
   - What's unclear: Whether the UI should show "Path A only" (1 path) or always 3 paths even if some have weak GW1 transfers.
   - Recommendation: **Always force the GW1 root sell, even with non-positive replacement.** Always produce 3 paths. The recommended-path highlight will naturally avoid the weak branch. This matches the literal reading of D-03 ("becomes the player sold in GW1 of its branch") and avoids the empty-tree fallback firing for normal squads.

5. **Should the bridge confirm prompt fire when the existing plan has steps but no transfers?** (D-08)
   - What we know: D-08 says confirm "If the existing `fplx_manual_plan` localStorage has any steps with transfers".
   - What's unclear: An empty plan (`steps[].transfers.length === 0` for all steps) can have non-zero `steps.length` — does it count as "any steps with transfers"?
   - Recommendation: **Confirm only when `steps.some(s => s.transfers.length > 0)`** — matches the literal D-08 reading. An empty plan (no transfers) is treated as no plan and overwritten silently.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Test execution + Next.js | ✓ | (per package.json `engines`) | — |
| npm | Package management | ✓ | — | — |
| Next.js | App router | ✓ | 16.2.1 | — |
| React | UI | ✓ | 19.2.4 | — |
| Vitest | Tests | ✓ | ^4.1.2 | — |
| @testing-library/react | Component tests | ✓ | ^16.3.2 | — |
| Tailwind CSS | Styling | ✓ | ^4 | — |
| use-immer | Local plan state | ✓ | ^0.11.0 | — |
| zod | Type validation | ✓ | ^4.3.6 | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

All required tooling is already installed and at expected versions. Phase 60 introduces no new external dependencies. [VERIFIED: package.json + node_modules]

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 + @testing-library/react 16.3.2 |
| Config file | `vitest.config.ts` — `environment: 'jsdom'`, `globals: true`, `'@'` alias for `src/` |
| Quick run command | `npm test -- transfer-route-tree` (or `RouteTreeTab`) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRT-01 | Engine returns 2–3 distinct paths from 3 lowest-`xPts_1gw` roots, greedy continuation, no LLM | unit | `npm test -- transfer-route-tree.test` | ❌ Wave 0 |
| TRT-02 | Each path's summary metrics: totalTransfers, totalHits, totalHitCostPts, netXpts, chipsConsumed | unit | `npm test -- transfer-route-tree.test` | ❌ Wave 0 |
| TRT-03 | Per-node breakdown shape: gw, transfers, ftBefore, hitCost, xPtsContribution | unit | `npm test -- transfer-route-tree.test` | ❌ Wave 0 |
| TRT-04 | `recommendedPathIndex` selects argmax of paths[i].netXpts | unit | `npm test -- transfer-route-tree.test` | ❌ Wave 0 |
| TRT-04 | RouteTreeTab renders side-by-side table with green ring + "Recommended" badge on highest-net-xPts row | RTL | `npm test -- RouteTreeTab.test` | ❌ Wave 0 |
| TRT-05 | Bridge writes correct `ManualPlan` to localStorage; calls `onSwitchSubTab('manual-plan')` | RTL | `npm test -- RouteTreeTab.test` | ❌ Wave 0 |
| TRT-05 | Inline confirm fires only when existing plan has transfers; silent overwrite when empty | RTL | `npm test -- RouteTreeTab.test` | ❌ Wave 0 |
| TRT-06 | Engine respects `chipMode` arg: when `chipMode === 'wildcard'`, GW1 hitCost stays 0 even with multiple transfers (FT engine handles); branch records chip in `chipsConsumed` | unit | `npm test -- transfer-route-tree.test` | ❌ Wave 0 |
| TRT-07 | RouteTreeTab `useMemo` dependency includes `horizon` so changing horizon recomputes paths | RTL | `npm test -- RouteTreeTab.test` | ❌ Wave 0 |
| Page wiring | `'route-tree'` SubTab union member; SECTIONS Plan subTabs entry inserted after `'manual-plan'`; render guard for `RouteTreeTab` | RTL | `npm test -- page.test` | ✅ (extend existing `tests/components/page.test.tsx` — needs check) |

### Sampling Rate
- **Per task commit:** `npm test -- transfer-route-tree RouteTreeTab` (engine + component scope)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/lib/transfer-route-tree.test.ts` — covers TRT-01/02/03/04/06; pure engine unit tests; mirror `tests/lib/free-transfer-engine.test.ts` structure (describe block per function, fixture-based ScoredPlayer arrays)
- [ ] `src/components/planner/RouteTreeTab.test.tsx` — covers TRT-04 (UI), TRT-05, TRT-07; RTL tests; mirror `src/components/planner/ManualPlanTab.test.tsx` structure (mock hooks with vi.mock, render with QueryClientProvider, click-flow tests)
- [ ] Verify whether `tests/components/page.test.tsx` exists for the existing page-level navigation tests; if so, extend it with the new `'route-tree'` sub-tab navigation test. If not, the existing pattern is `src/components/planner/ManualPlanTab.test.tsx` mounting `<Home />` indirectly via mocking — needs confirmation in plan-check.

*(Phase 60 introduces no new framework or fixtures. Existing test infrastructure covers the phase fully.)*

---

## Security Domain

> Required when `security_enforcement` is enabled (absent = enabled). Phase 60 deals only with client-side computation over already-fetched, public-or-authenticated FPL data already validated upstream.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Auth state read via existing `useAuthStatus` hook; Phase 60 does not gate auth or issue tokens |
| V3 Session Management | no | No new sessions; reuses Phase 59 localStorage |
| V4 Access Control | no | No new authorisation rules; sell prices already gated by `useMyTeam`'s `enabled: isAuthenticated` |
| V5 Input Validation | yes | `loadManualPlan` already validates the localStorage payload (version, horizon range, chip enum) on read — re-used by bridge |
| V6 Cryptography | no | No crypto operations |

### Known Threat Patterns for Phase 60 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| localStorage tampering (user manually edits `fplx_manual_plan`) | Tampering | `loadManualPlan` shape validation already implemented in Phase 59 (`src/lib/manual-plan.ts:230–254`) — invalid payloads return `null` and the consumer falls back to a fresh plan |
| Stale sell prices for unauthenticated users | Information Disclosure (low) | Phase 59 caveat banner already shown when `!isAuthenticated`; reused unchanged |
| Cross-tab race on `fplx_manual_plan` write | Race condition (low) | Single-page app with one user; no cross-tab synchronisation expected. Risk accepted (matches Phase 59 stance) |
| Numeric overflow in `netXpts` summation | DoS (negligible) | Floats sum across at most `3 × 5 = 15` nodes per branch; no overflow risk |

No new ASVS controls required; Phase 60 is a presentation + bridge layer over already-validated data.

---

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **No `Co-Authored-By` trailers on git commits** (CLAUDE.md). Plan tasks that include commit steps must omit Claude's `Co-Authored-By:` trailer.
- **Next.js is breaking-change version 16.2.1** (AGENTS.md). Read `node_modules/next/dist/docs/` before introducing any Next.js feature. **Phase 60 introduces zero new Next.js features** — only edits an existing client-component page (`src/app/page.tsx`) and adds two pure TypeScript files. No App Router APIs, no server actions, no middleware, no metadata. Constraint satisfied trivially.
- **Use Opus for planning/research agents, Sonnet for execution agents** (user MEMORY.md feedback note). Informational for the orchestrator; does not change Phase 60's deliverables.

---

## Sources

### Primary (HIGH confidence)
- `src/lib/free-transfer-engine.ts` — `computeNextFTState`, `computeHitCost`, `snapshotSquad` signatures and FTX-01/02 behaviour [VERIFIED: read in research session]
- `src/lib/suggest-transfers.ts:81–214` — position-matched candidate filtering, sell-value fallback, per-leg positive-gain rule (D-04 mirror) [VERIFIED]
- `src/lib/planning-engine.ts:69–177` — per-step greedy loop, `fixtureCountForGw` usage, GW score formula `(buy.xPts_1gw * fixtureCount) - (sell.xPts_1gw * fixtureCount)` [VERIFIED]
- `src/lib/manual-plan.ts` — `ManualPlan`, `ManualStep`, `ManualTransfer`, `MANUAL_PLAN_KEY`, `persistManualPlan`, `loadManualPlan`, `freshPlan` shapes for the bridge payload [VERIFIED]
- `src/components/planner/ManualPlanTab.tsx:42–115, 269–311` — auth/data hook composition, no-squad branch pattern, lazy initialiser pattern, caveat banner reuse [VERIFIED]
- `src/components/planner/PlannerTab.tsx:24–70` — `initialFTState` derivation pattern (verbatim reusable) [VERIFIED]
- `src/app/page.tsx:48–88, 144–227` — `SubTab` union, `SECTIONS` constant, sub-tab render-conditional structure [VERIFIED]
- `src/components/planner/HorizonSelector.tsx` — actual button list (1, 2, 3, 4, 5 — NOT 1/3/5) [VERIFIED, contradicts UI-SPEC accent text]
- `src/components/planner/ChipStrategyPanel.tsx:56` — recommended-path ring CSS pattern [VERIFIED]
- `package.json` — installed dependencies, no new packages required [VERIFIED]
- `vitest.config.ts` — test environment + alias [VERIFIED]
- `.planning/phases/060-transfer-route-tree/060-CONTEXT.md` + `060-UI-SPEC.md` — phase scope, locked decisions, UI design contract [VERIFIED]
- `.planning/REQUIREMENTS.md` §Transfer Route Tree (TRT-01–TRT-07) [VERIFIED]
- `.planning/ROADMAP.md` §Phase 60 [VERIFIED]
- `.planning/phases/058-mini-league-rival-tracker/058-RESEARCH.md` — research format reference [VERIFIED]

### Secondary (MEDIUM confidence)
- `.planning/phases/059-manual-transfer-planner/059-PATTERNS.md` — existing pattern map showing how Phase 59 used PlannerTab as analog; Phase 60 should follow the same approach using ManualPlanTab as analog [VERIFIED via direct read]

### Tertiary (LOW confidence)
- None for this phase. All claims either verified by direct file read or cited from CONTEXT.md / UI-SPEC.md / REQUIREMENTS.md / ROADMAP.md.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all dependencies installed and verified at expected versions; no new packages
- Architecture: HIGH — pure-engine + presentation-component pattern is well-established (Phases 45 / 51 / 56 / 58 / 59 all follow it); reuse map is concrete with file:line references
- Pitfalls: HIGH for engine-side (5 verified pitfalls reference specific code), MEDIUM for the UI-SPEC gaps (two D-07/D-08 references that anticipate not-yet-existing section-level state — flagged as Open Questions 1 and 2 for discuss-phase)
- Tests: HIGH — Vitest + RTL stack already used by 22 lib tests + 2 component tests in this codebase; pattern is exact

**Research date:** 2026-05-04
**Valid until:** 2026-06-04 (30 days — stable phase, no fast-moving dependencies)
