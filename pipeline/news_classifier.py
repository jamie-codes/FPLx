"""
MIN-02: Availability classifier for FPL players.

Priority order:
  1. FPL status codes ('i', 'u', 's') → out immediately.
  2. FPL chance_of_playing_next_round (numeric) → fit / doubt / out.
  3. Keyword scan of FPL news text (fallback when chance is null).

Pure functions, no side effects, no API calls.
"""

_OUT_KEYWORDS = ['ruled out', 'unavailable', 'will miss', 'withdrawn']
_DOUBT_KEYWORDS = ['doubt', '50/50', 'fitness test', 'assessed', 'knock', 'slight concern']
_FIT_KEYWORDS = ['fit', 'available', 'returned to training', 'fully fit']


def classify_availability(
    status: str,
    chance: int | None,
    news_text: str = '',
) -> dict:
    """Classify a player's availability risk.

    Args:
        status:    FPL status code ('a', 'd', 'i', 's', 'u', 'n').
        chance:    FPL chance_of_playing_next_round (0–100) or None.
        news_text: FPL news text from bootstrap element['news'].

    Returns dict with keys:
        availability_risk:   'out' | 'doubt' | 'fit' | 'unknown'
        availability_factor: float  (0.0, 0.5, or 1.0)
    """
    # Priority 1: status codes that definitively mean unavailable.
    if status in ('i', 'u', 's'):
        return {'availability_risk': 'out', 'availability_factor': 0.0}

    # Priority 2: FPL chance_of_playing (most authoritative signal).
    if chance is not None:
        if chance == 0:
            return {'availability_risk': 'out', 'availability_factor': 0.0}
        if chance >= 75:
            return {'availability_risk': 'fit', 'availability_factor': 1.0}
        if chance >= 25:
            return {'availability_risk': 'doubt', 'availability_factor': 0.5}
        # chance > 0 but < 25 — very unlikely to play
        return {'availability_risk': 'out', 'availability_factor': 0.0}

    # Priority 3: keyword scan of news text (first match wins).
    lower = (news_text or '').lower()
    for kw in _OUT_KEYWORDS:
        if kw in lower:
            return {'availability_risk': 'out', 'availability_factor': 0.0}
    for kw in _DOUBT_KEYWORDS:
        if kw in lower:
            return {'availability_risk': 'doubt', 'availability_factor': 0.5}
    for kw in _FIT_KEYWORDS:
        if kw in lower:
            return {'availability_risk': 'fit', 'availability_factor': 1.0}

    return {'availability_risk': 'unknown', 'availability_factor': 1.0}
