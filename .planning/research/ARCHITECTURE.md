# Architecture Patterns — v1.9 Competitive Intelligence Integration

**Domain:** FPL Analyst — incremental milestone integration (subsequent milestone, not greenfield)
**Researched:** 2026-05-03
**Overall confidence:** HIGH (existing codebase patterns directly observed)

---

## Existing Architecture (Verified Baseline — v1.8)

```
                +------------------------+
                |  GitHub Actions cron   |
                +-----------+------------+
                            |
                            v
+-----------------------------------------------------+
| pipeline/run.py  (Python orchestrator)              |
|  xmins.py, bonus.py, price_changes.py, merge.py    |
|  insights.py, accuracy.py, defcon.py               |
|  writes JSON to pipeline/cache/ + Vercel Blob       |
+----------------------+------------------------------+
                       |
                       |  writes JSON artifacts
                       v
        +--------------+----------------+
        | pipeline/cache/ + Vercel Blob |
        |  merged_players.json          |
        |  captain_picks.json           |
        |  insights.json                |
        |  accuracy_backtest.json       |
        |  set_piece_changes.json       |
        |  defcon_stats.json            |
        |  price_changes.json           |
        |  last_updated.json            |
        +--------------+----------------+
                       |
                       v
   +------------------------------------------------+
   | Next.js Route Handlers  /api/*                 |
   | (USE_BLOB toggle: blob.list() vs fs.readFile)  |
   | /api/fpl/[...proxy]  <- pass-through to FPL    |
   +-----------------------+------------------------+
                           |
                           v
   +------------------------------------------------+
   | TanStack Query hooks (src/lib/hooks/use*.ts)   |
   |  usePlayers (6h staleTime)                     |
   |  useSquad / useMyTeam / useClubForm            |
   |  useSetPieces / useCaptainPicks / useInsights  |
   |  usePriceChanges (30 min staleTime)            |
   +-----------------------+------------------------+
                           |
                           v
   +------------------------------------------------+
   | Pure-TS engines  (src/lib/*.ts, no React)      |
   |  optimise-lineup.ts, planning-engine.ts        |
   |  suggest-transfers.ts, chip-strategy-engine.ts |
   |  captaincy-engine.ts, opportunity-cost.ts      |
   |  lifecycle-label.ts, decision-severity.ts      |
   +-----------------------+------------------------+
                           |
                           v
   +------------------------------------------------+
   | UI components (src/components/**/*.tsx)        |
   | page.tsx manages Section/SubTab state          |
   | Sections: analyse / plan / squad               |
   | squad: Decision | Transfers | Optimiser        |
   | plan:  Planner  | Club Form  | Value Gems      |
   | analyse: Gems | Insights | DefCon | … (6 tabs) |
   +------------------------------------------------+
```

### Established Conventions for v1.9

| Convention | Source | Implication |
|---|---|---|
| `merged_players.json` is the single source of truth for per-player state | `pipeline/merge.py` -> `MergedPlayer` in `types.ts` | EO-01 needs no new field — `selected_by_percent` already present |
| New `MergedPlayer` fields use `?:` during pipeline rollout, consumers use `??` fallback | All four v1.8 features | No v1.9 feature needs new `MergedPlayer` fields |
| Pure-TS engines: no React, no `'use client'`, no side effects (importable in `@vitest-environment node`) | `src/lib/optimise-lineup.ts`, `chip-strategy-engine.ts` | EO-01 engine function follows this shape exactly |
| Public FPL API data fetched via `/api/fpl/[...proxy]` pass-through | `src/app/api/fpl/[...proxy]/route.ts` | ML-01 uses this proxy for league standings + rival picks; no new API route needed |
| Authenticated data via `useMyTeam` / `useSquad` — teamId shared from page.tsx | `PlannerTab.tsx`, `DecisionSummaryTab.tsx` | MTP-01 and TREE-01 share the same auth + teamId pattern |
| TanStack Query hooks use a string or array query key; `enabled:` guards null/empty IDs | `useSquad`, `useMyTeam`, `useChipHistory` | `useLeagueRivals` follows the same shape with `leagueId` enabling guard |
| Section/SubTab union types and `SECTIONS` constant in `page.tsx`; MobileNav derives from same constant | `page.tsx` lines 47-84 | Adding sub-tabs requires one addition to `SubTab` union and one entry in `SECTIONS` |
| `useImmer` for complex nested state that requires safe mutation recipes | `PlannerTab.tsx` (planResult, chip toggles) | MTP-01 multi-step plan state uses the same pattern |

---

