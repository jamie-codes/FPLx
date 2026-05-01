# Technology Stack — v1.7 Decision Assistant

**Project:** FPL Analyst
**Researched:** 2026-05-01
**Confidence:** HIGH
**Scope:** NEW additions for v1.7 Decision Assistant ONLY.

Existing validated stack (do not re-add): `next@16.2.1`, `react@19.2.4`, `@tanstack/react-query@^5.95.2`, `@tanstack/react-table@^8.21.3`, `@vercel/blob@^2.3.1`, `zod@^4.3.6`, `immer@^11.1.4`, `use-immer@^0.11.0`, `tailwindcss@^4`, `vitest@^4.1.2`; Python: `requests>=2.32.0`, `pandas>=2.2.0`, `numpy>=2.2.0`, `scipy>=1.14.0`, `vercel-blob>=0.4.0`, `python-dotenv>=1.0.0`, `soccerdata==1.8.8`

---

## Executive Finding: Zero New Dependencies

**No new npm packages. No new Python packages.**

Every v1.7 feature is implementable using the existing stack. The evidence is in the codebase:

| v1.7 Feature | Existing foundation that covers it |
|---|---|
| Transfer Opportunity Cost Simulator | `suggestTransfers()` already enumerates Roll/1-FT/2-FT. Multi-horizon comparison is a new calling convention over existing data. |
| Weekly Decision Summary | Aggregation of existing TanStack Query hooks. Pure layout work. |
| Fixture Swing Detector | `attacking_difficulty` / `defensive_difficulty` already in every `FixtureEntry`. Need a new sort/delta function over existing data. |
| Player Lifecycle Labels | `regression_signal`, `differential_flag`, `mins_risk`, `xPts_components_1gw` all already on `MergedPlayer`. Need a new classification function. |
| Explainable xPts Breakdown | `xPts_components_1gw: {goal_pts, assist_pts, cs_pts, bonus_pts}` already computed by pipeline and typed in `MergedPlayer`. Need a panel component. |
| Clean Sheet Probability | `_cs_prob()` already runs per-fixture in pipeline. Need to surface `cs_prob` into JSON; existing `FixtureEntry` or new per-team JSON artifact. |

---

## Feature-by-Feature Stack Analysis

### 1. Transfer Opportunity Cost Simulator

**What:** Compare Roll / 1-FT / 2-FT / Hit across 1 / 3 / 5 GW horizons side-by-side for the manager's current squad.

**Existing:** `suggestTransfers()` in `src/lib/suggest-transfers.ts` already enumerates all (sell, buy) pairs per position, applies budget filter, computes `xPtsGain`, `cost`, and `breakEvenGws`. It handles `ftCount: 1 | 2` and returns sorted results.

**What is new:** A simulator that calls `suggestTransfers()` three times (horizons 1, 3, 5) and computes the Roll scenario (do nothing, carry forward FTs). The Roll value is `0` additional xPts gain. The comparison table is plain TypeScript + JSX.

**Approach:** New pure-TS function `computeOpportunityCost(params)` that wraps `suggestTransfers()` for each horizon and returns a structured comparison object. No new library.

**Pattern to follow:** Mirrors the existing `HORIZON_FIELD` map pattern and the `suggestTransfers()` calling convention already in use by `OptimiserPanel`.

---

### 2. Weekly Decision Summary

**What:** One-screen aggregated view: captain rec, transfer rec, bench order, chip timing, risks, opportunities.

**Existing:** All underlying data already flows through existing hooks (`useCaptainPicks`, `useMyTeam`, `usePlayers`, `useInsights`, the chip-strategy engine). This is a composition/layout feature.

**Approach:** New `DecisionSummaryPanel` component that imports existing hooks and renders their outputs in a unified card layout. No new data fetching, no new computation engine, no new library.

**Note:** `useImmer` is available for any complex local state (existing dep). No additional state library needed.

---

### 3. Fixture Swing Detector

**What:** Surface teams with materially improving or worsening upcoming fixture sequences as proactive buy/sell signals.

**Existing:** Every `FixtureEntry` already carries `attacking_difficulty` (float, 0=easy, 1=hard) and `defensive_difficulty`. `ClubForm` aggregates `attacking_ease_1gw`, `attacking_ease_3gw`, `attacking_ease_5gw` per team in `computeClubForm()`. This is the raw material.

