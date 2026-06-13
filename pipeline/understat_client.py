"""Understat xG/xA data client — direct HTTP fetch, no external scraping library."""

import json
import os
import requests
from datetime import datetime, timezone, timedelta

CACHE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache', 'understat_current.json')
CACHE_TTL_HOURS = 24

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/124.0.0.0 Safari/537.36'
    ),
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'en-GB,en;q=0.5',
    'Connection': 'keep-alive',
}


def _current_season_year() -> int:
    """Return the Understat season start year for the current FPL season.

    FPL seasons run Aug–May, so April 2026 → season start 2025.
    """
    now = datetime.now(timezone.utc)
    return now.year if now.month >= 8 else now.year - 1


def _is_cache_fresh() -> bool:
    if not os.path.exists(CACHE_PATH):
        return False
    try:
        with open(CACHE_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        cached_at_str = data.get('_cached_at')
        if not cached_at_str:
            return False
        cached_at = datetime.fromisoformat(cached_at_str)
        if cached_at.tzinfo is None:
            cached_at = cached_at.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) - cached_at < timedelta(hours=CACHE_TTL_HOURS)
    except Exception:
        return False


def _load_cache() -> dict:
    with open(CACHE_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return {k: v for k, v in data.items() if k != '_cached_at'}


def _write_cache(players: dict) -> None:
    os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
    payload = dict(players)
    payload['_cached_at'] = datetime.now(timezone.utc).isoformat()
    with open(CACHE_PATH, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False)


def get_understat_players() -> dict:
    """Fetch Understat xG/xA season stats for all EPL players.

    Returns a dict keyed by Understat player ID (string) with fields:
        player, team, xG, xA, npxG, npxA, minutes

    Returns an empty dict (with a warning) if Understat is unreachable —
    the pipeline will fall back to the layered DQ-01 fallback (FPL xG/xA per-90,
    then goals/assists proxy) for xG/xA.
    """
    if _is_cache_fresh():
        print("Understat: using cached data (< 24h old)")
        return _load_cache()

    season_year = _current_season_year()
    print(f"Understat: fetching via JSON endpoint (season {season_year}) ...")

    try:
        resp = requests.post(
            'https://understat.com/main/getPlayersStats/',
            data={'league': 'EPL', 'season': str(season_year)},
            headers={**HEADERS, 'X-Requested-With': 'XMLHttpRequest',
                     'Referer': f'https://understat.com/league/EPL/{season_year}'},
            timeout=30,
        )
        resp.raise_for_status()
        raw_players = resp.json().get('players', [])
    except Exception as exc:
        print(f"Understat: HTTP error — {exc}. Falling back to layered DQ-01 data.")
        return {}

    if not raw_players:
        print("Understat: empty players list returned. Falling back to layered DQ-01 data.")
        return {}

    players = {}
    for p in raw_players:
        pid = str(p.get('id', ''))
        if not pid:
            continue

        team = p.get('team_title', '')
        if isinstance(team, list):
            team = team[-1] if team else ''

        players[pid] = {
            'player':  p.get('player_name', ''),
            'team':    str(team),
            'xG':      float(p.get('xG',   0) or 0),
            'xA':      float(p.get('xA',   0) or 0),
            'npxG':    float(p.get('npxG', 0) or 0),
            'npxA':    float(p.get('npxA', 0) or 0),
            'minutes': int(p.get('time',   0) or 0),
        }

    _write_cache(players)
    print(f"Understat: fetched {len(players)} players, cache written")
    return players
