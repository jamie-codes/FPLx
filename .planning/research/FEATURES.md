# Feature Landscape: v1.25 Pre-Season Intelligence

**Domain:** Fantasy Premier League analyst — pre-season/off-season intelligence
**Researched:** 2026-05-19
**Downstream consumer:** Roadmap for v1.25 (AUTO-01, WATCH-01/04, COST-01, GREEDY-NULL)

---

## Domain context (FPL off-season cadence)

- FPL publishes the next-season `bootstrap-static` (player prices, teams, events list) typically **2nd–3rd week of July**, ~5 weeks before GW1. The 2025/26 bootstrap went live around **20 July 2025**, 2024/25 around **11–18 July 2024**. (MEDIUM confidence — historical, varies year to year.)
- Player price reveals usually trickle out **5–10 days before** the bootstrap itself via official Premier League social and the PL news site. This means the FPL API briefly carries **last-season's** event/fixture list while the **next season's prices are already being announced publicly**. Detection logic must not confuse these two transitions.
- The summer transfer window opens **mid-June** and closes **end of August/early September** in the UK. By the time pre-season data lands, ~70% of confirmed signings have already happened.
- Competitor tooling (Fantasy Football Fix, FPL Scout, fplform.com, livefpl.net) all reactivate in the same July window. Beating them to activation by 24–48h is a real differentiator.

