"""Phase 113 BACK-02 — per-GW slim player snapshot side-write.

Side-write contract (D-02):
    when USE_BLOB=true, upload a slim projection of merged_players to Vercel Blob as
    'merged_players_slim_gw{current_gw}.json' so each GW's player pool is durably
    snapshotted at decision time. This is ADDITIVE to the existing
    merged_players.json write — it does NOT replace it.

    The slim projection contains only the nine SLIM_FIELDS needed by suggestTransfers()
    post-hoc in /api/decision-history. All other merged_player fields are dropped to
    keep the per-GW snapshot small (~50-75 KB vs ~600 KB for the full merged list).

Sources of truth:
  .planning/phases/113-transfer-regret-backtester-v1-20/113-CONTEXT.md §D-02
  .planning/phases/113-transfer-regret-backtester-v1-20/113-PATTERNS.md §pipeline/transfer_snapshots.py

Mirrors pipeline/captain_snapshots.py — the canonical analog from Phase 96 BACK-01.
"""

import os

SLIM_FIELDS = (
    'id', 'element_type', 'web_name', 'team', 'now_cost',
    'selected_by_percent', 'xPts_1gw', 'xPts_3gw', 'xPts_5gw',
)


def write_transfer_slim_snapshot(merged: list, current_gw: int) -> None:
    """Upload slim player projection to Vercel Blob as merged_players_slim_gw{N}.json.

    No-op when USE_BLOB is unset or not 'true'. Re-running for the same GW
    overwrites the existing Blob object (upload_json passes allowOverwrite=True
    via pipeline/upload.py).

    Args:
        merged: the full merged-players list produced by merge.merge_players().
            Only the nine SLIM_FIELDS are included in the uploaded snapshot.
        current_gw: gameweek number (finished_gws + 1) — embedded in the filename.
    """
    if os.getenv('USE_BLOB', '').lower() != 'true':
        return
    from upload import upload_json
    slim = [{k: p[k] for k in SLIM_FIELDS if k in p} for p in merged]
    upload_json(f'merged_players_slim_gw{current_gw}.json', slim)
    print(f"Transfer slim snapshot uploaded: merged_players_slim_gw{current_gw}.json")
