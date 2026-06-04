"""Compute prediction accuracy backtest and prediction snapshots for the pipeline.

Phase 40 / ACC-01: writes accuracy_backtest.json (pre-aggregated per-GW summary
+ haulters list + per-player history over the last 5 finished GWs) and
predictions_snapshot.json (current GW projections for future backtest replay).

Locked decisions honoured (per .planning/phases/40-accuracy-pipeline/40-CONTEXT.md):
  D-01 last 5 finished GWs, D-02 history-based xG/xA, D-03 FPL 1-5 -> 0-1 difficulty,
  D-04 binary start_prob (>=45 min),
  D-07/D-08 output shape, D-09 haulter threshold = 10, D-10 top-10 = "flagged",
  D-11/D-12 snapshot file shape.

Claude's Discretion: MIN_MINUTES = 10 — players who played fewer than 10 minutes
in a GW are excluded from that GW's backtest entry. This filters genuine DNP entries
and cameos that add noise without meaningful prediction signal.

Module follows the defcon.py pattern: top-level docstring, constants, public
functions, private helpers prefixed with _. No HTTP calls, no file I/O — pure
transform over the inputs handed in by run.py.
"""

import json
import os
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional

HAULTER_THRESHOLD = 10       # D-09: actual_pts >= 10 -> haulter
MID_TIER_THRESHOLD = 6       # Phase 42 ACC-04: 6 <= actual_pts < 10 -> mid-tier scorer
TOP_N_PREDICTED = 10         # D-10: rank within top 10 -> "flagged"
TOP_N_PREDICTED_MID = 30     # Phase 42 ACC-04: top-30 net for mid-tier (CS defenders, bonus accumulators)
BACKTEST_GWS = 5             # D-01: last 5 finished GWs
MIN_MINUTES = 10             # Claude's Discretion: skip <10-min entries (filters DNPs and noise from late subs)
GATE_MARGIN_PP = 0.02        # Phase 42 ACC-03 / Pitfall 3: require 2pp margin to flip gate (anti-flap)
BLEND_ALPHA = 0.4            # Phase 42 ACC-01: form-signal blend coefficient (matches merge.BLEND_ALPHA)
FORM_WINDOW_GWS = 5          # Phase 42 ACC-01: same window as merge._compute_form_signal default
FORM_MIN_MINUTES = 270       # Phase 42 ACC-01: same minutes floor as merge._compute_form_signal default
CS_PROB_BASE = 0.40          # TUNE-01: default base CS probability vs average opposition
CS_PROB_SLOPE = 0.30         # TUNE-01: default CS probability sensitivity to opponent strength
FORMULA_VERSION = 'v1.12-a'  # Phase 63 D-01 / VER-01: bumped manually when prediction formula changes; pattern v{milestone}-{letter}


def build_fixture_difficulty_lookup(fixtures: list) -> dict:
    """Build (gw, team_id) -> difficulty_score lookup from the fixtures list.

    Extracted from compute_accuracy_backtest inner setup so tune.py can reuse it
    without calling the full backtest. Identical mapping to the original inline block.

    difficulty_score = (raw_difficulty - 1) / 4.0  (1=easiest → 0.0, 5=hardest → 1.0)
    """
    lookup: dict = {}
    for fix in fixtures:
        gw = fix.get('event')
        if gw is None:
            continue
        lookup[(gw, fix['team_h'])] = (fix.get('team_h_difficulty', 3) - 1) / 4.0
        lookup[(gw, fix['team_a'])] = (fix.get('team_a_difficulty', 3) - 1) / 4.0
    return lookup


def compute_metrics_for_gws(per_gw_rows: dict, gws: list) -> dict:
    """Compute haul hit rate, xPts RMSE, and captain hit rate over the given GWs.

    Args:
        per_gw_rows: dict mapping gw (int) -> list of player-row dicts. Each row must
                     have: player_id, actual_pts, xpts_blended_predicted, element_type.
        gws:         List of GW numbers to include in the metric computation.

    Returns:
        {'haul_hit_rate': float, 'rmse': float, 'captain_hit_rate': float}
        All values are rounded to 4 decimal places. Returns all-zero dict for empty input.

    Note: Ranking for haul_hit_rate and captain_hit_rate is by ``xpts_blended_predicted``.
    This corresponds to ``xpts_blended_hit_rate`` in the backtest output, not ``xpts_hit_rate``.
    """
    import math as _math
    total_haulters = 0
    total_flagged = 0
    squared_errors: list = []
    captain_hits = 0
    captain_gws = 0

    for gw in gws:
        rows = per_gw_rows.get(gw, [])
        if not rows:
            continue

        # Rank all players by blended xPts descending for this GW
        ranked = sorted(rows, key=lambda r: r['xpts_blended_predicted'], reverse=True)
        rank_by_id = {r['player_id']: i + 1 for i, r in enumerate(ranked)}

        # Haul hit rate: haulters (≥10 actual pts) ranked in top 10
        gw_haulters = [r for r in rows if r['actual_pts'] >= HAULTER_THRESHOLD]
        total_haulters += len(gw_haulters)
        total_flagged += sum(
            1 for r in gw_haulters
            if rank_by_id.get(r['player_id'], 9999) <= TOP_N_PREDICTED
        )

        # RMSE: all players in this GW
        for r in rows:
            err = r['xpts_blended_predicted'] - r['actual_pts']
            squared_errors.append(err * err)

        # Captain hit rate: did rank-1 player score the highest actual pts?
        if ranked:
            captain_id = ranked[0]['player_id']
            max_actual = max(r['actual_pts'] for r in rows)
            captain_actual = next(
                r['actual_pts'] for r in rows if r['player_id'] == captain_id
            )
            captain_hits += 1 if captain_actual >= max_actual else 0
            captain_gws += 1

    haul_hit_rate = total_flagged / total_haulters if total_haulters > 0 else 0.0
    rmse = _math.sqrt(sum(squared_errors) / len(squared_errors)) if squared_errors else 0.0
    captain_hit_rate = captain_hits / captain_gws if captain_gws > 0 else 0.0

    return {
        'haul_hit_rate': round(haul_hit_rate, 4),
        'rmse': round(rmse, 4),
        'captain_hit_rate': round(captain_hit_rate, 4),
    }