## Per-Feature Integration Plan

### MTP-01 — Manual Transfer Planner

**Type:** New UI sub-tab in Plan section. New component. Uses existing hooks and engines; minor extension to `free-transfer-engine.ts`.

**Classification:** Auth-gated (exact sell prices + bank require authenticated `useMyTeam`); degrades gracefully to approximate prices from `useSquad` when unauthenticated — identical to `PlannerTab.tsx` degradation pattern.

**Files NEW:**
- `src/components/planner/ManualPlannerTab.tsx` — new sub-tab component. Manages its own `useImmer<ManualPlanStep[]>` state for the multi-step plan array. Renders per-GW step rows where the user picks Out and In player via `PlayerPickerModal` (already exists). Computes hit cost and bank balance imperatively as the user edits steps, using `computeHitCost` and `computeNextFTState` from `free-transfer-engine.ts`. Displays: GW column, player out, player in, FTs used, hit cost (–4n pts), running bank balance, break-even GWs for any hit.

**New type additions to `src/lib/types.ts`:**
```typescript
// MTP-01: one user-authored step in the manual plan
export interface ManualPlanStep {
  gw: number
  transfersOut: number[]    // up to 2 player IDs (multi-transfer support)
  transfersIn: number[]     // same length as transfersOut
  chip: PlannerChip
  // Derived on render, not stored — recomputed from prior steps:
  // freeTransfersAvailable, hitCost, bankBalance, breakEvenGws
}
```

**Files MODIFIED:**
- `src/app/page.tsx`:
  - Add `'manual-planner'` to `SubTab` union type (line 48)
  - Add `{ id: 'manual-planner', label: 'Manual Planner', mobileLabel: 'Manual' }` inside the `plan` section's `subTabs` array (after `'planner'`)
  - Add render block: `{activeSection !== 'squad' && activeSubTab === 'manual-planner' && <ManualPlannerTab ... />}`
  - Pass `teamId`, `submittedId`, `onTeamIdSubmit` props (same as PlannerTab pattern — MTP-01 needs squad and sell prices)
- `src/components/nav/MobileNav.tsx` — no structural change; picks up the new sub-tab automatically from `SECTIONS` once page.tsx is updated (MobileNav already derives from SECTIONS)

**Reused without modification:**
- `useSquad(teamId)` — starting squad picks + bank
- `useMyTeam(isAuthenticated)` — exact sell prices; falls back to `now_cost` when unauthenticated
- `usePlayers()` → `computeAllGemScores()` → player picker pool
- `PlayerPickerModal` — already exists for per-step player swap
- `computeHitCost(available, transfersUsed, chip)` — already exported from `free-transfer-engine.ts`
- `computeNextFTState(available, transfersUsed, chip)` — already exported from `free-transfer-engine.ts`

**Break-even computation (pure, no new function needed):**
```typescript
// inline in ManualPlannerTab render/memo
const breakEvenGws = hitCost < 0 && xPtsDelta > 0
  ? Math.ceil(Math.abs(hitCost) / xPtsDelta)
  : null
```
xPtsDelta = `(player_in.xPts_1gw ?? 0) - (player_out.xPts_1gw ?? 0)` for the active horizon. This is identical to the break-even logic in `suggest-transfers.ts` and the Opportunity Cost table — no new engine needed.

**State shape:** `ManualPlanStep[]` managed by `useImmer`. Each step is independently editable. Financial simulation replays from step 0 each render (O(horizon) = trivial). No `originalSteps` frozen copy needed (user controls all edits; there is no AI-generated baseline to restore).

**Auth gate distinction:**
- `selling_price` from `MyTeamPick` → exact sell price (authenticated path)
- `now_cost` from `MergedPlayer` → approximate sell price (unauthenticated fallback)
- The component UI shows a note when unauthenticated: "Sell prices are approximate (login for exact)"

---

### ML-01 — Mini-League Rival Tracker

**Type:** New Analyse sub-tab. New hook. New component. All data from public FPL API via existing proxy. No pipeline module needed.

**Classification:** Public data — no auth required. League ID is user-provided input (not derived from auth). Rival squad picks are public (`/api/fpl/entry/{id}/event/{gw}/picks`).

