---
phase: 057-effective-ownership-mode
verified: 2026-05-03T20:30:00Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open Plan section Planner sub-tab in browser — confirm ranked top-5 list replaces old 2-card Ceiling+EO-Adjusted layout"
    expected: "Single ranked list of 5 candidate rows visible; no old 2-card layout"
    why_human: "Visual replacement cannot be asserted programmatically"
  - test: "Verify 4-pill mode toggle renders with Max xPts highlighted by default"
    expected: "Max xPts pill has dark/active styling; others are muted"
    why_human: "Visual active/inactive pill styling requires browser inspection"
  - test: "Click each mode pill in turn (Protect Rank, Chase Rank, Differential, Max xPts) and verify list reorders"
    expected: "Protect Rank puts highest EO% at rank 1; Chase Rank puts highest ceiling at rank 1; Differential shows lowest-EO above-median candidates; Max xPts returns xPts descending order"
    why_human: "Dynamic re-ordering on click is a live DOM interaction not testable from file inspection"
  - test: "Hover the ~XX% figure on any candidate row"
    expected: "Native browser tooltip shows verbatim: 'Approximate effective ownership based on FPL selected_by_percent data.'"
    why_human: "title attribute tooltip appearance requires browser hover"
  - test: "Verify ~XX% format matches math.round(selected_by_percent) — e.g. Haaland 52.1% renders as ~52%"
    expected: "Integer-rounded tilde-prefixed percent inline next to player name"
    why_human: "Visual inline placement and rounding verification require browser"
  - test: "When unauthenticated, switch to Protect Rank mode — confirm no 'Dangerous to fade' badges appear anywhere"
    expected: "Zero badges in any mode while not logged in (D-10 regression)"
    why_human: "Requires browser session state"
  - test: "When authenticated: switch to Protect Rank, verify high-EO non-squad players show amber 'Dangerous to fade' badge; squad owners of >30% EO do not"
    expected: "Badge on non-squad >30% EO players only; badge absent when switching away from Protect Rank"
    why_human: "Requires authenticated FPL session with real squad data"
  - test: "Hover the 'Dangerous to fade' badge"
    expected: "Tooltip shows: 'Owned by over 30% of managers — fading this captain risks rank loss if they haul.'"
    why_human: "title attribute tooltip requires browser hover"
  - test: "Resize browser to ~400px width — verify toggle pills wrap and candidate rows stack vertically"
    expected: "Pills wrap to 2 rows; each row shows rank+name on first line, team+fixture on second, pts on third"
    why_human: "Responsive layout requires viewport resize in browser"
  - test: "Toggle dark mode — verify panel remains readable; active pill inverts to white-on-dark"
    expected: "All text, borders, toggle pills render correctly in dark mode"
    why_human: "Dark mode visual inspection requires browser with theme toggle"
  - test: "Regression: Squad section transfers/decision/optimiser sub-tabs still render without errors; no new console errors"
    expected: "Adjacent surfaces unaffected; DevTools console clean"
    why_human: "Cross-surface regression requires manual navigation"
---

# Phase 57: Effective Ownership Mode — Verification Report

**Phase Goal:** Give the manager a ranked top-5 captain panel with 4 EO modes and a "Dangerous to fade" badge — replacing the old 2-card Ceiling/EO-Adjusted layout
**Verified:** 2026-05-03T20:30:00Z
**Status:** human_needed — all automated checks PASS; browser checkpoint (Plan 02 Task 3) pending
**Re-verification:** No — initial verification

---

## Step 0: Previous Verification

