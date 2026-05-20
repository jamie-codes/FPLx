# v1.25 Pre-Season Intelligence — Integration Pitfalls

**Milestone:** v1.25 Pre-Season Intelligence (adding 4 features to existing FPL Analyst)
**Researched:** 2026-05-19
**Scope:** Integration pitfalls specific to wiring AUTO-01 (pipeline polling), WATCH-01/04 (watchlist), COST-01 (budget slider), and GREEDY-NULL (null-rate instrumentation) into the live codebase.
**Confidence:** HIGH for codebase-specific items (verified by reading `run.py`, `suggest_squad.py`, `pre-season-squad/route.ts`, `pre-season-squad.ts`, `NextSeasonPlannerTab.tsx`, `manual-plan.ts`, `pipeline.yml`); MEDIUM for FPL off-season API behaviour (undocumented, community-reported).

---

## How to read each pitfall

Each entry has: **Risk** (High / Medium / Low), **Description** (what goes wrong and why this codebase is vulnerable), **Prevention** (concrete guard to put in code or tests), **Phase** (which v1.25 phase plan should own the fix).

---

# Critical Pitfalls (Risk: High)

## 1. AUTO-01: Bootstrap "looks normal" mid-July but events[] are stale or partial

**Risk:** High

**Description:** The existing `IS_OFF_SEASON = not any(e.get('is_current') for e in events)` (`pipeline/run.py:148`) is binary — but the off-season has at least four sub-states the gate cannot distinguish:

1. **True off-season** — `events[]` is the *old* 38-GW array, all `finished: true`, no `is_current`. The current logic handles this.
2. **Empty/stub bootstrap** — between seasons FPL has historically served an `events: []` (or near-empty) response for hours-to-days. `IS_OFF_SEASON` becomes True (correct), but downstream code that does `max(e['id'] for e in events)` (`run.py:201`) will return the default `0`, which collapses GW38 detection silently.
3. **Pre-season armed** — new `events[]` published with all `finished: false` and `is_current: false` for the new season. **The current gate still reports True**, even though next-season data has landed. This is exactly the state AUTO-01 must detect.
4. **GW1 deadline crossed, `is_current` lag** — community reports indicate FPL can be slow to flip `is_current` on the first GW of a new season; the gate flips back to True briefly.

Polling alone (every 24h) does not solve detection — the *predicate* is the bug. If AUTO-01 uses `not IS_OFF_SEASON` as the activation signal, the heatmap and squad planner will *not* light up when next-season bootstrap arms, and will only flip on at the GW1 deadline (~weeks after fixtures are useful).

**Prevention:**
- Introduce a tri-state in `run.py`: `NEXT_SEASON_DATA_AVAILABLE = (len(events) > 0 and all(not e.get('finished') for e in events) and not any(e.get('is_current') for e in events))`. This is the AUTO-01 activation gate; it sits *between* off-season and live-season states.
- Persist `last_known_first_event_id` to Blob. When `events[0]['id']` rises above last-known, treat it as a season rollover signal independent of `is_current`.
- Add a `fixtures.json` health check in the gate predicate: AUTO-01 should only declare "next-season data has landed" when **both** `bootstrap.events[]` is fresh **and** `/api/fixtures` returns ≥38 fixtures with future kickoff dates. Either alone is insufficient (FPL has shipped bootstrap before fixtures and vice versa).
- Tests: snapshot-fixture replay for each of the four states (true off-season, empty events, armed pre-season, GW1 live) — assert which features turn on in each state.

**Phase:** AUTO-01 (the polling/activation phase). Write the gate predicate first; the polling cron is the trivial part.

---

## 2. COST-01: Budget slider fires PuLP ILP on every tick → UI freeze + Vercel timeout cascade

**Risk:** High

