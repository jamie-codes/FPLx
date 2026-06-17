import injury_join


def _bootstrap():
    return {'teams': [
        {'id': 1, 'name': 'Arsenal', 'short_name': 'ARS'},
        {'id': 35, 'name': 'Bournemouth', 'short_name': 'BOU'},
        {'id': 14, 'name': 'Man City', 'short_name': 'MCI'},
    ], 'elements': [
        {'id': 100, 'web_name': 'Saka', 'first_name': 'Bukayo', 'second_name': 'Saka', 'team': 1},
        {'id': 200, 'web_name': 'Christie', 'first_name': 'Ryan', 'second_name': 'Christie', 'team': 35},
        {'id': 201, 'web_name': 'Cook', 'first_name': 'Lewis', 'second_name': 'Cook', 'team': 35},
        {'id': 300, 'web_name': 'Haaland', 'first_name': 'Erling', 'second_name': 'Haaland', 'team': 14},
    ]}


def test_normalize_strips_accents_and_punctuation():
    assert injury_join._norm('C. Gakpo') == ['c', 'gakpo']
    assert injury_join._norm('Joelinton') == ['joelinton']
    assert injury_join._norm('Vitaly Janelt') == ['vitaly', 'janelt']


def test_match_player_by_surname():
    els = [e for e in _bootstrap()['elements'] if e['team'] == 35]
    assert injury_join._match_player('R. Christie', els) == 200


def test_match_player_disambiguates_by_first_initial():
    els = [{'id': 1, 'web_name': 'Smith', 'first_name': 'Adam', 'second_name': 'Smith', 'team': 9},
           {'id': 2, 'web_name': 'Smith', 'first_name': 'Bob', 'second_name': 'Smith', 'team': 9}]
    assert injury_join._match_player('B. Smith', els) == 2


def test_match_player_unmatched_returns_none():
    els = [e for e in _bootstrap()['elements'] if e['team'] == 1]
    assert injury_join._match_player('Z. Nobody', els) is None


def test_build_injury_lookup_live():
    recs = [
        {'player_id': 1125, 'player_name': 'R. Christie', 'type': 'Missing Fixture',
         'reason': 'fitness', 'team_id': 35, 'team_name': 'Bournemouth', 'date': '2025-08-15'},
        {'player_id': 9, 'player_name': 'E. Haaland', 'type': 'Questionable',
         'reason': 'knock', 'team_id': 14, 'team_name': 'Manchester City', 'date': '2025-08-15'},
    ]
    lookup = injury_join.build_injury_lookup(recs, _bootstrap())
    assert lookup[200] == {'risk': 'out', 'reason': 'fitness'}
    assert lookup[300] == {'risk': 'doubt', 'reason': 'knock'}


def test_build_injury_lookup_unmapped_team_is_skipped():
    recs = [{'player_id': 1, 'player_name': 'R. Christie', 'type': 'Missing Fixture',
             'reason': 'x', 'team_id': 999, 'team_name': 'Atlantis FC', 'date': '2025-08-15'}]
    assert injury_join.build_injury_lookup(recs, _bootstrap()) == {}


def test_build_backtest_lookup_keys_on_gw():
    archive = {'bootstrap': _bootstrap(), 'fixtures': [
        {'id': 500, 'event': 1, 'kickoff_time': '2025-08-15T19:00:00Z', 'team_h': 35, 'team_a': 1},
    ]}
    recs = [{'player_id': 1125, 'player_name': 'R. Christie', 'type': 'Missing Fixture',
             'reason': 'fitness', 'team_id': 35, 'team_name': 'Bournemouth', 'date': '2025-08-15'}]
    lookup = injury_join.build_backtest_injury_lookup(recs, archive)
    assert lookup == {(1, 200): 'out'}


def test_backtest_lookup_out_beats_doubt_same_key():
    archive = {'bootstrap': _bootstrap(), 'fixtures': [
        {'id': 500, 'event': 1, 'kickoff_time': '2025-08-15T19:00:00Z', 'team_h': 35, 'team_a': 1},
        {'id': 501, 'event': 1, 'kickoff_time': '2025-08-17T14:00:00Z', 'team_h': 1, 'team_a': 35},
    ]}
    recs = [
        {'player_id': 1, 'player_name': 'R. Christie', 'type': 'Questionable',
         'reason': 'a', 'team_id': 35, 'team_name': 'Bournemouth', 'date': '2025-08-17'},
        {'player_id': 1, 'player_name': 'R. Christie', 'type': 'Missing Fixture',
         'reason': 'b', 'team_id': 35, 'team_name': 'Bournemouth', 'date': '2025-08-15'},
    ]
    assert injury_join.build_backtest_injury_lookup(recs, archive)[(1, 200)] == 'out'


def test_overrides_force_player_id():
    recs = [{'player_id': 7, 'player_name': 'Totally Unmatchable', 'type': 'Missing Fixture',
             'reason': 'x', 'team_id': 1, 'team_name': 'Arsenal', 'date': '2025-08-15'}]
    lookup = injury_join.build_injury_lookup(recs, _bootstrap(), overrides={7: 100})
    assert lookup[100]['risk'] == 'out'


def test_coverage_report_counts_unmatched():
    recs = [
        {'player_id': 1125, 'player_name': 'R. Christie', 'type': 'Missing Fixture',
         'reason': 'x', 'team_id': 35, 'team_name': 'Bournemouth', 'date': '2025-08-15'},
        {'player_id': 9, 'player_name': 'Ghost Player', 'type': 'Missing Fixture',
         'reason': 'x', 'team_id': 1, 'team_name': 'Arsenal', 'date': '2025-08-15'},
    ]
    rep = injury_join.coverage_report(recs, _bootstrap())
    assert rep['matched'] == 1
    assert rep['unmatched'] == 1
    assert 'Ghost Player' in rep['unmatched_names']
