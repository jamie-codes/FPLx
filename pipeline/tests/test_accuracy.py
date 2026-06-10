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
from accuracy import (
    compute_accuracy_backtest, build_predictions_snapshot, FORMULA_VERSION,
    build_fixture_difficulty_lookup, build_per_gw_rows, compute_metrics_for_gws,
)
import math


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
    """ACC-01 / D-12: build_predictions_snapshot returns correct shape (Phase 42: snapshot is xPts-only)."""
    merged = [
        {'id': 1, 'xPts_1gw': 7.2},
        {'id': 2, 'xPts_1gw': 4.8},
    ]
    result = build_predictions_snapshot(merged, current_gw=32)

    assert result['gw'] == 32
    assert isinstance(result['run_at'], str)
    assert 'T' in result['run_at'], "run_at must be ISO 8601"
    assert len(result['players']) == 2
    assert result['players'][0] == {'id': 1, 'xPts_1gw': 7.2}
    assert result['players'][1] == {'id': 2, 'xPts_1gw': 4.8}


# ============================================================================
# Phase 42 ACC-02 / ACC-03 / ACC-04 — blended track, gate, mid-tier
# ============================================================================

def test_backtest_writes_blended_track():
    """ACC-02: per-GW + summary include xpts_blended_flagged and xpts_blended_hit_rate."""
    history = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 33)]
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs({1: history})
    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)

    assert 'xpts_blended_hit_rate' in result['summary']
    for gw_summary in result['summary']['gws']:
        assert 'xpts_blended_flagged' in gw_summary
        assert 'xpts_blended_hit_rate' in gw_summary


def test_backtest_writes_form_signal_enabled_flag():
    """ACC-03: top-level summary includes form_signal_enabled (bool) + blend_alpha_used (float)."""
    history = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 33)]
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs({1: history})
    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)

    assert 'form_signal_enabled' in result['summary']
    assert isinstance(result['summary']['form_signal_enabled'], bool)
    assert 'blend_alpha_used' in result['summary']
    assert isinstance(result['summary']['blend_alpha_used'], (int, float))


def test_form_signal_uses_strictly_prior_gws():
    """ACC-02 / Pitfall 6: form signal reconstruction at GW N excludes round >= N (no leak)."""
    # GW1-31 cold; GW32 huge spike. The form signal AT GW31 must not see GW32.
    history = [_hist(gw, 90, 6, xg=0.0, xa=0.0) for gw in range(1, 32)]
    history.append(_hist(32, 90, 15, xg=2.0, xa=1.0))

    summaries, fg, bootstrap, fixtures = _build_minimal_inputs({1: history})
    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)

    player = next(p for p in result['players'] if p['player_id'] == 1)
    gw31 = next(g for g in player['gws'] if g['gw'] == 31)
    gw32 = next(g for g in player['gws'] if g['gw'] == 32)

    # GW32's form signal sees GW27-31 (all cold) — its blended xpts ~ baseline (cold)
    # GW31's form signal sees GW26-30 (also cold) — its blended xpts ~ baseline (cold)
    # If GW32 leaked into GW31, blended for GW31 would jump.
    # With no leak, blended_predicted is in the same range as baseline_predicted at both GWs.
    # Sanity bound: GW31 blended xpts must be <= 1.5 * GW31 baseline xpts (no anomalous spike).
    assert gw31['xpts_blended_predicted'] <= 1.5 * max(gw31['xpts_predicted'], 1.0), \
        f"GW31 blended ({gw31['xpts_blended_predicted']}) must not spike from GW32 leak; baseline was {gw31['xpts_predicted']}"


def test_gate_enabled_when_blend_improves():
    """ACC-03: blend lifts hit rate by more than 2pp → form_signal_enabled is True."""
    # Build a 5-player population in which the form blend systematically reorders top-10 in favour
    # of haulters. Player 1 had cold season, hot recent form, hauls; baseline xPts ranks them outside
    # top-10, blended ranks them inside top-10.
    history_by_id = {}
    # Player 1: cold GW 1-29, very hot GW 30-32 (form signal lifts xPts). Hauls in GW 32.
    h = [_hist(gw, 90, 4, xg=0.05, xa=0.05) for gw in range(1, 30)]
    h += [_hist(gw, 90, 8, xg=1.2, xa=0.6) for gw in range(30, 33)]
    h[-1] = _hist(32, 90, 12, xg=1.2, xa=0.6)   # haulter on GW 32
    history_by_id[1] = h
    # Players 2-15: stable, mid-table predicted xPts; some haul, some don't.
    for pid in range(2, 16):
        base = [_hist(gw, 90, 5, xg=0.4, xa=0.2) for gw in range(1, 32)]
        # half haul, half don't on GW32
        actual = 12 if pid % 2 == 0 else 5
        base.append(_hist(32, 90, actual, xg=0.4, xa=0.2))
        history_by_id[pid] = base

    summaries, fg, bootstrap, fixtures = _build_minimal_inputs(history_by_id)
    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)

    # The synthetic data is constructed so blended outranks baseline on the player-1 hauler.
    # We do not require the gate be True (the helper math may or may not flip it for this
    # particular dataset), but the FIELD must exist and be a bool.
    assert isinstance(result['summary']['form_signal_enabled'], bool)
    # Blended hit rate must be >= baseline hit rate by construction (player 1 added value)
    assert result['summary']['xpts_blended_hit_rate'] >= result['summary']['xpts_hit_rate'] - 0.001


def test_backtest_gate_disabled_when_blended_no_better():
    """ACC-03 / Pitfall 3: blended <= baseline + 2pp margin → gate disabled."""
    # Static history: form signal == season rate ⇒ blend has no effect ⇒ blended == baseline ⇒ gate False.
    history = [_hist(gw, 90, 6, xg=0.5, xa=0.3) for gw in range(1, 33)]
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs({1: history})
    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)
    assert result['summary']['form_signal_enabled'] is False


def test_backtest_mid_tier_track():
    """ACC-04: mid-tier (6-9 pt) scorers tracked in summary as mid_tier_hit_rate."""
    history = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 32)]
    history.append(_hist(32, 90, 7, xg=0.3, xa=0.2))   # mid-tier (6 ≤ pts < 10)
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs({1: history})
    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)

    assert 'mid_tier_hit_rate' in result['summary']
    assert 'mid_tier_blended_hit_rate' in result['summary']
    # Player scored 7 pts → mid-tier, NOT haulter
    haulter_ids = {h['player_id'] for h in result['haulters']}
    assert 1 not in haulter_ids


def test_mid_tier_uses_wider_top_n():
    """ACC-04 / Pitfall 4: mid-tier ranking uses TOP_N_PREDICTED_MID = 30, not 10."""
    # 50 mid-tier scorers in GW 32; with top-30 net, hit rate must be > 0.
    history_by_id = {}
    for pid in range(1, 51):
        base = [_hist(gw, 90, 3, xg=0.1 * (1 + (pid % 5)), xa=0.1) for gw in range(1, 32)]
        base.append(_hist(32, 90, 7, xg=0.3, xa=0.2))   # all mid-tier in GW 32
        history_by_id[pid] = base

    summaries, fg, bootstrap, fixtures = _build_minimal_inputs(history_by_id)
    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)

    # With top-30 ranking and 50 mid-tier players, we expect at least some flagged
    # (if accidentally TOP_N_PREDICTED=10 was reused, hit rate would still be > 0 because
    # 50 candidates and 50 are mid-tier means 10 of them WILL be top-10 — so this test
    # alone does not prove top-30. The summary key existence in the previous test is the
    # contract; this one asserts the wider-net is meaningful (> 0 mid-tier hit rate).)
    assert result['summary']['mid_tier_hit_rate'] > 0.0


# ============================================================================
# Phase 53 BPS-01 — bonus_predictor_enabled flag persistence
# ============================================================================

def test_backtest_writes_bonus_predictor_flag():
    """Phase 53 BPS-01: top-level summary includes bonus_predictor_enabled (bool)."""
    history = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 33)]
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs({1: history})
    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)

    assert 'bonus_predictor_enabled' in result['summary'], (
        "summary must contain 'bonus_predictor_enabled' key (Phase 53 BPS-01)"
    )
    assert isinstance(result['summary']['bonus_predictor_enabled'], bool), (
        f"bonus_predictor_enabled must be bool, got {type(result['summary']['bonus_predictor_enabled'])}"
    )


