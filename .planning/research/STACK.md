# Stack Research — v1.25 Pre-Season Intelligence

**Domain:** FPL Analyst v1.25 — AUTO-01 next-season auto-activation, WATCH-01/04 Transfer Target Watchlist, COST-01 Squad Cost Simulator, GREEDY-NULL null-rate instrumentation
**Researched:** 2026-05-19
**Confidence:** HIGH — grounded in direct file inspection (`package.json`, `pipeline/requirements.txt`, `pipeline/run.py`, `pipeline/suggest_squad.py`, `src/lib/pre-season-squad.ts`, `src/lib/hooks/*`, `src/components/next-season/NextSeasonPlannerTab.tsx`, `.github/workflows/pipeline.yml`) + targeted web verification of React 19 patterns and FPL pre-season timing

---

## Bottom Line Up Front

**Zero new runtime dependencies are required.** All four v1.25 features are built from existing primitives already validated in v1.24 and earlier:

- **AUTO-01** — extend the existing `IS_OFF_SEASON` gate in `pipeline/run.py` (line 148) by adding a per-poll detection step that diffs the `events[]` shape between runs. The existing 4×-daily GitHub Actions cron (`.github/workflows/pipeline.yml` line 14) already covers the polling cadence required. No new scheduling, no new HTTP client, no new persistence layer. Detection signal is written to a small `next_season_state.json` artifact in Vercel Blob.
- **WATCH-01/04** — pure client feature on top of the existing localStorage pattern (`fplx_*` keyspace; same idiom as `fplx_manual_plan`, `fplx_mini_league_id`). Uses existing TanStack Query data (`/api/players`, `useTransferNews`, `usePreSeasonSquad`) joined client-side. No new dependencies.
- **COST-01** — debounce-free, network-free re-run of the existing pure-TS `buildPreSeasonSquad()` on slider change. React 19's built-in **`useDeferredValue`** is the correct primitive here (no debounce library needed). When `buildPreSeasonSquad()` returns `null` and ILP fallback is needed, the slider triggers a one-shot `POST /api/pre-season-squad?budget=N` (existing API extended with query param) — TanStack Query handles caching by budget key.
- **GREEDY-NULL** — pure instrumentation on `buildPreSeasonSquad()`. Add an optional out-parameter (or paired `diagnoseBuildPreSeasonSquad()` companion) that returns reason codes. No telemetry library; reasons surface in the UI via a small expandable diagnostics panel. Vitest already covers this code path.

**The single new Python dependency** that *might* be added is `tenacity` (retry/backoff for the off-season detection HTTP call), but the existing `requests` library + the simple try/except wrapper already used across the pipeline (e.g. `lineup_news`, `transfer_news`) is fully sufficient. Recommendation: **do not add tenacity.**

---

## New Dependencies

### None required.

After cross-checking the v1.24 lockfile against the four feature spec requirements, no v1.25 feature requires a new package on either side of the stack.

