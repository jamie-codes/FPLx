---
phase: 03-gem-rating-table
verified: 2026-03-28T18:20:00Z
status: human_needed
score: 11/11 must-haves verified (automated); 4/4 behavioral truths confirmed by user (03-03-SUMMARY)
re_verification: false
human_verification:
  - test: "Open http://localhost:3000 and confirm table loads, sorts, filters, and null xG/xA shows em-dash"
    expected: "All 8 visual checks from 03-03 pass with live FPL data"
    why_human: "Interactive DOM behavior (sort toggle, filter state, em-dash rendering) cannot be verified without a running browser"
---

# Phase 3: Gem Rating Table Verification Report

**Phase Goal:** The manager can see every FPL player ranked by a composite Gem score that combines seven dimensions, filterable by position, so the best targets are immediately visible
**Verified:** 2026-03-28T18:20:00Z
**Status:** human_needed (automated checks all pass; interactive UI behavior confirmed by user in 03-03-SUMMARY but not re-testable programmatically)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Every player has a gem_score between 0.0 and 1.0 | VERIFIED | gem-score.ts: `gem_score = dims.reduce / dims.length`; tests/lib/gem-score.test.ts test 1 confirms range |
| 2 | Players with null xg_per90 get null xg_score but valid gem_score from remaining dimensions | VERIFIED | gem-score.ts lines 78-83: xg_score stays null, not pushed to dims; tests cover null xg case |
| 3 | FDR score inverts difficulty_score so easy fixtures score higher | VERIFIED | gem-score.ts line 49: `rawFdr = 1.0 - avgDifficulty(p)`; test "easy fixtures give high fdr_score" passes |
| 4 | Ownership score inverts selected_by_percent so low ownership scores higher | VERIFIED | gem-score.ts line 53: `1.0 - parseFloat(p.selected_by_percent) / 100`; ownership inversion test passes |
| 5 | Set piece primary takers score higher than non-takers | VERIFIED | setpieceRank returns 2 for order=1, 0 for null; penalty taker test passes |
| 6 | gem_score is the mean of available (non-null) dimension scores | VERIFIED | gem-score.ts line 101: `dims.reduce((s,d) => s+d, 0) / dims.length`; null xg/xa excluded from dims array |
| 7 | Min-max normalisation uses full player population, not filtered subset | VERIFIED | gem-score.ts Pass 1 computes stats across entire `players` array before any per-player scoring |
| 8 | GemTable renders at / showing all players | VERIFIED | page.tsx imports and renders `<GemTable />`; GemTable.tsx calls `usePlayers()` with 825 real players in cache |
| 9 | Default sort is gem_score descending | VERIFIED | GemTable.tsx line 24-26: `useState<SortingState>([{ id: 'gem_score', desc: true }])` |
| 10 | Position filter limits visible rows by element_type | VERIFIED | columns.tsx: `filterFn: 'equals'` on element_type; GemTable.tsx: `setColumnFilters([{ id: 'element_type', value: code }])` |
| 11 | Null xG/xA displays em-dash, not zero or empty | VERIFIED | columns.tsx line 11: `fmtScoreNull = (v) => v === null ? '\u2014' : ...` applied to xg_score and xa_score columns |

