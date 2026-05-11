---
status: partial
phase: 95-set-piece-delivery-league-table
source: [95-VERIFICATION.md]
started: 2026-05-11T12:40:00.000Z
updated: 2026-05-11T12:40:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Mobile toggle visibility
expected: Takers / League Table pill renders at viewport < 640px (flex, not hidden behind sm: breakpoint)
result: [pending]

### 2. League table visual rendering
expected: Table shows team crests, score values as per-100 (e.g. "8.4"), correct column alignment (Corner and FK hidden on mobile, visible on sm+)
result: [pending]

### 3. SetPieceChangeAlert gating
expected: Alert banner appears in Takers mode when change_count > 0; alert is absent when League Table mode is active
result: [pending]

### 4. State reset on navigation
expected: Switching away from Set Pieces tab and back resets to Takers view (component-local state, D-09)
result: [pending]

### 5. Real data null scores
expected: Teams with only one score dimension (corner or FK null) show em-dash in that column but still appear in ranked section; teams with both null appear in Insufficient Data section
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
