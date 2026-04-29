---
phase: 35-tech-debt-fixes
verified: 2026-04-29T14:00:00Z
status: passed
score: 8/8
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 7/8
  gaps_closed:
    - "BGW players do not receive false TRAP flags during blank gameweeks (WR-02 goal)"
  gaps_remaining: []
  regressions: []
---

# Phase 35: Tech Debt Fixes — Verification Report

**Phase Goal:** Fix seven tech-debt items flagged by the v1.4 audit — Python pipeline correctness (WR-02, WR-03, WR-05, WR-06) and TypeScript/frontend cleanup (WR-01, WR-04, WR-07).
**Verified:** 2026-04-29T14:00:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (WR-02 flag-assignment loop skip guard added)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | BGW players (xPts_1gw=0 or None) are excluded from the TRAP position-median calculation in merge.py (WR-02 median loop) | VERIFIED | merge.py line 892: `if xpts_val:` guard — only non-zero xPts values are appended to pos_xpts |
| 2 | BGW players are skipped in the flag-assignment loop (WR-02 gap fix) | VERIFIED | merge.py lines 899-900: `if not p.get('xPts_1gw'): continue` — BGW players bypass `_compute_differential_flag` entirely |
| 3 | TRAP gate in `_compute_differential_flag` uses strict `xpts_1gw < position_median` (not `<=`) (WR-03) | VERIFIED | merge.py line 409: `if xpts_1gw < position_median and ownership > 15.0:`; `above_median` variable fully absent (0 grep matches) |
| 4 | Each `_player_patterns` insight in insights.py is only appended when its sample_n > 0 (WR-05) | VERIFIED | insights.py lines 311, 328, 345, 362: all four blocks guarded with `if sample_n_buy > 0:`, `if sample_n_sell > 0:`, `if sample_n_diff > 0:`, `if sample_n_trap > 0:` |
| 5 | upload.py upload_json signature accepts `list \| dict` for the data parameter (WR-06) | VERIFIED | upload.py line 7: `def upload_json(pathname: str, data: list \| dict):` |
| 6 | MOBILE_HIDDEN_COLUMNS in GwToggle.tsx uses key `regression_signal` not `signal` (WR-01) | VERIFIED | GwToggle.tsx line 19: `regression_signal: false`; no `signal: false` present; columns.tsx confirms TanStack accessor is `regression_signal` |
| 7 | InsightsTab.test.tsx empty-state mock has `data: [] as Insight[]` to prevent TS2352 (WR-04) | VERIFIED | InsightsTab.test.tsx line 167: `data: [] as Insight[]` with `Insight` imported at line 14 |
| 8 | ChipStrategyPanel.tsx FHChipRow bestGw guard has a comment explaining why > 0 is safe (WR-07) | VERIFIED | ChipStrategyPanel.tsx line 304: `{/* bestGw > 0: FPL GW numbers are always >= 1; 0 only if engine received no fixture data */}` |

