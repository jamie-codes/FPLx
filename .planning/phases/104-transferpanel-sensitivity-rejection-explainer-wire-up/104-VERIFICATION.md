---
phase: 104-transferpanel-sensitivity-rejection-explainer-wire-up
verified: 2026-05-13T17:00:00Z
status: human_needed
score: 7/7 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open TransferPanel with a loaded squad and verify sell candidates with known weaknesses show rejection reasons inline"
    expected: "Rotation-risk or form-poor sell candidates display up to 4 zinc-coloured plain-text reason lines directly below the sell name in each OCS row; strong sell candidates show no text below the name"
    why_human: "Visual rendering of always-visible inline reasons; correctness of computeRejection output for real FPL player data cannot be verified programmatically without a running app"
  - test: "Open DecisionSummaryTab OCS section and verify sell-rejection-reasons also appear there"
    expected: "Same rejection reason display as TransferPanel — both consumers are wired with the same props"
    why_human: "Second production call site; confirms prop threading works end-to-end in the DecisionSummaryTab context"
  - test: "Verify a combo-free (2 FT) OCS row shows independent reasons per sell leg"
    expected: "Each sell leg has its own reason block (or none if strong); reasons from leg 1 do not bleed into leg 2"
    why_human: "Multi-leg row rendering in production data with real players"
---

# Phase 104: TransferPanel Sensitivity & Rejection Explainer Wire-Up — Verification Report

