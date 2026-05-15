---
phase: 112
plan: "02"
subsystem: optimiser
tags: [fpl, optimiser, ui, react, tdd, opt-01, tfr-02, hasrun, cap-by-position]
dependency_graph:
  requires:
    - "src/lib/cap-transfer-suggestions.ts (Plan 01 — capByPosition + CappedSuggestions)"
  provides:
    - "src/components/optimiser/OptimiserPanel.tsx (hasRun gate + ready-state + capped suggestions)"
    - "src/components/optimiser/OptimiserPanel.test.tsx (OPT-01 + TFR-02 tests)"
  affects:
    - "User-facing Optimiser sub-tab behavior (button gate + transfer cap)"
tech_stack:
  added: []
  patterns:
    - "useState(false) gate — hasRun boolean, flip on button click, never reset by control changes"
    - "useMemo early-return for hasRun gate (first branch, before data-readiness guard)"
    - "Destructured useMemo returning two values (transferSuggestions + transferTotalsByPosition)"
    - "IIFE in JSX for grouped render with per-group footnote (Map.entries() iteration)"
    - "clickOptimiseIfPresent helper for backward-compat test wiring"
key_files:
  created: []
  modified:
    - src/components/optimiser/OptimiserPanel.tsx
    - src/components/optimiser/OptimiserPanel.test.tsx
decisions:
  - "hasRun early-return inserted as FIRST branch inside lineup useMemo — dep array extended with hasRun"
  - "Ready-state returned as a SEPARATE early-return branch (after data-readiness guards, before lineup===null) so controls are rendered in it (D-01)"
  - "transferSuggestions useMemo restructured to return { transferSuggestions, transferTotalsByPosition } destructure — backward compat for downstream render code preserved"
  - "Transfer suggestion grouping uses IIFE in JSX to scope Map construction inline — avoids hoisting grouped to component scope"
  - "clickOptimiseIfPresent hoisted to module scope so all Phase 44/45/46 describe blocks can reuse it"
  - "BGW critical tests also received clickOptimiseIfPresent — plan comment said DO NOT add but was incorrect; without click, test lands in ready-state not bgw-critical state"
metrics:
  duration: "~9 minutes"
  completed_date: "2026-05-15"
  tasks: 2
  files_created: 0
  files_modified: 2
  lines: "+200 / -93 (net +107)"
---

# Phase 112 Plan 02: OptimiserPanel Button Gate + Transfer Cap (OPT-01 + TFR-02) Summary

**One-liner:** hasRun boolean gates the lineup engine behind a 'Optimise Lineup' button click; transferSuggestions wrapped with capByPosition(3) and grouped by element_type with per-position truncation footnote.

## Files Modified

| File | Delta | Description |
|------|-------|-------------|
| `src/components/optimiser/OptimiserPanel.tsx` | +168 / -76 | hasRun state, ready-state placeholder, lineup useMemo gate, capByPosition wrap, grouped transfer render |
| `src/components/optimiser/OptimiserPanel.test.tsx` | +142 inserted (Task 1) + ~60 edits (Task 2) | 8 new Phase 112 tests + clickOptimiseIfPresent applied to all existing tests |

## 8 New Phase 112 Test Cases

1. **renders ready-state placeholder with 'Optimise Lineup' button on tab mount (hasRun === false default)** — asserts `optimiser-ready-state` and `optimise-button` exist on mount
2. **does NOT call optimiseLineup engine before button click** — asserts `comparison-table` and `headline-row` are null pre-click
3. **controls (GwToggle, ChipModeToggle) are rendered above the placeholder pre-click (D-01)** — asserts chip-mode-toggle-mock and a GwToggle button exist in ready-state
4. **clicking 'Optimise Lineup' renders comparison-table and removes ready-state placeholder (D-03)** — click → comparison-table visible, optimiser-ready-state gone
5. **after click, changing horizon re-computes WITHOUT re-showing the button (D-03 re-trigger policy)** — click optimise → click '5 GWs' → ready-state still absent, comparison-table still present
6. **applies capByPosition(3) to transferSuggestions and renders at most 3 rows per element_type** — 5 MID singles mocked; post-cap only 3 suggestion-rows render
7. **renders cap-footnote-MID with correct copy when MID bucket truncated (D-07)** — same 5 MID setup; `cap-footnote-MID` renders with 'Showing top 3 of 5 MID suggestions.'
8. **renders NO cap-footnote elements when every bucket has ≤ 3 (D-07 silent)** — 2 MID + 2 DEF singles; no `[data-testid^="cap-footnote-"]` elements

## Existing Tests Updated with clickOptimiseIfPresent

