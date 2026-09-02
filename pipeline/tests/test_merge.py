"""Unit tests for pipeline/merge.py form-signal field write and blend integration (Phase 42, ACC-01).

Wave 0 RED — these will fail until Task 3 wires the form signal write
and Task 4 wires the blend into _xpts_ngw inputs.
"""

import pytest
from merge import merge_players, _cs_prob, _compute_xpts_fixture, _cs_prob_1gw_for_fixtures, _compute_differential_flag


class TestCsProbKwargs:
    def test_default_values_unchanged(self):
        """Default call must produce same result as before — backward compat."""
        result = _cs_prob(0.5, 60.0)
        # cs_prob_raw = max(0.10, min(0.65, 0.40 - 0.5*0.30)) = 0.25; mins_factor = 1.0
        assert abs(result - 0.25) < 1e-9

    def test_custom_base_raises_cs_prob(self):
        """Higher cs_prob_base → higher cs_prob output."""
        default = _cs_prob(0.0, 90.0)
        custom  = _cs_prob(0.0, 90.0, cs_prob_base=0.55)
        assert custom > default

    def test_custom_slope_changes_sensitivity(self):
        """Lower cs_prob_slope → less sensitive to difficulty."""
        low_slope  = _cs_prob(1.0, 90.0, cs_prob_slope=0.15)
        high_slope = _cs_prob(1.0, 90.0, cs_prob_slope=0.40)
        assert low_slope > high_slope

    def test_clamp_still_applies_with_custom_params(self):
        """Result must stay in [0.10, 0.65] regardless of params."""
        result = _cs_prob(1.0, 90.0, cs_prob_base=0.10, cs_prob_slope=0.40)
        assert result >= 0.10

    def test_compute_xpts_fixture_forwards_cs_prob_kwargs(self):
        """Different cs_prob_base values must produce different cs_pts."""
        low  = _compute_xpts_fixture(0.2, 0.1, 1.0, 90.0, 2, 0.5, cs_prob_base=0.25)
        high = _compute_xpts_fixture(0.2, 0.1, 1.0, 90.0, 2, 0.5, cs_prob_base=0.55)
        assert high['cs_pts'] > low['cs_pts']

    def test_compute_xpts_fixture_default_unchanged(self):
        """Calling without kwargs must produce identical result to before."""
        result = _compute_xpts_fixture(0.3, 0.1, 1.0, 90.0, 3, 0.4)
        assert result['total'] > 0  # sanity; exact value comes from existing tests

    def test_cs_prob_1gw_for_fixtures_forwards_kwargs(self):
        """cs_prob_1gw_for_fixtures must forward cs_prob_base/slope to _cs_prob."""
        # Build a minimal fixtures list: one GW, one fixture
        fixtures = [{'event_id': 1, 'defensive_difficulty': 0.0}]
        lo = _cs_prob_1gw_for_fixtures(fixtures, 90.0, cs_prob_base=0.25)
        hi = _cs_prob_1gw_for_fixtures(fixtures, 90.0, cs_prob_base=0.55)
        assert hi > lo


def _hist(round_, minutes, total_points, xg=0.0, xa=0.0):
    return {
        'round': round_,
        'minutes': minutes,
        'total_points': total_points,
        'expected_goals': xg,
        'expected_assists': xa,
        'goals_scored': 0,
        'assists': 0,
        'starts': 1 if minutes >= 45 else 0,
    }


