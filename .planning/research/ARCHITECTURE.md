# Architecture Research — v1.25 Pre-Season Intelligence

**Domain:** FPL Analyst — subsequent milestone extending v1.24's Next Season Planner with: pipeline auto-activation when next-season data lands (AUTO-01), transfer target watchlist (WATCH-01/04), interactive budget slider re-running greedy (COST-01), and null-rate instrumentation for `buildPreSeasonSquad()` (GREEDY-NULL).

**Researched:** 2026-05-19
**Confidence:** HIGH — derived from direct inspection of `pipeline/run.py` (lines 144–522), `pipeline/suggest_squad.py`, `pipeline/archive_season.py`, `pipeline/upload.py`, `src/lib/pre-season-squad.ts`, `src/app/api/pre-season-squad/route.ts`, `src/lib/hooks/usePreSeasonSquad.ts`, `src/components/next-season/NextSeasonPlannerTab.tsx`, `src/components/gem-table/GemTable.tsx`, `src/app/page.tsx`, `src/lib/regret.ts` (ring-buffer pattern), `src/lib/manual-plan.ts` (simple-JSON pattern).

---

## Architectural Premise

v1.25 is a **content + UI iteration on top of v1.24**, not a new architectural layer. Every feature reuses one of three established patterns:

| Pattern | Established by | Reused by |
|---------|----------------|-----------|
| Pipeline writes JSON to Blob → API route reads → TanStack Query hook caches → component renders | All prior milestones | AUTO-01 |
| `localStorage` simple-JSON state lifted into `page.tsx` via lazy `useState` initialiser | manual-plan.ts (v1.9), `fpl_team_id`, `gemPreset` (v1.5) | WATCH-01/04 |
| Pure TypeScript builder taking a parameter, called via TanStack Query with debounced input | `optimiseLineup()` (v1.6), `buildPreSeasonSquad()` (v1.24) | COST-01 |
| Pipeline writes counter + API surfaces it in response payload | accuracy_backtest.json mc_enabled flag (v1.19) | GREEDY-NULL |

**Critical correction to milestone context (`COST-01`):** The brief states "Budget slider triggers re-call to /api/pre-season-squad (which calls suggest_squad.py --budget)." This is incorrect on two counts:

1. `suggest_squad.py` does **not** accept a `--budget` argument; it is invoked in-process from `run.py` as `suggest_squad(bootstrap, archive)` with a hardcoded `BUDGET = 1000`.
2. There is **no** Python invocation from the Next.js layer in this codebase (`grep -r child_process|exec|spawn src/` → zero matches), and Vercel serverless functions cannot run PuLP at request time (no CBC solver binary).

Therefore COST-01 **must use the TS greedy `buildPreSeasonSquad()`** which already accepts `budget` as a parameter (line 22, `pipeline/cache/pre-season-squad.ts`). The greedy is fast (<5 ms for 700 players × 15-slot fill loop), making client-side or per-request recompute viable without Python.

---

## AUTO-01 — Pipeline Auto-Activation on Next-Season Data

### Architectural Decision: New Flag Artifact + Pipeline-Side Detection

**Recommendation:** Write a new `pre_season_active.json` flag to Blob. UI reads this flag (not the bootstrap event list) to decide whether to render the empty state or the populated planner. Detection lives in `run.py`.

**Rationale:**
- The UI already consumes bootstrap indirectly via `/api/players` (which uses `merged_players.json`). In IS_OFF_SEASON the merge step is skipped, so the UI can't trust merged_players for next-season detection.
- Centralising detection in the pipeline keeps the off-season detection logic on a single source of truth (`run.py` already owns IS_OFF_SEASON at lines 148, 200–203). A flag artifact mirrors v1.18's `mc_enabled` flag in accuracy_backtest.json (`Key Decisions` table, PROJECT.md line 451) — a battle-tested pattern.
- Daily cron is the existing cadence; no new scheduling needed.

### Detection Algorithm

Inside `run.py` immediately after `IS_OFF_SEASON = not any(e.get('is_current') for e in events)` (line 148), add a sibling detection:

```python
# AUTO-01: Pre-season activation detected when bootstrap publishes next-season
# events (38 fresh GW entries, none finished, none current, GW1 deadline_time
# in the future).
PRE_SEASON_ACTIVE = (
    IS_OFF_SEASON
    and len(events) >= 38
    and not any(e.get('finished') for e in events)
    and bool(events[0].get('deadline_time'))
)
```

The three conjuncts are independent fail-safes against bootstrap edge states (mid-season BGWs with no `is_current`, partial event lists, etc.). They mirror the same defence-in-depth that WIN-03's IS_OFF_SEASON detection uses.

### Activation Side-Effects (within the existing GW38 gate vs new pre-season gate)

The GW38 gate at lines 205–236 of `run.py` runs `archive_season.py` and `suggest_squad.py` once at end-of-season. AUTO-01 adds a **second, separate gate** that runs in subsequent pre-season cron runs after fresh bootstrap arrives:

```python
if PRE_SEASON_ACTIVE:
    # Re-run suggest_squad with FRESH bootstrap (new now_cost values).
    # Archive remains the GW38 snapshot; ppm scoring unchanged but
    # cost basis re-aligned.
    from suggest_squad import suggest_squad
    archive = _load_archive_via_existing_path()
    if archive is not None:
        suggest_squad(bootstrap, archive)  # idempotency check already inside
    # Build fixture difficulty matrix for GW1-8 once fixtures published.
    # This populates the deferred GW1-8-FIXTURES feature in NextSeasonPlannerTab.
    # (see GW1-8 heatmap section below.)
```

**Idempotency caveat:** `suggest_squad` currently has an idempotency gate (lines 263–278 of `suggest_squad.py`) that skips if `pre_season_squad.json` exists. v1.25 must **remove this gate** or invert it for pre-season re-runs, since the entire point of AUTO-01 is that bootstrap now has fresh `now_cost` values that the GW38 snapshot's stale prices won't match. Alternative: write `pre_season_squad_v2.json` (versioned by detection round) and prefer it in the API route.

### Flag Artifact Schema

```json
{
  "pre_season_active": true,
  "detected_at": "2026-06-15T03:00:00Z",
  "season": "2026/27",
  "first_deadline_time": "2026-08-15T17:30:00Z",
  "fixtures_published": true,
  "bootstrap_player_count": 643
}
```

`fixtures_published` is independent: bootstrap can lag fixtures or vice versa. The heatmap deferred case in `NextSeasonPlannerTab.tsx` line 118 (`nextSeasonFixtures: unknown[] = []`) gates on this field.

### UI Response When Flag Flips

`NextSeasonPlannerTab` should fan-out one new hook (`usePreSeasonActive`) and combine it with `usePreSeasonSquad`:

| `pre_season_active` | `usePreSeasonSquad` data | UI state |
|---------------------|--------------------------|----------|
| missing (404) | null | "Prices pending" empty state (current v1.24 behaviour preserved) |
| true | null | "Pre-season detected — generating squad" loading-style state |
| true | populated | Fresh squad render with budget slider unlocked (COST-01) |

The fan-out is two separate hooks because TanStack Query memoises each query independently and we want the flag to invalidate the squad query when it flips.

### New Files

- `src/app/api/pre-season-active/route.ts` — Reads `pre_season_active.json` from Blob (mirrors `/api/pre-season-squad/route.ts:14-32 readBlobOrLocal`).
- `src/lib/hooks/usePreSeasonActive.ts` — TanStack Query hook, 6h staleTime, 404 → `{ pre_season_active: false }` (silent default — distinguish "flag absent" from "flag false").
- `pipeline/cache/pre_season_active.json` — local cache seed (mirrors how `insights.json` is seeded at `[]` per PROJECT.md `Phase 33`).

### Modified Files

- `pipeline/run.py` — Add `PRE_SEASON_ACTIVE` detection block after line 148; add pre-season re-run block (callable from outside the IS_GW38 branch); write `pre_season_active.json` via `save()`.
- `pipeline/suggest_squad.py` — Make idempotency optional via a `force=False` parameter (default off, called with `force=True` from the AUTO-01 path).
- `src/components/next-season/NextSeasonPlannerTab.tsx` — Combine `usePreSeasonActive` + `usePreSeasonSquad`; remove the unconditional "deferred" branch at lines 118–135 once fixtures land.

### Data Flow

```
GitHub Actions cron (daily)
  └─→ run.py loads bootstrap
        ├─→ IS_OFF_SEASON=True, PRE_SEASON_ACTIVE=False: existing v1.24 behaviour
        ├─→ IS_OFF_SEASON=True, PRE_SEASON_ACTIVE=True:
        │     ├─→ save('pre_season_active.json', { pre_season_active: true, ... })
        │     ├─→ suggest_squad(bootstrap, archive, force=True) → overwrites pre_season_squad.json
        │     └─→ (deferred: fixtures matrix for GW1-8 heatmap)
        └─→ in-season: PRE_SEASON_ACTIVE always False
              ↓
Vercel Blob:
  pre_season_active.json (new)
  pre_season_squad.json (refreshed on pre-season runs)
        ↓
Next.js: /api/pre-season-active (new), /api/pre-season-squad (existing)
        ↓
TanStack Query: usePreSeasonActive, usePreSeasonSquad
        ↓
NextSeasonPlannerTab: render gate on active flag, then on squad data
```

### Integration Points

- New: `usePreSeasonActive` hook, `/api/pre-season-active` route.
- Modified: `NextSeasonPlannerTab` render logic (gate on flag); `run.py` detection + re-run block; `suggest_squad.py` idempotency parameter.
- Reused: `readBlobOrLocal` helper pattern (copy from `/api/pre-season-squad/route.ts:14-32` into `/api/pre-season-active/route.ts` — DO NOT extract into shared util this milestone; only two callers).

---

## WATCH-01 / WATCH-04 — Transfer Target Watchlist

### Architectural Decision: localStorage Map + Dedicated Hook + GemTable Expand-Row Action