**Description:** `suggest_squad.py` is run as a Python subprocess inside the pipeline (`run.py:213-236`); it takes ~0.5-2 s for the CBC solver on a ~600-player pool, longer on cold starts. The existing `/api/pre-season-squad` route currently **does not** call PuLP — it serves the pre-computed `pre_season_squad.json` from Blob or falls back to the TS greedy builder (`route.ts:36-44, 125`). COST-01 changes that contract: the slider must re-run ILP/greedy *with a new budget*.

Three things break the moment a user moves the slider:

1. **Naive `onChange={(v) => mutate(v)}`** — fires 30-60 events per drag. Each call spawns a Python subprocess if ILP is used. CBC has a documented cold-start issue (`coin-or/pulp#167` cites `cbc -stop` taking >1s after idle); subprocess spawn + solver + JSON write/read will trip Vercel's 60s Pro timeout under load and starve the function pool.
2. **TanStack Query refetch cascade** — if COST-01 reuses `usePreSeasonSquad()`, every slider value mutation invalidates the query, causing `NextSeasonPlannerTab` (heavy formation grid + 8-GW heatmap rows) to re-render. With `GemTable` mounted in adjacent tabs, an unmemoized prop on the slider's parent will cascade re-renders into TanStack Table (TanStack Table has a documented infinite-re-render trap when columns/data aren't stably memoised, per github.com/TanStack/table#4227).
3. **Optimistic UX impossible** — debounced mutations don't compose with optimistic updates (TanStack Query discussion #2292) — so the slider will feel laggy regardless.

**Prevention:**
- **Default to TS greedy on slider drag, ILP only on release.** `buildPreSeasonSquad()` is pure TS and <50 ms on 600 players (verified by reading the implementation — single sort + single pass). Run greedy locally on every `onValueChange`; run ILP only on `onValueCommit` (Radix slider) or `onChange` final-debounced (300-400 ms after drag end).
- Wrap the slider's debounced state in `useDebouncedValue` (custom hook) — *do not* try to debounce the mutation function (`useCallback` + debounce creates a new instance per render unless wrapped in `useRef`, classic React debounce trap).
- Add `targetBudget` as a query key dimension: `useQuery({ queryKey: ['pre-season-squad', targetBudget] })`. This avoids re-fetching for already-computed budgets (user nudges back to 100m → cache hit).
- If ILP must run server-side per budget, add `maxDuration = 30` to the route handler, return 408 on solver timeout, and surface a "Solver busy — showing approximate squad" badge.
- Add a perf test: simulate 60 slider events in 1s, assert <5 mutations fired, P95 mutation latency <200 ms.

**Phase:** COST-01. Greedy-on-drag + ILP-on-release is the cheapest architecture; specifying it in the plan prevents the obvious naive implementation.

---

## 3. AUTO-01 → COST-01: Player IDs are reused across seasons but element_type/team change

**Risk:** High

**Description:** FPL element IDs (the `id` field on `bootstrap.elements`) are **assigned sequentially across all seasons and not reset**. Player Y's id `351` last season may be re-used (same player) — but new players added pre-season get fresh IDs *after* last season's max, and players who left the league still appear in bootstrap with `status: 'u'` (unavailable) until ~early August. Two specific failure modes for v1.25:

1. **WATCH-01 watchlist becomes a graveyard.** A watchlist persisted in localStorage as `[{id: 351, ...}, ...]` from last season will:
   - Show players who left the league as "current squad candidates" until FPL purges them
   - Display *stale* `now_cost`, `team`, `element_type` from the time of pinning
   - If FPL re-uses an internal squad slot, `element_type` can change (e.g., a player reclassified from MID to FWD; happens 1-3 times per season). The watchlist will render them in the wrong position group.
2. **Pre-season squad uses old IDs against new prices.** `pre_season_squad.json` is computed at GW38 with last-season `now_cost`. If COST-01 re-runs with a new budget *after* FPL publishes new-season prices but before the archive is regenerated, the squad costs in the UI will mismatch reality (e.g., Saka was 9.5m archived, FPL listed at 10.5m for new season). Budget slider says "£100m budget, used £99.5m" but the real wallet view at FPL says £101m used.

