---
phase: 111-fixture-heatmap-planner-cross-position-fixes-v1-20
verified: 2026-05-15T14:00:00Z
status: human_needed
score: 3/3 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 2/3
  gaps_closed:
    - "User can view the fixture heat map mid-week when their team has already played the current gameweek and see the current GW cell render that team's completed fixture (or a 'played' state), NOT a false BGW indicator — partially-played DGW case (fixtures.length >= 1 && playedFixtures.length >= 1) now handled"
    - "CR-02 WARNING: fallback GW derivation in club-form.ts now sorts events by id ascending before .slice(-1) — hardened against misordered FPL bootstrap.events"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Open each of the four surfaces — Squad Transfers tab (OCS table), Optimiser tab (transfer suggestions), Decision Summary tab (OCS sells), Rivals tab (transfer suggestions). For each, inspect Sell-Buy row pairs."
    expected: "Every suggested buy candidate shares the same position (element_type) as the corresponding sell player. No MID appears as a buy when the sell is a GK, etc."
    why_human: "The engine invariant is proven by regression tests (FIX-02 position-lock tests in suggest-transfers.test.ts lines 561–648). The question is whether the UI surfaces expose sell/buy pairs in a way that makes cross-position suggestions visually obvious if they were to occur. The FIX-02 annotation documents the contract; visual spot-check closes the loop."
---

# Phase 111: Fixture Heatmap & Planner Cross-Position Fixes — Verification Report (Re-verification)

**Phase Goal:** Fix the FixtureHeatMap BGW display bug (FIX-01) and the planner cross-position suggestion bug (FIX-02).
**Verified:** 2026-05-15T14:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap-closure plan 04 (partially-played DGW cell + CR-02 sort hardening)

---

## Re-verification Focus

The previous VERIFICATION.md (2026-05-15T12:00:00Z, score 2/3, status gaps_found) identified one BLOCKER:

> "The partially-played DGW case (fixtures>=1 AND playedFixtures>=1) has no render branch — the code falls through to the final fixtures[0] single-upcoming branch at line 166, silently discarding the played-fixture signal entirely."

Plan 04 closed that gap via TDD. This re-verification confirms closure and runs regression checks on previously-passing items.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User sees played cell (not false BGW) for a team that has played current GW — including the partially-played DGW case | VERIFIED | `FixtureHeatMap.tsx` lines 168–172: `baseTooltip` + `playedSuffix` composition in the single-upcoming fall-through. Two new regression tests at `FixtureHeatMap.test.tsx` lines 501–530 assert exact tooltip strings for 1-played and 2-played variants. All four existing branches (BGW / DGW-all-played / single-played / DGW-upcoming) confirmed intact by grep. |
| 2 | Transfer planner only suggests buy candidates of the same position | VERIFIED | `suggestTransfers` engine uses `inPoolByPosition.get(sell.element_type)` at line 137. Three regression tests in `suggest-transfers.test.ts` lines 562–648 lock the single/combo/guard invariants. Unchanged from initial verification. |
| 3 | Position-lock is enforced at all 4 suggestTransfers call sites | VERIFIED | FIX-02 annotation confirmed at: TransferPanel.tsx:124, OptimiserPanel.tsx:273, DecisionSummaryTab.tsx:233, RivalsTab.tsx:84. VALID_ELEMENT_TYPES guard at suggest-transfers.ts:42. Unchanged from initial verification. |

**Score:** 3/3 truths verified

---

## Required Artifacts — Plan 04 Focus

