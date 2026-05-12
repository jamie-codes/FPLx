---
phase: 101-gw-targeted-transfers-ux-polish
verified: 2026-05-12T18:53:30Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open TransferPanel with a loaded squad and click the Target GW dropdown"
    expected: "Dropdown lists all remaining season GW numbers (e.g. GW33 through GW38), sorted ascending, as 'GW{N}' options; placeholder reads exactly 'Target GW'"
    why_human: "Dynamic data-driven list — requires live fixture data from /api/players to populate availableGws memo; cannot be verified without a running app"
  - test: "Select GW36 in the Target GW dropdown"
    expected: "The 1/3/5 GW pills become visually greyed (opacity-50, pointer-events-none); the column header in OpportunityCostTable changes to 'xPts Gain (GW36)'; a sub-label 'Ranked by GW36 xPts' appears below the OCS section heading; transfer candidates re-rank by GW36 fixture xPts"
    why_human: "Visual state (CSS opacity, greyed buttons) and dynamic re-ranking require browser rendering to confirm"
  - test: "Reset the Target GW dropdown back to the 'Target GW' placeholder"
    expected: "The 1/3/5 GW pills re-enable (opacity restored, pointer-events restored); column header reverts to 'xPts Gain (Next {horizon} GW/GWs)'; sub-label disappears; ranking returns to horizon mode"
    why_human: "State reset flow requires browser interaction to verify the toggle back"
---

# Phase 101: GW-Targeted Transfers & UX Polish Verification Report

**Phase Goal:** Users can select a specific future GW in TransferPanel and see buy candidates re-ranked by that GW's xPts only — not the current horizon average — enabling targeted end-of-season planning; and the GwToggle labels are renamed for clarity throughout the app
**Verified:** 2026-05-12T18:53:30Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can select a target GW in TransferPanel and see transfer candidates re-ranked by projected xPts for that specific GW's fixtures only | VERIFIED | `computeGwXpts` routes through fixture filter by `event_id === targetGw`; `suggestTransfers` `scorePlayer` dispatch confirmed; all 8 engine unit tests pass |
| 2 | When a target GW is selected, the panel labels which GW is being scored (e.g. "Ranked by GW36 xPts") | VERIFIED | `TransferPanel.tsx` line 421-424: `{targetGw !== null && <p>Ranked by GW{targetGw} xPts</p>}` — conditional render verified in code |
| 3 | GwToggle labels read "Next 1 GW", "Next 3 GWs", "Next 5 GWs" across the app in both GwToggle.tsx and all column headers that reference the horizon | VERIFIED | `GwToggle.tsx` line 115: `Next {gw} GW{gw === 1 ? '' : 's'}`; `OpportunityCostTable.tsx` lines 135-137: horizon mode uses `` `xPts Gain (Next ${horizon} GW${horizon === 1 ? '' : 's'})` ``; 68 targeted tests pass including OptimiserPanel, GwToggle, FixtureEaseRankingPanel, page tests |
| 4 | UX-01 label rename does not affect any data logic — pure display string change verified by Vitest text-content assertions | VERIFIED | `npx tsc --noEmit` exits 0; no logic-bearing code changed in GwToggle.tsx; GwToggle.test.ts untouched (tests column visibility, not label text); `npx vitest run` shows 0 new failures from UX-01 |

**Score:** 4/4 truths verified

### Deferred Items

