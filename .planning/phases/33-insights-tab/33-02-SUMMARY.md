---
phase: 33-insights-tab
plan: "02"
subsystem: ui
tags: [react, nextjs-route, react-query, tailwind, insights, tier-badge]

# Dependency graph
requires:
  - phase: 33-01
    provides: pipeline/cache/insights.json with 12 insights from compute_insights()
provides:
  - src/app/api/insights/route.ts — GET handler serving insights.json with USE_BLOB toggle
  - src/lib/hooks/useInsights.ts — useQuery<Insight[]> hook with 6h staleTime
  - src/components/insights/InsightsTab.tsx — four-category tab component with tier badges
  - Insight interface in src/lib/types.ts
  - 'insights' tab wired into src/app/page.tsx and src/components/nav/MobileNav.tsx
  - 12 component tests in InsightsTab.test.tsx (all passing)
affects: [33-verify, frontend tab consumers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Insight[] flat-array convention for pipeline-to-frontend data flow (RESEARCH A1 confirmed)
    - Empty-array seed pattern for cache files prevents first-load 500s
    - Tier badge derived client-side from confidence_pct — never persisted
    - HTML title attribute for badge tooltip (no Radix/custom library)

key-files:
  created:
    - src/app/api/insights/route.ts
    - src/lib/hooks/useInsights.ts
    - src/components/insights/InsightsTab.tsx
    - src/components/insights/InsightsTab.test.tsx
  modified:
    - src/lib/types.ts
    - src/app/page.tsx
    - src/components/nav/MobileNav.tsx
  deleted:
    - src/components/insights/InsightsTab.test.ts (renamed to .tsx for JSX support)

key-decisions:
  - "D-04: Tier thresholds HIGH>=70%, MEDIUM 50-69%, LOW<50% — computed client-side from confidence_pct"
  - "D-05: Badge colours green/amber/zinc per TIER_CLASSES constant"
  - "D-06: Four categories in fixed order: defensive, attacking, player, captaincy"
  - "D-08: Card list grouped by category, no accordion, all expanded"
  - "D-09: Insights tab positioned after Set Pieces, before Value Gems"
  - "D-10: No pagination or filtering — pipeline triviality gate is the control knob"
  - "D-11: Route + hook mirror captain-picks pattern exactly (USE_BLOB toggle, 6h staleTime)"
  - "D-12: Insight interface — six fields, flat array, no wrapper object"
  - "JSX test file requires .tsx extension — InsightsTab.test.ts renamed to .tsx (Rule 1 fix)"

patterns-established:
  - "Insight[]-flat-array: pipeline emits flat Insight[] (no wrapper object); hook typed as useQuery<Insight[]>"
  - "Tier-badge-inline: getTier() + TIER_CLASSES const inside component; no shared badge component needed for single-use"
  - "Empty-category-skip: if (items.length === 0) return null — headings never rendered without cards"

requirements-completed: [INS-01, INS-02, INS-03, INS-04]

# Metrics
duration: ~20min
completed: 2026-04-28
---

# Phase 33 Plan 02: Frontend Stack for Insights Tab Summary

**Insights tab frontend shipped end-to-end: TypeScript Insight type, /api/insights route with USE_BLOB toggle, useInsights hook with 6h React Query cache, InsightsTab component with four category sections + tier badges + em-dash tooltips, and 12 component tests — all wired into desktop nav and MobileNav.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-28T20:06:00Z
- **Completed:** 2026-04-28T20:16:00Z
- **Tasks:** 5 auto tasks complete (Task 6 is human-verify checkpoint — pending)
- **Files modified:** 7 (3 created, 1 renamed .ts -> .tsx, 3 modified)

## Accomplishments

- TypeScript `Insight` interface with all six D-12 fields appended to `src/lib/types.ts`
- `/api/insights` route handler (verbatim clone of captain-picks with 3 string substitutions); USE_BLOB toggle; never 500s on empty array
- `useInsights()` hook: `useQuery<Insight[]>` with `queryKey: ['insights']`, 6h staleTime, fetches `/api/insights`
- `InsightsTab` component: four category sections (defensive/attacking/player/captaincy) with tier badges (HIGH/MEDIUM/LOW), HTML title tooltip with em-dash format, loading/error/empty/populated states all wired with locked UI-SPEC copy
- `'insights'` literal added to `Tab` union in both `page.tsx` and `MobileNav.tsx` atomically; desktop nav button inserted between Set Pieces and Value Gems; MobileNav TABS array gains 8th entry
- 12 component tests (11 real + 1 Wave 0 placeholder) all passing; full suite 311/311 tests green

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Insight interface to src/lib/types.ts** - `7ac3d89` (feat)
2. **Task 2: Create /api/insights route + useInsights hook** - `7ce7c46` (feat)
3. **Task 3: Wire 'insights' into page.tsx + MobileNav.tsx** - `9287594` (feat)
4. **Task 4: Create InsightsTab.tsx** - `8d92c18` (feat)
5. **Task 5: Replace Wave 0 stub with real component tests** - `f09a730` (test)

**Plan metadata:** (pending — committed with SUMMARY after checkpoint)

## Files Created/Modified

- `src/lib/types.ts` - Appended exported `Insight` interface (six D-12 fields)
- `src/app/api/insights/route.ts` - NEW: GET handler, USE_BLOB toggle, serves insights.json
- `src/lib/hooks/useInsights.ts` - NEW: useQuery<Insight[]> hook, 6h staleTime
- `src/components/insights/InsightsTab.tsx` - NEW: four-category component with tier badges, all states
- `src/components/insights/InsightsTab.test.tsx` - NEW (renamed from .ts): 12 component tests
- `src/app/page.tsx` - Added InsightsTab import, Tab union entry, nav button, content branch
- `src/components/nav/MobileNav.tsx` - Added 'insights' to Tab union and TABS array (8 entries)

## Decisions Made

- Used flat `Insight[]` array (not wrapper object) for hook return type — consistent with RESEARCH.md §A1 recommendation
- Renamed test file from `.test.ts` to `.test.tsx` (required for OXC to parse JSX syntax)
- Tier badge derivation kept entirely client-side — `confidence_pct` field flows to `getTier()` in component, no server-side tier computation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test file renamed from .ts to .tsx for JSX parse support**
- **Found during:** Task 5 (writing component tests)
- **Issue:** `InsightsTab.test.ts` uses `render(<InsightsTab />)` JSX syntax. OXC transform (used by Vitest) rejects JSX in `.ts` files — `[PARSE_ERROR] Expected > but found /`
- **Fix:** Renamed `src/components/insights/InsightsTab.test.ts` to `src/components/insights/InsightsTab.test.tsx`. The plan referenced `.test.ts` but JSX requires `.tsx`.
- **Files modified:** `src/components/insights/InsightsTab.test.tsx` (renamed from `.ts`)
- **Verification:** `npx vitest run src/components/insights/InsightsTab.test.tsx` exits 0 with 12 passed
- **Committed in:** `f09a730` (Task 5 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — parse error blocking test execution)
**Impact on plan:** Necessary for tests to run. File content is identical to plan spec; only extension changed.

## Issues Encountered

- Pre-existing TypeScript errors in `tests/lib/captain-picks.test.ts` (5 TS2554 errors unrelated to this plan's changes). Confirmed pre-existing by stash test. Out of scope per deviation scope boundary rule.

## Known Stubs

None. The `InsightsTab.tsx` component is fully wired to real data via `useInsights()`. The Plan 01 smoke run produced 12 real insights in `pipeline/cache/insights.json`. Empty state handles the seeded `[]` case gracefully.

## Threat Surface Scan

No new threat surface beyond what was documented in the plan's threat model (T-33-07 through T-33-14). All mitigations confirmed present:
- Route path is hard-coded `join(process.cwd(), 'pipeline', 'cache', 'insights.json')` — no user input (T-33-08)
- React JSX escapes all statement strings — no dangerouslySetInnerHTML (T-33-11, T-33-12)
- 6h staleTime prevents request thrashing (T-33-09)

## Next Phase Readiness

- Task 6 (human-verify checkpoint) awaiting approval: dev server must be started and Insights tab verified in browser
- After approval: INS-01, INS-02, INS-03, INS-04 fully user-visible; ready for `/gsd-verify-work`

---
*Phase: 33-insights-tab*
*Completed: 2026-04-28 (Tasks 1-5; Task 6 checkpoint pending)*

## Self-Check: PASSED

Files exist:
- `src/lib/types.ts` FOUND
- `src/app/api/insights/route.ts` FOUND
- `src/lib/hooks/useInsights.ts` FOUND
- `src/components/insights/InsightsTab.tsx` FOUND
- `src/components/insights/InsightsTab.test.tsx` FOUND
- `.planning/phases/33-insights-tab/33-02-SUMMARY.md` FOUND

Commits exist:
- `7ac3d89` FOUND (Task 1: Insight interface)
- `7ce7c46` FOUND (Task 2: route + hook)
- `9287594` FOUND (Task 3: page.tsx + MobileNav.tsx)
- `8d92c18` FOUND (Task 4: InsightsTab.tsx)
- `f09a730` FOUND (Task 5: component tests)
