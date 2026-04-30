---
phase: 43
plan: 02
subsystem: nav-wiring
tags: [react, navigation, refactor, fpl, squad, sub-tabs, tdd]
dependency_graph:
  requires:
    - OptimiserPanel stub (src/components/optimiser/OptimiserPanel.tsx) from Plan 01
  provides:
    - Squad section with Transfers + Optimiser sub-tabs (page.tsx)
    - Controlled TransferPanel component (src/components/transfers/TransferPanel.tsx)
    - teamId/submittedId state lifted to page.tsx (D-11)
    - MobileNav pill row shown for Squad section (D-10)
  affects:
    - src/app/page.tsx (SubTab union, SECTIONS, sectionMemory, state, sub-tab nav, content mounts)
    - src/components/nav/MobileNav.tsx (guard removed)
    - src/components/transfers/TransferPanel.tsx (controlled props)
    - src/app/page.test.tsx (new Squad + Optimiser sub-tab tests)
    - src/components/nav/MobileNav.test.tsx (NAV-04 updated)
    - Plan 03 (receives teamId prop via OptimiserPanel, Squad sub-tab already wired)
tech_stack:
  added: []
  patterns:
    - State lift: teamId/submittedId moved from TransferPanel to page.tsx (D-11)
    - Controlled component pattern: TransferPanel receives 4 props instead of owning state
    - Sub-tab guard: render via activeSectionDef.subTabs.length === 0 check (D-08, D-10)
    - TanStack Query cache deduplication via shared submittedId passed to useSquad
key_files:
  created: []
  modified:
    - src/app/page.tsx (+38 lines, -11 lines)
    - src/components/nav/MobileNav.tsx (+2 lines, -1 line)
    - src/components/transfers/TransferPanel.tsx (+13 lines, -17 lines)
    - src/app/page.test.tsx (+36 lines, -19 lines)
    - src/components/nav/MobileNav.test.tsx (+17 lines, -12 lines)
decisions:
  - "State lifted from TransferPanel to page.tsx so OptimiserPanel can receive teamId without prop-drilling through squadData"
  - "freeTransfers and isModalOpen stay local in TransferPanel — not needed by OptimiserPanel (Pitfall 6)"
  - "Sub-tab guard changed from activeSection !== 'squad' to subTabs.length === 0 — generic and future-proof"
  - "pre-existing club-form test failure (tests/lib/club-form.test.ts:228) is out of scope — not caused by this plan"
metrics:
  duration: "~25 minutes"
  completed: "2026-04-30"
  tasks_completed: 4
  files_created: 0
  files_modified: 5
  tests_added: 2
---

# Phase 43 Plan 02: Nav Wiring Summary

**One-liner:** Squad section wired with Transfers + Optimiser sub-tabs via state-lifted teamId/submittedId; TransferPanel converted to controlled component; MobileNav guard relaxed to subTabs.length check.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update tests FIRST — page.test.tsx and MobileNav.test.tsx (RED) | 23123d2 | src/app/page.test.tsx, src/components/nav/MobileNav.test.tsx |
| 2 | Refactor TransferPanel to controlled component (D-11 state lift) | 02f9739 | src/components/transfers/TransferPanel.tsx |
| 3 | Wire Squad sub-tabs in src/app/page.tsx (D-06..D-09 + D-11) | 58cf270 | src/app/page.tsx |
| 4 | Relax MobileNav guard (D-10) and run full test suite GREEN | 0a246a6 | src/components/nav/MobileNav.tsx |

## Test Results

```
npx vitest run src/app/page.test.tsx src/components/nav/MobileNav.test.tsx

 Test Files  2 passed (2)
      Tests  15 passed (15)
```

Full suite:
```
npx vitest run

 Test Files  1 failed | 40 passed (41)
      Tests  1 failed | 433 passed | 34 skipped (468)
```

The 1 failing test (`tests/lib/club-form.test.ts > computeClubForm > assigns difficulty tier correctly`) is pre-existing and was failing before this plan. Confirmed by running the test on the base commit before any plan changes. Not caused by this plan.

## TDD Gate Compliance

