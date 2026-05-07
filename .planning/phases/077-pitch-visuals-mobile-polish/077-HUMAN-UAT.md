---
status: partial
phase: 77-pitch-visuals-mobile-polish
source: [077-VERIFICATION.md]
started: 2026-05-07T21:17:49Z
updated: 2026-05-07T21:17:49Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Kit image visual render at 390–430px viewport
expected: FPL team shirt PNG images load from `fantasy.premierleague.com/dist/img/shirts/standard/shirt_{code}-66.png`, display at 24px (mobile) / 28px (≥sm) left of each player name on the LineupTab pitch. When an image fails to load, a coloured flat-colour `<div>` renders in its place (matching the team's primary colour from TEAM_COLOURS) — no text inside the fallback div.
result: [pending]

### 2. Decision tab captain row wrapping at narrow desktop widths
expected: On the Squad → Decision tab, the captain candidate row (badges + points) wraps onto a second line at narrow desktop widths (~640–900px wide) via `sm:flex-wrap` — no content clips or overflows the card boundary at those widths.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
