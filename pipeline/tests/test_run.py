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
    backtest_path = os.path.join(cache_dir, 'accuracy_backtest.json')
    form_window_gws_used = 5
    cs_prob_base_used    = 0.40
    cs_prob_slope_used   = 0.30
    try:
        with open(backtest_path, 'r', encoding='utf-8') as f:
            prev = json.load(f)
        summary = prev.get('summary', {})
        form_window_gws_used = int(summary.get('form_window_gws_used', 5))
        cs_prob_base_used    = float(summary.get('cs_prob_base_used',    0.40))
        cs_prob_slope_used   = float(summary.get('cs_prob_slope_used',   0.30))
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    return {
        'form_window_gws_used': form_window_gws_used,
        'cs_prob_base_used':    cs_prob_base_used,
        'cs_prob_slope_used':   cs_prob_slope_used,
    }


def test_read_tuner_params_defaults_on_missing_file():
    with tempfile.TemporaryDirectory() as tmpdir:
        params = _read_tuner_params(tmpdir)
        assert params['form_window_gws_used'] == 5
        assert abs(params['cs_prob_base_used']  - 0.40) < 1e-9
        assert abs(params['cs_prob_slope_used'] - 0.30) < 1e-9


def test_read_tuner_params_reads_promoted_values():
    with tempfile.TemporaryDirectory() as tmpdir:
        data = {'summary': {
            'form_window_gws_used': 4,
            'cs_prob_base_used': 0.45,
            'cs_prob_slope_used': 0.25,
        }}
        path = os.path.join(tmpdir, 'accuracy_backtest.json')
        with open(path, 'w') as f:
            json.dump(data, f)
        params = _read_tuner_params(tmpdir)
        assert params['form_window_gws_used'] == 4
        assert abs(params['cs_prob_base_used']  - 0.45) < 1e-9
        assert abs(params['cs_prob_slope_used'] - 0.25) < 1e-9
