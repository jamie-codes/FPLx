---
status: partial
phase: 132-deadline-day-banner
source: [132-VERIFICATION.md]
started: 2026-05-22T12:10:00Z
updated: 2026-05-22T12:10:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live banner with real FPL bootstrap
expected: Dev server shows banner with correct GW text (e.g. "GW38 deadline in 3h 22m") sourced from real FPL bootstrap is_next event
result: [pending]

### 2. Dismiss persistence across page reloads
expected: Clicking × hides banner; hard-refresh keeps it hidden (localStorage key `deadline-dismissed:GW{id}` persists); when FPL transitions to next GW the banner reappears for the new GW
result: [pending]

### 3. Red sticky positioning above section nav
expected: When msRemaining < 2h, banner becomes `sticky top-0 z-50` and visually layers above the section nav `z-40` wrapper when scrolling
result: [pending]

### 4. Insights tab --nav-height interaction (open carry-forward)
expected: With red banner active and Insights tab open, the inner sticky filter row is not obscured by the deadline banner; if it is, --nav-height CSS var needs updating
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
