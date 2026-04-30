---
phase: 45-transfer-aware-mode
verified: 2026-04-30T22:43:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
gaps: []
human_verification:
  - test: "CR-01: Verify hit-variant suppression when ftCount=2"
    expected: "When the user has 2 FTs, no cost=4 single-transfer suggestions should appear. Currently the engine emits cost=4 variants unconditionally for every (sell,buy) pair regardless of ftCount."
    why_human: "The engine bug (45-REVIEW.md CR-01) is observable only at runtime — automated tests mock suggestTransfers at the UI layer and the unit tests do not assert absence of hit variants when ftCount=2. A developer must read the code or run the engine directly to confirm the bug is present."
  - test: "CR-02: Verify per-leg gain guard on 2-FT combos"
    expected: "Every transfer leg in a combo suggestion should individually improve xPts (gain1 > 0 AND gain2 > 0). Combos where one leg is a downgrade offset by a large gain on the other leg should not appear."
    why_human: "The missing per-leg guard (45-REVIEW.md CR-02) is a logic defect in suggest-transfers.ts. No existing test asserts the per-leg invariant — the unit tests only check that a combo with net positive gain is present, not that each leg is individually positive. A developer must add a targeted test or inspect the engine to confirm the defect."
---

# Phase 45: Transfer-Aware Mode Verification Report

**Phase Goal:** Deliver transfer-aware mode — users can see ranked transfer suggestions (TFR-01: FT toggle, TFR-02: suggestions with out/in/cost/xPts, TFR-03: break-even formula) in the Optimiser panel.
**Verified:** 2026-04-30T22:43:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can enable transfer-aware mode that factors in 1 or 2 available free transfers when optimising | VERIFIED | `FtToggle.tsx` renders "1 FT" / "2 FTs" pill; `useState<1|2>(1)` in OptimiserPanel; `ftCount` wired into `suggestTransfers` call. RTL test confirms `aria-pressed` and `ftCount=2` call on toggle click. |
| 2 | User can see a ranked list of transfer suggestions alongside the optimised lineup (Out / In / Cost / xPts gain per suggestion) | VERIFIED | Transfer Suggestions section in OptimiserPanel.tsx renders `sug.sell.web_name`, `sug.buy.web_name`, cost pill (FREE/-4pts), `+{xPtsGain.toFixed(1)} xPts`. Engine sorts by `xPtsGain` descending. RTL tests assert copy and data-testids. |
| 3 | Each suggestion that requires a -4pt hit shows how many gameweeks it takes to break even based on projected xPts gain | VERIFIED | `breakEvenGws` computed via `Math.max(1, Math.ceil(4 / xPtsGainPerGw))` in engine. OptimiserPanel renders `Breaks even in {N} GW/GWs` conditionally on `breakEvenGws !== null`. RTL tests cover singular/plural and null (FREE) cases. |

**Score:** 3/3 roadmap success criteria verified

### PLAN Must-Have Truths (merged)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | TransferSuggestion discriminated union exported from src/lib/types.ts | VERIFIED | Lines 202-222 of types.ts. Both `kind: 'single'` and `kind: 'combo'` variants present with exact field names from UI-SPEC §9. |
| 2 | suggestTransfers returns ranked TransferSuggestion[] with correct engine logic | VERIFIED | 13/13 unit tests GREEN (vitest run confirmed). Engine implements top-30 pool, own-squad exclusion, budget filter, break-even formula, combo enumeration. |
| 3 | All 13 unit tests (originally described as 11) are GREEN | VERIFIED | `npx vitest run src/lib/suggest-transfers.test.ts` — 13 passed. |
| 4 | Break-even formula matches Math.max(1, Math.ceil(4 / xPtsGainPerGw)) for hits; null for FREE | VERIFIED | `breakEven()` function in suggest-transfers.ts lines 75-79 matches spec exactly. |
| 5 | OptimiserPanel renders Transfer Suggestions section with FtToggle, row variants, empty state, break-even subline | VERIFIED | OptimiserPanel.tsx lines 424-518. All data-testids present: `transfer-suggestions-section`, `ft-toggle`, `ft-toggle-1`, `ft-toggle-2`, `suggestion-row`, `cost-pill-free`, `cost-pill-hit`, `break-even`, `suggestions-empty-state`. 9/9 Phase 45 RTL tests GREEN. |

