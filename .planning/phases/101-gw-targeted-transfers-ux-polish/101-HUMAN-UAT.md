---
status: partial
phase: 101-gw-targeted-transfers-ux-polish
source: [101-VERIFICATION.md]
started: 2026-05-12T18:52:00Z
updated: 2026-05-12T18:52:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Target GW dropdown population
expected: The Target GW `<select>` in the OCS section shows all distinct GW numbers from live `/api/players` fixture data, sorted ascending, formatted "GW{N}" — no past gameweeks shown without a `currentGw` filter
result: [pending]

### 2. Full GWT mode visual activation
expected: Selecting a GW from the dropdown causes: (a) GwToggle pills become greyed/disabled (opacity-50, pointer-events-none), (b) OpportunityCostTable column header switches from "xPts Gain (Next N GWs)" to "xPts Gain (GW{N})", (c) "Ranked by GW{N} xPts" sub-label appears below the OCS section heading, (d) transfer suggestions re-rank by per-GW xPts (DGW players surface)
result: [pending]

### 3. Horizon mode restore
expected: Resetting the dropdown to the "Target GW" placeholder option restores horizon mode: GwToggle pills re-enable, column header reverts to "xPts Gain (Next N GWs)", sub-label disappears
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