**What is new:** A function `computeFixtureSwing(teams: ClubForm[])` that compares short-horizon ease vs long-horizon ease for each team and flags directional movement: `improving` when `attacking_ease_1gw` significantly above `attacking_ease_5gw`, `worsening` when below. Threshold is a constant (e.g. `SWING_THRESHOLD = 0.15` on the 0–1 scale).

**Approach:** Pure-TS function in `src/lib/fixture-swing.ts`, unit-tested with Vitest. Consumes `ClubForm[]` already available via `useClubForm()`. No pipeline changes needed; all input data already published to `merged_players.json` / `club_form`.

**Why no pipeline change:** `attacking_ease_Xgw` values are already emitted. The swing detection is a client-side derived computation, like `computeClubForm()` itself.

---

### 4. Player Lifecycle Labels

**What:** Richer timing advice labels per player — Buy next week, Hold one more, Sell soon, Minutes trap, Fixture trap, etc.

**Existing:** `regression_signal` ('buy'|'sell'), `differential_flag` ('diff'|'trap'), `mins_risk` ('nailed'|'likely_start'|'rotation_risk'|'cameo'|'injured'), and fixture difficulty are all already on `MergedPlayer`. `xPts_components_1gw` provides CS component for fixture quality.

**What is new:** A `classifyPlayerLifecycle(player: MergedPlayer, fixtures: FixtureEntry[])` pure function that combines these signals into a single `LifecycleLabel` type. The label set needs definition; the signal inputs already exist.

**Approach:** Pure-TS function in `src/lib/lifecycle.ts`. Returns a discriminated union or string literal union. Unit-tested with Vitest. No new data, no new pipeline artifact, no library.

**Minutes trap and Fixture trap** use existing `mins_risk` and per-fixture `attacking_difficulty` respectively — no new data fields needed.

---

### 5. Explainable xPts Breakdown

**What:** Component breakdown panel/tooltip showing appearance + goals + assists + CS + bonus + minutes risk contribution to any player's projected score.

**Existing:**
- `xPts_components_1gw?: {goal_pts, assist_pts, cs_pts, bonus_pts}` already on `MergedPlayer`
- `XPtsCell` in `src/components/gem-table/columns.tsx` already renders a native `title` tooltip showing these components for the 1 GW window
- The tooltip format is already established: "Goals: X.XX\nAssists: X.XX\nClean sheet: X.XX\nBonus: X.XX"

**What is new:** A richer panel (not just a native title tooltip) that can show all three horizon windows (1/3/5 GW), include a `minutes_risk` row, and present the data in a readable card layout. The 3GW/5GW horizons currently do NOT have component breakdown in the pipeline — `_xpts_ngw()` only returns components for the first GW.

**Pipeline change needed:** Extend `_xpts_ngw()` or add a separate `_compute_xpts_components_ngw()` that sums per-component across all fixtures in the N-GW window and emits `xPts_components_3gw` and `xPts_components_5gw` alongside the existing `xPts_components_1gw`. This is pure arithmetic — no new Python dependency.

**UI approach:** New `XPtsBreakdownPanel` component. Uses the existing native `title` pattern for simple cells (no Radix, no Floating UI, no Popper — the project explicitly avoids tooltip libraries). For the richer panel presentation, use a CSS `:hover` / `focus-within` expand pattern or a `<details>/<summary>` element — both are zero-dependency.

**Why no tooltip library:**
- The existing codebase comment in `VarianceBadge.tsx` states: "Native `title` tooltip is the project pattern (no Radix / no custom Tooltip primitive)."
- For a richer panel, `<details>`/`<summary>` or a `group-hover:` Tailwind pattern avoids adding a library for a single use case.
- Accessibility: native `title` is sufficient for a personal tool; not a public product.

---

### 6. Clean Sheet Probability

**What:** Per-fixture CS% for all teams, computed from xGA, improving defensive/GK picks.

**Existing:** `_cs_prob(defensive_difficulty, xmins)` in `pipeline/merge.py` already computes per-fixture CS probability using the formula `0.40 - defensive_difficulty * 0.30`, clamped to [0.10, 0.65], then scaled by minutes factor. This is invoked inside `_compute_xpts_fixture()` but its output is not separately surfaced to JSON.

**What is new:** Surface `cs_prob` per fixture per player into the merged player data, and/or emit a separate per-team CS probability summary (next 1/3/5 GW average) as a new JSON artifact.

