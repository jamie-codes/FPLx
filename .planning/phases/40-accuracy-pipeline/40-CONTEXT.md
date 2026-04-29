# Phase 40: Accuracy Pipeline - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Pipeline produces `accuracy_backtest.json` — a pre-aggregated backtest file comparing both projection models (`proj_pts_1gw` and `xPts_1gw`) against actual FPL points over the last 5 completed gameweeks. No UI in this phase (that's Phase 41). Phase 40 also introduces prediction snapshotting to each pipeline run so the historical record accumulates automatically going forward.

</domain>

<decisions>
## Implementation Decisions

### Historical Prediction Source

- **D-01:** Use **both** approaches: (1) **Historical reconstruction** using element-summary `history[]` data for immediate results — the last 5 completed GWs are reconstructed now; (2) **Prediction snapshotting** — each future pipeline run saves a `predictions_snapshot.json` with per-player `proj_pts_1gw` and `xPts_1gw` for the current GW, building a rolling historical record going forward.
- **D-02:** For historical xPts reconstruction, use the `expected_goals` and `expected_assists` per-GW fields from element-summary `history[]` as the xG/xA inputs to the xPts formula. Use `minutes` from the same history entry as the actual minutes played for that GW.
- **D-03:** For historical fixture difficulty, use the FPL standard `difficulty` field (1–5 scale) from `fpl_fixtures.json` for the fixture that player played in that GW. Do **not** use the FDR++ attacking/defensive split (not stored historically). Convert the 1–5 scale to a 0–1 difficulty score using the same normalisation as the current pipeline.
- **D-04:** For historical `start_prob`, use a binary proxy: `start_prob = 1.0` if the player played ≥45 minutes in that GW, `0.0` otherwise. We cannot retroactively know the pre-GW start probability.

### proj_pts Historical Reconstruction

- **D-05:** Include `proj_pts_1gw` in the backtest. Reconstruct it for each past GW N by computing rolling PPG from the **5 history entries immediately before GW N** (i.e., GWs N-5 to N-1). Apply the FPL standard difficulty modifier for that GW's fixture. This mirrors how `_proj_pts_ngw()` works with form-based inputs.
- **D-06:** For historical `proj_pts`, use `total_points / minutes * 90` per history entry to approximate per-90 scoring rate (as a proxy for `form_pts_per90`). Average over the prior 5 GW window to get historical PPG.

### Output File Structure

- **D-07:** Output file is `pipeline/cache/accuracy_backtest.json` (and Vercel Blob in production). Structure is **pre-aggregated**: the pipeline writes both a per-GW summary and per-player detail so Phase 41 is pure UI with no computation.
- **D-08:** JSON structure:
  ```json
  {
    "generated_at": "ISO timestamp",
    "gws_covered": [32, 31, 30, 29, 28],
    "summary": {
      "xpts_hit_rate": 0.42,
      "proj_pts_hit_rate": 0.35,
      "gws": [
        {
          "gw": 32,
          "haulter_count": 8,
          "xpts_flagged": 3,
          "proj_pts_flagged": 2,
          "xpts_hit_rate": 0.375,
          "proj_pts_hit_rate": 0.25
        }
      ]
    },
    "haulters": [
      {
        "gw": 32,
        "player_id": 123,
        "player_name": "Salah",
        "actual_pts": 18,
        "xpts_predicted": 8.2,
        "xpts_rank": 2,
        "xpts_flagged": true,
        "proj_pts_predicted": 6.1,
        "proj_pts_rank": 4,
        "proj_pts_flagged": true
      }
    ],
    "players": [
      {
        "player_id": 123,
        "player_name": "Salah",
        "team": "LIV",
        "gws": [
          {
            "gw": 32,
            "actual_pts": 18,
            "xpts_predicted": 8.2,
            "xpts_delta": -9.8,
            "proj_pts_predicted": 6.1,
            "proj_pts_delta": -11.9
          }
        ]
      }
    ]
  }
  ```
- **D-09:** **Haulter threshold**: 10+ actual points (per ACC-01 / ROADMAP requirement).
- **D-10:** **"Ranked highly" threshold**: Top 10 predicted players for that GW (by `xpts_predicted` or `proj_pts_predicted`). A haulter is "flagged" if they were in the top 10 predictions before that GW. Hit rate = flagged haulters ÷ total haulters that GW.

### Prediction Snapshotting (Going Forward)