**Files NEW:**
- `src/lib/hooks/useLeagueRivals.ts` — TanStack Query hook. Accepts `leagueId: string | null` and `currentGw: number | null`. `enabled` guard: `!!leagueId && !!currentGw`. Query key: `['league-rivals', leagueId, currentGw]`. Fetches:
  1. League standings: `GET /api/fpl/leagues-classic/${leagueId}/standings/`
  2. For each rival entry in standings (top N, e.g. 20): `GET /api/fpl/entry/${entryId}/event/${currentGw}/picks/`
  All via the existing `/api/fpl/[...proxy]` pass-through. Returns a typed `LeagueRivalsData` shape.
  `staleTime: 5 * 60 * 1000` (5 minutes — rival squads change during GW deadline; more volatile than pipeline data).

- `src/components/rivals/RivalTrackerTab.tsx` — new Analyse sub-tab. Contains:
  - League ID text input with submit button (local `useState<string>` for the typed value; lifted `leagueId` state to `page.tsx` so it persists on section change, same pattern as `teamId`)
  - Standings table: rank, manager name, team name, GW pts, total pts, rank gap vs user's team
  - Rival picks panel: for each rival shows captain choice, active chip, differential players (in rival squad but not in user's squad), threat players (high-ownership players rival has that you don't)
  - Loading/error/empty states following the `InsightsTab` pattern

**New type additions to `src/lib/types.ts`:**
```typescript
export interface RivalPick {
  element: number        // player ID
  is_captain: boolean
  is_vice_captain: boolean
  multiplier: number
}
export interface RivalEntry {
  entry_id: number
  manager_name: string
  team_name: string
  rank: number
  total_points: number
  event_total: number    // current GW points
  active_chip: string | null
  picks: RivalPick[]     // populated after second fetch
}
export interface LeagueRivalsData {
  league_name: string
  entries: RivalEntry[]
  current_gw: number
}
```

**Files MODIFIED:**
- `src/app/page.tsx`:
  - Add `'rivals'` to `SubTab` union type
  - Add `{ id: 'rivals', label: 'Rivals', mobileLabel: 'Rivals' }` to `analyse` section's `subTabs`
  - Add `leagueId` + `setLeagueId` state (lifted here so it persists across section switches; same rationale as `teamId`)
  - Add render block: `{activeSection !== 'squad' && activeSubTab === 'rivals' && <RivalTrackerTab leagueId={leagueId} onLeagueIdChange={setLeagueId} ... />}`

**Data flow:**
```
user inputs leagueId
    |
    v
useLeagueRivals(leagueId, currentGw)
    |  step 1: GET /api/fpl/leagues-classic/{id}/standings/
    |  step 2: GET /api/fpl/entry/{rival_id}/event/{gw}/picks/  (per rival)
    |  (both via /api/fpl/[...proxy] — no new server route)
    v
RivalTrackerTab renders standings + rival squad panels
    |
    | cross-reference with usePlayers() data
    | to resolve player names + xPts for differential analysis
    v
Differential intelligence: players in rival squad but not user's (upside)
Threat intelligence: high-xPts players rival has that user doesn't
```

**N+1 fetch concern:** Fetching picks for 20 rivals = 21 round trips (1 standings + 20 picks). All via the proxy which has no caching. Mitigation: cap rival count at 10 for performance; use TanStack Query's `useQueries` (parallel fan-out) rather than sequential. This is a known pattern in FPL community tooling.

**leagueId input sequencing:** The league ID input must be committed before rival data can load. The `enabled` guard on `useLeagueRivals` enforces this naturally. The UX flow is: type league ID → click "Load" → `setLeagueId(value)` → hook fires. This mirrors the teamId flow in `TransferPanel`.

**Auth-gated vs public distinction:** ALL data for ML-01 is from the public FPL API. No session cookie needed. The rival picks endpoint `/entry/{id}/event/{gw}/picks` is public for all managers. User's own squad (for differential comparison) comes from `useSquad(teamId)` which is also public. If the user is authenticated, `useMyTeam` provides richer own-squad data, but ML-01 does not require it.

---

### EO-01 — Effective Ownership

**Type:** Engine function addition + mode toggle state + UI modifications to existing components. No new API route. No new hook. No pipeline change.

**Classification:** Fully client-side. `selected_by_percent` is already on every `MergedPlayer` (and hence `ScoredPlayer`). No new data required.

