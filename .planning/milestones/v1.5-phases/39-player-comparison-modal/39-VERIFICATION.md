---
phase: 39-player-comparison-modal
verified: 2026-04-29T19:14:00Z
status: human_needed
score: 5/5
overrides_applied: 0
human_verification:
  - test: "Desktop hover icon — hover a player row in Gem Ratings at a viewport ≥640px wide. The ⊞ icon should appear next to the player name only while hovering, then disappear when the cursor leaves. No layout shift should occur."
    expected: "⊞ icon visible on hover, hidden otherwise. Player name does not shift position when icon appears."
    why_human: "CSS hover state (opacity-0 group-hover/name:opacity-100) not testable in jsdom; requires real browser"
  - test: "Open modal from desktop click — click the ⊞ icon on any player row. Verify: modal opens centred, backdrop is dimmed, Player A's name appears in the left column, Player B shows 'Search for a player to compare' placeholder, search input has focus."
    expected: "Native dialog centred, dimmed backdrop, correct initial state."
    why_human: "HTMLDialogElement.showModal() not implemented in jsdom; visual layout requires browser"
  - test: "Player B search — type a partial name (e.g. 'haa'). Confirm results appear from ALL positions (not just MID/FWD). Click a result. Both player columns should populate with all four sections."
    expected: "Results include players of any position. Both columns populated immediately with xPts, Gem, Fixtures, Signals. Search list collapses."
    why_human: "No position filter is a UI contract (D-04); needs visual verification across real player data"
  - test: "Section order — with two players compared, confirm sections appear top-to-bottom: xPts Projection → Gem Scores → Next Fixtures → Signals."
    expected: "Sections in exact D-08 order."
    why_human: "CSS vertical ordering and z-index not verifiable in jsdom"
  - test: "Backdrop click closes modal — click outside the dialog (on the dimmed backdrop area). Modal should close."
    expected: "Modal closes on backdrop click."
    why_human: "Native dialog backdrop click via e.target === dialogRef.current; jsdom lacks dialog geometry"
  - test: "Escape key closes modal — reopen modal, press Escape. Modal should close."
    expected: "Modal closes via native dialog 'close' event listener."
    why_human: "Native dialog Escape key handling requires real browser"
  - test: "✕ button closes modal — reopen modal, click ✕ top-right. Modal should close."
    expected: "Modal closes, onClose fires."
    why_human: "Visual confirmation of button placement and closure state"
  - test: "Dark mode — toggle ThemeToggle while modal is open. Confirm zinc-900 background, zinc-100 text, zinc-700 borders render correctly with no light-mode bleed."
    expected: "All modal elements correctly themed in dark mode."
    why_human: "CSS dark: class variant not testable in jsdom"
  - test: "Mobile action sheet (D-02) — open Chrome DevTools, set viewport ≤640px (e.g. iPhone 14). Tap a player row. Confirm: ⊞ icon is HIDDEN, row expands with 'Compare' and ✕ buttons. Tapping Compare opens modal. Tapping ✕ dismisses without opening modal."
    expected: "Action sheet appears on mobile tap. Compare opens modal. Dismiss does not."
    why_human: "CSS sm:hidden, sm:inline classes and touch events require real mobile viewport"
  - test: "Mobile stacked layout — with modal open on mobile viewport, confirm Player A column appears ABOVE Player B column (single-column stack, not side-by-side)."
    expected: "grid-cols-1 on mobile stacks columns vertically."
    why_human: "CSS responsive grid breakpoints require browser"
  - test: "iOS zoom guard — on real iOS Safari or iOS simulator, focus the search input. Safari should NOT zoom in."
    expected: "No viewport zoom when focusing the search input (font-size: 16px inline style prevents it)."
    why_human: "iOS Safari zoom behaviour requires real device or simulator"
  - test: "Sub-tab navigation while modal open — with modal open, click another sub-tab (e.g. Insights). Confirm modal remains visible while sub-tab content changes underneath. Closing modal then shows new sub-tab content."
    expected: "Modal persists across sub-tab navigation (mounted outside activeSubTab guard)."
    why_human: "React tree structure persistence during navigation requires browser integration"
  - test: "Sort still works on Player column — click the 'Player' column header in GemTable. Sort should toggle ascending/descending and players should reorder."
    expected: "Sort works correctly (col.accessor preserved, not col.display)."
    why_human: "TanStack Table sort behavior requires real DOM rendering with full table data"
  - test: "No console errors — open DevTools console and perform all interactions above. Zero errors should appear, particularly no 'Failed to execute showModal' or 'Cannot read properties of undefined'."
    expected: "Clean console throughout all interactions."
    why_human: "Console error monitoring requires real browser execution"