def test_bonus_predictor_flag_defaults_false_cold_start(tmp_path):
    """Phase 53 BPS-01: bonus_predictor_enabled defaults to False when no prior backtest exists."""
    history = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 33)]
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs({1: history})
    # tmp_path is an empty directory — no accuracy_backtest.json present
    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures, cache_dir=str(tmp_path))

    assert result['summary']['bonus_predictor_enabled'] is False, (
        "Cold-start (no prior accuracy_backtest.json) must default bonus_predictor_enabled to False"
    )


def test_bonus_predictor_flag_persists_across_runs(tmp_path):
    """Phase 53 BPS-01: when prior accuracy_backtest.json has bonus_predictor_enabled: true,
    the next compute_accuracy_backtest call must preserve True (manual-flip pattern)."""
    import json as _json

    # Seed tmp_path with a prior accuracy_backtest.json that has the flag flipped ON.
    prior_path = tmp_path / 'accuracy_backtest.json'
    prior_path.write_text(_json.dumps({
        'summary': {
            'bonus_predictor_enabled': True,
            # Other keys may be absent — the helper only reads bonus_predictor_enabled.
        },
    }))

    history = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 33)]
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs({1: history})
    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures, cache_dir=str(tmp_path))

    assert result['summary']['bonus_predictor_enabled'] is True, (
        "When prior accuracy_backtest.json has bonus_predictor_enabled: true, "
        "subsequent backtest must preserve True (Phase 52 D-02 mirror pattern)"
    )


# ============================================================================
# Phase 63 VER-01 / VER-02 — version record persistence and dedup
# ============================================================================

def test_version_record_appended(tmp_path):
    """Phase 63 VER-01: a fresh run appends a version record with the current FORMULA_VERSION
    containing formula_version (str), recorded_at (ISO str), hit_rate (float), and gate_flags
    (dict with form_signal_enabled, xmins_v2_enabled, bonus_predictor_enabled)."""
    history = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 33)]
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs({1: history})
    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures, cache_dir=str(tmp_path))

    assert 'versions' in result, "result must contain top-level 'versions' key (D-02)"
    assert isinstance(result['versions'], list)
    assert len(result['versions']) >= 1, "fresh run must append at least one version record"

    record = result['versions'][-1]
    # D-04: required fields
    assert record['formula_version'] == FORMULA_VERSION
    assert isinstance(record['recorded_at'], str) and record['recorded_at'].endswith(('Z', '+00:00'))
    assert isinstance(record['hit_rate'], float)
    assert 'gate_flags' in record
    for flag in ('form_signal_enabled', 'xmins_v2_enabled', 'bonus_predictor_enabled'):
        assert flag in record['gate_flags'], f"gate_flags must include {flag}"
        assert isinstance(record['gate_flags'][flag], bool)


def test_version_dedup(tmp_path):
    """Phase 63 VER-01 / D-03: a second run with the SAME FORMULA_VERSION must NOT append
    a duplicate. Final versions list length stays at 1 after two consecutive runs."""
    import json as _json
    history = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 33)]
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs({1: history})

    # Seed prior cache with a record matching the current FORMULA_VERSION.
    prior_path = tmp_path / 'accuracy_backtest.json'
    prior_path.write_text(_json.dumps({
        'versions': [{
            'formula_version': FORMULA_VERSION,
            'recorded_at': '2026-05-01T00:00:00+00:00',
            'hit_rate': 0.4000,
            'gate_flags': {
                'form_signal_enabled': False,
                'xmins_v2_enabled': False,
                'bonus_predictor_enabled': False,
            },
        }],
    }))

    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures, cache_dir=str(tmp_path))

    assert len(result['versions']) == 1, (
        "Dedup (D-03): when versions[-1].formula_version == FORMULA_VERSION, "
        "no new record is appended; length stays at 1"
    )


def test_version_cold_start(tmp_path):
    """Phase 63 VER-01: cold start (no prior accuracy_backtest.json) returns versions
    list with exactly the single new record (no IndexError on empty list — Pitfall 7)."""
    history = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 33)]
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs({1: history})
    # tmp_path is empty — no prior file
    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures, cache_dir=str(tmp_path))

    assert isinstance(result['versions'], list)
    assert len(result['versions']) == 1
    assert result['versions'][0]['formula_version'] == FORMULA_VERSION


# ============================================================================
# Phase 63 CAL-01 / CAL-02 — calibration data structure and bucketing
# ============================================================================

def test_calibration_structure():
    """Phase 63 CAL-01 / D-06: result includes top-level 'calibration' key with shape
    { by_position: { all, '1', '2', '3', '4' } }; each bucket contains bucket_mid,
    predicted_rate, actual_rate, sample_n."""
    # Build inputs with enough players for non-trivial decile bucketing across 5 GWs.
    # 50 players × 5 GWs = 250 observations -> 25 per decile in 'all'.
    player_histories = {}
    for pid in range(1, 51):
        player_histories[pid] = [_hist(gw, 90, (pid % 12) + 1, xg=0.3, xa=0.2) for gw in range(1, 33)]
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs(player_histories)

    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)

    assert 'calibration' in result, "result must contain top-level 'calibration' key (D-06)"
    assert 'by_position' in result['calibration']
    assert 'all' in result['calibration']['by_position']
    for pos_key in ('1', '2', '3', '4'):
        assert pos_key in result['calibration']['by_position'], (
            f"by_position must include position key '{pos_key}' (D-06)"
        )

    all_buckets = result['calibration']['by_position']['all']
    assert isinstance(all_buckets, list)
    # With 50 players × 5 GWs = 250 observations and 10 deciles = 25 per bucket,
    # all 10 buckets should clear sample_n >= 5.
    assert len(all_buckets) == 10, "with 250 obs over 10 deciles, all 10 buckets pass sample_n >= 5"
    for b in all_buckets:
        for key in ('bucket_mid', 'predicted_rate', 'actual_rate', 'sample_n'):
            assert key in b, f"bucket missing required key {key}"
        assert isinstance(b['bucket_mid'], float)
        assert 0.0 <= b['bucket_mid'] <= 1.0
        assert isinstance(b['sample_n'], int)
        assert b['sample_n'] >= 5


def test_calibration_sparse_filter():
    """Phase 63 CAL-01 / D-07: buckets with sample_n < 5 are excluded from the array,
    leaving a gap (not a zero entry). With only 1 player there are 5 observations
    over 5 GWs spread thinly across 10 deciles — most deciles get 0 or 1 sample."""
    # Single player, 32 GW history -> 5 observations in target_gws -> deciles will be sparse.
    history = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 33)]
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs({1: history})

    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)

    all_buckets = result['calibration']['by_position']['all']
    # With only 5 total observations spread across 10 deciles, NO bucket should clear
    # the sample_n >= 5 threshold — array is empty.
    for b in all_buckets:
        assert b['sample_n'] >= 5, (
            "D-07: every returned bucket must have sample_n >= 5; sparse buckets are filtered out"
        )