**Score:** 5/5 plan truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/types.ts` | TransferSuggestion discriminated union | VERIFIED | Lines 202-222. Both `single` and `combo` variants. `cost: 0 \| 4`, `xPtsGain`, `xPtsGainPerGw`, `breakEvenGws: number \| null`. |
| `src/lib/suggest-transfers.ts` | Working transfer engine | VERIFIED | 210 lines. Not a stub — returns real results. All 13 unit tests pass. |
| `src/lib/suggest-transfers.test.ts` | 13 unit tests covering TFR-01/02/03 | VERIFIED | File exists, `// @vitest-environment node`, 13 tests across 6 describe blocks. |
| `src/components/optimiser/FtToggle.tsx` | 1 FT / 2 FTs pill toggle | VERIFIED | `'use client'`, `export function FtToggle`, both buttons with correct copy, data-testids, `min-h-[44px]`, `aria-pressed`. |
| `src/components/optimiser/OptimiserPanel.tsx` | OptimiserPanel extended with transfer section | VERIFIED | All 4 new imports present, `ftCount` state, both hooks, 2 memos, Transfer Suggestions JSX section. |
| `src/components/optimiser/OptimiserPanel.test.tsx` | 9 Phase 45 RTL tests | VERIFIED | `describe('Phase 45: Transfer-aware mode (transfer suggestions)')` block present with 9 `it()` cases. All pass. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `suggest-transfers.test.ts` | `suggest-transfers.ts` | `import { suggestTransfers } from './suggest-transfers'` | WIRED | Line 5 of test file. |
| `suggest-transfers.test.ts` | `types.ts` | `import type { MergedPlayer }` | WIRED | Line 6 of test file. |
| `suggest-transfers.ts` | `optimise-lineup.ts` | `import { HORIZON_FIELD } from './optimise-lineup'` | WIRED | Line 29. IN-01 housekeeping applied; no local re-declaration. |
| `OptimiserPanel.tsx` | `suggest-transfers.ts` | `import { suggestTransfers } from '@/lib/suggest-transfers'` | WIRED | Line 13. Used in `transferSuggestions` useMemo at line 264. |
| `OptimiserPanel.tsx` | `FtToggle.tsx` | `import { FtToggle } from './FtToggle'` | WIRED | Line 16. Rendered at line 432 with `value={ftCount} onChange={setFtCount}`. |
| `OptimiserPanel.tsx` | `useMyTeam.ts` | `useMyTeam(isAuthenticated && submittedId !== null)` | WIRED | Line 232. Result feeds `exactSellPrices` memo at line 257. |
| `OptimiserPanel.tsx` | `optimise-lineup.ts` | `import { optimiseLineup, HORIZON_FIELD }` | WIRED | Line 11. CR-01 pairSection bounds fix confirmed (`i < sortedOptimised.length ? sortedOptimised[i] : currentId` at line 57). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `OptimiserPanel.tsx` | `transferSuggestions` | `suggestTransfers({currentPicks, players, horizon, ftCount, bank, sellPrices})` | Yes — engine traverses real player pool, applies budget/pool/gain filters | FLOWING |
| `OptimiserPanel.tsx` | `exactSellPrices` | `useMyTeam` response → `myTeamData.picks.map(p => [p.element, p.selling_price])` | Yes (auth path) / empty Map (unauth path → now_cost fallback in engine) | FLOWING |
| `OptimiserPanel.tsx` | `ftCount` | `useState<1\|2>(1)` updated by FtToggle onClick | Real user interaction | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All unit tests pass | `npx vitest run src/lib/suggest-transfers.test.ts src/components/optimiser/OptimiserPanel.test.tsx` | 37 passed (0 failed) | PASS |
| Engine not a stub | `grep -c "return \[\]" src/lib/suggest-transfers.ts` | 1 (only early-return for empty inputs) | PASS |
| No 'use client' in engine | `grep "'use client'" src/lib/suggest-transfers.ts` | 0 matches | PASS |
| FtToggle has correct structure | File contains `data-testid="ft-toggle"`, `data-testid="ft-toggle-1"`, `data-testid="ft-toggle-2"`, `min-h-[44px]` | All present | PASS |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| TFR-01 | User can enable transfer-aware mode that factors in 1–2 available free transfers when optimising | SATISFIED | FtToggle (1 FT / 2 FTs pill), `ftCount` state in OptimiserPanel, `ftCount` parameter in `suggestTransfers`. Toggle interaction tested by RTL. |
| TFR-02 | Transfer suggestions shown alongside optimised lineup (Out / In / Cost / xPts gain per suggestion) | SATISFIED | Transfer Suggestions section in OptimiserPanel renders all four data points. Empty state, FREE, hit, and combo variants all implemented. |
| TFR-03 | Hit break-even indicator shown for each -4pt hit ("Breaks even in X GWs") | SATISFIED | `breakEvenGws` field computed in engine; rendered conditionally only on hit rows; singular/plural copy correct. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `suggest-transfers.ts` | 137-148 | HIT variant emitted unconditionally regardless of `ftCount` — when `ftCount=2`, every single transfer gets a fictional `cost: 4` entry alongside the free one | WARNING (CR-01 from 45-REVIEW.md) | User with 2 FTs sees spurious -4pts rows for transfers that are genuinely free. Does not prevent goal achievement structurally but produces incorrect output for 2-FT users. |
| `suggest-transfers.ts` | 171-178 | 2-FT combo loop only checks combined `xPtsGain > 0`, not per-leg gain — a combo where one leg is a downgrade can surface | WARNING (CR-02 from 45-REVIEW.md) | Users can be advised to sell a player who is better than the suggested replacement in that position, as long as the other leg compensates. |
| `suggest-transfers.ts` | 156 | Stale comment claims `cost: 4` when `ftCount=1` is a combo code path — but the entire combo block is guarded by `if (ftCount === 2)` making the path unreachable | INFO (WR-01) | Documentation confusion only; no runtime impact. |
| `OptimiserPanel.tsx` | 244-248 | BGW eligibility count always uses `xPts_1gw` field regardless of selected horizon | INFO (WR-02) | Eligibility banner copy misleading for 3GW/5GW horizons; does not affect transfer suggestions. |

