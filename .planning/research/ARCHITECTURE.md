# Architecture Patterns

**Domain:** Multi-GW transfer planner integrated into an existing FPL Analyst web app (v1.3)
**Researched:** 2026-04-01
**Confidence:** HIGH — based on direct codebase inspection of all touched files

---

## Context: What v1.3 Adds Architecturally

v1.2 established a stable responsive layout. v1.3 adds a new planning domain: multi-gameweek transfer sequencing. This requires:

1. A new `PlannerPanel` tab component (mirrors the pattern of `TransferPanel`)
2. A new pure-function engine `multi-gw-planner.ts` (extends `transfer-engine.ts`)
3. Mutable plan state owned at the panel level (not in a new route or server)
4. No new API routes — all data already flows through existing hooks
5. Minor extension of the `Tab` union type and both nav bars

The architecture is **additive**. Nothing in the existing data pipeline, hooks, or components needs to change.

---

## Existing Architecture (Baseline for v1.3)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      layout.tsx (Server Component)                   │
│  body: pb-16 sm:pb-0                                                 │
├─────────────────────────────────────────────────────────────────────┤
│                      page.tsx ('use client')                         │
│  useState<Tab> — 5 tabs: gems | defcon | squad | club-form |        │
│                          value-gems                                  │
│                                                                      │
│  Tab content (conditional render):                                   │
│    gems      → <GemTable />                                         │
│    defcon    → <DefConTables />                                      │
│    squad     → <TransferPanel />    ← closest analogue to Planner   │
│    club-form → <ClubFormTable />                                     │
│    value-gems→ <ValueGemsTable />                                    │
│                                                                      │
│  <MobileNav activeTab onTabChange />  (fixed bottom, sm:hidden)     │
└─────────────────────────────────────────────────────────────────────┘

Data layer (TanStack Query):
  usePlayers()    → GET /api/players        → Vercel Blob merged_players.json
  useSquad(id)    → GET /api/squad/[id]     → FPL public picks endpoint
  useMyTeam(auth) → GET /api/fpl/my-team    → FPL authenticated my-team endpoint
  useAuthStatus() → GET /api/auth/status    → HttpOnly cookie check

Pure function engines (src/lib/):
  computeAllGemScores()         → src/lib/gem-score.ts
  computeTransferSuggestions()  → src/lib/transfer-engine.ts
  computeVerdicts()             → src/lib/recommend.ts
  computeCaptaincyCandidates()  → src/lib/captaincy-engine.ts
```

---

## Target Architecture (v1.3 — What Changes)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      page.tsx ('use client')  [MODIFIED]            │
│  useState<Tab> — NOW 6 tabs: adds 'planner'                         │
│                                                                      │
│  NEW:                                                                │
│    planner → <PlannerPanel />                                       │
│                                                                      │
│  UNCHANGED:                                                          │
│    gems | defcon | squad | club-form | value-gems                   │
└─────────────────────────────────────────────────────────────────────┘

New component tree (src/components/planner/):
  PlannerPanel.tsx              ← orchestrates data + state
    PlannerConfig.tsx           ← horizon selector, free transfers, chip selector
    PlanGwRow.tsx               ← one row per GW: transfers in/out, chip, score
    PlanSquadSnapshot.tsx       ← 15-player squad at end of given GW
    PlanTransferEditor.tsx      ← modal/inline: pick player out + player in

New engine (src/lib/):
  multi-gw-planner.ts           ← core planning logic (pure function)

Type extensions:
  src/lib/planner-types.ts      ← GwPlan, TransferPlan, PlannerConfig types
```

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `PlannerPanel.tsx` | Own all planner state (config + plan), fetch data via hooks, call engine, render sub-components | `usePlayers`, `useSquad`, `useMyTeam`, `useAuthStatus`, `multi-gw-planner.ts`, child components |
| `PlannerConfig.tsx` | Horizon slider (1–5), free transfer count, chip selector. Controlled — all state in parent | `PlannerPanel` via props |
| `PlanGwRow.tsx` | Renders one GW's row in the plan table: GW number, chip badge, transfer(s), projected gain, hit cost | `PlannerPanel` via props |
| `PlanSquadSnapshot.tsx` | Renders 15-player squad at end of a specific GW from the plan | `PlannerPanel` via props (derived squad state) |
| `PlanTransferEditor.tsx` | Player picker for manual edit: filter by position, show candidates sorted by proj_pts | `PlannerPanel` via props (callback to update plan) |
| `multi-gw-planner.ts` | Pure function: given squad + all players + config → returns `GwPlan[]` | Called from `PlannerPanel` via `useMemo` |

