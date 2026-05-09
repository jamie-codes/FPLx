"""Pytest unit tests for pipeline/set_piece_quality.py (Phase 84, SPQ-01/SPQ-02).

Wave 0 RED gate: collection fails with ModuleNotFoundError until Task 2 creates
pipeline/set_piece_quality.py. Per VALIDATION.md task map 84-01-01..84-01-03.

Test contract derived from:
  - CONTEXT.md D-01..D-07 (locked decisions)
  - RESEARCH.md Common Pitfalls 1, 2, 5; Code Examples (mixed-situation fixture)
  - PATTERNS.md test_set_piece_quality.py section
  - ROADMAP.md Phase 84 success criterion 5 (mixed-situation fixture)
"""

import pytest

# conftest.py inserts pipeline/ onto sys.path -- use bare import.
# Wave 0: this import will FAIL until Task 2 creates set_piece_quality.py.
from set_piece_quality import (
    _aggregate_shots,
    _compute_per_taker_scores,
    _shrink,
    SHRINKAGE_K,
)


# ------------------------------------------------------------------ helpers

def _make_shot(situation, deliverer_id, shooter_id, xg='0.10'):
    """Build a synthetic Understat shot dict with deliverer != shooter."""
    return {
        'situation': situation,
        'player_assisted_id': deliverer_id,
        'player_id': shooter_id,
        'xG': xg,
    }


# ------------------------------------------------------------------ SPQ-01 / SPQ-02 aggregation

def test_only_corner_and_fk_counted():
    """SPQ-01/SPQ-02: only FromCorner and DirectFreekick shots counted; grouped by
    player_assisted (deliverer), NOT player (shooter). RESEARCH Pitfall 1.
    ROADMAP Phase 84 success criterion 5 -- mixed-situation fixture."""
    shots = [
        # Corner -- deliverer=10, shooter=99
        _make_shot('FromCorner', 10, 99, '0.15'),
        _make_shot('FromCorner', 10, 88, '0.20'),
        # FK -- deliverer=10, shooter=77
        _make_shot('DirectFreekick', 10, 77, '0.12'),
        # Open play -- must be EXCLUDED
        _make_shot('OpenPlay', 10, 66, '0.30'),
        # Penalty -- must be EXCLUDED
        _make_shot('Penalty', 10, 55, '0.79'),
    ]
    result = _aggregate_shots(shots)
    # Deliverer must appear in both buckets
    assert 10 in result['corner_shots']
    assert 10 in result['fk_shots']
    assert len(result['corner_shots'][10]) == 2
    assert len(result['fk_shots'][10]) == 1
    # Shooter must NOT appear as deliverer (SPQ-02 critical invariant)
    assert 99 not in result['corner_shots']
    assert 99 not in result['fk_shots']
    assert 88 not in result['corner_shots']
    assert 77 not in result['fk_shots']


def test_aggregates_by_deliverer_not_shooter():
    """SPQ-02: two deliverers, three shooters -> output keys are deliverer IDs."""
    shots = [
        _make_shot('FromCorner', 10, 99, '0.15'),  # deliverer 10
        _make_shot('FromCorner', 20, 99, '0.20'),  # deliverer 20 (same shooter)
        _make_shot('DirectFreekick', 10, 88, '0.10'),
    ]
    result = _aggregate_shots(shots)
    assert set(result['corner_shots'].keys()) == {10, 20}
    assert set(result['fk_shots'].keys()) == {10}


def test_xg_string_coerced_to_float():
    """V5 Input Validation (RESEARCH Security Domain): xG arrives as a string from
    Understat JSON; aggregator must coerce via float() so downstream mean works."""
    shots = [_make_shot('FromCorner', 10, 99, '0.25')]
    result = _aggregate_shots(shots)
    assert result['corner_shots'][10] == [0.25]


# ------------------------------------------------------------------ SPQ-02 sample gates

def test_corner_score_null_below_5_samples():
    """SPQ-02: corner_danger_score is None when n_corner < 5."""
    corner_shots = {10: [0.10, 0.10, 0.10, 0.10]}  # n=4 -> below threshold
    fk_shots = {10: []}
    reverse_id_map = {10: '233'}
    sp_quality, unmatched = _compute_per_taker_scores(corner_shots, fk_shots, reverse_id_map)
    assert sp_quality['233']['corner_danger_score'] is None
    assert sp_quality['233']['fk_danger_score'] is None
    assert sp_quality['233']['sp_sample_n'] == 4


