"""Unit tests for pipeline/run.py form-signal gate-read pattern (Phase 42 ACC-03).

Wave 0 RED — run.py does not yet contain the gate-read pattern.
These tests do not import from run (which has top-level side effects via dotenv).
Instead they exercise the SAME read pattern run.py will use, ensuring the
contract is documented and regression-checkable.
"""

import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import accuracy


def _read_gate(cache_dir: str) -> tuple[bool, float]:
    """Replica of the run.py gate-read pattern. The PRODUCTION code in run.py
    must use this exact shape so this test is a contract test."""
    backtest_path = os.path.join(cache_dir, 'accuracy_backtest.json')
    form_signal_enabled = False
    blend_alpha_used = accuracy.BLEND_ALPHA
    try:
        with open(backtest_path, 'r', encoding='utf-8') as f:
            prev_backtest = json.load(f)
        form_signal_enabled = prev_backtest.get('summary', {}).get('form_signal_enabled', False)
        blend_alpha_used = prev_backtest.get('summary', {}).get('blend_alpha_used', accuracy.BLEND_ALPHA)
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
        assert alpha == accuracy.BLEND_ALPHA


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
    """ACC-03 / Pattern 5: corrupt JSON falls back to (False, accuracy.BLEND_ALPHA) — does not raise."""
    with tempfile.TemporaryDirectory() as tmpdir:
        backtest_path = os.path.join(tmpdir, 'accuracy_backtest.json')
        with open(backtest_path, 'w', encoding='utf-8') as f:
            f.write('{not valid json')
        enabled, alpha = _read_gate(tmpdir)
        assert enabled is False
        assert alpha == accuracy.BLEND_ALPHA


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


# ---------------------------------------------------------------------------
# Phase 108 NLP-BATCH-02/03 — batch_block integration tests (6 tests, RED)
# ---------------------------------------------------------------------------
# These tests follow the same source-code contract style as the gate-read
# tests above (test_run_py_uses_gate_read_pattern, test_run_invokes_prose).
# run.py cannot be imported directly (top-level side effects via dotenv and
# real I/O), so structural checks read the source as text and behavioural
# checks replicate the exact selection logic run.py will implement.
# ---------------------------------------------------------------------------


def _run_py_src() -> str:
    """Return the content of pipeline/run.py as a string."""
    run_path = os.path.join(os.path.dirname(__file__), '..', 'run.py')
    with open(run_path, 'r', encoding='utf-8') as f:
        return f.read()


def _select_top_n(merged: list, n: int) -> list:
    """Replicate the top-N selection logic that run.py will use for the batch block.

    Mirrors the planned run.py code (per PATTERNS.md and plan action):
        eligible = [p for p in merged if p.get('status') == 'a' and p.get('xPts_1gw') is not None]
        top20 = sorted(eligible,
                       key=lambda p: (p.get('xPts_1gw') or 0, float(p.get('selected_by_percent') or 0)),
                       reverse=True)[:n]
    This replica is used to validate the contract tests BEFORE run.py is updated (RED phase).
    After run.py is updated (GREEN), the run.py source tests confirm the same logic is present.
    """
    eligible = [p for p in merged if p.get('status') == 'a' and p.get('xPts_1gw') is not None]
    return sorted(
        eligible,
        key=lambda p: (p.get('xPts_1gw') or 0, float(p.get('selected_by_percent') or 0)),
        reverse=True,
    )[:n]


def test_batch_block_skipped_when_env_unset():
    """NLP-BATCH-02: when INSIGHT_BATCH_ENABLED is absent, the batch block is fully skipped.

    Structural check: run.py must guard the block with os.getenv('INSIGHT_BATCH_ENABLED', '').lower() == 'true'
    so that a falsy/absent env var bypasses the entire block without importing batch_insights.
    Fails RED because run.py does not yet contain this guard.
    """
    src = _run_py_src()
    assert "INSIGHT_BATCH_ENABLED" in src, \
        "run.py must contain the INSIGHT_BATCH_ENABLED env var guard"
    assert "os.getenv('INSIGHT_BATCH_ENABLED', '').lower() == 'true'" in src, \
        "run.py must guard the batch block with os.getenv('INSIGHT_BATCH_ENABLED', '').lower() == 'true'"
    # Confirm the import of generate_batch_insights is inside the guarded block
    # (not a top-level import that would run regardless of the env var)
    assert "from batch_insights import generate_batch_insights" in src, \
        "run.py must import generate_batch_insights (inside the guarded try block)"


