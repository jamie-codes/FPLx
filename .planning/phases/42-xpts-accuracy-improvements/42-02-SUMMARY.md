---
phase: 42-xpts-accuracy-improvements
plan: "02"
subsystem: pipeline
tags:
  - python
  - accuracy
  - backtest
  - pipeline
  - cleanup
dependency_graph:
  requires:
    - 42-01  # form signal + merge_players blend kwargs
  provides:
    - accuracy_backtest.json blended track fields
    - accuracy_backtest.json gate flag (form_signal_enabled)
    - accuracy_backtest.json mid-tier track fields
    - run.py gate-read before merge_players call
    - types.ts forward-compat AccuracySummary/GwSummary/Haulter/PlayerGw optional fields
  affects:
    - pipeline/cache/accuracy_backtest.json
    - pipeline/cache/predictions_snapshot.json
    - pipeline/cache/merged_players.json (form blend applied on next run if gate=True)
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN (test-first per plan spec)
    - Deferred import of merge._compute_xpts_fixture (avoids circular import at module load)
    - try/except (FileNotFoundError, json.JSONDecodeError) for cache-file reads (T-42-07)
    - Strict greater-than gate comparison (> GATE_MARGIN_PP) to prevent gate flapping (T-42-10)
    - Prior-GW-only form signal reconstruction (g < current_gw) — no-leak guard (T-42-09)
key_files:
  created:
    - pipeline/tests/test_run.py
  modified:
    - pipeline/accuracy.py
    - pipeline/run.py
    - pipeline/tests/test_accuracy.py
    - src/lib/types.ts
decisions:
  - "BLEND_ALPHA fixed at 0.4 (no alpha sweep in Phase 42 — scope discipline; revisit v1.7)"
  - "Gate margin GATE_MARGIN_PP=0.02 (strict >) — 2pp with 78-haulter window = at least 2 haulters of real difference"
  - "Mid-tier track is passive (observational only); gate uses haulter hit rate exclusively"
  - "TOP_N_PREDICTED_MID=30 for mid-tier so CS defenders / bonus accumulators have realistic inclusion chance"
  - "proj_pts purged from accuracy.py and test_accuracy.py — dead code since Phase 41 swept merge.py"
metrics:
  duration: ~35 min
  tasks_completed: 4
  tasks_total: 5
  files_changed: 5
  completed_date: "2026-04-30"
---

# Phase 42 Plan 02: Backtest gate + mid-tier + cleanup Summary

Wires the full form-signal feedback loop: accuracy.py computes baseline+blended backtest, persists the gate flag, run.py reads it on the next run and passes it to merge_players, proj_pts is purged, and AccuracySummary in types.ts forward-declares the new optional fields.

## What Was Built

### Task 0 — RED tests (commit a94b6bd)

- `pipeline/tests/test_accuracy.py`: deleted `test_proj_pts_reconstruction`; removed `proj_pts_hit_rate` assertion from `test_backtest_structure`; appended 7 new RED tests covering blended track keys, gate flag, no-leak form signal reconstruction, gate enabled/disabled logic, mid-tier track, and wider TOP_N net
- `pipeline/tests/test_run.py` (new file): 4 RED tests — gate defaults to False, reads True from previous backtest, handles corrupt JSON, source-level grep guard that run.py contains gate-read before merge_players call

### Task 1 — accuracy.py blended-track + mid-tier + gate (commit dece563)

New constants:
- `MID_TIER_THRESHOLD = 6` — 6 ≤ actual_pts < 10 = mid-tier scorer
- `TOP_N_PREDICTED_MID = 30` — wider predicted-set for mid-tier ranking
- `GATE_MARGIN_PP = 0.02` — strict 2pp margin to flip form_signal_enabled
- `BLEND_ALPHA = 0.4`, `FORM_WINDOW_GWS = 5`, `FORM_MIN_MINUTES = 270` — form signal config constants

New private helpers:
- `_reconstruct_form_signal(grouped, current_gw, ...)` — reconstructs recency-weighted xG+xA per-90 using ONLY entries with `round < current_gw` (no-leak; mirrors merge._compute_form_signal but operates on pre-grouped dict)
- `_reconstruct_xpts_with_form(entry, element_type, difficulty_score, form_per90, ...)` — wraps `_reconstruct_xpts` with optional form blend; re-splits blended xgxa proportionally to season xG/xA ratio (Pitfall 2 safe)

Extended backtest computation:
- First-pass loop: computes `xpts_blended_predicted` alongside `xpts_predicted` per row
- Second-pass loop: blended ranking (`xpts_blended_rank_by_id`), mid-tier flagging (`gw_mid_tier`), extended per-GW summary with blended + mid-tier fields
- Top-level summary: `xpts_blended_hit_rate`, `form_signal_enabled` (gate), `blend_alpha_used=0.4`, `mid_tier_hit_rate`, `mid_tier_blended_hit_rate`
- `_empty_backtest()` extended with same new keys (safe defaults)

