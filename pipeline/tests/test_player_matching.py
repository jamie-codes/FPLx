"""Unit tests for pipeline/player_matching.py (Phase 123 SCR-02).

RED stage: player_matching.py does not exist yet. Tests are collected successfully
but fail (or are skipped) until the implementation module is created in Task 02.

Tests validate:
  - build_name_lookup(elements) correct lowercasing and deduplication
  - match_player() exact match, fuzzy-above-cutoff, below-cutoff, short-word skip
  - FUZZY_CUTOFF is int 85 (not 0.85 — Pitfall 1, rapidfuzz 0-100 scale)
"""

import importlib

import pytest


def _import_pm():
    """Import player_matching, failing the test with a clear message if not yet implemented."""
    try:
        import player_matching as pm
        return pm
    except ModuleNotFoundError:
        pytest.fail("player_matching module not found (implement Task 02)")


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def pm():
    return _import_pm()


@pytest.fixture
def build_name_lookup(pm):
    return pm.build_name_lookup


@pytest.fixture
def match_player(pm):
    return pm.match_player


@pytest.fixture
def salah_elements():
    return [{'id': 1, 'web_name': 'Salah', 'second_name': 'Mohamed Salah'}]


@pytest.fixture
def salah_lookup(build_name_lookup, salah_elements):
    return build_name_lookup(salah_elements)


# ---------------------------------------------------------------------------
# FUZZY_CUTOFF scale guard
# ---------------------------------------------------------------------------

def test_fuzzy_cutoff_is_85_not_point_85(pm):
    """FUZZY_CUTOFF must be int 85 — rapidfuzz uses 0-100 scale, NOT 0.0-1.0.

    Pitfall 1 from RESEARCH.md: confusing rapidfuzz 0-100 scale with difflib 0.0-1.0.
    """
    assert pm.FUZZY_CUTOFF == 85, (
        f"FUZZY_CUTOFF should be 85 (int, rapidfuzz 0-100 scale), got {pm.FUZZY_CUTOFF}"
    )
    assert isinstance(pm.FUZZY_CUTOFF, int), (
        f"FUZZY_CUTOFF should be int, got {type(pm.FUZZY_CUTOFF)}"
    )


# ---------------------------------------------------------------------------
# build_name_lookup tests
# ---------------------------------------------------------------------------

def test_build_name_lookup_lowercases_web_and_second_name(build_name_lookup, salah_elements):
    """Both web_name and second_name should appear lowercased as keys."""
    lookup = build_name_lookup(salah_elements)
    assert 'salah' in lookup, "web_name 'Salah' should be lowercased to 'salah'"
    assert 'mohamed salah' in lookup, "second_name 'Mohamed Salah' should be lowercased"
    assert lookup['salah'] == 1
    assert lookup['mohamed salah'] == 1


def test_build_name_lookup_skips_duplicate_second_name(build_name_lookup):
    """When web_name and second_name are equal (case-insensitive), only one entry."""
    elements = [{'id': 5, 'web_name': 'Kane', 'second_name': 'Kane'}]
    lookup = build_name_lookup(elements)
    assert 'kane' in lookup
    assert lookup['kane'] == 5
    entries_for_id_5 = [k for k, v in lookup.items() if v == 5]
    assert len(entries_for_id_5) == 1, "Duplicate equal names should produce only one entry"


def test_build_name_lookup_values_are_int_element_ids(build_name_lookup, salah_elements):
    """Values must be int element_id, not the full element dict."""
    lookup = build_name_lookup(salah_elements)
    for key, val in lookup.items():
        assert isinstance(val, int), f"lookup['{key}'] should be int, got {type(val)}"


def test_build_name_lookup_empty_elements(build_name_lookup):
    """Empty elements list returns empty lookup."""
    lookup = build_name_lookup([])
    assert lookup == {}


# ---------------------------------------------------------------------------
# match_player tests
# ---------------------------------------------------------------------------

def test_match_player_exact_match_returns_element_id(match_player, salah_lookup):
    """Exact lowercased match should return the element_id."""
    result = match_player('Salah', salah_lookup)
    assert result == 1, f"Expected element_id 1, got {result}"


def test_match_player_exact_match_case_insensitive(match_player, salah_lookup):
    """Match should be case-insensitive."""
    result = match_player('SALAH', salah_lookup)
    assert result == 1


def test_match_player_fuzzy_above_cutoff_returns_element_id(build_name_lookup, match_player):
    """Full-string match of 'Mohamed Salah' against the lookup entry should return id."""
    elements = [{'id': 1, 'web_name': 'Salah', 'second_name': 'Mohamed Salah'}]
    lookup = build_name_lookup(elements)
    result = match_player('Mohamed Salah', lookup)
    assert result == 1, f"Expected 1, got {result}"


def test_match_player_below_cutoff_returns_none(match_player, salah_lookup):
    """A completely different name should not match."""
    result = match_player('Completely Different Name', salah_lookup)
    assert result is None, f"Expected None, got {result}"


def test_match_player_returns_none_for_empty_string(match_player, salah_lookup):
    """Empty string input should return None without error."""
    result = match_player('', salah_lookup)
    assert result is None


def test_match_player_returns_none_for_none_input(match_player, salah_lookup):
    """None input should return None without error."""
    result = match_player(None, salah_lookup)
    assert result is None


def test_match_player_short_word_skip_avoids_false_positive(build_name_lookup, match_player):
    """Words shorter than 4 chars (like 'Son') should be skipped in per-word loop.

    Pitfall 8 from RESEARCH.md: very short tokens can produce spurious matches
    via rapidfuzz token_sort_ratio.
    """
    elements = [{'id': 10, 'web_name': 'Johnson', 'second_name': 'Adam Johnson'}]
    lookup = build_name_lookup(elements)
    # 'Son' is 3 characters — should be skipped in per-word loop
    result = match_player('Son', lookup)
    assert result is None, (
        f"Short token 'Son' (3 chars) should be skipped in per-word loop, got {result}"
    )
