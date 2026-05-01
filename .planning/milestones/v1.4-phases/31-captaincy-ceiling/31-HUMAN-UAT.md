---
status: partial
phase: 31-captaincy-ceiling
source: [31-VERIFICATION.md]
started: 2026-04-28T16:00:00.000Z
updated: 2026-04-28T16:00:00.000Z
---

## Current Test

Approved 2026-04-28 — human verification checkpoint passed during plan 31-02 Task 6 execution.

## Tests

### 1. Visual rendering on Gems tab
expected: Section titled "Captain Picks — GW {N}" (em-dash) with two side-by-side cards (Ceiling + EO-Adjusted), each showing player name, position chip, meta line, and xPts with 90th-pct annotation
result: approved

### 2. Native tooltips on card headings
expected: Hovering "Ceiling" h3 shows tooltip "Highest 90th-percentile xPts. Captain when chasing rank — accepts higher variance for upside."
result: approved

### 3. Mobile responsive stacking
expected: Cards stack vertically at <640px viewport (iPhone 12 emulation)
result: approved

### 4. Dark mode styling
expected: Cards use dark:bg-zinc-900 + dark:border-zinc-700; no hue accents
result: approved

### 5. Tab switching / cache behaviour
expected: Re-visiting Gems tab shows cached data without re-fetch within 6h staleTime
result: approved

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
