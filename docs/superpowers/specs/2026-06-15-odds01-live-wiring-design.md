# ODDS-01 Live-Wiring Follow-up — Design

**Feature ID:** ODDS-01-LIVE (gated follow-up to ODDS-01; season-launch readiness §3)
**Date:** 2026-06-15
**Status:** Approved — spec only (turnkey for 2026/27 launch). Build when ready; the live source (`fixtures.csv`) carries no EPL rows until the season opens.
**Predecessor:** `docs/superpowers/specs/2026-06-14-odds01-bookmaker-odds-signal-design.md` (the validation build — VERDICT SHIP_BOTH on exp09: CS-prob blend lifts deploy top10_mean_pts 4.75→5.00 at weight 1.0; goal-expectation blend 4.93→5.04 at weight 0.25; market CS Brier 0.177).

---

## Problem

ODDS-01 validated, in the leakage-free backtest, that bookmaker closing odds beat the model's rolling-goals proxies for clean-sheet probability and fixture attack-difficulty. That build deliberately changed **no live behaviour** — the signal hooks were added to `_cs_prob`/`_compute_xpts_fixture` but the **live** xPts path never receives them. This follow-up wires the validated signal into the live `merge.py` path so it improves real 2026/27 picks, while keeping launch risk near zero.

## Launch posture (decided)

- **Shadow-first, then flip.** From GW1 the pipeline fetches odds, builds the lookup, and attaches the odds-implied values to each player's output for inspection/logging — but does **not** blend them into xPts until `ODDS_ENABLED` is flipped true after a live sanity check. Mirrors the cautious BPS-01 promote-after-shadow pattern. The validated signal is trusted; the new *external dependency* (live fetch, promoted-club aliases) is what gets a real-data shakedown first.
- **Weights are TUNE-01-tunable with the validated defaults** (`cs=1.0`, `goalexp=0.25`), so the in-season honest tuner re-fits them on 2026/27 odds once GWs accrue (GW13+).

## Live odds source & parser

- **Source:** football-data.co.uk `fixtures.csv` (verified reachable 2026-06-15, HTTP 200) — the upcoming-fixtures file carrying **current** pre-match odds, updated through the week. Filter `Div == 'E0'`. (Off-season it lists only the next few days, so 0 EPL rows until the season opens — expected.)
- **Columns:** current average 1X2 `AvgH/AvgD/AvgA` + over/under `Avg>2.5`/`Avg<2.5`, with `B365H/D/A`, `B365>2.5`/`B365<2.5` per-cell fallback. There are **no closing (`AvgC*`) columns** — closing odds don't exist before kickoff (which is after the FPL deadline anyway), so current pre-deadline odds are the correct and only live signal.
- **New `odds_client` functions:**
  - `fetch_fixtures_csv() -> str` — GET `https://www.football-data.co.uk/fixtures.csv` with a browser UA; raises on non-200.
  - `parse_fixtures_csv(text) -> list[dict]` — `Div=='E0'` filter; reads `AvgH/D/A` + `Avg>2.5`/`Avg<2.5` with `B365*` fallback; same output row shape as `parse_odds_csv` (`{date, home, away, fthg, ftag, odds_1x2, odds_ou25}`; `fthg/ftag` absent/0 for unplayed fixtures); `utf-8-sig` BOM strip; skips rows missing a full 1X2 or O/U quote from both sources.
