# Architecture Patterns — v1.7 Decision Assistant Integration

**Domain:** FPL analytics decision engine — adding on top of existing Next.js 16 / Python pipeline app
**Researched:** 2026-05-01
**Confidence:** HIGH (based on direct codebase reading, no guesswork)

---

## Existing Architecture — Ground Truth

### Data Flow (established, immutable)

```
GitHub Actions cron (daily)
  → pipeline/run.py
    → FPL bootstrap + fixtures + element-summaries
    → Understat xG/xA
    → merge_players() → merged_players.json
    → captain_picks.json
    → insights.json
    → accuracy_backtest.json
    → set_piece_changes.json
  → save() → Vercel Blob (prod) or pipeline/cache/ (dev)

Browser request
  → /api/players → Blob read → Response.json(enriched)   ← only API with join logic
  → /api/captain-picks → Blob read → Response.json()
  → /api/insights → Blob read → Response.json()
  → (pattern: thin Blob reader, no computation)

Client component (page.tsx)
  → usePlayers() → ['players'] query key → 6h staleTime
  → useSquad(teamId) → squad picks from FPL API
  → useMyTeam() → exact sell prices (auth only)
  → pure-TS engines (optimiseLineup, suggestTransfers, computeClubForm, etc.)
  → renders into section/sub-tab structure
```

### Nav Hierarchy (established)

```
Section: Analyse  → Gem Ratings | Insights | DefCon | Set Pieces | Accuracy
Section: Plan     → Planner | Club Form | Value Gems
Section: Squad    → Transfers | Optimiser
```

v1.7 adds a new sub-tab "Decision" inside Plan, and augments existing views. It does **not** restructure sections.

### Key Architectural Invariants to Preserve

- `/api/*` routes are **stateless thin readers** — no computation, no state
- All decision logic lives in **pure-TS engine functions** in `src/lib/`
- `usePlayers()` with `['players']` query key is the **single source of truth** for player data — all features must reuse this cache
- `useSquad(teamId)` is already lifted to `page.tsx` and shared between Transfers and Optimiser via TanStack Query cache
- Pipeline writes JSON files; UI reads them — **no pipeline-to-UI WebSocket or polling**
- `MergedPlayer` in `src/lib/types.ts` is the **schema contract** — all new pipeline fields must be added here

---

## Feature-by-Feature Integration Analysis

### 1. Transfer Opportunity Cost Simulator

**What it does:** Compare Roll / 1-FT / 2-FT / Hit across 1/3/5 GW horizons for the user's actual squad.

**Existing entry points:**
- `suggestTransfers()` in `src/lib/suggest-transfers.ts` already handles 1-FT (cost=0 or cost=4) and 2-FT (cost=0 when ftCount=2) variants
- `SuggestTransfersParams` accepts `ftCount: 1 | 2` and `bank`
- Results are `TransferSuggestion[]` with `xPtsGain`, `xPtsGainPerGw`, `breakEvenGws`, `cost`

**What is missing:**
- "Roll" scenario: the engine doesn't model "do nothing and bank the FT" — this is just `xPtsGain = 0` for this GW, plus a future-value heuristic (having 2 FTs next week is worth ~half a transfer's optionality)
- Cross-horizon comparison: `suggestTransfers()` is called with a single `horizon` — simulator needs to call it at 1, 3, and 5 to build a matrix
- Scenario aggregation: the 4 scenarios (Roll / 1-FT / 2-FT / Hit) need to be synthesised into a single table showing the best transfer for each scenario at each horizon

**Integration pattern:**

The simulator is a **pure-TS computation layer** that wraps `suggestTransfers()`:

```typescript
// src/lib/opportunity-cost-engine.ts  (NEW)
export interface ScenarioResult {
  scenario: 'roll' | '1ft' | '2ft' | 'hit'
  horizon: OptimiserHorizon
  bestGain: number
  bestTransfer: TransferSuggestion | null
  rollValue: number | null  // estimated FT option value for Roll scenario
}

export function computeOpportunityCost(
  picks: SquadPick[],
  players: MergedPlayer[],
  ftCount: 1 | 2,
  bank: number,
  sellPrices?: Map<number, number>
): ScenarioResult[]
```

This function calls `suggestTransfers()` three times (once per horizon) and synthesises results. Total computation: <5ms (same engine, three passes).

