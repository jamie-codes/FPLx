import copy
from capture_season import load_season_archive
from backtest import DEFAULT_PARAMS
from ml.features import build_feature_row, build_dataset, FEATURE_NAMES

_ARCHIVE = load_season_archive()


def _player_with_history():
    for pid, s in _ARCHIVE['summaries'].items():
        if len([e for e in s['history'] if e.get('round', 0) < 20]) >= 6:
            return pid, s['history']
    raise AssertionError('no eligible player')


def test_feature_row_has_all_named_features_numeric():
    pid, hist = _player_with_history()
    ctx = {'was_home': 1, 'n_fixtures': 1, 'norm_concede_rate': 0.5,
           'norm_attack_rate': 0.5, 'difficulty': 0.5, 'odds_cs_prob': 0.3,
           'attack_difficulty': 0.4}
    el = {'now_cost': 75}
    row = build_feature_row(hist, 20, DEFAULT_PARAMS, el, ctx)
    assert row is not None
    assert set(row.keys()) == set(FEATURE_NAMES)
    assert all(isinstance(v, float) for v in row.values())


def test_feature_row_none_when_no_prior():
    row = build_feature_row([{'round': 5, 'minutes': 90}], 1, DEFAULT_PARAMS,
                            {'now_cost': 50}, {'was_home': 1, 'n_fixtures': 1,
                            'norm_concede_rate': 0.5, 'norm_attack_rate': 0.5,
                            'difficulty': 0.5, 'odds_cs_prob': 0.3, 'attack_difficulty': 0.4})
    assert row is None  # no entries with round < 1


def test_feature_row_is_leakage_free():
    pid, hist = _player_with_history()
    el = {'now_cost': 75}
    ctx = {'was_home': 1, 'n_fixtures': 1, 'norm_concede_rate': 0.5,
           'norm_attack_rate': 0.5, 'difficulty': 0.5, 'odds_cs_prob': 0.3,
           'attack_difficulty': 0.4}
    base = build_feature_row(hist, 20, DEFAULT_PARAMS, el, ctx)
    # mutate the FUTURE: inflate every round>=20 entry's stats + append a fake future GW
    poisoned = copy.deepcopy(hist)
    for e in poisoned:
        if e.get('round', 0) >= 20:
            e['minutes'] = 90
            e['expected_goals'] = '9.9'
            e['total_points'] = 99
    poisoned.append({'round': 38, 'minutes': 90, 'expected_goals': '9.9',
                     'expected_assists': '9.9', 'starts': 1, 'total_points': 99})
    after = build_feature_row(poisoned, 20, DEFAULT_PARAMS, el, ctx)
    assert base == after  # future cannot change an as-of-GW20 feature row


def test_build_dataset_rows_match_backtest_gating_and_labels():
    rows, names = build_dataset(_ARCHIVE, DEFAULT_PARAMS, first_gw=7, last_gw=38)
    assert names == FEATURE_NAMES
    assert rows, 'dataset must be non-empty'
    r = rows[0]
    assert set(r.keys()) >= {'features', 'label', 'element_type', 'player_id',
                             'web_name', 'gw', 'actual_minutes', 'n_fixtures'}
    assert isinstance(r['label'], int)
    # spot-check a known (player, gw) label equals sum of total_points that GW
    pid = r['player_id']; gw = r['gw']
    hist = _ARCHIVE['summaries'][pid]['history']
    expected = sum(e.get('total_points', 0) or 0 for e in hist if e.get('round') == gw)
    assert r['label'] == expected
