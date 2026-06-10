"""Tests for backtest.py (BT-02). Synthetic data only — no network, no archive."""
import pytest

import backtest


# ── synthetic archive helpers ─────────────────────────────────────────────── #

def _entry(rnd, fixture_id, minutes=90, xg=0.3, xa=0.1, pts=2, starts=1,
           was_home=True):
    return {
        'round': rnd, 'fixture': fixture_id, 'minutes': minutes,
        'expected_goals': str(xg), 'expected_assists': str(xa),
        'total_points': pts, 'starts': starts, 'was_home': was_home,
        'opponent_team': 2 if was_home else 1,
    }


def _uniform_history(n_gws, minutes=90, xg=0.3, xa=0.1, pts=2):
    """One fixture per GW, fixture id = round number."""
    return [_entry(g, g, minutes=minutes, xg=xg, xa=xa, pts=pts)
            for g in range(1, n_gws + 1)]


def _params(**over):
    p = dict(backtest.DEFAULT_PARAMS)
    p.update(over)
    return p


# ── build_asof_signals ────────────────────────────────────────────────────── #

def test_asof_per90_uses_only_prior_rounds():
    """Cumulative per-90s at GW g must exclude GW g itself (the leak BT-02 fixes)."""
    hist = _uniform_history(10, xg=0.3)
    # Inflate GW 8's xG massively — signals AT GW 8 must not change
    hist_inflated = [dict(e) for e in hist]
    hist_inflated[7]['expected_goals'] = '9.9'
    base = backtest.build_asof_signals(hist, 8, _params())
    infl = backtest.build_asof_signals(hist_inflated, 8, _params())
    assert base['xg_per90'] == infl['xg_per90']
    # ...but signals at GW 9 DO see GW 8
    base9 = backtest.build_asof_signals(hist, 9, _params())
    infl9 = backtest.build_asof_signals(hist_inflated, 9, _params())
    assert infl9['xg_per90'] > base9['xg_per90']


def test_asof_cum_minutes_and_eligibility_threshold():
    """cum_minutes counts only prior rounds; 270-minute threshold is the caller's gate."""
    hist = _uniform_history(4, minutes=90)  # 90,90,90,90
    sig3 = backtest.build_asof_signals(hist, 3, _params())   # prior = GW1-2 = 180
    sig4 = backtest.build_asof_signals(hist, 4, _params())   # prior = GW1-3 = 270
    assert sig3['cum_minutes'] == 180
    assert sig4['cum_minutes'] == 270
    # No prior data at all -> None
    assert backtest.build_asof_signals(hist, 1, _params()) is None


def test_asof_xmins_window_and_probs():
    """Deploy-mode minutes signals come from the last 5 prior entries."""
    # Alternating 90/0: rounds 1..10 -> minutes 90,0,90,0,90,0,90,0,90,0
    hist = []
    for g in range(1, 11):
        m = 90 if g % 2 == 1 else 0
        hist.append(_entry(g, g, minutes=m, starts=1 if m else 0,
                           pts=2 if m else 0))
    sig = backtest.build_asof_signals(hist, 11, _params())
    # last 5 prior entries = rounds 6-10 = minutes 0,90,0,90,0 -> mean 36
    assert sig['xmins'] == pytest.approx(36.0)
    assert sig['start_prob'] == pytest.approx(2 / 5)
    assert sig['mins_60_prob'] == pytest.approx(2 / 5)
    assert sig['sub_appear_prob'] == 0.0  # 0-minute games are absences, not sub cameos


# ── synthetic archive for run_backtest ────────────────────────────────────── #