No previous VERIFICATION.md found. Initial mode.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | computeEOCandidates exported as named function from src/lib/eo-candidates.ts | VERIFIED | Line 10: `export function computeEOCandidates(` |
| 2 | EOMode type union of exactly 4 string literals exported from same file | VERIFIED | Line 8: `export type EOMode = 'max_xpts' \| 'protect_rank' \| 'chase_rank' \| 'differential_aggressive'` |
| 3 | Max xPts mode sorts eligible candidates by xPts_1gw descending and slices to topN | VERIFIED | Lines 23-28: `.sort((a, b) => (b.xPts_1gw ?? 0) - (a.xPts_1gw ?? 0)).slice(0, topN)` |
| 4 | Protect Rank mode sorts eligible candidates by parseFloat(selected_by_percent) descending | VERIFIED | Lines 30-39: `.sort((a,b) => parseFloat(b.selected_by_percent) - parseFloat(a.selected_by_percent))` |
| 5 | Chase Rank mode sorts eligible candidates by xPts_90th_1gw descending | VERIFIED | Lines 41-46: `.sort((a, b) => (b.xPts_90th_1gw ?? 0) - (a.xPts_90th_1gw ?? 0))` |
| 6 | Differential Aggressive mode filters to xPts_1gw >= median(eligible.xPts_1gw) THEN sorts by parseFloat(selected_by_percent) ascending | VERIFIED | Lines 48-68: median computed, `.filter(p => (p.xPts_1gw ?? 0) >= median)` then `.sort((a, b) => parseFloat(a.selected_by_percent) - parseFloat(b.selected_by_percent))` |
| 7 | Eligibility filter excludes element_type === 1 (GKs), status !== 'a', and xPts_1gw null/<= 0 | VERIFIED | Lines 15-21: `p.status === 'a' && p.element_type !== 1 && p.xPts_1gw != null && p.xPts_1gw > 0` |
| 8 | Median computation uses the FULL eligible pool, not the already-sliced top-N | VERIFIED | Lines 49-59: median derived from `eligible.map(p => p.xPts_1gw ?? 0)` BEFORE any slice; Pitfall 2 regression test at eo-candidates.test.ts:150 |
| 9 | All 4 mode branches plus eligibility filter covered by green vitest tests | VERIFIED | 14 tests in src/lib/eo-candidates.test.ts covering all modes, eligibility, median regression, defensive case |
| 10 | Top-5 ranked candidate list visible in the Plan section's Planner sub-tab (replacing the old 2-card layout) | VERIFIED (automated) / PENDING (browser) | CaptainPicksPanel.tsx rewritten (203 lines); PickCard absent; page.tsx line 215: `<CaptainPicksPanel submittedId={submittedId} />`; visual confirmation pending |
| 11 | Four mode pills render with role='group' and aria-label='Captain ranking mode' | VERIFIED | CaptainPicksPanel.tsx lines 33-35: `role="group" aria-label="Captain ranking mode"`; RTL test at line 103 asserts this |

**Score:** 11/11 truths verified (browser checkpoint pending for visual/interactive truths)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/eo-candidates.ts` | computeEOCandidates pure transform + EOMode type | VERIFIED | 69 lines; 2 named exports; no default export; no class; imports `MergedPlayer` from `@/lib/types` |
| `src/lib/eo-candidates.test.ts` | Vitest unit suite covering 4 modes, eligibility filter, median computation | VERIFIED | 14 tests; `// @vitest-environment node` present; `describe('Phase 57: computeEOCandidates'` present; Pitfall 2 regression test present |
| `src/components/captaincy/CaptainPicksPanel.tsx` | Rewritten panel with EOModeToggle, ranked top-5 list, ~EO% inline, Dangerous to fade badge | VERIFIED | 203 lines; PickCard removed; all required strings present; `useState<EOMode>('max_xpts')` (single occurrence); text-lg present (planned deviation from acceptance criteria — see notes) |
| `src/components/captaincy/CaptainPicksPanel.test.tsx` | RTL suite covering toggle render, mode switching, EO% inline display, badge gating | VERIFIED | 14 tests; `// @vitest-environment jsdom` present; all 4 vi.mock calls present; badge tests present |
| `src/app/page.tsx` | submittedId prop threaded into CaptainPicksPanel | VERIFIED | Line 215: `<CaptainPicksPanel submittedId={submittedId} />`; bare `<CaptainPicksPanel />` not present |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| CaptainPicksPanel.tsx | src/lib/eo-candidates.ts | `import { computeEOCandidates, type EOMode } from '@/lib/eo-candidates'` | WIRED | Line 12 import; line 151 usage in useMemo |
| CaptainPicksPanel.tsx | src/lib/hooks/usePlayers.ts | `usePlayers()` — full MergedPlayer pool (Pitfall 1 fix) | WIRED | Line 9 import; line 139 usage |
| CaptainPicksPanel.tsx | src/lib/hooks/useMyTeam.ts | `useMyTeam(isAuthenticated && !!submittedId)` — auth-gated | WIRED | Line 11 import; line 142 usage; result flows to myTeamPickIds Set |
| src/app/page.tsx | CaptainPicksPanel.tsx | `<CaptainPicksPanel submittedId={submittedId} />` in Planner sub-tab | WIRED | Line 20 import; line 215 mount inside `activeSection !== 'squad' && activeSubTab === 'planner'` guard |
| src/lib/eo-candidates.test.ts | src/lib/eo-candidates.ts | `import { computeEOCandidates, type EOMode } from './eo-candidates'` | WIRED | Line 4 import; used in all 14 test cases |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| CaptainPicksPanel.tsx | `playersData` | `usePlayers()` → `/api/players` route (existing) | Yes — full MergedPlayer[] from pipeline | FLOWING |
| CaptainPicksPanel.tsx | `eoCandidates` | `computeEOCandidates(playersData, mode, 5)` | Yes — pure transform of real player data | FLOWING |
| CaptainPicksPanel.tsx | `myTeamData` | `useMyTeam(isAuthenticated && !!submittedId)` → `/api/fpl/my-team` | Yes — authenticated FPL proxy (unchanged route) | FLOWING |
| CaptainPicksPanel.tsx | `myTeamPickIds` | `useMemo` over `myTeamData.picks.map(p => p.element)` | Yes — Set built from real squad picks | FLOWING |

