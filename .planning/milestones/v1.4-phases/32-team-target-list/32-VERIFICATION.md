---
phase: 32-team-target-list
verified: 2026-04-28T17:35:00Z
status: human_needed
score: 14/15 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open Club Form tab, confirm TARGET badge appears on teams with 4+ favourable fixtures and tooltip text is verbatim"
    expected: "Green TARGET badge after ease %, hovering shows '4+ favourable fixtures in the next 5 GWs (attacking difficulty < 0.5). Click to see top players.' — player table expands with Player/Pos/xGI%/xPts/Signal/Diff columns, chevron toggles, single-open invariant holds, keyboard (Enter/Space) works, non-TARGET rows have no interaction, GW/ATT-DEF toggles do not affect TARGET qualification, zero React console warnings"
    why_human: "Visual rendering, tooltip display, keyboard focus ring, real xGI% values from live pipeline data, badge colors in dark/light modes, mobile horizontal scroll — none of these are testable via jsdom"
---

# Phase 32: Team Target List Verification Report

**Phase Goal:** User can identify which teams to target for transfers based on green fixture runs and which specific players to buy from those teams
**Verified:** 2026-04-28T17:35:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Teams with 4+ favourable upcoming fixtures (attacking_difficulty < 0.5) show a green TARGET badge on the Club Form tab | VERIFIED | `FixtureEaseRankingPanel.tsx` line 81-83: `team.upcoming_fixtures.slice(0, 5).filter((f) => f.attacking_difficulty < 0.5).length >= 4`; badge rendered at line 119-125 with locked Tailwind classes; component test passes (`renders TARGET badge for a team with 4 of 5 fixtures`) |
| 2 | TOP-3 players ranked by xGI involvement % (share of team xG+xA) are shown for TARGET teams on expand | VERIFIED | `getTopPlayers` helper (lines 19-28) filters `status === 'a'`, sorts by `xgiMap.get(b.id) ?? 0` descending, slices top 3; `computeXgiInvolvement` utility in `src/lib/xgi.ts` produces the Map; component test `shows top 3 players sorted by xGI% descending, status === a only` passes |
| 3 | xGI% is computed as per-player share of team total (expected_goals + expected_assists) | VERIFIED | `src/lib/xgi.ts` implements two-pass aggregation: pass 1 sums xGI per team_id, pass 2 divides player xGI by team total; 5 unit tests all pass including multi-team isolation and zero-division guard |
| 4 | Buy signals (RegressionSignalBadge) and differential flags (DifferentialBadge) are visible in the expanded player table alongside xPts | VERIFIED | `FixtureEaseRankingPanel.tsx` lines 173-183: `<RegressionSignalBadge signal={p.regression_signal} delta={p.actual_vs_xg_delta} />` and `<DifferentialBadge flag={p.differential_flag} ownership={parseFloat(p.selected_by_percent)} />`; component test `renders xGI% as N% and Signal/Diff cells via badge components` confirms BUY/DIFF/TRAP text renders |
| 5 | Expanded player table has six columns: Player, Pos, xGI%, xPts, Signal, Diff | VERIFIED | `FixtureEaseRankingPanel.tsx` lines 145-151: column headers are exact locked strings; `xGI%` renders `{(share * 100).toFixed(0)}%` or em-dash; `xPts` renders `p.xPts_1gw.toFixed(1)` or `'—'` |
| 6 | TARGET rows are keyboard-operable: tabIndex=0, role=button, Enter/Space toggles | VERIFIED | `FixtureEaseRankingPanel.tsx` lines 107-110: `tabIndex: 0, role: 'button'` spread conditionally only on `isTarget`; `onKeyDown` handler at lines 99-106; component test `toggles expansion via Enter key on a focused TARGET row` passes |
| 7 | Non-TARGET rows have no click handler, no tabIndex, no role, no badge | VERIFIED | Conditional spread `{...(isTarget ? {...} : {})}` at line 93-111 ensures non-TARGET rows receive no interactive attributes; component test `does not expand when a non-TARGET row is clicked` asserts absence of tabindex and role |
| 8 | Single-open invariant: clicking a different TARGET row collapses the previous and expands the new | VERIFIED | `setExpandedTeamId` replaces the value on different row click (`expandedTeamId === team.team_id ? null : team.team_id`); component test `collapses the previous expansion when a different TARGET row is clicked` passes |
| 9 | Clicking the same expanded row collapses it | VERIFIED | Toggle logic: `expandedTeamId === team.team_id ? null : team.team_id`; component test `collapses when the same TARGET row is clicked again` passes |
| 10 | Empty state `No available players with xGI data for this team.` renders when topPlayers is empty | VERIFIED | `FixtureEaseRankingPanel.tsx` line 190; component test `renders the empty-state message when no eligible players exist` passes |
| 11 | GW toggle and ATT/DEF toggle do NOT affect TARGET qualification (always 5GW/ATT-based) | VERIFIED | TARGET qualification reads `team.upcoming_fixtures.slice(0, 5)` and `attacking_difficulty` directly — completely independent of `win` and `mode` state variables used for ranking; component tests exercise toggle changes without breaking TARGET state |
| 12 | pipeline/merge.py writes expected_goals and expected_assists as float per player | VERIFIED | `pipeline/merge.py` lines 768-772: `'expected_goals': float(element.get('expected_goals', 0) or 0)` and `'expected_assists': float(element.get('expected_assists', 0) or 0)` with zero-guard; no other fields modified |
| 13 | MergedPlayer TypeScript interface declares expected_goals: number and expected_assists: number (non-optional) | VERIFIED | `src/lib/types.ts` lines 107-111: both fields declared as `number` (non-optional) after `assists: number`, with Phase 32 comment block |
| 14 | computeXgiInvolvement unit tests: 5 tests covering single-team share, zero-division, single-player, multi-team, zero-contribution | VERIFIED | `tests/lib/xgi.test.ts` contains exactly 5 it() cases; `npx vitest run tests/lib/xgi.test.ts` output: 5/5 passed |
| 15 | Visual rendering, tooltip display, keyboard focus ring, real live data in browser | ? UNCERTAIN | Requires human — jsdom tests confirm DOM structure and logic; browser rendering, actual pipeline data, tooltip hover, focus ring, dark mode, mobile scroll cannot be verified programmatically |