def _build_minimal_inputs(player_history_by_id, finished_gws=10, element_type=3):
    """Build (bootstrap, fixtures, understat, id_map, xmins_stats, summaries)."""
    elements = []
    for pid in player_history_by_id:
        elements.append({
            'id': pid,
            'web_name': f'Player{pid}',
            'element_type': element_type,
            'team': 14,
            'now_cost': 70,
            'selected_by_percent': '5.0',
            'form': '0',
            'status': 'a',
            'minutes': 900,
            'starts': 10,
            'total_points': 60,
            'goals_scored': 5,
            'assists': 3,
            'expected_goals': '4.5',
            'expected_assists': '2.5',
            'cost_change_event': 0,
            'cost_change_start': 0,
            'penalties_text': '',
            'direct_freekicks_text': '',
            'corners_and_indirect_freekicks_text': '',
            'news': '',
            'defensive_contribution': None,
            'clearances_blocks_interceptions': None,
            'direct_freekicks_order': None,
            'penalties_order': None,
            'corners_and_indirect_freekicks_order': None,
        })

    bootstrap = {
        'elements': elements,
        'teams': [
            {'id': 14, 'short_name': 'LIV'},
            {'id': 1, 'short_name': 'ARS'},
        ],
        'events': [{'id': i, 'finished': i <= finished_gws, 'is_current': False} for i in range(1, finished_gws + 6)],
    }
    # Mark the next unfinished event as current
    for ev in bootstrap['events']:
        if not ev['finished']:
            ev['is_current'] = True
            break

    fixtures = []
    for gw in range(1, finished_gws + 1):
        fixtures.append({
            'event': gw, 'team_h': 14, 'team_a': 1,
            'team_h_difficulty': 3, 'team_a_difficulty': 3,
            'finished': True,
            'team_h_score': 1, 'team_a_score': 1,
        })
    for gw in range(finished_gws + 1, finished_gws + 6):
        fixtures.append({
            'event': gw, 'team_h': 14, 'team_a': 1,
            'team_h_difficulty': 3, 'team_a_difficulty': 3,
            'finished': False,
        })

    understat = {}
    id_map = {str(pid): {'understat_id': None} for pid in player_history_by_id}
    xmins_stats = {pid: {'xmins': 90.0, 'start_prob': 1.0, 'mins_risk': 'safe'} for pid in player_history_by_id}
    summaries = {pid: {'history': hist} for pid, hist in player_history_by_id.items()}
    return bootstrap, fixtures, understat, id_map, xmins_stats, summaries


def test_merge_writes_form_signal():
    """ACC-01: merge_players writes form_xgxa_per90 and form_xgxa_window_gws on every player."""
    # Player 1: enough history for form signal (5 GWs, 90 min each, total 450 min > 270)
    history_full = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 11)]
    # Player 2: insufficient history (only 2 GWs)
    history_short = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 3)]

    bootstrap, fixtures, understat, id_map, xmins_stats, summaries = _build_minimal_inputs({
        1: history_full, 2: history_short,
    })

    merged, _ = merge_players(bootstrap, fixtures, understat, id_map,
                               xmins_stats=xmins_stats, summaries=summaries)
    p1 = next(p for p in merged if p['id'] == 1)
    p2 = next(p for p in merged if p['id'] == 2)

    assert 'form_xgxa_per90' in p1
    assert 'form_xgxa_window_gws' in p1
    assert p1['form_xgxa_per90'] is not None
    assert p1['form_xgxa_window_gws'] >= 3

    assert 'form_xgxa_per90' in p2
    assert 'form_xgxa_window_gws' in p2
    assert p2['form_xgxa_per90'] is None
    assert p2['form_xgxa_window_gws'] == 0


def _build_minimal_inputs_override(player_history_by_id, finished_gws=10,
                                    goals_scored=5, assists=3):
    """Variant of _build_minimal_inputs with configurable goals_scored/assists."""
    bootstrap, fixtures, understat, id_map, xmins_stats, summaries = _build_minimal_inputs(
        player_history_by_id, finished_gws=finished_gws
    )
    # Override goals_scored/assists for player 1 to control season per-90 rate
    for el in bootstrap['elements']:
        if el['id'] == 1:
            el['goals_scored'] = goals_scored
            el['assists'] = assists
    return bootstrap, fixtures, understat, id_map, xmins_stats, summaries


def test_blend_changes_xpts_when_enabled():
    """ACC-01: form_signal_enabled=True with hot form lifts xPts_1gw above the disabled baseline.

    Season per-90 (from goals_scored/assists): (1+0)/900*90 = 0.1 per 90 (cold player).
    Form per-90 (from last 5 GWs): only GW10 has xG=2.0+xA=1.0 => ~0.8 per 90 (hot form).
    Blend = (0.6)*0.1 + (0.4)*0.8 = 0.38 != 0.1, so xPts must change.
    """
    # 9 cold GWs (xG+xA = 0), 1 very hot GW
    history = [_hist(gw, 90, 6, xg=0.0, xa=0.0) for gw in range(1, 10)]
    history.append(_hist(10, 90, 6, xg=2.0, xa=1.0))

    # Use very low season goals/assists so season per-90 (0.1/90) != form per-90 (0.8/90)
    bootstrap, fixtures, understat, id_map, xmins_stats, summaries = _build_minimal_inputs_override(
        {1: history}, goals_scored=1, assists=0
    )

    merged_baseline, _ = merge_players(bootstrap, fixtures, understat, id_map,
                                        xmins_stats=xmins_stats, summaries=summaries,
                                        form_signal_enabled=False)
    merged_blended, _ = merge_players(bootstrap, fixtures, understat, id_map,
                                       xmins_stats=xmins_stats, summaries=summaries,
                                       form_signal_enabled=True)

    baseline_xpts = next(p['xPts_1gw'] for p in merged_baseline if p['id'] == 1)
    blended_xpts = next(p['xPts_1gw'] for p in merged_blended if p['id'] == 1)

    assert blended_xpts != baseline_xpts, \
        f"blend must change xPts when form differs from season; got baseline={baseline_xpts}, blended={blended_xpts}"


