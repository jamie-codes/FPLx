"""Wave 0 RED gate (Phase 92, DH-04).

These tests fail collection with ImportError until Plan 02 adds
_append_history and _compute_overall_status to pipeline/data_health.py.
Per VALIDATION.md task map 92-01-01..92-01-04.

Test contract derived from:
  - 92-RESEARCH.md §Code Examples (helper signatures + integration sketch)
  - 92-PATTERNS.md §pipeline/tests/test_data_health_history.py (analog mapping)
  - 92-UI-SPEC.md (HistoryEntry enum: 'ok' | 'warning' | 'error')
"""

import json
import pytest

# Will FAIL collection until pipeline/data_health.py exposes _append_history
# and _compute_overall_status. Wave 0 RED is intentional.
from data_health import _append_history, _compute_overall_status, compute_data_health


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


# ------------------------------------------------------------------ Phase 92 DH-04

def test_append_and_fifo_cap():
    """92-01-01: _append_history caps at 7 FIFO entries; oldest dropped when exceeding cap."""
    base = [
        {'timestamp': f'2026-01-0{i}T00:00:00+00:00', 'overall_status': 'ok'}
        for i in range(1, 8)
    ]  # 7 existing entries (2026-01-01..2026-01-07)
    result = _append_history(base, 'warning', '2026-01-08T00:00:00+00:00')

    assert isinstance(result, list)
    assert len(result) == 7
    # Oldest (2026-01-01) dropped; new oldest is 2026-01-02.
    assert result[0]['timestamp'] == '2026-01-02T00:00:00+00:00'
    # Newest entry appended at the end with the supplied status.
    assert result[-1]['timestamp'] == '2026-01-08T00:00:00+00:00'
    assert result[-1]['overall_status'] == 'warning'


def test_cold_start_empty_history():
    """92-01-02: First run with prior_history=[] -> single entry appended."""
    result = _append_history([], 'ok', '2026-01-01T00:00:00+00:00')

    assert isinstance(result, list)
    assert len(result) == 1
    assert result[0]['timestamp'] == '2026-01-01T00:00:00+00:00'
    assert result[0]['overall_status'] == 'ok'


def test_status_enum_normalisation():
    """92-01-03: _compute_overall_status normalises pipeline 'warn' -> HistoryEntry 'warning'."""
    # 'warn' must map to 'warning' to match the HistoryEntry enum exposed in src/lib/types.ts.
    checks_warn = [{'status': 'warn'}, {'status': 'ok'}]
    assert _compute_overall_status(checks_warn) == 'warning'

    # Error wins over warn.
    checks_error = [{'status': 'error'}, {'status': 'warn'}, {'status': 'ok'}]
    assert _compute_overall_status(checks_error) == 'error'

    # All-ok stays 'ok'.
    checks_ok = [{'status': 'ok'}, {'status': 'ok'}]
    assert _compute_overall_status(checks_ok) == 'ok'


def test_atomic_write_order(tmp_path):
    """92-01-04: Three sequential compute_data_health calls produce chronological FIFO history."""
    merged = [_make_player() for _ in range(800)]
    ts = _make_timestamps()

    # Run 1: no prior data_health.json -> history starts at 1 entry.
    r1 = compute_data_health(merged, ts, str(tmp_path))
    assert 'history' in r1, "compute_data_health must include 'history' in result dict"
    assert len(r1['history']) == 1
    # Persist r1 back to tmp_path so r2 reads it as prior (mirrors test_missing_delta_reads_prior pattern).
    (tmp_path / 'data_health.json').write_text(json.dumps(r1))

    # Run 2: prior history has 1 entry -> grows to 2.
    r2 = compute_data_health(merged, ts, str(tmp_path))
    assert len(r2['history']) == 2
    (tmp_path / 'data_health.json').write_text(json.dumps(r2))

    # Run 3: prior history has 2 entries -> grows to 3.
    r3 = compute_data_health(merged, ts, str(tmp_path))
    assert len(r3['history']) == 3

    # Chronological order: r1 timestamp <= r2 timestamp <= r3 timestamp.
    timestamps = [e['timestamp'] for e in r3['history']]
    assert timestamps == sorted(timestamps), (
        f"history timestamps must be chronological, got: {timestamps}"
    )

    # Each entry has the HistoryEntry shape: {timestamp, overall_status}.
    for entry in r3['history']:
        assert set(entry.keys()) == {'timestamp', 'overall_status'}, (
            f"history entry has unexpected keys: {set(entry.keys())}"
        )
        assert entry['overall_status'] in ('ok', 'warning', 'error'), (
            f"overall_status must be normalised, got: {entry['overall_status']}"
        )
