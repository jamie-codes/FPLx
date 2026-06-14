"""Unit tests for pipeline/season_prior.py (COLD-01)."""

import pytest
from season_prior import (
    build_prior_lookup,
    build_bucket_priors,
    price_band,
    prior_for,
    SEED_MINUTES,
)


def _make_archive(players):
    """Build a minimal archive dict. players = list of (id, code, element_type, now_cost, history)."""
    elements = []
    summaries = {}
    for pid, code, et, cost, history in players:
        elements.append({
            'id': pid,
            'code': code,
            'element_type': et,
            'now_cost': cost,
        })
        summaries[pid] = {'history': history}
    return {
        'bootstrap': {'elements': elements},
        'summaries': summaries,
    }


def _hist(minutes, starts, xg='0.0', xa='0.0'):
    return {
        'minutes': minutes,
        'starts': starts,
        'expected_goals': xg,
        'expected_assists': xa,
    }


# ── SEED_MINUTES ──────────────────────────────────────────────────────────────

def test_seed_minutes_is_270():
    assert SEED_MINUTES == 270


# ── price_band ────────────────────────────────────────────────────────────────

def test_price_band_budget():
    assert price_band(54) == 0
    assert price_band(40) == 0


def test_price_band_mid():
    assert price_band(55) == 1
    assert price_band(84) == 1
    assert price_band(70) == 1


def test_price_band_premium():
    assert price_band(85) == 2
    assert price_band(130) == 2


# ── build_prior_lookup ────────────────────────────────────────────────────────

def test_build_prior_lookup_sums_correctly():
    """sums expected_goals/expected_assists/minutes/starts, computes per-90 correctly."""
    history = [
        _hist(90, 1, xg='0.18', xa='0.09'),
        _hist(90, 1, xg='0.27', xa='0.00'),
        _hist(90, 1, xg='0.00', xa='0.18'),
        _hist(90, 1, xg='0.09', xa='0.09'),
        _hist(90, 1, xg='0.09', xa='0.09'),
        _hist(90, 1, xg='0.09', xa='0.09'),
    ]  # 6 rows × 90 min = 540 min >= 500
    archive = _make_archive([(101, 1001, 3, 70, history)])
    lookup = build_prior_lookup(archive)
    assert 1001 in lookup
    p = lookup[1001]
    total_xg = 0.18 + 0.27 + 0.00 + 0.09 + 0.09 + 0.09
    total_xa = 0.09 + 0.00 + 0.18 + 0.09 + 0.09 + 0.09
    total_mins = 540
    assert abs(p['xg_per90'] - total_xg / total_mins * 90) < 1e-6
    assert abs(p['xa_per90'] - total_xa / total_mins * 90) < 1e-6
    assert p['total_minutes'] == 540
    assert abs(p['start_rate'] - 6 / 6) < 1e-6
    assert abs(p['mins_per_start'] - 90.0) < 1e-6


def test_build_prior_lookup_excludes_low_minutes():
    """Players with total_minutes < 500 are excluded."""
    history = [_hist(80, 1, xg='0.2', xa='0.1')] * 5  # 400 min < 500
    archive = _make_archive([(101, 1001, 3, 70, history)])
    lookup = build_prior_lookup(archive)
    assert 1001 not in lookup


def test_build_prior_lookup_key_is_code_not_id():
    """Lookup is keyed by player code, not FPL id."""
    history = [_hist(90, 1, xg='0.2', xa='0.1')] * 6  # 540 min
    archive = _make_archive([(999, 12345, 3, 70, history)])
    lookup = build_prior_lookup(archive)
    assert 12345 in lookup   # code
    assert 999 not in lookup  # id should not be the key


def test_build_prior_lookup_two_players():
    """Two players: one eligible, one excluded."""
    hist_big = [_hist(90, 1, xg='0.2', xa='0.1')] * 6  # 540 min
    hist_small = [_hist(60, 0, xg='0.0', xa='0.0')] * 4  # 240 min < 500
    archive = _make_archive([
        (101, 1001, 3, 70, hist_big),
        (102, 1002, 4, 55, hist_small),
    ])
    lookup = build_prior_lookup(archive)
    assert 1001 in lookup
    assert 1002 not in lookup


def test_build_prior_lookup_string_xg_coerced():
    """expected_goals/expected_assists as string decimals are coerced to float."""
    history = [_hist(90, 1, xg='0.15', xa='0.10')] * 6
    archive = _make_archive([(101, 1001, 3, 70, history)])
    lookup = build_prior_lookup(archive)
    assert 1001 in lookup
    assert abs(lookup[1001]['xg_per90'] - 0.15) < 1e-6
    assert abs(lookup[1001]['xa_per90'] - 0.10) < 1e-6


