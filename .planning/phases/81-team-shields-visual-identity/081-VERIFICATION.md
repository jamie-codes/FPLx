---
phase: 81-team-shields-visual-identity
verified: 2026-05-08T15:30:00Z
status: human_needed
score: 8/8 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open the Set Piece Takers panel in the browser with a known team (e.g. ARS). Inspect the team card."
    expected: "A faint club crest image is visible at the bottom-right of each team card, behind the taker text. The crest does not obscure player names or role labels."
    why_human: "Visual opacity rendering (opacity-10 ghost) and layout cannot be confirmed by automated test — requires visual inspection to confirm the crest is subtle but present."
  - test: "Open the Fixture Heat Map tab. Inspect each row header in the tbody."
    expected: "Each team row header shows a small (~20px) club crest image to the left of the 3-character team abbreviation. For unknown teams or CDN failures, a coloured circle with the team initial appears instead."
    why_human: "Visual sizing, alignment, and fallback rendering require browser inspection. The test verifies DOM structure but not visual quality."
  - test: "Navigate to the Squad/LineupTab view. Load a squad. Observe a player card for any team."
    expected: "The kit image appears in the player card alongside player name. On CDN failure, a coloured square swatch renders. The fallback shape is square (not a circle)."
    why_human: "The squad view integration uses teamKitUrl (not badgeUrl) as the img src — this is an intentional architectural constraint (UI-SPEC §5) that cannot be confirmed correct by tests alone. Visual confirmation is needed."
---

# Phase 81: Team Shields & Visual Identity — Verification Report