**Phase Goal:** Wire computeRejection into sell side of OCS rows in TransferPanel and DecisionSummaryTab — give managers scannable diagnostic context for why the OCS engine flagged a player as a sell candidate
**Verified:** 2026-05-13T17:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SENS-01 satisfied with no new code: FragilityBadge already renders on OCS buy candidates (Phase 93, unchanged) | VERIFIED | `computeFragility` + `FragilityBadge` at OCT.tsx:112-143 untouched; git diff of engine files is 0 bytes across Phase 104 commits |
| 2 | User can see plain-English rejection reasons inline directly below every OCS sell player name when computeRejection returns non-empty reasons | VERIFIED | `data-testid="sell-rejection-reasons"` div at OCT.tsx:135; rendered when `sellReasonsCapped.length > 0`; Test B passes confirming weak sell renders reasons |
| 3 | Sell-side reasons are capped at 4, preserving the fixed priority order from computeRejection | VERIFIED | `sellReasons.slice(0, 4)` at OCT.tsx:116; Test C confirms `.querySelectorAll('p').length === 4` for heavy-signal sell |
| 4 | When computeRejection returns reasons:[] (strong sell candidate), nothing renders below the sell name | VERIFIED | Conditional `{sellReasonsCapped.length > 0 && (...)}` at OCT.tsx:134; Test A passes (block is null for strong sell in test pool) |
| 5 | Each transfer leg in a multi-leg (combo FT) OCS row independently computes and renders its own sell rejection reasons | VERIFIED | `computeRejection` called inside `row.transfers.map((t, i) => ...)` at OCT.tsx:110-148; Test D confirms 2 distinct blocks on combo-free row |
| 6 | OCS roll row remains visually identical (no reasons rendered — PlayerMoveCell returns '—' early) | VERIFIED | Early return at OCT.tsx:105-107 on `row.kind === 'roll'`; 6 column-header tests pass with roll rows; grep count = 1 |
| 7 | computeRejection degrades gracefully when lifecycleLabels is new Map() (squad not loaded) — no runtime error | VERIFIED | All 4 WHY-01 tests pass `lifecycleLabels={new Map()}`; computeRejection handles empty Map at explain.ts:195-199 |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/transfers/OpportunityCostTable.tsx` | PlayerMoveCell calls computeRejection on t.sell per leg; props add allPlayers and lifecycleLabels | VERIFIED | `computeRejection(t.sell as unknown as ScoredPlayer, allPlayers, lifecycleLabels)` at line 115; interface updated lines 17-24 |
| `src/components/transfers/TransferPanel.tsx` | Threads scoredPlayers and lifecycleLabels into OpportunityCostTable | VERIFIED | `allPlayers={scoredPlayers}` and `lifecycleLabels={lifecycleLabels}` at lines 434-435 |
| `src/components/squad/DecisionSummaryTab.tsx` | Threads scoredPlayers and lifecycleLabels into OpportunityCostTable (second production consumer) | VERIFIED | `allPlayers={scoredPlayers}` and `lifecycleLabels={lifecycleLabels}` at lines 584-585 |
| `src/components/transfers/OpportunityCostTable.test.tsx` | Updated existing tests with new required props; new tests for sell-rejection-reasons rendering, slice cap, empty-reasons silence, and combo-row per-leg independence | VERIFIED | 10 tests total (6 column-header + 4 WHY-01); all pass; 2 describe blocks; `sell-rejection-reasons` appears 4 times in assertions |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `TransferPanel.tsx` | `OpportunityCostTable.tsx` | `allPlayers={scoredPlayers} lifecycleLabels={lifecycleLabels}` props | WIRED | grep confirms `allPlayers={scoredPlayers}` at line 434 and `lifecycleLabels={lifecycleLabels}` at line 435 |
| `OpportunityCostTable.tsx` | `src/lib/explain.ts` | `computeRejection` import + per-leg call on t.sell | WIRED | `import { computeRejection } from '@/lib/explain'` at line 15; call at line 115 |
| `OpportunityCostTable.tsx (PlayerMoveCell sell-reasons block)` | `data-testid="sell-rejection-reasons"` | conditional render when `sellReasonsCapped.length > 0` | WIRED | div with testid at line 135; conditional guard at line 134 |
| `DecisionSummaryTab.tsx` | `OpportunityCostTable.tsx` | `allPlayers={scoredPlayers} lifecycleLabels={lifecycleLabels}` props | WIRED | grep confirms `allPlayers={scoredPlayers}` and `lifecycleLabels={lifecycleLabels}` at lines 584-585 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `OpportunityCostTable.tsx` (sell reasons block) | `sellReasonsCapped` | `computeRejection(t.sell as unknown as ScoredPlayer, allPlayers, lifecycleLabels)` → `reasons.slice(0, 4)` | Yes — `allPlayers` is `scoredPlayers` memo from `computeAllGemScores(playersData)` | FLOWING |
| `TransferPanel.tsx` → `allPlayers` prop | `scoredPlayers` | `useMemo(() => computeAllGemScores(playersData ?? []), [playersData])` at line 57-60 | Yes — derived from live player data fetch | FLOWING |
| `TransferPanel.tsx` → `lifecycleLabels` prop | `lifecycleLabels` | `useMemo(() => computeLifecycleLabels(squadData.picks, scoredPlayers, clubFormMap), ...)` at line 82-85 | Yes — computed from squad picks + scored players; returns `new Map()` when squad not loaded (safe fallback) | FLOWING |

**Note on type cast:** `t.sell` is typed as `MergedPlayer` in `OCSRow` but the runtime objects flowing through `TransferPanel.scoredPlayers → suggestTransfers(players: scoredPlayers) → OCSRow.transfers[].sell` are `ScoredPlayer` instances (ScoredPlayer extends MergedPlayer). The cast `as unknown as ScoredPlayer` is safe at runtime because `suggestTransfers` receives `scoredPlayers` which carry `gem_score`. This is confirmed by Test A passing — the strong-sell player correctly produces `reasons: []` in the test environment. The REVIEW.md CR-01 documents this as a type-safety concern (not a runtime bug); the type boundary should be corrected in a future phase for maintainability.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 10 OCT tests pass | `npx vitest run src/components/transfers/OpportunityCostTable.test.tsx` | 10/10 passed, 0 failed, duration 665ms | PASS |
| computeRejection only in OpportunityCostTable among transfer components | `grep -rn computeRejection src/components/transfers/` | Matches only OCT.tsx (call site), OCT.test.tsx (test descriptions), and RejectionSearchCallout.tsx (pre-existing Phase 94 component) | PASS |
| sell-rejection-reasons testid only in OCT production code | `grep -rn 'data-testid="sell-rejection-reasons"' src/` | 1 match in OCT.tsx + 4 in OCT.test.tsx assertions; no other component | PASS |
| Engine files unchanged | `git diff fca24d9~1 fca24d9 -- src/lib/explain.ts src/lib/sensitivity.ts src/lib/lifecycle-label.ts` | 0 bytes diff | PASS |
| Three production render sites all pass new required props | `grep -rn "<OpportunityCostTable" src/ --include="*.tsx"` | TransferPanel.tsx:430, DecisionSummaryTab.tsx:581, OCT.test.tsx (10 render calls all with allPlayers+lifecycleLabels) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| SENS-01 | 104-01-PLAN.md | User can see fragility indicator on each transfer buy candidate in TransferPanel | SATISFIED (no new code) | FragilityBadge at OCT.tsx:143 — `{tier !== 'robust' && <FragilityBadge tier={tier} reasons={reasons} />}` — Phase 93 artefact untouched; computeFragility call at OCT.tsx:112 unchanged |
| WHY-01 | 104-01-PLAN.md | User can see plain-English rejection reasons for sell candidates in TransferPanel | SATISFIED | computeRejection per-leg at OCT.tsx:115; sell-reasons div at line 135; both TransferPanel and DecisionSummaryTab threaded; 4 new WHY-01 tests all pass |

**Note on REQUIREMENTS.md status:** Both SENS-01 and WHY-01 remain marked as pending (unchecked `[ ]`) in `.planning/REQUIREMENTS.md`. The traceability table correctly maps both to Phase 104 but the checkbox state was not updated post-implementation. This is a documentation maintenance item, not a code deficiency.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/transfers/OpportunityCostTable.tsx` | 115 | `t.sell as unknown as ScoredPlayer` type cast | Warning | Type-unsafe: OCSRow types sell as MergedPlayer, but ScoredPlayer.gem_score is required by computeRejection. Safe at runtime because scoredPlayers (ScoredPlayer[]) flows in; unsafe if call sites ever pass non-ScoredPlayer data. REVIEW.md CR-01 documents this with fix options. |
| `src/components/transfers/OpportunityCostTable.test.tsx` | 18,72,87 | `as unknown as OCSRow/ScoredPlayer` test factory casts | Info | Test factories use blanket casts; type errors from new required fields would be silently suppressed. REVIEW.md IN-02 notes this. Does not affect current test correctness. |