def test_blend_disabled_matches_baseline():
    """ACC-01: form_signal_enabled=False produces identical xPts_1gw to the pre-flag pipeline."""
    history = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 11)]
    bootstrap, fixtures, understat, id_map, xmins_stats, summaries = _build_minimal_inputs({1: history})

    # Default kwarg (no flag) and explicit False must produce the same numbers
    merged_default, _ = merge_players(bootstrap, fixtures, understat, id_map,
                                       xmins_stats=xmins_stats, summaries=summaries)
    merged_explicit_false, _ = merge_players(bootstrap, fixtures, understat, id_map,
                                              xmins_stats=xmins_stats, summaries=summaries,
                                              form_signal_enabled=False)

    d_xpts = next(p['xPts_1gw'] for p in merged_default if p['id'] == 1)
    f_xpts = next(p['xPts_1gw'] for p in merged_explicit_false if p['id'] == 1)
    assert d_xpts == f_xpts, "default and explicit-False must produce identical xPts (default IS False)"


def _build_lookahead_inputs(n_future_fixtures: int):
    """Build minimal inputs with two teams and n_future_fixtures unfinished fixtures."""
    elements = [
        {
            'id': 1,
            'web_name': 'PlayerLIV',
            'element_type': 3,
            'team': 14,
            'now_cost': 70,
            'selected_by_percent': '5.0',
            'form': '0',
            'status': 'a',
            'minutes': 900,
            'starts': 10,
            'total_points': 60,
            'goals_scored': 5,
            'assists': 3,
            'expected_goals': '4.5',
            'expected_assists': '2.5',
            'cost_change_event': 0,
            'cost_change_start': 0,
            'penalties_text': '',
            'direct_freekicks_text': '',
            'corners_and_indirect_freekicks_text': '',
            'news': '',
            'defensive_contribution': None,
            'clearances_blocks_interceptions': None,
            'direct_freekicks_order': None,
            'penalties_order': None,
            'corners_and_indirect_freekicks_order': None,
        },
        {
            'id': 2,
            'web_name': 'PlayerARS',
            'element_type': 3,
            'team': 1,
            'now_cost': 80,
            'selected_by_percent': '8.0',
            'form': '0',
            'status': 'a',
            'minutes': 900,
            'starts': 10,
            'total_points': 60,
            'goals_scored': 5,
            'assists': 3,
            'expected_goals': '4.5',
            'expected_assists': '2.5',
            'cost_change_event': 0,
            'cost_change_start': 0,
            'penalties_text': '',
            'direct_freekicks_text': '',
            'corners_and_indirect_freekicks_text': '',
            'news': '',
            'defensive_contribution': None,
            'clearances_blocks_interceptions': None,
            'direct_freekicks_order': None,
            'penalties_order': None,
            'corners_and_indirect_freekicks_order': None,
        },
    ]

    bootstrap = {
        'elements': elements,
        'teams': [
            {'id': 14, 'short_name': 'LIV'},
            {'id': 1, 'short_name': 'ARS'},
        ],
        'events': [{'id': i, 'finished': False, 'is_current': i == 1} for i in range(1, n_future_fixtures + 2)],
    }

    fixtures = []
    for gw in range(1, n_future_fixtures + 1):
        fixtures.append({
            'event': gw, 'team_h': 14, 'team_a': 1,
            'team_h_difficulty': 3, 'team_a_difficulty': 3,
            'finished': False,
        })

    understat = {}
    id_map = {'1': {'understat_id': None}, '2': {'understat_id': None}}
    xmins_stats = {
        1: {'xmins': 90.0, 'start_prob': 1.0, 'mins_risk': 'safe'},
        2: {'xmins': 90.0, 'start_prob': 1.0, 'mins_risk': 'safe'},
    }
    summaries = {1: {'history': []}, 2: {'history': []}}
    return bootstrap, fixtures, understat, id_map, xmins_stats, summaries


