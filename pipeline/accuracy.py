"""Compute prediction accuracy backtest and prediction snapshots for the pipeline.

Phase 40 / ACC-01: writes accuracy_backtest.json (pre-aggregated per-GW summary
+ haulters list + per-player history over the last 5 finished GWs) and
predictions_snapshot.json (current GW projections for future backtest replay).

Locked decisions honoured (per .planning/phases/40-accuracy-pipeline/40-CONTEXT.md):
  D-01 last 5 finished GWs, D-02 history-based xG/xA, D-03 FPL 1-5 -> 0-1 difficulty,
  D-04 binary start_prob (>=45 min), D-05/D-06 rolling-PPG proj_pts reconstruction,
  D-07/D-08 output shape, D-09 haulter threshold = 10, D-10 top-10 = "flagged",
  D-11/D-12 snapshot file shape.

Claude's Discretion: MIN_MINUTES = 10 — players who played fewer than 10 minutes
in a GW are excluded from that GW's backtest entry. This filters genuine DNP entries
and cameos that add noise without meaningful prediction signal.

Module follows the defcon.py pattern: top-level docstring, constants, public
functions, private helpers prefixed with _. No HTTP calls, no file I/O — pure
transform over the inputs handed in by run.py.
"""

from collections import defaultdict
from datetime import datetime, timezone

HAULTER_THRESHOLD = 10       # D-09: actual_pts >= 10 -> haulter
TOP_N_PREDICTED = 10         # D-10: rank within top 10 -> "flagged"
BACKTEST_GWS = 5             # D-01: last 5 finished GWs
MIN_MINUTES = 10             # Claude's Discretion: skip <10-min entries (filters DNPs and noise from late subs)


# ============================================================================
# Public API
# ============================================================================

