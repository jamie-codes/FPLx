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
    assert injury_client.get_live_injuries([7]) == []
    assert 'injury fetch failed' in capsys.readouterr().out
    assert not cache.exists()   # a failed fetch must not poison the 24h cache


def test_get_live_injuries_keeps_partial_batch_on_midloop_failure(tmp_path, monkeypatch, capsys):
    # Review 2026-08-28: a rate-limit tripping on fixture N must not discard
    # the N-1 fixtures already fetched — keep and cache the partial batch.
    cache = tmp_path / 'apifootball_injuries.json'
    monkeypatch.setattr(injury_client, 'CACHE_PATH', str(cache))
    monkeypatch.setenv('APIFOOTBALL_KEY', 'k')

    def fake_fetch(fid):
        if fid == 2:
            raise RuntimeError('rate limit reached')
        return [{'player_id': fid}]

    monkeypatch.setattr(injury_client, 'fetch_fixture_injuries', fake_fetch)
    recs = injury_client.get_live_injuries([1, 2, 3])
    assert [r['player_id'] for r in recs] == [1, 3]
    assert 'failed for 1/3' in capsys.readouterr().out
    assert cache.exists()


def test_get_live_injuries_empty_fixture_list_writes_no_cache(tmp_path, monkeypatch):
    # Review 2026-08-28: an empty fixture list must not write a 0-record cache
    # that then masquerades as "injury-free league" for 24h.
    cache = tmp_path / 'apifootball_injuries.json'
    monkeypatch.setattr(injury_client, 'CACHE_PATH', str(cache))
    assert injury_client.get_live_injuries([]) == []
    assert not cache.exists()


def test_get_live_injuries_logs_cache_serve(tmp_path, monkeypatch, capsys):
    cache = tmp_path / 'apifootball_injuries.json'
    cache.write_text(json.dumps({
        '_cached_at': datetime.now(timezone.utc).isoformat(),
        'records': [{'player_id': 1}],
    }), encoding='utf-8')
    monkeypatch.setattr(injury_client, 'CACHE_PATH', str(cache))
    recs = injury_client.get_live_injuries([1, 2])
    assert len(recs) == 1
    out = capsys.readouterr().out
    assert 'cache' in out and '1' in out