def test_build_prior_lookup_mins_per_start_zero_when_no_starts():
    """mins_per_start is 0.0 when a player has total_minutes >= 500 but starts == 0."""
    history = [_hist(100, 0, xg='0.0', xa='0.0')] * 6  # 600 min, 0 starts
    archive = _make_archive([(101, 1001, 3, 70, history)])
    lookup = build_prior_lookup(archive)
    assert 1001 in lookup
    assert lookup[1001]['mins_per_start'] == 0.0


# ── build_bucket_priors ───────────────────────────────────────────────────────

def test_build_bucket_priors_groups_by_et_and_band():
    """Two eligible players in different buckets → two (et, band) entries."""
    hist = [_hist(90, 1, xg='0.2', xa='0.1')] * 6
    archive = _make_archive([
        (101, 1001, 3, 70, hist),  # MID, mid-price
        (102, 1002, 4, 100, hist), # FWD, premium
    ])
    buckets = build_bucket_priors(archive)
    assert (3, 1) in buckets
    assert (4, 2) in buckets


def test_build_bucket_priors_means_correctly():
    """Two players in the same bucket → bucket mean of their per-90s."""
    hist_a = [_hist(90, 1, xg='0.2', xa='0.1')] * 6   # xg_per90=0.2, xa_per90=0.1
    hist_b = [_hist(90, 1, xg='0.4', xa='0.3')] * 6   # xg_per90=0.4, xa_per90=0.3
    archive = _make_archive([
        (101, 1001, 3, 70, hist_a),
        (102, 1002, 3, 75, hist_b),
    ])
    buckets = build_bucket_priors(archive)
    b = buckets[(3, 1)]  # MID, mid-price
    assert abs(b['xg_per90'] - 0.3) < 1e-6
    assert abs(b['xa_per90'] - 0.2) < 1e-6


def test_build_bucket_priors_only_eligible_players():
    """Sub-500-min player excluded from bucket means."""
    hist_ok = [_hist(90, 1, xg='0.4', xa='0.2')] * 6   # 540 min
    hist_bad = [_hist(60, 0, xg='1.0', xa='1.0')] * 4  # 240 min < 500
    archive = _make_archive([
        (101, 1001, 3, 70, hist_ok),
        (102, 1002, 3, 70, hist_bad),
    ])
    buckets = build_bucket_priors(archive)
    b = buckets[(3, 1)]
    # should be based only on player 1001
    assert abs(b['xg_per90'] - 0.4) < 1e-6
    assert abs(b['xa_per90'] - 0.2) < 1e-6


# ── prior_for ─────────────────────────────────────────────────────────────────

def test_prior_for_code_hit_returns_full_dict():
    """Code match returns the full prior dict including start fields."""
    lookup = {
        1001: {'xg_per90': 0.2, 'xa_per90': 0.1, 'total_minutes': 540,
               'start_rate': 1.0, 'mins_per_start': 90.0},
    }
    buckets = {}
    result = prior_for(1001, 3, 70, lookup, buckets)
    assert result is not None
    assert result['xg_per90'] == 0.2
    assert result['xa_per90'] == 0.1
    assert result['start_rate'] == 1.0
    assert result['mins_per_start'] == 90.0


def test_prior_for_bucket_fallback_returns_per90_only():
    """No code match → bucket match returns per-90 dict (no start fields)."""
    lookup = {}
    buckets = {(3, 1): {'xg_per90': 0.3, 'xa_per90': 0.15}}
    result = prior_for(9999, 3, 70, lookup, buckets)  # code=9999 not in lookup
    assert result is not None
    assert result['xg_per90'] == 0.3
    assert result['xa_per90'] == 0.15
    assert 'start_rate' not in result


def test_prior_for_returns_none_when_no_match():
    """No code and no bucket → returns None."""
    result = prior_for(9999, 3, 70, {}, {})
    assert result is None


def test_prior_for_code_takes_precedence_over_bucket():
    """When both code and bucket exist, code match is used."""
    lookup = {1001: {'xg_per90': 0.5, 'xa_per90': 0.2, 'total_minutes': 540,
                     'start_rate': 0.9, 'mins_per_start': 85.0}}
    buckets = {(3, 1): {'xg_per90': 0.1, 'xa_per90': 0.05}}
    result = prior_for(1001, 3, 70, lookup, buckets)
    assert result['xg_per90'] == 0.5
