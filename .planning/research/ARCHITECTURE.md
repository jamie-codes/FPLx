# Architecture Patterns — v1.16 Modelling & Trust Integration

**Domain:** FPL Analyst — subsequent milestone integration (5 SUBSEQUENT features added to existing app)
**Researched:** 2026-05-09
**Overall confidence:** HIGH (existing v1.14/v1.15 code paths verified by direct read of `pipeline/run.py`, `pipeline/data_health.py`, `pipeline/set_piece_quality.py`, `.github/workflows/pipeline.yml`, `src/app/api/data-health/route.ts`, `src/lib/hooks/useDataHealth.ts`, `src/components/accuracy/AccuracyTab.tsx`, `src/components/planner/ManualPlanTab.tsx`)

This document focuses on the **five v1.16 features that need integration reasoning**: SCRAPER-01, REFRESH-01, DH-04, BACK-01, SPQ-04. The four pure-modelling features (MC-01, CAL-01, SENS-01, WHY-01) follow the established XPtsCell / AccuracyTab patterns documented in the v1.14 baseline below and need no new architectural pattern.

---

## Existing Architecture (Verified Baseline — v1.15 shipped)

```
              +-------------------------------+
              | GitHub Actions cron (4x daily)|
              | .github/workflows/pipeline.yml|
              | (cron only — no event triggers)|
              +---------------+---------------+
                              |
                              v
+-------------------------------------------------------------+
| pipeline/run.py  (orchestrator — try/except wraps all)      |
|   fetch bootstrap + fixtures + element-summary (shared)     |
|   understat_client.get_understat_players() (24h cache)      |
|   xmins -> bonus -> saves (NEW v1.14) -> merge_players      |
|   _diff_sp_snapshots, set_piece_quality.run_sp_quality      |
|   insights, gw_intel, price_changes, defcon, accuracy       |
|   prose_summary -> last_updated.json -> data_health.json    |
+--------------------------+----------------------------------+
                           |
                           v   pipeline/cache/ (local) + Vercel Blob (prod)
              +------------+------------------+
              | merged_players.json           |  <-- single source of truth
              | captain_picks.json            |
              | accuracy_backtest.json        |
              | set_piece_changes.json        |
              | set_pieces_snapshot.json      |  <-- internal diff state
              | sp_quality.json               |  <-- v1.14 set-piece danger
              | insights.json / gw_intel.json |
              | price_changes.json            |
              | data_health.json              |  <-- v1.15 (DH-01..03)
              | last_updated.json             |
              +------------+------------------+
                           |
                           v
+--------------------------+----------------------------------+
| Next.js 16 Route Handlers (/api/*)                          |
|  pattern: list({prefix}) -> fetch blob OR readFile cache    |
|  /api/data-health (NO CDN cache, 60s refetchInterval)       |
|  /api/players, /api/accuracy, /api/set-pieces, ...          |
+--------------------------+----------------------------------+
                           |
                           v
+--------------------------+----------------------------------+
| TanStack Query hooks (6h staleTime convention)              |
|  EXCEPT useDataHealth: staleTime:0 + 60s refetchInterval    |
+--------------------------+----------------------------------+
                           |
                           v
+-----------------------------------------------------------+
| React Components — section/sub-tab routing in page.tsx    |
|  AccuracyTab.tsx contains DataHealthPanel inline (706+)   |
|  SetPieceTakerPanel reads useSetPieces (incl. sp_quality) |
|  ManualPlanTab persists ManualPlan via loadManualPlan()   |
|    (localStorage key: fplx_manual_plan)                   |
+-----------------------------------------------------------+
```

**Verified conventions to preserve:**

1. `merge.py` is the central join point. Player-row data flows through `merge_players(...)` returning `(merged, captain_picks)`. Sub-modules (`xmins`, `bonus`, `saves`) compute pre-merge `dict[player_id -> stats]` consumed as kwargs.
2. **Non-player-row artifacts get their own JSON file written by `run.py` + their own `/api/*` route + their own `useX` hook** (insights, accuracy, set-piece changes, gw_intel, sp_quality, data_health). This is the canonical "new pipeline output" pattern.
3. Feature gates flow `accuracy_backtest.json -> run.py -> merge_players(...)` (`xmins_v2_enabled`, `bonus_predictor_enabled`, `form_signal_enabled`, `save_predictor_enabled`). Default OFF; flip after non-regression shadow run.
4. **DataHealthPanel already exists inline in `AccuracyTab.tsx` (line 706+)** — DH-04 extends this existing component, NOT a new file.
5. **`data_health.json` already has a `timestamps` dict** (per-artifact ISO write times) — DH-04 needs a NEW persistent structure (history array), not an extension of `timestamps`.
6. **`run.py` writes per-artifact via `save(name, data)`** (`pipeline/upload.py`) which routes to local filesystem or Vercel Blob based on `USE_BLOB` env var. Persistent state across runs is achieved via the read-prior-then-write pattern (see `_diff_sp_snapshots` reading `set_pieces_snapshot.json` at run.py:269, and `data_health.compute_data_health` reading `prior_path` at data_health.py:114).
7. **Manual transfer plans use pure-localStorage persistence** (`loadManualPlan`, key `fplx_manual_plan`) — BACK-01 history can follow the same pattern but **must consider durability tradeoffs** (see BACK-01 section below).
8. **`pipeline.yml` is cron-only** with `workflow_dispatch` enabled — REFRESH-01 needs additional `schedule:` entries OR an event-detection job that conditionally calls workflow_dispatch. No external orchestrator exists today.

---

## Feature 1 — SCRAPER-01: FPL News Scraper

### Goal

Pull injury / suspension / press-conference news from a public source and surface as flags on `MergedPlayer.news_flag` so `TransferPanel` and `GemTable` can render warning badges. FPL's own bootstrap-static `news` field is sparse and lags behind verified press conferences.

### Critical Architectural Concern: Source Selection