**Files NEW:**
- `src/lib/eo-engine.ts` — pure TS engine. Exports:
  ```typescript
  export type EOMode = 'max-xpts' | 'protect-rank' | 'chase-rank' | 'differential'

  /**
   * Effective Ownership = selected_by_percent * captaincy_rate
   * captaincy_rate ≈ captain_selection_among_owners (approximated as xPts_1gw share)
   * EO-adjusted captain EV = xPts_1gw * 2 * eo_pct + xPts_1gw * (1 - eo_pct) * eo_multiplier
   *
   * eo_pct: fraction of all managers who have this player AND captain them
   * eo_multiplier: in protect-rank mode, penalise captaining non-popular picks
   */
  export function computeEOAdjustedCaptainEV(
    player: ScoredPlayer,
    allPlayers: ScoredPlayer[],
    mode: EOMode,
  ): number

  /**
   * Rank the squad's outfield players by EO-adjusted captain EV for the given mode.
   */
  export function rankCaptainsByEO(
    squadPicks: SquadPick[],
    allPlayers: ScoredPlayer[],
    mode: EOMode,
  ): Array<{ player: ScoredPlayer; eoAdjustedEV: number; eoPct: number }>
  ```
  Pure function, no React, node-importable. Follows `captaincy-engine.ts` shape.

**Files MODIFIED:**
- `src/app/page.tsx`:
  - Add `eoMode` state: `const [eoMode, setEOMode] = useState<EOMode>('max-xpts')`
  - Lift `eoMode` at Squad section level: passed as prop to `DecisionSummaryTab` and `TransferPanel` (both live under `activeSection === 'squad'`). This is the right level — EO mode is a squad-section concern, not a global app concern.

- `src/components/squad/DecisionSummaryTab.tsx`:
  - Accept `eoMode: EOMode` and `onEOModeChange: (m: EOMode) => void` props
  - Add a 4-button segmented toggle above the captain card: "Max xPts | Protect Rank | Chase Rank | Differential"
  - In the captain card, replace `computeCaptaincyCandidates()` ranking with `rankCaptainsByEO()` when mode !== `'max-xpts'`, or pass mode through to a unified function
  - Display EO% next to each captain candidate (formatted as "EO 14.2%")
  - Transfer recommendation card: when mode is `'protect-rank'`, weight `suggestTransfers()` output by de-emphasising differential picks (low-owned buys); when `'chase-rank'`, prefer high-ceiling picks. The transfer engine itself doesn't need to change — a post-sort filter/re-rank in the component is sufficient for v1.9.

- `src/components/transfers/TransferPanel.tsx`:
  - Accept `eoMode: EOMode` prop
  - Surface EO% on transfer candidates in the buy column
  - No engine change needed — `suggestTransfers()` output is re-sorted or annotated based on mode

**State ownership decision:**
`eoMode` lives in `page.tsx` at the Squad section level (not inside `DecisionSummaryTab` or `TransferPanel`). This preserves the mode when switching between Decision and Transfers sub-tabs within the Squad section, matching the `sectionMemory` pattern for sub-tab state.

**No pipeline involvement:** `selected_by_percent` (string "12.5") is already on every `MergedPlayer`. The EO engine does a `parseFloat(player.selected_by_percent)` internally. No new artifact, no new endpoint, no new hook.

---

### TREE-01 — Transfer Route Tree

**Type:** New Plan sub-tab. Extension to `planning-engine.ts` (new exported function). New component. No pipeline change. No new API route.

**Classification:** Auth-gated for best results (sell prices, bank balance); degrades gracefully without auth — same pattern as MTP-01 and PlannerTab.

**Files NEW:**
- `src/components/planner/TransferRouteTreeTab.tsx` — new sub-tab component. Calls `generateTransferTree()` engine function. Renders 2–3 branch cards side-by-side (or stacked on mobile), each showing: path label (A/B/C), GW-by-GW transfer sequence (player out → player in), cumulative xPts gain, hit cost total, bank balance trajectory. Highlights the recommended branch (highest net cumulative xPts after hit costs).

**Extension to `src/lib/planning-engine.ts`** (NEW exported function, no modification to existing functions):
```typescript
/**
 * Generate 2-3 branching transfer paths from the current squad.
 *
 * Each path is an independent PlanResult (or lighter TreePath shape).
 * Branching strategy: for the first GW, take the top-3 scoring single transfers
 * as branch roots, then run generatePlanFrom() independently for each.
 *
 * Pure function — no hooks, no side effects.
 */
export interface TreePath {
  label: 'A' | 'B' | 'C'
  steps: PlanStep[]
  cumulativeXPtsGain: number    // sum of netGain across all steps (after hit costs)
  totalHitCost: number          // sum of hitCost across all steps
  rootTransfer: { sellId: number; buyId: number }  // the GW-1 branch decision
}

export function generateTransferTree(
  picks: SquadPick[],
  allPlayers: ScoredPlayer[],
  horizon: PlannerHorizon,
  startingGw: number,
  ftState: FTState,
  bankBalance: number,
  sellPrices?: Record<number, number>,
  numBranches?: 2 | 3,
): TreePath[]
```

