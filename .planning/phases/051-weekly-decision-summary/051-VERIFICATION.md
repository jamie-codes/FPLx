---
phase: 051-weekly-decision-summary
verified: 2026-05-02T04:55:00Z
status: human_needed
score: 19/19 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Navigate to Squad section and confirm Decision tab is the default landing, with sub-tab order Decision | Transfers | Optimiser"
    expected: "Decision sub-tab is highlighted immediately on Squad click; order is Decision left, Transfers middle, Optimiser right"
    why_human: "Tab ordering and default active state require visual browser confirmation — cannot verify DOM render order and CSS active state programmatically"
  - test: "With a valid team ID loaded, view all four cards on one screen — Captain Pick, Transfer Options, Chip Timing, Risk Flags — without navigating to another tab"
    expected: "All four cards visible simultaneously in 2-col desktop grid; no tab switch required (WDS-01)"
    why_human: "Single-screen composition is a user-perceptible layout outcome; cannot verify the complete render without a browser"
  - test: "On mobile (< 640 px), confirm priority order is top-to-bottom: Captain, Transfer, Chip, Risk"
    expected: "Vertical stack follows the CSS grid-cols-1 order: captain-card first, transfer-card second, chip-card third, risk-card fourth (WDS-02)"
    why_human: "Responsive layout requires a resized browser viewport to confirm"
  - test: "Each card header shows a coloured severity badge (HIGH = red, MEDIUM = amber, LOW = zinc)"
    expected: "Badge text is 'HIGH', 'MEDIUM', or 'LOW'; background colours match SEVERITY_CONFIG (WDS-03)"
    why_human: "Colour rendering and Tailwind class application require visual browser inspection"
  - test: "With no squad loaded, Transfer Options and Risk Flags cells show the placeholder 'Load your squad to see transfer and risk recommendations.' while Captain Pick and Chip Timing cards still render (WDS-04)"
    expected: "Two NoSquadPlaceholder cells visible; Captain card shows top-3 from player pool; Chip card shows chip rows or 'All chips have been played.'"
    why_human: "No-squad rendering path requires a browser session with no submittedId to exercise all branches together"
  - test: "When the upcoming GW is a DGW, a violet 'DGW upcoming' badge appears on the Chip Timing card; when a BGW, a zinc 'BGW upcoming' badge appears (WDS-05)"
    expected: "data-testid='chip-dgw-badge' or 'chip-bgw-badge' visible and labelled correctly when isDGW/isBGW is true for the live GW"
    why_human: "DGW/BGW badge visibility depends on live fixture data for the current upcoming GW; cannot force isDGW=true without a live data state"
---

# Phase 51: Weekly Decision Summary Verification Report

