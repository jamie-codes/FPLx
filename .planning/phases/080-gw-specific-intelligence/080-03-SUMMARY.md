---
phase: "080"
plan: "03"
subsystem: frontend
tags: [frontend, insights, ui, react, gw-intel, typescript]
dependency_graph:
  requires:
    - phase: "080-02"
      provides: [useGWIntel hook, GWInsight discriminated union, GWIntelResponse, RotationRiskBadge]
  provides:
    - src/components/insights/InsightsTab.tsx GWIntelSection (always-rendered first section)
    - src/components/insights/InsightsTab.tsx PositionOpportunityCardView, RotationRiskCardView, DGWBGWCardView, FixtureRunCardView
    - src/components/insights/InsightsTab.tsx XptsTrajectoryBar (3-bar trajectory, DGW suffix)
    - src/components/insights/InsightsTab.tsx GWCard (discriminated-union switch, exhaustiveness check)
    - src/components/insights/InsightsTab.test.tsx 9 new Phase 80 tests (GWI-02, GWI-04, GWI-05)
  affects: [080-04 (SetPieceTakerPanel + TransferPanel badge integration)]
tech_stack:
  added: []
  patterns:
    - "GWIntelSection always renders (GWI-05) — no early return, no null; always first in DOM"
    - "InsightsTab refactored from early-return style to single-root return with inline conditional subtrees"
    - "XptsTrajectoryBar uses inline style={{ height }} for runtime-computed pixel heights (Tailwind cannot generate arbitrary values)"
    - "GWCard discriminated-union switch with `_never: never` exhaustiveness — unknown types silently drop (T-080-17)"
    - "beforeEach default-mocks useGWIntel so Phase 79 tests are unaffected by new hook"
key_files:
  created: []
  modified:
    - src/components/insights/InsightsTab.tsx
    - src/components/insights/InsightsTab.test.tsx
decisions:
  - "GWIntelSection placed before DecisionSummary in DOM — GW intel is the most forward-looking signal"
  - "InsightsTab refactored from early-return pattern to single-root return — required so GWIntelSection always renders regardless of season-insights fetch state (GWI-05)"
  - "GWIntelResponse import removed from InsightsTab.tsx — not needed in component scope (only card variants needed); prevents unused-import warning"
  - "9 new Phase 80 tests added (not 8 as plan stated minimum) — extra test for DGW marker (†) suffix"
metrics:
  duration: "~10 min"
  completed: "2026-05-08"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 2
---

# Phase 080 Plan 03: InsightsTab GW Intel Section (GWI-02/GWI-04/GWI-05) Summary

**"This Gameweek" section added to InsightsTab as first always-rendered collapsible section — 4 GW card variants + 3-bar xPts trajectory bar, all UI-SPEC token-compliant, 26 tests passing.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-05-08
- **Tasks:** 2/2
- **Files modified:** 2 (0 created)

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add GWIntelSection + 4 card components + XptsTrajectoryBar to InsightsTab.tsx | 8407212 | src/components/insights/InsightsTab.tsx |
| 2 | Extend InsightsTab.test.tsx with GW section + GWI-05 empty-state tests | 164b321 | src/components/insights/InsightsTab.test.tsx |

## What Was Built

### New Components (co-located in InsightsTab.tsx)

- **`GWIntelSection`** — Calls `useGWIntel()`, always renders `CollapsibleSection label="This Gameweek"`. Three states: loading → "Loading GW insights…", error/empty → "GW insights will appear once fixtures are confirmed." (D-08 EXACT), cards present → `GWCard` map.

- **`PositionOpportunityCardView`** — Renders `gw_label`, `position`, `narrative` fields. Card shell: `rounded border border-border bg-surface p-4 space-y-2`.

- **`RotationRiskCardView`** — Renders `team_short_name`, `competition` clash copy, optional `table_stakes_label` context line.

- **`DGWBGWCardView`** — Derives `kindLabel` from `card.is_dgw`: "Double Gameweek" / "Blank Gameweek". Renders team name + explanatory copy.

- **`XptsTrajectoryBar`** — `flex items-end h-10 gap-2` container. Each bar: height computed as `max(4, min(32, round((x/max)*32)))px` via inline style. Current GW bar (`current_gw_index=0`): `bg-primary`; future: `bg-surface-elevated`. Axis label: `GW{N}†` when `is_dgw[i]`.

- **`FixtureRunCardView`** — Renders `web_name`, `narrative`, `XptsTrajectoryBar`, and `† Double Gameweek` footnote when any `is_dgw` is true.

