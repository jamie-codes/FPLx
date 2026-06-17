import json
import os
import injury_client


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
