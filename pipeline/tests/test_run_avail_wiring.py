"""AVAIL-01: live injury wiring — default ON since the 2026-07 promotion
(exp12 SHIP); AVAIL_ENABLED=false remains the kill-switch."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


def test_avail_enabled_helper_defaults_on(monkeypatch):
    # Promoted default-ON at the 2026-07 system audit (exp12 verdict SHIP).
    monkeypatch.delenv('AVAIL_ENABLED', raising=False)
    import run
    assert run._avail_enabled() is True


def test_avail_enabled_helper_true(monkeypatch):
    monkeypatch.setenv('AVAIL_ENABLED', '1')
    import run
    assert run._avail_enabled() is True


def test_avail_enabled_helper_true_word(monkeypatch):
    monkeypatch.setenv('AVAIL_ENABLED', 'true')
    import run
    assert run._avail_enabled() is True


def test_avail_enabled_helper_yes(monkeypatch):
    monkeypatch.setenv('AVAIL_ENABLED', 'yes')
    import run
    assert run._avail_enabled() is True


def test_avail_enabled_helper_false_string(monkeypatch):
    monkeypatch.setenv('AVAIL_ENABLED', 'false')
    import run
    assert run._avail_enabled() is False


def test_avail_enabled_module_constant_exists():
    """AVAIL-01: AVAIL_ENABLED module-level constant must exist."""
    import run
    assert hasattr(run, 'AVAIL_ENABLED'), "run.py must expose AVAIL_ENABLED at module level"


def test_run_py_avail_block_present():
    """AVAIL-01: run.py source must contain the injury wiring block (structural guard)."""
    run_path = os.path.join(os.path.dirname(__file__), '..', 'run.py')
    with open(run_path, 'r', encoding='utf-8') as f:
        src = f.read()

    assert 'AVAIL_ENABLED' in src, \
        "run.py must define AVAIL_ENABLED"
    assert '_avail_enabled' in src, \
        "run.py must define _avail_enabled() helper"
    assert 'from injury_client import get_live_injuries' in src, \
        "run.py must import get_live_injuries inside the AVAIL block"
    assert 'from injury_join import build_injury_lookup' in src, \
        "run.py must import build_injury_lookup inside the AVAIL block"
    assert 'injury_lookup=injury_lookup' in src, \
        "run.py must pass injury_lookup= to compute_xmins_stats"
    assert 'apifootball_injury' in src, \
        "run.py must attach apifootball_injury for shadow inspection"
    assert 'AVAIL-01' in src, \
        "run.py must contain the AVAIL-01 comment tag"


def test_run_py_logs_injury_mapping_counts():
    """AVAIL-01 observability (2026-08-28): every run must print a definitive
    record/mapped-count line so success is distinguishable from a silent no-op
    (previously only failures logged; a dead key looked like 'no injuries')."""
    run_path = os.path.join(os.path.dirname(__file__), '..', 'run.py')
    with open(run_path, 'r', encoding='utf-8') as f:
        src = f.read()
    assert 'FPL players mapped' in src, \
        "run.py must log injury record -> mapped player counts on success"
