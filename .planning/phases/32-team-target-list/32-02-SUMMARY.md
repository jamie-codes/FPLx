---
phase: 32-team-target-list
plan: "02"
subsystem: ui
tags: [react, club-form, target-list, badge, expand-on-click, xgi, vitest, testing-library]

dependency_graph:
  requires:
    - phase: "32-01"
      provides: "computeXgiInvolvement utility + expected_goals/expected_assists on MergedPlayer"
    - phase: "27"
      provides: "ClubForm.upcoming_fixtures[].attacking_difficulty (FDR++ pipeline)"
    - phase: "29"
      provides: "RegressionSignalBadge + regression_signal on MergedPlayer"
    - phase: "30"
      provides: "DifferentialBadge + differential_flag on MergedPlayer"
  provides:
    - "TARGET badge on FixtureEaseRankingPanel rows for teams with 4+ favourable next-5 fixtures (attacking_difficulty < 0.5)"
    - "Expand-on-click inline player table: top-3 players by xGI% descending, showing xPts, Signal, Diff"
    - "Keyboard-operable expand/collapse (tabIndex=0, role=button, Enter/Space handler)"
    - "Single-open invariant: only one team expanded at a time"
    - "18-test component test suite covering all TGT-01/02/03 behaviours"
  affects:
    - "Phase 32 human-verify checkpoint: visual verification of TARGET badge + expand behaviour on Club Form tab"

tech-stack:
  added: []
  patterns:
    - "expandedTeamId: number | null state with single-open invariant — toggle same row off, replace on different row"
    - "React.Fragment key wrapper for <ul> list with inline sibling expansion block"
    - "useMemo for computeXgiInvolvement keyed to players reference (one-pass per player-data change)"
    - "getTopPlayers pure helper: filter(status=a) + sort(xgiMap desc) + slice(3)"
    - "Spread conditional props pattern {...(isTarget ? { onClick, onKeyDown, tabIndex, role } : {})} for non-interactive rows"
    - "eslint-disable no-explicit-any at file scope for test mocks using React Query return shapes"

key-files:
  created:
    - path: "tests/components/club-form/FixtureEaseRankingPanel.test.tsx"
      description: "18 component tests: 7 baseline panel tests + 2 TARGET badge gate tests + 9 expand/collapse/keyboard/badge tests"
  modified:
    - path: "src/components/club-form/FixtureEaseRankingPanel.tsx"
      description: "Extended with TARGET badge, expandedTeamId state, usePlayers + xgiMap integration, expand-on-click inline player table"

key-decisions:
  - "React.Fragment with key wraps each (team-row, expansion-row) pair — required because React fragment shorthand <> cannot hold a key prop, and the expansion <li> is a sibling not a child"
  - "eslint-disable @typescript-eslint/no-explicit-any at file scope in test file — mock objects for useClubForm and usePlayers require as any since full React Query return shape is complex; matches pre-existing pattern in mins-risk-badge.test.ts"
  - "TARGET data-testid uses lowercase prefix target-badge-{name} matching test assertions — plan acceptance criterion grep -c TARGET (uppercase) counts only the badge label text (1), not the testid; the criterion comment was written with uppercase prefix but lowercase is consistent with project testid naming convention"

patterns-established:
  - "React.Fragment key wrapper pattern for paired (row + inline-expansion) rendering inside <ul> — reusable for any expandable-row-list in this codebase"

requirements-completed: [TGT-01, TGT-02, TGT-03]

duration: "3min"
completed: "2026-04-28"
---

# Phase 32 Plan 02: FixtureEaseRankingPanel TARGET Badge + Expand-on-Click Summary

**Green TARGET badge on Club Form fixture ease rows for teams with 4+ favourable next-5 fixtures, with expand-on-click inline top-3 player table showing xGI%, xPts, Signal (BUY/SELL), and Diff (DIFF/TRAP)**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-28T16:17:24Z
- **Completed:** 2026-04-28T16:20:45Z
- **Tasks:** 1 (auto) + 1 (checkpoint:human-verify — pending)
- **Files modified:** 2

## Accomplishments

- Extended `FixtureEaseRankingPanel.tsx` (+91 lines net) with TARGET badge qualification logic, `expandedTeamId` state, keyboard handlers, and inline expand table with all 6 locked column headers
- Integrated `computeXgiInvolvement` (Plan 01 utility) via `useMemo` for efficient per-render xGI map; integrated `usePlayers` hook alongside existing `useClubForm`
- Shipped 18 component tests (7 preserving existing baseline behaviours + 2 TARGET badge gate + 9 expand/collapse/keyboard/badge assertions); full suite 299 passing, 34 skipped, 0 failed

## Task Commits

1. **Task 1: Extend FixtureEaseRankingPanel + component tests** - `60dd482` (feat)

**Plan metadata:** TBD (docs commit)

## Files Created/Modified

