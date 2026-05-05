---
status: partial
phase: 061-mc-simulation-core
source: [061-VERIFICATION.md]
started: 2026-05-05T22:30:00.000Z
updated: 2026-05-05T22:30:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. MC hover card visual rendering
expected: Hover xPts cell for an active player (window=1GW) — hover card shows Blank%/Haul%/Floor/Ceiling rows between the component breakdown and Total, with Haul% value in amber when >= 40%
result: [pending]

### 2. BGW player card behavior
expected: Hover xPts cell for a BGW player (value=0, no fixture) — no breakdown card appears; plain span only
result: [pending]

### 3. Multi-GW window suppression
expected: Switch to 3GW or 5GW xPts column — no MC rows (Blank%/Haul%/Floor/Ceiling) appear in any hover card
result: [pending]

### 4. End-to-end pipeline run
expected: Run full pipeline with live FPL API — merged_players.json has blank_prob, haul_prob, p10_pts, p90_pts fields per active player; xPts_90th_1gw overwritten with p90_pts value; BGW players show blank_prob=1.0
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