def build_per_gw_rows(
    summaries: dict,
    target_gws: list,
    bootstrap: dict,
    fixture_difficulty: dict,
    teams_by_id: dict,
    blend_alpha: float = BLEND_ALPHA,
    form_window_gws: int = FORM_WINDOW_GWS,
    cs_prob_base: float = CS_PROB_BASE,
    cs_prob_slope: float = CS_PROB_SLOPE,
) -> dict:
    """Build per-GW player rows with reconstructed xPts for the given target_gws.

    Extracted from compute_accuracy_backtest so tune.py can call it with
    different parameter values without running the full backtest pipeline.

    Args:
        summaries:         dict mapping player_id (int) -> element-summary dict.
        target_gws:        list of GW numbers to build rows for.
        bootstrap:         FPL bootstrap-static JSON (elements, teams).
        fixture_difficulty: dict from build_fixture_difficulty_lookup().
        teams_by_id:       dict mapping team_id (int) -> team dict.
        blend_alpha:       form signal blend weight (TUNE-01).
        form_window_gws:   recency window for form signal (TUNE-01).
        cs_prob_base:      base CS probability (TUNE-01).
        cs_prob_slope:     CS probability difficulty slope (TUNE-01).

    Returns:
        dict mapping gw -> list of player-row dicts (same shape as compute_accuracy_backtest
        internal per_gw_rows; each row has player_id, player_name, team_short, element_type,
        actual_pts, xpts_predicted, xpts_blended_predicted).
    """
    per_gw_rows: dict = {gw: [] for gw in target_gws}

    for element in bootstrap.get('elements', []):
        element_id = element['id']
        if element.get('starts', 0) == 0:
            continue
        summary = summaries.get(element_id)
        if summary is None:
            continue

        history = summary.get('history', []) or []
        grouped = _group_history_by_gw(history)
        element_type = element.get('element_type', 3)
        player_team_id = element['team']
        player_name = element.get('web_name', f'P{element_id}')
        team_short = teams_by_id.get(player_team_id, {}).get('short_name', '')

        for gw in target_gws:
            entry = grouped.get(gw)
            if entry is None:
                continue
            if entry['minutes'] < MIN_MINUTES:
                continue

            actual_pts = entry['total_points']
            difficulty_score = fixture_difficulty.get((gw, player_team_id), 0.5)

            xpts_predicted = _reconstruct_xpts(
                entry, element_type, difficulty_score,
                cs_prob_base=cs_prob_base, cs_prob_slope=cs_prob_slope,
            )
            form_per90_at_gw = _reconstruct_form_signal(grouped, gw, window_gws=form_window_gws)
            xpts_blended_predicted = _reconstruct_xpts_with_form(
                entry, element_type, difficulty_score, form_per90_at_gw,
                blend_alpha=blend_alpha,
                cs_prob_base=cs_prob_base,
                cs_prob_slope=cs_prob_slope,
            )

            per_gw_rows[gw].append({
                'player_id': element_id,
                'player_name': player_name,
                'team_short': team_short,
                'element_type': element_type,
                'actual_pts': actual_pts,
                'xpts_predicted': xpts_predicted,
                'xpts_blended_predicted': xpts_blended_predicted,
            })

    return per_gw_rows


def _read_existing_xmins_v2_flag(cache_dir: str) -> bool:
    """Phase 52 D-02: preserve xmins_v2_enabled across backtest runs.

    Until accuracy.py runs a parallel shadow path (deferred), the gate value is set
    once (manually flipped to True after a successful 5-GW shadow run) and preserved
    on subsequent backtests. Default False on cold start (file missing/malformed).
    """
    return bool(_read_existing_cache(cache_dir).get('summary', {}).get('xmins_v2_enabled', False))


def _read_existing_bonus_predictor_flag(cache_dir: str) -> bool:
    """Phase 53 BPS-01: preserve bonus_predictor_enabled across backtest runs.

    Until accuracy.py runs a parallel shadow path for the bonus model (deferred),
    the gate value is set once (manually flipped to True after a successful 5-GW
    shadow run) and preserved on subsequent backtests. Default False on cold start
    (file missing/malformed).
    """
    return bool(_read_existing_cache(cache_dir).get('summary', {}).get('bonus_predictor_enabled', False))


def _read_existing_save_predictor_flag(cache_dir: str) -> bool:
    """Phase 83 GK-03: preserve save_predictor_enabled across backtest runs.

    Until accuracy.py runs a parallel shadow path for the GK Poisson-floor model
    (deferred), the gate value is set once (manually flipped to True after a
    successful >=5-GW shadow run) and preserved on subsequent backtests. Default
    False on cold start (file missing/malformed). Mirrors
    _read_existing_bonus_predictor_flag exactly.
    """
    return bool(_read_existing_cache(cache_dir).get('summary', {}).get('save_predictor_enabled', False))


def _read_existing_mc_enabled_flag(cache_dir: str) -> bool:
    """Phase 90 MC-01 / D-01: preserve mc_enabled across backtest runs.

    Until accuracy.py runs a parallel shadow path for the 5-GW MC simulation
    (deferred), the gate value is set once (manually flipped to True after a
    successful end-to-end pipeline non-regression run) and preserved on subsequent
    backtests. Default False on cold start (file missing/malformed). Mirrors
    _read_existing_save_predictor_flag exactly.
    """
    return bool(_read_existing_cache(cache_dir).get('summary', {}).get('mc_enabled', False))


