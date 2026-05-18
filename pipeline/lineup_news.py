"""Lineup news artifact for FPL players (Phase 117 SCRP-01..SCRP-06).

Public API:
  compute_lineup_news(bootstrap: dict) -> None
      Derives per-player availability from FPL bootstrap (authoritative),
      enriches with news headlines from three optional web sources, and
      writes lineup_news.json to Vercel Blob or local cache.

      FPL bootstrap is the ONLY authoritative source for availability_factor.
      Web scrapers (premierleague.com, Sky Sports RSS, BBC Sport RSS) contribute
      news_headline + news_source fields ONLY (D-03).

      Never writes empty players[] to Blob (SCRP-05): if FPL bootstrap produces
      zero players, save() is skipped and the previous run's artifact is preserved.

Module structure mirrors pipeline/set_piece_quality.py (per-source isolation
try/except blocks, save() from upload, non-fatal by design).
"""

import sys
from datetime import datetime, timezone

import feedparser
import requests
from bs4 import BeautifulSoup

from player_matching import build_name_lookup, match_player  # SCR-02 shared utility
from upload import save

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SKY_RSS_URL = 'https://www.skysports.com/rss/11095'
BBC_RSS_URL = 'https://feeds.bbci.co.uk/sport/football/rss.xml'
PL_URL = 'https://www.premierleague.com/latest-player-injuries'
REQUEST_TIMEOUT = 10
HEADLINE_MAX_LEN = 280
ERROR_MAX_LEN = 200
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
}


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    """Return current UTC time as ISO 8601 string."""
    return datetime.now(timezone.utc).isoformat()


def _compute_availability(element: dict) -> tuple:
    """Compute (availability_factor, status_label) from FPL element dict.

    D-08/D-09/D-10: chance_of_playing_next_round wins over status.
    Order: chance first (if not None), then status fallback.
    Unrecognised status codes return (None, 'unknown') — D-10.
    """
    chance = element.get('chance_of_playing_next_round')
    status = element.get('status', '')

    # D-09: chance_of_playing_next_round is the primary signal when set.
    # Pitfall 4: also handle chance==100 (not in D-08 table but FPL does use it).
    if chance is not None:
        if chance == 100:
            return (1.0, 'confirmed_start')
        elif chance == 75:
            return (0.75, 'doubted')
        elif chance == 50:
            return (0.5, 'doubted')
        elif chance == 25:
            return (0.25, 'doubted')
        elif chance == 0:
            return (0.0, 'confirmed_absent')
        # Other non-None chance values: fall through to status check
        # (e.g. hypothetical values like 33, 66 are treated as doubted heuristically)
        # For safety, map any non-zero positive chance to doubted
        if chance > 0:
            return (round(chance / 100.0, 4), 'doubted')
        return (0.0, 'confirmed_absent')

    # chance is None — fall back to status
    if status == 'a':
        return (1.0, 'confirmed_start')
    elif status == 'd':
        return (0.5, 'doubted')
    elif status in ('i', 's', 'u', 'n'):
        return (0.0, 'confirmed_absent')
    else:
        # D-10: unrecognised status → null factor, unknown label
        return (None, 'unknown')


def _scrape_fpl(bootstrap: dict, scraped_at: str) -> dict:
    """Build per-player entries from FPL bootstrap elements.

    Returns a dict mapping player_id (int) -> player entry dict.
    This is the authoritative source for availability_factor and status_label.
    """
    players_map = {}
    for element in bootstrap.get('elements', []):
        pid = element.get('id')
        if pid is None:
            continue
        availability_factor, status_label = _compute_availability(element)
        entry = {
            'id': pid,
            'availability_factor': availability_factor,
            'status_label': status_label,
            'news_headline': None,
            'news_source': None,
            'scraped_at': scraped_at,
        }
        players_map[pid] = entry
    return players_map


# removed SCR-02: _build_name_lookup and _match_player replaced by player_matching.py
# Both functions are now imported at the top: build_name_lookup, match_player
# lineup_news call sites updated to use the shared implementations.
#
# Note: the old _match_player returned the full element dict; the new match_player
# returns element_id (int). Call sites below are updated accordingly.


def _scrape_premierleague(players_map: dict, name_lookup: dict) -> None:
    """Enrich players_map with news from premierleague.com/latest-player-injuries.

    NOTE: This page is JavaScript-rendered. requests.get() returns skeleton HTML;
    BS4 parse typically yields zero matches. This is an acceptable outcome per
    RESEARCH.md Pitfall 1. Never raises — caller catches exception for isolation.
    Sets news_headline and news_source ONLY if player's headline is None (D-03).
    """
    resp = requests.get(PL_URL, headers=HEADERS, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, 'lxml')

    # Try multiple CSS selectors since the JS-rendered page may vary
    selectors = ['article p', '.injurySection p', '.playerCard', '[class*="injury"]']
    for selector in selectors:
        for el in soup.select(selector):
            text = el.get_text(strip=True)
            if not text:
                continue
            pid = match_player(text, name_lookup)  # SCR-02: returns element_id (int) or None
            if pid is not None:
                if pid in players_map and players_map[pid]['news_headline'] is None:
                    players_map[pid]['news_headline'] = text[:HEADLINE_MAX_LEN]
                    players_map[pid]['news_source'] = 'premierleague'


