"""CUP-01: European + domestic cup fixture dates for rotation risk.

Replaces the hand-maintained `european_cup_dates.EUROPEAN_CUP_DATES`, which
shipped as an empty dict with a comment asking someone to populate it "at
execution time". Nobody did, so the rotation-risk flag was False for every
team all season — City played a Champions League matchday three days before a
Saturday 14:00 kickoff and nothing in the app knew (found 2026-09-01).

A hardcoded calendar rots exactly the same way, so these dates are FETCHED
from api-football and refreshed weekly, using the same committed-map pattern
as the photo layer (pipeline/cache is gitignored and CI is ephemeral).

Scope note: this drives a DISPLAY flag only. EUR-01 (exp10) tested congestion
as a model signal and it failed the robustness bar (permutation p=0.04 against
p<=0.02), so it is deliberately not wired into projections.
"""
import json
import os
import time
from datetime import datetime, timedelta, timezone

from injury_join import _resolve_team_id, _team_name_to_id

_MODULE_DIR = os.path.dirname(os.path.abspath(__file__))
MAP_PATH = os.path.join(_MODULE_DIR, 'data', 'cup_fixture_dates.json')
_BASE = 'https://v3.football.api-sports.io'
MAX_AGE_DAYS = 7
PAGE_DELAY_S = 1.5

# api-football league ids. English clubs can appear in any of these; the join
# drops everyone who is not a current PL club, so extra competitions are free.
COMPETITIONS = {
    2: 'UCL',
    3: 'UEL',
    848: 'UECL',
    48: 'League Cup (Carabao)',
    45: 'FA Cup',
}


def _api_key() -> str:
    key = os.environ.get('APIFOOTBALL_KEY')
    if not key:
        raise RuntimeError('CUP-01: APIFOOTBALL_KEY not set; cup-date refresh unavailable')
    return key


def _get(endpoint: str, params: dict) -> dict:
    import requests
    resp = requests.get(f'{_BASE}/{endpoint}', params=params,
                        headers={'x-apisports-key': _api_key()}, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    errs = data.get('errors')
    if errs:
        raise RuntimeError(f'CUP-01: api-football error response: {errs}')
    return data


def parse_cup_fixtures(response: list) -> list[dict]:
    """Flatten /fixtures records to one row per TEAM per fixture.

    Carries the api-football team id as well as the name: matching on name
    alone picked up namesakes (a women's or youth side sharing a club name),
    which put a cup date on 2026-09-05 for Man City — the same day as their
    league game, which no club can play (found 2026-09-01).
    """
    out = []
    for rec in response or []:
        fx = rec.get('fixture') or {}
        teams = rec.get('teams') or {}
        league_id = (rec.get('league') or {}).get('id')
        date = (fx.get('date') or '')[:10]
        home = teams.get('home') or {}
        away = teams.get('away') or {}
        if not (date and home.get('name') and away.get('name')):
            continue
        for side in (home, away):
            out.append({'team_name': side.get('name'), 'team_af_id': side.get('id'),
                        'date': date, 'league_id': league_id})
    return out


def fetch_pl_team_ids(season: int, league: int = 39) -> dict[int, str]:
    """{api_football_team_id: team_name} for the actual PL men's clubs.

    Derived from the league's own fixtures, so it is exactly the set of clubs
    that play in the competition FPL models — the reliable way to reject
    same-named women's/youth sides in the cup feeds.
    """
    payload = _get('fixtures', {'league': league, 'season': season})
    out: dict[int, str] = {}
    for rec in payload.get('response') or []:
        teams = rec.get('teams') or {}
        for side in (teams.get('home') or {}, teams.get('away') or {}):
            if side.get('id') and side.get('name'):
                out[side['id']] = side['name']
    return out


def fetch_cup_fixtures(season: int) -> list[dict]:
    """Upcoming fixtures across every tracked cup competition."""
    out: list[dict] = []
    for league_id, label in COMPETITIONS.items():
        try:
            payload = _get('fixtures', {'league': league_id, 'season': season})
            rows = parse_cup_fixtures(payload.get('response') or [])
            out.extend(rows)
            print(f'CUP-01: {label} — {len(rows) // 2} fixtures')
        except Exception as exc:
            # One competition failing must not lose the others.
            print(f'CUP-01: {label} fetch failed ({exc}); skipping')
        time.sleep(PAGE_DELAY_S)
    return out


def build_cup_date_map(rows: list[dict], bootstrap: dict,
                       pl_team_ids: dict[int, str] | None = None) -> dict[str, list[str]]:
    """{str(fpl_team_id): sorted unique ISO dates}. Non-PL clubs are dropped.

    When `pl_team_ids` is supplied (the api-football ids of the real PL clubs),
    a row must match one of those ids to count — names alone let namesake
    women's/youth sides through. Falls back to name matching without it.
    """
    table = _team_name_to_id(bootstrap)
    teams = bootstrap.get('teams') or []
    by_team: dict[str, set] = {}
    for r in rows:
        if pl_team_ids is not None:
            af_id = r.get('team_af_id')
            if af_id not in pl_team_ids:
                continue
            name = pl_team_ids[af_id]
        else:
            name = r['team_name']
        team_id = _resolve_team_id(name, table, teams)
        if team_id is None:
            continue
        by_team.setdefault(str(team_id), set()).add(r['date'])
    return {k: sorted(v) for k, v in by_team.items()}


def load_cup_dates(path: str = MAP_PATH) -> dict[int, list[str]]:
    """{fpl_team_id: [ISO dates]} with INT keys — _apply_rotation_risk looks up
    by int team id, while JSON only has string keys."""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            raw = json.load(f).get('dates', {}) or {}
        return {int(k): v for k, v in raw.items()}
    except (FileNotFoundError, json.JSONDecodeError, OSError, ValueError):
        return {}


def _needs_refresh(path: str, season: int, max_age_days: int = MAX_AGE_DAYS) -> bool:
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return True
    if data.get('_season') != season or not data.get('dates'):
        return True
    try:
        refreshed = datetime.fromisoformat(data.get('_refreshed_at', ''))
        if refreshed.tzinfo is None:
            refreshed = refreshed.replace(tzinfo=timezone.utc)
    except ValueError:
        return True
    return datetime.now(timezone.utc) - refreshed > timedelta(days=max_age_days)


def refresh_cup_dates(bootstrap: dict, season: int, path: str = MAP_PATH) -> dict[int, list[str]]:
    """Refresh the committed map when stale, then return it (int-keyed).

    Non-fatal: any failure keeps the existing map, and an empty map simply
    means rotation_risk stays False — the behaviour before CUP-01.
    """
    if not _needs_refresh(path, season):
        return load_cup_dates(path)
    try:
        pl_team_ids = fetch_pl_team_ids(season)
        print(f'CUP-01: {len(pl_team_ids)} PL club ids resolved for id-matching')
        rows = fetch_cup_fixtures(season)
        dates = build_cup_date_map(rows, bootstrap, pl_team_ids or None)
        if not dates:
            print('CUP-01: refresh produced no PL club dates — keeping existing map')
            return load_cup_dates(path)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump({'_refreshed_at': datetime.now(timezone.utc).isoformat(),
                       '_season': season, 'dates': dates}, f,
                      ensure_ascii=False, indent=1, sort_keys=True)
        total = sum(len(v) for v in dates.values())
        print(f'CUP-01: refreshed cup dates — {len(dates)} PL clubs, {total} club-fixtures')
        return {int(k): v for k, v in dates.items()}
    except Exception as exc:
        print(f'CUP-01: cup-date refresh failed ({exc}); keeping existing map')
        return load_cup_dates(path)