---

## Data Flow

### Auto-Suggest Flow

```
User opens Planner tab
    ↓
PlannerPanel mounts
    ↓
usePlayers() [cached 6h] + useSquad(teamId) [cached 5min]
    ↓
computeAllGemScores(players) [useMemo, ~250ms for 825 players]
    ↓
computeMultiGwPlan(picks, scoredPlayers, config) [useMemo]
    ↓ returns GwPlan[]
State: planState = GwPlan[]   ← mutable by user
    ↓
Render: PlanGwRow per GW + PlanSquadSnapshot per GW
```

### Manual Edit Flow

```
User clicks "Edit" on a transfer row in GwRow N
    ↓
PlannerPanel: setEditingTransfer({ gwIndex, transferIndex })
    ↓
PlanTransferEditor opens with position-filtered player list
    ↓
User selects replacement player
    ↓
PlannerPanel: setPlanState(produce(draft => {
  draft[gwIndex].transfers[transferIndex].buyPlayer = selected
}))
    ↓
useMemo re-runs: rescoreFromGw(planState, gwIndex, scoredPlayers) 
    ↓ partial rescore — only GWs from gwIndex onwards need rescoring
Re-render: updated scores, new squad snapshots
```

---

## Multi-GW Planner Engine Design

### Core Types (src/lib/planner-types.ts)

```typescript
export interface GwTransfer {
  out: ScoredPlayer           // player being sold
  in: ScoredPlayer            // player being bought
  isFree: boolean             // true if within free transfer allowance
  hitCost: number             // 0 or 4 (pts deducted)
}

export interface GwPlan {
  gwNumber: number            // e.g. 33
  transfers: GwTransfer[]     // 0-n transfers this GW
  chip: ChipState             // 'wildcard' | 'freehit' | 'bboost' | '3xc' | null
  projectedGain: number       // sum of (buy.proj_pts_Xgw - sell.proj_pts_Xgw) - hitCosts
  squadAfter: ScoredPlayer[]  // 15-player squad at end of this GW
  freeTransfersRemaining: number  // after this GW's transfers
  bankAfter: number           // bank balance after this GW's transfers (tenths)
}

export interface PlannerConfig {
  horizon: 1 | 2 | 3 | 4 | 5    // number of GWs to plan
  freeTransfersNow: number        // FTs available in the current GW (1 or 2)
  bankBalance: number             // tenths of £1m
  activeChip: ChipState
}
```

### Engine Function Signature

```typescript
// src/lib/multi-gw-planner.ts
export function computeMultiGwPlan(
  picks: SquadPick[],
  allScoredPlayers: ScoredPlayer[],
  config: PlannerConfig,
): GwPlan[]
```

**Algorithm (greedy, horizon-aware):**