def test_fixture_lookahead_caps_at_32():
    """Phase 75 HEAT-06: FIXTURE_LOOKAHEAD=32 — upcoming_fixtures capped at 32 per team."""
    # Build inputs with 40 unfinished fixtures — more than the 32 cap
    bootstrap, fixtures, understat, id_map, xmins_stats, summaries = _build_lookahead_inputs(40)

    merged, _ = merge_players(bootstrap, fixtures, understat, id_map,
                              xmins_stats=xmins_stats, summaries=summaries)

    # Each player has 'fixtures' (upcoming_fixtures list in player dict); check both teams
    liv_player = next(p for p in merged if p['id'] == 1)
    ars_player = next(p for p in merged if p['id'] == 2)

    assert len(liv_player['fixtures']) == 32, (
        f"Expected LIV fixtures capped at 32, got {len(liv_player['fixtures'])}"
    )
    assert len(ars_player['fixtures']) == 32, (
        f"Expected ARS fixtures capped at 32, got {len(ars_player['fixtures'])}"
    )


def test_fixture_lookahead_no_padding_below_32():
    """Phase 75 HEAT-06: upcoming fixtures not padded when fewer than 32 fixtures exist."""
    # Build inputs with only 10 unfinished fixtures
    bootstrap, fixtures, understat, id_map, xmins_stats, summaries = _build_lookahead_inputs(10)

    merged, _ = merge_players(bootstrap, fixtures, understat, id_map,
                              xmins_stats=xmins_stats, summaries=summaries)

    liv_player = next(p for p in merged if p['id'] == 1)
    assert len(liv_player['fixtures']) == 10, (
        f"Expected LIV fixtures=10, got {len(liv_player['fixtures'])}"
    )


class TestMergePlayersTunedParams:
    """merge_players must accept and apply cs_prob_base, cs_prob_slope, form_window_gws."""

    def test_merge_players_accepts_cs_prob_kwargs(self):
        """merge_players must not raise when passed cs_prob_base and cs_prob_slope."""
        history = [_hist(r, 90, 6, xg=0.3, xa=0.1) for r in range(1, 11)]
        bootstrap, fixtures, understat, id_map, xmins_stats, summaries = _build_minimal_inputs({1: history})
        # Should not raise:
        merged, _ = merge_players(
            bootstrap, fixtures, understat, id_map,
            xmins_stats=xmins_stats, summaries=summaries,
            cs_prob_base=0.50, cs_prob_slope=0.25, form_window_gws=4,
        )
        assert len(merged) > 0

    def test_cs_prob_base_affects_xpts_for_defender(self):
        """Higher cs_prob_base should increase xPts_1gw for defenders (element_type=2)."""
        history = [_hist(r, 90, 6, xg=0.05, xa=0.05) for r in range(1, 11)]
        bootstrap_lo, fixtures, understat, id_map, xmins_stats, summaries = _build_minimal_inputs(
            {1: history}, element_type=2
        )
        bootstrap_hi, _, _, _, _, _ = _build_minimal_inputs(
            {1: history}, element_type=2
        )
        lo, _ = merge_players(bootstrap_lo, fixtures, understat, id_map,
                              xmins_stats=xmins_stats, summaries=summaries,
                              cs_prob_base=0.25)
        hi, _ = merge_players(bootstrap_hi, fixtures, understat, id_map,
                              xmins_stats=xmins_stats, summaries=summaries,
                              cs_prob_base=0.55)
        lo_xpts = next(p['xPts_1gw'] for p in lo if p['id'] == 1)
        hi_xpts = next(p['xPts_1gw'] for p in hi if p['id'] == 1)
        assert hi_xpts > lo_xpts

    def test_form_window_gws_affects_form_signal(self):
        """Shorter form_window_gws with a recent hot streak should change form_xgxa_per90."""
        # Build player with low form early, high form recently
        early = [_hist(r, 90, 2, xg=0.1, xa=0.05) for r in range(1, 6)]
        recent = [_hist(r, 90, 8, xg=0.8, xa=0.4) for r in range(6, 11)]
        history = early + recent
        bootstrap, fixtures, understat, id_map, xmins_stats, summaries = _build_minimal_inputs({1: history})

        # Narrow window (3 GWs) captures only the hot recent form
        merged_narrow, _ = merge_players(
            bootstrap, fixtures, understat, id_map,
            xmins_stats=xmins_stats, summaries=summaries,
            form_signal_enabled=True, form_window_gws=3,
        )
        # Wide window (8 GWs) averages in the cold early games
        merged_wide, _ = merge_players(
            bootstrap, fixtures, understat, id_map,
            xmins_stats=xmins_stats, summaries=summaries,
            form_signal_enabled=True, form_window_gws=8,
        )
        p_narrow = next(p for p in merged_narrow if p['id'] == 1)
        p_wide   = next(p for p in merged_wide   if p['id'] == 1)
        # The narrow window should give higher form signal (only sees the hot streak)
        assert p_narrow['form_xgxa_per90'] > p_wide['form_xgxa_per90']


