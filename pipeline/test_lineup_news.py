"""Tests for pipeline/lineup_news.py — Phase 117 SCRP-01..SCRP-06.

TDD RED phase: written BEFORE lineup_news.py exists.
All tests must fail initially with ModuleNotFoundError: No module named 'lineup_news'.
"""

import importlib
import os
import sys
from unittest.mock import patch, MagicMock

import pytest

# ---------------------------------------------------------------------------
# Mock bootstrap fixture — one dict per D-08/D-09/D-10 mapping row
# ---------------------------------------------------------------------------

MOCK_BOOTSTRAP = {
    'elements': [
        # D-09: chance_of_playing wins over status='a' (75 → 0.75, doubted)
        {'id': 308, 'web_name': 'Salah',    'second_name': 'Salah',    'status': 'a', 'chance_of_playing_next_round': 75},
        # status 'i' + null chance → 0.0, confirmed_absent
        {'id': 1,   'web_name': 'Raya',     'second_name': 'Raya',     'status': 'i', 'chance_of_playing_next_round': None},
        # status 'a' + null chance → 1.0, confirmed_start
        {'id': 2,   'web_name': 'Foden',    'second_name': 'Foden',    'status': 'a', 'chance_of_playing_next_round': None},
        # chance == 100 → 1.0, confirmed_start (Pitfall 4)
        {'id': 3,   'web_name': 'Haaland',  'second_name': 'Haaland',  'status': 'a', 'chance_of_playing_next_round': 100},
        # status 'd' + null chance → 0.5, doubted
        {'id': 4,   'web_name': 'Watkins',  'second_name': 'Watkins',  'status': 'd', 'chance_of_playing_next_round': None},
        # status 's' + null chance → 0.0, confirmed_absent
        {'id': 5,   'web_name': 'Toney',    'second_name': 'Toney',    'status': 's', 'chance_of_playing_next_round': None},
        # unknown status + null chance → None, 'unknown' (D-10)
        {'id': 6,   'web_name': 'Mystery',  'second_name': 'Mystery',  'status': 'x', 'chance_of_playing_next_round': None},
        # chance == 25 → 0.25, doubted
        {'id': 7,   'web_name': 'Doubted50','second_name': 'Doubted50','status': 'a', 'chance_of_playing_next_round': 25},
    ]
}

EMPTY_BOOTSTRAP = {'elements': []}


# ---------------------------------------------------------------------------
# Helper: get compute_lineup_news from a freshly reloaded module
# ---------------------------------------------------------------------------

def _get_compute_lineup_news():
    """Import (or reload) lineup_news and return the public function."""
    if 'lineup_news' in sys.modules:
        import lineup_news as ln
        importlib.reload(ln)
    else:
        import lineup_news as ln
    return ln.compute_lineup_news


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_fpl_availability_mapping(monkeypatch):
    """SCRP-01/D-08: Verify availability_factor and status_label for all D-08 rows."""
    compute_lineup_news = _get_compute_lineup_news()
    with patch('lineup_news.save') as mock_save, \
         patch('lineup_news.feedparser') as mock_fp, \
         patch('lineup_news.requests') as mock_req:
        # Prevent any real network activity
        mock_fp.parse.return_value = MagicMock(entries=[])
        mock_req.get.side_effect = RuntimeError("no network in tests")

        compute_lineup_news(MOCK_BOOTSTRAP)

    assert mock_save.called, "save() must be called when players list is non-empty"
    payload = mock_save.call_args[0][1]
    players_by_id = {p['id']: p for p in payload['players']}

    # id=2: status 'a', null chance → 1.0 / confirmed_start
    assert players_by_id[2]['availability_factor'] == 1.0
    assert players_by_id[2]['status_label'] == 'confirmed_start'

    # id=4: status 'd', null chance → 0.5 / doubted
    assert players_by_id[4]['availability_factor'] == 0.5
    assert players_by_id[4]['status_label'] == 'doubted'

    # id=5: status 's', null chance → 0.0 / confirmed_absent
    assert players_by_id[5]['availability_factor'] == 0.0
    assert players_by_id[5]['status_label'] == 'confirmed_absent'

    # id=7: chance=25 → 0.25 / doubted
    assert players_by_id[7]['availability_factor'] == 0.25
    assert players_by_id[7]['status_label'] == 'doubted'


def test_chance_of_playing_wins_over_status_a(monkeypatch):
    """SCRP-01/D-09: chance_of_playing_next_round wins over status='a'."""
    compute_lineup_news = _get_compute_lineup_news()
    with patch('lineup_news.save') as mock_save, \
         patch('lineup_news.feedparser') as mock_fp, \
         patch('lineup_news.requests') as mock_req:
        mock_fp.parse.return_value = MagicMock(entries=[])
        mock_req.get.side_effect = RuntimeError("no network in tests")

        compute_lineup_news(MOCK_BOOTSTRAP)

    payload = mock_save.call_args[0][1]
    players_by_id = {p['id']: p for p in payload['players']}

    # id=308: status='a' but chance=75 → must be 0.75 doubted (NOT 1.0 confirmed_start)
    assert players_by_id[308]['availability_factor'] == 0.75, \
        "chance_of_playing=75 must win over status='a'"
    assert players_by_id[308]['status_label'] == 'doubted', \
        "status_label must be 'doubted' not 'confirmed_start'"


