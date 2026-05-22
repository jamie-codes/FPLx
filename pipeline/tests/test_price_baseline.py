"""Tests for pipeline/price_baseline.py — Phase 133 PRST-01.

TDD RED phase: written BEFORE price_baseline.py exists.
All tests must fail at collection time with ModuleNotFoundError: No module named 'price_baseline'.
"""

import sys
from unittest.mock import patch, MagicMock

import pytest

# ---------------------------------------------------------------------------
# Fake bootstrap fixture
# ---------------------------------------------------------------------------

FAKE_BOOTSTRAP = {
    'elements': [
        {'id': 1, 'now_cost': 50, 'web_name': 'Salah', 'team': 14, 'form': '8.3'},
        {'id': 2, 'now_cost': 55, 'web_name': 'Haaland', 'team': 11, 'form': '9.1'},
        {'id': 3, 'now_cost': 60, 'web_name': 'De Bruyne', 'team': 11, 'form': '6.5'},
    ]
}

EMPTY_BOOTSTRAP = {'elements': []}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_idempotency_skips_when_baseline_exists():
    """PRST-01/D-01: capture_price_baseline() returns early if price_baseline.json is in Blob."""
    from price_baseline import capture_price_baseline

    with patch('price_baseline._blob_exists', return_value=True) as mock_blob_exists, \
         patch('price_baseline.save') as mock_save:

        capture_price_baseline(FAKE_BOOTSTRAP)

        # _blob_exists must have been called once
        mock_blob_exists.assert_called_once()
        # save must NOT have been called (early return)
        mock_save.assert_not_called()


def test_writes_baseline_when_absent():
    """PRST-01/D-02: capture_price_baseline() calls save() with correct pathname and dict shape."""
    from price_baseline import capture_price_baseline

    with patch('price_baseline._blob_exists', return_value=False), \
         patch('price_baseline.save') as mock_save:

        capture_price_baseline(FAKE_BOOTSTRAP)

        # save must have been called exactly once
        mock_save.assert_called_once()
        # Verify pathname and dict shape
        call_args = mock_save.call_args[0]
        assert call_args[0] == 'price_baseline.json', (
            f"Expected pathname 'price_baseline.json', got {call_args[0]!r}"
        )
        saved_dict = call_args[1]
        assert saved_dict == {'1': 50, '2': 55, '3': 60}, (
            f"Expected {{'1': 50, '2': 55, '3': 60}}, got {saved_dict!r}"
        )


def test_skips_when_elements_empty(capsys):
    """PRST-01: capture_price_baseline() does not call save() when elements is empty; logs stderr warning."""
    from price_baseline import capture_price_baseline

    with patch('price_baseline._blob_exists', return_value=False), \
         patch('price_baseline.save') as mock_save:

        capture_price_baseline(EMPTY_BOOTSTRAP)

        # save must NOT have been called
        mock_save.assert_not_called()
        # A warning containing 'no elements' must appear in stderr
        captured = capsys.readouterr()
        assert 'no elements' in captured.err.lower(), (
            f"Expected 'no elements' warning in stderr, got: {captured.err!r}"
        )


def test_only_now_cost_captured():
    """PRST-01/D-02: only now_cost is saved per player — no extra fields, value is int."""
    from price_baseline import capture_price_baseline

    # Bootstrap with extra fields that must NOT appear in the saved dict
    bootstrap_with_extras = {
        'elements': [
            {
                'id': 10,
                'now_cost': 75,
                'web_name': 'Mbappe',
                'team': 21,
                'form': '7.5',
                'selected_by_percent': '18.3',
                'status': 'a',
            }
        ]
    }

    with patch('price_baseline._blob_exists', return_value=False), \
         patch('price_baseline.save') as mock_save:

        capture_price_baseline(bootstrap_with_extras)

        mock_save.assert_called_once()
        saved_dict = mock_save.call_args[0][1]
        # The value for player 10 must be the integer now_cost only — no nested dict
        assert '10' in saved_dict, f"Expected key '10' in saved dict, got keys: {list(saved_dict.keys())}"
        assert saved_dict['10'] == 75, f"Expected 75, got {saved_dict['10']!r}"
        assert isinstance(saved_dict['10'], int), (
            f"Expected int, got {type(saved_dict['10']).__name__}"
        )
        # No extra keys (like 'web_name') should be nested under the player entry
        assert not isinstance(saved_dict['10'], dict), (
            "Expected integer value, not nested dict"
        )