**Recommendation:** Store watchlist as `Set<number>` (player IDs) in localStorage under a single key. Expose it through a dedicated `useWatchlist()` hook that reads on mount, writes on every mutation, and exposes `{ ids: Set<number>, add, remove, toggle, isWatching }`. Wire the toggle into GemTable expand rows alongside the existing Compare action and into a new `WatchlistTab` for the curated view.

**Rationale:**
- Existing localStorage patterns split into two families:
  - **Ring buffer** (`src/lib/regret.ts:108-127`, key `decisionHistory:teamId:{id}`): 38-entry capped, write-on-every-change, hooks read-once-on-mount.
  - **Simple JSON** (`src/lib/manual-plan.ts:5 MANUAL_PLAN_KEY`, key `fplx_manual_plan`): single object, lazy `useState` initialiser, save-on-update.
  - Watchlist fits the simple-JSON family (small, single-user, no growth pressure — typical user pins 5–20 players).
- Hook-encapsulated mutation is consistent with how `loadManualPlan` is read once in `page.tsx:158` then mutated through tab-local handlers.
- GemTable's expand-row pattern (lines 317–440) already accommodates per-player actions (Compare in mobile sheet at lines 329–354, Confirmed-Signing badge at lines 396–400). Watchlist toggle slots into the same row, mirroring the action-cluster grammar.

### Why a Hook, Not Lifted page.tsx State

Watchlist is consumed by **multiple disconnected components** simultaneously: `GemTable` rows (toggle), `NextSeasonPlannerTab` (display in new section), `WatchlistTab` (Plan-section sub-tab, dedicated view), and potentially `TransferPanel` (highlight rows already on watchlist). Lifting to `page.tsx` and prop-drilling through five trees is the pattern that ROADMAP D-07 was created to *escape*. A hook backed by localStorage avoids the prop-drill — each consumer just calls `useWatchlist()` and gets a fresh `Set<number>`.

**Subscription concern:** localStorage does not natively notify cross-component. Use either (a) a small `subscribe`/`getSnapshot` pattern via `useSyncExternalStore` (React 19 native), or (b) a single React context provider near the root. Recommendation: `useSyncExternalStore` — zero new dependencies, idiomatic, and React 19 mature (this codebase is already on React 19 per PROJECT.md line 202).

### Watchlist Schema (localStorage value)

```json
{
  "version": 1,
  "ids": [123, 456, 789],
  "added": {
    "123": "2026-05-20T10:00:00Z"
  }
}
```

`added[id]` is the timestamp the player was pinned, used for "Added 3 days ago" sort/display in the watchlist tab. `version` follows the manual-plan.ts pattern for forward-compat.

**Key:** `fplx_watchlist` (no teamId suffix — watchlist is global/personal, not team-scoped, unlike ring-buffer regret).

### GemTable Integration

Insert a watchlist toggle button into both mobile and desktop expand rows. In the mobile action sheet block (lines 329–354), add a third button:

```tsx
<button
  type="button"
  onClick={(e) => {
    e.stopPropagation()
    toggleWatchlist(row.original.id)
  }}
  className="text-xs ..."
  aria-pressed={isWatching(row.original.id)}
>
  {isWatching(row.original.id) ? 'Watching' : 'Watch'}
</button>
```

In the desktop expand row (lines 404–437), append after the Confirmed-Signing badge slot. Use a star icon or pill toggle visually distinct from existing zinc badges.

### WatchlistTab (WATCH-04 — curated view)

New component `src/components/watchlist/WatchlistTab.tsx` mounted as a sub-tab in the Plan section (next to `next-season`). For each watched player it displays:

- `web_name`, team, position, `now_cost` (live from `usePlayers`)
- Price trend (uses existing `PriceTrendCell` from v1.0)
- Ownership % (`selected_by_percent` field already on `MergedPlayer`)
- News badge (existing `NewsBanner` component, gate on staleness per v1.21 NEWS-01)
- Squad overlap indicator: "In your squad" badge if `submittedId` resolves to `useSquad` containing this player ID
- Date added (relative time via `formatRelativeTime`)
- Remove button (×)

**State source:** `usePlayers()` joined with `useWatchlist()` ids on player ID. No new API route. No new pipeline step.

### New Files

- `src/lib/watchlist.ts` — Pure module: `loadWatchlist`, `persistWatchlist`, schema types (mirrors `regret.ts` pure-module convention).
- `src/lib/hooks/useWatchlist.ts` — `useSyncExternalStore` wrapper exposing `{ ids, add, remove, toggle, isWatching, addedAt }`.
- `src/components/watchlist/WatchlistTab.tsx` — Curated view with table of watched players.
- `src/components/watchlist/WatchlistTab.test.tsx` — RTL tests (empty state, populated state, remove action).

### Modified Files

- `src/components/gem-table/GemTable.tsx` — Add `useWatchlist()` call near other hooks (~line 200); insert toggle button in mobile expand row block (lines 329–354) and desktop expand row (lines 404–437).
- `src/components/next-season/NextSeasonPlannerTab.tsx` — Optional WATCH-04 v2: surface watchlist players overlay on the formation grid (e.g. "5 of your watchlist appear in this squad").
- `src/app/page.tsx` — Add `'watchlist' as SubTab` to the union at line 59; add to Plan section subTabs at line 88; add render block at the bottom of the Plan-section conditional cluster.