**Prevention:**
- WATCH-01 storage: persist `{id, web_name, pinned_at_iso}` *only*. Re-hydrate `now_cost`, `team`, `element_type`, `status` from current `/api/players` on every render. Treat the watchlist as a **set of IDs**, not a denormalised record.
- WATCH-01 needs a "Player no longer in FPL" empty pill — when an id isn't in current `elements[]`, render a zinc badge `Departed (last seen GW38)` rather than silently dropping or crashing.
- Add `element_type_drift_check` in the hook: if `last_seen_element_type !== current.element_type`, log + show amber `Reclassified` badge so user notices position changes.
- COST-01 needs a `prices_basis` field on the response (`'archive_gw38'` vs `'live_bootstrap'`) and a banner in the UI when the slider is operating on archive prices. Once `now_cost` for the new season lands in bootstrap, prefer it.
- Tests: feed a fixture where element 351's element_type flips between snapshots — assert the watchlist UI handles re-classification without throwing.

**Phase:** WATCH-01 owns the watchlist storage contract; COST-01 owns the prices_basis surfacing. Both depend on AUTO-01 establishing the price source detection.

---

## 4. GREEDY-NULL: Instrumentation as logging-only is useless without a reproducible fixture corpus

**Risk:** High

**Description:** `buildPreSeasonSquad()` returns `null` when (a) <15 eligible players, (b) any MIN_SLOTS unmet, or (c) the greedy can't fit 15 within budget (`pre-season-squad.ts:54-57`). The route already has *a* console.error on null (`route.ts:128-129`). The deferred GREEDY-NULL item asks for "null rate measurement and UI reporting."

The obvious-but-wrong implementation:
- Increment a counter in localStorage each time greedy returns null. Display "Greedy null rate: 12%" in the UI.

This fails because:
1. **Sample size is tiny.** A single user's localStorage will see this function called maybe 1-2x per session. n=50 over a season is not statistical.
2. **Confounded by budget slider input.** Once COST-01 lands, the user will deliberately push the slider to absurd values (£60m budget) and observe nulls. localStorage cannot distinguish "intentional infeasibility" from "algorithm shortcoming."
3. **No remediation path.** If you measure that greedy nulls at 12%, what do you do? Without a fixture set of the *inputs* that caused null, you cannot tune the algorithm. The point of instrumentation is to enable algorithm improvement, not to display a vanity metric.

**Prevention:**
- Instrument GREEDY-NULL **server-side, not client-side**. In the API route, when greedy returns null, capture `{score_map_size, budget, position_counts_pre_constraint, team_distribution}` and POST it to a Blob path `greedy_null_log/{iso_date}_{hash}.json`. Logs are durable, comparable, and can drive a fixture corpus.
- The "null rate" UI surface should be a **debug page** (or behind a `?debug=greedy` query param), not a primary user surface. Surfacing null rate to typical users without explanatory context is anti-feature noise.
- Add a `greedy_null_reason` enum to the response: `'insufficient_eligible' | 'budget_infeasible' | 'min_slot_unmet:GK' | ...`. This is what makes the data actionable — null with a reason converts to a test fixture immediately.
- Tests: assert greedy returns null with the right reason for each of 5 hand-crafted infeasibility fixtures, before measuring anything in production.

**Phase:** GREEDY-NULL. Pair the instrumentation work with at least 5 fixture cases derived from real archive snapshots.

---

# Moderate Pitfalls (Risk: Medium)

## 5. WATCH-01/04: localStorage namespace collision and missing migration with 4+ existing consumers

**Risk:** Medium

