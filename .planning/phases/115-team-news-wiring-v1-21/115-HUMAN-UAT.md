---
status: partial
phase: 115-team-news-wiring-v1-21
source: [115-VERIFICATION.md]
started: 2026-05-17T09:50:00.000Z
updated: 2026-05-17T09:50:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Fresh news badge visually placed correctly in CaptainPicksPanel
expected: NewsBanner renders inline inside each CandidateRow after the McLabel/DangerousToFadeBadge cluster — badge appears in the correct position within the flex-wrap div; row layout looks correct with and without a badge present
result: [pending]

### 2. Stale zinc news invisibly suppressed in CaptainPicksPanel
expected: On real FPL data, players whose news_added is older than 14 days AND severity is zinc show no badge in CaptainPicksPanel candidate rows; rows appear visually clean without any badge
result: [pending]

### 3. Stale zinc buy-candidate news suppressed in OpportunityCostTable
expected: On real FPL data, buy candidates whose news_added is older than 14 days AND severity is zinc show no NewsBanner in PlayerMoveCell; transfer table shows clean rows for long-settled news
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
