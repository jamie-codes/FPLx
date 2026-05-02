"""Pytest unit tests for compute_price_change_predictions (Phase 54 PRC-01)."""

import pytest

from price_changes import compute_price_change_predictions


def _bootstrap(elements=None, current_gw_id=1, teams=None):
    return {
        'elements': elements or [],
        'events': {'current': {'id': current_gw_id}} if current_gw_id else {'current': None},
        'teams': teams or [{'id': 1, 'short_name': 'ARS'}],
    }


def _element(player_id=1, transfers_in=0, transfers_out=0, ownership='5.0',
             now_cost=80, cost_change_event=0, team_id=1, web_name='Test'):
    return {
        'id': player_id,
        'web_name': web_name,
        'team': team_id,
        'now_cost': now_cost,
        'cost_change_event': cost_change_event,
        'transfers_in_event': transfers_in,
        'transfers_out_event': transfers_out,
        'selected_by_percent': ownership,
    }


def _snapshot_entry(cumulative_net=0, last_now_cost=80, velocity_history=None, dates=None):
    return {
        'cumulative_net': cumulative_net,
        'last_now_cost': last_now_cost,
        'velocity_history': velocity_history or [],
        'dates': dates or [],
    }


def test_rise_prediction():
    """Element with large positive net transfers should predict 'rise' with confidence_pct > 0."""
    elem = _element(player_id=1, transfers_in=2000, transfers_out=0, ownership='10.0', now_cost=80)
    bs = _bootstrap(elements=[elem])
    payload, current_snapshot = compute_price_change_predictions(bs, {})
    assert len(payload['predictions']) >= 1
    pred = payload['predictions'][0]
    assert pred['direction'] == 'rise'
    assert pred['confidence_pct'] > 0


def test_fall_prediction():
    """Element with large negative net transfers should predict 'fall' with confidence_pct > 0."""
    elem = _element(player_id=1, transfers_in=0, transfers_out=2000, ownership='10.0', now_cost=80)
    bs = _bootstrap(elements=[elem])
    payload, current_snapshot = compute_price_change_predictions(bs, {})
    assert len(payload['predictions']) >= 1
    pred = payload['predictions'][0]
    assert pred['direction'] == 'fall'
    assert pred['confidence_pct'] > 0


def test_empty_bootstrap():
    """Empty bootstrap elements list returns cold-start payload with empty predictions."""
    bs = {'elements': [], 'events': {'current': None}, 'teams': []}
    payload, current_snapshot = compute_price_change_predictions(bs, {})
    assert isinstance(payload['generated_at'], str)
    assert 'T' in payload['generated_at']
    assert payload['current_gw'] == 0
    assert payload['snapshot_days'] == 0
    assert payload['predictions'] == []
    assert current_snapshot == {}


def test_confidence_clamp():
    """confidence_pct must never exceed 100.0 even when cumulative_net >> threshold."""
    # cumulative_net far exceeds threshold: ownership=10.0 -> threshold=100; put 100000 net in prev
    elem = _element(player_id=1, transfers_in=0, transfers_out=0, ownership='10.0', now_cost=80)
    prev_snapshot = {
        '1': _snapshot_entry(cumulative_net=100000, last_now_cost=80)
    }
    bs = _bootstrap(elements=[elem])
    payload, current_snapshot = compute_price_change_predictions(bs, prev_snapshot)
    pred = next((p for p in payload['predictions'] if p['player_id'] == 1), None)
    assert pred is not None
    assert pred['confidence_pct'] == 100.0


def test_zero_ownership_guard():
    """selected_by_percent='0.0' must not raise ZeroDivisionError; threshold falls back to 1.0."""
    elem = _element(player_id=1, transfers_in=10, transfers_out=0, ownership='0.0', now_cost=80)
    bs = _bootstrap(elements=[elem])
    # Must not raise
    payload, current_snapshot = compute_price_change_predictions(bs, {})
    assert isinstance(payload, dict)
    assert 'predictions' in payload


def test_eta_days_zero():
    """eta_days must be 0.0 when cumulative_net >= threshold."""
    # ownership=10.0 -> threshold=100; set cumulative_net >= 100 via prev_snapshot
    elem = _element(player_id=1, transfers_in=0, transfers_out=0, ownership='10.0', now_cost=80)
    prev_snapshot = {
        '1': _snapshot_entry(
            cumulative_net=200,
            last_now_cost=80,
            velocity_history=[50, 50, 50],
        )
    }
    bs = _bootstrap(elements=[elem])
    payload, current_snapshot = compute_price_change_predictions(bs, prev_snapshot)
    pred = next((p for p in payload['predictions'] if p['player_id'] == 1), None)
    assert pred is not None
    assert pred['eta_days'] == 0.0


def test_snapshot_days_count():
    """snapshot_days reflects count of distinct ISO dates across all per-player date lists."""
    existing_dates = ['2026-04-28', '2026-04-29', '2026-04-30', '2026-05-01', '2026-05-02']
    elem = _element(player_id=1, transfers_in=5, transfers_out=0, ownership='5.0', now_cost=80)
    prev_snapshot = {
        '1': _snapshot_entry(
            cumulative_net=50,
            last_now_cost=80,
            dates=existing_dates,
        )
    }
    bs = _bootstrap(elements=[elem])
    payload, current_snapshot = compute_price_change_predictions(bs, prev_snapshot)
    # snapshot_days should be >= 5 (exactly 5 if today is already in the list, or 6 if new date added)
    assert payload['snapshot_days'] >= 5
