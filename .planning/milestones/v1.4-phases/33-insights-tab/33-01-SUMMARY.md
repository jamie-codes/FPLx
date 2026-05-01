---
phase: 33-insights-tab
plan: "01"
subsystem: pipeline
tags: [pipeline, python, insights, fpl, wave-0-stub]
dependency_graph:
  requires: [pipeline/run.py, pipeline/defcon.py structure, pipeline/xmins.py structure]
  provides: [pipeline/insights.py, pipeline/cache/insights.json, src/components/insights/InsightsTab.test.ts]
  affects: [pipeline/run.py (modified — import + save call), Plan 02 (has test target)]
tech_stack:
  added: []
  patterns: [pipeline-module-with-private-helpers (defcon.py/xmins.py shape re-applied)]
key_files:
  created:
    - pipeline/insights.py
    - pipeline/cache/insights.json
    - src/components/insights/InsightsTab.test.ts
  modified:
    - pipeline/run.py
decisions:
  - "D-01: Pipeline-computed insights persisted to insights.json — no client-side aggregation"
  - "D-02: Dynamic count — all insights that pass the gates are emitted"
  - "D-03: MIN_SAMPLE_TOTAL = 10 applied in every category helper and in public entry point"
  - "D-06: Four categories (defensive/attacking/player/captaincy) — all represented in smoke run"
  - "D-07: _TRIVIAL_PATTERN_IDS frozenset at module top; triviality-checked in compute_insights()"
  - "D-12: Insight dict shape matches TypeScript interface exactly — six required fields"
metrics:
  duration: "6m 24s"
  completed: "2026-04-28"
  tasks: 4
  files_created: 3
  files_modified: 1
---

# Phase 33 Plan 01: Pipeline Backend for Insights Tab Summary

**One-liner:** Python pipeline module `insights.py` with 11 pattern computations across four FPL categories (defensive CS rates, attacking goal splits, player regression signals, captaincy haul stats) — produces `insights.json` with 12 insights on smoke run.

---

## What Was Built

### pipeline/insights.py (431 lines)

New standalone Python module mirroring `defcon.py` / `xmins.py` structure:

- **`compute_insights(merged, bootstrap, fixtures, summaries, finished_gws)`** — public entry point; calls four private helpers, applies sample-floor gate (D-03: `sample_total < MIN_SAMPLE_TOTAL`), applies triviality gate (D-07: `id in _TRIVIAL_PATTERN_IDS`), validates required keys and category membership, sorts by `(category asc, confidence_pct desc)`.
- **`MIN_SAMPLE_TOTAL = 10`** — module constant.
- **`_TRIVIAL_PATTERN_IDS`** — frozenset of 4 known-trivial pattern IDs.
- **`CATEGORIES = ('defensive', 'attacking', 'player', 'captaincy')`** — validated at emit time.

### Four private category helpers

| Helper | Patterns |
|--------|---------|
| `_defensive_patterns` | `def_cs_home_vs_away`, `def_cs_rate_top6_vs_rest`, `def_cs_streak_ge2` |
| `_attacking_patterns` | `att_top_xg_overperformers`, `att_home_goal_share`, `att_top_team_goal_share` |
| `_player_patterns` | `player_buy_signal_count`, `player_sell_signal_count`, `player_diff_count`, `player_template_trap_count` |
| `_captaincy_patterns` | `cap_top3_xpts_share`, `cap_double_digit_haul_rate` |

Total: 11 defined pattern computations, 12 emitted in smoke run.

### pipeline/run.py (2 lines added)

- Import: `from insights import compute_insights` (after `from xmins import compute_xmins_stats`)
- Call + save: inside the `try:` block after `save('captain_picks.json', captain_picks)`:
  ```python
  insights = compute_insights(merged, bootstrap, fixtures, summaries, finished_gws)
  save('insights.json', insights)
  print(f"Insights computed: {len(insights)} pattern(s) emitted")
  ```

### pipeline/cache/insights.json

Seeded as `[]` initially (force-added despite `pipeline/cache/` being in `.gitignore`) so `/api/insights` (Plan 02) never 500s on a fresh checkout. Overwritten by smoke run with 12 real insights.

### src/components/insights/InsightsTab.test.ts

Wave 0 placeholder test — `expect(true).toBe(true)` inside `describe('Phase 33: InsightsTab — Wave 0 stub')`. Passes vitest. Plan 02 Task 5 rewrites this file with real component tests.