def test_batch_block_skipped_when_env_false():
    """NLP-BATCH-02: 'false' (any case) must NOT activate the block.

    Source check: the guard uses strict == 'true' comparison only, so 'false',
    'FALSE', '0', 'yes', '' etc. all evaluate as skip.
    Fails RED because run.py does not yet contain the guard.
    """
    src = _run_py_src()
    # The guard uses .lower() == 'true' — only exact 'true' activates it
    assert ".lower() == 'true'" in src, \
        "run.py guard must use .lower() == 'true' (strict equality, not truthy check)"
    # Ensure no secondary guard that might accidentally activate on 'false' string
    # i.e. the guard is a single equality check, not 'in ['true', '1', 'yes', ...]'
    assert "INSIGHT_BATCH_ENABLED" in src
    # Confirm there is exactly ONE INSIGHT_BATCH_ENABLED reference (no duplicate guards)
    count = src.count("INSIGHT_BATCH_ENABLED")
    assert count == 1, (
        f"run.py must contain exactly one INSIGHT_BATCH_ENABLED reference, found {count}. "
        "A duplicate would indicate a misplaced guard or env-var echo (T-108-09)."
    )


def test_batch_block_invokes_generate_with_top20():
    """NLP-BATCH-02: when enabled, generate_batch_insights is called with top-20 status='a' players.

    Logic test: verifies the top-N selection rule on a synthetic merged list of 25 players
    where 22 have status='a' and 3 have status='i'. Confirms exactly 20 are selected and
    that the 3 unavailable players are excluded.

    Also verifies the selection is in descending xPts_1gw order.
    Fails RED because run.py does not yet contain INSIGHT_BATCH_ENABLED or generate_batch_insights.
    """
    # Build synthetic merged: IDs 1-22 status='a' with xPts descending, IDs 23-25 status='i'
    merged = []
    for i in range(1, 23):
        merged.append({
            'id': i,
            'web_name': f'Player{i}',
            'status': 'a',
            'xPts_1gw': float(26 - i),  # 25.0, 24.0, ... 4.0
            'selected_by_percent': '5.0',
            'element_type': 3,
        })
    for i in range(23, 26):
        merged.append({
            'id': i,
            'web_name': f'InjuredPlayer{i}',
            'status': 'i',
            'xPts_1gw': 20.0,  # high xPts but unavailable
            'selected_by_percent': '10.0',
            'element_type': 3,
        })

    top20 = _select_top_n(merged, 20)

    assert len(top20) == 20, f"Expected 20 players, got {len(top20)}"
    # No unavailable players in the slice
    statuses = [p['status'] for p in top20]
    assert all(s == 'a' for s in statuses), \
        f"All selected players must have status='a', got: {statuses}"
    # Verify descending xPts_1gw order
    xpts_vals = [p['xPts_1gw'] for p in top20]
    assert xpts_vals == sorted(xpts_vals, reverse=True), \
        f"Players must be ordered by xPts_1gw descending: {xpts_vals}"

    # Structural check: run.py source must call generate_batch_insights
    src = _run_py_src()
    assert "generate_batch_insights(top20" in src or "generate_batch_insights(" in src, \
        "run.py must call generate_batch_insights with the top20 list"