| Considered | Verdict | Reason |
|------------|---------|--------|
| `use-local-storage-state` (npm) | **REJECT** | Existing `try/catch + window.localStorage.getItem/setItem + typeof window !== 'undefined'` pattern (see `src/app/page.tsx:141`, `src/components/rivals/RivalsTab.tsx:30`, `src/lib/manual-plan.ts:5`) is already in use across the codebase. Adding a third-party hook would create two patterns for the same behaviour. Reject for consistency. |
| `lodash.debounce` / `use-debounce` (npm) | **REJECT** | COST-01 budget-slider re-runs `buildPreSeasonSquad()`, which is pure-TS and finishes in <5ms on the full 700-player pool. There is no network call to debounce. React 19's `useDeferredValue` (built-in, no fixed delay, interruptible, concurrent-rendering aware) is the correct primitive. See [React docs](https://react.dev/reference/react/useDeferredValue) and [DEV Community article on useDeferredValue vs debouncing](https://dev.to/junihoj/enhancing-performance-in-react-why-you-should-consider-usedeferredvalue-over-throttling-and-debouncing-99b). |
| `tenacity` (PyPI) for retries on AUTO-01 polling | **REJECT** | The pipeline already uses bare `try/except` + `requests` for every external call. Adding a retry decorator for one new poll step (which is non-fatal anyway — IS_OFF_SEASON simply persists from prior run) creates inconsistency with `lineup_news.py`, `transfer_news.py`, `fpl_client.py`. Existing pattern is sufficient. |
| `@radix-ui/react-slider` (npm) for COST-01 budget slider | **REJECT** | A native `<input type="range">` styled with Tailwind v4 utilities is fully sufficient for a single-axis budget slider. Existing components have not pulled in Radix; staying primitives-only keeps bundle size flat. If accessibility deficiency surfaces during human UAT, revisit. |
| `idb-keyval` or `dexie` for watchlist persistence | **REJECT** | Watchlist is a list of integer player IDs — order-of-tens, not order-of-thousands. Serialised JSON in localStorage is well under any quota concern. The existing 38-GW ring-buffer pattern in `useDecisionHistory.ts` proves localStorage is comfortable at this scale. |
| `zustand` / `jotai` for cross-component watchlist state | **REJECT** | A single `useWatchlist()` hook reading/writing localStorage and exposing `add(id)`, `remove(id)`, `has(id)` is sufficient. The watchlist is consumed in ≤3 surfaces (GemTable row, dedicated WatchlistTab, NextSeasonPlannerTab cross-ref). Sync via the `storage` event handler already proven across the codebase. |

---

## Reused Stack (no changes)

### Frontend (no version bumps)

| Package | Version (locked) | Role in v1.25 |
|---------|------------------|---------------|
| `next` | `16.2.1` | App Router; new `/api/pre-season-squad?budget=N` reuses existing route handler |
| `react` / `react-dom` | `19.2.4` | `useDeferredValue` for COST-01 slider; `useSyncExternalStore` not required (localStorage event listener pattern already in use) |
| `typescript` | `^5` | strict types for `WatchlistEntry`, `NextSeasonState`, extended `PreSeasonSquadResult` |
| `@tanstack/react-query` | `^5.95.2` | New keys: `['watchlist-enriched']` (joins watchlist IDs against players + lineup news + signings), `['pre-season-squad', budget]` (budget-keyed cache for COST-01 ILP fallback). Mirror 6h `staleTime` from existing hooks. |
| `@tanstack/react-table` | `^8.21.3` | Existing GemTable gains a `pin` action column; no v8 API extensions required |
| `@vercel/blob` | `^2.3.1` | `next_season_state.json` write for AUTO-01 (mirrors `pre_season_squad.json` pattern) |
| `zod` | `^4.3.6` | Validate FPL bootstrap shape signals (event count, future deadline presence) inside AUTO-01 detector |
| `immer` / `use-immer` | `^11.1.4` / `^0.11.0` | Optional — watchlist add/remove can use plain state. Not strictly needed. |
| `recharts` | `^3.8.1` | Not used in v1.25 (no chart additions) |
| `tailwindcss` | `^4` | Slider, badge, pin-button styling — existing utility classes |
| `vitest` | `^4.1.2` | TDD for all four features; GREEDY-NULL needs explicit failure-mode test fixtures |

### Backend / Pipeline (no version bumps)

