---
status: partial
phase: 125-summer-window-tracker
source: [125-VERIFICATION.md]
started: 2026-05-19T10:50:00Z
updated: 2026-05-19T10:50:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Summer Window feed rendering
expected: Navigating to / → Analyse tab → Summer Window sub-tab renders a list of transfer news articles. Filter pills (All/Confirmed/Rumour/Injury/Rotation) are visible and single-select. Clicking a pill filters the article list to that classification. Empty state card shows "No X articles found." when no articles match. Stale banner appears above pills when feed data is older than 24h. Loading skeleton renders before data arrives. Error card renders on fetch failure.
result: [pending]

### 2. GemTable confirmed signing badge
expected: In Gem Ratings, expanding a row for a player who has a confirmed_signing article matching their FPL element_id shows a green "Confirmed Signing" pill in the expanded row. The badge tooltip (title attribute) shows the article headline and source name. Players with no confirmed_signing match show no badge.
result: [pending]

### 3. OpportunityCostTable buy-cluster badge
expected: In Squad → Transfers, a row whose buy-side player has a confirmed_signing match shows the green "Confirmed Signing" pill in the buy cluster. The sell-side player row does NOT show the badge. Tooltip format is "Article headline · Source Name".
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