class TestComputeDifferentialFlag:
    """EO-01 validated thresholds (exp06: p75 gate + <10% ownership, lift +11.2pp).

    DIFF gate: xpts_1gw > position_p75 AND ownership < 10.0 AND status == 'a'.
    TRAP gate: xpts_1gw < position_median AND ownership > 15.0 (UNCHANGED).
    """

    def test_diff_above_p75_low_ownership(self):
        """Player above p75 with 9.9% ownership and status 'a' → 'diff'."""
        # median=3.0, p75=5.0; xpts=6.0 > p75=5.0, own=9.9 < 10.0, status='a'
        result = _compute_differential_flag(
            xpts_1gw=6.0,
            selected_by_percent='9.9',
            status='a',
            position_median=3.0,
            position_p75=5.0,
        )
        assert result == 'diff'

    def test_diff_above_median_but_below_p75_not_flagged(self):
        """Player above median but below p75 → None even at 1% ownership (p75 gate required)."""
        # median=3.0, p75=5.0; xpts=4.0 > median but < p75 → no diff
        result = _compute_differential_flag(
            xpts_1gw=4.0,
            selected_by_percent='1.0',
            status='a',
            position_median=3.0,
            position_p75=5.0,
        )
        assert result is None

    def test_diff_ownership_exactly_10_not_flagged(self):
        """Ownership exactly 10.0% does NOT qualify — gate is strict < 10.0."""
        result = _compute_differential_flag(
            xpts_1gw=6.0,
            selected_by_percent='10.0',
            status='a',
            position_median=3.0,
            position_p75=5.0,
        )
        assert result is None

    def test_trap_below_median_high_ownership(self):
        """TRAP gate unchanged: below median + >15% ownership → 'trap'."""
        result = _compute_differential_flag(
            xpts_1gw=2.0,
            selected_by_percent='20.0',
            status='a',
            position_median=3.0,
            position_p75=5.0,
        )
        assert result == 'trap'

    def test_trap_status_exclusion_does_not_apply(self):
        """TRAP fires even for injured (non-'a') players — D-12 asymmetry preserved."""
        result = _compute_differential_flag(
            xpts_1gw=2.0,
            selected_by_percent='20.0',
            status='i',
            position_median=3.0,
            position_p75=5.0,
        )
        assert result == 'trap'

    def test_diff_requires_status_a(self):
        """DIFF requires status == 'a'; injured player above p75 and low-owned → None."""
        result = _compute_differential_flag(
            xpts_1gw=6.0,
            selected_by_percent='2.0',
            status='i',
            position_median=3.0,
            position_p75=5.0,
        )
        assert result is None


class TestAssetCodePassthrough:
    """UIX-01: merge_players passes element code + team code through to merged
    output so the client can build official asset URLs (photos p{code}.png,
    badges t{team_code}.png, kits shirt_{team_code}-110.webp)."""

    def test_code_and_team_code_passthrough(self):
        history = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 11)]
        bootstrap, fixtures, understat, id_map, xmins_stats, summaries = _build_minimal_inputs({1: history})
        bootstrap['elements'][0]['code'] = 223094
        bootstrap['teams'][0]['code'] = 14  # team id 14 (LIV) → official code 14
        merged, _ = merge_players(bootstrap, fixtures, understat, id_map,
                                  xmins_stats=xmins_stats, summaries=summaries)
        p = next(pl for pl in merged if pl['id'] == 1)
        assert p['code'] == 223094
        assert p['team_code'] == 14

    def test_team_code_defaults_to_zero_when_absent(self):
        """Bootstrap teams without a code field must not crash the merge."""
        history = [_hist(gw, 90, 6) for gw in range(1, 11)]
        bootstrap, fixtures, understat, id_map, xmins_stats, summaries = _build_minimal_inputs({1: history})
        merged, _ = merge_players(bootstrap, fixtures, understat, id_map,
                                  xmins_stats=xmins_stats, summaries=summaries)
        p = next(pl for pl in merged if pl['id'] == 1)
        assert p['team_code'] == 0