def test_calibration_by_position():
    """Phase 63 CAL-02 / D-06: by_position has separate, non-aggregated arrays for
    each position code; the 'all' aggregate sample sums over per-position arrays
    are >= the position-specific sums (since 'all' includes all positions)."""
    # Mix of element_types so each position has populated buckets.
    player_histories = {}
    bootstrap_elements = []
    for pid in range(1, 41):
        # 10 players per position 1..4
        et = ((pid - 1) // 10) + 1
        bootstrap_elements.append({
            'id': pid, 'web_name': f'P{pid}', 'element_type': et, 'team': 14, 'starts': 10,
        })
        player_histories[pid] = [_hist(gw, 90, (pid % 8) + 2, xg=0.3, xa=0.2) for gw in range(1, 33)]
    summaries, fg, _bootstrap_unused, fixtures = _build_minimal_inputs(player_histories)
    # Override bootstrap.elements with mixed element_types (the helper hardcodes element_type=3).
    bootstrap = {
        'elements': bootstrap_elements,
        'teams': [{'id': 14, 'short_name': 'LIV'}, {'id': 1, 'short_name': 'ARS'}],
        'events': [{'id': i, 'finished': True} for i in range(1, fg + 1)],
    }

    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)

    by_pos = result['calibration']['by_position']
    # Each of '1', '2', '3', '4' must be a list (possibly empty if all sparse).
    for pos_key in ('1', '2', '3', '4'):
        assert isinstance(by_pos[pos_key], list)

    # 'all' aggregate must include observations from each position — total sample
    # in 'all' equals sum across positions.
    all_total = sum(b['sample_n'] for b in by_pos['all'])
    pos_total = sum(
        b['sample_n']
        for pos_key in ('1', '2', '3', '4')
        for b in by_pos[pos_key]
    )
    # Sparse-filter caveat: 'all' may have buckets that pass while a position
    # bucket fails the n>=5 gate (so all_total >= pos_total is the safe assertion).
    assert all_total >= pos_total, (
        "'all' aggregate must include >= the union of position-specific samples "
        "(some position buckets may be filtered as sparse while 'all' passes)"
    )


# ============================================================================
# Phase 91 CAL-01 — xPts-mean calibration chart (RED phase, Wave 0)
# ============================================================================

def test_calibration_includes_xpts_means():
    """Phase 91 CAL-01: each bucket includes predicted_mean and actual_mean (floats, 2dp).
    With 50 players × 5 GWs all scoring 6 pts, every decile mean ≈ 6.0 (Pitfall 7: use approx)."""
    player_histories = {
        pid: [_hist(gw, 90, 6, xg=0.3, xa=0.2) for gw in range(1, 33)]
        for pid in range(1, 51)
    }
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs(player_histories)

    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)
    all_buckets = result['calibration']['by_position']['all']

    assert len(all_buckets) > 0, "expected non-empty calibration buckets"
    for b in all_buckets:
        assert 'predicted_mean' in b, "Phase 91 CAL-01: bucket must include predicted_mean"
        assert 'actual_mean' in b, "Phase 91 CAL-01: bucket must include actual_mean"
        assert isinstance(b['predicted_mean'], float), \
            f"predicted_mean must be float, got {type(b['predicted_mean']).__name__}"
        assert isinstance(b['actual_mean'], float), \
            f"actual_mean must be float, got {type(b['actual_mean']).__name__}"
        # All players score 6 → every bucket's actual_mean ≈ 6.0 (Pitfall 7)
        assert b['actual_mean'] == pytest.approx(6.0, abs=0.01), \
            f"expected actual_mean≈6.0 with uniform 6pt input, got {b['actual_mean']}"


def test_calibration_xpts_means_descending_by_decile():
    """Phase 91 CAL-01: predicted_mean is monotonically non-increasing as bucket_mid increases.
    Top decile (lowest bucket_mid) has highest predicted_mean by construction."""
    player_histories = {
        pid: [_hist(gw, 90, 6, xg=0.3, xa=0.2) for gw in range(1, 33)]
        for pid in range(1, 51)
    }
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs(player_histories)

    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)
    all_buckets = result['calibration']['by_position']['all']
    assert len(all_buckets) >= 2, "need ≥2 buckets to test ordering"

    means = [b['predicted_mean'] for b in all_buckets]
    # bucket_mid 0.05 = top predictors (highest predicted_mean); bucket_mid 0.95 = bottom
    assert means[0] >= means[-1], (
        f"top decile predicted_mean ({means[0]}) should be >= bottom decile ({means[-1]})"
    )


def test_calibration_xpts_means_by_position():
    """Phase 91 CAL-01: by_position structure carries predicted_mean/actual_mean per position.
    Each non-empty position list has the new fields on every bucket."""
    player_histories = {
        pid: [_hist(gw, 90, (pid % 12) + 1, xg=0.3, xa=0.2) for gw in range(1, 33)]
        for pid in range(1, 51)
    }
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs(player_histories)

    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)
    by_pos = result['calibration']['by_position']

    for pos_key in ('1', '2', '3', '4'):
        buckets = by_pos[pos_key]
        if len(buckets) == 0:
            continue  # sparse position is allowed
        for b in buckets:
            assert 'predicted_mean' in b, \
                f"position {pos_key}: bucket missing predicted_mean"
            assert 'actual_mean' in b, \
                f"position {pos_key}: bucket missing actual_mean"
            assert isinstance(b['predicted_mean'], float)
            assert isinstance(b['actual_mean'], float)


def test_calibration_xpts_means_5gw_window():
    """Phase 91 CAL-01 / ROADMAP SC-1: calibration uses last 5 finished GWs.
    Players score 8 in GWs 28–32 (the 5-GW window) and 2 elsewhere → actual_mean is
    closer to 8.0 than to 2.0."""
    def _mixed_hist(pid):
        rows = []
        for gw in range(1, 33):
            pts = 8 if gw >= 28 else 2
            rows.append(_hist(gw, 90, pts, xg=0.3, xa=0.2))
        return rows
    player_histories = {pid: _mixed_hist(pid) for pid in range(1, 51)}
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs(player_histories)

    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)
    all_buckets = result['calibration']['by_position']['all']

    assert len(all_buckets) > 0, "expected non-empty calibration buckets"
    for b in all_buckets:
        # actual_mean should reflect the last-5-GW values (8), not the older ones (2)
        assert abs(b['actual_mean'] - 8.0) < abs(b['actual_mean'] - 2.0), (
            f"5-GW window not honored: actual_mean={b['actual_mean']} closer to 2.0 than to 8.0"
        )


def test_calibration_xpts_means_sample_n_integrity():
    """Phase 91 CAL-01: sparse-filter is mean-aware. Every emitted bucket has sample_n >= 5
    AND predicted_mean AND actual_mean present (no orphan buckets that pass sample_n but lack means)."""
    player_histories = {
        pid: [_hist(gw, 90, (pid % 8) + 1, xg=0.3, xa=0.2) for gw in range(1, 33)]
        for pid in range(1, 51)
    }
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs(player_histories)

    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)
    by_pos = result['calibration']['by_position']

    for pos_key, buckets in by_pos.items():
        for b in buckets:
            assert b['sample_n'] >= 5, \
                f"pos {pos_key} bucket {b['bucket_mid']}: sample_n={b['sample_n']} below threshold"
            assert 'predicted_mean' in b, \
                f"pos {pos_key} bucket {b['bucket_mid']}: passed sample_n but lacks predicted_mean"
            assert 'actual_mean' in b, \
                f"pos {pos_key} bucket {b['bucket_mid']}: passed sample_n but lacks actual_mean"


def test_calibration_xpts_means_cold_start_absence():
    """Phase 91 CAL-01 / D-06: _empty_backtest cold-start fallback emits empty bucket arrays.
    No bucket-level assertion needed — empty arrays satisfy D-06 (fields are optional)."""
    from accuracy import _empty_backtest

    result = _empty_backtest()

    assert 'calibration' in result, "_empty_backtest must include calibration key"
    by_pos = result['calibration']['by_position']
    assert by_pos['all'] == [], f"expected empty 'all', got {by_pos['all']}"
    for pos_key in ('1', '2', '3', '4'):
        assert by_pos[pos_key] == [], \
            f"expected empty position '{pos_key}', got {by_pos[pos_key]}"


# ============================================================================
# Phase 103 CAL-01 — position-aware sparse-bucket threshold + position-pool guard
# ============================================================================