---

# Phase 39: Player Comparison Modal — Verification Report

**Phase Goal:** Player comparison modal — side-by-side xPts/Gem/fixtures/signals modal triggered from GemTable rows
**Verified:** 2026-04-29T19:14:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can open a comparison modal from any GemTable row via a compare icon | VERIFIED | `createColumns(onCompare)` factory in columns.tsx (line 58) renders aria-labelled compare button in web_name cell; GemTable.tsx passes `handleCompare` via `useMemo` stability chain; page.tsx mounts `<GemTable onCompare={handleCompare} />`; columns.test.tsx 1/1 GREEN; page.test.tsx Phase 39 test GREEN |
| 2 | User can search for and select any second player from the full player list within the modal | VERIFIED | PlayerComparisonModal.tsx lines 65-71 filter `scoredPlayers` by `web_name.includes()` with no `element_type` guard (D-04 confirmed); CMP-02 test GREEN |
| 3 | Modal shows xPts 1GW/3GW/5GW and 90th-percentile ceiling for both players side by side | VERIFIED | `renderXptsSection(pA, pB)` at lines 81-122 renders shared label rows with both values; section heading "xPts Projection" present; CMP-03 test GREEN asserting 6.4, 7.1, 11.2, 12.8 values |
| 4 | Modal shows all 7 Gem score components for each player side by side | VERIFIED | `renderGemColumn(p)` at lines 124-142 renders 8 rows (Gem composite + 7 components); CMP-04 test GREEN asserting all labels and 82/88 integer scores |
| 5 | Modal shows next 5 fixtures and BUY/SELL signal, DIFF/TRAP flag, rotation risk badge for each player | VERIFIED | FixtureBadges rendered at lines 228-229; RegressionSignalBadge/DifferentialBadge/MinsRiskBadge in renderSignalsColumn (lines 144-158); CMP-05 and CMP-06 tests GREEN asserting BUR/AVL fixtures and BUY/SELL/DIFF/TRAP text |

**Score:** 5/5 truths verified (automated)

### Deferred Items