**Algorithm sketch:**
1. Run `generatePlan()` once to collect the full scored transfer list for GW 1.
2. Take the top-3 unique `sellId` alternatives (or top-3 `buyId` alternatives when the same sell player appears multiple times) as branch roots.
3. For each branch root, apply that root transfer to the squad state, then call `generatePlanFrom()` for GW 2..horizon.
4. Compute `cumulativeXPtsGain` and `totalHitCost` as sums.
5. Return sorted by `cumulativeXPtsGain` descending; label as A/B/C.

This avoids deep recursion (no exponential branching). Complexity: O(3 × horizon × N) where N = candidate pool size. Same order as the existing `generatePlan`. Pure function; mirrors `generatePlanFrom` pattern.

**Files MODIFIED:**
- `src/app/page.tsx`:
  - Add `'transfer-tree'` to `SubTab` union type
  - Add `{ id: 'transfer-tree', label: 'Route Tree', mobileLabel: 'Tree' }` to `plan` section's `subTabs` (after `'manual-planner'`)
  - Add render block: `{activeSection !== 'squad' && activeSubTab === 'transfer-tree' && <TransferRouteTreeTab teamId={teamId} submittedId={submittedId} onSubmit={handleTeamIdSubmit} onTeamIdChange={setTeamId} />}`
- `src/lib/planning-engine.ts` — add `generateTransferTree()` export alongside existing functions. No modification to existing functions.

**Reused without modification:**
- `generatePlanFrom()` — called per branch after applying root transfer
- `computeNextFTState()`, `computeHitCost()` — used inside the tree generator
- `useSquad()`, `useMyTeam()`, `usePlayers()` — same hooks as `PlannerTab`
- `PlayerPickerModal` — not used in tree view (read-only output)
- `HorizonSelector` — reuse for the tree's horizon input

---

## New vs Modified Files Summary

### Files NEW

| File | Feature | Purpose |
|---|---|---|
| `src/components/planner/ManualPlannerTab.tsx` | MTP-01 | Manual GW-by-GW planner UI |
| `src/components/rivals/RivalTrackerTab.tsx` | ML-01 | Mini-league rivals UI |
| `src/lib/hooks/useLeagueRivals.ts` | ML-01 | TanStack hook, fans out FPL proxy calls |
| `src/lib/eo-engine.ts` | EO-01 | Pure TS EO-adjusted captain EV engine |
| `src/components/planner/TransferRouteTreeTab.tsx` | TREE-01 | Branch path comparison UI |

### Files MODIFIED

| File | Feature | What Changes |
|---|---|---|
| `src/app/page.tsx` | MTP-01, ML-01, EO-01, TREE-01 | SubTab union +4 entries; SECTIONS +4 sub-tabs; eoMode state; leagueId state; 4 new render blocks |
| `src/lib/types.ts` | MTP-01, ML-01 | `ManualPlanStep`, `RivalPick`, `RivalEntry`, `LeagueRivalsData` type additions; `EOMode` (in eo-engine.ts, not types.ts — no MergedPlayer changes) |
| `src/components/squad/DecisionSummaryTab.tsx` | EO-01 | eoMode prop; captain card re-ranks via eo-engine; EO% badges; mode toggle UI |
| `src/components/transfers/TransferPanel.tsx` | EO-01 | eoMode prop; EO% on buy candidates |
| `src/lib/planning-engine.ts` | TREE-01 | `generateTransferTree()` and `TreePath` type appended; no existing function modified |

### Files NOT Changed

- `pipeline/run.py`, `pipeline/merge.py`, `pipeline/xmins.py`, `pipeline/bonus.py`, `pipeline/price_changes.py` — all four v1.9 features are fully client-side or use existing pipeline data
- All existing `/api/*` routes — no new server routes needed
- `src/lib/optimise-lineup.ts`, `src/lib/suggest-transfers.ts`, `src/lib/captaincy-engine.ts` — untouched
- `MergedPlayer` type in `types.ts` — no new fields; `selected_by_percent` already present for EO-01

---

## Data Flow Diagrams

### MTP-01 Data Flow

```
useSquad(teamId) ──────────┐
useMyTeam(isAuthenticated) ─┤──> ManualPlannerTab
usePlayers() ──────────────┘      |
                                  | user selects out/in per GW step
                                  | computeHitCost() from free-transfer-engine
                                  | computeNextFTState() from free-transfer-engine
                                  | bank simulation: bank += sellPrice - buyCost
                                  | breakEvenGws: ceil(4 / xPtsDelta)
                                  v
                            per-step table:
                            GW | Out | In | FTs | Hit | Bank | Break-even
```