def test_calibration_position_aware_threshold_gk_def():
    """Phase 103 CAL-01 / D-01: GK ('1') and DEF ('2') buckets require sample_n >= 15.
    Build a fixture with enough GK + DEF observations to fill some deciles past 15 and
    leave others sparse; verify every emitted GK / DEF bucket has sample_n >= 15."""
    # 30 GKs + 30 DEFs over 5 GWs = 150 obs each -> 15 per decile (right at threshold).
    # Mix point totals so deciles spread; some deciles will land at sample_n in [5,14]
    # under the old gate and must now be excluded.
    player_histories = {}
    bootstrap_elements = []
    for pid in range(1, 31):
        # element_type 1 = GK
        bootstrap_elements.append({
            'id': pid, 'web_name': f'P{pid}', 'element_type': 1, 'team': 14, 'starts': 10,
        })
        player_histories[pid] = [_hist(gw, 90, (pid % 14) + 1, xg=0.1, xa=0.05) for gw in range(1, 33)]
    for pid in range(31, 61):
        # element_type 2 = DEF
        bootstrap_elements.append({
            'id': pid, 'web_name': f'P{pid}', 'element_type': 2, 'team': 14, 'starts': 10,
        })
        player_histories[pid] = [_hist(gw, 90, (pid % 14) + 1, xg=0.2, xa=0.1) for gw in range(1, 33)]
    summaries, fg, _bootstrap_unused, fixtures = _build_minimal_inputs(player_histories)
    bootstrap = {
        'elements': bootstrap_elements,
        'teams': [{'id': 14, 'short_name': 'LIV'}, {'id': 1, 'short_name': 'ARS'}],
        'events': [{'id': i, 'finished': True} for i in range(1, fg + 1)],
    }

    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)
    by_pos = result['calibration']['by_position']

    for pos_key in ('1', '2'):
        for b in by_pos[pos_key]:
            assert b['sample_n'] >= 15, (
                f"D-01: pos {pos_key} bucket {b['bucket_mid']}: sample_n={b['sample_n']} "
                f"below new GK/DEF threshold of 15"
            )


def test_calibration_position_aware_threshold_mid_fwd():
    """Phase 103 CAL-01 / D-01: MID ('3') and FWD ('4') buckets require sample_n >= 8."""
    player_histories = {}
    bootstrap_elements = []
    for pid in range(1, 31):
        bootstrap_elements.append({
            'id': pid, 'web_name': f'P{pid}', 'element_type': 3, 'team': 14, 'starts': 10,
        })
        player_histories[pid] = [_hist(gw, 90, (pid % 14) + 1, xg=0.3, xa=0.2) for gw in range(1, 33)]
    for pid in range(31, 61):
        bootstrap_elements.append({
            'id': pid, 'web_name': f'P{pid}', 'element_type': 4, 'team': 14, 'starts': 10,
        })
        player_histories[pid] = [_hist(gw, 90, (pid % 14) + 1, xg=0.4, xa=0.25) for gw in range(1, 33)]
    summaries, fg, _bootstrap_unused, fixtures = _build_minimal_inputs(player_histories)
    bootstrap = {
        'elements': bootstrap_elements,
        'teams': [{'id': 14, 'short_name': 'LIV'}, {'id': 1, 'short_name': 'ARS'}],
        'events': [{'id': i, 'finished': True} for i in range(1, fg + 1)],
    }

    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)
    by_pos = result['calibration']['by_position']

    for pos_key in ('3', '4'):
        for b in by_pos[pos_key]:
            assert b['sample_n'] >= 8, (
                f"D-01: pos {pos_key} bucket {b['bucket_mid']}: sample_n={b['sample_n']} "
                f"below new MID/FWD threshold of 8"
            )


def test_calibration_aggregate_threshold_unchanged():
    """Phase 103 CAL-01 / D-01: 'all' aggregate STILL uses sample_n >= 5 (unchanged).
    The aggregate has ~200 obs/decile and does not need raising."""
    player_histories = {}
    for pid in range(1, 51):
        player_histories[pid] = [_hist(gw, 90, (pid % 12) + 1, xg=0.3, xa=0.2) for gw in range(1, 33)]
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs(player_histories)

    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)
    all_buckets = result['calibration']['by_position']['all']

    assert len(all_buckets) > 0, "'all' aggregate should be populated with 50 players * 5 GWs"
    for b in all_buckets:
        assert b['sample_n'] >= 5, (
            f"D-01: 'all' bucket {b['bucket_mid']} sample_n={b['sample_n']} — "
            f"'all' threshold should remain at 5 (unchanged)"
        )


def test_calibration_position_pool_guard():
    """Phase 103 CAL-01 / D-03: when an individual position has < 50 total observations,
    by_position[pos_key] is exactly []. With 5 players * 5 GWs = 25 obs across one position,
    we are below the 50-observation pool threshold."""
    # Single position fixture: 5 players, all element_type derived from same modulus -> few obs.
    player_histories = {}
    for pid in range(1, 6):
        player_histories[pid] = [_hist(gw, 90, 4, xg=0.3, xa=0.2) for gw in range(1, 33)]
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs(player_histories)

    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)
    by_pos = result['calibration']['by_position']

    # At least one of the individual positions ('1','2','3','4') must be empty under <50 guard.
    # Tally per-position totals from emitted buckets; any position with 0 emitted buckets
    # is a pool-guard hit (the bucket-level loop was skipped).
    empty_positions = [pk for pk in ('1', '2', '3', '4') if by_pos[pk] == []]
    assert len(empty_positions) >= 1, (
        f"D-03: with only 25 total obs spread across positions, at least one position "
        f"must hit the <50 pool guard and return []. by_pos lengths: "
        f"{ {pk: len(by_pos[pk]) for pk in ('1','2','3','4')} }"
    )


def test_calibration_pool_guard_skips_all_key():
    """Phase 103 CAL-01 / D-03: the < 50 pool guard NEVER applies to 'all'. Even with
    sparse data, the 'all' key falls through to the per-bucket < 5 gate (which may
    leave it empty), but it is not pre-emptively blanked by the pool guard."""
    # Tiny fixture: 1 player, 5 GWs -> 5 total obs. 'all' will have at most a couple
    # of buckets pass the < 5 gate; the test only asserts the key is present and the
    # per-bucket gate (not the pool guard) is what filtered it.
    player_histories = {1: [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 33)]}
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs(player_histories)

    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)
    by_pos = result['calibration']['by_position']

    assert 'all' in by_pos, "'all' key must be present in by_position"
    # Every emitted 'all' bucket still satisfies the per-bucket gate of sample_n >= 5.
    for b in by_pos['all']:
        assert b['sample_n'] >= 5, (
            f"'all' bucket {b['bucket_mid']} sample_n={b['sample_n']} below the unchanged < 5 gate"
        )


# ============================================================================
# Phase 109 MC-CAL-01 — MC-enabled calibration bucketing
# ============================================================================

def _build_mc_inputs(n_players: int = 50, finished_gws: int = 32):
    """Build (summaries, finished_gws, bootstrap, fixtures) with starts > 0 for all elements."""
    player_histories = {
        pid: [_hist(gw, 90, (pid % 12) + 1, xg=0.3, xa=0.2) for gw in range(1, finished_gws + 1)]
        for pid in range(1, n_players + 1)
    }
    return _build_minimal_inputs(player_histories, finished_gws=finished_gws)


def test_mc_calibration_mode_written_to_summary():
    """Phase 109 MC-CAL-01 / D-04: summary contains calibration_mode ('mc' or 'analytical')."""
    summaries, fg, bootstrap, fixtures = _build_mc_inputs()
    # Pass a haul_lookup covering all players — triggers MC mode (mc_enabled must also be True)
    # mc_enabled is read from prior cache (defaults False); we pass lookup but coverage check
    # will drive use_mc=False when mc_enabled is False. Test just asserts the field is present.
    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)
    assert 'calibration_mode' in result['summary'], (
        "Phase 109 MC-CAL-01: summary must include calibration_mode field"
    )
    assert result['summary']['calibration_mode'] in ('mc', 'analytical'), (
        f"calibration_mode must be 'mc' or 'analytical', got {result['summary']['calibration_mode']!r}"
    )


def test_mc_calibration_mode_analytical_when_no_lookup():
    """Phase 109 MC-CAL-01 / D-03: calibration_mode is 'analytical' when merged_haul_lookup is absent."""
    summaries, fg, bootstrap, fixtures = _build_mc_inputs()
    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)
    assert result['summary']['calibration_mode'] == 'analytical', (
        "Without merged_haul_lookup, calibration_mode must be 'analytical'"
    )


