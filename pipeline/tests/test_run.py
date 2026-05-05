"""Unit tests for pipeline/run.py form-signal gate-read pattern (Phase 42 ACC-03).

Wave 0 RED — run.py does not yet contain the gate-read pattern.
These tests do not import from run (which has top-level side effects via dotenv).
Instead they exercise the SAME read pattern run.py will use, ensuring the
contract is documented and regression-checkable.
"""

import json
import os
import tempfile


def _read_gate(cache_dir: str) -> tuple[bool, float]:
    """Replica of the run.py gate-read pattern. The PRODUCTION code in run.py
    must use this exact shape so this test is a contract test."""
    backtest_path = os.path.join(cache_dir, 'accuracy_backtest.json')
    form_signal_enabled = False
    blend_alpha_used = 0.4
    try:
        with open(backtest_path, 'r', encoding='utf-8') as f:
            prev_backtest = json.load(f)
        form_signal_enabled = prev_backtest.get('summary', {}).get('form_signal_enabled', False)
        blend_alpha_used = prev_backtest.get('summary', {}).get('blend_alpha_used', 0.4)
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    return form_signal_enabled, blend_alpha_used


def _read_xmins_v2_gate(cache_dir: str) -> bool:
    """Replica of the Phase 52 xmins_v2_enabled gate-read in run.py (MIN-01 contract test)."""
    backtest_path = os.path.join(cache_dir, 'accuracy_backtest.json')
    xmins_v2_enabled = False
    try:
        with open(backtest_path, 'r', encoding='utf-8') as f:
            prev_backtest = json.load(f)
        xmins_v2_enabled = prev_backtest.get('summary', {}).get('xmins_v2_enabled', False)
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    return xmins_v2_enabled


def test_form_signal_gate_default_false():
    """ACC-03 / Pattern 5: when accuracy_backtest.json is absent, gate defaults to False."""
    with tempfile.TemporaryDirectory() as tmpdir:
        enabled, alpha = _read_gate(tmpdir)
        assert enabled is False
        assert alpha == 0.4


def test_form_signal_gate_reads_from_previous_run():
    """ACC-03 / Pattern 5: gate is True when prev backtest summary has form_signal_enabled=True."""
    with tempfile.TemporaryDirectory() as tmpdir:
        backtest_path = os.path.join(tmpdir, 'accuracy_backtest.json')
        backtest_data = {
            'generated_at': '2026-04-30T12:00:00Z',
            'gws_covered': [28, 29, 30, 31, 32],
            'summary': {
                'xpts_hit_rate': 0.18,
                'xpts_blended_hit_rate': 0.21,
                'form_signal_enabled': True,
                'blend_alpha_used': 0.4,
            },
            'haulters': [],
            'players': [],
        }
        with open(backtest_path, 'w', encoding='utf-8') as f:
            json.dump(backtest_data, f)

        enabled, alpha = _read_gate(tmpdir)
        assert enabled is True
        assert alpha == 0.4


def test_form_signal_gate_handles_corrupt_json():
    """ACC-03 / Pattern 5: corrupt JSON falls back to (False, 0.4) — does not raise."""
    with tempfile.TemporaryDirectory() as tmpdir:
        backtest_path = os.path.join(tmpdir, 'accuracy_backtest.json')
        with open(backtest_path, 'w', encoding='utf-8') as f:
            f.write('{not valid json')
        enabled, alpha = _read_gate(tmpdir)
        assert enabled is False
        assert alpha == 0.4


def test_run_py_uses_gate_read_pattern():
    """ACC-03: run.py source code contains the gate-read pattern (string-level grep guard).

    This is a defensive check — if a future refactor of run.py forgets to read the
    gate before calling merge_players, this test will catch it.
    """
    run_path = os.path.join(os.path.dirname(__file__), '..', 'run.py')
    with open(run_path, 'r', encoding='utf-8') as f:
        src = f.read()
    assert 'form_signal_enabled' in src, \
        "run.py must read form_signal_enabled from previous accuracy_backtest.json"
    assert 'accuracy_backtest.json' in src, \
        "run.py must reference accuracy_backtest.json (gate-read source)"
    assert 'merge_players(' in src
    # Coarse ordering check: gate-read must occur before merge_players call
    gate_idx = src.find('form_signal_enabled =')
    merge_idx = src.find('merge_players(')
    assert gate_idx != -1 and gate_idx < merge_idx, \
        "Gate must be read BEFORE merge_players is called"


