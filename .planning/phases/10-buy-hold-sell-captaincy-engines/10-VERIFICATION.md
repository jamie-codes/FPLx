---
phase: 10-buy-hold-sell-captaincy-engines
verified: 2026-03-30T15:45:00Z
status: human_needed
score: 17/17 must-haves verified
re_verification: false
human_verification:
  - test: "Navigate to Transfers tab, enter a valid FPL Team ID, click Load Squad. Check the SquadView table."
    expected: "A 'Rec' column appears after the 'Risk' column. Starting-XI players show Buy (green), Hold (grey), or Sell (red) badges. Bench players (opacity-50 rows) show no badge in the Rec cell. Hovering a badge shows its tooltip."
    why_human: "Visual rendering, badge colors, and tooltip hover cannot be verified by static code analysis."
  - test: "With squad loaded, inspect the section below the SquadView table."
    expected: "A 'Captaincy Picks — GW {N}' panel appears with up to 5 ranked rows. Each row shows: rank number, player name, team abbreviation, projected captain pts formatted as 'X.X pts (C)', a Safe (blue) or Upside (amber) type badge, and a MinsRisk badge."
    why_human: "Visual rendering, badge colors, and formatted number display cannot be verified by static code analysis."
  - test: "Load a squad that does not exist or before any squad is loaded."
    expected: "CaptaincyPanel is not rendered (the panel only appears when captaincyCandidates.length > 0)."
    why_human: "Conditional render guard requires runtime state to verify."
  - test: "Verify no visual regressions in the rest of the Transfers tab (transfer suggestions, chip warnings, save recommendation)."
    expected: "All existing Transfer tab UI still renders correctly with no layout shifts."
    why_human: "Full-page visual regression requires browser inspection."
---

# Phase 10: Buy/Hold/Sell + Captaincy Engines Verification Report

**Phase Goal:** Managers receive a Buy/Hold/Sell verdict for each squad player and a ranked captaincy shortlist derived from the same data signals as the existing transfer engine
**Verified:** 2026-03-30T15:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

All automated truths verified. Visual/runtime truths routed to human verification.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | computeVerdicts returns Buy for squad players with gem_score above position average | VERIFIED | Tests pass: "returns Buy for a squad MID with gem_score 0.80 when position average is 0.50"; function logic confirmed in src/lib/recommend.ts line 112 |
| 2 | computeVerdicts returns Sell for squad players with gem_score meaningfully below position average | VERIFIED | Tests pass: "returns Sell for a squad MID with gem_score 0.30"; SELL_THRESHOLD=0.90 enforced at line 114 |
| 3 | computeVerdicts returns Hold for squad players near position average | VERIFIED | Tests pass: "returns Hold for a squad MID with gem_score 0.48"; else-branch at line 116 |
| 4 | Only starting-XI picks (position 1-11) receive verdicts — bench players excluded | VERIFIED | `if (pick.position >= 12) continue` at line 103; bench exclusion test passes |
| 5 | No contradictory verdicts: a Sell player has lower gem_score than a Buy player at same position | VERIFIED | Contradiction test passes; algorithm is deterministic from gem_score comparison |
| 6 | Players with null xG/xA still receive valid verdicts | VERIFIED | Null xG/xA test passes; algorithm uses gem_score only, never touches xg_per90/xa_per90 |
| 7 | computeCaptaincyCandidates returns top-5 candidates sorted by projected_captain_pts descending | VERIFIED | Tests pass: "returns top-5 candidates sorted by projected_captain_pts descending"; sort at line 94 of captaincy-engine.ts |
| 8 | projected_captain_pts equals proj_pts_1gw * 2 for each candidate | VERIFIED | Tests pass: "projected_captain_pts equals proj_pts_1gw * 2"; line 79 of captaincy-engine.ts |
| 9 | Only starting-XI picks (position 1-11) are considered as candidates | VERIFIED | `if (pick.position >= 12) continue` at line 67 of captaincy-engine.ts; test passes |
| 10 | Injured players are excluded | VERIFIED | `if (player.mins_risk === 'injured') continue` at line 77; test passes |
| 11 | captain_type is 'safe' when mins_risk === 'nailed' AND gem_score >= position average | VERIFIED | isSafe logic at lines 83-84 of captaincy-engine.ts; test passes |
| 12 | captain_type is 'upside' for all other cases | VERIFIED | Tests pass for rotation_risk, likely_start, and nailed-below-avg cases |
| 13 | User can see a Buy, Hold, or Sell badge on each starting-XI player in SquadView | VERIFIED (code) / NEEDS HUMAN (visual) | VerdictBadge rendered at SquadView.tsx lines 150-152; bench guard `!isBench` confirmed |
| 14 | User can see a ranked captaincy panel below SquadView with top-5 candidates | VERIFIED (code) / NEEDS HUMAN (visual) | CaptaincyPanel rendered at TransferPanel.tsx lines 141-143; guard `captaincyCandidates.length > 0` confirmed |
| 15 | Each captaincy candidate shows projected captain points formatted as 'X.X pts (C)' | VERIFIED (code) | CaptaincyPanel.tsx line 59: `{c.projected_captain_pts.toFixed(1)} pts (C)` |
| 16 | Each captaincy candidate shows a Safe or Upside type badge | VERIFIED (code) | CaptainTypeBadge rendered at line 61; TYPE_MAP with blue/amber config at lines 13-26 |
| 17 | Each captaincy candidate shows a MinsRisk badge | VERIFIED (code) | MinsRiskBadge rendered at line 62 of CaptaincyPanel.tsx |

