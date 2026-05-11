---
phase: 95-set-piece-delivery-league-table
verified: 2026-05-11T12:40:00Z
status: human_needed
score: 7/7 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Load the Set Pieces tab in the browser"
    expected: "Takers / League Table segmented pill appears between subtitle and content, visible on mobile without horizontal scrolling"
    why_human: "CSS flex layout and mobile viewport behaviour cannot be verified from static code analysis alone"
  - test: "Click 'League Table' pill"
    expected: "Ranked table renders with team crest, team short name, Score (per-100 format e.g. '8.4'), Corner, FK columns; SetPieceChangeAlert is hidden"
    why_human: "Visual rendering, crest fallback colour, column visibility at breakpoints, and alert gating all require a live browser session"
  - test: "Click 'Takers' pill"
    expected: "Card grid returns with SetPieceChangeAlert visible (if changes exist)"
    why_human: "Stateful UI toggle round-trip requires interactive testing"
  - test: "Navigate away from Set Pieces tab and back"
    expected: "Default view is 'Takers' — component-local state has reset (D-09)"
    why_human: "Session-scoped state reset cannot be observed in static analysis"
  - test: "Inspect a team row with one null score (e.g. only corner or only FK data)"
    expected: "Null-score column shows em-dash '—'; composite shows the single available score formatted as per-100"
    why_human: "Requires real sp_quality.json data from the pipeline to exist for a team with missing data"
---

# Phase 95: Set-Piece Delivery League Table Verification Report

**Phase Goal:** Deliver SPQ-04 — all 20 PL teams ranked by composite set-piece delivery quality, browseable via a toggle within the existing Set Pieces tab.
**Verified:** 2026-05-11T12:40:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                      | Status     | Evidence                                                                                                |
|----|------------------------------------------------------------------------------------------------------------|------------|---------------------------------------------------------------------------------------------------------|
| 1  | All 8 unit tests for setPieceLeague pass GREEN                                                             | VERIFIED   | `npx vitest run src/lib/setPieceLeague.test.ts` → Tests 8 passed (8), 0 failed                         |
| 2  | All 5 component tests for SetPieceLeagueTable pass GREEN                                                   | VERIFIED   | `npx vitest run src/components/set-pieces/SetPieceLeagueTable.test.tsx` → Tests 5 passed (5), 0 failed  |
| 3  | SetPieceTakerPanel renders a Takers / League Table segmented pill visible on mobile                        | VERIFIED   | `SetPieceViewToggle` wrapper class is `flex` (not `hidden sm:flex`); rendered unconditionally at line 134 of SetPieceTakerPanel.tsx |
| 4  | Clicking League Table shows the ranked table; SetPieceChangeAlert is hidden                                | VERIFIED   | Line 157: `{view === 'takers' && <SetPieceChangeAlert ...>}`; line 169: `<SetPieceLeagueTable changes={data} />` in else branch |
| 5  | Clicking Takers restores the card grid with SetPieceChangeAlert visible                                    | VERIFIED   | Line 157–168: `view === 'takers'` ternary renders card grid + alert in takers mode; defaults to `'takers'` |
| 6  | Teams with both scores null appear in Insufficient Data section, not in ranked table                       | VERIFIED   | `aggregateSetPieceLeague`: composite===null rows go to `insufficient[]`; component renders `<section>` with heading "Insufficient Data" only when `insufficient.length > 0` |
| 7  | Score values display as per-100 (e.g. raw 0.084 → '8.4'), null columns show '—'                           | VERIFIED   | `formatScore`: `(raw * 100).toFixed(1)` for non-null; `return '—'` for null/undefined. Component calls `formatScore(row.composite)`, `formatScore(row.corner_score)`, `formatScore(row.fk_score)` in JSX cells |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact                                                    | Expected                                                                   | Status   | Details                                                                                         |
|-------------------------------------------------------------|----------------------------------------------------------------------------|----------|-------------------------------------------------------------------------------------------------|
| `src/lib/setPieceLeague.ts`                                 | computeCompositeScore, formatScore, aggregateSetPieceLeague, LeagueRow, LeagueTable | VERIFIED | All exports present, fully implemented (no throw stubs), all unit tests pass                   |
| `src/components/set-pieces/SetPieceLeagueTable.tsx`         | Table component with ranked rows + Insufficient Data section + TeamCrest    | VERIFIED | Full implementation: aggregateSetPieceLeague called, useTeamBadge used, both sections present   |
| `src/components/set-pieces/SetPieceViewToggle.tsx`          | Segmented pill toggle, always-visible (flex not hidden sm:flex)             | VERIFIED | `flex` class present, `hidden sm:flex` absent; `role="group"`, `aria-label="Set-piece view"` present |
| `src/components/set-pieces/SetPieceTakerPanel.tsx`          | Modified panel with useState toggle + conditional rendering                 | VERIFIED | `useState<SetPieceView>('takers')`, toggle rendered, league table conditionally rendered        |
| `src/lib/setPieceLeague.test.ts`                            | 8 RED→GREEN unit cases                                                      | VERIFIED | 8 `it(` calls, `@vitest-environment node`, all 8 pass                                          |
| `src/components/set-pieces/SetPieceLeagueTable.test.tsx`    | 5 RED→GREEN component cases                                                 | VERIFIED | 5 `it(` calls, `@vitest-environment jsdom`, mock hoisting pattern, all 5 pass                  |