### Artifacts Added / Modified by Plan 04

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/club-form/FixtureHeatMap.tsx` | `playedSuffix` logic in single-upcoming fall-through | VERIFIED | Lines 168–172: `const baseTooltip`, `const playedSuffix = playedFixtures.map(...)`, `const tooltip = playedSuffix.length > 0 ? \`${baseTooltip} / ${playedSuffix}\` : baseTooltip`. Handles `fixtures.length === 1 && playedFixtures.length >= 1` because this branch is reached only when `fixtures.length` is neither 0 nor >=2. |
| `src/components/club-form/FixtureHeatMap.test.tsx` | 2 new partially-played DGW test cases | VERIFIED | Lines 501–530: test names match plan spec exactly. Tooltip assertions use `.toBe(...)` for exact match. Test 1 asserts `'PSG (H) — 0.28 / MCI (H) — Played'`. Test 2 asserts `'LIV (A) — 0.71 / MCI (H) — Played / CHE (A) — Played'`. Banner comment at line 497–499 confirmed. |
| `src/lib/club-form.ts` | `.sort((a, b) => a.id - b.id)` before `.slice(-1)` | VERIFIED | Line 140: `bootstrap.events?.filter(e => e.finished).sort((a, b) => a.id - b.id).slice(-1)[0]?.id`. Unsorted version `.filter(e => e.finished).slice(-1)[0]?.id` is absent (grep confirmed no match). |
| `src/lib/club-form.test.ts` | CR-02 regression test with descending-order events array | VERIFIED | Lines 192–206: `'CR-02: fallback picks max finished event id regardless of array order'`. Events array is `[rawEvent(36, false, true), rawEvent(35, false, true)]` (descending). Asserts `current_gw_played[0].event_id === 36`. |

### Regression Check — Previously Passing Plan 02 Artifacts

| Artifact | Check | Status |
|----------|-------|--------|
| `FixtureHeatMap.tsx` — BGW branch | `fixtures.length === 0 && playedFixtures.length === 0` present at line 89 | VERIFIED — no regression |
| `FixtureHeatMap.tsx` — DGW all-played branch | `fixtures.length === 0 && playedFixtures.length >= 2` present at line 99 | VERIFIED — no regression |
| `FixtureHeatMap.tsx` — single-played branch | `fixtures.length === 0 && playedFixtures.length === 1` present at line 124 | VERIFIED — no regression |
| `FixtureHeatMap.tsx` — DGW upcoming branch | `fixtures.length >= 2` present at line 137 | VERIFIED — no regression |
| `src/lib/club-form.ts` — currentGw primary path | `bootstrap.events?.find(e => e.is_current)?.id` unchanged at line 139 | VERIFIED — no regression |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `HeatMapRow` single-upcoming fall-through | `byTeamGwPlayed` map | `playedFixtures` already in scope from line 88 | WIRED | `playedFixtures` is read from `grid.byTeamGwPlayed.get(t.team_id)?.get(gw) ?? []` at line 88 (unchanged from Plan 02). The new `playedSuffix` logic at lines 169–171 consumes it. No new wiring required — the existing scope connection is sufficient. |
| `HeatMapRow` mixed-state branch | Tooltip composition | `\`${baseTooltip} / ${playedSuffix}\`` | WIRED | Line 172 confirmed. Exact format matches test assertions at lines 509 and 527. |
| `club-form.ts` fallback path | Sorted events | `.filter().sort().slice(-1)` | WIRED | Line 140 confirmed. CR-02 regression test at line 194 uses descending-order events to prove sort is exercised. |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `FixtureHeatMap.tsx` single-upcoming fall-through | `playedFixtures` | `ClubForm.current_gw_played` → `useClubForm()` → `/api/club-form` → `computeClubForm` | Yes — populated from `finished.filter(f => f.event === currentGw)` with real fixture data | FLOWING — previously DISCONNECTED for partially-played DGW, now wired via `playedSuffix` |
| `FixtureHeatMap.tsx` | `playedSuffix` | `playedFixtures.map(pf => ...)` | Yes — loops over real ClubFormFixture data from current_gw_played | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Evidence | Status |
|----------|----------|--------|
| `FixtureHeatMap.test.tsx` — Test 1 (1 upcoming + 1 played) | Code at lines 501–513 asserts `title='PSG (H) — 0.28 / MCI (H) — Played'`, full-opacity class, label span `'PSG'`, not BGW class | PASS (code-level) |
| `FixtureHeatMap.test.tsx` — Test 2 (1 upcoming + 2 played) | Code at lines 516–530 asserts `title='LIV (A) — 0.71 / MCI (H) — Played / CHE (A) — Played'`, label span `'LIV'`, not dimmed | PASS (code-level) |
| `club-form.test.ts` — CR-02 test | Code at lines 192–206 uses descending-order events `[rawEvent(36,...), rawEvent(35,...)]`, asserts `event_id === 36`. Fails without the sort. | PASS (code-level) |
| TDD commit sequence | 5bdd3dd (test/RED) → 4a3d593 (feat/GREEN) → 314dd86 (fix/CR-02) — correct order confirmed by git log | PASS |
| No Co-Authored-By trailers | git show for all three Plan 04 commits returned no match | PASS |
| Test counts | 30 tests in FixtureHeatMap.test.tsx (28 pre-existing + 2 new); 7 tests in club-form.test.ts (6 pre-existing + 1 new) | PASS |