**UI placement:** New sub-tab "Simulator" under Plan section, or embedded panel inside existing Transfers sub-tab. The table is self-contained. Given it requires squad data (teamId), placing it as a panel inside the **Squad → Optimiser** sub-tab (below the existing comparison table) avoids duplicating the team ID entry flow. Alternatively, a dedicated Squad sub-tab "Simulator" is clean.

**Data flow:** No new API routes. No pipeline changes. Pure client-side.

**New files:**
- `src/lib/opportunity-cost-engine.ts` (pure TS, no React)
- `src/components/optimiser/SimulatorTable.tsx` (display only)

**Modified files:**
- `src/lib/types.ts` — add `ScenarioResult` type
- `page.tsx` — add sub-tab entry if creating new Squad sub-tab

---

### 2. Weekly Decision Summary

**What it does:** One-screen aggregation of captain rec, transfer rec, bench order, chip timing, risks, and opportunities.

**Existing engines to aggregate:**
- Captain: `useCaptainPicks()` → `captain_picks.json` (pipeline-computed, `CaptainPicks` type)
- Transfer: `suggestTransfers()` → top-1 single suggestion from current squad
- Bench order: `optimiseLineup()` → `bench: number[]` (already computed in OptimiserPanel)
- Chip timing: `computeBBScore()`, `computeTCScore()`, `computeFHResult()` from `chip-strategy-engine.ts`
- Lifecycle labels (v1.7 feature): `computeVerdicts()` extended (see Feature 4)

**Integration challenge:** All these data sources use different hooks. The Decision Summary needs them all simultaneously. This is a data aggregation problem, not a computation problem.

**Pattern:** Create a `useDecisionSummary()` hook that composes the relevant hooks:

```typescript
// src/lib/hooks/useDecisionSummary.ts  (NEW)
export function useDecisionSummary(teamId: string) {
  const { data: players } = usePlayers()           // ['players'] — already cached
  const { data: captainPicks } = useCaptainPicks() // ['captain-picks'] — already cached
  const { data: clubForm } = useClubForm()         // ['club-form'] — already cached
  const { data: squad } = useSquad(teamId)         // ['squad', teamId] — shared cache
  // ... memoised aggregation into DecisionSummary shape
}
```

This is the same composing pattern already used in `TransferPanel.tsx`. Each sub-hook is individually cached by TanStack Query; the aggregation is a `useMemo()` derived value.

**UI placement:** New sub-tab under the Plan section: Plan → "Decision" (landing between Planner and Club Form). This is the appropriate home — it's a planning output, not a squad-edit workflow.

**New files:**
- `src/lib/hooks/useDecisionSummary.ts`
- `src/components/decision/DecisionSummaryPanel.tsx`
- `src/components/decision/CaptainCard.tsx`
- `src/components/decision/TransferCard.tsx`
- `src/components/decision/ChipCard.tsx`
- `src/components/decision/RiskCard.tsx`

**Modified files:**
- `page.tsx` — add `'decision'` to SubTab union, add to Plan section's subTabs array
- `src/components/nav/MobileNav.tsx` — add Decision to mobile nav

---

### 3. Fixture Swing Detector

**What it does:** Identify teams with materially improving or worsening upcoming fixtures (delta from current GW to future GWs).

**Existing data:**
- `ClubForm` in `src/lib/types.ts` has `attacking_ease_1gw`, `attacking_ease_3gw`, `attacking_ease_5gw` and defensive equivalents
- `useClubForm()` hook already fetches this data, cached at `['club-form']`
- `FixtureEntry` per player has `attacking_difficulty` and `defensive_difficulty` per GW

**What is missing:**
- A "swing" computation: `delta = ease_3gw - ease_1gw` (or similar). Teams where the 3GW ease is significantly better than 1GW ease = "improving". Inverse = "worsening".
- No pipeline change needed — all data is already in `ClubForm`

**Integration pattern:**

```typescript
// src/lib/fixture-swing-engine.ts  (NEW)
export interface FixtureSwing {
  team_id: number
  team_short_name: string
  att_swing: number          // attacking_ease_3gw - attacking_ease_1gw (positive = improving)
  def_swing: number          // defensive_ease_3gw - defensive_ease_1gw
  direction: 'improving' | 'worsening' | 'neutral'
  magnitude: 'large' | 'moderate' | 'small'
}

export function computeFixtureSwings(clubForm: ClubForm[]): FixtureSwing[]
```

Threshold for "large": delta > 0.3 (raw ease units 0-1). Threshold for "moderate": delta > 0.15. These are tunable constants.