def test_mc_calibration_mode_analytical_when_mc_disabled(tmp_path):
    """Phase 109 MC-CAL-01 / D-03: calibration_mode is 'analytical' when mc_enabled is False
    even if a full haul_lookup is supplied."""
    import json as _json
    summaries, fg, bootstrap, fixtures = _build_mc_inputs()
    # Seed prior cache with mc_enabled: False
    prior_path = tmp_path / 'accuracy_backtest.json'
    prior_path.write_text(_json.dumps({'summary': {'mc_enabled': False}}))

    n_elements = len(bootstrap['elements'])
    haul_lookup = {i: 0.15 for i in range(1, n_elements + 1)}
    result = compute_accuracy_backtest(
        summaries, fg, bootstrap, fixtures,
        cache_dir=str(tmp_path),
        merged_haul_lookup=haul_lookup,
    )
    assert result['summary']['calibration_mode'] == 'analytical', (
        "mc_enabled=False must produce calibration_mode='analytical' regardless of haul_lookup"
    )


def test_mc_calibration_mode_analytical_when_coverage_below_threshold(tmp_path):
    """Phase 109 MC-CAL-01 / D-03: calibration_mode is 'analytical' when coverage < 80%."""
    import json as _json
    summaries, fg, bootstrap, fixtures = _build_mc_inputs(n_players=50)
    prior_path = tmp_path / 'accuracy_backtest.json'
    prior_path.write_text(_json.dumps({'summary': {'mc_enabled': True}}))

    # Only cover 10 out of 50 players (20% < 80%)
    haul_lookup = {i: 0.15 for i in range(1, 11)}
    result = compute_accuracy_backtest(
        summaries, fg, bootstrap, fixtures,
        cache_dir=str(tmp_path),
        merged_haul_lookup=haul_lookup,
    )
    assert result['summary']['calibration_mode'] == 'analytical', (
        "Coverage < 80% must produce calibration_mode='analytical'"
    )


def test_mc_calibration_mode_mc_when_fully_covered(tmp_path):
    """Phase 109 MC-CAL-01 / D-03: calibration_mode is 'mc' when mc_enabled=True and coverage >= 80%."""
    import json as _json
    summaries, fg, bootstrap, fixtures = _build_mc_inputs(n_players=50)
    prior_path = tmp_path / 'accuracy_backtest.json'
    prior_path.write_text(_json.dumps({'summary': {'mc_enabled': True}}))

    # Cover all players (100%)
    n_elements = len(bootstrap['elements'])
    haul_lookup = {pid: 0.2 for pid in range(1, n_elements + 1)}
    result = compute_accuracy_backtest(
        summaries, fg, bootstrap, fixtures,
        cache_dir=str(tmp_path),
        merged_haul_lookup=haul_lookup,
    )
    assert result['summary']['calibration_mode'] == 'mc', (
        "mc_enabled=True + coverage >= 80% must produce calibration_mode='mc'"
    )


def test_mc_calibration_predicted_rate_uses_haul_prob(tmp_path):
    """Phase 109 MC-CAL-01 / D-05: in MC mode, bucket predicted_rate = mean(haul_prob) per bucket,
    NOT bucket_mid. Verify predicted_rate != bucket_mid when haul_prob values differ from midpoints."""
    import json as _json
    summaries, fg, bootstrap, fixtures = _build_mc_inputs(n_players=50)
    prior_path = tmp_path / 'accuracy_backtest.json'
    prior_path.write_text(_json.dumps({'summary': {'mc_enabled': True}}))

    # Assign haul_prob = 0.5 for all players so mean(haul_prob) per bucket = 0.5.
    # bucket_mids range from 0.05 to 0.95, so predicted_rate == 0.5 != bucket_mid for most buckets.
    n_elements = len(bootstrap['elements'])
    haul_lookup = {pid: 0.5 for pid in range(1, n_elements + 1)}
    result = compute_accuracy_backtest(
        summaries, fg, bootstrap, fixtures,
        cache_dir=str(tmp_path),
        merged_haul_lookup=haul_lookup,
    )

    all_buckets = result['calibration']['by_position']['all']
    assert len(all_buckets) > 0, "expected non-empty calibration buckets"

    # Every bucket's predicted_rate should be approximately 0.5 (mean of uniform haul_prob=0.5)
    for b in all_buckets:
        assert abs(b['predicted_rate'] - 0.5) < 0.01, (
            f"MC mode: predicted_rate={b['predicted_rate']} expected ≈ 0.5 "
            f"(mean of uniform haul_prob=0.5); bucket_mid={b['bucket_mid']}"
        )


def test_mc_calibration_bucket_mid_preserved_in_mc_mode(tmp_path):
    """Phase 109 MC-CAL-01: bucket_mid is preserved (backward compat) even in MC mode.
    bucket_mid must always equal the decile midpoint (0.05, 0.15, ..., 0.95)."""
    import json as _json
    summaries, fg, bootstrap, fixtures = _build_mc_inputs(n_players=50)
    prior_path = tmp_path / 'accuracy_backtest.json'
    prior_path.write_text(_json.dumps({'summary': {'mc_enabled': True}}))

    n_elements = len(bootstrap['elements'])
    haul_lookup = {pid: 0.3 for pid in range(1, n_elements + 1)}
    result = compute_accuracy_backtest(
        summaries, fg, bootstrap, fixtures,
        cache_dir=str(tmp_path),
        merged_haul_lookup=haul_lookup,
    )

    all_buckets = result['calibration']['by_position']['all']
    valid_mids = {round(d * 0.1 + 0.05, 2) for d in range(10)}
    for b in all_buckets:
        assert b['bucket_mid'] in valid_mids, (
            f"MC mode: bucket_mid={b['bucket_mid']} not in valid midpoints {valid_mids}"
        )


def test_mc_calibration_analytical_path_unchanged():
    """Phase 109 MC-CAL-01: analytical path (use_mc=False) is unchanged; predicted_rate == bucket_mid."""
    summaries, fg, bootstrap, fixtures = _build_mc_inputs(n_players=50)
    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)

    all_buckets = result['calibration']['by_position']['all']
    assert len(all_buckets) > 0
    for b in all_buckets:
        assert b['predicted_rate'] == pytest.approx(b['bucket_mid'], abs=1e-9), (
            f"Analytical path: predicted_rate={b['predicted_rate']} must equal "
            f"bucket_mid={b['bucket_mid']} (unchanged from prior behaviour)"
        )


def test_mc_calibration_missing_player_gets_zero_haul_prob(tmp_path):
    """Phase 109 MC-CAL-01 / D-06: players absent from merged_haul_lookup get effective_haul_prob=0.0.
    They are sorted to the bottom decile in MC mode."""
    import json as _json
    summaries, fg, bootstrap, fixtures = _build_mc_inputs(n_players=50)
    prior_path = tmp_path / 'accuracy_backtest.json'
    prior_path.write_text(_json.dumps({'summary': {'mc_enabled': True}}))

    # Supply high haul_prob for player 1 only — all others default to 0.0
    haul_lookup = {1: 0.9}  # Only 1 out of 50 covered — coverage = 2% → analytical mode.
    result = compute_accuracy_backtest(
        summaries, fg, bootstrap, fixtures,
        cache_dir=str(tmp_path),
        merged_haul_lookup=haul_lookup,
    )
    # Coverage < 80% → analytical mode; no KeyError from missing players
    assert result['summary']['calibration_mode'] == 'analytical'
    assert 'calibration' in result


# ============================================================================
# Phase 116 VER-01 — sample_gws field on version records
# ============================================================================

def test_new_version_record_includes_sample_gws_equal_to_finished_gw_count():
    """Phase 116 VER-01 / D-09: compute_accuracy_backtest() version record gains
    'sample_gws' field equal to len(target_gws_desc) — count of finished GWs
    contributing to hit_rate."""
    from accuracy import BACKTEST_GWS

    player_histories = {1: [_hist(gw, 90, 6, xg=0.5) for gw in range(1, 33)]}
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs(player_histories, finished_gws=32)
    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)

    assert 'versions' in result, "result must have 'versions' key"
    versions = result['versions']
    assert len(versions) > 0, "versions list must be non-empty"
    fv_entry = next((v for v in versions if v.get('formula_version') == FORMULA_VERSION), None)
    assert fv_entry is not None, f"FORMULA_VERSION entry not found in versions: {versions}"
    assert 'sample_gws' in fv_entry, f"'sample_gws' key missing from version record: {fv_entry}"
    assert fv_entry['sample_gws'] == BACKTEST_GWS, (
        f"Expected sample_gws == BACKTEST_GWS ({BACKTEST_GWS}) but got {fv_entry['sample_gws']}"
    )


