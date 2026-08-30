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


def test_normalize_folds_non_decomposing_diacritics():
    # ø/ð/þ/ł have no NFKD decomposition; without folding they'd be dropped,
    # breaking matches against api-football's ascii forms.
    assert injury_join._norm('Højlund') == ['hojlund']
    assert injury_join._norm('Ødegaard') == ['odegaard']
    assert injury_join._norm('Sigurðsson') == ['sigurdsson']


def test_match_player_folds_diacritic_surname():
    els = [{'id': 555, 'web_name': 'Ødegaard', 'first_name': 'Martin',
            'second_name': 'Ødegaard', 'team': 1}]
    assert injury_join._match_player('M. Odegaard', els) == 555


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


# ---------------------------------------------------------------------------
# Promoted-club resolution (2026-08-30)
#
# The join is TEAM-FIRST, so a club missing from APIFOOTBALL_TEAM_TO_FPL loses
# every one of its players at once. The table still held the 2025/26 league, so
# all 28 unmatched live records belonged to the three promoted clubs (Coventry,
# Hull, Ipswich) — 14 confirmed real FPL players. Resolution now falls back to
# a tolerant name match so a promotion can't silently disable a whole club.
# ---------------------------------------------------------------------------

def _promoted_bootstrap():
    return {'teams': [
        {'id': 40, 'name': 'Coventry City', 'short_name': 'COV'},
        {'id': 41, 'name': 'Hull City', 'short_name': 'HUL'},
        {'id': 42, 'name': 'Ipswich Town', 'short_name': 'IPS'},
    ], 'elements': [
        {'id': 180, 'web_name': 'Woolfenden', 'first_name': 'Luke',
         'second_name': 'Woolfenden', 'team': 40},
        {'id': 274, 'web_name': 'Butland', 'first_name': 'Jack',
         'second_name': 'Butland', 'team': 41},
        {'id': 318, 'web_name': 'Philogene', 'first_name': 'Jaden',
         'second_name': 'Philogene', 'team': 42},
    ]}


def test_promoted_clubs_resolve_without_a_table_entry():
    boot = _promoted_bootstrap()
    recs = [
        {'player_id': 1, 'player_name': 'L. Woolfenden', 'type': 'Missing Fixture',
         'reason': 'knee', 'team_id': 1, 'team_name': 'Coventry', 'date': '2026-08-29'},
        {'player_id': 2, 'player_name': 'J. Butland', 'type': 'Questionable',
         'reason': 'knock', 'team_id': 2, 'team_name': 'Hull City', 'date': '2026-08-29'},
        {'player_id': 3, 'player_name': 'J. Philogene', 'type': 'Missing Fixture',
         'reason': 'hamstring', 'team_id': 3, 'team_name': 'Ipswich', 'date': '2026-08-29'},
    ]
    lookup = injury_join.build_injury_lookup(recs, boot)
    assert lookup[180]['risk'] == 'out'
    assert lookup[274]['risk'] == 'doubt'
    assert lookup[318]['risk'] == 'out'


def test_coverage_report_counts_promoted_clubs_as_matched():
    boot = _promoted_bootstrap()
    recs = [{'player_id': 1, 'player_name': 'L. Woolfenden', 'type': 'Missing Fixture',
             'reason': 'knee', 'team_id': 1, 'team_name': 'Coventry', 'date': '2026-08-29'}]
    report = injury_join.coverage_report(recs, boot)
    assert report['matched'] == 1
    assert report['unmatched'] == 0


def test_unknown_club_still_unmatched():
    # The fallback must stay tolerant, not indiscriminate.
    boot = _promoted_bootstrap()
    recs = [{'player_id': 9, 'player_name': 'A. Nobody', 'type': 'Missing Fixture',
             'reason': 'x', 'team_id': 9, 'team_name': 'Real Madrid', 'date': '2026-08-29'}]
    assert injury_join.build_injury_lookup(recs, boot) == {}


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