1. Build starting squad from `picks` + `allScoredPlayers` lookup
2. For each GW in the horizon (1 to config.horizon):
   a. Determine available FTs for this GW (carry from previous + 1, cap at 2)
   b. For each position, find the best improvement within budget
   c. Score each transfer candidate using the **GW-horizon-aware projected points** field:
      - GW 1 of plan: use `proj_pts_1gw`
      - GW 2–3: use `proj_pts_3gw` as proxy (no per-GW breakdown in pipeline)
      - GW 4–5: use `proj_pts_5gw`
   d. Apply DGW multiplier: if the fixture data shows 2 fixtures for that GW, weight proj_pts up (DGW bonus is already baked into pipeline `proj_pts` fields via the Python pipeline)
   e. Deduct 4pts for each transfer beyond the free allowance
   f. Build `GwPlan` with the selected transfers, squad snapshot, and projected gain
3. Return `GwPlan[]`

**Key constraint:** The engine is a pure function. It takes in data and returns a plan. State mutation (user editing the plan) happens in `PlannerPanel` by calling the engine with modified inputs or by patching the plan directly and re-scoring.

---

## State Management: Immutable vs Mutable Plan

**Recommendation: Local component state in `PlannerPanel`, no global state manager.**

The plan state lifecycle is:
- Born when the engine runs (auto-suggest)
- Mutated by user edits (transfer swaps, chip changes)
- Consumed only by child components of `PlannerPanel`
- Discarded when the user leaves the Planner tab (panel unmounts)

This is identical to how `TransferPanel` handles its own state — `useState` in the panel component, no context, no Zustand, no server state.

```
State lives in:          PlannerPanel.tsx (useState<GwPlan[]>)
Auto-suggest writes to:  planState via setPlanState(engine output)
User edits write to:     planState via setPlanState(patched copy)
Children read from:      planState passed as props
```

**Immer is recommended** for the patch operations — plan edits are nested array mutations (`planState[gwIndex].transfers[i].in = newPlayer`) and Immer's `produce` makes these safe without deep cloning. Immer is already a peer dependency of TanStack Query, so it may already be in the tree; confirm before adding.

**Do not use `useReducer`** — the state is not complex enough to justify the action/dispatch indirection. Direct `setState` with `produce` is cleaner.

---

## Integration Points: New vs Modified

### New Files

| File | Type | Purpose |
|------|------|---------|
| `src/lib/planner-types.ts` | Type definitions | `GwTransfer`, `GwPlan`, `PlannerConfig` |
| `src/lib/multi-gw-planner.ts` | Pure function engine | Auto-suggest algorithm |
| `src/components/planner/PlannerPanel.tsx` | Client component | Tab panel, owns plan state |
| `src/components/planner/PlannerConfig.tsx` | Client component | Horizon + config inputs |
| `src/components/planner/PlanGwRow.tsx` | Client component | One GW's row in the table |
| `src/components/planner/PlanSquadSnapshot.tsx` | Client component | Squad state after given GW |
| `src/components/planner/PlanTransferEditor.tsx` | Client component | Player picker for manual edits |

### Modified Files

| File | Change | Complexity |
|------|--------|------------|
| `src/app/page.tsx` | Add `'planner'` to `Tab` union, add `<PlannerPanel>` conditional render, add desktop tab button | Low |
| `src/components/nav/MobileNav.tsx` | Add `{ id: 'planner', label: 'Plan' }` to `TABS` array | Trivial |
| `src/lib/types.ts` | No change required — `ScoredPlayer`, `FixtureEntry`, `MergedPlayer` all have the needed fields |  |
| `src/lib/transfer-engine.ts` | No change required — `computeTransferSuggestions` is used as-is from `TransferPanel`; planner has its own engine |  |

### No New API Routes

All data the planner needs is already accessible:
- Squad picks: `useSquad(teamId)` → `/api/squad/[teamId]` (already exists)
- Player data with proj_pts: `usePlayers()` → `/api/players` (already exists)
- Exact sell prices: `useMyTeam(auth)` → `/api/fpl/my-team` (already exists)
- Current GW / fixture data: embedded in player fixtures array from `usePlayers()` (already exists)

The planner is a client-side computation feature. No server-side planning endpoint is needed.

---

## Tab Extension Pattern

### page.tsx Change

