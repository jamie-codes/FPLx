"""ODDS-01: fetch + parse football-data.co.uk EPL closing-odds CSV.

Verified source (2026-06-14): https://www.football-data.co.uk/mmz4281/2526/E0.csv
Uses closing-average columns (AvgC*) with per-cell fallback to B365*. For the
exp09 experiment, fetch_season_csv is run once to create the committed snapshot
at data/odds/E0_2025_26.csv; the experiment then reads the snapshot (offline/CI).
"""
import csv
import io
import os

_MODULE_DIR = os.path.dirname(os.path.abspath(__file__))
SNAPSHOT_PATH = os.path.join(_MODULE_DIR, 'data', 'odds', 'E0_2025_26.csv')
_URL_TMPL = 'https://www.football-data.co.uk/mmz4281/{code}/E0.csv'


def fetch_season_csv(season_code: str = '2526') -> str:
    """GET the season CSV text. Raises on non-200. Used to create the snapshot."""
    import requests
    resp = requests.get(_URL_TMPL.format(code=season_code),
                        headers={'User-Agent': 'Mozilla/5.0'}, timeout=30)
    resp.raise_for_status()
    return resp.text


def _num(row: dict, *keys) -> float | None:
    """First non-blank value among keys, as float; None if all blank/missing/bad."""
    for k in keys:
        v = (row.get(k) or '').strip()
        if v:
            try:
                return float(v)
            except ValueError:
                continue
    return None


def parse_odds_csv(text: str) -> list[dict]:
    """Parse CSV text into odds rows. Closing-average columns with B365 fallback.
    Rows missing a full 1X2 or O/U2.5 quote from BOTH sources are skipped."""
    reader = csv.DictReader(io.StringIO(text.lstrip('﻿')))
    out = []
    for row in reader:
        home = (row.get('HomeTeam') or '').strip()
        away = (row.get('AwayTeam') or '').strip()
        if not home or not away:
            continue
        h = _num(row, 'AvgCH', 'B365H')
        d = _num(row, 'AvgCD', 'B365D')
        a = _num(row, 'AvgCA', 'B365A')
        over = _num(row, 'AvgC>2.5', 'B365>2.5')
        under = _num(row, 'AvgC<2.5', 'B365<2.5')
        if None in (h, d, a, over, under):
            continue
        try:
            fthg = int(row.get('FTHG') or 0)
            ftag = int(row.get('FTAG') or 0)
        except ValueError:
            fthg, ftag = 0, 0
        out.append({
            'date': (row.get('Date') or '').strip(),
            'home': home,
            'away': away,
            'fthg': fthg,
            'ftag': ftag,
            'odds_1x2': (h, d, a),
            'odds_ou25': (over, under),
        })
    return out