def _scrape_rss_sky(players_map: dict, name_lookup: dict) -> None:
    """Enrich players_map with news from Sky Sports RSS.

    Never raises on bozo=True (feedparser recovers). Sets headline only if not
    already set (first-come-first-served among web sources — RESEARCH Pitfall 7).
    """
    feed = feedparser.parse(SKY_RSS_URL)
    # Pitfall 5: never bail on feed.bozo — always iterate entries
    for entry in feed.entries:
        title = entry.get('title', '')
        if not title:
            continue
        pid = match_player(title, name_lookup)  # SCR-02: returns element_id (int) or None
        if pid is not None:
            if pid in players_map and players_map[pid]['news_headline'] is None:
                players_map[pid]['news_headline'] = title[:HEADLINE_MAX_LEN]
                players_map[pid]['news_source'] = 'skysports'


def _scrape_rss_bbc(players_map: dict, name_lookup: dict) -> None:
    """Enrich players_map with news from BBC Sport RSS.

    Identical structure to _scrape_rss_sky. BBC only adds headline if Sky Sports
    didn't already set one (first-come-first-served — RESEARCH Pitfall 7).
    """
    feed = feedparser.parse(BBC_RSS_URL)
    for entry in feed.entries:
        title = entry.get('title', '')
        if not title:
            continue
        pid = match_player(title, name_lookup)  # SCR-02: returns element_id (int) or None
        if pid is not None:
            if pid in players_map and players_map[pid]['news_headline'] is None:
                players_map[pid]['news_headline'] = title[:HEADLINE_MAX_LEN]
                players_map[pid]['news_source'] = 'bbc'


# ---------------------------------------------------------------------------
# Public function
# ---------------------------------------------------------------------------

def compute_lineup_news(bootstrap: dict) -> None:
    """Compute lineup news artifact from FPL bootstrap + optional web scrapers.

    Called from run.py immediately after save('fpl_bootstrap.json', bootstrap).
    Wrapped in its own try/except in run.py (non-fatal — D-01).

    Writes lineup_news.json with structure:
      {
        'scraped_at': <ISO UTC string>,
        'players': [<per-player availability + headline>],
        'source_health': {fpl: ..., premierleague: ..., skysports: ..., bbc: ...}
      }

    SCRP-05 guard: if players list is empty, save() is NOT called.
    """
    scraped_at = _now_iso()

    # Initialise source_health for all four sources
    source_health = {
        'fpl':           {'ok': False, 'last_success': None, 'last_error': None},
        'premierleague': {'ok': False, 'last_success': None, 'last_error': None},
        'skysports':     {'ok': False, 'last_success': None, 'last_error': None},
        'bbc':           {'ok': False, 'last_success': None, 'last_error': None},
    }

    # Source 1: FPL bootstrap (authoritative for availability_factor)
    players_map = {}
    try:
        players_map = _scrape_fpl(bootstrap, scraped_at)
        source_health['fpl']['ok'] = True
        source_health['fpl']['last_success'] = scraped_at
    except Exception as fpl_exc:
        source_health['fpl']['last_error'] = str(fpl_exc)[:ERROR_MAX_LEN]
        print(f"[lineup_news/fpl] error: {fpl_exc}", file=sys.stderr)

    # Build name lookup for fuzzy matching (only if we have players)
    name_lookup = {}
    if players_map:
        name_lookup = build_name_lookup(bootstrap.get('elements', []))

    # Source 2: premierleague.com HTML (non-fatal; typically JS-rendered → zero matches)
    try:
        _scrape_premierleague(players_map, name_lookup)
        source_health['premierleague']['ok'] = True
        source_health['premierleague']['last_success'] = scraped_at
    except Exception as pl_exc:
        source_health['premierleague']['last_error'] = str(pl_exc)[:ERROR_MAX_LEN]
        print(f"[lineup_news/premierleague] non-fatal: {pl_exc}", file=sys.stderr)

    # Source 3: Sky Sports RSS (non-fatal)
    try:
        _scrape_rss_sky(players_map, name_lookup)
        source_health['skysports']['ok'] = True
        source_health['skysports']['last_success'] = scraped_at
    except Exception as sky_exc:
        source_health['skysports']['last_error'] = str(sky_exc)[:ERROR_MAX_LEN]
        print(f"[lineup_news/skysports] non-fatal: {sky_exc}", file=sys.stderr)

    # Source 4: BBC Sport RSS (non-fatal)
    try:
        _scrape_rss_bbc(players_map, name_lookup)
        source_health['bbc']['ok'] = True
        source_health['bbc']['last_success'] = scraped_at
    except Exception as bbc_exc:
        source_health['bbc']['last_error'] = str(bbc_exc)[:ERROR_MAX_LEN]
        print(f"[lineup_news/bbc] non-fatal: {bbc_exc}", file=sys.stderr)

    # Build players list from map values
    players = list(players_map.values())

    # SCRP-05 guard: never write empty players[] to Blob
    if not players:
        print("[lineup_news] players list empty — skipping save, preserving previous run")
        return

    payload = {
        'scraped_at': scraped_at,
        'players': players,
        'source_health': source_health,
    }
    save('lineup_news.json', payload)