**Phase Goal:** Users see captain recommendation, transfer recommendation, chip timing flag, and risk flags on a single screen — no tab-hopping required — with a clear priority order and severity signals
**Verified:** 2026-05-02T04:55:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | computeDecisionSeverity() exists and is exported from src/lib/decision-severity.ts | VERIFIED | File exists, 69 lines; `export function computeDecisionSeverity` confirmed at line 41 |
| 2 | SeverityLevel union type 'HIGH' \| 'MEDIUM' \| 'LOW' is exported | VERIFIED | Line 19: `export type SeverityLevel = 'HIGH' \| 'MEDIUM' \| 'LOW'` |
| 3 | Captain severity rule is correctly implemented (HIGH when top1 >= 2*top2 and top2 > 0; else MEDIUM) | VERIFIED | Lines 45-47; top2 > 0 guard present; >= operator confirmed; 21/21 tests pass including boundary Test 2 and zero-div Test 6 |
| 4 | Transfer severity rule correctly implemented (HIGH for sell/minutes_trap, MEDIUM for sell_soon/fixture_trap, LOW otherwise) | VERIFIED | Lines 50-52; shared transferRisk computation; Tests 7-13 all pass |
| 5 | Risk severity equals Transfer severity (same rule per D-12) | VERIFIED | Line 66: `risk: transferRisk` — same computed value, not recomputed; Test 14 invariant passes |
| 6 | Chip severity correctly implemented (HIGH = DGW/BGW+available+recommended; MEDIUM = recommended only; LOW otherwise) | VERIFIED | Lines 55-60; Tests 15-20 all pass including defensive Test 20 (hasAvailableChip=false falls through to MEDIUM via hasRecommendedChip) |
| 7 | computeDecisionSeverity returns exactly {captain, transfer, chip, risk} | VERIFIED | Return statement lines 62-67; Test 21 `Object.keys(result).sort()` passes |
| 8 | Decision-severity.ts has no 'use client', uses relative imports, is importable in Vitest node environment | VERIFIED | `grep -c "^'use client'"` = 0; `from './captaincy-engine'` and `from './lifecycle-label'` confirmed; no @/lib/ aliases |
| 9 | 21/21 Vitest cases pass for decision-severity | VERIFIED | `npx vitest run src/lib/__tests__/decision-severity.test.ts` → "21 passed (21)" |
| 10 | DecisionSummaryTab.tsx exists, exports DecisionSummaryTab, is a 'use client' component ≥ 250 lines | VERIFIED | File is 620 lines; `'use client'` at line 1; `export function DecisionSummaryTab` confirmed |
| 11 | Four cards rendered in priority order: Captain, Transfer, Chip, Risk (in grid grid-cols-1 md:grid-cols-2) | VERIFIED | Lines 434-617; card order in JSX is captain-card → transfer-card/placeholder → chip-card → risk-card/placeholder; `grid-cols-1 md:grid-cols-2` at line 432 |
| 12 | Each card has SeverityBadge driven by computeDecisionSeverity() — no inline severity logic | VERIFIED | severity.captain/transfer/chip/risk sourced from `computeDecisionSeverity()` useMemo (lines 322-333); SeverityBadge renders level prop |
| 13 | Transfer card mounts OpportunityCostTable with horizon={1} and no FtToggle/GwToggle; suggestTransfers called with horizon: 1 | VERIFIED | Line 518: `<OpportunityCostTable rows={ocsRows} horizon={1} />`; line 229: `horizon: 1, // PINNED per CONTEXT.md D-06`; no FtToggle or GwToggle in component |
| 14 | No-squad graceful degradation: Transfer and Risk cards show NoSquadPlaceholder; Captain and Chip cards remain visible (WDS-04) | VERIFIED | Lines 500-522 (Transfer: squadData ? card : NoSquadPlaceholder); lines 585-616 (Risk: squadData ? card : NoSquadPlaceholder); captaincyCandidates useMemo branches on !squadData (lines 191-204); chip card not gated on squadData |
| 15 | DGW/BGW badge shown on Chip card when isDGW/isBGW (WDS-05) | VERIFIED | Lines 535-552; `{isDGW && <span ... data-testid="chip-dgw-badge">DGW upcoming</span>}`; `{isBGW && <span ... data-testid="chip-bgw-badge">BGW upcoming</span>}` |
| 16 | page.tsx wires Decision as first Squad sub-tab and default landing page | VERIFIED | Line 55: `{ id: 'decision' as SubTab, label: 'Decision', mobileLabel: 'Decision' }` first; line 59: `defaultSubTab: 'decision' as SubTab`; line 68: `squad: 'decision'` |
| 17 | DecisionSummaryTab mounted in page.tsx conditional render before the 'transfers' branch | VERIFIED | Decision conditional at line 152; transfers conditional at line 160 |
| 18 | Existing TransferPanel and OptimiserPanel branches preserved | VERIFIED | `grep -c "<TransferPanel"` = 1; `grep -c "<OptimiserPanel"` = 1; both branches present unchanged |
| 19 | dangerouslySetInnerHTML absent from DecisionSummaryTab.tsx (T-051-11 XSS mitigation) | VERIFIED | `grep -c "dangerouslySetInnerHTML"` = 0 |

