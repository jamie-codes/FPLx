---
phase: 11-explainability-replacement-shortlist
verified: 2026-03-30T18:39:30Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 11: Explainability + Replacement Shortlist — Verification Report

**Phase Goal:** Expose the "why" behind each recommendation and surface replacement options for Sell-verdicted players, closing the last explainability gap in the decision engine.
**Verified:** 2026-03-30T18:39:30Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

Truths are drawn from the three PLAN frontmatter `must_haves` blocks, covering all three plans.

#### Plan 01 Truths (EXP-01, EXP-02)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `computeExplanations` returns positive reasons for strong players (fixture run, form, xG, xA, set pieces, differential, start prob) | VERIFIED | All signal branches confirmed in `src/lib/explain.ts` lines 19–69; 20 tests pass |
| 2 | `computeExplanations` returns negative reasons for weak players (poor form, difficult fixtures, low start prob, low xG) | VERIFIED | Lines 23–53 of `explain.ts`; test cases for Poor form / Difficult fixtures / Low start probability / Low xG all pass |
| 3 | `computeExplanations` excludes `mins_risk` and `cost_change_start` from reasons per D-03 | VERIFIED | `grep mins_risk\|rotation explain.ts` — no matches; two dedicated exclusion tests pass |
| 4 | `selected_by_percent` is parsed as float before comparison (Pitfall 2) | VERIFIED | `explain.ts` line 67: `const owned = parseFloat(player.selected_by_percent)` |

#### Plan 02 Truths (REC-02)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 5 | `computeReplacementShortlist` returns 3–5 same-position alternatives ranked by `proj_pts_1gw` delta descending | VERIFIED | `replacement-shortlist.ts` lines 43–44: `.sort((a, b) => b.pts_delta - a.pts_delta).slice(0, count)`; sort-order test passes |
| 6 | Shortlist excludes players already in the squad | VERIFIED | Line 34: `!squadIds.has(candidate.id)`; squad-exclusion test passes |
| 7 | Shortlist excludes players with `proj_pts_1gw <= 0` | VERIFIED | Line 36: `candidate.proj_pts_1gw > 0`; zero/negative projection test passes |
| 8 | Each entry includes `budget_sufficient` boolean using transfer-engine budget arithmetic | VERIFIED | Lines 28, 41: `available_budget = bankBalance/10 + sellPlayer.now_cost/10`; both true/false budget tests pass |

#### Plan 03 Truths (EXP-01, EXP-02, REC-02)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 9 | User can click a toggle on any starting-XI player row to expand an inline panel showing natural-language reasons | VERIFIED | `SquadView.tsx` lines 133–141: chevron button with `onClick={() => toggleExpand(pick.element)}` behind `!isBench` guard |
| 10 | User can see replacement shortlist below reasons for Sell-verdicted players | VERIFIED | `SquadView.tsx` lines 184–185: `verdict === 'sell' ? computeReplacementShortlist(...)  : null`; `ExplainPanel` renders shortlist when non-null |
| 11 | Each shortlist entry shows player name, team, projected pts gain, and affordability indicator | VERIFIED | `ExplainPanel.tsx` lines 29–35: `web_name`, `team_short_name`, `+{pts_delta.toFixed(1)} pts`, Affordable/Over budget pills |
| 12 | Clicking the toggle again collapses the panel | VERIFIED | `SquadView.tsx` lines 57–61: `toggleExpand` uses immutable Set — `next.delete(id)` on second click; `expandedIds.has` guards render |
| 13 | Bench players do not show an expand toggle | VERIFIED | Line 133: `{!isBench && (<button ...>)}` — bench guard confirmed; bench defined as `pick.position >= 12` (line 124) |

**Score:** 13/13 truths verified (5 truths in Plan 01+02 frontmatter + 8 in Plan 03 frontmatter all pass; condensed to 9 must-have groups above)

---

### Required Artifacts

