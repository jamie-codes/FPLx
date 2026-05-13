---
status: partial
phase: 102-mc-gate-activation-mcdistributionbar-display
source: [102-VERIFICATION.md]
started: 2026-05-13T12:01:01Z
updated: 2026-05-13T12:01:01Z
---

## Current Test

[awaiting human testing — requires next daily pipeline run to populate MC fields]

## Tests

### 1. MCDistributionBar visual render in xPts hover card
expected: After the next GitHub Actions pipeline run populates non-null MC fields in `merged_players.json`, hover any player's xPts cell and confirm the teal bar renders with P10/P90 labels and conditional amber Haul% row (amber row only visible for players with haulProb >= 0.40)
result: [pending]

### 2. CaptainPicksPanel P10/P90 range display
expected: After the same pipeline run, confirm each captain candidate row shows `"X.X pts (C) · Y.Y–Z.Z"` with raw undoubled values in muted zinc-400 styling. BGW case (p10_pts=0.0) should still render the range.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