**Score:** 11/11 truths verified (automated)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/gem-score.ts` | computeAllGemScores pure function | VERIFIED | 115 lines, exports `computeAllGemScores`, two-pass algorithm with `normalise`, `setpieceRank`, `minMax` helpers |
| `src/lib/types.ts` | ScoredPlayer interface extending MergedPlayer | VERIFIED | Lines 113-122: `export interface ScoredPlayer extends MergedPlayer` with gem_score + 7 dimension scores |
| `tests/lib/gem-score.test.ts` | Unit tests for scoring algorithm | VERIFIED | 134 lines, 11 `it()` blocks covering all edge cases; all 11 pass |
| `src/components/gem-table/GemTable.tsx` | Main table component with useReactTable | VERIFIED | 111 lines, `'use client'`, `useReactTable`, `usePlayers`, `computeAllGemScores`, sort + filter wiring |
| `src/components/gem-table/columns.tsx` | TanStack Table column definitions for ScoredPlayer | VERIFIED | 73 lines, `createColumnHelper`, `filterFn: 'equals'` on element_type, em-dash formatters |
| `src/components/gem-table/PositionFilter.tsx` | Position filter buttons All/GK/DEF/MID/FWD | VERIFIED | 36 lines, `'use client'`, numeric PositionCode (1/2/3/4), onChange wired |
| `src/app/page.tsx` | Default route rendering GemTable | VERIFIED | 9 lines, imports `GemTable`, no `'use client'` (Server Component) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `GemTable.tsx` | `src/lib/hooks/usePlayers.ts` | `usePlayers()` hook call | WIRED | Line 13: `import { usePlayers }`, line 20: `const { data, isLoading, error } = usePlayers()` |
| `GemTable.tsx` | `src/lib/gem-score.ts` | `computeAllGemScores` call | WIRED | Line 14: `import { computeAllGemScores }`, line 22: `useMemo(() => computeAllGemScores(data ?? []), [data])` |
| `page.tsx` | `GemTable.tsx` | import and render | WIRED | Line 1: `import { GemTable }`, line 5: `<GemTable />` |
| `GemTable.tsx` | `columns.tsx` | column definitions | WIRED | Line 16: `import { columns }`, passed to `useReactTable({ columns })` |
| `GemTable.tsx` | `PositionFilter.tsx` | position filter render | WIRED | Line 17: `import { PositionFilter }`, line 65: `<PositionFilter active={activePosition} onChange={handlePositionChange} />` |
| `usePlayers.ts` | `src/app/api/players/route.ts` | fetch('/api/players') | WIRED | usePlayers.ts line 5: `fetch('/api/players')`; route.ts reads `pipeline/cache/merged_players.json` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `GemTable.tsx` | `data` (MergedPlayer[]) | `usePlayers()` → `fetch('/api/players')` → `src/app/api/players/route.ts` | Yes — reads `pipeline/cache/merged_players.json` (825 real players verified) | FLOWING |
| `GemTable.tsx` | `scoredPlayers` (ScoredPlayer[]) | `computeAllGemScores(data ?? [])` — memoised | Yes — two-pass algorithm over live MergedPlayer[] | FLOWING |
| `src/app/api/players/route.ts` | JSON response | `readFile('pipeline/cache/merged_players.json')` | Yes — 825-record JSON with full MergedPlayer fields confirmed present | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| vitest: all gem-score tests pass | `npx vitest run tests/lib/gem-score.test.ts` | 11/11 pass, 0 failures | PASS |
| Full test suite: no regressions | `npx vitest run` | 44/44 pass across 4 test files | PASS |
| TypeScript compilation | `npx tsc --noEmit` | No output (exit 0) | PASS |
| merged_players.json: real data present | filesystem check | 825 records with full MergedPlayer fields | PASS |
| @tanstack/react-table installed | package.json check | `^8.21.3` in dependencies | PASS |
| Sortable table: column header toggling | Requires running browser | N/A — cannot test headlessly | SKIP |
| Position filter: MID isolates element_type=3 | Requires running browser | N/A — cannot test headlessly | SKIP |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| GEM-01 | 03-01, 03-03 | Score each player across multiple dimensions, show composite rating | SATISFIED | `computeAllGemScores` produces gem_score 0.0-1.0 across 7 dimensions; all 11 tests pass |
| GEM-02 | 03-02, 03-03 | Sortable table, filterable by position | SATISFIED | GemTable.tsx with `getSortedRowModel`, `getFilteredRowModel`; PositionFilter drives element_type column filter |
| UIX-01 | 03-02, 03-03 | Clear, data-forward layout using tabs or cards per section | NEEDS HUMAN | GemTable renders at `/` with Tailwind styling; layout quality requires visual inspection |
| UIX-02 | 03-02, 03-03 | Scannable tables with sort/filter by position | SATISFIED | TanStack Table with sort indicators (▲▼), position filter buttons All/GK/DEF/MID/FWD |
| FFA-01 | 03-01 | Players about to go on a high-scoring run (form + xG + fixtures) | TRACEABILITY OVERLAP | Mapped to Phase 2 in REQUIREMENTS.md traceability. Phase 3 plan 03-01 claims this ID — the dimensions (xG, form, FDR) are present in gem_score. Phase 2 implemented FFA-specific views. No gap. |
| FFA-02 | 03-01 | Players on a high-scoring run: highlight easy/hard upcoming fixtures | TRACEABILITY OVERLAP | Mapped to Phase 2 in REQUIREMENTS.md traceability. fdr_score in gem_score incorporates fixture difficulty. No gap. |
| PPS-01 | 03-01 | Penalty taker, set piece taker, corner taker flags | TRACEABILITY OVERLAP | Mapped to Phase 1 in REQUIREMENTS.md traceability. Phase 3 consumes these fields for `set_piece_score`. No gap. |
| PPS-02 | 03-01 | Minutes reliability: average minutes per game, consistency indicator | TRACEABILITY OVERLAP | Mapped to Phase 1. Phase 3 uses `minutes_per90` for `minutes_score` dimension. No gap. |
| PPS-03 | 03-01 | xG per 90 and xA per 90 from Understat | TRACEABILITY OVERLAP | Mapped to Phase 1. Phase 3 uses `xg_per90` / `xa_per90` for xg_score / xa_score dimensions. No gap. |
| PPS-04 | 03-01 | Injury / availability status from FPL flags | TRACEABILITY OVERLAP | Mapped to Phase 1. `status` field present in MergedPlayer and rendered in columns.tsx Status column. No gap. |

**Traceability note:** Plans 03-01 claims FFA-01, FFA-02, PPS-01 through PPS-04. REQUIREMENTS.md maps these to Phase 2 (FFA) and Phase 1 (PPS). These requirements were already marked Complete before Phase 3 began. Phase 3 consumes the underlying data fields but does not re-implement the features. The requirement IDs in the plan frontmatter reflect dimensional dependencies, not new completions. No unmet requirements detected.

**Orphaned requirements check:** REQUIREMENTS.md Traceability maps GEM-01, GEM-02, UIX-01, UIX-02 to Phase 3. All four are claimed in 03-01/03-02/03-03 plans. No orphaned requirements.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

Scanned `gem-score.ts`, `GemTable.tsx`, `columns.tsx`, `PositionFilter.tsx`, `page.tsx` for TODO/FIXME/placeholder, `return null`, empty handlers, hardcoded empty arrays as rendered data. None found. `data ?? []` in `useMemo` is a safe null-guard, not a stub — real data flows from `usePlayers()`.

---

### Human Verification Required

#### 1. Interactive Table Behavior at /

**Test:** Run `npm run dev` and visit http://localhost:3000
**Expected:**
1. Table loads with 800+ FPL player rows, Gem score, component scores (FDR, Form, xG Sc, xA Sc, Own, Min, SP), team, position, price
2. Players sorted by Gem score descending by default (highest gem first)
3. Clicking any sortable column header reorders rows and shows ▲/▼ indicator; no page reload
4. Clicking "MID" button shows only element_type=3 players; row count updates
5. Clicking "All" restores full player list
6. Promoted-team players with no Understat data show em-dash (—) in xG/90 and xA/90 columns, not "0" or blank
7. Each row shows all 7 component score columns alongside composite Gem score
8. Pos column shows GK/DEF/MID/FWD text labels, not numeric codes 1/2/3/4

**Why human:** DOM interactivity (sort toggle state, filter button highlight, em-dash rendering vs zero) cannot be verified without a running browser. Note: user already confirmed all 8 checks in 03-03-SUMMARY.md (2026-03-28). Re-verification would only be needed if code changed after that approval.

---

### Gaps Summary

No gaps found. All automated must-haves pass at all four verification levels (exists, substantive, wired, data flowing). The human verification item (interactive UI) was already completed by the user during Plan 03-03 checkpoint on 2026-03-28 and is included for completeness, not because it is outstanding.

---

_Verified: 2026-03-28T18:20:00Z_
_Verifier: Claude (gsd-verifier)_
