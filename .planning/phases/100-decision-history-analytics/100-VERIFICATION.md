---
phase: 100-decision-history-analytics
verified: 2026-05-12T15:55:00Z
status: human_needed
score: 11/11 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open the app in a browser, navigate to the Accuracy > Back tab, and confirm the three new sections render correctly with real data."
    expected: "Captain hit rate line visible in the header (e.g. 'Captain hit rate: 3/4 GWs (75%)'); Chip ROI section below the per-GW table with correct chip names (Bench Boost / Triple Captain / Free Hit) and signed delta; Hit Break-Even Tracking table with transfer pairs and ✓/✗/— result column."
    why_human: "Tests mock all data sources. Only a browser session with a real authenticated FPL team ID will confirm the full data pipeline from FPL upstream → route → hook → BackTab renders correctly end-to-end."
  - test: "While not authenticated (no teamId in localStorage), confirm HIST-02 and HIST-03 show the auth-guard prompt but HIST-01 still renders."
    expected: "'Load your squad to see chip ROI and hit tracking.' prompt visible below the per-GW table; Captain hit rate stat still visible in the summary header."
    why_human: "Auth-guard branch is tested with mocked hooks; real unauthenticated state requires a browser session."
  - test: "Toggle dark mode and confirm all new sections render with correct dark-mode colors (zinc/green/red palette)."
    expected: "No white-on-white or invisible text in dark mode for the Chip ROI list, Hit Tracking table, HIST-01 stat, and all state messages (loading, error, empty)."
    why_human: "Dark mode visual rendering cannot be verified programmatically."
---

# Phase 100: Decision History Analytics Verification Report

