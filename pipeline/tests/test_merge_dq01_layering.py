"""Unit tests for DQ-01 layered xG/xA fallback in merge.py (USR-01).

Layer priority (best → worst) when Understat has no entry:
  1. FPL expected_goals_per_90 / expected_assists_per_90  (correlation 0.85 / 0.70)
  2. goals_scored / assists per-90 proxy                  (correlation 0.72 / 0.50)

Tests follow the style of test_merge_routes.py — build minimal bootstrap/fixtures
and call merge_players directly.
"""

from merge import merge_players


# ---------------------------------------------------------------------------
# Shared builder
# ---------------------------------------------------------------------------

def _build_inputs(
    *,
    understat: dict = None,
    understat_id: int = None,
    us_xG: float = 0.0,
    us_minutes: int = 0,
    fpl_xg_per90=None,
    fpl_xa_per90=None,
    goals_scored: int = 0,
    assists: int = 0,
    minutes: int = 900,
):
    """Build minimal merge_players inputs for a single player (id=1).

    Parameters
    ----------
    understat : dict
        Fully-custom understat dict.  If None, built from us_* kwargs.
    understat_id : int or None
        The understat_id in id_map; None means no mapping (guaranteed miss).
    us_xG / us_minutes : float / int
        Used when building understat from scratch (understat_id must be set).
    fpl_xg_per90 / fpl_xa_per90 : various
        Value placed in the element dict for FPL per-90 xG/xA.
        Pass None to omit the field entirely.
    goals_scored / assists / minutes : int
        FPL element stats for the goals-proxy layer.
    """
    element = {
        'id': 1,
        'web_name': 'TestPlayer',
        'element_type': 3,
        'team': 14,
        'now_cost': 70,
        'selected_by_percent': '5.0',
        'form': '0',
        'status': 'a',
        'minutes': minutes,
        'starts': 10,
        'total_points': 60,
        'goals_scored': goals_scored,
        'assists': assists,
        'expected_goals': '0.0',
        'expected_assists': '0.0',
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

    # Inject FPL per-90 xG/xA fields only when caller supplies a value
    if fpl_xg_per90 is not None:
        element['expected_goals_per_90'] = fpl_xg_per90
    if fpl_xa_per90 is not None:
        element['expected_assists_per_90'] = fpl_xa_per90

    bootstrap = {
        'elements': [element],
        'teams': [
            {'id': 14, 'short_name': 'LIV'},
            {'id': 1,  'short_name': 'ARS'},
        ],
        'events': [
            {'id': i, 'finished': i <= 10, 'is_current': i == 11}
            for i in range(1, 16)
        ],
    }

    fixtures = []
    for gw in range(1, 16):
        fixtures.append({
            'event': gw, 'team_h': 14, 'team_a': 1,
            'team_h_difficulty': 3, 'team_a_difficulty': 3,
            'finished': gw <= 10,
            **({'team_h_score': 1, 'team_a_score': 1} if gw <= 10 else {}),
        })

    if understat is not None:
        us = understat
    elif understat_id is not None:
        us = {
            str(understat_id): {
                'player': 'TestPlayer',
                'team': 'Liverpool',
                'xG': us_xG,
                'xA': 0.0,
                'npxG': 0.0,
                'npxA': 0.0,
                'minutes': us_minutes,
            }
        }
    else:
        us = {}

    id_map = {'1': {'understat_id': understat_id}}

    return bootstrap, fixtures, us, id_map


def _get_player(merged):
    return next(p for p in merged if p['id'] == 1)


# ---------------------------------------------------------------------------
# Layer 0: Understat present → use Understat (no change)
# ---------------------------------------------------------------------------

class TestDQ01Layer0Understat:
    def test_understat_present_uses_understat_xg(self):
        """When Understat has stats for this player, xg_per90 comes from Understat."""
        # 18 xG over 1800 minutes → xg_per90 = 18/1800*90 = 0.9
        bootstrap, fixtures, us, id_map = _build_inputs(
            understat_id=42,
            us_xG=18.0,
            us_minutes=1800,
        )
        merged, _ = merge_players(bootstrap, fixtures, us, id_map)
        p = _get_player(merged)
        assert abs(p['xg_per90'] - 0.9) < 1e-3

    def test_understat_zero_minutes_leaves_none_path(self):
        """Understat entry with 0 minutes → xg_per90 falls to layered fallback."""
        # FPL per-90 xG/xA = 0.4/0.2, so those should be used
        bootstrap, fixtures, us, id_map = _build_inputs(
            understat_id=42,
            us_xG=18.0,
            us_minutes=0,  # triggers the "minutes==0, leave as None" branch
            fpl_xg_per90='0.4',
            fpl_xa_per90='0.2',
        )
        merged, _ = merge_players(bootstrap, fixtures, us, id_map)
        p = _get_player(merged)
        # Should use FPL layer (0.4) not Understat (would be 0/0 = undefined)
        assert abs(p['xg_per90'] - 0.4) < 1e-3


# ---------------------------------------------------------------------------
# Layer 1: Understat absent, FPL xG/xA present → use FPL per-90
# ---------------------------------------------------------------------------

class TestDQ01Layer1FplXg:
    def test_fpl_xg_per90_string_used_when_understat_absent(self):
        """FPL expected_goals_per_90 string is used when Understat has no entry."""
        bootstrap, fixtures, us, id_map = _build_inputs(
            understat_id=None,
            fpl_xg_per90='0.35',
            fpl_xa_per90='0.12',
        )
        merged, _ = merge_players(bootstrap, fixtures, us, id_map)
        p = _get_player(merged)
        assert abs(p['xg_per90'] - 0.35) < 1e-4
        assert abs(p['xa_per90'] - 0.12) < 1e-4

    def test_fpl_xg_per90_float_value_used(self):
        """FPL expected_goals_per_90 as a float is accepted."""
        bootstrap, fixtures, us, id_map = _build_inputs(
            understat_id=None,
            fpl_xg_per90=0.28,
            fpl_xa_per90=0.09,
        )
        merged, _ = merge_players(bootstrap, fixtures, us, id_map)
        p = _get_player(merged)
        assert abs(p['xg_per90'] - 0.28) < 1e-4

    def test_fpl_layer_preferred_over_goals_proxy(self):
        """When FPL per-90 xG is present, goals proxy is NOT used.

        goals_scored=9, minutes=900 → proxy would give 0.9000; FPL gives 0.35.
        They must differ, confirming the FPL layer fires instead of the proxy.
        """
        bootstrap, fixtures, us, id_map = _build_inputs(
            understat_id=None,
            fpl_xg_per90='0.35',
            fpl_xa_per90='0.10',
            goals_scored=9,   # proxy would give 0.9000
            assists=3,        # proxy would give 0.3000
            minutes=900,
        )
        merged, _ = merge_players(bootstrap, fixtures, us, id_map)
        p = _get_player(merged)
        assert abs(p['xg_per90'] - 0.35) < 1e-4
        assert abs(p['xa_per90'] - 0.10) < 1e-4

    def test_fpl_xg_zero_falls_through_to_proxy(self):
        """FPL expected_goals_per_90=0 (or absent) means proxy is used instead."""
        # FPL xG=0.0 xa=0.0 → layer 1 guard fails; proxy: 9g/900m*90=0.9
        bootstrap, fixtures, us, id_map = _build_inputs(
            understat_id=None,
            fpl_xg_per90='0.0',
            fpl_xa_per90='0.0',
            goals_scored=9,
            assists=3,
            minutes=900,
        )
        merged, _ = merge_players(bootstrap, fixtures, us, id_map)
        p = _get_player(merged)
        assert abs(p['xg_per90'] - 0.9) < 1e-4
        assert abs(p['xa_per90'] - 0.3) < 1e-4

    def test_fpl_xg_field_absent_falls_through_to_proxy(self):
        """Missing expected_goals_per_90 key (old element format) falls through to proxy."""
        # No fpl_xg_per90 kwarg → field not inserted into element
        bootstrap, fixtures, us, id_map = _build_inputs(
            understat_id=None,
            goals_scored=9,
            assists=3,
            minutes=900,
        )
        merged, _ = merge_players(bootstrap, fixtures, us, id_map)
        p = _get_player(merged)
        assert abs(p['xg_per90'] - 0.9) < 1e-4

    def test_fpl_xg_empty_string_falls_through_to_proxy(self):
        """FPL expected_goals_per_90='' is treated as absent, proxy is used."""
        bootstrap, fixtures, us, id_map = _build_inputs(
            understat_id=None,
            fpl_xg_per90='',
            fpl_xa_per90='',
            goals_scored=9,
            assists=3,
            minutes=900,
        )
        merged, _ = merge_players(bootstrap, fixtures, us, id_map)
        p = _get_player(merged)
        assert abs(p['xg_per90'] - 0.9) < 1e-4


# ---------------------------------------------------------------------------
# Layer 2: Both Understat and FPL xG absent → goals/assists proxy
# ---------------------------------------------------------------------------

class TestDQ01Layer2GoalsProxy:
    def test_goals_proxy_used_when_both_absent(self):
        """When Understat and FPL per-90 xG are absent, goals proxy fires."""
        # 9 goals / 900 mins * 90 = 0.9; 3 assists / 900 * 90 = 0.3
        bootstrap, fixtures, us, id_map = _build_inputs(
            understat_id=None,
            goals_scored=9,
            assists=3,
            minutes=900,
        )
        merged, _ = merge_players(bootstrap, fixtures, us, id_map)
        p = _get_player(merged)
        assert abs(p['xg_per90'] - 0.9) < 1e-4
        assert abs(p['xa_per90'] - 0.3) < 1e-4

    def test_zero_minutes_proxy_gives_zero(self):
        """Zero FPL minutes → proxy gives 0.0 (no division by zero)."""
        bootstrap, fixtures, us, id_map = _build_inputs(
            understat_id=None,
            goals_scored=5,
            assists=2,
            minutes=0,
        )
        merged, _ = merge_players(bootstrap, fixtures, us, id_map)
        p = _get_player(merged)
        assert p['xg_per90'] == 0.0
        assert p['xa_per90'] == 0.0