# ── COLD-01 Layer-3 prior blend tests ────────────────────────────────────────

def _build_cold_start_inputs(player_code=1001, minutes=0, element_type=3, now_cost=70,
                              xg_str='0.0', xa_str='0.0'):
    """Build minimal inputs for a single GW1-like cold player (no current-season data)."""
    element = {
        'id': 1,
        'code': player_code,
        'web_name': 'ColdPlayer',
        'element_type': element_type,
        'team': 14,
        'now_cost': now_cost,
        'selected_by_percent': '5.0',
        'form': '0',
        'status': 'a',
        'minutes': minutes,
        'starts': 0,
        'total_points': 0,
        'goals_scored': 0,
        'assists': 0,
        'expected_goals': xg_str,
        'expected_assists': xa_str,
        'cost_change_event': 0,
        'cost_change_start': 0,
        'penalties_text': '',
        'direct_freekicks_text': '',
        'corners_and_indirect_freekicks_text': '',
        'news': '',
        'defensive_contribution': None,
        'clearances_blocks_interceptions': None,
        'direct_freekicks_order': None,
        'penalties_order': None,
        'corners_and_indirect_freekicks_order': None,
    }
    bootstrap = {
        'elements': [element],
        'teams': [{'id': 14, 'short_name': 'LIV'}],
        'events': [{'id': 1, 'finished': False, 'is_current': True}],
    }
    fixtures = [{
        'event': 1, 'team_h': 14, 'team_a': 1,
        'team_h_difficulty': 3, 'team_a_difficulty': 3,
        'finished': False,
    }]
    understat = {}
    id_map = {'1': {'understat_id': None}}
    xmins_stats = {1: {'xmins': 60.0, 'start_prob': 0.8, 'mins_risk': 'nailed'}}
    summaries = {1: {'history': []}}
    return bootstrap, fixtures, understat, id_map, xmins_stats, summaries


