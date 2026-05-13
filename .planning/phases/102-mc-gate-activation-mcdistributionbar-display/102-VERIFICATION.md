---
phase: 102-mc-gate-activation-mcdistributionbar-display
verified: 2026-05-13T13:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "After the next daily GitHub Actions pipeline run, open the xPts hover card for any player with MC data populated (blank_prob/haul_prob/p10_pts/p90_pts non-null in merged_players.json) and confirm the teal MCDistributionBar renders with P10 left-label, P90 right-label, and conditional amber Haul% row when haulProb >= 0.40"
    expected: "Bar visible with numeric P10/P90 labels. Haul% row with amber colour shown above threshold, absent below. Blank%/Haul%/Floor/Ceiling text labels no longer present."
    why_human: "MC fields are currently undefined in production (mc_enabled gate flip is in code but next pipeline run has not executed). Visual bar layout and colour cannot be confirmed without a live pipeline run writing non-null MC fields to Vercel Blob."
  - test: "After the next daily pipeline run, open CaptainPicksPanel and confirm each candidate row shows 'X.X pts (C) · Y.Y–Z.Z' with the range values being the raw (undoubled) P10/P90"
    expected: "Range span visible in muted text-xs zinc-400 styling, en-dash separator, values to 1 decimal place. pts (C) span still shows the doubled value. Range absent when MC fields undefined."
    why_human: "Same dependency on pipeline run populating non-null MC fields in merged_players.json."
---

# Phase 102: MC Gate Activation & MCDistributionBar Display Verification Report