```typescript
// Before
type Tab = 'gems' | 'defcon' | 'squad' | 'club-form' | 'value-gems'

// After
type Tab = 'gems' | 'defcon' | 'squad' | 'club-form' | 'value-gems' | 'planner'
```

The `Tab` type is currently defined locally in `page.tsx` and duplicated in `MobileNav.tsx`. This was noted as a tech-debt item in the v1.2 architecture research. For v1.3, extract `Tab` to `src/lib/tabs.ts` before adding `'planner'` — this prevents the three-file change problem (page.tsx + MobileNav.tsx + any new component that imports Tab).

### MobileNav.tsx Change

```typescript
// Add to TABS array:
{ id: 'planner', label: 'Plan' },
```

Six tabs at the bottom nav will compress labels. At 375px with 6 tabs, each tab gets ~62px. Labels must stay short — "Plan" (4 chars) is correct. Consider whether to reorder tabs to put "Plan" second or third (adjacent to "Squad") for logical grouping.

---

## PlannerPanel and TransferPanel: Shared Data Pattern

`PlannerPanel` uses the same data hooks as `TransferPanel`. Both panels need `teamId` input, `usePlayers`, `useSquad`, `useMyTeam`, and `useAuthStatus`.

**Do not merge the panels.** They serve different cognitive tasks:
- `TransferPanel`: "What should I do THIS week?"
- `PlannerPanel`: "What should I do over the next N weeks?"

The team ID and auth state are not shared via context — each panel manages its own form. This is by design: panels are independent, mount on tab switch, unmount when hidden. The `usePlayers` query is shared at the TanStack Query cache level (same `['players']` query key), so there is no duplicate network request.

**Implication for build order:** PlannerPanel can be built without any knowledge of TransferPanel internals. It calls the same hooks but has no component coupling.

---

## Scoring: Projected Points Delta Over Horizon

The planner scores each transfer candidate by comparing projected points over the planning horizon. The pipeline already provides:

- `proj_pts_1gw` — expected points next 1 GW
- `proj_pts_3gw` — expected points next 3 GWs (DGW-aware cumulative)
- `proj_pts_5gw` — expected points next 5 GWs (DGW-aware cumulative)

**Mapping horizon to scoring field:**

| Horizon | Primary scoring field | Notes |
|---------|----------------------|-------|
| 1 GW | `proj_pts_1gw` | Most accurate — ep_next based |
| 2 GW | `proj_pts_3gw` | No 2-GW field exists; 3-GW is the nearest proxy |
| 3 GW | `proj_pts_3gw` | Direct match |
| 4 GW | `proj_pts_5gw` | 5-GW is the nearest proxy |
| 5 GW | `proj_pts_5gw` | Direct match |

For horizon 2 and 4, the engine uses the longer-horizon field. This is an acceptable approximation — the pipeline already factors DGW/BGW into these figures.

**Transfer cost scoring:**

- Free transfer: no deduction
- Hit (extra transfer beyond FT allowance): -4 pts deducted from `projectedGain`
- Hit cost is compared against `proj_pts` delta — the planner surfaces whether the hit is worth taking

---

## Squad Simulation Across GWs

Each GW plan step needs to track squad composition to:
1. Apply budget constraints (sell price + bank)
2. Prevent duplicate player selection across GW steps
3. Render the squad snapshot per GW

**Squad simulation approach:**

```typescript
// Starting state
let currentSquad: ScoredPlayer[] = initialSquadFromPicks(picks, allPlayers)
let currentBank: number = config.bankBalance

// Per GW step:
for (const transfer of gwPlan.transfers) {
  currentSquad = currentSquad.filter(p => p.id !== transfer.out.id)
  currentSquad.push(transfer.in)
  currentBank = currentBank + transfer.out.selling_price - transfer.in.now_cost
}
gwPlan.squadAfter = [...currentSquad]
gwPlan.bankAfter = currentBank
```