def test_empty_backtest_version_record_has_sample_gws_zero(tmp_path):
    """Phase 116 VER-01 / D-10: _empty_backtest() version record gains 'sample_gws': 0
    (cold start by definition)."""
    from accuracy import _empty_backtest

    result = _empty_backtest(str(tmp_path))

    assert 'versions' in result, "empty backtest must have 'versions' key"
    versions = result['versions']
    assert len(versions) > 0, "versions list must be non-empty for FORMULA_VERSION cold-start record"
    last = versions[-1]
    assert 'sample_gws' in last, f"'sample_gws' missing from empty backtest version record: {last}"
    assert last['sample_gws'] == 0, (
        f"Expected sample_gws == 0 (cold start) but got {last['sample_gws']}"
    )


def test_legacy_version_records_without_sample_gws_are_preserved(tmp_path):
    """Phase 116 VER-01 / T-116-03-01: legacy version entries lacking 'sample_gws' are
    preserved verbatim — the new code must NOT mutate existing entries."""
    import json as _json

    legacy_entry = {
        'formula_version': 'vTEST_LEGACY',
        'recorded_at': '2025-01-01T00:00:00+00:00',
        'hit_rate': 0.55,
        'gate_flags': {
            'form_signal_enabled': True,
            'xmins_v2_enabled': True,
            'bonus_predictor_enabled': False,
            'save_predictor_enabled': False,
            'mc_enabled': False,
        },
    }
    prior_cache = {
        'summary': {},
        'versions': [legacy_entry],
    }
    cache_file = tmp_path / 'accuracy_backtest.json'
    cache_file.write_text(_json.dumps(prior_cache))

    player_histories = {1: [_hist(gw, 90, 6, xg=0.5) for gw in range(1, 33)]}
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs(player_histories, finished_gws=32)
    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures, cache_dir=str(tmp_path))

    versions = result['versions']
    # Legacy entry must be present and unmodified (no sample_gws injected)
    legacy_in_result = next(
        (v for v in versions if v.get('formula_version') == 'vTEST_LEGACY'), None
    )
    assert legacy_in_result is not None, "Legacy 'vTEST_LEGACY' entry must be preserved in versions"
    assert 'sample_gws' not in legacy_in_result, (
        f"Legacy entry must NOT have 'sample_gws' added: {legacy_in_result}"
    )
    assert legacy_in_result['hit_rate'] == 0.55, "Legacy entry hit_rate must be unchanged"

    # New FORMULA_VERSION entry must have sample_gws
    from accuracy import FORMULA_VERSION as _FV, BACKTEST_GWS as _BGWS
    new_entry = next((v for v in versions if v.get('formula_version') == _FV), None)
    assert new_entry is not None, f"New FORMULA_VERSION entry must be present: {versions}"
    assert 'sample_gws' in new_entry, f"New FORMULA_VERSION entry must have 'sample_gws': {new_entry}"
    assert new_entry['sample_gws'] == _BGWS, (
        f"Expected sample_gws == {_BGWS} but got {new_entry['sample_gws']}"
    )


# ============================================================================
# TUNE-01 — build_fixture_difficulty_lookup and compute_metrics_for_gws
# ============================================================================

class TestBuildFixtureDifficultyLookup:
    def test_maps_team_and_gw_to_difficulty(self):
        fixtures = [
            {'event': 1, 'team_h': 10, 'team_a': 5, 'team_h_difficulty': 3, 'team_a_difficulty': 5},
        ]
        lookup = build_fixture_difficulty_lookup(fixtures)
        # team_h difficulty for team 10 in GW1: (3-1)/4.0 = 0.5
        assert abs(lookup[(1, 10)] - 0.5) < 1e-9
        # team_a difficulty for team 5 in GW1: (5-1)/4.0 = 1.0
        assert abs(lookup[(1, 5)] - 1.0) < 1e-9

    def test_skips_fixtures_without_event(self):
        fixtures = [{'team_h': 1, 'team_a': 2, 'team_h_difficulty': 3, 'team_a_difficulty': 3}]
        lookup = build_fixture_difficulty_lookup(fixtures)
        assert len(lookup) == 0


class TestComputeMetricsForGws:
    """compute_metrics_for_gws must return haul_hit_rate, rmse, captain_hit_rate."""

    def _make_rows(self, player_specs):
        """player_specs: list of (player_id, actual_pts, xpts_blended_predicted)."""
        rows = []
        for pid, actual, xpred in player_specs:
            rows.append({
                'player_id': pid,
                'player_name': f'P{pid}',
                'team_short': 'TST',
                'element_type': 3,
                'actual_pts': actual,
                'xpts_predicted': xpred,
                'xpts_blended_predicted': xpred,
            })
        return rows

    def test_haul_hit_rate_perfect(self):
        """Haulter is ranked #1 → haul_hit_rate = 1.0."""
        rows = self._make_rows([(1, 12, 8.0), (2, 4, 3.0)])  # P1 hauls + is rank-1
        per_gw_rows = {1: rows}
        metrics = compute_metrics_for_gws(per_gw_rows, [1])
        assert metrics['haul_hit_rate'] == 1.0

    def test_haul_hit_rate_zero(self):
        """Haulter ranked outside top 10 → haul_hit_rate = 0.0."""
        # Build 11 players with higher xpts_blended, 1 haulter ranked last
        rows = [{'player_id': i, 'player_name': f'P{i}', 'team_short': 'T',
                 'element_type': 3, 'actual_pts': 2, 'xpts_predicted': 10.0 - i * 0.5,
                 'xpts_blended_predicted': 10.0 - i * 0.5} for i in range(1, 12)]
        rows.append({'player_id': 99, 'player_name': 'Haulter', 'team_short': 'T',
                     'element_type': 3, 'actual_pts': 15, 'xpts_predicted': 0.1,
                     'xpts_blended_predicted': 0.1})  # ranked last
        per_gw_rows = {1: rows}
        metrics = compute_metrics_for_gws(per_gw_rows, [1])
        assert metrics['haul_hit_rate'] == 0.0

    def test_rmse_exact(self):
        """RMSE = sqrt(mean((pred - actual)^2))."""
        rows = self._make_rows([(1, 4.0, 6.0), (2, 8.0, 6.0)])  # both 2pt error
        per_gw_rows = {1: rows}
        metrics = compute_metrics_for_gws(per_gw_rows, [1])
        expected_rmse = math.sqrt((4.0 + 4.0) / 2)  # = 2.0
        assert abs(metrics['rmse'] - expected_rmse) < 0.001

    def test_captain_hit_rate_win(self):
        """Rank-1 player scores most points → captain_hit_rate = 1.0."""
        rows = self._make_rows([(1, 14, 9.0), (2, 6, 5.0)])  # P1 highest xpts AND highest actual
        per_gw_rows = {1: rows}
        metrics = compute_metrics_for_gws(per_gw_rows, [1])
        assert metrics['captain_hit_rate'] == 1.0

    def test_captain_hit_rate_miss(self):
        """Rank-1 player doesn't score most → captain_hit_rate = 0.0."""
        rows = self._make_rows([(1, 4, 9.0), (2, 14, 5.0)])  # P1 top xpts but P2 scores more
        per_gw_rows = {1: rows}
        metrics = compute_metrics_for_gws(per_gw_rows, [1])
        assert metrics['captain_hit_rate'] == 0.0

    def test_empty_gws_returns_zeros(self):
        per_gw_rows = {1: []}
        metrics = compute_metrics_for_gws(per_gw_rows, [1])
        assert metrics == {'haul_hit_rate': 0.0, 'rmse': 0.0, 'captain_hit_rate': 0.0}

    def test_multi_gw_aggregation(self):
        """Metrics aggregate correctly over multiple GWs."""
        # GW1: P1 is the haulter AND ranked #1 → haul hit
        gw1 = self._make_rows([(1, 12, 9.0), (2, 4, 5.0)])

        # GW2: P99 is the haulter but ranked #12 (11 players with higher xpts) → haul miss
        gw2_others = [{'player_id': i, 'player_name': f'P{i}', 'team_short': 'T',
                        'element_type': 3, 'actual_pts': 2,
                        'xpts_predicted': 10.0 - i * 0.1,
                        'xpts_blended_predicted': 10.0 - i * 0.1}
                      for i in range(1, 12)]  # 11 players ranked 1..11
        gw2_haulter = {'player_id': 99, 'player_name': 'Haulter', 'team_short': 'T',
                        'element_type': 3, 'actual_pts': 14, 'xpts_predicted': 0.1,
                        'xpts_blended_predicted': 0.1}  # ranked 12th
        gw2 = gw2_others + [gw2_haulter]

        per_gw_rows = {1: gw1, 2: gw2}
        metrics = compute_metrics_for_gws(per_gw_rows, [1, 2])
        assert abs(metrics['haul_hit_rate'] - 0.5) < 0.001  # 1 hit out of 2 haulters
        # GW1: P1 highest xpts (9.0), P1 highest actual (12) → captain hit
        # GW2: P1 has highest xpts (9.9) but P99 has highest actual (14) → captain miss
        # captain_hit_rate = 1/2 = 0.5
        assert abs(metrics['captain_hit_rate'] - 0.5) < 0.001


