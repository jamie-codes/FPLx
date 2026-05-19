---
phase: 124-season-review
plan: "03"
subsystem: season-review
tags:
  - season-review
  - ui
  - recharts
  - page-wiring
  - tdd
dependency_graph:
  requires:
    - SeasonGwEntry type (src/lib/types.ts — Plan 01)
    - SeasonReview type (src/lib/types.ts — Plan 01)
    - computeDecisionGrade function (src/lib/season-review.ts — Plan 01)
    - useSeasonReview hook (src/lib/hooks/useSeasonReview.ts — Plan 02)
    - useSeasonAnalytics hook (src/lib/hooks/useSeasonAnalytics.ts — existing)
    - useDecisionHistory hook (src/lib/hooks/useDecisionHistory.ts — existing)
    - computeSeasonSummary (src/lib/regret.ts — existing)
  provides:
    - SeasonReviewTab component (src/components/season-review/SeasonReviewTab.tsx)
    - 'season' SubTab (src/app/page.tsx)
  affects:
    - src/app/page.tsx (SubTab union + SECTIONS + render block)
    - src/app/page.test.tsx (sub-tab order assertion updated)
tech_stack:
  added: []
  patterns:
    - TDD RED→GREEN commit sequence
    - Multi-hook loading guard (rules-of-hooks ordering — hooks before conditional returns)
    - Grade useMemo gated on triple-isSuccess (Pitfall 2 prevention)
    - recharts ComposedChart with custom ChipDot dot renderer
    - Custom SeasonChartTooltip (function reference style, not JSX instance)
    - Tailwind-only styling (no shadcn)
    - isAnimationActive={false} on both Line components (test-flakiness prevention)
key_files:
  created:
    - src/components/season-review/SeasonReviewTab.tsx
    - src/components/season-review/SeasonReviewTab.test.tsx
  modified:
    - src/app/page.tsx
    - src/app/page.test.tsx
decisions:
  - "Tooltip content passed as function reference SeasonChartTooltip (not JSX instance <SeasonChartTooltip />) to avoid TypeScript TooltipContentProps mismatch"
  - "CHIP_DISPLAY_NAME map extended to include 'wildcard' beyond BackTab's 3-entry map (BackTab excludes wildcard per D-04, SeasonReviewTab must show chip GW markers)"
  - "React namespace imported as type-only for React.ReactElement return types on helper functions"
  - "page.test.tsx sub-tab order assertion updated to include 'Season' (Rule 1 auto-fix)"
  - "Cherry-picked Plan 01/02 commits into worktree (Rule 3 — worktree was behind main)"
metrics:
  duration: "~9 minutes"
  completed: "2026-05-19"
  tasks_completed: 2
  files_created: 3
  files_modified: 2
---

# Phase 124 Plan 03: SeasonReviewTab Component + Page Wiring Summary

Build and wire the `SeasonReviewTab` client component rendering REV-01 Summary Card, REV-02 Grade Card, and REV-03 Points Chart. Wire as 'season' sub-tab in the Analyse section, completing all four phase requirements (REV-01..REV-04).

## What Was Built

### SeasonReviewTab Component (Task 1)

`src/components/season-review/SeasonReviewTab.tsx` — 407-line `'use client'` component.

**Component structure (render order):**
1. Three hooks called unconditionally at top (rules-of-hooks)
2. Grade `useMemo` gated on all three `isSuccess` flags (Pitfall 2 guard)
3. componentScores `useMemo` for REV-02 grade card + REV-01 captain stat
4. Loading branch: 3-card `animate-pulse` skeleton
5. Error branch: red border card with "Failed to load season data." message
6. Empty-state branch (when `!teamId`): "Enter your FPL Team ID to see your Season Review"
7. Main render: REV-01 → REV-02 → REV-03 in vertical stack

**REV-01 Season Summary Card:**
- 6 stats: Overall Rank (locale-formatted), Total Points, Captain Hit Rate (from `useDecisionHistory` + `computeSeasonSummary`), Transfer Net (U+2212 minus + semantic coloring), Best GW, Worst GW
- `<dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">`
- Captain Hit Rate renders `—` while `useDecisionHistory` is loading

**REV-02 Decision Quality Grade Card:**
- Grade badge: A/B/C/D with GRADE_CLS color mapping or `—` while loading
- Grade label: descriptive text per GRADE_LABEL map
- Component-score breakdown: `data-testid="grade-component-scores"` dl with Captain EV rate, Hit break-even rate, Chip ROI positive rate (each formatted as `(value * 100).toFixed(1) + '%'` or `—`)
- Methodology note: "Grade based on: captain EV rate (40%) + hit break-even rate (35%) + chip ROI positive rate (25%). Thresholds: A ≥ 75%, B ≥ 50%, C ≥ 25%, D < 25%. Chip ROI excluded when no chips played. v1 thresholds — subject to calibration."

