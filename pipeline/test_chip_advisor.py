"""Tests for pipeline/chip_advisor.py — CHP-01."""

from chip_advisor import (BB_CONSIDER, BB_PLAY, TC_PLAY, build_chip_advice)


def _merged_team(tid, n_fixtures, gw):
    return {'id': tid * 100, 'team': tid,
            'fixtures': [{'event_id': gw} for _ in range(n_fixtures)]}


def _ledger(tc=6.0, bb=8.0, xi=55.0):
    return {'chip_signals': {'tc_value': tc, 'bb_value': bb, 'xi_xpts': xi},
            'model_xi': [{}] * 11, 'bench': [{}] * 4,
            'captain_shadow': {'xi_top_xpts': {'name': 'Haaland'}}}


def test_quiet_gw_holds_everything():
    merged = [_merged_team(t, 1, 30) for t in range(1, 21)]
    advice = build_chip_advice(merged, _ledger(), 30)
    chips = advice['chips']
    assert chips['bench_boost']['signal'] == 'hold'
    assert chips['triple_captain']['signal'] == 'hold'
    assert chips['free_hit']['signal'] == 'hold'


def test_big_bench_value_triggers_bb():
    merged = [_merged_team(t, 1, 30) for t in range(1, 21)]
    advice = build_chip_advice(merged, _ledger(bb=BB_PLAY + 1), 30)
    assert advice['chips']['bench_boost']['signal'] == 'play'


def test_dgw_upgrades_bb_consider_to_play():
    merged = ([_merged_team(t, 2, 30) for t in range(1, 5)]      # 4 DGW teams
              + [_merged_team(t, 1, 30) for t in range(5, 21)])
    advice = build_chip_advice(merged, _ledger(bb=BB_CONSIDER + 0.5), 30)
    assert advice['dgw_team_count'] == 4
    assert advice['chips']['bench_boost']['signal'] == 'play'


def test_elite_captain_triggers_tc():
    merged = [_merged_team(t, 1, 30) for t in range(1, 21)]
    advice = build_chip_advice(merged, _ledger(tc=TC_PLAY + 0.5), 30)
    tc = advice['chips']['triple_captain']
    assert tc['signal'] == 'play'
    assert tc['captain'] == 'Haaland'


def test_blank_gw_triggers_free_hit():
    merged = ([_merged_team(t, 0, 30) for t in range(1, 6)]      # 5 blanking
              + [_merged_team(t, 1, 30) for t in range(6, 21)])
    advice = build_chip_advice(merged, _ledger(), 30)
    assert advice['bgw_team_count'] == 5
    assert advice['chips']['free_hit']['signal'] == 'play'


def test_wildcard_always_informational():
    merged = [_merged_team(t, 1, 30) for t in range(1, 21)]
    advice = build_chip_advice(merged, _ledger(), 30)
    assert advice['chips']['wildcard']['signal'] == 'informational'


def test_missing_ledger_is_safe():
    merged = [_merged_team(t, 1, 30) for t in range(1, 21)]
    advice = build_chip_advice(merged, None, 30)
    assert advice['chips']['bench_boost']['signal'] == 'hold'