**UI placement:** New panel inside the Plan → Club Form sub-tab, rendered above the existing `FixtureEaseRankingPanel`. It's contextually appropriate — users already go to Club Form to assess fixture difficulty.

**New files:**
- `src/lib/fixture-swing-engine.ts` (pure TS)
- `src/components/club-form/FixtureSwingPanel.tsx`

**Modified files:**
- `page.tsx` — add `<FixtureSwingPanel />` above `<FixtureEaseRankingPanel />` inside the club-form branch

**No pipeline changes. No new API routes.**

---

### 4. Player Lifecycle Labels

**What it does:** Extend Buy/Hold/Sell with granular timing labels: "Buy next week", "Hold one more GW", "Sell soon", "Minutes trap", "Fixture trap", etc.

**Existing entry point:**
- `computeVerdicts()` in `src/lib/recommend.ts` returns `Map<playerId, Verdict>` where `Verdict = 'buy' | 'hold' | 'sell'`
- It uses `gem_score` vs position average as the sole discriminator
- `MergedPlayer` already has: `mins_risk`, `fixtures` (next 5), `regression_signal`, `differential_flag`, `xPts_1gw`, `xPts_3gw`, `xPts_5gw`

**What is missing:**
- Sub-labels derived from existing fields:
  - "Minutes trap": verdict='buy' but `mins_risk === 'rotation_risk'` or `mins_risk === 'cameo'`
  - "Fixture trap": verdict='buy' but `attacking_ease_1gw` < 0.3 (hard upcoming fixture)
  - "Sell soon": verdict='sell' AND `regression_signal === 'sell'` (price likely to fall)
  - "Buy next week": verdict='buy' but current fixture is hard (`attacking_ease_1gw` < 0.3), next 3GW is easy
  - "Hold one more GW": verdict='hold' AND fixture improvement incoming

**Decision: client-side, not pipeline.** All input data is already in `MergedPlayer`. Adding this to the pipeline would create a dependency on `ClubForm` data during merge (currently separate). Client-side keeps it testable and instantly reactive to horizon changes.

**Integration pattern:**

```typescript
// src/lib/lifecycle-labels.ts  (NEW)
export type LifecycleLabel =
  | 'buy'
  | 'buy-next-week'
  | 'minutes-trap'
  | 'fixture-trap'
  | 'hold'
  | 'hold-one-more'
  | 'sell-soon'
  | 'sell'

export function computeLifecycleLabel(
  player: ScoredPlayer,
  verdict: Verdict,
  clubFormMap: Map<number, ClubFormFixture[]>  // from buildClubFormMap()
): LifecycleLabel
```

The function accepts a pre-computed `Verdict` (from `computeVerdicts`) and enriches it with fixture and minutes context.

**UI placement:** `LifecycleLabel` replaces or augments `VerdictBadge` in `SquadView` and `TransferPanel`. The label appears on each squad player row, replacing the current 3-way Buy/Hold/Sell badge.

**New files:**
- `src/lib/lifecycle-labels.ts` (pure TS)
- `src/components/shared/LifecycleBadge.tsx` (replaces/wraps `VerdictBadge`)
- `src/lib/lifecycle-labels.test.ts`

**Modified files:**
- `src/components/squad/SquadView.tsx` — use `LifecycleBadge` where `VerdictBadge` is rendered
- `src/components/transfers/TransferPanel.tsx` — pass `clubForm` data for label computation

**No pipeline changes. No new API routes.** One new hook dependency: `useClubForm()` needs to be called in `TransferPanel` (currently it is not — `TransferPanel` does not use club form data). Since `useClubForm()` is already globally cached via TanStack Query, adding this call does not trigger a new network request if Club Form tab has already been visited.

---

### 5. Explainable xPts Breakdown

**What it does:** Expand the existing XPtsCell tooltip into a richer breakdown including appearance probability, minutes factor, goal prob, assist prob, CS prob, and bonus prob.

**Existing entry point:**
- `XPtsCell` in `src/components/gem-table/columns.tsx` already renders a tooltip for the 1GW window using `xPts_components_1gw`
- `xPts_components_1gw` in `MergedPlayer` has `{ goal_pts, assist_pts, cs_pts, bonus_pts }` — four fields
- The pipeline `_compute_xpts_fixture()` computes these values and stores them in `merged_players.json`

