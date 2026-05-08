---
phase: 81-team-shields-visual-identity
plan: "03"
subsystem: ui
tags: [team-shields, fixture-heat-map, react-hooks, vitest, tailwind]

requires:
  - phase: 81-01
    provides: useTeamBadge hook (src, onError, showFallback, fallbackColour, initial)
provides:
  - FixtureHeatMap row header widened to w-20 with inline 20px crest (or fallback swatch) via HeatMapRow sub-component
  - HeatMapRow extracted as closure inside FixtureHeatMap to satisfy react-hooks/rules-of-hooks
  - 3 new SHD-02 tests (w-20 class, img crest for ARS, all 20 teams have crest or fallback)
affects: [81-04, club-form-ui]

tech-stack:
  added: []
  patterns: [inner-function component as hook closure, eslint-disable on <img> for non-Next/Image]

key-files:
  created: []
  modified:
    - src/components/club-form/FixtureHeatMap.tsx
    - src/components/club-form/FixtureHeatMap.test.tsx

key-decisions:
  - "HeatMapRow defined as closure inside FixtureHeatMap (not top-level) to close over grid/mode/tierMap/ownedTeamIds without prop explosion"
  - "key prop placed on HeatMapRow in visibleTeams.map, not inside HeatMapRow <tr> per React rules"
  - "alt='' on crest img (decorative — adjacent span conveys team identity to AT users)"
  - "aria-hidden='true' on fallback swatch span per RESEARCH.md Pitfall 6 (prevents AT double-announcement)"

patterns-established:
  - "Inner component as closure pattern: define function inside parent to close over computed state without passing many props"
  - "eslint-disable-next-line @next/next/no-img-element on CDN badge img (Next/Image not warranted for 20px decorative icons)"

requirements-completed: [SHD-02]

duration: 5min
completed: 2026-05-08
---

# Phase 81 Plan 03: FixtureHeatMap Row Header Crest Summary

**FixtureHeatMap row header widened to w-20 with 20px PL CDN crest (or rounded-full initial fallback) via extracted HeatMapRow closure sub-component; all 21 tests green**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-08T15:15:00Z
- **Completed:** 2026-05-08T15:18:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Extended FixtureHeatMap.test.tsx with 3 failing SHD-02 tests (RED gate)
- Extracted HeatMapRow as inner closure function inside FixtureHeatMap satisfying react-hooks/rules-of-hooks for useTeamBadge
- Changed both header `<th>` and row `<th>` from `w-16` to `w-20`
- Row header now shows 20px crest img (known teams) or rounded-full fallback swatch with team initial (unknown/error), adjacent to 3-char abbreviation
- All 23 tests pass (18 existing Phase 66/75 + 3 new SHD-02); lint clean

## Task Commits

1. **Task 1: Extend FixtureHeatMap.test.tsx with 3 failing SHD-02 tests** - `14cf693` (test)
2. **Task 2: Extract HeatMapRow + widen th + add crest flex row** - `c6c765c` (feat)

## Files Created/Modified

- `src/components/club-form/FixtureHeatMap.tsx` - Added useTeamBadge import; HeatMapRow closure sub-component with crest/fallback flex row; w-16 → w-20 on both header and row th; replaced old visibleTeams.map inline JSX with `<HeatMapRow key={t.team_id} t={t} />`
- `src/components/club-form/FixtureHeatMap.test.tsx` - Added 3 SHD-02 tests: w-20 class check, img crest for ARS (t3.png), all 20 teams have crest or fallback span

## Decisions Made

- HeatMapRow defined as closure inside FixtureHeatMap (not hoisted to module level) to close over `grid`, `mode`, `tierMap`, `ownedTeamIds` without a large props interface — avoids prop explosion and keeps hook call at component top level
- `key` prop placed on `<HeatMapRow key={t.team_id} t={t} />` in the map, not inside `HeatMapRow`'s `<tr>` — React keys must live on the element returned to the parent render function
- `alt=""` on crest `<img>` (decorative — adjacent `<span>{t.team_short_name}</span>` already conveys team identity to screen readers)
- `aria-hidden="true"` on fallback swatch `<span>` per RESEARCH.md §Pitfall 6 (prevents double-announcement of initial character when abbreviation is already adjacent)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. The default-sort test (`h.textContent?.trim()` → `['ARS', 'MCI', 'WHU']`) continued to pass without modification because `<img>` contributes no textContent, and ARS/MCI/WHU are all in TEAM_BADGE_CODE so no fallback swatch initial character appears.

## Known Stubs

None.

## Threat Flags

None. All threats in the plan's STRIDE register are accepted (T-81-13 through T-81-18). No new trust boundaries introduced beyond what the plan accounts for.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- SHD-02 complete: FixtureHeatMap row headers now show team crests
- useTeamBadge hook (from Plan 01) integrated and exercised with real TEAM_BADGE_CODE data
- Plans 02 and 04 can proceed independently (this plan only touches FixtureHeatMap)

## Self-Check: PASSED

- FOUND: src/components/club-form/FixtureHeatMap.tsx (contains HeatMapRow, useTeamBadge, w-20 x2, rounded-full, eslint-disable)
- FOUND: src/components/club-form/FixtureHeatMap.test.tsx (contains SHD-02, 3 new tests)
- FOUND: commit 14cf693 (test RED)
- FOUND: commit c6c765c (feat GREEN)

---
*Phase: 81-team-shields-visual-identity*
*Completed: 2026-05-08*
