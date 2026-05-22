"""Transfer news RSS scraper, classifier, and artifact writer (Phase 123 SCR-01, SCR-03, SCR-05).

Scrapes Sky Sports and BBC Sport RSS feeds for football transfer news, classifies
each article by category, resolves FPL element_ids via player_matching.py, and
writes transfer_news.json to Vercel Blob (or local cache).

Public API:
  scrape(bootstrap: dict) -> None
      Entry point called from run.py. Env-gated, isolated per RSS source,
      empty-guarded. Never writes articles: [] to Blob (SCRP-05 mirror).

  classify_article(title: str, summary: str | None) -> str
      Rule-based keyword classifier returning one of 5 classes.

Decisions:
  D-01: rapidfuzz token_sort_ratio >= 85 via player_matching.match_player
  D-02: Name normalization reuses player_matching.build_name_lookup (Phase 117 pattern)
  D-03: Keyword sets locked in CONTEXT.md — confirmed_signing/rumour/injury_return/rotation_signal/general
  D-04: Classification at parse time, stored in artifact; deterministic, zero cost
  D-05: transfer_news runs year-round — NOT guarded by IS_OFF_SEASON in run.py
  D-06: TRANSFER_NEWS_ENABLED env var gate at top of scrape(); pattern from CONTEXT.md

Deduplication: URL-based (exact match across both feeds; keep first occurrence).
No age cutoff in v1 — RSS feeds naturally return only recent items.

Anti-patterns avoided:
  - Never calls vercel_blob directly; uses upload.save() exclusively
  - Never bails on feed.bozo (Pitfall 3); always iterates feed.entries
  - Never writes empty articles to Blob (Pitfall 4 / SCRP-05)
  - Transfermarkt omitted — no official RSS feed exists (CF-01 from RESEARCH.md)
"""

import os
import sys
from datetime import datetime, timezone
from typing import Literal

import feedparser

from player_matching import build_name_lookup, match_player
from upload import save

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SKY_RSS_URL = 'https://www.skysports.com/rss/11095'
BBC_RSS_URL = 'https://feeds.bbci.co.uk/sport/football/rss.xml'
HEADLINE_MAX_LEN = 280
SUMMARY_MAX_LEN = 500
ERROR_MAX_LEN = 200

# D-03: Keyword sets in priority order (first match wins).
# Keys are used as-is for classification output — do NOT rename.
# All matching is case-insensitive (both sides lowercased at match time).
CLASSIFICATION_KEYWORDS = {
    'confirmed_signing': ['sign', 'join', 'complet', 'agreed', 'confirmed', 'done deal'],
    'rumour':            ['linked', 'interest', 'bid', 'target', 'wants', 'considers'],
    'injury_return':     ['returns', 'fit', 'back in training', 'recovered'],
    'rotation_signal':   ['rotation', 'bench', 'rested', 'squad player'],
}

# D-02: skysports and bbc both map to Reliable. Official/Speculative reserved for future sources.
SOURCE_TIER: dict[str, Literal['Official', 'Reliable', 'Speculative']] = {
    'skysports': 'Reliable',
    'bbc':       'Reliable',
}


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _get_source_tier(source: str) -> Literal['Official', 'Reliable', 'Speculative']:
    """Return reliability tier for a given source identifier.

    Mirrors the shape of classify_article(). Falls back to 'Speculative' for
    unknown sources (D-02 fallback default).
    """
    return SOURCE_TIER.get(source, 'Speculative')


def _now_iso() -> str:
    """Return current UTC time as ISO 8601 string."""
    return datetime.now(timezone.utc).isoformat()


def _scrape_rss_sky(articles: list, name_lookup: dict, seen_urls: set, scraped_at: str) -> None:
    """Fetch Sky Sports RSS and append article dicts to articles list.

    Never raises (caller wraps in try/except for source isolation).
    Skips entries with no title or a URL already seen (deduplication).
    Pitfall 3: never bails on feed.bozo — always iterates feed.entries.
    """
    feed = feedparser.parse(SKY_RSS_URL)
    # Never bail on bozo — it is a parse warning, not a fatal error (Pitfall 3)
    for entry in feed.entries:
        title = entry.get('title', '')
        if not title:
            continue
        url = entry.get('link', '')
        if url and url in seen_urls:
            continue  # URL-based deduplication across feeds
        summary = entry.get('summary', None)
        published = entry.get('published', None)
        classification = classify_article(title, summary)
        match_text = title + ' ' + (summary or '')
        element_id = match_player(match_text, name_lookup)
        article = {
            'title': title[:HEADLINE_MAX_LEN],
            'summary': summary[:SUMMARY_MAX_LEN] if summary else None,
            'url': url,
            'published': published,
            'source': 'skysports',
            'classification': classification,
            'element_id': element_id,
            'source_tier': _get_source_tier('skysports'),   # D-01/D-03
            'scraped_at': scraped_at,
        }
        articles.append(article)
        if url:
            seen_urls.add(url)


