"""Phase 135 — Pipeline push notification dispatcher.

Isolation contract: this module MUST NOT import from run.py.
Called at end of run.py via:
    from notify import run_notify
    run_notify()

Reads pipeline artefacts (price_changes.json, merged_players.json,
fpl_bootstrap.json, captain_picks.json) and dispatches up to 3 push
notifications per run via POST /api/push/send.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta, timezone

CONFIDENCE_THRESHOLD = 75.0
MAX_PER_RUN = 3
COOLDOWN_HOURS = 24
DEADLINE_24H_LO, DEADLINE_24H_HI = 23, 25
DEADLINE_2H_LO,  DEADLINE_2H_HI  =  1,  3


# ---------------------------------------------------------------------------
# I/O helpers

def _read_json(filename: str, cache_dir: str = 'pipeline/cache') -> dict | list:
    """Read a pipeline JSON artefact.

    In production (USE_BLOB=true): fetches from Vercel Blob.
    In dev: reads from pipeline/cache/ directory.
    """
    if os.getenv('USE_BLOB', '').lower() == 'true':
        import vercel_blob          # noqa: PLC0415
        import requests as _req     # noqa: PLC0415
        result = vercel_blob.list({'prefix': filename, 'limit': 1})
        blobs = result.get('blobs', [])
        if not blobs:
            raise FileNotFoundError(f'Blob not found: {filename}')
        return _req.get(blobs[0]['url'], timeout=30).json()
    path = os.path.join(cache_dir, filename)
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def _load_state(cache_dir: str = 'pipeline/cache') -> dict:
    """Load notify_state.json; return empty defaults when absent or corrupt."""
    defaults: dict = {
        'last_price_sent_at':    None,
        'last_injury_sent_at':   None,
        'last_captain_sent_at':  None,
        'last_captain_id':       None,
        'last_known_injuries':   {},
        'gw_deadline_state':     {},
    }
    try:
        stored = _read_json('notify_state.json', cache_dir)
        return {**defaults, **stored}
    except (FileNotFoundError, json.JSONDecodeError, KeyError):
        return defaults


def _save_state(state: dict, cache_dir: str = 'pipeline/cache') -> None:
    """Persist notify_state.json to Blob (prod) or local cache (dev)."""
    if os.getenv('USE_BLOB', '').lower() == 'true':
        import vercel_blob  # noqa: PLC0415
        payload = json.dumps(state, ensure_ascii=False).encode('utf-8')
        vercel_blob.put(
            'notify_state.json',
            payload,
            {'allowOverwrite': True, 'contentType': 'application/json'},
        )
    else:
        os.makedirs(cache_dir, exist_ok=True)
        path = os.path.join(cache_dir, 'notify_state.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(state, f, indent=2, ensure_ascii=False)


def _within_cooldown(sent_at_iso: str | None, hours: int = COOLDOWN_HOURS) -> bool:
    """Return True if sent_at_iso is within `hours` of now (UTC)."""
    if not sent_at_iso:
        return False
    sent_at = datetime.fromisoformat(sent_at_iso.replace('Z', '+00:00'))
    return (datetime.now(timezone.utc) - sent_at) < timedelta(hours=hours)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Notification collectors
# Each returns a payload dict (with optional '_'-prefixed metadata keys)
# or None if conditions are not met.

def _collect_price_candidate(state: dict, cache_dir: str) -> dict | None:
    """PUSH-02: price change alert."""
    if _within_cooldown(state.get('last_price_sent_at')):
        return None
    try:
        players = _read_json('price_changes.json', cache_dir)
    except FileNotFoundError:
        print('[notify] price_changes.json not found — skipping price alert', file=sys.stderr)
        return None
    qualifying = [
        p for p in players
        if p.get('direction') in ('rise', 'fall')
        and p.get('confidence_pct', 0) >= CONFIDENCE_THRESHOLD
    ]
    if not qualifying:
        return None
    best = max(qualifying, key=lambda p: p['confidence_pct'])
    return {
        'type':  'price',
        'title': 'Price change alert',
        'body':  f'{best["web_name"]} likely to {best["direction"]} ({best["confidence_pct"]:.0f}% confidence)',
    }


def _collect_injury_candidate(state: dict, cache_dir: str) -> dict | None:
    """PUSH-03: injury alert — first NEW injured player not in last_known_injuries."""
    if _within_cooldown(state.get('last_injury_sent_at')):
        return None
    try:
        players = _read_json('merged_players.json', cache_dir)
    except FileNotFoundError:
        print('[notify] merged_players.json not found — skipping injury alert', file=sys.stderr)
        return None
    last_known: dict = state.get('last_known_injuries', {})
    for p in players:
        if p.get('status') != 'a' and p.get('news', ''):
            pid = str(p['id'])
            if pid not in last_known:
                return {
                    'type':          'injury',
                    'title':         'Injury alert',
                    'body':          f'{p["web_name"]}: {p["news"]}',
                    '_player_id':    pid,
                    '_player_news':  p['news'],
                }
    return None


def _collect_deadline_candidate(state: dict, cache_dir: str) -> dict | None:
    """PUSH-04: transfer deadline reminder at 24 h and 2 h windows."""
    try:
        bootstrap = _read_json('fpl_bootstrap.json', cache_dir)
    except FileNotFoundError:
        print('[notify] fpl_bootstrap.json not found — skipping deadline alert', file=sys.stderr)
        return None
    now = datetime.now(timezone.utc)
    # Find nearest future event (events list is ordered ascending by id/date)
    next_ev = None
    for ev in bootstrap.get('events', []):
        dl_str = ev.get('deadline_time')
        if not dl_str:
            continue
        dl_dt = datetime.fromisoformat(dl_str.replace('Z', '+00:00'))
        if dl_dt > now:
            next_ev = ev
            break
    if next_ev is None:
        return None
    dl_dt = datetime.fromisoformat(next_ev['deadline_time'].replace('Z', '+00:00'))
    hours_until = (dl_dt - now).total_seconds() / 3600
    gw_id = str(next_ev['id'])
    gw_name = next_ev.get('name', f'GW{gw_id}')
    gw_flags: dict = state.get('gw_deadline_state', {}).get(gw_id, {})

    if DEADLINE_24H_LO <= hours_until <= DEADLINE_24H_HI and not gw_flags.get('fired_24h'):
        return {
            'type':       'deadline',
            'title':      'Transfer deadline',
            'body':       f'{gw_name} deadline in 24h',
            'hours_until': 24,
            '_gw_id':     gw_id,
            '_window':    '24h',
        }
    if DEADLINE_2H_LO <= hours_until <= DEADLINE_2H_HI and not gw_flags.get('fired_2h'):
        return {
            'type':       'deadline',
            'title':      'Transfer deadline',
            'body':       f'{gw_name} deadline in 2h',
            'hours_until': 2,
            '_gw_id':     gw_id,
            '_window':    '2h',
        }
    return None


def _collect_captain_candidate(state: dict, cache_dir: str) -> dict | None:
    """PUSH-05: captain recommendation changed."""
    if _within_cooldown(state.get('last_captain_sent_at')):
        return None
    try:
        picks = _read_json('captain_picks.json', cache_dir)
    except FileNotFoundError:
        print('[notify] captain_picks.json not found — skipping captain alert', file=sys.stderr)
        return None
    ceiling = picks.get('ceiling', {})
    player_id = ceiling.get('id')
    if player_id is None:
        return None
    if str(player_id) == str(state.get('last_captain_id')):
        return None
    return {
        'type':          'captain',
        'title':         'Captain update',
        'body':          f'{ceiling.get("name", "Unknown")} ({ceiling.get("team", "")}) recommended',
        '_captain_id':   player_id,
    }


# ---------------------------------------------------------------------------
# Dispatch

def _send(payload: dict, base_url: str) -> int:
    """POST stripped payload to /api/push/send. Returns HTTP status code."""
    import requests as _req  # noqa: PLC0415
    body = {k: v for k, v in payload.items() if not k.startswith('_')}
    try:
        resp = _req.post(f'{base_url}/api/push/send', json=body, timeout=15)
        return resp.status_code
    except Exception as exc:
        print(f'[notify] send error: {exc}', file=sys.stderr)
        return 503


def _update_state(state: dict, payload: dict) -> None:
    """Mutate in-memory state for a successfully dispatched notification."""
    now = _now_iso()
    t = payload['type']
    if t == 'price':
        state['last_price_sent_at'] = now
    elif t == 'injury':
        state['last_injury_sent_at'] = now
        pid = payload.get('_player_id')
        if pid:
            state.setdefault('last_known_injuries', {})[pid] = payload.get('_player_news', '')
    elif t == 'deadline':
        gw_id = payload.get('_gw_id')
        window = payload.get('_window')
        if gw_id and window:
            gw_state = state.setdefault('gw_deadline_state', {}).setdefault(gw_id, {})
            if window == '24h':
                gw_state['fired_24h'] = True
            else:
                gw_state['fired_2h'] = True
    elif t == 'captain':
        state['last_captain_sent_at'] = now
        state['last_captain_id'] = payload.get('_captain_id')


# ---------------------------------------------------------------------------
# Entry point

def run_notify(cache_dir: str = 'pipeline/cache') -> None:
    """Collect candidates, dispatch up to MAX_PER_RUN, persist state."""
    base_url = os.environ.get('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000')
    state = _load_state(cache_dir)

    collectors = [
        ('price',    _collect_price_candidate),
        ('injury',   _collect_injury_candidate),
        ('deadline', _collect_deadline_candidate),
        ('captain',  _collect_captain_candidate),
    ]
    candidates: list[dict] = []
    for type_name, collector in collectors:
        try:
            c = collector(state, cache_dir)
            if c:
                candidates.append(c)
        except Exception as exc:
            print(f'[notify] {type_name} collector error: {exc}', file=sys.stderr)

    state_dirty = False
    for payload in candidates[:MAX_PER_RUN]:
        status = _send(payload, base_url)
        if status == 200:
            _update_state(state, payload)
            state_dirty = True
        elif status in (404, 410):
            print(f'[notify] no subscriber ({status}) — skipping', file=sys.stderr)
        else:
            print(f'[notify] /api/push/send returned {status} — state not updated', file=sys.stderr)

    if state_dirty:
        try:
            _save_state(state, cache_dir)
        except Exception as exc:
            print(f'[notify] failed to persist state: {exc}', file=sys.stderr)


if __name__ == '__main__':
    run_notify()
