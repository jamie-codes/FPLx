"""Pipeline module: computes pipeline/cache/data_health.json artifact (DH-01).

Sanity checks: player_count, missing_player_delta, understat_null_pct, pipeline_stale.
Raw stored metrics: understat_id_null_count, fpl_proxy_fallback_count, xg_per90_null_count.

Public:  compute_data_health(merged, timestamps, cache_dir, pipeline_stale=False) -> dict
Private: _sanitize_error(exc) -> str  (strips env-var tokens + absolute paths; truncates to 200)
"""

import json
import os
import re
from datetime import datetime, timezone


# D-19: absolute paths — Windows (C:\...) and POSIX (/home/...).
# Run path strip BEFORE env-var strip to avoid env-var pattern re-matching path components.
_PATH_PATTERN = re.compile(r'([A-Za-z]:[\\/][^\s]*|/[\w/.\-]+)')
# D-19: env-var tokens are uppercase identifiers >= 4 chars, e.g. BLOB_READ_WRITE_TOKEN
_ENV_VAR_PATTERN = re.compile(r'\b[A-Z][A-Z0-9_]{3,}\b')


def _sanitize_error(exc: Exception) -> str:
    """Strip absolute paths and env-var tokens from exception message; truncate to 200 chars."""
    msg = str(exc)
    msg = _PATH_PATTERN.sub('[PATH]', msg)
    msg = _ENV_VAR_PATTERN.sub('[REDACTED]', msg)
    return msg[:200]


def _check_player_count(total: int) -> dict:
    """D-02: ok if >= 700, warn if 550 <= value < 700, error if < 550."""
    if total >= 700:
        status = 'ok'
    elif total >= 550:
        status = 'warn'
    else:
        status = 'error'
    return {'id': 'player_count', 'status': status, 'value': total, 'threshold': '>= 700'}


def _check_missing_delta(value: int) -> dict:
    """D-03: ok if <= 5, warn if 5 < value <= 20, error if > 20."""
    if value <= 5:
        status = 'ok'
    elif value <= 20:
        status = 'warn'
    else:
        status = 'error'
    return {'id': 'missing_player_delta', 'status': status, 'value': value, 'threshold': '<= 5'}


def _check_understat_null_pct(pct: float) -> dict:
    """D-04: ok if < 15%, warn if 15% <= pct < 30%, error if >= 30%."""
    if pct < 15.0:
        status = 'ok'
    elif pct < 30.0:
        status = 'warn'
    else:
        status = 'error'
    return {'id': 'understat_null_pct', 'status': status, 'value': pct, 'threshold': '< 15%'}


def _check_pipeline_stale(stale: bool) -> dict:
    """D-05: binary check — error if stale, ok if not stale. No warn level."""
    return {
        'id': 'pipeline_stale',
        'status': 'error' if stale else 'ok',
        'value': bool(stale),
        'threshold': 'false',
    }


def compute_data_health(
    merged: list,
    timestamps: dict,
    cache_dir: str,
    pipeline_stale: bool = False,
) -> dict:
    """Compute data_health.json artifact and write via save().

    Args:
        merged: Full merged player list (len(merged) is denominator for all percentage calcs).
        timestamps: Dict of artifact name -> ISO UTC write-time string (from run.py accumulator).
        cache_dir: Path to the local cache directory (used to read prior data_health.json for delta).
        pipeline_stale: Whether the pipeline is stale (passed from run.py's last_updated['stale']).

    Returns:
        dict: The data_health result (also written to cache via save()).
    """
    # D-15/D-16: read prior data_health.json BEFORE overwriting to get prev_player_count.
    prior_path = os.path.join(cache_dir, 'data_health.json')
    prev_count = None  # None signals first-run (D-16)
    try:
        with open(prior_path, 'r', encoding='utf-8') as f:
            prev = json.load(f)
        prev_count = prev.get('total_player_count')
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        prev_count = None

    total = len(merged)

    # D-15 + Pitfall 3: absolute delta, NOT signed. First run (prev_count is None) -> delta = 0 (D-16).
    if prev_count is None:
        delta = 0
    else:
        delta = abs(total - int(prev_count))

    # D-06: raw null-xG counts — stored but NOT included as sanity checks.
    understat_null = sum(1 for p in merged if p.get('understat_id') is None)
    # Pitfall 2 (RESEARCH.md Open Question #2): fpl_proxy_fallback is the subset of understat_null
    # where xg_per90 was still populated (FPL expected_goals proxy used).
    fpl_proxy_fallback = sum(
        1 for p in merged
        if p.get('understat_id') is None and p.get('xg_per90') is not None
    )
    xg_per90_null = sum(1 for p in merged if p.get('xg_per90') is None)

    # Pitfall 5: denominator MUST be len(merged), NOT bootstrap element count.
    understat_pct = round(100.0 * understat_null / total, 2) if total > 0 else 0.0

    sanity_checks = [
        _check_player_count(total),
        _check_missing_delta(delta),
        _check_understat_null_pct(understat_pct),
        _check_pipeline_stale(pipeline_stale),
    ]

    result = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'timestamps': dict(timestamps),
        'total_player_count': total,
        'prev_player_count': prev_count,
        'missing_player_delta': delta,
        'understat_id_null_count': understat_null,
        'fpl_proxy_fallback_count': fpl_proxy_fallback,
        'xg_per90_null_count': xg_per90_null,
        'sanity_checks': sanity_checks,
    }

    # Local import keeps module testable without USE_BLOB env var set.
    from upload import save  # noqa: PLC0415
    save('data_health.json', result)
    return result
