"""Phase 135 — pytest suite for notify.py push notification dispatcher."""

from unittest.mock import patch
from datetime import datetime, timezone, timedelta

import notify  # fails until Task 2


# ---------------------------------------------------------------------------
# Helpers

def _empty_state() -> dict:
    return {
        'last_price_sent_at': None,
        'last_injury_sent_at': None,
        'last_captain_sent_at': None,
        'last_captain_id': None,
        'last_known_injuries': {},
        'gw_deadline_state': {},
        'last_setpiece_sent_at': None,
        'seen_setpiece_changes': [],
        'last_benched_sent_at': None,
        'benched_fired': {},
    }


def _hours_ago(hours: float) -> str:
    return (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()


def _future_deadline(hours: float) -> dict:
    """Minimal fpl_bootstrap.json with one future event."""
    deadline = datetime.now(timezone.utc) + timedelta(hours=hours)
    return {'events': [{'id': 38, 'name': 'Gameweek 38', 'deadline_time': deadline.isoformat()}]}


PRICE_PLAYERS = [
    {'id': 1, 'web_name': 'Salah',  'direction': 'rise',   'confidence_pct': 85.0},
    {'id': 2, 'web_name': 'Kane',   'direction': 'fall',   'confidence_pct': 60.0},
    {'id': 3, 'web_name': 'Bruno',  'direction': 'stable', 'confidence_pct': 90.0},
]

MERGED_PLAYERS = [
    {'id': 10, 'web_name': 'Raya',    'status': 'a', 'news': ''},
    {'id': 11, 'web_name': 'Kane',    'status': 'd', 'news': 'Hamstring injury'},
    {'id': 12, 'web_name': 'Haaland', 'status': 'u', 'news': 'Broken foot'},
]

CAPTAIN_PICKS = {
    'gameweek': 38,
    'ceiling': {'id': 411, 'name': "O'Reilly", 'team': 'MCI', 'position': 'DEF'},
}


# ---------------------------------------------------------------------------
# Price — PUSH-02

def test_price_fires_above_threshold():
    state = _empty_state()
    with patch.object(notify, '_read_json', return_value=PRICE_PLAYERS):
        result = notify._collect_price_candidate(state, 'pipeline/cache')
    assert result is not None
    assert result['type'] == 'price'
    assert 'Salah' in result['body']
    assert '85' in result['body']


def test_price_picks_highest_confidence():
    """When multiple qualifying players exist, the highest confidence wins."""
    players = [
        {'id': 1, 'web_name': 'Salah', 'direction': 'rise', 'confidence_pct': 80.0},
        {'id': 2, 'web_name': 'Kane',  'direction': 'fall', 'confidence_pct': 90.0},
    ]
    state = _empty_state()
    with patch.object(notify, '_read_json', return_value=players):
        result = notify._collect_price_candidate(state, 'pipeline/cache')
    assert 'Kane' in result['body']
    assert '90' in result['body']


def test_price_skips_below_threshold():
    state = _empty_state()
    low_players = [{'id': 1, 'web_name': 'Salah', 'direction': 'rise', 'confidence_pct': 60.0}]
    with patch.object(notify, '_read_json', return_value=low_players):
        result = notify._collect_price_candidate(state, 'pipeline/cache')
    assert result is None


def test_price_skips_within_cooldown():
    state = _empty_state()
    state['last_price_sent_at'] = _hours_ago(2)  # sent 2 h ago, inside 24 h window
    with patch.object(notify, '_read_json', return_value=PRICE_PLAYERS):
        result = notify._collect_price_candidate(state, 'pipeline/cache')
    assert result is None


# ---------------------------------------------------------------------------
# Injury — PUSH-03

def test_injury_fires_on_new_player():
    state = _empty_state()
    state['last_known_injuries'] = {'12': 'Broken foot'}  # Haaland known; Kane is new
    with patch.object(notify, '_read_json', return_value=MERGED_PLAYERS):
        result = notify._collect_injury_candidate(state, 'pipeline/cache')
    assert result is not None
    assert result['type'] == 'injury'
    assert 'Kane' in result['body']
    assert 'Hamstring' in result['body']


def test_injury_skips_all_known():
    state = _empty_state()
    state['last_known_injuries'] = {'11': 'Hamstring injury', '12': 'Broken foot'}
    with patch.object(notify, '_read_json', return_value=MERGED_PLAYERS):
        result = notify._collect_injury_candidate(state, 'pipeline/cache')
    assert result is None


def test_injury_skips_within_cooldown():
    state = _empty_state()
    state['last_injury_sent_at'] = _hours_ago(2)
    with patch.object(notify, '_read_json', return_value=MERGED_PLAYERS):
        result = notify._collect_injury_candidate(state, 'pipeline/cache')
    assert result is None


# ---------------------------------------------------------------------------
# Deadline — PUSH-04

def test_deadline_fires_24h_window():
    state = _empty_state()
    with patch.object(notify, '_read_json', return_value=_future_deadline(24)):
        result = notify._collect_deadline_candidate(state, 'pipeline/cache')
    assert result is not None
    assert result['type'] == 'deadline'
    assert result['hours_until'] == 24


def test_deadline_fires_2h_window():
    state = _empty_state()
    with patch.object(notify, '_read_json', return_value=_future_deadline(2)):
        result = notify._collect_deadline_candidate(state, 'pipeline/cache')
    assert result is not None
    assert result['hours_until'] == 2


def test_deadline_not_fired_twice_24h():
    state = _empty_state()
    state['gw_deadline_state'] = {'38': {'fired_24h': True, 'fired_2h': False}}
    with patch.object(notify, '_read_json', return_value=_future_deadline(24)):
        result = notify._collect_deadline_candidate(state, 'pipeline/cache')
    assert result is None


def test_deadline_skips_outside_windows():
    """12 hours until deadline: neither 24h nor 2h window."""
    state = _empty_state()
    with patch.object(notify, '_read_json', return_value=_future_deadline(12)):
        result = notify._collect_deadline_candidate(state, 'pipeline/cache')
    assert result is None


# ---------------------------------------------------------------------------
# Captain — PUSH-05

def test_captain_fires_on_id_change():
    state = _empty_state()
    state['last_captain_id'] = 999  # different from 411
    with patch.object(notify, '_read_json', return_value=CAPTAIN_PICKS):
        result = notify._collect_captain_candidate(state, 'pipeline/cache')
    assert result is not None
    assert result['type'] == 'captain'
    assert "O'Reilly" in result['body']
    assert 'MCI' in result['body']


def test_captain_skips_same_id():
    state = _empty_state()
    state['last_captain_id'] = 411
    with patch.object(notify, '_read_json', return_value=CAPTAIN_PICKS):
        result = notify._collect_captain_candidate(state, 'pipeline/cache')
    assert result is None


def test_captain_skips_within_cooldown():
    state = _empty_state()
    state['last_captain_sent_at'] = _hours_ago(2)
    state['last_captain_id'] = 999
    with patch.object(notify, '_read_json', return_value=CAPTAIN_PICKS):
        result = notify._collect_captain_candidate(state, 'pipeline/cache')
    assert result is None


# ---------------------------------------------------------------------------
# run_notify — rate limiting, error handling

def _all_triggers_read_json(filename, cache_dir='pipeline/cache'):
    """Returns data that triggers all 4 notification types."""
    if filename == 'notify_state.json':
        raise FileNotFoundError(filename)  # fresh start
    if filename == 'price_changes.json':
        return [{'id': 1, 'web_name': 'Salah', 'direction': 'rise', 'confidence_pct': 85.0}]
    if filename == 'merged_players.json':
        return [{'id': 11, 'web_name': 'Kane', 'status': 'd', 'news': 'Hamstring injury'}]
    if filename == 'fpl_bootstrap.json':
        return _future_deadline(24)
    if filename == 'captain_picks.json':
        return CAPTAIN_PICKS
    raise FileNotFoundError(filename)


def test_rate_limit_caps_at_3():
    """4 qualifying candidates → exactly 3 POSTs sent."""
    sent = []

    def mock_send(payload, base_url):
        sent.append(payload['type'])
        return 200

    with patch.object(notify, '_read_json', side_effect=_all_triggers_read_json), \
         patch.object(notify, '_send', side_effect=mock_send), \
         patch.object(notify, '_save_state'):
        notify.run_notify(cache_dir='pipeline/cache')

    assert len(sent) == 3


def test_404_does_not_update_state():
    """404 response → _save_state never called."""
    saved = []

    def mock_send(payload, base_url):
        return 404

    with patch.object(notify, '_read_json', side_effect=_all_triggers_read_json), \
         patch.object(notify, '_send', side_effect=mock_send), \
         patch.object(notify, '_save_state', side_effect=lambda s, d='pipeline/cache': saved.append(s)):
        notify.run_notify(cache_dir='pipeline/cache')

    assert saved == []


def test_missing_file_skips_type_continues_others():
    """price_changes.json missing → price skipped; injury + captain still dispatched."""
    def mock_read(filename, cache_dir='pipeline/cache'):
        if filename == 'notify_state.json':
            raise FileNotFoundError(filename)
        if filename == 'price_changes.json':
            raise FileNotFoundError(filename)   # missing
        if filename == 'merged_players.json':
            return [{'id': 11, 'web_name': 'Kane', 'status': 'd', 'news': 'Hamstring injury'}]
        if filename == 'fpl_bootstrap.json':
            raise FileNotFoundError(filename)   # missing too
        if filename == 'captain_picks.json':
            return {'gameweek': 38, 'ceiling': {'id': 999, 'name': 'Salah', 'team': 'LIV'}}
        raise FileNotFoundError(filename)

    sent = []

    def mock_send(payload, base_url):
        sent.append(payload['type'])
        return 200

    with patch.object(notify, '_read_json', side_effect=mock_read), \
         patch.object(notify, '_send', side_effect=mock_send), \
         patch.object(notify, '_save_state'):
        notify.run_notify(cache_dir='pipeline/cache')

    assert 'price' not in sent
    assert 'deadline' not in sent
    assert 'injury' in sent
    assert 'captain' in sent


# ---------------------------------------------------------------------------
# Set-piece change — PUSH-06

SP_CHANGES = {
    'has_changes': True,
    'change_count': 1,
    'teams': [
        {'team_id': 1, 'team_short_name': 'ARS',
         'penalty_taker': {'id': 16, 'name': 'Saka', 'changed': False},
         'fk_taker': {'id': 21, 'name': 'Rice', 'changed': True},
         'corner_taker': {'id': 21, 'name': 'Rice', 'changed': False}},
    ],
}


def test_setpiece_fires_on_changed_taker():
    state = _empty_state()
    with patch.object(notify, '_read_json', return_value=SP_CHANGES):
        result = notify._collect_setpiece_candidate(state, 'pipeline/cache')
    assert result is not None
    assert result['type'] == 'setpiece'
    assert 'Rice' in result['body'] and 'free kicks' in result['body'] and 'ARS' in result['body']


def test_setpiece_skips_when_no_changes():
    state = _empty_state()
    quiet = {'has_changes': False, 'change_count': 0, 'teams': SP_CHANGES['teams']}
    quiet = {**quiet, 'teams': [{**SP_CHANGES['teams'][0],
                                 'fk_taker': {'id': 21, 'name': 'Rice', 'changed': False}}]}
    with patch.object(notify, '_read_json', return_value=quiet):
        assert notify._collect_setpiece_candidate(state, 'pipeline/cache') is None


def test_setpiece_does_not_refire_on_seen_identity():
    state = _empty_state()
    state['seen_setpiece_changes'] = ['1:fk_taker:21']
    with patch.object(notify, '_read_json', return_value=SP_CHANGES):
        assert notify._collect_setpiece_candidate(state, 'pipeline/cache') is None


def test_setpiece_respects_cooldown():
    state = _empty_state()
    state['last_setpiece_sent_at'] = _hours_ago(1)
    with patch.object(notify, '_read_json', return_value=SP_CHANGES):
        assert notify._collect_setpiece_candidate(state, 'pipeline/cache') is None


def test_setpiece_state_capped_at_50():
    state = _empty_state()
    state['seen_setpiece_changes'] = [f'x:{i}' for i in range(50)]
    payload = {'type': 'setpiece', 'title': 'Set-piece update', 'body': 'b',
               '_sp_identity': '1:fk_taker:21'}
    notify._update_state(state, payload)
    assert len(state['seen_setpiece_changes']) == 50
    assert state['seen_setpiece_changes'][-1] == '1:fk_taker:21'
    assert state['last_setpiece_sent_at'] is not None
