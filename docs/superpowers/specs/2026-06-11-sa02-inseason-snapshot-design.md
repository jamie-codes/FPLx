# SA-02: In-Season Archive Accumulation

**Feature ID:** SA-02
**Date:** 2026-06-11
**Status:** Approved (user chose recommendation: CI commits snapshots to the repo)

---

## Goal

During the 2026/27 season, every pipeline run that sees a newly finished gameweek persists a complete SA-01-format season snapshot to `pipeline/data/season_<label>/` and CI commits it to the repo. Because element-summary history is cumulative, one snapshot directory always contains the complete season to date — per-GW minutes, xG, BPS, DefCon, ownership (`selected`), transfers, and price (`value`) included. Nothing is ever lost again, and the honest tuner/lab gain an ever-growing dataset.

## Why this storage choice

Git, not Blob: SA-01 measured the full-season payload at ~5MB (gzipped element summaries: 1.5MB). ~38 snapshot commits per season of a few MB each is trivial for the repo, free, versioned (per-GW git history = time series of snapshots), and survives Blob quota/retention concerns. The pipeline already runs in GitHub Actions with repo checkout.

## Design

### `pipeline/capture_season.py` (extend — archival concerns stay in one module)

1. **`write_archive(out_dir, bootstrap, fixtures, understat, summaries) -> dict`** — extracted from `capture_season()`'s write phase verbatim (atomic tmp+rename writes, manifest last, same five files, manifest returned). `capture_season()` refactors to call it; behaviour and tests unchanged. `manifest['season']` comes from `season_label(bootstrap)` (below) instead of the hardcoded constant — for the 2025/26 archive this yields the same '2025-26'.

2. **`season_label(bootstrap) -> str | None`** — derive from the first event's `deadline_time` year: August-anchored `f"{Y}-{str(Y+1)[-2:]}"` (e.g. '2026-27'). Returns None when events are missing/malformed (caller skips snapshot).

3. **`snapshot_season(bootstrap, fixtures, understat, summaries) -> bool`** — the in-season hook:
   - `label = season_label(bootstrap)`; None → log to stderr, return False
   - `finished_now = count of finished events`; 0 → return False (pre-season/off-season no-op)
   - Snapshot dir: `<module_dir>/data/season_<label with - replaced by _>/` (module-anchored absolute path — run.py executes from the repo root in CI, so relative paths are wrong)
   - Idempotency gate: if `manifest.json` exists and `manifest['finished_gws'] >= finished_now` → return False
   - Else `write_archive(...)`, print one summary line, return True
   - **No success-rate guard** (unlike SA-01): the caller passes the summaries dict the pipeline already fetched and validated for its own use; an in-season snapshot that is one player short self-heals on the next run because the gate compares finished GWs, not completeness. (Manifest still records `players_fetched`/`success_rate` for observability.)

4. **Module-anchored default paths**: `DEFAULT_OUT_DIR` and `load_season_archive`'s `base_dir` default become `<module_dir>/data/season_2025_26` (absolute) — strictly more robust for callers with arbitrary CWD; existing tests pass explicit dirs and are unaffected.

### `pipeline/run.py`

After `summaries` is fully built (post the element-summary fetch loop), add a non-fatal call mirroring the `archive_season` pattern:

```python
try:
    from capture_season import snapshot_season
    snapshot_season(bootstrap, fixtures, understat, summaries)
except Exception as exc:
    print(f"[pipeline] season snapshot failed (non-fatal): {exc}", file=sys.stderr)
```

(`understat` = whatever dict run.py already fetched; empty fallback dict is fine.)

### `.github/workflows/pipeline.yml`

- Job-level `permissions: contents: write`
- New step after "Run pipeline":

```yaml
      - name: Commit season snapshot
        if: success()
        run: |
          if [ -n "$(git status --porcelain pipeline/data/)" ]; then
            git config user.name "github-actions[bot]"
            git config user.email "github-actions[bot]@users.noreply.github.com"
            git add pipeline/data/
            git commit -m "data(sa-02): season snapshot $(date -u +%F)"
            git pull --rebase origin main
            git push
          else
            echo "No snapshot changes."
          fi
```

Notes: the existing workflow-level `concurrency: group: pipeline` serialises runs, so push races are effectively excluded; `git pull --rebase` is belt-and-braces. When the pipeline step is skipped by the deadline gate, the working tree has no changes and the step no-ops.

## Testing

`pipeline/tests/test_capture_season.py` additions (all offline):

| Test | Assertion |
|---|---|
| `test_season_label_derivation` | first event deadline `2026-08-15T17:30:00Z` → `'2026-27'`; missing events → None |
| `test_snapshot_skips_preseason` | 0 finished events → False, nothing written |
| `test_snapshot_writes_first_finished_gw` | 1 finished GW, no prior manifest → True, all 5 files written, manifest `finished_gws == 1` |
| `test_snapshot_idempotent_same_gw` | second call with same finished count → False, manifest mtime/content unchanged |
| `test_snapshot_advances_on_new_gw` | finished count 2 > manifest 1 → True, manifest updated |
| `test_write_archive_refactor_round_trip` | `capture_season()` still produces a `load_season_archive`-loadable archive (existing tests effectively cover; keep one explicit round-trip through `write_archive`) |

`snapshot_season` tests use a `tmp_path` snapshot dir via monkeypatching the module's snapshot-dir resolver (make the dir resolution a small function, e.g. `_snapshot_dir(label)`, so tests can patch it).

Workflow YAML: not locally testable — keep the step minimal; verify by inspection in review, and observe the first scheduled run after the season starts.

## Out of scope

- Backfilling 2025/26 (already archived via SA-01)
- Blob copies of snapshots
- Multi-season lab support in BT-02 (future, once two seasons exist)
- refresh_gate changes (snapshot rides existing run cadence)
