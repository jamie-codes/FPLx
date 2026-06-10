# SA-01: Season Archive Capture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permanently capture the complete 2025/26 FPL season dataset (bootstrap, fixtures, all element-summaries, Understat) to `pipeline/data/season_2025_26/`, committed to git, before the FPL API resets in July.

**Architecture:** One new standalone module `pipeline/capture_season.py` with a fetch-guard-write `capture_season()` entry point and a `load_season_archive()` read interface. Reuses `archive_season._fetch_all_summaries` for concurrent element-summary fetching. No changes to `run.py` or the regular pipeline.

**Tech Stack:** Python 3.11, pytest, gzip + json stdlib.

---

## File map

| File | Change |
|---|---|
| `pipeline/capture_season.py` | Create — capture + load functions |
| `pipeline/tests/test_capture_season.py` | Create — 5 unit tests, no network |
| `pipeline/data/season_2025_26/*` | Created by the real capture run (Task 3) |

Working directory for all commands: `pipeline/`

---

## Task 1: `capture_season.py` — capture logic with guard and atomic writes

**Files:**
- Create: `pipeline/capture_season.py`
- Test: `pipeline/tests/test_capture_season.py`

### Background

The FPL API serves the finished 2025/26 season (verified live 2026-06-10: 38 finished GWs, 841 elements, full 38-round element-summary histories). The fetch helpers exist:
- `fpl_client.get_bootstrap_static() -> dict`
- `fpl_client.get_fixtures() -> list`
- `understat_client.get_understat_players() -> dict`
- `archive_season._fetch_all_summaries(elements: list) -> dict` — concurrent (10 workers), returns `{player_id: summary}` for successes only, failure-tolerant

The capture must: fetch all four sources → retry missing element-summaries once → enforce a ≥90% success guard → write 5 files atomically (tmp + rename), manifest LAST.

### Step 1: Write the failing tests

Create `pipeline/tests/test_capture_season.py`:

```python
"""Tests for capture_season.py (SA-01). All fetches mocked — no network."""
import gzip
import json
import os

import pytest

import capture_season


def _bootstrap(n_players=10):
    return {
        'elements': [{'id': i, 'web_name': f'P{i}'} for i in range(1, n_players + 1)],
        'events': [{'id': g, 'finished': True} for g in range(1, 39)],
    }


def _summary(pid):
    return {'history': [{'round': g, 'element': pid, 'total_points': 2} for g in range(1, 39)]}


def _patch_fetches(monkeypatch, n_players=10, fail_ids=None, fail_ids_retry=None):
    """Patch all four fetch sources. fail_ids fail on first pass;
    fail_ids_retry also fail on the retry pass."""
    fail_first = set(fail_ids or set())
    fail_retry = set(fail_ids_retry or set())
    calls = {'pass_n': 0}

    monkeypatch.setattr(capture_season, '_get_bootstrap', lambda: _bootstrap(n_players))
    monkeypatch.setattr(capture_season, '_get_fixtures',
                        lambda: [{'id': 1, 'event': 1, 'finished': True}])
    monkeypatch.setattr(capture_season, '_get_understat', lambda: {'u1': {'xG': '5.0'}})

    def fake_fetch_all(elements):
        calls['pass_n'] += 1
        failing = fail_first if calls['pass_n'] == 1 else fail_retry
        return {el['id']: _summary(el['id']) for el in elements if el['id'] not in failing}

    monkeypatch.setattr(capture_season, '_fetch_summaries', fake_fetch_all)


def test_capture_writes_all_five_files(tmp_path, monkeypatch):
    _patch_fetches(monkeypatch, n_players=10)
    out = str(tmp_path / 'season_2025_26')
    ok = capture_season.capture_season(out_dir=out)
    assert ok is True
    for name in ['bootstrap_final.json', 'fixtures_final.json',
                 'understat_final.json', 'element_summaries.json.gz', 'manifest.json']:
        assert os.path.exists(os.path.join(out, name)), f'missing {name}'
    manifest = json.load(open(os.path.join(out, 'manifest.json')))
    assert manifest['season'] == '2025-26'
    assert manifest['players_total'] == 10
    assert manifest['players_fetched'] == 10
    assert manifest['success_rate'] == 1.0
    assert manifest['finished_gws'] == 38


def test_capture_guard_blocks_below_90pct(tmp_path, monkeypatch, capsys):
    # 3 of 10 players fail on BOTH passes -> 70% < 90% -> nothing written
    _patch_fetches(monkeypatch, n_players=10,
                   fail_ids={1, 2, 3}, fail_ids_retry={1, 2, 3})
    out = str(tmp_path / 'season_2025_26')
    ok = capture_season.capture_season(out_dir=out)
    assert ok is False
    assert not os.path.exists(os.path.join(out, 'manifest.json'))
    assert not os.path.exists(os.path.join(out, 'element_summaries.json.gz'))
    err = capsys.readouterr().err
    assert '7/10' in err


def test_retry_pass_fills_gaps(tmp_path, monkeypatch):
    # 3 players fail first pass, retry succeeds -> 100%
    _patch_fetches(monkeypatch, n_players=10, fail_ids={1, 2, 3}, fail_ids_retry=set())
    out = str(tmp_path / 'season_2025_26')
    ok = capture_season.capture_season(out_dir=out)
    assert ok is True
    manifest = json.load(open(os.path.join(out, 'manifest.json')))
    assert manifest['players_fetched'] == 10
    assert manifest['success_rate'] == 1.0


def test_load_round_trip(tmp_path, monkeypatch):
    _patch_fetches(monkeypatch, n_players=5)
    out = str(tmp_path / 'season_2025_26')
    assert capture_season.capture_season(out_dir=out) is True
    archive = capture_season.load_season_archive(base_dir=out)
    assert set(archive.keys()) == {'bootstrap', 'fixtures', 'understat', 'summaries', 'manifest'}
    # summaries keys must be ints (drop-in replacement for run.py's live summaries dict)
    assert all(isinstance(k, int) for k in archive['summaries'])
    assert archive['summaries'][3]['history'][0]['round'] == 1
    assert len(archive['bootstrap']['elements']) == 5


def test_load_raises_without_manifest(tmp_path):
    os.makedirs(str(tmp_path / 'empty_dir'), exist_ok=True)
    with pytest.raises(FileNotFoundError):
        capture_season.load_season_archive(base_dir=str(tmp_path / 'empty_dir'))
```

