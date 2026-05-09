"""Wave 0 RED gate (Phase 82, DH-01).

These tests fail collection with ModuleNotFoundError until Task 2 creates
pipeline/data_health.py. Per VALIDATION.md task map 82-01-01..82-01-11.

Test contract derived from:
  - CONTEXT.md D-01..D-19 (locked thresholds and behaviors)
  - RESEARCH.md §Code Examples (output shape; sanitize contract)
"""

import json
import pytest

# Will FAIL until pipeline/data_health.py exists. Wave 0 RED is intentional.
from data_health import compute_data_health, _sanitize_error


# ------------------------------------------------------------------ helpers

def _make_player(*, understat_id=1, xg_per90=0.5):
    return {'understat_id': understat_id, 'xg_per90': xg_per90}


def _make_timestamps():
    return {
        'merged_players.json': '2026-01-01T00:00:00+00:00',
        'insights.json': '2026-01-01T00:00:00+00:00',
        'gw_intel.json': '2026-01-01T00:00:00+00:00',
        'accuracy_backtest.json': '2026-01-01T00:00:00+00:00',
        'last_updated.json': '2026-01-01T00:00:00+00:00',
    }


# ------------------------------------------------------------------ tests

def test_compute_data_health_shape(tmp_path):
    """82-01-01: compute_data_health returns a dict with all required top-level keys."""
    merged = [_make_player() for _ in range(3)]
    result = compute_data_health(merged, _make_timestamps(), str(tmp_path), pipeline_stale=False)

    assert isinstance(result, dict)
    for key in (
        'generated_at', 'timestamps', 'total_player_count', 'prev_player_count',
        'missing_player_delta', 'understat_id_null_count', 'fpl_proxy_fallback_count',
        'xg_per90_null_count', 'sanity_checks',
    ):
        assert key in result, f"missing top-level key: {key}"

    assert isinstance(result['sanity_checks'], list)
    assert len(result['sanity_checks']) == 4
    for check in result['sanity_checks']:
        for subkey in ('id', 'status', 'value', 'threshold'):
            assert subkey in check, f"sanity check missing key: {subkey}"


def test_player_count_check_ok(tmp_path):
    """82-01-02: 800 players -> player_count status='ok', value=800, threshold='>= 700'."""
    merged = [_make_player() for _ in range(800)]
    result = compute_data_health(merged, _make_timestamps(), str(tmp_path))

    check = next(c for c in result['sanity_checks'] if c['id'] == 'player_count')
    assert check['status'] == 'ok'
    assert check['value'] == 800
    assert check['threshold'] == '>= 700'


def test_player_count_check_warn(tmp_path):
    """82-01-03: 600 players -> player_count status='warn', value=600."""
    merged = [_make_player() for _ in range(600)]
    result = compute_data_health(merged, _make_timestamps(), str(tmp_path))

    check = next(c for c in result['sanity_checks'] if c['id'] == 'player_count')
    assert check['status'] == 'warn'
    assert check['value'] == 600


def test_player_count_check_error(tmp_path):
    """82-01-04: 500 players -> player_count status='error', value=500."""
    merged = [_make_player() for _ in range(500)]
    result = compute_data_health(merged, _make_timestamps(), str(tmp_path))

    check = next(c for c in result['sanity_checks'] if c['id'] == 'player_count')
    assert check['status'] == 'error'
    assert check['value'] == 500


def test_missing_delta_first_run(tmp_path):
    """82-01-05: no prior data_health.json -> prev_player_count=None, delta=0, status='ok' (D-16)."""
    merged = [_make_player() for _ in range(820)]
    result = compute_data_health(merged, _make_timestamps(), str(tmp_path))

    assert result['prev_player_count'] is None
    assert result['missing_player_delta'] == 0

    check = next(c for c in result['sanity_checks'] if c['id'] == 'missing_player_delta')
    assert check['status'] == 'ok'
    assert check['value'] == 0


def test_missing_delta_reads_prior(tmp_path):
    """82-01-06: prior data_health.json present -> delta=abs(820-832)=12, status='warn' (> 5 threshold)."""
    prior = {'total_player_count': 832}
    (tmp_path / 'data_health.json').write_text(json.dumps(prior))

    merged = [_make_player() for _ in range(820)]
    result = compute_data_health(merged, _make_timestamps(), str(tmp_path))

    assert result['prev_player_count'] == 832
    assert result['missing_player_delta'] == 12  # absolute delta

    check = next(c for c in result['sanity_checks'] if c['id'] == 'missing_player_delta')
    assert check['status'] == 'warn'  # 12 > 5 threshold from D-03


def test_sanitize_error_strips_token():
    """82-01-07: _sanitize_error strips env-var tokens (D-19)."""
    exc = RuntimeError("Failed to fetch BLOB_READ_WRITE_TOKEN value")
    result = _sanitize_error(exc)
    assert 'BLOB_READ_WRITE_TOKEN' not in result


def test_sanitize_error_strips_path():
    """82-01-08: _sanitize_error strips absolute POSIX and Windows paths (D-19)."""
    exc = RuntimeError("Cannot read /home/user/.env file")
    exc2 = RuntimeError("Cannot read C:\\Users\\me\\secret.txt")
    result = _sanitize_error(exc)
    result2 = _sanitize_error(exc2)
    assert '/home/user' not in result
    assert 'C:\\Users\\me' not in result2