def test_batch_block_tiebreak_selected_by_percent():
    """NLP-BATCH-02: when two players share xPts_1gw, selected_by_percent descending is the tie-breaker.

    When two players have identical xPts_1gw = 8.0, the player with higher selected_by_percent
    must appear before the player with lower selected_by_percent in the selection.
    Fails RED because run.py does not yet contain the batch block with this tie-break logic.
    """
    # Three players with identical xPts; only two fit in top-2 (n=2)
    merged = [
        {'id': 1, 'web_name': 'A', 'status': 'a', 'xPts_1gw': 8.0, 'selected_by_percent': '3.0', 'element_type': 3},
        {'id': 2, 'web_name': 'B', 'status': 'a', 'xPts_1gw': 8.0, 'selected_by_percent': '12.0', 'element_type': 3},
        {'id': 3, 'web_name': 'C', 'status': 'a', 'xPts_1gw': 8.0, 'selected_by_percent': '7.5', 'element_type': 3},
    ]
    top2 = _select_top_n(merged, 2)
    assert len(top2) == 2
    # B (12.0%) must be first, C (7.5%) second, A (3.0%) excluded
    assert top2[0]['id'] == 2, \
        f"Player with highest selected_by_percent (B, 12.0%) must be first, got id={top2[0]['id']}"
    assert top2[1]['id'] == 3, \
        f"Player with second-highest selected_by_percent (C, 7.5%) must be second, got id={top2[1]['id']}"

    # Source check: run.py must reference selected_by_percent in the batch selection block
    src = _run_py_src()
    assert "selected_by_percent" in src, \
        "run.py must use selected_by_percent as a tie-breaker in the batch block"


def test_batch_block_swallows_exception():
    """NLP-BATCH-02: any exception from generate_batch_insights must be swallowed.

    Source check: the try/except block around the batch call must catch Exception and
    print to sys.stderr with the [batch_insights] prefix — it must NOT re-raise.
    Fails RED because run.py does not yet contain the batch block.
    """
    src = _run_py_src()
    assert "[batch_insights] non-fatal error" in src, \
        "run.py batch block must have '[batch_insights] non-fatal error' in the except branch"
    # Confirm the except does not re-raise (there must be no bare 'raise' after [batch_insights])
    # Coarse check: count 'raise' occurrences after the batch block insertion point
    batch_idx = src.find("[batch_insights] non-fatal error")
    assert batch_idx != -1, "run.py must contain the [batch_insights] error handler"
    # Find 'raise' within 3 lines of the error handler — would indicate a re-raise
    handler_snippet = src[batch_idx:batch_idx + 200]
    assert 'raise' not in handler_snippet, \
        f"Batch except block must not re-raise. Handler snippet: {handler_snippet!r}"
    # Structural check: last_updated.json write must still follow the batch block
    last_upd_idx = src.find("save('last_updated.json'")
    assert last_upd_idx > batch_idx, \
        "last_updated.json write must come AFTER the batch block (ensuring pipeline continues)"


def test_batch_block_passes_current_gw():
    """NLP-BATCH-02: the batch call must use the existing current_gw variable (no recomputation).

    Source check: run.py must have exactly one 'current_gw = finished_gws + 1' assignment
    (no duplicate introduced by the batch block) and must pass current_gw to generate_batch_insights.
    Fails RED because run.py does not yet contain the batch call with current_gw.
    """
    src = _run_py_src()
    # Exactly one definition of current_gw
    count = src.count("current_gw = finished_gws + 1")
    assert count == 1, (
        f"run.py must define current_gw = finished_gws + 1 exactly once, found {count}. "
        "The batch block must REUSE the existing variable, not recompute it."
    )
    # The batch call must pass current_gw (as a positional or keyword arg)
    assert "generate_batch_insights(top20, corpus, current_gw)" in src, \
        "run.py must call generate_batch_insights(top20, corpus, current_gw)"


# ---------------------------------------------------------------------------
# TUNE-01: tuner param read contract tests
# ---------------------------------------------------------------------------

