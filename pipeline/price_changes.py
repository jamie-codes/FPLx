"""Price change predictor — Phase 54 PRC-01.

Mirrors pipeline/bonus.py shape: pre-merge module, zero HTTP calls, all data
passed as arguments. Reads cumulative net-transfer snapshot from prev_snapshot
(persisted by pipeline/run.py as price_changes_snapshot.json) and computes
direction (rise/fall/stable), confidence_pct, and eta_days per player.

Output is persisted by pipeline/run.py as price_changes.json and served
by /api/price-changes.
"""

import json
from datetime import datetime, timezone

# Confidence / stability thresholds
MIN_DAYS_FOR_TIERS = 14      # SC-4 / D-06 threshold for early-data flag
STABLE_NET_FLOOR_RATIO = 0.05         # |cumulative_net| < threshold * this -> stable
MIN_CONFIDENCE_FOR_DIRECTION = 5.0    # confidence_pct floor before stable
VELOCITY_WINDOW = 7                   # days of velocity history retained


def compute_price_change_predictions(
    bootstrap: dict,
    prev_snapshot: dict,
) -> tuple[dict, dict]:
    """Returns (predictions_payload, current_snapshot).

    predictions_payload shape:
      {
        'generated_at': str,            # ISO 8601 UTC
        'current_gw': int,              # bootstrap['events']['current']['id'] or 0
        'snapshot_days': int,           # count of distinct ISO dates across all per-player date lists
        'predictions': list[dict],      # [] on cold start
      }

    Each prediction dict shape:
      {
        'player_id': int,
        'name': str,
        'team': str,
        'now_cost': int,
        'direction': 'rise' | 'fall' | 'stable',
        'confidence_pct': float,
        'eta_days': float,
        'cumulative_net': int,
        'selected_by_percent': str,
      }

    current_snapshot shape (per player_id key as str):
      {
        '<player_id>': {
          'cumulative_net': int,
          'last_now_cost': int,
          'velocity_history': list[int],
          'dates': list[str],
        },
        ...
      }
    """
    today_iso = datetime.now(timezone.utc).date().isoformat()
    team_lookup = {t['id']: t.get('short_name', '') for t in bootstrap.get('teams', [])}

    # current_gw: FPL API returns events as a list; find the is_current entry
    current_event = next(
        (e for e in bootstrap.get('events', []) if e.get('is_current')), None
    )
    current_gw = current_event['id'] if current_event else 0

    predictions = []
    current_snapshot = {}

    for element in bootstrap.get('elements', []):
        player_id = element['id']
        prev_player = prev_snapshot.get(str(player_id))
        prediction, snapshot_entry = _compute_player_prediction(
            element, prev_player, today_iso, team_lookup
        )
        current_snapshot[str(player_id)] = snapshot_entry
        if prediction is not None:
            predictions.append(prediction)

    # snapshot_days: count of distinct ISO dates across all per-player date lists
    all_dates: set = set()
    for p in current_snapshot.values():
        all_dates.update(p.get('dates', []))
    snapshot_days = len(all_dates)

    payload = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'current_gw': current_gw,
        'snapshot_days': snapshot_days,
        'predictions': predictions,
    }
    return payload, current_snapshot


def _compute_player_prediction(
    element: dict,
    prev_player: dict | None,
    today_iso: str,
    team_lookup: dict,
) -> tuple:
    """Compute prediction and snapshot entry for a single player.

    Returns (prediction_dict_or_None, snapshot_entry).
    """
    player_id = element['id']
    daily_delta = element.get('transfers_in_event', 0) - element.get('transfers_out_event', 0)
    prev_player = prev_player or {}

    # GW-reset boundary: reset cumulative_net when price has already changed
    # (cost_change_event != 0) OR when now_cost differs from last recorded cost.
    prev_now_cost = prev_player.get('last_now_cost', element['now_cost'])
    if element.get('cost_change_event', 0) != 0 or prev_now_cost != element['now_cost']:
        cumulative_net = daily_delta
        velocity_history = [daily_delta]
        dates = [today_iso]
    else:
        cumulative_net = prev_player.get('cumulative_net', 0) + daily_delta
        velocity_history = (prev_player.get('velocity_history') or [])[-(VELOCITY_WINDOW - 1):] + [daily_delta]
        prev_dates = prev_player.get('dates') or []
        dates = prev_dates if today_iso in prev_dates else (prev_dates + [today_iso])

    # Ownership guard (Pitfall 3): threshold = max(1.0, ownership * 10)
    ownership = float(element.get('selected_by_percent', '0') or '0')
    threshold = max(1.0, ownership * 10)

    # Confidence: clamp cumulative_net / threshold to [0, 1] * 100
    confidence_pct = round(min(1.0, abs(cumulative_net) / threshold) * 100, 2)

    # Velocity and eta_days
    avg_velocity = sum(abs(v) for v in velocity_history) / max(1, len(velocity_history))
    if avg_velocity > 0:
        eta_days = max(0.0, (threshold - abs(cumulative_net)) / avg_velocity)
    else:
        eta_days = 999.0
    eta_days = round(eta_days, 2)

    # Direction rule
    if abs(cumulative_net) < threshold * STABLE_NET_FLOOR_RATIO or confidence_pct < MIN_CONFIDENCE_FOR_DIRECTION:
        direction = 'stable'
    elif cumulative_net > 0:
        direction = 'rise'
    else:
        direction = 'fall'

    snapshot_entry = {
        'cumulative_net': cumulative_net,
        'last_now_cost': element['now_cost'],
        'velocity_history': velocity_history,
        'dates': dates,
    }

    # Omit cold-start zero rows from predictions list
    if direction == 'stable' and cumulative_net == 0 and not prev_player:
        prediction = None
    else:
        prediction = {
            'player_id': player_id,
            'name': element.get('web_name', ''),
            'team': team_lookup.get(element.get('team', 0), ''),
            'now_cost': element['now_cost'],
            'direction': direction,
            'confidence_pct': confidence_pct,
            'eta_days': eta_days,
            'cumulative_net': cumulative_net,
            'selected_by_percent': str(element.get('selected_by_percent', '0')),
        }

    return prediction, snapshot_entry