The existing pipeline has **only two scrape clients**: `understat_client.py` (season totals page) and `understat_shots_client.py` (per-team shot pages, added in v1.14). Both target Understat — a single, known-stable host. SCRAPER-01 introduces a **new external dependency surface**, which is the highest architectural risk in v1.16.

| Source | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **A. FPL bootstrap `news` field** | Already fetched, zero new HTTP, official | Lags press conferences by hours; sparse (only severe injuries); often empty pre-deadline | Use as **floor** — always include, never the only source |
| **B. Premier Injuries (premierinjuries.com)** | Comprehensive, dedicated injury feed | Scraping ToS unclear; HTML structure brittle; no API | **NOT recommended** — ToS risk for personal tool unjustified |
| **C. RSS aggregator (Sky Sports / BBC sport tag feeds)** | Public RSS = sanctioned for consumption; stable XML | News is freeform text, not player-keyed; needs NLP to map to FPL players | **Recommended secondary** with web_name regex match |
| **D. Fantasy Football Scout free tier** | FPL-keyed news | Requires login / paid for full feed | Out of scope (auth) |

**Recommendation: A + C.** Always emit FPL `news`; layer C on top via a freeform-text-to-`web_name` matcher with confidence scoring. **Ship behind `news_scraper_enabled` gate** (default False) so a brittle source can be disabled without code changes.

### Data Flow

```
+----------------------------------+    +----------------------------------+
| bootstrap['elements'][i]['news'] |    | RSS feeds (NEW: news_scraper.py) |
| (already fetched in run.py)      |    | feedparser over Sky/BBC feeds    |
+----------------+-----------------+    +-----------------+----------------+
                 |                                        |
                 |   tuple of (player_id, source, text)   |
                 +-------------------+--------------------+
                                     |
                                     v
              +-----------------------------------------+
              | pipeline/news.py (NEW)                  |
              |   compute_news_flags(bootstrap, rss)    |
              |     -> dict[player_id -> {              |
              |          flag: 'injury'|'suspension'|   |
              |                'doubt'|'rotation',      |
              |          source: 'fpl'|'rss',           |
              |          text: str (truncated 140),     |
              |          last_updated_iso: str          |
              |        }]                               |
              +------------------+----------------------+
                                 |
                                 v   merge_players(news_stats=...) kwarg
              +------------------+----------------------+
              | merge.py — adds player['news_flag'] and |
              | player['news_text'] to each merged row  |
              +------------------+----------------------+
                                 |
                                 v   merged_players.json -> /api/players
                                 v
              +------------------+----------------------+
              | TransferPanel + GemTable                |
              |   render NewsFlag badge in player cell  |
              |   tooltip shows news_text + source      |
              +-----------------------------------------+
```

### Why merge.py kwarg (not separate JSON)

Per-player flags belong on the player row (same justification used for `xPts_components_1gw`, `regression_signal`, `differential_flag`, `news_text`). A separate `news.json` would force every consumer (`TransferPanel`, `GemTable`, `OptimiserPanel`, `DecisionSummaryTab`) to add a join. Player-row enrichment is the cheaper integration.

### New Files

| Path | Purpose |
|------|---------|
| `pipeline/news.py` | `compute_news_flags(bootstrap, rss_items)` -> `dict[player_id -> {flag, source, text, last_updated_iso}]`. Pure transform; no HTTP. |
| `pipeline/news_client.py` | RSS feed fetcher: `fetch_news_items() -> list[dict]`. Hand-rolled (no `feedparser` dep) — uses `requests` + `xml.etree.ElementTree` to keep dependency footprint flat. 24h cache mirrors `understat_client` shape. |
| `tests/pipeline/test_news.py` | Unit tests for flag classification (regex on news text), web_name matching (collisions: Son vs Son Jr), confidence threshold. |
| `src/components/shared/NewsFlag.tsx` | Small badge component (red=injury, amber=doubt, zinc=rotation); HTML title tooltip; mirrors `RegressionSignalBadge` shape. |
| `tests/components/shared/NewsFlag.test.tsx` | RTL tests. |

### Modified Files

| Path | Change |
|------|--------|
| `pipeline/merge.py` | Add `news_stats` kwarg; for each player set `player['news_flag']` and `player['news_text']` from the dict (default `None`). Add `news_scraper_enabled` gate kwarg (when False, fields default to FPL bootstrap `news` text only). |
| `pipeline/run.py` | Import `compute_news_flags` and `news_client.fetch_news_items`; **wrap in try/except** (mirrors `prose_summary` at line 343) so a feed failure does NOT poison `merged_players.json`. Read `news_scraper_enabled` from `accuracy_backtest.json.summary` (default False). |
| `pipeline/accuracy.py` | Add `news_scraper_enabled` to `AccuracySummary`; bump `FORMULA_VERSION` to `v1.16-a`. |
| `src/lib/types.ts` | Extend `MergedPlayer`: `news_flag?: 'injury' \| 'suspension' \| 'doubt' \| 'rotation' \| null`, `news_text?: string`, `news_source?: 'fpl' \| 'rss'`, `news_updated_iso?: string`. |
| `src/components/transfers/TransferPanel.tsx` | Render `<NewsFlag />` next to player name where `news_flag` set. |
| `src/components/gem-table/columns.tsx` | Add NewsFlag inline beside `web_name` in the player-name accessor cell. NO new column (visual annotation only — keeps mobile layout intact). |
| `src/components/accuracy/AccuracyTab.tsx` | Extend `GATE_LABEL` map with `news_scraper_enabled: 'news scraper'`. |

### Integration Points

- **Reuses existing `usePlayers()` pipe.** No new API route, no new hook. Player-row enrichment.
- **Cache discipline:** RSS sources MUST be cached at least 1h to avoid hammering Sky/BBC on every cron tick (4x daily * 5+ feeds = 20 requests/day; with 1h cache that drops to ~5 effective requests). Use the `understat_client.py` 24h JSON-cache pattern but parameterise TTL.
- **Failure mode:** A scrape failure must produce `news_flag = bootstrap_news_only` (i.e. fall back to FPL field). The orchestrator's try/except in `run.py` catches scrape exceptions; `compute_news_flags` itself must never raise — it returns the FPL-only baseline if `rss_items` is empty/missing.
- **`web_name` collision risk:** "Son", "Silva", "Diaz" appear multiple times. The matcher MUST require a **two-token confirmation** (web_name + team short_name OR full second_name) before tagging. Sample-of-one match -> drop. Document this in `pipeline/news.py` docstring.
- **Gate discipline:** Ship `news_scraper_enabled=False`; audit 7 days of pipeline output for false positives; flip after manual review.

