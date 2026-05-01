---
phase: 049-player-lifecycle-labels
verified: 2026-05-01T00:25:30Z
status: human_needed
score: 11/12 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Load a real squad in the Transfers tab and verify lifecycle labels display"
    expected: "Each starting-XI player row shows exactly one of: Buy Next Week, Hold One More, Sell Soon, Minutes Trap, Fixture Trap, Hold, or Sell. Bench rows show no badge. Hovering shows a tooltip. Expanding a sell/sell_soon row shows replacement shortlist."
    why_human: "UI rendering, badge colour correctness, tooltip display, and real-data label accuracy cannot be verified programmatically. Plan 049-02 Task 3 was a human-gated checkpoint."
---

# Phase 49: Player Lifecycle Labels Verification Report

**Phase Goal:** Squad players display granular timing labels that extend beyond Buy/Hold/Sell — giving managers specific action timing (Buy Next Week, Hold One More, Sell Soon, Minutes Trap, Fixture Trap) with a consistent priority hierarchy preventing contradictory signals
**Verified:** 2026-05-01T00:25:30Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | computeLifecycleLabel returns exactly one of seven LifecycleLabel string values for any valid input | VERIFIED | Union type enforced by TypeScript; 29 test cases pass covering all 7 label values |
| 2 | Minutes Trap fires only when now_cost >= 70 AND mins_risk in {rotation_risk,cameo} AND start_prob < 0.65 | VERIFIED | lifecycle-label.ts lines 93-98; Tests 1, 9, 11 confirm price gate + mins_risk + start_prob conditions; Test 9 confirms blocked when now_cost=65 |
| 3 | Fixture Trap fires only when differential_flag === 'trap' AND clubForm.swing_3gw <= -0.20 | VERIFIED | lifecycle-label.ts lines 105-110; Test 2 and explicit "Fixture Trap fires" test confirm both conditions required |
| 4 | Buy Next Week requires gem in [posAvg*0.90, posAvg], swing_1gw >= 0.20, regression_signal !== 'sell' | VERIFIED | lifecycle-label.ts lines 118-126; Test 3, Test 8 (regression_signal blocks), "Buy Next Week fires" test |
| 5 | Hold One More requires gem in [posAvg*0.90, posAvg] AND swing_3gw >= 0.20 AND NOT Buy Next Week conditions | VERIFIED | lifecycle-label.ts lines 131-138; Test 4 and "Hold One More fires" test verify swing_1gw below threshold fallthrough |
| 6 | Sell Soon fires when gem in [posAvg*0.85, posAvg*0.90) | VERIFIED | lifecycle-label.ts lines 143-145; Test 6 (88% of posAvg) |
| 7 | Sell fires when gem < posAvg*0.85 | VERIFIED | lifecycle-label.ts lines 148-150; Test 5 (84% of posAvg) |
| 8 | Hold is the default fallback when no other condition matches | VERIFIED | lifecycle-label.ts line 155; Tests 7, 7b, 7c confirm fallback |
| 9 | Priority cascade: Minutes Trap > Fixture Trap > Buy Next Week > Hold One More > Sell Soon > Sell > Hold | VERIFIED | Tests 1-4 cover all adjacent-priority pairs; additional "Minutes Trap fires over Fixture Trap" test covers priority 1 > 2 |
| 10 | Null clubForm causes all swing-dependent conditions to be skipped (no crash) | VERIFIED | lifecycle-label.ts uses `clubForm !== null &&` guards on all swing checks; Test 11 and Test 13 confirm no crash and gem-band fallback |
| 11 | computeLifecycleLabels excludes bench picks where pick.position >= 12 | VERIFIED | lifecycle-label.ts line 187; Test 12 asserts bench player absent from returned map |
| 12 | LifecycleLabelBadge renders exactly one of seven coloured badges (or null) per player in the UI | UNCERTAIN (human_needed) | Component exists and handles null — but visual rendering correctness in live browser not verified. Plan 049-02 Task 3 is a human-gated checkpoint. |

