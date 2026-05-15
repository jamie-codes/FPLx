"""Tests for pipeline/transfer_snapshots.py — Phase 113 BACK-02.

TDD RED phase: these tests are written BEFORE transfer_snapshots.py exists.
All tests must fail initially with ModuleNotFoundError.
"""

import importlib
from unittest.mock import patch, call


def test_write_transfer_slim_snapshot_noop_when_use_blob_unset(monkeypatch):
    """Test 1: No-op when USE_BLOB is unset."""
    monkeypatch.delenv('USE_BLOB', raising=False)
    from transfer_snapshots import write_transfer_slim_snapshot
    with patch('upload.upload_json') as mock_upload:
        write_transfer_slim_snapshot([{'id': 1, 'web_name': 'Salah'}], 30)
        mock_upload.assert_not_called()


def test_write_transfer_slim_snapshot_noop_when_use_blob_false(monkeypatch):
    """Test 2: No-op when USE_BLOB is set to a non-'true' value."""
    for value in ('false', '0', '', 'no', 'FALSE'):
        monkeypatch.setenv('USE_BLOB', value)
        # Re-import to pick up env change
        import transfer_snapshots
        importlib.reload(transfer_snapshots)
        with patch('upload.upload_json') as mock_upload:
            transfer_snapshots.write_transfer_slim_snapshot(
                [{'id': 1, 'web_name': 'Salah'}], 30
            )
            mock_upload.assert_not_called()


def test_write_transfer_slim_snapshot_calls_upload_json_when_use_blob_true(monkeypatch):
    """Test 3: Calls upload_json with correct pathname when USE_BLOB=true."""
    monkeypatch.setenv('USE_BLOB', 'true')
    import transfer_snapshots
    importlib.reload(transfer_snapshots)
    merged = [
        {
            'id': 328,
            'element_type': 4,
            'web_name': 'Salah',
            'team': 11,
            'now_cost': 130,
            'selected_by_percent': '44.1',
            'xPts_1gw': 8.5,
            'xPts_3gw': 25.0,
            'xPts_5gw': 42.0,
        }
    ]
    with patch('upload.upload_json') as mock_upload:
        transfer_snapshots.write_transfer_slim_snapshot(merged, 30)
        assert mock_upload.call_count == 1
        args = mock_upload.call_args
        pathname = args[0][0]
        assert pathname == 'merged_players_slim_gw30.json', \
            f"Expected 'merged_players_slim_gw30.json', got '{pathname}'"


def test_write_transfer_slim_snapshot_projects_only_slim_fields(monkeypatch):
    """Test 4: Slim projection contains ONLY SLIM_FIELDS keys — drops all others."""
    monkeypatch.setenv('USE_BLOB', 'true')
    import transfer_snapshots
    importlib.reload(transfer_snapshots)
    merged = [
        {
            'id': 328,
            'element_type': 4,
            'web_name': 'Salah',
            'team': 11,
            'now_cost': 130,
            'selected_by_percent': '44.1',
            'xPts_1gw': 8.5,
            'xPts_3gw': 25.0,
            'xPts_5gw': 42.0,
            # Extra fields that must be dropped:
            'xg': 0.45,
            'xa': 0.12,
            'gem_score': 0.78,
            'bogus_extra_field': 'should_be_dropped',
            'differential_flag': 'diff',
        }
    ]
    captured_data = {}

    def capture(pathname, data):
        captured_data['data'] = data

    with patch('upload.upload_json', side_effect=capture):
        transfer_snapshots.write_transfer_slim_snapshot(merged, 30)

    assert 'data' in captured_data, "upload_json was not called"
    uploaded_list = captured_data['data']
    assert len(uploaded_list) == 1
    uploaded_player = uploaded_list[0]

    slim_fields = set(transfer_snapshots.SLIM_FIELDS)
    # Every key in the uploaded player must be in SLIM_FIELDS
    for key in uploaded_player:
        assert key in slim_fields, f"Unexpected field '{key}' in slim projection"
    # All SLIM_FIELDS present in the source should be present in the output
    for field in transfer_snapshots.SLIM_FIELDS:
        if field in merged[0]:
            assert field in uploaded_player, f"Expected field '{field}' missing from slim projection"


def test_write_transfer_slim_snapshot_omits_missing_fields_silently(monkeypatch):
    """Test 5: Keys absent from a player dict are silently omitted (if k in p guard)."""
    monkeypatch.setenv('USE_BLOB', 'true')
    import transfer_snapshots
    importlib.reload(transfer_snapshots)
    # Player missing xPts_* fields (e.g., GKs in some early pipeline runs)
    merged = [
        {
            'id': 1,
            'web_name': 'Raya',
            'team': 1,
            # 'element_type' is missing
            # 'now_cost' is missing
            # 'selected_by_percent' is missing
            # 'xPts_1gw', 'xPts_3gw', 'xPts_5gw' are all missing
        }
    ]
    captured_data = {}

    def capture(pathname, data):
        captured_data['data'] = data

    with patch('upload.upload_json', side_effect=capture):
        transfer_snapshots.write_transfer_slim_snapshot(merged, 33)

    uploaded_list = captured_data['data']
    assert len(uploaded_list) == 1
    uploaded_player = uploaded_list[0]
    # Only fields that were present in the source should appear
    assert 'id' in uploaded_player
    assert 'web_name' in uploaded_player
    # Missing fields must NOT appear (no KeyError, no None placeholders)
    assert 'element_type' not in uploaded_player
    assert 'now_cost' not in uploaded_player
    assert 'xPts_1gw' not in uploaded_player
    assert 'xPts_3gw' not in uploaded_player
    assert 'xPts_5gw' not in uploaded_player
    # No extra fields
    slim_fields = set(transfer_snapshots.SLIM_FIELDS)
    for key in uploaded_player:
        assert key in slim_fields