### Data Flow

```
User clicks "Watch" on a GemTable row
  ↓
useWatchlist.toggle(id) → setState in module-level store → persistWatchlist() → localStorage.setItem
  ↓
useSyncExternalStore broadcasts to all subscribers
  ├─→ GemTable row re-renders with "Watching" label
  ├─→ WatchlistTab re-renders with new entry
  └─→ NextSeasonPlannerTab overlay re-renders (if mounted)
```

### Integration Points

- New: `src/lib/watchlist.ts`, `useWatchlist` hook, `WatchlistTab`, `'watchlist'` SubTab.
- Modified: `GemTable.tsx` expand rows (3 lines added per mobile + desktop branch), `page.tsx` SubTab union + Plan section subTabs array + render block.
- Reused: `PriceTrendCell`, `NewsBanner`, `formatRelativeTime`, `usePlayers`, `useSquad`. **Zero new API routes. Zero new pipeline steps.**

---

## COST-01 — Squad Cost Simulator (Budget Slider)

### Architectural Decision: Client-Side Greedy Recompute, Debounced Slider with Commit-on-Release

**Recommendation:** Re-call `buildPreSeasonSquad()` **in the browser** (not via API) on every committed budget value. Use a slider that emits a `commit` event (mouseup / touchend / pointerup) — not on every drag tick — and additionally debounce by 300ms to absorb keyboard arrow-key spamming. Do NOT hammer `/api/pre-season-squad`.

**Rationale:**
- `buildPreSeasonSquad()` (`src/lib/pre-season-squad.ts`) is a pure synchronous TS function with no IO. Profiling baseline: filter → sort 700 players → 15-slot fill loop completes in well under 5 ms (sort dominates at O(n log n)). Running this in the browser is **strictly better** than a round-trip to Vercel.
- The current `/api/pre-season-squad/route.ts` is needed only for the **initial** archive + bootstrap fetch (it loads `season_archive_gw38.json` + `fpl_bootstrap.json` from Blob and builds `players[] + scoreMap`). After that initial fetch, the slider operates entirely on the in-memory `{ players, scoreMap, budget }` triple.
- The milestone-context claim that COST-01 calls `suggest_squad.py --budget` is structurally infeasible — no CLI flag exists, no child_process bridge exists, no PuLP solver is available in Vercel runtime. Greedy is the only realistic path.

### Refactor Required: Surface `players[]` and `scoreMap` From the API

The current `/api/pre-season-squad/route.ts` builds `players` and `scoreMap` internally (lines 88–123) and discards them, returning only the resolved `PreSeasonSquad`. For COST-01 the API must additionally return these inputs so the client can re-run the builder.

**Option A (recommended):** Add a `?include=inputs` query param that augments the response:

```json
{
  "squad": { "starters": [...], "bench": [...], "formation": "...", "budgetUsed": 980 },
  "inputs": {
    "players": [{ "id": 123, "web_name": "...", ... }, ...],   // PreSeasonPlayer[]
    "scoreMap": [[123, 0.124], [456, 0.098], ...],              // [id, ppm] tuples (Map-compat)
    "budget_default": 1000
  }
}
```

The serialisation overhead is bounded: ~700 players × ~80 bytes = ~56 KB gzipped → ~12 KB. Acceptable.

**Option B (alternative):** Two endpoints — `/api/pre-season-squad/inputs` returns players + scoreMap once; `/api/pre-season-squad` returns the prebuilt squad. The hook fans out both, caches inputs at 6h staleTime, and the slider rebuilds locally. Slightly more elegant but adds a route.

Recommendation: Option A — keep one route, gate by query param. Mirrors `/api/players` patterns where the same artifact is exposed with optional augmentation flags.

### Hook Modification

```ts
// usePreSeasonSquad.ts (extended)
export function usePreSeasonSquad(opts?: { includeInputs?: boolean }) {
  return useQuery<PreSeasonSquadResponse | null>({
    queryKey: ['pre-season-squad', { includeInputs: !!opts?.includeInputs }],
    queryFn: async () => {
      const url = opts?.includeInputs
        ? '/api/pre-season-squad?include=inputs'
        : '/api/pre-season-squad'
      const res = await fetch(url)
      if (res.status === 404) return null
      if (!res.ok) throw new Error('Failed to fetch pre-season squad')
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000,
  })
}
```

`NextSeasonPlannerTab` calls `usePreSeasonSquad({ includeInputs: true })`.

### Budget Slider Component

New component `src/components/next-season/BudgetSlider.tsx`:

- Range: 80m to 120m, step 0.5m, default 100m (mirrors `BUDGET = 1000` in `suggest_squad.py:36`, in tenths-of-£1m).
- Native `<input type="range">` for accessibility (no third-party slider lib needed).
- Local state `value`, separate `committedValue`. On `onPointerUp` / `onChange` (debounced 300 ms), set `committedValue`.
- Parent (`NextSeasonPlannerTab`) calls `buildPreSeasonSquad(players, scoreMap, committedValue * 10, 3)` and re-renders the FormationGrid with the new result.