### Key Link Verification

| From                               | To                                  | Via                                      | Status   | Details                                                              |
|------------------------------------|-------------------------------------|------------------------------------------|----------|----------------------------------------------------------------------|
| SetPieceTakerPanel.tsx             | SetPieceViewToggle.tsx              | `import { SetPieceViewToggle }`          | WIRED    | Line 10 import; line 134 `<SetPieceViewToggle view={view} onViewChange={setView} />` |
| SetPieceTakerPanel.tsx             | SetPieceLeagueTable.tsx             | conditional render when `view === 'league'` | WIRED | Line 12 import; line 169 `<SetPieceLeagueTable changes={data} />` in else branch of `view === 'takers'` ternary |
| SetPieceLeagueTable.tsx            | src/lib/setPieceLeague.ts           | `aggregateSetPieceLeague(changes)`       | WIRED    | Line 3 import; line 31 `const { ranked, insufficient } = aggregateSetPieceLeague(changes)` |
| SetPieceLeagueTable.tsx            | src/lib/hooks/useTeamBadge.ts       | `useTeamBadge(shortName)` in TeamCrest   | WIRED    | Line 4 import; line 12 `const { src, onError, showFallback, fallbackColour, initial } = useTeamBadge(shortName)` |

### Data-Flow Trace (Level 4)

| Artifact                     | Data Variable              | Source                           | Produces Real Data                                   | Status   |
|------------------------------|----------------------------|----------------------------------|------------------------------------------------------|----------|
| SetPieceLeagueTable.tsx      | `ranked`, `insufficient`   | `aggregateSetPieceLeague(changes)` | Yes — pure function over live `SetPieceChanges` prop | FLOWING  |
| SetPieceTakerPanel.tsx       | `data` (SetPieceChanges)   | `useSetPieces()` hook            | Yes — SWR fetch to `/api/set-pieces`, returns `res.json()` | FLOWING |

The data path is: `/api/set-pieces` → `useSetPieces()` → `data` prop → `changes={data}` → `aggregateSetPieceLeague(changes)` → rendered rows. No static returns or hardcoded empty values at any stage.

### Behavioral Spot-Checks

