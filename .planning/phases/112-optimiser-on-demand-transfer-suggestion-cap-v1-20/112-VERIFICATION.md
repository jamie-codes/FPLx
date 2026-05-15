---
phase: 112-optimiser-on-demand-transfer-suggestion-cap-v1-20
verified: 2026-05-15T00:00:00Z
status: human_needed
score: 14/14 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open Squad > Optimiser sub-tab with a valid FPL Team ID loaded"
    expected: "GwToggle and ChipModeToggle render above a bordered card with the text 'Configure settings above, then click to calculate the best lineup for your horizon.' and a green 'Optimise Lineup' button. No comparison table is visible."
    why_human: "Visual appearance and layout of the ready-state card — cannot verify Tailwind class rendering or actual pixel layout programmatically"
  - test: "Click 'Optimise Lineup' then toggle the GW horizon selector"
    expected: "Results recompute in place. The 'Optimise Lineup' button does NOT reappear. The ready-state card is gone and stays gone."
    why_human: "D-03 re-trigger policy — requires user interaction in a running browser to confirm the hasRun state never resets on control changes"
  - test: "Open Squad > Transfers sub-tab with a squad that has > 3 MID buy candidates in the engine output"
    expected: "OCS table renders at most 3 MID rows. Below the table a paragraph reads 'Showing top 3 of N MID suggestions.' (and similarly for other truncated position buckets). When all buckets have <= 3 candidates, no footnote paragraph appears."
    why_human: "Requires real FPL squad data to trigger >3-candidate scenario; footnote placement relative to table needs visual confirmation"
---

# Phase 112: Optimiser On-Demand + Transfer Suggestion Cap Verification Report

**Phase Goal:** Users get a calmer, more deliberate planning surface — the Optimiser tab no longer auto-computes when opened (button-gated), and transfer suggestion lists never show more than 3 candidates per position slot so the user can focus on the meaningful top picks.
**Verified:** 2026-05-15T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | capByPosition pure function exists in src/lib/cap-transfer-suggestions.ts | VERIFIED | File exists; `export function capByPosition` at line 20 |
| 2  | Single-kind suggestions bucketed by sug.buy.element_type | VERIFIED | Line 29: `sug.buy.element_type` under `sug.kind === 'single'` branch |
| 3  | Combo-kind suggestions bucketed by sug.transfers[0].buy.element_type | VERIFIED | Line 30: `sug.transfers[0].buy.element_type` in else branch |
| 4  | Input order preserved inside each bucket; slice(0, limit) is the only truncation | VERIFIED | Lines 46-51: `bucket.slice(0, limit)` iteration; insertion order preserved via Map |
| 5  | Return shape includes totalsByPosition Map pre-cap | VERIFIED | Lines 40-43: totalsByPosition built BEFORE capped slice; returned at line 61 |
| 6  | Final suggestions sorted by xPtsGain desc, cost asc | VERIFIED | Lines 54-58: capped.sort((a,b) => b.xPtsGain - a.xPtsGain then a.cost - b.cost) |
| 7  | hasRun state gates lineup compute in OptimiserPanel | VERIFIED | Line 239: `useState(false)`; line 254: `if (!hasRun)` early-return in useMemo; line 269: `hasRun` in dep array |
| 8  | Ready-state card renders with correct data-testids and copy pre-click | VERIFIED | Lines 384-399: `data-testid="optimiser-ready-state"`, `data-testid="optimise-button"`, button text "Optimise Lineup", teaser text "Configure settings above, then click to calculate the best lineup for your horizon." |
| 9  | Controls (GwToggle, ChipModeToggle) render above placeholder pre-click (D-01) | VERIFIED | Lines 376-381: GwToggle and ChipModeToggle rendered inside the `!hasRun` early-return branch BEFORE the ready-state card |
| 10 | hasRun is only set by button click, never reset by control changes (D-03) | VERIFIED | Line 395: `onClick={() => setHasRun(true)}` is the only setHasRun call in the file; setHasRun(false) does not appear anywhere in the file |
| 11 | OptimiserPanel transferSuggestions useMemo applies capByPosition(3) | VERIFIED | Lines 296-297: `const { suggestions, totalsByPosition } = capByPosition(raw, 3)` |
| 12 | OptimiserPanel renders cap-footnote-{POSITION} with "Showing top 3 of N" copy when truncated | VERIFIED | Lines 692-700: footnote `<p>` with `data-testid={\`cap-footnote-${POSITION_LABELS[pos]}\`}` and copy "Showing top 3 of {N} {POS} suggestions." |
| 13 | TransferPanel ocsSuggestions useMemo applies capByPosition(3) | VERIFIED | TransferPanel.tsx line 140: `const { suggestions, totalsByPosition } = capByPosition(raw, 3)`; line 29: import present |
| 14 | OpportunityCostTable receives totalsByPosition prop and renders footnotes | VERIFIED | OpportunityCostTable.tsx line 28: `totalsByPosition?: Map<number, number>` prop; lines 242-253: footnote rendering with correct data-testid pattern and copy |