**Description:** localStorage is used in 23+ files (verified via grep), including `manual-plan.ts` (`MANUAL_PLAN_KEY`), `useChipHistory`, `useDecisionHistory` (ring buffer), `useGwReview`, `usePlayerInsight` (`playerInsight:{id}:gw{N}`), `useRivals`, theme toggle. There is **no unified abstraction** — each module rolls its own key, version field, validation, and try/catch (`manual-plan.ts:221-264` is the canonical pattern).

Failure modes when WATCH-01/04 lands:
1. **Key collision** — naming `watchlist` or `targets` without a `fplx:` prefix risks colliding with a future feature or a browser extension. Several existing keys lack prefix (`manual-plan`, `theme`).
2. **No schema versioning** — `manual-plan.ts` has `if (p.version !== 1) return null` (line 239). If WATCH-01 ships without a `version` field, the next iteration that adds `pinned_priority` or `notes` will silently discard all existing watchlists.
3. **Quota cap** — localStorage is 5-10 MB per origin. The combined existing footprint is small (~50-200 KB), but `useDecisionHistory` is a 38-entry ring buffer and `usePlayerInsight` caches up to ~30 KB per insight. A user with 200 pinned players × full denormalised payload × 600-byte JSON = 120 KB; multiplied by stale GW snapshots in `useGwReview`, you can land in `QuotaExceededError` on Safari (lower effective limit).
4. **`window` undefined during SSR** — `NextSeasonPlannerTab` is a client component (`'use client'`), but `usePreSeasonSquad` is consumed in a tab that may not always be mounted. If WATCH-01's hook reads localStorage *outside* a `useEffect`, Next.js 16 (which has tighter hydration assertions than 14/15) will warn or throw mismatch.

**Prevention:**
- Extract a `useLocalStorageState<T>(key, initial, schema)` utility in `src/lib/hooks/useLocalStorageState.ts`. Use Zod for the schema (Zod is already a dependency for FPL adapter). All new features (and ideally a migration of existing ones, out of scope for v1.25) go through this.
- Mandatory `{version: 1, ...}` envelope on every persisted blob. Increment on schema change; the hook returns `null` if version mismatches and clears the slot.
- Mandatory `fplx:` prefix on every key. Audit existing keys in a follow-up; for v1.25 *new* keys, enforce.
- Always read inside `useEffect` (or `useSyncExternalStore` with SSR-safe snapshot). Initial render must return `null` or `[]` to avoid hydration mismatch.
- Catch `QuotaExceededError` specifically and show a toast: "Watchlist storage full — unpin some players or clear old data." Don't silently drop writes (the existing `manual-plan.ts` swallow-catch pattern hides quota issues).

**Phase:** WATCH-01. Land the `useLocalStorageState` utility in WATCH-01's plan; WATCH-04 reuses it.

---

## 6. COST-01: GemTable / OpportunityCostTable re-render storm from unmemoized prop drilling

**Risk:** Medium

**Description:** `NextSeasonPlannerTab` is currently a leaf consumer (`usePreSeasonSquad` → render). Adding the budget slider creates state at the tab level. If that state is propagated as a raw value through any component tree that includes `GemTable`, `OpportunityCostTable`, or even another `HeatMapRow`, every slider tick causes their parents to re-render. TanStack Table specifically penalises this — per the FAQ, columns/data without stable references will re-render the full table, not just the slider's locale.

The existing codebase is *generally* good at this (use of `useImmer`, memoised columns in `GemTable`), but the v1.25 plan adds:
- COST-01 budget slider state
- A "Recompute" button (likely)
- A `prices_basis` banner
- WATCH-04 squad-overlap highlight (cross-references watchlist to a player set)

Each of these is a new piece of state in the Plan-section tree. Without explicit memoization of the slider's container and an isolated `BudgetSliderProvider` context, the prop chain back into `PlannerTab` / `RouteTreeTab` / `ManualPlanTab` (all sibling Plan-section components sharing `planHorizon`) can re-render on every slider event.