| Behavior                          | Command                                                                                                           | Result                                              | Status  |
|-----------------------------------|-------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------|---------|
| 8 unit tests pass GREEN           | `npx vitest run src/lib/setPieceLeague.test.ts`                                                                   | Tests 8 passed (8), 0 failed                        | PASS    |
| 5 component tests pass GREEN      | `npx vitest run src/components/set-pieces/SetPieceLeagueTable.test.tsx`                                           | Tests 5 passed (5), 0 failed                        | PASS    |
| Panel regression tests pass       | `npx vitest run src/components/set-pieces/SetPieceTakerPanel.test.tsx`                                            | Tests 8 passed (8), 0 failed                        | PASS    |
| TypeScript compiles clean         | `npx tsc --noEmit`                                                                                                | No output (zero errors)                             | PASS    |
| Toggle is mobile-visible          | `grep -n "hidden sm:flex" src/components/set-pieces/SetPieceViewToggle.tsx`                                       | No match — `hidden sm:flex` absent                  | PASS    |
| No stubs remain                   | `grep -n "throw new Error\|not implemented\|league-table-stub"` on all 4 implementation files                     | NO STUBS                                            | PASS    |

### Requirements Coverage

| Requirement | Source Plan | Description | Status        | Evidence |
|-------------|-------------|-------------|---------------|----------|
| SPQ-04      | 095-01-PLAN.md, 095-02-PLAN.md | Set-piece delivery league table — all 20 PL teams ranked by composite delivery quality score; toggle in Set Pieces tab; Insufficient Data section; zero pipeline changes | SATISFIED (code); NOT UPDATED (REQUIREMENTS.md) | Implementation complete and all tests pass. REQUIREMENTS.md traceability table still shows `pending` — requires checkbox update `[ ]` → `[x]`. This is a documentation gap, not a functional blocker. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No TODO/FIXME/placeholder comments found. No stub patterns (empty returns, throw stubs) found. No hardcoded empty data arrays flowing to render. No orphaned components.

### Human Verification Required

#### 1. Mobile Toggle Visibility

**Test:** Load the Set Pieces tab on a mobile viewport (< 640px). Confirm the "Takers / League Table" pill renders without being hidden.
**Expected:** Both buttons visible and tappable; min-height 44px touch targets respected.
**Why human:** CSS `flex` vs `hidden sm:flex` cannot be confirmed from code inspection alone without a real browser render.

#### 2. League Table Visual Rendering

**Test:** Click "League Table". Observe the ranked table.
**Expected:** Team crests or fallback colour badges appear beside short names; Score column shows values like "8.4" (not "0.084"); Corner and FK columns show "—" for teams with null scores; table has correct column alignment.
**Why human:** Visual correctness, crest image loading/fallback, and column alignment require a browser.

#### 3. Alert Gating

**Test:** Ensure there are recent set-piece taker changes in the data (change_count > 0). Toggle between Takers and League Table views.
**Expected:** SetPieceChangeAlert appears only in Takers view, disappears in League Table view.
**Why human:** Requires live data with change_count > 0 to observe the conditional alert.

#### 4. State Reset on Navigation

**Test:** Switch to League Table view. Navigate away from Set Pieces tab (e.g. to another tab). Navigate back.
**Expected:** View resets to Takers (component-local useState, not persisted).
**Why human:** Component mount/unmount lifecycle and React state reset require interactive browser session.

#### 5. Real Data Null Scores

**Test:** If any team in live `sp_quality.json` data has exactly one of corner_score or fk_score null (not both), observe that team's row.
**Expected:** The null column shows "—"; the composite shows the single available score formatted per-100.
**Why human:** Requires real pipeline data with a partially-scored team — may not exist in current data.

### Gaps Summary

No gaps identified. All 7 must-have truths are verified. All 4 required artifacts exist, are substantive, and are wired. Data flows from the real API through to rendered rows. Test suite passes completely (13 phase tests + 8 panel regression tests). TypeScript compiles clean.

The only action item is updating REQUIREMENTS.md to mark SPQ-04 as `[x]` complete — this is a documentation housekeeping task, not a functional gap.

---

_Verified: 2026-05-11T12:40:00Z_
_Verifier: Claude (gsd-verifier)_
