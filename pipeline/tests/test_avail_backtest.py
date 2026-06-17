"""AVAIL-01: backtest injury-gating hook is a strict no-op by default and zeroes
a flagged player's prediction when avail_out_factor=0."""
from backtest import run_backtest, DEFAULT_PARAMS


def _archive():
    """Two players, GW1-10, identical full-minutes histories so both are eligible."""
    def hist(pid_pts):
        return [{'round': r, 'fixture': 1000 + r, 'minutes': 90, 'starts': 1,
                 'was_home': True, 'total_points': pid_pts,
                 'expected_goals': '0.3', 'expected_assists': '0.1'} for r in range(1, 11)]
    fixtures = [{'id': 1000 + r, 'event': r, 'kickoff_time': f'2025-08-{r:02d}T14:00:00Z',
                 'team_h': 1, 'team_a': 2, 'team_h_difficulty': 3, 'team_a_difficulty': 3}
                for r in range(1, 11)]
    return {
        'bootstrap': {'teams': [{'id': 1, 'name': 'Arsenal', 'short_name': 'ARS'},
                                {'id': 2, 'name': 'Chelsea', 'short_name': 'CHE'}],
                      'elements': [{'id': 10, 'web_name': 'A', 'element_type': 3, 'team': 1},
                                   {'id': 20, 'web_name': 'B', 'element_type': 3, 'team': 1}]},
        'fixtures': fixtures,
        'summaries': {10: {'history': hist(5)}, 20: {'history': hist(5)}},
    }


def test_defaults_are_strict_noop():
    arch = _archive()
    base = run_backtest(arch, mode='deploy', first_gw=7, last_gw=10)
    gated = run_backtest(arch, mode='deploy', first_gw=7, last_gw=10, injury_lookup={})
    assert [r['xpts_pred'] for r in base['rows']] == [r['xpts_pred'] for r in gated['rows']]


def test_out_factor_zero_zeroes_flagged_player_only():
    arch = _archive()
    lookup = {(8, 10): 'out'}  # flag player 10 out for GW8 only
    params = {'avail_out_factor': 0.0}
    res = run_backtest(arch, params=params, mode='deploy', first_gw=7, last_gw=10,
                       injury_lookup=lookup)
    flagged = [r for r in res['rows'] if r['player_id'] == 10 and r['gw'] == 8]
    unflagged = [r for r in res['rows'] if r['player_id'] == 20 and r['gw'] == 8]
    assert flagged and flagged[0]['xpts_pred'] == 0.0
    assert unflagged and unflagged[0]['xpts_pred'] > 0.0


def test_doubt_factor_reduces_flagged_player_prediction():
    # exp12 uses avail_doubt_factor=0.5 in production, so exercise the 'doubt' branch:
    # a doubt-flagged player's prediction is reduced (not zeroed) vs the unflagged peer.
    arch = _archive()
    lookup = {(8, 10): 'doubt'}  # flag player 10 doubtful for GW8 only
    res = run_backtest(arch, params={'avail_doubt_factor': 0.5}, mode='deploy',
                       first_gw=7, last_gw=10, injury_lookup=lookup)
    flagged = [r for r in res['rows'] if r['player_id'] == 10 and r['gw'] == 8][0]
    unflagged = [r for r in res['rows'] if r['player_id'] == 20 and r['gw'] == 8][0]
    assert 0.0 < flagged['xpts_pred'] < unflagged['xpts_pred']


def test_avail_params_exist_and_default_to_one():
    assert DEFAULT_PARAMS['avail_out_factor'] == 1.0
    assert DEFAULT_PARAMS['avail_doubt_factor'] == 1.0
