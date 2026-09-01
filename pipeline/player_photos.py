"""PHOTO-01: fresher player headshots from api-football.

The Premier League photo CDN the app has always used has not reshot players
since Aug 2024, so anyone who has transferred since appears in their old
club's kit (verified 2026-09-01: Semenyo's PL photo dates from 14 Aug 2024,
api-football's from 30 Jul 2026 — after his move; Mbeumo likewise).

api-football serves headshots from `media.api-sports.io`, which needs NO API
key to fetch, so the browser can load them directly. Only building the
FPL-id -> photo-URL map needs the key, and that happens here in the pipeline.

The map is COMMITTED to pipeline/data/ (like the other id maps) rather than
cached, because pipeline/cache/ is gitignored and CI is ephemeral — caching
would re-fetch every player page on every run. Photos change only when a
player transfers, so a weekly refresh is ample.
"""
import json
import os
from datetime import datetime, timedelta, timezone

from injury_join import (
    _index_elements,
    _match_player,
    _resolve_team_id,
    _team_name_to_id,
    load_overrides,
)

_MODULE_DIR = os.path.dirname(os.path.abspath(__file__))
MAP_PATH = os.path.join(_MODULE_DIR, 'data', 'apifootball_photo_map.json')
_BASE = 'https://v3.football.api-sports.io'
_PL_LEAGUE = 39
MAX_AGE_DAYS = 7
MAX_PAGES = 40


def _api_key() -> str:
    key = os.environ.get('APIFOOTBALL_KEY')
    if not key:
        raise RuntimeError('PHOTO-01: APIFOOTBALL_KEY not set; photo refresh unavailable')
    return key


def _get(endpoint: str, params: dict) -> dict:
    import requests
    resp = requests.get(f'{_BASE}/{endpoint}', params=params,
                        headers={'x-apisports-key': _api_key()}, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    # HTTP-200 errors body = dead key / plan limit (see injury_client._get).
    errs = data.get('errors')
    if errs:
        raise RuntimeError(f'PHOTO-01: api-football error response: {errs}')
    return data


def parse_players(response: list) -> list[dict]:
    """Flatten /players records to the fields the join needs.

    Team lives under statistics[0].team; records without a team or a photo
    cannot be joined or used, so they are dropped here.
    """
    out = []
    for rec in response or []:
        player = rec.get('player') or {}
        stats = rec.get('statistics') or []
        team = ((stats[0] or {}).get('team') or {}) if stats else {}
        pid, name, photo = player.get('id'), player.get('name'), player.get('photo')
        team_name = team.get('name')
        if not (pid and name and photo and team_name):
            continue
        out.append({'player_id': pid, 'player_name': name,
                    'team_name': team_name, 'photo': photo})
    return out


def fetch_all_players(season: int, league: int = _PL_LEAGUE) -> list[dict]:
    """Every player in the league for a season (paged)."""
    out: list[dict] = []
    page = 1
    while page <= MAX_PAGES:
        payload = _get('players', {'league': league, 'season': season, 'page': page})
        out.extend(parse_players(payload.get('response') or []))
        total = int(((payload.get('paging') or {}).get('total')) or 1)
        if page >= total:
            break
        page += 1
    return out


def build_photo_map(records: list[dict], bootstrap: dict,
                    overrides: dict | None = None) -> dict[str, str]:
    """{str(fpl_element_id): photo_url} using the AVAIL-01 club+surname join.

    Keys are strings so the artifact round-trips through JSON unchanged.
    """
    overrides = overrides if overrides is not None else load_overrides()
    table = _team_name_to_id(bootstrap)
    teams = bootstrap.get('teams') or []
    elements_by_team = _index_elements(bootstrap)

    out: dict[str, str] = {}
    for rec in records:
        fpl_id = overrides.get(rec['player_id'])
        if fpl_id is None:
            team_id = _resolve_team_id(rec['team_name'], table, teams)
            if team_id is None:
                continue
            fpl_id = _match_player(rec['player_name'], elements_by_team.get(team_id, []))
        if fpl_id is None:
            continue
        out[str(fpl_id)] = rec['photo']
    return out


def load_photo_map(path: str = MAP_PATH) -> dict[str, str]:
    """{str(fpl_id): photo_url}; {} when absent or unreadable (safe no-op —
    callers fall back to the Premier League CDN)."""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f).get('photos', {}) or {}
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}


def _needs_refresh(path: str, season: int, max_age_days: int = MAX_AGE_DAYS) -> bool:
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return True
    if data.get('_season') != season or not data.get('photos'):
        return True
    try:
        refreshed = datetime.fromisoformat(data.get('_refreshed_at', ''))
        if refreshed.tzinfo is None:
            refreshed = refreshed.replace(tzinfo=timezone.utc)
    except ValueError:
        return True
    return datetime.now(timezone.utc) - refreshed > timedelta(days=max_age_days)


def refresh_photo_map(bootstrap: dict, season: int, path: str = MAP_PATH) -> dict[str, str]:
    """Refresh the committed map when stale, then return it.

    Non-fatal by design: any failure leaves the existing map in place (or
    returns {}), and callers fall back to the Premier League CDN.
    """
    if not _needs_refresh(path, season):
        return load_photo_map(path)
    try:
        records = fetch_all_players(season)
        photos = build_photo_map(records, bootstrap)
        if not photos:
            print('PHOTO-01: refresh produced no matches — keeping existing map')
            return load_photo_map(path)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump({'_refreshed_at': datetime.now(timezone.utc).isoformat(),
                       '_season': season, 'photos': photos}, f,
                      ensure_ascii=False, indent=1, sort_keys=True)
        print(f'PHOTO-01: refreshed photo map — {len(records)} api-football players '
              f'-> {len(photos)} FPL players mapped')
        return photos
    except Exception as exc:
        print(f'PHOTO-01: photo refresh failed ({exc}); keeping existing map')
        return load_photo_map(path)