def test_xmins_v2_enabled_defaults_false_when_backtest_missing():
    """Phase 52 MIN-01: missing accuracy_backtest.json -> xmins_v2_enabled = False (no crash)."""
    with tempfile.TemporaryDirectory() as tmpdir:
        flag = _read_xmins_v2_gate(tmpdir)
        assert flag is False


def test_xmins_v2_enabled_reads_true_from_backtest():
    """Phase 52 MIN-01: accuracy_backtest.json with summary.xmins_v2_enabled=True is read as True."""
    with tempfile.TemporaryDirectory() as tmpdir:
        backtest_path = os.path.join(tmpdir, 'accuracy_backtest.json')
        backtest_data = {
            'generated_at': '2026-05-02T12:00:00Z',
            'gws_covered': [28, 29, 30, 31, 32],
            'summary': {
                'xpts_hit_rate': 0.18,
                'xpts_blended_hit_rate': 0.21,
                'form_signal_enabled': False,
                'blend_alpha_used': 0.4,
                'xmins_v2_enabled': True,
            },
            'haulters': [],
            'players': [],
        }
        with open(backtest_path, 'w', encoding='utf-8') as f:
            json.dump(backtest_data, f)

        flag = _read_xmins_v2_gate(tmpdir)
        assert flag is True


def test_xmins_v2_enabled_run_py_source_check():
    """Phase 52 MIN-01: run.py source contains xmins_v2_enabled gate pattern (string-level guard)."""
    run_path = os.path.join(os.path.dirname(__file__), '..', 'run.py')
    with open(run_path, 'r', encoding='utf-8') as f:
        src = f.read()
    assert "xmins_v2_enabled = False" in src, \
        "run.py must declare xmins_v2_enabled default False"
    assert "xmins_v2_enabled = prev_backtest.get('summary', {}).get('xmins_v2_enabled', False)" in src, \
        "run.py must read xmins_v2_enabled from accuracy_backtest.json.summary"
    assert "xmins_v2_enabled=xmins_v2_enabled" in src, \
        "run.py must pass xmins_v2_enabled to merge_players"
    assert "xMins v2" in src, \
        "run.py must print xMins v2 status"


def test_run_invokes_prose():
    """Phase 67 NLP-02: run.py source calls generate_weekly_summary with the correct pattern.

    This is a source-code contract test (same style as the existing gate-read tests above).
    It verifies run.py imports and calls generate_weekly_summary with the required kwargs.
    """
    run_path = os.path.join(os.path.dirname(__file__), '..', 'run.py')
    with open(run_path, 'r', encoding='utf-8') as f:
        src = f.read()

    # Phase 67 NLP-02 must-haves
    assert 'from prose_summary import generate_weekly_summary' in src, \
        "run.py must import generate_weekly_summary from prose_summary"
    assert 'generate_weekly_summary(' in src, \
        "run.py must call generate_weekly_summary()"
    assert "captains=cap_payload" in src, \
        "run.py must pass captains=cap_payload to generate_weekly_summary"
    assert "gems=gem_payload" in src, \
        "run.py must pass gems=gem_payload to generate_weekly_summary"
    assert "player_corpus=corpus" in src, \
        "run.py must pass player_corpus=corpus to generate_weekly_summary"
    assert "gameweek=current_gw" in src, \
        "run.py must pass gameweek=current_gw to generate_weekly_summary"
    assert "save('weekly_summary.json'" in src, \
        "run.py must call save('weekly_summary.json', ...) when summary is not None"

    # Pitfall 8: Claude failure must not poison pipeline — ensure the call is guarded
    assert "[prose_summary] non-fatal error" in src, \
        "run.py prose block must have a non-fatal error handler (Pitfall 8)"

    # Selection logic: top-3 captains exclude GKs (element_type != 1)
    assert "element_type') != 1" in src, \
        "run.py must exclude GKs (element_type != 1) when building captain top-3"

    # Selection logic: gems use ownership < 15.0 threshold
    assert "< 15.0" in src, \
        "run.py must filter gems by selected_by_percent < 15.0"