### ML-01 Data Flow

```
user input: leagueId
    |
    v
useLeagueRivals(leagueId, currentGw)
    |  /api/fpl/leagues-classic/{id}/standings/   (proxy, public)
    |  /api/fpl/entry/{id}/event/{gw}/picks/      (proxy, public, ×N rivals)
    v
RivalTrackerTab
    |  cross-reference: usePlayers() for xPts, names
    |  cross-reference: useSquad(teamId) for user's own picks
    v
standings table + differential/threat player lists
```

### EO-01 Data Flow

```
usePlayers() → selected_by_percent on every MergedPlayer (already present)
useSquad(teamId) / useMyTeam() → user's squad picks
    |
    v
eo-engine.ts: computeEOAdjustedCaptainEV(player, allPlayers, eoMode)
    |
    v
DecisionSummaryTab (captain card with EO% badges, mode toggle)
TransferPanel (EO% on buy candidates)
    |
    | eoMode state lives in page.tsx, passed as prop to both
```

### TREE-01 Data Flow

```
useSquad(teamId) ──────────┐
useMyTeam(isAuthenticated) ─┤──> TransferRouteTreeTab
usePlayers() ──────────────┘      |
                                  | generateTransferTree(picks, allPlayers, horizon, ...)
                                  |   -> takes top-3 GW-1 transfers as branch roots
                                  |   -> generatePlanFrom() per branch
                                  |   -> compute cumulative xPts + hit cost per path
                                  v
                            3 branch cards (A/B/C):
                            - GW-by-GW transfer sequence
                            - Cumulative xPts gain
                            - Total hit cost
                            - Bank trajectory
                            Recommended path highlighted (highest net cumulative xPts)
```

---

## Navigation Changes to page.tsx

Current `plan` subTabs (2 entries → 4 entries after v1.9):
```typescript
// BEFORE
{ id: 'planner',    label: 'Planner',    mobileLabel: 'Planner' },
{ id: 'club-form',  label: 'Club Form',  mobileLabel: 'Form'    },
{ id: 'value-gems', label: 'Value Gems', mobileLabel: 'Values'  },

// AFTER (MTP-01 + TREE-01 add 2 sub-tabs to Plan)
{ id: 'planner',        label: 'AI Planner',    mobileLabel: 'AI Plan' },
{ id: 'manual-planner', label: 'Manual',         mobileLabel: 'Manual'  },
{ id: 'transfer-tree',  label: 'Route Tree',     mobileLabel: 'Tree'    },
{ id: 'club-form',      label: 'Club Form',      mobileLabel: 'Form'    },
{ id: 'value-gems',     label: 'Value Gems',     mobileLabel: 'Values'  },
```

Current `analyse` subTabs (6 entries → 7 entries after v1.9):
```typescript
// AFTER (ML-01 adds 1 sub-tab to Analyse)
{ id: 'gems',         label: 'Gem Ratings',     mobileLabel: 'Gems'     },
{ id: 'insights',     label: 'Insights',         mobileLabel: 'Insights' },
{ id: 'rivals',       label: 'Rivals',           mobileLabel: 'Rivals'   },  // NEW
{ id: 'defcon',       label: 'DefCon Analysis',  mobileLabel: 'DefCon'   },
{ id: 'set-pieces',   label: 'Set Pieces',       mobileLabel: 'SP'       },
{ id: 'accuracy',     label: 'Accuracy',         mobileLabel: 'Acc'      },
{ id: 'price-changes',label: 'Price Changes',    mobileLabel: 'Prices'   },
```

`squad` subTabs: unchanged (Decision | Transfers | Optimiser). EO-01 is a mode toggle within existing sub-tabs, not a new sub-tab.

**MobileNav note:** MobileNav already derives its structure from the `SECTIONS` constant exported from `page.tsx`. No direct MobileNav.tsx changes are required; it picks up new sub-tabs automatically.

---

## Recommended Build Order

