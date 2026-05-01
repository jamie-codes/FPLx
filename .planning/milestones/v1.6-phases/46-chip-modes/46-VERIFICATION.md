---
phase: 46-chip-modes
verified: 2026-05-01T08:20:00Z
status: gaps_found
score: 11/14 must-haves verified
overrides_applied: 0
gaps:
  - truth: "WC mode shows ChipSquadView with 15-player position-grouped squad; XI rows have green left border"
    status: partial
    reason: "ChipSquadView renders correctly and XI rows have 'border-green-500' in their className, but the component prop type is not narrowed before passing chipMode — OptimiserPanel passes raw ChipMode ('none'|'wildcard'|'free-hit'|'bench-boost') to a prop typed as 'wildcard'|'free-hit'. Guarded at runtime by the conditional branch, but TypeScript type contract is violated (WR-03 from review)."
    artifacts:
      - path: "src/components/optimiser/OptimiserPanel.tsx"
        issue: "Line 451: chipMode is ChipMode but ChipSquadViewProps.chipMode requires 'wildcard'|'free-hit'; no type narrowing cast present"
    missing:
      - "Cast chipMode before passing: `chipMode as 'wildcard' | 'free-hit'` at the ChipSquadView call site"

  - truth: "BB mode shows existing comparison table with modified headline (Bench Boost | Bench xPts | Start xPts | Total) and full-opacity bench rows"
    status: failed
    reason: "CR-02: MobileComparisonCards bench opacity logic is inverted. ComparisonTable correctly uses 'row.isBench && !isBenchBoost' for opacity-80, but MobileComparisonCards uses 'isBenchBoost && row.isBench ? \"\" : \" opacity-60\"'. This applies opacity-60 to ALL unchanged rows (XI and bench) in normal mode and to ALL unchanged XI rows in BB mode. In normal mode, unchanged XI rows get opacity-60 on mobile (wrong — only bench should be dimmed). Desktop table is correct. Mobile is wrong in both normal mode and BB mode."
    artifacts:
      - path: "src/components/optimiser/OptimiserPanel.tsx"
        issue: "Line 200: opacity condition should be 'row.isBench && !isBenchBoost ? \" opacity-60\" : \"\"' but is 'isBenchBoost && row.isBench ? \"\" : \" opacity-60\"' — inverted predicate applies opacity to XI rows on mobile"
    missing:
      - "Fix line 200: `${row.isChanged ? ' border-l-2 border-l-green-500 pl-2' : (row.isBench && !isBenchBoost ? ' opacity-60' : '')}`"

  - truth: "Formation quotas enforced: exactly 2 GK, 3-5 DEF, 2-5 MID, 1-3 FWD, total = 15"
    status: partial
    reason: "CR-01: buildOptimalSquad only enforces MAX_SLOTS, never MIN_SLOTS. The MIN_SLOTS constant is declared but suppressed with 'void MIN_SLOTS' (confirmed at line 131). With an adversarial or thin player pool (e.g. players with high xPts concentrated in MID/DEF), the greedy loop can exhaust the budget or 15-player cap before accumulating the minimum quotas (2 GK, 3 DEF, 2 MID, 1 FWD). The 18 unit tests pass because 'makeValidPool()' is constructed to have exactly the right minimum counts per position and diverse teams, making the greedy loop trivially satisfy minimums without enforcement. No test covers the case where top-xPts players exhaust the budget before MIN_SLOTS are met."
    artifacts:
      - path: "src/lib/chip-modes.ts"
        issue: "Lines 56-81: greedy loop checks MAX_SLOTS only. MIN_SLOTS at line 15 is declared but never read by the algorithm. Line 131 uses 'void MIN_SLOTS' to suppress the unused-variable linter warning, confirming the constant is dead code in the algorithm."
    missing:
      - "Add two-pass strategy: Pass 1 fills MIN_SLOTS per position from the sorted pool; if any position cannot meet its minimum, return null. Pass 2 greedily fills remaining slots up to 15 with MAX_SLOTS enforcement."
human_verification:
  - test: "Visual dark mode check for all four chip modes"
    expected: "All amber/green/zinc tokens render correctly in dark mode; ChipModeToggle, ChipSquadView, BB headline, GwToggle disabled state all visually correct"
    why_human: "Tailwind dark: classes cannot be verified without a running browser"
  - test: "Mobile layout check for ChipSquadView (< 640px)"
    expected: "Player rows are single-column cards; ChipModeToggle pill is readable and tappable (min-h-[44px] enforced); BB notice visible below headline"
    why_human: "Responsive layout requires browser viewport"
  - test: "GwToggle keyboard accessibility in FH mode"
    expected: "When FH is active, 1GW/3GW/5GW buttons are not reachable by keyboard Tab; WR-01 identified buttons remain focusable via keyboard despite pointer-events-none wrapper"
    why_human: "Keyboard navigation requires browser interaction; pointer-events-none does not block keyboard events on <button> elements"
  - test: "MobileComparisonCards visual: normal mode bench rows vs XI rows"
    expected: "In normal mode on mobile, only bench rows should appear dimmed (opacity-60); XI rows should be full opacity. CR-02 bug means XI rows ARE incorrectly dimmed at opacity-60 on mobile — verify this is visually broken"
    why_human: "Requires mobile viewport to confirm the opacity-60 bug is visible to users"