def _read_existing_versions(cache_dir: str) -> list:
    """Phase 63 VER-01 / D-02 / D-03: preserve version history across backtest runs.

    Returns the existing top-level versions array from the cache, or [] on cold start
    (file missing or malformed). Matches the guard pattern of _read_existing_xmins_v2_flag.
    The 'versions' key is at the TOP LEVEL of the JSON, not nested under 'summary'.
    """
    try:
        path = os.path.join(cache_dir, 'accuracy_backtest.json')
        with open(path, 'r', encoding='utf-8') as f:
            prev = json.load(f)
        existing = prev.get('versions', [])
        return existing if isinstance(existing, list) else []
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return []


def _read_existing_cache(cache_dir: str) -> dict:
    """WR-02: read and parse accuracy_backtest.json exactly once, returning the full dict.

    Callers derive all gate flags and version history from the returned dict to avoid
    repeated file opens for the same data within one pipeline run.
    Returns {} on cold start (file missing or malformed).
    """
    try:
        path = os.path.join(cache_dir, 'accuracy_backtest.json')
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}


# ============================================================================
# Public API
# ============================================================================

def compute_accuracy_backtest(
    summaries: dict,
    finished_gws: int,
    bootstrap: dict,
    fixtures: list,
    cache_dir: str = '',
    merged_haul_lookup: Optional[dict] = None,
    blend_alpha: float = BLEND_ALPHA,
    form_window_gws: int = FORM_WINDOW_GWS,
    cs_prob_base: float = CS_PROB_BASE,
    cs_prob_slope: float = CS_PROB_SLOPE,
) -> dict:
    """Compute pre-aggregated accuracy backtest for the last 5 finished GWs.

    Phase 109 MC-CAL-01: accepts merged_haul_lookup (player_id -> haul_prob dict built by
    run.py from the current merged list). When mc_enabled and coverage >= 80%, sets
    use_mc=True and writes calibration_mode='mc' to summary. Otherwise analytical.

    Args:
        summaries: dict mapping player_id (int) -> element-summary dict.
                   Pre-fetched by run.py — ZERO HTTP calls made here.
        finished_gws: count of completed gameweeks (from bootstrap events).
        bootstrap: Full FPL bootstrap-static JSON (elements, teams, events).
        fixtures: list of all fixture dicts from fpl_fixtures.json.
        merged_haul_lookup: optional dict mapping player_id (int) -> haul_prob (float).
                            Built by run.py from the current merged list after MC simulation.
                            None (default) produces the analytical calibration path.
        blend_alpha: Form signal blend coefficient (default BLEND_ALPHA). Passed
                     to build_per_gw_rows and used by TUNE-01 sweep.
        form_window_gws: Recency window for form signal in GWs (default FORM_WINDOW_GWS).
                         Passed to build_per_gw_rows. Tunable via TUNE-01.
        cs_prob_base: Base CS probability vs average opposition (default 0.40).
                      Passed to build_per_gw_rows. Tunable via TUNE-01.
        cs_prob_slope: Sensitivity of CS prob to opponent attacking strength (default 0.30).
                       Passed to build_per_gw_rows. Tunable via TUNE-01.

    Returns:
        Dict matching accuracy_backtest.json structure (D-08).
    """
    if merged_haul_lookup is None:
        merged_haul_lookup = {}
    # D-01: identify last 5 finished GWs
    if finished_gws < 1:
        return _empty_backtest(cache_dir)
    target_gws = list(range(max(1, finished_gws - BACKTEST_GWS + 1), finished_gws + 1))
    target_gws_desc = sorted(target_gws, reverse=True)

    # Build lookup dicts and per-GW rows (extracted to build_per_gw_rows for tune.py reuse)
    fixture_difficulty = build_fixture_difficulty_lookup(fixtures)
    teams_by_id = {t['id']: t for t in bootstrap.get('teams', [])}

    per_gw_rows = build_per_gw_rows(
        summaries=summaries,
        target_gws=target_gws,
        bootstrap=bootstrap,
        fixture_difficulty=fixture_difficulty,
        teams_by_id=teams_by_id,
        blend_alpha=blend_alpha,
        form_window_gws=form_window_gws,
        cs_prob_base=cs_prob_base,
        cs_prob_slope=cs_prob_slope,
    )

    # Second pass: per-GW ranking and haulter flagging
    haulters: list = []
    gw_summaries: list = []
    total_haulters = 0
    total_xpts_flagged = 0
    # Phase 76 ACC2-01: per-player xpts_flagged lookup keyed by (gw, player_id)
    # Used to populate xpts_flagged on per_player[pid]['gws'] entries below.
    xpts_flagged_by_gw_pid: dict = {}
    total_xpts_blended_flagged = 0   # Phase 42 ACC-02
    # Phase 42 ACC-04 mid-tier
    total_mid_tier = 0
    total_xpts_mid_flagged = 0
    total_xpts_blended_mid_flagged = 0

    for gw in target_gws_desc:
        rows = per_gw_rows.get(gw, [])
        if not rows:
            gw_summaries.append({
                'gw': gw,
                'haulter_count': 0,
                'xpts_flagged': 0,
                'xpts_blended_flagged': 0,                # Phase 42
                'xpts_hit_rate': 0.0,
                'xpts_blended_hit_rate': 0.0,             # Phase 42
                'mid_tier_count': 0,                      # Phase 42 ACC-04
                'xpts_mid_flagged': 0,                    # Phase 42 ACC-04
                'xpts_blended_mid_flagged': 0,            # Phase 42 ACC-04
                'mid_tier_hit_rate': 0.0,                 # Phase 42 ACC-04
                'mid_tier_blended_hit_rate': 0.0,         # Phase 42 ACC-04
            })
            continue

        # Pitfall 4: rank ALL players, not just haulters
        xpts_ranked = sorted(rows, key=lambda r: r['xpts_predicted'], reverse=True)
        xpts_rank_by_id = {r['player_id']: i + 1 for i, r in enumerate(xpts_ranked)}

        # Phase 76 ACC2-01: record xpts_flagged for every player in this GW (not just haulters)
        # so per_player[pid]['gws'] entries can carry xpts_flagged for the Flagged Misses filter.
        for r in rows:
            xpts_flagged_by_gw_pid[(gw, r['player_id'])] = xpts_rank_by_id.get(r['player_id'], 9999) <= TOP_N_PREDICTED

        # Phase 42 ACC-02: blended ranking
        xpts_blended_ranked = sorted(rows, key=lambda r: r['xpts_blended_predicted'], reverse=True)
        xpts_blended_rank_by_id = {r['player_id']: i + 1 for i, r in enumerate(xpts_blended_ranked)}

        gw_haulters = [r for r in rows if r['actual_pts'] >= HAULTER_THRESHOLD]
        haulter_count = len(gw_haulters)

        # Phase 42 ACC-04: mid-tier subset (6 <= actual_pts < 10)
        gw_mid_tier = [r for r in rows if MID_TIER_THRESHOLD <= r['actual_pts'] < HAULTER_THRESHOLD]
        mid_tier_count = len(gw_mid_tier)
        xpts_mid_flagged_count = 0
        xpts_blended_mid_flagged_count = 0

        xpts_flagged_count = 0
        xpts_blended_flagged_count = 0    # Phase 42 ACC-02

        for r in gw_haulters:
            pid = r['player_id']
            xrank = xpts_rank_by_id.get(pid, 9999)
            xbrank = xpts_blended_rank_by_id.get(pid, 9999)   # Phase 42
            xflagged = xrank <= TOP_N_PREDICTED
            xbflagged = xbrank <= TOP_N_PREDICTED              # Phase 42
            if xflagged:
                xpts_flagged_count += 1
            if xbflagged:
                xpts_blended_flagged_count += 1                 # Phase 42
            haulters.append({
                'gw': gw,
                'player_id': pid,
                'player_name': r['player_name'],
                'actual_pts': r['actual_pts'],
                'xpts_predicted': r['xpts_predicted'],
                'xpts_rank': xrank,
                'xpts_flagged': xflagged,
                'xpts_blended_predicted': r['xpts_blended_predicted'],    # Phase 42
                'xpts_blended_rank': xbrank,                              # Phase 42
                'xpts_blended_flagged': xbflagged,                        # Phase 42
            })

        # Phase 42 ACC-04: flag mid-tier scorers using TOP_N_PREDICTED_MID = 30
        for r in gw_mid_tier:
            pid = r['player_id']
            if xpts_rank_by_id.get(pid, 9999) <= TOP_N_PREDICTED_MID:
                xpts_mid_flagged_count += 1
            if xpts_blended_rank_by_id.get(pid, 9999) <= TOP_N_PREDICTED_MID:
                xpts_blended_mid_flagged_count += 1

        xpts_hit = xpts_flagged_count / haulter_count if haulter_count > 0 else 0.0
        xpts_blended_hit = xpts_blended_flagged_count / haulter_count if haulter_count > 0 else 0.0
        mid_tier_hit = xpts_mid_flagged_count / mid_tier_count if mid_tier_count > 0 else 0.0
        mid_tier_blended_hit = xpts_blended_mid_flagged_count / mid_tier_count if mid_tier_count > 0 else 0.0

        gw_summaries.append({
            'gw': gw,
            'haulter_count': haulter_count,
            'xpts_flagged': xpts_flagged_count,
            'xpts_blended_flagged': xpts_blended_flagged_count,            # Phase 42
            'xpts_hit_rate': round(xpts_hit, 4),
            'xpts_blended_hit_rate': round(xpts_blended_hit, 4),           # Phase 42
            'mid_tier_count': mid_tier_count,                              # Phase 42 ACC-04
            'xpts_mid_flagged': xpts_mid_flagged_count,                    # Phase 42 ACC-04
            'xpts_blended_mid_flagged': xpts_blended_mid_flagged_count,    # Phase 42 ACC-04
            'mid_tier_hit_rate': round(mid_tier_hit, 4),                   # Phase 42 ACC-04
            'mid_tier_blended_hit_rate': round(mid_tier_blended_hit, 4),   # Phase 42 ACC-04
        })

        total_haulters += haulter_count
        total_xpts_flagged += xpts_flagged_count
        total_xpts_blended_flagged += xpts_blended_flagged_count   # Phase 42
        total_mid_tier += mid_tier_count                           # Phase 42 ACC-04
        total_xpts_mid_flagged += xpts_mid_flagged_count           # Phase 42 ACC-04
        total_xpts_blended_mid_flagged += xpts_blended_mid_flagged_count   # Phase 42 ACC-04

    # Per-player history (Claude's Discretion: positive delta = surprise haul -> actual - predicted)
    per_player: dict = {}
    for gw in target_gws_desc:
        for r in per_gw_rows.get(gw, []):
            pid = r['player_id']
            if pid not in per_player:
                per_player[pid] = {
                    'player_id': pid,
                    'player_name': r['player_name'],
                    'team': r['team_short'],
                    'gws': [],
                }
            per_player[pid]['gws'].append({
                'gw': gw,
                'actual_pts': r['actual_pts'],
                'xpts_predicted': r['xpts_predicted'],
                'xpts_delta': round(r['actual_pts'] - r['xpts_predicted'], 2),
                'xpts_blended_predicted': r['xpts_blended_predicted'],                          # Phase 42
                'xpts_blended_delta': round(r['actual_pts'] - r['xpts_blended_predicted'], 2),  # Phase 42
                'xpts_flagged': xpts_flagged_by_gw_pid.get((gw, pid), False),                  # Phase 76 ACC2-01
            })

    overall_xpts_hit = total_xpts_flagged / total_haulters if total_haulters > 0 else 0.0
    overall_xpts_blended_hit = total_xpts_blended_flagged / total_haulters if total_haulters > 0 else 0.0
    overall_mid_tier_hit = total_xpts_mid_flagged / total_mid_tier if total_mid_tier > 0 else 0.0
    overall_mid_tier_blended_hit = total_xpts_blended_mid_flagged / total_mid_tier if total_mid_tier > 0 else 0.0

    # Phase 42 ACC-03: gate flag — blended must beat baseline by STRICTLY MORE THAN GATE_MARGIN_PP (2pp). Strict `>` per PATTERNS.md and RESEARCH.md Pitfall 3 (anti-flap).
    form_signal_enabled = (overall_xpts_blended_hit - overall_xpts_hit) > GATE_MARGIN_PP

    # Phase 52 D-02: xmins_v2_enabled gate — flip condition is non-regression on xPts hit-rate.
    # Until a parallel shadow-run path is added to accuracy.py (deferred), preserve the existing
    # flag value if present (so a manually-flipped True survives subsequent backtests). Default False.
    # This matches the bootstrap/cold-start behavior of form_signal_enabled.
    # WR-02: parse accuracy_backtest.json once and derive all three values from the same dict.
    prior_cache = _read_existing_cache(cache_dir)
    xmins_v2_enabled = bool(prior_cache.get('summary', {}).get('xmins_v2_enabled', False))
    bonus_predictor_enabled = bool(prior_cache.get('summary', {}).get('bonus_predictor_enabled', False))  # Phase 53 BPS-01
    save_predictor_enabled = bool(prior_cache.get('summary', {}).get('save_predictor_enabled', False))  # Phase 83 GK-03
    mc_enabled = bool(prior_cache.get('summary', {}).get('mc_enabled', False))  # Phase 90 MC-01

    # Phase 109 MC-CAL-01 / D-03: derive use_mc from mc_enabled + coverage check.
    # When >= 80% of bootstrap elements have haul_prob in merged_haul_lookup, use MC path.
    total_elements = len([e for e in bootstrap.get('elements', []) if e.get('starts', 0) > 0])
    coverage_pct = len(merged_haul_lookup) / total_elements if total_elements > 0 else 0.0
    use_mc = mc_enabled and coverage_pct >= 0.80
    calibration_mode = 'mc' if use_mc else 'analytical'

    # Phase 63 CAL-01 / CAL-02: precompute calibration data over per_gw_rows.
    # Phase 109 MC-CAL-01: pass use_mc and merged_haul_lookup to enable MC bucketing.
    calibration = _compute_calibration_data(
        per_gw_rows,
        use_mc=use_mc,
        merged_haul_lookup=merged_haul_lookup,
    )

    # Phase 63 VER-01 / D-02 / D-03 / D-04: read prior versions, dedup-append new record.
    _existing = prior_cache.get('versions', [])
    versions = _existing if isinstance(_existing, list) else []
    new_version_record = {
        'formula_version': FORMULA_VERSION,
        'recorded_at': datetime.now(timezone.utc).isoformat(),
        'hit_rate': round(overall_xpts_blended_hit, 4),  # D-04: use blended (Pitfall 1)
        'gate_flags': {
            'form_signal_enabled': form_signal_enabled,
            'xmins_v2_enabled': xmins_v2_enabled,
            'bonus_predictor_enabled': bonus_predictor_enabled,
            'save_predictor_enabled': save_predictor_enabled,   # Phase 83 GK-03
            'mc_enabled': mc_enabled,                            # Phase 90 MC-01
        },
        'sample_gws': len(target_gws_desc),  # Phase 116 VER-01 / D-09: finished GWs contributing to hit_rate
    }
    # D-03 dedup: use set membership to catch interior matches, not just tail (CR-01).
    existing_versions_set = {v.get('formula_version') for v in versions}
    if FORMULA_VERSION not in existing_versions_set:
        versions = versions + [new_version_record]

    return {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'gws_covered': target_gws_desc,
        'summary': {
            'xpts_hit_rate': round(overall_xpts_hit, 4),
            'xpts_blended_hit_rate': round(overall_xpts_blended_hit, 4),         # Phase 42 ACC-02
            'form_signal_enabled': form_signal_enabled,                          # Phase 42 ACC-03
            'xmins_v2_enabled': xmins_v2_enabled,                               # Phase 52 D-02: gate for _cs_prob mins_60_prob swap; preserved across runs once flipped
            'bonus_predictor_enabled': bonus_predictor_enabled,                  # Phase 53 BPS-01: gate for per-player bonus EV; preserved across runs once flipped
            'save_predictor_enabled': save_predictor_enabled,                    # Phase 83 GK-03: gate for GK Poisson-floor save_pts; preserved across runs once flipped
            'mc_enabled': mc_enabled,                                            # Phase 90 MC-01 / D-01: gate for 5-GW MC simulation; preserved across runs once flipped
            'calibration_mode': calibration_mode,                                # Phase 109 MC-CAL-01: 'mc' when MC coverage >= 80%; 'analytical' otherwise
            'news_flag_enabled': True,                                           # Phase 88 SCRAPER-01: always on; kill switch in UI gate
            'blend_alpha_used': BLEND_ALPHA,                                     # Phase 42 ACC-03
            'mid_tier_hit_rate': round(overall_mid_tier_hit, 4),                 # Phase 42 ACC-04
            'mid_tier_blended_hit_rate': round(overall_mid_tier_blended_hit, 4), # Phase 42 ACC-04
            'gws': gw_summaries,
        },
        'haulters': haulters,
        'players': list(per_player.values()),
        'versions': versions,                    # Phase 63 VER-01 / D-02
        'calibration': calibration,             # Phase 63 CAL-01 / CAL-02 (Task 2)
    }