### Debounce + Commit-on-Release Hybrid

```ts
const [draftBudget, setDraftBudget] = useState(100)
const [committedBudget, setCommittedBudget] = useState(100)

// Debounced commit on keyboard arrow-key drag
useEffect(() => {
  const id = setTimeout(() => setCommittedBudget(draftBudget), 300)
  return () => clearTimeout(id)
}, [draftBudget])

// Immediate commit on pointer release (no wait for debounce)
const handlePointerUp = () => setCommittedBudget(draftBudget)
```

This pattern is standard for budget/range inputs (Stripe, Mapbox, etc.) and avoids the recompute-on-every-pixel cost.

### Null-Return Surfacing (links to GREEDY-NULL)

If `buildPreSeasonSquad(players, scoreMap, lowBudget, 3)` returns `null` at, say, £85m, the UI must show "Infeasible at this budget — try £88m+" rather than silently falling back to the prior render. The infeasibility message connects to GREEDY-NULL (next section): we surface the null case here, and we measure how often it happens there.

### New Files

- `src/components/next-season/BudgetSlider.tsx` — Range input + debounce + commit-on-release.
- `src/components/next-season/BudgetSlider.test.tsx`.

### Modified Files

- `src/app/api/pre-season-squad/route.ts` — Accept `?include=inputs` query param; serialise `players` + `scoreMap` as tuples when set; otherwise unchanged for backward compat.
- `src/lib/hooks/usePreSeasonSquad.ts` — Accept `{ includeInputs }` option; return `PreSeasonSquadResponse` (squad + optional inputs).
- `src/components/next-season/NextSeasonPlannerTab.tsx` — Add `useState<number>` for budget, render `BudgetSlider`, call `buildPreSeasonSquad(inputs.players, inputs.scoreMap, budget * 10)` via `useMemo` keyed on `[budget, inputs]`; render infeasibility message when result is null.
- `src/lib/types.ts` — Add `PreSeasonSquadResponse` type.

### Data Flow

```
User opens "Next Season" sub-tab
  ↓
usePreSeasonSquad({ includeInputs: true }) → fetch '/api/pre-season-squad?include=inputs'
  ↓
Vercel route reads pre_season_squad.json (resolved squad) + season_archive_gw38.json + fpl_bootstrap.json
  ↓
Returns { squad, inputs: { players, scoreMap, budget_default } }
  ↓
React state: budget=100, draftBudget=100, committedBudget=100
  ↓
User drags slider from 100 → 95
  ├─→ draftBudget = 95 (every tick)
  └─→ pointerUp: committedBudget = 95
        ↓
useMemo recomputes buildPreSeasonSquad(players, scoreMap, 950, 3)
  ↓
FormationGrid re-renders with new £95m squad (or "Infeasible — try higher budget")
```

### Integration Points

- New: `BudgetSlider` component, `?include=inputs` query path.
- Modified: API route response shape, hook signature, `NextSeasonPlannerTab` rendering.
- Reused: `buildPreSeasonSquad()` (no engine change), Blob read pattern.

---

## GREEDY-NULL — Instrumentation for `buildPreSeasonSquad()` Null Rate

### Architectural Decision: Pipeline-Side Null Counter + API Surfacing + UI Indicator

**Recommendation:** Measure null rate **in the pipeline** by running `buildPreSeasonSquad()`'s logic (port to Python, or run a synthetic budget sweep against the ILP for cross-check) across a range of budgets and write `pre_season_squad_health.json` with the empirical null rate. Surface via the existing `/api/pre-season-squad` response. UI flags the rate in a small health indicator near the budget slider.

**Wait — split this measurement into two questions:**

1. **What is the absolute null rate** for the TS greedy at a given budget? — Static across pipeline runs (function is deterministic for fixed inputs). Compute once per pipeline run.
2. **How often does the user hit null** with their slider? — Dynamic, per-session. Measured client-side and could be logged or just displayed inline.

For the milestone, (1) is the actionable answer — it tells us whether to keep the greedy or fall back to ILP. (2) is value-add but not strictly required.

### Where to Surface (Decision: API Response, Not Component-Local State)

The milestone-context question asks: "Where to surface the null rate — NextSeasonPlannerTab or /api/pre-season-squad response?"

**Answer: API response.** Rationale:

- Source of truth for greedy health is the algorithm output across a budget sweep — that computation belongs in the data layer (pipeline or API route at build time), not the component (which would have to re-run the sweep on every mount).
- API response gives every consumer (current `NextSeasonPlannerTab`, future tabs, debug surfaces) the same number.
- Mirrors the v1.18 `mc_enabled` and v1.19 `calibration_mode` flag patterns — health metadata travels with the artifact.

### Pipeline Instrumentation Strategy

Add `pipeline/squad_health.py` that:

1. Loads `season_archive_gw38.json` + `fpl_bootstrap.json` once (reusing the same helpers as `suggest_squad.py`).
2. Builds `players[] + scoreMap` exactly as the API route does.
3. Sweeps budgets in tenths of £1m from 800 → 1200 (i.e. £80m → £120m, step £0.5m, 81 points).
4. For each budget, calls a Python port of `buildPreSeasonSquad` logic (or alternatively re-runs the PuLP ILP with that budget) and records `{ budget, greedy_null: bool, ilp_feasible: bool, greedy_score: number|null, ilp_score: number|null }`.
5. Writes `pre_season_squad_health.json` with the full sweep + summary stats:

```json
{
  "version": 1,
  "computed_at": "2026-05-19T...",
  "sweep": [
    { "budget": 800, "greedy_null": true, "ilp_feasible": false },
    { "budget": 950, "greedy_null": true, "ilp_feasible": true, "ilp_score": 0.118 },
    { "budget": 1000, "greedy_null": false, "greedy_score": 0.121, "ilp_feasible": true, "ilp_score": 0.124 }
  ],
  "summary": {
    "greedy_null_rate": 0.21,
    "greedy_optimality_gap_avg": 0.018,
    "min_feasible_budget_greedy": 950,
    "min_feasible_budget_ilp": 880
  }
}
```

This gives a complete map of the greedy's failure mode AND its sub-optimality vs the ILP gold standard — far more actionable than a single null rate.

### Alternative: Port Greedy to Python vs. Run Greedy via subprocess

The TS greedy logic must execute somewhere in the pipeline run. Two options:

