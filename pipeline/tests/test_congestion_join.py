from congestion_join import build_congestion_lookup


def _fix(fid, gw, h, a, kickoff):
    return {'id': fid, 'event': gw, 'team_h': h, 'team_a': a, 'kickoff_time': kickoff}


def test_euro_3_days_before_is_clash():
    # team 12 plays a midweek match Thu 2025-09-18; PL fixture Sun 2025-09-21 (3 days)
    cal = {12: ['2025-09-18']}
    fixtures = [_fix(100, 6, 12, 4, '2025-09-21T15:00:00Z')]
    clashes = build_congestion_lookup(cal, fixtures)
    assert (12, 6) in clashes
    assert (4, 6) not in clashes  # opponent had no midweek match


def test_six_days_before_is_not_clash():
    cal = {12: ['2025-09-15']}
    fixtures = [_fix(100, 6, 12, 4, '2025-09-21T15:00:00Z')]
    assert build_congestion_lookup(cal, fixtures) == set()


def test_same_day_or_after_is_not_clash():
    cal = {12: ['2025-09-21'], 4: ['2025-09-23']}  # same day; after
    fixtures = [_fix(100, 6, 12, 4, '2025-09-21T15:00:00Z')]
    assert build_congestion_lookup(cal, fixtures) == set()


def test_away_team_clash_detected():
    cal = {4: ['2025-09-18']}  # the away team had the midweek match
    fixtures = [_fix(100, 6, 12, 4, '2025-09-21T15:00:00Z')]
    clashes = build_congestion_lookup(cal, fixtures)
    assert (4, 6) in clashes


def test_window_bounds_1_and_4():
    cal = {12: ['2025-09-20', '2025-09-17']}  # 1 day before, 4 days before
    fixtures = [_fix(100, 6, 12, 4, '2025-09-21T15:00:00Z')]
    assert (12, 6) in build_congestion_lookup(cal, fixtures)  # both within 1..4