| Artifact | Expected | Level 1 (Exists) | Level 2 (Substantive) | Level 3 (Wired) | Level 4 (Data Flows) | Status |
|----------|----------|------------------|-----------------------|-----------------|----------------------|--------|
| `src/lib/explain.ts` | `computeExplanations` pure function | PASS (74 lines) | PASS — full signal implementation, all threshold constants exported | PASS — imported & called in `SquadView.tsx` line 9, 182 | PASS — receives live `ScoredPlayer` from `allPlayers` prop (real pipeline data) | VERIFIED |
| `tests/lib/explain.test.ts` | TDD tests for all signal branches; min 80 lines | PASS (273 lines) | PASS — 20 `it(` blocks across 8 describe groups | N/A (test file) | N/A | VERIFIED |
| `src/lib/replacement-shortlist.ts` | `computeReplacementShortlist` + `ShortlistEntry` interface | PASS (45 lines) | PASS — full filter/map/sort/slice implementation, both exports present | PASS — imported & called in `SquadView.tsx` lines 10, 185 | PASS — receives live `allPlayers`, `squadIds`, `entryHistory.bank` | VERIFIED |
| `tests/lib/replacement-shortlist.test.ts` | TDD tests for shortlist logic; min 60 lines | PASS (223 lines) | PASS — 11 `it(` blocks covering all specified behaviors | N/A (test file) | N/A | VERIFIED |
| `src/components/squad/ExplainPanel.tsx` | Inline expand panel rendering reasons and shortlist | PASS (43 lines) | PASS — renders reasons `<ul>` + conditional shortlist section with affordability pills | PASS — imported in `SquadView.tsx` line 11, rendered at line 190 | PASS — receives live `reasons` and `shortlist` computed inline before render | VERIFIED |
| `src/components/squad/SquadView.tsx` | Expand state management, toggle button, ExplainPanel rendering | PASS (modified) | PASS — `expandedIds` state, `toggleExpand`, `squadIds`, conditional expand `<tr>` | PASS — used in `TransferPanel.tsx` lines 132–136 with all four live props | PASS — all props (`picks`, `allPlayers`, `entryHistory`, `verdicts`) populated from real API data | VERIFIED |

---

### Key Link Verification

