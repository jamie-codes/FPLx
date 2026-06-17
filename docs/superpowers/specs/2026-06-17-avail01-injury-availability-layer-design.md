# AVAIL-01 — Injury / Availability Layer

**Feature ID:** AVAIL-01
**Date:** 2026-06-17
**Status:** Approved — design. Build = BT-02 validation harness + gap-fill classifier change + shadow-first live wiring (disabled by default). No live default changes until BT-02 validates and the flag is flipped.

---

## Problem & honest framing

FPLx has no real injury/availability feed. Availability today is `news_classifier.classify_availability(status, chance, news_text)`: it reads FPL's `status` code, then `chance_of_playing_next_round`, then — when both are silent — **keyword-scans the free-text FPL `news` string**. The one prior attempt at a real feed (scraping premierleague.com injuries) is documented as dead (JS-rendered, ~zero matches).

The user now has an **api-football Pro** subscription (7,500 req/day, current 2025/26 PL season + 5 back seasons, `injuries` coverage = true). Its `injuries` endpoint returns structured per-player, per-fixture availability with `type` (`Missing Fixture` / `Questionable`) and a free-text `reason` (e.g. "Thigh Injury", "Broken Leg", "Red Card").

This feature plugs that structured data into the **one weak spot**: the keyword-scan fallback. It is mostly *defensive* EV — it stops the model predicting points (and suggesting captaincy) for a player who will not play. It will not find hauls; it prevents zeros. A captained player who turns out injured is the single worst weekly outcome, so the leverage is real, but the **honest caveat is stated up front**: the measured gain may be modest because FPL's own flags already catch most cases. BT-02 decides whether it is real.

## Scope decisions (from brainstorming)

1. **Validation gate: validate-first in BT-02.** Reconstruct as-of historical injuries per GW, fold into the leakage-free backtest, measure uplift, and promote (enable live) **only on a measured win that beats a placebo**. Same discipline as COLD-01 / ODDS-01 / EUR-01. This directly guards the main risk — stale/noisy api-football data wrongly benching players who actually play.
2. **Precedence: gap-fill only.** FPL stays authoritative when it has a definite signal. api-football fills **only** the bucket where FPL is silent (`status='a'`, `chance=null`). It can never override an official FPL flag. Lowest variance, easiest to validate.
3. **Signal scope: availability gate only.** Use the injury record purely to classify `out` / `doubt` / `fit`, feeding the existing `0.0 / 0.5 / 1.0` `availability_factor`. No suspension-vs-injury distinction, no return-to-play minutes ramp (YAGNI; both deferred).

## Architecture

All ingestion lives in `pipeline/`. New modules are small and single-responsibility.

