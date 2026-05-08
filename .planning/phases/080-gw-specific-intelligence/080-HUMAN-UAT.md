---
status: partial
phase: 080-gw-specific-intelligence
source: [080-VERIFICATION.md]
started: 2026-05-08T13:00:00Z
updated: 2026-05-08T13:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. "This Gameweek" section renders first visually in live Insights tab
expected: GWIntelSection appears above Priority Insights / DecisionSummary in the Insights tab when viewed in the browser
result: [pending]

### 2. GWI-05 empty-state renders when gw_intel.json is absent
expected: Deleting/renaming gw_intel.json and reloading the Insights tab shows the placeholder "GW insights will appear once fixtures are confirmed." — no blank space, no error thrown
result: [pending]

### 3. RotationRiskBadge appears in Set Pieces tab team headers
expected: When a player has rotation_risk=true in merged_players.json, their team's header row in SetPieceTakerPanel shows "⚡ Rotation risk" badge (note: EUROPEAN_CUP_DATES is currently empty so all teams show false — manual data population required to test)
result: [pending]

### 4. RotationRiskBadge appears in OCS table buy-player rows
expected: In the Opportunity Cost simulator, buy-player cells show "⚡ Rotation risk" badge when rotation_risk=true; sell player has no badge
result: [pending]

### 5. XptsTrajectoryBar renders correct 3-bar heights visually
expected: The 3-bar trajectory in the PositionOpportunity card shows proportional inline-style px heights; DGW fixtures show † suffix on the GW number
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