def build_predictions_snapshot(merged: list, current_gw: int) -> dict:
    """Build predictions_snapshot.json for the current pipeline run (D-11, D-12).

    Args:
        merged: list of merged player dicts. Each must have id, xPts_1gw.
        current_gw: current gameweek number (typically `finished_gws + 1` or the active GW).

    Returns:
        Dict matching D-12 snapshot format: {gw, run_at, players: [{id, xPts_1gw}]}.
    """
    return {
        'gw': current_gw,
        'run_at': datetime.now(timezone.utc).isoformat(),
        'players': [
            {
                'id': p['id'],
                'xPts_1gw': p.get('xPts_1gw', 0.0),
            }
            for p in merged
        ],
    }


# ============================================================================
# Private helpers
# ============================================================================

def _empty_backtest(cache_dir: str = '') -> dict:
    """Return an empty but well-shaped backtest (used when no GWs are finished).

    Reads existing flag values from cache_dir so manually-flipped True values
    are not silently overwritten when finished_gws < 1. Also dedup-appends a
    FORMULA_VERSION record with hit_rate=0.0 so the first pre-season pipeline run
    is captured in version history (WR-03 fix).
    """
    prior_cache = _read_existing_cache(cache_dir)
    xmins_v2_enabled = bool(prior_cache.get('summary', {}).get('xmins_v2_enabled', False))
    bonus_predictor_enabled = bool(prior_cache.get('summary', {}).get('bonus_predictor_enabled', False))
    save_predictor_enabled = bool(prior_cache.get('summary', {}).get('save_predictor_enabled', False))  # Phase 83 GK-03
    mc_enabled = bool(prior_cache.get('summary', {}).get('mc_enabled', False))  # Phase 90 MC-01

    _existing = prior_cache.get('versions', [])
    existing_versions = _existing if isinstance(_existing, list) else []
    existing_set = {v.get('formula_version') for v in existing_versions}
    if FORMULA_VERSION not in existing_set:
        existing_versions = existing_versions + [{
            'formula_version': FORMULA_VERSION,
            'recorded_at': datetime.now(timezone.utc).isoformat(),
            'hit_rate': 0.0,
            'gate_flags': {
                'form_signal_enabled': False,
                'xmins_v2_enabled': xmins_v2_enabled,
                'bonus_predictor_enabled': bonus_predictor_enabled,
                'save_predictor_enabled': save_predictor_enabled,   # Phase 83 GK-03
                'mc_enabled': mc_enabled,                            # Phase 90 MC-01
            },
            'sample_gws': 0,  # Phase 116 VER-01 / D-10: cold start — no finished GWs
        }]

    return {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'gws_covered': [],
        'summary': {
            'xpts_hit_rate': 0.0,
            'xpts_blended_hit_rate': 0.0,            # Phase 42
            'form_signal_enabled': False,             # Phase 42
            'xmins_v2_enabled': xmins_v2_enabled,    # Phase 52
            'bonus_predictor_enabled': bonus_predictor_enabled,  # Phase 53
            'save_predictor_enabled': save_predictor_enabled,    # Phase 83 GK-03
            'mc_enabled': mc_enabled,                            # Phase 90 MC-01
            'calibration_mode': 'analytical',                    # Phase 109 MC-CAL-01: no merged data in empty path, default analytical
            'news_flag_enabled': True,                            # Phase 88 SCRAPER-01: always on; kill switch in UI gate
            'blend_alpha_used': BLEND_ALPHA,          # Phase 42
            'mid_tier_hit_rate': 0.0,                 # Phase 42
            'mid_tier_blended_hit_rate': 0.0,         # Phase 42
            'gws': [],
        },
        'haulters': [],
        'players': [],
        'versions': existing_versions,                                                               # Phase 63 VER-01
        'calibration': {'by_position': {'all': [], '1': [], '2': [], '3': [], '4': []}},   # Phase 63 CAL-01: full shape with empty arrays
    }


