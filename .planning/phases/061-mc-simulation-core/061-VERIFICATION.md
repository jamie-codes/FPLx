---
phase: 061-mc-simulation-core
verified: 2026-05-05T22:35:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open GemTable in browser, hover (desktop) or tap (mobile) the xPts cell for an active player after a pipeline run that includes simulate.py output"
    expected: "Hover card shows 5 component rows, then a divider, then 4 MC rows: Blank% (integer percent), Haul% (integer percent, amber if >= 40%), Floor (1 decimal), Ceiling (1 decimal), then another divider, then Total"
    why_human: "Cannot verify hover card visual rendering and CSS hover/tap behavior programmatically; requires a live browser session with real pipeline data in merged_players.json"
  - test: "Open GemTable, hover xPts cell for a BGW player (value = 0)"
    expected: "Plain span shown with no hover card at all — the BGW guard fires before MC props are evaluated"
    why_human: "BGW guard behavior for value <= 0 path requires visual inspection against a real BGW player row"
  - test: "Open GemTable 3GW or 5GW xPts column, hover any player"
    expected: "No Blank%/Haul%/Floor/Ceiling rows appear — the multi-GW window suppression guard fires"
    why_human: "Multi-window suppression requires visual confirmation against live rendered columns"
  - test: "Run the pipeline end-to-end and inspect merged_players.json"
    expected: "Each active player has blank_prob (0.0-1.0), haul_prob (0.0-1.0), p10_pts (>=0), p90_pts (>=p10_pts), and xPts_90th_1gw equals p90_pts; BGW players have blank_prob=1.0, haul_prob=0.0, p10_pts=0.0, p90_pts=0.0"
    why_human: "Full end-to-end pipeline run requires live FPL API access and Vercel Blob credentials; cannot run in CI without secrets"
---

# Phase 61: MC Simulation Core Verification Report

**Phase Goal:** Users can see simulation-derived blank probability, haul probability, floor (10th percentile), and ceiling (90th percentile) for any player for the upcoming GW — making the uncertainty of xPts predictions explicit
**Verified:** 2026-05-05T22:35:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `pipeline/simulate.py` exists, exports `compute_simulations(merged, xmins_v2_enabled)`, runs 10k MC sims per player, writes blank_prob/haul_prob/p10_pts/p90_pts, and is wired into run.py between merge_players() and save() | ✓ VERIFIED | File exists (147 lines). `from simulate import compute_simulations` at run.py line 20. Invocation `merged = compute_simulations(merged, xmins_v2_enabled)` at run.py line 209, between merge_players() close-paren and `save('merged_players.json', merged)` at line 210. All 5 pytest tests pass (0.08s). No import from merge.py (D-02 clean). No file reads (D-03 clean). Vectorized NumPy: `rng.poisson(lam_g, size=N_SIMS)`, `rng.binomial(1, cs_prob, size=N_SIMS)`. |
| 2 | User can see blank% and haul% for any player in GemTable xPts hover card (window===1) | ✓ VERIFIED (automated) | `XPtsCell` in columns.tsx accepts `blankProb?: number`, `haulProb?: number`. `showMC` guard at line 88 requires window===1 and all 4 props !== undefined. JSX renders `<span>Blank%</span>` and `(blankProb! * 100).toFixed(0)%`, `<span>Haul%</span>` and `(haulProb! * 100).toFixed(0)%`. Vitest test "renders MC rows when blankProb/haulProb/p10Pts/p90Pts present and window===1" passes. Human verification required for live browser rendering. |
| 3 | User can see floor (10th percentile) and ceiling (90th percentile) outcomes alongside xPts | ✓ VERIFIED (automated) | `p10Pts?: number`, `p90Pts?: number` props in XPtsCell. Renders `<span>Floor</span>` + `{p10Pts!.toFixed(1)}` and `<span>Ceiling</span>` + `{p90Pts!.toFixed(1)}`. Vitest confirms labels and values "3.2" / "11.8" render correctly at window===1. |
| 4 | BGW players produce blank_prob=1.0, haul_prob=0.0, p10_pts=0.0, p90_pts=0.0; DGW players simulate both fixtures per iteration | ✓ VERIFIED | `test_bgw_shortcircuit` PASSES: xmins=0 and start_prob=0 both yield all-zero/one values. `test_dgw_sums_fixtures` PASSES: DGW p90 > single p90, DGW haul_prob >= single, DGW blank_prob <= single. BGW UI guard at columns.tsx line 64 (`value <= 0`) unchanged — fires before MC props evaluated. |
| 5 | Simulation results written once per pipeline run as static JSON (no client-side simulation, no added latency on page load) | ✓ VERIFIED | `compute_simulations` is a post-merge pipeline module called in run.py between merge_players() and save(). It writes to merged_players.json once per run. No client-side simulation code was added. The XPtsCell reads already-computed values from `row.original` — zero runtime computation in the browser. |

