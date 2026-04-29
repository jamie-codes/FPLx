"""Unit tests for pipeline/accuracy.py (Phase 40, ACC-01).

These tests are written before pipeline/accuracy.py exists (Wave 0 RED gate
per VALIDATION.md). They will all fail collection with ModuleNotFoundError
until Plan 02 creates the module.

Test contract is derived from:
  - CONTEXT.md D-08 (JSON output shape)
  - CONTEXT.md D-09 (haulter threshold = 10 actual pts)
  - CONTEXT.md D-10 (top-10 predicted = "flagged"; hit_rate = flagged/total)
  - CONTEXT.md D-11/D-12 (snapshot format)
  - RESEARCH.md Pattern 4 (DGW aggregation: sum minutes / total_points / xG / xA)
  - RESEARCH.md Pitfall 1 (own-team-id used for fixture lookup, not opponent_team)
"""

import math
import pytest

# This import will FAIL until Plan 02 creates pipeline/accuracy.py.
# Wave 0 RED: collection error is the explicit failure mode.
from accuracy import compute_accuracy_backtest, build_predictions_snapshot


# ------------------------------------------------------------------ helpers

def _hist(round_, minutes, total_points, xg=0.0, xa=0.0, opponent_team=1):
    return {
        'round': round_,
        'minutes': minutes,
        'total_points': total_points,
        'expected_goals': xg,
        'expected_assists': xa,
        'opponent_team': opponent_team,
        'starts': 1 if minutes >= 45 else 0,
    }


def _build_minimal_inputs(player_history_by_id, finished_gws=32):
    """Build (summaries, finished_gws, bootstrap, fixtures) tuple.

    player_history_by_id: dict[int, list[dict]] — element_id -> history entries
    Adds one fixture per GW per team; team 14 (player team) plays team 1.
    Difficulty for team 14 in every fixture is 3 (mid-table) -> score 0.5.
    """
    elements = []
    for pid in player_history_by_id:
        elements.append({
            'id': pid, 'web_name': f'Player{pid}', 'element_type': 3,
            'team': 14, 'starts': 10,
        })

    bootstrap = {
        'elements': elements,
        'teams': [
            {'id': 14, 'short_name': 'LIV'},
            {'id': 1, 'short_name': 'ARS'},
        ],
        'events': [{'id': i, 'finished': True} for i in range(1, finished_gws + 1)],
    }

    fixtures = []
    for gw in range(1, finished_gws + 1):
        fixtures.append({
            'event': gw,
            'team_h': 14,
            'team_a': 1,
            'team_h_difficulty': 3,
            'team_a_difficulty': 3,
            'finished': True,
        })

    summaries = {
        pid: {'history': hist}
        for pid, hist in player_history_by_id.items()
    }
    return summaries, finished_gws, bootstrap, fixtures


# ------------------------------------------------------------------ tests

def test_backtest_structure():
    """ACC-01 / D-08: output dict has required top-level keys."""
    history = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 33)]
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs({1: history})

    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)

    assert isinstance(result, dict)
    for key in ('generated_at', 'gws_covered', 'summary', 'haulters', 'players'):
        assert key in result, f"missing top-level key: {key}"

    # D-01: covers last 5 finished GWs (28..32 in descending order)
    assert sorted(result['gws_covered']) == [28, 29, 30, 31, 32]

    # D-08 summary nested keys
    assert 'xpts_hit_rate' in result['summary']
    assert 'proj_pts_hit_rate' in result['summary']
    assert 'gws' in result['summary']


def test_haulter_detection():
    """ACC-01 / D-09: total_points >= 10 marks player as haulter."""
    history_haulter = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 32)]
    history_haulter.append(_hist(32, 90, 12, xg=0.7, xa=0.4))  # haul on last GW

    history_nonhaul = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 32)]
    history_nonhaul.append(_hist(32, 90, 8, xg=0.5, xa=0.3))   # under threshold

    summaries, fg, bootstrap, fixtures = _build_minimal_inputs({
        1: history_haulter,
        2: history_nonhaul,
    })

    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)
    haulter_ids = {h['player_id'] for h in result['haulters']}
    assert 1 in haulter_ids, "player 1 scored 12 pts (>=10) and must be a haulter"
    assert 2 not in haulter_ids, "player 2 scored 8 pts (<10) and must NOT be a haulter"

    h_entry = next(h for h in result['haulters'] if h['player_id'] == 1 and h['gw'] == 32)
    assert h_entry['actual_pts'] == 12