def _compute_calibration_data(
    per_gw_rows: dict,
    use_mc: bool = False,
    merged_haul_lookup: Optional[dict] = None,
) -> dict:
    """Phase 63 CAL-01 / CAL-02 / D-05 / D-06 / D-07: decile calibration by position.

    Phase 109 MC-CAL-01 extension: when use_mc=True and merged_haul_lookup is provided,
    sorts players by effective_haul_prob (from merged_haul_lookup) descending instead of
    by xpts_predicted, and sets predicted_rate = mean(haul_prob) per bucket.

    Analytical path (use_mc=False): unchanged — sorts by xpts_predicted, predicted_rate = bucket_mid.

    D-07: filter buckets with sample_n < 5 (they appear as gaps in the chart, not zeros).
    Phase 103 D-01/D-03 tightens per-position thresholds (15 for GK/DEF, 8 for MID/FWD) and adds a < 50 position-pool guard.

    Args:
        per_gw_rows: dict mapping gw -> list of player-row dicts with xpts_predicted, actual_pts, element_type.
        use_mc: when True, use haul_prob for sorting and predicted_rate computation (MC path).
        merged_haul_lookup: dict mapping player_id (int) -> haul_prob (float). Required when use_mc=True.
            Players absent from the lookup receive effective_haul_prob=0.0 (D-06).

    Returns:
        { 'by_position': { 'all': [bucket, ...], '1': [...], '2': [...], '3': [...], '4': [...] } }
        Each bucket: { 'bucket_mid': float, 'predicted_rate': float, 'actual_rate': float, 'sample_n': int }
    """
    if merged_haul_lookup is None:
        merged_haul_lookup = {}

    # bucket_haul[pos_key][decile_idx] = haul count; bucket_total[pos_key][decile_idx] = total count
    bucket_haul: dict = defaultdict(lambda: defaultdict(int))
    bucket_total: dict = defaultdict(lambda: defaultdict(int))
    # Phase 91 CAL-01 (D-07): xPts-mean accumulators — float sums for predicted_mean / actual_mean
    bucket_sum_predicted: dict = defaultdict(lambda: defaultdict(float))
    bucket_sum_actual: dict = defaultdict(lambda: defaultdict(float))
    # Phase 109 MC-CAL-01: haul_prob accumulator for predicted_rate in MC mode
    bucket_sum_haul_prob: dict = defaultdict(lambda: defaultdict(float))

    for gw, rows in per_gw_rows.items():
        if not rows:
            continue
        n = len(rows)
        if use_mc and merged_haul_lookup:
            # MC path: sort by effective_haul_prob descending; missing players get 0.0 (D-06)
            ranked = sorted(
                rows,
                key=lambda r: merged_haul_lookup.get(r['player_id'], 0.0),
                reverse=True,
            )
        else:
            # Analytical path: rank by xpts_predicted descending (unchanged)
            ranked = sorted(rows, key=lambda r: r['xpts_predicted'], reverse=True)
        for rank_idx, row in enumerate(ranked):
            decile = min(int(rank_idx * 10 / n), 9)
            is_haul = 1 if row['actual_pts'] >= HAULTER_THRESHOLD else 0
            pos_key = str(row['element_type'])  # Pitfall 3: element_type is int 1-4
            effective_haul_prob = merged_haul_lookup.get(row['player_id'], 0.0) if use_mc else 0.0
            for pk in ('all', pos_key):
                bucket_haul[pk][decile] += is_haul
                bucket_total[pk][decile] += 1
                # Phase 91 CAL-01: accumulate xPts sums for mean computation
                bucket_sum_predicted[pk][decile] += row['xpts_predicted']
                bucket_sum_actual[pk][decile]    += row['actual_pts']
                # Phase 109 MC-CAL-01: accumulate haul_prob for MC predicted_rate
                bucket_sum_haul_prob[pk][decile] += effective_haul_prob

    # D-06: bucket midpoints for 10 deciles -> 0.05, 0.15, ..., 0.95
    bucket_mids = [round(d * 0.1 + 0.05, 2) for d in range(10)]

    by_position: dict = {}
    for pos_key in ('all', '1', '2', '3', '4'):
        # Phase 103 CAL-01 / D-03: position-pool guard. Hide the chart entirely (empty
        # array) when an individual position has < 50 total observations. 'all' aggregate
        # (~200 obs/decile) is exempt; only per-position tabs need this gate.
        if pos_key != 'all' and sum(bucket_total[pos_key].values()) < 50:
            by_position[pos_key] = []
            continue
        buckets: list = []
        for d in range(10):
            total = bucket_total[pos_key][d]
            # Phase 103 CAL-01 / D-01: position-aware sparse-bucket filter.
            # PMC 7923594: a single haulting GK shifts actual_rate by 12pp at sample_n~8.
            # GK/DEF need >=15 obs; MID/FWD need >=8; 'all' aggregate keeps the old >=5 gate.
            if pos_key in ('1', '2') and total < 15:
                continue
            if pos_key in ('3', '4') and total < 8:
                continue
            if pos_key == 'all' and total < 5:
                continue
            haul = bucket_haul[pos_key][d]
            # Phase 109 MC-CAL-01: in MC mode, predicted_rate = mean(haul_prob) per bucket.
            # In analytical mode, predicted_rate = bucket_mid (backward compat).
            if use_mc and merged_haul_lookup:
                predicted_rate = round(bucket_sum_haul_prob[pos_key][d] / total, 4)
            else:
                predicted_rate = bucket_mids[d]
            buckets.append({
                'bucket_mid': bucket_mids[d],
                'predicted_rate': predicted_rate,
                'actual_rate': round(haul / total, 4),
                'sample_n': total,
                # Phase 91 CAL-01 (D-07): xPts means; round to 2dp matches UI toFixed(2)
                # and avoids IEEE-754 drift in test fixtures (Pitfall 7).
                'predicted_mean': round(bucket_sum_predicted[pos_key][d] / total, 2),
                'actual_mean':    round(bucket_sum_actual[pos_key][d]    / total, 2),
            })
        by_position[pos_key] = buckets

    return {'by_position': by_position}