**Sell price approximation:** For GW 2+ in the plan, the engine cannot know the exact future sell price (price may change). Use `now_cost` as an approximation. Flag this in the UI as "approximate" — the same caveat already shown in `TransferPanel`.

---

## Chip State in the Plan

Chip timing is visible in the plan (PLAN-08) but chip automation is out of scope. The UI shows a chip selector per GW row. When the user assigns a chip to a GW:

| Chip | Engine effect |
|------|---------------|
| Wildcard | All transfers that GW are free (no -4pt cost) |
| Free Hit | Transfers that GW are free; squad reverts to previous GW's squad next GW |
| Triple Captain | No transfer cost effect; surfaced as a badge in PlanGwRow |
| Bench Boost | No transfer cost effect; surfaced as a badge in PlanGwRow |

The chip list comes from the `active_chip` field that already exists in `SquadPicksResponse` (via `squad-adapter.ts`). The planner needs to know which chips the manager has *available* — this data lives in FPL's `entry/{id}/` endpoint, which the current codebase does not call. Options:

1. **Manual input:** User indicates which chips are available via checkboxes in `PlannerConfig`. Simple, no new API call. 
2. **Auto-fetch:** New call to `GET /api/fpl/entry/[teamId]` to read `chips` array. Adds complexity and a new route.

**Recommendation:** Manual input first. Add auto-fetch as a subsequent enhancement if it proves friction-heavy.

---

## Architecture Diagram (v1.3 Target State)

```
┌──────────────────────────────────────────────────────────────────┐
│  page.tsx  ('use client')    [Tab union adds 'planner']          │
│                                                                   │
│  Tab content:                                                     │
│    planner → <PlannerPanel />   ← NEW                           │
│    ... (5 existing tabs unchanged) ...                           │
│                                                                   │
│  <MobileNav />  [adds 'Plan' tab]    ← MODIFIED (trivial)       │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  PlannerPanel.tsx  ('use client')                                │
│                                                                   │
│  Hooks (same as TransferPanel — shared via TQ cache):            │
│    usePlayers()        → scoredPlayers (useMemo)                 │
│    useSquad(teamId)    → picks, bank, activeChip                 │
│    useMyTeam(auth)     → exact sell prices                       │
│    useAuthStatus()     → isAuthenticated                         │
│                                                                   │
│  State:                                                           │
│    teamId, freeTransfers                (input form)             │
│    config: PlannerConfig               (horizon, chips)          │
│    planState: GwPlan[]                 (mutable plan)            │
│    editingTransfer: {gwIdx, tIdx}|null (editor open state)       │
│                                                                   │
│  Derived (useMemo):                                               │
│    scoredPlayers = computeAllGemScores(players)                  │
│    autoPlan = computeMultiGwPlan(picks, scoredPlayers, config)   │
│    → on mount: setPlanState(autoPlan)                            │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  PlannerConfig                                             │  │
│  │  horizon: 1–5 | FTs: 1–2 | chips available                │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Plan Table (one PlanGwRow per GW in horizon)              │  │
│  │  GW | Chip | Transfers (Out → In) | Hit Cost | Proj Gain   │  │
│  │  [Edit] button per row → opens PlanTransferEditor          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  PlanSquadSnapshot (one per GW, below plan table)          │  │
│  │  GK / DEF / MID / FWD split, highlights changed players    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  PlanTransferEditor (modal/inline, shown when editingTransfer)   │
│    position-filtered player list, sorted by proj_pts_Xgw         │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  multi-gw-planner.ts  (pure function — no side effects)          │
│                                                                   │
│  computeMultiGwPlan(                                             │
│    picks: SquadPick[],                                           │
│    allPlayers: ScoredPlayer[],                                   │
│    config: PlannerConfig                                         │
│  ): GwPlan[]                                                     │
│                                                                   │
│  Calls:                                                          │
│    computeAllGemScores() — already in gem-score.ts              │
│    nextGwFixtureCount()  — already in transfer-engine.ts         │
│  Does NOT call:                                                  │
│    computeTransferSuggestions() — separate single-GW engine     │
└──────────────────────────────────────────────────────────────────┘
```

