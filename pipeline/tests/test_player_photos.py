"""PHOTO-01: fresher player headshots from api-football.

The Premier League's photo CDN has not reshot players since Aug 2024, so
transferred players still appear in their old club's kit (Semenyo in a
Bournemouth shirt, Mbeumo in a Brentford one). api-football refreshed both
in July 2026 and serves images from a public CDN needing no API key.
"""
import json

import player_photos


def _api_player(pid, name, team, photo=None):
    return {
        'player': {'id': pid, 'name': name,
                   'photo': photo or f'https://media.api-sports.io/football/players/{pid}.png'},
        'statistics': [{'team': {'id': 1, 'name': team}}],
    }


BOOTSTRAP = {
    'teams': [
        {'id': 3, 'name': 'Bournemouth', 'short_name': 'BOU'},
        {'id': 14, 'name': 'Man City', 'short_name': 'MCI'},
        {'id': 1, 'name': 'Coventry City', 'short_name': 'COV'},
    ],
    'elements': [
        {'id': 427, 'web_name': 'Semenyo', 'first_name': 'Antoine',
         'second_name': 'Semenyo', 'team': 14},
        {'id': 300, 'web_name': 'Haaland', 'first_name': 'Erling',
         'second_name': 'Haaland', 'team': 14},
        {'id': 180, 'web_name': 'Woolfenden', 'first_name': 'Luke',
         'second_name': 'Woolfenden', 'team': 1},
    ],
}


class TestParseRecords:
    def test_extracts_id_name_team_photo(self):
        recs = player_photos.parse_players([_api_player(19281, 'A. Semenyo', 'Manchester City')])
        assert recs == [{'player_id': 19281, 'player_name': 'A. Semenyo',
                         'team_name': 'Manchester City',
                         'photo': 'https://media.api-sports.io/football/players/19281.png'}]

    def test_skips_records_without_a_usable_photo_or_team(self):
        assert player_photos.parse_players([
            {'player': {'id': 1, 'name': 'X', 'photo': None}, 'statistics': [{'team': {'name': 'T'}}]},
            {'player': {'id': 2, 'name': 'Y', 'photo': 'u'}, 'statistics': []},
        ]) == []


class TestBuildPhotoMap:
    def test_maps_by_club_and_surname(self):
        recs = player_photos.parse_players([
            _api_player(19281, 'A. Semenyo', 'Manchester City'),
            _api_player(1100, 'E. Haaland', 'Manchester City'),
        ])
        m = player_photos.build_photo_map(recs, BOOTSTRAP)
        assert m['427'].endswith('/19281.png')
        assert m['300'].endswith('/1100.png')

    def test_resolves_promoted_clubs_via_the_shared_team_fallback(self):
        # 'Coventry' -> 'Coventry City' relies on injury_join's tolerant match.
        recs = player_photos.parse_players([_api_player(999, 'L. Woolfenden', 'Coventry')])
        assert player_photos.build_photo_map(recs, BOOTSTRAP)['180'].endswith('/999.png')

    def test_unmatched_players_are_simply_absent(self):
        recs = player_photos.parse_players([_api_player(5, 'Z. Nobody', 'Real Madrid')])
        assert player_photos.build_photo_map(recs, BOOTSTRAP) == {}


