"""Unit tests for pipeline/understat_client.py (USR-01).

All tests mock requests.post; no network calls are made.

Fixture shape mirrors the live endpoint response:
  {'players': [{id, player_name, team_title, xG, xA, npxG, npxA, time}, ...]}
"""

import json
import os
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

import pytest

import understat_client as uc


# ---------------------------------------------------------------------------
# Shared fixture factory
# ---------------------------------------------------------------------------

def _make_player(**kwargs):
    """Return a minimal endpoint player dict with sensible defaults."""
    base = {
        'id': '1',
        'player_name': 'Test Player',
        'team_title': 'Man City',
        'xG': '10.5',
        'xA': '5.2',
        'npxG': '9.0',
        'npxA': None,   # endpoint returns null for npxA
        'time': '1800',
    }
    base.update(kwargs)
    return base


def _make_response(players):
    """Build a mock requests.Response for resp.json().get('players', [])."""
    mock_resp = MagicMock()
    mock_resp.json.return_value = {'players': players}
    mock_resp.raise_for_status.return_value = None
    return mock_resp


# ---------------------------------------------------------------------------
# Helper to patch both cache freshness and requests.post
# ---------------------------------------------------------------------------

def _run_fetch(players_fixture, monkeypatch):
    """Bypass cache, POST mock, return get_understat_players() result."""
    monkeypatch.setattr(uc, '_is_cache_fresh', lambda: False)
    monkeypatch.setattr(uc, '_write_cache', lambda d: None)
    mock_post = MagicMock(return_value=_make_response(players_fixture))
    with patch('understat_client.requests.post', mock_post):
        result = uc.get_understat_players()
    return result, mock_post


# ---------------------------------------------------------------------------
# Mapping correctness
# ---------------------------------------------------------------------------

class TestMapping:
    def test_basic_fields_mapped_correctly(self, monkeypatch):
        """xG, xA, npxG, minutes are mapped to correct output keys."""
        result, _ = _run_fetch([_make_player()], monkeypatch)

        assert '1' in result
        p = result['1']
        assert p['player'] == 'Test Player'
        assert p['team'] == 'Man City'
        assert abs(p['xG'] - 10.5) < 1e-9
        assert abs(p['xA'] - 5.2) < 1e-9
        assert abs(p['npxG'] - 9.0) < 1e-9
        assert p['minutes'] == 1800

    def test_npxa_null_becomes_zero(self, monkeypatch):
        """npxA=null from the endpoint is coerced to 0.0."""
        result, _ = _run_fetch([_make_player(npxA=None)], monkeypatch)
        assert result['1']['npxA'] == 0.0

    def test_npxa_zero_string_becomes_zero(self, monkeypatch):
        """npxA='0' (string) is coerced to 0.0."""
        result, _ = _run_fetch([_make_player(npxA='0')], monkeypatch)
        assert result['1']['npxA'] == 0.0

    def test_team_title_list_uses_last_entry(self, monkeypatch):
        """When team_title is a list (mid-season transfer), the last club is used."""
        result, _ = _run_fetch(
            [_make_player(team_title=['Arsenal', 'Chelsea'])], monkeypatch
        )
        assert result['1']['team'] == 'Chelsea'

    def test_team_title_empty_list_becomes_empty_string(self, monkeypatch):
        """team_title=[] doesn't crash; falls back to empty string."""
        result, _ = _run_fetch([_make_player(team_title=[])], monkeypatch)
        assert result['1']['team'] == ''

    def test_output_dict_shape(self, monkeypatch):
        """Output dict has exactly the expected keys."""
        result, _ = _run_fetch([_make_player()], monkeypatch)
        assert set(result['1'].keys()) == {'player', 'team', 'xG', 'xA', 'npxG', 'npxA', 'minutes'}

    def test_multiple_players_all_mapped(self, monkeypatch):
        """Multiple players in the response all appear in the output."""
        players = [
            _make_player(id='1', player_name='Alpha'),
            _make_player(id='2', player_name='Beta', xG='0.0'),
        ]
        result, _ = _run_fetch(players, monkeypatch)
        assert len(result) == 2
        assert result['1']['player'] == 'Alpha'
        assert result['2']['player'] == 'Beta'


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

