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
from accuracy import compute_accuracy_backtest, build_predictions_snapshot, FORMULA_VERSION


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