class TestCold01PriorBlend:
    """COLD-01: Layer-3 prior blend in merge_players."""

    def test_no_op_when_no_prior_args(self):
        """When neither prior_lookup nor bucket_priors passed, output is unchanged (backward-compat)."""
        history = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 11)]
        bootstrap, fixtures, understat, id_map, xmins_stats, summaries = _build_minimal_inputs({1: history})
        merged_default, _ = merge_players(bootstrap, fixtures, understat, id_map,
                                          xmins_stats=xmins_stats, summaries=summaries)
        merged_explicit, _ = merge_players(bootstrap, fixtures, understat, id_map,
                                           xmins_stats=xmins_stats, summaries=summaries,
                                           prior_lookup=None, bucket_priors=None)
        p_default = next(p for p in merged_default if p['id'] == 1)
        p_explicit = next(p for p in merged_explicit if p['id'] == 1)
        assert p_default['xg_per90'] == p_explicit['xg_per90']
        assert p_default['xa_per90'] == p_explicit['xa_per90']

    def test_prior_used_at_gw1_pure_prior(self):
        """At cur_minutes=0 (GW1), w=0 → output equals prior (re-split by prior share)."""
        prior_xg = 0.3
        prior_xa = 0.15
        prior_lookup = {
            1001: {
                'xg_per90': prior_xg,
                'xa_per90': prior_xa,
                'total_minutes': 2700,
                'start_rate': 0.95,
                'mins_per_start': 88.0,
            }
        }
        bootstrap, fixtures, understat, id_map, xmins_stats, summaries = _build_cold_start_inputs(
            player_code=1001, minutes=0
        )
        merged, _ = merge_players(bootstrap, fixtures, understat, id_map,
                                   xmins_stats=xmins_stats, summaries=summaries,
                                   prior_lookup=prior_lookup, bucket_priors={})
        p = next(pl for pl in merged if pl['id'] == 1)
        # w=0 → pure prior; total = prior_xg + prior_xa; re-split by prior share
        prior_total = prior_xg + prior_xa
        share = prior_xg / prior_total
        expected_xg = round(prior_total * share, 4)
        expected_xa = round(prior_total * (1 - share), 4)
        assert abs(p['xg_per90'] - expected_xg) < 1e-4, f"Expected xg_per90={expected_xg}, got {p['xg_per90']}"
        assert abs(p['xa_per90'] - expected_xa) < 1e-4, f"Expected xa_per90={expected_xa}, got {p['xa_per90']}"

    def test_prior_vanishes_at_seed_minutes(self):
        """At cur_minutes >= SEED_MINUTES (270), w=1 → current xg/xa unchanged."""
        from season_prior import SEED_MINUTES
        prior_lookup = {
            1001: {
                'xg_per90': 0.5,   # very different from current
                'xa_per90': 0.3,
                'total_minutes': 2700,
                'start_rate': 0.95,
                'mins_per_start': 88.0,
            }
        }
        # Player has 270 current minutes and FPL xG data (non-zero)
        bootstrap, fixtures, understat, id_map, xmins_stats, summaries = _build_cold_start_inputs(
            player_code=1001, minutes=SEED_MINUTES, xg_str='0.1', xa_str='0.05'
        )
        merged_with_prior, _ = merge_players(bootstrap, fixtures, understat, id_map,
                                              xmins_stats=xmins_stats, summaries=summaries,
                                              prior_lookup=prior_lookup, bucket_priors={})
        merged_no_prior, _ = merge_players(bootstrap, fixtures, understat, id_map,
                                            xmins_stats=xmins_stats, summaries=summaries)
        p_with = next(p for p in merged_with_prior if p['id'] == 1)
        p_no = next(p for p in merged_no_prior if p['id'] == 1)
        assert p_with['xg_per90'] == p_no['xg_per90'], (
            f"Prior should vanish at SEED_MINUTES; with={p_with['xg_per90']}, no={p_no['xg_per90']}"
        )
        assert p_with['xa_per90'] == p_no['xa_per90']

    def test_intermediate_w_pure_xa_player_not_rendered_pure_xg(self):
        """At intermediate w (cur_minutes=243 → w=0.9), a current pure-xA player keeps xa > xg.

        Prior is pure-xG (xg=0.3, xa=0.0).  Current is pure-xA (xg=0.0, xa=0.4).
        With old code (share = prior_xg/prior_total = 1.0), the player would be
        rendered pure-xG regardless of current data.  With blended share the
        current signal should dominate (w=0.9) and xa_per90 > xg_per90.
        """
        from season_prior import SEED_MINUTES
        prior_lookup = {
            1001: {
                'xg_per90': 0.3,
                'xa_per90': 0.0,   # pure-xG prior
                'total_minutes': 2700,
                'start_rate': 0.95,
                'mins_per_start': 88.0,
            }
        }
        # cur_minutes=243, SEED_MINUTES=270 → w = 243/270 = 0.9
        cur_minutes = int(SEED_MINUTES * 0.9)
        # Build inputs with a pure-xA current player using per-90 fields (Layer-1 path)
        bootstrap, fixtures, understat, id_map, xmins_stats, summaries = _build_cold_start_inputs(
            player_code=1001, minutes=cur_minutes, xg_str='0.0', xa_str='0.4'
        )
        # Inject expected_goals_per_90 / expected_assists_per_90 so Layer-1 picks them up
        bootstrap['elements'][0]['expected_goals_per_90'] = '0.0'
        bootstrap['elements'][0]['expected_assists_per_90'] = '0.4'
        merged, _ = merge_players(bootstrap, fixtures, understat, id_map,
                                   xmins_stats=xmins_stats, summaries=summaries,
                                   prior_lookup=prior_lookup, bucket_priors={})
        p = next(pl for pl in merged if pl['id'] == 1)
        assert p['xa_per90'] > p['xg_per90'], (
            f"At w=0.9 with pure-xA current player, xa_per90 ({p['xa_per90']}) "
            f"must exceed xg_per90 ({p['xg_per90']})"
        )

    def test_bucket_prior_used_when_no_code_match(self):
        """New-entrant (code not in lookup) uses bucket prior."""
        bucket_xg = 0.2
        bucket_xa = 0.1
        bucket_priors = {(3, 1): {'xg_per90': bucket_xg, 'xa_per90': bucket_xa}}
        # code=9999 not in lookup; element_type=3, now_cost=70 → band=1
        bootstrap, fixtures, understat, id_map, xmins_stats, summaries = _build_cold_start_inputs(
            player_code=9999, minutes=0, element_type=3, now_cost=70
        )
        merged, _ = merge_players(bootstrap, fixtures, understat, id_map,
                                   xmins_stats=xmins_stats, summaries=summaries,
                                   prior_lookup={}, bucket_priors=bucket_priors)
        p = next(pl for pl in merged if pl['id'] == 1)
        prior_total = bucket_xg + bucket_xa
        share = bucket_xg / prior_total
        expected_xg = round(prior_total * share, 4)
        expected_xa = round(prior_total * (1 - share), 4)
        assert abs(p['xg_per90'] - expected_xg) < 1e-4
        assert abs(p['xa_per90'] - expected_xa) < 1e-4