def test_sanitize_error_truncates():
    """82-01-09: _sanitize_error truncates to <= 200 chars (D-19)."""
    exc = RuntimeError("X" * 500)
    assert len(_sanitize_error(exc)) <= 200


def test_understat_null_pct_check(tmp_path):
    """82-01-10: 20/100 null understat_id -> warn (20 > 15%); 35/100 -> error (35 > 30%)."""
    # 20 nulls -> warn
    merged_20 = (
        [_make_player(understat_id=None) for _ in range(20)] +
        [_make_player(understat_id=i + 1) for i in range(80)]
    )
    result_20 = compute_data_health(merged_20, _make_timestamps(), str(tmp_path))
    check_20 = next(c for c in result_20['sanity_checks'] if c['id'] == 'understat_null_pct')
    assert check_20['status'] == 'warn'
    assert check_20['value'] == pytest.approx(20.0, abs=0.01)

    # 35 nulls -> error
    tmp_path2 = tmp_path / 'run2'
    tmp_path2.mkdir()
    merged_35 = (
        [_make_player(understat_id=None) for _ in range(35)] +
        [_make_player(understat_id=i + 1) for i in range(65)]
    )
    result_35 = compute_data_health(merged_35, _make_timestamps(), str(tmp_path2))
    check_35 = next(c for c in result_35['sanity_checks'] if c['id'] == 'understat_null_pct')
    assert check_35['status'] == 'error'


def test_pipeline_stale_check(tmp_path):
    """82-01-11: pipeline_stale=True -> status='error'; pipeline_stale=False -> status='ok'."""
    merged = [_make_player() for _ in range(800)]

    result_stale = compute_data_health(merged, _make_timestamps(), str(tmp_path), pipeline_stale=True)
    check_stale = next(c for c in result_stale['sanity_checks'] if c['id'] == 'pipeline_stale')
    assert check_stale['status'] == 'error'
    assert check_stale['value'] is True
    assert check_stale['threshold'] == 'false'

    tmp_path2 = tmp_path / 'ok'
    tmp_path2.mkdir()
    result_ok = compute_data_health(merged, _make_timestamps(), str(tmp_path2), pipeline_stale=False)
    check_ok = next(c for c in result_ok['sanity_checks'] if c['id'] == 'pipeline_stale')
    assert check_ok['status'] == 'ok'
    assert check_ok['value'] is False


# ------------------------------------------------------------------ Phase 84 SPQ-02 / D-04 / D-05

def test_sp_unmatched_check_omitted_when_none(tmp_path):
    """D-05: sp_unmatched_count omitted (default None) -> sanity_checks remains 4 entries.

    Preserves backward compatibility: existing callers that don't pass the new kwarg
    see no behavioral change. RESEARCH Pitfall 6.
    """
    merged = [_make_player() for _ in range(800)]
    result = compute_data_health(merged, _make_timestamps(), str(tmp_path))
    assert len(result['sanity_checks']) == 4
    ids = [c['id'] for c in result['sanity_checks']]
    assert 'sp_unmatched_ids' not in ids


def test_sp_unmatched_check_appended_when_int(tmp_path):
    """D-04: sp_unmatched_count=25 -> 5th sanity_check appended with status='error'."""
    merged = [_make_player() for _ in range(800)]
    result = compute_data_health(
        merged, _make_timestamps(), str(tmp_path),
        sp_unmatched_count=25,
    )
    assert len(result['sanity_checks']) == 5
    check = next(c for c in result['sanity_checks'] if c['id'] == 'sp_unmatched_ids')
    assert check['status'] == 'error'
    assert check['value'] == 25
    assert check['threshold'] == '<= 5'


def test_sp_unmatched_threshold_ok(tmp_path):
    """D-04: sp_unmatched_count=3 -> status='ok' (boundary check at 5)."""
    merged = [_make_player() for _ in range(800)]
    result = compute_data_health(
        merged, _make_timestamps(), str(tmp_path),
        sp_unmatched_count=3,
    )
    check = next(c for c in result['sanity_checks'] if c['id'] == 'sp_unmatched_ids')
    assert check['status'] == 'ok'
    assert check['value'] == 3


def test_sp_unmatched_threshold_warn(tmp_path):
    """D-04: sp_unmatched_count=15 -> status='warn' (in 6..20 range)."""
    merged = [_make_player() for _ in range(800)]
    result = compute_data_health(
        merged, _make_timestamps(), str(tmp_path),
        sp_unmatched_count=15,
    )
    check = next(c for c in result['sanity_checks'] if c['id'] == 'sp_unmatched_ids')
    assert check['status'] == 'warn'
    assert check['value'] == 15


def test_sp_unmatched_threshold_error_boundary(tmp_path):
    """D-04: sp_unmatched_count=21 -> status='error' (just past 20 boundary)."""
    merged = [_make_player() for _ in range(800)]
    result = compute_data_health(
        merged, _make_timestamps(), str(tmp_path),
        sp_unmatched_count=21,
    )
    check = next(c for c in result['sanity_checks'] if c['id'] == 'sp_unmatched_ids')
    assert check['status'] == 'error'
    assert check['value'] == 21
