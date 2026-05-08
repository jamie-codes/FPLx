---
phase: 079-insight-card-redesign
plan: "01"
subsystem: pipeline
tags: [pipeline, python, insights, data-shape, tdd]
dependency_graph:
  requires: []
  provides:
    - pipeline/insights.py:_signal_label()
    - pipeline/insights.py:BENCHMARK_DEFAULTS
    - pipeline/insights.py:INSIGHT_TITLES
    - pipeline/insights.py:INSIGHT_ACTION_HINTS
    - pipeline/cache/insights.json (17-field shape)
    - pipeline/tests/test_insights.py
  affects:
    - pipeline/cache/insights.json
    - plans: [079-02 (types), 079-03 (UI rewrite), 079-04 (verification)]
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN cycle (pytest)
    - Per-insight metadata constants (BENCHMARK_DEFAULTS, INSIGHT_TITLES, INSIGHT_ACTION_HINTS)
    - _signal_label() category x confidence rule matrix (D-04)
key_files:
  created:
    - pipeline/tests/test_insights.py
  modified:
    - pipeline/insights.py
    - pipeline/cache/insights.json
decisions:
  - "_signal_label() rule precedence: player>=65 -> Hidden gem BEFORE generic >=70 -> Strong signal; attacking/player<45 -> Trap risk BEFORE defensive<45 -> Regression risk BEFORE generic <55 -> Weak signal"
  - "teams_by_id built once in _defensive_patterns for def_cs_rate_top6_vs_rest team_names population"
  - "gw_coverage uses em-dash (U+2013) GW1-{max_event} for fixture-based insights per D-14"
  - "player_template_trap_count absent from regenerated cache (0 qualifying traps currently) - correct per sample_n guard"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-08"
  tasks_completed: 3
  files_changed: 3
---

# Phase 079 Plan 01: Pipeline Extension for Insight Card Redesign Summary

Extended `pipeline/insights.py` to emit the Phase 79 17-field insight shape: 6 existing fields preserved + `_signal_label()` helper + `BENCHMARK_DEFAULTS`/`INSIGHT_TITLES`/`INSIGHT_ACTION_HINTS` constants + 11 new structured fields wired to all 12 `out.append()` sites. Created `pipeline/tests/test_insights.py` with 5 tests covering INS-01/INS-02/INS-06. Regenerated `pipeline/cache/insights.json` via `python pipeline/run.py` — all 117 pipeline tests pass.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | _signal_label helper + metadata constants + failing tests | a55fbd7 | pipeline/insights.py, pipeline/tests/test_insights.py |
| 2 (GREEN) | Wire 11 new fields to all 12 out.append() sites | 5d9ea3b | pipeline/insights.py |
| 3 | Regenerate insights.json via pipeline run | cd45c2e | pipeline/cache/insights.json |

## Insight IDs in Regenerated Cache and Signal Label Distribution

11 records in `pipeline/cache/insights.json` (GW35 data):

| ID | confidence_pct | signal_label | metric_value |
|----|----------------|--------------|--------------|
| att_home_goal_share | 55.2% | Watchlist | 55.2 |
| att_top_xg_overperformers | 20.7% | Trap risk | 20.7 |
| att_top_team_goal_share | 7.2% | Trap risk | 7.2 |
| cap_double_digit_haul_rate | 4.6% | Weak signal | 4.6 |
| cap_top3_xpts_share | 3.0% | Weak signal | 3.0 |
| def_cs_rate_top6_vs_rest | 31.6% | Regression risk | 31.6 |
| def_cs_home_vs_away | 28.4% | Regression risk | 28.4 |
| def_cs_streak_ge2 | 5.0% | Regression risk | 5.0 |
| player_diff_count | 31.8% | Trap risk | 31.8 |
| player_sell_signal_count | 2.6% | Trap risk | 2.6 |
| player_buy_signal_count | 0.7% | Trap risk | 0.7 |

**Distribution:** Trap risk x5, Regression risk x3, Weak signal x2, Watchlist x1

**Note:** "Strong signal" and "Hidden gem" do not appear in the current cache — expected per D-04 (low confidence data at end of season). As noted in RESEARCH.md Open Question 4, this is correct behavior, not a bug.

**Note:** `player_template_trap_count` is absent from the cache because there are currently 0 qualifying template-trap players (filtered by the `if sample_n_trap > 0:` guard). This is correct behavior.

## Per-Insight Refinements Made During Implementation

- `def_cs_home_vs_away` `metric_value` uses `home_pct` (home CS rate %) — most intuitive for the progress bar
- `def_cs_rate_top6_vs_rest` `team_names` computed via `teams_by_id` dict built at the start of the block — added `teams_by_id = {t['id']: t for t in teams}` line immediately after `teams = bootstrap.get('teams', [])` 
- `att_top_team_goal_share` `metric_value` is `confidence_pct` (% of goals from top team), `team_ids=[int(top_team_id)]`, `team_names=[top_team_short]` — wired correctly
- `gw_coverage` for fixture-based insights uses `f'GW1–{max((f.get("event") or 0) for f in finished)}'` with proper en-dash (U+2013, not hyphen-minus)
- Player insights cap at top 5 by order in qualifying list (buy_players, sell_players, diff_players)

## Issues Encountered Running python pipeline/run.py

None. Pipeline ran cleanly on first attempt:
- Understat scraping fell back to FPL proxy data (expected for 2025/26 season end)
- 11 patterns emitted, 832 players processed, 20 teams, 380 fixtures
- `pipeline/cache/insights.json` has 17 fields per record

## Test Suite Results

`python -m pytest pipeline/tests/test_insights.py -x` — **5 passed**
- `test_signal_label_rules` — D-04 rule matrix all 10 cases green
- `test_insight_metadata_constants_complete` — all 12 IDs covered in all 3 dicts
- `test_each_insight_has_structured_fields` — all 11 new fields present on every emitted insight
- `test_gw_coverage_present` — gw_coverage is non-empty string on every insight
- `test_signal_label_in_emitted_insights` — all signal_labels from 6-label vocabulary

`python -m pytest pipeline/tests/` — **117 passed** — no regression in any existing pipeline test

## Deviations from Plan

None — plan executed exactly as written.

## TDD Gate Compliance

RED gate (test commit a55fbd7): `test(079-01): add failing tests for INS-01/INS-02/INS-06 structured insight fields`
GREEN gate (feat commit 5d9ea3b): `feat(079-01): wire 11 new fields to all 12 out.append() sites in insights.py`

Both TDD gate commits present. test_signal_label_rules and test_insight_metadata_constants_complete passed in RED (they test the helper/constants, not the integration). Integration tests (test_each_insight_has_structured_fields, test_gw_coverage_present, test_signal_label_in_emitted_insights) failed in RED and passed in GREEN as expected.

## Self-Check: PASSED

- pipeline/insights.py exists and contains `def _signal_label`: FOUND
- pipeline/insights.py contains 12 `'signal_label':` entries: FOUND (grep count=12)
- pipeline/tests/test_insights.py exists: FOUND
- pipeline/cache/insights.json exists and has 17 fields: FOUND
- Commits a55fbd7, 5d9ea3b, cd45c2e: FOUND in git log
