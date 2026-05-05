---
status: partial
phase: 73-post-gw-review
source: [073-VERIFICATION.md]
started: 2026-05-05T18:32:00.000Z
updated: 2026-05-05T18:32:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Browser smoke test — Squad → Review tab
expected: With a real team ID submitted, Squad → Review tab shows 4-stat card (GW Score, Bench pts left, Captain delta, FPL average) with real values. GW pills (GW33/GW34/GW35) toggle correctly and trigger new data fetch. Degraded states ("Load your squad to see GW reviews." / "GW review will appear once scores finalise.") display correct copy.
result: [pending]

### 2. Live pipeline run produces real gw_review files
expected: Running `python pipeline/run.py` (full run, not --dry-run) writes `gw_review_gw{N}.json` for the actual last 3 finished GWs with real `{gw: <N>, average_score: <int>}` content (not the `{"gw": null}` seed shape). After run, visiting Squad → Review shows real scores.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