**Prevention:**
- Co-locate slider state in a dedicated `BudgetContext` (React context) scoped to `NextSeasonPlannerTab` only — do not lift to `page.tsx` alongside `planHorizon`. The contexts are unrelated.
- Wrap `FormationGrid`, `HeatmapSection`, and `WatchlistSection` in `React.memo` with shallow-equal prop check. Pass the *resolved* squad object, not the slider value, so memo can stop the re-render at the section boundary.
- Use `useDeferredValue(budgetValue)` for any expensive derived display (e.g., a "£X.Xm remaining" sub-headline that reads from the recomputed squad). Lets React keep the slider thumb responsive while the table recomputes.
- Test: add a re-render counter component (Profiler API) inside `GemTable` and assert it does *not* increment when the v1.25 budget slider moves on a different tab. CI guard.

**Phase:** COST-01. State architecture decision is in the plan, before any UI code.

---

## 7. AUTO-01: Daily cron may miss a 4-hour FPL window — and a missed window has compounding effect

**Risk:** Medium

**Description:** The existing cron is "4x daily baseline + dense weekend deadlines" (`.github/workflows/pipeline.yml:13-16`). For mid-season, this is fine — GW deadlines are predictable. For AUTO-01 in the off-season:

- FPL typically publishes next-season bootstrap **once**, often overnight UK time in mid-July with no advance warning.
- If the cron next runs 4-6 hours later, that's fine for data freshness — but the activation window (when the heatmap "lights up") is delayed by up to 6 hours.
- More problematic: `refresh_gate.py` was built for *mid-season* deadline-window logic. It probably doesn't know about off-season events and may *suppress* off-season runs entirely (need to verify). If so, AUTO-01's polling cron is gated by a predicate that doesn't apply.
- The 4x-daily baseline does run unconditionally (line 58 — `'0 6,12,18,0 * * *'` runs even without gate), so the 6h worst case is the bound. But a user opening the app at 9am UK time, the morning bootstrap published at 5am, won't see fixtures until the 12pm cron lands them.

**Prevention:**
- Verify `refresh_gate.py` allows off-season runs. If not, add an explicit `is_off_season_or_pre_season` clause that always returns `run=true` once `NEXT_SEASON_DATA_AVAILABLE` is suspected.
- Add a tighter polling cron *only* during the suspected pre-season window (mid-June to mid-August): `0 */2 * * *` (every 2 hours) inside the gate, gated by date range. This is a 6-week intensification, not a permanent change.
- Add a "Last bootstrap check: X min ago" debug surface on the planner tab; if next-season data is expected and stale, the user sees an honest staleness indicator instead of "Fixtures not yet published" when they actually are.
- Don't put activation polling on the client (browser fetch every N seconds) — it duplicates work and complicates Vercel Blob cache invalidation. The pipeline cron is the source of truth.

**Phase:** AUTO-01. Cron-config change is small; the gate-predicate verification is the work.

---

## 8. AUTO-01: archive_season.py + suggest_squad.py idempotency assumptions break when bootstrap shape changes

**Risk:** Medium

**Description:** `archive_season.py` has a 50%-success guard, and `suggest_squad.py` has an idempotency skip (`suggest_squad.py:263-278` — skips if `pre_season_squad.json` already exists). These were designed for a one-shot GW38 window.

In the v1.25 world:
- A user changes the budget via COST-01 → the route handler reads `pre_season_squad.json`, but it was computed for £100m. The slider's request for £95m has no pre-computed file.
- AUTO-01 detects new bootstrap mid-July → should `suggest_squad.py` re-run with the new player pool and new prices? Currently it would **skip** because `pre_season_squad.json` already exists from GW38.
- The skip key is filename-only; it has no notion of "computed against archive A vs archive B."

