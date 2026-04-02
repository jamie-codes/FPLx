---
phase: 19-data-quality-and-value-gems-polish
verified: 2026-04-02T00:00:00Z
status: passed
score: 8/8 must-haves verified
---

# Phase 19: Data Quality and Value Gems Polish — Verification Report

**Phase Goal:** Fix pipeline data quality gaps (xG proxy, DefCon threshold) and add historical points display to Value Gems table
**Verified:** 2026-04-02
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A player with null Understat xG/xA gets a Gem score using FPL goals/assists proxy | VERIFIED | `pipeline/merge.py` lines 313-321: DQ-01 proxy block sets `xg_per90 = (goals_scored / minutes) * 90` when still None; `gem-score.ts` includes xg/xa dimensions for all numeric values |
| 2 | DefCon table excludes players with fewer than 5 games played | VERIFIED | `pipeline/defcon.py` line 39: `if games_played < 5: continue` |
| 3 | merged_players.json includes pts_last3gw and pts_last5gw for every player | VERIFIED | `pipeline/merge.py` lines 324-381: fields computed from element-summary history and assigned in player dict |
| 4 | Players with fewer GWs than the window get a partial sum (never null) | VERIFIED | Lines 332-335: partial slices used (`history[-3:]` or full history if shorter); defaults to 0 if no history — always numeric |
| 5 | Value Gems table shows Total Pts, Pts L5, and Pts L3 columns | VERIFIED | `src/components/value-gems/columns.tsx` lines 49-75: three column definitions with correct headers |
| 6 | Sorting by any of the three points columns produces correct ordering | VERIFIED | All three columns have `enableSorting: true`; TanStack Table `getSortedRowModel()` wired in `ValueGemsTable.tsx` |
| 7 | On mobile, Pts L5 and Pts L3 columns are hidden | VERIFIED | `src/components/value-gems/ValueGemsTable.tsx` line 38: `pts_last5gw: false, pts_last3gw: false` in mobile `columnVisibility` |
| 8 | Partial-window values show an asterisk (e.g. 12*) | VERIFIED | `columns.tsx` lines 61-63 and 70-73: `gwCount < 5` / `gwCount < 3` triggers `{value}*` span with tooltip |

**Score:** 8/8 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pipeline/merge.py` | xG/xA proxy + pts_last3gw/pts_last5gw computation | VERIFIED | DQ-01 proxy block at lines 313-321; VG-01 history block at lines 323-335; `summaries` param in function signature line 127; all three pts fields in output dict lines 379-381 |
| `pipeline/defcon.py` | Raised minimum games threshold | VERIFIED | Line 39: `if games_played < 5: continue` |
| `src/lib/types.ts` | MergedPlayer with pts_last3gw, pts_last5gw, goals_scored, assists | VERIFIED | Lines 102-108: all five new fields present with correct types |
| `src/lib/gem-score.ts` | Proxy xG/xA scoring with DQ-01 comment | VERIFIED | Lines 78-90: `// DQ-01` comment; null + undefined guards for xg/xa |
| `src/components/value-gems/columns.tsx` | Three points column definitions | VERIFIED | Lines 49-75: Total Pts, Pts L5, Pts L3 columns with cell renderers, ids, and enableSorting |
| `src/components/value-gems/ValueGemsTable.tsx` | Mobile column visibility for new pts columns | VERIFIED | Line 38: `pts_last5gw: false, pts_last3gw: false` in mobile visibility object |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `pipeline/merge.py` | `src/lib/types.ts` | JSON output schema matches MergedPlayer interface | VERIFIED | `pts_last3gw`, `pts_last5gw`, `pts_gw_count`, `goals_scored`, `assists` all present in both pipeline output dict and MergedPlayer interface |
| `src/lib/gem-score.ts` | `src/lib/types.ts` | Uses goals_scored/assists for proxy when xg_per90 is null | VERIFIED | Proxy is in pipeline (merge.py), not gem-score.ts — gem-score.ts consumes already-numeric xg_per90/xa_per90 values; types match |
| `src/components/value-gems/columns.tsx` | `src/lib/types.ts` | Accesses ScoredPlayer.pts_last3gw, pts_last5gw, pts_gw_count | VERIFIED | Column accessors use `pts_last5gw`, `pts_last3gw`, and `info.row.original.pts_gw_count` — all typed on ScoredPlayer via MergedPlayer inheritance |
| `src/components/value-gems/ValueGemsTable.tsx` | `src/components/value-gems/columns.tsx` | columnVisibility hides pts columns on mobile | VERIFIED | Column `id` values `pts_last5gw`/`pts_last3gw` in columns.tsx exactly match keys in ValueGemsTable.tsx columnVisibility object |
| `pipeline/run.py` | `pipeline/merge.py` | summaries passed to merge_players | VERIFIED | `run.py` line 86: `merged = merge_players(..., summaries=summaries)` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `columns.tsx` (Pts L5 cell) | `pts_last5gw` | `pipeline/merge.py` → `/api/players` → `usePlayers()` | Yes — computed from FPL element-summary `history` array via `run.py` summaries fetch loop | FLOWING |
| `columns.tsx` (Pts L3 cell) | `pts_last3gw` | Same pipeline path | Yes — same source as above | FLOWING |
| `columns.tsx` (asterisk) | `pts_gw_count` | `total_gws_available = len(history)` in merge.py | Yes — reflects actual history length | FLOWING |
| `gem-score.ts` (xg_score) | `xg_per90` | DQ-01 proxy in merge.py for unmatched players | Yes — real FPL `goals_scored`/`minutes` when Understat absent | FLOWING |

