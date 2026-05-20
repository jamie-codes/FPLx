---
phase: 129-squad-cost-simulator
verified: 2026-05-20T18:04:00Z
status: human_needed
score: 5/5
overrides_applied: 0
human_verification:
  - test: "Drag slider from £100m to £80m in the running app"
    expected: "Infeasibility message 'No squad possible at £80.0m — try £83.5m+' appears above the (still-visible) formation grid showing the last feasible squad"
    why_human: "Requires npm run dev, real FPL pre-season data in the blob/cache, and visual confirmation of layout, amber gradient position, and message copy with em-dash"
  - test: "Drag slider from £80m back to £100m"
    expected: "Infeasibility message disappears; formation grid updates to reflect the new feasible client squad"
    why_human: "Cannot test real-data round-trip behaviour without a running server and live inputs payload"
  - test: "Confirm GemTable and other Plan sub-tabs do not re-render on slider drag"
    expected: "React DevTools (or console.count) shows zero re-renders in GemTable and WatchlistTab while dragging the NextSeasonPlannerTab slider"
    why_human: "Requires React DevTools profiler or manual console instrumentation; cannot be verified statically"
  - test: "Confirm slider track shows amber zone to the left of min_feasible_budget_greedy"
    expected: "Visible amber segment in the slider rail for budgets below min_feasible_budget_greedy; zinc/grey above the threshold"
    why_human: "CSS inline gradient rendering requires visual inspection; jsdom normalises inline styles differently from real browsers"
  - test: "Confirm FDR heatmap shows empty-state 'Fixtures not yet published' (deferred condition)"
    expected: "Section B renders the empty-state paragraph, confirming the GW1-8-FIXTURES TODO path is the active render path"
    why_human: "Deferred condition documented in REQUIREMENTS.md COST-02; smoke test confirms deferred path is live rather than erroring"
---

# Phase 129: Squad Cost Simulator — Verification Report

**Phase Goal:** User can drag a budget slider in NextSeasonPlannerTab and see the 15-player squad and GW1-8 fixture heatmap re-render to reflect the squad the greedy builder produces at the chosen budget, with clear infeasibility messaging when no squad is possible.
**Verified:** 2026-05-20T18:04:00Z
**Status:** human_needed — all automated checks pass; 5 human smoke-test items require running app
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | User can drag a budget slider in NextSeasonPlannerTab between £80m and £120m in £0.5m steps (default £100m), and the squad formation grid updates without a server round-trip per slider tick | VERIFIED | `<input type="range" min={80} max={120} step={0.5} value={sliderValue}>` at line 289-305 of NextSeasonPlannerTab.tsx; `scoreMapHydrated` useMemo and `clientSquad` useMemo drive in-browser recompute; no fetch per tick; 7 component tests cover this contract (28/28 passing) |
| SC-2 | Recompute commits on pointer release (or 300ms after keyboard navigation) using useDeferredValue, so the slider stays responsive at every tick while expensive greedy work runs only on commit | VERIFIED | `useDeferredValue(committedBudget)` at line 147; `handlePointerUp` sets `committedBudget` at line 180-183; `handleKeyUp` sets a 300ms debounce setTimeout at lines 184-190; keyboard debounce test passes |
| SC-3 | /api/pre-season-squad?include=inputs response includes inputs (players, scoreMap, budget_default) and health; client uses cached inputs for in-browser recompute | VERIFIED | `loadSquadInputs` helper at route.ts line 40-109; conditional spread `...(inputs ? { inputs } : {})` at lines 145, 206; `Object.fromEntries(scoreMap)` at lines 137, 200; `budget_default: 1000` at lines 138, 201; all 6 route tests pass |
| SC-4 | When greedy returns null at the chosen budget, user sees inline message "No squad possible at £X.Xm — try £Y.Ym+" where Y is health.min_feasible_budget_greedy, and the slider track renders amber below the minimum feasible budget threshold | VERIFIED | Infeasibility `<p>` at lines 308-313 with em-dash literal; `trackBackground` useMemo computing linear-gradient at lines 169-174; both variant A and B tests pass; amber+zinc test passes |
| SC-5 | Slider state scoped to NextSeasonPlannerTab via local context (not lifted to page.tsx) | VERIFIED | `sliderValue`, `committedBudget`, `hasCommitted`, `lastValidSquad` only exist in `NextSeasonPlannerTab.tsx`; no props passed to/from page.tsx; no state in a Context provider |

**Score:** 5/5 truths verified

