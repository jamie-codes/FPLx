---
status: testing
phase: 33-insights-tab
source: [33-01-SUMMARY.md, 33-02-SUMMARY.md]
started: 2026-04-28T00:00:00Z
updated: 2026-04-28T00:00:00Z
---

## Current Test

number: 2
name: Insights tab in mobile nav
expected: |
  The mobile bottom nav shows an "Insights" entry as the 8th tab. Tapping it navigates to the Insights view.
awaiting: user response

## Tests

### 1. Insights tab in desktop nav
expected: "Insights" tab button visible between Set Pieces and Value Gems in the desktop nav. Clicking it activates the tab and loads the Insights content area.
result: pass

### 2. Insights tab in mobile nav
expected: The mobile bottom nav shows an "Insights" entry as the 8th tab. Tapping it navigates to the Insights view.
result: [pending]

### 3. Four category sections render
expected: The Insights tab displays four headed sections in order: Defensive, Attacking, Player, Captaincy. Each section contains at least one insight card with a short statement and a tier badge.
result: [pending]

### 4. Tier badge colours
expected: Insight cards show colour-coded tier badges — HIGH in green, MEDIUM in amber, LOW in zinc/grey. Badges reflect the confidence_pct value (HIGH ≥ 70%, MEDIUM 50–69%, LOW < 50%).
result: [pending]

### 5. Badge tooltip (1 d.p. precision)
expected: Hovering (or long-pressing) a tier badge shows a tooltip in the format "True in {X.X}% of fixtures — {N}/{M} matches" — exactly one decimal place on the percentage (e.g. "True in 35.6% of fixtures — 57/160 matches").
result: [pending]

### 6. Loading state
expected: While the /api/insights request is in flight (e.g. on a throttled connection or first load), the Insights tab shows a loading skeleton or spinner rather than a blank area or error.
result: [pending]

### 7. /api/insights route returns data
expected: Navigating to http://localhost:3000/api/insights in the browser returns a JSON array of insight objects, each with id, category, statement, confidence_pct, sample_n, and sample_total fields. Should have roughly 12 items.
result: [pending]

### 8. Empty insights fallback
expected: If the pipeline cache is replaced with an empty array ([]), the Insights tab shows a friendly "No insights available" message rather than a blank page or error.
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0

## Gaps

[none yet]