### Human Verification Required

#### 1. CR-01: Hit variants shown to users with 2 free transfers

**Test:** Open Optimiser panel with 2 FTs selected. Inspect the transfer suggestions list (or call `suggestTransfers` directly in console with `ftCount: 2`).

**Expected:** Only FREE (cost=0) single-transfer suggestions should appear when `ftCount=2`. No `-4pts` pill should appear on any single-transfer row.

**Actual (code-confirmed bug):** `suggest-transfers.ts` lines 137-148 unconditionally push a `cost: 4` HIT variant for every valid (sell, buy) pair, regardless of `ftCount`. When `ftCount=2`, every single suggestion appears twice in the list — once as FREE and once as a `-4pts hit` — where the hit entry is factually wrong.

**Why human:** No automated test covers this path. All 13 unit tests pass because they only check that hit variants *exist* when `ftCount=1`, or that combos are FREE when `ftCount=2`. None assert that hit singles are *absent* when `ftCount=2`.

**Fix required in `src/lib/suggest-transfers.ts`:** Wrap the cost=4 single push (lines 139-148) in `if (ftCount === 1) { ... }`.

---

#### 2. CR-02: Per-leg gain validation on 2-FT combos

**Test:** Call `suggestTransfers` with `ftCount=2` and a player pool where a high-gain DEF candidate exists alongside a FWD candidate who is weaker than any squad FWD. Inspect results for combo suggestions where one leg sells a FWD for a weaker replacement.

**Expected:** No combo should include a leg where `horizonScore(buy, field) < horizonScore(sell, field)` — every individual leg must be an improvement.

**Actual (code-confirmed bug):** `suggest-transfers.ts` line 177 only checks `xPtsGain <= 0` (aggregate). The `gain1` and `gain2` guards are absent. A combo with `gain1 = -3, gain2 = +5` (net `+2`) will pass the filter.

**Why human:** The 2-FT combo unit test only asserts that a combo *exists* with `cost=0` and `transfers.length === 2`. It does not assert per-leg positivity. A developer must add a specific failing-leg test or read the engine output with a crafted input.

**Fix required in `src/lib/suggest-transfers.ts`:** Add `if (gain1 <= 0) continue` after line 172 and `if (gain2 <= 0) continue` after line 175.

---

### Overall Assessment

All five structural must-haves are VERIFIED. The three ROADMAP success criteria are met at the architectural level: the FT toggle exists and wires correctly (TFR-01), the suggestion section renders all four data fields with all three variants (TFR-02), and the break-even formula is implemented and rendered (TFR-03). The 37 automated tests all pass.

However, two code review findings (CR-01 and CR-02) represent **correctness bugs in the engine output** for the 2-FT code path specifically. These do not prevent the phase goal from being *structurally present*, but they produce incorrect data for users:

- CR-01: Users with 2 FTs see spurious `-4pts hit` suggestions that do not exist.
- CR-02: Users can be advised to sell a better player as part of a combo because per-leg gain is not validated.

The human checkpoint in Plan 03 was marked APPROVED (2026-04-30) for visual layout and toggle behaviour. The CR-01/CR-02 bugs were identified in the code review (45-REVIEW.md) after the human checkpoint. They require a developer decision: accept as deferred cleanup, or fix before closing phase 45.

---

_Verified: 2026-04-30T22:43:00Z_
_Verifier: Claude (gsd-verifier)_
