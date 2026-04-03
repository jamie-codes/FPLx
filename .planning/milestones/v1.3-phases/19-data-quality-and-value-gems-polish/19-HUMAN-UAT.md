---
status: partial
phase: 19-data-quality-and-value-gems-polish
source: [19-VERIFICATION.md]
started: 2026-04-02T00:00:00Z
updated: 2026-04-02T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Asterisk Display on Partial-Window Players
expected: Players with pts_gw_count < 5 show asterisk notation (e.g. "12*"); hovering shows tooltip "N of 5 gameweeks". Players with 5+ GWs show plain number.
result: [pending]

### 2. Column Sort Ordering on Points Columns
expected: Clicking "Pts L5" header sorts descending (highest at top), then ascending (lowest at top). Same for Total Pts and Pts L3.
result: [pending]

### 3. Mobile Column Hiding
expected: At viewport < 640px, Pts L5 and Pts L3 columns are hidden. Only Player, Price, Own%, Total Pts, Gem, and Next 5 visible.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
