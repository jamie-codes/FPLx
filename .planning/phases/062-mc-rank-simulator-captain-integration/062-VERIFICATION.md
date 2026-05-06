---
phase: 62-mc-rank-simulator-captain-integration
verified: 2026-05-06T03:40:00Z
status: human_needed
score: 4/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Confirm P(top-10k) is either shown in RankSimTab or intentionally omitted"
    expected: "ROADMAP SC-1 says the simulator shows 'P(top-10k), P(rank gain), and P(rank drop)'. The implementation renders only P(rank gain) and P(rank drop) — no P(top-10k) stat. Either confirm this deviation is acceptable (the plan's UI-SPEC may have narrowed scope) or flag as a gap to close."
    why_human: "SC-1 lists P(top-10k) explicitly. The UI-SPEC narrowed to two stats; the PLAN's must_haves do not mention top-10k. Cannot determine programmatically whether this is an intentional scope reduction or an omission."
---

# Phase 62: MC Rank Simulator & Captain Integration — Verification Report

**Phase Goal:** Users can simulate where their rank will be after 5 GWs under their current XI vs an alternative XI, and captain recommendations are augmented with MC-derived labels (highest ceiling, lowest floor, best P(haul))
**Verified:** 2026-05-06T03:40:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | 5-GW rank trajectory simulator shows P(top-10k), P(rank gain), P(rank drop) for current XI | ? UNCERTAIN | P(rank gain) and P(rank drop) are present in RankSimTab.tsx (lines 237–246). P(top-10k) is absent — no match for "top-10k" anywhere in src/components/planner/RankSimTab.tsx. Plan 03 must_haves do not include P(top-10k); the narrowing may be intentional. |
| SC-2 | User can define an alternative XI by swapping players and see rank trajectory comparison | ✓ VERIFIED | Sell/Buy dropdowns in RankSimTab.tsx (lines 300–346). altInfo useMemo computes alt trajectory (lines 127–145). chartData merges altMean (lines 148–154). Alt XI dashed amber line rendered conditionally (line 288). Test 7 asserts "Alt XI (transfer)" legend appears. |
| SC-3 | Each captain candidate shows one MC label (Highest ceiling / Lowest floor / Best P(haul)) with simulated value | ✓ VERIFIED | computeMCLabels pure ranker in src/lib/mc-labels.ts (greedy cascade, lines 18–79). McLabel badge rendered in CaptainPicksPanel.tsx (lines 72–81, 129). mcLabelMap.get(c.id) passed to each CandidateRow (line 241). 20/20 CaptainPicksPanel tests pass. |
| SC-4 | TC recommendation surfaces player with highest P(haul) annotated with probability | ✓ VERIFIED | tcCandidate useMemo in CaptainPicksPanel.tsx (lines 172–178) selects highest haul_prob candidate. TC callout JSX (lines 214–224) renders "TC: {web_name} — N% P(haul)". data-testid="tc-callout". Test confirms hidden when haul_prob absent. |
| SC-5 | Rank simulator degrades gracefully when squad not loaded — shows explanatory prompt | ✓ VERIFIED | No-squad branch in RankSimTab.tsx (lines 195–208) renders "Load your squad to run the rank simulator" with sub-copy. Test 1 asserts this copy. picks === null guard verified by code inspection. |