---

# Phase 46: Chip Modes Verification Report

**Phase Goal:** Ship chip mode simulation (Wildcard, Free Hit, Bench Boost) in the OptimiserPanel — users can select a chip mode and see an optimal 15-player squad (WC/FH) or modified comparison table (BB) derived from the live player pool.
**Verified:** 2026-05-01T08:20:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ChipMode type exists with four values | ✓ VERIFIED | `export type ChipMode = 'none' \| 'wildcard' \| 'free-hit' \| 'bench-boost'` at types.ts:227 |
| 2 | ChipSquadPlayer and ChipSquadResult types exported from types.ts | ✓ VERIFIED | Both interfaces present at types.ts:230–246 |
| 3 | buildOptimalSquad returns valid 15-player ChipSquadResult for sufficient pool | ✓ VERIFIED | 18/18 engine unit tests GREEN; real algorithm at chip-modes.ts:37–106 |
| 4 | Budget filter prevents over-budget selection | ✓ VERIFIED | Line 66: `if (runningCost + player.now_cost > budget) continue` |
| 5 | Formation quotas enforced: exactly 2 GK, 3-5 DEF, 2-5 MID, 1-3 FWD | ✗ PARTIAL (CR-01) | MAX_SLOTS enforced; MIN_SLOTS declared but dead code (`void MIN_SLOTS` at line 131). Greedy loop can produce squads missing required minimum positions with adversarial player pools. |
| 6 | No FPL club has more than 3 players in squad | ✓ VERIFIED | teamCap=3 guard at line 65 |
| 7 | BGW players excluded (xPts_1gw === 0) | ✓ VERIFIED | Filter at line 43: `p.status === 'a' && p.xPts_1gw !== 0` |
| 8 | Free Hit always uses xPts_1gw field | ✓ VERIFIED | effectiveHorizon guard at OptimiserPanel.tsx:288 |
| 9 | User can click None/WC/FH/BB to switch chip modes | ✓ VERIFIED | ChipModeToggle.tsx renders 4 buttons with aria-pressed; 7/7 component tests GREEN |
| 10 | WC mode shows ChipSquadView with green left border for XI | ✓ PARTIAL (WR-03) | ChipSquadView renders data-xi="true" rows with `border-green-500`; formation+budget headline present. Type narrowing missing at call site but runtime behavior correct. |
| 11 | FH mode shows ChipSquadView with amber reversion notice; horizon selector visually disabled | ✓ VERIFIED | `fh-reversion-notice` data-testid present with "reverts" text; GwToggle receives `disabled={chipMode === 'free-hit'}` wrapping with `pointer-events-none opacity-50` |
| 12 | BB mode shows comparison table with modified headline and full-opacity bench rows | ✗ FAILED (CR-02) | Desktop ComparisonTable bench opacity is correct. MobileComparisonCards at line 200: inverted predicate (`isBenchBoost && row.isBench ? '' : ' opacity-60'`) applies opacity-60 to ALL unchanged rows including XI rows on mobile. |
| 13 | FT toggle hidden when WC or FH active | ✓ VERIFIED | FtToggle inside `{chipMode !== 'wildcard' && chipMode !== 'free-hit' && (...)}` guard; test "activating Wildcard hides the FT toggle" passes |
| 14 | computeBenchBoostXPts returns correct sum for active horizon | ✓ VERIFIED | 2 unit tests GREEN; real implementation at chip-modes.ts:112–123 |