**Phase Goal:** Club crests appear as visual anchors throughout the app — Set Piece taker boxes, Fixture Heat Map row headers, and other team-identity surfaces — making the UI feel like a real FPL product and letting users identify teams at a glance without reading abbreviations
**Verified:** 2026-05-08T15:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | useTeamBadge('ARS') returns a non-null src pointing to the PL CDN badge URL | VERIFIED | `src/lib/hooks/useTeamBadge.ts` line 23: `teamBadgeUrl(code)` when code defined; vitest 5/5 pass including ARS → t3.png assertion |
| 2 | useTeamBadge('XYZ') returns src=null and showFallback=true | VERIFIED | Test case 2 in `useTeamBadge.test.ts` asserts `src.toBeNull()` and `showFallback.toBe(true)` — passes |
| 3 | Calling onError() on a valid hook result flips showFallback to true | VERIFIED | Test case 3 uses `act(() => result.current.onError())` and asserts `showFallback.toBe(true)` — passes |
| 4 | fallbackColour matches getTeamColour(shortName).primary for every known team | VERIFIED | Hook line 28: `fallbackColour: getTeamColour(shortName).primary`; MCI test asserts `#6CABDD` — passes |
| 5 | initial is the first character of the shortName argument | VERIFIED | Hook line 29: `initial: shortName[0] ?? '?'`; LIV test asserts `'L'` — passes |
| 6 | Each team card in SetPieceTakerPanel shows a ghost crest (opacity-10, absolute bottom-right) when the team code is known | VERIFIED | `SetPieceTakerPanel.tsx` lines 38–46: `{!showFallback && src && <img className="absolute bottom-0 right-0 w-14 h-14 opacity-10 pointer-events-none ..."`; 3/3 SHD-01 tests pass |
| 7 | Each row header in FixtureHeatMap has class w-20 (not w-16); contains crest img or fallback swatch adjacent to team abbreviation | VERIFIED | `FixtureHeatMap.tsx` lines 131 and 228: both `<th>` elements carry `w-20`; no `w-16` found; HeatMapRow renders `<img>` (known) or `rounded-full <span>` (fallback); 23/23 tests pass including 3 SHD-02 tests |
| 8 | LineupTab no longer uses inline useState(false) for kit-error state; uses onError from useTeamBadge; teamKitUrl preserved as img src | VERIFIED | `LineupTab.tsx` line 45: `const { onError, showFallback, fallbackColour } = useTeamBadge(...)` at component top; line 88: `src={teamKitUrl(teamCode)}` (hook src NOT used); grep for `kitError` returns zero matches |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/hooks/useTeamBadge.ts` | Single source of truth for crest URL, error state, fallback | VERIFIED | Exists, substantive (31 lines), exports `useTeamBadge`, direct `TEAM_BADGE_CODE[shortName]` lookup, `'use client'` on line 1 |
| `src/lib/hooks/useTeamBadge.test.ts` | Unit test suite — 5 cases (SHD-03 hook contract) | VERIFIED | Exists, substantive, `describe('useTeamBadge', ...)` with 5 tests; all pass |
| `src/components/set-pieces/SetPieceTakerPanel.tsx` | Ghost watermark crest per team card; SetPieceTakerCard sub-component | VERIFIED | `SetPieceTakerCard` function at line 28; `useTeamBadge` at line 35; `relative overflow-hidden` at line 37; `opacity-10 pointer-events-none` at line 44; `aria-hidden="true"` at line 43 |
| `src/components/set-pieces/SetPieceTakerPanel.test.tsx` | Integration tests for SHD-01 ghost watermark | VERIFIED | 3 tests under `describe('SetPieceTakerPanel — SHD-01 ghost watermark')`; all 3 pass |
| `src/components/club-form/FixtureHeatMap.tsx` | Widened row header with crest + abbrev flex row; HeatMapRow sub-component | VERIFIED | `HeatMapRow` closure at line 123; `useTeamBadge` at line 124; `w-20` appears 2 times; `w-16` — 0 matches; `rounded-full` fallback swatch present |
| `src/components/club-form/FixtureHeatMap.test.tsx` | Extended with 3 new SHD-02 tests | VERIFIED | `SHD-02` string appears 4 times; 3 new tests present; 23/23 pass |
| `src/components/squad/LineupTab.tsx` | Kit-error state replaced by useTeamBadge (state only) | VERIFIED | `useTeamBadge` at lines 11 (import) and 45 (call); `kitError` — 0 matches; `teamKitUrl` at line 88 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `useTeamBadge.ts` | `src/lib/fpl-images.ts` | `teamBadgeUrl(code)` | WIRED | Line 9 import; line 23 call `teamBadgeUrl(code)` |
| `useTeamBadge.ts` | `src/lib/team-colours.ts` | `TEAM_BADGE_CODE[shortName]` + `getTeamColour(shortName)` | WIRED | Line 10 import; lines 22–28 use both |
| `SetPieceTakerPanel.tsx` | `useTeamBadge.ts` | `useTeamBadge(team.team_short_name)` in SetPieceTakerCard | WIRED | Line 9 import; line 35 destructure call |
| `SetPieceTakerCard` | ghost `<img>` | `!showFallback && src` conditional render | WIRED | Lines 38–46: conditional with `showFallback` guard |
| `FixtureHeatMap.tsx` | `useTeamBadge.ts` | `useTeamBadge(t.team_short_name)` in HeatMapRow | WIRED | Line 7 import; line 124 destructure call |
| `HeatMapRow` | `<th scope="row">` | `w-20` flex row with conditional img/span | WIRED | Lines 131–153: `w-20 h-8` th containing flex span with img or fallback |
| `LineupTab.tsx (PlayerCard)` | `useTeamBadge.ts` | `const { onError, showFallback, fallbackColour } = useTeamBadge(...)` | WIRED | Lines 11 (import), 45 (call); `onError` used at line 94 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `SetPieceTakerPanel.tsx` | `src`, `showFallback` | `TEAM_BADGE_CODE` static map + `teamBadgeUrl()` pure function | Yes — static compile-time badge code map; URL constructed deterministically | FLOWING |
| `FixtureHeatMap.tsx` (HeatMapRow) | `src`, `showFallback`, `fallbackColour`, `initial` | `TEAM_BADGE_CODE` + `teamBadgeUrl()` + `getTeamColour()` | Yes — all static compile-time data | FLOWING |
| `LineupTab.tsx` (PlayerCard) | `onError`, `showFallback`, `fallbackColour` | `useTeamBadge` (state only); img src from `teamKitUrl(teamCode)` | Yes — state management only; kit URL from static map | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| useTeamBadge hook — 5 unit tests | `npx vitest run src/lib/hooks/useTeamBadge.test.ts` | 5/5 passed | PASS |
| SetPieceTakerPanel SHD-01 — 3 integration tests | `npx vitest run src/components/set-pieces/SetPieceTakerPanel.test.tsx` | 3/3 passed | PASS |
| FixtureHeatMap SHD-02 — 21+2 tests (23 total) | `npx vitest run src/components/club-form/FixtureHeatMap.test.tsx` | 23/23 passed | PASS |
| No w-16 remains in FixtureHeatMap.tsx | `grep -n "w-16" FixtureHeatMap.tsx` | 0 matches | PASS |
| w-20 appears at least 2 times in FixtureHeatMap.tsx | `grep -c "w-20" FixtureHeatMap.tsx` | 2 | PASS |
| kitError removed from LineupTab.tsx | `grep "kitError" LineupTab.tsx` | 0 matches | PASS |
| teamKitUrl preserved in LineupTab.tsx | `grep "teamKitUrl" LineupTab.tsx` | 1 match (line 88) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SHD-01 | 081-02-PLAN.md | Set Piece taker box shows team crest as low-opacity background element | SATISFIED | `SetPieceTakerPanel.tsx`: `opacity-10` ghost `<img>` rendered per card when team code known; suppressed on fallback; 3/3 SHD-01 tests pass |
| SHD-02 | 081-03-PLAN.md | Fixture Heat Map row headers display club crest (~24px) alongside team abbreviation | SATISFIED | `FixtureHeatMap.tsx`: HeatMapRow renders 20px crest img or rounded-full fallback in `<th scope="row">` flex row; `w-20` on both header and data row `<th>`; 3/3 SHD-02 tests pass |
| SHD-03 | 081-01-PLAN.md + 081-04-PLAN.md | Shared `useTeamBadge` hook as single source of truth; graceful fallback to coloured initial-letter swatch | SATISFIED | `src/lib/hooks/useTeamBadge.ts` exports `useTeamBadge`; imported by FixtureHeatMap, SetPieceTakerPanel, and LineupTab (3 placement sites); fallback via `showFallback` + `fallbackColour` + `initial`; 5/5 unit tests pass |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/squad/LineupTab.tsx` | 253 | Pre-existing `react-hooks/set-state-in-effect` lint error in `useEffect` | INFO | Out-of-scope; present on baseline commit `68d697a` prior to Phase 81; not introduced by this phase |