**Score:** 14/15 truths verified (1 requires human verification)

### Deferred Items

None — no items deferred to later phases.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pipeline/merge.py` | expected_goals and expected_assists added to per-player dict (line ~769-772) | VERIFIED | Lines 768-772 confirmed via direct read; float() guard present; insertion point is immediately after `'assists'` line as required |
| `src/lib/types.ts` | expected_goals: number and expected_assists: number on MergedPlayer (non-optional) | VERIFIED | Lines 107-111 confirmed; non-optional `number` type matching goals_scored/assists convention |
| `src/lib/xgi.ts` | exports computeXgiInvolvement(players: MergedPlayer[]): Map<number, number> | VERIFIED | File exists (39 lines), exports single named function, two-pass implementation present, zero-division guard present |
| `tests/lib/xgi.test.ts` | 5 unit tests covering all required cases | VERIFIED | File exists (62 lines); describe('computeXgiInvolvement') with 5 it() cases; all 5 passing |
| `src/components/club-form/FixtureEaseRankingPanel.tsx` | Extended panel with TARGET badge, expandedTeamId state, expand-on-click player table | VERIFIED | File is 205 lines (up from 73); contains expandedTeamId state, usePlayers, xgiMap, getTopPlayers helper, TARGET badge, expansion block |
| `tests/components/club-form/FixtureEaseRankingPanel.test.tsx` | Component tests: TARGET badge gating, expand toggle, single-open, xGI% formatting, badge wiring, empty state | VERIFIED | File exists (365 lines); 18 it() cases across 3 describe blocks; all 18 passing |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `FixtureEaseRankingPanel.tsx` | `src/lib/xgi.ts computeXgiInvolvement` | import + useMemo call | WIRED | Line 6: import; line 45: `useMemo(() => computeXgiInvolvement(players ?? []), [players])` |
| `FixtureEaseRankingPanel.tsx` | `RegressionSignalBadge` | JSX import + render in Signal column | WIRED | Line 8: import; lines 173-176: `<RegressionSignalBadge signal={p.regression_signal} delta={p.actual_vs_xg_delta} />` |
| `FixtureEaseRankingPanel.tsx` | `DifferentialBadge` | JSX import + render in Diff column | WIRED | Line 9: import; lines 179-182: `<DifferentialBadge flag={p.differential_flag} ownership={parseFloat(p.selected_by_percent)} />` |
| `FixtureEaseRankingPanel.tsx` | `usePlayers()` hook | hook call inside component | WIRED | Line 5: import; line 43: `const { data: players } = usePlayers()` |
| `FixtureEaseRankingPanel.tsx` TARGET qualification | `ClubForm.upcoming_fixtures[].attacking_difficulty` | `team.upcoming_fixtures.slice(0,5).filter(f => f.attacking_difficulty < 0.5).length >= 4` | WIRED | Line 81-83: exact pattern confirmed |
| `pipeline/merge.py` per-player dict | FPL bootstrap expected_goals/expected_assists | `float(element.get('expected_goals', 0) or 0)` | WIRED | Lines 771-772 confirmed |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `FixtureEaseRankingPanel.tsx` | `players` (MergedPlayer[]) | `usePlayers()` hook → `/api/players` → `merged_players.json` | Yes — pipeline writes expected_goals/expected_assists; usePlayers fetches live data | FLOWING |
| `FixtureEaseRankingPanel.tsx` | `xgiMap` | `computeXgiInvolvement(players ?? [])` via useMemo | Yes — reads expected_goals/expected_assists from MergedPlayer array, returns Map with real computed values | FLOWING |
| `FixtureEaseRankingPanel.tsx` | `data` (ClubForm[]) | `useClubForm()` hook → `/api/club-form` → live pipeline data | Yes — attacking_difficulty fields populated in pipeline/merge.py Phase 27 work | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| xgi.ts unit tests — 5/5 pass | `npx vitest run tests/lib/xgi.test.ts` | 5 passed (5), 456ms | PASS |
| FixtureEaseRankingPanel component tests — 18/18 pass | `npx vitest run tests/components/club-form/FixtureEaseRankingPanel.test.tsx` | 18 passed (18), 788ms | PASS |
| TypeScript compilation — no new errors | `npx tsc --noEmit` | 5 pre-existing errors in `tests/lib/captain-picks.test.ts` only (predated Phase 32, documented in 32-01-SUMMARY.md) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TGT-01 | 32-02-PLAN.md | User can see teams with 4+ favourable upcoming fixtures highlighted on the Club Form tab | SATISFIED | TARGET badge rendered conditionally on `isTarget` (attacking_difficulty < 0.5 for 4/5 fixtures); badge presence tested and passing |
| TGT-02 | 32-01-PLAN.md, 32-02-PLAN.md | User can see top players ranked by xGI involvement % for teams with green fixture runs | SATISFIED | `computeXgiInvolvement` utility ships; `getTopPlayers` sorts by xgiMap descending; xGI% column renders `{(share * 100).toFixed(0)}%`; all wired and tested |
| TGT-03 | 32-02-PLAN.md | Buy signals (REG-01) and differential flags (TMPL-01) visible alongside team target player data | SATISFIED | `<RegressionSignalBadge>` and `<DifferentialBadge>` both imported, rendered in Signal/Diff columns; component test confirms BUY/DIFF/TRAP text renders correctly |

All three requirement IDs from REQUIREMENTS.md (TGT-01, TGT-02, TGT-03) are mapped to Phase 32 and are satisfied by the implementation. REQUIREMENTS.md traceability table shows TGT-01/02/03 as "Pending" — this status was not updated as part of Phase 32 execution (the update typically happens when the phase is fully closed after human verify). No orphaned Phase 32 requirements detected.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | No anti-patterns found |

No TODOs, FIXMEs, placeholder comments, empty returns, or hardcoded stub data found in any Phase 32 files. `xgiMap` is populated from real `computeXgiInvolvement` output, not an empty Map. `players` and `data` come from live hooks, not hardcoded arrays.

### Human Verification Required

#### 1. Club Form tab — TARGET badge and expand-on-click full flow

**Test:** Run `npm run dev`, open http://localhost:3000, click the Club Form tab. Identify teams with a green TARGET badge after their ease percentage. Verify:
- Badge label is "TARGET" in correct Tailwind green classes (bg-green-100/dark:bg-green-900, text-green-800/dark:text-green-200)
- Hover tooltip reads verbatim: "4+ favourable fixtures in the next 5 GWs (attacking difficulty < 0.5). Click to see top players."
- Click a TARGET row: inline player table appears with columns Player, Pos, xGI%, xPts, Signal, Diff
- 1-3 player rows appear ranked by xGI% descending; xGI% shows as "{N}%" (or em-dash if zero-division); xPts shows 1 decimal
- Signal column shows BUY (green) / SELL (amber) / em-dash; Diff column shows DIFF (green) / TRAP (amber) / em-dash
- Chevron shows "▾" (collapsed) and "▴" (expanded)
- Click same TARGET row again: collapses
- Click a different TARGET row: previous collapses, new expands (single-open invariant)
- Click a NON-TARGET row: nothing happens, no badge, no expansion
- Toggle ATT/DEF and 1/3/5 GW: TARGET badge remains on same teams (qualification is invariant to toggle state)
- Tab to TARGET rows using keyboard: visible focus ring; Enter or Space toggles expansion
- Non-TARGET rows are NOT in the tab order
- Open browser dev console: zero React warnings (key warnings, hydration mismatches, etc.)

**Expected:** All steps pass as described above.

**Why human:** Visual rendering (badge colors, focus rings, dark mode), native browser tooltip display, real xGI% values from live pipeline data, keyboard accessibility feel, mobile horizontal scroll, React console warnings — none are verifiable via jsdom component tests.

### Gaps Summary

No gaps found. All 14 programmatically-verifiable must-haves are verified. The one outstanding item (truth #15) is a human verification need for browser rendering and live data behavior, which is standard for this type of UI phase and was explicitly flagged in 32-02-PLAN.md as a blocking human-verify checkpoint.

---

_Verified: 2026-04-28T17:35:00Z_
_Verifier: Claude (gsd-verifier)_
