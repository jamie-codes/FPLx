---
status: partial
phase: 112-optimiser-on-demand-transfer-suggestion-cap-v1-20
source: [112-VERIFICATION.md]
started: 2026-05-15T16:25:00.000Z
updated: 2026-05-15T16:25:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Ready-state visual layout (D-01)
expected: Opening Squad → Optimiser tab shows controls (1/3/5 GW toggle, chip toggle) rendered ABOVE a bordered card containing the teaser text and 'Optimise Lineup' button. No comparison table or lineup visible before click.
result: [pending]

### 2. Post-click recompute without button re-appearing (D-03)
expected: After clicking 'Optimise Lineup' once — comparison table renders, lineup results appear. Then change the GW horizon selector (e.g. 1→5). Results update in place. The 'Optimise Lineup' button does NOT re-appear. Opening a fresh tab resets the button.
result: [pending]

### 3. Transfers tab footnote with real data
expected: Open Squad → Transfers sub-tab on a typical GW. If the engine produces more than 3 MID (or DEF/FWD) buy candidates, a line 'Showing top 3 of N MID suggestions.' appears below the OCS table for that position. When all positions have ≤ 3 candidates, no footnote appears.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