### Step 2: Run tests to verify they fail

Run: `cd pipeline && python -m pytest tests/test_capture_season.py -v`
Expected: 5 ERRORS/FAILURES (ModuleNotFoundError: capture_season)

### Step 3: Write `capture_season.py`

Create `pipeline/capture_season.py`:

```python
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
```

### Step 4: Run tests to verify they pass

Run: `cd pipeline && python -m pytest tests/test_capture_season.py -v`
Expected: 5 PASSED

### Step 5: Run full test suite

Run: `cd pipeline && python -m pytest tests/ -q 2>&1 | tail -5`
Expected: 504 passed (499 + 5 new), 0 failed

### Step 6: Commit

```bash
git add pipeline/capture_season.py pipeline/tests/test_capture_season.py
git commit -m "feat(sa-01): add capture_season.py — one-shot season archive capture + loader"
```

---

## Task 2: Run the real capture and commit the archive

**Files:**
- Create (by running the script): `pipeline/data/season_2025_26/` (5 files)

### Step 1: Run the capture

Run: `cd pipeline && python capture_season.py`
Expected output (takes ~2-4 minutes for ~841 element-summary fetches):
```
[capture_season] archive complete: 841/841 players, 38 finished GWs -> data\season_2025_26
```
(player count may be 840-841; success_rate must be >= 0.90 or the script exits 1)

### Step 2: Verify the archive integrity

Run from `pipeline/`:
```bash
python -c "
from capture_season import load_season_archive
a = load_season_archive()
m = a['manifest']
print('players:', m['players_fetched'], '/', m['players_total'])
print('finished_gws:', m['finished_gws'])
print('fixtures:', m['fixtures_count'])
# Spot-check Haaland (top scorer, 239 pts) — find his id from bootstrap
h = [e for e in a['bootstrap']['elements'] if e['web_name'] == 'Haaland'][0]
hist = a['summaries'][h['id']]['history']
print('Haaland: total_points =', h['total_points'], ', history rounds =', len(hist),
      ', sum of per-GW points =', sum(r['total_points'] for r in hist))
"
```
Expected: `finished_gws: 38`, `fixtures: 380`, Haaland total_points 239 AND the per-GW sum equals 239 (history-vs-season-total consistency proves the per-GW data is complete).

### Step 3: Check archive size before committing

Run: `git status --porcelain pipeline/data/ && du -sh pipeline/data/season_2025_26/ 2>/dev/null || dir pipeline\data\season_2025_26`
Expected: ~12-15MB total (element_summaries.json.gz ~6MB, bootstrap ~3MB, fixtures ~2.5MB)

### Step 4: Commit the archive

```bash
git add pipeline/data/season_2025_26/
git commit -m "data(sa-01): capture complete 2025/26 season archive (38 GWs, 841 players)"
```

---

## Self-review notes

- Spec coverage: fetch 4 sources ✓ (Task 1 Step 3), retry pass ✓, ≥90% guard ✓, 5 files + manifest-last ✓, atomic tmp+rename ✓, int-keyed loader ✓, 5 unit tests ✓ (exact tests from spec), manual Haaland verification ✓ (Task 2 Step 2), data/ not gitignored ✓ (verified — no matching pattern in .gitignore), committed to git ✓ (Task 2 Step 4).
- `archive_season._fetch_all_summaries` confirmed to exist with signature `(elements: list) -> dict`.
- No placeholders; all code complete.
