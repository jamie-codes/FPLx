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
    assert injury_client.get_live_injuries(['2026-09-05'], season=2026) == []
    assert 'injury fetch failed' in capsys.readouterr().out
    assert not cache.exists()   # a failed fetch must not poison the 24h cache


def test_get_live_injuries_keeps_partial_batch_on_midloop_failure(tmp_path, monkeypatch, capsys):
    # Review 2026-08-28: a rate-limit tripping on request N must not discard
    # the N-1 dates already fetched — keep and cache the partial batch.
    cache = tmp_path / 'apifootball_injuries.json'
    monkeypatch.setattr(injury_client, 'CACHE_PATH', str(cache))
    monkeypatch.setenv('APIFOOTBALL_KEY', 'k')

    def fake_fetch(date, season, league=39):
        if date == '2026-09-06':
            raise RuntimeError('rate limit reached')
        return [{'player_id': date}]

    monkeypatch.setattr(injury_client, 'fetch_date_injuries', fake_fetch)
    recs = injury_client.get_live_injuries(
        ['2026-09-05', '2026-09-06', '2026-09-07'], season=2026)
    assert [r['player_id'] for r in recs] == ['2026-09-05', '2026-09-07']
    assert 'failed for 1/3' in capsys.readouterr().out
    assert cache.exists()


def test_get_live_injuries_empty_date_list_writes_no_cache(tmp_path, monkeypatch):
    # Review 2026-08-28: an empty request list must not write a 0-record cache
    # that then masquerades as "injury-free league" for 24h.
    cache = tmp_path / 'apifootball_injuries.json'
    monkeypatch.setattr(injury_client, 'CACHE_PATH', str(cache))
    assert injury_client.get_live_injuries([], season=2026) == []
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


def test_get_live_injuries_fetches_by_date_not_fpl_fixture_id(tmp_path, monkeypatch):
    cache = tmp_path / 'apifootball_injuries.json'
    monkeypatch.setattr(injury_client, 'CACHE_PATH', str(cache))
    calls = []

    def fake_fetch(date, season, league=39):
        calls.append((date, season))
        return [{'player_id': 1, 'date': date}]

    monkeypatch.setattr(injury_client, 'fetch_date_injuries', fake_fetch)
    recs = injury_client.get_live_injuries(['2026-09-05', '2026-09-06'], season=2026)
    assert calls == [('2026-09-05', 2026), ('2026-09-06', 2026)]
    assert len(recs) == 2


def test_get_live_injuries_dedupes_repeated_dates(tmp_path, monkeypatch):
    # Several fixtures share a kickoff date — one API call per distinct date.
    cache = tmp_path / 'apifootball_injuries.json'
    monkeypatch.setattr(injury_client, 'CACHE_PATH', str(cache))
    calls = []

    def fake_fetch(date, season, league=39):
        calls.append(date)
        return []

    monkeypatch.setattr(injury_client, 'fetch_date_injuries', fake_fetch)
    injury_client.get_live_injuries(
        ['2026-09-05', '2026-09-05', '2026-09-06'], season=2026)
    assert calls == ['2026-09-05', '2026-09-06']


def test_get_live_injuries_logs_cache_serve(tmp_path, monkeypatch, capsys):
    cache = tmp_path / 'apifootball_injuries.json'
    cache.write_text(json.dumps({
        '_cached_at': datetime.now(timezone.utc).isoformat(),
        'records': [{'player_id': 1}],
    }), encoding='utf-8')
    monkeypatch.setattr(injury_client, 'CACHE_PATH', str(cache))
    recs = injury_client.get_live_injuries(['2026-09-05', '2026-09-06'], season=2026)
    assert len(recs) == 1
    out = capsys.readouterr().out
    assert 'cache' in out and '1' in out