No stub patterns found. No TODO/placeholder comments. No hardcoded empty data flowing to rendering. No return null/return [] implementations in production paths.

### Human Verification Required

The automated checks are all green. Three items require human testing with a running app and real FPL data:

#### 1. Sell Rejection Reasons Render in TransferPanel

**Test:** Load TransferPanel with a squad that has suggested transfers. Identify a sell candidate that is a weak player (rotation risk, poor form, or hard upcoming fixture). Verify rejection reasons appear inline below the sell name.
**Expected:** Up to 4 zinc-coloured (`text-xs text-zinc-500`) reason strings render directly below the sell player name in the OCS row, with no expand/toggle needed. Strong sell candidates (if any) show no text below the name.
**Why human:** Real FPL player data is needed to exercise computeRejection with live gem_scores, start_probs, and fixture data. The always-visible nature and visual separation from the amber FragilityBadge requires eyeball confirmation.

#### 2. Sell Rejection Reasons Render in DecisionSummaryTab

**Test:** Navigate to the Decision Summary tab. Locate the OCS table. Verify the same sell-side rejection reasons appear.
**Expected:** Identical behaviour to TransferPanel — same reasons for the same sell candidates, same capping at 4, same silence for strong sells.
**Why human:** Second production consumer; confirms DecisionSummaryTab's prop threading (`scoredPlayers` at line 186, `lifecycleLabels` at line 213) reaches the component correctly in the real render tree.

#### 3. Combo-Free Row Per-Leg Independence

**Test:** If a combo-free (2 FT) OCS row is present, inspect both legs. Confirm each sell name has its own independent reason block.
**Expected:** Two separate reason blocks (or none), one per leg. Reasons are specific to each leg's sell player — the two blocks show different reasons if the sell players have different weaknesses.
**Why human:** Multi-leg combo rows may not be generated for every squad/horizon combination; requires production data to trigger.

### Gaps Summary

No gaps blocking phase goal achievement. All 7 must-have truths are VERIFIED. All key links are WIRED. Data flows from real sources. Tests are green.

**Known deviations from ROADMAP wording (intentional, recorded in CONTEXT):**
- ROADMAP SC-2 says "expand" a sell candidate — implementation is always-visible inline (CONTEXT D-02). The CONTEXT decision takes precedence as the agreed design refinement.
- ROADMAP says "top-2 reasons" — implementation shows up to 4 (CONTEXT note, D-04). This is a scope expansion, not a regression.
- REQUIREMENTS.md checkboxes for SENS-01 and WHY-01 not updated to checked state — documentation maintenance item only.

**Open type-safety item from REVIEW.md CR-01:** The `t.sell as unknown as ScoredPlayer` cast is safe at runtime but represents a type boundary gap. Future work should either widen `OCSRow.transfers` to use `ScoredPlayer` or add an `allPlayers.find()` lookup at the call site. Not a Phase 104 blocker.

---

_Verified: 2026-05-13T17:00:00Z_
_Verifier: Claude (gsd-verifier)_