---

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | GW1-8 FDR heatmap update on slider commit | GW1-8-FIXTURES (future, prerequisite-blocked) | REQUIREMENTS.md COST-02: "FDR heatmap update is prerequisite-blocked by GW1-8 fixture data not yet published"; component has TODO(GW1-8-FIXTURES) comment and future-ready HeatMapRow import |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/api/pre-season-squad/route.test.ts` | Route contract tests for ?include=inputs (COST-02) | VERIFIED | Exists; contains `// @vitest-environment node`; 6 tests all pass |
| `src/components/next-season/NextSeasonPlannerTab.test.tsx` | Extended with makeInputs helper and slider tests (COST-01, COST-03) | VERIFIED | Contains `makeInputs`; 28 total tests (13 pre-existing + 15 new), all pass |
| `src/lib/types.ts` | `PreSeasonSquadInputs` interface + optional `inputs?` on `PreSeasonSquadResponse` | VERIFIED | `PreSeasonSquadInputs` at line 1148; `inputs?: PreSeasonSquadInputs` at line 1142 |
| `src/app/api/pre-season-squad/route.ts` | GET(request: NextRequest), loadSquadInputs helper, ?include=inputs query-param gate | VERIFIED | `GET(request: NextRequest)` at line 111; `function loadSquadInputs` at line 40; `searchParams.get('include') === 'inputs'` at line 114 |
| `src/lib/hooks/usePreSeasonSquad.ts` | Optional includeInputs parameter + queryKey discriminator | VERIFIED | `options?: { includeInputs?: boolean }` at line 9; queryKey `['pre-season-squad', includeInputs ? 'with-inputs' : 'default']` at line 12; conditional URL at line 14 |
| `src/components/next-season/NextSeasonPlannerTab.tsx` | Slider + useDeferredValue + infeasibility paragraph + amber gradient | VERIFIED | `useDeferredValue(committedBudget)` at line 147; slider block at lines 284-307; infeasibility `<p>` at lines 308-314; `trackBackground` useMemo at lines 169-174 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `NextSeasonPlannerTab.tsx` | `usePreSeasonSquad.ts` | `usePreSeasonSquad({ includeInputs: true })` | WIRED | Line 127; confirmed by grep |
| `NextSeasonPlannerTab.tsx` | `pre-season-squad.ts` | `buildPreSeasonSquad(inputs.players, scoreMapHydrated, Math.round(deferredBudget * 10))` | WIRED | Line 159; Pitfall 3 (integer coercion) handled |
| `route.ts` | `types.ts` | `import type { PreSeasonSquadInputs } from '@/lib/types'` | WIRED | Line 13 of route.ts |
| `route.ts` | `@vercel/blob + fs/promises` | `readBlobOrLocal('season_archive_gw38.json')` | WIRED | Lines 121-123 conditional read |
| `NextSeasonPlannerTab.tsx` | `health.min_feasible_budget_greedy` | `trackBackground useMemo` on `health?.min_feasible_budget_greedy` | WIRED | Lines 169-174; 2 grep hits (memo + style prop) |
| `route.test.ts` | `route.ts` | `import { GET } from './route'` (dynamic) | WIRED | Line 171 (`await import('./route')`) |
| `WatchlistTab.tsx` | `usePreSeasonSquad.ts` | `usePreSeasonSquad()` (no args) | WIRED — no regression | Uses default path; queryKey `['pre-season-squad','default']`; cache-isolated from planner's `['pre-season-squad','with-inputs']` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `NextSeasonPlannerTab.tsx` | `inputs` | `data?.inputs` from `usePreSeasonSquad({ includeInputs: true })` → fetches `/api/pre-season-squad?include=inputs` | Yes — route reads `season_archive_gw38.json` + `fpl_bootstrap.json`, filters 500+ minutes, computes ppm; returns `{ players, scoreMap, budget_default }` | FLOWING |
| `NextSeasonPlannerTab.tsx` | `clientSquad` | `buildPreSeasonSquad(inputs.players, scoreMapHydrated, Math.round(deferredBudget * 10))` via `useMemo` | Yes — greedy algorithm over real player pool | FLOWING |
| `NextSeasonPlannerTab.tsx` | `health` | `data?.health` — side-read from `pre_season_squad_health.json` | Yes when pipeline has run; null-safe (health may be null pre-pipeline) | FLOWING (null-safe) |
| `NextSeasonPlannerTab.tsx` | `trackBackground` | `useMemo` on `health?.min_feasible_budget_greedy` | Yes — gradient formula is derived from real health data; falls back to `#71717a` when null | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 6 route tests pass | `npx vitest run src/app/api/pre-season-squad/route.test.ts` | 6/6 passed | PASS |
| 28 component tests pass | `npx vitest run src/components/next-season/NextSeasonPlannerTab.test.tsx` | 28/28 passed | PASS |
| 8 greedy unit tests unchanged | `npx vitest run src/lib/pre-season-squad.test.ts` | 8/8 passed | PASS |
| TypeScript: 0 new errors | `npx tsc --noEmit` | 1 error in `decision-history/route.test.ts` (pre-existing, unrelated) | PASS |
| Slider state confined to component | grep `sliderValue|committedBudget|hasCommitted|lastValidSquad` in `src/` | Found only in `NextSeasonPlannerTab.tsx` and its test | PASS |
| WatchlistTab cache key isolated | `usePreSeasonSquad()` call in WatchlistTab.tsx | No args → queryKey `['pre-season-squad','default']`; discriminated from `['pre-season-squad','with-inputs']` | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| COST-01 | 129-03, 129-04 | Budget slider min=80/max=120/step=0.5/default=100, useDeferredValue commit-on-release | SATISFIED | Slider at lines 289-305; useDeferredValue at line 147; handlePointerUp/handleKeyUp at lines 180-190 |
| COST-02 | 129-01, 129-02, 129-03 | /api/pre-season-squad?include=inputs; inputs envelope with players/scoreMap/budget_default; client in-browser recompute | SATISFIED | route.ts GET(request: NextRequest) + loadSquadInputs; PreSeasonSquadInputs type; scoreMapHydrated useMemo; buildPreSeasonSquad call |
| COST-03 | 129-01, 129-04 | Infeasibility "No squad possible at £X.Xm — try £Y.Ym+"; slider track amber below min_feasible | SATISFIED | Infeasibility `<p>` at lines 308-314; trackBackground useMemo + linear-gradient at lines 169-174 |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `NextSeasonPlannerTab.tsx` | 224-226 | `TODO(GW1-8-FIXTURES)` — heatmap deferred | Info | Known prerequisite-blocked deferred item; documented in REQUIREMENTS.md COST-02; hardcoded empty array `nextSeasonFixtures = []` is intentional, not a stub for Phase 129 scope |