def test_merge_writes_gw_xpts_per_gw():
    """GWI-04: each merged player gets a gw_xpts list — per-GW xPts, len <= 5."""
    history = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 11)]
    bootstrap, fixtures, understat, id_map, xmins_stats, summaries = _build_minimal_inputs({1: history})
    merged, _ = merge_players(bootstrap, fixtures, understat, id_map,
                              xmins_stats=xmins_stats, summaries=summaries)
    p = next(pl for pl in merged if pl['id'] == 1)
    assert 'gw_xpts' in p
    assert isinstance(p['gw_xpts'], list)
    assert 0 < len(p['gw_xpts']) <= 5
    assert all(isinstance(x, (int, float)) for x in p['gw_xpts'])
    assert p['gw_xpts'][0] > 0


def _hist_with_opponent(round_, minutes, total_points, opponent_team, was_home):
    h = _hist(round_, minutes, total_points)
    h['opponent_team'] = opponent_team
    h['was_home'] = was_home
    return h


def test_merge_writes_recent_gws_matching_the_pts_last5_window():
    """LAST5-01: recent_gws is the per-game breakdown of the pts_last5gw sum.

    The aggregate hides the shape of a player's recent returns, which is what
    the popup needs to show, so the same five matches ship individually.
    """
    history = [_hist_with_opponent(gw, 90, gw, opponent_team=1, was_home=gw % 2 == 0)
               for gw in range(1, 11)]
    bootstrap, fixtures, understat, id_map, xmins_stats, summaries = _build_minimal_inputs({1: history})
    merged, _ = merge_players(bootstrap, fixtures, understat, id_map,
                              xmins_stats=xmins_stats, summaries=summaries)
    p = next(pl for pl in merged if pl['id'] == 1)

    assert [g['gw'] for g in p['recent_gws']] == [6, 7, 8, 9, 10]
    assert [g['pts'] for g in p['recent_gws']] == [6, 7, 8, 9, 10]
    assert sum(g['pts'] for g in p['recent_gws']) == p['pts_last5gw']
    assert p['recent_gws'][0]['min'] == 90
    # opponent_team resolves to the short name the UI renders
    assert p['recent_gws'][0]['opp'] == 'ARS'
    assert p['recent_gws'][0]['home'] is True    # gw 6


def test_merge_recent_gws_survives_history_without_opponent_fields():
    """Archived/partial history has no opponent_team — emit null, never crash."""
    history = [_hist(gw, 90, 4) for gw in range(1, 4)]
    bootstrap, fixtures, understat, id_map, xmins_stats, summaries = _build_minimal_inputs({1: history})
    merged, _ = merge_players(bootstrap, fixtures, understat, id_map,
                              xmins_stats=xmins_stats, summaries=summaries)
    p = next(pl for pl in merged if pl['id'] == 1)

    assert len(p['recent_gws']) == 3          # short history is not padded
    assert all(g['opp'] is None for g in p['recent_gws'])


def test_merge_recent_gws_is_empty_without_summaries():
    """No element-summary (pre-season, unmatched player) -> empty list, not None."""
    bootstrap, fixtures, understat, id_map, xmins_stats, _ = _build_minimal_inputs({1: []})
    merged, _ = merge_players(bootstrap, fixtures, understat, id_map,
                              xmins_stats=xmins_stats, summaries=None)
    p = next(pl for pl in merged if pl['id'] == 1)
    assert p['recent_gws'] == []
