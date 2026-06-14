"""COLD-01: Pre-season prior model.

Builds a code-keyed prior lookup and (element_type, price_band) bucket fallback
from the committed season archive. Used by merge.py and xmins.py to seed
projections before current-season data has accumulated.

SEED_MINUTES = 270  (≈3 full matches; lab-fit via exp08 — 270 beat 540/180/0
on the held-out early window).
"""


SEED_MINUTES = 270   # ≈3 full matches; lab-fit via exp08


def price_band(now_cost: int) -> int:
    """Map FPL now_cost to a coarse price band.

    0 = budget  (now_cost < 55)
    1 = mid     (55 <= now_cost <= 84)
    2 = premium (now_cost >= 85)
    """
    if now_cost >= 85:
        return 2
    if now_cost >= 55:
        return 1
    return 0


def build_prior_lookup(archive: dict) -> dict:
    """Build a code-keyed prior lookup from a season archive.

    archive = capture_season.load_season_archive() → {
        'bootstrap': {'elements': [{'id', 'code', 'element_type', 'now_cost'}, ...]},
        'summaries': {int player_id → {'history': [...]}},
        ...
    }

    For each archived player, sums expected_goals / expected_assists / minutes /
    starts over archive['summaries'][id]['history']. Keeps only players with
    total_minutes >= 500 (reuse suggest_squad's eligibility floor).

    Returns:
        {code (int): {
            'xg_per90': float,
            'xa_per90': float,
            'total_minutes': int,
            'start_rate': float,   # total_starts / n_history_rows
            'mins_per_start': float,  # total_minutes / total_starts (0 if no starts)
        }}
    """
    # Build id → code map from bootstrap elements
    id_to_info: dict = {}
    for el in archive.get('bootstrap', {}).get('elements', []):
        id_to_info[el['id']] = {
            'code': el['code'],
            'element_type': el.get('element_type', 3),
            'now_cost': el.get('now_cost', 0),
        }

    summaries = archive.get('summaries', {})
    lookup: dict = {}

    for pid, summary in summaries.items():
        if pid not in id_to_info:
            continue
        info = id_to_info[pid]
        history = summary.get('history', [])

        total_minutes = 0
        total_starts = 0
        total_xg = 0.0
        total_xa = 0.0
        n_rows = len(history)

        for row in history:
            total_minutes += int(row.get('minutes', 0))
            total_starts += int(row.get('starts', 0))
            total_xg += float(row.get('expected_goals', 0.0) or 0.0)
            total_xa += float(row.get('expected_assists', 0.0) or 0.0)

        if total_minutes < 500:
            continue

        xg_per90 = total_xg / total_minutes * 90 if total_minutes > 0 else 0.0
        xa_per90 = total_xa / total_minutes * 90 if total_minutes > 0 else 0.0
        start_rate = total_starts / n_rows if n_rows > 0 else 0.0
        mins_per_start = total_minutes / total_starts if total_starts > 0 else 0.0

        lookup[info['code']] = {
            'xg_per90': xg_per90,
            'xa_per90': xa_per90,
            'total_minutes': total_minutes,
            'start_rate': start_rate,
            'mins_per_start': mins_per_start,
        }

    return lookup


def build_bucket_priors(archive: dict) -> dict:
    """Build mean per-90 by (element_type, price_band) over eligible players.

    Uses the same ≥500-min filter as build_prior_lookup.
    price_band from archive bootstrap now_cost: 0=budget(<55), 1=mid(55-84), 2=premium(>=85).

    Returns:
        {(element_type, band): {'xg_per90': float, 'xa_per90': float}}
    """
    # Build id → (element_type, now_cost) from bootstrap elements
    id_to_info: dict = {}
    for el in archive.get('bootstrap', {}).get('elements', []):
        id_to_info[el['id']] = {
            'element_type': el.get('element_type', 3),
            'now_cost': el.get('now_cost', 0),
        }

    summaries = archive.get('summaries', {})

    # Accumulate sums per bucket
    bucket_xg: dict = {}
    bucket_xa: dict = {}
    bucket_count: dict = {}

    for pid, summary in summaries.items():
        if pid not in id_to_info:
            continue
        info = id_to_info[pid]
        history = summary.get('history', [])

        total_minutes = 0
        total_xg = 0.0
        total_xa = 0.0

        for row in history:
            total_minutes += int(row.get('minutes', 0))
            total_xg += float(row.get('expected_goals', 0.0) or 0.0)
            total_xa += float(row.get('expected_assists', 0.0) or 0.0)

        if total_minutes < 500:
            continue

        xg_per90 = total_xg / total_minutes * 90
        xa_per90 = total_xa / total_minutes * 90

        key = (info['element_type'], price_band(info['now_cost']))
        bucket_xg[key] = bucket_xg.get(key, 0.0) + xg_per90
        bucket_xa[key] = bucket_xa.get(key, 0.0) + xa_per90
        bucket_count[key] = bucket_count.get(key, 0) + 1

    buckets: dict = {}
    for key, count in bucket_count.items():
        buckets[key] = {
            'xg_per90': bucket_xg[key] / count,
            'xa_per90': bucket_xa[key] / count,
        }

    return buckets


def prior_for(code, element_type, now_cost, lookup: dict, buckets: dict):
    """Return a prior dict for this player.

    Precedence:
        1. code match in lookup → full dict {xg_per90, xa_per90, start_rate, mins_per_start}
        2. bucket match → {xg_per90, xa_per90} only (no start fields)
        3. None

    Args:
        code:         FPL player code (persistent across seasons).
        element_type: 1=GK, 2=DEF, 3=MID, 4=FWD.
        now_cost:     Current FPL price (tenths of £m).
        lookup:       Output of build_prior_lookup.
        buckets:      Output of build_bucket_priors.
    """
    if code in lookup:
        return lookup[code]
    band = price_band(now_cost)
    key = (element_type, band)
    if key in buckets:
        return buckets[key]
    return None
