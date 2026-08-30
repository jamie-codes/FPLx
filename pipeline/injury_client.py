"""AVAIL-01: api-football injuries client (fetch + 24h cache + snapshot loader).

Live fetch needs env APIFOOTBALL_KEY. The committed season snapshot (used by the
BT-02 validation and CI) needs no key. Record dates are normalised to 'YYYY-MM-DD'
so the join can map them to a GW via the archive fixtures.
"""
import json
import os
from datetime import datetime, timedelta, timezone

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
    """Whole-season injury records (snapshotting, lab reconstruction, live sweep).

    Single unpaged call — /injuries has NO `page` parameter. A review suggested
    paging to guard against page-1 truncation; sending `page` returned
    {'page': 'The Page field do not exist.'} and, because that arrives as an
    HTTP-200 errors body, took the whole layer dark for a run (2026-08-30).
    The endpoint returns the full set in one response: 3417 records for the
    committed 2025/26 season, so there is no cap to work around.
    """
    return parse_records(_get('injuries', {'league': league, 'season': season}))


def fetch_fixture_injuries(fixture_id: int) -> list[dict]:
    """Projected absentees for one fixture — takes an API-FOOTBALL fixture id.

    NOT usable with FPL fixture ids (see fetch_date_injuries): the id spaces are
    disjoint (api-football 7-digit globals vs FPL 1-380), and a wrong-namespace
    id returns an empty 200 rather than an error. Kept for callers that already
    hold a real api-football id; the live per-GW path uses dates.
    """
    return parse_records(_get('injuries', {'fixture': fixture_id}))


def fetch_date_injuries(date: str, season: int, league: int = _PL_LEAGUE) -> list[dict]:
    """Projected absentees for one match date (the live per-GW path).

    Queries the league/season/date namespace — the only fixture-scoping the FPL
    side can express, since it has no api-football fixture ids. The downstream
    join (injury_join.build_injury_lookup) matches on team + player name, so
    fixture identity is never needed.
    """
    return parse_records(_get('injuries', {'league': league, 'season': season, 'date': date}))


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


# A club's own feed can legitimately go quiet for an international break
# (~2 weeks), so the staleness cap sits comfortably beyond that. Past this,
# a club's block is assumed abandoned rather than "everyone still injured".
STALE_AFTER_DAYS = 21


def select_current_records(records: list[dict], today: str | None = None,
                           stale_after_days: int = STALE_AFTER_DAYS) -> list[dict]:
    """Reduce a season sweep to the CURRENT injury picture.

    api-football attaches each injury record to a fixture, so a season sweep
    contains every matchday's snapshot back to GW1 — feeding all of it to
    build_injury_lookup would keep flagging players who have long since
    recovered. Per team, keep the most recent PLAYED matchday's snapshot and
    ADD every future-dated record.

    The past/future split is load-bearing (review 2026-08-30): anchoring on the
    max over all dates let a single early entry for the next fixture replace
    the whole current snapshot — upcoming-fixture lists populate gradually as
    kickoff nears, so they are additive evidence, never a full picture. It also
    stops a postponed fixture months ahead from freezing a club's block.

    A club whose latest played matchday is older than `stale_after_days` has
    stopped publishing; its block is dropped rather than served as current.
    """
    today = today or datetime.now(timezone.utc).date().isoformat()
    cutoff = (datetime.fromisoformat(today).date()
              - timedelta(days=stale_after_days)).isoformat()

    latest_played: dict[str, str] = {}
    for r in records:
        team, date = r.get('team_name') or '', r.get('date') or ''
        if not team or not date or date > today:
            continue
        if date > latest_played.get(team, ''):
            latest_played[team] = date

    out = []
    for r in records:
        team, date = r.get('team_name') or '', r.get('date') or ''
        if not team or not date:
            continue
        if date > today:
            out.append(r)                       # forward-looking: always additive
            continue
        anchor = latest_played.get(team)
        if anchor and date == anchor and anchor >= cutoff:
            out.append(r)                       # the club's current snapshot
    return out


def get_live_injuries(season: int) -> list[dict]:
    """Fetch+cache the current injury picture for the season (one API call).

    Queries league/season — NOT fixture ids (a foreign namespace, 2026-08-30)
    and NOT upcoming dates: api-football only populates a fixture's injuries as
    kickoff nears, so querying the next GW's dates days ahead returns an empty
    200 (verified 2026-08-30: date=+6d → 0 records, season sweep → 304). The
    sweep is then reduced to each team's latest matchday by
    select_current_records.

    On failure returns [] WITHOUT writing the 24h cache, so an outage can't
    masquerade as an injury-free league. Affected players keep their
    FPL-derived availability either way (safe no-op).
    """
    if _cache_fresh():
        with open(CACHE_PATH, 'r', encoding='utf-8') as f:
            # .get keeps the documented "returns []" guarantee even if a fresh
            # cache file is missing the 'records' key (interrupted/partial write).
            records = json.load(f).get('records', [])
        print(f'AVAIL-01: injuries served from cache ({len(records)} records)')
        return records
    try:
        swept = fetch_season_injuries(season=season)
    except Exception as exc:
        print(f'AVAIL-01: live injury fetch failed ({exc}); no injury data this run')
        return []   # never cache an outage as "no injuries"
    if not swept:
        # A successful-but-empty 200 is the signature of a wrong season/league
        # param (the 76d95a7 bug), not an injury-free league. Don't cache it.
        print('AVAIL-01: season sweep returned 0 records — not cached '
              '(empty response is a param/upstream smell, not an injury-free league)')
        return []
    records = select_current_records(swept)
    print(f'AVAIL-01: season sweep {len(swept)} records -> {len(records)} current')
    os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
    with open(CACHE_PATH, 'w', encoding='utf-8') as f:
        json.dump({'_cached_at': datetime.now(timezone.utc).isoformat(),
                   'records': records}, f, ensure_ascii=False)
    return records