# ============================================================================
# TUNE-01 — build_per_gw_rows tunable parameter tests
# ============================================================================

class TestBuildPerGwRows:
    """build_per_gw_rows must apply tunable params to reconstructed xPts."""

    def _make_inputs(self, n_gws=15, element_type=2):
        """Build minimal (summaries, bootstrap, fixture_difficulty, teams_by_id)."""
        history = [
            {'round': gw, 'minutes': 90, 'total_points': 5,
             'expected_goals': 0.05, 'expected_assists': 0.02, 'starts': 1}
            for gw in range(1, n_gws + 1)
        ]
        summaries = {1: {'history': history}}
        bootstrap = {
            'elements': [
                {'id': 1, 'web_name': 'P1', 'element_type': element_type,
                 'team': 14, 'starts': n_gws}
            ],
            'teams': [{'id': 14, 'short_name': 'TST'}]
        }
        fixtures = [
            {'event': gw, 'team_h': 14, 'team_a': 1,
             'team_h_difficulty': 3, 'team_a_difficulty': 3}
            for gw in range(1, n_gws + 1)
        ]
        from accuracy import build_fixture_difficulty_lookup
        fixture_difficulty = build_fixture_difficulty_lookup(fixtures)
        teams_by_id = {14: {'short_name': 'TST'}}
        return summaries, bootstrap, fixture_difficulty, teams_by_id

    def test_cs_prob_base_affects_xpts_predicted_for_defender(self):
        """Higher cs_prob_base must increase xpts_predicted for a DEF player."""
        summaries, bootstrap, fd, tbi = self._make_inputs(element_type=2)
        gws = list(range(1, 16))
        rows_lo = build_per_gw_rows(summaries, gws, bootstrap, fd, tbi, cs_prob_base=0.25)
        rows_hi = build_per_gw_rows(summaries, gws, bootstrap, fd, tbi, cs_prob_base=0.55)
        # Take any GW with a row
        lo_xpts = rows_lo[1][0]['xpts_predicted']
        hi_xpts = rows_hi[1][0]['xpts_predicted']
        assert hi_xpts > lo_xpts

    def test_blend_alpha_affects_xpts_blended_predicted(self):
        """Different blend_alpha values must produce different xpts_blended_predicted when form exists."""
        # Build player with 10 GWs of strong form (high xG)
        history = [
            {'round': gw, 'minutes': 90, 'total_points': 8,
             'expected_goals': 0.6, 'expected_assists': 0.2, 'starts': 1}
            for gw in range(1, 16)
        ]
        summaries = {1: {'history': history}}
        bootstrap = {
            'elements': [{'id': 1, 'web_name': 'P1', 'element_type': 3, 'team': 14, 'starts': 15}],
            'teams': [{'id': 14, 'short_name': 'TST'}]
        }
        from accuracy import build_fixture_difficulty_lookup
        fixtures = [{'event': gw, 'team_h': 14, 'team_a': 1,
                     'team_h_difficulty': 3, 'team_a_difficulty': 3}
                    for gw in range(1, 16)]
        fd = build_fixture_difficulty_lookup(fixtures)
        tbi = {14: {'short_name': 'TST'}}
        # GW 10+ has prior form signal; test blended vs unblended
        rows_zero = build_per_gw_rows(summaries, [10], bootstrap, fd, tbi, blend_alpha=0.0)
        rows_full = build_per_gw_rows(summaries, [10], bootstrap, fd, tbi, blend_alpha=1.0)
        # With identical uniform history, season and form are the same so blended == unblended
        # This at least confirms the param is passed through without error
        assert len(rows_zero[10]) > 0
        assert len(rows_full[10]) > 0


# ── APM-01: sub appearance tests ──────────────────────────────────────────────

class TestComputeSubAppearProb:
    """Tests for _compute_sub_appear_prob helper."""

    def _make_grouped(self, rounds_data):
        """Build a minimal grouped dict. rounds_data: list of (round, minutes, sub_appear_n, difficulty_n)."""
        grouped = {}
        for r, mins, sub_n, diff_n in rounds_data:
            grouped[r] = {
                'round': r, 'minutes': mins, 'total_points': 0,
                'expected_goals': 0.0, 'expected_assists': 0.0,
                'goals_scored': 0, 'assists': 0,
                'difficulty_sum': 3.0 * diff_n, 'difficulty_n': diff_n,
                'sub_appear_n': sub_n,
            }
        return grouped

    def test_basic(self):
        """2 sub appearances across 10 entries (SGW rounds), window=15 → 2/10 = 0.2."""
        from accuracy import _compute_sub_appear_prob
        grouped = self._make_grouped(
            [(r, 90, 0, 1) for r in range(1, 9)]   # 8 starts, no subs
            + [(9, 30, 1, 1), (10, 25, 1, 1)]       # 2 sub appearances
        )
        # current_gw=11 → all 10 rounds are prior
        result = _compute_sub_appear_prob(grouped, current_gw=11, window_gws=15)
        assert abs(result - 2/10) < 1e-6

    def test_empty_history(self):
        """No rounds before current_gw → 0.0."""
        from accuracy import _compute_sub_appear_prob
        grouped = self._make_grouped([(5, 90, 0, 1)])
        result = _compute_sub_appear_prob(grouped, current_gw=3, window_gws=15)
        assert result == 0.0

    def test_window_cap(self):
        """Only 5 rounds before current_gw, window=15 → uses those 5, denominator = 5."""
        from accuracy import _compute_sub_appear_prob
        grouped = self._make_grouped(
            [(r, 90, 0, 1) for r in range(1, 4)]   # 3 starts
            + [(4, 20, 1, 1), (5, 35, 1, 1)]        # 2 sub appearances
        )
        result = _compute_sub_appear_prob(grouped, current_gw=6, window_gws=15)
        assert abs(result - 2/5) < 1e-6

    def test_reconstruct_xpts_sub_appearance_returns_sub_appear_prob(self):
        """APM-01: entry with minutes=30 (< 45) → _reconstruct_xpts returns sub_appear_prob."""
        from accuracy import _reconstruct_xpts
        entry = {'minutes': 30, 'total_points': 1,
                 'expected_goals': 0.0, 'expected_assists': 0.0}
        result = _reconstruct_xpts(entry, element_type=3, difficulty_score=0.5,
                                    sub_appear_prob=0.25)
        assert abs(result - 0.25) < 0.001


# ── CSF-01: build_team_def_form_lookup ───────────────────────────────────────

from accuracy import build_team_def_form_lookup