def _make_archive(n_gws=12, dgw_gw=None, players=None):
    """Two teams (1, 2) playing each other every GW. fixture id = 100+gw
    (and 200+gw for the second DGW fixture). players: list of dicts with
    id, element_type, team, history-overrides."""
    fixtures = []
    for g in range(1, n_gws + 1):
        fixtures.append({
            'id': 100 + g, 'event': g, 'team_h': 1, 'team_a': 2,
            'team_h_score': 1, 'team_a_score': 1, 'finished': True,
            'team_h_difficulty': 3, 'team_a_difficulty': 3,
        })
        if dgw_gw is not None and g == dgw_gw:
            fixtures.append({
                'id': 200 + g, 'event': g, 'team_h': 2, 'team_a': 1,
                'team_h_score': 1, 'team_a_score': 1, 'finished': True,
                'team_h_difficulty': 3, 'team_a_difficulty': 3,
            })
    players = players or []
    elements = [{'id': p['id'], 'element_type': p.get('element_type', 4),
                 'team': p.get('team', 1), 'web_name': f"P{p['id']}"}
                for p in players]
    summaries = {p['id']: {'history': p['history']} for p in players}
    return {
        'bootstrap': {'elements': elements,
                      'events': [{'id': g, 'finished': True}
                                 for g in range(1, n_gws + 1)]},
        'fixtures': fixtures,
        'understat': {},
        'summaries': summaries,
        'manifest': {'season': 'synthetic'},
    }


def _std_player(pid, n_gws=12, **entry_over):
    hist = []
    for g in range(1, n_gws + 1):
        e = _entry(g, 100 + g, was_home=True)
        e.update(entry_over)
        e['round'] = g
        e['fixture'] = 100 + g
        hist.append(e)
    return {'id': pid, 'history': hist}


def test_run_backtest_no_leakage_end_to_end():
    """Inflating a player's GW-8 xG must not change his GW-8 prediction."""
    base_arch = _make_archive(players=[_std_player(1)])
    infl = _make_archive(players=[_std_player(1)])
    for e in infl['summaries'][1]['history']:
        if e['round'] == 8:
            e['expected_goals'] = '9.9'
    r_base = backtest.run_backtest(archive=base_arch, first_gw=8, last_gw=8)
    r_infl = backtest.run_backtest(archive=infl, first_gw=8, last_gw=8)
    assert r_base['rows'][0]['xpts_pred'] == r_infl['rows'][0]['xpts_pred']


def test_run_backtest_eligibility_gate():
    """Player with <270 prior minutes produces no row."""
    p = _std_player(1)
    for e in p['history']:
        e['minutes'] = 60  # 60*6 prior at GW7 = 360 OK; at GW5 = 240 not OK
    arch = _make_archive(players=[p])
    r5 = backtest.run_backtest(archive=arch, first_gw=5, last_gw=5)
    r7 = backtest.run_backtest(archive=arch, first_gw=7, last_gw=7)
    assert len(r5['rows']) == 0
    assert len(r7['rows']) == 1


def test_dgw_sums_two_fixtures():
    """GW with two fixtures -> predicted equals 2x the single-fixture prediction
    (symmetric synthetic world) and actual sums both entries."""
    p = _std_player(1)
    # add second GW-8 entry (away fixture 208)
    e2 = _entry(8, 208, was_home=False, pts=5)
    p['history'].append(e2)
    p['history'].sort(key=lambda e: (e['round'], e['fixture']))
    arch = _make_archive(dgw_gw=8, players=[p])
    single = _make_archive(players=[_std_player(1)])
    r_dgw = backtest.run_backtest(archive=arch, first_gw=8, last_gw=8)
    r_one = backtest.run_backtest(archive=single, first_gw=8, last_gw=8)
    assert r_dgw['rows'][0]['xpts_pred'] == pytest.approx(
        2 * r_one['rows'][0]['xpts_pred'])
    assert r_dgw['rows'][0]['actual_pts'] == 2 + 5


def test_modes_differ_on_minutes():
    """Rotation player: deploy uses predicted xmins; conditional uses actual."""
    p = _std_player(1)
    for e in p['history']:
        m = 90 if e['round'] % 2 == 1 else 0
        e['minutes'] = m
        e['starts'] = 1 if m else 0
    arch = _make_archive(players=[p])
    # GW 11 is odd -> played 90 that GW
    dep = backtest.run_backtest(archive=arch, mode='deploy',
                                first_gw=11, last_gw=11)
    con = backtest.run_backtest(archive=arch, mode='conditional',
                                first_gw=11, last_gw=11)
    assert len(dep['rows']) == 1 and len(con['rows']) == 1
    # conditional (actual 90 min) must predict more than deploy (xmins 36)
    assert con['rows'][0]['xpts_pred'] > dep['rows'][0]['xpts_pred']


