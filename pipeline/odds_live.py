"""ODDS-02: LIVE pre-match odds from API-Football -> ODDS-01 lookup.

exp09 validated market odds (SHIP_BOTH, cs weight 1.0) but the replay source
(football-data.co.uk) only publishes CLOSING odds — useless pre-deadline. This
module fetches PRE-MATCH odds from API-Football (same APIFOOTBALL_KEY as the
AVAIL-01 injury client), converts 1X2 + Over/Under 2.5 to per-team lambdas via
the exp09-validated odds_model maths, and emits the same lookup shape
odds_join produces: {(fpl_fixture_id, fpl_team_id): {cs_prob, goal_exp,
attack_difficulty}}.

Fixture join: API-Football fixtures are matched to FPL fixtures by kickoff
DATE + both team names (reusing odds_join's tolerant _team_matches). Unmatched
fixtures are skipped with a warning — a partial lookup is still useful; merge
falls back to the model CS-prob wherever no odds entry exists.

Snapshot-cached (3h) at cache/odds_live.json to bound API usage across the
4x-daily + deadline-window pipeline schedule. All failures are non-fatal by
design: no key / API down / no odds yet -> {} and the model runs as before.
"""
from __future__ import annotations

import json
import os
import time
from collections import defaultdict

from odds_model import lambdas_from_odds, cs_prob
from odds_join import _team_matches

_MODULE_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_PATH = os.path.join(_MODULE_DIR, 'cache', 'odds_live.json')
CACHE_TTL_S = 3 * 3600
_BASE = 'https://v3.football.api-sports.io'
_PL_LEAGUE = 39
MATCH_WINNER_BET_ID = 1
OVER_UNDER_BET_ID = 5


def _api_key() -> str:
    key = os.environ.get('APIFOOTBALL_KEY')
    if not key:
        raise RuntimeError('ODDS-02: APIFOOTBALL_KEY not set; live odds unavailable')
    return key


def _get(endpoint: str, params: dict) -> dict:
    import requests
    resp = requests.get(f'{_BASE}/{endpoint}', params=params,
                        headers={'x-apisports-key': _api_key()}, timeout=30)
    resp.raise_for_status()
    return resp.json()


def fetch_upcoming_odds(season: int, next_n: int = 20) -> list[dict]:
    """Raw API-Football odds responses for the next PL fixtures (paged)."""
    out: list[dict] = []
    page = 1
    while True:
        payload = _get('odds', {'league': _PL_LEAGUE, 'season': season,
                                'bet': MATCH_WINNER_BET_ID, 'page': page})
        out.extend(payload.get('response') or [])
        paging = payload.get('paging') or {}
        if page >= int(paging.get('total') or 1) or len(out) >= next_n * 4:
            break
        page += 1
    # Over/Under odds arrive in the same records when bet filter is omitted;
    # with the bet filter we need a second sweep for totals.
    totals: list[dict] = []
    page = 1
    while True:
        payload = _get('odds', {'league': _PL_LEAGUE, 'season': season,
                                'bet': OVER_UNDER_BET_ID, 'page': page})
        totals.extend(payload.get('response') or [])
        paging = payload.get('paging') or {}
        if page >= int(paging.get('total') or 1) or len(totals) >= next_n * 4:
            break
        page += 1
    return _merge_bets(out, totals)


def _first_bookmaker_values(record: dict, bet_id: int) -> list[dict] | None:
    for bm in record.get('bookmakers') or []:
        for bet in bm.get('bets') or []:
            if bet.get('id') == bet_id and bet.get('values'):
                return bet['values']
    return None


def _merge_bets(winner_records: list[dict], totals_records: list[dict]) -> list[dict]:
    """Combine the two sweeps into per-fixture raw rows."""
    totals_by_fx = {r.get('fixture', {}).get('id'): r for r in totals_records}
    rows = []
    for r in winner_records:
        fx = r.get('fixture') or {}
        rows.append({'winner': r, 'totals': totals_by_fx.get(fx.get('id'))})
    return rows