**REV-03 Season Points Chart:**
- `data-testid="season-points-chart"` container
- Legend row: Your score / Avg manager / Chip GW
- `ResponsiveContainer` height 288
- `ComposedChart` with `CartesianGrid`, `XAxis` (GW{N} tick formatter), `YAxis` (domain `[0, 'auto']`)
- User score `Line`: `stroke="currentColor"`, `dot={<ChipDot />}`, `isAnimationActive={false}`
- Avg manager `Line`: `stroke="rgba(161,161,170,0.7)"`, `strokeDasharray="4 4"`, `isAnimationActive={false}`
- `SeasonChartTooltip`: GW header, Your score, Avg manager, Overall rank (locale-formatted), conditional Chip name

**Pitfall protections applied:**
- Pitfall 2: Grade only computed when `reviewQuery.isSuccess && analyticsQuery.isSuccess && historyQuery.isSuccess`
- Pitfall 3: `chipRoi.length === 0` ternary guards chip ROI denominator
- Pitfall 4: `hitTracking.length === 0` ternary returns `1.0` (vacuously true)
- Pitfall 5: `CHIP_DISPLAY_NAME` map with all 4 slugs including `wildcard`
- T-124-07: All chip/rank values via React text interpolation, never `dangerouslySetInnerHTML`

### Test File (Task 1)

`src/components/season-review/SeasonReviewTab.test.tsx` — 9 render tests:

| # | Test | REQ | Result |
|---|------|-----|--------|
| 1 | Renders empty state when teamId is null | REV-04/D-08 | PASS |
| 2 | Renders skeleton when useSeasonReview is loading | all | PASS |
| 3 | Renders skeleton when only useDecisionHistory is loading | all | PASS |
| 4 | Renders — in grade badge while any hook loading (Pitfall 2) | REV-02 | PASS |
| 5 | Renders grade A when computeDecisionGrade returns A | REV-02 | PASS |
| 6 | Renders summary stats with formatted values | REV-01 | PASS |
| 7 | Renders methodology note on grade card | REV-02 | PASS |
| 8 | Renders three component scores in grade card | REV-02/Crit-2 | PASS |
| 9 | Renders — for chip ROI when no chips played (D-06) | REV-02/D-06 | PASS |

### page.tsx Wiring (Task 2)

Four surgical edits to `src/app/page.tsx`:

1. **Import** (line 27): `import { SeasonReviewTab } from '@/components/season-review/SeasonReviewTab'`
2. **SubTab union** (line 57): Added `'season'` between `'accuracy'` and `'decision'` in the union
3. **SECTIONS entry** (line 70): `{ id: 'season' as SubTab, label: 'Season', mobileLabel: 'Season' }` positioned after `accuracy` and before `price-changes`
4. **Render condition** (line 284): `{activeSection !== 'squad' && activeSubTab === 'season' && <SeasonReviewTab teamId={submittedId} />}`

## Requirements Satisfied

| Requirement | Description | Test / Assertion |
|-------------|-------------|-----------------|
| REV-01 | Season summary card: rank, points, captain hit rate, transfer net, best/worst GW | Test 6 (stats formatting) |
| REV-02 | Decision quality grade A–D with methodology note and component scores | Tests 4, 5, 7, 8, 9 |
| REV-03 | GW-by-GW points chart with avg manager overlay and chip markers | Component renders ComposedChart with ChipDot |
| REV-04 | 'Season' sub-tab in Analyse section, accessible on desktop and mobile | page.tsx SECTIONS + SubTab union |

## Phase 124 Success Criterion 2

The REV-02 grade card displays the three component scores (Captain EV rate, Hit break-even rate, Chip ROI positive rate) in a `data-testid="grade-component-scores"` `<dl>` element. Test 8 asserts all three labels and their formatted values (62.5%, 50.0%, 100.0%). Test 9 asserts that Chip ROI shows `—` when no chips played (D-06).

## Test Results