```
Phase 1: EO-01 (smallest blast radius, no new files except eo-engine.ts)
    |
    |  Rationale:
    |  - Zero pipeline dependency
    |  - One new pure-TS engine file + two component prop additions
    |  - Verifies the mode-toggle + eoMode state-lift pattern before more complex features
    |
    v
Phase 2: ML-01 (new sub-tab, new hook, public data only)
    |
    |  Rationale:
    |  - leagueId state lift to page.tsx is independent of eoMode state lift
    |  - useLeagueRivals has no dependency on EO-01 or MTP-01
    |  - Can be developed in parallel with EO-01 if two contributors available
    |  - Validates the N+1 rival picks fetch pattern before complex planner work
    |
    v
Phase 3: MTP-01 (new Plan sub-tab, depends on squad/auth pattern being understood)
    |
    |  Rationale:
    |  - Builds on PlannerTab.tsx auth pattern (already proven)
    |  - ManualPlannerTab is self-contained; no engine changes needed
    |  - Ships value independently of TREE-01
    |
    v
Phase 4: TREE-01 (extends planning-engine.ts; benefits from MTP-01 UX patterns)
    |
    |  Rationale:
    |  - generateTransferTree() is a pure extension to planning-engine.ts
    |  - After MTP-01 lands, the team understands the GW-step financial simulation model deeply
    |  - TransferRouteTreeTab reuses HorizonSelector and the same auth/squad hooks as MTP-01
    |  - No risk of breaking generatePlan() or generatePlanFrom() — appended, not modified
```

**Parallelism option:** EO-01 and ML-01 have zero shared files and can be developed simultaneously without conflict.

---

## Integration Point Matrix

| Layer | MTP-01 | ML-01 | EO-01 | TREE-01 |
|---|---|---|---|---|
| Pipeline module | none | none | none | none |
| `pipeline/run.py` | none | none | none | none |
| Cache artifact | none | none | none | none |
| API route | none | none (uses existing /api/fpl proxy) | none | none |
| TanStack hook | none new (reuses useSquad/useMyTeam/usePlayers) | NEW `useLeagueRivals` | none | none (reuses same 3 hooks) |
| `MergedPlayer` type | none | none | none — uses `selected_by_percent` already present | none |
| New types | `ManualPlanStep` | `RivalPick`, `RivalEntry`, `LeagueRivalsData` | `EOMode` (in eo-engine.ts) | `TreePath` (in planning-engine.ts) |
| Pure TS engine | none | none | NEW `eo-engine.ts` | `generateTransferTree()` added to planning-engine.ts |
| `page.tsx` state | leagueId lifted here | leagueId lifted here | eoMode lifted here | none (reuses teamId) |
| UI component | NEW `ManualPlannerTab` | NEW `RivalTrackerTab` | MODIFY `DecisionSummaryTab` + `TransferPanel` | NEW `TransferRouteTreeTab` |
| Sub-tab added | plan: Manual Planner | analyse: Rivals | none (mode toggle, not sub-tab) | plan: Route Tree |
| Auth required | degrades gracefully | no — public FPL data | no | degrades gracefully |
| Test surface | unit tests for hit/bank simulation | hook tests (mock proxy responses) | unit tests for eo-engine.ts | unit tests for generateTransferTree |

---

## Risks Specific to v1.9 Integration

### R1 — ML-01 N+1 FPL API calls
**What goes wrong:** Fetching 10–20 rival picks in parallel may hit FPL's unofficial rate limit (~5 req/s). FPL has no documented rate limit but community experience shows 429s at ~10 concurrent requests.
**Mitigation:** Cap `useLeagueRivals` at 10 rivals by default. Use `useQueries` from TanStack Query (parallel fan-out with concurrency) rather than `Promise.all`. Cache the results aggressively (5 min staleTime). Display partial results if some picks fail (fail gracefully per rival, not whole request).