**Phase Goal:** Add decision history analytics — captain hit rate (HIST-01), chip ROI (HIST-02), hit break-even tracking (HIST-03) — to the BackTab accuracy view.
**Verified:** 2026-05-12T15:55:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SeasonSummary includes captainHitRate (number \| null) and captainHits (number) | VERIFIED | `src/lib/regret.ts` lines 37–48: interface extended with both required fields |
| 2 | computeSeasonSummary returns captainHitRate === null when gwsWithData === 0 | VERIFIED | `src/lib/regret.ts` line 68: `gwsWithData > 0 ? captainHits / gwsWithData : null`; confirmed by 11/11 passing tests |
| 3 | computeSeasonSummary returns captainHitRate === (userWon + tied) / gwsWithData when > 0 | VERIFIED | `src/lib/regret.ts` lines 67–68; test at `regret.test.ts` line 81 asserts 0.75 for 3/4 case |
| 4 | computeSeasonSummary returns captainHits === userWon + tied (tied GWs count as hits per D-02) | VERIFIED | `src/lib/regret.ts` line 67: `const captainHits = userWon + tied`; all-tied test confirms hitRate === 1 |
| 5 | src/lib/types.ts exports ChipRoiEntry, HitTrackingEntry, SeasonAnalytics | VERIFIED | `src/lib/types.ts` lines 709–745: all three interfaces present with correct field shapes |
| 6 | GET /api/season-analytics?teamId={id} returns 200 with { chipRoi, hitTracking } | VERIFIED | `src/app/api/season-analytics/route.ts` exists with full implementation; 8/8 route tests pass |
| 7 | Route returns 400 when teamId is missing or non-numeric | VERIFIED | `route.ts` line 100: `/^\d+$/.test(teamIdParam)` guard returns 400; test coverage confirmed |
| 8 | chipRoi excludes Wildcard; only bboost/3xc/freehit (D-04) | VERIFIED | `route.ts` line 16: `ALLOWED_CHIPS` constant excludes wildcard; test at route.test.ts line 384 asserts exclusion |
| 9 | useSeasonAnalytics hook with queryKey, staleTime 6h, disabled when null/non-numeric | VERIFIED | `src/lib/hooks/useSeasonAnalytics.ts`: queryKey `['season-analytics', teamId]`, staleTime `6 * 60 * 60 * 1000`, enabled guard `/^\d+$/`; 4/4 tests pass |
| 10 | BackTab renders 'Captain hit rate: {N}/{M} GWs ({P}%)' in SeasonSummaryHeader | VERIFIED | `BackTab.tsx` lines 163–170: gated on `captainHitRate !== null`; BackTab test case confirms regex match `/Captain hit rate:\s*3\/4 GWs\s*\(\s*75%\s*\)/` |
| 11 | BackTab renders Chip ROI and Hit Break-Even Tracking sections below per-GW table with auth-guard/loading/error/empty states | VERIFIED | `BackTab.tsx` lines 352–417: full state machine with 5 branches; 15/15 BackTab tests pass including all 9 Phase 100 cases |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/types.ts` | ChipRoiEntry, HitTrackingEntry, SeasonAnalytics interfaces | VERIFIED | Lines 705–745; all fields match plan spec |
| `src/lib/regret.ts` | Extended SeasonSummary + computeSeasonSummary with captainHitRate/captainHits | VERIFIED | Lines 37–70; both interface extension and computation present |
| `src/lib/regret.test.ts` | 11 tests covering D-02 formula, null-when-empty, tied-counts-as-hit | VERIFIED | 11/11 tests pass; 5 tests for captainHitRate contract |
| `src/app/api/season-analytics/route.ts` | GET handler for chip ROI + hit break-even | VERIFIED | 215 lines; full implementation matching spec |
| `src/app/api/season-analytics/route.test.ts` | 8 node-env tests | VERIFIED | 8/8 pass; covers D-04, D-05, Pitfall 3/4/6, partial-failure |
| `src/lib/hooks/useSeasonAnalytics.ts` | TanStack v5 hook | VERIFIED | 49 lines; queryKey, staleTime, enabled guard all correct |
| `src/lib/hooks/useSeasonAnalytics.test.ts` | 4 jsdom tests | VERIFIED | 4/4 pass; disabled-when-null, disabled-when-non-numeric, fetch URL, error propagation |
| `src/components/accuracy/BackTab.tsx` | Extended with HIST-01 stat + HIST-02/03 sections | VERIFIED | 421 lines; useSeasonAnalytics wired; ChipRoiSection + HitTrackingSection present |
| `src/components/accuracy/BackTab.test.tsx` | 9 new tests for Phase 100 | VERIFIED | 15/15 total pass (6 Phase 96 + 9 Phase 100) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/regret.ts` | SeasonSummary interface | `captainHitRate: number \| null` field | WIRED | Interface extended; computeSeasonSummary returns the field |
| `src/app/api/season-analytics/route.ts` | `fantasy.premierleague.com/api/entry/{id}/history/` | `FPL_BASE` direct fetch (not proxy) | WIRED | Line 31: `${FPL_BASE}/entry/${teamId}/history/`; no `/api/fpl/` proxy usage |
| `src/app/api/season-analytics/route.ts` | `fantasy.premierleague.com/api/entry/{id}/transfers/` | `FPL_BASE` direct fetch | WIRED | Line 44: `${FPL_BASE}/entry/${teamId}/transfers/` |
| `src/app/api/season-analytics/route.ts` | `fantasy.premierleague.com/api/element-summary/{id}/` | `Promise.all` parallel fetch with partial-failure fold | WIRED | Lines 164–168: parallel fetch, null on failure |
| `src/app/api/season-analytics/route.ts` | `src/lib/types.ts SeasonAnalytics` | import + return type | WIRED | Line 10: `import type { ChipRoiEntry, HitTrackingEntry, SeasonAnalytics }` |
| `src/lib/hooks/useSeasonAnalytics.ts` | `/api/season-analytics` | `fetch(\`/api/season-analytics?teamId=${teamId}\`)` | WIRED | Line 17: exact URL construction |
| `src/lib/hooks/useSeasonAnalytics.ts` | `src/lib/types.ts SeasonAnalytics` | `useQuery<SeasonAnalytics>` generic | WIRED | Line 14: `import type { SeasonAnalytics }` |
| `src/components/accuracy/BackTab.tsx` | `useSeasonAnalytics` hook | import + `useSeasonAnalytics(teamId)` call | WIRED | Lines 22, 319–323: imported and called alongside useDecisionHistory |
| `src/components/accuracy/BackTab.tsx` | `SeasonSummary.captainHitRate` | `summary.captainHitRate` in SeasonSummaryHeader | WIRED | Lines 163–170: gated render |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `BackTab.tsx` — HIST-01 | `summary.captainHitRate` | `computeSeasonSummary(entries)` via `useMemo` | Yes — computed from real `entries` from `useDecisionHistory` | FLOWING |
| `BackTab.tsx` — HIST-02 | `seasonData.chipRoi` | `useSeasonAnalytics(teamId)` → `/api/season-analytics` → FPL `/history/` | Yes — route fetches FPL upstream, no hardcoded data | FLOWING |
| `BackTab.tsx` — HIST-03 | `seasonData.hitTracking` | `useSeasonAnalytics(teamId)` → `/api/season-analytics` → FPL `/transfers/` + `/element-summary/` | Yes — route fetches FPL upstream with partial-failure fold | FLOWING |
| `route.ts` — seasonAvgPoints | `current[]` from `/history/` | `totalPoints / current.length` | Yes — arithmetic over real FPL fetch | FLOWING |
| `route.ts` — break-even | `element-summary/{id}/history[]` | cumulative sum `round >= event` | Yes — real per-player data; null on fetch failure | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| regret.test.ts — 11 tests | `npx vitest run src/lib/regret.test.ts` | 11 passed | PASS |
| route.test.ts — 8 tests | `npx vitest run src/app/api/season-analytics/route.test.ts` | 8 passed | PASS |
| useSeasonAnalytics.test.ts — 4 tests | `npx vitest run src/lib/hooks/useSeasonAnalytics.test.ts` | 4 passed | PASS |
| BackTab.test.tsx — 15 tests | `npx vitest run src/components/accuracy/BackTab.test.tsx` | 15 passed | PASS |
| TypeScript compilation | `npx tsc --noEmit` | 0 errors | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| HIST-01 | 100-01, 100-04 | Captain hit rate % displayed in BackTab | SATISFIED | computeSeasonSummary returns captainHitRate; BackTab SeasonSummaryHeader renders it gated on non-null |
| HIST-02 | 100-02, 100-04 | Chip ROI vs season average in BackTab | SATISFIED | `/api/season-analytics` assembles chip ROI; ChipRoiSection renders with name mapping and delta color |
| HIST-03 | 100-02, 100-04 | Hit break-even tracking from FPL transfers | SATISFIED | Route fetches `/transfers/` + per-player `/element-summary/`; HitTrackingSection renders table with ✓/✗/— |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

