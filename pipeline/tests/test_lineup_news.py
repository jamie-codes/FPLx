"""Regression tests for pipeline/lineup_news.py (Phase 123 Task 04 SCR-02 refactor).

These tests verify that after lineup_news.py is refactored to use player_matching.py
instead of internal difflib-based _build_name_lookup/_match_player functions,
the module still imports cleanly and its compute_lineup_news() behavior is unchanged.

Note: lineup_news.py had no pre-existing test file. These tests were created as part
of the SCR-02 shared utility refactor (Phase 123 Task 04) to guard against regression.
"""

import importlib
import pytest
from unittest.mock import MagicMock, patch


def _import_ln():
    try:
        import lineup_news as ln
        return ln
    except ModuleNotFoundError:
        pytest.fail("lineup_news module not found")


@pytest.fixture
def ln():
    return _import_ln()


# ---------------------------------------------------------------------------
# Import sanity tests
# ---------------------------------------------------------------------------

def test_lineup_news_imports_cleanly(ln):
    """lineup_news.py should import without errors after SCR-02 refactor."""
    assert ln is not None


def test_lineup_news_has_compute_lineup_news(ln):
    """Public compute_lineup_news function should still exist."""
    assert callable(ln.compute_lineup_news)


def test_lineup_news_uses_player_matching_not_internal_build(ln):
    """lineup_news should not define _build_name_lookup or _match_player internally.

    After the SCR-02 refactor, these functions are imported from player_matching.py.
    """
    assert not hasattr(ln, '_build_name_lookup'), (
        "_build_name_lookup should be removed from lineup_news after SCR-02 refactor"
    )
    assert not hasattr(ln, '_match_player'), (
        "_match_player should be removed from lineup_news after SCR-02 refactor"
    )


def test_lineup_news_does_not_import_difflib_for_matching(ln):
    """lineup_news should not use difflib after the player_matching refactor."""
    import sys
    # If difflib is in lineup_news module's globals it was imported at module level
    # The key check: lineup_news's matching path should not go through difflib
    # We verify by checking the module source
    import inspect
    source = inspect.getsource(ln)
    assert 'import difflib' not in source, (
        "lineup_news.py still imports difflib — should have been removed in SCR-02 refactor"
    )


def test_compute_lineup_news_early_returns_on_empty_bootstrap():
    """compute_lineup_news with empty bootstrap should not raise and should skip save."""
    ln = _import_ln()
    with patch('lineup_news.save') as mock_save:
        # Empty bootstrap → no elements → players list empty → SCRP-05 guard → no save
        ln.compute_lineup_news({'elements': [], 'events': []})
        mock_save.assert_not_called()


def test_compute_lineup_news_with_single_element():
    """compute_lineup_news with one element should produce one player entry."""
    ln = _import_ln()
    bootstrap = {
        'elements': [
            {
                'id': 1,
                'web_name': 'Salah',
                'second_name': 'Mohamed Salah',
                'status': 'a',
                'chance_of_playing_next_round': None,
            }
        ],
        'events': [],
    }
    captured_payload = {}
    def mock_save(key, payload):
        captured_payload.update(payload)

    # Feed scrapers will fail (no network in tests) — that is non-fatal
    with patch('lineup_news.save', side_effect=mock_save):
        with patch('lineup_news.feedparser.parse') as mock_parse:
            mock_parse.return_value = MagicMock(entries=[])
            with patch('lineup_news.requests.get') as mock_get:
                mock_resp = MagicMock()
                mock_resp.raise_for_status.return_value = None
                mock_resp.text = '<html></html>'
                mock_get.return_value = mock_resp
                ln.compute_lineup_news(bootstrap)

    # Should have called save with one player
    assert 'players' in captured_payload, "payload should have 'players' key"
    assert len(captured_payload['players']) == 1
    player = captured_payload['players'][0]
    assert player['id'] == 1
    assert player['availability_factor'] == 1.0  # status='a' → confirmed_start
    assert player['status_label'] == 'confirmed_start'