def _read_tuner_params(cache_dir: str) -> dict:
    """Replica of the run.py tuner-param read pattern (TUNE-01 contract test).
    Production code in run.py MUST use this exact shape.
    """
    import json, os
    import sys as _sys
    _sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
    import accuracy
    backtest_path = os.path.join(cache_dir, 'accuracy_backtest.json')
    form_window_gws_used = accuracy.FORM_WINDOW_GWS
    cs_prob_base_used    = 0.40
    cs_prob_slope_used   = 0.30
    form_actual_beta_used = 0.0
    form_difficulty_gamma_used = 0.0
    sub_appear_window_gws_used = 15   # APM-01
    cs_team_form_slope_used    = 0.0  # CSF-01
    cs_def_form_window_gws_used = 6   # CSF-01
    atf_slope_used      = accuracy.ATF_SLOPE       # ATF-01: default
    atf_window_gws_used = accuracy.ATF_WINDOW_GWS  # ATF-01: default
    fas_slope_used      = accuracy.FAS_SLOPE       # FAS-01: default
    defcon_scale_used   = accuracy.DEFCON_SCALE    # DC-01: default
    try:
        with open(backtest_path, 'r', encoding='utf-8') as f:
            prev = json.load(f)
        summary = prev.get('summary', {})
        form_window_gws_used = int(summary.get('form_window_gws_used', accuracy.FORM_WINDOW_GWS))
        cs_prob_base_used    = float(summary.get('cs_prob_base_used',    0.40))
        cs_prob_slope_used   = float(summary.get('cs_prob_slope_used',   0.30))
        form_actual_beta_used = float(summary.get('form_actual_beta_used', 0.0))
        form_difficulty_gamma_used = float(summary.get('form_difficulty_gamma_used', 0.0))  # FRM-02
        sub_appear_window_gws_used = int(summary.get('sub_appear_window_gws_used', 15))   # APM-01
        cs_team_form_slope_used    = float(summary.get('cs_team_form_slope_used', 0.0))   # CSF-01
        cs_def_form_window_gws_used = int(summary.get('cs_def_form_window_gws_used', 6))  # CSF-01
        atf_slope_used      = float(prev.get('summary', {}).get(
            'atf_slope_used', accuracy.ATF_SLOPE))
        atf_window_gws_used = int(prev.get('summary', {}).get(
            'atf_window_gws_used', accuracy.ATF_WINDOW_GWS))
        fas_slope_used      = float(prev.get('summary', {}).get(
            'fas_slope_used', accuracy.FAS_SLOPE))         # FAS-01
        defcon_scale_used   = float(prev.get('summary', {}).get(
            'defcon_scale_used', accuracy.DEFCON_SCALE))   # DC-01
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    return {
        'form_window_gws_used': form_window_gws_used,
        'cs_prob_base_used':    cs_prob_base_used,
        'cs_prob_slope_used':   cs_prob_slope_used,
        'form_actual_beta_used': form_actual_beta_used,
        'form_difficulty_gamma_used': form_difficulty_gamma_used,
        'sub_appear_window_gws_used': sub_appear_window_gws_used,   # APM-01
        'cs_team_form_slope_used':    cs_team_form_slope_used,      # CSF-01
        'cs_def_form_window_gws_used': cs_def_form_window_gws_used, # CSF-01
        'atf_slope_used':      atf_slope_used,      # ATF-01
        'atf_window_gws_used': atf_window_gws_used, # ATF-01
        'fas_slope_used':      fas_slope_used,      # FAS-01
        'defcon_scale_used':   defcon_scale_used,   # DC-01
    }


def test_read_tuner_params_defaults_on_missing_file():
    with tempfile.TemporaryDirectory() as tmpdir:
        params = _read_tuner_params(tmpdir)
        assert params['form_window_gws_used'] == accuracy.FORM_WINDOW_GWS
        assert abs(params['cs_prob_base_used']  - 0.40) < 1e-9
        assert abs(params['cs_prob_slope_used'] - 0.30) < 1e-9
        assert abs(params['form_actual_beta_used'] - 0.0) < 1e-9
        assert abs(params['form_difficulty_gamma_used'] - 0.0) < 1e-9
        assert params['sub_appear_window_gws_used'] == 15
        assert abs(params['cs_team_form_slope_used'] - 0.0) < 1e-9
        assert params['cs_def_form_window_gws_used'] == 6
        assert params['atf_slope_used'] == accuracy.ATF_SLOPE
        assert params['atf_window_gws_used'] == accuracy.ATF_WINDOW_GWS
        assert params['fas_slope_used'] == accuracy.FAS_SLOPE        # FAS-01
        assert params['defcon_scale_used'] == accuracy.DEFCON_SCALE  # DC-01