def _group_history_by_gw(history: list) -> dict:
    """Aggregate DGW entries (same `round`) into one entry per GW (Pattern 4).

    Sums minutes, total_points, expected_goals, expected_assists.
    Captures the player's own team_id from the first entry encountered for that round.
    """
    by_round: dict = defaultdict(lambda: {
        'round': 0, 'minutes': 0, 'total_points': 0,
        'expected_goals': 0.0, 'expected_assists': 0.0,
    })
    for entry in history:
        r = entry.get('round')
        if r is None:
            continue
        agg = by_round[r]
        agg['round'] = r
        agg['minutes'] += entry.get('minutes', 0) or 0
        agg['total_points'] += int(entry.get('total_points', 0) or 0)
        agg['expected_goals'] += float(entry.get('expected_goals', 0) or 0)
        agg['expected_assists'] += float(entry.get('expected_assists', 0) or 0)
    return dict(by_round)


def _reconstruct_xpts(entry: dict, element_type: int, difficulty_score: float,
                       cs_prob_base: float = CS_PROB_BASE, cs_prob_slope: float = CS_PROB_SLOPE) -> float:
    """Reconstruct xPts for a single GW history entry (D-02, D-03, D-04).

    Calls merge._compute_xpts_fixture with reconstructed historical inputs.
    Returns 0.0 if minutes < 45 (binary start_prob proxy says "didn't start").
    """
    from merge import _compute_xpts_fixture  # deferred — matches run.py style; avoids ModuleNotFoundError at import time
    minutes = entry.get('minutes', 0) or 0
    if minutes <= 0:
        return 0.0

    # D-04: binary start_prob proxy
    start_prob = 1.0 if minutes >= 45 else 0.0
    if start_prob == 0.0:
        return 0.0

    # D-02: per-90 rates from history's expected_goals / expected_assists
    xg = float(entry.get('expected_goals', 0) or 0)
    xa = float(entry.get('expected_assists', 0) or 0)
    xg_per90 = (xg / minutes) * 90 if minutes > 0 else 0.0
    xa_per90 = (xa / minutes) * 90 if minutes > 0 else 0.0

    # xmins = start_prob × minutes: _compute_xpts_fixture treats xmins as
    # unconditional expected minutes; for binary start_prob=1.0 this equals minutes.
    xmins = start_prob * float(minutes)

    result = _compute_xpts_fixture(
        xg_per90=xg_per90,
        xa_per90=xa_per90,
        start_prob=start_prob,
        xmins=xmins,
        element_type=element_type,
        defensive_difficulty=difficulty_score,
        cs_prob_base=cs_prob_base,
        cs_prob_slope=cs_prob_slope,
    )
    return round(result['total'], 2)