| From | To | Via | Status | Detail |
|------|----|-----|--------|--------|
| `src/lib/explain.ts` | `src/lib/types.ts` | `ScoredPlayer` import | WIRED | Line 1: `import type { ScoredPlayer } from '@/lib/types'` |
| `src/lib/replacement-shortlist.ts` | `src/lib/types.ts` | `ScoredPlayer` import | WIRED | Line 1: `import type { ScoredPlayer } from '@/lib/types'` |
| `src/components/squad/SquadView.tsx` | `src/lib/explain.ts` | `computeExplanations` import | WIRED | Line 9: `import { computeExplanations } from '@/lib/explain'`; called line 182 |
| `src/components/squad/SquadView.tsx` | `src/lib/replacement-shortlist.ts` | `computeReplacementShortlist` import | WIRED | Line 10: `import { computeReplacementShortlist } from '@/lib/replacement-shortlist'`; called line 185 |
| `src/components/squad/SquadView.tsx` | `src/components/squad/ExplainPanel.tsx` | `ExplainPanel` import | WIRED | Line 11: `import { ExplainPanel } from '@/components/squad/ExplainPanel'`; rendered line 190 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ExplainPanel.tsx` | `reasons: string[]` | `computeExplanations(player)` called inline in `SquadView` with live `ScoredPlayer` from `allPlayers` prop | Yes — `allPlayers` = `scoredPlayers` from `TransferPanel`, populated from pipeline API | FLOWING |
| `ExplainPanel.tsx` | `shortlist: ShortlistEntry[] \| null` | `computeReplacementShortlist(player, allPlayers, squadIds, entryHistory.bank)` for Sell verdict; `null` otherwise | Yes — same `allPlayers` population; `entryHistory.bank` from FPL API via `squadData` | FLOWING |
| `SquadView.tsx` | `verdicts: Map<number, Verdict>` | `computeVerdicts(squadData.picks, scoredPlayers)` in `TransferPanel` | Yes — computed from live squad + scored players | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| `computeExplanations` returns correct reasons | `npx vitest run tests/lib/explain.test.ts` | 20/20 passed | PASS |
| `computeReplacementShortlist` filters + sorts correctly | `npx vitest run tests/lib/replacement-shortlist.test.ts` | 11/11 passed | PASS |
| Full suite remains green (no regressions) | `npx vitest run` | 157 passed, 8 skipped, 0 failed (15 files) | PASS |
| `explain.ts` contains no `mins_risk` / `rotation` strings | `grep mins_risk\|rotation src/lib/explain.ts` | No matches | PASS |
| `parseFloat` used for `selected_by_percent` | `grep parseFloat src/lib/explain.ts` | Found line 67 | PASS |
| `ExplainPanel` wired with live props in app | `grep -rn SquadView src/ --include=*.tsx` (non-self) | `TransferPanel.tsx` line 132, all 4 props live | PASS |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| EXP-01 | Plan 01, Plan 03 | User can see natural-language "why this player" reasons per recommendation | SATISFIED | `computeExplanations` maps 9 signal categories to reason strings; `ExplainPanel` renders them as `<ul>` in expandable row of `SquadView` |
| EXP-02 | Plan 01, Plan 03 | User can see risk flags per player (rotation concern / fixture swing / regression risk / poor form) | SATISFIED | Negative reasons (poor form, difficult fixtures, low start prob, low xG for MID/FWD) implemented as risk signals per D-04; explicitly excludes `mins_risk`/`rotation` which are shown separately via `MinsRiskBadge` |
| REC-02 | Plan 02, Plan 03 | User can see replacement shortlist (3–5 alternatives with projected pts delta) for Sell candidates | SATISFIED | `computeReplacementShortlist` returns up to 5 same-position alternatives sorted by pts delta desc, with `budget_sufficient` flag; rendered in `ExplainPanel` only when `verdict === 'sell'` |

No orphaned requirements — all three IDs (EXP-01, EXP-02, REC-02) are declared in plan frontmatter and have verified implementations. REQUIREMENTS.md traceability table confirms all three are assigned to Phase 11.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `SquadView.tsx` | 103 | `return null` | INFO | React conditional rendering for empty position groups — not a stub. Expected pattern. |

No blockers or warnings found. The `return null` at line 103 is a standard React conditional render for position groups with no players — it is not a stub or placeholder affecting phase functionality.

---

### Human Verification Required

The following items were confirmed by human during Plan 03 Task 3 (checkpoint:human-verify gate) and cannot be re-run programmatically:

**1. Expand/collapse visual behavior**
- Test: Open Squad page, click chevron on a starting XI player
- Expected: Panel expands below the row with natural-language reasons; click again collapses it
- Why human: Interactive state behavior, not testable via grep or static analysis
- Status: APPROVED (documented in 11-03-SUMMARY.md)

**2. Sell player shortlist section**
- Test: Find a Sell-badged player, expand their row
- Expected: "Replacement options" section appears below reasons with ranked alternatives showing pts delta and Affordable/Over budget pills
- Why human: Visual rendering and data accuracy require live FPL data
- Status: APPROVED (documented in 11-03-SUMMARY.md)

**3. Bench player chevron exclusion**
- Test: Inspect opacity-50 bench player rows
- Expected: No chevron toggle visible on bench rows
- Why human: CSS opacity and button rendering requires visual inspection
- Status: APPROVED (documented in 11-03-SUMMARY.md)

---

### Gaps Summary

No gaps. All must-haves from all three plan frontmatters verified.

- Phase 11 delivered all three requirements end-to-end: EXP-01, EXP-02, REC-02
- Two pure functions (`computeExplanations`, `computeReplacementShortlist`) are fully implemented, tested (31 tests), and wired into the UI
- `ExplainPanel` component is substantive, wired into `SquadView`, and `SquadView` is used in the live app via `TransferPanel`
- Data flows from the real pipeline through all layers — no hardcoded stubs or empty returns in the render path
- Full test suite green (157 passed, 8 skipped) with no regressions

---

_Verified: 2026-03-30T18:39:30Z_
_Verifier: Claude (gsd-verifier)_