**What is missing:**
- `appearance_prob` and `min_factor` are computed inside `_compute_xpts_fixture()` but not stored in the output:
  - `start_prob` is already in `MergedPlayer` as a top-level field
  - `xmins` is already in `MergedPlayer`
  - `min_factor = min(1.0, xmins / 60.0)` is derivable client-side
- A richer "breakdown modal" or expanded tooltip that shows the probability chain

**Decision: mostly client-side.** The missing values (`appearance_prob` = `start_prob`, `min_factor` derivable from `xmins`) are already present in `MergedPlayer`. No pipeline change required for the core breakdown.

The one genuine gap: `goal_prob` and `assist_prob` as probabilities (not as expected points). These are `lam_g = xg_per90 * (xmins/90)` and `lam_a = xa_per90 * (xmins/90)`, derivable client-side from existing `xg_per90`, `xa_per90`, and `xmins` fields.

**Integration pattern:**

```typescript
// src/lib/xpts-breakdown.ts  (NEW)
export interface XPtsBreakdown {
  appearance_prob: number    // start_prob from MergedPlayer
  min_factor: number         // min(1, xmins/60) for CS; xmins/90 for goals
  goal_prob: number          // lam_g = xg_per90 * (xmins/90)
  assist_prob: number        // lam_a = xa_per90 * (xmins/90)
  cs_prob: number            // _cs_prob formula: 0.40 - dd*0.30 * min_factor
  goal_pts: number           // from xPts_components_1gw
  assist_pts: number         // from xPts_components_1gw
  cs_pts: number             // from xPts_components_1gw
  bonus_pts: number          // from xPts_components_1gw
  total: number              // xPts_1gw
}

export function computeXPtsBreakdown(player: MergedPlayer): XPtsBreakdown | null
```

**UI:** Replace the existing `title=` tooltip in `XPtsCell` with a hover card (Tailwind popover pattern — no new library). Or, integrate the breakdown into `PlayerComparisonModal` which already has a dedicated xPts section.

**New files:**
- `src/lib/xpts-breakdown.ts` (pure TS)
- Possibly `src/components/gem-table/XPtsBreakdownCard.tsx` (hover card)

**Modified files:**
- `src/components/gem-table/columns.tsx` — `XPtsCell` uses new breakdown card instead of `title=` tooltip

**No pipeline changes.** The `cs_prob` formula needs to be mirrored from Python (`_cs_prob()` in `merge.py`) into TypeScript — this is a documented formula, easy to replicate.

---

### 6. Clean Sheet Probability

**What it does:** Per-fixture CS% for all teams computed from rolling xGA, displayed as a new column or panel to improve GK/DEF picks.

**Existing data:**
- `defensive_difficulty` per fixture in `FixtureEntry` represents opponent's attacking threat (0.0 = weak attacker, 1.0 = strong)
- `_cs_prob()` in `merge.py` already computes `cs_prob_raw = max(0.10, min(0.65, 0.40 - defensive_difficulty * 0.30))`
- This formula is already being applied per player, per fixture, inside `_compute_xpts_fixture()` — but the per-team, per-GW CS probability is not currently surfaced as a standalone field

**Decision: pipeline adds per-team CS% data; client-side display only.**

Two options:
- **Option A (pipeline):** Add `cs_prob_1gw`, `cs_prob_3gw` per player to `merged_players.json`. Computed in `merge.py` by aggregating `_cs_prob()` across upcoming fixtures. Minimal pipeline change — the formula already runs per fixture.
- **Option B (client-side):** Derive CS prob client-side using `defensive_difficulty` from `player.fixtures` and `player.xmins`. No pipeline change.

**Recommendation: Option B (client-side).** All required data is already in `MergedPlayer`:
- `player.fixtures[0].defensive_difficulty` — first-GW defensive difficulty
- `player.xmins` — minutes factor
- CS prob formula is simple enough to mirror from Python: `max(0.10, min(0.65, 0.40 - dd * 0.30)) * min(1.0, xmins / 60.0)`

This avoids a pipeline schema change and keeps all probability math client-side (consistent with xPts breakdown approach above).

**Integration pattern:**

```typescript
// src/lib/cs-probability.ts  (NEW)
export interface CSProbability {
  team_id: number
  team_short_name: string
  cs_prob_1gw: number    // for GK/DEF: always computed; for others: 0
  cs_prob_3gw: number    // mean across next 3 fixtures
  fixture_opponent: string
  is_home: boolean
}

export function computeCSProbability(player: MergedPlayer): CSProbability | null
```