def test_chance_100_returns_confirmed_start(monkeypatch):
    """SCRP-01/RESEARCH Pitfall 4: chance_of_playing==100 → 1.0 / confirmed_start."""
    compute_lineup_news = _get_compute_lineup_news()
    with patch('lineup_news.save') as mock_save, \
         patch('lineup_news.feedparser') as mock_fp, \
         patch('lineup_news.requests') as mock_req:
        mock_fp.parse.return_value = MagicMock(entries=[])
        mock_req.get.side_effect = RuntimeError("no network in tests")

        compute_lineup_news(MOCK_BOOTSTRAP)

    payload = mock_save.call_args[0][1]
    players_by_id = {p['id']: p for p in payload['players']}

    # id=3: chance=100 → 1.0, confirmed_start
    assert players_by_id[3]['availability_factor'] == 1.0
    assert players_by_id[3]['status_label'] == 'confirmed_start'


def test_unknown_status_returns_null_factor(monkeypatch):
    """SCRP-01/D-10: Unrecognised status → availability_factor=None, status_label='unknown'."""
    compute_lineup_news = _get_compute_lineup_news()
    with patch('lineup_news.save') as mock_save, \
         patch('lineup_news.feedparser') as mock_fp, \
         patch('lineup_news.requests') as mock_req:
        mock_fp.parse.return_value = MagicMock(entries=[])
        mock_req.get.side_effect = RuntimeError("no network in tests")

        compute_lineup_news(MOCK_BOOTSTRAP)

    payload = mock_save.call_args[0][1]
    players_by_id = {p['id']: p for p in payload['players']}

    # id=6: status='x', null chance → None / 'unknown'
    assert players_by_id[6]['availability_factor'] is None
    assert players_by_id[6]['status_label'] == 'unknown'


def test_empty_players_guard_skips_save(monkeypatch):
    """SCRP-05: If bootstrap.elements is empty, save() must NOT be called."""
    compute_lineup_news = _get_compute_lineup_news()
    with patch('lineup_news.save') as mock_save, \
         patch('lineup_news.feedparser') as mock_fp, \
         patch('lineup_news.requests') as mock_req:
        mock_fp.parse.return_value = MagicMock(entries=[])
        mock_req.get.side_effect = RuntimeError("no network in tests")

        compute_lineup_news(EMPTY_BOOTSTRAP)

    mock_save.assert_not_called()


def test_source_health_structure(monkeypatch):
    """SCRP-06: payload must contain source_health with four keys, each having ok/last_success/last_error."""
    compute_lineup_news = _get_compute_lineup_news()
    with patch('lineup_news.save') as mock_save, \
         patch('lineup_news.feedparser') as mock_fp, \
         patch('lineup_news.requests') as mock_req:
        mock_fp.parse.return_value = MagicMock(entries=[])
        mock_req.get.side_effect = RuntimeError("no network in tests")

        compute_lineup_news(MOCK_BOOTSTRAP)

    payload = mock_save.call_args[0][1]
    sh = payload['source_health']

    assert set(sh.keys()) == {'fpl', 'premierleague', 'skysports', 'bbc'}
    for source, info in sh.items():
        assert 'ok' in info, f"source_health['{source}'] missing 'ok'"
        assert 'last_success' in info, f"source_health['{source}'] missing 'last_success'"
        assert 'last_error' in info, f"source_health['{source}'] missing 'last_error'"

    # FPL must be ok=True because MOCK_BOOTSTRAP has valid elements
    assert sh['fpl']['ok'] is True


def test_rss_scraper_failure_isolates(monkeypatch):
    """SCRP-05/SCRP-06: RSS feedparser failure sets source ok=False but FPL ok=True; save() still called."""
    compute_lineup_news = _get_compute_lineup_news()
    with patch('lineup_news.save') as mock_save, \
         patch('lineup_news.feedparser') as mock_fp, \
         patch('lineup_news.requests') as mock_req:
        # Make feedparser.parse raise on every call
        mock_fp.parse.side_effect = RuntimeError("network down")
        mock_req.get.side_effect = RuntimeError("no network in tests")

        compute_lineup_news(MOCK_BOOTSTRAP)

    assert mock_save.called, "save() must still be called when only RSS fails"
    payload = mock_save.call_args[0][1]
    sh = payload['source_health']

    # RSS sources should be marked failed
    assert sh['skysports']['ok'] is False
    assert 'network down' in (sh['skysports']['last_error'] or '')
    assert sh['bbc']['ok'] is False

    # FPL source must still have succeeded
    assert sh['fpl']['ok'] is True
