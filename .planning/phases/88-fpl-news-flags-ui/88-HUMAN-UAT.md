---
status: partial
phase: 88-fpl-news-flags-ui
source: [88-VERIFICATION.md]
started: 2026-05-10T10:00:00Z
updated: 2026-05-10T10:00:00Z
---

## Current Test

Approved via Task 6 UAT checkpoint (2026-05-10)

## Tests

### 1. TransferPanel OCS news banner
expected: Severity-coloured banner below buy candidate name with live flagged player data
result: approved

### 2. GemTable Status badge tooltip
expected: Hover over Status badge to see news text in browser tooltip
result: approved

### 3. GemTable row-expand news section
expected: Expand a flagged player row to see news text + relative timestamp
result: approved

### 4. SquadView news banner
expected: Banner below owned flagged player's name
result: approved

### 5. Kill switch
expected: Set summary.news_flag_enabled=false in cache, all chrome disappears with no layout gap
result: approved

### 6. Portrait mobile
expected: 390px viewport — no tooltip on touch, row-expand news section still visible
result: approved

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
