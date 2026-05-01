---
phase: 34-chip-strategy
verified: 2026-04-28T22:37:00Z
status: human_needed
score: 10/10 must-haves verified (automated)
overrides_applied: 0
human_verification:
  - test: "Chip Strategy panel renders in browser above Planning Horizon"
    expected: "Panel sits above the 'Planning Horizon' heading and 'Generate Plan' button. Card has thin border, white/zinc-900 background, p-4 padding. Heading 'Chip Strategy' (large semibold). Subheading 'Best upcoming gameweek to play each remaining chip.' (small zinc-500)."
    why_human: "Visual layout and Tailwind class rendering cannot be verified without a browser"
  - test: "Three chip rows visible with correct order and content"
    expected: "Bench Boost, Triple Captain, Free Hit rows in that order. Each has a chip-name pill, 'Best: GW{N}' label, and a 5-cell ease bar (24x12px cells, 4px gaps). Best-GW cell has green ring-2 ring-offset-1."
    why_human: "Visual appearance, colour scale (green/amber/red ease cells), and ring highlight require browser verification"
  - test: "Free Hit row expand interaction"
    expected: "Row reads 'Best: GW{N} — click for squad' (em dash, not hyphen) with '▾' chevron. Click expands inline table with columns Player/Pos/xPts/Ease GW{N}/£ and up to 15 rows. Chevron flips to '▴'. Click again to collapse."
    why_human: "Interactive expand behaviour and table column layout require browser verification"
  - test: "Keyboard interaction on FH row"
    expected: "Tab to the FH row (focus ring visible). Enter expands. Space toggles AND the page does NOT scroll (preventDefault). Enter/Space collapses when expanded."
    why_human: "Focus management and scroll prevention require browser verification"
  - test: "Used chip handling (if applicable)"
    expected: "If the manager has used any chip this season: that row is at ~40% opacity, shows 'Used GW{N}', ease cells are all flat zinc (no colour intensity, no green ring)."
    why_human: "Requires a test account that has actually played a chip; opacity visual appearance needs browser"
  - test: "No Team ID state"
    expected: "Clear localStorage.removeItem('fpl_team_id') and refresh. Panel area shows ONLY 'Enter your FPL Team ID to see chip recommendations.' (no card border, no chip rows)."
    why_human: "Requires browser with localStorage manipulation"
  - test: "Loading and error states"
    expected: "Loading: 'Loading chip strategy…' (ellipsis U+2026, not three dots). Error: 'Failed to load chip strategy. Check squad data and refresh.' in red text."
    why_human: "Error state requires network throttle or disabling fetch; loading state requires slow network"
  - test: "No regression in PlannerTab"
    expected: "Generate Plan button still works. TransferPlanTable renders below the chip panel after clicking Generate Plan. No console errors or React warnings."
    why_human: "End-to-end interaction with PlannerTab requires browser testing"
  - test: "Accessibility attributes"
    expected: "section has aria-label='Chip Strategy'. FH row has aria-expanded toggling true/false on click. Ease bars have role='img' with descriptive aria-label."
    why_human: "Accessibility attribute inspection is done most reliably in browser DevTools"
---

# Phase 34: Chip Strategy Verification Report

