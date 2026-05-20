---
phase: 128-pre-season-auto-activation
plan: "04"
subsystem: frontend
tags: [react, tanstack-query, hooks, ui, pre-season, banner, localStorage]

requires:
  - phase: 128-pre-season-auto-activation
    plan: "03"
    provides: PreSeasonActiveResponse type and /api/pre-season-active endpoint

provides:
  - usePreSeasonActive TanStack Query hook (src/lib/hooks/usePreSeasonActive.ts)
  - usePreSeasonActive vitest contract tests (src/lib/hooks/usePreSeasonActive.test.ts)
  - Status pill row (Awaiting/Live) integrated into NextSeasonPlannerTab as first element
  - First-activation banner with localStorage suppression in NextSeasonPlannerTab

affects:
  - Human UAT checkpoint (Task 3) — requires browser verification

tech-stack:
  added: []
  patterns:
    - TanStack Query useQuery 404→null silent fallback (mirrors usePreSeasonSquad but !res.ok → null not throw)
    - Synchronous localStorage read per render (avoids stale-init hazard from useState lazy initialiser)
    - typeof window !== 'undefined' guard for SSR safety on localStorage access
    - fplx_ localStorage key prefix convention (fplx_nsp_activation_seen_{seasonId})

key-files:
  created:
    - src/lib/hooks/usePreSeasonActive.ts
    - src/lib/hooks/usePreSeasonActive.test.ts
  modified:
    - src/components/next-season/NextSeasonPlannerTab.tsx
    - src/components/next-season/NextSeasonPlannerTab.test.tsx

key-decisions:
  - "usePreSeasonActive uses !res.ok → null (not throw) — silent Awaiting fallback per UI-SPEC Interaction Contract; deliberate deviation from usePreSeasonSquad which throws on non-404 errors"
  - "dismissed state initialised false; banner condition reads localStorage synchronously each render to avoid stale-init with empty seasonId (RESEARCH.md Pitfall 3 + Open Question 2 recommendation)"
  - "localStorage key uses fplx_ prefix (fplx_nsp_activation_seen_{seasonId}) to match project convention — UI-SPEC explicitly permits either prefix; fplx_ chosen for consistency"
  - "NextSeasonPlannerTab.test.tsx updated to mock usePreSeasonActive — defaulted to Awaiting (null) so all 9 existing tests pass unmodified"

duration: ~20min
completed: 2026-05-20
checkpoint_reached: Task 3 (human-verify)
---

# Phase 128 Plan 04: Frontend Hook + Pill + Banner Integration Summary

**TanStack Query `usePreSeasonActive` hook (404→null, silent error fallback) + status pill (Awaiting/Live) + first-activation dismissible banner with `fplx_` localStorage suppression integrated into `NextSeasonPlannerTab`**

## Status: CHECKPOINT REACHED — Awaiting Human Verification (Task 3)

Tasks 1 and 2 are complete and committed. Task 3 is a `checkpoint:human-verify` gate — browser verification required before continuing.

## Performance

- **Started:** 2026-05-20T08:13:00Z
- **Checkpoint reached:** 2026-05-20T08:20:00Z
- **Duration:** ~20 min (Tasks 1 + 2)
- **Tasks completed:** 2 of 3
- **Files modified/created:** 4

## Accomplishments

### Task 1: usePreSeasonActive hook + vitest contract tests
- Created `src/lib/hooks/usePreSeasonActive.ts` — TanStack Query hook with:
  - `queryKey: ['pre-season-active']`, `staleTime: 60_000`
  - 404 → `null` (Awaiting state)
  - `!res.ok` → `null` (silent Awaiting fallback, per UI-SPEC — unlike `usePreSeasonSquad` which throws)
  - `return res.json() as Promise<PreSeasonActiveResponse>` on 200
  - Zero `throw new Error` statements (verified: grep -c returns 0)
- Added `PreSeasonActiveResponse` interface to `src/lib/types.ts` (two fields: `activated_at: string`, `season_id: string`)
- Created `src/lib/hooks/usePreSeasonActive.test.ts` with 4 contract tests:
  1. 404 → `data === null` (Awaiting)
  2. 200 → `data` deep-equals payload
  3. 500 → `data === null` AND `isError === false` (silent fallback verified)
  4. staleTime freshness: `isStale === false` immediately after resolution

### Task 2: Status pill + first-activation banner in NextSeasonPlannerTab
- Modified `src/components/next-season/NextSeasonPlannerTab.tsx`:
  - Added `useState` import from 'react', `usePreSeasonActive` import
  - Hook call + derived state: `isActive`, `seasonId`, `dismissed` (initialized `false`)
  - Pill row as FIRST element inside `<div className="space-y-4">` — before existing Section A
    - Renders nothing when `activeData === undefined` (loading, avoids flash)
    - Zinc "Awaiting" pill when `activeData === null`
    - Green "Live" pill when `activeData` is non-null
  - First-activation banner between pill row and Section A `<h3>`:
    - Shown when `isActive && seasonId !== '' && !dismissed && typeof window !== 'undefined' && localStorage.getItem(...) !== 'true'`
    - Copy: `🏆 Pre-season is live — your squad has been re-optimised against the new FPL prices.`
    - Dismiss button: `aria-label="Dismiss activation banner"`, `min-h-[44px] min-w-[44px]` touch target
    - onClick: `localStorage.setItem('fplx_nsp_activation_seen_${seasonId}', 'true')` + `setDismissed(true)`
    - `fplx_nsp_activation_seen_` key prefix aligns with project convention
    - `typeof window !== 'undefined'` guard protects all localStorage access
  - All existing tab content (FormationGrid, HealthIndicator, Section B heatmap) preserved unchanged