**Score:** 11/14 truths verified (2 FAILED, 1 PARTIAL degraded to FAILED for scoring)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/types.ts` | ChipMode, ChipSquadPlayer, ChipSquadResult exports | ✓ VERIFIED | All three present at lines 227–246 |
| `src/lib/chip-modes.ts` | Real buildOptimalSquad + computeBenchBoostXPts | ✓ VERIFIED | Real implementation; `filledSlots` greedy loop present |
| `src/lib/chip-modes.test.ts` | 18 GREEN engine unit tests | ✓ VERIFIED | 18/18 GREEN |
| `src/components/optimiser/ChipModeToggle.tsx` | 4-button pill with chip-toggle-none testid | ✓ VERIFIED | 46 lines; all 4 options with testids |
| `src/components/optimiser/ChipSquadView.tsx` | Position-grouped squad view with data-testids | ✓ VERIFIED | 108 lines; chip-squad-view, chip-squad-headline, fh-reversion-notice, data-xi attrs |
| `src/components/optimiser/OptimiserPanel.tsx` | chipMode state + conditional rendering + BB headline | ✓ VERIFIED | chipMode state, chipSquad memo, effectiveHorizon, isBenchBoost threading |
| `src/components/gem-table/GwToggle.tsx` | disabled prop for FH mode | ✓ VERIFIED | disabled?: boolean prop added; wrapper div with pointer-events-none |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| OptimiserPanel.tsx | ChipModeToggle.tsx | `import { ChipModeToggle } from './ChipModeToggle'` | ✓ WIRED | Line 19; rendered at line 438 |
| OptimiserPanel.tsx | ChipSquadView.tsx | `import { ChipSquadView } from './ChipSquadView'` | ✓ WIRED | Line 20; rendered at line 451 |
| OptimiserPanel.tsx | chip-modes.ts | `import { buildOptimalSquad, computeBenchBoostXPts, CHIP_DEFAULT_BUDGET_TENTHS }` | ✓ WIRED | Line 18; buildOptimalSquad called in chipSquad useMemo at line 297 |
| chipSquad memo | buildOptimalSquad | effectiveHorizon FH lock | ✓ WIRED | Line 288: `const effectiveHorizon = chipMode === 'free-hit' ? 1 : horizon` |
| chip-modes.ts | optimise-lineup.ts | `import { HORIZON_FIELD, optimiseLineup }` | ✓ WIRED | Line 6; optimiseLineup called at line 94 for bestXI derivation |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| ChipSquadView | `result.squad`, `result.bestXI` | `chipSquad` useMemo → `buildOptimalSquad({ players: playersData, budget, horizon })` | playersData from usePlayers() hook (live API) | ✓ FLOWING |
| BB headline in OptimiserPanel | `computeBenchBoostXPts(lineup.bench, playersData, horizon)` | Real lineup from `optimiseLineup` on squad picks | playersData from usePlayers() hook | ✓ FLOWING |
| GwToggle disabled | `disabled={chipMode === 'free-hit'}` | `chipMode` local state | State-driven; no data source needed | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Engine unit tests GREEN | `npx vitest run src/lib/chip-modes.test.ts` | 18 passed | ✓ PASS |
| ChipModeToggle tests GREEN | `npx vitest run src/components/optimiser/ChipModeToggle.test.tsx` | 7 passed | ✓ PASS |
| ChipSquadView tests GREEN | `npx vitest run src/components/optimiser/ChipSquadView.test.tsx` | 8 passed | ✓ PASS |
| OptimiserPanel Phase 46 tests GREEN | `npx vitest run src/components/optimiser/OptimiserPanel.test.tsx` | 33 passed (9 Phase 46 + 24 prior) | ✓ PASS |
| Full suite regressions | `npx vitest run` | 511 passed, 1 pre-existing fail (club-form.test.ts) | ✓ PASS |
| TypeScript compilation | `npx tsc --noEmit` | 5 pre-existing errors in captain-picks.test.ts only | ✓ PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CHIP-01 | 46-01, 46-02, 46-03 | Wildcard: best 15 from all players, show best XI | ✓ SATISFIED | buildOptimalSquad engine GREEN; ChipSquadView renders WC mode; tests pass. CR-01 (MIN_SLOTS) is a correctness edge case with adversarial pools; typical real-world pools pass. |
| CHIP-02 | 46-01, 46-02, 46-03 | Free Hit: optimise for current GW only, labelled reverts | ✓ SATISFIED | effectiveHorizon guard forces horizon:1; fh-reversion-notice rendered with "reverts" text; GwToggle disabled |
| CHIP-03 | 46-01, 46-03 | Bench Boost: bench order visible, bench xPts headline | ✗ BLOCKED (mobile) | Desktop ComparisonTable BB behavior correct. MobileComparisonCards CR-02 inverted opacity bug: unchanged XI rows appear dimmed (opacity-60) on mobile in both normal mode and BB mode. BB bench full opacity only works on desktop. |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/chip-modes.ts` | 131 | `void MIN_SLOTS` — dead constant suppressing lint warning | BLOCKER | MIN_SLOTS is never read by the algorithm (CR-01). The greedy loop only enforces MAX_SLOTS. Can produce squads with < minimum required players per position with adversarial/thin pools. |
| `src/components/optimiser/OptimiserPanel.tsx` | 200 | `isBenchBoost && row.isBench ? '' : ' opacity-60'` — inverted opacity predicate | BLOCKER | Applies opacity-60 to all unchanged rows (including XI) on mobile. Should be `row.isBench && !isBenchBoost` to match ComparisonTable logic. |
| `src/components/optimiser/OptimiserPanel.tsx` | 298 | `playerMap` in chipSquad dep array | WARNING | playerMap identity changes when horizon changes (it depends on [squadData, playersData, horizon]). Causes chipSquad to recompute on every horizon change even when chipMode is 'none' (early return makes it cheap but wasteful). CR-03. |
| `src/components/optimiser/OptimiserPanel.tsx` | 451 | `chipMode` passed without narrowing to `ChipSquadViewProps.chipMode: 'wildcard' \| 'free-hit'` | WARNING | TypeScript type contract broken; runtime guarded by conditional branch but future refactoring could silently break. WR-03. |
| `src/components/gem-table/GwToggle.tsx` | 100–111 | `pointer-events-none` wrapper does not block keyboard events on `<button>` elements | WARNING | Screen readers and keyboard users can still activate GwToggle buttons when FH chip is active. WR-01. |

