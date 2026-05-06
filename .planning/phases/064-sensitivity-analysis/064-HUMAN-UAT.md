---
status: partial
phase: 064-sensitivity-analysis
source: [064-VERIFICATION.md]
started: 2026-05-06T12:18:00.000Z
updated: 2026-05-06T12:18:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Fragility note visible on fragile transfer card (Row 4 position)
expected: A transfer suggestion where the buy candidate has `start_prob < 0.70`, a `medium` fixture, or an xPtsGain < 4.0 should display an inline amber ⚠ note below the budget badge (Row 4). The note text should start with "no longer recommended if:" followed by the applicable reason(s).
result: [pending]

### 2. No indicator on robust transfer cards
expected: A transfer suggestion where the buy candidate has `start_prob >= 0.70`, an easy/hard fixture, and xPtsGain >= 4.0 (if it's a hit) should show NO fragility indicator anywhere on the card. The card should be visually clean.
result: [pending]

### 3. Fragility note at tail of captain candidate row
expected: A captain candidate with `start_prob < 0.70` or a `medium` fixture should display a fragility note as the last element of its row. The note must NOT include a hit-cost reason (captains have no hit — D-09).
result: [pending]

### 4. Visual distinction from filled amber pill badges
expected: The FragilityNote should appear as plain inline text with an amber ⚠ symbol — NOT as a filled amber pill/badge. It should look different from DangerousToFadeBadge, McLabel, and SeverityBadge MEDIUM (which all have background fill). The text should be smaller (text-xs) and flush with the card content.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
