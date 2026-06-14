"""Tests for backtest.py (BT-02). Synthetic data only — no network, no archive."""
import pytest

import backtest


# ── synthetic archive helpers ─────────────────────────────────────────────── #

def _entry(rnd, fixture_id, minutes=90, xg=0.3, xa=0.1, pts=2, starts=1,
           was_home=True, dc=0, xgc=0.0, saves=0):
    return {
        'round': rnd, 'fixture': fixture_id, 'minutes': minutes,
        'expected_goals': str(xg), 'expected_assists': str(xa),
        'total_points': pts, 'starts': starts, 'was_home': was_home,
        'opponent_team': 2 if was_home else 1,
        'defensive_contribution': dc,
        'expected_goals_conceded': xgc,
        'saves': saves,
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


def test_conditional_mode_cameo_branch():
    """Conditional mode, m < 45 target GW: xpts_pred == sub_appear_prob.

    Variant A: all 10 prior entries have minutes=90 -> sub_appear_prob=0.0
               -> xpts_pred == 0.0 for a 30-minute target GW.
    Variant B: 2 of the last 5 prior entries have minutes=30
               -> sub_appear_prob=0.4 -> xpts_pred == 0.4.
    Both players have cum_minutes >= 270 (eligibility gate) and
    target actual_minutes=30 >= 10 (conditional-mode gate).
    """
    # ── Variant A: all prior entries are 90-minute full games ────────────────
    p_a = _std_player(10, n_gws=11)  # GW 1-11 history; target = GW 11
    # Override all 11 entries to minutes=90, starts=1
    for e in p_a['history']:
        e['minutes'] = 90
        e['starts'] = 1
    # Target GW is GW 11; prior = GW 1-10, all 90 min -> sub_appear_prob=0.0
    # Give GW 11 minutes=30 (cameo) so the m<45 branch fires
    p_a['history'][10]['minutes'] = 30  # GW 11 entry

    arch_a = _make_archive(n_gws=11, players=[p_a])
    r_a = backtest.run_backtest(archive=arch_a, mode='conditional',
                                first_gw=11, last_gw=11)
    assert len(r_a['rows']) == 1
    row_a = r_a['rows'][0]
    assert row_a['xpts_pred'] == pytest.approx(0.0), (
        f"Variant A: expected xpts_pred=0.0, got {row_a['xpts_pred']}")

    # ── Variant B: 2 of the last 5 prior entries are cameos (minutes=30) ─────
    # GW 1-10 prior, GW 11 target (minutes=30)
    # Make GW 9 and GW 10 cameos so they fall in the last-5 window
    # Last 5 prior = GW 6-10; set GW 9, 10 to minutes=30
    p_b = _std_player(11, n_gws=11)
    for e in p_b['history']:
        e['minutes'] = 90
        e['starts'] = 1
    p_b['history'][8]['minutes'] = 30   # GW 9
    p_b['history'][8]['starts'] = 0
    p_b['history'][9]['minutes'] = 30   # GW 10
    p_b['history'][9]['starts'] = 0
    # Target GW 11: minutes=30 (cameo)
    p_b['history'][10]['minutes'] = 30

    arch_b = _make_archive(n_gws=11, players=[p_b])
    r_b = backtest.run_backtest(archive=arch_b, mode='conditional',
                                first_gw=11, last_gw=11)
    assert len(r_b['rows']) == 1
    row_b = r_b['rows'][0]
    # last 5 prior entries (GW 6-10): GW 9 and GW 10 have 0<m<45 -> 2/5 = 0.4
    assert row_b['xpts_pred'] == pytest.approx(0.4), (
        f"Variant B: expected xpts_pred=0.4, got {row_b['xpts_pred']}")


import os


# ── DefCon (dc_rate) tests ────────────────────────────────────────────────── #

def test_dc_rates_strictly_prior():
    """dc_rate_12 at GW 8 uses only GW 1-7; inflating GW 8 changes nothing.
    Games with minutes < 60 are excluded from the denominator."""
    # Build 12-GW history: dc=12 for GWs 1-7, dc=0 for GWs 8-12, all 90 min.
    hist = [_entry(g, g, minutes=90, dc=(12 if g <= 7 else 0))
            for g in range(1, 13)]

    sig8 = backtest.build_asof_signals(hist, 8, _params())
    assert sig8['dc_rate_12'] == pytest.approx(1.0)
    assert sig8['dc_rate_10'] == pytest.approx(1.0)

    # At GW 10, prior is GW 1-9: dc=12 for 1-7, dc=0 for 8-9 → 7/9
    sig10 = backtest.build_asof_signals(hist, 10, _params())
    assert sig10['dc_rate_12'] == pytest.approx(7 / 9)

    # Inflating GW 8's dc does NOT change GW-8 signals (leakage check)
    hist_inflated = [dict(e) for e in hist]
    hist_inflated[7]['defensive_contribution'] = 99
    sig8_infl = backtest.build_asof_signals(hist_inflated, 8, _params())
    assert sig8_infl['dc_rate_12'] == pytest.approx(sig8['dc_rate_12'])

    # Games with minutes < 60 must be excluded from denominator.
    # Build history where GW 3 has minutes=30 (excluded) and dc=12.
    hist_short = [_entry(g, g, minutes=(30 if g == 3 else 90),
                         dc=12) for g in range(1, 9)]
    sig8_short = backtest.build_asof_signals(hist_short, 8, _params())
    # Prior GWs 1-7: 6 with >=60 min (GW 3 excluded), all dc=12 → 6/6 = 1.0
    assert sig8_short['dc_rate_12'] == pytest.approx(1.0)

    # Edge: no prior 60+ min games -> both rates 0.0
    hist_none = [_entry(g, g, minutes=30, dc=12) for g in range(1, 5)]
    sig5 = backtest.build_asof_signals(hist_none, 5, _params())
    assert sig5['dc_rate_10'] == pytest.approx(0.0)
    assert sig5['dc_rate_12'] == pytest.approx(0.0)


def test_defcon_scale_zero_is_noop():
    """run_backtest with defcon_scale=0.0 (default) must produce identical rows
    to a run with the key entirely absent from params."""
    arch = _make_archive(players=[_std_player(1)])
    r_default = backtest.run_backtest(archive=arch, first_gw=8, last_gw=10)
    r_explicit = backtest.run_backtest(archive=arch, first_gw=8, last_gw=10,
                                       params={'defcon_scale': 0.0})
    # Compare row by row
    rows_d = sorted(r_default['rows'], key=lambda r: (r['gw'], r['player_id']))
    rows_e = sorted(r_explicit['rows'], key=lambda r: (r['gw'], r['player_id']))
    assert len(rows_d) == len(rows_e)
    for rd, re in zip(rows_d, rows_e):
        assert rd['xpts_pred'] == re['xpts_pred']


def test_defcon_scale_adds_ev_for_def():
    """A DEF (element_type 2) with all prior games dc=10, 90 min.
    With defcon_scale=1.0, xpts_pred increases by exactly 2.0 vs scale=0.0
    (deploy mode, xmins=90 → mins_factor=1.0, dc_rate_10=1.0 for DEF)."""
    # Build a DEF player with 12 GWs of history, dc=10, 90 min each.
    hist = [_entry(g, 100 + g, minutes=90, dc=10) for g in range(1, 13)]
    player = {'id': 42, 'element_type': 2, 'history': hist}
    arch = _make_archive(players=[player])

    r_base = backtest.run_backtest(archive=arch, first_gw=8, last_gw=8,
                                   params={'defcon_scale': 0.0})
    r_dc = backtest.run_backtest(archive=arch, first_gw=8, last_gw=8,
                                 params={'defcon_scale': 1.0})

    assert len(r_base['rows']) == 1
    assert len(r_dc['rows']) == 1
    base_pred = r_base['rows'][0]['xpts_pred']
    dc_pred = r_dc['rows'][0]['xpts_pred']
    assert dc_pred == pytest.approx(base_pred + 2.0, abs=1e-9)


def test_defcon_thresholds_by_position():
    """MID threshold is 12 (not 10); GKP gains nothing regardless.
    MID with all dc=10 (below threshold): no gain.
    MID with all dc=12 (at threshold): gains exactly 2.0.
    GKP with all dc=10: no gain (et==1 → 0.0)."""
    def _player(pid, et, dc_val):
        hist = [_entry(g, 100 + g, minutes=90, dc=dc_val)
                for g in range(1, 13)]
        return {'id': pid, 'element_type': et, 'history': hist}

    # MID dc=10 (below threshold)
    arch_mid10 = _make_archive(players=[_player(1, 3, 10)])
    r_mid10_base = backtest.run_backtest(archive=arch_mid10, first_gw=8, last_gw=8,
                                         params={'defcon_scale': 0.0})
    r_mid10_dc = backtest.run_backtest(archive=arch_mid10, first_gw=8, last_gw=8,
                                       params={'defcon_scale': 1.0})
    assert (r_mid10_dc['rows'][0]['xpts_pred']
            == pytest.approx(r_mid10_base['rows'][0]['xpts_pred']))

    # MID dc=12 (at threshold → dc_rate_12=1.0 → gains 2.0)
    arch_mid12 = _make_archive(players=[_player(2, 3, 12)])
    r_mid12_base = backtest.run_backtest(archive=arch_mid12, first_gw=8, last_gw=8,
                                         params={'defcon_scale': 0.0})
    r_mid12_dc = backtest.run_backtest(archive=arch_mid12, first_gw=8, last_gw=8,
                                       params={'defcon_scale': 1.0})
    assert (r_mid12_dc['rows'][0]['xpts_pred']
            == pytest.approx(r_mid12_base['rows'][0]['xpts_pred'] + 2.0,
                             abs=1e-9))

    # GKP dc=10: no gain (et==1)
    arch_gkp = _make_archive(players=[_player(3, 1, 10)])
    r_gkp_base = backtest.run_backtest(archive=arch_gkp, first_gw=8, last_gw=8,
                                       params={'defcon_scale': 0.0})
    r_gkp_dc = backtest.run_backtest(archive=arch_gkp, first_gw=8, last_gw=8,
                                     params={'defcon_scale': 1.0})
    assert (r_gkp_dc['rows'][0]['xpts_pred']
            == pytest.approx(r_gkp_base['rows'][0]['xpts_pred']))


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


# ── fixture_attack_slope tests ────────────────────────────────────────────── #

def test_fixture_attack_slope_zero_noop():
    """fixture_attack_slope absent vs 0.0 must give identical predictions."""
    arch = _make_archive(players=[_std_player(1)])
    r_default = backtest.run_backtest(archive=arch, first_gw=8, last_gw=10)
    r_explicit = backtest.run_backtest(archive=arch, first_gw=8, last_gw=10,
                                       params={'fixture_attack_slope': 0.0})
    rows_d = sorted(r_default['rows'], key=lambda r: (r['gw'], r['player_id']))
    rows_e = sorted(r_explicit['rows'], key=lambda r: (r['gw'], r['player_id']))
    assert len(rows_d) == len(rows_e)
    for rd, re in zip(rows_d, rows_e):
        assert rd['xpts_pred'] == re['xpts_pred']


def test_fixture_attack_slope_direction():
    """Easy fixture (difficulty=2 -> 0.25 < 0.5) boosts xpts with slope>0;
    hard fixture (difficulty=5 -> 1.0) penalises it."""
    # Build an archive with two differently-difficult versions of fixture 108
    def _arch_with_difficulty(diff):
        arch = _make_archive(players=[_std_player(1)])
        for f in arch['fixtures']:
            if f['event'] == 8:
                f['team_h_difficulty'] = diff
                f['team_a_difficulty'] = diff
        return arch

    arch_easy = _arch_with_difficulty(2)   # difficulty = (2-1)/4 = 0.25
    arch_hard = _arch_with_difficulty(5)   # difficulty = (5-1)/4 = 1.0

    r_slope0_easy = backtest.run_backtest(archive=arch_easy, first_gw=8, last_gw=8,
                                          params={'fixture_attack_slope': 0.0})
    r_slope_easy = backtest.run_backtest(archive=arch_easy, first_gw=8, last_gw=8,
                                         params={'fixture_attack_slope': 0.4})

    r_slope0_hard = backtest.run_backtest(archive=arch_hard, first_gw=8, last_gw=8,
                                          params={'fixture_attack_slope': 0.0})
    r_slope_hard = backtest.run_backtest(archive=arch_hard, first_gw=8, last_gw=8,
                                         params={'fixture_attack_slope': 0.4})

    # Easy fixture: slope should boost attacking EV
    assert r_slope_easy['rows'][0]['xpts_pred'] > r_slope0_easy['rows'][0]['xpts_pred']
    # Hard fixture: slope should penalise attacking EV
    assert r_slope_hard['rows'][0]['xpts_pred'] < r_slope0_hard['rows'][0]['xpts_pred']


# ── build_team_xgc_lookup tests ───────────────────────────────────────────── #

def _make_xgc_archive(n_gws=8):
    """Two teams (1, 2); team-1 players have xgc=2.0, team-2 players xgc=0.5.
    fixture id = 100+gw for each GW."""
    fixtures = []
    for g in range(1, n_gws + 1):
        fixtures.append({
            'id': 100 + g, 'event': g, 'team_h': 1, 'team_a': 2,
            'team_h_score': 1, 'team_a_score': 1, 'finished': True,
            'team_h_difficulty': 3, 'team_a_difficulty': 3,
        })

    # Two players: one for each team. Their entries carry expected_goals_conceded.
    def _xgc_player(pid, team, xgc_val):
        hist = []
        for g in range(1, n_gws + 1):
            e = _entry(g, 100 + g, was_home=(team == 1), xgc=xgc_val)
            e['round'] = g
            e['fixture'] = 100 + g
            hist.append(e)
        return {'id': pid, 'element_type': 4, 'team': team, 'history': hist}

    players = [_xgc_player(1, 1, 2.0), _xgc_player(2, 2, 0.5)]
    elements = [{'id': p['id'], 'element_type': p['element_type'],
                 'team': p['team'], 'web_name': f"P{p['id']}"}
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


def test_build_team_xgc_lookup_strictly_prior_and_normalised():
    """Team 1 has xgc=2.0 each GW; team 2 has xgc=0.5.
    At GW 5: lookup[(5,1)]==1.0 (worst), lookup[(5,2)]==0.0 (best).
    Values at GW g are unaffected by inflating GW g's xgc.
    Cold start (GW 1) returns 0.5."""
    arch = _make_xgc_archive(n_gws=8)

    lookup = backtest.build_team_xgc_lookup(arch, window_gws=6)

    # GW 5: team 1 worst (2.0 mean), team 2 best (0.5 mean)
    assert lookup[(5, 1)] == pytest.approx(1.0)
    assert lookup[(5, 2)] == pytest.approx(0.0)

    # Cold start: GW 1 has no prior data -> 0.5
    assert lookup[(1, 1)] == pytest.approx(0.5)
    assert lookup[(1, 2)] == pytest.approx(0.5)

    # Leakage check: inflating GW 5 entries must not change GW 5 lookup values
    arch2 = _make_xgc_archive(n_gws=8)
    for pid in [1, 2]:
        for e in arch2['summaries'][pid]['history']:
            if e['round'] == 5:
                e['expected_goals_conceded'] = 99.0
    lookup2 = backtest.build_team_xgc_lookup(arch2, window_gws=6)
    assert lookup2[(5, 1)] == pytest.approx(lookup[(5, 1)])
    assert lookup2[(5, 2)] == pytest.approx(lookup[(5, 2)])


def test_use_xgc_def_form_switches_source():
    """With cs_team_form_slope=0.2, predictions differ between use_xgc_def_form=0
    and 1 when goals conceded are equal but xGC values differ across teams.

    Uses element_type=2 (DEF) so CS points are included and ncr change is visible.
    """
    # Both teams concede exactly 1 goal/game (equal goals -> def_form will be 0.5
    # for both; but xgc: team 1 = 2.0, team 2 = 0.5).
    # Player 1 is on team 1 (DEF). With use_xgc_def_form=1, team 1 appears leakier
    # (xgc 2.0 >> 0.5), which reduces CS prob -> lower xpts_pred.
    def _make_def_xgc_archive(n_gws=12):
        """Like _make_xgc_archive but players are element_type=2 (DEF)."""
        fixtures = []
        for g in range(1, n_gws + 1):
            fixtures.append({
                'id': 100 + g, 'event': g, 'team_h': 1, 'team_a': 2,
                'team_h_score': 1, 'team_a_score': 1, 'finished': True,
                'team_h_difficulty': 3, 'team_a_difficulty': 3,
            })

        def _xgc_player(pid, team, xgc_val):
            hist = []
            for g in range(1, n_gws + 1):
                e = _entry(g, 100 + g, was_home=(team == 1), xgc=xgc_val)
                e['round'] = g
                e['fixture'] = 100 + g
                hist.append(e)
            return {'id': pid, 'element_type': 2, 'team': team, 'history': hist}

        players = [_xgc_player(1, 1, 2.0), _xgc_player(2, 2, 0.5)]
        elements = [{'id': p['id'], 'element_type': p['element_type'],
                     'team': p['team'], 'web_name': f"P{p['id']}"}
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

    arch = _make_def_xgc_archive(n_gws=12)
    # Goals scores/conceded are equal (1-1 each game); only cs_team_form_slope matters.
    params_goals = {'cs_team_form_slope': 0.2, 'use_xgc_def_form': 0.0}
    params_xgc = {'cs_team_form_slope': 0.2, 'use_xgc_def_form': 1.0}

    r_goals = backtest.run_backtest(archive=arch, first_gw=8, last_gw=8,
                                    params=params_goals)
    r_xgc = backtest.run_backtest(archive=arch, first_gw=8, last_gw=8,
                                  params=params_xgc)

    # With equal goal concedes, def_form gives both teams 0.5 (no penalty).
    # With xgc, team 1 (xgc=2.0) >> team 2 (xgc=0.5): team 1 gets higher ncr,
    # reducing its CS prob -> lower xpts for team 1's DEF player.
    rows_goals = {r['player_id']: r for r in r_goals['rows']}
    rows_xgc = {r['player_id']: r for r in r_xgc['rows']}
    assert rows_xgc[1]['xpts_pred'] != rows_goals[1]['xpts_pred']


# ── xmins_halflife tests ──────────────────────────────────────────────────── #

def test_xmins_halflife_zero_noop():
    """xmins_halflife absent vs explicitly 0.0 must yield identical signals."""
    hist = _uniform_history(10)
    sig_default = backtest.build_asof_signals(hist, 11, _params())
    sig_explicit = backtest.build_asof_signals(hist, 11, _params(xmins_halflife=0.0))
    assert sig_default['xmins'] == sig_explicit['xmins']
    assert sig_default['start_prob'] == sig_explicit['start_prob']
    assert sig_default['mins_60_prob'] == sig_explicit['mins_60_prob']
    assert sig_default['sub_appear_prob'] == sig_explicit['sub_appear_prob']


def test_xmins_halflife_weights_recent():
    """Last 5 entries = [90,90,90,0,0] (most recent two are zeros).
    Plain mean xmins = 54; halflife=2 weights recent more -> xmins < 54.
    Exact weighted value computed with exponential weights 0.5**(age/halflife)
    where age=0 is most recent."""
    import math
    # Build history: GW 1-10; last five are GW 6-10 minutes = [90,90,90,0,0]
    hist = []
    for g in range(1, 11):
        if g <= 5:
            m = 90
        elif g <= 8:
            m = 90
        else:
            m = 0   # GW 9 and 10 are benched
        hist.append(_entry(g, g, minutes=m, starts=1 if m else 0))
    # Verify plain mean: last 5 = GW 6-10 = [90,90,90,0,0] -> mean = 54
    sig_plain = backtest.build_asof_signals(hist, 11, _params(xmins_halflife=0.0))
    assert sig_plain['xmins'] == pytest.approx(54.0)

    # With halflife=2: ages for most-recent-first [0,90,90,90,90] is wrong.
    # most-recent-first for last 5 (GW 6-10) = [GW10=0, GW9=0, GW8=90, GW7=90, GW6=90]
    # ages = [0, 1, 2, 3, 4]
    halflife = 2.0
    minutes = [0, 0, 90, 90, 90]  # most-recent-first
    weights = [0.5 ** (age / halflife) for age in range(5)]
    # w = [1.0, 0.7071, 0.5, 0.3536, 0.25]
    sum_w = sum(weights)
    expected_xmins = sum(m * w for m, w in zip(minutes, weights)) / sum_w

    sig_hl = backtest.build_asof_signals(hist, 11, _params(xmins_halflife=halflife))
    assert sig_hl['xmins'] < 54.0
    assert sig_hl['xmins'] == pytest.approx(expected_xmins, rel=1e-3)


# ── gk_saves_scale tests ──────────────────────────────────────────────────── #

def test_saves_per90_prior_only():
    """GK with saves=3 per 90-min game; saves_per90 at target GW == 3.0.
    Inflating saves in the target GW itself must not change the signal."""
    # History: GW 1-10 with 90 min, saves=3 each
    hist = [_entry(g, g, minutes=90, saves=3) for g in range(1, 11)]
    sig_at_11 = backtest.build_asof_signals(hist, 11, _params())
    assert sig_at_11['saves_per90'] == pytest.approx(3.0)

    # Inflate GW 11's saves (target GW); signal at GW 11 must be unchanged
    hist_inflated = [dict(e) for e in hist]
    hist_inflated.append(_entry(11, 11, minutes=90, saves=99))
    sig_inflated = backtest.build_asof_signals(hist_inflated, 11, _params())
    assert sig_inflated['saves_per90'] == pytest.approx(3.0)


def test_gk_saves_scale_adds_ev_only_for_gkp():
    """GKP (et=1) with saves_per90=3, xmins=90, neutral opp (atf_form 0.5):
    scale=1.0 adds exactly 1.0 to xpts_pred vs scale=0.0.
    FWD (et=4) with same setup gains nothing."""
    # Build archive with a GKP and a FWD, both with saves=3 per prior game.
    # Use neutral fixture difficulty=3 (difficulty=(3-1)/4=0.5).
    # atf_form will be 0.5 (equal goals scored by both teams).
    def _player_with_saves(pid, et):
        hist = [_entry(g, 100 + g, minutes=90, saves=3, was_home=True)
                for g in range(1, 13)]
        return {'id': pid, 'element_type': et, 'history': hist}

    arch = _make_archive(players=[
        _player_with_saves(1, 1),   # GKP
        _player_with_saves(2, 4),   # FWD
    ])

    r_base = backtest.run_backtest(archive=arch, first_gw=8, last_gw=8,
                                   params={'gk_saves_scale': 0.0})
    r_scale = backtest.run_backtest(archive=arch, first_gw=8, last_gw=8,
                                    params={'gk_saves_scale': 1.0})

    rows_base = {r['player_id']: r for r in r_base['rows']}
    rows_scale = {r['player_id']: r for r in r_scale['rows']}

    # GKP: opp_attack = 0.5, save_ev = (3/3) * (90/90) * (0.5 + 0.5) * 1.0 = 1.0
    assert rows_scale[1]['xpts_pred'] == pytest.approx(
        rows_base[1]['xpts_pred'] + 1.0, abs=1e-6)

    # FWD: no change
    assert rows_scale[2]['xpts_pred'] == pytest.approx(
        rows_base[2]['xpts_pred'], abs=1e-6)


# ── ODDS-01 blend tests ───────────────────────────────────────────────────── #

def test_cs_prob_odds_blend_noop_at_zero_weight():
    from merge import _cs_prob
    base = _cs_prob(0.5, 90.0, cs_prob_base=0.40, cs_prob_slope=0.30)
    blended = _cs_prob(0.5, 90.0, cs_prob_base=0.40, cs_prob_slope=0.30,
                       odds_cs_prob=0.9, odds_cs_weight=0.0)
    assert base == blended  # weight 0 -> identical


def test_cs_prob_odds_blend_full_weight_uses_market():
    from merge import _cs_prob
    # full weight: cs_prob_raw becomes the market prob, then x minutes factor (=1 at 90')
    out = _cs_prob(0.5, 90.0, mins_60_prob=1.0,
                   odds_cs_prob=0.55, odds_cs_weight=1.0)
    assert abs(out - 0.55) < 1e-9


def test_run_backtest_noop_when_no_odds_lookup():
    from backtest import run_backtest
    from capture_season import load_season_archive
    archive = load_season_archive()
    base = run_backtest(archive, mode='deploy')
    same = run_backtest(archive, mode='deploy', odds_lookup=None)
    assert base['metrics'] == same['metrics']


def test_run_backtest_odds_weight_zero_matches_baseline():
    from backtest import run_backtest
    from capture_season import load_season_archive
    from odds_client import parse_odds_csv, SNAPSHOT_PATH
    from odds_join import build_odds_lookup
    archive = load_season_archive()
    lk = build_odds_lookup(parse_odds_csv(open(SNAPSHOT_PATH, encoding='utf-8').read()), archive)
    base = run_backtest(archive, mode='deploy')
    # lookup present but both weights 0 -> identical to baseline
    same = run_backtest(archive, params={'odds_cs_weight': 0.0, 'odds_goalexp_weight': 0.0},
                        mode='deploy', odds_lookup=lk)
    assert base['metrics'] == same['metrics']


def test_run_backtest_odds_cs_weight_changes_metrics():
    from backtest import run_backtest
    from capture_season import load_season_archive
    from odds_client import parse_odds_csv, SNAPSHOT_PATH
    from odds_join import build_odds_lookup
    archive = load_season_archive()
    lk = build_odds_lookup(parse_odds_csv(open(SNAPSHOT_PATH, encoding='utf-8').read()), archive)
    base = run_backtest(archive, mode='deploy')
    blended = run_backtest(archive, params={'odds_cs_weight': 1.0}, mode='deploy', odds_lookup=lk)
    assert base['metrics'] != blended['metrics']  # CS blend moves predictions
