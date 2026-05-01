---
phase: 29-regression-detector
verified: 2026-04-28T11:43:00Z
status: human_needed
score: 9/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open GemTable in browser and confirm Signal column renders BUY/SELL/em-dash correctly with tooltips, sort works, and column is hidden on portrait mobile"
    expected: "Green BUY pill with 'Consider buying' tooltip; amber SELL pill with 'Consider selling' tooltip; grey em-dash for no-signal players; ascending sort puts BUY first; column absent on portrait mobile"
    why_human: "Visual rendering, interactive sort behaviour, and responsive breakpoint behaviour cannot be verified programmatically without a running dev server"
---

# Phase 29: Regression Detector Verification Report

**Phase Goal:** User can spot buy opportunities (underperformers due to regress) and sell signals (overperformers likely to regress) based on actual vs expected goals and assists
**Verified:** 2026-04-28T11:43:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Pipeline computes regression_signal ('buy'\|'sell'\|None) from last 5 unique GW rounds in element-summary history | ✓ VERIFIED | `_compute_regression_signal()` at merge.py:331; last-5-unique-rounds logic at lines 354-357; BUY/SELL threshold at lines 378-383 |
| 2 | Players with fewer than 900 minutes in 5-GW window receive no signal (None) | ✓ VERIFIED | `total_mins < min_minutes: return None, None` at merge.py:363-364; min_minutes=900 default |
| 3 | delta = mean(actual G+A) - mean(xG+xA); BUY if delta < -0.5, SELL if delta > +0.5 | ✓ VERIFIED | Lines 370-383 in merge.py; `delta = round(mean_actual - mean_xgxa, 4)`; threshold comparisons exact |
| 4 | If summaries absent/fetch failed, regression fields are simply absent (D-03 graceful fallback) | ✓ VERIFIED | `if summaries and fpl_id in summaries:` guard at merge.py:747; comment confirms D-03 intent |
| 5 | MergedPlayer TS type has regression_signal?: 'buy' \| 'sell' \| null and actual_vs_xg_delta?: number \| null | ✓ VERIFIED | src/lib/types.ts:159-160; placed after xPts_components_1gw block |
| 6 | Vitest unit stubs for key invariants pass (integration skip + component todo stubs) | ✓ VERIFIED | `npx vitest run tests/lib/regression-signal.test.ts` → 7 passed, 5 skipped (0 failed) |
| 7 | User sees BUY green pill, SELL amber pill, em-dash for no-signal in Signal column | ✓ VERIFIED (code) / ? HUMAN | RegressionSignalBadge.tsx exports BUY (bg-green-100), SELL (bg-amber-100), em-dash (text-zinc-400); wired in columns.tsx cell renderer; visual rendering needs human confirm |
| 8 | Signal column is sortable with ascending=BUY first, descending=SELL first | ✓ VERIFIED (code) / ? HUMAN | sortingFn at columns.tsx:169-174 with order={sell:2, buy:0}, null=1; interactive sort needs human confirm |
| 9 | Signal column hidden on portrait mobile (D-06) | ✓ VERIFIED (code) / ? HUMAN | `signal: false` in MOBILE_HIDDEN_COLUMNS (GwToggle.tsx:19); breakpoint behaviour needs human confirm |
| 10 | Signal column appears after xPts_5gw and before trend column | ✓ VERIFIED | columns.tsx:160-175 inserts Signal between xPts_5gw (ends line 159) and col.display({id:'trend'}) at line 176 |

