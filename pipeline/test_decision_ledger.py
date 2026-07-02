"""Tests for pipeline/decision_ledger.py — DEC-02."""

import importlib
from unittest.mock import patch


def _player(pid, et, xpts, name='P', status='a', cost=50, team='ABC'):
    return {'id': pid, 'element_type': et, 'xPts_1gw': xpts,
            'xPts_90th_1gw': xpts + 1.0, 'web_name': f'{name}{pid}',
            'status': status, 'now_cost': cost, 'selected_by_percent': '5.0',
            'team_short_name': team}


def _pool():
    players = []
    pid = 1
    for et, n in ((1, 3), (2, 7), (3, 7), (4, 4)):
        for i in range(n):
            players.append(_player(pid, et, xpts=10.0 - i, name='X'))
            pid += 1
    return players


def test_build_ledger_xi_is_formation_legal():
    from decision_ledger import build_decision_ledger
    ledger = build_decision_ledger(_pool(), {}, current_gw=1)
    xi = ledger['model_xi']
    assert len(xi) == 11
    counts = {}
    for p in xi:
        counts[p['position']] = counts.get(p['position'], 0) + 1
    assert counts['GK'] == 1
    assert 3 <= counts['DEF'] <= 5
    assert 3 <= counts['MID'] <= 5
    assert 1 <= counts['FWD'] <= 3


def test_bench_is_gk_plus_three_outside_xi():
    from decision_ledger import build_decision_ledger
    ledger = build_decision_ledger(_pool(), {}, current_gw=1)
    xi_ids = {p['id'] for p in ledger['model_xi']}
    bench = ledger['bench']
    assert len(bench) == 4
    assert bench[0]['position'] == 'GK'
    assert all(p['id'] not in xi_ids for p in bench)


def test_shadow_attacker_captain_excludes_gk_and_def():
    from decision_ledger import build_decision_ledger
    pool = _pool()
    # Give a DEF the highest xPts — attacker_mean must still be MID/FWD.
    pool[3]['xPts_1gw'] = 99.0   # a DEF
    ledger = build_decision_ledger(pool, {}, current_gw=1)
    assert ledger['captain_shadow']['attacker_mean']['position'] in ('MID', 'FWD')


def test_unavailable_players_excluded():
    from decision_ledger import build_decision_ledger
    pool = _pool()
    star = _player(99, 3, xpts=50.0, status='i')   # injured superstar
    ledger = build_decision_ledger(pool + [star], {}, current_gw=1)
    assert all(p['id'] != 99 for p in ledger['model_xi'])


def test_chip_signals_present_and_consistent():
    from decision_ledger import build_decision_ledger
    ledger = build_decision_ledger(_pool(), {}, current_gw=1)
    cs = ledger['chip_signals']
    assert cs['xi_xpts'] > 0
    assert cs['bb_value'] > 0
    assert cs['tc_value'] == max(p['xPts_1gw'] for p in ledger['model_xi'])


def test_write_ledger_noop_when_use_blob_unset(monkeypatch):
    monkeypatch.delenv('USE_BLOB', raising=False)
    import decision_ledger
    importlib.reload(decision_ledger)
    with patch('upload.upload_json') as mock_upload:
        decision_ledger.write_decision_ledger({'gw': 1}, 1)
        mock_upload.assert_not_called()


def test_write_ledger_uploads_when_use_blob_true(monkeypatch):
    monkeypatch.setenv('USE_BLOB', 'true')
    import decision_ledger
    importlib.reload(decision_ledger)
    with patch('upload.upload_json') as mock_upload:
        decision_ledger.write_decision_ledger({'gw': 7}, 7)
        mock_upload.assert_called_once()
        assert mock_upload.call_args[0][0] == 'decision_ledger_gw7.json'