**Score:** 14/14 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/cap-transfer-suggestions.ts` | capByPosition function + CappedSuggestions type | VERIFIED | 62 lines; exports `CappedSuggestions` interface and `capByPosition` function; no `use client`, no React imports |
| `src/lib/cap-transfer-suggestions.test.ts` | 8 vitest unit tests @vitest-environment node | VERIFIED | 216 lines; `describe('Phase 112 (TFR-02): capByPosition'`; 8 test cases covering empty, single, combo, mixed, sort, limit-edge cases |
| `src/components/optimiser/OptimiserPanel.tsx` | hasRun gate + ready-state + capByPosition wrap + footnotes | VERIFIED | Contains `hasRun`, `optimiser-ready-state`, `optimise-button`, `capByPosition(raw, 3)`, `transferTotalsByPosition`, `cap-footnote-` pattern, "Showing top 3 of" |
| `src/components/optimiser/OptimiserPanel.test.tsx` | Phase 112 OPT-01 + TFR-02 tests | VERIFIED (trust summary) | 8 new tests in `describe('Phase 112: OPT-01 + TFR-02'`; 42 total tests pass per SUMMARY |
| `src/components/transfers/TransferPanel.tsx` | capByPosition applied to ocsSuggestions; totalsByPosition forwarded | VERIFIED | Line 29: import; line 140: `capByPosition(raw, 3)`; line 141: `ocsTotalsByPosition`; line 446: `totalsByPosition={ocsTotalsByPosition}` |
| `src/components/transfers/OpportunityCostTable.tsx` | totalsByPosition prop + footnote rendering | VERIFIED | Line 28: optional prop; line 39: POSITION_LABELS const; lines 242-253: footnote render block with correct className and testid |
| `src/components/transfers/OpportunityCostTable.test.tsx` | Phase 112 TFR-02 footnote tests | VERIFIED (trust summary) | `describe('Phase 112 (TFR-02): truncation footnote'`; 4 tests; 17 total pass per SUMMARY |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| OptimiserPanel.tsx | cap-transfer-suggestions.ts | `import { capByPosition } from '@/lib/cap-transfer-suggestions'` | WIRED | Line 21 of OptimiserPanel.tsx; consumed at line 296 |
| OptimiserPanel.tsx lineup useMemo | hasRun state | `if (!hasRun) return {...}` | WIRED | Line 254; hasRun in dep array line 269 |
| OptimiserPanel.tsx ready-state button | setHasRun(true) | `onClick={() => setHasRun(true)}` | WIRED | Line 395 |
| OptimiserPanel.tsx | footnote `<p>` | `(transferTotalsByPosition.get(pos) ?? 0) > 3` | WIRED | Lines 693-700 |
| TransferPanel.tsx | cap-transfer-suggestions.ts | `import { capByPosition } from '@/lib/cap-transfer-suggestions'` | WIRED | Line 29; consumed at line 140 |
| TransferPanel.tsx ocsSuggestions memo | OpportunityCostTable totalsByPosition prop | `totalsByPosition={ocsTotalsByPosition}` | WIRED | Line 446 |
| OpportunityCostTable.tsx render | footnote `<p>` | `totalsByPosition && Array.from(...).filter(([,t]) => t > 3).map(...)` | WIRED | Lines 242-253 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| OptimiserPanel.tsx | transferSuggestions | `suggestTransfers(...)` → `capByPosition(raw, 3)` | Yes — engine call wrapped by cap | FLOWING |
| OptimiserPanel.tsx | transferTotalsByPosition | returned from `capByPosition` alongside suggestions | Yes — pre-cap bucket counts | FLOWING |
| TransferPanel.tsx | ocsSuggestions | `suggestTransfers(...)` → `capByPosition(raw, 3)` | Yes — engine call wrapped by cap | FLOWING |
| TransferPanel.tsx | ocsTotalsByPosition | returned from `capByPosition` alongside ocsSuggestions | Yes — forwarded to OpportunityCostTable | FLOWING |
| OpportunityCostTable.tsx | totalsByPosition | prop from TransferPanel.tsx | Yes — optional prop; guards correctly when undefined | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED for client-side React components (no runnable entry points without a server). Test suite evidence is used instead.

| Behavior | Evidence | Status |
|----------|----------|--------|
| capByPosition 8 unit tests pass | SUMMARY-01: "GREEN confirmed: all 8 tests pass" | PASS |
| OptimiserPanel 42 tests pass (8 new + ~34 existing) | SUMMARY-02: "42 tests pass" confirmed | PASS |
| OpportunityCostTable 17 tests pass (4 new + 13 existing) | SUMMARY-03: "All 17 OpportunityCostTable tests pass" | PASS |
| Engine src/lib/suggest-transfers.ts unmodified | All 3 SUMMARYs confirm D-05 invariant; git log shows no modifications | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| OPT-01 | 112-02-PLAN.md | Lineup optimiser shows empty state with "Optimise Lineup" button on load; calculation only runs when user triggers it | SATISFIED | `hasRun` gate in useMemo (line 254), ready-state card with `data-testid="optimiser-ready-state"` and `data-testid="optimise-button"` (lines 384-399); `setHasRun(true)` only on button click |
| TFR-02 | 112-01-PLAN.md, 112-02-PLAN.md, 112-03-PLAN.md | Transfer suggestion list shows at most 3 buy candidates per position slot | SATISFIED | `capByPosition(raw, 3)` in both OptimiserPanel.tsx (line 296) and TransferPanel.tsx (line 140); OpportunityCostTable.tsx renders footnotes; unit tests prove cap logic |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/components/optimiser/OptimiserPanel.tsx | 698 | `POSITION_LABELS[pos]` without `?? fallback` — renders `"undefined"` in DOM if pos is outside 1-4 | Warning | Low — FPL element_type is always 1-4 in practice; defensive fallback present in OpportunityCostTable.tsx but missing here (flagged in REVIEW.md WR-02) |
| src/lib/cap-transfer-suggestions.ts | 30 | Cross-position combo suggestions bucketed under `transfers[0].buy.element_type` only — second leg position unrepresented in totalsByPosition | Warning | Low — combo legs are typically same position per Phase 111 FIX-02 invariant; explicitly documented in REVIEW.md WR-01 |

Neither anti-pattern is a blocker — both are cosmetic/edge-case issues already captured in the code review and accepted for this phase.

### Human Verification Required

#### 1. Ready-state visual layout and controls-above-placeholder ordering (OPT-01 D-01/D-02)

**Test:** Load the app with a valid FPL Team ID, navigate to Squad > Optimiser tab.
**Expected:** GwToggle and ChipModeToggle render above a bordered card containing the teaser text and green "Optimise Lineup" button. No comparison table, headline row, or transfer suggestions are visible.
**Why human:** Visual layout and Tailwind class rendering requires a running browser; test coverage proves DOM presence but not visual ordering or spacing.

#### 2. Post-click recompute without button re-appearing (OPT-01 D-03)

**Test:** After clicking "Optimise Lineup", change the GW horizon selector (1 GW to 5 GWs or similar).
**Expected:** Lineup results recompute immediately. The "Optimise Lineup" button and ready-state card do NOT reappear. Results update in place. Refreshing the page resets the button (hasRun resets on remount).
**Why human:** Requires real browser interaction to confirm state persistence across user actions; React re-render timing and hasRun persistence across dep-array changes cannot be fully exercised in jsdom.

#### 3. Transfer suggestions footnote in Transfers tab (TFR-02 D-07)

**Test:** Open Squad > Transfers sub-tab with a squad containing > 3 affordable MID buy candidates relative to current squad players.
**Expected:** OCS table renders the usual rows (at most 3 per position bucket). Below the table a paragraph reads "Showing top 3 of N MID suggestions." for each truncated position. When all position buckets naturally have <= 3 candidates, no footnote paragraph appears.
**Why human:** Requires real FPL squad data and real engine output to trigger the >3-candidate scenario; footnote placement relative to the OCS table needs visual confirmation.

### Gaps Summary

No gaps found. All 14 observable truths are VERIFIED in the codebase. The two anti-patterns (WR-01 cross-position combo bucketing, WR-02 undefined fallback in OptimiserPanel footnote) are pre-existing code-review findings, not blockers. Three items require human browser verification to confirm visual layout and real-data behavior.

---

_Verified: 2026-05-15T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