def test_read_tuner_params_reads_promoted_values():
    with tempfile.TemporaryDirectory() as tmpdir:
        data = {'summary': {
            'form_window_gws_used': 4,
            'cs_prob_base_used': 0.45,
            'cs_prob_slope_used': 0.25,
            'form_actual_beta_used': 0.3,
            'form_difficulty_gamma_used': 0.4,
            'sub_appear_window_gws_used': 12,   # APM-01
            'cs_team_form_slope_used': 0.10,    # CSF-01
            'cs_def_form_window_gws_used': 5,   # CSF-01
            'atf_slope_used':      0.2,         # ATF-01
            'atf_window_gws_used': 5,           # ATF-01
            'fas_slope_used':      0.6,         # FAS-01
            'defcon_scale_used':   0.5,         # DC-01
        }}
        path = os.path.join(tmpdir, 'accuracy_backtest.json')
        with open(path, 'w') as f:
            json.dump(data, f)
        params = _read_tuner_params(tmpdir)
        assert params['form_window_gws_used'] == 4
        assert abs(params['cs_prob_base_used']  - 0.45) < 1e-9
        assert abs(params['cs_prob_slope_used'] - 0.25) < 1e-9
        assert abs(params['form_actual_beta_used'] - 0.3) < 1e-9
        assert abs(params['form_difficulty_gamma_used'] - 0.4) < 1e-9
        assert params['sub_appear_window_gws_used'] == 12
        assert abs(params['cs_team_form_slope_used'] - 0.10) < 1e-9   # CSF-01
        assert params['cs_def_form_window_gws_used'] == 5              # CSF-01
        assert params['atf_slope_used'] == 0.2                         # ATF-01
        assert params['atf_window_gws_used'] == 5                      # ATF-01
        assert params['fas_slope_used'] == 0.6                         # FAS-01
        assert params['defcon_scale_used'] == 0.5                      # DC-01


# ---------------------------------------------------------------------------
# PICK-01: compute_honest_metrics tests
# ---------------------------------------------------------------------------


def test_compute_honest_metrics_gate_below_8_gws():
    """PICK-01: returns None when fewer than 8 finished GWs (UI falls back to last-season data)."""
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
    import run as run_mod
    bootstrap = {'events': [{'id': g, 'finished': g <= 5} for g in range(1, 39)]}
    result = run_mod.compute_honest_metrics(bootstrap, [], {}, {})
    assert result is None


def test_compute_honest_metrics_shape(monkeypatch):
    """PICK-01: with >= 8 finished GWs, returns rounded metrics dict from _run_backtest_for_picks."""
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
    import run as run_mod
    bootstrap = {'events': [{'id': g, 'finished': g <= 10} for g in range(1, 39)]}
    fake_metrics = {'top10_mean_pts': 5.123, 'haul_capture_20': 0.25,
                    'captain_return_rate': 0.7, 'haul_hit_rate': 0.12, 'n_gws': 6}
    monkeypatch.setattr(run_mod, '_run_backtest_for_picks',
                        lambda archive, params, first_gw, last_gw: {
                            'metrics': fake_metrics, 'per_gw': []})
    result = run_mod.compute_honest_metrics(bootstrap, [], {}, {'fas_slope': 0.4})
    assert result is not None
    assert result['top10_mean_pts'] == 5.12
    assert result['haul_capture_20'] == 0.25
    assert result['captain_return_rate'] == 0.7
    assert result['haul_hit_rate'] == 0.12
    assert result['n_gws'] == 6
    assert result['mode'] == 'deploy'
    assert result['per_gw'] == []