No blockers or warnings found in Phase 129 scope.

---

### Human Verification Required

#### 1. Infeasibility message with real FPL data

**Test:** Open `npm run dev` → Plan → Next Season tab. Drag slider to £80m and release.
**Expected:** "No squad possible at £80.0m — try £83.5m+" appears above a (still-visible) formation grid showing the last feasible squad. Amber slider track visible to the left of the min_feasible_budget_greedy threshold.
**Why human:** Requires running server, real pre_season_squad_health.json blob data, and visual inspection of the layout, amber gradient position, and em-dash copy.

#### 2. Feasibility recovery on slider release

**Test:** From the infeasible state at £80m, drag slider back to £100m and release.
**Expected:** Infeasibility message disappears; formation grid updates to a new feasible client squad.
**Why human:** Requires real inputs payload flowing through the route, useDeferredValue settling, and visual confirmation that the grid updates correctly.

#### 3. Re-render isolation (SC-5)

**Test:** While on the Next Season tab with slider visible, open React DevTools Profiler. Drag slider. Switch to Gem Table or Watchlist sub-tab and observe profiler.
**Expected:** GemTable, WatchlistTab, and other plan sub-tabs show zero highlights during slider drag. Only NextSeasonPlannerTab and its children re-render.
**Why human:** Requires React DevTools profiler or console.count instrumentation; cannot be verified statically or by grep alone.

#### 4. Amber gradient visual rendering

**Test:** With health.min_feasible_budget_greedy populated in the blob, inspect the slider element in browser DevTools.
**Expected:** `style.background` contains the correct `linear-gradient(to right, #f59e0b 0%, #f59e0b X%, #71717a X%, #71717a 100%)` where X = ((min_feasible - 80) / 40) * 100.
**Why human:** jsdom normalises inline hex to rgb() in tests; browser rendering may differ; visual gradient appearance needs human confirmation.

#### 5. FDR heatmap deferred state

**Test:** Load the Next Season tab.
**Expected:** Section B "GW1–8 Fixture Difficulty" renders "Fixtures not yet published for next season." — confirming the deferred empty-state is active and not erroring.
**Why human:** Confirms the deferred TODO path is graceful rather than throwing; requires running app.

---

### Gaps Summary

No gaps found. All 5 roadmap success criteria are VERIFIED in the codebase. All 34 automated tests (6 route + 28 component) pass. TypeScript is clean (1 pre-existing error in an unrelated test file). The only items requiring resolution are 5 human smoke tests for visual/runtime behavior that cannot be verified statically.

---

_Verified: 2026-05-20T18:04:00Z_
_Verifier: Claude (gsd-verifier)_