| Package | Version (locked in `pipeline/requirements.txt`) | Role in v1.25 |
|---------|-------------------------------------------------|---------------|
| `requests` | `>=2.32.0` | AUTO-01 reuses existing `get_bootstrap_static()` from `fpl_client.py` — bootstrap is already fetched every run; no new HTTP call required |
| `vercel-blob` | `>=0.4.0` | AUTO-01 writes `next_season_state.json`; COST-01 ILP fallback writes `pre_season_squad_budget_{N}.json` keyed by budget (or skips Blob entirely if invoked on-demand from API route) |
| `pulp` | `>=2.7.0` | COST-01: existing `suggest_squad.py` `_solve_ilp()` accepts a `budget` parameter (line 83) — already parameterised. Re-invoke with slider value. |
| `pandas` | `>=2.2.0` | Existing — no new use |
| `python-dotenv` | `>=1.0.0` | Existing — no new use |
| `numpy` | `>=1.26.0` | Existing — no new use |
| `feedparser` / `beautifulsoup4` / `lxml` / `rapidfuzz` | (RSS scraper deps) | Existing — no new use in v1.25 |
| `anthropic` | `>=0.98.1` | Existing — no new use in v1.25 |

### Infrastructure (no changes)

| Component | Status | Role in v1.25 |
|-----------|--------|---------------|
| GitHub Actions cron (`pipeline.yml`) | **Already sufficient** | 4×-daily baseline (`0 6,12,18,0 * * *`) + weekend/Friday intensives. AUTO-01 needs no new schedule. |
| Vercel Blob | **Already provisioned** | New artifact `next_season_state.json` (≤200 bytes). Optional `pre_season_squad_budget_{N}.json` if caching ILP results by budget. |
| `IS_OFF_SEASON` gate in `run.py:148` | **Reuse with extension** | AUTO-01 adds a *transition detector* alongside the existing `not any(e.get('is_current') for e in events)` predicate. When `IS_OFF_SEASON` flips back to `False` (or when `future_event_count` increases), `next_season_state.json` is written with `{detected_at, signal: 'new_season_published'}`. UI reads this to self-activate. |

---

## Integration Notes per Feature

### AUTO-01 — Pipeline daily polls for next-season data

**Reuse pattern:** the existing `bootstrap = get_bootstrap_static()` call (`pipeline/run.py:141`) already runs at every pipeline tick. AUTO-01 is a **derived signal**, not a new fetch.

**Detection logic (Python, new file `pipeline/next_season_detector.py`):**
```python
# Off-season → pre-season transition signals (any one is sufficient):
#   1. events[] grows beyond last known max_event_id  →  new fixture list published
#   2. an event in events[] has a deadline_time > now+7d after a period of all-past deadlines
#   3. bootstrap['elements'] count diverges materially (>50 player delta) from last snapshot
#   4. element 'now_cost' median changes >5% from last snapshot (price reveal)
```
The detector writes `next_season_state.json`:
```json
{
  "is_off_season": false,
  "next_season_signal_detected": true,
  "detected_at": "2026-07-20T18:00:00Z",
  "first_deadline_iso": "2026-08-15T17:30:00Z",
  "next_season_event_count": 38,
  "player_count": 712,
  "median_now_cost": 50,
  "signals_fired": ["future_deadline", "element_count_delta"]
}
```

