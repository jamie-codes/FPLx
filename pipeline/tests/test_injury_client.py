import json
import os
from datetime import datetime, timezone

import pytest

import injury_client


class _FakeResp:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


def test_parse_records_extracts_fields():
    raw = {'response': [
        {'player': {'id': 1, 'name': 'A B', 'type': 'Missing Fixture', 'reason': 'knee'},
         'team': {'id': 35, 'name': 'Bournemouth'},
         'fixture': {'id': 99, 'date': '2025-08-15T19:00:00+00:00'}},
    ]}
    recs = injury_client.parse_records(raw)
    assert recs == [{
        'player_id': 1, 'player_name': 'A B', 'type': 'Missing Fixture', 'reason': 'knee',
        'team_id': 35, 'team_name': 'Bournemouth', 'date': '2025-08-15',
    }]


def test_parse_records_coerces_null_string_fields():
    # api-football returns explicit null for name/type/reason on some real records;
    # parse_records must coerce these to '' so downstream sorting/matching never sees None.
    raw = {'response': [
        {'player': {'id': 5, 'name': None, 'type': None, 'reason': None},
         'team': {'id': 1, 'name': 'Arsenal'},
         'fixture': {'id': 9, 'date': '2025-08-15T19:00:00+00:00'}},
    ]}
    rec = injury_client.parse_records(raw)[0]
    assert rec['player_name'] == ''
    assert rec['type'] == ''
    assert rec['reason'] == ''


def test_parse_records_empty_on_missing_response():
    assert injury_client.parse_records({}) == []
    assert injury_client.parse_records({'response': []}) == []


def test_load_snapshot_reads_committed_file(tmp_path):
    snap = tmp_path / 'snap.json'
    snap.write_text(json.dumps({'response': [
        {'player': {'id': 7, 'name': 'X Y', 'type': 'Questionable', 'reason': 'doubt'},
         'team': {'id': 1, 'name': 'Arsenal'},
         'fixture': {'id': 5, 'date': '2025-09-01T14:00:00+00:00'}},
    ]}), encoding='utf-8')
    recs = injury_client.load_snapshot(str(snap))
    assert len(recs) == 1
    assert recs[0]['type'] == 'Questionable'
    assert recs[0]['date'] == '2025-09-01'


def test_default_snapshot_path_points_at_committed_file():
    assert injury_client.SNAPSHOT_PATH.endswith(
        os.path.join('data', 'injuries', 'apifootball_PL_2025_26.json'))


# ---------------------------------------------------------------------------
# AVAIL-01 observability (2026-08-28): api-football signals bad keys / plan
# limits via HTTP 200 + a non-empty `errors` body. That must RAISE (so the
# caller's failure logging fires), never silently parse as "no injuries".
# ---------------------------------------------------------------------------

def test_get_raises_on_api_football_errors_body(monkeypatch):
    monkeypatch.setenv('APIFOOTBALL_KEY', 'k')
    monkeypatch.setattr(injury_client.requests, 'get', lambda *a, **kw: _FakeResp(
        {'errors': {'token': 'Error/Missing application key.'}, 'response': []}))
    with pytest.raises(RuntimeError, match='api-football error'):
        injury_client._get('injuries', {'fixture': 1})


def test_get_passes_through_on_empty_errors(monkeypatch):
    # api-football sends errors as {} or [] on healthy responses — both fine.
    monkeypatch.setenv('APIFOOTBALL_KEY', 'k')
    for empty in ({}, []):
        monkeypatch.setattr(injury_client.requests, 'get', lambda *a, _e=empty, **kw: _FakeResp(
            {'errors': _e, 'response': []}))
        assert injury_client._get('injuries', {'fixture': 1})['response'] == []


def test_get_live_injuries_bad_key_logs_failure_and_writes_no_cache(tmp_path, monkeypatch, capsys):
    cache = tmp_path / 'apifootball_injuries.json'
    monkeypatch.setattr(injury_client, 'CACHE_PATH', str(cache))
    monkeypatch.setenv('APIFOOTBALL_KEY', 'dead-key')
    monkeypatch.setattr(injury_client.requests, 'get', lambda *a, **kw: _FakeResp(
        {'errors': {'token': 'invalid'}, 'response': []}))
    assert injury_client.get_live_injuries(season=2026) == []
    assert 'injury fetch failed' in capsys.readouterr().out
    assert not cache.exists()   # a failed fetch must not poison the 24h cache