- Modified `src/components/next-season/NextSeasonPlannerTab.test.tsx`:
  - Added `usePreSeasonActive` mock (defaulted to `{ data: null }` Awaiting state)
  - All 9 existing tests pass without modification

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | usePreSeasonActive hook + vitest tests | `bb45c90` | src/lib/types.ts, src/lib/hooks/usePreSeasonActive.ts, src/lib/hooks/usePreSeasonActive.test.ts |
| 2 | Pill + banner integration in NextSeasonPlannerTab | `e6429e3` | src/components/next-season/NextSeasonPlannerTab.tsx, NextSeasonPlannerTab.test.tsx |

## Verification Results

- `npm test -- usePreSeasonActive`: 4/4 passed
- `npm test` (full suite): 1509/1509 passed, 34 skipped, 123 test files
- `npx tsc --noEmit`: only pre-existing `decision-history/route.test.ts` error (Buffer/Node 25 issue, out of scope)
- `grep -c "throw new Error" src/lib/hooks/usePreSeasonActive.ts`: 0
- `grep -n "usePreSeasonActive" NextSeasonPlannerTab.tsx`: 3 lines (comment + import + call)
- `grep -c "fplx_nsp_activation_seen_"`: 2 (getItem + setItem)
- `grep -c "🏆 Pre-season is live"`: 1
- `grep -c "Dismiss activation banner"`: 1
- `grep -n "typeof window !== 'undefined'"`: present at line 210

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] NextSeasonPlannerTab.test.tsx needed usePreSeasonActive mock**
- **Found during:** Task 2 — running `npm test` after modifying NextSeasonPlannerTab.tsx
- **Issue:** 9 existing tests failed because `usePreSeasonActive()` was called inside the component but not mocked in the test file; TanStack Query threw "No QueryClient found"
- **Fix:** Added `vi.mock('@/lib/hooks/usePreSeasonActive', ...)` + `usePreSeasonActiveMock.mockReturnValue({ data: null })` in `beforeEach`; all 9 tests pass
- **Files modified:** `src/components/next-season/NextSeasonPlannerTab.test.tsx`
- **Commit:** `e6429e3`

## Checkpoint: Task 3 — Human Verification Pending

**What was built:** Status pill (Awaiting/Live) + first-activation banner integrated into NextSeasonPlannerTab. Hook `usePreSeasonActive` returns null on 404 and `PreSeasonActiveResponse` on 200.

**How to verify (from plan):**

1. **Awaiting state:** Confirm `pipeline/cache/pre_season_active.json` does NOT exist. Run `npm run dev`. Navigate Plan → Next Season tab. Expected: zinc "Awaiting" pill as first element above "Pre-Season Squad" heading; no banner; rest of tab renders normally.

2. **Live state:** Create `pipeline/cache/pre_season_active.json` with `{"activated_at": "2026-08-01T04:12:33Z", "season_id": "2526"}`. Clear localStorage. Restart dev server. Expected: green "Live" pill; green banner between pill and "Pre-Season Squad" h3 with the 🏆 copy and × dismiss button.

3. **Banner dismiss persists:** Click ×. Expected: banner disappears immediately; `fplx_nsp_activation_seen_2526='true'` in DevTools → Application → Local Storage; F5 reload: pill still "Live", banner does NOT return.

4. **Accessibility:** Tab to × button, confirm focus ring; inspect `aria-label="Dismiss activation banner"`; confirm ≥44×44px touch target.

5. **Cleanup:** Delete `pipeline/cache/pre_season_active.json`, clear localStorage key; tab reverts to Awaiting.

**Resume signal:** Type "approved" once all five steps pass, or describe issues.

## Known Stubs

None — all data is wired to the `usePreSeasonActive` hook which reads from `/api/pre-season-active`. The Awaiting state (null) is the correct empty state, not a stub.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced in this plan. `usePreSeasonActive` is a read-only public endpoint; the localStorage key is UX-only.

## Self-Check: PASSED

- FOUND: src/lib/hooks/usePreSeasonActive.ts
- FOUND: src/lib/hooks/usePreSeasonActive.test.ts
- FOUND: src/components/next-season/NextSeasonPlannerTab.tsx (modified)
- FOUND: commit bb45c90 (feat(128-04): create usePreSeasonActive hook + vitest contract tests)
- FOUND: commit e6429e3 (feat(128-04): integrate status pill + first-activation banner in NextSeasonPlannerTab)
- FOUND: .planning/phases/128-pre-season-auto-activation/128-04-SUMMARY.md (this file)

---
*Phase: 128-pre-season-auto-activation*
*Checkpoint reached: 2026-05-20 — Task 3 awaiting human verification*
