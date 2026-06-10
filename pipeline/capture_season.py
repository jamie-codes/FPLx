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
DEFAULT_OUT_DIR = os.path.join('data', 'season_2025_26')
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


# ── public API ────────────────────────────────────────────────────────────── #

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

    finished_gws = sum(1 for e in bootstrap.get('events', []) if e.get('finished'))

    os.makedirs(out_dir, exist_ok=True)
    _write_json(os.path.join(out_dir, 'bootstrap_final.json'), bootstrap)
    _write_json(os.path.join(out_dir, 'fixtures_final.json'), fixtures)
    _write_json(os.path.join(out_dir, 'understat_final.json'), understat)
    _write_json_gz(os.path.join(out_dir, 'element_summaries.json.gz'), summaries)

    manifest = {
        'season': SEASON,
        'captured_at': datetime.now(timezone.utc).isoformat(),
        'players_total': total,
        'players_fetched': fetched,
        'success_rate': round(fetched / total, 4),
        'finished_gws': finished_gws,
        'fixtures_count': len(fixtures),
    }
    _write_json(os.path.join(out_dir, 'manifest.json'), manifest)

    print(f'[capture_season] archive complete: {fetched}/{total} players, '
          f'{finished_gws} finished GWs -> {out_dir}')
    return True


def load_season_archive(base_dir: str = DEFAULT_OUT_DIR) -> dict:
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
