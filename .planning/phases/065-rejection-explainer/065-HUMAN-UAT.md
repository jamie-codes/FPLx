---
status: resolved
phase: 065-rejection-explainer
source: [065-VERIFICATION.md]
started: 2026-05-06T15:00:00.000Z
updated: 2026-05-06T15:00:00.000Z
---

## Current Test

Human UAT approved by user 2026-05-06.

## Tests

### 1. WHY-01 GemTable row expand — desktop and mobile
expected: Clicking any row in the Gem Ratings table expands a blue-tinted row below. On desktop (>=640px) the panel shows either a green 'No rejection signals' line or a 'Why not recommended:' header with rejection reasons. On mobile (<640px) the panel shows action-sheet first, then hidden-column dl, then rejection panel below.
result: approved

### 2. WHY-02 TransferPanel high-ownership callout
expected: After loading a squad with >20%-owned players absent from OCS suggestions, a zinc-bordered info card titled 'ℹ️ Why aren't these players appearing?' appears above the Transfer Opportunity Cost section with correct per-player copy and em-dashes.
result: approved

### 3. WHY-03 SquadView rejection reasons — sell/hold player expand
expected: Expanding a starting-XI player with verdict='sell' or verdict='hold' shows in order: positive reasons ul, 'Why not recommended:' header, rejection reasons ul, then replacement shortlist if applicable. The top captain candidate has no captain rejection line (D-09 guard). Bench players show no expand panel.
result: approved

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