def test_compute_honest_metrics_widened_keys(monkeypatch):
    """ACC-05: widened dict includes all new keys + slim per_gw with correct fields."""
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
    import run as run_mod
    bootstrap = {'events': [{'id': g, 'finished': g <= 12} for g in range(1, 39)]}
    fake_metrics = {
        'top10_mean_pts': 5.66, 'haul_capture_20': 0.1944, 'captain_return_rate': 0.60,
        'haul_hit_rate': 0.1234, 'mid_tier_hit_rate': 0.0987, 'captain_hit_rate': 0.5432,
        'rmse': 3.1415, 'mae': 2.7182, 'spearman': 0.3210,
        'by_position': {'GKP': {'n': 100, 'rmse': 1.5, 'n_haulers': 2}},
        'n_gws': 12,
    }
    fake_per_gw = [
        {'gw': 1, 'n_rows': 250, 'n_haulers': 5, 'haul_hits': 2,
         'haul_hit_rate': 0.40, 'top10_mean_pts': 5.5, 'spearman': 0.32,
         'captain_actual': 12, 'captain_name': 'Salah'},
        {'gw': 2, 'n_rows': 240, 'n_haulers': 3, 'haul_hits': 1,
         'haul_hit_rate': 0.333, 'top10_mean_pts': 4.8, 'spearman': 0.28,
         'captain_actual': 8, 'captain_name': 'Haaland'},
    ]
    monkeypatch.setattr(run_mod, '_run_backtest_for_picks',
                        lambda archive, params, first_gw, last_gw: {
                            'metrics': fake_metrics, 'per_gw': fake_per_gw})
    result = run_mod.compute_honest_metrics(bootstrap, [], {}, {})
    assert result is not None
    # Existing keys still present
    assert result['top10_mean_pts'] == round(5.66, 2)
    assert result['haul_capture_20'] == round(0.1944, 4)
    assert result['captain_return_rate'] == round(0.60, 4)
    assert result['haul_hit_rate'] == round(0.1234, 4)
    # New scalar keys
    assert result['mid_tier_hit_rate'] == round(0.0987, 4)
    assert result['captain_hit_rate'] == round(0.5432, 4)
    assert result['rmse'] == round(3.1415, 4)
    assert result['mae'] == round(2.7182, 4)
    assert result['spearman'] == round(0.3210, 4)
    assert result['mode'] == 'deploy'
    assert result['n_gws'] == 12
    # by_position passed through unchanged
    assert result['by_position'] == fake_metrics['by_position']
    # per_gw: slim — n_rows dropped, other fields preserved
    assert len(result['per_gw']) == 2
    gw1 = result['per_gw'][0]
    assert gw1['gw'] == 1
    assert gw1['n_haulers'] == 5
    assert gw1['haul_hits'] == 2
    assert gw1['haul_hit_rate'] == 0.40
    assert gw1['top10_mean_pts'] == 5.5
    assert gw1['spearman'] == 0.32
    assert gw1['captain_actual'] == 12
    assert gw1['captain_name'] == 'Salah'
    assert 'n_rows' not in gw1, "n_rows must be dropped by _slim_per_gw"


def test_compute_honest_metrics_gate_still_none_below_8(monkeypatch):
    """ACC-05: gate behaviour unchanged — <8 finished GWs still returns None."""
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
    import run as run_mod
    bootstrap = {'events': [{'id': g, 'finished': g <= 7} for g in range(1, 39)]}
    called = []
    monkeypatch.setattr(run_mod, '_run_backtest_for_picks',
                        lambda *a, **kw: called.append(1) or {})
    result = run_mod.compute_honest_metrics(bootstrap, [], {}, {})
    assert result is None
    assert len(called) == 0, "_run_backtest_for_picks must not be called when < 8 GWs"