**Prevention:**
- Version the artifact name: `pre_season_squad_v{bootstrap_hash}.json` where `bootstrap_hash` is a short hash of `(events[0].id, len(elements), sum(now_cost))`. Different bootstrap → different filename → no skip.
- Or, *delete* the artifact when bootstrap freshness check fails (i.e., when AUTO-01 detects new-season data). Add a `force_recompute` env var for the cron to set when the bootstrap-hash changes.
- For COST-01 budget variations, **do not** persist every budget's squad to Blob — that explodes the artifact set. Use the route handler's in-memory ILP call (with greedy-on-drag, ILP-on-release per Pitfall 2) and cache in-memory via the Next.js `unstable_cache` for `s-maxage=3600` only on the default £100m path.
- Tests: assert `suggest_squad` recomputes when the bootstrap hash differs, even if `pre_season_squad.json` exists.

**Phase:** AUTO-01 (artifact versioning) and COST-01 (slider path doesn't write to Blob).

---

## 9. WATCH-01: News badge integration with NewsBanner and ConfirmedSigningBadge — staleness pipeline isn't unified

**Risk:** Medium

**Description:** Existing badges on player rows include `NewsBanner` (14-day staleness suppression, `NEWS-01`), `ConfirmedSigningBadge` (green pill, `WIN-02`), `MinsRiskBadge`, `StatusLabelBadge`. Each has its own staleness rule:

- `NewsBanner`: zinc badges suppressed >14 days; red/amber never suppressed.
- `ConfirmedSigningBadge`: rendered from `transfer_news.json` 5-class classification; no explicit staleness gate.
- WATCH-01 will request "news badge" on watched players. If it naively reuses `NewsBanner`, it inherits the 14-day rule — but in the **off-season**, the most valuable news is *more than 14 days old* (a confirmed signing from 3 weeks ago is still the canonical fact). The 14-day rule was a mid-season decision (`NEWS-01` rationale).

**Prevention:**
- Make `staleness_threshold_days` a prop on `NewsBanner`, default 14, allow `Infinity` (or a sentinel) for off-season use cases.
- WATCH-01 watchlist row uses `NewsBanner` with `stalenessDays={null}` (no suppression) when `IS_OFF_SEASON` is detected. Mid-season, default suppression applies.
- Document this in `NewsBanner.tsx` JSDoc so the next consumer doesn't re-derive the rationale.
- Test: snapshot a 30-day-old confirmed-signing news item; assert it renders in the watchlist row but not in the captain-picks row (which retains 14-day suppression).

**Phase:** WATCH-01. The `NewsBanner` prop extension is a 10-line change but easy to overlook.

---

## 10. GREEDY-NULL: Sample bias from users who never click the planner tab

**Risk:** Medium

**Description:** `NextSeasonPlannerTab` is a Plan-section sub-tab — most users won't visit it daily. The greedy null observation only happens when:
1. User opens the Plan section
2. Selects "Next Season" sub-tab
3. `usePreSeasonSquad()` fetches `/api/pre-season-squad`
4. Server tries greedy if no pre-computed ILP exists

In the **production happy path**, the pipeline pre-computes `pre_season_squad.json` via `suggest_squad.py` (ILP) at GW38. The route hits Resolution 1 (`route.ts:36-44`) and never invokes the TS greedy. Greedy is only used when the ILP file is missing — which is exactly the pathological state the instrumentation wants to measure.

So the deployed null rate will be: "How often does the route hit Resolution 2 + greedy fails?" — which is a *function of pipeline reliability*, not algorithm quality. The instrumentation is measuring the wrong thing.

**Prevention:**
- Run a **shadow ILP-vs-greedy A/B** in the route: when ILP file exists, run greedy *also* (on the same inputs), compare squads, log delta. This measures algorithmic quality directly.
- Alternatively, run greedy nightly in the pipeline against synthetic budget perturbations (`£90m`, `£95m`, `£100m`, `£105m`) and log nulls.
- Define the actual metric clearly in the plan: "% of (archive, budget) inputs for which greedy returns null while ILP returns a feasible squad." This is the algorithmic gap, which is what GREEDY-NULL was deferred to measure.

**Phase:** GREEDY-NULL. Plan must reframe the metric definition before any code is written.

---

# Minor Pitfalls (Risk: Low)

## 11. COST-01: Budget slider UX granularity — £0.1m steps vs £0.5m steps

**Risk:** Low

**Description:** FPL prices are in tenths of millions (`now_cost: 95 = £9.5m`). A naive slider with `step={1}` over `min=600, max=1100` (£60m-£110m) gives 500 ticks — overly granular and wastes solver budget. £0.5m steps (`step=5`) is 100 ticks; £1m steps (`step=10`) is 50 ticks.

**Prevention:** Use `step={5}` (£0.5m). Bounds: `min={800}` (£80m, below which no FPL squad is feasible) to `max={1200}` (£120m, far above reality but allows "what if I had a bigger budget" exploration). Default value: `1000` (£100m).

**Phase:** COST-01.

## 12. AUTO-01: Mid-season BGW false-positive on activation gate

**Risk:** Low

**Description:** The existing `IS_OFF_SEASON` predicate uses `not any(e.get('is_current'))` (correct — handles BGW). The AUTO-01 `NEXT_SEASON_DATA_AVAILABLE` predicate proposed in Pitfall 1 must not false-positive on a mid-season BGW. The check `all(not e.get('finished') for e in events)` is sufficient — in a BGW, prior events are still finished. Document this in the predicate; add a test.

**Prevention:** Pure unit test for the gate: BGW fixture (some events finished, some not, no is_current) → must return False.

**Phase:** AUTO-01.

## 13. WATCH-01: Default sort order — pinned-time vs ownership

**Risk:** Low

**Description:** Watchlist will likely default to "most recently pinned" order. Users with 10+ pins typically prefer ownership/price-trend sort. The decision should be deliberate, not accidental.

**Prevention:** Ship with `useLocalStorageState<{sort: 'recency' | 'ownership' | 'price' | 'xpts'}>` and a column-header sort affordance. Default: `'recency'`. Persist user choice.

**Phase:** WATCH-01.

## 14. AUTO-01: Vercel Blob list() pagination missing for legacy artifacts

**Risk:** Low

**Description:** `route.ts:17` uses `list({ prefix: filename, limit: 1 })` — assumes a single matching blob. If a previous deploy wrote multiple artifact versions (e.g., GREEDY-NULL adds debug logs at `greedy_null_log/*`), and AUTO-01 introduces hash-versioned artifact names (Pitfall 8), the route will pick the first lexicographically, not the latest.

**Prevention:** When versioned artifacts exist, sort blobs by `uploadedAt` descending and pick the newest. Add a unit test for "two versions exist" fixture.

**Phase:** AUTO-01 (if hash-versioning lands).

## 15. COST-01: Budget validation — slider value below £80m makes no FPL squad feasible

**Risk:** Low

**Description:** A FPL squad of 15 players at the absolute floor (4.0m × 15 = £60m, but realistic min is closer to £80m due to position quotas and 2 GKs) is infeasible below ~£80m. ILP will return `Infeasible`, greedy returns null. UX should pre-validate.

**Prevention:** Disable slider range below £80m, or show inline "No FPL squad is feasible below £80m" warning. Don't burn solver time on infeasible budgets.

**Phase:** COST-01.

---

# Phase-Specific Warning Summary

| Phase | Likely Pitfalls (refs) | Most Critical Guard |
|-------|------------------------|---------------------|
| **AUTO-01** Pipeline polling | 1, 7, 8, 12, 14 | Tri-state gate (off / armed / live) — not the binary `IS_OFF_SEASON`. |
| **WATCH-01** Watchlist core | 3, 5, 9, 13 | Store IDs only; rehydrate from current `/api/players` every render. |
| **WATCH-04** Squad overlap | 5, 6 | Reuse `useLocalStorageState` from WATCH-01; do not invent a parallel storage layer. |
| **COST-01** Budget slider | 2, 3, 6, 8, 11, 15 | Greedy on drag, ILP on release. Never spawn Python subprocess on every tick. |
| **GREEDY-NULL** Instrumentation | 4, 10 | Server-side logging with reason codes; shadow A/B against ILP. The user-facing % is a vanity metric. |

---

# What to Test First

For the Planner: these are the 5 highest-value test fixtures to commission *before* any feature code is written. They convert "unknown FPL API behaviour" into deterministic CI guards.

1. **Off-season bootstrap states fixture set** — 4 JSON files representing (true off-season, empty events, armed pre-season, GW1 live). Drives Pitfalls 1, 7, 12.
2. **Element ID drift fixture** — two consecutive bootstrap snapshots where element 351 changes `element_type` and element 999 disappears entirely. Drives Pitfall 3.
3. **Greedy null-reason corpus** — 5 (score_map, budget) inputs that exercise each null reason. Drives Pitfall 4 and 10.
4. **Re-render counter wrapper around GemTable** — Profiler-based test asserting GemTable does not re-render when COST-01 slider is moved. Drives Pitfall 6.
5. **localStorage quota fixture** — pre-populate localStorage to ~4.5MB, attempt watchlist write, assert graceful QuotaExceededError handling. Drives Pitfall 5.

---

# Sources

**Codebase (HIGH confidence):**
- `pipeline/run.py` lines 141-244 — `IS_OFF_SEASON` gate, GW38 archive trigger
- `pipeline/suggest_squad.py` — PuLP ILP, idempotency check, 500-min eligibility
- `src/app/api/pre-season-squad/route.ts` — three-step resolution, greedy fallback
- `src/lib/pre-season-squad.ts` — pure TS greedy, null conditions
- `src/components/next-season/NextSeasonPlannerTab.tsx` — current empty-state UX
- `src/lib/manual-plan.ts` lines 217-264 — canonical localStorage version-validate-catch pattern
- `.github/workflows/pipeline.yml` — cron schedule and concurrency model

**External (MEDIUM confidence):**
- [TanStack Table FAQ — memoization](https://tanstack.com/table/v8/docs/faq) — stable column/data refs to avoid re-render cascades
- [TanStack/table#4227 — memoization in v8](https://github.com/TanStack/table/issues/4227)
- [Debounced mutation proposal — TanStack/query#2292](https://github.com/TanStack/query/discussions/2292) — optimistic updates incompatible with debounced mutations
- [PuLP CBC timeout PR — coin-or/pulp#167](https://github.com/coin-or/pulp/pull/167) — CBC subprocess cold-start delays
- [Vercel serverless timeout limits](https://vercel.com/kb/guide/what-can-i-do-about-vercel-serverless-functions-timing-out) — 10s free / 60s Pro
- [Next.js hydration error guide](https://nextjs.org/docs/messages/react-hydration-error) — localStorage in SSR
- [Frenzel Timothy — FPL API endpoints guide](https://medium.com/@frenzelts/fantasy-premier-league-api-endpoints-a-detailed-guide-acbd5598eb19) — off-season schema change warning
- [Oliver Looney — FPL APIs Explained](https://www.oliverlooney.com/blogs/FPL-APIs-Explained) — bootstrap-static + events semantics
- [Vercel cron idempotency guidance](https://vercel.com/docs/cron-jobs/manage-cron-jobs)

**LOW confidence (community-reported, no canonical source):**
- FPL `is_current` lag on GW1 deadline — community forum chatter; treat as defensive assumption.
- FPL element re-classification between MID/FWD — observed pattern; no documented FPL policy.
- Empty `events[]` window between seasons — observed historically; FPL gives no schedule.