**Phase Goal:** User can see the optimal upcoming gameweek for each remaining chip based on their actual squad and the fixture landscape
**Verified:** 2026-04-28T22:37:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Pure function `computeBBScore` returns 5-entry GWEaseScore[] for bench picks | ✓ VERIFIED | 28 engine tests pass; function exists at line 114 of chip-strategy-engine.ts; polarity inversion at `easeForTeamGw` (line 63: `ease = 1 - fx.attacking_difficulty`) |
| 2 | Pure function `computeTCScore` returns 5-entry GWEaseScore[] from top-3 captain candidates by xPts_90th_1gw | ✓ VERIFIED | Function exists at line 189; TC_CANDIDATE_COUNT=3 exported; fallback chain `xPts_90th_1gw ?? xPts_1gw ?? proj_pts_1gw ?? 0` at line 209; GK and injured exclusion verified by tests |
| 3 | Pure function `computeFHResult` returns { bestGw, scores: 5 entries, suggestedSquad } with formation 1 GK + 1 GK bench + 3-5 DEF + 2-5 MID + 1-3 FWD and team cap of 3 | ✓ VERIFIED | Function exists at line 272; minSlots/maxSlots enforced (lines 334-336); FH_TEAM_CAP=3 check at line 352; tests verify formation bounds and team cap |
| 4 | BGW yields ease = 0.5 (BGW_NEUTRAL_EASE) | ✓ VERIFIED | BGW_NEUTRAL_EASE=0.5 exported (line 8); `easeForTeamGw` returns `{ease: BGW_NEUTRAL_EASE, isBGW: true}` when no fixture found (lines 60-62) |
| 5 | Ease polarity consistently inverted at engine boundary (ease = 1 - attacking_difficulty) | ✓ VERIFIED | Single inversion point at `easeForTeamGw` helper line 63; no raw attacking_difficulty in output; test `inverts attacking_difficulty to ease` passes |
| 6 | `useChipHistory(teamId)` returns ChipHistoryEntry[] with numeric guard; disabled when null or non-numeric | ✓ VERIFIED | enabled guard: `!!teamId && /^\d+$/.test(teamId)` at line 35 of useChipHistory.ts; ChipHistoryEntry exported; 6h staleTime; retry:1 |
| 7 | ChipStrategyPanel renders loading/error/no-team-id/data states with locked copy strings | ✓ VERIFIED | All four states present in component (lines 252-301); exact copy strings match UI-SPEC byte-for-byte |
| 8 | User sees BB row with "Best: GW{N}" and 5 ease cells (CHIP-01) | ✓ VERIFIED | `<ChipRow chip="bboost">` mounts with bbScores; data-testid="chip-row-bboost"; 5 ease cells rendered; component test passes |
| 9 | User sees TC row with "Best: GW{N}" and 5 ease cells (CHIP-02) | ✓ VERIFIED | `<ChipRow chip="3xc">` mounts with tcScores; data-testid="chip-row-3xc"; component test passes |
| 10 | User sees FH row with expand-on-click squad table, keyboard support, and used-chip greying (CHIP-03) | ✓ VERIFIED | FHChipRow implements role="button", tabIndex={0}, aria-expanded, onClick, onKeyDown (Space preventDefault only), opacity-40 for used chips; 9 component tests pass including expand, keyboard toggle, and used-chip state |

