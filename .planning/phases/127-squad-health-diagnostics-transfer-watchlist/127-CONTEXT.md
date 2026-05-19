# Phase 127: Squad Health Diagnostics & Transfer Watchlist - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 127 delivers two independent but related features:

1. **Squad Health Diagnostics (GREEDY-01/02/03)** — `pipeline/squad_health.py` sweeps budgets £80m–£120m in £0.5m steps (81 greedy builds) to compute `greedy_null_rate` and `min_feasible_budget_greedy`; writes `pre_season_squad_health.json` to Vercel Blob. `/api/pre-season-squad` response evolves to a `{ squad, health, solver }` envelope. `NextSeasonPlannerTab` gains a health indicator below the formation grid and a Greedy/ILP solver badge on the grid.

2. **Transfer Target Watchlist (WATCH-01/02/03/04)** — `useWatchlist()` hook + `localStorage['fplx_watchlist']` (array of player IDs). Star button (action row) added as first element in GemTable expand rows (mobile + desktop). New "Watchlist" sub-tab in the Plan section after "Next Season". `WatchlistPlayerCard` bespoke 2-col mobile / 3-col desktop grid with price trend, ownership%, 48h news amber border (via `useLineupNews()`), squad-overlap dot (via `usePreSeasonSquad()`), and Departed pill.

**No overlap with Phase 128 (auto-activation) or Phase 129 (budget slider)** — the API envelope shape and `health.min_feasible_budget_greedy` introduced here are consumed by those phases without further refactor.

</domain>

<decisions>
## Implementation Decisions

### Squad Health Pipeline (squad_health.py)

- **D-01:** Budget sweep range: £80m–£120m in £0.5m steps = 81 builds. Budget values are FPL cost units (×10): 800 to 1200 inclusive, step 5. Sweep calls the Python equivalent of `buildPreSeasonSquad()` from `src/lib/pre-season-squad.ts` — re-implement inline in `squad_health.py` (do not import from TypeScript).
- **D-02:** `greedy_optimality_gap_avg` is present in the `SquadHealth` type and in `pre_season_squad_health.json` but set to `null` for Phase 127. ILP comparison deferred — no compute cost.
- **D-03:** Player pool source: `fpl_bootstrap.json` (Vercel Blob or `pipeline/cache/fpl_bootstrap.json` locally). Same resolution pattern as `suggest_squad.py`. `squad_health.py` runs **after** `suggest_squad.py` in `pipeline/run.py`.
- **D-04:** No env var gate. `squad_health.py` always runs (greedy sweep is lightweight — 81 calls, no ILP). Guarded by the same IS_OFF_SEASON block as `suggest_squad.py` in `run.py`.

### API Response Shape (/api/pre-season-squad)

- **D-05:** Route response evolves from flat `PreSeasonSquad` to a named envelope:
  ```ts
  interface PreSeasonSquadResponse {
    squad: PreSeasonSquad | null  // null when archive absent
    health: SquadHealth | null    // null until pipeline runs squad_health.py
    solver: 'ilp' | 'greedy' | null  // null when squad is null
  }
  ```
  Phase 129 adds `inputs` to this envelope — no further breaking change needed.
- **D-06:** `health` is a **side-read**: route always attempts `readBlobOrLocal('pre_season_squad_health.json')` and attaches the parsed result to the envelope. Falls back to `null` silently if the file doesn't exist (pre-Phase 127 cache).
- **D-07:** `solver` is inferred from resolution path inside the route — **not** stored in `pre_season_squad.json`:
  - Resolution 1 (pre_season_squad.json exists) → `solver: 'ilp'`
  - Resolution 2 (raw archive + greedy fallback) → `solver: 'greedy'`
  - 404/503 (no squad available) → `solver: null`
- **D-08:** `usePreSeasonSquad` updated: return type changes to `PreSeasonSquadResponse | null`. All existing consumers updated: `NextSeasonPlannerTab` reads `data?.squad`, health indicator reads `data?.health`, solver badge reads `data?.solver`.

### Watchlist Data & Components