- `src/components/club-form/FixtureEaseRankingPanel.tsx` — Extended from 73 to 165 lines:
  - Lines 1–11: imports block (added React default, useMemo, usePlayers, computeXgiInvolvement, RegressionSignalBadge, DifferentialBadge, MergedPlayer)
  - Lines 14–28: module-level POS_LABEL constant, posLabel() helper, getTopPlayers() helper
  - Lines 30–36: type/helper declarations preserved unchanged
  - Lines 40–45: expanded state block — added expandedTeamId, usePlayers, xgiMap useMemo
  - Lines 58–165: return block — React.Fragment key wrapper; isTarget + isExpanded + topPlayers per row; TARGET badge + chevron on qualifying rows; inline expansion table with all 6 columns
- `tests/components/club-form/FixtureEaseRankingPanel.test.tsx` — Replaced with unified 350-line file:
  - eslint-disable comment for no-explicit-any (test mock casts)
  - Unified vi.mock pattern for useClubForm + usePlayers
  - makeFixture(), makeClubForm(), makePlayer() fixture helpers
  - 3 describe blocks: baseline panel (7 tests), TARGET badge gate (2 tests), expand/collapse (9 tests)

## Vitest Output

```
Test Files  1 passed (1)
Tests  18 passed (18)
Duration  821ms
```

Full suite: 28 test files, 299 passed, 34 skipped, 0 failed.

## TypeScript / Lint Outcomes

- `npx tsc --noEmit`: exits 0 for all files (5 pre-existing errors in `tests/lib/captain-picks.test.ts` not caused by this plan — documented in 32-01 SUMMARY)
- `npm run lint`: 8 errors / 16 warnings — identical to pre-plan baseline; 0 new errors introduced by this plan's files

## Human-Verify Checkpoint

**Status: Pending** — Task 2 checkpoint returned to orchestrator for user verification.

Verification requires:
1. Run `npm run dev` and open http://localhost:3000 → Club Form tab
2. Confirm TARGET badge appears on teams with 4+ favourable fixtures; hover for tooltip text
3. Click a TARGET row → inline player table expands with correct columns and data
4. Click same row → collapses; click different TARGET row → single-open invariant
5. Click non-TARGET row → no expansion
6. Verify ATT/DEF and GW toggles do not affect TARGET qualification
7. Tab focus + Enter/Space keyboard expand works on TARGET rows

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added eslint-disable for @typescript-eslint/no-explicit-any in test file**

- **Found during:** Task 1 (lint run)
- **Issue:** Plan template provides `} as any)` mock casts but project lint rules forbid `@typescript-eslint/no-explicit-any`. Without the disable, 15 new lint errors were introduced (baseline: 8 errors; after test file: 23 errors).
- **Fix:** Added `/* eslint-disable @typescript-eslint/no-explicit-any */` at the top of the test file. This is the correct pattern for test files using React Query mock shapes — same approach as `tests/lib/mins-risk-badge.test.ts` (pre-existing).
- **Files modified:** `tests/components/club-form/FixtureEaseRankingPanel.test.tsx`
- **Verification:** `npm run lint` returned to baseline 8 errors / 16 warnings after fix
- **Committed in:** 60dd482

---

**Total deviations:** 1 auto-fixed (Rule 2 — lint compliance)
**Impact on plan:** Necessary for lint parity; no scope change.

### Acceptance Criteria Note

One acceptance criterion reads `grep -c "TARGET" src/components/club-form/FixtureEaseRankingPanel.tsx` is at least 2. The plan's interface section specified `data-testid={\`target-badge-${team.team_short_name}\`}` (lowercase `target`). The uppercase `TARGET` string appears exactly once (badge label text); the testid uses lowercase `target-badge-`. The criterion comment "(badge text + testid prefix)" was written assuming an uppercase testid, but lowercase is consistent with the project's testid naming convention. All tests pass confirming the implementation is correct.

## Issues Encountered

None — implementation proceeded cleanly. The single deviation (eslint-disable) was caught on first lint run and resolved immediately.

## Known Stubs

None — all data is wired live via `useClubForm()` + `usePlayers()` hooks. No hardcoded fixtures or placeholder values. The xGI% renders em-dash for players in zero-total teams (correct handling per Plan 01 utility zero-division guard).

## Threat Flags

None — implementation is purely additive UI over existing hooks. No new network endpoints, auth paths, or trust boundary changes:
- T-32-05 (XSS): React auto-escapes all text nodes; no `dangerouslySetInnerHTML`; native `title` attributes are browser-escaped. Satisfied.
- T-32-06 (Tampering): `parseFloat(p.selected_by_percent)` can produce NaN; DifferentialBadge handles NaN gracefully via its existing null guard. Satisfied.
- T-32-07 (DoS): `getTopPlayers` only called for the single expanded team; `xgiMap` is useMemo'd. Satisfied.

## Self-Check: PASSED

- `src/components/club-form/FixtureEaseRankingPanel.tsx` exists: FOUND
- `tests/components/club-form/FixtureEaseRankingPanel.test.tsx` exists: FOUND
- Task 1 commit 60dd482 exists: CONFIRMED
- `npx tsc --noEmit` (excluding pre-existing captain-picks errors): exits 0
- `npx vitest run tests/components/club-form/FixtureEaseRankingPanel.test.tsx`: 18/18 PASSING
- `npx vitest run`: 28/28 test files, 299/299 tests PASSING
- `npm run lint`: 8 errors / 16 warnings (matches pre-plan baseline exactly)

---
*Phase: 32-team-target-list*
*Completed: 2026-04-28*
