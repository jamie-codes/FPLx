---
status: partial
phase: 129-squad-cost-simulator
source: [129-VERIFICATION.md]
started: 2026-05-20T18:02:00.000Z
updated: 2026-05-20T18:02:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Infeasibility message renders correctly
expected: Drag slider to £80m; confirm "No squad possible at £80.0m — try £83.5m+" appears with formation grid still visible below the message
result: [pending]

### 2. Feasibility recovery on slider drag
expected: Drag slider back to £100m; confirm infeasibility message disappears and formation grid updates to show a valid client squad
result: [pending]

### 3. Re-render isolation (SC-5 — other tabs unaffected)
expected: React DevTools profiler confirms GemTable and Watchlist components do not re-render during slider drag on the Next Season tab
result: [pending]

### 4. Amber gradient visible in browser
expected: Browser DevTools Elements panel confirms correct `linear-gradient(to right, #f59e0b ...)` inline style on the slider element when health data is available
result: [pending]

### 5. FDR heatmap deferred state
expected: Section B in the Next Season tab renders "Fixtures not yet published" (or equivalent empty-state) without a JavaScript error or blank crash
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