### R2 — page.tsx state accumulation
**What goes wrong:** page.tsx already manages `teamId`, `submittedId`, `gemPreset`, `comparePlayer`, `compareOpen`, `sectionMemory`. Adding `leagueId` + `eoMode` makes it 7+ state values. This is manageable but approaching the limit of "grab-bag component" before extraction becomes necessary.
**Mitigation:** All additions are small `useState` primitives. `leagueId` could live in `RivalTrackerTab` if cross-section persistence is not required (it probably isn't for v1.9). Recommend keeping `eoMode` in page.tsx (cross-sub-tab within Squad) but scoping `leagueId` to `RivalTrackerTab` local state unless the spec requires it to persist.

### R3 — TREE-01 branch root diversity
**What goes wrong:** The top-3 transfers from `generatePlan()` may all involve the same sell player (e.g. sell Salah → buy Mbeumo, sell Salah → buy Haaland, sell Salah → buy Palmer). The three branches then look identical in structure.
**Mitigation:** Select branch roots by unique `buyId` OR require distinct `sellId` across branches. In `generateTransferTree()`, after collecting the sorted transfer list, skip candidates until 3 branches with distinct sell players are found.

### R4 — EO-01 mode toggle affecting transfer recommendations
**What goes wrong:** The `suggestTransfers()` function is pure and takes no mode parameter. Changing behaviour based on mode requires either: (a) passing mode into `suggestTransfers()` which would break its existing tests, or (b) post-filtering the results in the component.
**Mitigation:** Use post-filtering in the component for v1.9 (option b). Add a `// TODO v1.9: EO mode filtering` comment in `TransferPanel.tsx`. If the post-filter logic becomes complex (>20 lines), extract `applyEOModeFilter(suggestions, mode, allPlayers)` as a separate pure function in `eo-engine.ts`.

### R5 — MobileNav sub-tab count
**What goes wrong:** Adding 3 new sub-tabs (Manual Planner, Route Tree, Rivals) pushes the Plan section to 5 sub-tabs and Analyse to 7. Mobile pill row for Plan will need horizontal scroll on small screens.
**Mitigation:** Use short mobile labels (`'Manual'`, `'Tree'`, `'Rivals'`). The mobile pill row already scrolls horizontally (CSS `overflow-x-auto` pattern from Phase 36). Verify on 375px viewport. If Plan section with 5 sub-tabs overflows badly, consider grouping Manual Planner + Route Tree under a single "Planning" expand, but this is a UX call not an architecture one.

---

## Anti-Patterns to Avoid

### AP1: New pipeline artifact for EO-01
**Don't:** Create a `eo_stats.json` pipeline artifact to pre-compute EO data.
**Do:** `selected_by_percent` is already on every `MergedPlayer`. The EO engine is a pure TS function that runs in-browser in <1ms. No pipeline involvement.

### AP2: New API route for ML-01
**Don't:** Create a `/api/league-rivals` server route that proxies the FPL calls and joins the standings + picks data.
**Do:** Use the existing `/api/fpl/[...proxy]` pass-through. The joining and enrichment logic belongs in `useLeagueRivals` (TanStack hook) and `RivalTrackerTab`. No new server route is justified — the proxy already handles CORS for all FPL API paths.

### AP3: Putting eoMode inside DecisionSummaryTab local state
**Don't:** `const [eoMode, setEOMode] = useState<EOMode>('max-xpts')` inside `DecisionSummaryTab`.
**Do:** Lift `eoMode` to `page.tsx` and pass as prop to both `DecisionSummaryTab` and `TransferPanel`. This preserves the selected mode when switching between Decision and Transfers sub-tabs.

### AP4: Modifying generatePlan() for TREE-01
**Don't:** Add a `branches` parameter to `generatePlan()` or fork it.
**Do:** Add `generateTransferTree()` as a new top-level export that internally calls `generatePlan()` once and `generatePlanFrom()` once per branch. Existing function signatures stay stable.

### AP5: Fetching rival picks inside the component render
**Don't:** Call `fetch('/api/fpl/entry/{id}/event/{gw}/picks')` inside `useEffect` in `RivalTrackerTab`.
**Do:** Encapsulate all fetching in `useLeagueRivals` hook (TanStack Query). Components are presentation only.

---

## Sources

- `src/app/page.tsx` (SubTab union, SECTIONS constant, state management pattern) — HIGH confidence, directly observed
- `src/lib/planning-engine.ts` (generatePlan, generatePlanFrom, generateChipStep) — HIGH confidence, directly observed
- `src/lib/types.ts` (MergedPlayer, PlanStep, FTState, PlannerChip, SquadPick) — HIGH confidence, directly observed
- `src/components/planner/PlannerTab.tsx` (auth pattern, sell prices, bank balance, useImmer plan state) — HIGH confidence, directly observed
- `src/lib/free-transfer-engine.ts` (computeHitCost, computeNextFTState) — HIGH confidence, directly observed
- `src/lib/squad-adapter.ts` (MyTeamPick.selling_price, bank fields) — HIGH confidence, directly observed
- `src/app/api/fpl/[...proxy]/route.ts` (pass-through proxy for all FPL paths) — HIGH confidence, directly observed
- `src/lib/hooks/useSquad.ts` (TanStack hook template with enabled guard) — HIGH confidence, directly observed
- `src/lib/captaincy-engine.ts` (pure TS engine shape for EO-01 to mirror) — HIGH confidence, directly observed
- `src/components/squad/DecisionSummaryTab.tsx` (component structure, prop pattern) — HIGH confidence, directly observed
- `.planning/PROJECT.md` (v1.9 feature specs, established decisions, tech stack) — HIGH confidence, directly observed
