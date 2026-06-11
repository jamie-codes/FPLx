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


# ── SA-02 helpers ─────────────────────────────────────────────────────────── #

def _bootstrap_with_deadline(n_players=5, n_finished=1, deadline_year=2026):
    """Bootstrap with deadline_time on events and configurable finished count."""
    events = []
    for i in range(1, 39):
        e = {'id': i, 'finished': i <= n_finished}
        if i == 1:
            e['deadline_time'] = f'{deadline_year}-08-15T17:30:00Z'
        events.append(e)
    return {
        'elements': [{'id': i, 'web_name': f'P{i}'} for i in range(1, n_players + 1)],
        'events': events,
    }


def _fake_summaries(bootstrap):
    return {el['id']: _summary(el['id']) for el in bootstrap['elements']}


# ── SA-02 tests ───────────────────────────────────────────────────────────── #

def test_season_label_derivation():
    """first event deadline 2026-08-15T17:30:00Z -> '2026-27'; missing events -> None"""
    bs = _bootstrap_with_deadline(deadline_year=2026)
    assert capture_season.season_label(bs) == '2026-27'

    # Missing events -> None
    assert capture_season.season_label({}) is None
    assert capture_season.season_label({'events': []}) is None

    # Malformed deadline_time -> None
    bs_bad = {'events': [{'id': 1, 'finished': False, 'deadline_time': 'not-a-date'}]}
    assert capture_season.season_label(bs_bad) is None


def test_snapshot_skips_preseason(tmp_path, monkeypatch):
    """0 finished events -> False, nothing written"""
    bs = _bootstrap_with_deadline(n_finished=0)
    snap_dir = str(tmp_path / 'snap')
    monkeypatch.setattr(capture_season, '_snapshot_dir', lambda label: snap_dir)
    result = capture_season.snapshot_season(bs, [], {}, _fake_summaries(bs))
    assert result is False
    assert not os.path.exists(os.path.join(snap_dir, 'manifest.json'))


def test_snapshot_writes_first_finished_gw(tmp_path, monkeypatch):
    """1 finished GW, no prior manifest -> True, all 5 files written, manifest finished_gws == 1"""
    bs = _bootstrap_with_deadline(n_finished=1)
    snap_dir = str(tmp_path / 'snap')
    monkeypatch.setattr(capture_season, '_snapshot_dir', lambda label: snap_dir)
    result = capture_season.snapshot_season(bs, [{'id': 1}], {}, _fake_summaries(bs))
    assert result is True
    for name in ['bootstrap_final.json', 'fixtures_final.json',
                 'understat_final.json', 'element_summaries.json.gz', 'manifest.json']:
        assert os.path.exists(os.path.join(snap_dir, name)), f'missing {name}'
    manifest = json.load(open(os.path.join(snap_dir, 'manifest.json')))
    assert manifest['finished_gws'] == 1


def test_snapshot_idempotent_same_gw(tmp_path, monkeypatch):
    """second call with same finished count -> False, manifest mtime/content unchanged"""
    bs = _bootstrap_with_deadline(n_finished=1)
    snap_dir = str(tmp_path / 'snap')
    monkeypatch.setattr(capture_season, '_snapshot_dir', lambda label: snap_dir)
    summaries = _fake_summaries(bs)
    # First call writes
    assert capture_season.snapshot_season(bs, [], {}, summaries) is True
    manifest_path = os.path.join(snap_dir, 'manifest.json')
    mtime_before = os.path.getmtime(manifest_path)
    content_before = open(manifest_path).read()
    # Second call with same finished count -> False, file unchanged
    result = capture_season.snapshot_season(bs, [], {}, summaries)
    assert result is False
    assert os.path.getmtime(manifest_path) == mtime_before
    assert open(manifest_path).read() == content_before


def test_snapshot_same_gw_rewrites_when_more_players(tmp_path, monkeypatch):
    """Same finished_gws but more players in summaries -> True, players_fetched increases."""
    bs = _bootstrap_with_deadline(n_players=5, n_finished=1)
    snap_dir = str(tmp_path / 'snap')
    monkeypatch.setattr(capture_season, '_snapshot_dir', lambda label: snap_dir)

    # First call: write snapshot with only 3 players (partial)
    partial_summaries = {el['id']: _summary(el['id']) for el in bs['elements'][:3]}
    assert capture_season.snapshot_season(bs, [], {}, partial_summaries) is True
    manifest_path = os.path.join(snap_dir, 'manifest.json')
    first_manifest = json.load(open(manifest_path))
    assert first_manifest['players_fetched'] == 3

    # Second call: same finished GW count but N+2 players (5 total) -> should rewrite
    full_summaries = _fake_summaries(bs)  # 5 players
    result = capture_season.snapshot_season(bs, [], {}, full_summaries)
    assert result is True
    second_manifest = json.load(open(manifest_path))
    assert second_manifest['players_fetched'] == 5


def test_snapshot_advances_on_new_gw(tmp_path, monkeypatch):
    """finished count 2 > manifest 1 -> True, manifest updated"""
    bs1 = _bootstrap_with_deadline(n_finished=1)
    bs2 = _bootstrap_with_deadline(n_finished=2)
    snap_dir = str(tmp_path / 'snap')
    monkeypatch.setattr(capture_season, '_snapshot_dir', lambda label: snap_dir)
    # First snapshot (GW1)
    assert capture_season.snapshot_season(bs1, [], {}, _fake_summaries(bs1)) is True
    # Second snapshot (GW2) — should advance
    result = capture_season.snapshot_season(bs2, [], {}, _fake_summaries(bs2))
    assert result is True
    manifest = json.load(open(os.path.join(snap_dir, 'manifest.json')))
    assert manifest['finished_gws'] == 2


def test_write_archive_refactor_round_trip(tmp_path, monkeypatch):
    """capture_season() still produces a load_season_archive-loadable archive via write_archive"""
    _patch_fetches(monkeypatch, n_players=5)
    out = str(tmp_path / 'season_2025_26')
    assert capture_season.capture_season(out_dir=out) is True
    # Write_archive round-trip: load back
    archive = capture_season.load_season_archive(base_dir=out)
    assert set(archive.keys()) == {'bootstrap', 'fixtures', 'understat', 'summaries', 'manifest'}
    assert all(isinstance(k, int) for k in archive['summaries'])
    # write_archive directly
    bs = archive['bootstrap']
    fx = archive['fixtures']
    us = archive['understat']
    sm = {k: v for k, v in archive['summaries'].items()}
    out2 = str(tmp_path / 'direct_write')
    manifest = capture_season.write_archive(out2, bs, fx, us, sm)
    assert manifest['players_fetched'] == 5
    archive2 = capture_season.load_season_archive(base_dir=out2)
    assert len(archive2['bootstrap']['elements']) == 5