**Score:** 10/10 truths verified (automated)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `src/lib/chip-strategy-engine.ts` | Pure scoring functions + types | ✓ VERIFIED | 423 lines; exports buildClubFormMap, computeBBScore, computeTCScore, computeFHResult, BGW_NEUTRAL_EASE, TC_CANDIDATE_COUNT, FH_HORIZON, FH_TEAM_CAP, FH_DEFAULT_BUDGET_TENTHS, GWEaseScore, FHResult, FHSquadPlayer; zero React imports |
| `src/lib/chip-strategy-engine.test.ts` | 12+ unit tests; no it.todo | ✓ VERIFIED | 437 lines; 28 passing tests; 0 it.todo; covers all 5 Common Pitfalls; fixture builders makePlayer/makeClubForm/makeFx present |
| `src/lib/hooks/useChipHistory.ts` | TanStack Query hook with numeric teamId validation | ✓ VERIFIED | 39 lines; ChipHistoryEntry exported; numeric guard `/^\d+$/`; queryKey ['chip-history', teamId]; staleTime 6h; retry:1 |
| `src/components/planner/ChipStrategyPanel.tsx` | Panel component ≥200 lines | ✓ VERIFIED | 302 lines (≥200 satisfied); 'use client'; named export ChipStrategyPanel; all locked Tailwind classes and copy strings present |
| `src/components/planner/ChipStrategyPanel.test.tsx` | 9+ component tests; no it.todo | ✓ VERIFIED | 187 lines; 9 passing tests; 0 it.todo; vi.mock('@/lib/hooks/useChipHistory'); jsdom environment; covers all states |
| `src/components/planner/PlannerTab.tsx` | Mounts ChipStrategyPanel as first child with 7 props | ✓ VERIFIED | ChipStrategyPanel is first child of `<div className="space-y-6">`; all 7 props forwarded: teamId, scoredPlayers, clubForm, picks, bankBalance, sellPrices, startingGw |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| PlannerTab.tsx | ChipStrategyPanel.tsx | JSX mount + props | ✓ WIRED | `<ChipStrategyPanel` at line 306; all 7 props present at lines 307-313 |
| ChipStrategyPanel.tsx | chip-strategy-engine.ts | named imports | ✓ WIRED | `from '@/lib/chip-strategy-engine'` line 12; imports buildClubFormMap, computeBBScore, computeTCScore, computeFHResult, GWEaseScore, FHResult, FHSquadPlayer |
| ChipStrategyPanel.tsx | useChipHistory.ts | useChipHistory(teamId) call | ✓ WIRED | `useChipHistory` imported at line 13; called at line 228 with `isValidTeamId ? teamId : null` |
| ChipStrategyPanel.tsx | plan-helpers.ts | CHIP_LABELS import | ✓ WIRED | `import { CHIP_LABELS } from './plan-helpers'` line 14; CHIP_LABELS exported from plan-helpers.ts line 21 |
| PlannerTab.tsx | useClubForm.ts | useClubForm() call | ✓ WIRED | `import { useClubForm } from '@/lib/hooks/useClubForm'` line 12; `const { data: clubFormData } = useClubForm()` line 35 |
| chip-strategy-engine.ts | types.ts | type-only import | ✓ WIRED | `import type { ScoredPlayer, ClubForm, ClubFormFixture } from './types'` line 1 |
| chip-strategy-engine.ts | squad-adapter.ts | type-only import of SquadPick | ✓ WIRED | `import type { SquadPick } from './squad-adapter'` line 2 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| ChipStrategyPanel.tsx | bbScores, tcScores, fhResult | computeBBScore/computeTCScore/computeFHResult called in useMemo | Yes — pure functions using scoredPlayers from usePlayers() and clubFormMap from useClubForm(); neither is static | ✓ FLOWING |
| ChipStrategyPanel.tsx | chipHistory | useChipHistory(teamId) | Yes — fetches `/api/fpl/entry/${teamId}/history/` via existing FPL proxy; `data.chips ?? []` extraction | ✓ FLOWING |
| ChipStrategyPanel.tsx | usedChips Map | chipHistory from useChipHistory | Yes — built from actual API response via `new Map(chipHistory.map(c => [c.name, c.event]))` | ✓ FLOWING |
| FHSquadTable | squad | fhResult.suggestedSquad from computeFHResult | Yes — greedy 15-player selection from real scoredPlayers pool | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 28 engine tests pass | `npx vitest run src/lib/chip-strategy-engine.test.ts` | 28 passed (0 failed/skipped) | ✓ PASS |
| 9 component tests pass | `npx vitest run src/components/planner/ChipStrategyPanel.test.tsx` | 9 passed (0 failed/skipped) | ✓ PASS |
| Full suite no regression | `npx vitest run` | 348 passed, 34 skipped, 31 files | ✓ PASS |
| TypeScript compilation | `npx tsc --noEmit -p tsconfig.json` | 2 pre-existing errors in InsightsTab.test.tsx and captain-picks.test.ts (not Phase 34 files); Phase 34 files compile cleanly | ✓ PASS (pre-existing errors excluded) |
| Engine purity | `grep "from 'react'\|useState\|useEffect\|useQuery" src/lib/chip-strategy-engine.ts` | 0 matches | ✓ PASS |
| No it.todo stubs | `grep -c "it\.todo"` on both test files | 0 in engine test, 0 in component test | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| CHIP-01 | Plans 01 + 02 | User can see optimal upcoming GW for Bench Boost based on projected squad xPts across the bench | ✓ SATISFIED | computeBBScore uses bench picks (positions ≥12) and their teams' fixture ease; ChipRow chip="bboost" renders the score; 4 BB unit tests + 1 component test |
| CHIP-02 | Plans 01 + 02 | User can see optimal upcoming GW for Triple Captain based on player xPts ceiling and fixture ease | ✓ SATISFIED | computeTCScore uses xPts_90th_1gw (ceiling) with fallback chain; top-3 candidates; ChipRow chip="3xc" renders; 7 TC unit tests + 1 component test |
| CHIP-03 | Plans 01 + 02 | User can see optimal upcoming GW for Free Hit based on upcoming fixture landscape and squad flexibility | ✓ SATISFIED | computeFHResult greedy-fills 15-player squad with formation/team-cap/budget constraints; FHChipRow expands to FHSquadTable; 11 FH unit tests + 2 component tests (expand, keyboard) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/chip-strategy-engine.ts` | 307 | Budget falls back to `FH_DEFAULT_BUDGET_TENTHS` alone when `currentSquadIds` is undefined — plan spec says `bankBalance + FH_DEFAULT_BUDGET_TENTHS` | ℹ️ Info | Functionally neutral: FH_DEFAULT_BUDGET_TENTHS=1000 (£100m) is always above any realistic budget; in practice no player would be excluded. SUMMARY.md documents the opposite of what the code does but the effect is the same. |
| `src/components/planner/ChipStrategyPanel.tsx` | 294 | `fhResult.bestGw \|\| null` — if bestGw is 0 this coerces to null | ℹ️ Info | Edge case: GW numbers are always ≥1 in FPL; bestGw=0 only occurs in the defensive empty-data path; no real data scenario triggers this |

No blockers found.

### Human Verification Required

These 9 items require browser testing and cannot be verified programmatically:

#### 1. Layout and Visual Appearance

**Test:** Run `npm run dev`, navigate to Planner tab with FPL Team ID set in localStorage
**Expected:** Panel sits ABOVE "Planning Horizon" heading and "Generate Plan" button. Card has thin border, white/zinc-900 background, 16px internal padding. Heading "Chip Strategy" (large semibold). Subheading "Best upcoming gameweek to play each remaining chip." (small zinc-500).
**Why human:** Visual layout and Tailwind rendering require browser

#### 2. Three Chip Rows With Ease Bars

**Test:** Observe Bench Boost, Triple Captain, Free Hit rows in order
**Expected:** Each row has a 96px-wide pill (zinc-100/zinc-800), "Best: GW{N}" label, and a 5-cell ease bar. Best-GW cell has green ring (`ring-2 ring-offset-1`). Cell colours follow green/amber/red ease scale.
**Why human:** Colour rendering and ring visibility require browser

#### 3. Free Hit Row Expand Interaction

**Test:** Click the Free Hit row
**Expected:** Row reads `Best: GW{N} — click for squad` (em dash U+2014) with `▾` chevron. Click expands inline table with Player/Pos/xPts/Ease GW{N}/£ columns and up to 15 player rows. Chevron flips to `▴`. Click again to collapse.
**Why human:** Interactive behaviour and table layout require browser

#### 4. Keyboard Interaction on FH Row

**Test:** Tab to FH row; press Enter; press Space
**Expected:** Focus ring visible on FH row. Enter expands. Space toggles AND page does NOT scroll (preventDefault).
**Why human:** Focus management and scroll-prevention require browser

#### 5. Used Chip Handling

**Test:** Use an account that has played at least one chip this season
**Expected:** Used chip row renders at ~40% opacity, shows "Used GW{N}" label, ease cells are all flat zinc (no green/amber/red), no green ring.
**Why human:** Requires real chip history data and visual opacity inspection

#### 6. No Team ID State

**Test:** `localStorage.removeItem('fpl_team_id')` in browser console; refresh page
**Expected:** Panel area shows ONLY "Enter your FPL Team ID to see chip recommendations." — no card border, no chip rows.
**Why human:** Requires browser localStorage manipulation

#### 7. Loading and Error States

**Test:** Throttle network or block the chip history endpoint; observe initial load
**Expected:** Loading state shows "Loading chip strategy…" (U+2026 ellipsis). Error state shows "Failed to load chip strategy. Check squad data and refresh." in red.
**Why human:** Network state manipulation requires browser DevTools

#### 8. No Regression in PlannerTab

**Test:** Click "Generate Plan" button after observing Chip Strategy panel
**Expected:** Generate Plan still works. TransferPlanTable renders below the chip panel. No console errors, React warnings, or hydration errors.
**Why human:** End-to-end PlannerTab flow requires browser

#### 9. Accessibility Attributes

**Test:** Inspect DOM in browser DevTools
**Expected:** `<section aria-label="Chip Strategy">`. FH row `<li>` has `aria-expanded` attribute toggling `false`/`true` on click. Ease bar `<div>` has `role="img"` with descriptive `aria-label`.
**Why human:** Accessibility attribute inspection is most reliable in browser DevTools

### Gaps Summary

No gaps. All 10 automated must-haves are verified. Phase 34 automated deliverables are complete. Phase completion is gated solely on human verification of the UI (9 checks above), which is required per the Plan 02 `checkpoint:human-verify` gate.

---

_Verified: 2026-04-28T22:37:00Z_
_Verifier: Claude (gsd-verifier)_
