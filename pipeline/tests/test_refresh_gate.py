"""Wave 0 RED gate (Phase 89, REFRESH-01).

These tests fail collection with ModuleNotFoundError until Plan 02 creates
pipeline/refresh_gate.py. 8 cases:

  - test_before_window
  - test_in_window
  - test_after_window
  - test_failure_skip                 (empty events -> False)
  - test_failure_skip_main            (HTTP exception -> main() catches, writes run=false)
  - test_dgw_double_deadline
  - test_cold_bootstrap
  - test_naive_iso_string_treated_as_utc  (defensive tzinfo guard)

Test contract derived from:
  - 89-CONTEXT.md decisions D-01..D-08
  - 89-RESEARCH.md Code Examples + Validation Architecture
  - ROADMAP.md Phase 89 Success Criteria SC-1 / SC-5
"""

import os
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

# Will FAIL until pipeline/refresh_gate.py exists. Wave 0 RED is intentional.
from refresh_gate import check_deadline_window


# ------------------------------------------------------------------ constants

NOW = datetime(2026, 8, 16, 9, 0, tzinfo=timezone.utc)


# ------------------------------------------------------------------ helpers

def _events(*offsets_minutes: int) -> list[dict]:
    """Build events list where each deadline is NOW + offset minutes.

    Output strings carry an explicit 'Z' suffix to match real FPL bootstrap.
    """
    return [
        {'deadline_time': (NOW + timedelta(minutes=m)).strftime('%Y-%m-%dT%H:%M:%SZ')}
        for m in offsets_minutes
    ]


# ------------------------------------------------------------------ tests

def test_before_window():
    """Before-window: deadline 3 hours away -> run=False."""
    events = _events(180)
    assert check_deadline_window(events, now=NOW, window_minutes=90) is False


def test_in_window():
    """In-window: deadline 60 min away -> run=True."""
    events = _events(60)
    assert check_deadline_window(events, now=NOW, window_minutes=90) is True


def test_after_window():
    """After-window: deadline was 60 min ago (in the past) -> run=False.

    A past deadline is NOT a future event, so no future_deadlines remain
    and the function returns False.
    """
    past_events = [
        {'deadline_time': (NOW - timedelta(minutes=60)).strftime('%Y-%m-%dT%H:%M:%SZ')}
    ]
    assert check_deadline_window(past_events, now=NOW, window_minutes=90) is False


def test_failure_skip():
    """Empty events list (defensive) -> run=False."""
    assert check_deadline_window([], now=NOW, window_minutes=90) is False


def test_failure_skip_main(tmp_path, monkeypatch):
    """HTTP exception path: main() catches, writes run=false, never raises."""
    import refresh_gate

    output_file = tmp_path / 'github_output'
    output_file.write_text('', encoding='utf-8')
    monkeypatch.setenv('GITHUB_OUTPUT', str(output_file))

    with patch.object(refresh_gate, 'get_bootstrap_static', side_effect=Exception('boom')):
        refresh_gate.main()  # MUST NOT raise

    contents = output_file.read_text(encoding='utf-8')
    assert 'run=false' in contents


def test_dgw_double_deadline():
    """DGW: two future deadlines, both within window -> run=True (nearest wins)."""
    events = _events(60, 90)
    assert check_deadline_window(events, now=NOW, window_minutes=90) is True


def test_cold_bootstrap():
    """End of season: no future events at all -> run=False."""
    assert check_deadline_window([], now=NOW, window_minutes=90) is False


def test_naive_iso_string_treated_as_utc():
    """Defensive tzinfo guard: naive ISO string (no 'Z') is treated as UTC.

    Pitfall 1 from RESEARCH.md — if FPL ever drops the 'Z' suffix, the
    comparison must NOT raise TypeError. Asserts the dt.tzinfo is None
    branch sets UTC and the deadline 30 min away is in window.
    """
    naive_deadline = (NOW + timedelta(minutes=30)).strftime('%Y-%m-%dT%H:%M:%S')
    events = [{'deadline_time': naive_deadline}]
    assert check_deadline_window(events, now=NOW, window_minutes=90) is True
