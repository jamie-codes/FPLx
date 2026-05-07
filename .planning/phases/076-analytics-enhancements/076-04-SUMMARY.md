---
phase: 076-analytics-enhancements
plan: 04
subsystem: ui
tags: [react, vitest, rtl, captain, vc, override, lineup, state-machine, session-only]

# Dependency graph
requires:
  - phase: 072
    provides: LineupTab swap state machine, D-08 no-localStorage constraint, pitch card testids
  - phase: 076-01
    provides: Phase 76 planning context and UI-SPEC design contract
provides:
  - PlayerCard refactored from nested-button to div+sibling-button structure
  - Captain/VC override state machine (captainOverrideId, vcOverrideId) in LineupTab
  - Set C / Set VC per-card pill buttons with direct-commit interaction model
  - effectiveCaptainId / effectiveVcId derived values used throughout
  - Auto-shuffle: setting captain to current VC moves VC to previous captain
  - OPT-01 vitest coverage (8 cases), Phase 72 regression tests preserved
affects:
  - LineupTab future work (captain display, xPts accuracy)
  - Any plan reading LineupTab card structure (OPT2-02 pitch visual)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct-commit pill model: always-visible Set C/Set VC pills dispatch in one tap (no arm state)"
    - "Div wrapper + sibling buttons avoids nested-<button> HTML invalidity"
    - "effectiveId = overrideId ?? algorithmId: simple nullable override pattern"
    - "Mutual exclusion: setCaptain/setVc call setPendingStarterId(null) to clear swap arm"

key-files:
  created: []
  modified:
    - src/components/squad/LineupTab.tsx
    - src/components/squad/LineupTab.test.tsx

key-decisions:
  - "Direct-commit pills per UI-SPEC §OPT-01 (locked): no arm state, no pendingCaptainArmedId — single-tap dispatch"
  - "PlayerCard outer element is <div> not <button> to avoid nested-button HTML invalidity (UI-SPEC §Pitfall)"
  - "Auto-shuffle rule: Set C on current VC moves VC to previous captain atomically"
  - "D-08 carry-forward: no localStorage/sessionStorage writes for captain/VC override"
  - "Phase 72 tests updated with pitch-card-body-{id} and :not([data-testid^='pitch-card-body-']) selectors"

patterns-established:
  - "Set C / Set VC pills are siblings of the body button inside the card wrapper div"
  - "captainOverrideId ?? lineup.captainId pattern for nullable session-only overrides"

requirements-completed: [OPT-01]

# Metrics
duration: 15min
completed: 2026-05-07
---

# Phase 76 Plan 04: Captain/VC Override Summary

**Session-only captain and VC override on LineupTab via always-visible per-card Set C / Set VC pills, with auto-shuffle collision avoidance and zero localStorage writes**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-07T11:17:00Z
- **Completed:** 2026-05-07T11:24:52Z
- **Tasks:** 3 (Task 1 RED, Task 2a structural refactor, Task 2b GREEN)
- **Files modified:** 2

## Accomplishments

- PlayerCard refactored from a single outer `<button>` to a `<div>` wrapper containing a body `<button>` (for swap interactions) and sibling Set C / Set VC `<button>` pills — eliminating the nested-button HTML invalidity
- Captain/VC override state machine: `captainOverrideId` + `vcOverrideId` state, derived `effectiveCaptainId` / `effectiveVcId`, auto-shuffle on C+VC collision, Reset and `useEffect([initialLineup])` both clear overrides (RESEARCH Pitfall 2)
- `captainBonus` now uses `effectiveCaptainId` so Total xPts in the headline row reflects the user's chosen captain
- 8 OPT-01 vitest cases pass; all 12 Phase 72 tests preserved and updated for new card structure

## Task Commits

1. **Task 1: OPT-01 failing test cases (RED)** — `5a42b70` (test)
2. **Task 2a: PlayerCard refactor — div wrapper + pill row** — `509ebfa` (feat)
3. **Task 2b: State machine + prop threading (GREEN)** — `427d0df` (feat)

## Files Created/Modified

- `src/components/squad/LineupTab.tsx` — PlayerCard refactored; `captainOverrideId` / `vcOverrideId` state; `effectiveCaptainId` / `effectiveVcId` derived values; `setCaptain` / `setVc` handlers with auto-shuffle and mutual exclusion; PitchRowProps extended; all 5 PitchRow JSX invocations updated
- `src/components/squad/LineupTab.test.tsx` — 8 OPT-01 cases added; Phase 72 tests updated with `pitch-card-body-{id}` and `:not([data-testid^="pitch-card-body-"])` selector fixes

## Decisions Made