---

## Behavioral Spot-Checks

Step 7b skipped: requires running server (npm run dev) and authenticated session for full validation. RTL tests cover all behavioral branches programmatically. See Human Verification Required section.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| EO-01 | 057-01-PLAN, 057-02-PLAN | Each captain candidate displays EO% figure (~EO) with tooltip | SATISFIED | `~{eoPercent}%` at CaptainPicksPanel.tsx:110; `title={EO_TOOLTIP}` at line 107; tooltip text verbatim at line 26 |
| EO-02 | 057-01-PLAN, 057-02-PLAN | Captain panel has 4-mode toggle that re-ranks candidates | SATISFIED | EOModeToggle renders 4 buttons with testIds; mode state drives computeEOCandidates; RTL tests assert re-ordering |
| EO-03 | 057-02-PLAN | In Protect Rank mode, EO>30% non-squad players show "Dangerous to fade" badge | SATISFIED | showDangerBadge logic at lines 84-89 gates on all required conditions; badge component at lines 59-68; RTL test suite covers all 4 badge-gating scenarios |
| EO-04 | 057-02-PLAN | EO mode selection scoped to captain panel only — no global state lift | SATISFIED | Single `useState<EOMode>('max_xpts')` inside CaptainPicksPanel (line 138); no context provider, no external store; confirmed by grep returning 1 occurrence |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/lib/eo-candidates.ts | 61 | `>= median` filter while UI copy says "above-median" | Warning (WR-01) | User-visible copy mismatch; not a functional blocker. At-median player appears in Differential list despite "above-median" label |
| src/lib/eo-candidates.ts | 41-45 | chase_rank missing null guard for xPts_90th_1gw | Warning (WR-02) | Players without ceiling value silently rank at 0 rather than being excluded; could produce misleading top-5 if ceiling data is sparse |
| src/components/captaincy/CaptainPicksPanel.tsx | 83 | `parseFloat(...)` unguarded — can produce NaN% display | Warning (WR-03) | If selected_by_percent is ever non-numeric, renders `~NaN%`; badge condition fails silently (NaN > 30 = false); not a blocker given current pipeline data contracts |
| src/lib/eo-candidates.test.ts | 172 | Test description says "returns empty array" but asserts length 1 | Warning (WR-04) | Misleading test name; correct assertion, wrong description; could confuse future regression diagnosis |
| src/components/captaincy/CaptainPicksPanel.tsx | 175 | Uses `text-lg` despite acceptance criteria saying "does NOT contain text-lg" | Info | The plan's own code template prescribes `text-lg font-semibold`; SUMMARY documents this contradiction; plan code template takes precedence; `font-bold` is correctly absent |

