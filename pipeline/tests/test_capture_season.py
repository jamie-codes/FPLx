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