---

## Feature 2 — REFRESH-01: Event-Based GitHub Actions

### Goal

Today the pipeline runs 4x daily on a fixed UTC cron (`0 6,12,18,0 * * *`). FPL deadlines (typically Friday 18:30 BST or Saturday 11:30 BST) often fall **between** cron ticks — a deadline at 18:30 BST sees a stale snapshot from 18:00 UTC (~30 min old) but no fresh run until midnight. REFRESH-01 wants a refresh **30 minutes before** every gameweek deadline.

### Critical Architectural Concern: GitHub Actions Has No "Conditional Cron"

GitHub Actions `schedule:` accepts only static cron expressions — there is no way to say "30 min before each FPL deadline". Three architectures are viable:

| Option | Approach | Trade-off |
|--------|----------|-----------|
| **A. Dense cron + early-exit** | Increase cron to every 30min during deadline windows (e.g. Fri 16-22 UTC, Sat 08-13 UTC); each run checks "is the next deadline within 30-90 min?" — if not, exit 0 fast. | Simple; **no new infra**. Wastes ~20 cron tics/week on idle starts (each costs ~30s for checkout/python-setup). Free tier covers it. **Recommended.** |
| **B. Self-scheduling job** | Pipeline reads `bootstrap.events`, computes the next deadline, then schedules the next run via `gh workflow run` with a delay. | Requires `gh` auth from the runner; debugging async workflow chains is brittle. |
| **C. External scheduler (Vercel cron)** | Vercel cron job hits `/api/refresh` which dispatches the workflow. | Adds Vercel paid feature OR another runtime; route handler also needs PAT for `gh` API. **Complexity tax not worth it.** |

**Recommendation: Option A — dense conditional cron.** This is the canonical GitHub Actions pattern for deadline-aware refresh. The pipeline already fetches `bootstrap` on every run (cheap once cached); the early-exit gate runs in <2s.

### Data Flow

```
+----------------------------------+
| .github/workflows/pipeline.yml   |
|   schedule:                      |
|     - cron: '0 6,12,18,0 * * *'  |  <-- existing 4x daily (preserve)
|     - cron: '*/30 16-22 * * 5'   |  <-- NEW Fri 16-22 UTC every 30min
|     - cron: '*/30 8-13 * * 6'    |  <-- NEW Sat 08-13 UTC every 30min
|     - cron: '*/30 10-15 * * 0'   |  <-- NEW Sun 10-15 UTC every 30min
|   workflow_dispatch:             |  <-- existing
+----------------+-----------------+
                 |
                 v
+----------------+-----------------+
| Job step BEFORE run.py:          |
|   refresh-gate.py (NEW small)    |
|   reads cached bootstrap (or     |
|   fetches if absent), finds next |
|   event with finished=false,     |
|   parses deadline_time.          |
|   exit 0 (skip) if NOT in        |
|   refresh window:                |
|     - within 90min before deadline|
|     - within 60min after deadline|
|     - OR scheduled cron tick is  |
|       the 4x-daily cron (always  |
|       run those — preserves      |
|       baseline freshness)        |
+----------------+-----------------+
                 |
                 v   if gate passes:
                 v
        existing python pipeline/run.py
```

### Why Pre-Pipeline Gate (not Inside run.py)

Putting the gate inside `run.py` means every run still does Python setup + imports + bootstrap fetch even when we'd skip — defeats the cost savings. A separate `refresh-gate.py` step that exits non-zero (or sets a job output) lets the main `Run pipeline` step be conditional:

```yaml
- name: Refresh gate
  id: gate
  run: python pipeline/refresh_gate.py
  continue-on-error: true

- name: Run pipeline
  if: steps.gate.outcome == 'success'
  run: python pipeline/run.py
```

### New Files

