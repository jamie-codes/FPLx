"""AVAIL-01: api-football injuries client (fetch + 24h cache + snapshot loader).

Live fetch needs env APIFOOTBALL_KEY. The committed season snapshot (used by the
BT-02 validation and CI) needs no key. Record dates are normalised to 'YYYY-MM-DD'
so the join can map them to a GW via the archive fixtures.
"""
import json
import os
from datetime import datetime, timezone, timedelta

import requests

_BASE = 'https://v3.football.api-sports.io'
_PL_LEAGUE = 39
CACHE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                          'cache', 'apifootball_injuries.json')
SNAPSHOT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                             'data', 'injuries', 'apifootball_PL_2025_26.json')
CACHE_TTL_HOURS = 24


def parse_records(raw: dict) -> list[dict]:
    """Flatten api-football injury `response[]` into the fields the join needs."""
    out = []
    for r in (raw or {}).get('response', []) or []:
        player = r.get('player', {}) or {}
        team = r.get('team', {}) or {}
        fixture = r.get('fixture', {}) or {}
        date = (fixture.get('date') or '')[:10]
        out.append({
            'player_id': player.get('id'),
            # `or ''` (not just a default): api-football returns explicit null for
            # name/type/reason on some records, which a bare .get(k, '') would pass through.
            'player_name': player.get('name') or '',
            'type': player.get('type') or '',
            'reason': player.get('reason') or '',
            'team_id': team.get('id'),
            'team_name': team.get('name') or '',
            'date': date,
        })
    return out


def load_snapshot(path: str = SNAPSHOT_PATH) -> list[dict]:
    """Load + parse the committed season snapshot. Used by BT-02 / CI (no API key)."""
    with open(path, 'r', encoding='utf-8') as f:
        return parse_records(json.load(f))


def _api_key() -> str:
    key = os.environ.get('APIFOOTBALL_KEY')
    if not key:
        raise RuntimeError('AVAIL-01: APIFOOTBALL_KEY not set; live injury fetch unavailable')
    return key


def _get(endpoint: str, params: dict) -> dict:
    resp = requests.get(f'{_BASE}/{endpoint}', params=params,
                        headers={'x-apisports-key': _api_key()}, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    # api-football signals bad keys / plan limits via HTTP 200 + a non-empty
    # `errors` body (healthy responses carry {} or []). Raising here routes it
    # through the caller's failure logging instead of parsing as "no injuries".
    errs = data.get('errors')
    if errs:
        raise RuntimeError(f'AVAIL-01: api-football error response: {errs}')
    return data


def fetch_season_injuries(season: int = 2025, league: int = _PL_LEAGUE) -> list[dict]:
    """Whole-season injury records (for snapshotting / lab reconstruction)."""
    return parse_records(_get('injuries', {'league': league, 'season': season}))


def fetch_fixture_injuries(fixture_id: int) -> list[dict]:
    """Projected absentees for one upcoming fixture (the live per-GW path)."""
    return parse_records(_get('injuries', {'fixture': fixture_id}))


def _cache_fresh() -> bool:
    if not os.path.exists(CACHE_PATH):
        return False
    try:
        with open(CACHE_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        cached_at = datetime.fromisoformat(data.get('_cached_at', ''))
        if cached_at.tzinfo is None:
            cached_at = cached_at.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) - cached_at < timedelta(hours=CACHE_TTL_HOURS)
    except Exception:
        return False


def get_live_injuries(fixture_ids: list[int]) -> list[dict]:
    """Fetch+cache projected absentees across the given upcoming fixtures.

    Returns parsed records. Failures are per-fixture (review 2026-08-28): a
    rate-limit tripping mid-batch keeps the fixtures already fetched. A total
    failure — or an empty fixture list — returns [] WITHOUT writing the 24h
    cache, so an outage can't masquerade as an injury-free league. Affected
    players keep their FPL-derived availability either way (safe no-op)."""
    if not fixture_ids:
        return []
    if _cache_fresh():
        with open(CACHE_PATH, 'r', encoding='utf-8') as f:
            # .get keeps the documented "returns []" guarantee even if a fresh
            # cache file is missing the 'records' key (interrupted/partial write).
            records = json.load(f).get('records', [])
        print(f'AVAIL-01: injuries served from cache ({len(records)} records)')
        return records
    records: list[dict] = []
    failed = 0
    last_exc: Exception | None = None
    for fid in fixture_ids:
        try:
            records.extend(fetch_fixture_injuries(fid))
        except Exception as exc:
            failed += 1
            last_exc = exc
    if failed:
        kept = 'keeping partial batch' if records else 'no injury data this run'
        print(f'AVAIL-01: live injury fetch failed for {failed}/{len(fixture_ids)} '
              f'fixtures ({last_exc}); {kept}')
        if not records:
            return []   # total failure — never cache an outage as "no injuries"
    os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
    with open(CACHE_PATH, 'w', encoding='utf-8') as f:
        json.dump({'_cached_at': datetime.now(timezone.utc).isoformat(),
                   'records': records}, f, ensure_ascii=False)
    return records