**Phase Goal:** Activate the MC pipeline gate (MC_ENABLED = True) and surface MC simulation data through two UI components — MCDistributionBar in the XPtsCell hover card and P10/P90 inline range in CaptainPicksPanel.
**Verified:** 2026-05-13T13:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can hover any player's xPts cell and see MC data via MCDistributionBar (rendered only when MC props defined) | ✓ VERIFIED | `MCDistributionBar` imported and used in `columns.tsx` line 12 / 144; `showMC` guard at lines 95–99 enforces all-4-props-defined before render; 17/17 columns.test.tsx tests pass including gate-off silence test |
| 2 | User can see a P10/P90 pts range on each captain picks card row | ✓ VERIFIED | Conditional span at `CaptainPicksPanel.tsx` lines 152–156; `!== undefined` guard; exact U+00B7 / U+2013 separators; 26/26 CaptainPicksPanel tests pass including BGW-safe zero-value test |
| 3 | The mc_enabled gate is hard-coded ON (MC_ENABLED = True) and MC_ITERATIONS=10000 / MC_SEED=42 are in GitHub Actions env block | ✓ VERIFIED | `pipeline/run.py` line 194: `MC_ENABLED = True`; line 204: `mc_enabled = MC_ENABLED`; old sticky read absent; `pipeline.yml` lines 34–35: `MC_ITERATIONS: 10000`, `MC_SEED: 42` as unquoted integers (YAML parse confirmed: `int` type) |
| 4 | GitHub Actions workflow hygiene: anthropic pin aligned to 0.98.1, numpy==2.2.3 added | ✓ VERIFIED | `pipeline.yml` line 48: `anthropic==0.98.1 numpy==2.2.3`; `anthropic==0.40.0` absent from file |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pipeline/run.py` | MC_ENABLED = True constant + mc_enabled = MC_ENABLED assignment | ✓ VERIFIED | Line 194 adds constant; line 204 assigns; old sticky read fully removed; `if mc_enabled:` guard preserved at line 224; Python AST parse clean |
| `pipeline/tests/test_simulate.py` | Updated assertions matching new constant pattern | ✓ VERIFIED | Lines 259–262: asserts `"MC_ENABLED = True" in run_source` and `"mc_enabled = MC_ENABLED" in run_source`; old `prev_backtest.get` assertion absent |
| `.github/workflows/pipeline.yml` | anthropic==0.98.1, numpy==2.2.3, MC_ITERATIONS: 10000, MC_SEED: 42 | ✓ VERIFIED | All four changes confirmed; MC vars are unquoted integers (int not str confirmed via YAML parse); YAML parses cleanly |
| `src/components/mc/MCDistributionBar.tsx` | Standalone component with P10/P90 bar, teal fill, conditional amber Haul% row | ✓ VERIFIED | 41 lines; `export function MCDistributionBar`; `role="img"` aria-label; `bg-teal-500 dark:bg-teal-400`; `haulProb >= 0.40` threshold; no `'use client'`; no `import React` |
| `src/components/mc/MCDistributionBar.test.tsx` | 10 RTL tests covering render / no-render paths | ✓ VERIFIED | 10 tests; all pass (10/10 in live run) |
| `src/components/gem-table/columns.tsx` | MCDistributionBar imported and used in showMC block | ✓ VERIFIED | Import at line 12; `<MCDistributionBar>` at line 144; Blank%/Floor/Ceiling labels fully absent |
| `src/components/gem-table/columns.test.tsx` | Phase 61 MC-02 describe replaced with Phase 102 MC-01 describe | ✓ VERIFIED | Phase 61 MC-02 describe absent; Phase 102 MC-01 describe at line 136; all 17 tests pass |
| `src/components/captaincy/CaptainPicksPanel.tsx` | Conditional P10/P90 span after pts (C) span | ✓ VERIFIED | Lines 152–156: `candidate.p10_pts !== undefined && candidate.p90_pts !== undefined`; `{' · '}` middle dot; `{'–'}` en-dash; `text-xs text-zinc-400 dark:text-zinc-500 tabular-nums`; no `* 2` on range values |
| `src/components/captaincy/CaptainPicksPanel.test.tsx` | Phase 102 MC-02 describe with 6 new tests | ✓ VERIFIED | Describe at line 322; 6 tests including BGW p10=0 edge case; 26/26 total tests pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `columns.tsx` XPtsCell showMC block | `MCDistributionBar.tsx` | `import { MCDistributionBar } from '@/components/mc/MCDistributionBar'` | ✓ WIRED | Import at line 12; JSX at line 144; TypeScript compile clean (tsc --noEmit exits 0) |
| `pipeline/run.py` MC_ENABLED constant | `compute_simulations()` call | `mc_enabled = MC_ENABLED; if mc_enabled: compute_simulations(...)` | ✓ WIRED | `MC_ENABLED = True` at line 194; `mc_enabled = MC_ENABLED` at line 204; `if mc_enabled:` at line 224 |
| `.github/workflows/pipeline.yml` env block | `pipeline/simulate.py` env reads | GitHub Actions env propagation | ✓ WIRED | `MC_ITERATIONS: 10000` and `MC_SEED: 42` at lines 34–35; YAML parses as int type |
| `CaptainPicksPanel.tsx` CandidateRow pts (C) span | Inline P10/P90 range span | JSX sibling conditional span | ✓ WIRED | Lines 152–156 immediately follow closing `</span>` of pts (C) at line 151; before FragilityBadge IIFE at line 157 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `MCDistributionBar.tsx` | `blankProb, haulProb, p10Pts, p90Pts` | Props from `columns.tsx` XPtsCell (caller guards via `showMC`); ultimately from `merged_players.json` MC fields written by `pipeline/run.py` | Yes — after MC_ENABLED=True activates, pipeline writes non-null values; gate-off produces `undefined` which `showMC` filters | ✓ FLOWING (gate-dependent; pre-run data is undefined = intentional silent omission) |
| `CaptainPicksPanel.tsx` P10/P90 span | `candidate.p10_pts`, `candidate.p90_pts` | `usePlayers` hook → `merged_players.json` MC fields | Yes — same pipeline source; `!== undefined` guard is BGW-safe | ✓ FLOWING (same gate-dependency) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| MCDistributionBar 10 RTL tests | `npm test -- src/components/mc/MCDistributionBar.test.tsx --run` | 10/10 pass | ✓ PASS |
| columns.tsx 17 tests (Phase 102 MC-01 describe) | `npm test -- src/components/gem-table/columns.test.tsx --run` | 17/17 pass | ✓ PASS |
| CaptainPicksPanel.test.tsx 26 tests | `npm test -- src/components/captaincy/CaptainPicksPanel.test.tsx --run` | 26/26 pass | ✓ PASS |
| TypeScript compile | `npx tsc --noEmit` | Exit 0 | ✓ PASS |
| pipeline/run.py AST + constant assertions | `python3 -c "import ast; ... assert 'MC_ENABLED = True' in src"` | All assertions pass | ✓ PASS |
| pipeline.yml YAML + int-type assertions | `python3 -c "import yaml; ... assert env['MC_ITERATIONS'] == 10000"` | MC_ITERATIONS=10000 (int), MC_SEED=42 (int) | ✓ PASS |
| test_simulate.py constant assertions present | `grep -n` inspection | Lines 259–262 assert MC_ENABLED constant pattern; old sticky-read assertion absent | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MC-01 | 102-01-PLAN.md, 102-02-PLAN.md | User can see haul %, blank %, P10 pts, and P90 pts in xPts hover card via MCDistributionBar — requires mc_enabled gate activation, MC env vars, and workflow hygiene | ✓ SATISFIED | Gate flip in pipeline/run.py; MCDistributionBar wired into XPtsCell; all test suites pass; YAML env vars confirmed as int types |
| MC-02 | 102-03-PLAN.md | User can see P10/P90 pts range on captain picks card for TC/differential decisions | ✓ SATISFIED | Conditional P10/P90 span in CaptainPicksPanel.tsx; raw values (no doubling); 6 new tests pass including BGW edge case |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODOs, FIXMEs, stubs, placeholder returns, or hardcoded empty values were found in any of the five modified files. The `void blankProb` in `MCDistributionBar.tsx` is an intentional ESLint-suppression for an accepted-but-not-rendered prop (D-01 bar-only design) — not a stub.

### Human Verification Required

#### 1. MCDistributionBar visual render in xPts hover card (post-pipeline-run)

**Test:** Trigger or wait for the next scheduled GitHub Actions pipeline run to complete. Then open the FPL Analyst app in a browser and hover any player's xPts cell in the GemTable.
**Expected:** A teal horizontal bar appears with P10 value on the left, P90 value on the right. If haulProb >= 0.40 for that player, an amber "Haul N%" row appears below the bar. The old Blank%/Haul%/Floor/Ceiling text rows are absent.
**Why human:** MC fields (`blank_prob`, `haul_prob`, `p10_pts`, `p90_pts`) are currently `undefined` in production because the MC_ENABLED = True gate flip has been committed but no pipeline run has executed since. The `showMC` guard correctly produces silent omission until the next run populates non-null values into `merged_players.json` via Vercel Blob. The visual bar layout, teal colour, and conditional Haul% display require live data to confirm.

#### 2. CaptainPicksPanel P10/P90 range display (post-pipeline-run)

**Test:** After the next pipeline run, open the Captain Picks card. Inspect each candidate row.
**Expected:** Each row shows `"X.X pts (C) · Y.Y–Z.Z"` where X.X is the doubled xPts value and Y.Y–Z.Z is the raw (undoubled) P10–P90 base range. Range uses middle-dot separator and en-dash. Muted text (zinc-400) subordinate to the main pts display. Range absent for any candidate with undefined MC fields.
**Why human:** Same live-data dependency as item 1. The gate-off path (no range shown) can be confirmed programmatically (test 4 covers it), but the positive render path requires non-null pipeline data.

### Gaps Summary

No blocking gaps found. All four ROADMAP Success Criteria are implemented and pass automated verification:

1. MCDistributionBar component exists, renders correctly, and is wired into XPtsCell with the correct showMC guard — confirmed by 10+17 tests passing.
2. CaptainPicksPanel CandidateRow renders the P10/P90 inline range with correct formatting, BGW-safe guard, raw (undoubled) values — confirmed by 26 tests passing.
3. MC_ENABLED = True constant is active in pipeline/run.py, MC_ITERATIONS=10000 and MC_SEED=42 are in the GitHub Actions env block as unquoted integers.
4. GitHub Actions anthropic pin aligned to 0.98.1, numpy==2.2.3 added.

The two human verification items are gating only on live pipeline execution — the code is complete and correct. Once the next daily run completes and populates MC fields, both visual surfaces should activate with no further code changes.

---

_Verified: 2026-05-13T13:00:00Z_
_Verifier: Claude (gsd-verifier)_