None identified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/gw-xpts.ts` | `computeGwXpts` pure helper — TS port of Python `_xpts_per_gw` | VERIFIED | File exists, 64 lines, exports `computeGwXpts`; contains `start_prob * 2` (correct appearance_pts), `0.40 - defensiveDifficulty * 0.30` (correct CS direction), all 4 constants (GOAL_PTS/ASSIST_PTS/CS_PTS/BONUS_RATE); no `'use client'`, no `bonus_ev` |
| `src/lib/gw-xpts.test.ts` | Unit tests — BGW=0, DGW=sum, single, guards, GK vs MID | VERIFIED | 8 tests in `describe('computeGwXpts')`; all 8 pass via `npx vitest run src/lib/gw-xpts` |
| `src/lib/suggest-transfers.ts` | `suggestTransfers` with optional `targetGw?: number` + scorePlayer dispatch | VERIFIED | Contains `targetGw?: number` (line 49), `import { computeGwXpts } from './gw-xpts'` (line 30), `const scorePlayer = (p: MergedPlayer): number =>` (line 92), `const denominator = targetGw !== undefined ? 1 : horizon` (line 94); 7 `scorePlayer(` occurrences; 2 code-site `xPtsGain / denominator` uses (+ 1 comment); 0 `xPtsGain / horizon` uses; only 2 `horizonScore` occurrences (definition + single scorePlayer call) |
| `src/lib/suggest-transfers.test.ts` | New `describe('Phase 101 GWT-01: targetGw parameter'` block with 3 tests | VERIFIED | Block exists at line 495; 3 tests: routes scoring via computeGwXpts, denominator=1, no regression; 23 total tests pass |
| `src/components/transfers/OpportunityCostTable.tsx` | `targetGw?: number` prop + conditional column header | VERIFIED | Contains `targetGw?: number` (line 18), GWT branch `` `xPts Gain (GW${targetGw})` `` (line 136), horizon branch `` `xPts Gain (Next ${horizon} GW${horizon === 1 ? '' : 's'})` `` (line 137); no old `xPts Gain ({horizon} GW` format remains |
| `src/components/transfers/OpportunityCostTable.test.tsx` | 6 column header tests covering horizon 1/3/5, GWT 33/36, undefined fallback | VERIFIED | `describe('OpportunityCostTable column header'` present; 6 tests all pass via `npx vitest run src/components/transfers/OpportunityCostTable` |
| `src/components/transfers/TransferPanel.tsx` | `targetGw` state + dropdown + availableGws memo + GwToggle disabled + sub-label + prop threading | VERIFIED | All 12 acceptance-criterion strings confirmed present (see Key Link Verification below) |
| `src/components/gem-table/GwToggle.tsx` | Renamed button labels per D-12 | VERIFIED | Line 115: `Next {gw} GW{gw === 1 ? '' : 's'}`; no bare `{gw} GW` rendering remaining |
| `src/components/optimiser/OptimiserPanel.test.tsx` | Updated assertion `'Next 5 GWs'` | VERIFIED | Line 209: `=== 'Next 5 GWs'`; old `=== '5 GW'` is fully removed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `suggest-transfers.ts` | `gw-xpts.ts` | `import { computeGwXpts } from './gw-xpts'` | WIRED | Line 30 confirmed |
| `suggest-transfers.ts` scorePlayer fn | all 4 scoring sites (sort + 1-FT + 2-FT) | `scorePlayer(x)` replaces `horizonScore(x, field)` at every callsite | WIRED | 7 `scorePlayer(` occurrences confirmed; 0 residual `horizonScore` in sort/loop code |
| TransferPanel `<select>` onChange | `setTargetGw` state setter | `e.target.value ? Number(e.target.value) : null` | WIRED | Line 405 confirmed |
| TransferPanel `ocsSuggestions` useMemo | `suggestTransfers({ targetGw: targetGw ?? undefined })` | `targetGw` in dep array | WIRED | Lines 127, 129 confirmed — `targetGw` in both the call and dep array |
| TransferPanel `<GwToggle>` | disabled visual state | `disabled={!!targetGw}` prop | WIRED | Line 400 confirmed |
| TransferPanel `<OpportunityCostTable>` | column header switch | `targetGw={targetGw ?? undefined}` prop | WIRED | Line 426 confirmed |
| `GwToggle.tsx` line 115 | rendered button text | `Next {gw} GW{gw === 1 ? '' : 's'}` JSX inline template | WIRED | Confirmed; GwToggle, OptimiserPanel, FixtureEaseRankingPanel tests all pass |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `TransferPanel.tsx` availableGws | `scoredPlayers[*].fixtures[*].event_id` | `useMemo(() => new Set<number>(...scoredPlayers.fixtures), [scoredPlayers])` | Yes — derives from live player fixture data already loaded by `usePlayers()` | FLOWING |
| `OpportunityCostTable.tsx` column header | `targetGw` prop | Passed from TransferPanel state, which comes from `<select>` user interaction | Yes — conditional ternary renders correct string based on prop | FLOWING |
| `computeGwXpts` | `player.fixtures.filter(f => f.event_id === targetGw)` | `MergedPlayer.fixtures[]` from `/api/players` pipeline | Yes — filters real fixture data; DGW sums, BGW returns 0 | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `computeGwXpts` BGW=0, DGW=sum, guard conditions | `npx vitest run src/lib/gw-xpts` | 8/8 passed | PASS |
| `suggestTransfers` targetGw re-ranks pool, denominator=1, no regression | `npx vitest run src/lib/suggest-transfers` | 23/23 passed (including 3 new GWT-01 tests) | PASS |
| OpportunityCostTable column header — horizon mode (Next N GW/GWs) and GWT mode (GW{N}) | `npx vitest run src/components/transfers/OpportunityCostTable` | 6/6 passed | PASS |
| GwToggle labels "Next 1 GW"/"Next 3 GWs"/"Next 5 GWs" across GwToggle, OptimiserPanel, page tests | `npx vitest run src/components/gem-table/GwToggle src/components/optimiser/OptimiserPanel src/app/page` | 68/68 passed | PASS |
| FixtureEaseRankingPanel test assertions updated for new GwToggle labels | `npx vitest run tests/components/club-form/FixtureEaseRankingPanel` | 18/18 passed | PASS |
| TypeScript type safety across all modified files | `npx tsc --noEmit` | 0 errors | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| GWT-01 | 101-01, 101-02 | User can select a target GW in TransferPanel and see transfer recommendations re-ranked by xPts for that specific GW's fixtures only | SATISFIED | Engine (computeGwXpts + scorePlayer wiring) verified in code and tests; UI state + dropdown + prop chain all confirmed present; 3 GWT-01 engine tests pass |
| UX-01 | 101-03, 101-02 | Horizon toggle labels renamed "Next 1 GW / Next 3 GWs / Next 5 GWs" in GwToggle.tsx and all column headers | SATISFIED | GwToggle.tsx line 115 confirmed; OpportunityCostTable.tsx horizon-mode branch uses "Next" prefix; OptimiserPanel.test.tsx and FixtureEaseRankingPanel.test.tsx updated; 68 affected tests pass |

**Orphaned requirements check:** REQUIREMENTS.md traceability table shows GWT-01 and UX-01 both mapped to Phase 101. The status columns show "pending" — this is a REQUIREMENTS.md documentation staleness issue (the table was not updated post-completion), but both requirements are demonstrably implemented in code and tested. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `TransferPanel.tsx` | 223, 268 | `placeholder=` attribute | Info | HTML input placeholder attributes for text fields (team ID input, bank input) — not code stubs; no impact on phase goals |

No blockers or warnings found. The `placeholder` hits are legitimate HTML attributes.

### Human Verification Required

#### 1. Target GW Dropdown Population

**Test:** Open the app with a squad loaded, navigate to TransferPanel's Transfer Opportunity Cost section, click the "Target GW" dropdown
**Expected:** Dropdown shows GW options populated from live fixture data (e.g. GW33 through GW38), sorted ascending as "GW{N}", with the first option being placeholder "Target GW"
**Why human:** `availableGws` is a `useMemo` derived from `scoredPlayers[*].fixtures[*].event_id` — requires live `/api/players` data; the list content is dynamic and cannot be verified without a running app

#### 2. Full GWT Mode Visual Activation

**Test:** With a squad loaded, select GW36 from the Target GW dropdown
**Expected:** (a) The 1/3/5 GW pills are visually greyed and unclickable (opacity-50, pointer-events-none applied via `disabled={!!targetGw}` on GwToggle wrapper); (b) The OpportunityCostTable column header reads "xPts Gain (GW36)" (not the horizon variant); (c) A sub-label "Ranked by GW36 xPts" appears below "Transfer Opportunity Cost" heading; (d) Transfer candidates visibly re-rank (DGW players for GW36 surface higher)
**Why human:** CSS visual state (opacity, pointer-events), dynamic ranking change, and sub-label visibility all require browser rendering; automated tests cover the conditional render logic but not the pixel-level appearance

#### 3. Horizon Mode Restore

**Test:** After selecting a target GW (e.g. GW36), reset the dropdown back to the "Target GW" placeholder option
**Expected:** Pills re-enable (opacity restored, clickable again); column header reverts to "xPts Gain (Next 1 GW)" (or whichever horizon is active); sub-label disappears; transfer ranking returns to horizon-average mode
**Why human:** State reset flow requires interaction in a browser session; the toggle-back behaviour is critical for usability but not fully testable via unit tests

### Gaps Summary

No gaps found. All 4 ROADMAP success criteria are VERIFIED through code inspection, grep pattern checks, and automated test results. The human verification items are visual/interactive behaviours that are fully implemented in code but cannot be confirmed programmatically.

**Pre-existing failures note:** The full Vitest suite has 25 pre-existing failures (captain-picks: 5, club-form: 1, MobileNav: 10, useRivals: 9) confirmed by the Phase 101 SUMMARY.md as present before this phase's changes began. Phase 101 introduced zero new failures.

---

_Verified: 2026-05-12T18:53:30Z_
_Verifier: Claude (gsd-verifier)_