class TestEdgeCases:
    def test_empty_players_returns_empty_dict(self, monkeypatch):
        """Empty players list → empty dict (triggers layered DQ-01 fallback)."""
        result, _ = _run_fetch([], monkeypatch)
        assert result == {}

    def test_player_with_no_id_skipped(self, monkeypatch):
        """A player dict with no 'id' key is silently skipped."""
        player = _make_player()
        del player['id']
        result, _ = _run_fetch([player], monkeypatch)
        assert result == {}

    def test_player_with_empty_id_skipped(self, monkeypatch):
        """A player dict with id='' is silently skipped."""
        result, _ = _run_fetch([_make_player(id='')], monkeypatch)
        assert result == {}

    def test_real_npxg_value_is_emitted(self, monkeypatch):
        """npxG with a real value (not 0) is emitted correctly (was always 0 in old scraper)."""
        result, _ = _run_fetch([_make_player(npxG='25.3')], monkeypatch)
        assert abs(result['1']['npxG'] - 25.3) < 1e-9


# ---------------------------------------------------------------------------
# HTTP error handling
# ---------------------------------------------------------------------------

class TestHttpError:
    def test_http_error_returns_empty_dict(self, monkeypatch):
        """An HTTP error (raise_for_status) returns {} without crashing."""
        monkeypatch.setattr(uc, '_is_cache_fresh', lambda: False)
        monkeypatch.setattr(uc, '_write_cache', lambda d: None)

        import requests as req
        mock_resp = MagicMock()
        mock_resp.raise_for_status.side_effect = req.HTTPError("503 Service Unavailable")

        with patch('understat_client.requests.post', return_value=mock_resp):
            result = uc.get_understat_players()

        assert result == {}

    def test_connection_error_returns_empty_dict(self, monkeypatch):
        """A connection error (exception on post()) returns {} without crashing."""
        monkeypatch.setattr(uc, '_is_cache_fresh', lambda: False)
        monkeypatch.setattr(uc, '_write_cache', lambda d: None)

        import requests as req
        with patch('understat_client.requests.post', side_effect=req.ConnectionError("timeout")):
            result = uc.get_understat_players()

        assert result == {}


# ---------------------------------------------------------------------------
# POST is used (not GET)
# ---------------------------------------------------------------------------

class TestPostEndpoint:
    def test_post_called_with_correct_args(self, monkeypatch):
        """requests.post is called with the correct URL, data, and headers."""
        result, mock_post = _run_fetch([_make_player()], monkeypatch)

        assert mock_post.called
        call_kwargs = mock_post.call_args

        # Positional arg 0 = URL
        url = call_kwargs.args[0] if call_kwargs.args else call_kwargs.kwargs.get('url', '')
        assert url == 'https://understat.com/main/getPlayersStats/'

        data = call_kwargs.kwargs.get('data', {})
        assert data.get('league') == 'EPL'
        assert 'season' in data

        headers = call_kwargs.kwargs.get('headers', {})
        assert headers.get('X-Requested-With') == 'XMLHttpRequest'
        assert 'understat.com' in headers.get('Referer', '')


# ---------------------------------------------------------------------------
# Cache paths
# ---------------------------------------------------------------------------

class TestCache:
    def test_cache_fresh_path_skips_post(self, monkeypatch, tmp_path):
        """When the cache is fresh, requests.post is never called."""
        # Write a fresh cache
        cache_file = tmp_path / 'understat_current.json'
        data = {
            '42': {'player': 'Cached Player', 'team': 'Arsenal',
                   'xG': 5.0, 'xA': 2.0, 'npxG': 4.5, 'npxA': 0.0, 'minutes': 900},
            '_cached_at': datetime.now(timezone.utc).isoformat(),
        }
        cache_file.write_text(json.dumps(data), encoding='utf-8')

        monkeypatch.setattr(uc, 'CACHE_PATH', str(cache_file))
        monkeypatch.setattr(uc, '_is_cache_fresh', lambda: True)

        # Reload _load_cache after monkeypatching CACHE_PATH
        def _patched_load():
            with open(str(cache_file), 'r', encoding='utf-8') as f:
                d = json.load(f)
            return {k: v for k, v in d.items() if k != '_cached_at'}

        monkeypatch.setattr(uc, '_load_cache', _patched_load)

        with patch('understat_client.requests.post') as mock_post:
            result = uc.get_understat_players()
            assert not mock_post.called

        assert '42' in result
        assert result['42']['player'] == 'Cached Player'

    def test_stale_cache_triggers_post(self, monkeypatch):
        """When cache is stale, requests.post is called."""
        monkeypatch.setattr(uc, '_is_cache_fresh', lambda: False)
        monkeypatch.setattr(uc, '_write_cache', lambda d: None)

        with patch('understat_client.requests.post', return_value=_make_response([])) as mock_post:
            uc.get_understat_players()
            assert mock_post.called
