"""Pipeline deadline gate - standalone utility (Phase 89, REFRESH-01).

Reads events[].deadline_time from the FPL bootstrap. Writes run=true to
$GITHUB_OUTPUT when now is within PIPELINE_DEADLINE_WINDOW_MINUTES of the
nearest future deadline; otherwise writes run=false. Always exits 0.

Per CONTEXT.md D-07 this module MUST NOT import from pipeline/run.py - it is
a thin standalone deadline-math utility so a syntax error in run.py cannot
break gating. Bootstrap fetch reuses fpl_client.get_bootstrap_static() per
D-07 (no duplicated HTTP logic).
"""

import os
from datetime import datetime, timedelta, timezone

# Bare import - conftest.py / run.py sys.path pattern (project convention).
from fpl_client import get_bootstrap_static


def _write_output(run: bool) -> None:
    """Write run=true/false to $GITHUB_OUTPUT (no-op outside GitHub Actions).

    Pitfall 3: GITHUB_OUTPUT is None in local/pytest runs - guard the open().
    """
    output_file = os.environ.get('GITHUB_OUTPUT')
    if output_file:
        with open(output_file, 'a', encoding='utf-8') as f:
            f.write(f'run={"true" if run else "false"}\n')


def check_deadline_window(
    events: list,
    now: datetime | None = None,
    window_minutes: int | None = None,
) -> bool:
    """Return True iff `now` is within `window_minutes` of the nearest future deadline.

    Args:
        events: List of event dicts each containing a 'deadline_time' ISO string.
        now: UTC-aware datetime to compare against. Defaults to datetime.now(timezone.utc).
        window_minutes: Window half-width in minutes. Defaults to env var
            PIPELINE_DEADLINE_WINDOW_MINUTES or 90.

    Returns:
        False when:
            - events is empty
            - no event has a future deadline (end of season)
            - the nearest future deadline is more than window_minutes away
            - all deadline_time strings fail to parse
        True when the nearest future deadline is within [0, window_minutes] from now.
    """
    if now is None:
        now = datetime.now(timezone.utc)
    if window_minutes is None:
        try:
            window_minutes = int(os.getenv('PIPELINE_DEADLINE_WINDOW_MINUTES', '90'))
        except ValueError:
            window_minutes = 90

    window = timedelta(minutes=window_minutes)
    future: list[datetime] = []
    for event in events:
        raw = event.get('deadline_time', '')
        if not raw:
            continue
        try:
            dt = datetime.fromisoformat(raw)
            # Pitfall 1: defensive tzinfo guard for naive ISO strings.
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
        except (ValueError, AttributeError):
            continue
        if dt > now:
            future.append(dt)

    if not future:
        return False  # cold-bootstrap / end-of-season / all past

    nearest = min(future)
    delta = nearest - now
    return timedelta(0) <= delta <= window


def main() -> None:
    """Module entry point. Always exits 0 (Pitfall 2)."""
    try:
        bootstrap = get_bootstrap_static()
        events = bootstrap.get('events') or []
        result = check_deadline_window(events)
    except Exception:
        # D-07: any failure of the bootstrap fetch -> skip (run=false), never proceed.
        _write_output(False)
        return

    _write_output(result)


if __name__ == '__main__':
    main()