**Score:** 4/5 truths verified (SC-1 uncertain — see human verification)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/mc-labels.ts` | computeMCLabels pure ranker, MCDimension type, MCLabel interface | ✓ VERIFIED | 80 lines, exports computeMCLabels, MCDimension, MCLabel. MC-absent guard on line 21. Three dimension blocks. |
| `src/lib/mc-labels.test.ts` | 12 tests, describe('Phase 62: computeMCLabels' | ✓ VERIFIED | 12/12 tests pass. Covers empty input, absent haul_prob gate, priority cascade, 3-label cap, value formatting. |
| `src/components/captaincy/CaptainPicksPanel.tsx` | McLabel badge, tcCandidate useMemo, mcLabels useMemo, mcLabelMap useMemo, TC callout | ✓ VERIFIED | All additions present. function McLabel at line 72. tcCandidate at line 172. mcLabels/mcLabelMap at lines 181–185. TC callout at line 214. |
| `src/components/captaincy/CaptainPicksPanel.test.tsx` | Phase 62 MC-04 captain enrichment describe block, 6 tests | ✓ VERIFIED | 20/20 tests pass (14 Phase 57 + 6 Phase 62). TC callout + mc-label-badge coverage confirmed. |
| `src/lib/rank-sim.ts` | computeXITrajectory, ChartPoint, computeBeatTheAverageProb | ✓ VERIFIED | 169 lines. Exports computeXITrajectory, computeXIPerGwStats, computeBeatTheAverageProb, ChartPoint. SIGMA_SCALE=2.56. Captain doubling in mean and sigma. sqrt(N) scaling. erf A&S approximation. |
| `src/lib/rank-sim.test.ts` | 12 tests, describe('Phase 62: computeXITrajectory' | ✓ VERIFIED | 12/12 tests pass. Covers empty input, GW labels, captain doubling, sigma math, BGW zero-contribution, CDF reference points. |
| `src/lib/hooks/useEntryRank.ts` | TanStack Query hook, /^\d+$/ guard, 5-min staleTime | ✓ VERIFIED | 35 lines. Dual /^\d+$/ guard (enabled gate + queryFn defence-in-depth). staleTime 5min. retry:1. |
| `src/lib/hooks/useEntryRank.test.ts` | 7 tests, describe('useEntryRank' | ✓ VERIFIED | 7/7 tests pass. Covers null, empty, non-numeric, mixed disabled states. Fetch URL assertion. Null-field guard. Non-ok error. |
| `src/app/api/gw-average/route.ts` | GET route, gw_review_gw scan, non-zero filter | ✓ VERIFIED | 50 lines. Scans GW38→1. average_score > 0 filter on line 37. Null fallback on line 48. |
| `src/lib/hooks/useGwAverage.ts` | TanStack Query hook, /api/gw-average, 30-min staleTime | ✓ VERIFIED | 27 lines. queryKey ['gw-average']. staleTime 30min. |
| `package.json` | recharts dependency | ✓ VERIFIED | "recharts": "^3.8.1" confirmed in dependencies. @types/recharts absent. |
| `src/components/planner/RankSimTab.tsx` | 4th Plan sub-tab, ComposedChart, fan chart, rank header, dropdowns | ✓ VERIFIED | 352 lines. Uses ComposedChart (not AreaChart). hide={true} on band Areas. fill="var(--background)" for dark-mode erase. formatRank with en-GB locale. No-squad branch. data-testid="rank-sim-tab" on both branches. |
| `src/components/planner/RankSimTab.test.tsx` | 10 tests, describe('RankSimTab' | ✓ VERIFIED | 10/10 tests pass. All 10 UI states covered per plan spec. |
| `src/app/page.tsx` | rank-sim in SubTab union, SECTIONS Plan entry 4th, RankSimTab import + render | ✓ VERIFIED | Line 24: import RankSimTab. Line 66: 'rank-sim' in SubTab union. Lines 90-91: rank-sim as 4th Plan sub-tab. Lines 279-281: render conditional `activeSection === 'plan' && activeSubTab === 'rank-sim'`. |
| `src/app/page.test.tsx` | RankSimTab mock + Phase 62 nav test | ✓ VERIFIED | 13/13 tests pass. "Phase 62: renders RankSimTab when Plan → Rank Sim sub-tab is active" test present and passing. |
| `src/components/nav/MobileNav.test.tsx` | Rank Sim pill assertion | ✓ VERIFIED | 9/9 tests pass. "Phase 62: Plan active includes Rank Sim pill (MC-03)" test passing. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| CaptainPicksPanel.tsx | src/lib/mc-labels.ts | `import { computeMCLabels, type MCLabel } from '@/lib/mc-labels'` | ✓ WIRED | Line 13 of CaptainPicksPanel.tsx. computeMCLabels called in useMemo at line 181. |
| CaptainPicksPanel.tsx (CandidateRow) | McLabel sub-component | `<McLabel label={mcLabel.label} value={mcLabel.value} />` | ✓ WIRED | Line 129. `{mcLabel && <McLabel .../>}` conditional render. |
| CaptainPicksPanel.tsx | TC callout DOM block | `{tcCandidate && <div data-testid="tc-callout">...}` | ✓ WIRED | Lines 214-224. Guarded by tcCandidate useMemo. |
| src/app/page.tsx (SECTIONS) | RankSimTab.tsx | `import { RankSimTab }` + render conditional `activeSubTab === 'rank-sim'` | ✓ WIRED | Line 24 import. Lines 279-281 render conditional. |
| RankSimTab.tsx | src/lib/rank-sim.ts | `import { computeXITrajectory, ... } from '@/lib/rank-sim'` | ✓ WIRED | Lines 26-30. Used in currentTrajectory and altInfo useMemos. |
| RankSimTab.tsx | useEntryRank | `import { useEntryRank } from '@/lib/hooks/useEntryRank'` | ✓ WIRED | Line 23. Called at line 84: `const rankQuery = useEntryRank(submittedId)`. |
| RankSimTab.tsx | useGwAverage | `import { useGwAverage } from '@/lib/hooks/useGwAverage'` | ✓ WIRED | Line 24. Called at line 85. gwAvgData.average_score consumed in pStats useMemo. |
| RankSimTab.tsx | recharts ComposedChart | `import { ComposedChart, Area, Line, ... } from 'recharts'` | ✓ WIRED | Lines 15-17. ComposedChart used at line 274. |
| useEntryRank.ts | /api/fpl/entry/{teamId}/ | `fetch('/api/fpl/entry/${teamId}/')` | ✓ WIRED | Line 22. Guarded by /^\d+$/ in both enabled gate and queryFn. |
| useGwAverage.ts | /api/gw-average | `fetch('/api/gw-average')` | ✓ WIRED | Line 15. |
| /api/gw-average/route.ts | pipeline/cache/gw_review_gw*.json | `readFile(join(cacheDir, 'gw_review_gw${gw}.json'))` | ✓ WIRED | Line 32. Non-zero average_score filter at line 37. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| RankSimTab.tsx | chartData | computeXITrajectory(startingXIIds, captainId, playerMap) via useMemo | Yes — math over real player xPts_1gw/p10_pts/p90_pts from usePlayers | ✓ FLOWING |
| RankSimTab.tsx | rankQuery.data | useEntryRank(submittedId) → /api/fpl/entry/{teamId}/ → FPL API | Yes — live FPL proxy (null when submittedId absent — shows em-dash) | ✓ FLOWING |
| RankSimTab.tsx | pStats | computeBeatTheAverageProb + gwAvgData.average_score | Yes — null when gwAvgData.average_score is null (dev/seed state shows em-dash) | ✓ FLOWING |
| CaptainPicksPanel.tsx | mcLabels | computeMCLabels(eoCandidates) | Yes — live from usePlayers; returns [] when haul_prob absent (pre-MC pipeline state) | ✓ FLOWING |
| CaptainPicksPanel.tsx | tcCandidate | eoCandidates.reduce over haul_prob | Yes — null when no haul_prob present; renders nothing when null | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| recharts importable at runtime | `node -e "const r = require('recharts'); ['ComposedChart','Area','Line'].forEach(k => { if(!r[k]) process.exit(1); }); console.log(require('recharts/package.json').version)"` | `3.8.1` | ✓ PASS |
| mc-labels.ts exports present | grep exports | computeMCLabels, MCDimension, MCLabel all present | ✓ PASS |
| rank-sim.ts exports present | grep exports | computeXITrajectory, computeXIPerGwStats, computeBeatTheAverageProb, ChartPoint all present | ✓ PASS |
| @types/recharts absent | `grep '"@types/recharts"' package.json` | no match | ✓ PASS |
| P(top-10k) in RankSimTab | grep for "top-10k" | no match | ✗ ABSENT (see SC-1 uncertainty) |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MC-03 | Plans 02, 03 | 5-GW rank trajectory simulator with P(rank gain)/P(rank drop) and alt XI comparison | ✓ SATISFIED | RankSimTab.tsx renders ComposedChart fan chart (6 data points), 3-column rank header, Sell/Buy dropdowns, alt XI dashed line. Recharts installed. Math substrate verified with 12 tests. 10/10 RankSimTab tests pass. Human UAT approved per 062-03-SUMMARY.md. |
| MC-04 | Plan 01 | MC captain labels (Highest ceiling / Lowest floor / Best P(haul)) + TC recommendation | ✓ SATISFIED | computeMCLabels 12/12 tests pass. McLabel badge in CaptainPicksPanel 6/6 new tests pass. TC callout rendered when haul_prob present, hidden otherwise. |

Note: ROADMAP SC-1 also lists P(top-10k) as part of MC-03 — not implemented. The PLAN's must_haves do not include P(top-10k), suggesting scope was narrowed at planning time. Requires human confirmation.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/components/planner/RankSimTab.tsx` line 39 | `horizon` prop accepted but unused ("unused for now — fan chart is fixed at 5 GWs") | ℹ Info | Not a stub — behavior is intentional per D-06 (fixed 5-GW horizon). No rendering impact. |
| `src/app/api/gw-average/route.ts` line 16 | `export const dynamic = 'force-dynamic'` (deviates from plan which specified 'force-static') | ℹ Info | Functionally correct — reads filesystem and returns live data. Plan specified 'force-static' but 'force-dynamic' is the safer choice for a filesystem-reading route. No impact on correctness. |

