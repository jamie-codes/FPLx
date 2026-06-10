# SA-01: Season Archive Capture

**Feature ID:** SA-01
**Date:** 2026-06-10
**Status:** Approved

---

## Goal

Permanently capture the complete 2025/26 FPL season dataset to local disk (committed to git) before the FPL API resets for the 2026/27 season (~early July 2026).

The FPL API currently serves all 38 finished gameweeks, including per-player per-GW element-summary history (41 fields per round: minutes, goals, assists, xG, xA, xGC, BPS, bonus, ICT/threat/creativity/influence, defensive_contribution, tackles, recoveries, CBI, ownership (`selected`), transfers, price (`value`), starts, was_home, opponent, team scores...). The pipeline currently fetches this live on every run and discards it — only 5 GWs of derived data (GW31–35) survive in `accuracy_backtest.json`. When the new season launches, this data is wiped from the API and lost forever.

This archive is the foundation for:
- **BT-02** — a leakage-free full-season backtest harness (~30+ evaluable GWs instead of 5)
- Model signal experiments (DefCon route, penalty-taker uplift, xGC-based CS modelling, xG source blending)
- What-if scenario training and next-season picks-list validation

## Why this design

- **One-shot archival, not a pipeline step.** Unlike `archive_season.py` (GW38-gated, Blob-only, 50% guard), this is a standalone script run manually once. It must be stricter (≥90% success guard + one retry pass) because there is no second chance after the API reset.
- **Committed to git, compressed.** The data is irreplaceable. Gitignored-local-only means one disk failure loses the season. Compressed total is ~12MB — acceptable for the repo. (Decision approved by user.)
- **Reuses existing fetch machinery.** `archive_season._fetch_all_summaries` already does concurrent, failure-tolerant element-summary fetching with 10 workers.

## Architecture

New standalone module **`pipeline/capture_season.py`**, runnable as `python capture_season.py` from `pipeline/`. No changes to `run.py` or the regular pipeline. No UI changes.

### Fetch (4 sources)

1. `get_bootstrap_static()` — final season state, 841 elements, 38 events, 20 teams
2. `get_fixtures()` — all 380 fixtures with final scores
3. Element summaries for **all** bootstrap elements via `archive_season._fetch_all_summaries(elements)` — then one retry pass: re-fetch the missing IDs the same way and merge results
4. `get_understat_players()` — Understat season totals (xG/xA/npxG/npxA/minutes)

### Guard

After the retry pass: if successful element summaries < 90% of total elements, print failure counts to stderr and **exit without writing anything**. There is no partial archive — it either captures the season or it doesn't.

### Write — `pipeline/data/season_2025_26/`

| File | Contents | Format |
|---|---|---|
| `bootstrap_final.json` | Full bootstrap-static snapshot | plain JSON |
| `fixtures_final.json` | All 380 fixtures with results | plain JSON |
| `understat_final.json` | Understat season data | plain JSON |
| `element_summaries.json.gz` | `{player_id: element_summary}` for all fetched players | gzip JSON (~50MB → ~6MB) |
| `manifest.json` | `{season: "2025-26", captured_at: ISO-8601 UTC, players_total, players_fetched, success_rate, finished_gws, fixtures_count}` | plain JSON |

`pipeline/data/` is a new directory and is **NOT** added to `.gitignore` — the archive is committed.

Writes are atomic-ish: write each file to a `.tmp` path, then rename. The manifest is written **last** — its presence signals a complete archive.

### Read interface

```python
def load_season_archive(base_dir: str = 'data/season_2025_26') -> dict:
    """Load the season archive. Returns dict with keys:
    'bootstrap', 'fixtures', 'understat', 'summaries' (player_id int -> summary),
    'manifest'. Raises FileNotFoundError if manifest.json is absent (incomplete
    or missing archive)."""
```

Lives in `capture_season.py`. JSON object keys are strings — `load_season_archive` converts `summaries` keys back to `int` so consumers see `{player_id: int → summary}` exactly as `run.py`'s live `summaries` dict does. This makes the archive a drop-in replacement for the live fetch in backtest contexts.

## Testing

Unit tests in `pipeline/tests/test_capture_season.py` (no network — all fetches mocked):

| Test | Assertion |
|---|---|
| `test_capture_writes_all_five_files` | With mocked fetches at 100% success, all 5 files exist in tmp dir; manifest counts correct |
| `test_capture_guard_blocks_below_90pct` | Mocked 80% success after retry → nothing written, non-zero message to stderr |
| `test_retry_pass_fills_gaps` | First pass misses 3 players, retry succeeds → 100% in manifest |
| `test_load_round_trip` | `load_season_archive` returns summaries with int keys identical to what was saved |
| `test_load_raises_without_manifest` | Missing manifest → FileNotFoundError |

Manual verification after the real run: spot-check one known player's GW history (e.g. Haaland, 239 pts) against the FPL website; confirm `finished_gws == 38`.

## Out of scope

- No changes to `run.py`, `archive_season.py` behaviour, or the web app
- No prior-season data (only 2025/26 is available)
- BT-02 (the backtest harness that consumes this archive) — separate spec
- Per-GW ownership *history* beyond what element-summary `selected` provides