Key checks performed:
- No `TODO`/`FIXME`/`placeholder` in any modified file
- No `return null` / empty stub implementations in route or hook
- No `/api/fpl/` proxy usage in `route.ts` (Pitfall 2) — confirmed zero matches
- No `wildcard` mapping in `BackTab.tsx` (D-04) — confirmed zero matches
- No `onSuccess` option in `useSeasonAnalytics.ts` (Pitfall 7) — confirmed zero matches
- `localStorage` not referenced in `useSeasonAnalytics.ts` (A1) — confirmed zero matches

### Human Verification Required

#### 1. End-to-End Render with Real FPL Data

**Test:** Open the app in a browser with a real authenticated FPL team ID loaded (teamId in localStorage). Navigate to Accuracy > Back tab.

**Expected:**
- Captain hit rate line appears in the summary header section (e.g., "Captain hit rate: 3/4 GWs (75%)")
- Chip ROI section renders below the per-GW table with correct display names: Bench Boost / Triple Captain / Free Hit (not raw FPL strings like bboost/3xc/freehit)
- Delta values are signed (+/- pts) and color-coded (green positive, red negative)
- Hit Break-Even Tracking table renders with GW, transfer pair, net pts, and ✓/✗/— result column
- Multi-transfer hit GWs appear as multiple rows

**Why human:** All hook data sources are mocked in automated tests. Only a live browser session with a real team ID exercises the actual FPL upstream fetch chain: route.ts → FPL /history/ → /transfers/ → /element-summary/ → BackTab render.

#### 2. Unauthenticated Auth-Guard State

**Test:** Clear localStorage / use a fresh session (no teamId). Navigate to Accuracy > Back tab where decision-history data was previously cached.

**Expected:** "Load your squad to see chip ROI and hit tracking." prompt is visible below the per-GW table; HIST-01 captain hit rate stat still appears in the header (if decision-history data is in cache).

**Why human:** The auth-guard branch triggers on `teamId === null` inside BackTab; the interaction with cached vs. absent decision-history data requires real localStorage state, not mock data.

#### 3. Dark Mode Visual Verification

**Test:** Toggle dark mode in the browser and inspect all new Phase 100 UI sections.

**Expected:** No white-on-white or invisible text in dark mode for: Chip ROI list rows, Hit Tracking table cells, HIST-01 stat line, loading/error/empty state messages. Green/red delta colors should be `text-green-400`/`text-red-400` variants in dark mode.

**Why human:** Dark mode color rendering requires browser visual inspection; cannot be verified programmatically.

### Gaps Summary

No gaps identified. All 11 must-haves are verified at all levels (exists, substantive, wired, data-flowing). Three items require human visual verification (end-to-end render, auth-guard state, dark mode), which is expected for a UI phase of this scope.

---

_Verified: 2026-05-12T15:55:00Z_
_Verifier: Claude (gsd-verifier)_