- **D-09:** `localStorage['fplx_watchlist']` stores `JSON.stringify(number[])` — a plain array of player element IDs. No timestamp, no metadata. Departed detection: ID in watchlist but not found in `/api/players` response → render "Departed" pill.
- **D-10:** `useWatchlist()` hook manages `watchlistIds: number[]` and `toggleWatchlist(id: number)`. State lives at `page.tsx` level (same pattern as `planHorizon`, `submittedId`). `watchlistIds` and `toggleWatchlist` passed as props to `GemTable` and `WatchlistTab`.
- **D-11:** `WatchlistTab` calls **three** data hooks: `usePlayers()` (for player enrichment), `useLineupNews()` (for 48h amber border), `usePreSeasonSquad()` (for squad-overlap dot). All three are already stale-cached — no additional API calls on tab switch.
- **D-12:** Squad-overlap dot: compare pinned player IDs against IDs in `data?.squad?.starters` + `data?.squad?.bench`. If `data?.squad` is null (archive not ready), overlap dots never render — graceful degradation.
- **D-13:** 48h amber border: for each pinned player, check `lineup_news` entries where `player_id` matches and `news_added` is within 48h of current time. If any entry matches → apply `border-amber-400 dark:border-amber-500` to the card border.
- **D-14:** Bespoke `WatchlistPlayerCard` component — does **not** reuse `PriceTrendCell` or `NewsBanner` (those are table-cell components with fixed widths). Card is self-contained with: player name, position badge, price + inline trend arrow (▲/▼ from `cost_change_event`), ownership %, news amber border, overlap dot, Departed pill. Card is marked inactive/muted when departed.

### GemTable Star Action Row

- **D-15:** New **action row** added as the **first child** of both mobile and desktop expand rows, before the existing rejection panel / insight section / ConfirmedSigningBadge content.
- **D-16:** Star button text: `⭐ Pin to watchlist` (unpinned) / `⭐ Pinned` (pinned, amber text). Text button style — not icon-only. Consistent with `ComparisonSearch` text-button pattern in the same row area.
- **D-17:** `toggleWatchlist(player.id)` called on click. No confirmation, no toast — immediate toggle. Pinned state reflected instantly via `watchlistIds` prop from page.tsx.

### Claude's Discretion
- Exact stale time for `useWatchlist` re-reads from localStorage (suggest initialising on mount; no polling — localStorage is synchronous)
- Whether `WatchlistTab` sorts cards by position order or alphabetical (suggest position order: GK → DEF → MID → FWD, matching the squad grid convention)
- TDD test scope for `WatchlistPlayerCard` (suggest: render tests for each visual state — departed, amber border, overlap dot, normal)
- Exact `SquadHealth` TypeScript interface field names and types (align with `pre_season_squad_health.json` Python output)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pre-Season Squad (Phase 126 Infrastructure)
- `src/app/api/pre-season-squad/route.ts` — existing route; extended with health side-read, solver inference, and envelope response shape (D-05–D-07)
- `src/lib/hooks/usePreSeasonSquad.ts` — updated return type to `PreSeasonSquadResponse | null` (D-08)
- `src/lib/pre-season-squad.ts` — TypeScript greedy builder; Python equivalent re-implemented in `squad_health.py` (D-01)
- `src/components/next-season/NextSeasonPlannerTab.tsx` — extended with health indicator and solver badge; reads `data?.squad` after envelope change (D-08)
- `src/lib/types.ts` — new types: `SquadHealth`, `PreSeasonSquadResponse`; existing `PreSeasonSquad` unchanged

### Pipeline
- `pipeline/suggest_squad.py` — ILP squad builder; `squad_health.py` runs after it in `run.py` (D-03, D-04)
- `pipeline/run.py` — wiring point for `squad_health.py` inside IS_OFF_SEASON block

### Watchlist
- `src/app/page.tsx` — SubTab union extended with `'watchlist'`; SECTIONS Plan array extended; `useWatchlist` state + props (D-10); localStorage key pattern reference at lines 141–149
- `src/components/gem-table/GemTable.tsx` — expand-row action cluster added (D-15–D-17); `watchlistIds` and `toggleWatchlist` props added
- `src/lib/hooks/useLineupNews.ts` (or equivalent) — 48h news check for amber border (D-11, D-13)

