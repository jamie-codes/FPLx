# Phase 129: Squad Cost Simulator - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 129 delivers an interactive budget slider in NextSeasonPlannerTab that drives an in-browser greedy squad recompute — no server round-trip per tick. Three interlocking pieces:

1. **`?include=inputs` API extension (COST-02)** — `/api/pre-season-squad?include=inputs` response gains an `inputs` field (`players`, `scoreMap`, `budget_default`) alongside the existing `squad`, `health`, and `solver` fields. Inputs are computed inline for all resolution paths (ILP and greedy) when the query param is present.

2. **Budget slider + useDeferredValue (COST-01)** — `<input type="range" min=80 max=120 step=0.5>` (£m values) inside `NextSeasonPlannerTab`. Slider visual position updates on every tick via a `sliderValue` state; the formation grid re-renders only on commit (pointer release or 300ms after keyboard) via a `committedBudget` state wrapped in `useDeferredValue`. Slider state is scoped to `NextSeasonPlannerTab` (not lifted to page.tsx).

3. **Infeasibility messaging (COST-03)** — When `buildPreSeasonSquad()` returns null at the committed budget, an inline message appears above the formation grid; the grid continues to show the last valid committed squad. The slider track renders amber below `health.min_feasible_budget_greedy` via CSS `linear-gradient`.

</domain>

<decisions>
## Implementation Decisions

### inputs Artifact Path

- **D-01:** Route reads archive + bootstrap in parallel when `?include=inputs` query param is present — applies to ALL resolution paths (ILP pre-computed and greedy fallback). In Resolution 2 this is free (archive+bootstrap already read); in Resolution 1 it adds parallel reads alongside `pre_season_squad.json`.
- **D-02:** `?include=inputs` is a **query param gate** — when absent, the route skips archive+bootstrap reads and returns the existing `{ squad, health, solver }` envelope unchanged. Existing callers (usePreSeasonSquad without inputs) are unaffected.
- **D-03:** `scoreMap` serialises as **`Record<string, number>`** in the inputs JSON — `Object.fromEntries(scoreMap)` on the route side; restored client-side with `new Map(Object.entries(inputs.scoreMap).map(([k, v]) => [Number(k), v]))`.
- **D-04:** `inputs` shape:
  ```ts
  interface PreSeasonSquadInputs {
    players: PreSeasonPlayer[]        // full eligible player pool
    scoreMap: Record<string, number>  // player id (string) → ppm score
    budget_default: number            // 1000 (= £100m in FPL tenths-of-million)
  }
  ```
  `PreSeasonSquadResponse` gains an optional `inputs?: PreSeasonSquadInputs` field (absent when `?include=inputs` is not set).

### Slider Initialization

- **D-05:** Slider thumb initialises at **£100m (budget = 1000)** always — matches ROADMAP `default £100m` spec. Does not mirror `squad.budgetUsed`.
- **D-06:** On first load (before the user has dragged), the formation grid shows **the API squad** (`data.squad` — ILP or greedy from the server). The grid switches to client greedy result only after the first pointer release / keyboard commit.

### Infeasibility Display

- **D-07:** When `buildPreSeasonSquad(players, scoreMap, committedBudget)` returns null, the **formation grid stays visible** showing the last valid committed squad; the infeasibility message renders above it (not a replacement).
- **D-08:** Message when `health.min_feasible_budget_greedy` is **non-null**: `"No squad possible at £X.Xm — try £Y.Ym+"` where X = chosen budget and Y = `health.min_feasible_budget_greedy`.
- **D-09:** Message when `health` is **null** (pre-Phase 127 pipeline): `"No squad possible at £X.Xm"` — no suggestion suffix.

### Amber Track Technique

- **D-10:** Slider track uses **CSS `linear-gradient` as an inline style** on the native `<input type="range">`. Threshold % = `(min_feasible_budget_greedy - 80) / (120 - 80) * 100`. Applied dynamically whenever health data changes.
- **D-11:** When `health` is **null** (no `min_feasible_budget_greedy`): single-colour neutral zinc track — no amber zone. Slider is still interactive.

### Claude's Discretion

- Exact CSS values: amber zone = `#f59e0b` (amber-500), neutral zone = Tailwind zinc matching existing pill style; webkit/moz `-webkit-slider-runnable-track` CSS for cross-browser range styling
- `useDeferredValue` wiring: separate `sliderValue` (every tick) and `committedBudget` (pointer release / 300ms keyboard debounce) states; `deferredBudget = useDeferredValue(committedBudget)` drives `buildPreSeasonSquad`; formation grid renders from `deferredBudget`
- Whether slider component is extracted to a named subcomponent or kept inline in `NextSeasonPlannerTab`
- `usePreSeasonSquad` staleTime when `?include=inputs` is passed (suggest 6h, same as current)
- Whether to create a separate `usePreSeasonSquadWithInputs` hook or pass the query param inline

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### API Route
- `src/app/api/pre-season-squad/route.ts` — existing route; extend with `?include=inputs` query param gate + parallel archive+bootstrap reads in Resolution 1; inline inputs computation (D-01–D-04)

