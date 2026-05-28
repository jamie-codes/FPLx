"""Integration tests: cons_rate written to player dict via merge_players (FLOOR-01)."""
import pytest
from merge import merge_players


def _build_minimal_player(player_id: int = 1):
    """Minimal merge_players input: one MID on team 14 with 10 starts."""
    bootstrap = {
        'teams': [
            {'id': 14, 'short_name': 'T14'},
            {'id': 1, 'short_name': 'T01'},
        ],
        'elements': [{
            'id': player_id,
            'web_name': 'TestPlayer',
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
            'expected_goals': '0.5',
            'expected_assists': '0.3',
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
        }],
        'events': [{'id': 33, 'is_next': True, 'is_current': True, 'finished': False}],
    }
    return bootstrap, [], {}, {str(player_id): {'understat_id': None}}


def test_cons_rate_written_when_summaries_provided():
    """Player with 10 starts all returning >= threshold -> cons_rate written to player dict."""
    bootstrap, fixtures, understat, id_map = _build_minimal_player(player_id=1)
    summaries = {
        1: {
            'history': [
                {'starts': 1, 'total_points': 6, 'round': i + 1,
                 'minutes': 90, 'expected_goals': 0.1, 'expected_assists': 0.05}
                for i in range(10)
            ],
        }
    }
    merged, _ = merge_players(bootstrap, fixtures, understat, id_map,
                               summaries=summaries)
    p = merged[0]
    assert 'cons_rate' in p, "cons_rate key must be present in player dict"
    assert p['cons_rate'] == pytest.approx(1.0), \
        f"10 starts all >= 5 pts (MID threshold) -> cons_rate=1.0, got {p.get('cons_rate')}"


def test_cons_rate_is_none_when_no_summaries():
    """Player with no summaries -> cons_rate=None in player dict."""
    bootstrap, fixtures, understat, id_map = _build_minimal_player(player_id=1)
    merged, _ = merge_players(bootstrap, fixtures, understat, id_map,
                               summaries=None)
    p = merged[0]
    assert 'cons_rate' in p, "cons_rate key must be present even when summaries=None"
    assert p['cons_rate'] is None, \
        f"No summaries -> cons_rate=None, got {p.get('cons_rate')}"
