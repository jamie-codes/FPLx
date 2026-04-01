---
phase: 15-remaining-tables-mobile
verified: 2026-04-01T00:00:00Z
status: gaps_found
score: 6/7 must-haves verified
re_verification: false
gaps:
  - truth: "REQUIREMENTS.md traceability table reflects MOB-TBL-05 (SquadView) as Complete"
    status: partial
    reason: "The active requirements section at line 28 is marked [x] complete, but the traceability table at line 98 still reads 'Pending' for MOB-TBL-05 (SquadView). The code fully satisfies the requirement — this is a documentation inconsistency only."
    artifacts:
      - path: ".planning/REQUIREMENTS.md"
        issue: "Line 98: '| MOB-TBL-05 (SquadView) | Phase 15 | Pending |' should be 'Complete'"
    missing:
      - "Update traceability table line 98 in REQUIREMENTS.md: change 'Pending' to 'Complete' for MOB-TBL-05 (SquadView)"
human_verification:
  - test: "Open SquadView at 375px width and scroll right"
    expected: "Player column (with C/VC indicators) stays pinned to the left edge; only Price, Risk, Rec columns scroll into view"
    why_human: "CSS sticky positioning and visual scroll behavior cannot be verified via static code analysis"
  - test: "Open SquadView at 375px, expand a player row to show ExplainPanel"
    expected: "ExplainPanel spans exactly 4 columns (Player, Price, Risk, Rec) on mobile; no visual layout break"
    why_human: "ColSpan rendering and panel layout require browser visual inspection"
  - test: "Open DefConTables at 375px"
    expected: "Each table shows exactly 4 columns: Player, Team, Hit Rate, Avg DC/90; Hits, Distance, Easy vs Hard are absent"
    why_human: "TanStack VisibilityState column removal requires browser visual confirmation"
  - test: "Open ClubFormTable at 375px"
    expected: "Table shows exactly 5 columns: Team, W, D, L, GD; GS, GC, Next 5 are absent"
    why_human: "Column hiding requires browser visual confirmation"
  - test: "Open ValueGemsTable at 375px"
    expected: "Table shows exactly 4 columns: Player, Price, Gem, Pts; Pos, Team, Own%, Trend, Next 5 are absent"
    why_human: "Column hiding requires browser visual confirmation"
  - test: "Resize browser from 375px to 1024px for all four tables"
    expected: "All tables restore their full column set at >= 640px with no visual artifacts"
    why_human: "Responsive resize behavior requires live browser testing"
---

# Phase 15: Remaining Tables Mobile Verification Report

**Phase Goal:** SquadView, DefConTables, ClubFormTable, and ValueGemsTable all show priority column sets on mobile — only the most essential data is visible by default, with the Player column sticky in SquadView
**Verified:** 2026-04-01
**Status:** gaps_found (1 documentation gap only — all code verified)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SquadView shows Player, Price, Risk, Rec on mobile; Team, Own%, Mins, Gem, Status hidden | VERIFIED | `hideOnMobile` applied to 5 th/td pairs (lines 132, 134-137, 171, 189, 192, 195, 198); visible columns: Player (line 131), Price (line 133), Risk (line 138), Rec (line 139) |
| 2 | SquadView Player column is sticky on mobile horizontal scroll | VERIFIED | `sticky left-0 z-30 bg-white` on Player th (line 131); `sticky left-0 z-10 bg-white` on Player td (line 150) |
| 3 | ExplainPanel colSpan adjusts to 4 on mobile, 9 on desktop | VERIFIED | `colSpan={isMobile ? 4 : 9}` at line 218 |
| 4 | DefConTables shows Player, Team, Hit Rate, Avg DC/90 on mobile; Hits, Distance, Easy vs Hard hidden | VERIFIED | `columnVisibility` hides `hits`, `distance_to_threshold`, `fixture_correlation`; wired into both defTable and midFwdTable state objects |
| 5 | ClubFormTable shows Team, W, D, L, GD on mobile; GS, GC, Next 5 hidden | VERIFIED | `columnVisibility` hides `goals_scored`, `goals_conceded`, `upcoming`; wired into table state |
| 6 | ValueGemsTable shows Player, Price, Gem, Pts on mobile; Pos, Team, Own%, Trend, Next 5 hidden | VERIFIED | `columnVisibility` hides `element_type`, `team_short_name`, `selected_by_percent`, `trend`, `fixtures`; wired into table state |
| 7 | REQUIREMENTS.md traceability table reflects phase completion for all four requirement IDs | FAILED | MOB-TBL-05 (SquadView) listed as "Pending" in traceability table (line 98) despite code being complete and active requirement marked [x] |

**Score:** 6/7 truths verified (1 documentation inconsistency)

---

## Required Artifacts