### `pipeline/injury_client.py` — fetch + cache
- `fetch_season_injuries(season=2025, league=39) -> list[dict]` — `GET https://v3.football.api-sports.io/injuries?league={league}&season={season}`, header `x-apisports-key: $APIFOOTBALL_KEY`. Returns the raw `response` list. Used for the committed snapshot and for the season backtest reconstruction.
- `fetch_fixture_injuries(fixture_id) -> list[dict]` — `GET .../injuries?fixture={fixture_id}` for the live per-GW path.
- 24h disk cache at `cache/apifootball_injuries.json` (mirrors `understat_client`'s cache pattern).
- API key read from env `APIFOOTBALL_KEY`; **never committed**. Missing key → raise a clear error on the live fetch path only (the snapshot/backtest path needs no key).
- HTTP via the same library the existing `*_client.py` modules use (match the codebase; do not introduce a new dependency).

### `pipeline/injury_join.py` — join api-football → FPL
- `APIFOOTBALL_TEAM_TO_FPL: dict[str, str]` — api-football team name → FPL `short_name` (20 entries; mirrors `FOOTBALL_DATA_TO_FPL` in `odds_join.py`).
- `normalize_name(name) -> str` — lowercase, strip accents/punctuation, collapse "C. Gakpo" / "Cody Gakpo" toward a comparable key (last name + first initial).
- Persistent `pipeline/data/apifootball_id_map.json` — `{api_football_player_id: fpl_element_id}`, seeded by team-first then within-team normalised-name match, manual-override capable (mirrors the Understat `player_id_map.json`).
- `build_injury_lookup(records, bootstrap) -> dict[int, dict]` — live: `{fpl_element_id: {'risk': 'out'|'doubt', 'reason': str}}`. Uses the most-recent / upcoming-fixture records.
- `build_backtest_injury_lookup(records, archive) -> dict[tuple[int,int], str]` — lab: `{(gw, fpl_element_id): 'out'|'doubt'}`. Maps each record's `fixture.id` → GW via the archive fixtures (`event`), and api-football player → FPL element via the id-map.
- `coverage_report(records, bootstrap) -> dict` — counts matched / unmatched players + teams, lists unmatched names (à la STH-01). Surfaces join gaps for the launch/maintenance checklist.
- **Type → risk mapping:** `type == 'Missing Fixture'` ⇒ `out`; `type == 'Questionable'` ⇒ `doubt`. (`reason` is carried for display only; suspensions like "Red Card" arrive as `Missing Fixture` ⇒ `out`, which is correct without special-casing.)

### `pipeline/data/injuries/apifootball_PL_2025_26.json` — committed snapshot
A one-time dump of the 2025/26 season injury records, committed so BT-02 and CI are reproducible **without the API key** (mirrors the committed `data/odds/E0_2025_26.csv`). The live path fetches fresh; the lab/CI path reads this file.

### `pipeline/news_classifier.py` — the seam (gap-fill precedence)
`classify_availability(status, chance, news_text, injury=None)` gains one optional arg and one new priority tier:

- **P1** — `status in ('i','u','s')` → `out` (0.0). *(FPL, unchanged.)*
- **P2** — `chance is not None` → fit/doubt/out by the existing thresholds. *(FPL, unchanged.)*
- **P3 — NEW** — `injury` present → `'Missing Fixture'` ⇒ `out` (0.0); `'Questionable'` ⇒ `doubt` (0.5).
- **P4** — news keyword scan. *(Existing fallback, unchanged.)*
- **P5** — `unknown` → 1.0.

Because P3 is reached only when P1 and P2 are silent (FPL `status='a'` and `chance=null`), this is **pure gap-fill** — it cannot override an official FPL flag. The function stays pure (no I/O); the `injury` record is passed in by the caller.

### `pipeline/xmins.py` — live caller
`_compute_player_xmins` already calls `classify_availability` at line ~265. Add an optional `injury_lookup` parameter threaded from `run.py`; pass `injury_lookup.get(element['id'])` as the new `injury` arg. The double-penalty guard (factor applied only when `chance` is null/0) is unchanged and continues to apply.

### `pipeline/run.py` — live wiring, shadow-first
- Build the live injury lookup once per run (fetch via `injury_client`, join via `injury_join`), env-gated by `AVAIL_ENABLED` (default **off**).
- **Off (default):** injury info attached to player dicts for inspection (e.g. `apifootball_injury`), but `availability_factor` is **not** changed — `xmins.py` is passed an empty lookup. Shadow-only, identical posture to ODDS-01's `ODDS_ENABLED`.
- **On (after BT-02 validates):** the populated lookup is threaded into `xmins.py`. A one-line flip; no other code change.
- Safe-default: a join miss / fetch failure ⇒ empty or partial lookup ⇒ affected players keep their FPL-derived availability. Never worse than today.

### `pipeline/backtest.py` — validation hook
- `run_backtest(..., injury_lookup=None, avail_out_factor=1.0, avail_doubt_factor=1.0)` — defaults are a strict no-op (preserves all existing backtest behaviour and numbers).
- When `(gw, player_id)` is present in `injury_lookup`, scale that GW's `xmins` by `avail_out_factor` (out) or `avail_doubt_factor` (doubt) before computing `xpts_pred`. The experiment sets `avail_out_factor=0.0` (and a chosen doubt factor) to gate injured players out.
- The backtest currently applies **no** availability gating, so this is cleanly additive and leakage-free (the GW-N flag is pre-deadline information — see below).

## Validation — `experiments/exp12_avail.py` (+ `.json`)

1. Load the committed 2025/26 injury snapshot; `build_backtest_injury_lookup` over the archive.
2. **Baseline:** `run_backtest(archive, mode='deploy')` (no injury lookup).
3. **Treatment:** same, with `injury_lookup` + `avail_out_factor=0.0` (doubt factor tunable, e.g. 0.5).
4. **Placebo (EUR-01 lesson):** same as treatment but with a *random same-size* set of "injured" `(gw, pid)` pairs (seeded for reproducibility). The real signal must beat placebo, not merely beat baseline.
5. Compare top10_mean_pts, captain_return_rate, haul_capture_20, rmse, spearman across baseline / treatment / placebo. Report how many predictions changed and the points delta on exactly the flagged players (injured players' actual points should be ≈0 — the mechanism check).
6. Write `exp12_avail.json` = `{baseline_metrics, treatment_metrics, placebo_metrics, n_flagged, changed_predictions, verdict, config}`. Print a table.
7. **Verdict gate:** `SHIP` only if treatment improves top-N / captaincy and does not hurt RMSE **and** beats placebo; else `NO_SHIP` (recorded honestly, like EUR-01).

**Leakage note (in spec + code):** api-football injury records are inherently pre-match — a player's unavailability is known before kickoff. Using the GW-N flag to predict GW-N is therefore leakage-free, exactly as using the GW-N fixture is. The reconstruction keys strictly on `fixture → event(GW)`; no post-match information enters a feature.

## Testing

- **`news_classifier`:** P3 fires only in the gap bucket (`status='a'`, `chance=null`); P3 never overrides P1 (`i/u/s`) or P2 (`chance` set); `Missing Fixture` ⇒ out, `Questionable` ⇒ doubt; `injury=None` reproduces today's behaviour exactly (regression guard for the existing tests).
- **`injury_join`:** team map resolves known names; `normalize_name` collapses initial/full-name variants; an unmatched player yields no lookup entry (safe no-op); `coverage_report` counts are correct; `build_backtest_injury_lookup` keys on the right GW via the archive fixtures.
- **`backtest` hook:** default args are a strict no-op (metrics byte-identical to current); `avail_out_factor=0.0` zeroes a flagged player's `xpts_pred` for that GW only.
- **`xmins`:** an injured (gap-bucket) player gets `availability_factor` reduced; an FPL-flagged player is unchanged (gap-fill respected).
- **`exp12`:** runs end-to-end on the committed snapshot; returns finite baseline/treatment/placebo metrics + a verdict string; writes the json. Mark `slow` if it dominates suite runtime.
- **Import-graph guard:** with `AVAIL_ENABLED` off, `run.py`'s behaviour and the production import graph are unchanged; api-football fetching is confined to `injury_client` and its tests.

## Out of scope (YAGNI / deferred)

- Suspension-vs-injury distinction and known-return-date logic.
- Return-to-play minutes ramp (graduated `xmins` on return).
- Overriding FPL flags (the "earlier-than-FPL" override edge) — deliberately not built; revisit only if gap-fill validates and there's evidence override helps.
- Predicted-XI / confirmed-lineup ingestion; referee data.
- Any UI change.
- football-data.org entirely (assessed redundant: no xG, post-deadline lineups, odds already covered by ODDS-01).
- Cold-start new-entrant priors from api-football (a separate, launch-gated candidate; not this feature).

## Dependencies & ops

- **Env:** `APIFOOTBALL_KEY` (live fetch only; not in CI). `AVAIL_ENABLED` (default off).
- **No new Python package** — reuse the existing HTTP client library.
- **Rate budget:** season dump = 1 call; live per-GW ≈ 10 fixture calls. Trivial against 7,500/day.
- **Reproducibility:** committed season snapshot makes BT-02 + CI key-free.