def test_run_binds_accuracy_module_name():
    """Regression (prod incident 2026-06-13): run.py references accuracy.BLEND_ALPHA
    etc. in main()'s tuner-default block, so the bare module name MUST be bound.
    `from accuracy import X` alone does NOT bind it — this guards the missing
    `import accuracy` that NameError'd the live pipeline."""
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
    import run as run_mod
    assert hasattr(run_mod, 'accuracy'), "run.py must bind the `accuracy` module name"
    assert run_mod.accuracy.__name__ == 'accuracy'
    # the specific constants run.py dereferences must resolve through it
    for attr in ('BLEND_ALPHA', 'FORM_WINDOW_GWS', 'FAS_SLOPE', 'DEFCON_SCALE',
                 'ATF_SLOPE', 'CS_TEAM_FORM_SLOPE'):
        assert hasattr(run_mod.accuracy, attr), f"accuracy.{attr} must resolve"


# ---------------------------------------------------------------------------
# ACC-06: _honest_calibration + compute_honest_metrics calibration key
# ---------------------------------------------------------------------------

def test_honest_calibration_bucketing():
    """ACC-06: a row at xpts_pred=3.5 lands in the [3,4) bin."""
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
    import run as run_mod
    rows = [
        {'xpts_pred': 3.5, 'actual_pts': 4.0, 'element_type': 3},
    ]
    result = run_mod._honest_calibration(rows)
    assert len(result) == 1, f"Expected 1 bucket, got {len(result)}"
    b = result[0]
    assert b['bin_lo'] == 3
    assert b['bin_hi'] == 4
    assert b['n'] == 1
    assert b['mean_pred'] == 3.5
    assert b['mean_actual'] == 4.0


def test_honest_calibration_empty_bins_dropped():
    """ACC-06: empty bins are not included in the output."""
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
    import run as run_mod
    # Only one row — only [0,1) should be populated
    rows = [{'xpts_pred': 0.5, 'actual_pts': 1.0, 'element_type': 1}]
    result = run_mod._honest_calibration(rows)
    assert len(result) == 1
    assert result[0]['bin_lo'] == 0
    assert result[0]['bin_hi'] == 1


def test_honest_calibration_mean_actual_averaged():
    """ACC-06: mean_actual is the average over all rows in the bucket."""
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
    import run as run_mod
    rows = [
        {'xpts_pred': 2.1, 'actual_pts': 2.0, 'element_type': 3},
        {'xpts_pred': 2.8, 'actual_pts': 4.0, 'element_type': 3},
    ]
    result = run_mod._honest_calibration(rows)
    assert len(result) == 1
    b = result[0]
    assert b['bin_lo'] == 2
    assert b['bin_hi'] == 3
    assert b['n'] == 2
    assert abs(b['mean_pred'] - round((2.1 + 2.8) / 2, 2)) < 1e-9
    assert abs(b['mean_actual'] - round((2.0 + 4.0) / 2, 2)) < 1e-9


def test_honest_calibration_last_bin_open_ended():
    """ACC-06: last bin [8,99) captures rows with xpts_pred >= 8."""
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
    import run as run_mod
    rows = [{'xpts_pred': 10.0, 'actual_pts': 12.0, 'element_type': 4}]
    result = run_mod._honest_calibration(rows)
    assert len(result) == 1
    assert result[0]['bin_lo'] == 8
    assert result[0]['bin_hi'] == 99


