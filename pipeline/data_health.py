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


def _check_sp_unmatched(count: int) -> dict:
    """Phase 84 D-04: ok if count <= 5, warn if 5 < count <= 20, error if > 20.

    Mirrors _check_missing_delta() thresholds exactly. The 43-known-null
    Understat-ID population means this check will typically be warn/error
    until the ID map is extended -- that is the desired visibility (per CONTEXT.md
    decision text), not a bug.
    """
    if count <= 5:
        status = 'ok'
    elif count <= 20:
        status = 'warn'
    else:
        status = 'error'
    return {'id': 'sp_unmatched_ids', 'status': status, 'value': count, 'threshold': '<= 5'}


def _append_history(prior_history: list, overall_status: str, generated_at: str) -> list:
    """Append new status entry; cap FIFO at 7 items.

    Args:
        prior_history: Existing history list (may be empty on first run).
        overall_status: Normalised status — must be 'ok', 'warning', or 'error'.
                        Caller responsible for mapping 'warn' -> 'warning'.
        generated_at:  ISO-8601 UTC timestamp string (reuse result['generated_at']).

    Returns:
        New list capped at 7 items, chronological order (oldest first).
    """
    entry = {'timestamp': generated_at, 'overall_status': overall_status}
    return (prior_history + [entry])[-7:]


def _compute_overall_status(sanity_checks: list) -> str:
    """Derive normalised overall status for HistoryEntry from sanity checks.

    Maps internal 'warn' -> 'warning' to match the HistoryEntry enum
    ('ok' | 'warning' | 'error') exposed in src/lib/types.ts.
    Precedence: 'error' > 'warn' > 'ok'.
    """
    statuses = {c['status'] for c in sanity_checks}
    if 'error' in statuses:
        return 'error'
    if 'warn' in statuses:
        return 'warning'
    return 'ok'


def compute_data_health(
    merged: list,
    timestamps: dict,
    cache_dir: str,
    pipeline_stale: bool = False,
    sp_unmatched_count: int | None = None,
) -> dict:
    """Compute data_health.json artifact and write via save().

    Args:
        merged: Full merged player list (len(merged) is denominator for all percentage calcs).
        timestamps: Dict of artifact name -> ISO UTC write-time string (from run.py accumulator).
        cache_dir: Path to the local cache directory (used to read prior data_health.json for delta).
        pipeline_stale: Whether the pipeline is stale (passed from run.py's last_updated['stale']).
        sp_unmatched_count: Phase 84 D-04 -- count of unmatched Understat IDs from
            run_sp_quality(). When None (default, including the failure case per D-05),
            no sp_unmatched_ids entry is added to sanity_checks. When an int, a 5th
            sanity_check entry is appended with thresholds ok 0-5 / warn 6-20 / error > 20.

    Returns:
        dict: The data_health result (also written to cache via save()).
    """
    # D-15/D-16: read prior data_health.json BEFORE overwriting to get prev_player_count.
    # Phase 92 DH-04: also extract prior history for FIFO-cap rolling-7 history field.
    prior_path = os.path.join(cache_dir, 'data_health.json')
    prev_count = None  # None signals first-run (D-16)
    prior_history: list = []  # empty on first run / corrupt prior file
    try:
        with open(prior_path, 'r', encoding='utf-8') as f:
            prev = json.load(f)
        prev_count = prev.get('total_player_count')
        prior_history = prev.get('history', [])
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        prev_count = None
        prior_history = []

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
    # Phase 84 D-04: append sp_unmatched_ids check only when caller passed an int.
    # When None (failure case from run_sp_quality), entry is omitted (D-05 / Pitfall 6).
    if sp_unmatched_count is not None:
        sanity_checks.append(_check_sp_unmatched(sp_unmatched_count))

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

    # Phase 92 DH-04: append rolling 7-entry status history (FIFO cap-7).
    # _compute_overall_status normalises pipeline 'warn' -> HistoryEntry 'warning'.
    result['history'] = _append_history(
        prior_history,
        _compute_overall_status(sanity_checks),
        result['generated_at'],
    )

    # Local import keeps module testable without USE_BLOB env var set.
    from upload import save  # noqa: PLC0415
    save('data_health.json', result)
    return result