Sources: [Fantasy Football Fix — 2025/26 launch](https://www.fantasyfootballfix.com/blog-index/fpl-2025-26-game-launch-announced/), [Fantasy Football Fix — 2025/26 prices](https://www.fantasyfootballfix.com/blog-index/fpl-2025-26-player-price-revealed-update/), [Premier League — new player prices](https://www.premierleague.com/en/news/4363681/see-the-prices-of-new-players-added-to-202526-fantasy)

---

## AUTO-01: Next-Season API Detection & Auto-Activation

### Table Stakes
- **Daily polling cadence** — FPL bootstrap endpoint already hit by `pipeline/run.py`; just need to interpret what's there during off-season. No new infra.
- **Reliable detection signal**, not a guess. Best signal: `events` array contains an event with `id=1` (or any event whose `deadline_time` falls in the future and after the previous season's GW38 deadline). Secondary signal: `total_players > 0` and at least one event with `is_next=true`.
- **Graceful degradation** when only partial data is published (e.g. fixtures published before some teams have their full roster priced). Don't gate the heatmap on having all 380 fixtures — show what's available.
- **Idempotency** — daily polls must not double-write or re-trigger downstream steps once activated. Match the `archive_season.py` pattern (50% guard, single Blob write).
- **Manual override** — a `FORCE_PRESEASON_ACTIVATION=true` env var so the user can force-activate for testing or if detection misfires.

### Differentiators
- **Activation status surfaced in the UI**, not buried in pipeline logs. A small banner on the Next Season Planner tab: "Pre-season data detected — squad planner active as of [date]" or "Awaiting FPL pre-season data (last checked: 2h ago)." This is the single biggest UX differentiator vs competitors who silently switch on.
- **Diff summary on first activation** — what changed vs last season's archive: N new players added, M removed, average price delta per position. Builds trust that detection worked correctly.
- **Two-phase activation** — Phase A: prices published, no fixtures yet → show squad builder but hide FDR heatmap with explanatory empty state. Phase B: fixtures published → unlock heatmap. Avoid "all or nothing" gate.

### Anti-Features (do NOT build)
- **Real-time/webhook activation.** FPL has no webhooks. Don't try to detect within minutes of publish — daily cadence is sufficient and matches existing pipeline rhythm.
- **Push notifications / email alerts on activation.** Out of scope for a personal tool with no notification infra. The UI banner is enough.
- **Auto-clear of previous-season data on activation.** Keep the archive blob (used by `usePreSeasonSquad()` and Season Review). Activation should be additive, never destructive.
- **Predicting the activation date.** Tempting to show "Expected: 18 July" countdown. Don't — historical variance is too high (11 July to 21 July range), and being wrong undermines trust.

### UX Pattern
- **Status indicator** on the Next Season Planner tab header — a small zinc/green pill: `Awaiting pre-season data` (zinc) → `Pre-season data live` (green) → `Active for 2026/27` (green, after first GW1 deadline). Mirrors the existing `LastUpdated` ticker pattern (FRE-01, amber when stale).
- **Banner on first activation** auto-dismisses after 7 days or first user interaction with the planner. Use localStorage flag `nsp_activation_seen_{seasonId}` to suppress.
- **Pipeline log line** with structured prefix `[auto-detect]` matching `[player-insight]` / `[transfer_news]` conventions for grep-ability.
- **Pre-season banner copy**: avoid hype ("New season!" "Get ready!"). Inform: "FPL has published 2026/27 data. The Next Season Planner is now using next-season prices."

### Complexity
**Low-Medium.** Pipeline detection logic is ~30-50 LOC. The UX work (banner, status pill, two-phase activation) is the larger surface — probably 4-5 components, mostly empty-state branching. Existing `IS_OFF_SEASON` gate is the natural seam.

### Dependencies on existing components
- `pipeline/run.py` IS_OFF_SEASON gate (invert/extend it — `IS_OFF_SEASON` and `IS_PRESEASON_DETECTED` are distinct states).
- `archive_season.py` 50% guard pattern — reuse for atomicity.
- `NextSeasonPlannerTab` graceful empty state — extend with "awaiting data" copy.
- `LastUpdated` ticker — reuse for "last checked" timestamp.
- New `useNextSeasonStatus()` hook reading from a small `next_season_status.json` blob.

---

## WATCH-01/04: Transfer Target Watchlist

### Table Stakes
- **Pin/unpin a player from GemTable** — leverages the existing tap-to-expand row pattern (MOB-TBL-06) and existing pin/compare actions. One new action button next to Compare. No new modal.
- **Persistent across sessions** — localStorage, same pattern as decision history ring buffer and squad snapshots (already established).
- **Show on a dedicated tab/section** — likely under Plan section as `watchlist` sub-tab, similar to how `next-season` was added after `rivals`. Mobile-first 1-column card layout, desktop 2-3 column grid.
- **Per-card data points** (the non-negotiables FPL managers expect):
  - Current price + last 7-day delta (use existing `cost_change_event` field)
  - Ownership % (use existing `selected_by_percent`)
  - Position + team + shirt colour or badge
  - News badge (reuse `NewsBanner` component, already gated by 14-day staleness in NEWS-01)
- **Bulk action: clear watchlist** — single button with confirm step. Matches the manual planner reset pattern.
- **Empty state** — first-run users need a clear "Pin players from the Gem Ratings table to track them here." Critical: 50%+ of users miss watchlist features because pinning is hidden in row actions.

### Differentiators
- **Squad overlap badge** — for each watched player, show whether they're in the user's current Pre-Season Squad (NSP-02 output) via a small badge: `In planned squad` (green) / `Not in squad` (zinc). This is the bridge to the squad simulator — instantly answers "should I be planning around this player?"
- **Price trend sparkline** — tiny 7-day sparkline using the existing `cost_change_event` + history. Differentiates vs competitors who show only static deltas. Reuse `PriceTrendCell` styling.
- **Group by position** by default — FPL managers think in positions (need a GK, 5 DEFs etc), not alphabetical. Toggle to sort by price/ownership/news-most-recent.
- **News-newest badge** — surface watchlist players who have **fresh** news (added in last 48h) at the top automatically. Matches the Summer Window Tracker's article-feed feel. Provides "what changed since I last checked" without forcing the user to scan all cards.
- **Confirmed signing surfacing** — if a watchlist player has a `ConfirmedSigningBadge` (already implemented for v1.24), show it prominently on the card. Two birds, one stone: validates the watchlist as a multi-source signal aggregator.
- **Compact density** — watchlists for FPL managers commonly hit 20-40 players. Cards must be scannable; long descriptions and large avatars don't scale. Aim for ~80-100px card height on desktop.

### Anti-Features (do NOT build)
- **Custom notes per player.** Users say they want it; usage data from todo apps and Pocket shows <5% actually use notes. Adds DB-like complexity to a JSON localStorage blob.
- **Folders/categories for watchlists.** Same trap. A single flat list of 20-40 players is the sweet spot. If the user truly needs more, FPL Scout has paid tooling for this.
- **Sharing the watchlist via URL.** Personal tool, no multi-user. Adds zero value.
- **Price-change alerts via push/email/notifications.** Out of scope (no infra). The dashboard view is sufficient.
- **Automatic suggestions to add players.** No "you might also like" — keep it pure user intent. The Gem Ratings table already surfaces recommendations.
- **Drag-to-reorder.** Sort options cover this. Drag handles on mobile + 30 cards = bad ergonomics.

### UX Pattern
- **Pin action** in GemTable row: a star/pin icon between Compare and the existing actions. Filled state = pinned. Tap → optimistic toggle, optimistic localStorage write, toast confirmation "Added [name] to watchlist" with Undo (3s).
- **Watchlist tab** as a sub-tab of Plan section, after `next-season`. Card grid (mobile: 1col, sm: 2col, lg: 3col). Each card: player name + position pill + team badge + price + sparkline + ownership% + news badge + squad-overlap badge. Tap card to expand (reuse existing PlayerComparisonModal? Or a lighter inline expansion).
- **localStorage schema** — keep flat:
  ```ts
  interface WatchlistEntry {
    id: number              // FPL player ID
    pinned_at: string       // ISO 8601
    last_price_seen: number // for delta-since-pin tracking (differentiator)
  }
  type Watchlist = WatchlistEntry[]  // localStorage key: 'fplx_watchlist'
  ```
- **Delta-since-pin** — show a small "+0.2 since pinned" or "-0.1 since pinned" delta on each card. Requires `last_price_seen` field. High signal for managers tracking price movement on targets.
- **News card prominence** — if a watched player has `news_added` in last 48h, the card gets an amber left border (4px) and surfaces to the top of its position group. This is the **what-changed** UX everyone steals from RSS readers.

### Complexity
**Medium.** New tab + card component + new localStorage hook + GemTable action button. ~200-300 LOC across 4-5 files. The squad-overlap calculation is trivial (set intersection on player IDs). Risk: getting the card density right takes iteration; build with low-data state in mind (1 player) AND high-data state (40 players, sticky filters).

### Dependencies on existing components
- `GemTable` row actions (extend createColumns factory).
- `useLocalStorage`-style hook (may need to write a small one; not seeing a generic one in the codebase, but `useDecisionHistory` uses the ring-buffer pattern).
- `NewsBanner` component (NEWS-01/02 — reuse, including 14-day staleness gate).
- `ConfirmedSigningBadge` (v1.24 — reuse from summer window).
- `PriceTrendCell` (v1.0 — reuse for sparkline-adjacent display).
- `usePreSeasonSquad()` (v1.24 — read pre-season squad for overlap calculation).
- `usePlayers()` for canonical player data (existing 6h staleTime).

---

## COST-01: Squad Cost Simulator

### Table Stakes
- **Slider control** with a sensible range. FPL gives each manager 100m. The historical sweet spot of "interesting" budgets is **98.5m – 101m** (the user's described range is correct). Below 98.5m gets dull (drops in expensive premiums), above 101m is hypothetical only.
- **Live update of the displayed squad** as the slider moves — but **debounced** to avoid hammering the ILP solver (which runs server-side via `/api/pre-season-squad`).
- **Visual feedback during pending compute** — loading skeleton on the formation grid, or a subtle opacity dip + spinner overlay. Without this, users assume the app is broken.
- **Numeric input alongside slider** for power users who want to type 99.7 directly. Common pattern in financial calculators.
- **Reset to 100.0** button — the canonical FPL budget.
- **Show budget actually used** vs budget allowed — e.g. "Used: 99.8 / Allowed: 100.0" so the user sees the ILP didn't necessarily spend every penny.

### Differentiators
- **Delta view** — show which players were swapped in/out vs the canonical 100.0 squad as the slider moves. Two-column "Added / Removed" panel below the formation grid. Critical insight: at 99.5m budget, who do you lose vs 100m? This is the "aha" the simulator should deliver.
- **xPts-equivalent or PPM-equivalent total** alongside budget used. So the manager sees: "99.5m saves 0.5m but loses 3.2 ppm of squad value." Quantifies the trade-off in the language the ILP is already optimising on.
- **Position-pinned mode** — let the user lock specific players (e.g. "I'm definitely owning Salah") and watch the ILP re-solve the remaining 14 slots within remaining budget. This is the killer feature competitors don't have. Adds complexity but huge value.
- **Budget tick marks at semantic points** — 98.0 ("tight"), 100.0 ("default"), 101.5 ("hypothetical chip-fund"). Visual scaffolding for users who don't know what to try.

### Anti-Features (do NOT build)
- **Auto-running the slider through every value on mount** to pre-compute a curve. Tempting for instant feedback, but ILP is ~1-3s per solve and 30 budget values × 1.5s = 45s of compute per page load. The user will probably try 3-5 budgets, max.
- **Multi-objective sliders** ("maximise xPts vs minimise variance"). Out of scope — keep one slider. Adds cognitive load.
- **Showing the full ILP solution tree.** The internal solver state is not user-facing intelligence.
- **Decimal step size below 0.1m.** FPL prices are in 0.1m increments; 0.05 steps would imply non-existent precision.
- **Slider on mobile that requires fine motor control.** Mobile gets large +/- buttons next to a numeric display. Sliders below ~12px range on mobile are unusable.

### UX Pattern
- **Debounce: 350-500ms after last slider movement** before calling `/api/pre-season-squad?budget=N`. Use a `useDebouncedValue` hook (or `useEffect` + setTimeout). Avoid debounce <250ms — feels jittery on the network round-trip. Avoid >600ms — feels laggy.
- **Skeleton state for the formation grid** while compute is in-flight. Reuse existing loading skeleton patterns from `NextSeasonPlannerTab` empty/loading states.
- **Slider above the formation grid** — visually anchored to the grid it modifies. Don't put it in a settings panel.
- **Snap-to-step** at 0.1m increments. Slider thumb shows current value with a tooltip; track shows tick marks at 99.0, 100.0, 101.0.
- **State persistence** — last-used budget stored in localStorage (`nsp_budget`) so a returning user picks up where they left off. Default to 100.0 on first visit.
- **Mobile fallback**: slider with `min-h-[44px]` (MOB-TOUCH-01) and a flanking `-0.1` / `+0.1` button pair, plus numeric input. Keeps the UX usable on a 375px screen.
- **Error state**: if ILP returns null at this budget (e.g. budget too low), show an inline message "No valid 15-player squad at £98.0m. Try a higher budget." Tie into GREEDY-NULL telemetry below.

### Complexity
**Medium-High.** The slider + debounce is straightforward (~50 LOC). The ILP wiring is mostly done already (`/api/pre-season-squad` exists). The delta view (added/removed players) requires diffing two PreSeasonSquad results — a small pure function. The position-pinned mode (differentiator) adds significant complexity: requires extending `suggest_squad.py` to accept a `pinned_ids` param threaded to the ILP as forced `x_i = 1` constraints. Recommend shipping the basic slider first, then position-pinning as a follow-up.

### Dependencies on existing components
- `suggest_squad.py` `_solve_ilp(players, score_map, budget, team_cap)` — already parameterised. The `budget` param is exactly what the slider drives.
- `/api/pre-season-squad` route — extend to accept a `budget` query param (currently uses default).
- `usePreSeasonSquad()` hook — needs to accept a budget arg and re-fetch on change. Or new `usePreSeasonSquadWithBudget(budget)` hook.
- `NextSeasonPlannerTab` formation grid — wrap with a loading state during pending fetches.
- `buildPreSeasonSquad()` TypeScript fallback — must also accept budget. Currently I believe it does (passes through to the ILP call). Verify on implementation.

---

## GREEDY-NULL: Telemetry & Reporting

### Table Stakes
- **Track the rate** at which `buildPreSeasonSquad()` returns null vs a valid squad. Today this is invisible — failures degrade silently to the ILP fallback. Telemetry is the only way to know if greedy is good enough or systematically broken.
- **Two telemetry surfaces**:
  1. **Pipeline-side**: log structured line `[suggest_squad] greedy_null=true budget=1000 reason=...` when `_solve_ilp` is invoked because greedy returned null. Aggregate over runs.
  2. **Runtime-side**: when the user moves the COST-01 slider, count how often greedy returns null at that budget (purely client-side; never sent off-device).
- **Surface the rate to the developer**, not the user. This is internal calibration — does not need a flashy UI.
- **No PII / no team ID leakage** — even though it's a personal tool. Logs should be parameter-shaped (budget, position counts), not user-identifying.

### Differentiators
- **Inline "fallback used" indicator** on the formation grid when the squad came from ILP rather than greedy. Tiny badge: `Optimal (ILP)` vs `Heuristic (Greedy)`. Subtle, but it signals to the user *why* the result is good (or merely sufficient).
- **Reason classification** for null returns: `budget_too_low`, `position_quota_unmet`, `team_cap_hit`, `no_eligible_players_in_pool`. Helps drive future improvements to the greedy heuristic.
- **Comparison across budget values** — if the simulator is being used heavily, surface a small dev-only stat panel: "Greedy nulls in last 10 budget tries: 3 (30%)." Off by default; behind a debug flag.

### Anti-Features (do NOT build)
- **Telemetry sent to a server.** Personal tool, no analytics infra. Keep it console.log or local file.
- **Forcing the user to choose greedy vs ILP.** They shouldn't care. The system should always pick the better answer.
- **Auto-tuning the greedy heuristic** based on null rate. Premature optimisation; measure first.
- **Showing null rates to the end user as a metric.** Confusing, low signal.

### UX Pattern
- **Console logging** for runtime nulls — structured: `[buildPreSeasonSquad] returned null budget=1000 trigger=cost_simulator`.
- **Pipeline logging** for batch nulls — same format, aggregated by pipeline run.
- **Optional `?debug=1` query param** that surfaces an info panel on `NextSeasonPlannerTab` showing the last 10 ILP/greedy outcomes with reasons. Strictly dev-facing.
- **Implicit signal** — if greedy null rate exceeds threshold (e.g. >40%), automatically widen the greedy search or switch to ILP-first. But: don't build the auto-switching until you have the data to justify it.

### Complexity
**Low.** ~20-30 LOC of logging in `pre-season-squad.ts` and `suggest_squad.py`. Optional debug panel is another 50 LOC. Don't over-engineer — this is observability, not a feature.

### Dependencies on existing components
- `buildPreSeasonSquad()` (`src/lib/pre-season-squad.ts`) — add structured console.warn when returning null.
- `suggest_squad.py` — add structured stdout when `_solve_ilp` is reached as fallback.
- `/api/pre-season-squad` route — pass through error reasons if ILP also fails (currently 404s).
- No new components required for the must-haves. Optional debug panel could be a small `<DebugInfo />` component gated on `process.env.NEXT_PUBLIC_DEBUG`.

---

## Cross-cutting MVP Recommendation

**Ship order** (smallest blast radius first, biggest UX win last):

1. **GREEDY-NULL telemetry first** — invisible to user, gives data to inform every other feature. ~1 day's work.
2. **AUTO-01 detection + status banner** — the foundation. Without auto-activation, nothing else lights up automatically when the season turns. ~2-3 days.
3. **WATCH-01/04 watchlist** — biggest user-facing value, most independent feature, can ship without COST-01 being done. ~3-4 days. Most of the v1.25 value sits here.
4. **COST-01 budget simulator (basic)** — slider + ILP wiring + delta view. ~2-3 days. Defer position-pinning (differentiator) to a follow-up phase.

**Defer to a future milestone**:
- Position-pinning in COST-01 (high value, but adds complexity that risks the milestone).
- Notification/alert system for watchlist (out of scope — no infra).
- Multi-watchlist / shared watchlists / collaboration features (anti-feature).

---

## Sources

- [Fantasy Football Fix — 2025/26 launch date](https://www.fantasyfootballfix.com/blog-index/fpl-2025-26-game-launch-announced/) — MEDIUM confidence (publication may shift YoY)
- [Fantasy Football Fix — 2025/26 player prices](https://www.fantasyfootballfix.com/blog-index/fpl-2025-26-player-price-revealed-update/) — MEDIUM
- [Premier League — new player prices 2025/26](https://www.premierleague.com/en/news/4363681/see-the-prices-of-new-players-added-to-202526-fantasy) — HIGH (official PL)
- [LiveFPL Price Predictor](https://www.livefpl.net/prices) — competitor pattern reference
- [FPL Dashboard — Price Changes](https://fpl.page/price-changes) — competitor pattern reference
- [FPL Core](https://www.fplcore.com/price-changes) — competitor pattern reference
- [Fantasy Football Fix — toolbox/web features](https://www.fantasyfootballfix.com/web_features/) — watchlist + notification patterns
- [Fantasy Football Scout — Price Predictions](https://www.fantasyfootballscout.co.uk/fpl/price-predictions/) — UX reference
- [Sportmonks — Building a real-time Livescore app: best practices](https://www.sportmonks.com/blogs/building-a-real-time-livescore-app-with-a-football-api-best-practices/) — polling UX patterns
- [Eleken — Slider UI examples](https://www.eleken.co/blog-posts/slider-ui) — slider UX patterns
- [useHooks — useDebounce](https://usehooks.com/usedebounce) — debounce hook implementation reference
- [FPL API Endpoints guide (Medium)](https://medium.com/@frenzelts/fantasy-premier-league-api-endpoints-a-detailed-guide-acbd5598eb19) — bootstrap shape reference

**Codebase references inspected** (HIGH confidence):
- `src/lib/types.ts` — `PreSeasonPlayer`, `PreSeasonSquad`, `TransferNewsArticle`, `news_added`, `news_severity`
- `pipeline/suggest_squad.py` — `_solve_ilp(players, score_map, budget=BUDGET, team_cap=TEAM_CAP)` signature confirmed
- `src/lib/pre-season-squad.ts` — `buildPreSeasonSquad()` returns `PreSeasonSquad | null`
- `src/lib/hooks/usePreSeasonSquad.ts` — 404→null TanStack Query pattern
- `src/components/news/NewsBanner.tsx` — 14-day staleness gate reused
- `.planning/PROJECT.md` — milestone goals and existing IS_OFF_SEASON gate
