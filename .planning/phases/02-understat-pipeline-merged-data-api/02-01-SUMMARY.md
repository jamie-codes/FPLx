---
phase: 02-understat-pipeline-merged-data-api
plan: "01"
subsystem: pipeline
tags: [python, understat, soccerdata, merge, fdr, per-90, fixtures]
dependency_graph:
  requires: [pipeline/fpl_client.py, pipeline/player_id_map.json, pipeline/upload.py]
  provides: [pipeline/understat_client.py, pipeline/merge.py, pipeline/merged_players.json]
  affects: [pipeline/run.py]
tech_stack:
  added: [soccerdata==1.8.8]
  patterns: [24h file cache, rolling-window xGA FDR, percentile-based tier mapping]
key_files:
  created:
    - pipeline/understat_client.py
    - pipeline/merge.py
  modified:
    - pipeline/run.py
    - pipeline/requirements.txt
decisions:
  - "D-07: 24h file cache for Understat avoids slow re-fetches on every pipeline run"
  - "D-05: Percentile thirds (bottom/middle/top) map rolling-xGA to hard/medium/easy tiers"
  - "xGA proxy: FPL fixtures lack true xGA so goals conceded in last 6 games are used as proxy"
  - "difficulty_score direction: 0.0 = easiest (high xGA opponent), 1.0 = hardest (low xGA opponent)"
metrics:
  duration_minutes: 8
  completed_date: "2026-03-28"
  tasks_completed: 2
  files_changed: 4
---

# Phase 2 Plan 01: Understat Pipeline + Merge Module Summary

Python pipeline modules that fetch Understat xG/xA via soccerdata with 24h caching, merge with FPL bootstrap on `player_id_map.json`, compute per-90 form metrics, custom FDR from rolling goals conceded, next-5 fixture difficulty tiers (easy/medium/hard), and extend `run.py` to write `merged_players.json`.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Understat client + merge module with per-90, custom FDR, fixture difficulty | b6a367b | pipeline/understat_client.py, pipeline/merge.py, pipeline/requirements.txt |
| 2 | Extend pipeline/run.py to call Understat fetch and merge, write merged_players.json | f3d7456 | pipeline/run.py |

## What Was Built

### pipeline/understat_client.py
Single function `get_understat_players() -> dict` that:
- Checks `pipeline/cache/understat_current.json` — returns cached data if < 24h old (D-07)
- Otherwise calls soccerdata `Understat(leagues="ENG-Premier League", seasons="2425").read_player_season_stats()`
- Returns dict keyed by Understat player ID (string), each with `player`, `team`, `xG`, `xA`, `npxG`, `npxA`, `minutes`
- Writes cache with `_cached_at` ISO timestamp

### pipeline/merge.py
Function `merge_players(bootstrap, fixtures, understat, id_map) -> list[dict]` that:
1. Builds team lookup and determines current GW from bootstrap events
2. Computes rolling 6-game goals-conceded average per team (xGA proxy, D-02)
3. Computes percentile difficulty thresholds: bottom third = hard, top third = easy (D-05)
4. Normalises per-team xGA to `difficulty_score` float (0.0 easy, 1.0 hard)
5. Builds next-5 upcoming fixture lists per team with `opponent_team`, `is_home`, `event_id`, `difficulty_score`, `difficulty_tier` (D-03, D-04)
6. For each FPL element: joins Understat via `player_id_map.json` understat_id key; computes `xg_per90`, `xa_per90` (null for unmatched, NOT zero); computes `minutes_per90` (minutes/starts) and `form_pts_per90` (FPL form field)

### pipeline/run.py (extended)
After existing FPL fetch steps:
- Calls `get_understat_players()` (cached)
- Loads `player_id_map.json`
- Calls `merge_players(bootstrap, fixtures, understat, id_map)`
- Saves `merged_players.json` via `save()`
- Adds `merged_count` to `last_updated.json`

## Schema Fields Produced (per player)

All Phase 1 FPL fields plus:
- `team_short_name` — team abbreviation from bootstrap
- `understat_id` — null for unmatched players (43 promoted-team players)
- `xg_per90` — null for unmatched; season-level `(xG/minutes)*90`
- `xa_per90` — null for unmatched; season-level `(xA/minutes)*90`
- `minutes_per90` — `minutes/starts` (average minutes per start)
- `form_pts_per90` — FPL `form` field (already a recent-GW average)
- `fixtures` — array of next 5 upcoming fixtures, each with `opponent_team`, `is_home`, `event_id`, `difficulty_score`, `difficulty_tier`

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Notes on Implementation Choices

**soccerdata column detection (robustness):** The soccerdata library uses a multi-index DataFrame. `understat_client.py` probes several likely column names (`player_id`, `id`, `player`, `player_name`, `team`, `team_name`, etc.) to handle minor version variations. This is a defensive pattern, not a deviation.

**Difficulty score direction confirmed:** 0.0 = easiest fixture (opponent has high rolling goals-conceded = easy to attack against). 1.0 = hardest fixture (opponent has low rolling goals-conceded = hard to break down). This matches the plan spec.

## Known Stubs

None — all fields are wired. Understat xG/xA will be null for players without soccerdata match until `get_understat_players()` is called with real soccerdata data at pipeline run time. This is expected and correct (null = no data, per D-02 from Phase 1).

## Self-Check: PASSED

All files exist on disk and all task commits confirmed in git history:
- pipeline/understat_client.py — FOUND
- pipeline/merge.py — FOUND
- pipeline/requirements.txt — FOUND
- pipeline/run.py — FOUND
- Commit b6a367b — FOUND
- Commit f3d7456 — FOUND
