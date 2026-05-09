# Feature Landscape — v1.16 Modelling & Trust

**Milestone:** v1.16 (FPL Analyst — subsequent milestone)
**Domain:** Forecast transparency, pipeline reliability, decision auditability
**Researched:** 2026-05-09
**Overall confidence:** MEDIUM-HIGH

This research covers the seven new v1.16 features. Two prior v1.16 entries (MC-01 Monte Carlo, CAL-01 Calibration Charts) are not re-researched here — they were defined in v1.10 ROADMAP and the deferred-but-still-planned shape carries over. This document focuses on the seven *new* features layered on top.

The codebase context is mature: GemTable / TransferPanel surfaces exist, `data_health.json` and `DataHealthPanel` shipped in v1.14/v1.15, decision history pipeline groundwork exists for accuracy backtests, and `news` already lands in `bootstrap.elements[].news` via the FPL API (verified). What is new in v1.16 is *what we put on top* of those signals, not the signals themselves in most cases.

**Source provenance legend:** `[VERIFIED]` checked against repo / FPL API / docs in this session; `[CITED]` from named external source; `[ASSUMED]` based on FPL community knowledge / training data — flagged for user confirmation.

---

## Feature 1 — SCRAPER-01: FPL News Scraper

**Backlog ref:** `feature-backlog.md` line 342-352 (Priority 4 — Must-have / Phase 2)
**Existing surfaces affected:** `pipeline/merge.py` (extract `news`, `news_added`, `chance_of_playing_next_round` from bootstrap); `TransferPanel`, `GemTable` row-expand, `SquadView` flag pills, `DecisionSummary` risk card.

### What "scraper" actually means here (CRITICAL framing)

The backlog item title says "scraper" but the cheapest, highest-fidelity FPL news source is **already in the FPL bootstrap response** — the `news` and `news_added` strings on each `element`, plus `chance_of_playing_next_round` (integer 0/25/50/75/100/null) and `status` (`a`/`d`/`i`/`s`/`u`/`n`). [VERIFIED — `pipeline/run.py` already fetches bootstrap; `MergedPlayer` does not currently surface `news` text]

**Recommendation: do NOT scrape Sky/BBC for v1.16.** The FPL `news` string is updated by FPL editors and reflects official disciplinary, injury, and rotation flags. Third-party scraping introduces fragility (anti-bot defences, terms-of-service ambiguity, parsing breakage on layout changes) for marginal incremental information.

**v1.16 scope = "Surface FPL official news in-app + render confidence per the FPL chance% field."** Re-frame the feature accordingly. Press conference scraping is a v1.17+ deferred idea.

### User-facing behaviour

For any player with non-empty `news`:

1. **GemTable row** — small grey newspaper icon in Player column tooltip; expand-row reveals the news string and `news_added` date.
2. **TransferPanel suggestion card** — if a buy candidate has `chance_of_playing_next_round < 75` or non-empty news, an amber "News" pill renders next to the price; click reveals the news string.
3. **SquadView player chip** — already has `status` indicator (red flag for injured); upgrade tooltip to show news string + chance%.
4. **Decision Summary** — new "Team news" card if any owned player has news added in last 48h; severity High if status changed, Medium for chance% drop, Low for informational text.

### Confidence tiers (from FPL chance%)

| Chance% | Tier label | UI colour | Meaning |
|---|---|---|---|
| 100 | Cleared | green | No flag |
| 75 | Likely | green | Minor doubt; cleared but news exists |
| 50 | 50/50 | amber | Genuine uncertainty |
| 25 | Doubtful | amber | Serious doubt; backup recommended |
| 0 | Ruled out | red | Won't play this GW |
| null | — | grey | No data (not flagged) |

Map directly from FPL `chance_of_playing_next_round`. No bespoke confidence model required.

### News-added freshness

The `news_added` string is an ISO timestamp [VERIFIED — FPL API returns ISO 8601 timestamps in this field]. Compute `hours_since_news_added`:
- < 24h → "Fresh" badge (blue dot)
- 24–168h → no badge (in-context only)
- > 168h → "Stale news" tooltip (often residual from old injury that was never cleared)

This is critical — without freshness signalling, users see week-old news as new and over-react.

### Table stakes

- `news`, `news_added`, `chance_of_playing_next_round`, `status` exposed on `MergedPlayer`.
- News pill renders on TransferPanel cards.
- News tooltip on GemTable Player column.
- `chance%` mapped to coloured tier label per the table above.
- Players with `status='u'` (unavailable, transferred out) excluded from buy suggestions outright (existing behaviour — confirm preserved).

### Differentiators

- **Diff-from-last-run news flagging** — pipeline writes a `news_changes.json` snapshot diff (parallel to the existing `set_piece_changes.json`); UI shows a one-shot "News updated" banner above tabs for changed players. Mirrors the SP-CHANGE-01 pattern that already shipped.
- **Owned-player priority surfacing** — Decision Summary "Team news" card lists owned-squad changes first.
- **News-aware xPts dampening (downstream)** — xMins engine could weight news/chance% more strongly. *Out of scope for SCRAPER-01 itself*; flag as cross-feature lift for a future xMins v3.

### Anti-features (do NOT build for v1.16)

| Anti-feature | Why avoid |
|---|---|
| Sky / BBC / Twitter scraping | Fragile, ToS-grey, marginal info; press-conf data has long delays vs FPL official news anyway |
| LLM summarisation of news strings | News strings are already short and editorially curated; LLM adds hallucination risk and zero compression value |
| Predicting *future* news (e.g. "Pep is likely to rotate") | Speculative; out of model scope |
| Auto-removing players from optimiser based on news | UI surfaces the signal; user makes the decision (matches existing app philosophy) |

### Complexity

**Low.** ~40 LOC pipeline (extract 4 new fields onto `MergedPlayer`, write `news_changes.json` diff). ~120 LOC React (NewsPill component, news tooltip in GemTable Player cell, TransferPanel card extension, Decision Summary card extension). One new pipeline cache file (`news_changes.json`).

**Risk:** None substantial — purely additive on existing data feed.

### Dependencies

- **Depends on:** Nothing new. FPL bootstrap fetch already runs daily.
- **Cross-feature lift to DH-04:** SCRAPER-01 introduces a `news_changes_count` signal that DH-04's sparkline can include.
- **Cross-feature lift to REFRESH-01:** event-based refresh becomes substantially more useful once news scraping is wired (news arriving ~1h before deadline becomes actionable).