**Two options:**

Option A — Add `cs_prob_1gw` / `cs_prob_3gw` / `cs_prob_5gw` floats directly to each `MergedPlayer` in the pipeline. Enables per-player CS% sorting in GemTable. Zero cost: the `_cs_prob` function already runs for every player/fixture pair during xPts computation — it's a single additional dict key assignment.

Option B — Emit a per-team `team_cs_probs.json` artifact (20 teams × next 5 fixtures) as a separate endpoint. Cleaner separation of concerns for a Fixture Swing / CS panel that shows per-team rather than per-player data.

**Recommendation: Option A first, Option B if a dedicated CS panel is added.** Option A requires zero pipeline refactoring — just capture the output already computed and assign it to the player dict. Option B is a separate pipeline module.

**Python change:** One or two additional `player['cs_prob_1gw'] = ...` assignments inside the existing `merge_players()` loop, using the same `_cs_prob()` call that already runs. No new Python package.

---

## New npm Dependencies

**None.**

| Considered | Verdict | Reason |
|---|---|---|
| `@radix-ui/react-tooltip` | Rejected | Project pattern is native `title`. Single personal tool. Adds ~8KB gzip for no UX gain over `<details>` expand. |
| `recharts` / `victory` / `nivo` | Rejected | No charting requirement in v1.7 features. Horizon comparison is a table, not a chart. |
| `@floating-ui/react` | Rejected | Same as Radix tooltip — overkill for this use case. |
| `date-fns` / `dayjs` | Rejected | Relative time formatting already done by `formatRelativeTime.ts`. No new date math needed. |
| `clsx` / `classnames` | Rejected | Tailwind v4 with template literals already handles conditional classes across the codebase. |

---

## New Python Dependencies

**None.**

| Considered | Verdict | Reason |
|---|---|---|
| `statsmodels` | Rejected | All statistical modelling (Poisson xPts, Bernoulli CS) already done with `numpy`/`scipy` in `merge.py`. No regression model needed for v1.7. |
| `scikit-learn` | Rejected | No ML model needed. Lifecycle labels and swing detection are rule-based. |

---

## Pipeline Changes (Python, no new packages)

| Change | File | Cost | Purpose |
|---|---|---|---|
| Surface `cs_prob_1gw`, `cs_prob_3gw`, `cs_prob_5gw` per player | `pipeline/merge.py` | ~5 lines in existing merge loop | Clean Sheet Probability feature |
| Emit per-component breakdown for 3GW and 5GW windows | `pipeline/merge.py` | ~20 lines extending `_xpts_ngw()` | Explainable xPts Breakdown (3/5 GW panels) |
| (Optional) `team_cs_probs.json` artifact | New `pipeline/cs_probs.py` | ~60 lines, new module | Per-team CS% panel if built separately |

All changes use existing `_cs_prob()` and `_compute_xpts_fixture()` functions — no new algorithm, no new dependency.

---

## New TypeScript Source Files (no new packages)

| File | Purpose |
|---|---|
| `src/lib/opportunity-cost.ts` | `computeOpportunityCost()` — wraps `suggestTransfers()` across all horizons for simulator |
| `src/lib/fixture-swing.ts` | `computeFixtureSwing()` — swing direction from existing `ClubForm` ease fields |
| `src/lib/lifecycle.ts` | `classifyPlayerLifecycle()` — combines existing signals into a label union |
| `src/components/optimiser/XPtsBreakdownPanel.tsx` | Rich xPts component panel (replaces inline `title` tooltip for detail view) |
| `src/components/squad/DecisionSummaryPanel.tsx` | Aggregated weekly decision view |
| `src/components/fixtures/FixtureSwingPanel.tsx` | Improving/worsening fixture trend display |

Each file follows the existing pattern: pure functions in `src/lib/`, React components in `src/components/`, corresponding `.test.ts` / `.test.tsx` in place.

---

## New TanStack Query Hooks

All hooks follow the existing pattern in `src/lib/hooks/` (6h staleTime, typed return, no manual caching):

| Hook | Data Source | New endpoint needed? |
|---|---|---|
| `useDecisionSummary()` | Composes `usePlayers` + `useCaptainPicks` + `useMyTeam` — no new fetch | No |
| `useClubCsProbs()` | `team_cs_probs.json` via `/api/cs-probs` | Yes, if Option B chosen |