```
npx vitest run src/components/season-review src/lib/hooks/useSeasonReview src/lib/season-review src/app/api/season-review

 Test Files  4 passed (4)
      Tests  33 passed (33)

Full suite: 1441 passed | 34 skipped (1475)
```

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 31861e7 | test | add render tests for SeasonReviewTab (RED gate) |
| 2560d9c | feat | implement SeasonReviewTab (REV-01 + REV-02 + REV-03) (GREEN gate) |
| f3b975c | feat | wire SeasonReviewTab into page.tsx — REV-04 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Cherry-picked Plan 01/02 commits into worktree**
- **Found during:** Task 1 pre-flight check
- **Issue:** Worktree was forked before Plan 01/02 were merged to main. Files `src/lib/season-review.ts`, `src/lib/hooks/useSeasonReview.ts`, `src/app/api/season-review/route.ts` were missing.
- **Fix:** Cherry-picked 9 commits from main into the worktree (Plans 01+02 in their entirety).
- **Impact:** No behavior change — purely additive dependency resolution.

**2. [Rule 1 - Bug] Updated page.test.tsx sub-tab order assertion**
- **Found during:** Task 2 verification (full vitest suite)
- **Issue:** `src/app/page.test.tsx` had a hardcoded array of Analyse sub-tabs that didn't include `'Season'`. Adding the Season tab to SECTIONS caused this test to fail.
- **Fix:** Updated the assertion array to include `'Season'` between `'Accuracy'` and `'Price Changes'`.
- **Files modified:** `src/app/page.test.tsx`
- **Commit:** f3b975c (included in Task 2 commit)

**3. [Rule 1 - Bug] Tooltip passed as function reference, not JSX instance**
- **Found during:** TypeScript compile check (tsc --noEmit)
- **Issue:** `<Tooltip content={<SeasonChartTooltip />} />` caused TypeScript error — recharts expects the function reference, not a pre-constructed element with empty props.
- **Fix:** Changed to `<Tooltip content={SeasonChartTooltip} />` (pattern from AccuracyTab).
- **Files modified:** `src/components/season-review/SeasonReviewTab.tsx`

**4. [Rule 1 - Bug] Fixed test data field names to match actual TypeScript types**
- **Found during:** TypeScript compile check
- **Issue:** Test data used wrong field names: `chip` instead of `chipName`, `gw` instead of `event` for HitTrackingEntry, missing `userCaptainId`/`modelCeilingId`/`hasSnapshot` for RegretEntry.
- **Fix:** Updated all test fixture objects to use the correct type shapes from `src/lib/types.ts`.
- **Files modified:** `src/components/season-review/SeasonReviewTab.test.tsx`

## Known Stubs

None — all data flows are wired: `useSeasonReview` → REV-01/REV-03, `useSeasonAnalytics` → REV-02 component scores, `useDecisionHistory` + `computeSeasonSummary` → captain hit rate + grade.

## Threat Flags

No new threat surface beyond what is documented in the plan's threat model (T-124-07 XSS guard implemented via React text interpolation only, T-124-08/T-124-09 accepted).

## Manual Verification Checklist

These items require visual inspection in a running browser (per VALIDATION.md §Manual-Only Verifications):

- [ ] Chart chip markers render as amber dots (r=6, fill=#f59e0b) on chip GWs
- [ ] Methodology note copy displays exactly as in UI-SPEC §Copywriting
- [ ] 'Season' sub-tab appears 7th in Analyse (after Accuracy, before Price Changes) on desktop
- [ ] 'Season' sub-tab appears in MobileNav in the same position
- [ ] Empty state shows correct copy "Enter your FPL Team ID to see your Season Review" when no team ID
- [ ] Grade badge renders `—` while data is loading, then resolves to A/B/C/D
- [ ] Tooltip shows Overall rank, Your score, Avg manager on hover; Chip name on chip GWs
- [ ] Transfer net negative shows `−8` with U+2212 minus (not hyphen) in red color
- [ ] Transfer net zero shows `0` in zinc-500 color
- [ ] Dark mode: all cards render with dark:bg-zinc-800 backgrounds, dark text colors

*Implementer note: Automated tests cover all functional behaviors. Manual verification covers visual/interactive aspects not testable in jsdom.*

## Self-Check

Checking created files exist and commits are present...

- FOUND: src/components/season-review/SeasonReviewTab.tsx
- FOUND: src/components/season-review/SeasonReviewTab.test.tsx
- FOUND: src/app/page.tsx (modified — verified 4 season-related lines)
- FOUND: src/app/page.test.tsx (modified — Season added to sub-tab order assertion)

Checking commits:
- FOUND commit: 31861e7 (test RED)
- FOUND commit: 2560d9c (feat GREEN)
- FOUND commit: f3b975c (feat wire)

Tests:
- SeasonReviewTab: 9 passed (9)
- Full suite: 1441 passed | 34 skipped (1475)

## Self-Check: PASSED