**UI placement:** Two integration points:
1. New column in GemTable (`CS%`) — visible in Analysis preset, hidden in Default and Compact presets. This is the primary discovery surface.
2. Panel inside OptimiserPanel showing GK and DEF CS probabilities for the user's current starters.

**New files:**
- `src/lib/cs-probability.ts` (pure TS)
- `src/components/gem-table/CSProbCell.tsx` (column renderer)

**Modified files:**
- `src/components/gem-table/columns.tsx` — add CS% column
- `src/components/gem-table/GwToggle.tsx` — add `cs_prob` to `PRESET_COLUMN_VISIBILITY` (hidden in default/compact, visible in analysis)
- `src/lib/types.ts` — if any new optional fields are needed (likely none for Option B)

**No new API routes. No pipeline changes (Option B).**

---

## Component Boundaries Summary

| Component | Location | Type | Communicates With |
|-----------|----------|------|-------------------|
| `opportunity-cost-engine.ts` | `src/lib/` | Pure TS | Wraps `suggestTransfers()` |
| `SimulatorTable.tsx` | `src/components/optimiser/` | React client | Receives `ScenarioResult[]` via props |
| `useDecisionSummary.ts` | `src/lib/hooks/` | TanStack Query composite | `usePlayers`, `useCaptainPicks`, `useClubForm`, `useSquad` |
| `DecisionSummaryPanel.tsx` | `src/components/decision/` | React client | `useDecisionSummary()` |
| `fixture-swing-engine.ts` | `src/lib/` | Pure TS | Reads `ClubForm[]` |
| `FixtureSwingPanel.tsx` | `src/components/club-form/` | React client | `useClubForm()` |
| `lifecycle-labels.ts` | `src/lib/` | Pure TS | Wraps `computeVerdicts()` result + `ClubForm` |
| `LifecycleBadge.tsx` | `src/components/shared/` | React client | Replaces `VerdictBadge` |
| `xpts-breakdown.ts` | `src/lib/` | Pure TS | Reads `MergedPlayer` fields |
| `XPtsBreakdownCard.tsx` | `src/components/gem-table/` | React client | Replaces `title=` tooltip in `XPtsCell` |
| `cs-probability.ts` | `src/lib/` | Pure TS | Reads `player.fixtures` + `player.xmins` |
| `CSProbCell.tsx` | `src/components/gem-table/` | React client | New GemTable column |

---

## Data Flow Changes

### Fields Already Present in `MergedPlayer` (no pipeline change needed)
- `start_prob` — appearance probability for xPts breakdown
- `xmins` — minutes factor for CS prob and xPts breakdown
- `xg_per90`, `xa_per90` — for goal/assist probability computation
- `fixtures[].defensive_difficulty` — for CS probability
- `fixtures[].attacking_difficulty` — for fixture swing
- `xPts_components_1gw` — four components already stored

### Fields in `ClubForm` (already served by `/api/club-form`)
- `attacking_ease_1gw`, `attacking_ease_3gw`, `attacking_ease_5gw` — for fixture swing
- `defensive_ease_1gw`, `defensive_ease_3gw`, `defensive_ease_5gw` — for fixture swing and lifecycle labels

### New Pipeline Fields Required
None for the recommended integration approach. All six features can be implemented using existing pipeline output.

### New API Routes Required
None. All existing `/api/*` routes are sufficient.

---

## Suggested Build Order

Dependencies drive this order: each phase uses only data and engines that exist at the start of that phase.

### Phase 1: Fixture Swing Detector + CS Probability
**Why first:** Pure client-side, no deps on other v1.7 features. Uses only `ClubForm` and `MergedPlayer` — both stable. These are new pure-TS engines (`fixture-swing-engine.ts`, `cs-probability.ts`) that later features can optionally consume. Building these first gives lifecycle labels a fixture context to draw from.
- New: `fixture-swing-engine.ts`, `FixtureSwingPanel.tsx`, `cs-probability.ts`, `CSProbCell.tsx`
- Modified: `columns.tsx` (CS% column), `GwToggle.tsx` (preset visibility), page club-form branch

### Phase 2: Explainable xPts Breakdown
**Why second:** Self-contained. Depends only on existing `MergedPlayer` fields and `xPts_components_1gw`. No deps on other v1.7 features. Unblocks `DecisionSummaryPanel` which will want to show xPts components.
- New: `xpts-breakdown.ts`, `XPtsBreakdownCard.tsx`
- Modified: `XPtsCell` in `columns.tsx`