def compute_accuracy_backtest(
    summaries: dict,
    finished_gws: int,
    bootstrap: dict,
    fixtures: list,
) -> dict:
    """Compute pre-aggregated accuracy backtest for the last 5 finished GWs.

    Args:
        summaries: dict mapping player_id (int) -> element-summary dict.
                   Pre-fetched by run.py — ZERO HTTP calls made here.
        finished_gws: count of completed gameweeks (from bootstrap events).
        bootstrap: Full FPL bootstrap-static JSON (elements, teams, events).
        fixtures: list of all fixture dicts from fpl_fixtures.json.

    Returns:
        Dict matching accuracy_backtest.json structure (D-08).
    """
    # D-01: identify last 5 finished GWs
    if finished_gws < 1:
        return _empty_backtest()
    target_gws = list(range(max(1, finished_gws - BACKTEST_GWS + 1), finished_gws + 1))
    target_gws_desc = sorted(target_gws, reverse=True)

    # Pitfall 1: build fixture_difficulty lookup keyed by (gw, OWN team_id)
    # team_h_difficulty IS the difficulty rating shown for the home team — i.e. the away team's strength
    # team_a_difficulty IS the difficulty rating shown for the away team — i.e. the home team's strength
    fixture_difficulty: dict = {}
    for fix in fixtures:
        gw = fix.get('event')
        if gw is None:
            continue
        # Linear (d-1)/4.0 map: 1->0.0 (easiest), 5->1.0 (hardest)
        fixture_difficulty[(gw, fix['team_h'])] = (fix.get('team_h_difficulty', 3) - 1) / 4.0
        fixture_difficulty[(gw, fix['team_a'])] = (fix.get('team_a_difficulty', 3) - 1) / 4.0

    teams_by_id = {t['id']: t for t in bootstrap.get('teams', [])}

    # First pass: build per-player, per-GW reconstructed predictions.
    # We need this BEFORE ranking because ranking happens per-GW across all players.
    # Structure: per_gw_rows[gw] -> list of dicts { player_id, name, team_short,
    #     element_type, actual_pts, minutes, xpts_predicted, proj_pts_predicted }
    per_gw_rows: dict = {gw: [] for gw in target_gws}

    for element in bootstrap.get('elements', []):
        element_id = element['id']
        if element.get('starts', 0) == 0:
            continue  # Pitfall 2: zero-start players have no summary entry
        summary = summaries.get(element_id)
        if summary is None:
            continue  # Pitfall 2: guard against missing summaries

        history = summary.get('history', []) or []
        grouped = _group_history_by_gw(history)  # Pattern 4: DGW aggregation

        element_type = element.get('element_type', 3)
        player_team_id = element['team']
        player_name = element.get('web_name', f'P{element_id}')
        team_short = teams_by_id.get(player_team_id, {}).get('short_name', '')

        for gw in target_gws:
            entry = grouped.get(gw)
            if entry is None:
                continue
            if entry['minutes'] < MIN_MINUTES:
                continue  # Claude's Discretion: skip DNP / cameo entries

            actual_pts = entry['total_points']

            # D-03: difficulty score for THIS player's team in THIS GW
            difficulty_score = fixture_difficulty.get((gw, player_team_id), 0.5)

            xpts_predicted = _reconstruct_xpts(entry, element_type, difficulty_score)

            # D-05: prior 5 GW window (entries strictly before `gw`)
            prior_entries = [grouped[g] for g in sorted(grouped.keys()) if g < gw]
            prior_window = prior_entries[-5:]
            proj_pts_predicted = _reconstruct_proj_pts(prior_window, entry, difficulty_score)

            per_gw_rows[gw].append({
                'player_id': element_id,
                'player_name': player_name,
                'team_short': team_short,
                'element_type': element_type,
                'actual_pts': actual_pts,
                'xpts_predicted': xpts_predicted,
                'proj_pts_predicted': proj_pts_predicted,
            })

    # Second pass: per-GW ranking and haulter flagging
    haulters: list = []
    gw_summaries: list = []
    total_haulters = 0
    total_xpts_flagged = 0
    total_proj_flagged = 0

    for gw in target_gws_desc:
        rows = per_gw_rows.get(gw, [])
        if not rows:
            gw_summaries.append({
                'gw': gw,
                'haulter_count': 0,
                'xpts_flagged': 0,
                'proj_pts_flagged': 0,
                'xpts_hit_rate': 0.0,
                'proj_pts_hit_rate': 0.0,
            })
            continue

        # Pitfall 4: rank ALL players, not just haulters
        xpts_ranked = sorted(rows, key=lambda r: r['xpts_predicted'], reverse=True)
        proj_ranked = sorted(rows, key=lambda r: r['proj_pts_predicted'], reverse=True)
        xpts_rank_by_id = {r['player_id']: i + 1 for i, r in enumerate(xpts_ranked)}
        proj_rank_by_id = {r['player_id']: i + 1 for i, r in enumerate(proj_ranked)}

        gw_haulters = [r for r in rows if r['actual_pts'] >= HAULTER_THRESHOLD]
        haulter_count = len(gw_haulters)
        xpts_flagged_count = 0
        proj_flagged_count = 0

        for r in gw_haulters:
            pid = r['player_id']
            xrank = xpts_rank_by_id.get(pid, 9999)
            prank = proj_rank_by_id.get(pid, 9999)
            xflagged = xrank <= TOP_N_PREDICTED
            pflagged = prank <= TOP_N_PREDICTED
            if xflagged:
                xpts_flagged_count += 1
            if pflagged:
                proj_flagged_count += 1
            haulters.append({
                'gw': gw,
                'player_id': pid,
                'player_name': r['player_name'],
                'actual_pts': r['actual_pts'],
                'xpts_predicted': r['xpts_predicted'],
                'xpts_rank': xrank,
                'xpts_flagged': xflagged,
                'proj_pts_predicted': r['proj_pts_predicted'],
                'proj_pts_rank': prank,
                'proj_pts_flagged': pflagged,
            })

        xpts_hit = xpts_flagged_count / haulter_count if haulter_count > 0 else 0.0
        proj_hit = proj_flagged_count / haulter_count if haulter_count > 0 else 0.0

        gw_summaries.append({
            'gw': gw,
            'haulter_count': haulter_count,
            'xpts_flagged': xpts_flagged_count,
            'proj_pts_flagged': proj_flagged_count,
            'xpts_hit_rate': round(xpts_hit, 4),
            'proj_pts_hit_rate': round(proj_hit, 4),
        })

        total_haulters += haulter_count
        total_xpts_flagged += xpts_flagged_count
        total_proj_flagged += proj_flagged_count

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
                'proj_pts_predicted': r['proj_pts_predicted'],
                'proj_pts_delta': round(r['actual_pts'] - r['proj_pts_predicted'], 2),
            })

    overall_xpts_hit = total_xpts_flagged / total_haulters if total_haulters > 0 else 0.0
    overall_proj_hit = total_proj_flagged / total_haulters if total_haulters > 0 else 0.0

    return {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'gws_covered': target_gws_desc,
        'summary': {
            'xpts_hit_rate': round(overall_xpts_hit, 4),
            'proj_pts_hit_rate': round(overall_proj_hit, 4),
            'gws': gw_summaries,
        },
        'haulters': haulters,
        'players': list(per_player.values()),
    }