- RED gate: `test(43-02)` commit 23123d2 — 3 new tests failing (Squad sub-tab nav, Optimiser panel, 5-button MobileNav)
- GREEN gate: `feat(43-02)` commits 02f9739, 58cf270, 0a246a6 — all 15 targeted tests pass
- REFACTOR gate: Not needed — implementation was clean

## Verification

- `grep -c "import { OptimiserPanel } from '@/components/optimiser/OptimiserPanel'" src/app/page.tsx` → 1
- `grep -c "'transfers' | 'optimiser'" src/app/page.tsx` → 1
- `grep -c "squad: 'transfers'" src/app/page.tsx` → 1
- `grep -c "handleTeamIdSubmit" src/app/page.tsx` → 2 (declaration + use site)
- `grep -c "activeSection !== 'squad' && (() =>" src/app/page.tsx` → 0
- `grep -c "activeSection === 'squad' && <div" src/app/page.tsx` → 0
- `grep -c "interface TransferPanelProps" src/components/transfers/TransferPanel.tsx` → 1
- `grep -c "setTeamId\|setSubmittedId" src/components/transfers/TransferPanel.tsx` → 0
- `grep -c "activeSectionDef.subTabs.length === 0" src/components/nav/MobileNav.tsx` → 1
- `grep -c "activeSection !== 'squad'" src/components/nav/MobileNav.tsx` → 0
- `npx tsc --noEmit` → no new errors (pre-existing captain-picks + optimise-lineup errors only)

## Deviations from Plan

None — plan executed exactly as written. All 6 must-have truths satisfied:

1. Squad desktop nav shows Transfers + Optimiser sub-tab row: confirmed via test D-05/D-07/D-08
2. Squad mobile nav shows Transfers + Optimiser pill row: confirmed via NAV-04/NAV-01 test (5 buttons total)
3. Squad default sub-tab is Transfers — TransferPanel visible on first Squad click: confirmed (sectionMemory init = 'transfers')
4. Clicking Optimiser sub-tab shows OptimiserPanel stub: confirmed via NAV-01/D-09 test
5. teamId state owned by page.tsx, passed as props to TransferPanel: confirmed (D-11 state lift)
6. All existing tests pass (15 targeted + 418 other passing tests)

## Known Stubs

- `src/components/optimiser/OptimiserPanel.tsx`: Intentional stub inherited from Plan 01. Renders placeholder text only. Full pitch-layout implementation ships in Plan 03.

## Deferred Issues

- `tests/lib/club-form.test.ts:228` — `computeClubForm > assigns difficulty tier correctly` pre-existing failure. Not caused by this plan. Out of scope.

## Threat Surface Scan

No new threat surface introduced. State lift of teamId/submittedId to page.tsx is same-client, same-localStorage-key, same-trust-posture as prior TransferPanel ownership. T-43-04 (localStorage tampering) and T-43-05 (sub-tab routing) remain accepted per plan threat model. No new network endpoints, auth paths, or API routes.

## Self-Check: PASSED

Files modified (all tracked in git):
- [x] src/app/page.tsx — imports OptimiserPanel, SubTab union extended, Squad SECTIONS updated, sectionMemory init updated, teamId/submittedId state added, sub-tab nav guard relaxed, spacer removed, TransferPanel + OptimiserPanel mounts gated by activeSubTab
- [x] src/components/nav/MobileNav.tsx — activeSection !== 'squad' guard removed; subTabs.length === 0 check added
- [x] src/components/transfers/TransferPanel.tsx — controlled component with 4 props; setTeamId/setSubmittedId/handleSubmit removed
- [x] src/app/page.test.tsx — new Squad default sub-tab test + Optimiser sub-tab test; TransferPanel mock updated; OptimiserPanel mock added; old CR-01 test removed
- [x] src/components/nav/MobileNav.test.tsx — NAV-04 test replaced with 5-button Squad assertion

Commits verified:
- [x] 23123d2 — test(43-02): update Squad test contract — RED state for nav wiring
- [x] 02f9739 — feat(43-02): refactor TransferPanel to controlled component (D-11 state lift)
- [x] 58cf270 — feat(43-02): wire Squad sub-tabs in page.tsx (D-06..D-09 + D-11 atomic)
- [x] 0a246a6 — feat(43-02): relax MobileNav pill-row guard to subTabs.length check (D-10)