def parse_rows(raw_rows: list[dict]) -> list[dict]:
    """Raw record pairs -> {home, away, date, odds_1x2, odds_ou25} rows.

    API-Football /odds records carry fixture.id + league but the TEAM NAMES and
    kickoff live under `teams`/`fixture.date` on the odds record itself.
    Rows missing either market are dropped (both are needed for the lambdas).
    """
    out = []
    for pair in raw_rows:
        rec = pair.get('winner') or {}
        fx = rec.get('fixture') or {}
        teams = rec.get('teams') or {}
        home = (teams.get('home') or {}).get('name')
        away = (teams.get('away') or {}).get('name')
        date = (fx.get('date') or '')[:10]      # YYYY-MM-DD
        mw = _first_bookmaker_values(rec, MATCH_WINNER_BET_ID)
        tot_rec = pair.get('totals') or {}
        ou = _first_bookmaker_values(tot_rec, OVER_UNDER_BET_ID) if tot_rec else None
        if not (home and away and date and mw):
            continue
        try:
            by_val = {v.get('value'): float(v.get('odd')) for v in mw}
            odds_1x2 = [by_val['Home'], by_val['Draw'], by_val['Away']]
        except (KeyError, TypeError, ValueError):
            continue
        odds_ou25 = None
        if ou:
            try:
                ou_by = {v.get('value'): float(v.get('odd')) for v in ou}
                odds_ou25 = [ou_by['Over 2.5'], ou_by['Under 2.5']]
            except (KeyError, TypeError, ValueError):
                odds_ou25 = None
        if odds_ou25 is None:
            continue
        out.append({'home': home, 'away': away, 'date': date,
                    'odds_1x2': odds_1x2, 'odds_ou25': odds_ou25})
    return out


def _resolve_fpl_team(name: str, teams: list[dict]) -> int | None:
    for t in teams:
        if _team_matches(name, t.get('name') or '', t.get('short_name') or ''):
            return t['id']
    return None


def build_live_odds_lookup(rows: list[dict], bootstrap: dict,
                           fixtures: list[dict]) -> dict:
    """Parsed rows -> {(fpl_fixture_id, fpl_team_id): {cs_prob, goal_exp,
    attack_difficulty}}. Skips (with a print) anything that fails to join."""
    teams = bootstrap.get('teams') or []
    fix_index = {}
    for f in fixtures:
        date = (f.get('kickoff_time') or '')[:10]
        fix_index[(date, f['team_h'], f['team_a'])] = f

    raw = []   # (fix_id, event, team_id, lam_team, lam_opp)
    for r in rows:
        h_id = _resolve_fpl_team(r['home'], teams)
        a_id = _resolve_fpl_team(r['away'], teams)
        if h_id is None or a_id is None:
            print(f"ODDS-02: unmapped team in {r['home']} v {r['away']} — skipped")
            continue
        fix = fix_index.get((r['date'], h_id, a_id))
        if fix is None:
            print(f"ODDS-02: no FPL fixture on {r['date']} for {r['home']} v {r['away']} — skipped")
            continue
        try:
            lam_h, lam_a = lambdas_from_odds(r['odds_1x2'], r['odds_ou25'])
        except (ValueError, ZeroDivisionError) as e:
            print(f"ODDS-02: lambda solve failed for {r['home']} v {r['away']} ({e}) — skipped")
            continue
        raw.append((fix['id'], fix.get('event'), h_id, lam_h, lam_a))
        raw.append((fix['id'], fix.get('event'), a_id, lam_a, lam_h))

    by_gw = defaultdict(list)
    for _fid, gw, _tid, lam_team, _ in raw:
        by_gw[gw].append(lam_team)
    gw_minmax = {gw: (min(v), max(v)) for gw, v in by_gw.items()}

    lookup = {}
    for fid, gw, tid, lam_team, lam_opp in raw:
        lo, hi = gw_minmax[gw]
        norm = (lam_team - lo) / (hi - lo) if hi > lo else 0.5
        lookup[(fid, tid)] = {'cs_prob': cs_prob(lam_opp), 'goal_exp': lam_team,
                              'attack_difficulty': 1.0 - norm}
    return lookup


def get_live_odds_lookup(bootstrap: dict, fixtures: list[dict],
                         season: int) -> dict:
    """Cached wrapper: rows from a fresh-enough snapshot, else the API."""
    rows = None
    try:
        if os.path.exists(CACHE_PATH) and (time.time() - os.path.getmtime(CACHE_PATH)) < CACHE_TTL_S:
            with open(CACHE_PATH, 'r', encoding='utf-8') as f:
                rows = json.load(f)
    except (OSError, json.JSONDecodeError):
        rows = None
    if rows is None:
        rows = parse_rows(fetch_upcoming_odds(season))
        try:
            os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
            with open(CACHE_PATH, 'w', encoding='utf-8') as f:
                json.dump(rows, f)
        except OSError:
            pass
    return build_live_odds_lookup(rows, bootstrap, fixtures)
