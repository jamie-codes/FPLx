"""Understat xG/xA data client using soccerdata with 24h local cache."""

import json
import os
from datetime import datetime, timezone, timedelta

CACHE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache', 'understat_current.json')
CACHE_TTL_HOURS = 24


def _is_cache_fresh() -> bool:
    """Return True if cache exists and was written within the last 24 hours."""
    if not os.path.exists(CACHE_PATH):
        return False
    try:
        with open(CACHE_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        cached_at_str = data.get('_cached_at')
        if not cached_at_str:
            return False
        cached_at = datetime.fromisoformat(cached_at_str)
        # Ensure timezone-aware comparison
        if cached_at.tzinfo is None:
            cached_at = cached_at.replace(tzinfo=timezone.utc)
        age = datetime.now(timezone.utc) - cached_at
        return age < timedelta(hours=CACHE_TTL_HOURS)
    except Exception:
        return False


def _load_cache() -> dict:
    """Load and return cached Understat data (without the _cached_at key)."""
    with open(CACHE_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return {k: v for k, v in data.items() if k != '_cached_at'}


def _write_cache(players: dict) -> None:
    """Write players dict to cache with a _cached_at timestamp."""
    os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
    payload = dict(players)
    payload['_cached_at'] = datetime.now(timezone.utc).isoformat()
    with open(CACHE_PATH, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False)


def get_understat_players() -> dict:
    """Fetch Understat xG/xA season stats for all EPL players.

    Returns a dict keyed by Understat player ID (string) with fields:
        player, team, xG, xA, npxG, npxA, minutes

    Uses a 24h local cache (pipeline/cache/understat_current.json) to avoid
    slow re-fetches on every pipeline run (D-07).
    """
    if _is_cache_fresh():
        print("Understat: using cached data (< 24h old)")
        return _load_cache()

    print("Understat: fetching fresh data via soccerdata...")
    from soccerdata import Understat

    us = Understat(leagues="ENG-Premier League", seasons="2425")
    df = us.read_player_season_stats()

    # Reset index to expose player ID as a column (soccerdata uses multi-index)
    df = df.reset_index()

    # Identify the player ID column — soccerdata uses 'player_id' or the index name
    # After reset_index, look for 'player_id' or fallback to inspect columns
    id_col = None
    for candidate in ('player_id', 'id', 'understat_id'):
        if candidate in df.columns:
            id_col = candidate
            break

    # Identify the player name column
    name_col = None
    for candidate in ('player', 'player_name', 'name'):
        if candidate in df.columns:
            name_col = candidate
            break

    # Identify team column
    team_col = None
    for candidate in ('team', 'team_name', 'club'):
        if candidate in df.columns:
            team_col = candidate
            break

    def _safe_float(val) -> float:
        try:
            return float(val)
        except (TypeError, ValueError):
            return 0.0

    def _safe_int(val) -> int:
        try:
            return int(val)
        except (TypeError, ValueError):
            return 0

    players = {}
    for _, row in df.iterrows():
        # Determine the ID — use explicit id_col or fall back to row name
        if id_col:
            player_id = str(row[id_col])
        else:
            # soccerdata may place the player ID as the index even after reset
            # Try the first level of the original multi-index if available
            player_id = str(row.name) if hasattr(row, 'name') else str(row.iloc[0])

        player_name = str(row[name_col]) if name_col and name_col in row.index else ''
        team_name = str(row[team_col]) if team_col and team_col in row.index else ''

        players[player_id] = {
            'player': player_name,
            'team': team_name,
            'xG': _safe_float(row.get('xG', row.get('xg', 0))),
            'xA': _safe_float(row.get('xA', row.get('xa', 0))),
            'npxG': _safe_float(row.get('npxG', row.get('npxg', 0))),
            'npxA': _safe_float(row.get('npxA', row.get('npxa', 0))),
            'minutes': _safe_int(row.get('minutes', row.get('time', 0))),
        }

    _write_cache(players)
    print(f"Understat: fetched {len(players)} players, cache written")
    return players