**Score:** 5/5 truths verified (automated evidence). Human verification needed for 4 live-browser/live-pipeline scenarios.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pipeline/simulate.py` | MC engine: compute_simulations + _simulate_player + _cs_prob_sim + N_SIMS=10_000 | ✓ VERIFIED | 147 lines. All 3 public functions present. N_SIMS=10_000. GOAL_PTS, ASSIST_PTS, CS_PTS, BONUS_RATE constants match merge.py. Vectorized NumPy sampling. |
| `pipeline/run.py` | Import + invocation of compute_simulations between merge_players() and save() | ✓ VERIFIED | `from simulate import compute_simulations` at line 20. `merged = compute_simulations(merged, xmins_v2_enabled)` at line 209 — confirmed between merge_players() close (line 208) and save() (line 210). |
| `pipeline/requirements.txt` | numpy>=1.26.0 as direct dependency | ✓ VERIFIED | Line 7: `numpy>=1.26.0`. File has 7 lines total. All 6 prior dependencies unchanged. |
| `pipeline/tests/test_simulate.py` | 5 RED (now GREEN) test cases: bgw_shortcircuit, mc_mean_matches_analytical, dgw_sums_fixtures, p90_overwrites_ceiling, output_value_ranges | ✓ VERIFIED | File exists with all 5 named test functions and helpers `_fix`, `_player`. All 5 PASS in 0.08s. Full suite: 99 passed. |
| `src/lib/types.ts` MergedPlayer | 4 optional snake_case fields: blank_prob?, haul_prob?, p10_pts?, p90_pts? | ✓ VERIFIED | All 4 fields present at lines 180-183, immediately after `xPts_90th_1gw?: number` (line 175), before `last_gw_actual_pts` (line 187). Phase-tagged comment block at line 176. tsc --noEmit exits 0. |
| `src/components/gem-table/columns.tsx` XPtsCell | 4 new optional MC props + showMC guard + MC rows in hover card + xPts_1gw column threading | ✓ VERIFIED | blankProb/haulProb/p10Pts/p90Pts in signature at lines 34-37 + type at lines 53-56. showMC at lines 88-92. MC block at lines 129-153. xPts_1gw threading at lines 272-275. BGW guard unchanged at line 64. showBreakdown guard unchanged at line 70. |
| `src/components/gem-table/columns.test.tsx` | Phase 61 MC-02 describe block with 3 test cases | ✓ VERIFIED | `describe('XPtsCell — Phase 61 MC-02 hover card MC rows', ...)` at line 136. All 3 tests PASS. 11/11 total tests PASS. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `pipeline/run.py` | `pipeline/simulate.py compute_simulations` | `from simulate import compute_simulations` + `merged = compute_simulations(merged, xmins_v2_enabled)` | ✓ WIRED | Import at line 20; invocation at line 209, confirmed between merge_players() and save(). `xmins_v2_enabled` in scope at this point. |
| `pipeline/simulate.py _simulate_player` | `pipeline/simulate.py _cs_prob_sim` | `cs_prob = _cs_prob_sim(dd, xmins, m60)` inside fixture loop | ✓ WIRED | Line 95: `cs_prob = _cs_prob_sim(dd, xmins, m60)`. Called once per fixture in the first_gw loop. |
| `pipeline/simulate.py compute_simulations` | `merged_players.json` | `p['xPts_90th_1gw'] = sim['p90_pts']` + `p.update(sim)` | ✓ WIRED | Line 139: `p.update(sim)` writes 4 new fields. Line 141: `p['xPts_90th_1gw'] = sim['p90_pts']` overwrites ceiling (D-05). test_p90_overwrites_ceiling confirms the invariant. |
| `src/components/gem-table/columns.tsx XPtsCell signature` | `xPts_1gw column cell renderer` | `blankProb={info.row.original.blank_prob}` (+ 3 more) | ✓ WIRED | Lines 272-275 in xPts_1gw column accessor. All 4 MC snake_case fields threaded. xPts_3gw/xPts_5gw cells NOT modified per D-13. |
| `MergedPlayer.blank_prob (src/lib/types.ts)` | `XPtsCell rendered Blank% span` | `row.original.blank_prob -> blankProb prop -> (blankProb! * 100).toFixed(0) + '%'` | ✓ WIRED | Type field at types.ts line 180. Prop threading at columns.tsx line 272. Format expression at columns.tsx line 133. Vitest test confirms "23%" renders for blankProb=0.23. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `pipeline/simulate.py` | `total_pts` (N_SIMS array) | `rng.poisson(lam_g, size=N_SIMS)`, `rng.binomial(1, cs_prob, size=N_SIMS)` — vectorized NumPy random draws | Yes — real statistical sampling from player-specific Poisson lambdas and Bernoulli probabilities derived from xg_per90, xa_per90, xmins, defensive_difficulty | ✓ FLOWING |
| `XPtsCell` in columns.tsx | `blankProb`, `haulProb`, `p10Pts`, `p90Pts` | `info.row.original.blank_prob` etc. from merged_players.json via /api/players | Yes — these are pre-computed pipeline values, not hardcoded; showMC guard ensures nothing renders if values are undefined (pre-Phase-61 cache fallback) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 5 MC-01 pytest tests pass | `python3 -m pytest pipeline/tests/test_simulate.py -x -q` | `5 passed in 0.08s` | ✓ PASS |
| Full pipeline test suite (99 tests, no regressions) | `python3 -m pytest pipeline/tests/ -x -q` | `99 passed in 0.21s` | ✓ PASS |
| All 11 Vitest tests pass including 3 new MC-02 cases | `npx vitest run src/components/gem-table/columns.test.tsx` | `11 passed` | ✓ PASS |
| TypeScript compiles cleanly | `npx tsc --noEmit` | Exit 0, no output | ✓ PASS |
| simulate.py does not import from merge.py (D-02) | `grep "from merge import" pipeline/simulate.py` | No matches | ✓ PASS |
| simulate.py does not read JSON files (D-03) | `grep "open(\|json.load" pipeline/simulate.py` | No matches | ✓ PASS |
| xPts_1gw column threads all 4 MC props | `grep "blankProb={info.row.original.blank_prob}"` | Lines 272-275 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|------------|-------------|--------|---------|
| MC-01 | 061-01, 061-02 | Pipeline runs 10,000 MC sims per player per GW, writing blank_prob, haul_prob, p10_pts, p90_pts to merged_players.json | ✓ SATISFIED | pipeline/simulate.py implements compute_simulations with N_SIMS=10_000, vectorized NumPy; wired into run.py; all 5 tests green; BGW short-circuit and DGW fixture-sum verified |
| MC-02 | 061-01, 061-03 | User can see blank%/haul%/floor/ceiling for any player in GemTable row expand; BGW = 100% blank; DGW combines fixtures | ✓ SATISFIED (automated) | XPtsCell extended with 4 MC props + showMC guard + MC rows in hover card; amber Haul% at >= 0.40; xPts_1gw column threads from row.original; 3 new Vitest tests GREEN; human visual confirmation pending |

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| None detected | — | — | No TODO/FIXME/placeholder comments in simulate.py or columns.tsx. No return null/return []/return {} stubs. No hardcoded empty data flowing to rendering. `showMC` guard safely handles undefined props. |

### Human Verification Required

#### 1. MC hover card visual rendering (active player, 1GW window)

**Test:** Open the FPL Analyst app in a browser after a pipeline run that includes simulate.py output. Navigate to the GemTable on the Decision tab. Hover (desktop) or tap (mobile) the xPts cell for any active player with window=1GW.
**Expected:** A hover card appears showing: 5 component rows (Appearance, Goals, Assists, Clean sheet, Bonus), a divider `<hr>`, then 4 MC rows in order: Blank% (integer percent), Haul% (integer percent — amber text if >= 40%), Floor (1 decimal), Ceiling (1 decimal), then another `<hr>` divider, then Total (bold, computed sum of components), then MinsRiskBadge.
**Why human:** CSS hover visibility, amber color rendering, and the layout/order of MC rows relative to the dividers require visual inspection in a live browser session with real pipeline JSON data.

#### 2. BGW player card behavior

**Test:** Find a BGW player row (xPts = 0 or empty) in the GemTable and hover/tap their xPts cell.
**Expected:** No hover card appears — just a plain span with "0.0". The BGW guard (`value <= 0`) fires at columns.tsx line 64 before any MC props are evaluated.
**Why human:** BGW guard short-circuit requires a real BGW player entry in the live cache to verify visually.

#### 3. Multi-GW window suppression

**Test:** Switch to 3GW or 5GW xPts column in GemTable, hover any active player.
**Expected:** The standard plain span with no hover card at all for the 3GW/5GW columns (existing showBreakdown guard suppresses the card entirely). No Blank%/Haul%/Floor/Ceiling rows appear.
**Why human:** Multi-window suppression requires a live UI session with the actual column switcher enabled.

#### 4. End-to-end pipeline run with real data

**Test:** Run `python3 pipeline/run.py` with live FPL API access and inspect the output `merged_players.json` (or Vercel Blob output).
**Expected:** Each active player entry has blank_prob in [0.0, 1.0], haul_prob in [0.0, 1.0], p10_pts >= 0.0, p90_pts >= p10_pts, and xPts_90th_1gw equals p90_pts exactly. BGW players (xmins=0 or start_prob=0) have blank_prob=1.0, haul_prob=0.0, p10_pts=0.0, p90_pts=0.0.
**Why human:** Full pipeline run requires live FPL API credentials and Vercel Blob access — cannot execute in a verification context without secrets.

### Gaps Summary

No gaps found. All 5 must-have truths are VERIFIED by automated evidence. All 7 required artifacts exist, are substantive, and are wired correctly. All 4 data-flow traces confirm real computation flows through the wiring. All 5 plan must-haves (from 061-01, 061-02, 061-03 PLAN frontmatter) are satisfied. Requirements MC-01 and MC-02 are both covered by the implemented artifacts.

Status is `human_needed` rather than `passed` because 4 items require live browser/pipeline verification — specifically the hover card visual rendering and end-to-end pipeline output. These are inherently unverifiable programmatically.

---

_Verified: 2026-05-05T22:35:00Z_
_Verifier: Claude (gsd-verifier)_