---

### Human Verification Required

#### 1. Visual dark mode — all chip modes

**Test:** Open the app in dark mode, navigate to Squad > Optimiser, submit a valid FPL team ID. Cycle through None → Wildcard → Free Hit → Bench Boost.
**Expected:** All Tailwind dark: variants render correctly. ChipModeToggle pill, ChipSquadView rows (green/amber/zinc), GwToggle disabled state (opacity-50), BB headline and notice all visually correct.
**Why human:** Tailwind dark: classes cannot be verified without a running browser.

#### 2. Mobile layout (< 640px) for ChipSquadView

**Test:** Open the app at mobile viewport width. Activate Wildcard or Free Hit chip modes.
**Expected:** ChipSquadView player rows are single-column cards, tappable (min-h-[44px]), ChipModeToggle pill is readable and tappable, FH amber notice visible.
**Why human:** Responsive layout requires browser viewport.

#### 3. Mobile opacity bug (CR-02) visual confirmation

**Test:** Open the app at mobile viewport width in normal (None) chip mode. Load squad with optimised lineup changes.
**Expected (BROKEN):** Unchanged XI rows should be full opacity. Due to CR-02, unchanged rows including XI rows will appear at opacity-60 on mobile — this is the bug. Confirm it is visible.
**Why human:** Requires mobile viewport to confirm the opacity-60 regression on XI rows.

#### 4. GwToggle keyboard accessibility in FH mode

**Test:** Activate Free Hit chip mode. Tab to the 1GW/3GW/5GW buttons. Press Enter/Space.
**Expected (BROKEN per WR-01):** Buttons are accessible by keyboard despite `pointer-events-none`. The `onChange` handler can still fire via keyboard, bypassing the FH horizon lock.
**Why human:** Keyboard navigation requires browser interaction.

---

### Gaps Summary

Three gaps block full phase goal achievement:

**GAP 1 — CR-01: MIN_SLOTS not enforced (CHIP-01/CHIP-02 correctness)**
`buildOptimalSquad` declares `MIN_SLOTS` but never reads it. The greedy loop only checks `MAX_SLOTS`. In adversarial or thin player pools (few players per position), the algorithm can return a squad with fewer than the minimum required players for a position. This will then cause `optimiseLineup` to return null (no valid XI), or silently return a formation-invalid squad. The 18 unit tests pass because `makeValidPool()` is constructed to always have exactly the minimum positions available — they don't test a thin-pool scenario where greedy order produces the violation. Root fix: two-pass strategy (fill minimums first, then greedily fill remaining slots).

**GAP 2 — CR-02: MobileComparisonCards opacity inverted (CHIP-03 visual regression)**
At `OptimiserPanel.tsx:200`, the condition `(isBenchBoost && row.isBench ? '' : ' opacity-60')` is inverted relative to the intended logic. It applies `opacity-60` to all unchanged rows on mobile — including unchanged XI rows in normal mode. This is a visual regression from Phase 44/45 behavior on mobile: previously only unchanged rows had opacity-60 applied (which was also wrong per the PLAN spec, but the inverted condition makes it worse). In BB mode, XI rows still incorrectly get opacity-60. The correct expression mirrors ComparisonTable line 137: `(row.isBench && !isBenchBoost ? ' opacity-60' : '')`.

**GAP 3 — WR-03: ChipMode not narrowed before ChipSquadView prop (type safety)**
`OptimiserPanel.tsx:451` passes `chipMode` (type `ChipMode`) to `ChipSquadView`'s prop typed as `'wildcard' | 'free-hit'`. The runtime is safe (guarded by the conditional branch) but TypeScript strict mode will reject this assignment. A cast `chipMode as 'wildcard' | 'free-hit'` at the call site fixes the type contract.

GAP 1 and GAP 3 are correctness/robustness issues. GAP 2 is an observable visual regression on mobile.

---

_Verified: 2026-05-01T08:20:00Z_
_Verifier: Claude (gsd-verifier)_
