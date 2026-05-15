---
phase: 111-fixture-heatmap-planner-cross-position-fixes-v1-20
verified: 2026-05-15T12:00:00Z
status: gaps_found
score: 2/3 must-haves verified
overrides_applied: 0
gaps:
  - truth: "User can view the fixture heat map mid-week when their team has already played the current gameweek and see the current GW cell render that team's completed fixture (or a 'played' state), NOT a false BGW indicator"
    status: partial
    reason: "The BGW-only case (fixtures=0, playedFixtures>=1) is fully handled. However, the partially-played DGW case (fixtures>=1 AND playedFixtures>=1) has no render branch — the code falls through to the final fixtures[0] single-upcoming branch at line 166, silently discarding the played-fixture signal entirely. This was identified as CR-01 in REVIEW.md and confirmed directly in FixtureHeatMap.tsx lines 86-177."
    artifacts:
      - path: "src/components/club-form/FixtureHeatMap.tsx"
        issue: "Missing branch for fixtures.length >= 1 && playedFixtures.length >= 1 (partially-played DGW). Code falls through to line 166 (upcoming single branch) and discards playedFixtures."
      - path: "src/components/club-form/FixtureHeatMap.test.tsx"
        issue: "No test case for the partially-played DGW render path (identified as WR-03 in REVIEW.md)."
    missing:
      - "Insert a render branch before the `fixtures.length >= 2` check that handles `fixtures.length >= 1 && playedFixtures.length >= 1` — show upcoming fixture at full opacity with a visual indicator (e.g. a checkmark or modified tooltip) that confirms a game has already been played in this GW."
      - "Add a test case for the partially-played DGW scenario (as specified in REVIEW.md WR-03)."
human_verification:
  - test: "Load heatmap tab mid-week with a team that is in a DGW and has played one of their two fixtures"
    expected: "The heatmap cell shows the upcoming fixture at full opacity AND some indication (e.g. a checkmark, a combined tooltip, or a split cell) that a game has already been played — the played signal must not be silently discarded."
    why_human: "Requires a live DGW mid-week state that cannot be simulated by unit tests without mocking both upcoming_fixtures and current_gw_played in the same GW for the same team. The partially-played DGW case is the CR-01 failure mode."
  - test: "Open Transfer Planner / OCS table and inspect every Sell-Buy row"
    expected: "Every buy candidate in a row has the same position (element_type) as the sell player — no MID suggested for a GK sell, no FWD for a DEF sell, etc."
    why_human: "Engine contract is proven by regression tests, but the user-facing rendering of OCS table rows requires visual inspection to confirm the UI correctly exposes the engine invariant across all four tabs (TransferPanel, OptimiserPanel, DecisionSummaryTab, RivalsTab)."
---

# Phase 111: Fixture Heatmap & Planner Cross-Position Fixes — Verification Report

**Phase Goal:** Fix the FixtureHeatMap BGW display bug (FIX-01) and the planner cross-position suggestion bug (FIX-02).
**Verified:** 2026-05-15T12:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Roadmap Success Criteria

The ROADMAP.md defines three success criteria for Phase 111:

1. User can view the fixture heat map mid-week when their team has already played the current gameweek and see the current GW cell render that team's completed fixture (or a "played" state), NOT a false BGW indicator
2. User can open the transfer planner, select a player to transfer out, and see only buy candidates of the same position (no MID candidates suggested for a GK sell, no FWD candidates for a DEF sell, etc.)
3. Position-lock is enforced everywhere `suggestTransfers` / planner candidate ranking surfaces a buy suggestion — Squad Transfers, Manual Plan, Route Tree, Decision Summary OCS sells, all honour the same rule

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User sees played cell (not false BGW) for a team that has played current GW | PARTIAL | The BGW-only case is implemented and tested. The partially-played DGW case (one game played, one still upcoming in the same GW) has no render branch — confirmed by direct inspection of FixtureHeatMap.tsx lines 86–177. CR-01 from REVIEW.md is unremediated. |
| 2 | Transfer planner only suggests buy candidates of the same position | VERIFIED | `suggestTransfers` engine uses `inPoolByPosition.get(sell.element_type)` at line 137 (position-matched pool). Three regression tests in suggest-transfers.test.ts (lines 562–648) lock the single/combo/guard invariants. |
| 3 | Position-lock is enforced at all 4 suggestTransfers call sites | VERIFIED | FIX-02 annotation confirmed at: TransferPanel.tsx:124, OptimiserPanel.tsx:273, DecisionSummaryTab.tsx:233, RivalsTab.tsx:84. Each carries the canonical comment plus the VALID_ELEMENT_TYPES guard in suggest-transfers.ts:42. |

**Score:** 2/3 truths verified

---

## Required Artifacts

