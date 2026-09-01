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
