"""Tests for pipeline/archive_season.py — Phase 126 NSP-01.

TDD RED phase: written BEFORE archive_season.py exists.
All tests must fail at collection time with ModuleNotFoundError: No module named 'archive_season'.
"""

import sys
from unittest.mock import patch, MagicMock, call

import pytest

# ---------------------------------------------------------------------------
# Fake bootstrap fixture — 10 players to make 50% threshold trivial to test
# ---------------------------------------------------------------------------

FAKE_BOOTSTRAP = {
    'elements': [{'id': i} for i in range(1, 11)]  # players 1..10
}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_idempotency_skips_when_archive_exists():
    """NSP-01/D-08: archive_season() returns early if season_archive_gw38.json is in Blob."""
    from archive_season import archive_season, _blob_exists

    with patch('archive_season._blob_exists', return_value=True) as mock_blob_exists, \
         patch('archive_season.save') as mock_save:

        archive_season(FAKE_BOOTSTRAP)

        # _blob_exists must have been called
        mock_blob_exists.assert_called_once()
        # save must NOT have been called (early return)
        mock_save.assert_not_called()


def test_partial_write_guard_success():
    """NSP-01/D-10: save() is called when >= 50% of element_summary fetches succeed (7/10 here)."""
    from archive_season import archive_season

    # 7 successes, 3 failures (None) — 70% success rate, above 50% threshold
    def fake_fetch_one(player_id):
        if player_id in (3, 6, 9):
            return (player_id, None)
        return (player_id, {'history': [{'element': player_id, 'total_points': 50, 'minutes': 900}]})

    with patch('archive_season._blob_exists', return_value=False), \
         patch('archive_season._fetch_one', side_effect=fake_fetch_one) as mock_fetch, \
         patch('archive_season.save') as mock_save:

        archive_season(FAKE_BOOTSTRAP)

        # save must have been called exactly once
        assert mock_save.call_count == 1, f"Expected save() called once, got {mock_save.call_count}"
        # The saved dict must contain exactly 7 successful entries
        saved_data = mock_save.call_args[0][1]
        assert len(saved_data) == 7, f"Expected 7 players in saved data, got {len(saved_data)}"


def test_partial_write_guard_failure(capsys):
    """NSP-01/D-10: save() is NOT called when < 50% of element_summary fetches succeed (4/10)."""
    from archive_season import archive_season

    # 4 successes, 6 failures — 40% success rate, below 50% threshold
    def fake_fetch_one(player_id):
        if player_id in (1, 2, 3, 4):
            return (player_id, {'history': [{'element': player_id, 'total_points': 30, 'minutes': 600}]})
        return (player_id, None)

    with patch('archive_season._blob_exists', return_value=False), \
         patch('archive_season._fetch_one', side_effect=fake_fetch_one), \
         patch('archive_season.save') as mock_save:

        archive_season(FAKE_BOOTSTRAP)

        # save must NOT have been called
        mock_save.assert_not_called()
        # A warning should have been logged to stderr
        captured = capsys.readouterr()
        assert '< 50%' in captured.err or 'skipping' in captured.err.lower(), (
            f"Expected a partial-write warning in stderr, got: {captured.err!r}"
        )


def test_non_fatal_player_failures_do_not_abort():
    """NSP-01/D-10: An exception inside _fetch_one does not abort the loop; surviving players are saved."""
    from archive_season import archive_season

    # 8 successes; players 5 and 10 raise exceptions
    def fake_fetch_one(player_id):
        if player_id in (5, 10):
            # Simulate a real network exception
            raise RuntimeError(f"Network error for player {player_id}")
        return (player_id, {'history': [{'element': player_id, 'total_points': 40, 'minutes': 800}]})

    with patch('archive_season._blob_exists', return_value=False), \
         patch('archive_season._fetch_one', side_effect=fake_fetch_one), \
         patch('archive_season.save') as mock_save:

        # Should not raise even though 2 players error
        archive_season(FAKE_BOOTSTRAP)

        # 8 surviving players should still be saved (80% > 50% threshold)
        assert mock_save.call_count == 1
        saved_data = mock_save.call_args[0][1]
        assert len(saved_data) == 8, f"Expected 8 surviving players, got {len(saved_data)}"
        # Erroring players must not appear in result
        assert 5 not in saved_data
        assert 10 not in saved_data
