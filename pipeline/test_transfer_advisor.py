"""Tests for pipeline/transfer_advisor.py — TRF-01."""

from transfer_advisor import (FREE_GAIN_MIN, HIT_GAIN_MIN, merged_to_candidates,
                              suggest_transfers)


def _c(pid, et, value, cost=50, team=1, available=True, name=None):
    return {'id': pid, 'name': name or f'P{pid}', 'element_type': et,
            'team': team, 'cost': cost, 'value': value, 'available': available}


def _squad():
    """Legal 15: 2 GK, 5 DEF, 5 MID, 3 FWD across many teams, value 4.0 each."""
    squad, pid = [], 1
    for et, n in ((1, 2), (2, 5), (3, 5), (4, 3)):
        for i in range(n):
            squad.append(_c(pid, et, value=4.0, team=pid, cost=50))
            pid += 1
    return squad


def test_recommends_clear_upgrade():
    squad = _squad()
    star = _c(100, 3, value=9.0, team=100, cost=50)
    res = suggest_transfers(squad, squad + [star], free_transfers=1)
    assert not res['hold']
    assert res['moves'][0]['in']['id'] == 100
    assert res['moves'][0]['gain'] == 5.0
    assert res['n_hits'] == 0


def test_holds_when_gain_below_bar():
    squad = _squad()
    meh = _c(100, 3, value=4.0 + FREE_GAIN_MIN - 0.1, team=100, cost=50)
    res = suggest_transfers(squad, squad + [meh], free_transfers=1)
    assert res['hold']


def test_respects_budget():
    squad = _squad()
    rich = _c(100, 3, value=20.0, team=100, cost=200)   # unaffordable
    res = suggest_transfers(squad, squad + [rich], free_transfers=1, budget=750)
    assert all(m['in']['id'] != 100 for m in res['moves'])


def test_respects_club_limit():
    squad = _squad()
    # Three squad members moved to team 99 -> a 4th team-99 player is illegal.
    for p in squad[:3]:
        p['team'] = 99
    fourth = _c(100, 3, value=20.0, team=99, cost=50)
    res = suggest_transfers(squad, squad + [fourth], free_transfers=1)
    assert all(m['in']['id'] != 100 for m in res['moves'])


def test_same_position_swaps_only():
    squad = _squad()
    gk_star = _c(100, 1, value=20.0, team=100, cost=50)
    res = suggest_transfers(squad, squad + [gk_star], free_transfers=1)
    for m in res['moves']:
        assert m['out']['element_type'] == m['in']['element_type']


def test_unavailable_never_comes_in():
    squad = _squad()
    injured_star = _c(100, 3, value=25.0, team=100, cost=50, available=False)
    res = suggest_transfers(squad, squad + [injured_star], free_transfers=1)
    assert all(m['in']['id'] != 100 for m in res['moves'])


def test_forced_sell_of_unavailable_member():
    squad = _squad()
    injured = squad[3]                  # pid 4 — a DEF (squad = 2 GK then 5 DEF)
    assert injured['element_type'] == 2
    injured['available'] = False
    sub = _c(100, 2, value=4.5, team=100, cost=50)   # modest replacement
    res = suggest_transfers(squad, squad + [sub], free_transfers=1)
    assert not res['hold']
    assert res['moves'][0]['out']['id'] == injured['id']
    assert 'forced' in res['moves'][0]['reason']


def test_free_transfer_goes_to_biggest_gain_and_hits_need_big_gains():
    squad = _squad()
    good = _c(100, 3, value=9.0, team=100, cost=50)                    # gain 5.0
    big = _c(102, 2, value=4.0 + HIT_GAIN_MIN + 2.0, team=102, cost=50)  # gain 8.0
    res = suggest_transfers(squad, squad + [good, big],
                            free_transfers=1, max_extra=2)
    in_ids = {m['in']['id'] for m in res['moves']}
    # The FREE transfer is spent on the biggest gain (8.0); the 5.0 swap is
    # then a paid hit and does NOT clear HIT_GAIN_MIN — correctly skipped.
    assert in_ids == {102}
    assert res['n_hits'] == 0


def test_hit_recommended_when_second_gain_clears_bar():
    squad = _squad()
    a = _c(100, 3, value=4.0 + HIT_GAIN_MIN + 4.0, team=100, cost=50)  # gain 10
    b = _c(101, 4, value=4.0 + HIT_GAIN_MIN + 1.0, team=101, cost=50)  # gain 7
    res = suggest_transfers(squad, squad + [a, b],
                            free_transfers=1, max_extra=2)
    in_ids = {m['in']['id'] for m in res['moves']}
    assert in_ids == {100, 101}
    assert res['n_hits'] == 1
    assert res['net_gain'] == res['predicted_gain'] - 4


def test_banked_free_transfers():
    squad = _squad()
    a = _c(100, 3, value=9.0, team=100, cost=50)
    b = _c(101, 4, value=8.0, team=101, cost=50)
    res = suggest_transfers(squad, squad + [a, b], free_transfers=2)
    assert res['n_hits'] == 0
    assert len(res['moves']) == 2


def _pool30():
    """A pool big enough for a legal 15: 4 GK, 10 DEF, 10 MID, 6 FWD."""
    pool, pid = [], 1
    for et, n in ((1, 4), (2, 10), (3, 10), (4, 6)):
        for i in range(n):
            pool.append(_c(pid, et, value=5.0 + (n - i) * 0.1, team=pid % 15,
                           cost=50))
            pid += 1
    return pool


def test_init_squad_ilp_is_legal():
    from transfer_advisor import init_squad_ilp
    ids = init_squad_ilp(_pool30(), budget=1000)
    assert len(ids) == 15


def test_advance_first_run_initialises():
    from transfer_advisor import advance_and_advise
    state, advice = advance_and_advise(None, _pool30(), current_gw=1)
    assert state['gw'] == 1
    assert len(state['squad_ids']) == 15
    assert 'moves' in advice


def test_advance_same_gw_keeps_squad():
    from transfer_advisor import advance_and_advise
    pool = _pool30()
    s1, _ = advance_and_advise(None, pool, current_gw=3)
    s2, _ = advance_and_advise(s1, pool, current_gw=3)
    assert s2['squad_ids'] == s1['squad_ids']


def test_advance_gw_boundary_commits_advised_squad():
    from transfer_advisor import advance_and_advise
    pool = _pool30()
    s1, _ = advance_and_advise(None, pool, current_gw=3)
    # New star appears -> advised squad differs from held squad.
    star = _c(999, 3, value=30.0, team=14, cost=50)
    s2, advice2 = advance_and_advise(s1, pool + [star], current_gw=3)
    assert 999 in s2['advised_squad_ids']
    assert s2['squad_ids'] == s1['squad_ids']      # not committed yet
    s3, _ = advance_and_advise(s2, pool + [star], current_gw=4)
    assert 999 in s3['squad_ids']                  # committed at the boundary


def test_merged_to_candidates_maps_fields():
    merged = [{'id': 7, 'web_name': 'Salah', 'element_type': 3, 'team': 12,
               'now_cost': 130, 'xPts_5gw': 28.4, 'xPts_1gw': 6.1,
               'status': 'a'},
              {'id': 8, 'web_name': 'Doak', 'element_type': 3, 'team': 12,
               'now_cost': 45, 'xPts_5gw': None, 'xPts_1gw': 2.0,
               'status': 'i'}]
    cands = merged_to_candidates(merged)
    assert cands[0]['value'] == 28.4 and cands[0]['available'] is True
    assert cands[1]['value'] == 2.0 and cands[1]['available'] is False
