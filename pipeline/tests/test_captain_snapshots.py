"""Phase 96 BACK-01 Wave 1 RED — captain snapshot side-write contract tests.

pipeline/captain_snapshots.py does not exist yet — these tests fail at import.
Plan 02 will create it and turn these tests GREEN.

Contract being tested (mirrors predictions_snapshot side-write at run.py lines 339-342):

    if os.getenv('USE_BLOB', '').lower() == 'true':
        from upload import upload_json
        upload_json(f'captain_picks_gw{current_gw}.json', captain_picks)

Sources of truth:
  .planning/phases/96-captain-decision-backtester/96-CONTEXT.md §D-09
  .planning/phases/96-captain-decision-backtester/096-PATTERNS.md §pipeline/run.py
"""

from unittest.mock import patch, MagicMock


# Plan 02 must expose a callable named `write_captain_snapshot(captain_picks, current_gw)`
# in pipeline/captain_snapshots.py. This is the SEAM the run.py side-write delegates to.
from captain_snapshots import write_captain_snapshot  # type: ignore[import-not-found]  # noqa: E402


SAMPLE_CAPTAIN_PICKS = {
    'generated_at': '2026-05-11T12:00:00+00:00',
    'gameweek': 42,
    'ceiling': {
        'id': 100,
        'name': 'Haaland',
        'team': 'MCI',
        'position': 'FWD',
        'now_cost': 145,
        'xPts_1gw': 8.2,
        'xPts_90th_1gw': 11.4,
        'selected_by_percent': '55.0',
    },
    'eo_adjusted': None,
}


def test_uploads_to_blob_when_use_blob_true(monkeypatch):
    """D-09: filename convention is captain_picks_gw{current_gw}.json."""
    monkeypatch.setenv('USE_BLOB', 'true')
    with patch('vercel_blob.put') as mock_put:
        write_captain_snapshot(SAMPLE_CAPTAIN_PICKS, 42)
        assert mock_put.called, 'vercel_blob.put must be invoked when USE_BLOB=true'
        # First positional arg is the blob pathname
        args, _kwargs = mock_put.call_args
        assert args[0] == 'captain_picks_gw42.json', (
            f'expected filename captain_picks_gw42.json, got {args[0]!r}'
        )
        # WR-03: assert the payload contains the correct captain picks data.
        # A future refactor that serialises the wrong dict would be caught here.
        import json as _json
        payload_bytes = args[1]
        parsed = _json.loads(
            payload_bytes.decode('utf-8') if isinstance(payload_bytes, bytes) else payload_bytes
        )
        assert parsed.get('gameweek') == 42, (
            f'expected gameweek=42 in payload, got {parsed.get("gameweek")!r}'
        )
        assert 'ceiling' in parsed, 'payload must contain a "ceiling" key'


def test_no_upload_when_use_blob_unset(monkeypatch):
    """USE_BLOB unset → side-write is a no-op (pipeline running locally)."""
    monkeypatch.delenv('USE_BLOB', raising=False)
    with patch('vercel_blob.put') as mock_put:
        write_captain_snapshot(SAMPLE_CAPTAIN_PICKS, 42)
        assert not mock_put.called, 'vercel_blob.put must NOT be called when USE_BLOB is unset'


def test_no_upload_when_use_blob_false(monkeypatch):
    """USE_BLOB=false → side-write is a no-op."""
    monkeypatch.setenv('USE_BLOB', 'false')
    with patch('vercel_blob.put') as mock_put:
        write_captain_snapshot(SAMPLE_CAPTAIN_PICKS, 42)
        assert not mock_put.called, 'vercel_blob.put must NOT be called when USE_BLOB=false'


def test_idempotent_repeat_invocation(monkeypatch):
    """Re-running the pipeline for the same GW must not raise; allowOverwrite=true is required."""
    monkeypatch.setenv('USE_BLOB', 'true')
    with patch('vercel_blob.put') as mock_put:
        write_captain_snapshot(SAMPLE_CAPTAIN_PICKS, 42)
        write_captain_snapshot(SAMPLE_CAPTAIN_PICKS, 42)
        assert mock_put.call_count == 2
        # Inspect the options dict (3rd positional) for allowOverwrite=True
        for call in mock_put.call_args_list:
            args = call.args
            # vercel_blob.put(pathname, payload, options_dict) per pipeline/upload.py
            assert len(args) >= 3, f'expected (pathname, payload, options), got {args!r}'
            options = args[2]
            assert isinstance(options, dict)
            assert options.get('allowOverwrite') is True, (
                f'allowOverwrite must be True for idempotent re-run; got options={options!r}'
            )


def test_run_py_invokes_write_captain_snapshot_after_predictions_block():
    """Contract test: pipeline/run.py must call write_captain_snapshot(captain_picks, current_gw)
    AFTER the existing predictions_snapshot Blob upload block, not before.

    Reading run.py as text (rather than importing — top-level dotenv side effects
    prevent import), so this is a syntax-shape contract test mirroring test_run.py.
    """
    import pathlib
    run_py_path = pathlib.Path(__file__).resolve().parent.parent / 'run.py'
    src = run_py_path.read_text(encoding='utf-8')

    # Both markers must be present.
    pred_marker = 'Predictions snapshot uploaded to Blob'
    cap_call = 'write_captain_snapshot(captain_picks, current_gw)'
    cap_import = 'from captain_snapshots import write_captain_snapshot'

    assert pred_marker in src, 'predictions snapshot block must remain in run.py'
    assert cap_call in src, f'run.py must call {cap_call}'
    assert cap_import in src, f'run.py must import write_captain_snapshot'

    # Ordering: the captain call must appear AFTER the predictions marker.
    pred_idx = src.index(pred_marker)
    cap_idx = src.index(cap_call)
    assert cap_idx > pred_idx, (
        'captain snapshot side-write must follow the predictions snapshot block; '
        f'got predictions at offset {pred_idx}, captain at offset {cap_idx}'
    )

    # The existing captain_picks.json save (line 227) must still exist — additive only.
    assert "save('captain_picks.json', captain_picks)" in src, (
        'Phase 31 captain_picks.json save must remain — Phase 96 is additive'
    )
