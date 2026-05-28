"""Integration tests: streak and form_delta written to player dict via merge_players (STREAK-01)."""
import pytest
from merge import merge_players


def _build_minimal_player(player_id: int = 1):
    """Minimal merge_players input: one MID on team 14."""
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


def test_streak_and_form_delta_written_when_summaries_provided():
    """Player with 8 starts all returning >= threshold → both fields in player dict."""
    bootstrap, fixtures, understat, id_map = _build_minimal_player(player_id=1)
    # 8 starts: first 3 at 3 pts, last 5 at 7 pts (all >= MID threshold of 5)
    history = (
        [{'starts': 1, 'total_points': 3, 'minutes': 90, 'expected_goals': '0.1', 'expected_assists': '0.1', 'round': i + 1} for i in range(3)]
        + [{'starts': 1, 'total_points': 7, 'minutes': 90, 'expected_goals': '0.3', 'expected_assists': '0.2', 'round': i + 4} for i in range(5)]
    )
    summaries = {1: {'history': history}}
    merged, _ = merge_players(bootstrap, fixtures, understat, id_map,
                               summaries=summaries)
    p = merged[0]
    assert 'streak' in p, "streak key must be present"
    assert 'form_delta' in p, "form_delta key must be present"
    # Last 5 starts at 7 pts >= threshold=5; 6th-from-last at 3 pts breaks streak → streak = 5
    assert p['streak'] == 5, f"Expected streak=5, got {p.get('streak')}"
    # last5_avg = 7.0, season_avg = (3*3 + 5*7)/8 = 44/8 = 5.5 → delta = 1.5
    assert p['form_delta'] == pytest.approx(1.5), f"Expected form_delta=1.5, got {p.get('form_delta')}"


def test_streak_and_form_delta_none_when_no_summaries():
    """Player with no summaries → both streak and form_delta are None."""
    bootstrap, fixtures, understat, id_map = _build_minimal_player(player_id=1)
    merged, _ = merge_players(bootstrap, fixtures, understat, id_map,
                               summaries=None)
    p = merged[0]
    assert 'streak' in p, "streak key must be present even when summaries=None"
    assert 'form_delta' in p, "form_delta key must be present even when summaries=None"
    assert p['streak'] is None, f"Expected streak=None, got {p.get('streak')}"
    assert p['form_delta'] is None, f"Expected form_delta=None, got {p.get('form_delta')}"