**Score:** 19/19 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/decision-severity.ts` | SeverityLevel type, DecisionSeverity interface, ComputeDecisionSeverityArgs interface, computeDecisionSeverity() pure function | VERIFIED | 69 lines; all 3 exports + 1 function confirmed; no 'use client'; relative imports only |
| `src/lib/__tests__/decision-severity.test.ts` | Vitest suite covering WDS-03 and WDS-05; 21 Test N: cases | VERIFIED | 201 lines; 5 describe blocks; 21 `it('Test N:` cases; makeCandidate + makeArgs factories |
| `src/components/squad/DecisionSummaryTab.tsx` | DecisionSummaryTab component, four cards, internal helpers | VERIFIED | 620 lines (> 250 minimum); all four data-testids present; all engine imports confirmed |
| `src/app/page.tsx` | SubTab union with 'decision', SECTIONS Squad with Decision first, sectionMemory.squad default 'decision', conditional render | VERIFIED | All four edits confirmed in file |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| decision-severity.ts | captaincy-engine.ts | `import type { CaptaincyCandidate } from './captaincy-engine'` | VERIFIED | Line 12; relative import |
| decision-severity.ts | lifecycle-label.ts | `import type { LifecycleLabel } from './lifecycle-label'` | VERIFIED | Line 13; relative import |
| decision-severity.test.ts | decision-severity.ts | `import { computeDecisionSeverity } from '@/lib/decision-severity'` | VERIFIED | Lines 2-9; @/lib alias |
| DecisionSummaryTab.tsx | decision-severity.ts | `import { computeDecisionSeverity } from '@/lib/decision-severity'` | VERIFIED | Line 24; called at lines 324-333 in useMemo |
| DecisionSummaryTab.tsx | captaincy-engine.ts | computeCaptaincyCandidates | VERIFIED | Line 11; called at line 203 |
| DecisionSummaryTab.tsx | lifecycle-label.ts | computeLifecycleLabels | VERIFIED | Line 12; called at line 208 |
| DecisionSummaryTab.tsx | opportunity-cost.ts | computeOpportunityCostRows | VERIFIED | Line 13; called at line 237 |
| DecisionSummaryTab.tsx | suggest-transfers.ts | suggestTransfers | VERIFIED | Line 14; called at lines 226-234 with horizon: 1 |
| DecisionSummaryTab.tsx | chip-strategy-engine.ts | computeBBScore, computeTCScore, computeFHResult | VERIFIED | Lines 15-22; all three called in useMemo |
| DecisionSummaryTab.tsx | planning-engine.ts | fixtureCountForGw | VERIFIED | Line 23; used in isDGW/isBGW useMemos |
| DecisionSummaryTab.tsx | OpportunityCostTable | JSX `<OpportunityCostTable rows={ocsRows} horizon={1} />` | VERIFIED | Line 518 |
| DecisionSummaryTab.tsx | LifecycleLabelBadge | `<LifecycleLabelBadge label={label} />` | VERIFIED | Line 609 |
| DecisionSummaryTab.tsx | MinsRiskBadge | `<MinsRiskBadge minsRisk={c.player.mins_risk} />` | VERIFIED | Line 492 |
| page.tsx | DecisionSummaryTab.tsx | `import { DecisionSummaryTab } from '@/components/squad/DecisionSummaryTab'` | VERIFIED | Line 23; conditional render at line 152 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| DecisionSummaryTab.tsx | captaincyCandidates | computeCaptaincyCandidates(squadData.picks, scoredPlayers, 3) or scoredPlayers fallback | Yes — live squad picks → engine; player pool → filtered/sorted | FLOWING |
| DecisionSummaryTab.tsx | ocsRows | computeOpportunityCostRows(ocsSuggestions, derivedFtCount) ← suggestTransfers({...}) | Yes — squad picks + scoredPlayers → transfer engine → OCS mapper | FLOWING |
| DecisionSummaryTab.tsx | severity | computeDecisionSeverity({ candidates, riskLabels, isDGW, isBGW, hasAvailableChip, hasRecommendedChip }) | Yes — pure function over live engine outputs | FLOWING |
| DecisionSummaryTab.tsx | riskRows | lifecycleLabels (from computeLifecycleLabels) filtered on position < 12 and RISK_LABELS set | Yes — squad picks + club form + scoredPlayers → lifecycle engine | FLOWING |
| DecisionSummaryTab.tsx | unusedChipCodes | usedChips Map from useChipHistory(submittedId) | Yes — chip history from authenticated API; empty Map when no teamId | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 21 decision-severity tests pass | `npx vitest run src/lib/__tests__/decision-severity.test.ts` | 21 passed (21) | PASS |
| Full test suite — 1 known pre-existing failure (club-form.test.ts) | `npx vitest run` | 588 passed, 1 failed (club-form — pre-Phase-51 failure unrelated to Phase 51 files) | PASS |
| TypeScript errors in Phase 51 files | `npx tsc --noEmit 2>&1 \| grep "DecisionSummaryTab\|decision-severity\|page.tsx"` | 0 errors in Phase 51 files | PASS |
| TypeScript errors globally | `npx tsc --noEmit` | 6 errors — all pre-existing in columns.tsx (Phase 48) and tests/lib/captain-picks.test.ts (Phase 31); confirmed by checking git diff against Phase 51 commits (0 lines changed in those files) | INFO (pre-existing, not caused by Phase 51) |
| Commit SHAs from SUMMARY match git log | `git log --oneline` | RED=378da9c, GREEN=ae6a210 (Plan 01); 4e0d98d, b4561d2 (Plan 02) — all present | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| WDS-01 | 051-02 | User sees all four recommendation types on a single screen — no tab-hopping | VERIFIED (automated) / HUMAN NEEDED (visual) | DecisionSummaryTab renders all 4 cards in one JSX tree; page.tsx wires it as Squad landing. Human confirm required that all 4 are simultaneously visible |
| WDS-02 | 051-02 | Recommendations in priority order: captain → transfer → chip → risks | VERIFIED (code order) / HUMAN NEEDED (visual mobile) | JSX card order is captain (1st), transfer (2nd), chip (3rd), risk (4th) in the grid div. Mobile stack order requires browser confirm |
| WDS-03 | 051-01, 051-02 | Each recommendation card carries a severity badge (High/Medium/Low) | VERIFIED | computeDecisionSeverity() confirmed correct by 21 tests; all 4 cards use SeverityBadge with severity.{captain,transfer,chip,risk}. Visual colour rendering needs human confirm |
| WDS-04 | 051-02 | Screen degrades gracefully when no squad loaded — captain/chip remain; transfer/risk hidden with prompt | VERIFIED (code paths) / HUMAN NEEDED (runtime) | captaincyCandidates branches on !squadData; Transfer and Risk use {squadData ? card : <NoSquadPlaceholder />}; correct copy strings confirmed |
| WDS-05 | 051-01, 051-02 | DGW/BGW context flag shown on chip card when upcoming GW is double/blank | VERIFIED (code) / HUMAN NEEDED (live data) | isDGW/isBGW computed via fixtureCountForGw; DGW/BGW badge JSX confirmed; data-testid attrs present. Visual confirm with live fixture data needed |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/components/squad/DecisionSummaryTab.tsx | 447 | `<p className="text-xs text-zinc-400 dark:text-zinc-500">1 GW</p>` — hardcoded "1 GW" subtitle under Captain Pick heading | INFO | Cosmetic — this matches the pinned horizon per D-06; not a stub, just static copy |
| src/lib/__tests__/decision-severity.test.ts | 19 | `player: { id: 1, web_name: 'P', element_type: 3 }` partial object cast — intentional test pattern | INFO | Factory helper cast to CaptaincyCandidate per plan spec; not a stub |

No blockers or warnings found. The "1 GW" subtitle is intentional per the spec (Transfer Options heading already says "Transfer Options — 1 GW"; the captain card sub-line is decorative, not a functional stub).

### Human Verification Required

The automated checks pass all 19 must-have truths. Six items require runtime browser confirmation to fully satisfy the phase goal:

#### 1. Decision tab default landing + sub-tab order (WDS-01, D-10)

**Test:** Open http://localhost:3000, click "Squad" in the top navigation
**Expected:** Decision sub-tab is active by default; sub-tab bar shows "Decision | Transfers | Optimiser" left-to-right; the four-card grid is visible immediately
**Why human:** Active CSS state and sub-tab render order require a live browser session

#### 2. Single-screen four-card view — no tab-hopping (WDS-01)

**Test:** With a valid team ID submitted, view the Squad → Decision tab
**Expected:** All four cards — Captain Pick, Transfer Options, Chip Timing, Risk Flags — are simultaneously visible in the viewport (or reachable by scrolling within a single page, without clicking a different tab)
**Why human:** "Single screen" is a spatial layout outcome not testable via grep

#### 3. Priority order on mobile (WDS-02)

**Test:** Resize browser to < 640 px viewport width; navigate to Squad → Decision
**Expected:** Vertical stack top-to-bottom: Captain Pick → Transfer Options (or placeholder) → Chip Timing → Risk Flags (or placeholder)
**Why human:** Responsive CSS stack order requires a narrow viewport

#### 4. Severity badge colours (WDS-03)

**Test:** Observe each card's severity badge on a squad-loaded Decision screen
**Expected:** HIGH badge has red background; MEDIUM has amber; LOW has zinc — matching SEVERITY_CONFIG in the component
**Why human:** Tailwind class rendering to actual colour requires visual browser inspection

#### 5. No-squad graceful degradation (WDS-04)

**Test:** Clear localStorage or use a fresh browser session with no team ID; navigate to Squad → Decision
**Expected:** Captain Pick card shows top-3 from player pool; Chip Timing shows chip rows; Transfer Options and Risk Flags show "Load your squad to see transfer and risk recommendations."; no runtime errors in the console
**Why human:** Multi-branch rendering path requires exercising the actual no-squad state at runtime

#### 6. DGW/BGW chip card badge (WDS-05)

**Test:** Use a GW where a DGW or BGW is detected (e.g., GW33 or GW36 per project memory); navigate to Squad → Decision; observe Chip Timing card
**Expected:** A violet "DGW upcoming" badge (or zinc "BGW upcoming" badge) appears below the Chip Timing header when isDGW/isBGW is true for the next GW
**Why human:** isDGW/isBGW depend on live fixture data; cannot force a DGW state in a static check

---

## Pre-existing Issues (Not Phase 51 Responsibility)

- **TypeScript:** 6 type errors exist globally (`npx tsc --noEmit`). All are in `src/components/gem-table/columns.tsx` (Phase 48) and `tests/lib/captain-picks.test.ts` (Phase 31). Confirmed by `git diff` — Phase 51 commits touch neither file. These are pre-Phase-51 carry-forwards.
- **Vitest:** `tests/lib/club-form.test.ts` has 1 pre-existing failure (Phase 27 `computeClubForm` difficulty tier test). Phase 51 commits do not touch that file.

---

_Verified: 2026-05-02T04:55:00Z_
_Verifier: Claude (gsd-verifier)_
