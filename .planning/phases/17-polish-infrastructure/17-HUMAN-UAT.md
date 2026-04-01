---
status: partial
phase: 17-polish-infrastructure
source: [17-VERIFICATION.md]
started: 2026-04-01T00:00:00Z
updated: 2026-04-01T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Sticky filter bar visible while scrolling GemTable on mobile
expected: GW toggle and position filter row stays fixed at top of viewport at 375px while scrolling; disappears on desktop (sm:static)
result: [pending]

### 2. Back-to-top button appears after scrolling
expected: After scrolling past one viewport height of GemTable rows on mobile, a circular button appears bottom-right; tapping smooth-scrolls to top; hidden on desktop
result: [pending]

### 3. DGW labels in fixture badges (requires GW33 or GW36)
expected: When a team has 2 fixtures in the same GW, FixtureBadges shows a violet "DGW" label before the two badge chips
result: [pending — requires live DGW week GW33 or GW36]

### 4. CaptaincyPanel shows both fixtures for DGW players (requires GW33 or GW36)
expected: During a DGW, captaincy candidates with 2 fixtures show both opponents separated by "/" with a "DGW" label
result: [pending — requires live DGW week GW33 or GW36]

### 5. GitHub Actions cron operational and LastUpdated shows fresh timestamp
expected: GitHub Actions "Daily Data Pipeline" has at least one successful run; deployed app /api/last-updated returns JSON with recent timestamp
result: approved by user during execution

## Summary

total: 5
passed: 1
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
