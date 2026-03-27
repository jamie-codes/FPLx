"""FPL API client with browser-like headers to avoid 403 responses."""

FPL_BASE = 'https://fantasy.premierleague.com/api'

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-GB,en;q=0.9',
    'Origin': 'https://fantasy.premierleague.com',
    'Referer': 'https://fantasy.premierleague.com/',
}


def get_bootstrap_static() -> dict:
    """Fetch the bootstrap-static endpoint (players, teams, events, etc)."""
    import requests
    response = requests.get(f'{FPL_BASE}/bootstrap-static/', headers=HEADERS, timeout=30)
    response.raise_for_status()
    return response.json()


def get_fixtures() -> list:
    """Fetch all fixtures for the current season."""
    import requests
    response = requests.get(f'{FPL_BASE}/fixtures/', headers=HEADERS, timeout=30)
    response.raise_for_status()
    return response.json()


def get_element_summary(player_id: int) -> dict:
    """Fetch per-player history and upcoming fixtures. Used in Phase 4 (DefCon)."""
    import requests
    response = requests.get(f'{FPL_BASE}/element-summary/{player_id}/', headers=HEADERS, timeout=30)
    response.raise_for_status()
    return response.json()