def test_param_override_changes_predictions():
    """atf_slope with non-neutral attack form shifts predictions."""
    # Team 1 scores 3/game, team 2 scores 0 -> team 1 attack form -> 1.0
    arch = _make_archive(players=[_std_player(1)])
    for f in arch['fixtures']:
        f['team_h_score'] = 3
        f['team_a_score'] = 0
    base = backtest.run_backtest(archive=arch, first_gw=8, last_gw=8)
    boosted = backtest.run_backtest(archive=arch, first_gw=8, last_gw=8,
                                    params={'atf_slope': 0.4})
    assert boosted['rows'][0]['xpts_pred'] > base['rows'][0]['xpts_pred']


# ── metrics ───────────────────────────────────────────────────────────────── #

def _row(pid, gw, pred, actual, et=4):
    return {'player_id': pid, 'web_name': f'P{pid}', 'element_type': et,
            'gw': gw, 'xpts_pred': pred, 'actual_pts': actual}


def test_haul_hit_rate_computation():
    # GW1: 12 players; haulers are pids 1 (pred rank 1) and 12 (pred rank 12).
    rows = [_row(i, 1, pred=13 - i, actual=(12 if i in (1, 12) else 3))
            for i in range(1, 13)]
    metrics, per_gw = backtest.compute_metrics(rows)
    assert metrics['haul_hit_rate'] == pytest.approx(0.5)      # 1 of 2 in top-10
    assert metrics['haul_capture_20'] == pytest.approx(1.0)    # both in top-20 (only 12 rows)
    assert metrics['captain_hit_rate'] == 1.0                  # rank-1 pid 1 scored max 12
    assert metrics['captain_return_rate'] == 1.0               # >= 6
    assert per_gw[0]['n_haulers'] == 2
    assert metrics['top10_mean_pts'] == pytest.approx(
        (12 + 3 * 9) / 10)


def test_spearman_perfect_and_inverted():
    rows_perfect = [_row(i, 1, pred=10 - i, actual=10 - i) for i in range(5)]
    rows_inverted = [_row(i, 1, pred=10 - i, actual=i) for i in range(5)]
    m1, _ = backtest.compute_metrics(rows_perfect)
    m2, _ = backtest.compute_metrics(rows_inverted)
    assert m1['spearman'] == pytest.approx(1.0)
    assert m2['spearman'] == pytest.approx(-1.0)


import os


def test_cli_set_parsing():
    args = backtest._parse_args(['--mode', 'conditional', '--first-gw', '10',
                                 '--set', 'atf_slope=0.2',
                                 '--set', 'form_window_gws=4'])
    overrides = backtest._parse_overrides(args.set)
    assert args.mode == 'conditional'
    assert args.first_gw == 10
    assert overrides == {'atf_slope': 0.2, 'form_window_gws': 4}


ARCHIVE_EXISTS = os.path.exists(
    os.path.join(os.path.dirname(__file__), '..', 'data', 'season_2025_26',
                 'manifest.json'))


@pytest.mark.skipif(not ARCHIVE_EXISTS, reason='season archive not present')
def test_real_archive_smoke():
    from capture_season import load_season_archive
    archive = load_season_archive(base_dir=os.path.join(
        os.path.dirname(__file__), '..', 'data', 'season_2025_26'))
    result = backtest.run_backtest(archive=archive, first_gw=35, last_gw=38)
    m = result['metrics']
    assert m['n_gws'] == 4
    assert m['n_rows'] > 800            # >= ~200 eligible players per GW
    assert 0.0 <= m['haul_hit_rate'] <= 1.0
    assert m['rmse'] > 0