### Phase 3: Player Lifecycle Labels
**Why third:** Depends on `computeVerdicts()` (existing) and `ClubForm` fixture context (Phase 1 engine). `LifecycleBadge` replaces `VerdictBadge` in SquadView and TransferPanel.
- New: `lifecycle-labels.ts`, `LifecycleBadge.tsx`, `lifecycle-labels.test.ts`
- Modified: `SquadView.tsx`, `TransferPanel.tsx`

### Phase 4: Transfer Opportunity Cost Simulator
**Why fourth:** Depends on `suggestTransfers()` (existing, stable) and squad data hooks. No deps on v1.7 features. Can be built independently but benefits from lifecycle labels being available for contextual display.
- New: `opportunity-cost-engine.ts`, `SimulatorTable.tsx`
- Modified: `page.tsx` (new Squad sub-tab or embedded panel), `src/lib/types.ts`

### Phase 5: Weekly Decision Summary
**Why last:** Aggregates outputs from all other features (captain picks, transfer engine, chip strategy, lifecycle labels, fixture swings). Must be built last because it depends on Phases 1, 3, and 4.
- New: `useDecisionSummary.ts`, `DecisionSummaryPanel.tsx`, sub-components (CaptainCard, TransferCard, ChipCard, RiskCard)
- Modified: `page.tsx` (new Plan → Decision sub-tab), `MobileNav.tsx`

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: New Pipeline Schema for Client-Derivable Values
**What:** Adding `cs_prob_1gw`, `goal_prob_1gw`, etc. to `merged_players.json` when the values can be computed client-side from existing fields.
**Why bad:** Schema migrations require pipeline re-run + cache invalidation + TypeScript type updates + API route changes. Client-side derivation is faster to ship and easier to change.
**Instead:** Mirror the Python formula in TypeScript. The `_cs_prob()` formula is 2 lines of math.

### Anti-Pattern 2: New API Routes for v1.7 Features
**What:** Creating `/api/decision-summary`, `/api/fixture-swings`, `/api/lifecycle-labels`.
**Why bad:** All v1.7 features compose existing data. A new route adds a Blob read, a TanStack Query key, cache invalidation complexity, and a new file to maintain — for no data that isn't already available.
**Instead:** Compose from `usePlayers()`, `useClubForm()`, `useCaptainPicks()`, `useSquad()` — all already cached.

### Anti-Pattern 3: Putting Decision Logic in `page.tsx`
**What:** Moving `computeLifecycleLabel()` or `computeOpportunityCost()` calls into the page component.
**Why bad:** `page.tsx` is already 200 lines managing nav state. Decision logic belongs in pure-TS engines (testable via Vitest) or hooks. `page.tsx` should only handle section/sub-tab state.
**Instead:** Pure-TS engine in `src/lib/`, called from the relevant panel component or hook.

### Anti-Pattern 4: Duplicating Squad Fetch
**What:** Calling `useSquad(teamId)` independently inside new components like `SimulatorTable` or `DecisionSummaryPanel`.
**Why bad:** If `teamId` differs (e.g., prop drilling missed), TanStack Query creates a second cache entry. The pattern established in v1.6 (teamId lifted to `page.tsx`, shared via props) must be preserved.
**Instead:** Pass `teamId` or pre-fetched `squadData` as props from the parent that already has it.

---

## Sources

- Direct codebase reading: `src/lib/suggest-transfers.ts`, `src/lib/optimise-lineup.ts`, `src/lib/recommend.ts`, `src/lib/club-form.ts`, `src/lib/chip-strategy-engine.ts`
- `src/lib/types.ts` — full MergedPlayer schema with all optional fields
- `src/app/page.tsx` — nav hierarchy, sub-tab structure, state model
- `src/components/optimiser/OptimiserPanel.tsx` — existing squad + transfer engine wiring
- `src/components/transfers/TransferPanel.tsx` — multi-hook composition pattern
- `src/components/gem-table/columns.tsx` — XPtsCell and existing tooltip pattern
- `pipeline/merge.py` — `_cs_prob()`, `_compute_xpts_fixture()`, xPts component computation
- `pipeline/run.py` — pipeline output files and save() pattern
- `src/app/api/players/route.ts` — thin Blob reader pattern with backtest join
- `.planning/PROJECT.md` — v1.6 decisions log, established invariants