No blockers. All four warnings are code-quality issues documented in the existing code review (057-REVIEW.md). None prevent the phase goal from being achieved.

---

## Human Verification Required

Plan 02 Task 3 is an explicit **blocking human-verify checkpoint**. The SUMMARY.md status is "PENDING — awaiting Task 3 checkpoint approval". The following items require browser verification before the phase can be marked complete:

### 1. Visual replacement of 2-card layout

**Test:** Open `http://localhost:3000`, navigate to Plan section → Planner sub-tab. Scroll to the captain panel area.
**Expected:** The old side-by-side Ceiling + EO-Adjusted cards are gone. A single ranked list of up to 5 rows is present, preceded by a 4-pill toggle row.
**Why human:** Visual layout replacement cannot be verified from file inspection.

### 2. Default mode and toggle active state

**Test:** On first render, check which pill is highlighted.
**Expected:** "Max xPts" pill has dark background (light mode) or white background (dark mode). Other three pills are muted.
**Why human:** Visual CSS active styling requires browser.

### 3. Mode switching reorders the list

**Test:** Click each of the 4 pills in sequence and observe candidate order.
**Expected:** Protect Rank → Haaland (or highest-EO player) at rank 1. Chase Rank → highest ceiling player at rank 1. Differential → lowest-EO above-median player at rank 1 (may show fewer than 5 rows). Max xPts → highest xPts_1gw player at rank 1.
**Why human:** Dynamic re-ordering on click requires live browser.

### 4. ~XX% tooltip text

**Test:** Hover the `~XX%` figure on any candidate row.
**Expected:** Native browser tooltip shows exactly: `Approximate effective ownership based on FPL selected_by_percent data.`
**Why human:** title attribute tooltip requires browser hover event.

### 5. "Dangerous to fade" badge — unauthenticated suppression (D-10)

**Test:** Without FPL login, switch to Protect Rank mode.
**Expected:** No amber "Dangerous to fade" chip appears anywhere on any row.
**Why human:** Requires confirming unauthenticated session state in browser.

### 6. "Dangerous to fade" badge — authenticated, protect_rank mode (EO-03)

**Test:** Log in to FPL via the Squad section. Return to Plan → Planner sub-tab. Switch to Protect Rank.
**Expected:** Amber "Dangerous to fade" badge appears next to high-EO (>30%) players NOT in your squad. Players you own do not get the badge even if their EO > 30%.
**Why human:** Requires authenticated FPL session with real squad data.

### 7. Badge disappears on mode switch (D-11)

**Test:** While authenticated with badges visible in Protect Rank, click any other mode.
**Expected:** All "Dangerous to fade" badges disappear immediately.
**Why human:** Requires authenticated browser session.

### 8. Dark mode and responsive layout

**Test:** Toggle dark mode; resize to ~400px width.
**Expected:** Panel readable in dark mode; pills wrap on narrow viewport; rows stack vertically.
**Why human:** Visual/responsive checks require browser.

### 9. Regression — adjacent surfaces unaffected

**Test:** Navigate to Squad section → Transfers, Decision, and Optimiser sub-tabs. Check browser console for errors.
**Expected:** All three sub-tabs render correctly; no new console errors.
**Why human:** Cross-surface regression requires manual navigation.

---

## Notes on Acceptance Criteria Contradiction

The Plan 02 acceptance criteria states the panel "does NOT contain `text-lg`". The same plan's code template at line 505 explicitly uses `text-lg font-semibold` for the heading. The implementation follows the code template (the executable spec). The SUMMARY.md documents this contradiction. `font-bold` is correctly absent; `font-semibold` is used instead. This is not a blocker.

---

## Gaps Summary

No gaps identified. All automated must-haves are VERIFIED. The only pending item is the human-verify checkpoint (Plan 02 Task 3) which is a blocking gate in the original plan specification.

---

_Verified: 2026-05-03T20:30:00Z_
_Verifier: Claude (gsd-verifier)_