**Score:** 9/10 truths verified programmatically (Truth 7-9 pass code verification; interactive/visual behaviour requires human confirmation)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pipeline/merge.py` | `_compute_regression_signal()` helper + merge_players() integration | ✓ VERIFIED | Function at line 331; integration block at lines 743-755; D-01/D-02 deviation comments present |
| `src/lib/types.ts` | regression_signal and actual_vs_xg_delta optional fields on MergedPlayer | ✓ VERIFIED | Lines 159-160; correct types; after xPts_components_1gw block |
| `tests/lib/regression-signal.test.ts` | Integration skip tests + component render tests + placeholder | ✓ VERIFIED | 5 it.skip() integration tests + 6 component tests (all passing) + placeholder |
| `src/components/gem-table/RegressionSignalBadge.tsx` | BUY/SELL/em-dash badge component | ✓ VERIFIED | Exports RegressionSignalBadge; bg-green-100 BUY; bg-amber-100 SELL; text-zinc-400 em-dash; tooltips with "Consider buying"/"Consider selling" |
| `src/components/gem-table/columns.tsx` | Signal column definition with custom sortingFn | ✓ VERIFIED | RegressionSignalBadge import at line 6; col.accessor('regression_signal') at line 160; sortingFn at line 169 |
| `src/components/gem-table/GwToggle.tsx` | `signal: false` in MOBILE_HIDDEN_COLUMNS | ✓ VERIFIED | Line 19: `signal: false` as last entry |
| `src/components/gem-table/GemTable.tsx` | `signal: 'Signal'` in HIDDEN_COLUMN_LABELS | ✓ VERIFIED | Line 40: `signal: 'Signal'` as last entry |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `pipeline/merge.py _compute_regression_signal()` | `summaries[fpl_id]['history']` | `merge_players()` after xPts_components_1gw | ✓ WIRED | `summaries[fpl_id].get('history', [])` at line 749; guard at line 747 |
| `src/lib/types.ts MergedPlayer` | `regression_signal` field | Optional field declaration after xPts_components_1gw block | ✓ WIRED | types.ts:159 inside MergedPlayer closing brace |
| `columns.tsx Signal column` | `RegressionSignalBadge.tsx` | Cell renderer import at line 6 | ✓ WIRED | Import confirmed; cell at lines 162-166 passes signal + delta props |
| `GwToggle.tsx MOBILE_HIDDEN_COLUMNS` | `getColumnVisibility()` spread | `{ ...MOBILE_HIDDEN_COLUMNS, ...gwVisibility }` | ✓ WIRED | signal:false in map; getColumnVisibility() spreads MOBILE_HIDDEN_COLUMNS (GwToggle.tsx:30-33) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `RegressionSignalBadge.tsx` | `signal` prop | `columns.tsx info.getValue()` → `regression_signal` field from `merged_players.json` | Yes — computed by `_compute_regression_signal()` from FPL element-summary history | ✓ FLOWING |
| `RegressionSignalBadge.tsx` | `delta` prop | `columns.tsx info.row.original.actual_vs_xg_delta` from `merged_players.json` | Yes — computed as `round(mean_actual - mean_xgxa, 4)` by pipeline | ✓ FLOWING |

**Note:** Data flows from FPL element-summary → `summaries` dict → `_compute_regression_signal()` → `merged_players.json` → `/api/players` → `usePlayers()` hook → `GemTable` → Signal column cell renderer → `RegressionSignalBadge`. No intermediate static values; badge renders em-dash when fields absent (correct for players below 900-min gate or when pipeline hasn't run yet).

### Behavioral Spot-Checks

Step 7b skipped — the Signal column behaviour requires a running dev server and browser interaction to verify the visual rendering and sort interaction. Tests confirm code-level correctness.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Vitest test suite passes | `npx vitest run tests/lib/regression-signal.test.ts` | 7 passed, 5 skipped, 0 failed | ✓ PASS |
| TypeScript compiler clean | `npx tsc --noEmit` | No output (exit 0) | ✓ PASS |
| `_compute_regression_signal` defined once in merge.py | `grep -c "def _compute_regression_signal(" pipeline/merge.py` | 1 | ✓ PASS |
| regression_signal wired in merge_players() | `grep -c "regression_signal" pipeline/merge.py` | 3 (function def + 2 in integration block) | ✓ PASS |
| Signal column imports badge component | `grep -n "RegressionSignalBadge" src/components/gem-table/columns.tsx` | 2 lines (import + JSX) | ✓ PASS |
| All documented commits exist | `git log 84b25c6 5f950e6 ba4703d a7a3cd9 fe688d4` | All 5 commits present | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DATA-03 | 29-01-PLAN.md | System fetches and stores per-match xG/xA per player (from Understat per REQUIREMENTS.md wording) | ✓ SATISFIED (with documented deviation) | Per-match xG/xA is fetched from FPL element-summary (StatsBomb model) instead of Understat — data source changed per D-01/D-02 research finding; deviation documented in ROADMAP.md cross-cutting constraints, 29-RESEARCH.md, both PLAN frontmatter, and merge.py code comments. Intent of DATA-03 (per-match xG/xA enabling regression detection) is fully met. REQUIREMENTS.md wording predates the research finding. |
| REG-01 | 29-01-PLAN.md, 29-02-PLAN.md | User can see a buy signal on players whose actual goals/assists are below their xG/xA over last 5-10 GW (min 900 min) | ✓ SATISFIED | BUY signal computed in merge.py; RegressionSignalBadge renders green pill; Signal column wired; component tests pass; human verify checkpoint approved per 29-02-SUMMARY.md |
| REG-02 | 29-01-PLAN.md, 29-02-PLAN.md | User can see a sell signal on players whose actual goals/assists are above their xG/xA over last 5-10 GW (min 900 min) | ✓ SATISFIED | SELL signal computed in merge.py; RegressionSignalBadge renders amber pill; Signal column wired; component tests pass; human verify checkpoint approved per 29-02-SUMMARY.md |

**Orphaned requirements check:** REQUIREMENTS.md maps DATA-03, REG-01, REG-02 to Phase 29. All three are claimed by plan frontmatter. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | No TODOs, FIXMEs, stubs, or placeholder returns detected in any Phase 29 modified file | — | — |

**Integration condition deviation (informational):**
- PLAN behavior spec said write fields when `reg_signal is not None or reg_delta is not None`
- Actual code at merge.py:753 writes only when `reg_signal is not None`
- Effect: neutral-zone players (delta in [-0.5, +0.5], gate passed) have fields absent, not null
- The badge handles absent fields (`undefined`) and `null` identically (both render em-dash), so user-visible behaviour is identical
- The code comment explicitly documents this as intentional: "Neutral-zone must produce absent fields per D-03"
- Classification: INFO — intentional refinement, not a bug

### Human Verification Required

### 1. Signal Column Visual Rendering

**Test:** Start dev server (`npm run dev`), navigate to the Gems tab, and inspect the Signal column.
**Expected:**
- Players with a BUY signal show a green pill labeled "BUY"
- Players with a SELL signal show an amber/orange pill labeled "SELL"
- Players with no signal show a grey em-dash (—), not blank
- Signal column header reads "Signal" and appears after the xPts columns, before the Price Trend column
**Why human:** Visual rendering requires browser; automated tests confirm code correctness but not pixel-level display

### 2. Tooltip Content

**Test:** Hover over a BUY badge and a SELL badge.
**Expected:**
- BUY tooltip contains "xG+xA", "last 5 GW", and "Consider buying"
- SELL tooltip contains "xG+xA", "last 5 GW", and "Consider selling"
- Delta value (e.g. "-0.67 per match") is shown in the tooltip
**Why human:** HTML title attribute tooltip display requires browser hover interaction

### 3. Sort Behaviour

**Test:** Click the Signal column header once (ascending), then again (descending), then once more (reset).
**Expected:**
- Ascending: BUY players sort to the top
- Descending: SELL players sort to the top
- Third click: returns to default gem_score order
- Players with no signal stay in the middle position in both sort directions
**Why human:** TanStack Table sort interaction requires browser

### 4. Mobile Portrait Visibility

**Test:** Open in DevTools responsive mode at ~390px width portrait (or on a physical mobile device).
**Expected:** Signal column is NOT visible on portrait mobile; column reappears when rotated to landscape (if supported) or on desktop
**Why human:** CSS responsive breakpoint behaviour requires browser rendering

**Note:** If the pipeline has not been run since Phase 29 went live, all players will show em-dash (—). This is correct expected behaviour. Run `python pipeline/run.py` to generate signals, then refresh, before verifying BUY/SELL badges.

### Gaps Summary

No blocking gaps found. All pipeline, type, component, and wiring artefacts are substantive and correctly connected.

The DATA-03 "from Understat" clause in REQUIREMENTS.md is a stale wording issue — the implementation uses FPL element-summary (StatsBomb model) per the documented D-01/D-02 research deviation, which achieves the same functional intent (per-match xG/xA data enabling regression detection). This deviation is explicitly acknowledged in ROADMAP.md cross-cutting constraints.

Status is `human_needed` solely because visual rendering, tooltip display, interactive sort, and mobile responsive behaviour cannot be verified without a running browser session. The 29-02-SUMMARY.md records that the human verify checkpoint was approved by the user on 2026-04-28 — this verification report requests confirmation of that approval via a fresh browser check.

---

_Verified: 2026-04-28T11:43:00Z_
_Verifier: Claude (gsd-verifier)_