- **D-11:** Each pipeline run writes `predictions_snapshot.json` with the current GW number and per-player `proj_pts_1gw` and `xPts_1gw`. The backtest computation in future runs will use these snapshots when available (preferred over reconstruction). When 5+ snapshots exist, the historical reconstruction path is no longer needed.
- **D-12:** Snapshot format: `{ "gw": N, "run_at": "ISO", "players": [{ "id": ..., "proj_pts_1gw": ..., "xPts_1gw": ... }] }`. Stored at `pipeline/cache/predictions_snapshot.json` (overwrites each run — only the most recent is kept locally; Blob stores one per GW via named prefix).

### Claude's Discretion

- Whether to run the backtest computation as a standalone function in `merge.py` or a separate `accuracy.py` module.
- Minimum minutes threshold for including a player in the backtest (e.g., skip players who played 0 minutes that GW).
- Whether `delta` is `actual - predicted` (positive = overperformed) or `predicted - actual` (positive = overpredicted). Use `actual - predicted` convention so positive = surprise haul.
- Handling of DGWs (player plays twice in one GW) — use summed `total_points` and summed `expected_goals`/`expected_assists` for that GW.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pipeline Architecture
- `pipeline/run.py` — Main pipeline orchestration. The backtest computation and snapshot write should follow the existing pattern (lines ~145–200). Summaries dict is already populated here.
- `pipeline/merge.py` — xPts formula (`_xpts_1gw()`, `_xpts_ngw()`, `_proj_pts_ngw()`, `_cs_prob()`). Backtest reconstruction re-uses these functions with historical inputs.
- `pipeline/fpl_client.py:get_element_summary()` — Returns `history[]` with per-GW fields including `expected_goals`, `expected_assists`, `minutes`, `total_points`, `round`.

### Data Sources
- `pipeline/cache/fpl_fixtures.json` — Contains all fixtures including past ones with `difficulty` (1–5), `event` (GW number), `team_h`, `team_a`, `team_h_score`, `team_a_score`. Used to find historical fixture difficulty.
- `pipeline/cache/merged_players.json` — Current merged player data. `element_type` (position) and `team` needed for backtest context.

### Requirements
- `.planning/REQUIREMENTS.md` §Projection Accuracy — ACC-01 (this phase), ACC-02 through ACC-06 (Phase 41 consumes this output)

### Phase 41 (consumer of this phase's output)
- `.planning/ROADMAP.md` §Phase 41 — Documents exactly what the UI needs from `accuracy_backtest.json`. Pre-aggregation decisions in D-08 were made to satisfy ACC-02, ACC-03, ACC-04.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `pipeline/merge.py:_xpts_1gw(xg, xa, element_type, defensive_difficulty, start_prob, xmins)` — Core xPts formula. Historical reconstruction calls this with reconstructed inputs per past GW.
- `pipeline/merge.py:_proj_pts_ngw(ppg, start_prob, fixtures, n)` — proj_pts formula. Backtest calls a simplified version with rolling PPG from history.
- `pipeline/merge.py:_cs_prob(defensive_difficulty, xmins)` — CS probability — reused in historical xPts reconstruction.
- `pipeline/run.py` summaries dict — Already populated from `get_element_summary()` calls for all players. The backtest function receives this dict and iterates `history[]` entries.

### Established Patterns
- Pipeline cache files are written via `save(filename, data)` in `run.py`. The new `accuracy_backtest.json` and `predictions_snapshot.json` follow this exact pattern.
- Vercel Blob upload uses `upload.py`. New files need to be added to the upload list.
- The `finished_gws` variable (count of completed GWs from bootstrap events) is already computed in `run.py` and passed to downstream functions — the backtest should receive it to identify the last 5 finished GWs.
- `fpl_fixtures.json` maps `event` → GW number. Past fixtures have `event` set; use `team_h`/`team_a` + `event` to find which team a player played against in a given GW.

### Integration Points
- `run.py` around line 196: After DefCon stats computation, before `save()` calls — a natural place to add `backtest_data = compute_accuracy_backtest(summaries, finished_gws, bootstrap, fixtures)` then `save('accuracy_backtest.json', backtest_data)`.
- `run.py`: Add `save('predictions_snapshot.json', build_predictions_snapshot(merged, finished_gws))` after merged players are computed.

</code_context>

<specifics>
## Specific Ideas

- The snapshot format should name Blob objects with the GW number (e.g., `predictions_snapshot_gw32.json`) so multiple snapshots accumulate in Blob even though only one exists locally.
- The backtest reconstruction is explicitly a "best approximation" — the CONTEXT notes that D-03 uses FPL standard difficulty (not FDR++), D-04 uses a binary start_prob proxy, and D-06 uses a per-90 scoring rate proxy. Phase 41 UI should not present reconstruction results as exact model replay.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 40-accuracy-pipeline*
*Context gathered: 2026-04-29*
