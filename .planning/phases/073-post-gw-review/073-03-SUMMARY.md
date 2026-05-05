---
phase: 73
plan: "03"
subsystem: ui
tags: [component, rtl-tests, squad-sub-tab, gw-review, pill-toggle, tdd]
dependency_graph:
  requires: [073-02]
  provides: [GwReviewTab component, Review sub-tab in Squad section, RTL test coverage PGW-01]
  affects:
    - src/components/squad/GwReviewTab.tsx
    - src/components/squad/GwReviewTab.test.tsx
    - src/app/page.tsx
    - src/components/nav/MobileNav.test.tsx
    - src/app/page.test.tsx
tech_stack:
  added: []
  patterns: [TDD Wave 0 RED/GREEN, React useState pill toggle, aria-pressed accessibility, StatCard inline sub-component, sentiment color branching]
key_files:
  created:
    - src/components/squad/GwReviewTab.tsx
    - src/components/squad/GwReviewTab.test.tsx
  modified:
    - src/app/page.tsx
    - src/components/nav/MobileNav.test.tsx
    - src/app/page.test.tsx
decisions:
  - "Test beforeEach provides safe default mock return (disabled-query shape) instead of bare mockReset() — React hooks must be called unconditionally so useGwReview is always called even when teamId=''"
  - "SETTLED_GWS_PLACEHOLDER hardcoded [33,34,35] for Phase 73 ship; matches Plan 01 seed file GW numbers; future enhancement deferred to useSettledGws hook"
  - "page.test.tsx Squad sub-tabs assertion updated to include Review (Rule 1 auto-fix)"
metrics:
  duration: "310s"
  completed: "2026-05-05"
  tasks_completed: 4
  files_changed: 5
---

# Phase 73 Plan 03: UI Layer Summary

GwReviewTab component (5th Squad sub-tab) with GW pill toggle, 4-stat grid, and full state guards (no-squad/loading/error/data); wired into page.tsx with SETTLED_GWS_PLACEHOLDER [33,34,35]; all 4 RTL tests pass (TDD RED→GREEN); MobileNav and page tests updated for 5 Squad pills.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create GwReviewTab.test.tsx (Wave 0 RED) | 1a1b5cf | src/components/squad/GwReviewTab.test.tsx (new, 120 lines) |
| 2 | Implement GwReviewTab.tsx (GREEN phase) | 5014f83 | src/components/squad/GwReviewTab.tsx (new, 200 lines) + test fix |
| 3 | Wire GwReviewTab into page.tsx | 24014b5 | src/app/page.tsx (4 edits + constant, 14 lines added) |
| 4 | Update MobileNav.test.tsx for 5 Squad pills | 6a9f91f | src/components/nav/MobileNav.test.tsx (1 test updated) |

## What Was Built

### Task 1: GwReviewTab.test.tsx (Wave 0 — written first, RED phase)

4 RTL test cases covering PGW-01:
- **Test 1 (data render):** Verifies all 4 stat values (72, 8, +6, 55), both detail rows (Haaland top scorer, Salah captain), and stat labels (GW Score, Bench pts left, FPL average, Captain delta)
- **Test 2 (no-squad empty state):** Empty teamId renders "Load your squad to see GW reviews." with no stat grid and no pill toggle
- **Test 3 (unsettled 503):** error.status=503 renders "GW review will appear once scores finalise." with no stat grid
- **Test 4 (GW pill toggle):** Default active GW=35 (most recent); clicking GW33 pill calls useGwReview with gw=33; aria-pressed updates correctly

Mock pattern: `vi.mock('@/lib/hooks/useGwReview')` with `mockSuccess()`/`mockError(status, msg)` helpers. `beforeEach` sets safe default return shape (disabled-query: `{ data: undefined, isLoading: false, isError: false, error: null }`) so empty-teamId test doesn't crash from undefined destructuring.

### Task 2: GwReviewTab.tsx (GREEN phase)

Component signature: `export function GwReviewTab({ teamId, settledGws }: { teamId: string; settledGws: number[] })`

5 render branches (all hooks called unconditionally before any early return — T-73-16):
1. **No-squad** (`submittedId === null`): "Load your squad to see GW reviews."
2. **No settled GWs** (`settledGws.length === 0`): "GW review will appear once scores finalise."
3. **Loading** (`isLoading`): "Loading GW review..." with pill toggle
4. **Error** (`isError || !data`): status-branched copy (503→unsettled, 404/502→unavailable, other→generic) with pill toggle
5. **Data** (happy path): 4-card stat grid + top scorer row + captain row with optional Optimal suffix

Inline sub-components:
- `StatCard`: label + pre-formatted value with optional sentiment class
- `GwPillToggle`: `role="group"` wrapper + `aria-pressed` on each pill + `min-h-[44px]` touch target

Color semantics (UI-SPEC verbatim):
- Captain delta=0: `text-green-600 dark:text-green-400`, label "Optimal captain - no delta"
- Captain delta>0: `text-amber-700 dark:text-amber-300`, value `+{N}pts missed`
- Score beats average: `text-green-600 dark:text-green-400`; otherwise neutral zinc (no red)

### Task 3: page.tsx (4 additive edits)

**Edit 1 — Import:** `import { GwReviewTab } from '@/components/squad/GwReviewTab'` (after LineupTab import)

**Edit 2 — SubTab union:** appended `| 'review'` to the union type (line 65)

**Edit 3 — Squad subTabs:** Added `{ id: 'review' as SubTab, label: 'Review', mobileLabel: 'Review' }` after Lineup entry (line 103)