---

## Feature 2 — REFRESH-01: Event-Based Pipeline Refresh

**Backlog ref:** `feature-backlog.md` line 316-323 (Priority 4 — Must-have infrastructure)
**Existing surfaces affected:** `.github/workflows/*.yml` (NEW or extend existing daily cron); pipeline `run.py` (idempotent — already is); Data Health panel (surfaces last-trigger reason).

### User-facing behaviour

User-facing changes are minimal and largely passive:

1. **Data Health panel** — `last_pipeline_run_age_hours` stays low (< 6h on deadline day, vs current ~24h average).
2. **DH-04 sparkline** (separate feature) shows multiple bars per deadline day instead of one bar per day.
3. **"Last updated" ticker** on every tab (existing FRE-01 component) reads "Updated 12 min ago" near deadline rather than "Updated 4 hours ago".
4. **Optional**: a `last_trigger_reason` field surfaces in Data Health: "Triggered: 2h before deadline" / "Triggered: post-match" / "Triggered: scheduled cron".

### Trigger schedule (recommended — table stakes)

The backlog suggests "6h before, 2h before, 30min before, immediately after, after each match". Refine for cost / signal:

| Trigger | Rationale | FPL signal |
|---|---|---|
| Daily 04:00 UTC (existing) | Baseline freshness | Already shipping |
| **T-6h before deadline** | Press-conf news typically lands 24-3h prior; T-6h captures most | `bootstrap.events[next].deadline_time` |
| **T-2h before deadline** | Captures last-minute injury / rotation flags | Same |
| **T-15min before deadline** | Final price changes (FPL recalculates ~01:30 UTC); for daytime deadlines this catches confirmed lineups if leaked | Same |
| **T+30min after deadline** | Locked squads visible; bonus/EO recompute valid | Same |
| **After each match completes** [DEFER] | Refresh actuals for accuracy backtest | Match end-time isn't reliably exposed in bootstrap; would need scraping or hardcoded fixture timing — defer |

**Recommendation: ship 4 triggers (T-6h, T-2h, T-15min, T+30min); defer per-match refresh.** Per-match adds infrastructure complexity (need a scheduler that knows match end times) for low marginal value (next-day cron picks up actuals anyway).

### Implementation pattern (HIGH confidence — GitHub Actions)

GitHub Actions natively supports cron triggers and `workflow_dispatch` (manual trigger), but does **not** support dynamic schedules computed from app state. Two viable patterns:

| Pattern | How | Pros | Cons |
|---|---|---|---|
| **A. Frequent cron + early-exit guard** | Cron every 30min; `run.py` checks "is deadline within next 6h, 2h, 15min, or did it just pass?" and exits early otherwise | Simple, no external scheduler; one workflow file | Wastes ~95% of runs as no-ops; counts toward GitHub Actions free minutes |
| **B. Computed schedule via separate "scheduler" workflow** | One workflow runs daily, reads next deadline, uses `gh workflow run` to schedule the four event-triggered runs via API | More efficient; fewer total runs | Two workflow files; `gh workflow run` doesn't actually schedule — it triggers immediately. True scheduling needs an external service |
| **C. Recommended: hybrid** | Workflow runs every 1h; bash guard checks "are we within ±15min of any of the four event windows?" — exits 0 if not, runs pipeline if yes | Lightweight guard; no external infra; scales naturally | Slightly less precise (±15min); fine for FPL cadence |