### Existing Hooks to Mirror
- `src/lib/hooks/usePreSeasonSquad.ts` — hook pattern (TanStack Query, staleTime, 404→null)
- `src/components/planner/ManualPlanTab.tsx` — localStorage read/write pattern (`fplx_manual_plan`, lazy initialiser)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `buildPreSeasonSquad()` in `src/lib/pre-season-squad.ts` — TypeScript greedy builder; `squad_health.py` reimplements this logic in Python with the same constraints (MIN_SLOTS, MAX_SLOTS, teamCap=3, budget guard)
- `readBlobOrLocal()` in `src/app/api/pre-season-squad/route.ts` — existing helper function; reuse directly for the health file side-read (D-06)
- `useLineupNews()` hook — already exists from Phase 123; returns lineup news array used for NewsBanner; reuse for 48h check in WatchlistTab (D-11)
- `usePreSeasonSquad()` — after Phase 127 update, returns `PreSeasonSquadResponse | null`; consumed by both `NextSeasonPlannerTab` and `WatchlistTab`

### Established Patterns
- **Resolution order in routes**: try Blob file → fallback → 404. `route.ts` already uses this; health side-read adds a parallel read, not a new resolution step.
- **LocalStorage pattern**: `ManualPlanTab` uses lazy useState initialiser `() => loadManualPlan()`. `useWatchlist` should follow the same pattern: initialise from localStorage on mount, write on every toggle.
- **Props from page.tsx**: `planHorizon`, `submittedId` set in page.tsx and passed down as props. `watchlistIds` + `toggleWatchlist` follow the same flow.
- **Expand row structure**: GemTable has parallel mobile (`hidden sm:hidden` / visible on mobile) and desktop (`hidden sm:table-row`) expand rows. Action row must be added to BOTH (D-15).
- **Sub-tab nav**: `SubTab` union type + `SECTIONS` constant in `page.tsx` line 59 and Plan section array (line ~88). Add `{ id: 'watchlist', label: 'Watchlist', mobileLabel: 'Watchlist' }` after `next-season`.

### Integration Points
- `pipeline/run.py` IS_OFF_SEASON block — wire `squad_health.py` call after `suggest_squad.py`, before `archive_season.py` (to ensure health data exists before archive completes)
- `page.tsx` SubTab union — add `'watchlist'` type
- `page.tsx` Plan section SECTIONS — add Watchlist sub-tab entry
- `page.tsx` render block — add `WatchlistTab` conditional render for `activeSubTab === 'watchlist'`
- `GemTable.tsx` expand rows — add action row as first child of both mobile and desktop expand bodies

</code_context>

<specifics>
## Specific Ideas

- Health indicator text: "Greedy success rate: X% across £80m–£120m budget sweep. Min feasible budget: £Y.Ym." Below the formation grid in NextSeasonPlannerTab.
- Solver badge: small pill inline with the formation headline row. "Greedy" (zinc) vs "ILP" (teal/green). Same size as existing status pills.
- Star button text: `⭐ Pin to watchlist` / `⭐ Pinned` with `text-amber-500` when pinned.
- Watchlist empty state: "No players pinned yet. Tap ⭐ on any player in Gem Ratings to add them here."
- `localStorage['fplx_watchlist']` — consistent with existing `fplx_` key prefix used in the codebase.

</specifics>

<deferred>
## Deferred Ideas

- `greedy_optimality_gap_avg` computation (ILP comparison at sampled budget points) — deferred beyond Phase 127; field present in schema as `null`
- Sort order options for WatchlistTab (alphabetical, by price, by xPts) — deferred; position order is the default
- Watchlist sharing / export — out of scope (personal tool, no multi-user)
- Pinned-at timestamp in localStorage — deferred; plain ID array sufficient for Phase 127

</deferred>

---

*Phase: 127-Squad Health Diagnostics & Transfer Watchlist*
*Context gathered: 2026-05-19*