**Note on test count discrepancy:** The initial VERIFICATION.md stated "51 tests" in FixtureHeatMap.test.tsx. Direct inspection confirms 30 tests. The "51" figure in the initial report was an error in the initial verification. The plan 04 summary correctly states "28 pre-existing + 2 new = 30 total". This discrepancy has no bearing on goal achievement.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FIX-01 | Plans 01 + 02 + 04 | Heatmap must not show BGW for a fixture that has been completed | VERIFIED | Data layer (Plan 01) fully implemented. Render layer (Plan 02) handles BGW-only, single-played, DGW-all-played. Plan 04 adds the partially-played DGW branch — played signal is no longer silently discarded. All cases are now covered and regression-tested. |
| FIX-02 | Plan 03 | Transfer planner only suggests buy candidates of the same position | VERIFIED | Engine position-lock proven by 3 regression tests; defensive guard added; all 4 call sites annotated. Unchanged from initial verification. |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found in Plan 04 additions | — | — | — | The 4-line change to FixtureHeatMap.tsx and 1-line change to club-form.ts introduce no new TODO/placeholder/stub patterns. |

Previously flagged WARNING in initial verification:

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/suggest-transfers.ts` | 105–107 | `sanePlayers` uses conditional re-filter instead of unconditional | WARNING (carried forward) | Semantic coupling. No correctness risk. Not within scope of Plan 04. |

---

## Human Verification Required

### 1. OCS Table Position Consistency

**Test:** Open each of the four surfaces — Squad Transfers tab (OCS table), Optimiser tab (transfer suggestions), Decision Summary tab (OCS sells), Rivals tab (transfer suggestions). For each, inspect Sell-Buy row pairs.
**Expected:** Every suggested buy candidate shares the same position (element_type) as the corresponding sell player. No MID appears as a buy when the sell is a GK, etc.
**Why human:** The engine invariant is proven by regression tests (FIX-02 position-lock tests in `suggest-transfers.test.ts` lines 562–648 and the VALID_ELEMENT_TYPES guard). The question is whether the UI surfaces expose sell/buy pairs in a way that makes the contract visually legible. The FIX-02 comment annotations at all four call sites document the contract; visual spot-check closes the loop. Not introduced by Plan 04 — carried forward from initial verification.

---

## Gaps Summary

No gaps remain. The single BLOCKER from the initial verification is resolved:

- The `FixtureHeatMap.tsx` single-upcoming fall-through now appends played-leg suffixes via `playedSuffix` — played fixture data is never silently discarded.
- Two regression tests lock the exact tooltip format for the 1-played and 2-played variants.
- The CR-02 WARNING (fallback sort) is hardened with a regression test that fails without the sort.

The one remaining `human_needed` item (OCS table visual) was present in the initial verification and is unrelated to the BLOCKER that was closed. It requires a live session to inspect the four UI surfaces for FIX-02 contract visibility.

---

_Verified: 2026-05-15T14:00:00Z_
_Verifier: Claude (gsd-verifier) — re-verification after Plan 04_
