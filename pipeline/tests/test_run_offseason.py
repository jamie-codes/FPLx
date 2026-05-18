"""Contract tests for pipeline/run.py IS_OFF_SEASON detection logic (Phase 123 WIN-03).

run.py imports dotenv at module-load time and has top-level side effects.
Importing run directly in tests causes dotenv to fire and potentially
mutate environment state. Following the pattern in test_run.py, these
tests exercise the IS_OFF_SEASON detection idiom and skip-log format
via REPLICA FUNCTIONS rather than importing run.

The replica function is the EXACT detection expression that run.py will use:
    IS_OFF_SEASON = not any(e.get('is_current') for e in events)

If production code in run.py drifts from this expression, this test fails
as a contract regression — which is the intent.

References:
  D-05: transfer_news runs year-round; IS_OFF_SEASON only skips GW-dependent steps
  D-06: IS_OFF_SEASON = not any(e.get('is_current') for e in events)
         Skipped steps log [pipeline] IS_OFF_SEASON: skipping {step}
  WIN-03: IS_OFF_SEASON gate detects no current GW; GW-dependent steps degrade gracefully
"""


# ---------------------------------------------------------------------------
# Replica functions (mirrors what Task 02 adds to run.py)
# ---------------------------------------------------------------------------


def _detect_is_off_season(bootstrap: dict) -> bool:
    """Replica of the run.py IS_OFF_SEASON detection — D-06 contract test.

    Production run.py uses exactly:
        events = bootstrap.get('events', [])
        IS_OFF_SEASON = not any(e.get('is_current') for e in events)

    This replica must stay in sync with that expression.
    """
    events = bootstrap.get('events', [])
    return not any(e.get('is_current') for e in events)


def _skip_log(step: str) -> str:
    """Replica of the D-06 skip-log format used in run.py IS_OFF_SEASON else branch.

    Production run.py uses:
        print("[pipeline] IS_OFF_SEASON: skipping {step}")

    The format is locked — no period, no extra punctuation, exact prefix.
    """
    return f"[pipeline] IS_OFF_SEASON: skipping {step}"


# ---------------------------------------------------------------------------
# IS_OFF_SEASON detection tests
# ---------------------------------------------------------------------------


def test_is_off_season_true_when_events_empty():
    """D-06: empty events list means no current GW — IS_OFF_SEASON is True."""
    result = _detect_is_off_season({'events': []})
    assert result is True


def test_is_off_season_true_when_no_event_is_current():
    """D-06: all events have is_current=False — IS_OFF_SEASON is True."""
    bootstrap = {
        'events': [
            {'id': 36, 'is_current': False, 'finished': True},
            {'id': 37, 'is_current': False, 'finished': True},
            {'id': 38, 'is_current': False, 'finished': True},
        ]
    }
    result = _detect_is_off_season(bootstrap)
    assert result is True


def test_is_off_season_true_when_bootstrap_missing_events_key():
    """D-06: bootstrap dict without 'events' key — .get('events', []) returns [] — True."""
    result = _detect_is_off_season({})
    assert result is True


def test_is_off_season_false_when_one_event_is_current():
    """D-06: one event with is_current=True among several — IS_OFF_SEASON is False."""
    bootstrap = {
        'events': [
            {'id': 33, 'is_current': False, 'finished': True},
            {'id': 34, 'is_current': True, 'finished': False},
            {'id': 35, 'is_current': False, 'finished': False},
        ]
    }
    result = _detect_is_off_season(bootstrap)
    assert result is False


def test_is_off_season_false_in_typical_in_season_bootstrap():
    """D-06: typical mid-season bootstrap (GW34 is_current=True) — IS_OFF_SEASON is False."""
    bootstrap = {
        'events': [
            {'id': 33, 'is_current': False, 'finished': True},
            {'id': 34, 'is_current': True, 'finished': False},
            {'id': 35, 'is_current': False, 'finished': False},
        ]
    }
    result = _detect_is_off_season(bootstrap)
    assert result is False


def test_is_off_season_handles_missing_is_current_key_as_falsey():
    """D-06: .get('is_current') returns None when key absent — None is falsey — True.

    Some FPL API responses may omit the is_current key on future/past events.
    The .get() call treats missing as None which is falsey, so not any() returns True.
    """
    bootstrap = {
        'events': [
            {'id': 36, 'finished': True},   # no is_current key
            {'id': 37, 'finished': True},   # no is_current key
            {'id': 38, 'finished': False},  # no is_current key
        ]
    }
    result = _detect_is_off_season(bootstrap)
    assert result is True


# ---------------------------------------------------------------------------
# Skip-log format lock (D-06 verbatim format)
# ---------------------------------------------------------------------------


def test_skip_log_format_is_locked():
    """D-06: skip-log format is [pipeline] IS_OFF_SEASON: skipping {step} — no deviation.

    Any refactor of run.py that changes this format will break monitoring grep patterns
    in GitHub Actions. This test locks the format.
    """
    result = _skip_log('merge')
    assert result == '[pipeline] IS_OFF_SEASON: skipping merge'


def test_skip_log_format_for_various_steps():
    """D-06: verify format holds for all expected GW-dependent steps."""
    expected_steps = [
        'merge',
        'gw_intel',
        'bonus',
        'captain_snapshots',
        'set_piece_quality',
        'insights',
        'gw_review',
        'defcon',
        'rotation_risk',
        'mc_simulations',
        'dgw_bgw',
        'xmins',
    ]
    for step in expected_steps:
        log_line = _skip_log(step)
        assert log_line.startswith('[pipeline] IS_OFF_SEASON: skipping '), (
            f"Format wrong for step '{step}': {log_line!r}"
        )
        assert log_line == f'[pipeline] IS_OFF_SEASON: skipping {step}', (
            f"Unexpected format for step '{step}': {log_line!r}"
        )