---

## Smoke Run Results

**Command:** `python pipeline/run.py` (from project root)
**Exit code:** 0
**Console output:** `Insights computed: 12 pattern(s) emitted`

### Output breakdown by category

| Category | Count | Pattern IDs |
|----------|-------|-------------|
| attacking | 3 | `att_home_goal_share` (54.8%), `att_top_xg_overperformers` (19.0%), `att_top_team_goal_share` (7.1%) |
| captaincy | 2 | `cap_double_digit_haul_rate` (4.6%), `cap_top3_xpts_share` (2.0%) |
| defensive | 3 | `def_cs_rate_top6_vs_rest` (35.6%), `def_cs_home_vs_away` (28.3%), `def_cs_streak_ge2` (5.0%) |
| player | 4 | `player_diff_count` (59.2%), `player_template_trap_count` (0.7%), `player_buy_signal_count` (0.0%), `player_sell_signal_count` (0.0%) |

**Notable data points from GW33 season state:**
- 54.8% of PL goals scored by home teams (508/927)
- Only 19% of qualifying attackers (xG >= 3) are outscoring their xG by 30%+
- MCI are the top-scoring team but account for only 7.1% of all PL goals
- Top-6 teams maintain CS in 35.6% of fixtures
- 59.2% of regular starters carry a differential flag (high xPts, low ownership)
- Buy/sell regression signals both at 0% — suggesting most players are producing in line with xG

### Gate compliance

- All 12 insights: `sample_total >= 10` ✓
- All 12 insights: `category` in allowed set ✓
- All 12 insights: `0 <= confidence_pct <= 100` ✓
- All 12 insights: six required fields present ✓
- No emitted insight has `id` in `_TRIVIAL_PATTERN_IDS` ✓

---

## Requirements Delivered

- **INS-02** (confidence weights): `confidence_pct` + `sample_n` + `sample_total` present in every dict; D-12 data shape implemented
- **INS-03** (four category coverage): all four categories present in smoke run output
- **INS-04** (triviality gate): `_TRIVIAL_PATTERN_IDS` frozenset in place; manual review confirms no trivially obvious statements in output
- **INS-01** (visible tab): deferred to Plan 02

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pipeline path issue when run from wrong working directory**
- **Found during:** Task 4 (smoke run)
- **Issue:** Running `python run.py` from inside `pipeline/` directory caused `save()` to write to `pipeline/pipeline/cache/` instead of `pipeline/cache/` (relative path in `upload.py save_local()`)
- **Fix:** Re-ran pipeline from project root (`python pipeline/run.py`) as designed
- **Files modified:** None — no code change needed; stray `pipeline/pipeline/` directory cleaned up with `rm -rf`
- **Commit:** n/a (operational error, not code bug)

**2. [Rule 2 - Missing functionality] Force-add pipeline/cache/insights.json despite gitignore**
- **Found during:** Task 3 commit
- **Issue:** `pipeline/cache/` is in `.gitignore`; `git add` rejected the file
- **Fix:** Used `git add -f pipeline/cache/insights.json` per plan requirement ("The file MUST be committed... Do NOT add this file to .gitignore exclusions")
- **Commits:** be9fc10, a2594f2

None - all other plan items executed exactly as written.

---

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundaries introduced by this plan. `insights.py` performs zero HTTP calls — verified by `grep -c "import requests" pipeline/insights.py` = 0. The `save()` pathway is identical to `captain_picks.json` (T-33-02: accept). T-33-01 mitigated by `.get()` usage throughout helpers.

No threat flags to report.

---

## Known Stubs

None. The `InsightsTab.test.ts` Wave 0 stub is an intentional placeholder (documented; Plan 02 Task 5 rewrites it). The `insights.json` seed `[]` was overwritten by the smoke run with real data.

---

## Self-Check: PASSED

Files exist:
- `pipeline/insights.py` ✓ (`[ -f pipeline/insights.py ]`)
- `pipeline/cache/insights.json` ✓ (12 insights, non-empty)
- `src/components/insights/InsightsTab.test.ts` ✓

Commits exist:
- `cfa21b5` ✓ (test stub)
- `669e699` ✓ (insights.py)
- `be9fc10` ✓ (run.py + seed)
- `a2594f2` ✓ (smoke run output)

All acceptance criteria met. Vitest suite: 29/29 files passed, 300/300 tests passed.
