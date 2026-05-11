"""Phase 96 BACK-01 — per-GW captain snapshot side-write.

Side-write contract (D-09):
    when USE_BLOB=true, upload captain_picks dict to Vercel Blob as
    'captain_picks_gw{current_gw}.json' so each GW's recommendation is durably
    snapshotted at decision time. This is ADDITIVE to the existing
    captain_picks.json write — it does NOT replace it.

Sources of truth:
  .planning/phases/96-captain-decision-backtester/96-CONTEXT.md §D-09
  .planning/phases/96-captain-decision-backtester/096-PATTERNS.md §pipeline/run.py

Mirrors the predictions snapshot side-write at pipeline/run.py lines 339-342.
"""

import os


def write_captain_snapshot(captain_picks: dict, current_gw: int) -> None:
    """Upload captain_picks dict to Vercel Blob as captain_picks_gw{N}.json.

    No-op when USE_BLOB is unset or not 'true'. Re-running for the same GW
    overwrites the existing Blob object (upload_json passes allowOverwrite=True
    via pipeline/upload.py).

    Args:
        captain_picks: the dict produced by merge._compute_captain_picks().
            Same schema as the existing pipeline/cache/captain_picks.json file.
        current_gw: gameweek number (finished_gws + 1) — embedded in the filename.
    """
    if os.getenv('USE_BLOB', '').lower() != 'true':
        return
    from upload import upload_json
    upload_json(f'captain_picks_gw{current_gw}.json', captain_picks)
    print(f"Captain snapshot uploaded to Blob: captain_picks_gw{current_gw}.json")
