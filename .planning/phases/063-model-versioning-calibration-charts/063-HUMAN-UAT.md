---
status: partial
phase: 063-model-versioning-calibration-charts
source: [063-VERIFICATION.md]
started: 2026-05-06T09:15:00Z
updated: 2026-05-06T09:15:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live calibration chart rendering in browser
expected: recharts ComposedChart renders with visible y=x dashed reference diagonal, actual_rate line with dots, and XAxis ticks at 0%/20%/40%/60%/80%/100% — confirms ResponsiveContainer renders correctly outside jsdom with real accuracy_backtest.json data; position pill switching updates the chart
result: [pending]

### 2. Dark mode appearance of new sections
expected: both VersionHistoryTable and CalibrationSection sections respect dark zinc surface tokens (dark:bg-zinc-800, dark:text-zinc-300, etc.) — no colour bleed or invisible text in dark mode
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
