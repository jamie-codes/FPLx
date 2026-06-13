"""TFR-01: scrape Wikipedia's current-window English transfer list, filter to
Premier League clubs, write transfers_confirmed.json. Accurate-but-lagged by
design. Clones the transfer_news.py isolation/empty-guard conventions; never
calls vercel_blob directly (uses upload.save)."""
import os
import sys
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

from upload import save

REQUEST_TIMEOUT = 10
HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; FPLx/1.0)'}
WIKI_BASE = 'https://en.wikipedia.org/wiki/List_of_English_football_transfers_'

# Wikipedia full name -> FPL teams[].name, for clubs whose rendering diverges.
# Exact-match (Wikipedia text == FPL name) needs no entry. Common promotion
# candidates included defensively so a promoted club still groups.
WIKI_CLUB_TO_FPL = {
    'brighton & hove albion': 'Brighton',
    'leeds united': 'Leeds',
    'manchester city': 'Man City',
    'manchester united': 'Man Utd',
    'newcastle united': 'Newcastle',
    'nottingham forest': "Nott'm Forest",
    'tottenham hotspur': 'Spurs',
    'west ham united': 'West Ham',
    'wolverhampton wanderers': 'Wolves',
    'afc bournemouth': 'Bournemouth',
    "a.f.c. bournemouth": 'Bournemouth',
    # promotion candidates (stable mappings; harmless if not in the league)
    'leicester city': 'Leicester', 'southampton': 'Southampton',
    'ipswich town': 'Ipswich', 'sheffield united': 'Sheffield Utd',
    'west bromwich albion': 'West Brom', 'norwich city': 'Norwich',
}


def _current_window_url(month: int, year: int) -> str:
    """Summer page Jun-Aug; winter page Sep-Jan (winter window straddles the new year)."""
    if 6 <= month <= 8:
        return f'{WIKI_BASE}summer_{year}'
    # Sep-Dec -> winter_<year>-<yy+1>; Jan-May -> winter_<year-1>-<yy> (window opened prior year)
    start = year if month >= 9 else year - 1
    return f'{WIKI_BASE}winter_{start}-{str(start + 1)[-2:]}'


def _build_team_lookup(bootstrap: dict) -> dict:
    """lowercased club-name -> FPL team dict. Includes exact FPL names + aliases."""
    teams = bootstrap.get('teams', [])
    lookup = {t['name'].lower(): t for t in teams}
    by_name = {t['name']: t for t in teams}
    for wiki_name, fpl_name in WIKI_CLUB_TO_FPL.items():
        if fpl_name in by_name:
            lookup[wiki_name] = by_name[fpl_name]
    return lookup


def _resolve(club_text: str, lookup: dict):
    return lookup.get((club_text or '').strip().lower())


def _fetch_html(url: str) -> str:
    resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    return resp.text


def _parse_date(s: str) -> datetime:
    """Parse a Wikipedia-format date like '1 July 2026'. Falls back to datetime.min."""
    try:
        return datetime.strptime(s.strip(), '%d %B %Y')
    except (ValueError, AttributeError):
        return datetime.min


def _parse_transfers(html: str, lookup: dict) -> list:
    """Parse wikitables to rows; keep a row iff from OR to is a PL club.
    Loans-section tables tagged kind='loan'."""
    soup = BeautifulSoup(html, 'lxml')
    rows = []
    for table in soup.select('table.wikitable'):
        # a table is "loans" if a preceding heading mentions Loan
        kind = 'permanent'
        prev = table.find_previous(['h2', 'h3', 'h4'])
        if prev and 'loan' in prev.get_text(strip=True).lower():
            kind = 'loan'
        for tr in table.find_all('tr'):
            cells = tr.find_all(['td', 'th'])
            if len(cells) < 5 or tr.find('th'):
                continue  # header / malformed
            date, player, frm, to, fee = (c.get_text(strip=True) for c in cells[:5])
            t_from, t_to = _resolve(frm, lookup), _resolve(to, lookup)
            if not t_from and not t_to:
                continue  # neither side PL
            rows.append({'date': date, 'player': player, 'from_club': frm,
                         'to_club': to, 'fee': fee, 'kind': kind,
                         '_from': t_from, '_to': t_to})
    return rows


def _build_payload(rows: list, bootstrap: dict, window: str,
                   source_url: str, now_iso: str) -> dict:
    groups = {}  # team_id -> group

    def _grp(team):
        g = groups.get(team['id'])
        if g is None:
            g = {'team_id': team['id'], 'team_name': team['name'],
                 'team_short_name': team['short_name'], 'ins': [], 'outs': []}
            groups[team['id']] = g
        return g

    chronological = []
    for r in rows:
        deal = {'date': r['date'], 'player': r['player'], 'fee': r['fee'], 'kind': r['kind']}
        if r['_to']:   # an IN for the buyer
            _grp(r['_to'])['ins'].append({**deal, 'other_club': r['from_club']})
        if r['_from']:  # an OUT for the seller
            _grp(r['_from'])['outs'].append({**deal, 'other_club': r['to_club']})
        chronological.append({
            'date': r['date'], 'player': r['player'], 'fee': r['fee'], 'kind': r['kind'],
            'from_club': r['from_club'], 'to_club': r['to_club'],
            'from_short': r['_from']['short_name'] if r['_from'] else None,
            'to_short': r['_to']['short_name'] if r['_to'] else None,
            'is_pl_to_pl': bool(r['_from'] and r['_to']),
        })
    # Sort by parsed date (Wikipedia format: "1 July 2026"), newest first.
    chronological.sort(key=lambda d: _parse_date(d['date']), reverse=True)
    return {
        'scraped_at': now_iso, 'window': window, 'source_url': source_url,
        'groups': sorted(groups.values(), key=lambda g: g['team_name']),
        'chronological': chronological,
        'counts': {'deals': len(rows), 'loans': sum(1 for r in rows if r['kind'] == 'loan')},
    }


def compute_confirmed_transfers(bootstrap: dict) -> None:
    if os.getenv('CONFIRMED_TRANSFERS_ENABLED', '').lower() != 'true':
        print('[confirmed_transfers] CONFIRMED_TRANSFERS_ENABLED not set — skipping')
        return
    now = datetime.now(timezone.utc)
    url = _current_window_url(now.month, now.year)
    window = url.rsplit('_', 1)[-1] if 'summer' in url else url.split('transfers_')[-1]
    try:
        html = _fetch_html(url)
    except Exception as exc:
        print(f'[confirmed_transfers] fetch failed ({exc}) — skipping', file=sys.stderr)
        return
    rows = _parse_transfers(html, _build_team_lookup(bootstrap))
    payload = _build_payload(rows, bootstrap, window=window, source_url=url,
                             now_iso=now.isoformat())
    if not payload['chronological']:
        print('[confirmed_transfers] no PL deals parsed — preserving prior artifact', file=sys.stderr)
        return
    save('transfers_confirmed.json', payload)
    print(f"Confirmed transfers written: {payload['counts']['deals']} deals "
          f"({payload['counts']['loans']} loans), window {window}.")
