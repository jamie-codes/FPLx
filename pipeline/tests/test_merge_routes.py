"""Pytest unit tests for routes_to_points post-loop pass (Phase 76 RTP-01).

Tests cover:
  - Pen-taker only -> routes_to_points = 1
  - All five routes (pen + FK + corner + above-median xG + above-median xA) -> 5
  - No routes -> 0 (NOT clamped to 1)
  - None xg_per90 / xa_per90 cleanly skipped -> no crash, only set-piece routes count
  - Range invariant: 0 <= routes_to_points <= 5 across realistic dataset
"""
from merge import merge_players


def _build_two_player_team(p1: dict, p2: dict, team_id: int = 14) -> tuple:
    """Build minimal bootstrap + fixtures + understat + id_map for two players on the same team.

    p1 / p2 accept these optional keys (all default to safe minimums):
      penalties_order, direct_freekicks_order, corners_and_indirect_freekicks_order,
      xg, xa  (xg/xa are per-90 targets; goals_scored/assists derive via DQ-01 proxy at
               minutes=900: xg_per90 = goals_scored/900*90 = goals_scored/10, so
               goals_scored = xg*10 gives the desired per-90 value).
      xg=None, xa=None simulates a player with zero goals/assists (xg_per90 = 0.0).
    """
    teams = [
        {'id': team_id, 'short_name': f'T{team_id}'},
        {'id': 1, 'short_name': 'T01'},
    ]

    elements = []
    for pid, kw in [(1, p1), (2, p2)]:
        xg = kw.get('xg')
        xa = kw.get('xa')
        # DQ-01 proxy: xg_per90 = goals_scored / minutes * 90
        # With minutes=900: goals_scored = xg * 10, assists = xa * 10
        goals_scored = round(xg * 10) if xg is not None else 0
        assists = round(xa * 10) if xa is not None else 0
        elements.append({
            'id': pid,
            'web_name': f'Player{pid}',
            'element_type': 3,
            'team': team_id,
            'now_cost': 70,
            'selected_by_percent': '5.0',
            'form': '0',
            'status': 'a',
            'minutes': 900,
            'starts': 10,
            'total_points': 60,
            'goals_scored': goals_scored,
            'assists': assists,
            'expected_goals': str(xg or 0.0),
            'expected_assists': str(xa or 0.0),
            'cost_change_event': 0,
            'cost_change_start': 0,
            'penalties_text': '',
            'direct_freekicks_text': '',
            'corners_and_indirect_freekicks_text': '',
            'news': '',
            'defensive_contribution': None,
            'clearances_blocks_interceptions': None,
            'direct_freekicks_order': kw.get('direct_freekicks_order'),
            'penalties_order': kw.get('penalties_order'),
            'corners_and_indirect_freekicks_order': kw.get('corners_and_indirect_freekicks_order'),
        })

    bootstrap = {
        'teams': teams,
        'elements': elements,
        'events': [{'id': 1, 'is_next': True, 'is_current': True, 'finished': False}],
    }
    fixtures = []
    # Empty understat dict — DQ-01 proxy derives xg_per90/xa_per90 from goals_scored/assists
    understat = {}
    id_map = {str(pid): {'understat_id': None} for pid in (1, 2)}
    return bootstrap, fixtures, understat, id_map


def test_routes_to_points_pen_taker_only():
    """Player who is the team penalty taker AND below-median xG/xA scores 1."""
    bootstrap, fixtures, understat, id_map = _build_two_player_team(
        p1={'penalties_order': 1, 'xg': 0.1, 'xa': 0.1},
        p2={'xg': 0.5, 'xa': 0.5},
    )
    merged, _ = merge_players(bootstrap, fixtures, understat, id_map)
    p1 = next(p for p in merged if p['id'] == 1)
    assert p1['routes_to_points'] == 1


def test_routes_to_points_all_five_routes():
    """Player who is pen + FK + corner taker AND above-median xG AND above-median xA scores 5."""
    bootstrap, fixtures, understat, id_map = _build_two_player_team(
        p1={'penalties_order': 1, 'direct_freekicks_order': 1,
            'corners_and_indirect_freekicks_order': 1, 'xg': 0.5, 'xa': 0.5},
        p2={'xg': 0.1, 'xa': 0.1},
    )
    merged, _ = merge_players(bootstrap, fixtures, understat, id_map)
    p1 = next(p for p in merged if p['id'] == 1)
    assert p1['routes_to_points'] == 5


def test_routes_to_points_no_routes():
    """Player with no set-piece roles and below-median xG/xA scores 0 (NOT clamped to 1)."""
    bootstrap, fixtures, understat, id_map = _build_two_player_team(
        p1={'xg': 0.1, 'xa': 0.1},
        p2={'xg': 0.5, 'xa': 0.5},
    )
    merged, _ = merge_players(bootstrap, fixtures, understat, id_map)
    p1 = next(p for p in merged if p['id'] == 1)
    assert p1['routes_to_points'] == 0


def test_routes_none_xg_xa_skipped():
    """Player with xg=None / xa=None (zero goals/assists) cleanly skips xG/xA routes 4 and 5.

    In the pipeline, DQ-01 always fills xg_per90 with goals_scored/minutes*90.
    A player with no goals and no assists gets xg_per90=0.0 (not None).
    Routes 4 and 5 evaluate False because 0.0 > median is False when the median > 0.
    Only the pen-taker route (route 1) fires, giving routes_to_points == 1.
    """
    bootstrap, fixtures, understat, id_map = _build_two_player_team(
        p1={'penalties_order': 1, 'xg': None, 'xa': None},
        p2={'xg': 0.5, 'xa': 0.5},
    )
    merged, _ = merge_players(bootstrap, fixtures, understat, id_map)
    p1 = next(p for p in merged if p['id'] == 1)
    assert p1['routes_to_points'] == 1
    # xg_per90 is 0.0 (DQ-01 proxy with goals_scored=0, minutes=900), not None
    assert p1.get('xg_per90') == 0.0
    assert p1.get('xa_per90') == 0.0


def test_routes_range_invariant():
    """Across a realistic-ish multi-player dataset, routes_to_points stays in 0..5 inclusive."""
    # Build two players with varied set-piece + xg/xa values
    bootstrap, fixtures, understat, id_map = _build_two_player_team(
        p1={'penalties_order': 1, 'direct_freekicks_order': 1, 'xg': 0.6, 'xa': 0.4},
        p2={'corners_and_indirect_freekicks_order': 1, 'xg': 0.3, 'xa': 0.7},
    )
    merged, _ = merge_players(bootstrap, fixtures, understat, id_map)
    for p in merged:
        assert 0 <= p['routes_to_points'] <= 5, (
            f"player {p['id']} out of range: routes_to_points={p['routes_to_points']}"
        )
        assert isinstance(p['routes_to_points'], int)
