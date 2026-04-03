"""Understat xG/xA data client — direct HTTP fetch, no external scraping library."""

import json
import os
import re
import requests
from datetime import datetime, timezone, timedelta

CACHE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache', 'understat_current.json')
CACHE_TTL_HOURS = 24


def _current_season_year() -> int:
    """Return the Understat season start year for the current FPL season.

    FPL seasons run Aug–May, so April 2026 → season start 2025.
    """
    now = datetime.now(timezone.utc)
    return now.year if now.month >= 8 else now.year - 1


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

    Fetches directly from understat.com (JSON embedded in page HTML).
    Uses a 24h local cache to avoid repeated requests.
    """
    if _is_cache_fresh():
        print("Understat: using cached data (< 24h old)")
        return _load_cache()

    season_year = _current_season_year()
    url = f'https://understat.com/league/EPL/{season_year}'
    print(f"Understat: fetching fresh data from {url} ...")

    resp = requests.get(
        url,
        headers={'User-Agent': 'Mozilla/5.0 (compatible; FPLAnalyst/1.0)'},
        timeout=30,
    )
    resp.raise_for_status()

    # Understat embeds player data as JSON.parse('...') in a <script> tag
    match = re.search(r"var playersData\s*=\s*JSON\.parse\('(.+?)'\)", resp.text)
    if not match:
        raise RuntimeError(
            "playersData not found in Understat HTML — page structure may have changed"
        )

    # The string uses unicode escape sequences — decode them
    encoded = match.group(1)
    decoded = encoded.encode('raw_unicode_escape').decode('unicode_escape')
    raw_players = json.loads(decoded)

    players = {}
    for p in raw_players:
        pid = str(p.get('id', ''))
        if not pid:
            continue

        # team_title can be a list for mid-season transfers — take the last entry
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