All 14 test_accuracy.py tests GREEN (7 legacy + 7 new Phase-42).

### Task 2 — run.py gate-read (commit 6cba4c6)

Inserted before the `merge_players()` call:
```python
form_signal_enabled = False
blend_alpha_used = 0.4
backtest_path = os.path.join(cache_dir, 'accuracy_backtest.json')
try:
    with open(backtest_path, 'r', encoding='utf-8') as f:
        prev_backtest = json.load(f)
    form_signal_enabled = prev_backtest.get('summary', {}).get('form_signal_enabled', False)
    blend_alpha_used = prev_backtest.get('summary', {}).get('blend_alpha_used', 0.4)
except (FileNotFoundError, json.JSONDecodeError):
    pass
print(f"Form signal blend: {'ENABLED' if form_signal_enabled else 'DISABLED'} (alpha={blend_alpha_used})")
```
`merge_players()` updated to pass `form_signal_enabled=form_signal_enabled, blend_alpha=blend_alpha_used` kwargs.

All 4 test_run.py tests GREEN; full pipeline suite 26/26 GREEN.

### Task 3 — proj_pts purge (commit 5f8ffdc)

Removed from `pipeline/accuracy.py`:
- `_reconstruct_proj_pts` private helper (deleted entirely)
- `prior_entries` / `prior_window` / `proj_pts_predicted` from first-pass loop
- `proj_ranked` / `proj_rank_by_id` / `proj_flagged_count` / `total_proj_flagged` from second-pass
- `proj_pts_*` fields from haulters list, per-GW summaries, per-player history, top-level summary, `_empty_backtest`
- `build_predictions_snapshot` updated: `proj_pts_1gw` removed from per-player snapshot dict

Removed from `pipeline/tests/test_accuracy.py`:
- `test_snapshot_format` rewritten to assert `{id, xPts_1gw}` only shape

`grep -c proj_pts pipeline/accuracy.py` = 0
`grep -c proj_pts pipeline/tests/test_accuracy.py` = 0

### Task 4 — types.ts forward compat (commit bac6b2f)

Extended four interfaces with optional Phase-42 fields:

- `AccuracyGwSummary`: `+xpts_blended_flagged?`, `+xpts_blended_hit_rate?`, `+mid_tier_count?`, `+xpts_mid_flagged?`, `+xpts_blended_mid_flagged?`, `+mid_tier_hit_rate?`, `+mid_tier_blended_hit_rate?`
- `AccuracySummary`: `+xpts_blended_hit_rate?`, `+form_signal_enabled?`, `+blend_alpha_used?`, `+mid_tier_hit_rate?`, `+mid_tier_blended_hit_rate?`
- `AccuracyHaulter`: `+xpts_blended_predicted?`, `+xpts_blended_rank?`, `+xpts_blended_flagged?`
- `AccuracyPlayerGw`: `+xpts_blended_predicted?`, `+xpts_blended_delta?`

All fields are optional (`?:`) — forward-compatible with existing consumers.

### Task 5 — PENDING (checkpoint:human-verify)

Live pipeline run and `accuracy_backtest.json` inspection required. See checkpoint section below.

## Commits

| Task | Commit | Type | Message |
|------|--------|------|---------|
| 0 | a94b6bd | test | RED tests for blended track, gate, mid-tier, gate-read pattern |
| 1 | dece563 | feat | add blended-track, mid-tier, gate constants and helpers in accuracy.py |
| 2 | 6cba4c6 | feat | wire run.py to read gate flag and pass to merge_players |
| 3 | 5f8ffdc | refactor | purge proj_pts from accuracy.py and test_accuracy.py |
| 4 | bac6b2f | feat | extend AccuracySummary/GwSummary/Haulter/PlayerGw with optional Phase-42 fields |

## Deviations from Plan

None — plan executed exactly as written. Pre-existing TypeScript compile errors (`captain-picks.test.ts`) and one pre-existing vitest failure (`club-form.test.ts`) noted but out of scope per CLAUDE.md scope boundary rules.

## Threat Surface Scan

No new HTTP endpoints, no new auth paths, no new file access patterns beyond what is declared in the plan threat model (T-42-07 through T-42-13). Gate-read is read-only with try/except defence in depth (T-42-07). Gate flip is printed to stdout (T-42-08). No-leak constraint enforced in `_reconstruct_form_signal` (T-42-09). Gate margin prevents flapping (T-42-10).

## Known Stubs

None. All data flows are wired. The blended track fields will appear in `accuracy_backtest.json` on the next live pipeline run (Task 5 checkpoint verifies this).

## Self-Check: PENDING

Task 5 (live pipeline verification) is a checkpoint — self-check will be completed after human approval.