def test_fk_score_null_below_3_samples():
    """SPQ-02: fk_danger_score is None when n_fk < 3."""
    corner_shots = {10: []}
    fk_shots = {10: [0.10, 0.10]}  # n=2 -> below threshold
    reverse_id_map = {10: '233'}
    sp_quality, unmatched = _compute_per_taker_scores(corner_shots, fk_shots, reverse_id_map)
    assert sp_quality['233']['fk_danger_score'] is None
    assert sp_quality['233']['corner_danger_score'] is None
    assert sp_quality['233']['sp_sample_n'] == 2


def test_corner_score_returns_mean_at_threshold():
    """SPQ-02: corner_danger_score == mean(xg) when n_corner >= 5."""
    corner_shots = {10: [0.10, 0.10, 0.10, 0.10, 0.10]}  # n=5 -> threshold
    fk_shots = {10: []}
    reverse_id_map = {10: '233'}
    sp_quality, unmatched = _compute_per_taker_scores(corner_shots, fk_shots, reverse_id_map)
    assert sp_quality['233']['corner_danger_score'] == pytest.approx(0.10, abs=1e-9)
    assert sp_quality['233']['sp_sample_n'] == 5


def test_delivery_quality_rank_null_when_both_scores_null():
    """SPQ-02: delivery_quality_rank is None when both corner and FK scores are null."""
    corner_shots = {10: [0.10]}      # n=1 -> below corner threshold
    fk_shots = {10: [0.10]}          # n=1 -> below FK threshold
    reverse_id_map = {10: '233'}
    sp_quality, unmatched = _compute_per_taker_scores(corner_shots, fk_shots, reverse_id_map)
    assert sp_quality['233']['corner_danger_score'] is None
    assert sp_quality['233']['fk_danger_score'] is None
    assert sp_quality['233']['delivery_quality_rank'] is None


# ------------------------------------------------------------------ SPQ-02 unmatched ID

def test_unmatched_understat_id_counted():
    """SPQ-02: deliverer with no FPL mapping increments unmatched_count and is dropped."""
    corner_shots = {
        10: [0.10, 0.10, 0.10, 0.10, 0.10],   # in reverse_id_map -> kept
        99: [0.10, 0.10, 0.10, 0.10, 0.10],   # NOT in reverse_id_map -> unmatched
    }
    fk_shots = {}
    reverse_id_map = {10: '233'}  # only 10 is mapped; 99 is unmatched
    sp_quality, unmatched = _compute_per_taker_scores(corner_shots, fk_shots, reverse_id_map)
    assert '233' in sp_quality
    assert unmatched == 1
    # Unmatched deliverer must NOT appear in output keyed by FPL ID
    assert all(k.isdigit() for k in sp_quality.keys())


def test_understat_id_field_in_output():
    """D-06: each sp_quality entry includes understat_id (int or null) for debugging."""
    corner_shots = {10: [0.10, 0.10, 0.10, 0.10, 0.10]}
    fk_shots = {}
    reverse_id_map = {10: '233'}
    sp_quality, _ = _compute_per_taker_scores(corner_shots, fk_shots, reverse_id_map)
    assert sp_quality['233']['understat_id'] == 10


# ------------------------------------------------------------------ EB shrinkage

def test_shrinkage_constant_is_20():
    """SPQ-02: SHRINKAGE_K must be exactly 20 (RESEARCH bonus.py uses k=12;
    SPQ-02 spec mandates k=20 -- divergence must be intentional)."""
    assert SHRINKAGE_K == 20


def test_shrink_with_zero_n_returns_prior():
    """EB shrinkage: n=0 -> w=0, result == prior."""
    assert _shrink(empirical=1.0, prior=0.5, n=0) == pytest.approx(0.5)


def test_shrink_with_high_n_approaches_empirical():
    """EB shrinkage: n=200, k=20 -> w=200/220=~0.909, result close to empirical."""
    result = _shrink(empirical=1.0, prior=0.5, n=200)
    assert result == pytest.approx(1.0 * (200 / 220) + 0.5 * (20 / 220), abs=1e-9)