def build_predictions_snapshot(merged: list, current_gw: int) -> dict:
    """Build predictions_snapshot.json for the current pipeline run (D-11, D-12).

    Args:
        merged: list of merged player dicts. Each must have id, proj_pts_1gw, xPts_1gw.
        current_gw: current gameweek number (typically `finished_gws + 1` or the active GW).

    Returns:
        Dict matching D-12 snapshot format: {gw, run_at, players: [{id, proj_pts_1gw, xPts_1gw}]}.
    """
    return {
        'gw': current_gw,
        'run_at': datetime.now(timezone.utc).isoformat(),
        'players': [
            {
                'id': p['id'],
                'proj_pts_1gw': p.get('proj_pts_1gw', 0.0),
                'xPts_1gw': p.get('xPts_1gw', 0.0),
            }
            for p in merged
        ],
    }


# ============================================================================
# Private helpers
# ============================================================================

def _empty_backtest() -> dict:
    """Return an empty but well-shaped backtest (used when no GWs are finished)."""
    return {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'gws_covered': [],
        'summary': {'xpts_hit_rate': 0.0, 'proj_pts_hit_rate': 0.0, 'gws': []},
        'haulters': [],
        'players': [],
    }


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
        agg['total_points'] += entry.get('total_points', 0) or 0
        agg['expected_goals'] += float(entry.get('expected_goals', 0) or 0)
        agg['expected_assists'] += float(entry.get('expected_assists', 0) or 0)
    return dict(by_round)


def _reconstruct_xpts(entry: dict, element_type: int, difficulty_score: float) -> float:
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
    )
    return round(result['total'], 2)


def _reconstruct_proj_pts(prior_entries: list, current_entry: dict, difficulty_score: float) -> float:
    """Reconstruct proj_pts for a single GW (D-05, D-06).

    Rolling per-90 PPG averaged over up to 5 prior GW entries (entries with minutes > 0).
    Difficulty modifier mirrors merge._proj_pts_ngw exactly: `1.0 - score * 0.5`.
    Binary start_prob: 1.0 if current minutes >= 45, else 0.0.
    """
    minutes = current_entry.get('minutes', 0) or 0
    if minutes <= 0:
        return 0.0

    played = [h for h in prior_entries if (h.get('minutes', 0) or 0) >= MIN_MINUTES]
    if not played:
        return 0.0

    per90_scores = []
    for h in played:
        m = h.get('minutes', 0) or 0
        pts = h.get('total_points', 0) or 0
        if m > 0:
            per90_scores.append((pts / m) * 90)

    if not per90_scores:
        return 0.0
    ppg = sum(per90_scores) / len(per90_scores)

    start_prob = 1.0 if minutes >= 45 else 0.0
    difficulty_modifier = 1.0 - (difficulty_score * 0.5)
    return round(ppg * start_prob * difficulty_modifier, 2)