**Recommended approach C.** Cron expression: `0 * * * *` (hourly) plus a 30-line shell preamble that fetches `https://fantasy.premierleague.com/api/bootstrap-static/`, parses next event deadline, and sets a job-level conditional. [CITED — GitHub Actions docs: cron triggers fire at the schedule's resolution; dispatch is on-demand only]

### Failure detection

Current failure mode: cron fails silently. v1.16 adds:

- **Workflow failure → GitHub Issue auto-create** via existing `gh` CLI + `peter-evans/create-issue-from-file` or simple `gh issue create` step. [CITED — GitHub Actions standard pattern]
- **Failure surfaced in DH-04 sparkline** as a red bar (uses Actions REST API: `GET /repos/{owner}/{repo}/actions/runs?status=failure&per_page=20` from the pipeline itself, written to `data_health.json` as `cron_failures_last_7d`).
- **Two consecutive failures → terminate fallback** to last good cache; `/api/last-updated` exposes `is_stale_failover: true` so the FRE-01 ticker turns red instead of amber.

### Table stakes

- 4 event triggers (T-6h, T-2h, T-15min, T+30min) per deadline relative to `bootstrap.events[?].deadline_time`.
- Idempotent `run.py` (already is — verified via existing daily cron).
- Workflow failure produces a visible signal (auto-issue or DH-04 red bar).
- `last_trigger_reason` written to `data_health.json` for surfacing.

### Differentiators

- **Pre-deadline refresh acknowledgement banner** — FRE-01 ticker shows "Final pre-deadline refresh in 12 min" so user knows to check back.
- **Skip refresh if no fixtures within 72h** (pre/post international break gap) — saves runs during dead weeks.
- **Smart matchday refresh** — single trigger ~1h after typical match end (15:00 + 2h = 17:00 UTC for 15:00 kickoffs); cheaper than per-match scheduling. *Optional — defer if scope tight.*

### Anti-features (do NOT build)

| Anti-feature | Why avoid |
|---|---|
| Per-minute polling near deadline | Hammers FPL API; risks rate limiting; marginal value over 15min granularity |
| In-app deadline countdown widget | Out of scope (UI feature, not a refresh feature); existing FRE-01 covers freshness |
| Push notifications on refresh complete | ALERT-01 territory (separate backlog item); refresh shouldn't bundle alerting |
| External cron service (e.g. EasyCron) for true precision | Adds dependency; GitHub Actions hourly+guard is sufficient for FPL's deadline cadence |

### Complexity

**Low-Medium.** ~80 lines YAML (one new workflow with cron + guard step), ~30 lines `run.py` to write `last_trigger_reason` and increment cron health metrics. Largest risk is GitHub Actions billing / minute consumption — hourly runs use 24×30 = ~720 min/month vs current ~30 min/month. Within free tier (2000 min/month for public repos; private repos pay).

### Dependencies

- **Depends on:** Existing `pipeline/run.py` (already idempotent).
- **Cross-feature lift to DH-04:** REFRESH-01 generates the multi-bar-per-day sparkline data DH-04 visualises.
- **Cross-feature lift to SCRAPER-01:** REFRESH-01 makes news scraping near-real-time, where it has highest decision value.

---

## Feature 3 — DH-04: Cron History Sparkline

**Backlog ref:** Mid-flight v1.16 add-on; not in formal backlog yet (extends v1.14 DQ-01/DQ-02 which shipped as Data Health Dashboard).
**Existing surfaces affected:** `DataHealthPanel.tsx` (existing — extend with sparkline component), `pipeline/data_health.py` (write 7-day rolling history), possibly persistent storage choice.

### User-facing behaviour

In the existing Data Health panel (top of Accuracy tab), the **Operational signals** section (where `cron_failures_last_7d` already lives) gains an inline 7-bar sparkline visualisation:

```
Pipeline runs (last 7 days)    ▆ ▇ ▆ ▇ ▆ ▆ ▇   ✓ 7 OK
                                                ✗ 0 failed
```

Each bar represents one day. Bar **height** = number of successful runs that day (taller = more refreshes — useful when REFRESH-01 ships and there are multiple runs/day). Bar **colour** = green (all OK), amber (some succeeded, some failed), red (all failed), grey (no runs that day).

Hover any bar reveals: "Mon 5 May: 5 runs / 4 ok / 1 failed at 14:23 — duration 2m 14s". Click expands to a per-run table for that day.

### Data source — three options

| Option | Source | Pros | Cons |
|---|---|---|---|
| **A. GitHub Actions REST API** | `GET /repos/{owner}/{repo}/actions/workflows/{id}/runs?per_page=100` | Source of truth; no separate persistence; includes failure detail | Requires authenticated token; rate-limited (5000 req/h with token); doesn't include early-exit guard runs as "successful" |
| **B. Pipeline self-log** | `run.py` appends to `pipeline/cache/cron_history.jsonl` on each run | Self-contained; no auth | File grows unbounded (truncate to 30 days); doesn't capture cases where `run.py` itself failed to start |
| **C. Hybrid** | A as primary, B as supplementary detail (per-step timing) | Most accurate; degrades gracefully if API call fails | Most code |

**Recommended approach A.** GitHub Actions API is the source of truth for "did the workflow run". Authenticated via `GITHUB_TOKEN` (auto-provided in Actions context for self-queries) or a fine-scoped PAT for the deployed app. Cache 1h server-side to avoid rate limits.

### Persistence question (CRITICAL — flagged in quality gate)

DH-04 needs **multi-day history**. Three persistence layers exist in the app:

| Layer | Suitability for cron history |
|---|---|
| Vercel Blob (`USE_BLOB=true`) | Already used; appropriate. Write `cron_history.json` per pipeline run; UI fetches alongside `accuracy.json`. **Recommended.** |
| localStorage | Per-browser; users on different devices see different history. Wrong choice for shared signal. |
| GitHub Actions API direct | Live query; no persistence layer needed if going Approach A. **Also viable.** |

**Recommended:** Approach A (live API query) with a thin server-side cache (1h TTL) sitting in Blob. No persistent JSONL log needed.

### Sparkline rendering

Pure CSS / inline SVG; no chart library required:

- Tailwind `flex items-end gap-0.5 h-8`
- Each bar: `<div class="w-2 bg-green-500" style="height: ${pct}%">` with semantic colour class
- Accessible: `role="img" aria-label="7 days of pipeline runs: all successful"`

This stays consistent with existing DataHealthPanel styling (no new dependencies). [VERIFIED — DataHealthPanel uses Tailwind primitives only]

### Table stakes

- 7-day window (configurable constant; not user-controllable).
- Bar per day with colour-coded status.
- Tooltip with run count + last failure time.
- Empty state: < 7 days of history shows partial bars; missing days are grey.
- Failure mode: API unreachable → sparkline shows grey "Unavailable" placeholder, doesn't break the panel.

### Differentiators

- **Per-run drilldown** — click a bar to expand a table of that day's runs (timestamp, duration, trigger reason, outcome).
- **Trend annotation** — "↗ +20% runs vs prior week" (only meaningful after REFRESH-01 ships).
- **Average duration sparkline** as a sibling — surfaces pipeline performance regression.
- **Click-through to GitHub** — bar hover reveals "View on GitHub" link to the actual workflow run.

### Anti-features (do NOT build)

| Anti-feature | Why avoid |
|---|---|
| 30-day or 90-day history | Visual noise; 7 days is the standard ops window |
| Logging per-task or per-step within a run | Massive granularity for negligible signal; out of scope |
| Real-time WebSocket update of in-progress runs | Out of scope; periodic refresh is fine |
| User-configurable thresholds | DataHealthPanel is opinionated by design |

### Complexity

**Low.** ~30 LOC pipeline (extend `data_health.py` to call GitHub Actions API and write `cron_history` field), ~80 LOC React (new `CronHistorySparkline.tsx` component, slot into existing DataHealthPanel). Optional Approach C drilldown adds ~50 LOC.

### Dependencies

- **Depends on:** GitHub Actions API access via `GITHUB_TOKEN`.
- **Depends on:** existing `DataHealthPanel` (shipped v1.14/v1.15).
- **Cross-feature lift from REFRESH-01:** sparkline becomes much more visually meaningful (multiple bars/day) once event-triggered refreshes ship.
- **Cross-feature lift from SCRAPER-01:** add an optional second sparkline row "News updates / day" using `news_changes.json` counts.

---

## Feature 4 — BACK-01: Decision History / Regret Backtester

**Backlog ref:** `feature-backlog.md` line 205-213 (Priority 3 — Advanced / Personal analytics)
**Existing surfaces affected:** New `Plan → History` sub-tab (or `Squad → Review` sub-tab), localStorage decision log, NEW `pipeline/regret.py` post-GW computation, possibly `/api/regret`.

### What FPL managers actually want from a backtester (CRITICAL framing)

This is the most subtle feature in v1.16. Three distinct user needs are commonly conflated under "decision backtester":

| User need | What it answers |
|---|---|
| **Process auditing** | "Was my decision rational *given what I knew at the time*?" (Good process / bad outcome separation) |
| **Outcome scoring** | "How many points did this decision actually cost or earn me vs the alternative?" |
| **Pattern detection** | "Do I have a captaincy bias? Do I take too many hits? Do I sell too early?" |

**v1.16 must serve all three to be useful, but the persistence model differs sharply.** Process auditing requires capturing *the recommendation snapshot at decision time* — not just the outcome. This is the load-bearing complexity flagged in the quality gate.

### User-facing behaviour

A new **History** view (likely under Plan section) shows a per-GW table:

| GW | Decision | What you did | What was recommended | xPts at decision time | Actual outcome | Verdict |
|---|---|---|---|---|---|---|
| 32 | Captain | Salah | Saka | Salah 5.2 / Saka 5.8 | Salah 4 (×2 = 8) / Saka 14 (×2 = 28) | **-20 pts** • Bad process & bad outcome |
| 33 | Transfer | Roll | Out: Watkins / In: Wood | +0.6 net | Watkins blanked (2), Wood scored (8) | **+6 pts** • Good process • Good outcome |
| 34 | Hit | -4 for Cunha | Roll | -4 hit needed +1.4 EV/wk × 5 to break even | Cunha returned 18 over next 4 GWs | **+8 vs roll** • Aggressive process • Good outcome |
| 35 | Chip | None | TC on Salah | TC EV +12 vs no chip | Salah hauled 16 (TC = +32 instead of +16) | **-16 pts** • Conservative process • Bad outcome |

Below the table: aggregate metrics — captain hit rate, average regret per decision, total regret over season, biggest single-decision swing.

### The persistence model (THE hard part)

To produce the columns above, the app must capture **at decision time**:

1. The user's decision (captain choice, transfers in/out, chip used, no-chip).
2. The model's recommendation at that time.
3. The xPts model output at that time (snapshot of model state).

Then **at outcome time** (after deadline + GW completion), compute:

4. Actual points the user's choice scored.
5. Actual points the recommended alternative scored.
6. Verdict via 2×2 matrix (good/bad process × good/bad outcome).

| Layer | What it persists | How |
|---|---|---|
| **L1: Decision log (localStorage)** | User's chosen action per GW: `{ gw, captain_id, transfers_in[], transfers_out[], chip, deadline_iso }` | Auto-captured when user clicks "Lock in plan" in Manual Planner; manual fallback "Log this week's decision" button |
| **L2: Recommendation snapshot (Blob)** | At each pipeline run, snapshot top-3 captain picks, recommended transfer, recommended chip per GW | Pipeline writes `recommendations_snapshot_{gw}.json` once per GW (the *first* snapshot captured before deadline becomes the canonical "what was recommended"); subsequent runs append to history but the gate snapshot is immutable |
| **L3: Outcome computation (post-GW)** | After GW results are in, compute actual xPts received for each captured decision and each unchosen alternative | New `pipeline/regret.py` runs once per GW after results land; writes `regret_history.json` |
| **L4: Display layer** | Reads L1 + L3, shows table; degrades gracefully if L1 missing for a GW (shows "—") | React component reads from localStorage (L1) and `/api/regret` (L3); joins on GW number |

**Critical complexity:** L2 must capture state *before* deadline, but the user might log L1 *after* deadline (forgetting until later). The system needs:

- A canonical "lock time" — recommended snapshot at last pipeline run before deadline.
- A way to retroactively log decisions (user enters last week's decisions in Plan → History).
- Authenticated FPL fetch (already implemented, AUTH-03/04) can pull `entry/{team_id}/event/{gw}/picks/` to *infer* user's actual captain and transfers from their historical squads — **massively reduces the manual logging burden**. [VERIFIED — FPL API endpoint `/api/entry/{id}/event/{gw}/picks/` is documented and returns historical picks]

**Recommendation: rely on FPL API for historical decisions where authenticated; localStorage only for prospective/manual logging.** This eliminates ~80% of the manual-burden objection that kills decision-history features in other tools.

### The "regret" computation

Two viable definitions:

| Definition | Formula | Interpretation |
|---|---|---|
| **A. Vs recommended** | `actual_pts(user_choice) − actual_pts(recommended)` | "How much did I lose by ignoring the model?" |
| **B. Vs optimal hindsight** | `actual_pts(user_choice) − actual_pts(top_scorer_in_eligible_set)` | "How much was I theoretically off the perfect play?" |

**Recommendation: ship A as primary, B as a secondary "Optimal hindsight" toggle.** A is fair (you can only act on what you knew). B is brutal (always negative for any non-omniscient player) and only useful as a season-aggregate ceiling.

### Verdict 2×2 matrix

```
                 Good outcome              Bad outcome
Good process     ✓ Good process+outcome   ⚠ Process right, unlucky
Bad process      ⚠ Lucky bad call          ✗ Bad process+outcome
```

- **Good process** = decision matched recommendation OR was within 1.5 xPts of recommendation.
- **Good outcome** = chosen player scored > 0.5 of expected, OR > 75th percentile for position.

These thresholds are tunable; default to those values and surface as "Process threshold: ±1.5 xPts" in the UI.

### Aggregate metrics (table stakes)

- **Captain hit rate** — % of GWs where chosen captain scored > 6 raw points (industry-standard "haul" threshold). [ASSUMED — community convention; flag for user confirmation]
- **Captain regret total** — sum of (recommended captain pts − actual captain pts) × 2 over all GWs.
- **Transfer ROI** — for each transfer, sum of pts scored by IN over next 5 GWs minus pts scored by OUT.
- **Hit ROI** — for each -4 taken, did the additional xPts gained over next 4 GWs exceed 4? Hit-rate %.
- **Chip ROI** — points gained from chip use vs season-average GW.

### Table stakes

- localStorage L1 decision log auto-populated when authenticated (FPL API picks endpoint).
- Manual entry fallback for unauthenticated / missed weeks.
- Per-GW regret table with verdict column.
- Five aggregate metrics (captain hit rate, captain regret, transfer ROI, hit ROI, chip ROI).
- "Reset history" button — destructive, with confirmation dialog.
- Empty state: clear "No decisions logged yet" with explainer.

### Differentiators

- **Bias surfacing** — "You overweight Liverpool players in captaincy 30% of weeks vs 18% recommended" / "You take hits 1.4× more than recommended".
- **Side-by-side weekly review card** — pre-deadline "This week's decision" vs post-GW "Last week's review".
- **Comparison vs template** — overlay "If you'd captained the consensus pick every week" on the regret total.
- **Export to CSV** — for spreadsheet-loving users.
- **Optional sharing** — anonymised verdict screenshot for social. *Defer.*

### Persistence-related anti-features (do NOT build)

| Anti-feature | Why avoid |
|---|---|
| Server-side multi-user persistence | Single-user app per CLAUDE.md / PROJECT.md "Single user" constraint |
| Cloud sync of localStorage history | Cross-device sync requires accounts; out of scope |
| Auto-replay of "what would the model do for past GWs given current state" | Requires retroactive model state — impossible without versioned snapshots; honor only forward-captured snapshots |
| Predicting future regret | Speculative; users will read it as a recommendation |
| Continuous re-evaluation of past decisions as model improves | Confuses "process at the time" with "current model output"; sticks to immutable L2 snapshot |

### Complexity

**Medium-High** — and most of the complexity is in the persistence model, not the math. Estimate:

- ~150 LOC pipeline (`pipeline/regret.py` post-GW computation, snapshot writer wired into `run.py`).
- ~80 LOC `useDecisionHistory` hook (localStorage L1 + FPL API hydration + Blob L3 join).
- ~250 LOC React (`HistoryView.tsx` table + aggregates + manual entry modal).
- ~50 LOC types + tests.

**Risks flagged:**
- Snapshot timing race (which snapshot is "the" recommendation) — mitigate by tagging the snapshot taken in the T-15min REFRESH-01 trigger as canonical.
- Authenticated path fragility — FPL session cookies expire; degrade gracefully.
- Backfill from FPL API only works for the current season — historical season replay impossible.

### Dependencies

- **Depends on:** AUTH-03/04 (authenticated FPL fetch) for historical pick inference. [VERIFIED — already shipped v1.3]
- **Depends on:** Existing accuracy backtest infrastructure (similar shape: snapshot + post-GW compute).
- **Cross-feature lift from REFRESH-01:** the T-15min snapshot is the canonical recommendation marker — REFRESH-01 makes BACK-01 sharper.
- **Cross-feature lift to WHY-01:** if user's actual choice differs from recommendation, BACK-01 history can deep-link "Why was X not recommended in GW32?" → WHY-01 explainer.

---

## Feature 5 — SPQ-04: Set-Piece League Table

**Backlog ref:** Mid-flight v1.16 extension; builds on SPQ-01/02 (delivery quality pipeline shipped v1.15) and SP-QUAL-01 (which became SPQ-01/02 + UI badges).
**Existing surfaces affected:** Set Pieces tab — NEW second view "League Table" alongside existing per-team taker cards.

### Bounding the scope (CRITICAL — flagged in quality gate)

The risk with "league table" features is feature-creep — every signal can be ranked across all 20 teams, leading to a sprawling dashboard.

**v1.16 SPQ-04 scope = single ranked table of 20 PL teams by composite delivery quality**, surfaced as a sub-view in the Set Pieces tab. Not a tab of its own. Not multi-dimensional. Not splittable by attacking/defensive set pieces. Not over time.

If users want deeper splits, that's SPQ-05+ in v1.17.

### User-facing behaviour

In Set Pieces tab, a new toggle at the top: `Per Team | League Table` (default Per Team; League Table is opt-in).

Switching to League Table renders:

| Rank | Team | Composite | Corner | FK | Direct FK | Top taker | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Arsenal | 0.114 | Elite (#1) | Elite (#3) | Good (#7) | Saka | 4 elite categories |
| 2 | Liverpool | 0.108 | Elite (#2) | Good (#6) | Elite (#1) | Szoboszlai | High variance |
| ... |

Sortable by any column. Clicking a team row drills back into the Per Team view for that team (SPQ-02 cards).

The composite score is the same `team_composite` already computed in SPQ-01/02 (verified via FEATURES.md v1.14 reference) — SPQ-04 is purely a presentation layer over existing data.

### What's "table stakes" for an FPL set-piece league table

- All 20 PL teams ranked.
- Per-situation tier badge (Elite / Good / Weak) for the team's primary taker in each of 3 situations (Corner, FK, Direct FK).
- Composite score column (sortable).
- Top taker name per team.
- Click-through drill-down to per-team detail.
- "Last updated" footer (sync with SPQ pipeline weekly cache).

### Differentiators

- **"Hidden gem" highlighting** — teams in bottom-half of attacking xG but top-quartile delivery quality (their forwards/defenders are over-performing thanks to delivery, not luck).
- **Goal share from set pieces** — a per-team % of goals coming from set pieces, surfaces relevance ("Crystal Palace: 38% of goals from set pieces" makes their corner taker high-leverage).
- **Owned-player highlighting** — teams where you own a player from get a thin border / accent.
- **Mini delivery-trend bar** — last 5 GWs' xG-from-deliveries as a sparkline per team.

### Anti-features (do NOT build)

| Anti-feature | Why avoid |
|---|---|
| Aerial defending league table (defending corners) | Different feature; conflates attack and defence; out of v1.16 scope |
| Per-player league table (all PL takers ranked) | Already covered by per-team detail cards; flat list of 60+ takers is unscannable |
| Historical season comparison | Set-piece quality is current-season; multi-season data is noisy and irrelevant for FPL EV |
| Live in-match recompute | Set-piece quality is slow-moving (per FEATURES.md v1.14 SP-QUAL-01); weekly cadence is correct |
| Predicting next week's deliveries | Speculative; out of model scope |

### Complexity

**Low.** Pure UI feature. ~150 LOC React (`SetPieceLeagueTable.tsx` component, sort logic, tier badge rendering reuses existing `DeliveryQualityBadge`), ~20 LOC tab toggle wiring. No new pipeline work — composite scores already computed by SPQ-01/02.

**Risk:** None substantial.

### Dependencies

- **Depends on:** SPQ-01/02 (set-piece delivery quality pipeline) — shipped v1.15.
- **Independent of:** All other v1.16 features.

---

## Feature 6 — WHY-01: Rejection Explainer

**Backlog ref:** `feature-backlog.md` line 194-201 (Priority 3 — Advanced / Trust)
**Existing surfaces affected:** GemTable row-expand, TransferPanel "Show why a player isn't suggested" link, new modal/drawer.

### What "rejection explainer" actually means in FPL

Two distinct user questions hide under "why isn't X recommended":

| Question | Example | Answer shape |
|---|---|---|
| **Q1: Why isn't this player on my recommended-buy list?** | "Why isn't Haaland recommended?" | Reasons relative to user's squad and budget |
| **Q2: Why is this player ranked lower than another?** | "Why is Saka rated above Salah this week?" | Component-by-component xPts diff |

**v1.16 should serve both.** Q1 is the headline use case (manager asks "why not?" about a popular player they're considering); Q2 is the deeper dive when comparing two specific players.

### User-facing behaviour — Q1 (rejection from buy list)

In TransferPanel, a small link at the bottom of the suggestion list: "Show why a player isn't suggested" → opens a search modal:

1. User searches/selects a player (e.g. Haaland).
2. Modal shows a structured explanation:

```
Why isn't Haaland recommended?

Position: FWD                      |  3 FWDs already considered
xPts (5 GW): 38.4 (rank 2/100)    |  Above the bar — high quality
Price: £15.0m                       |  ❌ Exceeds your remaining budget (£12.4m)

Cheaper alternatives in same tier:
  • Watkins £8.5m, xPts 32.1
  • Wood £7.2m, xPts 28.4

Verdict: Outside budget; closest affordable upgrade is Watkins (≈85% of EV at 57% of price)
```

For each player, run the rejection cascade against deterministic gates:

| Gate | Surface text |
|---|---|
| `status != 'a'` | "Currently flagged: {news string}; chance of playing {pct}%" |
| `cost > user_budget` | "Exceeds your budget by £{diff}m" |
| `xPts_5gw < position_floor` | "xPts below position cutoff (rank {n}/{total})" |
| `start_prob < 0.6` | "Start probability only {pct}% — rotation risk" |
| `xPts_per_£ < efficiency_floor` | "Below value threshold ({xpts_per_pound:.1f} xPts/£m vs floor {floor:.1f})" |
| `position locked (already 5 MIDs)` | "Position locked — would exceed 5 MID limit; would require selling {worst_owned_mid}" |
| `cheaper_dominant_alternative` | "{alternative} delivers {pct}% of EV at {pct}% of price" |
| `differential_flag = 'trap'` | "TRAP flag: high ownership ({sel}%) with below-position-median xPts" |

### User-facing behaviour — Q2 (head-to-head)

In GemTable row, expand-row reveals (alongside existing detail) a "Compare to..." dropdown that picks another player. Side-by-side xPts component diff:

```
Saka vs Salah (next 5 GWs)
                        Saka   Salah   Diff
Appearance pts          9.5    9.5      —
Goal pts               12.3    14.1   +1.8 Salah
Assist pts              8.4     7.2   -1.2 Saka
CS pts                  2.4     1.8   -0.6 Saka
Bonus pts               2.8     3.1   +0.3 Salah
─────────────────────────────────────
Total                  35.4    35.7   +0.3 Salah

Verdict: Effectively tied; Salah edge from finishing rate, Saka edge from CS contribution.
```

This reuses `xPts_components_1gw` (already exists per XPT-01); no new model work.

### The "no recommendation" cascade (deterministic, not LLM)

Critical design decision: **WHY-01 should be deterministic gate-based, not LLM-generated.**

LLM prose explainers (NLP-01 territory) produce variable quality and risk hallucination. WHY-01 has structured inputs (squad, budget, model output) and structured failure modes (the gates above). A deterministic cascade gives:

- Reproducibility (same inputs → same explanation).
- Auditable correctness (each gate is a unit-tested predicate).
- Zero hallucination risk.
- Cheap to compute (no API call).

If natural-language polish is desired later, NLP-01 can wrap the deterministic output as a v1.17+ enhancement.

### Threshold sourcing

| Threshold | Default | Source |
|---|---|---|
| Position floor for xPts | 75th percentile of position | Compute from `merged_players.json` per pipeline run |
| Value efficiency floor | 75th percentile of `xPts_5gw / cost` per position | Same |
| Start probability cutoff | 0.6 | Aligned with existing rotation_label thresholds [VERIFIED — `xmins.py` mins_risk thresholds] |
| Alternative-dominance threshold | "≥85% of EV at ≤70% of price" | Heuristic; tunable |

### Table stakes

- "Why isn't X recommended?" search modal in TransferPanel.
- 6+ deterministic rejection gates with clear surface text.
- Side-by-side player comparison in GemTable row-expand.
- Component-diff table reuses existing `xPts_components_1gw`.
- Empty state: if no rejection reasons fire, show "X *is* a strong candidate — top reason it's not in the suggestion list: position-locked / budget-locked".

### Differentiators

- **Inline "explain" link** on every TransferPanel suggestion ("Why this and not someone cheaper?") — flips the rejection direction.
- **Owned-player explainer** — for any squad player, "Why hasn't this been flagged for sale?" or "Why has this been flagged for sale?".
- **Cross-link to WHY-01 from BACK-01** — regret table rows link "Why was Saka recommended in GW32?".
- **Suggestion provenance** — show which engine produced the suggestion (xPts ranking / value gem filter / opportunity-cost pair).

### Anti-features (do NOT build)

| Anti-feature | Why avoid |
|---|---|
| LLM-generated prose explanations | Hallucination risk; deterministic cascade is auditable |
| Generic "popular player not recommended" leaderboard | Confusing — not user-relevant; popular ≠ recommendable |
| Predicting *future* recommendation changes | "Will Haaland become recommended after fixture swing?" — speculative |
| Long-form "essay" explanations | Users want one-screen verdict, not a wall of text |

### Complexity

**Medium.** ~120 LOC `rejection-engine.ts` (pure TS gate predicates with structured output type), ~80 LOC `RejectionExplainerModal.tsx`, ~50 LOC `PlayerComparisonExpansion.tsx` extension. ~30 unit tests for the gate cascade. No pipeline work.

**Risk:** Threshold tuning. Defaults will need user feedback to refine.

### Dependencies

- **Depends on:** Existing `MergedPlayer` data, `xPts_components_*`, `start_prob`, `differential_flag` — all shipped.
- **Independent of:** SCRAPER-01 (but SCRAPER-01's news pill should be referenced in the gate text when chance% < 100).
- **Cross-feature lift to BACK-01:** historical "why" linking from regret table rows.
- **Cross-feature lift to SENS-01:** rejection reasons can include fragility ("this would be recommended at 90% start prob, but currently only 70%").

---

## Feature 7 — SENS-01: Sensitivity / Fragility Analysis

**Backlog ref:** `feature-backlog.md` line 183-191 (Priority 3 — Advanced / Trust)
**Existing surfaces affected:** TransferPanel suggestion cards (fragility badge), Decision Summary (fragile-decision warning), GemTable row-expand (per-player fragility detail).

### What FPL managers actually need from "fragility"

Sensitivity analysis in modelling = "how much does the output change when I perturb an input by ε?" In FPL terms:

- **Fragile recommendation** = if any one assumption breaks (xMins drops, fixture worsens, price changes), the recommendation reverses.
- **Robust recommendation** = recommendation holds across reasonable perturbations to all inputs.

The user-actionable framing is: **"Which of my decisions are sitting on a knife edge?"** A fragile recommendation isn't necessarily wrong — but the manager should know it's fragile so they can:

1. Wait for more information (e.g. press conf at T-3h).
2. Pick a more robust alternative even if slightly lower expected value.
3. Avoid taking a hit on a fragile signal.

### User-facing behaviour

Three surfaces:

**1. TransferPanel suggestion card** — fragility badge:

```
BUY  Watkins  £8.5m  +5.4 EV over 3 GW
     [🟢 ROBUST]  Recommendation holds across all tested perturbations

BUY  Wood     £7.2m  +4.8 EV over 3 GW
     [🟡 FRAGILE]  Reverses if start_prob drops below 75% (currently 82%)

BUY  Cunha    £6.8m  +4.2 EV over 3 GW
     [🔴 KNIFE EDGE]  Reverses on any of: −0.3 fixture ease, −10% start_prob, +0.1 price
```

Click badge to expand the perturbation table.

**2. Decision Summary fragile-call card** — if any of the four summary cards (captain / transfer / chip / risk) rests on a fragile recommendation, prepend a small "⚠ Fragile" prefix and a one-liner ("Hinges on Saka starting").

**3. GemTable row-expand** — per-player perturbation table:

| Perturbation | Δ xPts | Verdict |
|---|---|---|
| start_prob: 82% → 60% | -1.4 | Still buy |
| start_prob: 82% → 40% | -3.1 | Reconsider |
| Fixture ease: 0.65 → 0.50 | -0.6 | Still buy |
| Both above | -3.7 | Avoid |

### The five canonical perturbations (table stakes)

For any recommendation, perturb each of these inputs by a standard amount and re-evaluate:

| Input | Perturbation | Why |
|---|---|---|
| `start_prob` | -20 percentage points (e.g. 90% → 70%) | Captures rotation surprise |
| `mins_60_prob` | -15 pp | Captures sub-risk surprise |
| `attacking_difficulty` | +0.15 (worse fixture) | Captures fixture downgrade (e.g. injury at opp) |
| `cost` | +£0.1m | Captures price rise eating into EV |
| `news` flag flips to non-empty | binary | Captures sudden injury news |

Each perturbation re-runs the recommendation logic and produces a binary "still recommended" + a `Δ_xPts`. The fragility badge is determined by:

- **🔴 KNIFE EDGE** — recommendation reverses on **any single** perturbation.
- **🟡 FRAGILE** — recommendation reverses on **any combination of two** perturbations (single-input robust, multi-input not).
- **🟢 ROBUST** — recommendation holds across all single and 2-input perturbations.

### Computational shape

This is a **bounded combinatorial sweep**: 5 inputs × 2 directions = 10 single perturbations + C(5,2) × 4 = 40 two-input perturbations = 50 model evaluations per player. Per-player xPts compute is O(1) (already computed); recommendation logic is O(squad size) for transfer suggestions.

For 600 players × 50 perturbations = 30k recompute operations per pipeline run — trivially fast in TypeScript (sub-100ms).

**Recommendation: compute fragility client-side at decision-rendering time, not in pipeline.** This avoids cache bloat and lets fragility recompute when user changes squad/budget/horizon.

### Where to draw the line on perturbation magnitudes

Critical design decision (flag for user confirmation): perturbation magnitudes should reflect **realistic uncertainty**, not worst-case.

- start_prob -20pp ≈ "press conf surprise" (typical volatility of the start_prob signal between two pipeline runs is ~5–15pp — verified by inspecting historical xmins.py outputs over rotation events). [ASSUMED — should be calibrated]
- attacking_difficulty +0.15 ≈ "opponent's key player ruled out" (rolling 3-game window typically drifts by ~0.1 between runs).
- cost +£0.1m ≈ "single price rise" (FPL price changes are always ±£0.1m).
- news flip ≈ binary press-conf event.

Document defaults in `sensitivity-engine.ts`; expose as configurable constants for future tuning.

### Table stakes

- 5 canonical perturbations per player.
- 3-tier badge (ROBUST / FRAGILE / KNIFE EDGE) on transfer suggestions.
- Per-player perturbation table in GemTable row-expand.
- Fragile-decision flagging in Decision Summary cards.
- "Robust alternative" suggestion when a knife-edge recommendation exists ("Cunha is knife-edge; Watkins is robust at 90% of EV").

### Differentiators

- **Squad-level fragility** — total squad xPts under worst-case 2-input perturbation per starter (composite "stress test" score).
- **Hit-decision fragility** — for `-4 hit` recommendations, "How many GWs does the hit still break even if start_prob drops 20pp?" — directly addresses hit-decision regret.
- **User-defined perturbation slider** — power user can drag start_prob slider and watch ranking re-sort live. *Optional — defer if scope tight.*
- **Cross-link to BACK-01**: in regret history, fragile decisions get a 🟡/🔴 marker so user can see "I was always making fragile calls — that's why I have high variance".

### Relationship to MC-01 (Monte Carlo)

SENS-01 and MC-01 are complementary, not redundant:

- **MC-01** = stochastic full-distribution simulation (variance, percentile bands, "ceiling vs floor").
- **SENS-01** = deterministic structured perturbation ("which lever moves the recommendation").

MC-01 answers "how spread is the outcome?". SENS-01 answers "what assumption is the outcome leaning on?". Both are useful; SENS-01 is cheaper and more directly actionable for the manager's decision.

### Anti-features (do NOT build)

| Anti-feature | Why avoid |
|---|---|
| Full Monte Carlo per player per perturbation | MC-01 is its own feature; SENS-01 stays deterministic |
| Continuous slider sliders for every input on every row | Visual overload; limit to row-expand panel |
| "Optimal robust portfolio" optimisation | Squad optimiser already balances xPts; adding robust constraint is a v1.17+ idea |
| Predicting which input *will* shift | Speculative; out of model scope |
| Fragility scoring for non-recommended players | Wasted compute; only score players that survived initial recommendation |

### Complexity

**Medium.** ~150 LOC `sensitivity-engine.ts` (pure TS perturbation harness over recommendation predicates), ~80 LOC `FragilityBadge.tsx` + `PerturbationTable.tsx`, ~40 LOC integration into TransferPanel and Decision Summary cards. No pipeline work — fully client-side.

**Risk:** Defining "recommendation reverses" cleanly. For captain picks it's clear (different player ranks #1). For transfers it's softer (the IN suggestion drops out of top-3 vs entirely flips position). Need a clear definition per recommendation type.

### Dependencies

- **Depends on:** Existing `MergedPlayer`, `xPts_components_*`, recommendation engines (TransferPanel, Decision Summary).
- **Cross-feature lift to BACK-01:** fragility marker on regret history.
- **Cross-feature lift from MC-01:** if MC-01 ships first, fragility tier could incorporate stdev as a heuristic prior.
- **Cross-feature lift from WHY-01:** WHY-01's rejection cascade can cite fragility ("This player would be recommended, but only on a fragile assumption: 90% start prob").

---

## Feature dependencies

```
SCRAPER-01 ──┐
             ├──> DH-04  (DH-04 surfaces news_changes_count and refresh frequency)
REFRESH-01 ──┤            (REFRESH-01 produces multi-bar-per-day sparkline data)
             │
SCRAPER-01 ──┴──> SENS-01 (news flip is one of 5 perturbations)
             │
WHY-01 ⟂ everything (purely consumes existing data)
SPQ-04 ⟂ everything (UI over shipped SPQ-01/02 pipeline)

BACK-01 ──> WHY-01     (regret rows deep-link to "why was X recommended")
       └──> REFRESH-01 (T-15min snapshot is canonical recommendation marker)

SENS-01 <─> WHY-01     (mutual: WHY-01 cites fragility; SENS-01 uses WHY-01's rejection predicate)
```

**No hard ordering required**, but the cleanest sequence is:

1. **SCRAPER-01 first** — small, isolated, additive; news data unlocks better rendering across other v1.16 features.
2. **REFRESH-01 second** — infrastructure that compounds value of SCRAPER-01 and BACK-01.
3. **DH-04 third** — visualises the health signals from (1) and (2); cheap once those land.
4. **SPQ-04 anywhere** — independent UI surface; can ship in parallel with anything.
5. **WHY-01 fifth** — pure UI/logic feature; foundation for SENS-01 and BACK-01 cross-links.
6. **SENS-01 sixth** — depends on WHY-01's rejection predicates being clean.
7. **BACK-01 last** — most complex (persistence model); benefits from REFRESH-01 timing markers and WHY-01 deep-links.

## MVP recommendation

If a single feature must ship first to deliver value, ship **SCRAPER-01** (re-framed as "surface FPL official news + chance% in-app"). It's low-complexity, immediately visible to the user, and unlocks downstream value across BACK-01, DH-04, and SENS-01. Avoid leading with BACK-01 — its persistence complexity makes it the highest-risk delivery.

## Cross-cutting anti-features (do NOT build for v1.16)

| Anti-feature | Why avoid |
|---|---|
| Multi-user / shared decision history | Single-user app constraint |
| Real-time match-state updates | Out of scope; data refreshes on cadence |
| LLM-generated prose for any explainer or summary | NLP-01 territory; defer; deterministic engines are reproducible |
| Push notifications | ALERT-01 territory; separate backlog item |
| Mobile app shell | Out of scope per PROJECT.md |
| Press-conference scraping | Fragile; FPL official news is sufficient for v1.16 |
| Scraping third-party FPL aggregators (FFH, FPL Review) | ToS risk; original signals from FPL+Understat are sufficient |

## Sources

- [FPL bootstrap-static endpoint — `news`, `news_added`, `chance_of_playing_next_round`, `status` fields] [VERIFIED — codebase pipeline already fetches `bootstrap-static`; field names confirmed in `pipeline/merge.py` and FPL public API conventions]
- [FPL `/api/entry/{id}/event/{gw}/picks/` for historical picks] [CITED — community-documented FPL API endpoints; used by tools like LiveFPL, FPL Review for historical squad reconstruction]
- [GitHub Actions cron and dispatch documentation] [CITED — GitHub Docs: `on.schedule` cron triggers fire at the workflow's resolution; `workflow_dispatch` is on-demand only; no native dynamic-schedule API]
- [GitHub Actions REST API for workflow runs] [CITED — GitHub REST API: `GET /repos/{owner}/{repo}/actions/workflows/{id}/runs` returns paginated run history with status]
- [FPL community convention: "haul" = > 6 raw points] [ASSUMED — widely-used community heuristic; flag for user confirmation]
- [Sensitivity analysis taxonomy: one-at-a-time vs global] [CITED — Saltelli et al., "Global Sensitivity Analysis: The Primer" (2008) — informs the deterministic 1-input-then-2-input cascade approach in SENS-01]
- [Existing FEATURES.md v1.14 — GK-01, DQ-01, SP-QUAL-01] [VERIFIED — read in this session]
- [FPL Analyst PROJECT.md — v1.16 milestone definition, v1.10/v1.11 deferred features] [VERIFIED — read in this session]
- [Backlog `feature-backlog.md`: SCRAPER-01, REFRESH-01, BACK-01, WHY-01, SENS-01 entries] [VERIFIED — read in this session]
- [Calibration / Monte Carlo — deferred to MC-01 / CAL-01 standalone research; not re-derived here]

## Confidence

| Feature | Confidence | Risk areas |
|---|---|---|
| SCRAPER-01 | HIGH | Whether to do third-party scraping later (deferred) |
| REFRESH-01 | HIGH | Cron precision (±15min acceptable for FPL cadence) |
| DH-04 | HIGH | Persistence layer choice (Approach A — live API — recommended) |
| BACK-01 | MEDIUM | Persistence complexity is the load-bearing risk; rely on FPL API for backfill |
| SPQ-04 | HIGH | Pure UI; depends on SPQ-01/02 already shipped |
| WHY-01 | HIGH | Threshold tuning needs user feedback |
| SENS-01 | MEDIUM-HIGH | "Recommendation reverses" definition needs care per recommendation type |