def _reconstruct_form_signal(
    grouped: dict,
    current_gw: int,
    window_gws: int = FORM_WINDOW_GWS,
    min_minutes: int = FORM_MIN_MINUTES,
) -> 'float | None':
    """Reconstruct the form signal at GW `current_gw` from STRICTLY PRIOR rounds (Phase 42 ACC-02).

    `grouped` is the output of _group_history_by_gw — DGW already aggregated.
    We must NOT include `current_gw` itself: the player's GW-N actuals are the
    thing we are predicting; including them is a leak (Pitfall 6).

    Returns None when fewer than 3 prior played GWs exist in the window or
    total minutes < min_minutes. Otherwise returns recency-weighted xG+xA
    per-90 (linear weights 0.5..1.0, oldest..most recent).

    Mirrors merge._compute_form_signal but operates on grouped dict + GW filter.
    """
    prior_gws = [g for g in sorted(grouped.keys()) if g < current_gw]
    if not prior_gws:
        return None
    last_gws = prior_gws[-window_gws:]
    played = [grouped[g] for g in last_gws if grouped[g]['minutes'] > 0]
    total_mins = sum(p['minutes'] for p in played)
    if len(played) < 3 or total_mins < min_minutes:
        return None

    n = len(played)
    weights = [0.5 + 0.5 * (i / max(n - 1, 1)) for i in range(n)]
    weighted_xgxa = sum(
        (p['expected_goals'] + p['expected_assists']) * w
        for p, w in zip(played, weights)
    )
    weighted_mins = sum(p['minutes'] * w for p, w in zip(played, weights))
    if weighted_mins <= 0:
        return None
    return round((weighted_xgxa / weighted_mins) * 90, 4)


