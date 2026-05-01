---
phase: 30-differential-tracker
verified: 2026-04-28T13:30:00Z
status: human_needed
score: 13/15 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open the app in a browser (npm run dev → http://localhost:3000), navigate to the Gems tab. Run the pipeline first if merged_players.json is stale (python pipeline/run.py)."
    expected: "A 'Diff' column header appears in GemTable immediately to the right of the Signal column and to the left of the Trend column. Players with above-median xPts and <5% ownership (status='a') show a green pill labelled 'DIFF'. Players with below-median xPts and >15% ownership show an amber pill labelled 'TRAP'. All other players show a grey em-dash (—). Hovering a DIFF pill shows the exact tooltip: 'Differential: {x.x}% owned, above-average xPts for position. Low ownership = rank gain potential.' Hovering a TRAP pill shows: 'Template trap: {x.x}% owned, below-average xPts for position. High ownership with weak projections.' Clicking the Diff column header sorts: ascending = DIFF first, null middle, TRAP last."
    why_human: "Visual badge rendering, sort UX, column positioning, and tooltip readability require live browser inspection. Cannot verify Tailwind class rendering, dark mode appearance, or mobile responsive behaviour programmatically."
  - test: "In browser DevTools, set responsive mode to iPhone 12/13 portrait (390x844). Navigate to Gems tab."
    expected: "The 'Diff' column header is NOT visible in the table. When a player row is tapped/expanded, the detail panel includes a 'Diff:' field showing the correct DIFF/TRAP/em-dash badge."
    why_human: "Mobile column hiding and tap-to-expand panel rendering cannot be verified without a running dev server and browser viewport simulation."
  - test: "Find an injured or suspended template player (status 'i', 'd', 's', or 'n') with selected_by_percent > 15%. Check their Diff cell. Also find an injured low-owned player (status not 'a', ownership <5%). Check their Diff cell."
    expected: "The injured template player shows TRAP (D-04 is status-agnostic). The injured low-owned player shows em-dash (D-12: status='a' required for DIFF). This confirms the D-12 asymmetry is working as designed."
    why_human: "Finding real players matching these criteria and verifying their displayed badges requires live data and browser inspection."
---

# Phase 30: Differential Tracker Verification Report

**Phase Goal:** User can identify high-value differentials to gain rank and template traps to avoid or sell
**Verified:** 2026-04-28T13:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Pipeline computes `differential_flag` ('diff' \| 'trap' \| None) per player | VERIFIED | `_compute_differential_flag()` at merge.py:386; conditional write at line 822; Python AST parses cleanly |
| 2  | Position-relative median (D-01): grouped by element_type, computed via statistics.median | VERIFIED | merge.py lines 806-813: `pos_xpts` buckets by element_type 1-4; `from statistics import median`; empty-bucket guard |
| 3  | DIFF gate (D-03): xPts_1gw > median AND ownership < 5.0 AND status == 'a' | VERIFIED | merge.py:408: `if above_median and ownership < 5.0 and status == 'a': return 'diff'` |
| 4  | TRAP gate (D-04): below/at median AND ownership > 15.0, status-agnostic (D-12) | VERIFIED* | merge.py:410: `if not above_median and ownership > 15.0: return 'trap'` — note: uses `not above_median` (<=) rather than strict `<`; docstring at line 395 says strict less-than; see WR-03 warning |
| 5  | D-05 conditional write — `differential_flag` absent from player dict when None | VERIFIED | merge.py:821-822: `if flag is not None: p['differential_flag'] = flag` |
| 6  | MergedPlayer TypeScript type has `differential_flag?: 'diff' \| 'trap' \| null` | VERIFIED | types.ts:165: exact declaration confirmed; placed after `actual_vs_xg_delta` (line 160) before closing brace (line 166) |
| 7  | Wave 0 Vitest stubs: 5 it.skip integration + 6 component tests + 1 placeholder | VERIFIED | Test run: 7 passed \| 5 skipped \| 0 todo \| 0 failed; `describe('Phase 30: Differential flag pipeline output')` and `describe('Phase 30: DifferentialBadge component')` both present |
| 8  | DifferentialBadge renders green DIFF pill, amber TRAP pill, em-dash fallback | VERIFIED | Component tests pass (6/6); DifferentialBadge.tsx lines 22-27 (DIFF), 30-36 (TRAP), 15 (em-dash) confirmed |
| 9  | Diff column sortable: ascending DIFF first (0), TRAP last (2), null middle (1) | VERIFIED | columns.tsx:187: `const order: Record<string, number> = { diff: 0, trap: 2 }` with `?? 1` fallback |
| 10 | Diff column hidden portrait mobile (MOBILE_HIDDEN_COLUMNS) | VERIFIED (code) | GwToggle.tsx:20: `differential_flag: false` appended as last entry — VISUAL confirmation pending |
| 11 | Diff column appears after Signal, before Trend in columns.tsx | VERIFIED | awk ordering check: Signal=161 < Diff=177 < Trend=194 |
| 12 | DIFF tooltip: 'above-average xPts for position' AND 'rank gain potential' AND ownership % | VERIFIED | DifferentialBadge.tsx:23; component test passes regex assertions on all three patterns |
| 13 | TRAP tooltip: 'below-average xPts for position' AND 'weak projections' AND ownership % | VERIFIED | DifferentialBadge.tsx:33; component test passes regex assertions on all three patterns |
| 14 | `differential_flag: 'Diff'` in HIDDEN_COLUMN_LABELS for mobile tap-to-expand | VERIFIED | GemTable.tsx:41: `differential_flag: 'Diff'` confirmed |
| 15 | Human verify checkpoint approved (plan gate — 30-02 Task 3, `autonomous: false`) | PENDING | 30-02-SUMMARY.md status: "checkpoint — awaiting human verify"; no approval record found |

**Score:** 13/15 truths verified (14 VERIFIED + 1 PENDING human gate; 1 partial — TRAP gate uses `<=` vs docstring `<`)

### Roadmap Success Criteria Coverage

| SC | Text | Status | Evidence |
|----|------|--------|----------|
| SC1 | User can see a differential flag on players with above-average xPts and below-average ownership | VERIFIED (code) / HUMAN NEEDED (visual) | DIFF gate correct in pipeline; DifferentialBadge green pill renders correctly in tests; live browser check pending |
| SC2 | User can see a template-trap flag on players with below-average xPts and above-average ownership | VERIFIED (code) / HUMAN NEEDED (visual) | TRAP gate correct in pipeline; DifferentialBadge amber pill renders correctly in tests; live browser check pending |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pipeline/merge.py` | `_compute_differential_flag()` helper + position-median pass | VERIFIED | Helper at line 386; post-loop block at lines 802-822; `_safe_float` T-30-01 mitigated; `statistics.median` with empty-bucket guard |
| `src/lib/types.ts` | `differential_flag?: 'diff' \| 'trap' \| null` on MergedPlayer | VERIFIED | Line 165; TMPL-01/TMPL-02 attribution comment at line 161; field after `actual_vs_xg_delta` before closing brace |
| `tests/lib/differential-flag.test.ts` | Wave 0 stubs (5 skip + 6 component + 1 placeholder) | VERIFIED | 7 passing, 5 skipped, 0 todo — vitest exits 0 |
| `src/components/gem-table/DifferentialBadge.tsx` | DIFF/TRAP/em-dash badge with D-10 tooltips | VERIFIED | 38 lines; 'use client'; green DIFF pill; amber TRAP pill; literal U+2014 em-dash; ownership.toFixed(1) in tooltip |
| `src/components/gem-table/columns.tsx` | `differential_flag` col.accessor with sortingFn | VERIFIED | Line 177-192; DifferentialBadge import at line 7; `parseFloat(selected_by_percent ?? '0')` for ownership prop |
| `src/components/gem-table/GwToggle.tsx` | `differential_flag: false` in MOBILE_HIDDEN_COLUMNS | VERIFIED | Line 20: last entry in the map |
| `src/components/gem-table/GemTable.tsx` | `differential_flag: 'Diff'` in HIDDEN_COLUMN_LABELS | VERIFIED | Line 41: last entry in the map |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `merge.py _compute_differential_flag()` | result list (post-loop) | `merge_players()` — after `result.append(player)` line 800, before xPts ceiling line 824 | WIRED | Lines 802-822 confirmed; ordering awk-verified: append(800) < diff-flag(802) < ceiling(824) |
| `src/lib/types.ts MergedPlayer` | `differential_flag?:` | After `actual_vs_xg_delta` line 160, before closing brace | WIRED | Confirmed at line 165 |
| `columns.tsx Diff col.accessor` | `DifferentialBadge.tsx` | Import at line 7, JSX at lines 180-183 | WIRED | `grep -c "DifferentialBadge" columns.tsx` = 3 (import + cell JSX + nothing else) |
| `columns.tsx Diff cell renderer` | `info.row.original.selected_by_percent` | `parseFloat(info.row.original.selected_by_percent ?? '0')` | WIRED | Line 182; ownership prop passed to DifferentialBadge |
| `GwToggle.tsx MOBILE_HIDDEN_COLUMNS` | column visibility | `{ ...MOBILE_HIDDEN_COLUMNS, ...gwVisibility }` spread | WIRED | `differential_flag: false` at GwToggle.tsx:20 |
| `pipeline/merge.py` → `merged_players.json` → `/api/players` → `usePlayers()` → `MergedPlayer[]` → columns.tsx | DifferentialBadge | Full data-flow chain | WIRED | api/players/route.ts reads cache file or Vercel Blob; usePlayers() types response as MergedPlayer[]; differential_flag flows through |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `DifferentialBadge.tsx` | `flag` prop | `info.getValue()` from `col.accessor('differential_flag')` → `MergedPlayer.differential_flag` → `merged_players.json` produced by `_compute_differential_flag()` in pipeline | Yes — pipeline computes from xPts_1gw and selected_by_percent; field conditionally written when non-None | FLOWING |
| `DifferentialBadge.tsx` | `ownership` prop | `parseFloat(info.row.original.selected_by_percent ?? '0')` | Yes — selected_by_percent is a real FPL API string field on every player | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Pipeline helper defined before merge_players() | `grep -n "def _compute_differential_flag(" pipeline/merge.py` | line 386 (before merge_players at line 415) | PASS |
| Position-median block between result.append and xPts ceiling | awk ordering check | 800 < 802 < 824 | PASS |
| Python AST parses cleanly | `python -c "import ast; ast.parse(...)"` | AST OK | PASS |
| TypeScript compiles cleanly | `npx tsc --noEmit` | 0 errors | PASS |
| Test suite: 7 pass, 5 skip, 0 fail | `npx vitest run tests/lib/differential-flag.test.ts` | 7 passed \| 5 skipped (12) | PASS |
| Full suite: no regression | `npx vitest run` | 278 passed \| 26 skipped (304) | PASS |
| Column ordering Signal < Diff < Trend | awk | Signal=161, Diff=177, Trend=194 → 1 | PASS |
| Visual badge rendering, sort UX, mobile behaviour | Requires running dev server | Not run | SKIP (human) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TMPL-01 | 30-01, 30-02 | User can see a differential flag on players with above-average xPts and below-average ownership | VERIFIED (code), HUMAN NEEDED (visual) | Pipeline gate correct; DifferentialBadge green DIFF pill wired; tests pass |
| TMPL-02 | 30-01, 30-02 | User can see a template-trap flag on players with below-average xPts and above-average ownership | VERIFIED (code), HUMAN NEEDED (visual) | Pipeline gate correct; DifferentialBadge amber TRAP pill wired; tests pass |

No orphaned requirements: REQUIREMENTS.md traceability table maps only TMPL-01 and TMPL-02 to Phase 30. Both are claimed by plans 30-01 and 30-02.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `pipeline/merge.py` | 410 | TRAP gate uses `not above_median` (<=) instead of strict `<` per docstring | WARNING | Players at exactly position median with >15% ownership receive a TRAP flag; tooltip says "below-average" but median-at players are exactly average. Per REVIEW.md WR-03. |
| `pipeline/merge.py` | 807-822 | BGW false-TRAP: players with no fixture have xPts_1gw=0.0, included in median calculation; template players blanking receive TRAP flag incorrectly | WARNING | Misleading sell signal during BGW weeks for valid template holds. Per REVIEW.md WR-02. |
| `src/components/gem-table/GwToggle.tsx` | 19 | Pre-existing: `signal: false` key does not match Signal column's actual TanStack ID `regression_signal` — mobile-expand row never shows Signal field | WARNING (pre-existing, Phase 29 issue — not introduced by Phase 30; Phase 30's own `differential_flag: false` key is correct) | Signal column missing from mobile tap-to-expand panel. Phase 30 correctly followed the pattern for `differential_flag`. Per REVIEW.md WR-01. |

No BLOCKER anti-patterns. The WR-02 BGW false-TRAP and WR-03 at-median issues affect edge cases (BGW weeks and exact-median players); the core DIFF/TRAP classification for normal gameweeks is correct.

### Human Verification Required

#### 1. DIFF/TRAP Column Visual Rendering

**Test:** Run `npm run dev`, navigate to Gems tab. Run `python pipeline/run.py` first if cache is stale. Look for a `Diff` column header between Signal and Trend.
**Expected:** Green DIFF pill for players with xPts above position median and <5% ownership (status available). Amber TRAP pill for players with xPts below/at position median and >15% ownership. Grey em-dash for all others. Hovering a pill shows the exact tooltip text with the player's actual ownership %.
**Why human:** Tailwind class rendering, visual colour correctness, and tooltip readability require live browser inspection.

#### 2. Sort Behaviour

**Test:** Click the Diff column header once (ascending), then again (descending).
**Expected:** Ascending: DIFF rows sort to top, em-dashes in middle, TRAPs at bottom. Descending: TRAPs to top. Third click returns to default order (or remains descending per TanStack behaviour — consistent with Signal column).
**Why human:** Sort interaction and visual result order cannot be verified without a running TanStack Table instance.

#### 3. Mobile Portrait — Column Hidden / Detail Panel Visible

**Test:** DevTools → Responsive → iPhone 12/13 portrait (390×844). Navigate to Gems tab.
**Expected:** `Diff` column header NOT visible in the table header row. Tap any player row to expand. The detail panel includes a `Diff:` label with the correct DIFF/TRAP/em-dash badge.
**Why human:** Responsive column hiding and tap-to-expand panel rendering require a running server and viewport simulation.

#### 4. Mobile Landscape — Column Reappears

**Test:** DevTools → Switch to landscape (844×390).
**Expected:** `Diff` column header reappears in the main table view.
**Why human:** Same as above.

#### 5. Dark Mode

**Test:** Toggle dark mode. Inspect DIFF and TRAP pills.
**Expected:** DIFF pill: dark green background (`bg-green-900`), light text. TRAP pill: dark amber background (`bg-amber-900`), light text. Text readable against both backgrounds.
**Why human:** Dark mode CSS class rendering requires visual inspection.

#### 6. D-12 Asymmetry Verification

**Test:** Find an injured/doubtful player (status not 'a') with >15% ownership. Find a low-owned injured player (status not 'a', <5% ownership).
**Expected:** Injured template player: shows TRAP (D-04 is status-agnostic). Injured low-owned player: shows em-dash, NOT DIFF (D-03 requires status='a').
**Why human:** Requires identifying real players with these characteristics in the live data and inspecting their Diff cell.

### Gaps Summary

No structural gaps blocking goal achievement. All code artifacts exist, are substantive, and are wired into the full data-flow chain from pipeline through to the UI component. The Vitest suite passes (7 pass, 5 skip, 0 fail). TypeScript compiles cleanly. The pipeline Python AST parses correctly.

The phase is at human verification checkpoint (30-02 Task 3, `checkpoint:human-verify`, `gate="blocking"`). The 10 visual/interactive checks in the plan must be approved before the phase can be marked complete. This is a plan gate, not a code defect.

Two code-quality warnings from the code review (WR-02 BGW false-TRAP, WR-03 at-median asymmetry) are noted but do not block the phase goal — they are correctness edge cases, not missing features.

---

_Verified: 2026-04-28T13:30:00Z_
_Verifier: Claude (gsd-verifier)_