**Edit 4 — Render guard + constant:**
```typescript
// Phase 73 PGW-01: hardcoded last-3 settled GWs. Pipeline writes gw_review_gw{N}.json
// for actual last 3 finished GWs (D-10 sliding window). Future enhancement: useSettledGws
// hook reading bootstrap.events (deferred per RESEARCH.md Open Question 2).
const SETTLED_GWS_PLACEHOLDER: number[] = [33, 34, 35]
```
Guard added after Lineup guard:
```tsx
{activeSection === 'squad' && activeSubTab === 'review' && (
  <GwReviewTab teamId={submittedId ?? ''} settledGws={SETTLED_GWS_PLACEHOLDER} />
)}
```

All existing Lineup wiring untouched.

### Task 4: MobileNav.test.tsx (1 test updated)

Squad-active test updated: "4 pills" → "5 pills", `toHaveLength(7)` → `toHaveLength(8)`, filter array adds `'Review'`, pillButtons[3]/[4] assertions added. All 9 MobileNav tests pass.

## TypeScript Verification

`npx tsc --noEmit` exits 0 — no TypeScript errors across all 4 tasks.

## Test Results

```
npx vitest run src/components/squad/GwReviewTab.test.tsx  → 4/4 pass (GREEN phase)
npx vitest run src/components/nav/MobileNav.test.tsx       → 9/9 pass
npx vitest run src/app/page.test.tsx                       → 13/13 pass
npx vitest run                                             → 838 pass, 6 pre-existing failures (captain-picks/club-form)
```

Pre-existing failures (unrelated to Phase 73):
- `tests/lib/captain-picks.test.ts`: 5 failures — documented in STATE.md as TEST-57 deferred
- `tests/lib/club-form.test.ts`: 1 failure — pre-existing, unrelated to this plan

## TDD Gate Compliance

- RED gate: commit `1a1b5cf` — `test(073-03)` before component (Wave 0)
- GREEN gate: commit `5014f83` — `feat(073-03)` after all 4 tests pass
- REFACTOR gate: not needed — code was clean on first pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test beforeEach returning undefined after mockReset()**
- **Found during:** Task 2 (first test run)
- **Issue:** `mockReset()` in `beforeEach` left mock returning `undefined`. The no-squad empty-state test didn't call `mockSuccess()`/`mockError()` before render, but `useGwReview` is called unconditionally (React rules of hooks) — destructuring `undefined` crashed.
- **Fix:** `beforeEach` now calls `mockReturnValue({ data: undefined, isLoading: false, isError: false, error: null })` (disabled-query shape) instead of bare `mockReset()`. Individual tests calling `mockSuccess()`/`mockError()` override this default.
- **Files modified:** `src/components/squad/GwReviewTab.test.tsx`
- **Commit:** `5014f83`

**2. [Rule 1 - Bug] Fixed page.test.tsx Squad sub-tabs assertion**
- **Found during:** Full test suite run after Task 3
- **Issue:** `src/app/page.test.tsx` line 155 asserted exactly `['Decision','Transfers','Optimiser','Lineup']` — the 5th Review tab broke this.
- **Fix:** Updated assertion to `['Decision','Transfers','Optimiser','Lineup','Review']`.
- **Files modified:** `src/app/page.test.tsx`
- **Commit:** `7369419`

## Note for Verifier

- **Dev smoke test:** Open `http://localhost:3000` → Squad → Review tab. With no team ID: "Load your squad to see GW reviews." Submit a team ID → expect either stat grid (if pipeline ran) or "GW review will appear once scores finalise." (seed files have `gw: null`). Click GW33/GW34/GW35 pills to verify active pill highlight and data refetch.
- **SETTLED_GWS_PLACEHOLDER:** Hardcoded `[33,34,35]` matches Plan 01 seed file names. After first live pipeline run (`python pipeline/run.py`), the API serves real data for whatever GWs are actually finished. If a requested GW has no Blob file, the API returns 404 → component shows "Review data unavailable — check back after the next pipeline run."
- **Future enhancement:** A `useSettledGws` hook reading `bootstrap.events` where `finished=true` would replace the hardcoded placeholder (RESEARCH.md Open Question 2, deferred).

## Threat Surface Scan

No new threat surface beyond what was planned. All T-73-12 through T-73-16 mitigations confirmed present:
- T-73-12: `error.status` accessed via optional chaining cast
- T-73-14: No `dangerouslySetInnerHTML` — player names in JSX text nodes (React auto-escapes)
- T-73-15: SETTLED_GWS_PLACEHOLDER is 3 elements (bounded by plan spec)
- T-73-16: All hooks called unconditionally before early returns

## Self-Check: PASSED

- src/components/squad/GwReviewTab.tsx: FOUND
- src/components/squad/GwReviewTab.test.tsx: FOUND
- src/app/page.tsx imports GwReviewTab: FOUND
- src/components/nav/MobileNav.test.tsx 5-pill assertion: FOUND
- Commit 1a1b5cf (Task 1): FOUND
- Commit 5014f83 (Task 2): FOUND
- Commit 24014b5 (Task 3): FOUND
- Commit 6a9f91f (Task 4): FOUND
- Commit 7369419 (Rule 1 fix): FOUND
- npx tsc --noEmit: exits 0
- npx vitest run src/components/squad/GwReviewTab.test.tsx: 4/4 pass
- npx vitest run src/components/nav/MobileNav.test.tsx: 9/9 pass