**Score:** 17/17 truths verified (4 require human visual confirmation)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/recommend.ts` | computeVerdicts pure function | VERIFIED | 125 lines; exports Verdict type, BUY_THRESHOLD, SELL_THRESHOLD, computePositionAverages, computeVerdicts |
| `tests/lib/recommend.test.ts` | Unit tests for computeVerdicts | VERIFIED | 8 tests, all pass; uses makeScoredPlayer/makeSquadPick factory pattern |
| `src/lib/captaincy-engine.ts` | computeCaptaincyCandidates pure function | VERIFIED | 98 lines; exports CaptaincyCandidate interface and computeCaptaincyCandidates |
| `tests/lib/captaincy-engine.test.ts` | Unit tests for captaincy engine | VERIFIED | 14 tests (13 planned + 1 unplanned GK exclusion), all pass |
| `src/components/shared/VerdictBadge.tsx` | Buy/Hold/Sell verdict badge component | VERIFIED | 45 lines; exports VerdictBadge; VERDICT_MAP with green/zinc/red config |
| `src/components/captaincy/CaptaincyPanel.tsx` | Captaincy ranking panel | VERIFIED | 69 lines; exports CaptaincyPanel; inline CaptainTypeBadge with blue/amber config |
| `src/components/squad/SquadView.tsx` | Modified SquadView with Rec column | VERIFIED | verdicts prop at line 13; VerdictBadge import at line 6; Rec column header at line 103 |
| `src/components/transfers/TransferPanel.tsx` | Wired TransferPanel with verdicts and captaincy | VERIFIED | computeVerdicts at line 8; computeCaptaincyCandidates at line 9; CaptaincyPanel at line 12 |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/recommend.ts` | `src/lib/types.ts` | ScoredPlayer import | WIRED | Line 1: `import type { ScoredPlayer } from '@/lib/types'` |
| `src/lib/recommend.ts` | `src/lib/squad-adapter.ts` | SquadPick import | WIRED | Line 2: `import type { SquadPick } from '@/lib/squad-adapter'` |
| `src/lib/captaincy-engine.ts` | `src/lib/types.ts` | ScoredPlayer import | WIRED | Line 1: `import type { ScoredPlayer } from '@/lib/types'` |
| `src/lib/captaincy-engine.ts` | `src/lib/squad-adapter.ts` | SquadPick import | WIRED | Line 2: `import type { SquadPick } from '@/lib/squad-adapter'` |
| `src/components/transfers/TransferPanel.tsx` | `src/lib/recommend.ts` | computeVerdicts import | WIRED | Line 8; used in useMemo at lines 38-41; passed to SquadView at line 136 |
| `src/components/transfers/TransferPanel.tsx` | `src/lib/captaincy-engine.ts` | computeCaptaincyCandidates import | WIRED | Line 9; used in useMemo at lines 43-46; passed to CaptaincyPanel at line 142 |
| `src/components/transfers/TransferPanel.tsx` | `src/components/captaincy/CaptaincyPanel.tsx` | CaptaincyPanel import | WIRED | Line 12; rendered at lines 141-143 |
| `src/components/squad/SquadView.tsx` | `src/components/shared/VerdictBadge.tsx` | VerdictBadge import | WIRED | Line 6; rendered at lines 150-152 |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| SquadView.tsx (Rec column) | `verdicts` (Map<number, Verdict>) | `computeVerdicts(squadData.picks, scoredPlayers)` in TransferPanel useMemo | Yes — real engine computation from live scoredPlayers and squadData | FLOWING |
| CaptaincyPanel.tsx | `candidates` (CaptaincyCandidate[]) | `computeCaptaincyCandidates(squadData.picks, scoredPlayers)` in TransferPanel useMemo | Yes — real engine computation; filtered and sorted from live data | FLOWING |
| computeVerdicts | `allPlayers` (ScoredPlayer[]) | `computeAllGemScores(playersData ?? [])` — scoredPlayers useMemo in TransferPanel | Yes — scoredPlayers flows from usePlayers() API hook which fetches /api/players | FLOWING |
| computeCaptaincyCandidates | `squadPicks` (SquadPick[]) | `squadData.picks` from useSquad() hook | Yes — squadData fetched from /api/squad/[teamId] with real FPL API data | FLOWING |