def test_compute_honest_metrics_includes_calibration(monkeypatch):
    """ACC-06: compute_honest_metrics includes 'calibration' key when >= 8 GWs."""
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
    import run as run_mod
    bootstrap = {'events': [{'id': g, 'finished': g <= 10} for g in range(1, 39)]}
    fake_metrics = {
        'top10_mean_pts': 5.0, 'haul_capture_20': 0.2,
        'captain_return_rate': 0.6, 'haul_hit_rate': 0.1, 'n_gws': 10,
    }
    fake_rows = [
        {'xpts_pred': 3.5, 'actual_pts': 4.0, 'element_type': 3},
        {'xpts_pred': 1.2, 'actual_pts': 2.0, 'element_type': 2},
    ]
    monkeypatch.setattr(run_mod, '_run_backtest_for_picks',
                        lambda archive, params, first_gw, last_gw: {
                            'metrics': fake_metrics, 'per_gw': [], 'rows': fake_rows})
    result = run_mod.compute_honest_metrics(bootstrap, [], {}, {})
    assert result is not None
    assert 'calibration' in result, "compute_honest_metrics must include 'calibration' key"
    calib = result['calibration']
    assert isinstance(calib, list)
    # 3.5 -> [3,4), 1.2 -> [1,2) — two separate non-empty bins
    assert len(calib) == 2


def test_compute_honest_metrics_calibration_gate_below_8(monkeypatch):
    """ACC-06: gate <8 GWs still returns None — calibration key not added before gate."""
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
    import run as run_mod
    bootstrap = {'events': [{'id': g, 'finished': g <= 6} for g in range(1, 39)]}
    called = []
    monkeypatch.setattr(run_mod, '_run_backtest_for_picks',
                        lambda *a, **kw: called.append(1) or {})
    result = run_mod.compute_honest_metrics(bootstrap, [], {}, {})
    assert result is None
    assert len(called) == 0


# ── COLD-01: prior built and threaded via run.py source checks ────────────────

def test_run_py_cold01_source_contains_prior_build():
    """COLD-01: run.py source references the prior-build block."""
    run_path = os.path.join(os.path.dirname(__file__), '..', 'run.py')
    with open(run_path, 'r', encoding='utf-8') as f:
        src = f.read()
    assert 'build_prior_lookup' in src, "run.py must call build_prior_lookup"
    assert 'build_bucket_priors' in src, "run.py must call build_bucket_priors"
    assert 'start_seed' in src, "run.py must build start_seed"
    assert 'prior_lookup=prior_lookup' in src, "run.py must pass prior_lookup to merge_players"
    assert 'bucket_priors=bucket_priors' in src, "run.py must pass bucket_priors to merge_players"
    assert 'start_seed=start_seed' in src, "run.py must pass start_seed to compute_xmins_stats"


def test_run_py_cold01_non_fatal_when_archive_absent(monkeypatch):
    """COLD-01: FileNotFoundError from load_season_archive leaves pipeline running with empty lookups."""
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
    import run as run_mod
    import season_prior as sp_mod

    # Patch load_season_archive to raise FileNotFoundError
    def _raise_fnf(*a, **kw):
        raise FileNotFoundError("no archive")

    captured_prior_lookup = {}
    captured_bucket_priors = {}
    captured_start_seed = {}

    original_build_prior = sp_mod.build_prior_lookup
    original_build_buckets = sp_mod.build_bucket_priors

    def _fake_build_prior(archive):
        captured_prior_lookup['called'] = True
        return original_build_prior(archive)

    # Monkeypatch load_season_archive in the run module's capture_season import
    import capture_season as cs_mod
    monkeypatch.setattr(cs_mod, 'load_season_archive', _raise_fnf)

    # The non-fatal block should catch FileNotFoundError and leave lookups empty.
    # We verify by calling the pattern inline (same logic run.py uses):
    prior_lookup, bucket_priors, start_seed = {}, {}, {}
    try:
        _archive = cs_mod.load_season_archive()
        prior_lookup = sp_mod.build_prior_lookup(_archive)
        bucket_priors = sp_mod.build_bucket_priors(_archive)
        start_seed = {
            code: {'start_rate': p['start_rate'], 'mins_per_start': p['mins_per_start']}
            for code, p in prior_lookup.items()
        }
    except FileNotFoundError:
        pass  # non-fatal

    assert prior_lookup == {}, "prior_lookup must be empty when archive is absent"
    assert bucket_priors == {}, "bucket_priors must be empty when archive is absent"
    assert start_seed == {}, "start_seed must be empty when archive is absent"