### Plan 01 — SquadView (MOB-TBL-02, MOB-TBL-05)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/squad/SquadView.tsx` | isMobile state, hideOnMobile helper, sticky Player, dynamic colSpan | VERIFIED | All patterns present and wired |

**Level 1 (exists):** File present at expected path.

**Level 2 (substantive):**
- `isMobile` state: 3 token occurrences (declaration line 58, usage in hideOnMobile line 66, usage in colSpan line 218)
- `useEffect` with resize listener: line 59-64
- `window.innerWidth < 640`: line 60
- `hideOnMobile`: 11 line occurrences (definition + 5 th + 5 td)
- `sticky left-0 z-30` on Player th: line 131
- `sticky left-0 z-10` on Player td: line 150
- `z-20` on all 7 non-Player th elements: 8 occurrences
- `colSpan={isMobile ? 4 : 9}`: line 218

**Level 3 (wired):** `isMobile` drives `hideOnMobile` which is applied to all 5 hidden column pairs; `colSpan` directly references `isMobile`; sticky CSS is unconditional (correct — sticky on desktop is harmless).

**Level 4 (data flow):** Not applicable — this is column visibility state, not a data-fetching concern. The `isMobile` boolean state is read from `window.innerWidth` on mount and resize, which is a real browser API.

---

### Plan 02 — DefConTables, ClubFormTable, ValueGemsTable (MOB-TBL-03, MOB-TBL-04)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/defcon/DefConTables.tsx` | isMobile state, VisibilityState, wired to both table instances | VERIFIED | All patterns present |
| `src/components/club-form/ClubFormTable.tsx` | isMobile state, VisibilityState, wired to table | VERIFIED | All patterns present |
| `src/components/value-gems/ValueGemsTable.tsx` | isMobile state, VisibilityState, wired to table | VERIFIED | All patterns present |