No static/empty returns or hollow props detected. Guards (`!squadData || scoredPlayers.length === 0 return new Map()`) are correct empty-state guards, not stubs — they produce empty output only when data is genuinely absent.

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| recommend.test.ts — all 8 tests pass | `npx vitest run tests/lib/recommend.test.ts` | 2 test files, 22 tests passed | PASS |
| captaincy-engine.test.ts — all 14 tests pass | `npx vitest run tests/lib/captaincy-engine.test.ts` | 2 test files, 22 tests passed | PASS |
| Full Vitest suite remains green | `npx vitest run` | 13 test files, 126 passed, 8 skipped | PASS |
| TypeScript compiles with no errors | `npx tsc --noEmit` | Exit 0, no output | PASS |

---

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| REC-01 | 10-01, 10-03 | User can see Buy / Hold / Sell label for each player in their squad | SATISFIED | computeVerdicts produces correct verdicts (8 tests); VerdictBadge renders in SquadView Rec column; visual confirmation pending human |
| CAP-01 | 10-02, 10-03 | User can see top-5 captaincy candidates for next GW with projected captain points | SATISFIED | computeCaptaincyCandidates returns top-5 sorted by projected_captain_pts (14 tests); CaptaincyPanel renders candidates with "{X.X} pts (C)" formatting; visual confirmation pending human |
| CAP-02 | 10-02, 10-03 | User can distinguish safe captain (nailed, high-floor) from upside captain (differential, high-ceiling) | SATISFIED | captain_type classification logic correct (5 tests covering safe/upside cases); CaptainTypeBadge with distinct blue (Safe) / amber (Upside) styling; visual confirmation pending human |

No orphaned requirements: REQUIREMENTS.md maps REC-01, CAP-01, and CAP-02 to Phase 10. All three are claimed and implemented across Plans 01, 02, and 03.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | — |

No TODO/FIXME/placeholder comments found. No empty return stubs. No hardcoded empty data arrays that flow to rendering. The `return new Map()` and `return []` guards in TransferPanel are correct short-circuits when data is not yet loaded — they are not stubs.

**Notable finding:** `captaincy-engine.ts` implements a goalkeeper exclusion rule (`element_type === 1`) that is not specified in the 10-02-PLAN.md algorithm. This is a beneficial enhancement (captaining a GK is never optimal) that is tested (14th test case in captaincy-engine.test.ts). It does not contradict any requirement and adds correctness. Classified as info-level deviation.

---

## Human Verification Required

### 1. Verdict Badges in SquadView

**Test:** Run `npm run dev`, navigate to Transfers tab, enter a valid FPL Team ID, click "Load Squad". Inspect the squad table.
**Expected:** A "Rec" column appears after the "Risk" column. Starting-XI players show Buy (green bg-green-100), Hold (grey bg-zinc-100), or Sell (red bg-red-100) badges. Bench players (shown at reduced opacity) have no badge in the Rec cell. Hovering a badge shows its tooltip.
**Why human:** Badge color rendering, column layout, and tooltip hover behavior require browser inspection.

### 2. CaptaincyPanel Displays Below SquadView

**Test:** With squad loaded, scroll below the squad table.
**Expected:** A panel headed "Captaincy Picks — GW {N}" appears with up to 5 ranked rows. Each row shows rank number, player name, team abbreviation, projected captain pts (e.g. "14.2 pts (C)"), a Safe (blue) or Upside (amber) badge, and a MinsRisk badge.
**Why human:** Visual rendering of the ranked panel, badge colors, and number formatting require browser inspection.

### 3. CaptaincyPanel Not Rendered Without Squad

**Test:** Open the Transfers tab without loading a squad (or load an invalid ID).
**Expected:** No CaptaincyPanel is rendered below the squad area.
**Why human:** Conditional render guard (`captaincyCandidates.length > 0`) requires runtime state to confirm.

### 4. No Visual Regressions

**Test:** With squad loaded, verify the full Transfers tab: transfer suggestions, chip warnings, save recommendation, budget summary.
**Expected:** All existing Transfers tab UI elements remain visually correct with no layout shifts, overlaps, or missing content.
**Why human:** Full-page visual regression cannot be verified by static code analysis.

---

## Gaps Summary

No gaps found. All automated checks pass. All 17 must-have truths are verified at the code level. The 4 human verification items are required before final approval but do not indicate defects — they are normal visual/runtime checks for a UI phase.

---

_Verified: 2026-03-30T15:45:00Z_
_Verifier: Claude (gsd-verifier)_