### Plan 01 — FIX-01 Data Layer

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/types.ts` | `current_gw_played: ClubFormFixture[]` declared as required field | VERIFIED | Line 504: `current_gw_played: ClubFormFixture[]   // Phase 111 FIX-01 — finished fixtures from active GW only` |
| `src/lib/club-form.ts` | `RawEvent` interface + `RawBootstrap.events?` + `teamPlayedCurrentGw` builder | VERIFIED | Lines 41–50: `RawEvent { id, is_current, finished }` and `RawBootstrap.events?: RawEvent[]`. Lines 137–179: `currentGw` derivation and `teamPlayedCurrentGw` map. Line 227: `current_gw_played: teamPlayedCurrentGw.get(tId) ?? []` in result.push. |
| `src/lib/club-form.test.ts` | 6 node-env unit tests for `current_gw_played` | VERIFIED | File exists. Contains `// @vitest-environment node`, `describe('computeClubForm — current_gw_played (Phase 111 FIX-01)', ...)`, all 6 `it(...)` blocks. |
| `src/app/api/club-form/route.ts` | Route passes `events: bootstrap.events` to `computeClubForm` | VERIFIED | Line 36: `computeClubForm({ teams: bootstrap.teams, events: bootstrap.events }, fixtures)` |

### Plan 02 — FIX-01 Render Layer

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/club-form/FixtureHeatMap.tsx` | `byTeamGwPlayed` map + three-way branch + `allEventIds` union | PARTIAL | `byTeamGwPlayed` map exists (lines 238–247). `allEventIds` union includes `current_gw_played` event_ids (lines 221–226). Three-way branch covers BGW / DGW-fully-played / single-fully-played. **MISSING:** branch for `fixtures.length >= 1 && playedFixtures.length >= 1` (partially-played DGW). |
| `src/components/club-form/FixtureHeatMap.test.tsx` | Updated `team()` helper + 5 FIX-01 test cases | PARTIAL | `team()` helper has `playedFixtures: ClubFormFixture[] = []` (line 36). 5 FIX-01 test cases exist (lines 422–496). **MISSING:** test for partially-played DGW (fixtures.length >= 1 AND playedFixtures.length >= 1). |

### Plan 03 — FIX-02 Engine Guard + Audit

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/suggest-transfers.test.ts` | 3 FIX-02 regression tests | VERIFIED | Lines 561–648: `describe('Phase 111 FIX-02: Position lock invariants', ...)` with guard test, single-lock test, combo-lock test. Contains `FIX-02` token and `expect(sug.sell.element_type).toBe(sug.buy.element_type)`. |
| `src/lib/suggest-transfers.ts` | `VALID_ELEMENT_TYPES` guard + `sanePlayers` binding | VERIFIED | Line 42: `const VALID_ELEMENT_TYPES = new Set([1, 2, 3, 4])`. Lines 95–107: guard filters invalid players, emits `[FIX-02]` console.warn. `sanePlayers` feeds `playerById` (line 114) and `inPoolByPosition` (line 137). |
| `src/components/transfers/TransferPanel.tsx` | FIX-02 comment annotation | VERIFIED | Line 124: canonical FIX-02 comment present. |
| `src/components/optimiser/OptimiserPanel.tsx` | FIX-02 comment annotation | VERIFIED | Line 273: canonical FIX-02 comment present. |
| `src/components/squad/DecisionSummaryTab.tsx` | FIX-02 comment annotation | VERIFIED | Line 233: canonical FIX-02 comment present. |
| `src/components/rivals/RivalsTab.tsx` | FIX-02 comment annotation | VERIFIED | Line 84: canonical FIX-02 comment present. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/app/api/club-form/route.ts` | `computeClubForm` | `events: bootstrap.events` | WIRED | Line 36 confirmed. |
| `src/lib/club-form.ts` | `ClubForm.current_gw_played` | `current_gw_played: teamPlayedCurrentGw.get(tId) ?? []` | WIRED | Line 227 confirmed. |
| `FixtureHeatMap.tsx useMemo` | `ClubForm.current_gw_played` | `t.current_gw_played ?? []` in allEventIds and byTeamGwPlayed loop | WIRED | Lines 224, 241 confirmed. |
| `HeatMapRow` | `byTeamGwPlayed` | `grid.byTeamGwPlayed.get(t.team_id)?.get(gw) ?? []` | WIRED | Line 88 confirmed. |
| `suggest-transfers.ts` | position-lock contract | `inPoolByPosition.get(sell.element_type)` with `sanePlayers` | WIRED | Lines 114, 134–141 confirmed. |
| `suggest-transfers.ts` to call sites | FIX-02 annotation | comment above `return suggestTransfers(` in each useMemo | WIRED | All 4 call sites confirmed. |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `FixtureHeatMap.tsx` | `playedFixtures` (from `byTeamGwPlayed`) | `ClubForm.current_gw_played` → `useClubForm()` → `/api/club-form` → `computeClubForm` | Yes — populated from `finished.filter(f => f.event === currentGw)` with real fixture data from `bootstrap.events` | FLOWING for BGW-only case |
| `FixtureHeatMap.tsx` | played cell when `fixtures.length >= 1` | `playedFixtures` is looked up but the code branch that renders it is absent | No — data is computed but the render branch for the mixed state does not exist | DISCONNECTED for partially-played DGW |

---

## Behavioral Spot-Checks

| Behavior | Evidence | Status |
|----------|----------|--------|
| `src/lib/club-form.test.ts` — 6 tests pass | Commits 92f5a32 (RED) and 9cb4902 (GREEN) confirm TDD cycle. File contents verified. | PASS (code-level) |
| `src/components/club-form/FixtureHeatMap.test.tsx` — 5 FIX-01 tests pass | Commits 40bcbe0 (RED) and 89d491f (GREEN) confirm TDD cycle. All 5 test names match acceptance criteria. | PASS (code-level) |
| `src/lib/suggest-transfers.test.ts` — 3 FIX-02 tests pass | Commits 7527640 (characterization), 833d88c (RED guard), 7f66a5f (GREEN guard) confirm TDD order. | PASS (code-level) |
| Partially-played DGW render | `FixtureHeatMap.tsx` has no branch for `fixtures.length >= 1 && playedFixtures.length >= 1` | FAIL — played data is silently dropped |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FIX-01 | Plans 01 + 02 | Heatmap must not show BGW for a fixture that has been completed | PARTIAL | Data layer (Plan 01) fully implemented and tested. Render layer (Plan 02) handles BGW-only case correctly but lacks the partially-played DGW branch (CR-01 unremediated). |
| FIX-02 | Plan 03 | Transfer planner only suggests buy candidates of the same position | VERIFIED | Engine position-lock proven by 3 regression tests; defensive guard added; all 4 call sites annotated. |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/club-form/FixtureHeatMap.tsx` | 86–177 | Missing render branch for `fixtures.length >= 1 && playedFixtures.length >= 1` | BLOCKER | Played fixture data is silently discarded for partially-played DGW teams. User sees upcoming cell with no indication a game has been played. The "played" signal is entirely lost during mid-GW DGW periods. |
| `src/lib/club-form.ts` | 140 | `bootstrap.events?.filter(e => e.finished).slice(-1)[0]?.id` — no sort before slice | WARNING | If FPL API returns events out of order, fallback selects wrong GW. Primary path (`is_current`) is reliable; fallback is order-dependent on external source. Identified as CR-02 in REVIEW.md. |
| `src/lib/suggest-transfers.ts` | 105–107 | `sanePlayers` uses conditional re-filter instead of unconditional | WARNING | Semantic coupling between `invalidPlayers` predicate and `sanePlayers` filter. Identified as WR-01 in REVIEW.md. No correctness risk today. |

---

## Human Verification Required

### 1. Partially-Played DGW Heatmap Cell

**Test:** Set up local dev with a team in a DGW that has played one game but has another upcoming in the same GW (or simulate via mock data). Load the GW Heatmap tab.
**Expected:** The cell should show the upcoming fixture at full opacity AND some visual signal that a game has already been played in this GW. The played fixture data must NOT be silently discarded.
**Why human:** The code path where `fixtures.length >= 1 && playedFixtures.length >= 1` is a confirmed missing branch (CR-01). No unit test covers it. Requires either a live mid-DGW state or a mock that forces both arrays non-empty for the same GW. After CR-01 is fixed, this scenario needs a regression test too.

### 2. OCS Table Position Consistency

**Test:** Open each of the four surfaces — Squad Transfers tab (OCS table), Optimiser tab (transfer suggestions), Decision Summary tab (OCS sells), Rivals tab (transfer suggestions). For each, inspect Sell-Buy row pairs.
**Expected:** Every suggested buy candidate shares the same position (element_type) as the corresponding sell player. No MID appears as a buy when the sell is a GK, etc.
**Why human:** The engine invariant is proven by regression tests. The question is whether the UI surfaces (OCS table rendering, TransferPanel column layout, etc.) expose sell/buy pairs in a way that makes cross-position suggestions visually obvious if they were to occur. The FIX-02 annotation documents the contract; visual spot-check closes the loop.

---

## Gaps Summary

**One gap is blocking goal achievement for FIX-01.**

The phase successfully delivers the FIX-01 data layer (Plan 01) and the common FIX-01 render paths (Plan 02 handles: true BGW, single fully-played cell, DGW fully-played cell). FIX-02 is fully delivered (Plan 03).

The missing render branch (`fixtures.length >= 1 && playedFixtures.length >= 1`) means FIX-01 is incomplete: a user looking at the heatmap during a live DGW week — after one game has been played but before the second — will see no indication that a game has been played. The upcoming fixture renders at full opacity with no "played" signal on the other leg. This is a correctness failure identified by the code reviewer as CR-01, and no remediation has been committed.

The CR-02 fallback sort issue (WARNING) is a latent risk but does not block goal achievement for the common case where `is_current` is set correctly by the FPL API, which is the primary derivation path.

To close the gap:
1. Add a render branch in `FixtureHeatMap.tsx` before the `fixtures.length >= 2` check that handles `fixtures.length >= 1 && playedFixtures.length >= 1`.
2. Add a test case for that scenario in `FixtureHeatMap.test.tsx`.
3. Optionally add `.sort((a, b) => a.id - b.id)` before `.slice(-1)` in `club-form.ts` to harden the fallback (CR-02).

---

_Verified: 2026-05-15T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
