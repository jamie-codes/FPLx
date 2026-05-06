---
phase: 62-mc-rank-simulator-captain-integration
plan: "03"
subsystem: planner-ui
tags: [rank-sim, recharts, tdd, mc-03, fan-chart, transfer-comparison]
dependency_graph:
  requires: [062-02]
  provides: [MC-03]
  affects: [src/app/page.tsx, src/components/planner/RankSimTab.tsx, src/components/nav/MobileNav.test.tsx]
tech_stack:
  added: [recharts@3.8.1 (already installed by Plan 02)]
  patterns: [ComposedChart fan chart, TooltipContentProps, hybrid useSquad/useMyTeam pattern, RTL vi.mock recharts ResponsiveContainer]
key_files:
  created:
    - src/components/planner/RankSimTab.tsx (351 lines)
    - src/components/planner/RankSimTab.test.tsx (409 lines)
  modified:
    - src/app/page.tsx (SubTab union + SECTIONS Plan entry + RankSimTab import + render conditional)
    - src/app/page.test.tsx (RankSimTab mock + Phase 62 nav test + 2 sub-tab order assertions updated)
    - src/components/nav/MobileNav.test.tsx (Phase 62 Plan pill count + Rank Sim label assertion)
    - src/lib/types.ts (removed duplicate MC fields blank_prob/haul_prob/p10_pts/p90_pts)
decisions:
  - "[062-03] TooltipContentProps (not TooltipProps) required for custom Recharts tooltip content in v3.8.1 — TooltipProps omits payload/label/active via PropertiesReadFromContext"
  - "[062-03] Tooltip content must use fn reference `content={CustomTooltip}` not JSX instance `content={<CustomTooltip />}` to satisfy ContentType<ValueType,NameType> constraint"
  - "[062-03] types.ts had duplicate blank_prob/haul_prob/p10_pts/p90_pts — first block from Plan 01 comment, second from Plan 02 — removed second block as Rule 1 auto-fix"
metrics:
  duration: "~45 min (continuation from prior session)"
  completed_date: "2026-05-06"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 6
---

# Phase 62 Plan 03: RankSimTab UI + Page Integration Summary

**One-liner:** Recharts ComposedChart fan chart wired as 4th Plan sub-tab with P(rank) header, sell/buy transfer comparison, captain-sold alt XI label, and full RTL test coverage.

## Status: COMPLETE

All 3 tasks complete. Task 3 (human UAT) approved by user — visual verification passed.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Build RankSimTab component + RTL tests (TDD RED+GREEN) | 395da55 | RankSimTab.tsx, RankSimTab.test.tsx |
| 2 | Wire into page.tsx + update page.test.tsx + MobileNav.test.tsx | febe229 | page.tsx, page.test.tsx, MobileNav.test.tsx, RankSimTab.tsx (TS fixes), types.ts |
| 3 | Human UAT — visual verification of RankSimTab in dev server | — (checkpoint) | Approved by user |

## Task 3 — Human UAT: APPROVED

**Outcome:** User confirmed: approved — all visual checks passed in dev server.

Visual checks completed:
- Recharts fan chart renders (confidence band + mean line): PASSED
- Dark-mode erase-fill correct (Pitfall 2 — `fill="var(--background)"`): PASSED
- P(rank gain) / P(rank drop) header block: PASSED
- Sell/Buy dropdown UX (Buy disabled until Sell selected): PASSED
- Alt XI dashed amber line + legend updates (including "new captain" case): PASSED
- "Clear comparison" resets both dropdowns: PASSED
- Mobile Rank Sim pill visible in Plan section nav: PASSED

## Automated Test Results

### RankSimTab.test.tsx — 10/10 passed