def _rec(player, team, date, rtype='Missing Fixture'):
    return {'player_id': player, 'player_name': str(player), 'type': rtype,
            'reason': 'knock', 'team_id': 1, 'team_name': team, 'date': date}


# ---------------------------------------------------------------------------
# select_current_records — a season sweep spans every matchday back to GW1;
# feeding all of it to build_injury_lookup would keep flagging recovered
# players, since that lookup dedupes by player but has no notion of recency.
# ---------------------------------------------------------------------------

TODAY = '2026-09-03'


class TestSelectCurrentRecords:
    def test_keeps_only_each_teams_latest_matchday(self):
        recs = [
            _rec(1, 'Arsenal', '2026-08-15'),    # stale — recovered since
            _rec(2, 'Arsenal', '2026-08-29'),    # current
            _rec(3, 'Arsenal', '2026-08-29'),    # current
            _rec(4, 'Liverpool', '2026-08-30'),  # Liverpool's latest
        ]
        got = {r['player_id'] for r in injury_client.select_current_records(recs, today=TODAY)}
        assert got == {2, 3, 4}

    def test_per_team_recency_is_independent(self):
        # Teams play on different days — one team's newer fixture must not
        # discard another team's latest snapshot.
        recs = [_rec(1, 'Arsenal', '2026-08-30'), _rec(2, 'Burnley', '2026-08-28')]
        got = {r['player_id'] for r in injury_client.select_current_records(recs, today=TODAY)}
        assert got == {1, 2}

    def test_future_records_ADD_to_the_latest_matchday(self):
        """Review 2026-08-30: the first version took the max over ALL dates, so
        a single early entry for the NEXT fixture replaced the whole current
        snapshot — silently un-flagging genuinely injured players inside the
        deadline window. Upcoming-fixture lists populate gradually, so they
        must ADD to the latest played matchday, never replace it."""
        recs = [
            _rec(1, 'Arsenal', '2026-08-29'),   # last matchday — still injured
            _rec(2, 'Arsenal', '2026-08-29'),
            _rec(3, 'Arsenal', '2026-09-05'),   # partial early entry for next
        ]
        got = {r['player_id'] for r in injury_client.select_current_records(recs, today=TODAY)}
        assert got == {1, 2, 3}

    def test_postponed_fixture_far_ahead_does_not_freeze_the_picture(self):
        # A rescheduled fixture months out must not become the anchor date.
        recs = [
            _rec(1, 'Arsenal', '2027-02-10'),   # postponed game, 2 stale records
            _rec(2, 'Arsenal', '2026-08-29'),   # the real current picture
        ]
        got = {r['player_id'] for r in injury_client.select_current_records(recs, today=TODAY)}
        assert got == {1, 2}

    def test_drops_a_stalled_teams_stale_block(self):
        # If a club's feed stops publishing, its months-old flags must not be
        # served as current. International breaks (~2 weeks) stay inside the cap.
        recs = [
            _rec(1, 'Arsenal', '2026-06-01'),   # way past the staleness cap
            _rec(2, 'Liverpool', '2026-08-22'),  # 12 days — normal break gap
        ]
        got = {r['player_id'] for r in injury_client.select_current_records(recs, today=TODAY)}
        assert got == {2}

    def test_team_with_only_future_records_is_kept(self):
        recs = [_rec(1, 'Arsenal', '2026-09-05')]
        got = {r['player_id'] for r in injury_client.select_current_records(recs, today=TODAY)}
        assert got == {1}

    def test_ignores_records_missing_team_or_date(self):
        recs = [_rec(1, '', '2026-08-29'), _rec(2, 'Arsenal', '')]
        assert injury_client.select_current_records(recs, today=TODAY) == []


