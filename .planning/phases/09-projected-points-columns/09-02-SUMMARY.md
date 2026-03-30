---
phase: 09
plan: 02
subsystem: transfers-ui
tags: [projected-points, transfer-panel, ui]
requirements: [PROJ-04]

dependency_graph:
  requires:
    - Phase 07: proj_pts_1gw field on ScoredPlayer (non-nullable number)
    - Phase 08: TransferPanel structure with suggestion card loops
  provides:
    - Projected points (1 GW) visible in every TransferPanel suggestion card
  affects:
    - src/components/transfers/TransferPanel.tsx

tech_stack:
  added: []
  patterns:
    - Inline metadata extension: appended to existing text-xs text-zinc-500 div

key_files:
  modified:
    - src/components/transfers/TransferPanel.tsx

decisions:
  - TransferPanel always shows 1 GW horizon (multi-GW toggle deferred to future phase per UI-SPEC)
  - No null guard needed — proj_pts_1gw is non-nullable number per Phase 07-02 locked decision

metrics:
  duration: "< 5 minutes"
  completed: "2026-03-30"
  tasks_completed: 1
  files_modified: 1
---

# Phase 09 Plan 02: Projected Points in TransferPanel Summary

One-liner: Appended "Proj pts (1 GW): X.X -> Y.Y" inline metadata to both single-transfer and 2-transfer combo suggestion cards in TransferPanel.

## What Was Built

`src/components/transfers/TransferPanel.tsx` extended to show projected points (1 GW) in the metadata row of every suggestion card. The fragment `| Proj pts (1 GW): {sell} -> {buy}` is appended after the existing `Cost: £X.Xm (approx)` entry in the `text-xs text-zinc-500` div. Applied identically to both the single-transfer loop and the 2-transfer combo loop.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add projected points metadata to single-transfer and combo suggestion cards | 6dfc6e3 | src/components/transfers/TransferPanel.tsx |

## Acceptance Criteria Verification

- `Proj pts (1 GW):` appears exactly 2 times in TransferPanel.tsx: PASS
- `s.sell.proj_pts_1gw.toFixed(1)` appears exactly 2 times: PASS
- `s.buy.proj_pts_1gw.toFixed(1)` appears exactly 2 times: PASS
- `&rarr;` present in proj pts context for both loops: PASS
- `npx tsc --noEmit` exits 0: PASS

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. Data is wired directly from `s.sell.proj_pts_1gw` and `s.buy.proj_pts_1gw` which are non-nullable fields populated by the Phase 07 pipeline.

## Self-Check: PASSED