If CS% data is added directly to `MergedPlayer` (Option A), `usePlayers()` already covers it — no new hook.

---

## Type Extensions (src/lib/types.ts)

New fields to add to existing interfaces — no new types file:

```typescript
// On MergedPlayer — Clean Sheet Probability (Option A)
cs_prob_1gw?: number        // per-fixture average CS probability, 1 GW window
cs_prob_3gw?: number        // 3 GW window average
cs_prob_5gw?: number        // 5 GW window average

// On MergedPlayer — Extended xPts breakdown
xPts_components_3gw?: { goal_pts: number; assist_pts: number; cs_pts: number; bonus_pts: number } | null
xPts_components_5gw?: { goal_pts: number; assist_pts: number; cs_pts: number; bonus_pts: number } | null

// New standalone types
export type LifecycleLabel =
  | 'buy-now'
  | 'buy-next-week'
  | 'hold'
  | 'sell-soon'
  | 'minutes-trap'
  | 'fixture-trap'
  | 'differential'
  | 'transfer-target'

export type SwingDirection = 'improving' | 'worsening' | 'stable'
export interface FixtureSwing {
  team_id: number
  team_short_name: string
  direction: SwingDirection
  attacking_ease_delta: number   // ease_1gw - ease_5gw; positive = improving short-term
  defensive_ease_delta: number
}
```

All `?` (optional) fields follow the existing `xPts_components_1gw?` convention — absent before pipeline runs, no breakage to existing consumers.

---

## What NOT to Add

| Item | Reason |
|---|---|
| Any tooltip/popover library (Radix, Floating UI, Headless UI) | Project explicitly uses native `title` attribute. A `<details>` expand covers the richer panel case. Single personal tool — accessibility cost of `title` is acceptable. |
| Any charting library (recharts, victory, nivo, chart.js) | Horizon comparison is a comparison table. CS% is displayed as a numeric column. No chart needed. |
| `react-hot-toast` or notification library | No new async operations that need toast feedback. |
| Server-side computation for simulator | Transfer opportunity cost is fast client-side (<5ms for all horizon combinations using existing engine). No API route needed. |
| Separate `/api/opportunity-cost` route | Simulator inputs are per-manager (squad, bank, FTs) — they must be computed client-side from data already fetched by `usePlayers` and `useMyTeam`. |
| `lodash` or `ramda` | All array manipulation uses native TypeScript. No functional utility library needed. |
| `zod` schema changes | New pipeline fields are optional additions; existing Zod schemas use `safeParse` with stale-cache fallback — new optional fields pass through without schema changes. |

---

## Integration Summary

```
pipeline/merge.py (modified — no new imports)
├── _cs_prob() already runs per player/fixture — add cs_prob_1gw output
├── _xpts_ngw() extended — emit xPts_components_3gw / xPts_components_5gw
└── upload.py — no changes (existing merged_players.json covers all new fields)

src/lib/ (new pure-TS files, no new npm packages)
├── opportunity-cost.ts   — calls suggestTransfers() × 3 horizons
├── fixture-swing.ts      — derives swing direction from ClubForm data
└── lifecycle.ts          — classifies player lifecycle from existing MergedPlayer fields

src/components/ (new React components, no new npm packages)
├── DecisionSummaryPanel  — composes existing hook outputs
├── XPtsBreakdownPanel    — renders xPts_components_{1,3,5}gw
├── FixtureSwingPanel     — renders fixture swing signals
└── [inline CS% in existing FixtureBadges or GemTable column]

src/lib/types.ts
└── New optional fields on MergedPlayer + new LifecycleLabel / SwingDirection types
```

---

## Confirmed Package Versions (no changes from v1.6)

All versions are inherited from the validated v1.6 stack. No version upgrades required for v1.7.

| Package | Current version | v1.7 needs upgrade? |
|---|---|---|
| next | 16.2.1 | No |
| react | 19.2.4 | No |
| @tanstack/react-query | ^5.95.2 | No |
| @tanstack/react-table | ^8.21.3 | No |
| immer / use-immer | ^11.1.4 / ^0.11.0 | No |
| tailwindcss | ^4 | No |
| vitest | ^4.1.2 | No |
| scipy (Python) | >=1.14.0 | No |

---

*Stack research for: FPL Analyst v1.7 Decision Assistant*
*Researched: 2026-05-01*