---

## Patterns to Follow

### Pattern 1: Pure Function Engine

**What:** All planning logic in `multi-gw-planner.ts` as a pure function. No React state, no hooks, no side effects. Takes data in, returns `GwPlan[]`.

**When:** The engine is called from `useMemo` in `PlannerPanel`. The same function can be called with patched inputs to re-score after user edits.

**Precedent in codebase:** `computeTransferSuggestions` (transfer-engine.ts), `computeVerdicts` (recommend.ts), `computeAllGemScores` (gem-score.ts) — all pure functions called from `useMemo` in `TransferPanel`.

### Pattern 2: Panel-Level State Ownership

**What:** All planner state (`planState`, `config`, `editingTransfer`) lives in `PlannerPanel`. No context, no global store. Child components receive data and callbacks as props.

**When:** The state is consumed by children of a single parent. One level of prop passing is not "drilling" — it is the correct pattern at this component depth.

**Precedent in codebase:** `TransferPanel` owns `freeTransfers`, computed results, and all UI state. Passes derived data down to `SquadView`, `CaptaincyPanel`, etc.

### Pattern 3: useMemo for Derived Plan State

**What:** `planState` = auto-suggested plan stored in `useState`. User edits produce a new array via `produce` (Immer). Downstream derived values (squad snapshots, projected totals) computed with `useMemo(fn, [planState, scoredPlayers])`.

**When:** Expensive computations triggered by user edits. `useMemo` prevents recomputation on unrelated re-renders.

**Precedent in codebase:** `transferResult`, `verdicts`, `captaincyCandidates` in TransferPanel.tsx all use `useMemo`.

### Pattern 4: Progressive Disclosure for Squad Snapshots

**What:** Squad snapshots (15-player lists) are shown per GW but collapsed by default. User clicks "View squad →" to expand the snapshot for that GW. This avoids a wall of 15-player tables.

**When:** Content that is useful but dense — show on demand. The page would be 90+ rows of player names without this.

**Implementation:** `useState<Set<number>>` of expanded GW indices. Each `PlanSquadSnapshot` receives `isExpanded` prop and an `onToggle` callback.

### Pattern 5: Responsive Table Pattern (from v1.2)

**What:** Plan table on mobile uses the same `overflow-x-auto` + sticky first column pattern already used by GemTable. On mobile (< sm), compress the plan table to: GW | Transfers | Score. Chip badge and detailed breakdown visible on expand.

**When:** Table with 5+ columns rendered on mobile.

**Precedent in codebase:** All 4 TanStack tables in v1.2 use `overflow-x-auto` with `columnVisibility` for mobile.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Server-Side Plan Computation

**What people do:** Create a `POST /api/planner` route that accepts squad + config, runs the planning algorithm server-side, and returns the plan.

**Why it's wrong for this app:** The planning algorithm needs the scored players (`computeAllGemScores` output) which are expensive to recompute server-side per request. The `usePlayers` data is already cached client-side with a 6h stale time. All planning computations run in under 500ms on the client (825 players, 5-GW horizon, greedy algorithm). Server-side adds a network round-trip, auth complexity, and caching questions for a computation that is inherently personal and ephemeral.

**Do this instead:** Pure function in `src/lib/multi-gw-planner.ts`, called from `useMemo` in `PlannerPanel`. Same pattern as `computeTransferSuggestions`.

### Anti-Pattern 2: Zustand or External State Manager for Plan State

**What people do:** Create a `usePlannerStore` with Zustand to hold `GwPlan[]` globally so the plan persists across tab switches.