def test_get_live_injuries_failure_writes_no_cache(tmp_path, monkeypatch, capsys):
    # An outage must not be cached as "injury-free league" for 24h.
    cache = tmp_path / 'apifootball_injuries.json'
    monkeypatch.setattr(injury_client, 'CACHE_PATH', str(cache))

    def boom(season, league=39):
        raise RuntimeError('rate limit reached')

    monkeypatch.setattr(injury_client, 'fetch_season_injuries', boom)
    assert injury_client.get_live_injuries(season=2026) == []
    assert 'injury fetch failed' in capsys.readouterr().out
    assert not cache.exists()


# ---------------------------------------------------------------------------
# AVAIL-01 live-path namespace bug (2026-08-30)
#
# run.py passed FPL fixture ids (1-380) into api-football's `fixture=` param,
# whose ids are 7-digit globals (1378969-1379348 in the committed snapshot —
# ZERO overlap). Every live call returned an empty 200 with no `errors`, so the
# injury layer silently produced 0 records in production from day one.
# The live path must query the league/season/date namespace instead; the join
# (build_injury_lookup) matches on team + player name, never on fixture id.
# ---------------------------------------------------------------------------

def test_fetch_date_injuries_queries_league_season_date(monkeypatch):
    seen = {}

    def fake_get(endpoint, params):
        seen['endpoint'] = endpoint
        seen['params'] = params
        return {'response': []}

    monkeypatch.setattr(injury_client, '_get', fake_get)
    injury_client.fetch_date_injuries('2026-09-05', season=2026)
    assert seen['endpoint'] == 'injuries'
    assert seen['params'] == {'league': 39, 'season': 2026, 'date': '2026-09-05'}
    # The FPL-namespace `fixture` param must never be sent on the live path.
    assert 'fixture' not in seen['params']


def test_fetch_season_injuries_sends_no_page_param(monkeypatch):
    """/injuries has no `page` field — sending one returns an HTTP-200 errors
    body, which (correctly) raises and took the layer dark for a run on
    2026-08-30. Pin the param set so paging can't be reintroduced."""
    seen = {}

    def fake_get(endpoint, params):
        seen['endpoint'], seen['params'] = endpoint, params
        return {'response': []}

    monkeypatch.setattr(injury_client, '_get', fake_get)
    injury_client.fetch_season_injuries(season=2026)
    assert seen['endpoint'] == 'injuries'
    assert seen['params'] == {'league': 39, 'season': 2026}
    assert 'page' not in seen['params']


def test_get_live_injuries_sweeps_by_season_and_selects_current(tmp_path, monkeypatch):
    """Live path: ONE league/season call, then per-team recency selection.

    Verified against the live API 2026-08-30: season sweep -> 304 records,
    while the upcoming GW's dates (+6 days) -> 0, because api-football only
    populates a fixture's injuries as kickoff nears.
    """
    cache = tmp_path / 'apifootball_injuries.json'
    monkeypatch.setattr(injury_client, 'CACHE_PATH', str(cache))
    calls = []

    def fake_sweep(season, league=39):
        calls.append(season)
        return [_rec(1, 'Arsenal', '2026-08-15'), _rec(2, 'Arsenal', '2026-08-29')]

    monkeypatch.setattr(injury_client, 'fetch_season_injuries', fake_sweep)
    recs = injury_client.get_live_injuries(season=2026)
    assert calls == [2026]                       # exactly one API call
    assert [r['player_id'] for r in recs] == [2]  # stale record dropped
    assert cache.exists()


def test_get_live_injuries_logs_cache_serve(tmp_path, monkeypatch, capsys):
    cache = tmp_path / 'apifootball_injuries.json'
    cache.write_text(json.dumps({
        '_cached_at': datetime.now(timezone.utc).isoformat(),
        'records': [{'player_id': 1}],
    }), encoding='utf-8')
    monkeypatch.setattr(injury_client, 'CACHE_PATH', str(cache))
    recs = injury_client.get_live_injuries(season=2026)
    assert len(recs) == 1
    out = capsys.readouterr().out
    assert 'cache' in out and '1' in out
