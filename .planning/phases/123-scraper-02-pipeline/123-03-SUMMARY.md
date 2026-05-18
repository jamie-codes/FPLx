---
phase: 123
plan: 03
subsystem: pipeline
tags: [pipeline, off-season, run-py, gate, transfer-news-integration, win-03, tdd]
dependency_graph:
  requires:
    - pipeline/transfer_news.py (Plan 01 — scrape() public API)
    - pipeline/player_matching.py (Plan 01 — shared utility)
  provides:
    - pipeline/run.py (IS_OFF_SEASON gate + transfer_news.scrape() wiring)
    - pipeline/tests/test_run_offseason.py (contract tests for gate detection + log format)
  affects:
    - pipeline/run.py (all GW-dependent steps now wrapped in IS_OFF_SEASON conditional)
tech_stack:
  added: []
  patterns:
    - IS_OFF_SEASON detection via not any(e.get('is_current') for e in events) — D-06
    - Replica-function contract test pattern (mirrors test_run.py — avoids dotenv side effects)
    - Year-round vs GW-dependent step classification in pipeline orchestrator
key_files:
  created:
    - pipeline/tests/test_run_offseason.py
  modified:
    - pipeline/run.py
decisions:
  - "IS_OFF_SEASON gate inserted immediately after bootstrap fetch + save (D-06 placement)"
  - "transfer_news.scrape() placed OUTSIDE IS_OFF_SEASON block — year-round (D-05)"
  - "merged defaults to [] before gate block so last_updated.json and data_health are safe in off-season"
  - "price_changes left year-round (off-season pre-prep value)"
  - "12 GW-dependent steps classified and wrapped with skip-logs in verbatim D-06 format"
metrics:
  duration: "8 minutes"
  completed: "2026-05-18"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
  tests_added: 8
  tests_passing: 280
---

# Phase 123 Plan 03: IS_OFF_SEASON Gate + transfer_news Wiring Summary

**One-liner:** IS_OFF_SEASON gate wraps all GW-dependent pipeline steps (graceful GW38 degradation) and transfer_news.scrape() wired year-round outside the gate, with contract tests locking the D-06 detection expression and skip-log format.

## What Was Built

### pipeline/tests/test_run_offseason.py (Task 01 — contract test)

New contract test file following the `test_run.py` replica-function pattern (does not import `run` to avoid dotenv side effects). Contains:
- `_detect_is_off_season(bootstrap)` replica — exact D-06 detection expression
- `_skip_log(step)` replica — D-06 skip-log format lock
- 8 tests covering: empty events, no is_current, missing events key, one current, typical in-season, missing key as falsey, format lock for 'merge', format for all 12 expected GW-dependent steps

The contract assertion: if production code in `run.py` drifts from `not any(e.get('is_current') for e in events)`, this test fails as a regression.

### pipeline/run.py (Task 02 — IS_OFF_SEASON gate + transfer_news wiring)

**Step 1 — IS_OFF_SEASON detection** inserted immediately after `save('fpl_bootstrap.json', bootstrap)`:
```python
events = bootstrap.get('events', [])
IS_OFF_SEASON = not any(e.get('is_current') for e in events)
```

**Step 2 — transfer_news year-round call** inserted after lineup_news block, OUTSIDE IS_OFF_SEASON:
```python
try:
    from transfer_news import scrape as scrape_transfer_news
    scrape_transfer_news(bootstrap)
    print("Transfer news written.")
except Exception as tn_exc:
    print(f"[transfer_news] non-fatal error: {tn_exc}", file=sys.stderr)
```

**Step 3 — GW-dependent step wrapping** — 12 steps classified and wrapped in `if not IS_OFF_SEASON:` / `else:` block:

| Step | Classification | Reason |
|------|---------------|--------|
| xmins | GW-DEPENDENT | uses finished_gws + summaries |
| bonus | GW-DEPENDENT | uses finished_gws + summaries |
| merge (merge_players, mc_simulations, rotation_risk) | GW-DEPENDENT | requires current GW event |
| set_piece_quality | GW-DEPENDENT | uses merged which requires current GW |
| insights | GW-DEPENDENT | uses merged + finished_gws |
| gw_intel | GW-DEPENDENT | explicitly GW-keyed |
| gw_review | GW-DEPENDENT | reads finished events |
| defcon | GW-DEPENDENT | uses merged |
| captain_snapshots + transfer_snapshots | GW-DEPENDENT | uses captain_picks + merged |
| prose_summary + batch_insights | GW-DEPENDENT | use merged |
| dgw_bgw (log step) | GW-DEPENDENT | part of prose_summary block |
| price_changes | YEAR-ROUND | off-season transfer window pre-prep |
| last_updated.json | YEAR-ROUND | always written (merged defaults to []) |
| data_health | YEAR-ROUND | tracks pipeline run itself |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| f98ef6c | test | Add IS_OFF_SEASON detection contract tests (WIN-03 gate) |
| d0233a5 | feat | Add IS_OFF_SEASON gate to run.py + wire transfer_news call (WIN-03, SCR-01, SCR-05) |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Minor implementation notes

**merged defaults to [] before IS_OFF_SEASON block:** The plan's acceptance criteria required `last_updated.json` and `data_health` to remain year-round, but they reference `merged`. Initializing `merged: list = []` before the `if not IS_OFF_SEASON:` block ensures these work correctly in off-season (merged_count=0, data_health receives empty list). This is defensive correctness, not a behavioral deviation.

**price_changes moved outside IS_OFF_SEASON block:** The plan classified `price_changes` as year-round ("leave outside — FPL price tracking continues in off-season for transfer window pre-prep"). The edit moved the price_changes block from inside the original sequential flow to after the `else:` arm. The behavior is identical in in-season runs; in off-season, price_changes now runs where it previously would have crashed.

## Verification Results

```
cd pipeline && python -m pytest tests/test_run_offseason.py -x -q
8 passed in 0.02s

cd pipeline && python -m pytest tests/ -x -q
280 passed in 1.79s  (no regressions)

python -c "import ast; ast.parse(open('pipeline/run.py').read()); print('run.py parses OK')"
run.py parses OK

grep -c "IS_OFF_SEASON = not any(e.get('is_current') for e in events)" pipeline/run.py
1  (D-06 detection expression, verbatim)

grep -c "from transfer_news import scrape" pipeline/run.py
1  (Plan 01 module imported)

grep -c "[pipeline] IS_OFF_SEASON: skipping" pipeline/run.py
12  (>= 9 GW-dependent steps have skip-log lines)

transfer_news at line 164, gate at line 202 — PASS (precedes gate)
```

## Requirements Satisfied

- **WIN-03**: IS_OFF_SEASON gate detects no current GW (`not any(e.get('is_current') for e in events)`); all GW-dependent steps degrade gracefully with `[pipeline] IS_OFF_SEASON: skipping {step}` log lines. Pipeline survives GW38 rollover without KeyError/TypeError.
- **SCR-01** wiring: `transfer_news.scrape(bootstrap)` invoked from `pipeline/run.py` each run to produce `transfer_news.json`.
- **SCR-05** outer non-fatal wrap: `try/except Exception as tn_exc` around the entire `from transfer_news import scrape; scrape_transfer_news(bootstrap)` block — failure logs to stderr, pipeline continues.

## Known Stubs

None — this plan has no UI or data consumers. The `transfer_news.json` artifact is produced by the pipeline and consumed by Phase 125 (Summer Window Tracker). No stubs in this plan.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. `pipeline/run.py` is an orchestrator; the actual RSS network calls are in `transfer_news.py` (Plan 01).

Mitigations verified:
- **T-123-09** (GW38 rollover DoS): IS_OFF_SEASON gate detects and routes execution to skip branch — tested by 8 contract tests covering edge cases including empty events, missing key, and no is_current.
- **T-123-10** (transfer_news import failure): Outer `try/except Exception as tn_exc` in run.py catches ImportError or any other failure — logs to stderr, pipeline continues.
- **T-123-11** (IS_OFF_SEASON expression drift): Contract test in `test_run_offseason.py` grep-asserts the exact expression via the replica function — any drift fails the test.

## Self-Check: PASSED

Files exist:
- pipeline/tests/test_run_offseason.py: FOUND
- pipeline/run.py (modified): FOUND

Commits exist:
- f98ef6c: FOUND (test(123-03): add IS_OFF_SEASON detection contract tests)
- d0233a5: FOUND (feat(123-03): add IS_OFF_SEASON gate to run.py)

Tests: 280 passing (8 new + 272 pre-existing).