**Score:** 8/8 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pipeline/merge.py` | BGW exclusion in median build loop + BGW skip guard in flag-assignment loop + strict `<` in `_compute_differential_flag` | VERIFIED | All three conditions met: line 892 (median guard), lines 899-900 (flag-assignment skip), line 409 (strict `<`) |
| `pipeline/insights.py` | Zero-count guard in `_player_patterns` — insights with sample_n=0 never emitted | VERIFIED | Four `if sample_n_X > 0:` guards at lines 311, 328, 345, 362 |
| `pipeline/upload.py` | Corrected type annotation: `data: list \| dict` | VERIFIED | Line 7 confirmed |
| `src/components/gem-table/GwToggle.tsx` | Fixed MOBILE_HIDDEN_COLUMNS with correct `regression_signal` key | VERIFIED | Line 19 confirmed |
| `src/components/insights/InsightsTab.test.tsx` | Type-safe empty-data mock with explicit `Insight[]` cast | VERIFIED | Line 167 confirmed |
| `src/components/planner/ChipStrategyPanel.tsx` | Documented bestGw > 0 guard with rationale comment | VERIFIED | Line 304 confirmed |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| pipeline/merge.py (median loop) | pipeline/merge.py (flag loop) | BGW exclusion consistent across both loops | VERIFIED | Median build loop excludes BGW via `if xpts_val:`; flag loop skips BGW via `if not p.get('xPts_1gw'): continue` — consistent guards |
| pipeline/merge.py | `_compute_differential_flag` | Called only for non-BGW players with pos_median | VERIFIED | Lines 901-906: call is inside the loop body after the BGW skip; receives `p['xPts_1gw']` (truthy) and correct position median |
| pipeline/insights.py | `_player_patterns` | Guards prevent zero-count emit | VERIFIED | All four `if sample_n_X > 0:` guards present and substantive |
| pipeline/upload.py | pipeline/run.py | `upload_json` called with insights list payload | VERIFIED | Signature `list \| dict` correctly accepts list payloads |
| src/components/gem-table/GwToggle.tsx | src/components/gem-table/columns.tsx | `regression_signal` key matches TanStack column accessor | VERIFIED | GwToggle.tsx line 19 and columns.tsx confirmed |
| src/components/insights/InsightsTab.test.tsx | src/components/insights/InsightsTab.tsx | `useInsights` return type — data field is `Insight[]` | VERIFIED | Cast present; SUMMARY confirms 12/12 tests passed |
| src/components/planner/ChipStrategyPanel.tsx | src/lib/chip-strategy-engine.ts | FHResult.bestGw invariant documented at call site | VERIFIED | Comment at line 304 present |

---

## Data-Flow Trace (Level 4)

Not applicable — all phase changes are correctness/annotation fixes to existing wired components. No new data paths introduced.

---

## Behavioral Spot-Checks

| Behavior | Check | Status |
|----------|-------|--------|
| `_compute_differential_flag(5.0, '10', 'a', 5.0)` returns None (exactly-median not TRAP) | Code inspection: `5.0 < 5.0` is False → returns None | PASS |
| `_compute_differential_flag(4.9, '20', 'a', 5.0)` returns 'trap' (below-median, high-ownership) | Code inspection: `4.9 < 5.0` and `20 > 15.0` → returns 'trap' | PASS |
| BGW player (xPts_1gw=0 or None) is skipped before `_compute_differential_flag` | Code inspection: `if not p.get('xPts_1gw'): continue` at line 899 — BGW players never reach the call | PASS |
| All four `if sample_n_X > 0:` guards in insights.py `_player_patterns` | Grep: 4 matches at lines 311, 328, 345, 362 | PASS |
| `upload_json` accepts list payload | Signature `list \| dict` at line 7 confirmed | PASS |
| `regression_signal: false` in MOBILE_HIDDEN_COLUMNS | Line 19 confirmed; `signal: false` absent | PASS |
| `data: [] as Insight[]` in InsightsTab.test.tsx empty-state mock | Line 167 confirmed | PASS |
| bestGw > 0 rationale comment in ChipStrategyPanel.tsx | Line 304 confirmed | PASS |

---

## Requirements Coverage

No formal requirement IDs for this tech-debt phase. Items tracked as WR-01 through WR-07 audit items.

| Item | Plan | Description | Status |
|------|------|-------------|--------|
| WR-01 | 35-02 | Fix mobile column ID mismatch (`signal` → `regression_signal`) | SATISFIED |
| WR-02 | 35-01 | Exclude BGW players from TRAP median AND skip them in flag-assignment loop | SATISFIED |
| WR-03 | 35-01 | TRAP gate uses strict `<` (not `<=`) | SATISFIED |
| WR-04 | 35-02 | Fix TS2352 never[] in InsightsTab test | SATISFIED |
| WR-05 | 35-01 | Zero-count guard in `_player_patterns` | SATISFIED |
| WR-06 | 35-01 | `upload_json` type annotation `list \| dict` | SATISFIED |
| WR-07 | 35-02 | Document bestGw > 0 guard rationale | SATISFIED |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| pipeline/upload.py | 15, 25 | `save_local` and `save` have bare untyped `data` parameters while `upload_json` now has `list \| dict`; inconsistent annotation in same public API | INFO | Type checker accepts incorrect payload types passed to `save`/`save_local`; not a correctness bug for the fixed function |
| src/components/gem-table/GwToggle.test.ts | (test assertions) | GwToggle.test.ts does not assert `regression_signal` or `differential_flag` in mobile column assertions; future key rename would go undetected | INFO | No regression coverage for the WR-01 fix; not a blocker |

No blockers. The single BLOCKER from the prior run (BGW players receiving false TRAP flags) is now closed.

---

## Human Verification Required

None — all items verified programmatically via code inspection.

---

## Gaps Summary

No gaps. All eight must-haves are verified.

The previously-failed item — **WR-02 flag-assignment loop** — is now fixed. `merge.py` lines 899-900 add `if not p.get('xPts_1gw'): continue` at the top of the flag-assignment loop. This is symmetric with the median build loop guard (`if xpts_val:` at line 892), so BGW players are excluded from both the median calculation and the classification step. A BGW player with ownership > 15% (e.g., a popular defender whose team has no fixture) will no longer be written to `merged_players.json` with `differential_flag: 'trap'`.

---

_Verified: 2026-04-29T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