**Why it's wrong:** Plan state is session-ephemeral. It is meaningless if the user's squad or the player data has changed. The plan should regenerate when the user re-opens the Planner tab. Persisting plan state across tabs adds complexity (stale plan problem, invalidation triggers) that provides no real user value.

**Do this instead:** `useState<GwPlan[]>` in `PlannerPanel`. The panel re-mounts on each tab switch (conditional render pattern already used), which naturally clears stale state. If plan persistence becomes a user need, address it then.

### Anti-Pattern 3: Merging PlannerPanel into TransferPanel

**What people do:** Add a "multi-GW mode" toggle to `TransferPanel` and extend that component with planner functionality.

**Why it's wrong:** `TransferPanel` is already 430 lines and handles 5 distinct concerns (auth, squad loading, transfer engine, captaincy, verdicts). Adding planning UI would push it past 800 lines with conditional rendering scattered through a single component. The cognitive tasks are distinct — single-GW suggestion vs multi-GW planning — and deserve separate tabs.

**Do this instead:** New `PlannerPanel` component in `src/components/planner/`. It reuses the same hooks and data layer but has its own component tree.

### Anti-Pattern 4: Recalculating Full Plan on Every Edit

**What people do:** When the user edits transfer N in GW 2, call `computeMultiGwPlan` from scratch with modified inputs.

**Why it's wrong:** Full plan recomputation is O(players * horizon * positions). For a 5-GW plan, this is acceptable (~100ms), but it discards all other manual edits the user has made to other GWs.

**Do this instead:** Partial re-score from the edited GW onwards. GWs before the edit are unchanged (squad state is the same). Implement `rescoreFromGw(planState, gwIndex, scoredPlayers)` that recalculates `projectedGain` and `squadAfter` for GWs >= gwIndex without regenerating transfer recommendations for earlier GWs. This preserves user edits above the changed GW.

### Anti-Pattern 5: New API Route for Fixture Data

**What people do:** Create `GET /api/fpl/fixtures` to fetch upcoming GW fixture data for the planner.

**Why it's wrong:** Fixture data (specifically the `event_id` on each player's `fixtures` array) is already embedded in `MergedPlayer.fixtures` from `usePlayers()`. The pipeline computes `proj_pts_1gw`, `proj_pts_3gw`, `proj_pts_5gw` factoring in DGW/BGW. No additional fixture API call is needed for the planner's scoring logic.

**Do this instead:** Use `player.fixtures` (already in `MergedPlayer`) to identify DGW/BGW weeks and use `player.proj_pts_Xgw` fields for scoring.

---

## Build Order (Dependency-Respecting)

```
Step 1:  src/lib/planner-types.ts
         Define GwTransfer, GwPlan, PlannerConfig types.
         Zero dependencies. Required by steps 2–5.

Step 2:  src/lib/multi-gw-planner.ts
         Pure function engine. Depends on planner-types + existing 
         ScoredPlayer/SquadPick types. No UI dependency.
         Write unit tests alongside (Vitest — same pattern as squad-adapter.test.ts).

Step 3:  src/lib/tabs.ts
         Extract Tab union type from page.tsx + MobileNav.tsx into a shared file.
         Add 'planner' to the union here.
         Prerequisite for step 7 (MobileNav) and step 8 (page.tsx).

Step 4:  src/components/planner/PlanGwRow.tsx
         Dumb component — receives GwPlan as props, renders one table row.
         No state, no hooks. Build and snapshot-test in isolation.

Step 5:  src/components/planner/PlanSquadSnapshot.tsx
         Dumb component — receives ScoredPlayer[] + changes, renders squad grid.
         No state, no hooks.

Step 6:  src/components/planner/PlannerConfig.tsx
         Controlled form component. Horizon selector, FT count, chip availability.
         Only peer dependency: planner-types.ts.

Step 7:  src/components/planner/PlanTransferEditor.tsx
         Player picker. Receives position filter, playerList, onSelect callback.
         No state (controlled by parent).

Step 8:  src/components/planner/PlannerPanel.tsx
         Assembles all sub-components + hooks + engine.
         Depends on steps 2–7. This is the integration step.

Step 9:  Update src/app/page.tsx
         Add 'planner' tab button + <PlannerPanel /> conditional render.
         Depends on step 8.

Step 10: Update src/components/nav/MobileNav.tsx
         Add 'Plan' entry to TABS.
         Depends on step 3 (shared Tab type).

Step 11: Integration test: full tab render with real hook data (manual + Vitest).
```