- Test 1: no-squad passive branch (correct copy, no chart, no dropdowns)
- Test 2: squad-loaded happy path (chart container, rank header, Buy disabled)
- Test 3: rank loading em-dash
- Test 4: null teamId em-dash (no error note)
- Test 5: rank fetch error note ("Could not load rank — check your Team ID.")
- Test 6: Buy enabled after Sell; xPts-sorted options; squad excluded
- Test 7: Alt XI legend appears when both Sell + Buy selected
- Test 8: Selling captain updates legend to "Alt XI (new captain: <web_name>)"
- Test 9: Clear comparison resets dropdowns + removes alt XI legend
- Test 10: Graceful render when p10/p90 MC fields absent

### page.test.tsx — 13/13 passed (0 new failures)
### MobileNav.test.tsx — 9/9 passed (0 new failures)

**Total:** 34/34 tests passing across all 3 files

### TypeScript: 0 errors

## Implementation Notes

### RankSimTab.tsx architecture

- Prop shape: `{ submittedId: string | null; horizon: number }` — bank NOT a prop (Pitfall 7)
- Hybrid squad: `picks = myTeamData?.picks ?? squadData?.picks ?? null`
- Chart: `ComposedChart` (NOT `AreaChart`) with Area p90 + Area p10 erase-fill + Line mean + conditional Line altMean
- Confidence band: two Area components with `hide` prop (NOT `tooltipType="none"` — Pitfall 6)
- Dark-mode erase-fill: `fill="var(--background)"` on p10 Area (Pitfall 2)
- Alt XI captain sold: highest `xPts_1gw` player in alt XI becomes new captain (Pitfall 4)
- formatRank: `#1,234,567` en-GB locale format, em-dash for null/undefined

### Recharts v3 type findings (deviation documented)

`TooltipProps<number, string>` omits `payload`, `label`, `active` via `PropertiesReadFromContext`. Custom tooltip content must use `TooltipContentProps` and be passed as a function reference (`content={CustomTooltip}`), not a JSX instance. This was auto-fixed (Rule 1 — TS errors blocking compilation).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Recharts TooltipProps incompatible with custom tooltip pattern**
- **Found during:** Task 2 TypeScript check
- **Issue:** `TooltipProps<number, string>` omits `payload`/`label`/`active` in Recharts v3.8.1 — they moved to `PropertiesReadFromContext` and are excluded from the prop type. Additionally, `Tooltip content={<JSX />}` fails the `ContentType<ValueType,NameType>` contravariance check; requires `content={FunctionRef}`.
- **Fix:** Changed import from `TooltipProps` to `TooltipContentProps`; changed function signature to `TooltipContentProps` (default generics); changed Tooltip usage to `content={CustomTooltip}`.
- **Files modified:** `src/components/planner/RankSimTab.tsx`
- **Commit:** febe229

**2. [Rule 1 - Bug] Duplicate MC fields in types.ts causing TS2300 duplicate identifier errors**
- **Found during:** Task 2 TypeScript check
- **Issue:** `blank_prob`, `haul_prob`, `p10_pts`, `p90_pts` declared twice in `MergedPlayer` interface — once from Phase 61 Plan 01 comment block and once from Phase 61 Plan 02 re-addition.
- **Fix:** Removed the second duplicate block (lines 199-205) which was a verbatim copy.
- **Files modified:** `src/lib/types.ts`
- **Commit:** febe229

## Known Stubs

None — all chart data flows from real hooks (usePlayers, useSquad, useMyTeam, useEntryRank, useGwAverage). No hardcoded placeholder values in rendered output.

## Threat Surface Scan

No new network endpoints introduced. `RankSimTab` reuses existing hooks (useSquad, useMyTeam, usePlayers, useEntryRank, useGwAverage) without modification. Sell/Buy IDs flow only into in-memory Map lookups, not URL construction. No new threat surface beyond the register in the plan's `<threat_model>`.

## UAT Outcome

**Status:** APPROVED
**Date:** 2026-05-06
**Confirmed by:** User
**Result:** All visual checks passed in dev server. User typed "approved".

## Self-Check

### Files exist:
- src/components/planner/RankSimTab.tsx: FOUND
- src/components/planner/RankSimTab.test.tsx: FOUND

### Commits exist:
- 395da55 (Task 1): FOUND
- febe229 (Task 2): FOUND

## Self-Check: PASSED