**Score:** 11/12 truths verified (1 requires human verification)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/lifecycle-label.ts` | LifecycleLabel type, threshold constants, computeLifecycleLabel and computeLifecycleLabels exports | VERIFIED | 8 exports confirmed: 1 type, 5 constants, 2 functions; 199 lines; substantive implementation |
| `src/lib/__tests__/lifecycle-label.test.ts` | Vitest cases for all 7 labels, priority cascade, bench exclusion, null clubForm guard | VERIFIED | 29 test cases, 4 describe blocks, all 29 pass green |
| `src/components/shared/LifecycleLabelBadge.tsx` | Seven-state badge component matching VerdictBadge structure | VERIFIED | Contains LABEL_MAP with all 7 entries; Record<LifecycleLabel, Config> exhaustiveness enforced by TypeScript |
| `src/components/transfers/TransferPanel.tsx` | useClubForm wiring + clubFormMap useMemo + computeLifecycleLabels useMemo + labels prop pass | VERIFIED | useClubForm: 2 occurrences (import + call); computeLifecycleLabels: 2 occurrences (import + useMemo); clubFormMap: 3+ occurrences; labels={lifecycleLabels}: 1 match |
| `src/components/squad/SquadView.tsx` | labels prop + LifecycleLabelBadge render + sell\|sell_soon shortlist trigger | VERIFIED | LifecycleLabelBadge: 2 occurrences (import + JSX); labels prop typed as `Map<number, LifecycleLabel>`; `label === 'sell' || label === 'sell_soon'` confirmed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| lifecycle-label.ts computeLifecycleLabels | recommend.ts computePositionAverages | import { computePositionAverages } from '@/lib/recommend' | WIRED | Line 4 import; line 183 invocation |
| lifecycle-label.ts computeLifecycleLabels | ClubForm lookup | clubFormMap.get(player.team) ?? null | WIRED | Line 193 confirmed |
| TransferPanel.tsx | useClubForm.ts | useClubForm() hook call | WIRED | Line 10 import; line 36 hook call |
| TransferPanel.tsx | lifecycle-label.ts computeLifecycleLabels | useMemo over squadData.picks, scoredPlayers, clubFormMap | WIRED | Lines 63-66 useMemo; line 229 labels={lifecycleLabels} prop pass |
| SquadView.tsx | LifecycleLabelBadge.tsx | <LifecycleLabelBadge label={labels?.get(pick.element) ?? null} /> | WIRED | Line 7 import; line 206 JSX render |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| SquadView.tsx | labels (Map<number, LifecycleLabel>) | computeLifecycleLabels in TransferPanel useMemo | Yes — computed from scoredPlayers (real FPL data) + squadData.picks (real squad) + clubFormMap (real ClubForm from useClubForm) | FLOWING |
| LifecycleLabelBadge.tsx | label prop | labels?.get(pick.element) ?? null | Yes — value comes from populated map; null on bench (expected) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 29 test cases pass | npx vitest run src/lib/__tests__/lifecycle-label.test.ts | 29 passed (1 file) | PASS |
| TypeScript compiles (phase 49 files) | npx tsc --noEmit | 5 errors exist — all pre-existing: 2 in captain-picks.test.ts (Phase 48), 1 in columns.tsx (Phase 48). Zero errors in any phase 49 file. | PASS (phase 49 clean) |
| computeVerdicts preserved for Phase 51 | grep -c "export function computeVerdicts" src/lib/recommend.ts | 1 | PASS |
| Legacy verdicts prop removed from both components | grep "verdicts" TransferPanel.tsx SquadView.tsx | 0 matches | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| LCL-01 | 049-02 | Squad players display a lifecycle label extending beyond Buy/Hold/Sell — includes Buy Next Week, Hold One More, Sell Soon, Minutes Trap, Fixture Trap | SATISFIED (with human gate) | LifecycleLabelBadge renders all 7 labels; SquadView wired to labels prop; human verification of live UI still pending |
| LCL-02 | 049-01 | Labels computed as pure-TS function over existing MergedPlayer fields — no new pipeline data required | SATISFIED | lifecycle-label.ts is pure TypeScript using only ScoredPlayer + ClubForm fields already in the codebase. No new API endpoints, no pipeline changes. |
| LCL-03 | 049-01 | Priority hierarchy prevents conflicting labels | SATISFIED | Priority cascade implemented and tested: 4 cascade tests (Tests 1-4) + additional pairwise tests. Exactly one label returned per player. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| TransferPanel.tsx | 115 | `placeholder=` attribute | Info | HTML input placeholder text for the team ID field — not a code stub |

No code stubs, empty returns, hardcoded empty data, or TODO/FIXME markers in any phase 49 file.

### Human Verification Required

#### 1. Live UI Lifecycle Label Display

**Test:** Start the dev server (`npm run dev`), open http://localhost:3000, navigate to Transfers tab, enter a valid FPL Team ID, click Load Squad, and wait for the squad table to render.

**Expected:**
- Each starting-XI player row has exactly one badge in the Rec column: "Buy Next Week", "Hold One More", "Sell Soon", "Minutes Trap", "Fixture Trap", "Hold", or "Sell" — never two simultaneously
- Badge background colour matches semantic intent (emerald/green = positive timing, orange/amber = warning trap, red = sell, zinc = neutral)
- Hovering a badge shows a tooltip string explaining the label
- All four bench rows show no badge in the Rec column
- If dark mode is toggled, all seven colours remain legible
- Expanding a row with a "Sell" or "Sell Soon" badge shows the replacement shortlist; any other label shows reasons only (no shortlist)
- Browser DevTools console shows no React errors or warnings from LifecycleLabelBadge, SquadView, or TransferPanel

**Why human:** Visual rendering correctness, colour accuracy against UI-SPEC, tooltip display, dark mode legibility, and live-data label accuracy cannot be verified programmatically. Plan 049-02 Task 3 was explicitly defined as a blocking human verification checkpoint.

### Gaps Summary

No automated gaps found. All programmatically verifiable must-haves are satisfied:
- lifecycle-label.ts engine is fully implemented, exported, and substantive (199 lines, 8 exports)
- All 29 unit tests pass
- LifecycleLabelBadge component has all 7 LABEL_MAP entries with correct Tailwind classes
- TransferPanel wiring is complete: useClubForm + clubFormMap useMemo + computeLifecycleLabels useMemo + labels prop
- SquadView is fully migrated: VerdictBadge/Verdict removed, LifecycleLabelBadge/LifecycleLabel in place, sell|sell_soon shortlist trigger active
- computeVerdicts preserved in recommend.ts for Phase 51

The only open item is the human verification checkpoint from Plan 049-02 Task 3 (live UI rendering). This is not a code gap — the implementation is complete and wired.

---

_Verified: 2026-05-01T00:25:30Z_
_Verifier: Claude (gsd-verifier)_