None.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/gem-table/PlayerComparisonModal.tsx` | Native dialog modal, four data sections, 200+ lines | VERIFIED | 239 lines; `'use client'` directive; native `<dialog>`; exports `PlayerComparisonModal`; all five lifecycle useEffects; no modal library |
| `src/components/gem-table/columns.tsx` | createColumns factory + fmtScore/fmtScoreNull/XPtsCell/columns exports, 200+ lines | VERIFIED | 251 lines; exports `createColumns`, `fmtScore`, `fmtScoreNull`, `XPtsCell`, `columns` (shim); backwards-compat shim present |
| `src/components/gem-table/GemTable.tsx` | onCompare prop + stability chain + mobile action sheet, 220+ lines | VERIFIED | 271 lines; `onCompare?: (player: ScoredPlayer) => void` in interface; `useCallback`/`useMemo` stability chain; `actionSheetPlayer` state; action sheet with `sm:hidden` |
| `src/app/page.tsx` | comparePlayer/compareOpen state + modal mount at page level, 150+ lines | VERIFIED | 164 lines; `comparePlayer`/`compareOpen` state; `handleCompare` in `useCallback`; modal mounted between `</main>` and `<MobileNav>` outside `activeSubTab` guard |
| `src/components/gem-table/PlayerComparisonModal.test.tsx` | 6 tests CMP-01..CMP-06, 80+ lines | VERIFIED | 246 lines; 6/6 tests GREEN; HTMLDialogElement polyfill present; vi.mock for usePlayers and computeAllGemScores |
| `src/components/gem-table/columns.test.tsx` | 1 test for createColumns compare icon, 40+ lines | VERIFIED | 44 lines; 1/1 test GREEN; asserts aria-label and onCompare callback |
| `src/app/page.test.tsx` | Phase 36 tests intact + Phase 39 modal mount test | VERIFIED | 145 lines; Phase 36 (5 tests) GREEN; Phase 39 (1 test) GREEN; PlayerComparisonModal mock present; GemTable mock exposes onCompare trigger |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/app/page.tsx` | `PlayerComparisonModal.tsx` | `import { PlayerComparisonModal }` | WIRED | Line 7: `import { PlayerComparisonModal } from '@/components/gem-table/PlayerComparisonModal'`; used at lines 150-155 |
| `src/app/page.tsx` | `GemTable.tsx` | `<GemTable onCompare={handleCompare} />` | WIRED | Line 133: `onCompare={handleCompare}` confirmed present |
| `src/components/gem-table/GemTable.tsx` | `columns.tsx` | `import { createColumns }` | WIRED | Line 19: `import { createColumns } from './columns'`; used in useMemo at line 60 |
| `src/components/gem-table/columns.tsx` | `ScoredPlayer (row.original)` | `onCompare(row.original)` | WIRED | Line 68: `onCompare(row.original)` in cell onClick handler |
| `src/components/gem-table/PlayerComparisonModal.tsx` | `columns.tsx` | `import { fmtScore, fmtScoreNull }` | WIRED | Line 12: `import { fmtScore, fmtScoreNull } from '@/components/gem-table/columns'`; used in renderGemColumn |
| `src/components/gem-table/PlayerComparisonModal.tsx` | `usePlayers.ts` | `import { usePlayers }` | WIRED | Line 5; called at line 62 with result flowing to scoredPlayers |
| `src/components/gem-table/PlayerComparisonModal.tsx` | `gem-score.ts` | `import { computeAllGemScores }` | WIRED | Line 6; called in useMemo at line 63 |
| `src/components/gem-table/PlayerComparisonModal.tsx` | `FixtureBadges.tsx` | `import { FixtureBadges }` | WIRED | Line 7; used at lines 228-229 with `fixtures.slice(0, 5)` |
| `src/components/gem-table/PlayerComparisonModal.tsx` | `RegressionSignalBadge.tsx` | `import { RegressionSignalBadge }` | WIRED | Line 10; used in renderSignalsColumn |
| `src/components/gem-table/PlayerComparisonModal.tsx` | `DifferentialBadge.tsx` | `import { DifferentialBadge }` | WIRED | Line 11; used in renderSignalsColumn |
| `src/components/gem-table/PlayerComparisonModal.tsx` | `MinsRiskBadge.tsx` | `import { MinsRiskBadge }` | WIRED | Line 8; used in renderSignalsColumn |
| `src/components/gem-table/PlayerComparisonModal.tsx` | `VarianceBadge.tsx` | `import { VarianceBadge }` | WIRED | Line 9; used in renderXptsSection |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `PlayerComparisonModal.tsx` | `scoredPlayers` | `usePlayers()` → `computeAllGemScores(data ?? [])` | Yes — same TanStack Query hook used throughout app; computeAllGemScores performs real computation over ~700 players | FLOWING |
| `PlayerComparisonModal.tsx` | `filteredPlayers` | `scoredPlayers.filter(...)` | Yes — filters real scored players by name match | FLOWING |
| `PlayerComparisonModal.tsx` | `playerA` | Prop from GemTable row (`row.original`) | Yes — real ScoredPlayer from GemTable data grid | FLOWING |
| `PlayerComparisonModal.tsx` | `playerB` | Set via `setPlayerB(p)` on search result click | Yes — real ScoredPlayer from filteredPlayers | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All Phase 39 vitest tests GREEN | `npx vitest run PlayerComparisonModal.test.tsx columns.test.tsx page.test.tsx` | 13/13 passed | PASS |
| TypeScript clean (Phase 39 files) | `npx tsc --noEmit 2>&1 \| grep error \| grep -v captain-picks` | 0 errors from Phase 39 files | PASS |
| All Phase 39 commits exist | `git log --oneline \| grep -E "4fe2f0f\|8e8803f\|..."` | All 8 commits verified | PASS |
| createColumns export present | `grep "^export function createColumns" columns.tsx` | Line 58: `export function createColumns(onCompare: ...` | PASS |
| Backwards-compat shim present | `grep "^export const columns = createColumns" columns.tsx` | Line 251: confirmed | PASS |
| Modal outside activeSubTab guard | No `activeSubTab.*PlayerComparisonModal` in page.tsx | Mounted at lines 149-155 between `</main>` and `<MobileNav>` | PASS |
| No position filter in modal search (D-04) | `grep "element_type" PlayerComparisonModal.tsx` | Exit 1 — not found | PASS |
| iOS zoom guard present | `grep "fontSize.*16px" PlayerComparisonModal.tsx` | Line 188: `style={{ fontSize: '16px' }}` | PASS |
| Double-open guards present | `grep "if (!el.open) el.showModal()\|if (el.open) el.close()" PlayerComparisonModal.tsx` | Lines 30-31: both guards present | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CMP-01 | 39-01, 39-03 | User can open comparison modal from any GemTable row via compare icon | SATISFIED | createColumns factory renders aria-labelled compare button; GemTable threads callback; page.tsx mounts modal; all automated tests GREEN |
| CMP-02 | 39-01, 39-02 | Modal lets user pick second player to compare (search full player list) | SATISFIED | PlayerComparisonModal search panel with no position filter; scoredPlayers list from usePlayers+computeAllGemScores; CMP-02 test GREEN |
| CMP-03 | 39-01, 39-02 | Modal shows xPts 1GW/3GW/5GW and 90th-percentile ceiling for both players | SATISFIED | renderXptsSection shared label grid; four rows: 1 GW, 3 GW, 5 GW, Ceiling (90th); VarianceBadge for ceiling flag; CMP-03 test GREEN |
| CMP-04 | 39-01, 39-02 | Modal shows Gem score breakdown (all 7 components) for each player | SATISFIED | renderGemColumn 8 rows (Gem + FDR + Form + xG + xA + Ownership + Minutes + Set Piece); fmtScore/fmtScoreNull conversion; CMP-04 test GREEN |
| CMP-05 | 39-01, 39-02 | Modal shows next 5 fixtures with colour-coded difficulty for each player | SATISFIED | FixtureBadges rendered with `.slice(0,5)` for both players; CMP-05 test GREEN asserting BUR/AVL |
| CMP-06 | 39-01, 39-02 | Modal shows BUY/SELL signal, DIFF/TRAP flag, and rotation risk badge for each player | SATISFIED | renderSignalsColumn renders RegressionSignalBadge, DifferentialBadge, MinsRiskBadge per player; CMP-06 test GREEN asserting BUY/SELL/DIFF/TRAP |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/gem-table/columns.test.tsx` | 5-9 | Stale comment: "Today columns.tsx exports a static columns array... this test is intentionally RED until Plan 03 ships" | Info | Misleading to readers; test is GREEN; no functional impact (IN-01 from code review) |
| `src/components/gem-table/PlayerComparisonModal.tsx` | 43-45 | No reset effect keyed on `playerA.id` — stale playerB when modal re-triggered while already open | Warning | UX bug: clicking compare on a second player while modal is open with Player B selected leaves stale Player B visible (WR-01 from code review); does not block any CMP requirement |
| `src/components/gem-table/GemTable.tsx` | 56-60, 216 | `handleCompare` wrapper unused on mobile path — mobile action sheet calls `onCompare` directly while desktop path calls `handleCompare` | Info | Inconsistent but functionally equivalent; future logic added to handleCompare would be missed by mobile (WR-03 from code review) |

### Human Verification Required

**Automated checks all pass. The following items require a browser test before Phase 39 can be marked complete. These cover CSS interactions, native dialog behavior, and mobile/device-specific behavior that jsdom cannot simulate.**

#### 1. Desktop Hover Icon

**Test:** On a desktop viewport (≥640px), hover over a player row in Gem Ratings. Observe the ⊞ icon next to the player name.
**Expected:** Icon appears on hover only, disappears when cursor leaves. No layout shift.
**Why human:** CSS `opacity-0 group-hover/name:opacity-100` requires real browser hover state.

#### 2. Modal Open State

**Test:** Click the ⊞ icon on any player row.
**Expected:** Native dialog opens centered with dimmed backdrop (rgba(0,0,0,0.5)), Player A name visible in left column, "Search for a player to compare" placeholder in right column, search input auto-focused.
**Why human:** `HTMLDialogElement.showModal()` not implemented in jsdom; visual centering and backdrop require browser.

#### 3. Player B Search — No Position Filter (D-04)

**Test:** Type a partial name. Confirm results include players of all positions (GK, DEF, MID, FWD).
**Expected:** All positions represented in results; no position filter applied.
**Why human:** Real player dataset verification; position variety only visible with production data.

#### 4. Section Order (D-08)

**Test:** With two players compared, confirm sections appear top-to-bottom: xPts Projection → Gem Scores → Next Fixtures → Signals.
**Expected:** Exact order per D-08.
**Why human:** Visual layout order requires browser rendering.

#### 5. Backdrop Click Closes Modal

**Test:** Click outside the dialog area (on the dimmed backdrop). Modal should close.
**Expected:** Modal closes; onClose fires; compareOpen becomes false.
**Why human:** `e.target === dialogRef.current` geometry requires real browser.

#### 6. Escape Key Closes Modal

**Test:** With modal open, press Escape.
**Expected:** Modal closes via native dialog `close` event.
**Why human:** Native dialog Escape handling requires real browser.

#### 7. ✕ Button Closes Modal

**Test:** Click the ✕ button in the modal header.
**Expected:** Modal closes immediately.
**Why human:** Visual confirmation of button position and closure.

#### 8. Dark Mode

**Test:** Toggle ThemeToggle with modal open.
**Expected:** Modal renders with zinc-900 background, zinc-100 text, zinc-700 borders. No light-mode element visible.
**Why human:** CSS `dark:` variants require browser with prefers-color-scheme or class toggle.

#### 9. Mobile Action Sheet (D-02)

**Test:** In Chrome DevTools, set viewport ≤640px (iPhone 14 or similar). Tap a player row.
**Expected:** ⊞ icon is hidden (`hidden sm:inline`). Row expands and shows "Compare" + ✕ buttons. Tapping Compare opens the modal. Tapping ✕ dismisses the sheet without opening the modal.
**Why human:** `sm:inline`/`sm:hidden` CSS breakpoints and touch events require real mobile viewport.

#### 10. Mobile Stacked Layout (D-06)

**Test:** With modal open on mobile viewport, observe the section layout.
**Expected:** Player A column appears ABOVE Player B column (single-column stack via `grid-cols-1`), not side-by-side.
**Why human:** CSS responsive grid breakpoints require browser.

#### 11. iOS Zoom Guard (Pitfall 5)

**Test:** On iOS Safari (real device or simulator), focus the search input inside the modal.
**Expected:** Safari does NOT zoom the viewport. The `style={{ fontSize: '16px' }}` inline style prevents iOS auto-zoom.
**Why human:** iOS Safari auto-zoom behavior requires real iOS device or Xcode simulator.

#### 12. Sub-tab Navigation While Modal Open

**Test:** With the modal open, click another sub-tab (e.g. Insights). Observe whether the modal stays visible.
**Expected:** Modal remains visible during sub-tab navigation (it is mounted outside the `activeSubTab === 'gems'` guard). Closing the modal then shows the new sub-tab content.
**Why human:** React tree persistence during navigation requires browser integration.

#### 13. Player Column Sort Preservation (Pitfall 1)

**Test:** Click the "Player" column header in GemTable.
**Expected:** Sort toggles ascending/descending and players reorder alphabetically. The column remains a `col.accessor` (not `col.display`), so TanStack Table's auto-sort works.
**Why human:** TanStack Table sort with full ~700-player dataset requires real browser.

#### 14. No Console Errors

**Test:** Open DevTools console. Perform all interactions above.
**Expected:** Zero console errors. No "Failed to execute 'showModal' on 'HTMLDialogElement'", no "Cannot read properties of undefined", no React hydration warnings.
**Why human:** Console error monitoring requires real browser execution.

### Known Quality Issues (Not Blockers)

The code review (39-REVIEW.md, committed 8336b06) identified three warnings not yet fixed:

- **WR-01** (Warning): Stale modal state when re-triggered while already open — `playerB` is not reset when `playerA.id` changes. Fix: add `useEffect(() => { setSearch(''); setPlayerB(null) }, [playerA.id])` to `PlayerComparisonModal.tsx`. Does not block any CMP requirement.
- **WR-02** (Warning): Pre-existing NaN guard bug in `XPtsCell` in `columns.tsx` — `NaN <= 0` evaluates to `false` so NaN passes through. Pre-dates Phase 39 (present since Phase 28). Does not block CMP requirements.
- **WR-03** (Warning): `handleCompare` wrapper in `GemTable.tsx` is called on desktop path but mobile action sheet bypasses it and calls `onCompare` directly — inconsistent code paths. Functionally equivalent today. Does not block CMP requirements.

These should be addressed in a follow-up fix before the next phase that touches these files.

---

_Verified: 2026-04-29T19:14:00Z_
_Verifier: Claude (gsd-verifier)_