### TypeScript Types
- `src/lib/types.ts` — add `PreSeasonSquadInputs` interface; extend `PreSeasonSquadResponse` with optional `inputs?` field (D-04)
- `src/lib/pre-season-squad.ts` — `buildPreSeasonSquad(players, scoreMap, budget, teamCap)` — client-side recompute entrypoint; already accepts variable `budget` param

### Frontend Hook
- `src/lib/hooks/usePreSeasonSquad.ts` — update or extend to pass `?include=inputs`; current staleTime pattern to preserve

### Frontend Component
- `src/components/next-season/NextSeasonPlannerTab.tsx` — slider integration point; useDeferredValue wiring; infeasibility message + amber track (D-05–D-11)

### Requirements
- `.planning/REQUIREMENTS.md` §COST-01, COST-02, COST-03 — locked requirements for this phase

### Prior Phase Context (carry-forwards)
- `.planning/phases/127-squad-health-diagnostics-transfer-watchlist/127-CONTEXT.md` — D-05 (inputs envelope pre-agreed for Phase 129); D-08 (`PreSeasonSquadResponse` shape with optional `inputs`)
- `.planning/phases/128-pre-season-auto-activation/128-CONTEXT.md` — `suggest_squad.py` force=True pattern (upstream dependency)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `buildPreSeasonSquad(players, scoreMap, budget, teamCap)` in `src/lib/pre-season-squad.ts` — already accepts variable `budget`; ready for client-side recompute at any £m value. Returns `PreSeasonSquad | null`.
- `readBlobOrLocal()` in `src/app/api/pre-season-squad/route.ts` — reuse for the additional archive+bootstrap reads in Resolution 1 when `?include=inputs`
- `usePreSeasonSquad` staleTime pattern (6h) — preserve for the inputs-extended hook

### Established Patterns
- **Route query param branching**: `const url = new URL(request.url); const includeInputs = url.searchParams.get('include') === 'inputs'` — standard Next.js route pattern; `request` is already available in the GET handler
- **useDeferredValue pattern**: maintain two states (`sliderValue` for visual, `committedBudget` for logic); `onInput` updates `sliderValue`; `onPointerUp` + keyboard `setTimeout(300)` updates `committedBudget`; `useDeferredValue(committedBudget)` feeds the greedy recompute
- **LocalStorage exclusion**: slider state is in-memory only (local `useState`) — not persisted, not lifted to page.tsx, no localStorage
- **Infeasibility null from greedy**: `buildPreSeasonSquad` already returns `null` — the component needs a `lastValidSquad` ref or state to hold the previous commit's squad when null is returned

### Integration Points
- `src/app/api/pre-season-squad/route.ts` — add `include=inputs` branch inside existing GET handler; inputs computed from existing archive+bootstrap parse code (extract shared helper)
- `src/lib/types.ts` — `PreSeasonSquadInputs` interface + `inputs?` field on `PreSeasonSquadResponse`
- `src/lib/hooks/usePreSeasonSquad.ts` — extend queryKey with `['pre-season-squad', 'with-inputs']` when inputs are needed; or pass `include` param
- `src/components/next-season/NextSeasonPlannerTab.tsx` — add slider above formation grid; wire `committedBudget` → `buildPreSeasonSquad` → squad display; infeasibility message above `FormationGrid`; CSS gradient on range input

</code_context>

<specifics>
## Specific Ideas

- Slider range: `min="80" max="120" step="0.5"` (£m units); internal budget value = slider value × 10 (FPL tenths)
- Infeasibility message text: `"No squad possible at £X.Xm — try £Y.Ym+"` (D-08) / `"No squad possible at £X.Xm"` (D-09)
- Amber gradient: `background: \`linear-gradient(to right, #f59e0b 0%, #f59e0b ${threshold}%, #71717a ${threshold}%, #71717a 100%)\``
- Threshold %: `((minFeasible - 80) / 40) * 100` where `minFeasible = health.min_feasible_budget_greedy`
- `lastValidSquad` state: initialised from `data.squad` on first load; updated to client greedy result on each non-null commit

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 129-Squad Cost Simulator*
*Context gathered: 2026-05-20*