def _scrape_rss_bbc(articles: list, name_lookup: dict, seen_urls: set, scraped_at: str) -> None:
    """Fetch BBC Sport RSS and append article dicts to articles list.

    Identical structure to _scrape_rss_sky. Deduplicates by URL against seen_urls
    (which includes URLs already added from Sky Sports).
    """
    feed = feedparser.parse(BBC_RSS_URL)
    for entry in feed.entries:
        title = entry.get('title', '')
        if not title:
            continue
        url = entry.get('link', '')
        if url and url in seen_urls:
            continue
        summary = entry.get('summary', None)
        published = entry.get('published', None)
        classification = classify_article(title, summary)
        match_text = title + ' ' + (summary or '')
        element_id = match_player(match_text, name_lookup)
        article = {
            'title': title[:HEADLINE_MAX_LEN],
            'summary': summary[:SUMMARY_MAX_LEN] if summary else None,
            'url': url,
            'published': published,
            'source': 'bbc',
            'classification': classification,
            'element_id': element_id,
            'source_tier': _get_source_tier('bbc'),   # D-01/D-03
            'scraped_at': scraped_at,
        }
        articles.append(article)
        if url:
            seen_urls.add(url)


# ---------------------------------------------------------------------------
# Public functions
# ---------------------------------------------------------------------------

def classify_article(title: str, summary: str | None) -> str:
    """Classify an article using rule-based keyword matching.

    Args:
        title:   Article headline (required).
        summary: Optional article body/summary text.

    Returns:
        One of: 'confirmed_signing', 'rumour', 'injury_return', 'rotation_signal', 'general'.
        Returns the first class whose any keyword is found in the concatenated
        title + summary text (both lowercased). Falls back to 'general'.
    """
    text = (title + ' ' + (summary or '')).lower()
    for cls, keywords in CLASSIFICATION_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            return cls
    return 'general'


def scrape(bootstrap: dict) -> None:
    """Scrape Sky Sports and BBC Sport RSS feeds and write transfer_news.json.

    Env-gated: returns early if TRANSFER_NEWS_ENABLED env var is not 'true'.
    Each RSS source is isolated in its own try/except (non-fatal).
    Empty-guarded: never calls save() when articles list is empty.

    Artifact shape (transfer_news.json):
      {
        'scraped_at': '<ISO UTC>',
        'articles': [<article dicts with classification and element_id>],
        'source_health': {
          'skysports': {'ok': bool, 'last_success': str|None, 'last_error': str|None},
          'bbc':       {'ok': bool, 'last_success': str|None, 'last_error': str|None},
        }
      }
    """
    # D-06 env gate: early-return if not explicitly enabled
    if os.getenv('TRANSFER_NEWS_ENABLED', '').lower() != 'true':
        print('[transfer_news] TRANSFER_NEWS_ENABLED not set — skipping')
        return

    scraped_at = _now_iso()

    # Build FPL player name → element_id lookup for fuzzy matching
    name_lookup = build_name_lookup(bootstrap.get('elements', []))

    articles: list = []
    seen_urls: set = set()  # URL-based deduplication across feeds

    # Initialise source_health for both sources
    source_health = {
        'skysports': {'ok': False, 'last_success': None, 'last_error': None},
        'bbc':       {'ok': False, 'last_success': None, 'last_error': None},
    }

    # Source 1: Sky Sports RSS (non-fatal)
    try:
        _scrape_rss_sky(articles, name_lookup, seen_urls, scraped_at)
        source_health['skysports']['ok'] = True
        source_health['skysports']['last_success'] = scraped_at
    except Exception as sky_exc:
        source_health['skysports']['last_error'] = str(sky_exc)[:ERROR_MAX_LEN]
        print(f'[transfer_news/skysports] non-fatal: {sky_exc}', file=sys.stderr)

    # Source 2: BBC Sport RSS (non-fatal)
    try:
        _scrape_rss_bbc(articles, name_lookup, seen_urls, scraped_at)
        source_health['bbc']['ok'] = True
        source_health['bbc']['last_success'] = scraped_at
    except Exception as bbc_exc:
        source_health['bbc']['last_error'] = str(bbc_exc)[:ERROR_MAX_LEN]
        print(f'[transfer_news/bbc] non-fatal: {bbc_exc}', file=sys.stderr)

    # SCRP-05 empty-guard: never write empty articles to Blob (Pitfall 4)
    if not articles:
        print('[transfer_news] articles list empty — skipping save, preserving previous run')
        return

    payload = {
        'scraped_at': scraped_at,
        'articles': articles,
        'source_health': source_health,
    }
    save('transfer_news.json', payload)