| Path | Purpose |
|------|---------|
| `pipeline/refresh_gate.py` | Small standalone script. Detects current cron schedule via env var (`GITHUB_EVENT_NAME`, `github.event.schedule`), reads cached `fpl_bootstrap.json` if present (or fetches fresh — 1 HTTP call), finds next unfinished GW deadline, decides skip-or-run. Exit 0 = run; exit 1 = skip (paired with `continue-on-error: true` so the workflow doesn't fail). Logs the decision. |
| `tests/pipeline/test_refresh_gate.py` | Tests: 4x daily cron always passes; deadline-window crons pass when next deadline within 90min; deadline-window crons skip otherwise; missing bootstrap falls back to "always run". |

### Modified Files

| Path | Change |
|------|--------|
| `.github/workflows/pipeline.yml` | (1) Add 3 new `schedule:` entries (Fri/Sat/Sun deadline windows in UTC). (2) Add `Refresh gate` step before `Run pipeline`. (3) Make `Run pipeline` conditional on `steps.gate.outcome == 'success'`. |

### Integration Points

- **No new code in `run.py`.** Gate is a separate concern; `run.py` stays a black-box orchestrator.
- **Bootstrap cache reuse:** `refresh_gate.py` reads `pipeline/cache/fpl_bootstrap.json` if it exists; falls back to a fresh `get_bootstrap_static()` call only if cache missing. On a clean runner cache is always missing (GitHub Actions runners are ephemeral) — so we accept 1 extra bootstrap fetch on gate runs. ~50KB, fast.
- **Deadline format:** `bootstrap.events[i].deadline_time` is ISO-8601 UTC. Parse via `datetime.fromisoformat()`; compare to `datetime.now(timezone.utc)`. Window check: `-90min <= delta <= +60min` (post-deadline run captures team-locked snapshots for `accuracy_backtest`).
- **DST safety:** Cron is UTC; FPL deadlines are stored in UTC in bootstrap. **Do not** translate to BST. The Sat 08-13 UTC window covers both 11:30 BST (10:30 UTC during BST) and 12:30 GMT deadlines.
- **Cost:** GitHub Actions free tier = 2,000 min/month. Current usage: 4 runs/day * ~3 min = 360 min/month. Added: ~30 gate runs/week * 30s = 60 min/month. New total: ~420 min/month. Comfortably within budget.

---

## Feature 3 — DH-04: Sparkline in DataHealthPanel

### Goal

Display the last 7 pipeline run statuses (ok / warn / error) as a sparkline above the existing sanity_checks table in the `DataHealthPanel` (already in `AccuracyTab.tsx:706`). Lets the user see "is this an isolated bad run, or has the pipeline been degrading for days?".

### Critical Architectural Concern: Where to Persist History

`data_health.json` today is **rewritten in full on every run** (no append). The sanity_checks for the *current* run are visible; prior runs are gone. Three options:

| Option | Approach | Trade-off |
|--------|----------|-----------|
| **A. Extend `data_health.json` with `history` array** | On each run, append `{generated_at, overall_severity}` to a rolling 7-entry array; oldest entries dropped. Read prior `data_health.json` (already done at line 114) to seed. | **Zero new artifacts, zero new routes, zero new hooks.** History travels with the existing payload. **Recommended.** |
| B. New `data_health_history.json` | Separate file mirroring `set_pieces_snapshot.json` pattern. | Two files for one feature; UI needs join. Worse than A. |
| C. localStorage on client | Tab the user has open accumulates history. | Useless on first load; resets on cache clear; per-device. **Not viable** — observability data must be server-side. |

**Recommendation: Option A.** Drop a `history` array onto the existing JSON.

### Data Flow

```
+----------------------------------+
| pipeline/data_health.py          |
|   compute_data_health(...)       |
|   line 114: read prior file      |  <-- already does this for prev_player_count
|   prev = load_prior()            |
|   prior_history = prev.get(      |
|     'history', [])               |
|                                  |
|   sanity_checks = [...]          |  <-- already computed
|   overall_severity = max(        |  <-- NEW derived field
|     [c['status'] for c in        |
|     sanity_checks])              |
|     priority: error>warn>ok      |
|                                  |
|   new_entry = {                  |
|     'generated_at': now_iso,     |
|     'overall_severity':          |
|     overall_severity             |
|   }                              |
|   history = (prior_history       |
|     + [new_entry])[-7:]          |  <-- rolling window of 7
|                                  |
|   result['history'] = history    |
|   result['overall_severity']     |
|     = overall_severity           |
|   save('data_health.json',       |
|     result)                      |
+----------------+-----------------+
                 |
                 v   /api/data-health (UNCHANGED — passthrough)
                 v   useDataHealth (UNCHANGED — 60s refetch)
                 v
+----------------+-----------------+
| AccuracyTab.tsx                  |
|   DataHealthPanel (line 706)     |
|     <DataHealthSparkline         |
|       history={data.history} />  |  <-- NEW sub-component
|     <SanityCheckTable ... />     |  (existing rendering, unchanged)
+----------------------------------+
```

### Why This Pattern Is Safe

`compute_data_health` already reads its own prior output to compute `prev_player_count` (data_health.py:113-121). Extending that read to also pull `prior_history` is a one-line change. **First-run safety:** `prev.get('history', [])` returns `[]` when prior file is absent — the array seeds empty and grows monotonically until reaching 7. **Failure-run safety:** When `run.py`'s except branch fires, `data_health.json` is NOT updated, but that's fine — sparkline shows the last 7 *successful* runs (which is what the user actually wants to see; failure visibility comes from `last_updated.stale`).

### New Files

| Path | Purpose |
|------|---------|
| `src/components/accuracy/DataHealthSparkline.tsx` | Pure presentational component. Props: `history: HistoryEntry[]`. Renders 7 small coloured dots (red/amber/green) via inline SVG OR a row of pure-CSS divs. No external sparkline dependency — 7 data points doesn't justify a library. |
| `tests/components/accuracy/DataHealthSparkline.test.tsx` | RTL tests: empty history → em-dash; <7 entries → renders only available dots; mixed severity → correct colour mapping. |

### Modified Files

| Path | Change |
|------|--------|
| `pipeline/data_health.py` | (1) Compute `overall_severity` from `sanity_checks` (priority: error > warn > ok). (2) Read `prior_history` from existing `prior_path` block. (3) Append new entry; truncate to last 7. (4) Add `history` and `overall_severity` keys to returned dict. |
| `tests/pipeline/test_data_health.py` | Add tests: history grows from 0 → 7; oldest entry drops on 8th run; first-run history has 1 entry; overall_severity derives correctly. |
| `src/lib/types.ts` | Extend `DataHealth`: `overall_severity: 'ok' \| 'warn' \| 'error'`, `history: Array<{ generated_at: string; overall_severity: 'ok' \| 'warn' \| 'error' }>`. |
| `src/components/accuracy/AccuracyTab.tsx` | In `DataHealthPanel` (line 706), render `<DataHealthSparkline history={data.history} />` above the existing sanity-checks rendering. Visible only when expanded (`isExpanded` state already exists). |

### Integration Points

- **No new API route, no new hook.** History rides on the existing `data_health.json` blob and `useDataHealth()` 60s-refetch hook.
- **Storage cost:** 7 entries * ~60 bytes each = ~420 bytes added to `data_health.json`. Trivial.
- **First-7-days behaviour:** Sparkline shows 1, 2, 3... dots until reaching 7. Acceptable — "history will populate over the next week" is self-explanatory.
- **`overall_severity` is also useful as a top-line badge** in the panel header (red/amber/green dot beside "Data Health"). Worth implementing in same task for visual coherence.

---

## Feature 4 — BACK-01: Decision History Backtester

### Goal

Replay the user's actual transfers and captain choices GW-by-GW; for each decision, compute "what was the optimal alternative our engine recommended at the time?" and show **regret score** (cumulative xPts / actual pts difference). Lets the user audit whether following the tool would have outperformed their actual choices.

### Critical Architectural Concern: Where Does Per-GW Decision History Live?

This is the hardest data-architecture question in v1.16. The user's decisions accumulate over a season; the engine's recommendations also accumulate. None of this is currently persisted longitudinally.

**Existing storage today:**

| Storage | Currently Holds | Persistence Scope |
|---------|----------------|--------------------|
| `pipeline/cache/predictions_snapshot.json` | Current-GW predictions only (overwritten each run) | Last write wins |
| `pipeline/cache/predictions_snapshot_gw{N}.json` | **Per-GW snapshot uploaded to Blob** (run.py:336-338) | Permanent in Blob |
| `pipeline/cache/accuracy_backtest.json` | 5-GW rolling backtest of pipeline predictions | Rolling window |
| `localStorage.fplx_manual_plan` | Manual transfer planner state | Per-device |
| FPL API `/entry/{id}/event/{gw}/picks/` | User's actual picks per GW (authoritative) | FPL-side, queryable any time |
| FPL API `/entry/{id}/transfers/` | User's transfer history | FPL-side, queryable any time |

**The blob-stored `predictions_snapshot_gw{N}.json` is the key insight.** `run.py` already uploads a per-GW snapshot to Blob (line 336-338) — that's the engine's "what we recommended at the time" record. We don't need to build new history infrastructure for the **engine side**. We DO need to capture the engine's captain pick + transfer suggestion alongside the raw predictions — currently the snapshot is players-only.

**Three architecture options for the user-decision side:**

| Option | Approach | Trade-off |
|--------|----------|-----------|
| **A. Pure-derive at view time** | On BackTab open: fetch user's real picks/transfers via FPL API (`useMyTeam` already does picks), pull each historical `predictions_snapshot_gw{N}.json` from Blob, compute regret per GW client-side. **Zero new persistence.** | Heavy on read (loads 5-30 snapshots from Blob); slow on first render. Cacheable via TanStack Query. **Recommended.** |
| B. Pre-compute server-side per GW | Pipeline writes a `decision_history_team{id}.json` per user. Requires user-keyed pipeline runs (currently the pipeline is single-tenant — no team_id parameter). | **Major architecture change.** Pipeline becomes multi-tenant. Out of scope for v1.16. |
| C. localStorage cache of derived results | Compute once via Option A, persist results client-side, recompute only when GW advances. | Mirrors `fplx_manual_plan` pattern. Good optimisation **on top of A**, not a replacement. |

**Recommendation: A (pure-derive) + C (client-cache as optimisation).** This honours the existing single-tenant pipeline; FPL API is the source of truth for user actions; per-GW Blob snapshots are the source of truth for engine recommendations.

### Data Flow

```
+----------------------------------+
| FPL API (already proxied)        |
|   /api/fpl/entry/{id}/history/   |  <-- needs new proxy URL OR
|   /api/fpl/entry/{id}/transfers/ |      use [...proxy] catch-all
|   /api/fpl/entry/{id}/event/{gw}/picks/
+----------------+-----------------+
                 |
                 v
+----------------+-----------------+
| Vercel Blob                      |
|   predictions_snapshot_gw1.json  |  <-- ALREADY uploaded by run.py
|   predictions_snapshot_gw2.json  |       (line 336-338)
|   ...                            |
|   predictions_snapshot_gw30.json |
+----------------+-----------------+
                 |
                 v
+----------------+-----------------+
| /api/decision-history (NEW)      |
|   GET ?team_id=...&gw_start=...  |
|   Server-side fetch fans out:    |
|     - bootstrap.events           |
|     - per-GW user picks          |
|     - per-GW user transfers      |
|     - per-GW predictions snapshot|
|   joins into:                    |
|     [{gw, captain_actual,        |
|       captain_engine,            |
|       captain_actual_pts,        |
|       captain_engine_pts,        |
|       transfers_actual: [...],   |
|       transfers_engine: [...],   |
|       cumulative_regret_pts}]    |
+----------------+-----------------+
                 |
                 v
+----------------+-----------------+
| useDecisionHistory(teamId)       |
|   TanStack Query                 |
|   queryKey: ['decision-history', |
|     teamId, finished_gw_count]   |
|   staleTime: 6h                  |
+----------------+-----------------+
                 |
                 v   localStorage cache mirror (optional optimisation)
                 v
+----------------+-----------------+
| BackTab (NEW sub-tab in Squad)   |
|   <DecisionHistoryTable />       |
|   Per-GW row: actual vs engine,  |
|   regret column, sparkline       |
|   <RegretScoreSummary />         |
|   Headline number + breakdown    |
+----------------------------------+
```

### Critical Constraint: Engine Snapshot Must Capture Captain & Transfer Recs

`predictions_snapshot.json` today holds per-player predictions. To do BACK-01 honestly, we need the engine's *recommendation* at snapshot time — specifically:
- The recommended captain (from `captain_picks.json` — already written per run.py:223)
- The recommended transfer (from `suggestTransfers()` — currently TS-side only, computed on demand)

**Two paths:**

1. **Side-load `captain_picks_gw{N}.json` to Blob** (mirror predictions snapshot): minimal change, captures the captain rec.
2. **Per-GW `transfer_suggestion_snapshot_gw{N}.json`**: requires running `suggestTransfers()` server-side, which currently doesn't run in the pipeline. Would need a new `pipeline/suggest_transfer_snapshot.py` that ports the TS engine to Python, OR runs the TS engine via a Node subprocess.

**Recommendation: ship phase 1 (captain regret only) in v1.16, defer transfer regret to v1.17.** Captain regret is the bulk of weekly variance and the easier signal to compute; transfer regret requires porting `suggestTransfers()` to Python which is a phase-sized effort on its own.

### New Files

| Path | Purpose |
|------|---------|
| `src/app/api/decision-history/route.ts` | Server-side join endpoint. Query params: `team_id` (required). Fans out: FPL `/entry/{id}/history/`, `/entry/{id}/event/{gw}/picks/` per finished GW, Blob `predictions_snapshot_gw{N}.json` per finished GW, Blob `captain_picks_gw{N}.json` per finished GW. Returns `DecisionHistoryEntry[]`. Cacheable (s-maxage 1h). |
| `src/lib/hooks/useDecisionHistory.ts` | TanStack Query hook. `queryKey: ['decision-history', teamId, finishedGwCount]` so cache invalidates as GWs complete. `staleTime: 6h`. |
| `src/lib/decision-history.ts` | Pure compute: `computeRegret(actual, engine)` helper; cumulative regret reducer; per-position regret breakdown. Unit-testable in isolation. |
| `src/components/squad/BackTab.tsx` | New sub-tab content — replaces "Coming soon" or sits beside DecisionSummaryTab. Renders `<RegretScoreSummary />` + `<DecisionHistoryTable />`. |
| `src/components/squad/DecisionHistoryTable.tsx` | TanStack Table over per-GW rows. Columns: GW, Captain Actual, Captain Engine, Captain Pts Δ, Transfers Actual, Transfers Engine, Cumulative Regret. |
| `src/components/squad/RegretScoreSummary.tsx` | Single-card headline: "If you'd followed every captain rec: +X.X pts cumulative". |
| Tests for all of the above | Vitest + RTL. |

### Modified Files

| Path | Change |
|------|--------|
| `pipeline/run.py` | After `save('captain_picks.json', captain_picks)` (line 223), if `USE_BLOB`, also upload as `captain_picks_gw{current_gw}.json` (mirrors predictions_snapshot pattern at line 336-338). |
| `pipeline/upload.py` | Already has `upload_json` per the v1.14 doc — no change needed if signature accepts arbitrary names. |
| `src/app/page.tsx` | Add Backtester sub-tab to Squad section's `SECTIONS` constant; route in conditional render block. |
| `src/components/nav/MobileNav.tsx` | If Squad mobile pill row is in scope, add Backtester pill. |
| `src/lib/types.ts` | New interfaces: `DecisionHistoryEntry`, `RegretBreakdown`. |

### Integration Points

- **Read-only over existing FPL + Blob data.** No new external dependencies; only new joins.
- **Cold-start cost:** First view fetches ~30 Blob snapshots (one per finished GW). At ~50KB each = ~1.5MB. Acceptable but **the API route MUST parallelise** (`Promise.all`) the per-GW fetches. Sequential = 30 * 200ms = 6s; parallel = ~500ms.
- **Snapshot retention assumption:** Blob storage retains every uploaded `predictions_snapshot_gw{N}.json` indefinitely. Verify with `vercel blob list` before promising 30-GW history; if Blob has lifecycle policies enabled, document the actual retention horizon.
- **Pre-snapshot GWs:** If the pipeline started uploading per-GW snapshots only from GW7, GWs 1-6 cannot be backtested. Render a "engine history starts at GW{N}" banner. Don't fail silently.
- **Transfer regret deferred:** Document this clearly in the v1.16 PROJECT.md so users don't expect the Transfers columns. UI shows them as "—" with a tooltip "transfer regret coming v1.17".
- **Pure-TS `suggestTransfers` is a future Python port consideration**: keep `src/lib/transferEngine.ts` (or wherever the TS engine lives) deterministic and side-effect-free so a future Python mirror is feasible.

---

## Feature 5 — SPQ-04: Set-Piece League Table

### Goal

Pure UI feature. `pipeline/cache/sp_quality.json` (written by `set_piece_quality.py` during v1.14) already contains per-player corner / FK danger scores. Today only the per-team `SetPieceTakerPanel` consumes it. SPQ-04 wants a 20-team league table view — sortable by corner danger, FK danger, or composite.

### Critical Architectural Concern: Reuse vs Extend Existing Route

`/api/set-pieces` already merges `sp_quality.json` into the response (per v1.14 doc, modified `route.ts` to embed `quality_ranking` array). **The data is already on the wire.** SPQ-04 is therefore a **client-only** feature: extend `SetPieceTakerPanel` with a new sub-component that reads the same `useSetPieces()` data and renders a league table.

**No new pipeline work. No new API route. No new hook.**

### Data Flow

```
sp_quality.json (existing)
        |
        v   read by /api/set-pieces (existing)
        v
useSetPieces() (existing)
        |
        v   data.quality_ranking (existing field)
        v
SetPieceTakerPanel.tsx
   <ExistingTakerCardGrid />
   <SetPieceQualityTable />              <-- NEW (per-taker rank table)
   <SetPieceLeagueTable />               <-- NEW (SPQ-04: 20-team aggregate)
     - aggregates per-team danger from quality_ranking
     - sortable by metric
     - links into team's takers
```

### One Data Question

`sp_quality.json` is keyed by **taker/player**, not team. To produce a 20-team league table, we need to aggregate takers back up to teams. Two options:

| Option | Approach |
|--------|----------|
| **A. Client-side aggregate** | `SetPieceLeagueTable` does a `groupBy(team_id)` over `data.quality_ranking`, picks the primary corner taker + primary FK taker per team, computes a composite score (e.g. `0.6 * corner_danger + 0.4 * fk_danger`). Pure UI math. |
| B. Pipeline emits `sp_team_league.json` | Server-side aggregation; cleaner data but new artifact + new merging in /api/set-pieces. |

**Recommendation: A.** 20 teams × ~3 takers = 60 rows; client-side aggregate is sub-millisecond. Avoids adding a new artifact for a single consumer.

### New Files

| Path | Purpose |
|------|---------|
| `src/components/set-pieces/SetPieceLeagueTable.tsx` | Sortable TanStack Table, 20 rows (1 per team). Columns: Team (with TeamBadge), Corner Danger, FK Danger, Composite, Rank. |
| `src/lib/setPieceLeague.ts` | Pure aggregator: `aggregateTeamDanger(quality_ranking) -> TeamDangerRow[]`. Unit-testable. |
| `tests/components/set-pieces/SetPieceLeagueTable.test.tsx` | RTL tests. |
| `tests/lib/setPieceLeague.test.ts` | Aggregation correctness, tie-breaking, BGW handling. |

### Modified Files

| Path | Change |
|------|--------|
| `src/components/set-pieces/SetPieceTakerPanel.tsx` | Render `<SetPieceLeagueTable />` below the existing card grid (and below `SetPieceQualityTable` if shipped from v1.14). Add a small toggle "Cards / League Table" if the panel becomes too dense; otherwise stack. |

### Integration Points

- **Zero pipeline change. Zero API change. Zero new hook.**
- Reuses existing `TeamBadge` component for team identity rendering (consistency with `RivalSummaryTable`, `FixtureEaseRankingPanel`).
- Mobile sizing: portrait-mode 5+ columns will overflow. Reuse the established `MOBILE_HIDDEN_COLUMNS` pattern from GemTable: hide Composite + Rank on mobile, keep Team + Corner Danger + FK Danger.
- **Empty-state safety:** If `data.quality_ranking` is missing (e.g. shot scrape failed), `SetPieceLeagueTable` renders "league table unavailable — set-piece quality data missing". Mirror `SetPieceTakerPanel`'s existing degradation copy.

---

## Cross-Cutting Concerns

### Type Versioning & Gates

v1.16 introduces three new feature gates: `news_scraper_enabled`, plus the existing slate (`xmins_v2_enabled`, `bonus_predictor_enabled`, `form_signal_enabled`, `save_predictor_enabled`). Every new model toggle ships **OFF**; flip after a non-regression shadow run logged in `accuracy_backtest`. Bump `FORMULA_VERSION` per feature flip (`v1.16-a`, `v1.16-b`, ...).

REFRESH-01 is **not gated** — it's infrastructure only; gating it would still require manually editing the cron file. The dense-cron strategy is self-gating because the gate script can be edited to always-skip if needed.

DH-04 is **not gated** — sparkline derives from existing data with no model risk; rolling out is benign.

BACK-01's **transfer regret is deferred to v1.17**, captain regret ships in v1.16. UI clearly labels deferred columns.

### Shared Run-Order Dependencies (Updated for v1.16)

```
.github/workflows/pipeline.yml
  refresh-gate.py (NEW REFRESH-01)        <-- decides skip-or-run
    -> exit 0: continue; exit 1: skip job
  pipeline/run.py
    fetch bootstrap + fixtures + element-summary (existing shared)
    news_client.fetch_news_items (NEW SCRAPER-01, try/except wrapped)
      -> news.compute_news_flags (NEW)
    xmins -> bonus -> saves -> merge.merge_players(news_stats=..., ...)
    ... existing pipeline ...
    captain_picks.json save + Blob upload as captain_picks_gw{N}.json (NEW BACK-01)
    sp_quality (existing) — feeds SPQ-04 with no pipeline change
    data_health.compute_data_health (extended for DH-04 history)
    last_updated.json
```

### Component Tree Touch Points

```
src/app/page.tsx                                     <-- MODIFIED (Squad: add Backtester sub-tab)
  GemTable
    columns.tsx                                      <-- MODIFIED (NewsFlag inline)
  AccuracyTab.tsx
    DataHealthPanel (line 706)                       <-- MODIFIED (mount sparkline)
      DataHealthSparkline.tsx                        <-- NEW (DH-04)
  SetPieceTakerPanel.tsx                             <-- MODIFIED (mount league table)
    SetPieceLeagueTable.tsx                          <-- NEW (SPQ-04)
  Squad section
    DecisionSummaryTab (existing)
    BackTab.tsx                                      <-- NEW (BACK-01)
      DecisionHistoryTable.tsx                       <-- NEW
      RegretScoreSummary.tsx                         <-- NEW
  TransferPanel.tsx                                  <-- MODIFIED (NewsFlag)
  shared/NewsFlag.tsx                                <-- NEW (SCRAPER-01)
```

---

## Suggested Build Order

Sequenced to maximise parallelism while respecting dependencies. Each phase is independently shippable behind a gate or feature flag.

### Phase Order

1. **Phase A — DH-04 Sparkline (SMALLEST, lowest risk)**
   - Why first: pure additive change to existing `data_health.json` + existing `DataHealthPanel`; one new presentational component; no new external surface.
   - Touches: `pipeline/data_health.py`, `src/lib/types.ts` (DataHealth extension), `src/components/accuracy/DataHealthSparkline.tsx`, `AccuracyTab.tsx` (mount).
   - Risk: very low. First-7-days cosmetic ramp-up acceptable.
   - **Sequencing rationale:** Ship DH-04 first so the sparkline starts accumulating history immediately; by the time later v1.16 features ship the sparkline has real data to show their stability.

2. **Phase B — SPQ-04 League Table (UI-only, parallel-safe with A)**
   - Why second: zero pipeline change, zero API change. Reuses `useSetPieces()`. Pure client work.
   - Touches: `src/components/set-pieces/SetPieceLeagueTable.tsx`, `src/lib/setPieceLeague.ts`, `SetPieceTakerPanel.tsx` (mount).
   - Risk: very low. Aggregator math is unit-testable in isolation.
   - **Can ship in parallel with Phase A** if appetite for parallel phases.

3. **Phase C — REFRESH-01 Event-Based Cron**
   - Why third: infrastructure-only; touches workflow YAML and one new gate script. Once shipped, every subsequent v1.16 feature benefits from deadline-aware refreshes.
   - Touches: `.github/workflows/pipeline.yml`, `pipeline/refresh_gate.py`, `tests/pipeline/test_refresh_gate.py`.
   - Risk: medium — easy to break the cron schedule (a bad cron entry silently skips runs). Verify in a side branch first; observe at least one full deadline cycle before merging to main.
   - **Dependency:** None. Can ship before A and B.

4. **Phase D — SCRAPER-01 News Scraper**
   - Why fourth: introduces a new external scrape surface (RSS) — the highest-risk new dependency in v1.16. Ships behind `news_scraper_enabled=False`.
   - Touches: `pipeline/news.py`, `pipeline/news_client.py`, `pipeline/merge.py`, `pipeline/run.py`, `pipeline/accuracy.py`, `src/lib/types.ts`, `src/components/shared/NewsFlag.tsx`, `TransferPanel.tsx`, `gem-table/columns.tsx`.
   - Risk: medium-high — RSS feeds can break, reorganise, or get bot-blocked. Strict try/except discipline required (mirror `prose_summary` pattern). Ship with gate OFF; manually flip after 7-day audit.
   - **Dependency:** Benefits from Phase A's sparkline (visibility into how often the news scrape succeeds).

5. **Phase E — BACK-01 Decision History Backtester (LARGEST)**
   - Why last: largest feature; depends on per-GW `captain_picks_gw{N}.json` being uploaded for at least 1 GW before it can be demonstrated; benefits from observability shipped in earlier phases.
   - Touches: `pipeline/run.py` (Blob upload), `src/app/api/decision-history/route.ts`, `src/lib/hooks/useDecisionHistory.ts`, `src/lib/decision-history.ts`, `src/components/squad/BackTab.tsx`, `DecisionHistoryTable.tsx`, `RegretScoreSummary.tsx`, `src/app/page.tsx`, `MobileNav.tsx`.
   - Risk: medium — many new files; cold-start fetch performance needs careful parallelisation; transfer-regret scope deferred so user expectations need clear UI labelling.
   - **Hard dependency:** the `captain_picks_gw{N}.json` Blob upload step in `run.py` should ship in an earlier phase OR as the first step of Phase E, then wait at least 1 GW before the UI reads it. **Recommendation: split E into E1 (pipeline upload, 1 task) shipped at the start of v1.16, then E2 (UI + API + hook) shipped near the end of v1.16** — gives the snapshots time to accumulate.

### Build-Order Rationale

| Phase | Depends on | Can parallel with | Why this order |
|-------|------------|-------------------|----------------|
| A (DH-04) | nothing | B, C, E1 | Cheapest; starts sparkline accumulating history immediately |
| B (SPQ-04) | nothing | A, C, E1 | UI-only; zero infrastructure risk |
| C (REFRESH-01) | nothing | A, B, E1 | Infrastructure first so deadline runs benefit later features |
| E1 (BACK-01 pipeline upload) | nothing | A, B, C | Ship Blob upload early so snapshots accumulate during v1.16 build |
| D (SCRAPER-01) | benefits from A | nothing critical | New external surface — highest dep risk |
| E2 (BACK-01 UI) | E1 + ≥1 GW elapsed | nothing | UI needs real snapshots to demo |

### Phase Numbering

- v1.15 last phase: 85 (set-piece-threat-assisted-ui).
- Suggested numbering (assuming each top-level feature is 1 phase except E split into 2):
  - 086 = DH-04 sparkline
  - 087 = SPQ-04 league table
  - 088 = REFRESH-01 event-based cron
  - 089 = BACK-01 pipeline upload (Blob captain_picks_gw{N}.json)
  - 090 = SCRAPER-01 news scraper
  - 091 = BACK-01 UI (BackTab + API + hook)
  - Plus phases for MC-01, CAL-01, SENS-01, WHY-01 (see v1.14 baseline patterns; numbering 092-095).

---

## Open Questions for /gsd-discuss-phase

1. **BACK-01 transfer regret scope:** Confirm captain-regret-only is acceptable for v1.16, with full transfer regret deferred to v1.17. The deferral is necessary because `suggestTransfers()` is currently TS-only and would need a Python port to run server-side per snapshot.
2. **SCRAPER-01 source choice:** RSS aggregator vs Premier Injuries scraping vs FPL-only. RSS is recommended; user may prefer a different tradeoff.
3. **Blob retention horizon:** Verify `vercel blob list --prefix predictions_snapshot_gw` returns ALL historical snapshots (not just recent N). If retention is bounded, BACK-01's "show last 30 GWs" promise must shrink to actual retention horizon.
4. **REFRESH-01 deadline windows:** Recommended Fri 16-22 / Sat 08-13 / Sun 10-15 UTC. Confirm these cover the 2026/27 season's typical deadline distribution; midweek GWs (Tue/Wed) would need additional windows.
5. **DH-04 sparkline visual:** 7 dots vs proper SVG sparkline (e.g. line graph of severity-as-numeric). Dots are simpler; sparkline is richer but adds rendering complexity.

---

## Sources

- Existing codebase observations from: `pipeline/run.py` (verified read), `pipeline/data_health.py` (verified read), `pipeline/set_piece_quality.py`, `.github/workflows/pipeline.yml` (verified read), `src/app/api/data-health/route.ts` (verified read), `src/lib/hooks/useDataHealth.ts` (verified read), `src/components/accuracy/AccuracyTab.tsx` (DataHealthPanel at line 706+ verified via grep), `src/components/planner/ManualPlanTab.tsx` (loadManualPlan persistence pattern at line 97-101 verified).
- v1.14 baseline architecture: `.planning/research/ARCHITECTURE.md` prior content (preserved conventions retained).
- GitHub Actions cron syntax (multiple `schedule:` entries permitted; `workflow_dispatch` for manual triggers): standard documented behaviour [VERIFIED via existing `pipeline.yml` use of both `schedule` and `workflow_dispatch`].
- FPL API endpoints `/entry/{id}/event/{gw}/picks/`, `/entry/{id}/history/`, `/entry/{id}/transfers/`: existing `[...proxy]` route handles these by URL passthrough [VERIFIED via `src/app/api/fpl/[...proxy]/route.ts` existence].
- `predictions_snapshot_gw{N}.json` per-GW Blob upload: confirmed by `pipeline/run.py:336-338` `upload_json(f'predictions_snapshot_gw{current_gw}.json', snapshot_data)` [VERIFIED].
- `data_health.json` reads its own prior output for delta computation: confirmed by `pipeline/data_health.py:114-121` [VERIFIED].