No stubs, placeholders, empty returns, or disconnected data flows found in Phase 81 files.

### Human Verification Required

The automated gate passes on all structural and behavioral checks. The following items require visual inspection in a running browser:

#### 1. Ghost Crest Visual Quality in Set Piece Panel

**Test:** Open the app to the Set Piece Takers tab with data loaded. View any team card for a known PL team.
**Expected:** A faint ghost crest is visible at the bottom-right corner of each team card, behind the taker text. The opacity is low enough that text remains clearly readable. On hover or zoom, the crest shape is discernible. An unknown team's card has no ghost element (neither image nor coloured swatch).
**Why human:** The `opacity-10` rendering effect and visual legibility cannot be confirmed by DOM attribute checks alone.

#### 2. Fixture Heat Map Row Header Crest Alignment

**Test:** Open the Fixture Heat Map tab (Club Form section). Inspect the row headers in the team grid.
**Expected:** Each row header shows a small (~20px) club crest image left-aligned with the 3-character abbreviation. The crest and text are vertically centred. For unknown teams or CDN load failures, a coloured circle with the team initial appears in place of the crest. Row width appears consistent with the w-20 column.
**Why human:** Visual alignment, spacing, and crest rendering quality require browser visual confirmation.

#### 3. LineupTab Kit Image Continuity

**Test:** Navigate to the Squad tab, load a squad. Observe player cards on the pitch view.
**Expected:** Player cards show the kit image (shirt art) alongside player name and stats. The kit image is square (not round), and the fallback on image error is a coloured square swatch (not a circle). Behaviour is identical to pre-Phase 81 baseline.
**Why human:** The architectural constraint (teamKitUrl used as src, not hook's badge URL) and preserved square fallback shape require visual inspection to confirm no unintended change to the squad view's appearance.

### Gaps Summary

No automated gaps detected. All 8 must-have truths are VERIFIED by codebase evidence and passing tests. Three human verification items remain for visual quality confirmation — these cannot fail the automated gate since they concern rendering fidelity, not structural correctness.

---

_Verified: 2026-05-08T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