Data chain: `run.py` (fetches element summaries) → `merge_players()` (computes pts fields) → `merged_players.json` (cached) → `/api/players` route → `usePlayers()` hook → `computeAllGemScores()` → `ValueGemsTable` renders via `columns.tsx`.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| merge_players accepts summaries param | `python -c "from pipeline.merge import merge_players; import inspect; sig = inspect.signature(merge_players); assert 'summaries' in sig.parameters"` | Function signature verified via direct code read | PASS |
| DefCon threshold is 5 games | Code read of defcon.py line 39 | `if games_played < 5: continue` confirmed | PASS |
| TypeScript compiles cleanly | `npx tsc --noEmit` | No output (exit 0) | PASS |
| All 4 phase commits exist in git log | `git log --oneline` grep | 90f9eca, cd300f9, eef6f7e, 89f53ff all present | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DQ-01 | 19-01 | Players without Understat xG/xA data use FPL goals/assists as a proxy in the Gem score computation | SATISFIED | `merge.py` lines 313-321: proxy block; `gem-score.ts` consumes numeric xg_per90/xa_per90 from pipeline |
| DQ-02 | 19-01 | DefCon table minimum games threshold raised | SATISFIED | `defcon.py` line 39: `if games_played < 5: continue` |
| VG-01 | 19-01 | Pipeline computes pts_last3gw and pts_last5gw per player from FPL element-summary history | SATISFIED | `merge.py` lines 323-381: computation and dict output; `types.ts` lines 105-108: fields typed |
| VG-02 | 19-02 | Value Gems table shows three points columns: Total Pts, Pts (last 5 GW), Pts (last 3 GW) | SATISFIED | `columns.tsx` lines 49-75: three column defs; mobile visibility in `ValueGemsTable.tsx` line 38 |

All four requirement IDs (DQ-01, DQ-02, VG-01, VG-02) from PLAN frontmatter are accounted for. REQUIREMENTS.md marks all four as Complete for Phase 19. No orphaned requirements found.

---

### Anti-Patterns Found

None. No TODO/FIXME/PLACEHOLDER comments in any phase-modified files. No stub return patterns. No empty handler implementations. The old single `header: 'Pts'` column was correctly removed and replaced.

---

### Human Verification Required

#### 1. Asterisk Display on Partial-Window Players

**Test:** Open Value Gems table in a browser early in the season (or with test data where a player has fewer than 5 games played). Check that Pts L5 shows a number followed by `*`, and hovering shows the tooltip "N of 5 gameweeks".
**Expected:** Players with `pts_gw_count < 5` show asterisk notation; players with 5+ GWs do not.
**Why human:** Requires rendered UI and real/test pipeline data to verify conditional rendering fires in practice.

#### 2. Column Sort Ordering on Points Columns

**Test:** In the Value Gems table, click "Pts L5" column header to sort descending, then ascending. Verify rows reorder correctly by that column.
**Expected:** Descending sort puts highest Pts L5 value at top; ascending puts lowest at top.
**Why human:** TanStack Table sort wiring is correct in code but functional sort behavior requires browser interaction to confirm.

#### 3. Mobile Column Hiding

**Test:** Open Value Gems table in a viewport narrower than 640px (or browser devtools mobile emulation). Verify Pts L5 and Pts L3 columns disappear.
**Expected:** Only Player, Price, Own%, Total Pts, Gem, and Next 5 visible on mobile; Pos, Team, Pts L5, Pts L3, Trend hidden.
**Why human:** `isMobile` state uses `window.innerWidth` — requires browser resize event to trigger.

---

### Gaps Summary

None. All phase goals are achieved. All eight observable truths are verified at all four levels (exists, substantive, wired, data flowing). TypeScript compiles cleanly with zero errors. All four requirement IDs are satisfied with direct code evidence. All four commits exist in git history.

---

_Verified: 2026-04-02_
_Verifier: Claude (gsd-verifier)_