def test_hit_rate_computation():
    """ACC-01 / D-10: hit_rate = flagged_haulters / total_haulters."""
    # Build 4 haulters in GW 32; rank them so xpts flags 2 of them.
    history_by_id = {}
    for pid in range(1, 5):
        base = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 32)]
        base.append(_hist(32, 90, 15, xg=0.8, xa=0.5))  # all haulters in GW 32
        history_by_id[pid] = base

    summaries, fg, bootstrap, fixtures = _build_minimal_inputs(history_by_id)
    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)

    gw32 = next(g for g in result['summary']['gws'] if g['gw'] == 32)
    assert gw32['haulter_count'] == 4
    # xpts_hit_rate is xpts_flagged / haulter_count — bounded between 0 and 1
    assert 0.0 <= gw32['xpts_hit_rate'] <= 1.0
    # By construction every haulter scored equally, so all should rank top-10
    # (only 4 players in pool) -> hit rate = 1.0
    assert gw32['xpts_hit_rate'] == pytest.approx(1.0)
    assert gw32['xpts_flagged'] == 4


def test_xpts_reconstruction():
    """ACC-01 / D-02, D-03, D-04: reconstructed xPts is in sane bounds."""
    history = [_hist(gw, 90, 6, xg=0.5, xa=0.3) for gw in range(1, 33)]
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs({1: history})

    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)
    player = next(p for p in result['players'] if p['player_id'] == 1)
    gw32 = next(g for g in player['gws'] if g['gw'] == 32)

    assert gw32['xpts_predicted'] is not None
    assert 0.0 < gw32['xpts_predicted'] < 20.0, "xPts must be sane positive value"
    assert 'xpts_delta' in gw32


def test_proj_pts_reconstruction():
    """ACC-01 / D-05, D-06: proj_pts uses rolling PPG from prior 5 GWs * difficulty modifier."""
    # Player scores exactly 6 points in 90 minutes for every GW
    history = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 33)]
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs({1: history})

    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)
    player = next(p for p in result['players'] if p['player_id'] == 1)
    gw32 = next(g for g in player['gws'] if g['gw'] == 32)

    # PPG = (6/90)*90 = 6 per game; difficulty_score = (3-1)/4.0 = 0.5;
    # difficulty_modifier = 1.0 - 0.5*0.5 = 0.75; start_prob = 1.0
    # expected proj_pts ≈ 6 * 1.0 * 0.75 = 4.5
    assert math.isclose(gw32['proj_pts_predicted'], 4.5, abs_tol=0.5), \
        f"expected proj_pts ≈ 4.5, got {gw32['proj_pts_predicted']}"


def test_dgw_aggregation():
    """ACC-01 / Claude's Discretion (CONTEXT.md): DGW entries summed by round."""
    history = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 32)]
    # GW 32 DGW: two fixtures, summed total = 4 + 8 = 12 (haulter)
    history.append(_hist(32, 90, 4, xg=0.2, xa=0.1))
    history.append(_hist(32, 90, 8, xg=0.3, xa=0.2))

    summaries, fg, bootstrap, fixtures = _build_minimal_inputs({1: history})
    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)

    player = next(p for p in result['players'] if p['player_id'] == 1)
    gw32_entries = [g for g in player['gws'] if g['gw'] == 32]
    assert len(gw32_entries) == 1, "DGW must produce exactly one aggregated entry"
    assert gw32_entries[0]['actual_pts'] == 12

    # Player should also be a haulter for GW 32
    haulter_ids = {(h['player_id'], h['gw']) for h in result['haulters']}
    assert (1, 32) in haulter_ids


def test_empty_backtest_when_no_finished_gws():
    """ACC-01: compute_accuracy_backtest returns valid D-08 shape when finished_gws=0."""
    summaries, _, bootstrap, fixtures = _build_minimal_inputs({}, finished_gws=0)
    result = compute_accuracy_backtest(summaries, 0, bootstrap, fixtures)
    for key in ('generated_at', 'gws_covered', 'summary', 'haulters', 'players'):
        assert key in result, f"missing top-level key: {key}"
    assert result['gws_covered'] == []
    assert result['haulters'] == []
    assert result['players'] == []


def test_snapshot_format():
    """ACC-01 / D-12: build_predictions_snapshot returns correct shape."""
    merged = [
        {'id': 1, 'proj_pts_1gw': 6.5, 'xPts_1gw': 7.2},
        {'id': 2, 'proj_pts_1gw': 4.0, 'xPts_1gw': 4.8},
    ]
    result = build_predictions_snapshot(merged, current_gw=32)

    assert result['gw'] == 32
    assert isinstance(result['run_at'], str)
    assert 'T' in result['run_at'], "run_at must be ISO 8601"
    assert len(result['players']) == 2
    assert result['players'][0] == {'id': 1, 'proj_pts_1gw': 6.5, 'xPts_1gw': 7.2}
    assert result['players'][1] == {'id': 2, 'proj_pts_1gw': 4.0, 'xPts_1gw': 4.8}
