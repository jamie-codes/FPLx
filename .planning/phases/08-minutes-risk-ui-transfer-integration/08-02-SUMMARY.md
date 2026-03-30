---
phase: 08-minutes-risk-ui-transfer-integration
plan: "02"
subsystem: transfer-engine, ui-components
tags: [mins-risk, transfer-engine, rotation-risk, tdd, TransferPanel, badge]
dependency_graph:
  requires: [08-01]
  provides: [isRotationRisk, 3-tier transfer sort, MinsRiskBadge in TransferPanel]
  affects: [transfer-engine.ts, TransferPanel.tsx]
tech_stack:
  added: []
  patterns: [TDD red-green, 3-tier comparator sort, inline badge placement]
key_files:
  created: []
  modified:
    - src/lib/transfer-engine.ts
    - tests/lib/transfer-engine.test.ts
    - src/components/transfers/TransferPanel.tsx
decisions:
  - isRotationRisk covers 'rotation_risk' and 'cameo' (both reduce expected minutes enough to deprioritise as buy targets)
  - Rotation risk penalty is buy-side only — sell candidates with rotation_risk are still surfaced normally
  - Budget tier remains the primary sort key (affordable before unaffordable regardless of risk)
  - MinsRiskBadge placed on sell-side player only in TransferPanel (shows why player is a sell candidate)
metrics:
  duration: "~3 minutes"
  completed: "2026-03-30T08:07:41Z"
  tasks_completed: 2
  files_changed: 3
---

# Phase 8 Plan 02: Transfer Engine Rotation Risk Penalty and TransferPanel Badge Summary

**One-liner:** 3-tier transfer sort (budget > rotation-risk-on-buy > gem_delta) with MinsRiskBadge inline on sell player names in both TransferPanel sections.

## What Was Built

Extended `computeTransferSuggestions` in `transfer-engine.ts` with a `isRotationRisk` helper and a 3-tier sort comparator. Rotation-risk and cameo buy candidates are de-prioritised below non-risk equivalents when budget tier and gem_delta are equal. Added `MinsRiskBadge` inline after sell player names in both the main suggestions list and the 2-transfer combo section of `TransferPanel.tsx`.

## Tasks

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 (RED) | Add failing rotation risk penalty tests | 4238d27 | tests/lib/transfer-engine.test.ts |
| 1 (GREEN) | Implement isRotationRisk + 3-tier sort | cab790d | src/lib/transfer-engine.ts |
| 2 | Add MinsRiskBadge to TransferPanel sell rows | 2a50220 | src/components/transfers/TransferPanel.tsx |

## Verification

- `npx tsc --noEmit` passes (0 errors)
- `npx vitest run` passes (10 test files, 101 tests + 8 skipped)
- Transfer suggestions sort: budget_sufficient > non-rotation-risk buy > gem_delta desc
- isRotationRisk covers rotation_risk and cameo; nailed and likely_start are non-risk
- MinsRiskBadge renders inline after sell player name in main suggestions list
- MinsRiskBadge renders inline after sell player name in 2-transfer combo section
- Sell-side rotation_risk players still appear as suggestions (penalty is buy-side only)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TDD RED tests passed unexpectedly due to stable sort insertion order**
- **Found during:** Task 1 TDD RED phase
- **Issue:** Initial test implementation put the non-risk candidate first in the input array. V8's stable Array.sort preserved insertion order for equal-key elements, so the tests passed with the old 2-tier sort — defeating the purpose of the RED phase.
- **Fix:** Reversed the input order in the two key tests (rotation_risk/cameo listed FIRST) so the existing sort would keep the risk candidate first, making the tests fail correctly before the 3-tier implementation.
- **Files modified:** tests/lib/transfer-engine.test.ts
- **Commit:** 4238d27

## Known Stubs

None — all data flows from `player.mins_risk` on `ScoredPlayer` which is non-nullable per Phase 7 pipeline schema.

## Self-Check: PASSED