- **Port `buildPreSeasonSquad` to Python.** ~40 lines, mechanical translation. Pros: pure Python, no Node dep, fast. Cons: two implementations to keep in sync.
- **Run the existing TS via `node -e ...` from `run.py`.** Pros: single source of truth. Cons: requires Node binary in GitHub Actions runner (it's there for npm install), adds subprocess management, fragile.

Recommendation: **port to Python**. The greedy logic is ~40 lines and unlikely to change frequently. Add a unit test that confirms Python output matches TS output for a fixed seed of players/scoreMap to keep them in lock-step.

### API Surfacing

Extend `/api/pre-season-squad` to also read `pre_season_squad_health.json` (mirroring how the existing route reads multiple Blob files) and include in response:

```json
{
  "squad": { ... },
  "inputs": { ... },          // COST-01
  "health": {                  // GREEDY-NULL
    "greedy_null_rate": 0.21,
    "min_feasible_budget_greedy": 950,
    "min_feasible_budget_ilp": 880,
    "current_budget_feasible": true
  }
}
```

`current_budget_feasible` is dynamic per-request when the route knows the budget (future enhancement); for v1.25 it can mirror "is the resolved squad non-null".

### UI Surfacing

In `NextSeasonPlannerTab`, near the `BudgetSlider`, render a small zinc-text indicator:

```tsx
{health.greedy_null_rate > 0.1 && (
  <p className="text-xs text-zinc-500 dark:text-zinc-400">
    Greedy infeasible {Math.round(health.greedy_null_rate * 100)}% of budget range;
    minimum viable budget £{(health.min_feasible_budget_greedy / 10).toFixed(1)}m.
  </p>
)}
```

When the user hits a null (slider in the infeasible zone), upgrade the message to red:

```tsx
{squadForBudget === null && (
  <p className="text-sm text-red-600">
    No valid squad at £{budget}m. Try £{(health.min_feasible_budget_greedy / 10).toFixed(1)}m+.
  </p>
)}
```

This closes the loop with COST-01: the slider doesn't just fail silently — it tells the user where to move.

### New Files

- `pipeline/squad_health.py` — Greedy port + budget sweep + JSON write.
- `pipeline/tests/test_squad_health.py` — Confirm Python port matches TS output for a fixed seed.
- `src/components/next-season/SquadHealthIndicator.tsx` — Tiny presentational component for the indicator text.

### Modified Files

- `pipeline/run.py` — Call `squad_health.compute_squad_health(bootstrap, archive)` inside the same GW38 / pre-season gate that already calls `suggest_squad` (line 213 ff).
- `src/app/api/pre-season-squad/route.ts` — Read `pre_season_squad_health.json` and include `health` in the response.
- `src/lib/hooks/usePreSeasonSquad.ts` — Response type extension.
- `src/components/next-season/NextSeasonPlannerTab.tsx` — Render `SquadHealthIndicator` below the `BudgetSlider`; switch infeasibility message based on `health.min_feasible_budget_greedy`.
- `src/lib/types.ts` — `PreSeasonSquadHealth` type.

### Data Flow

```
Pipeline (cron, off-season / pre-season):
  squad_health.compute_squad_health()
    → for budget in 800..1200 step 5:
         result = greedy_py(players, scoreMap, budget)
         ilp_result = (optional cross-check via PuLP)
       sweep.append({ budget, greedy_null: result is None, ilp_feasible: ... })
    → save('pre_season_squad_health.json', { sweep, summary })

API:
  /api/pre-season-squad reads pre_season_squad.json + season_archive + bootstrap + pre_season_squad_health.json
  → returns { squad, inputs, health }

UI:
  NextSeasonPlannerTab renders BudgetSlider + SquadHealthIndicator(health)
  When slider in infeasible zone: red error with recommended budget from health.min_feasible_budget_greedy
```

### Integration Points

- New: `pipeline/squad_health.py`, `pre_season_squad_health.json` artifact, `SquadHealthIndicator` component.
- Modified: `run.py` (one call), API route (one Blob read + one response field), `NextSeasonPlannerTab` (one component render), hook + types.
- Reused: existing Blob read pattern, existing PuLP ILP for cross-check (if used).

---

## Cross-Feature Architectural Concerns

### Schema Versioning

All new artifacts (`pre_season_active.json`, `pre_season_squad_health.json`) should include a top-level `version: 1` field. This mirrors `manual-plan.ts:60 version: 1` and gives forward-compat headroom if schemas evolve in v1.26+.

### Test Strategy

- AUTO-01: pytest cases in `pipeline/tests/test_run.py` mocking bootstrap with various event-list states (in-season, off-season, pre-season). Verify exactly which flag combinations trigger which side-effects.
- WATCH-01/04: vitest cases for `loadWatchlist`/`persistWatchlist` (round-trip, corrupt-JSON, version-mismatch fallback); RTL test for GemTable toggle propagating to WatchlistTab through useSyncExternalStore.
- COST-01: vitest case for `buildPreSeasonSquad` at multiple budgets (already tested in v1.24 phase 126); RTL test for slider debounce + commit-on-release.
- GREEDY-NULL: pytest cross-check `greedy_py(players, scoreMap, B) == buildPreSeasonSquad(players, scoreMap, B)` for fixed seed.

### Cache Invalidation

When `pre_season_active.json` flips from false → true, the pre-season squad query (cached for 6h via TanStack Query) must be invalidated so the UI shows the freshly-generated squad. Two options:

- Have `usePreSeasonActive` call `queryClient.invalidateQueries(['pre-season-squad'])` in an effect when its `pre_season_active` field flips true.
- Tie cache keys: `useQuery({ queryKey: ['pre-season-squad', preSeasonActive] })` — when the flag value changes, the key changes, and TanStack auto-refetches.

Recommendation: option 2 (cache key tie). Less imperative, idiomatic TanStack.

### Off-Season vs Pre-Season vs In-Season State Matrix

| State | IS_OFF_SEASON | PRE_SEASON_ACTIVE | UI behaviour |
|-------|---------------|-------------------|--------------|
| In-season (GW1–37) | False | False | All v1.24 in-season tabs active; Next Season tab shows "Available after GW38" |
| GW38 | False | False | One-shot archive + suggest_squad runs; Next Season tab shows fresh squad |
| Off-season pre-pre-season (June–early July) | True | False | Most tabs degraded; Next Season tab shows GW38 squad with "Prices pending" note |
| Pre-season active (mid-July–early August) | True | True | Next Season tab shows refreshed squad + GW1-8 heatmap + budget slider unlocked |
| GW1 deadline passes | False | False | IS_OFF_SEASON flips false; PRE_SEASON_ACTIVE flips false; back to in-season |

Every feature must work in every state. AUTO-01 owns the off-season → pre-season transition. WATCH-01/04 works in all states. COST-01 only unlocks when squad data exists (current 200 vs 404 distinction preserved). GREEDY-NULL surfaces only when the health artifact exists (graceful absence in early off-season).

---

## Build Order

### Critical Dependency Chain

```
GREEDY-NULL (pipeline + API instrumentation)
   │
   ├─→ AUTO-01 (uses same pipeline structure for pre_season_active.json detection)
   │       │
   │       └─→ COST-01 (depends on API response surfacing inputs + health, both touched by GREEDY-NULL)
   │
   └─→ (parallel) WATCH-01/04 (independent — no pipeline touch, no API touch)
```

### Why GREEDY-NULL First

1. It touches `/api/pre-season-squad/route.ts` (adds health field) and `usePreSeasonSquad` hook (response type) — the **same files** COST-01 needs to extend. Doing it first means COST-01 builds on a stable response shape.
2. It validates the greedy algorithm before COST-01 trusts it for slider-driven recompute. If GREEDY-NULL reveals the greedy is null at >40% of common budget values, the COST-01 design must add ILP fallback (a much bigger change). Measuring first de-risks COST-01.
3. The Python port and ILP cross-check are isolated changes that don't require any UI plumbing — easy to ship in one phase.

### Why AUTO-01 Second

1. AUTO-01 establishes the `pre_season_active` flag that gates the pre-season UI flow. COST-01 only makes sense when pre-season is active and a fresh squad exists. So AUTO-01 must land before COST-01's slider becomes visible.
2. AUTO-01's pipeline changes (re-running `suggest_squad` after IS_GW38) are independent of COST-01's API/UI changes.
3. AUTO-01 reveals whether the fixtures matrix is available (drives the deferred GW1-8 heatmap section). Without AUTO-01 the slider operates on the GW38 snapshot's stale `now_cost`, which defeats the purpose of an interactive cost simulator.

### Why COST-01 Third

1. Depends on GREEDY-NULL's response shape and AUTO-01's freshness signal.
2. Adds the slider, the input augmentation, and the infeasibility messaging that completes the user-facing pre-season planner experience.
3. The TS greedy is already in production — no new algorithm risk.

### Why WATCH-01/04 in Parallel (can ship anywhere in the order)

1. Zero coupling to pre-season pipeline. Zero coupling to the squad API route. Pure localStorage + GemTable expand-row addition + new tab.
2. Can be developed and shipped before, during, or after the AUTO-01/COST-01/GREEDY-NULL chain without conflict.
3. Recommend slotting it as Phase 1 (alongside GREEDY-NULL) for early visible UI value while the deeper pipeline work proceeds.

### Recommended Phase Sequence

| Phase | Feature(s) | Rationale |
|-------|------------|-----------|
| **Phase 127** | GREEDY-NULL + WATCH-01/04 (parallel) | GREEDY-NULL de-risks the squad pipeline; WATCH delivers visible UX wins independent of pipeline. Both are small, scoped, no API contract conflict (WATCH touches no API). |
| **Phase 128** | AUTO-01 | Pipeline-heavy; establishes `pre_season_active.json` flag + suggest_squad re-run path; unlocks pre-season state transitions. Cannot ship before GREEDY-NULL because they share `suggest_squad.py` idempotency-gate refactor. |
| **Phase 129** | COST-01 | Depends on both prior phases (response shape from GREEDY-NULL, freshness from AUTO-01). Ships the budget slider + infeasibility messaging + final user-facing pre-season planner experience. |

If aggressive parallelism is desired, GREEDY-NULL and AUTO-01 can run side-by-side as long as the file-level edits to `run.py` and `suggest_squad.py` are coordinated (e.g. AUTO-01 owner adds the `force` parameter to `suggest_squad`, GREEDY-NULL owner adds the sweep call alongside it).

### Test Suite Integration

Each phase should land with full vitest + pytest green. The v1.24 baseline (1466/1500 GREEN per PROJECT.md) must not regress. Watch specifically for:

- `pipeline/tests/test_run.py` mock fixtures need updating when AUTO-01 adds the pre-season detection block (existing mocks assume two-branch is_off_season).
- `src/app/api/pre-season-squad/route.ts` existing tests need updating when GREEDY-NULL adds `health` field and COST-01 adds `inputs` field.

---

## Summary of New vs Modified Files

### New (10 files)
- `src/app/api/pre-season-active/route.ts`
- `src/lib/hooks/usePreSeasonActive.ts`
- `src/lib/watchlist.ts`
- `src/lib/hooks/useWatchlist.ts`
- `src/components/watchlist/WatchlistTab.tsx` (+ `.test.tsx`)
- `src/components/next-season/BudgetSlider.tsx` (+ `.test.tsx`)
- `src/components/next-season/SquadHealthIndicator.tsx`
- `pipeline/squad_health.py` (+ `tests/test_squad_health.py`)
- `pipeline/cache/pre_season_active.json` (seed file)
- `pipeline/cache/pre_season_squad_health.json` (seed file)

### Modified (8 files)
- `pipeline/run.py` — Add PRE_SEASON_ACTIVE detection block; add pre-season re-run block calling `suggest_squad(force=True)`; add `squad_health.compute_squad_health()` call.
- `pipeline/suggest_squad.py` — Add `force=False` parameter to bypass idempotency gate.
- `src/app/api/pre-season-squad/route.ts` — Accept `?include=inputs`; read `pre_season_squad_health.json`; extend response with `inputs` + `health` fields.
- `src/lib/hooks/usePreSeasonSquad.ts` — Accept `{ includeInputs }`; response type covers new fields.
- `src/lib/types.ts` — Add `PreSeasonSquadResponse`, `PreSeasonSquadHealth`, `PreSeasonActiveFlag`, `Watchlist` types.
- `src/components/next-season/NextSeasonPlannerTab.tsx` — Combine `usePreSeasonActive` + `usePreSeasonSquad`; render `BudgetSlider` + `SquadHealthIndicator`; budget-driven recompute via `useMemo` + `buildPreSeasonSquad`; infeasibility messaging.
- `src/components/gem-table/GemTable.tsx` — Add `useWatchlist()` call; insert toggle button in mobile expand row (lines 329–354) and desktop expand row (lines 404–437).
- `src/app/page.tsx` — Add `'watchlist'` to SubTab union (line 59); add to Plan section subTabs (line 88); add render block in conditional cluster.

### Untouched (notable)
- `src/lib/pre-season-squad.ts` (the greedy itself) — algorithm is unchanged across v1.25; only its harness and instrumentation evolve.
- `pipeline/archive_season.py` — runs once at GW38; v1.25 doesn't re-run it.
- All in-season pipeline modules (`merge.py`, `accuracy.py`, `simulate.py`, etc.) — pre-season work is fully isolated.
