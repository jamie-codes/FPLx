"""SA-01: one-shot season archive capture.

Permanently captures the finished season's full dataset to local disk
(committed to git) before the FPL API resets for the new season:
  - bootstrap_final.json     (full bootstrap-static)
  - fixtures_final.json      (all fixtures with results)
  - understat_final.json     (Understat season totals)
  - element_summaries.json.gz (per-player per-GW history, gzip)
  - manifest.json            (written LAST — its presence marks a complete archive)

Usage:  python capture_season.py            (from pipeline/)
Read:   load_season_archive() -> dict with int-keyed 'summaries'

Unlike archive_season.py (GW38-gated pipeline step, Blob, 50% guard) this is a
manual one-shot with a strict >=90% guard + one retry pass: there is no second
chance after the API reset.
"""
import gzip
import json
import os
import sys
from datetime import datetime, timezone

SEASON = '2025-26'
_MODULE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_OUT_DIR = os.path.join(_MODULE_DIR, 'data', 'season_2025_26')
SUCCESS_THRESHOLD = 0.90


# ── thin fetch wrappers (monkeypatch seams for tests) ─────────────────────── #

def _get_bootstrap() -> dict:
    from fpl_client import get_bootstrap_static
    return get_bootstrap_static()


def _get_fixtures() -> list:
    from fpl_client import get_fixtures
    return get_fixtures()


def _get_understat() -> dict:
    from understat_client import get_understat_players
    return get_understat_players()


def _fetch_summaries(elements: list) -> dict:
    from archive_season import _fetch_all_summaries
    return _fetch_all_summaries(elements)


# ── atomic write helpers ──────────────────────────────────────────────────── #

def _write_json(path: str, data) -> None:
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f)
    os.replace(tmp, path)


def _write_json_gz(path: str, data) -> None:
    tmp = path + '.tmp'
    with gzip.open(tmp, 'wt', encoding='utf-8') as f:
        json.dump(data, f)
    os.replace(tmp, path)


# ── SA-02 helpers ────────────────────────────────────────────────────────── #

def season_label(bootstrap: dict):
    """Derive season label from first event's deadline_time.

    Returns e.g. '2026-27' from a deadline_time starting with '2026'.
    Returns None when events are missing or deadline_time is malformed.
    """
    events = bootstrap.get('events', [])
    if not events:
        return None
    dt_str = events[0].get('deadline_time', '')
    if not dt_str or len(dt_str) < 4 or not dt_str[:4].isdigit():
        return None
    try:
        y = int(dt_str[:4])
    except (ValueError, TypeError):
        return None
    return f"{y}-{str(y + 1)[-2:]}"


def _snapshot_dir(label: str) -> str:
    """Return the module-anchored snapshot directory for the given season label."""
    return os.path.join(_MODULE_DIR, 'data', 'season_' + label.replace('-', '_'))


# ── public API ────────────────────────────────────────────────────────────── #

def write_archive(out_dir: str, bootstrap: dict, fixtures: list,
                  understat: dict, summaries: dict) -> dict:
    """Write the five archive files to out_dir atomically; return the manifest dict.

    manifest['season'] comes from season_label(bootstrap) if available, else SEASON.
    Manifest is written last — its presence marks a complete archive.
    """
    total = len(bootstrap.get('elements', []))
    fetched = len(summaries)
    finished_gws = sum(1 for e in bootstrap.get('events', []) if e.get('finished'))

    label = season_label(bootstrap)
    season = label if label is not None else SEASON

    os.makedirs(out_dir, exist_ok=True)
    _write_json(os.path.join(out_dir, 'bootstrap_final.json'), bootstrap)
    _write_json(os.path.join(out_dir, 'fixtures_final.json'), fixtures)
    _write_json(os.path.join(out_dir, 'understat_final.json'), understat)
    _write_json_gz(os.path.join(out_dir, 'element_summaries.json.gz'), summaries)

    manifest = {
        'season': season,
        'captured_at': datetime.now(timezone.utc).isoformat(),
        'players_total': total,
        'players_fetched': fetched,
        'success_rate': round(fetched / total, 4) if total else 0.0,
        'finished_gws': finished_gws,
        'fixtures_count': len(fixtures),
    }
    _write_json(os.path.join(out_dir, 'manifest.json'), manifest)
    return manifest