**FPL pre-season timing context:** per [Premier League official announcement](https://www.premierleague.com/en/news/4362780/fantasy-premier-league-202526-is-live), the 2025/26 game went live **21 July 2025** with first price reveals **20 July 2025**. The 2026/27 cycle will follow the same mid-July → mid-August window. The polling cadence (4×/day) is overkill for a once-per-summer event; staying with existing cron avoids any new infra.

**UI integration:** `useNextSeasonState()` hook (new, mirrors `usePreSeasonSquad`) reads `/api/next-season-state` (new tiny route handler, USE_BLOB toggle pattern). `NextSeasonPlannerTab` reads this hook to:
- Show "Next-season data detected on YYYY-MM-DD" banner above the formation grid
- Activate the GW1-8 FDR heatmap section (currently a stub at `NextSeasonPlannerTab.tsx:117-135`)
- Activate the squad planner (currently shows "Prices pending" when archive 404s)

**Confidence: HIGH** — all primitives are in place; this is purely a derived-signal addition.

### WATCH-01/04 — Transfer Target Watchlist

**Storage:** localStorage key `fplx_watchlist` — JSON-serialised array of `WatchlistEntry`:
```typescript
interface WatchlistEntry {
  id: number              // FPL element ID
  added_at: string        // ISO 8601 — for sort and stale detection
  note?: string           // optional user note (deferred to v1.26 if scope grows)
}
```
Mirror the **lazy-initialiser + try/catch** pattern from `src/lib/manual-plan.ts:5` (`MANUAL_PLAN_KEY = 'fplx_manual_plan'`). Cross-tab sync via the `storage` event listener; not required for v1.25 MVP but trivial to add.

**Hook:** `src/lib/hooks/useWatchlist.ts`
```typescript
export function useWatchlist(): {
  ids: number[]
  add: (id: number) => void
  remove: (id: number) => void
  toggle: (id: number) => void
  has: (id: number) => boolean
  entries: WatchlistEntry[]
}
```
Internally `useState<WatchlistEntry[]>` with lazy initialiser reading localStorage; `useEffect` persisting on change.

**Enrichment:** `useWatchlistEnriched()` joins:
- `usePlayers()` — price, ownership%, position, team
- `useTransferNews()` — confirmed-signing badge (v1.24 `buildConfirmedSigningMap` already exported from `src/lib/buildConfirmedSigningMap.ts`)
- `useLineupNews()` — `NewsBanner` 14-day staleness gate (v1.21 NEWS-01)
- `usePreSeasonSquad()` — boolean "in pre-season squad" overlay for the squad-overlap badge
- `usePriceChanges()` — rise/fall confidence tier (v1.8 PRC-01)

The join is pure-TS (no new API route), runs in `useMemo`, and is performant for the ≤30-entry list size.

**Pin/unpin from GemTable rows:** add a column factory hook to the existing `createColumns(onCompare, onPin?)` signature in `src/components/gem-table/columns.tsx`. A small star/pin icon button on each row calls `onPin(playerId)` which routes to `useWatchlist().toggle`. No table-engine changes (TanStack Table v8 already handles the column type).

**UI surface:** new `WatchlistTab` (likely under Plan section, between `next-season` and existing tabs) renders the enriched list. Empty state directs the user to GemTable.

**Confidence: HIGH** — every primitive (localStorage hook, GemTable column, enrichment hooks, badge components) already exists in the v1.24 codebase.

### COST-01 — Squad Cost Simulator

**Primary path (greedy, fast):** `buildPreSeasonSquad()` already accepts `budget` as its third parameter (`src/lib/pre-season-squad.ts:24` — default 1000 = £100m). Slider drives a `useState<number>` for budget; pass through `useDeferredValue` to throttle re-renders during drag without a debounce library:

```typescript
const [budgetTenths, setBudgetTenths] = useState(1000)
const deferredBudget = useDeferredValue(budgetTenths)
const squadResult = useMemo(
  () => buildPreSeasonSquad(players, scoreMap, deferredBudget, 3),
  [players, scoreMap, deferredBudget],
)
```
Per the [React docs](https://react.dev/reference/react/useDeferredValue), `useDeferredValue` is interruptible (a new drag value cancels the stale background render), adapts to device speed (no fixed delay), and avoids the "wrong delay constant" problem. The greedy build is pure-TS and finishes in <5ms on 700 players, so this is essentially free.

**Fallback path (ILP, slower):** when `buildPreSeasonSquad()` returns `null` (GREEDY-NULL signal — minimum slots unmet, or no feasible greedy assignment under the budget constraint), fall through to a TanStack Query mutation calling:

```
POST /api/pre-season-squad
Content-Type: application/json
{ "budget": 985 }
```

The route handler reuses `suggest_squad.py`'s `_solve_ilp()` (already takes `budget` as parameter at `pipeline/suggest_squad.py:83`). For Node.js → Python invocation in v1.25, options are:
- **Recommended:** pre-compute ILP results for budget grid (£95m–£100m in £0.5m steps = 11 buckets) during the pipeline run and cache to Blob as `pre_season_squad_budget_{N}.json`. UI reads the nearest bucket. No Python-at-request-time complexity.
- **Alternative (rejected for v1.25):** spawn Python subprocess from the Next.js route handler. Vercel Serverless Functions can ship a Python runtime but mixing runtimes complicates deploys.

Cache by query key `['pre-season-squad-ilp', bucketBudget]` with 24h staleTime (ILP result is deterministic given fixed inputs).

**Confidence: HIGH** — uses existing pure functions; React 19 `useDeferredValue` is the correct primitive (verified across [React docs](https://react.dev/reference/react/useDeferredValue) and [DEV.to comparative analysis](https://dev.to/junihoj/enhancing-performance-in-react-why-you-should-consider-usedeferredvalue-over-throttling-and-debouncing-99b)); ILP grid pre-compute keeps the runtime stack pure-TS at request time.

### GREEDY-NULL — `buildPreSeasonSquad()` null-rate instrumentation

**Extension to existing pure function** (`src/lib/pre-season-squad.ts`):

Add a sibling diagnostics function rather than mutating the return type (preserves the existing 1466/1500 GREEN test suite):

```typescript
export interface BuildPreSeasonSquadDiagnostics {
  outcome: 'success' | 'incomplete_squad' | 'unmet_min_slots' | 'no_eligible_players'
  squad_size: number                    // actual filled (0-15)
  filled_by_position: Record<number, number>
  missing_by_position: Record<number, number>
  budget_used: number
  budget_remaining: number
  team_count_at_cap: number[]           // FPL team IDs at the 3-per-club cap
  eligible_pool_size: number
}

export function diagnoseBuildPreSeasonSquad(
  players: PreSeasonPlayer[],
  scoreMap: Map<number, number>,
  budget = 1000,
  teamCap = 3,
): { squad: PreSeasonSquad | null; diagnostics: BuildPreSeasonSquadDiagnostics }
```

The existing `buildPreSeasonSquad()` remains unchanged and is internally rewritten to delegate to `diagnoseBuildPreSeasonSquad().squad`. No call-site breakage.

**UI surface:** small "Why no squad?" expand-row under the empty-state at `NextSeasonPlannerTab.tsx:102-106`, only shown when `data === null`. Renders the diagnostics fields as a plain `<dl>`.

**Telemetry (out of scope for v1.25, optional v1.26):** the diagnostics function is sync and side-effect-free; if cumulative null-rate measurement is ever required, a `localStorage[fplx_greedy_null_log]` ring buffer can be added without code changes to the core function.

**Confidence: HIGH** — pure refactor with TDD coverage; no new dependencies.

---

## What NOT to Add

| Dependency / approach | Why not |
|------|---------|
| `use-local-storage-state` or `usehooks-ts` (npm) | Adds a third pattern for a behaviour already implemented twice (raw `try/catch` and the `MANUAL_PLAN_KEY` helper in `src/lib/manual-plan.ts`). Pure-cost, zero-benefit. |
| `lodash.debounce`, `use-debounce`, `awesome-debounce-promise` | `useDeferredValue` is the React 19 idiomatic answer for COST-01. The slider has no network call to debounce. |
| `@radix-ui/react-slider` or `react-aria` `Slider` | Single-axis range slider is one of the few `<input>` types where native works fully (keyboard, touch, screen-reader). Tailwind v4 provides slider-thumb pseudo-element utilities. Revisit only if UAT surfaces a specific accessibility failure. |
| `zustand`, `jotai`, `valtio` for watchlist state | A 30-entry list with three call sites does not need a state-management library. `useWatchlist()` returning plain state is sufficient. |
| `idb-keyval`, `dexie`, IndexedDB | Watchlist size (≤30 integer IDs + metadata) is far below the 5MB localStorage practical ceiling. IndexedDB adds async complexity for no benefit. |
| `tenacity`, `backoff` (PyPI) for AUTO-01 polling retries | The pipeline already runs 4×/day; a single failed bootstrap fetch self-recovers on the next run. The existing bare `try/except` pattern (`lineup_news.py:154`, `transfer_news.py:163`) is the established idiom — adding retry decorators creates inconsistency. |
| `apscheduler` or any new scheduler | GitHub Actions cron already polls 4×/day. AUTO-01 needs no new schedule — it's a derived signal on top of the existing bootstrap fetch. |
| New `python-fpl` library or `fpl-api` wrappers | `pipeline/fpl_client.py` already has all the methods v1.25 needs. Adding a wrapper would duplicate validated code. |
| Server-Sent Events / WebSockets for AUTO-01 "data published" notification | Single-user app polled 4×/day; the user opens the app on their own cadence and reads the most recent state. SSE is unnecessary infrastructure for this use case. |
| GraphQL layer | Existing REST + TanStack Query is sufficient; no GraphQL benefit at this app size. |
| `react-window` / `react-virtualized` for the watchlist | List is ≤30 items; virtualisation overhead exceeds benefit. |
| Cookie-based persistence for watchlist | localStorage is the existing app convention (`fpl_team_id`, `fpl_token`, `fplx_manual_plan`, `fplx_mini_league_id`). Cookies add unnecessary server roundtrips. |
| Calling Python from a Next.js Route Handler at request time for COST-01 ILP | Pre-compute the 11-bucket grid during the pipeline run and serve via Blob. Keeps request path pure-TS. |

---

## Sources

- [React docs — useDeferredValue](https://react.dev/reference/react/useDeferredValue) — verified COST-01 primitive choice
- [DEV Community — useDeferredValue vs throttling/debouncing](https://dev.to/junihoj/enhancing-performance-in-react-why-you-should-consider-usedeferredvalue-over-throttling-and-debouncing-99b) — confirms idiomatic React 19 pattern
- [Premier League — FPL 2025/26 launch](https://www.premierleague.com/en/news/4362780/fantasy-premier-league-202526-is-live) — verifies pre-season timing window (mid-July reveal, mid-August deadline)
- [Premier League — first prices for 2025/26](https://www.premierleague.com/en/news/4362323/price-reveals-for-202526-fantasy) — confirms price-reveal-first then game-launch sequence; AUTO-01 detector should fire on price reveal not just deadline appearance
- [Premier League — added-player prices](https://www.premierleague.com/en/news/4363681/see-the-prices-of-new-players-added-to-202526-fantasy) — confirms new-player-count-delta is a valid AUTO-01 signal
- [Oliver Looney — FPL APIs Explained](https://www.oliverlooney.com/blogs/FPL-APIs-Explained) — community reference for `events[].deadline_time` field semantics
- [Frenzel Timothy — FPL API Endpoints guide](https://medium.com/@frenzelts/fantasy-premier-league-api-endpoints-a-detailed-guide-acbd5598eb19) — secondary confirmation of bootstrap-static event shape
- Direct file inspection: `package.json`, `pipeline/requirements.txt`, `pipeline/run.py`, `pipeline/suggest_squad.py`, `src/lib/pre-season-squad.ts`, `src/lib/hooks/usePreSeasonSquad.ts`, `src/lib/hooks/useDecisionHistory.ts`, `src/components/next-season/NextSeasonPlannerTab.tsx`, `.github/workflows/pipeline.yml`, `src/lib/manual-plan.ts`, `src/app/page.tsx`

**Source priority used:** Direct file inspection (HIGH) > Official React docs (HIGH) > Premier League official news (MEDIUM — single-source for pre-season timing) > Community FPL API references (LOW, but corroborate each other on the events[] shape).