class TestThrottling:
    """CI 2026-09-01: paging the league back-to-back tripped api-football's
    per-minute cap and the whole refresh aborted (it degraded safely to the PL
    photos, but never produced a map)."""

    def test_backs_off_and_retries_a_rate_limited_page(self, monkeypatch):
        monkeypatch.setattr(player_photos.time, 'sleep', lambda _s: None)
        calls = {'n': 0}

        def flaky(endpoint, params):
            calls['n'] += 1
            if calls['n'] == 1:
                raise RuntimeError("PHOTO-01: api-football error response: "
                                   "{'rateLimit': 'Too many requests.'}")
            return {'response': [_api_player(1, 'A. B', 'Man City')], 'paging': {'total': 1}}

        monkeypatch.setattr(player_photos, '_get', flaky)
        recs = player_photos.fetch_all_players(season=2026)
        assert calls['n'] == 2          # retried after the limit
        assert len(recs) == 1

    def test_non_rate_limit_errors_still_propagate(self, monkeypatch):
        monkeypatch.setattr(player_photos.time, 'sleep', lambda _s: None)

        def dead_key(endpoint, params):
            raise RuntimeError("PHOTO-01: api-football error response: {'token': 'invalid'}")

        monkeypatch.setattr(player_photos, '_get', dead_key)
        try:
            player_photos.fetch_all_players(season=2026)
            raise AssertionError('expected the dead-key error to propagate')
        except RuntimeError as exc:
            assert 'token' in str(exc)

    def test_pages_until_paging_total(self, monkeypatch):
        monkeypatch.setattr(player_photos.time, 'sleep', lambda _s: None)
        seen = []

        def paged(endpoint, params):
            seen.append(params['page'])
            return {'response': [_api_player(params['page'], f'P{params["page"]}', 'Man City')],
                    'paging': {'total': 3}}

        monkeypatch.setattr(player_photos, '_get', paged)
        recs = player_photos.fetch_all_players(season=2026)
        assert seen == [1, 2, 3]
        assert len(recs) == 3


class TestRefreshPolicy:
    def test_refreshes_when_file_missing(self, tmp_path):
        assert player_photos._needs_refresh(str(tmp_path / 'nope.json'), season=2026) is True

    def test_refreshes_when_season_changed(self, tmp_path):
        p = tmp_path / 'm.json'
        p.write_text(json.dumps({'_season': 2025, '_refreshed_at': '2099-01-01T00:00:00+00:00',
                                 'photos': {'1': 'u'}}), encoding='utf-8')
        assert player_photos._needs_refresh(str(p), season=2026) is True

    def test_does_not_refresh_a_fresh_same_season_map(self, tmp_path):
        from datetime import datetime, timezone
        p = tmp_path / 'm.json'
        p.write_text(json.dumps({'_season': 2026,
                                 '_refreshed_at': datetime.now(timezone.utc).isoformat(),
                                 'photos': {'1': 'u'}}), encoding='utf-8')
        assert player_photos._needs_refresh(str(p), season=2026) is False

    def test_refreshes_a_stale_map(self, tmp_path):
        p = tmp_path / 'm.json'
        p.write_text(json.dumps({'_season': 2026,
                                 '_refreshed_at': '2020-01-01T00:00:00+00:00',
                                 'photos': {'1': 'u'}}), encoding='utf-8')
        assert player_photos._needs_refresh(str(p), season=2026) is True


def test_run_py_attaches_photo_url_before_saving():
    """Structural guard: the map is useless unless run.py stamps photo_url onto
    every merged player BEFORE merged_players.json is written."""
    import os
    run_path = os.path.join(os.path.dirname(__file__), '..', 'run.py')
    with open(run_path, encoding='utf-8') as f:
        src = f.read()
    assert 'from player_photos import refresh_photo_map' in src
    assert "_p['photo_url'] = _url" in src
    # ...and the attach must precede the save, or the field never ships.
    assert src.index("_p['photo_url'] = _url") < src.index("save('merged_players.json'")


class TestLoad:
    def test_load_returns_empty_dict_when_absent(self, tmp_path):
        assert player_photos.load_photo_map(str(tmp_path / 'missing.json')) == {}

    def test_load_returns_the_photos_block(self, tmp_path):
        p = tmp_path / 'm.json'
        p.write_text(json.dumps({'_season': 2026, 'photos': {'427': 'url'}}), encoding='utf-8')
        assert player_photos.load_photo_map(str(p)) == {'427': 'url'}

    def test_corrupt_file_degrades_to_empty(self, tmp_path):
        p = tmp_path / 'm.json'
        p.write_text('{not json', encoding='utf-8')
        assert player_photos.load_photo_map(str(p)) == {}
