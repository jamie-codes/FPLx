---
status: resolved
phase: 29-regression-detector
source: [29-VERIFICATION.md]
started: 2026-04-28T00:00:00Z
updated: 2026-04-28T00:00:00Z
---

## Current Test

Completed — human verification performed during Wave 2 checkpoint (same session).

## Tests

### 1. Signal column visible in GemTable after xPts columns
expected: "Signal" column header appears after xPts_5gw, before Trend column
result: approved

### 2. BUY/SELL/em-dash badges render correctly
expected: Green BUY pill, amber SELL pill, grey em-dash for null; tooltips mention xG+xA, last 5 GW, Consider buying/selling
result: approved

### 3. Sort interaction
expected: Ascending puts BUY first, descending puts SELL first, null stays middle
result: approved

### 4. Mobile portrait — Signal column hidden
expected: Column not visible at ~390px portrait width
result: approved

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