- **Fetch cadence:** fetched fresh each pipeline run (~4 KB); **non-fatal** — any failure → empty lookup → proxy unchanged. No persistent cache (odds move intra-week; unlike Understat's 24 h blob).

## Graceful live join (validation-vs-live difference)

`build_odds_lookup` currently **raises** on any unmapped team or unmatched fixture — correct for the experiment (no silent gaps), wrong for live (a single promoted-club alias gap must not kill the pipeline). Add a parameter:

- `build_odds_lookup(odds_rows, archive, strict: bool = True) -> dict`
  - **strict=True** (experiment, default — existing callers unchanged): raise on any unmapped team / unmatched fixture, as today.
  - **strict=False** (live): skip + `log` the unmapped team or unmatched fixture and continue. A skipped fixture simply falls back to the proxy (per-fixture no-op). `resolve_team_ids` gains the same strict/skip behaviour (live builds the name→id map from only the teams it can resolve).

Live call: `build_odds_lookup(rows, {'bootstrap': bootstrap, 'fixtures': fixtures}, strict=False)` (no `summaries` needed — the builder only uses `bootstrap['teams']` + `fixtures`).

**Launch task (do at bootstrap):** add the 3 promoted-club names to `FOOTBALL_DATA_TO_FPL`. Shadow-mode logging surfaces any alias gap before the flip.

## Live integration into `merge.py`

The signal hooks in `_cs_prob` (merge.py:214-215, blend at :244) and `_compute_xpts_fixture` (merge.py:324-325, CS at :375-382; FAS at :359) already exist. Three wiring changes carry the signal the last mile:

1. **Thread the missing hop.** Add `odds_lookup=None`, `odds_cs_weight=0.0`, `odds_goalexp_weight=0.0` to `_xpts_ngw` (merge.py:425) and `_xpts_per_gw` (merge.py:511). Inside, per fixture: `od = odds_lookup.get((fix['fixture_id'], fix['team_id'])) if odds_lookup else None`; pass `odds_cs_prob=(od['cs_prob'] if od else None)`, `odds_cs_weight=odds_cs_weight` into `_compute_xpts_fixture`; and blend goal-exp into a **separate** `atk_difficulty` (never mutating the `defensive_difficulty`/`attacking_difficulty` reads that feed CS) before passing `attack_difficulty=atk_difficulty`. Identical signal separation to the validated backtest (backtest.py:438-442).
2. **Enrich fixture dicts.** Add `'fixture_id': fix['id']` and `'team_id': h_id` (home dict, merge.py:1187) / `'team_id': a_id` (away dict, merge.py:1203) so the live path can key the lookup. Odds only cover the imminent GW(s); 3-/5-GW-horizon fixtures miss the lookup → proxy fallback automatically (graceful, no special-casing).
3. **`merge_players` signature** (merge.py:939) gains `odds_lookup=None`, `odds_cs_weight=0.0`, `odds_goalexp_weight=0.0`, forwarded into every `_xpts_ngw`/`_xpts_per_gw` call. No-op defaults keep all existing tests/callers green.

## Shadow mode, weights & the flip

- **`accuracy.py` constants** (after line 48): `ODDS_ENABLED = False`, `ODDS_CS_WEIGHT = 1.0`, `ODDS_GOALEXP_WEIGHT = 0.25`.
- **run.py:** a module-level `_build_odds_signal() -> dict` helper (non-fatal try/except, COLD-01 `_build_cold_start_prior` pattern) fetches `fixtures.csv`, parses live, and returns `build_odds_lookup(..., strict=False)` (empty dict on any failure). Called once in the `if not IS_OFF_SEASON:` block, before `merge_players`.
- **Effective weights:** `odds_cs_weight_used = ODDS_CS_WEIGHT if accuracy.ODDS_ENABLED else 0.0` (same for goalexp), passed to `merge_players`. So when `ODDS_ENABLED=False` the blend is a pure no-op, **but the lookup is still built** and each player gets `player['odds_cs_prob']` / `player['odds_attack_difficulty']` attached (null when the player's next fixture has no odds) for inspection/logging.
- **TUNE-01 plumbing:** `odds_cs_weight_used`/`odds_goalexp_weight_used` read from `accuracy_backtest.json` `summary` (the `fas_slope_used` pattern) when present, so the honest tuner re-fits them in-season. The `ODDS_ENABLED` gate multiplies the result (tuner can't enable a disabled signal).
- **The flip:** after the launch sanity check (live fetch works, all 20+3 aliases resolve, odds-implied CS-probs sane in the logs), set `ODDS_ENABLED = True`. One-line change; weights then take their tuned/validated values.

## Testing

- `parse_fixtures_csv`: parses the live header (`AvgH/D/A`, no `AvgC*`); B365 fallback per cell; `Div=='E0'` filter drops other leagues; BOM stripped; row missing both sources skipped.
- `build_odds_lookup(strict=False)`: unmapped team and unmatched fixture are skipped + logged (not raised); a still-resolvable fixture in the same batch is included. `strict=True` (default) still raises (existing exp/test behaviour unchanged).
- `merge.py`: odds params no-op at weight 0 (existing xPts tests unchanged); a player whose next fixture has an odds entry, at weight>0, blends CS at the raw-prob stage and attack-difficulty into `atk_difficulty` only (CS `defensive_difficulty` untouched); per-team fixture dicts now carry `fixture_id`/`team_id`.
- `run.py`: `_build_odds_signal()` returns `{}` non-fatally when the fetch raises; with `ODDS_ENABLED=False`, merged xPts equals the no-odds baseline AND `player['odds_cs_prob']` is populated where odds exist; with `ODDS_ENABLED=True` + a non-empty lookup, xPts differs.
- Full pipeline suite green; new params backward-compatible no-ops by default.

## Out of scope

- Flipping `ODDS_ENABLED` true — a manual post-launch decision after the sanity check, not part of this build.
- the-odds-api or any second odds source; Dixon-Coles low-score correction (the refinement now that Approach A validated).
- UI surfacing of the odds-implied values (the `player['odds_*']` fields are for logs/inspection, not display).
- Re-validation on 2026/27 (happens automatically via the in-season honest tuner once odds + GWs accrue).
