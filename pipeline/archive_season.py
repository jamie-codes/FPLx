"""Season archive pipeline step — Phase 126 NSP-01.

Archives per-player element-summary history for all bootstrap players to Vercel Blob
as 'season_archive_gw38.json'. Runs behind a GW38 gate in run.py; idempotent.

Public API:
  archive_season(bootstrap: dict) -> None
      Fetches element summaries concurrently, applies a 50% partial-write guard,
      and writes the result via upload.py save(). Non-fatal: caller (run.py) wraps
      in try/except.

Helpers:
  _blob_exists(pathname: str) -> bool
  _fetch_one(player_id: int) -> tuple[int, dict | None]
  _fetch_all_summaries(elements: list) -> dict
"""

import sys
import concurrent.futures
from upload import save

MAX_WORKERS = 10
ARCHIVE_KEY = 'season_archive_gw38.json'


def _blob_exists(pathname: str) -> bool:
    """Return True if pathname exists in Vercel Blob.

    Wraps vercel_blob.list() lazily so unit tests can monkeypatch this function
    without importing vercel_blob at module load time.

    Returns False on any exception (treat as "does not exist" — proceed to fetch;
    the partial-write guard still protects against overwriting good data with bad).
    """
    try:
        import vercel_blob
        result = vercel_blob.list({'prefix': pathname, 'limit': 1})
        return len(result.get('blobs', [])) > 0
    except Exception as exc:
        print(f"[archive_season] _blob_exists check failed ({exc}); assuming not present.", file=sys.stderr)
        return False


def _fetch_one(player_id: int) -> tuple:
    """Fetch element-summary for one player. Returns (player_id, data_or_None).

    On any exception, logs to stderr and returns (player_id, None) so the
    caller can count failures without aborting the batch.
    """
    try:
        from fpl_client import get_element_summary
        return (player_id, get_element_summary(player_id))
    except Exception as exc:
        print(f"[archive_season] player {player_id} failed: {exc}", file=sys.stderr)
        return (player_id, None)


def _fetch_all_summaries(elements: list) -> dict:
    """Fetch element summaries concurrently for all elements.

    Uses ThreadPoolExecutor with MAX_WORKERS workers. Per-future exceptions are
    caught individually so that failures in _fetch_one (raised from future.result())
    are treated as player-level failures and do not abort the batch.

    Returns dict mapping player_id (int) -> element_summary_dict for successful fetches.
    """
    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(_fetch_one, el['id']): el['id'] for el in elements}
        for future in concurrent.futures.as_completed(futures):
            try:
                pid, data = future.result()
                if data is not None:
                    results[pid] = data
            except Exception as exc:
                player_id = futures[future]
                print(f"[archive_season] player {player_id} failed: {exc}", file=sys.stderr)
    return results


def archive_season(bootstrap: dict) -> None:
    """Archive per-player element-summary history to Vercel Blob.

    Execution ordering (Pitfall 2 — must match this sequence exactly):
    1. Idempotency check: return immediately if archive already exists in Blob.
    2. Extract elements from bootstrap.
    3. Fetch all summaries concurrently.
    4. Apply >= 50% partial-write guard; log to stderr and return if below.
    5. Write via save() and log success.
    """
    # Step 1: Idempotency check — MUST be first statement (Pitfall 2)
    if _blob_exists(ARCHIVE_KEY):
        print("[archive_season] already exists — skipping.")
        return

    # Step 2: Extract elements
    elements = bootstrap.get('elements', [])
    total = len(elements)
    if total == 0:
        print("[archive_season] no elements in bootstrap — skipping.", file=sys.stderr)
        return

    # Step 3: Concurrent fetch
    results = _fetch_all_summaries(elements)

    # Step 4: Partial-write guard (>= 50% success required)
    if len(results) < total * 0.5:
        print(
            f"[archive_season] < 50% players fetched ({len(results)}/{total}) — skipping Blob write.",
            file=sys.stderr,
        )
        return

    # Step 5: Write to Blob via save()
    save(ARCHIVE_KEY, results)
    print(f"Season archive written: {len(results)}/{total} players.")