- **`GWCard`** — Switch on `card.type` dispatching to the 4 card views. `default` branch with `_never: never` exhaustiveness check; returns null silently for unknown types (T-080-17 mitigation).

### InsightsTab Refactor

Replaced early-return pattern with single `<section>` root:
1. `<GWIntelSection />` — always first (D-07, GWI-05)
2. Season-insights subtree — inline conditional rendering for loading/error/empty/populated states (replaces former early returns)

This ensures the GW section is always visible regardless of season-insights fetch state.

### Test Suite Extension

9 new Phase 80 tests in `InsightsTab.test.tsx`:
1. Section header "This Gameweek" renders
2. Empty-state placeholder when cards array is empty (GWI-05)
3. Empty-state placeholder when data is undefined (GWI-05)
4. Empty-state placeholder on fetch error (GWI-05)
5. FixtureRunCard renders narrative + 3 axis labels + 3 bar elements with aria-labels
6. DGW marker (†) suffix on axis label + "† Double Gameweek" footnote
7. RotationRiskCard renders team_short_name + table_stakes_label
8. DGWBGWCard renders Double/Blank Gameweek labels for is_dgw=true/false
9. DOM order test: "This Gameweek" appears before "Priority Insights" in innerHTML

## Test Results

- `src/components/insights/InsightsTab.test.tsx`: **26/26 tests pass**
  - 17 Phase 79 tests (all preserved, unaffected)
  - 9 Phase 80 tests (all new)
- `npx tsc --noEmit`: exits 0 (no TypeScript errors)

## Deviations from Plan

### Minor Deviations

**1. [Discretion] GWIntelResponse removed from InsightsTab.tsx import**
- **Found during:** Task 1 implementation
- **Issue:** `GWIntelResponse` was listed in the plan's Edit 1 import block but is not used in the component scope (only `GWInsight` and the 4 card variants are needed). TypeScript would flag it as an unused import.
- **Fix:** Removed from the type import list. The type is fully available in the test file where it is used.
- **Impact:** None — component compiles cleanly.

**2. [Discretion] 9 tests added instead of 8**
- **Context:** Plan specified "at least 8 new Phase 80 tests". An extra test for the DGW marker (†) suffix was added as it tests a distinct rendering path (the `hasDgw` boolean gate and `† Double Gameweek` footnote).
- **Impact:** Stronger coverage of FixtureRunCardView DGW path.

## Known Stubs

None — all 4 card views render real discriminated-union data. `GWIntelSection` renders live data from `useGWIntel()` hook. No placeholder values.

## Threat Flags

No new threat surface beyond plan's threat model (T-080-14 through T-080-20):
- T-080-14 (XSS): All string fields rendered as React children — auto-escaped. No `dangerouslySetInnerHTML`.
- T-080-17 (Tampering): `default: { const _never: never = card; void _never; return null }` in GWCard switch.
- T-080-16 (Info disclosure): Error state shows generic copy, not error message.

## Open Visual Checkpoints (for Developer)

1. **Dev server smoke test** — `npm run dev`, navigate to Insights tab. With `pipeline/cache/gw_intel.json` present (from Plan 01 pipeline run), verify "This Gameweek" section appears first with GW cards rendered.
2. **Empty-state smoke test** — Delete or rename `pipeline/cache/gw_intel.json`, reload. Verify "This Gameweek" section still appears with empty-state placeholder (not absent from DOM).
3. **Trajectory bar visual** — With FixtureRunCard data present, verify bars have correct relative heights (tallest bar = 32px, shortest bar >= 4px, bottom-aligned).
4. **DGW suffix** — With a FixtureRunCard where `is_dgw[0]=true`, verify "GW{N}†" axis label and "† Double Gameweek" footnote appear.
5. **Dark mode** — Verify `bg-primary` and `bg-surface-elevated` trajectory bars are distinguishable in both light and dark mode.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/components/insights/InsightsTab.tsx modified | FOUND |
| src/components/insights/InsightsTab.test.tsx modified | FOUND |
| commit 8407212 (Task 1) | FOUND |
| commit 164b321 (Task 2) | FOUND |
| 26/26 tests pass | PASS |
| tsc --noEmit exits 0 | PASS |
| GWIntelSection always renders (GWI-05) | PASS |
| GWIntelSection DOM-first (D-07) | PASS |
| No hex literals | PASS |
| No font-medium or font-bold | PASS |
