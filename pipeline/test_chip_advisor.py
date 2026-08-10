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


def _team_with_calendar(tid, gw_fixture_counts):
    """gw_fixture_counts: {gw: n_fixtures}. Builds one team's fixtures across GWs."""
    fixtures = []
    for gw, n in gw_fixture_counts.items():
        fixtures.extend({'event_id': gw} for _ in range(n))
    return {'id': tid * 100, 'team': tid, 'fixtures': fixtures}


def test_horizon_stops_at_max_scheduled_gw():
    # Calendar runs GW30..35 only (every team one fixture per GW, none past 35).
    merged = [_team_with_calendar(t, {g: 1 for g in range(30, 36)}) for t in range(1, 21)]
    advice = build_chip_advice(merged, _ledger(), 30)
    assert advice['horizon_start'] == 30
    assert advice['horizon_end'] == 35            # NOT 38 — nothing scheduled past 35
    # No chip has any window at 36-38 (past-horizon zero-fixtures are not blanks).
    for chip in ('bench_boost', 'triple_captain', 'free_hit'):
        for w in advice['chips'][chip]['windows']:
            assert w['end_gw'] <= 35


def test_bench_boost_window_on_dgw_cluster():
    # Base single fixtures GW30..35; GW34 & GW35 are DGWs for 6 teams (contiguous).
    merged = []
    for t in range(1, 21):
        cal = {g: 1 for g in range(30, 36)}
        if t <= 6:
            cal[34] = 2; cal[35] = 2
        merged.append(_team_with_calendar(t, cal))
    advice = build_chip_advice(merged, _ledger(), 30)
    bb = advice['chips']['bench_boost']['windows']
    assert len(bb) == 1
    assert bb[0]['start_gw'] == 34 and bb[0]['end_gw'] == 35   # contiguous merge
    assert bb[0]['strength'] == 'play'                         # 6 DGW teams >= strong
    # Triple Captain uses the same DGW basis → also gets the window.
    assert advice['chips']['triple_captain']['windows'][0]['start_gw'] == 34


def test_free_hit_window_on_blank_gw():
    # GW33 is a blank for 5 teams (0 fixtures that GW); calendar GW30..35.
    merged = []
    for t in range(1, 21):
        cal = {g: 1 for g in range(30, 36)}
        if t <= 5:
            cal[33] = 0
        merged.append(_team_with_calendar(t, cal))
    advice = build_chip_advice(merged, _ledger(), 30)
    fh = advice['chips']['free_hit']['windows']
    assert any(w['start_gw'] == 33 and w['strength'] == 'play' for w in fh)


def test_no_windows_on_flat_calendar():
    # Every team exactly one fixture per GW 30..35 — no doubles, no blanks.
    merged = [_team_with_calendar(t, {g: 1 for g in range(30, 36)}) for t in range(1, 21)]
    advice = build_chip_advice(merged, _ledger(), 30)
    assert advice['chips']['bench_boost']['windows'] == []
    assert advice['chips']['triple_captain']['windows'] == []
    assert advice['chips']['free_hit']['windows'] == []


def test_no_false_blank_from_truncated_team_horizon():
    # 15 singles teams have fixtures every GW30..38 (one each) — real horizon to 38.
    # 5 "doubled-early" teams' fixture lists end at GW34 (e.g. an early confirmed
    # double consumed list capacity) — nothing scheduled at GW35-38 for them, but
    # that's list truncation, NOT a real blank: those teams simply aren't in the
    # scanned range past their own horizon.
    merged = [_team_with_calendar(t, {g: 1 for g in range(30, 39)}) for t in range(1, 16)]
    merged += [_team_with_calendar(t, {g: 1 for g in range(30, 35)}) for t in range(16, 21)]
    advice = build_chip_advice(merged, _ledger(), 30)
    assert advice['horizon_end'] == 38            # global max still spans to GW38
    fh = advice['chips']['free_hit']['windows']
    # The 5 short-horizon teams must NOT be counted as blanks at GW35-38, so no
    # false Free Hit window should appear in that tail.
    assert not any(w['start_gw'] >= 35 for w in fh)


def test_wildcard_never_gets_windows():
    merged = []
    for t in range(1, 21):
        cal = {g: 1 for g in range(30, 36)}
        if t <= 8:
            cal[34] = 2
        merged.append(_team_with_calendar(t, cal))
    advice = build_chip_advice(merged, _ledger(), 30)
    assert advice['chips']['wildcard']['windows'] == []
