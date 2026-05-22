"""Price baseline pipeline step — Phase 133 PRST-01.

Captures per-player now_cost from bootstrap into price_baseline.json on Vercel Blob
exactly once (idempotent write-once). Mirrors the archive_season.py pattern.

Public API:
  capture_price_baseline(bootstrap: dict) -> None
      Reads bootstrap elements, builds a { str(id): now_cost } mapping, and writes
      to Vercel Blob via upload.py save(). Guarded by a _blob_exists idempotency
      check — subsequent runs skip the write entirely. Non-fatal: caller (run.py)
      wraps in try/except.

Helpers:
  _blob_exists(pathname: str) -> bool
"""

import sys
from upload import save

BASELINE_KEY = 'price_baseline.json'


def _blob_exists(pathname: str) -> bool:
    """Return True if pathname exists in Vercel Blob.

    Wraps vercel_blob.list() lazily so unit tests can monkeypatch this function
    without importing vercel_blob at module load time.

    Returns False on any exception (treat as "does not exist" — proceed to write;
    the idempotency check is the guard against overwriting existing data).
    """
    try:
        import vercel_blob
        result = vercel_blob.list({'prefix': pathname, 'limit': 1})
        return len(result.get('blobs', [])) > 0
    except Exception as exc:
        print(
            f"[price_baseline] _blob_exists check failed ({exc}); assuming not present.",
            file=sys.stderr,
        )
        return False


def capture_price_baseline(bootstrap: dict) -> None:
    """Capture per-player now_cost from bootstrap to Vercel Blob as price_baseline.json.

    Execution ordering (mirrors archive_season.py):
    1. Idempotency check: return immediately if price_baseline.json already exists.
    2. Extract elements from bootstrap; skip if empty.
    3. Build { str(id): now_cost } mapping (D-02: now_cost only, string keys for JSON safety).
    4. Write via save() and log success.
    """
    # Step 1: Idempotency check — MUST be first statement (D-01)
    if _blob_exists(BASELINE_KEY):
        print("[price_baseline] already exists — skipping.")
        return

    # Step 2: Extract elements
    elements = bootstrap.get('elements', [])
    if not elements:
        print("[price_baseline] no elements in bootstrap — skipping.", file=sys.stderr)
        return

    # Step 3: Build baseline dict — string keys are JSON-roundtrip safe (D-02)
    baseline = {
        str(el['id']): el['now_cost']
        for el in elements
        if 'now_cost' in el
    }

    # Step 4: Write to Blob via save()
    save(BASELINE_KEY, baseline)
    print(f"Price baseline written: {len(baseline)} players.")