def snapshot_season(bootstrap: dict, fixtures: list, understat: dict,
                    summaries: dict) -> bool:
    """SA-02: in-season snapshot hook. Writes a snapshot if a new GW has finished.

    - label None (malformed bootstrap) -> stderr, return False
    - 0 finished events -> False (pre-season / off-season no-op)
    - manifest exists and finished_gws >= finished_now -> False (idempotent)
    - else write_archive to module-anchored snapshot dir, print summary, return True
    """
    label = season_label(bootstrap)
    if label is None:
        print('[snapshot_season] could not derive season label — skipping.', file=sys.stderr)
        return False

    finished_now = sum(1 for e in bootstrap.get('events', []) if e.get('finished'))
    if finished_now == 0:
        return False

    snap_dir = _snapshot_dir(label)
    manifest_path = os.path.join(snap_dir, 'manifest.json')

    if os.path.exists(manifest_path):
        try:
            with open(manifest_path, encoding='utf-8') as f:
                prior = json.load(f)
            prior_gws = prior.get('finished_gws', 0)
            prior_players = prior.get('players_fetched', 0)
            if finished_now < prior_gws:
                return False
            if finished_now == prior_gws and len(summaries) <= prior_players:
                return False
        except (json.JSONDecodeError, OSError):
            pass  # corrupt manifest — overwrite

    manifest = write_archive(snap_dir, bootstrap, fixtures, understat, summaries)
    print(f'[snapshot_season] snapshot written: {manifest["players_fetched"]} players, '
          f'{manifest["finished_gws"]} finished GWs -> {snap_dir}')
    return True


def capture_season(out_dir: str = DEFAULT_OUT_DIR) -> bool:
    """Fetch + persist the full season dataset. Returns True on success.

    Guard: after one retry pass, element-summary success must be >= 90% of
    bootstrap elements or NOTHING is written (no partial archives).
    Manifest is written last — its presence marks a complete archive.
    """
    bootstrap = _get_bootstrap()
    fixtures = _get_fixtures()
    understat = _get_understat()

    elements = bootstrap.get('elements', [])
    total = len(elements)
    if total == 0:
        print('[capture_season] no elements in bootstrap — aborting.', file=sys.stderr)
        return False

    summaries = _fetch_summaries(elements)

    # One retry pass for the gaps
    missing = [el for el in elements if el['id'] not in summaries]
    if missing:
        print(f'[capture_season] retrying {len(missing)} failed players...')
        summaries.update(_fetch_summaries(missing))

    fetched = len(summaries)
    if fetched < total * SUCCESS_THRESHOLD:
        print(
            f'[capture_season] only {fetched}/{total} players fetched '
            f'(< {SUCCESS_THRESHOLD:.0%}) — nothing written.',
            file=sys.stderr,
        )
        return False

    manifest = write_archive(out_dir, bootstrap, fixtures, understat, summaries)
    fetched = manifest['players_fetched']
    finished_gws = manifest['finished_gws']

    print(f'[capture_season] archive complete: {fetched}/{total} players, '
          f'{finished_gws} finished GWs -> {out_dir}')
    return True


def load_season_archive(base_dir: str = DEFAULT_OUT_DIR) -> dict:  # DEFAULT_OUT_DIR is module-anchored
    """Load the season archive. Returns dict with keys:
    'bootstrap', 'fixtures', 'understat', 'summaries' (player_id int -> summary),
    'manifest'. Raises FileNotFoundError if manifest.json is absent (incomplete
    or missing archive)."""
    manifest_path = os.path.join(base_dir, 'manifest.json')
    if not os.path.exists(manifest_path):
        raise FileNotFoundError(
            f'No complete season archive at {base_dir} (manifest.json missing)')
    with open(manifest_path, encoding='utf-8') as f:
        manifest = json.load(f)
    with open(os.path.join(base_dir, 'bootstrap_final.json'), encoding='utf-8') as f:
        bootstrap = json.load(f)
    with open(os.path.join(base_dir, 'fixtures_final.json'), encoding='utf-8') as f:
        fixtures = json.load(f)
    with open(os.path.join(base_dir, 'understat_final.json'), encoding='utf-8') as f:
        understat = json.load(f)
    with gzip.open(os.path.join(base_dir, 'element_summaries.json.gz'),
                   'rt', encoding='utf-8') as f:
        raw = json.load(f)
    summaries = {int(k): v for k, v in raw.items()}
    return {
        'bootstrap': bootstrap,
        'fixtures': fixtures,
        'understat': understat,
        'summaries': summaries,
        'manifest': manifest,
    }


if __name__ == '__main__':
    ok = capture_season()
    sys.exit(0 if ok else 1)
