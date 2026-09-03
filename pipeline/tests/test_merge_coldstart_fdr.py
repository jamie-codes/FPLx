"""Season cold-start FDR regression (2026/27 GW1).

With zero finished fixtures the rolling goals-conceded proxy is 0.0 for every
team; min == max collapsed every difficulty score and both percentile
thresholds to 0.5, and _difficulty_tier's `score <= easy_threshold` branch
marked EVERY upcoming fixture 'easy' (all-green Next-5 columns in the UI).

The fix falls back to FPL's official per-fixture difficulty ratings (1-5)
whenever no fixtures have finished or the xGA spread is degenerate.
"""
from merge import merge_players, _official_fdr_fallback
from tests.test_merge import _build_minimal_inputs, _hist


class TestOfficialFdrFallback:
    def test_mapping_matches_club_form_tier_thresholds(self):
        assert _official_fdr_fallback(1) == (0.0, 'easy')
        assert _official_fdr_fallback(2) == (0.25, 'easy')
        assert _official_fdr_fallback(3) == (0.5, 'medium')
        assert _official_fdr_fallback(4) == (0.75, 'hard')
        assert _official_fdr_fallback(5) == (1.0, 'hard')

    def test_missing_difficulty_defaults_to_medium(self):
        assert _official_fdr_fallback(None) == (0.5, 'medium')


def test_coldstart_uses_official_fdr_not_all_easy():
    """Zero finished fixtures → tiers must follow FPL official difficulty."""
    history = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 11)]
    bootstrap, fixtures, understat, id_map, xmins_stats, summaries = \
        _build_minimal_inputs({1: history}, finished_gws=0)

    # No finished fixtures exist (finished_gws=0). Give the upcoming fixtures a
    # spread of official difficulties for team 14 (the player's team, at home).
    upcoming = [f for f in fixtures if not f['finished']]
    assert len(upcoming) >= 3
    upcoming[0]['team_h_difficulty'] = 2   # easy
    upcoming[1]['team_h_difficulty'] = 5   # hard (e.g. HUL vs MUN)
    upcoming[2]['team_h_difficulty'] = 3   # medium

    merged, _ = merge_players(bootstrap, fixtures, understat, id_map,
                              xmins_stats=xmins_stats, summaries=summaries)
    player = next(p for p in merged if p['id'] == 1)
    tiers = [f['difficulty_tier'] for f in player['fixtures'][:3]]

    assert tiers == ['easy', 'hard', 'medium']
    # Scores must track the official ratings too (feeds FDR++ xPts adjust).
    scores = [f['difficulty_score'] for f in player['fixtures'][:3]]
    assert scores == [0.25, 1.0, 0.5]
    # Cold-start opponent-xG prior: must be non-zero (GK save-point lambda) and
    # scale with opponent strength (harder opponent → more expected shots faced).
    opp_xgs = [f['opponent_xg_per_game'] for f in player['fixtures'][:3]]
    assert all(x > 0 for x in opp_xgs)
    assert opp_xgs[1] > opp_xgs[2] > opp_xgs[0]   # hard > medium > easy
    # Defensive difficulty uses the same direction-agnostic prior at cold start.
    assert player['fixtures'][1]['defensive_difficulty'] == 1.0


def test_early_season_blends_official_prior_with_rolling_proxy():
    """FDR blend (2026-08-28): with 2 of 6 window games played, the fixture
    score is 1/3 rolling + 2/3 official prior — not a hard cutover to a noisy
    tiny-sample proxy the moment the first result lands."""
    history = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 11)]
    bootstrap, fixtures, understat, id_map, xmins_stats, summaries = \
        _build_minimal_inputs({1: history}, finished_gws=2)

    # Non-degenerate spread: team 14 wins 3-0 twice → opponent (team 1) has the
    # max xGA (rolling score 0.0 = easiest) but only 2 games of evidence.
    for f in fixtures:
        if f['finished']:
            f['team_h_score'] = 3
            f['team_a_score'] = 0
    # Official rating says hardest (5 → prior score 1.0).
    upcoming = [f for f in fixtures if not f['finished']]
    upcoming[0]['team_h_difficulty'] = 5

    merged, _ = merge_players(bootstrap, fixtures, understat, id_map,
                              xmins_stats=xmins_stats, summaries=summaries)
    player = next(p for p in merged if p['id'] == 1)
    first = player['fixtures'][0]

    # TEAM-01 (2026-09-03): the rolling weight is now scaled by the 0.35 cap,
    # so w = 0.35 * 2/6 and the score leans further on the prior than it did.
    w = 0.35 * 2 / 6
    assert abs(first['difficulty_score'] - (w * 0.0 + (1 - w) * 1.0)) < 1e-9
    # The property this test exists to protect is unchanged: two games of
    # evidence must NOT stampede the prior. It is now protected harder.
    assert first['difficulty_score'] > 2 / 3
    # Tier thresholds still interpolate with the same w (continuity — no
    # game-count cliff). With the prior weighted more heavily, an officially
    # 'hardest' fixture now reads hard on two games instead of medium, which is
    # the intended consequence.
    assert first['difficulty_tier'] == 'hard'
    # Opponent-xG blend (3-game window, 2 played): rolling 0.0, prior 1.9 →
    # (1/3)*1.9 scaled by the venue factor — must stay positive, below prior.
    assert 0 < first['opponent_xg_per_game'] < 1.9


def test_with_real_results_and_spread_rolling_proxy_still_used():
    """Once finished fixtures produce a non-degenerate xGA spread, the rolling
    proxy (not the official rating) drives score/tier — unchanged behavior."""
    history = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 11)]
    bootstrap, fixtures, understat, id_map, xmins_stats, summaries = \
        _build_minimal_inputs({1: history}, finished_gws=10)

    # Make the xGA spread non-degenerate: team 1 (ARS, the opponent) concedes
    # heavily, team 14 concedes nothing → team 1 is the max-xGA (easiest) side.
    for f in fixtures:
        if f['finished']:
            f['team_h_score'] = 3   # team 14 scores 3 (team 1 concedes 3)
            f['team_a_score'] = 0   # team 1 scores 0 (team 14 concedes 0)
    # Official ratings say 'hard' — the rolling proxy must win when warm.
    for f in fixtures:
        if not f['finished']:
            f['team_h_difficulty'] = 5

    merged, _ = merge_players(bootstrap, fixtures, understat, id_map,
                              xmins_stats=xmins_stats, summaries=summaries)
    player = next(p for p in merged if p['id'] == 1)
    first = player['fixtures'][0]

    # TEAM-01 (2026-09-03): the rolling proxy no longer wins outright when warm.
    # It used to reach weight 1.0 and drive the score to 0.0 ('easy'); replaying
    # 2025/26 against each team's goals over the following five gameweeks showed
    # that discarding the season prior costs a lot of accuracy (attack r .145 at
    # full rolling vs .318 at the 0.35 cap), so the prior keeps 65% of the say.
    #
    # What this test protects is that the rolling proxy still MOVES the score
    # against a contrary official rating — it just no longer erases it.
    w = 0.35
    assert abs(first['difficulty_score'] - (w * 0.0 + (1 - w) * 1.0)) < 1e-9
    assert first['difficulty_score'] < 1.0, 'ten games of results must count for something'
    assert first['difficulty_tier'] == 'medium'