---

## Scalability Considerations

This is a single-user personal tool. Scalability concerns are about code maintainability, not load.

| Concern | Now (v1.3) | If Requirements Expand |
|---------|------------|------------------------|
| Plan algorithm complexity | Greedy, O(players * horizon * positions) — ~100ms max | Beam search or dynamic programming if brute-force quality needed |
| Plan persistence | Session-only (useState, lost on tab switch) | localStorage serialisation, invalidate on squad change |
| Chip availability detection | Manual user input | Fetch `entry/{id}/` chips array via new route |
| Horizon length | 1–5 GWs | Beyond 5, `proj_pts_5gw` is the ceiling of available data |
| Multiple plan variants | Single plan per session | "Saved scenarios" pattern: `useState<GwPlan[][]>` |
| Mobile layout of plan table | overflow-x-auto + compressed columns | Same column-hiding pattern as v1.2 tables |

---

## Integration Points Summary

| What integrates | With what | How | Change type |
|-----------------|-----------|-----|-------------|
| `PlannerPanel` | `usePlayers` | Hook call — returns `MergedPlayer[]` | Reuse (no change) |
| `PlannerPanel` | `useSquad` | Hook call — returns picks + bank + chip | Reuse (no change) |
| `PlannerPanel` | `useMyTeam` | Hook call — returns exact sell prices | Reuse (no change) |
| `PlannerPanel` | `useAuthStatus` | Hook call — gates `useMyTeam` | Reuse (no change) |
| `PlannerPanel` | `computeAllGemScores` | Direct import + useMemo | Reuse (no change) |
| `PlannerPanel` | `multi-gw-planner.ts` | Direct import + useMemo | New engine |
| `page.tsx` | `PlannerPanel` | Conditional render on tab | Minor addition |
| `page.tsx` | `Tab` type | Add `'planner'` literal | Minor extension |
| `MobileNav` | `Tab` type | Add `'Plan'` to TABS array | Trivial addition |
| `planner-types.ts` | `ChipState` from `transfer-engine.ts` | Re-export or re-use | Reuse |

---

## Sources

- `src/lib/transfer-engine.ts` — pure function pattern, `ChipState`, `SingleTransfer` types; scoring approach with DGW awareness (HIGH confidence — codebase)
- `src/components/transfers/TransferPanel.tsx` — panel-level state ownership pattern; hook usage; `useMemo` for derived values (HIGH confidence — codebase)
- `src/lib/types.ts` — `MergedPlayer.proj_pts_1gw/3gw/5gw`, `FixtureEntry.event_id` for DGW detection (HIGH confidence — codebase)
- `src/app/page.tsx` — Tab union type location, conditional render pattern, desktop tab bar structure (HIGH confidence — codebase)
- `src/components/nav/MobileNav.tsx` — TABS array structure, Tab type duplication issue (HIGH confidence — codebase)
- `src/lib/squad-adapter.ts` — `SquadPicksResponse`, `MyTeamPickSchema.selling_price`, `EntryHistorySchema.bank` (HIGH confidence — codebase)
- `src/lib/gem-score.ts` — `computeAllGemScores` signature; 825-player, ~250ms estimate based on 7-dimension O(n) pass (HIGH confidence — codebase)

---

*Architecture research for: FPL Analyst v1.3 Gameweek Planner*
*Researched: 2026-04-01*
