---
status: partial
phase: 104-transferpanel-sensitivity-rejection-explainer-wire-up
source: [104-VERIFICATION.md]
started: 2026-05-13T17:00:00Z
updated: 2026-05-13T17:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Sell rejection reasons in TransferPanel
expected: Weak sell candidates (rotation risk, poor form) show up to 4 zinc-coloured reason lines inline below the sell name in the Transfers OCS section. Strong sell candidates show nothing below the name. Amber FragilityBadge (buy side) remains visually distinct from the zinc reason text.
result: [pending]

### 2. Sell rejection reasons in DecisionSummaryTab
expected: Navigate to Decision Summary tab OCS section. Same always-visible reason behaviour as TransferPanel — confirms DecisionSummaryTab's `scoredPlayers`/`lifecycleLabels` memos (lines 186, 213) thread correctly to the component end-to-end.
result: [pending]

### 3. Combo-free row per-leg independence
expected: If a 2-FT combo row appears, each sell leg shows its own independent reason block with player-specific reasons. Two separate `data-testid="sell-rejection-reasons"` divs visible.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