def _reconstruct_xpts_with_form(
    entry: dict,
    element_type: int,
    difficulty_score: float,
    form_per90: 'float | None',
    blend_alpha: float = BLEND_ALPHA,
    cs_prob_base: float = CS_PROB_BASE,
    cs_prob_slope: float = CS_PROB_SLOPE,
) -> float:
    """Reconstruct xPts with optional form blend (Phase 42 ACC-02).

    When form_per90 is None, identical to _reconstruct_xpts (graceful fallback).
    When form_per90 is provided, blends season per-90 (derived from this
    entry's xG/xA/minutes) with form per-90 using:
        blended_xgxa = (1-alpha)*season + alpha*form
    Then re-splits proportionally to the season xG/xA ratio (50/50 fallback
    for zero-season players) so goal-heavy strikers do not gain assists
    and vice versa (Pitfall 2).
    """
    if form_per90 is None:
        return _reconstruct_xpts(entry, element_type, difficulty_score,
                                  cs_prob_base=cs_prob_base, cs_prob_slope=cs_prob_slope)

    from merge import _compute_xpts_fixture

    minutes = entry.get('minutes', 0) or 0
    if minutes <= 0:
        return 0.0
    start_prob = 1.0 if minutes >= 45 else 0.0
    if start_prob == 0.0:
        return 0.0

    xg = float(entry.get('expected_goals', 0) or 0)
    xa = float(entry.get('expected_assists', 0) or 0)
    xg_per90 = (xg / minutes) * 90 if minutes > 0 else 0.0
    xa_per90 = (xa / minutes) * 90 if minutes > 0 else 0.0
    season_xgxa_per90 = xg_per90 + xa_per90

    blended_xgxa_per90 = (1.0 - blend_alpha) * season_xgxa_per90 + blend_alpha * form_per90
    if season_xgxa_per90 > 0:
        xg_share = xg_per90 / season_xgxa_per90
        blended_xg_per90 = blended_xgxa_per90 * xg_share
        blended_xa_per90 = blended_xgxa_per90 * (1.0 - xg_share)
    else:
        blended_xg_per90 = blended_xgxa_per90 * 0.5
        blended_xa_per90 = blended_xgxa_per90 * 0.5

    xmins = start_prob * float(minutes)
    result = _compute_xpts_fixture(
        xg_per90=blended_xg_per90,
        xa_per90=blended_xa_per90,
        start_prob=start_prob,
        xmins=xmins,
        element_type=element_type,
        defensive_difficulty=difficulty_score,
        cs_prob_base=cs_prob_base,
        cs_prob_slope=cs_prob_slope,
    )
    return round(result['total'], 2)