- **Direct-commit pills (UI-SPEC locked decision):** Always-visible Set C / Set VC pills with single-tap dispatch — no arm/commit two-step. This supersedes RESEARCH.md's arm/commit recommendation per UI-SPEC §OPT-01 line 202 and §Rejected Patterns line 312.
- **Div wrapper to avoid nested buttons:** HTML validity requires the outer card element to be a `<div>` with sibling `<button>` elements rather than a `<button>` containing other `<button>` elements.
- **Auto-shuffle atomic:** When Set C is pressed on the current VC, both `captainOverrideId` and `vcOverrideId` are set atomically (single React render) — no intermediate state where C and VC share a card.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Phase 72 swap tests failing after PlayerCard refactor**
- **Found during:** Task 2a
- **Issue:** Phase 72 tests clicked `[data-testid="pitch-card-{id}"]` as a button and checked `data-pending` on it. After refactor, `pitch-card-{id}` is a `<div>` (not clickable), and `data-pending` lives on `pitch-card-body-{id}`.
- **Fix:** Updated Phase 72 test selectors: click `pitch-card-body-{id}`, check `data-pending` on body button, use `:not([data-testid^="pitch-card-body-"])` when counting outer card divs, use `pitch-card-body-*` for `disabled` checks on bench cards.
- **Files modified:** `src/components/squad/LineupTab.test.tsx`
- **Verification:** All 12 Phase 72 tests pass after update.
- **Committed in:** `509ebfa` (Task 2a commit)

**2. [Rule 1 - Bug] OPT-01 tests: `.closest('[data-testid^="pitch-card-"]')` found body button before outer div**
- **Found during:** Task 2b
- **Issue:** The captain/VC badge spans are nested inside the body button (`pitch-card-body-{id}`). `.closest('[data-testid^="pitch-card-"]')` traverses up the DOM and finds the body button first before the outer `pitch-card-{id}` div.
- **Fix:** Changed all OPT-01 `.closest()` calls to `.closest('[data-testid^="pitch-card-"]:not([data-testid^="pitch-card-body-"])')` using a bulk replace.
- **Files modified:** `src/components/squad/LineupTab.test.tsx`
- **Verification:** All 8 OPT-01 tests pass after fix.
- **Committed in:** `427d0df` (Task 2b commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs from structural refactor changing testid locations)
**Impact on plan:** Both fixes were direct consequences of the planned structural refactor. No scope creep.

## Issues Encountered

- The plan's acceptance criterion for `grep -c "captainOverrideId"` returning "at least 4" does not match the actual count (2 lines match the lowercase `captainOverrideId` variable; the setter `setCaptainOverrideId` uses uppercase `C` in `Captain`). All functional tests pass and the pattern is correctly implemented — this is purely a documentation mismatch in the acceptance criteria.

## vitest Output

```
Test Files  1 passed (1)
     Tests  20 passed (20)
```

8 OPT-01 tests + 12 Phase 72 tests all green. No localStorage writes.

## Threat Model Compliance

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-076-11: Captain override persisted to localStorage | Regex `/lineup\|override\|swap\|captain\|vc/i` spy asserts 0 writes | Mitigated |
| T-076-12: captain == VC after override | Auto-shuffle in `setCaptain(id)` when `id === effectiveVcId`; Set VC pill on captain is `disabled`+`aria-disabled`; `setVc` returns early when `id === effectiveCaptainId` | Mitigated |
| T-076-13: Stale override after squad refresh | `useEffect([initialLineup])` clears `captainOverrideId` and `vcOverrideId`; Test 6 asserts this | Mitigated |
| T-076-15: Nested button HTML invalidity | PlayerCard refactored to `<div>` + sibling `<button>`s | Mitigated |

## No Known Stubs

All Set C / Set VC functionality is fully wired. `effectiveCaptainId` is used in both the badge rendering and `captainBonus` calculation. No placeholder data flows.

## Next Phase Readiness

- OPT-01 complete; ready for OPT2-02 (pitch visual with player kit art) which extends the same card structure
- The `pitch-card-{id}` / `pitch-card-body-{id}` testid convention is now established and documented

---
*Phase: 076-analytics-enhancements*
*Completed: 2026-05-07*

## Self-Check: PASSED

Files exist:
- `src/components/squad/LineupTab.tsx` — FOUND
- `src/components/squad/LineupTab.test.tsx` — FOUND
- `.planning/phases/076-analytics-enhancements/076-04-SUMMARY.md` — (this file)

Commits exist:
- `5a42b70` — FOUND (test(076-04): add failing OPT-01 captain/VC override test cases)
- `509ebfa` — FOUND (feat(076-04): refactor PlayerCard to div wrapper + add Set C/VC pill row)
- `427d0df` — FOUND (feat(076-04): wire captain/VC override state machine)