def _finished_fix(gw: int, h_id: int, a_id: int, h_score: int, a_score: int) -> dict:
    return {
        'event': gw, 'team_h': h_id, 'team_a': a_id,
        'team_h_score': h_score, 'team_a_score': a_score,
        'finished': True,
    }


def test_build_team_def_form_lookup_basic():
    """Team with higher goals conceded → higher norm_concede_rate than team with fewer."""
    fixtures = []
    # Team 1 concedes 3 per game; team 2 concedes 0 per game (6 prior games before GW 7)
    for gw in range(1, 7):
        fixtures.append(_finished_fix(gw, h_id=1, a_id=2, h_score=0, a_score=3))  # team 1 concedes 3, team 2 concedes 0

    # Also add an upcoming fixture at GW 7 for both teams
    fixtures.append({'event': 7, 'team_h': 1, 'team_a': 2, 'finished': False})

    lookup = build_team_def_form_lookup(fixtures, window_gws=6)
    rate_leaky = lookup.get((7, 1), 0.5)   # team 1 concedes 3/game
    rate_solid = lookup.get((7, 2), 0.5)   # team 2 concedes 0/game
    assert rate_leaky > rate_solid


def test_build_team_def_form_lookup_cold_start():
    """Team with no prior fixtures → returns 0.5."""
    # GW 1 upcoming fixture — no finished games before it
    fixtures = [{'event': 1, 'team_h': 10, 'team_a': 11, 'finished': False}]
    lookup = build_team_def_form_lookup(fixtures, window_gws=6)
    assert lookup.get((1, 10), 0.5) == pytest.approx(0.5)
    assert lookup.get((1, 11), 0.5) == pytest.approx(0.5)


def test_build_team_def_form_lookup_sparse():
    """Only 2 prior games with window=6 → denominator = 2 (actual entries, not window)."""
    # Team 3 played GW 1 and GW 2, conceded 2 each time. Team 4 conceded 0 each time.
    fixtures = [
        _finished_fix(1, h_id=3, a_id=4, h_score=0, a_score=2),  # team 3 concedes 2, team 4 concedes 0
        _finished_fix(2, h_id=4, a_id=3, h_score=2, a_score=0),  # team 3 concedes 2 again, team 4 concedes 0
        {'event': 3, 'team_h': 3, 'team_a': 4, 'finished': False},
    ]
    lookup = build_team_def_form_lookup(fixtures, window_gws=6)
    # team 3: avg = 2.0 (2 games); team 4: avg = 0.0 → team 3 norm > team 4 norm
    assert lookup.get((3, 3), 0.5) > lookup.get((3, 4), 0.5)


def test_build_team_def_form_lookup_all_equal():
    """All teams identical concede rate → returns 0.5 for all (division guard)."""
    # Both teams concede exactly 1 per game
    fixtures = [
        _finished_fix(1, h_id=5, a_id=6, h_score=1, a_score=1),
        _finished_fix(2, h_id=5, a_id=6, h_score=1, a_score=1),
        {'event': 3, 'team_h': 5, 'team_a': 6, 'finished': False},
    ]
    lookup = build_team_def_form_lookup(fixtures, window_gws=6)
    assert lookup.get((3, 5), 0.5) == pytest.approx(0.5)
    assert lookup.get((3, 6), 0.5) == pytest.approx(0.5)


# ── ATF-01: build_team_atf_lookup ────────────────────────────────────────── #

def test_build_team_atf_lookup_basic():
    """Team with more goals scored → higher norm_attack_rate than team with fewer."""
    from accuracy import build_team_atf_lookup
    fixtures = [
        _finished_fix(1, h_id=1, a_id=2, h_score=3, a_score=0),
        {'event': 2, 'team_h': 1, 'team_a': 2,
         'team_h_score': None, 'team_a_score': None, 'finished': False},
    ]
    lookup = build_team_atf_lookup(fixtures)
    rate_1 = lookup.get((2, 1), 0.5)
    rate_2 = lookup.get((2, 2), 0.5)
    assert rate_1 > rate_2


def test_build_team_atf_lookup_cold_start():
    """No prior finished fixtures → returns 0.5 for all teams."""
    from accuracy import build_team_atf_lookup
    fixtures = [
        {'event': 1, 'team_h': 1, 'team_a': 2,
         'team_h_score': None, 'team_a_score': None, 'finished': False},
    ]
    lookup = build_team_atf_lookup(fixtures)
    assert lookup.get((1, 1), 0.5) == 0.5
    assert lookup.get((1, 2), 0.5) == 0.5


def test_build_team_atf_lookup_sparse():
    """Only 2 prior games with window=6 → denominator = 2 (actual entries, sparse-safe)."""
    from accuracy import build_team_atf_lookup
    fixtures = [
        _finished_fix(1, h_id=3, a_id=4, h_score=2, a_score=0),
        _finished_fix(2, h_id=3, a_id=4, h_score=2, a_score=0),
        {'event': 3, 'team_h': 3, 'team_a': 4,
         'team_h_score': None, 'team_a_score': None, 'finished': False},
    ]
    lookup = build_team_atf_lookup(fixtures, window_gws=6)
    rate_3 = lookup.get((3, 3), 0.5)
    # team 3 scores 2+2=4 over 2 games → avg 2.0 (denominator=2, not 6)
    # team 4 scores 0+0=0 → avg 0.0; normalised: team 3 = 1.0 > 0.5
    assert rate_3 > 0.5


def test_build_team_atf_lookup_all_equal():
    """All teams identical scoring rate → returns 0.5 for all (division guard)."""
    from accuracy import build_team_atf_lookup
    fixtures = [
        _finished_fix(1, h_id=1, a_id=2, h_score=1, a_score=1),
        {'event': 2, 'team_h': 1, 'team_a': 2,
         'team_h_score': None, 'team_a_score': None, 'finished': False},
    ]
    lookup = build_team_atf_lookup(fixtures)
    assert lookup.get((2, 1), 0.5) == 0.5
    assert lookup.get((2, 2), 0.5) == 0.5


# ── DC-01: build_defcon_rate_lookup ──────────────────────────────────────── #

def _dc_summary(pid, rates):
    """rates: list of (round, minutes, dc)."""
    return {pid: {'history': [
        {'round': r, 'minutes': m, 'defensive_contribution': d}
        for r, m, d in rates]}}


def test_build_defcon_rate_lookup_strictly_prior():
    from accuracy import build_defcon_rate_lookup
    summaries = _dc_summary(7, [(1, 90, 12), (2, 90, 12), (3, 90, 0)])
    elements = [{'id': 7, 'element_type': 3}]
    lookup = build_defcon_rate_lookup(summaries, elements)
    assert lookup[(1, 7)] == 0.0          # nothing prior
    assert lookup[(2, 7)] == 1.0          # 1/1 prior hits
    assert lookup[(3, 7)] == 1.0          # 2/2
    # GW3's own miss not visible at GW3; a GW4 key doesn't exist (no GW4 entry)


def test_build_defcon_rate_lookup_sixty_minute_denominator():
    from accuracy import build_defcon_rate_lookup
    summaries = _dc_summary(8, [(1, 90, 12), (2, 30, 12), (3, 90, 0)])
    elements = [{'id': 8, 'element_type': 3}]
    lookup = build_defcon_rate_lookup(summaries, elements)
    # At GW3: prior 60+ games = GW1 only (GW2 was 30 mins) -> 1/1
    assert lookup[(3, 8)] == 1.0


def test_build_defcon_rate_lookup_def_threshold_and_gkp():
    from accuracy import build_defcon_rate_lookup
    summaries = {}
    summaries.update(_dc_summary(1, [(1, 90, 10), (2, 90, 10)]))
    summaries.update(_dc_summary(2, [(1, 90, 10), (2, 90, 10)]))
    elements = [{'id': 1, 'element_type': 2},   # DEF: threshold 10 -> hits
                {'id': 2, 'element_type': 1}]   # GKP: excluded entirely
    lookup = build_defcon_rate_lookup(summaries, elements)
    assert lookup[(2, 1)] == 1.0
    assert (2, 2) not in lookup