**Level 2 (substantive) — DefConTables:**
- `isMobile` state: lines 70, 78 (2 lines — correct; plan's "at least 3" criterion was overcounted; `setIsMobile` contains isMobile as substring but grep-c counts lines)
- `useEffect` with `setIsMobile(window.innerWidth < 640)`: lines 71-77
- `VisibilityState` type imported and used: lines 11, 78
- `columnVisibility` with `hits: false`, `distance_to_threshold: false`, `fixture_correlation: false`: lines 78-80
- Wired into `defTable` state: line 92; wired into `midFwdTable` state: line 101

**Level 2 (substantive) — ClubFormTable:**
- `isMobile` state: lines 19, 27
- `useEffect` with resize listener: lines 20-25
- `VisibilityState` type: lines 10, 27
- `columnVisibility` with `goals_scored: false`, `goals_conceded: false`, `upcoming: false`: lines 27-29
- Wired into table state: line 38

**Level 2 (substantive) — ValueGemsTable:**
- `isMobile` state: lines 29, 37
- `useEffect` with resize listener: lines 30-35
- `VisibilityState` type: lines 10, 37
- `columnVisibility` with all 5 column IDs false: lines 37-39
- Wired into table state: line 55

**Level 3 (wired):** All three TanStack tables use `getVisibleCells()` and `headerGroup.headers` in their render loops (TanStack's standard pattern), which automatically respects the `columnVisibility` state object. The `columnVisibility` constant is passed in the `state:` property in each `useReactTable` call — confirmed at lines 92/101 (DefCon), 38 (ClubForm), 55 (ValueGems).

**Level 4 (data flow):** Not applicable — same rationale as Plan 01.

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `SquadView.tsx` | `window.innerWidth` | useEffect + resize listener | WIRED | Lines 59-64; cleanup returns `removeEventListener` |
| `SquadView.tsx` | `hideOnMobile` CSS | `isMobile` ternary | WIRED | Line 66: `isMobile ? 'hidden' : ''` |
| `SquadView.tsx` | sticky Player th | CSS class | WIRED | Line 131: `sticky left-0 z-30 bg-white` — unconditional |
| `SquadView.tsx` | ExplainPanel colSpan | `isMobile` ternary | WIRED | Line 218: `colSpan={isMobile ? 4 : 9}` |
| `DefConTables.tsx` | `window.innerWidth` | useEffect + resize listener | WIRED | Lines 71-76 |
| `DefConTables.tsx` | both table instances | `columnVisibility` in `state:` | WIRED | Lines 92, 101 |
| `ClubFormTable.tsx` | `window.innerWidth` | useEffect + resize listener | WIRED | Lines 20-25 |
| `ClubFormTable.tsx` | table instance | `columnVisibility` in `state:` | WIRED | Line 38 |
| `ValueGemsTable.tsx` | `window.innerWidth` | useEffect + resize listener | WIRED | Lines 30-35 |
| `ValueGemsTable.tsx` | table instance | `columnVisibility` in `state:` | WIRED | Line 55 |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — column visibility is driven by CSS class toggling and TanStack state; no runnable CLI entry point or API endpoint to test. Requires browser at 375px width (routed to human verification).

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MOB-TBL-02 | 15-01 | SquadView shows only priority columns on mobile (Player, Price, Risk badge, Rec verdict) | SATISFIED | `hideOnMobile` applied to Team, Own%, Mins, Gem, Status th/td pairs in SquadView.tsx |
| MOB-TBL-03 | 15-02 | DefConTables show priority columns on mobile (Player, Team, Hit Rate, Avg DC/90) | SATISFIED | `columnVisibility` hides hits, distance_to_threshold, fixture_correlation in DefConTables.tsx |
| MOB-TBL-04 | 15-02 | ClubFormTable and ValueGemsTable show priority columns on mobile | SATISFIED | ClubFormTable hides goals_scored/goals_conceded/upcoming; ValueGemsTable hides element_type/team_short_name/selected_by_percent/trend/fixtures |
| MOB-TBL-05 | 15-01 | Player column is sticky in SquadView on mobile | SATISFIED (code) | `sticky left-0 z-30` on Player th, `sticky left-0 z-10` on Player td in SquadView.tsx |

**Orphaned requirements check:** REQUIREMENTS.md traceability maps exactly MOB-TBL-02, MOB-TBL-03, MOB-TBL-04, and MOB-TBL-05 (SquadView) to Phase 15. All four are claimed by plans and verified in code. No orphaned requirements.

**Documentation gap — MOB-TBL-05 (SquadView):** The active requirements section (line 28) correctly marks MOB-TBL-05 as `[x]` complete. However, the traceability table (line 98) still shows `Pending`. The code satisfies the requirement in full. The traceability table needs a one-line update.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/squad/SquadView.tsx` | 123 | `return null` | Info | Guard clause: returns null when a position group has 0 players — this is correct defensive logic, not a stub |

No blockers or warnings found. The `return null` at line 123 is a conditional guard inside a `.map()` loop checking `rows.length === 0` — legitimate empty-state handling.

---

## Human Verification Required

### 1. SquadView sticky Player column on mobile scroll

**Test:** Open the app in DevTools at 375px, navigate to the Squad tab, and scroll the SquadView table horizontally to the right.
**Expected:** The Player column (including C/VC badge) remains pinned to the left edge; Price, Risk, and Rec columns slide left behind it.
**Why human:** CSS `sticky` positioning with z-index layering and `overflow-x-auto` wrapping cannot be validated by static code inspection.

### 2. SquadView ExplainPanel spans correctly on mobile

**Test:** At 375px, click the expand arrow on any starting player row.
**Expected:** The ExplainPanel expands and occupies the full width of the 4-column layout; no overflow or misaligned cell boundary.
**Why human:** ColSpan rendering is a browser layout concern.

### 3. DefConTables column hiding at 375px

**Test:** Open the DefCon tab at 375px and inspect both the Defenders and Midfielders/Forwards tables.
**Expected:** Each table shows exactly 4 columns: Player, Team, Hit Rate, Avg DC/90. Hits, Distance, and Easy vs Hard columns are absent.
**Why human:** TanStack VisibilityState is applied at runtime; column removal must be visually confirmed.

### 4. ClubFormTable column hiding at 375px

**Test:** Open the Club Form tab at 375px.
**Expected:** Table shows exactly 5 columns: Team, W, D, L, GD. GS, GC, and Next 5 columns are absent.
**Why human:** Same as above.

### 5. ValueGemsTable column hiding at 375px

**Test:** Open the Value Gems tab at 375px.
**Expected:** Table shows exactly 4 columns: Player, Price, Gem, Pts. Pos, Team, Own%, Trend, and Next 5 are absent.
**Why human:** Same as above.

### 6. Desktop layout unchanged at 1024px

**Test:** Resize all four tables to >= 640px.
**Expected:** All tables restore their complete column sets with no visual artifacts or residual hidden columns.
**Why human:** Responsive resize transition requires live browser observation.

---

## Gaps Summary

One gap was found, and it is a documentation inconsistency — not a code deficiency.

**Gap:** The REQUIREMENTS.md traceability table at line 98 still reads `| MOB-TBL-05 (SquadView) | Phase 15 | Pending |`. The code in `src/components/squad/SquadView.tsx` fully implements the sticky Player column (`sticky left-0 z-30` on th, `sticky left-0 z-10` on td) as required by MOB-TBL-05. The active requirements section at line 28 correctly marks MOB-TBL-05 as `[x]`. This is a one-line fix to the traceability table.

All four code artifacts are substantive, fully wired, and have their data flows intact. All three commits (2d7a5af, 43e502a, 653b1fe) are confirmed in git history. No stubs, no placeholder implementations, no broken wiring found.

---

_Verified: 2026-04-01_
_Verifier: Claude (gsd-verifier)_