No blocker anti-patterns found. No TODO/FIXME/placeholder comments in key files. No hardcoded empty data in rendered paths. All useMemos have real data sources.

---

### Human Verification Required

#### 1. P(top-10k) omission — scope confirmation

**Test:** Review the UI-SPEC for Phase 62 (`062-UI-SPEC.md`) and confirm whether P(top-10k) was explicitly removed from scope during the UI design phase.

**Expected:** Either:
  - (a) UI-SPEC confirms P(top-10k) was intentionally dropped in favour of only P(rank gain) / P(rank drop) — in which case ROADMAP SC-1 should be annotated as met-with-deviation and this verification passes, OR
  - (b) P(top-10k) is still required — in which case a gap exists: add a third stat column to the rank header block showing P(score > top-10k threshold)

**Why human:** The ROADMAP SC-1 explicitly names all three stats. The PLAN's `must_haves` only lists two. Determining which document takes precedence requires a judgment call. The SUMMARY says "Status: COMPLETE" without mentioning P(top-10k). The UI-SPEC may have narrowed scope.

---

### Gaps Summary

No hard blockers identified. The only open item is the P(top-10k) omission in SC-1, which requires human judgment on whether the UI-SPEC intentionally narrowed scope. All code paths verified as substantive and wired. All automated tests pass (31+20+10+24 = 85 tests across all phase-62 files, all green). Human UAT was approved per 062-03-SUMMARY.md.

If the P(top-10k) omission is accepted as intentional scope narrowing (the most likely interpretation given the PLAN's must_haves contract did not list it), the phase passes.

---

_Verified: 2026-05-06T03:40:00Z_
_Verifier: Claude (gsd-verifier)_