All tests that assert on post-engine artifacts (comparison-table, headline-row, suggestion-row, ft-toggle, bb-notice, chip-squad-view-mock, badge-promoted, badge-dropped, bgw-banner-critical, bgw-banner-soft, etc.) received `clickOptimiseIfPresent(container)` immediately after `render(...)`.

Count of tests updated: ~22 existing tests across Phase 44 (OPT-02, CMP-01, CMP-02, CMP-03, OPT-05), Phase 45 (all 9 tests), Phase 46 (8 of 10 tests).

Tests NOT updated (render pre-engine state, no post-engine assertions):
- Phase 44 empty/loading/error tests (lines ~155-183) — no squad data loaded
- Phase 46 'ChipModeToggle renders when squad is loaded' — only checks toggle presence, visible in ready-state

## TDD Gate Compliance

| Gate | Commit | Subject |
|------|--------|---------|
| RED | 6db7845 | `test(112-02): add failing tests for OPT-01 button gate and TFR-02 cap+footnote` |
| GREEN | bfa49b3 | `feat(112-02): button-gate optimiser (OPT-01) and cap transfer suggestions per position (TFR-02)` |

RED confirmed: 7 of 8 new tests failed before implementation (1 passed — controls visible test, which was correct since controls render in the existing pre-implementation code).
GREEN confirmed: all 42 tests pass after implementation.

## Engine Non-Modification Confirmation

`src/lib/suggest-transfers.ts` was NOT modified (D-05 invariant preserved). The cap is applied post-suggestTransfers in the `transferSuggestions` useMemo — engine output is unchanged.

## hasRun Invariant Confirmation (D-03)

`hasRun` is set ONLY via `onClick={() => setHasRun(true)}` on the 'Optimise Lineup' button. It is never reset to false by control changes (horizon, ftCount, chipMode). The lineup useMemo and transferSuggestions useMemo both have `hasRun` in their dep arrays, ensuring recompute on every control change after the first click — no second button click required.

## Note for /gsd-verify-work

**OPT-01 user-perceptible verification:** Open Squad → Optimiser sub-tab with a valid FPL Team ID. EXPECTED: GwToggle + ChipModeToggle visible above a bordered card reading "Configure settings above, then click to calculate the best lineup for your horizon." + green "Optimise Lineup" button. No comparison table visible. Click the button. EXPECTED: comparison table, headline row, transfer suggestions all appear. Toggle horizon from 1 GW to 5 GWs. EXPECTED: results recompute; button does NOT reappear. Refresh the page. EXPECTED: button is back (hasRun resets on remount).

**TFR-02 user-perceptible verification:** After clicking "Optimise Lineup", check the Transfer Suggestions section. If any position group had more than 3 candidates, the rendered list shows exactly 3 rows for that group, followed by a muted "Showing top 3 of N {POSITION} suggestions." footnote. If all groups have ≤ 3, no footnotes appear.

## Deviations from Plan

**1. [Rule 1 - Bug] BGW critical tests also needed clickOptimiseIfPresent**
- **Found during:** Task 2 implementation
- **Issue:** The plan's `<action>` step 7 said "DO NOT add the helper here [BGW critical]". However, with the new `!hasRun` early-return, clicking "Optimise Lineup" is required to reach the BGW critical state. Without the click, the render shows the ready-state placeholder (not the bgw-banner-critical). The plan's comment was based on the incorrect assumption that the helper was only needed to unlock post-engine results.
- **Fix:** Added `clickOptimiseIfPresent(container)` to both OPT-05 BGW tests (critical and soft) and to the Phase 45 "does not render transfer-suggestions-section when lineup is null" test.
- **Files modified:** `src/components/optimiser/OptimiserPanel.test.tsx`
- **Commit:** bfa49b3

All other plan instructions executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. The ready-state button and cap logic are entirely client-side UI with no trust-boundary implications beyond those documented in the plan's threat model (T-112-04 through T-112-07, all accepted).

## Self-Check: PASSED

- `src/components/optimiser/OptimiserPanel.tsx` exists: FOUND
- `src/components/optimiser/OptimiserPanel.test.tsx` exists: FOUND
- Commit 6db7845 (test/RED): FOUND
- Commit bfa49b3 (feat/GREEN): FOUND
- All 42 tests pass: CONFIRMED (npx vitest run src/components/optimiser/OptimiserPanel.test.tsx → 42 passed)
- Full suite pre-existing failures only: CONFIRMED (MobileNav.test.tsx + useRivals.test.ts failures are pre-existing, confirmed by git stash check)
- TypeScript: 1 pre-existing error in src/app/api/decision-history/route.test.ts (unrelated to this plan)
- suggest-transfers.ts unmodified: CONFIRMED
- hasRun never reset by control changes: CONFIRMED (only setHasRun(true) in onClick handler)
