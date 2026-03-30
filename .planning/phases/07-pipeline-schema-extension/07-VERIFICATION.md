---
phase: 07-pipeline-schema-extension
verified: 2026-03-29T07:43:30Z
status: passed
score: 10/10 must-haves verified
re_verification: false
gaps: []
---

# Phase 7: Pipeline Schema Extension Verification Report

**Phase Goal:** The Python pipeline computes and publishes projected points and expected minutes for every player, making that data available to all downstream v1.1 features
**Verified:** 2026-03-29T07:43:30Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | defcon.py accepts a pre-fetched summaries dict instead of calling get_element_summary internally | VERIFIED | Signature `compute_defcon_stats(bootstrap, difficulty_scores, summaries)` confirmed; no `get_element_summary`, no `import time`, no `time.sleep` in file |
| 2 | xmins.py computes xmins, start_prob, and mins_risk for every player with starts > 0 | VERIFIED | `compute_xmins_stats` iterates all `bootstrap['elements']` (including GKs and 0-start); live test produced `{xmins: 28.3, start_prob: 0.3333, mins_risk: 'rotation_risk'}` |
| 3 | mins_risk classification follows the locked decision: status='a' and blank news gates rotation classification | VERIFIED | `if status != 'a' or news: mins_risk = 'injured'` present in xmins.py; all 5 categories (nailed/likely_start/rotation_risk/cameo/injured) implemented |
| 4 | merge.py computes proj_pts_1gw from ep_next adjusted by availability for every player | VERIFIED | `proj_pts_1gw = round(ep_next * availability, 2)` confirmed; `float(element.get('ep_next', 0) or 0)` handles string/empty FPL field |
| 5 | merge.py computes proj_pts_3gw and proj_pts_5gw using ppg * start_prob * difficulty_modifier across N unique GW groups | VERIFIED | `_proj_pts_ngw` uses `groupby(fixtures, key=lambda f: f['event_id'])` then consumes `grouped[:n_gws]`; DGW-aware |
| 6 | DGW players produce higher projected points than equivalent single-GW players | VERIFIED | Live test: DGW (2 fixtures event 10) = 10.8, single GW = 7.2; DGW > single confirmed |
| 7 | run.py fetches element-summaries once and passes to both defcon and xmins | VERIFIED | Single `summaries: dict[int, dict] = {}` fetch loop; `compute_xmins_stats(bootstrap, summaries, finished_gws)` and `compute_defcon_stats(bootstrap, difficulty_scores, summaries)` both receive same dict; confirmed only 1 fetch call in file |
| 8 | run.py passes xmins_stats into merge_players for start_prob access | VERIFIED | `merge_players(bootstrap, fixtures, understat, id_map, xmins_stats=xmins_stats)` present in run.py |
| 9 | MergedPlayer TypeScript interface includes all 6 new fields with correct types | VERIFIED | `proj_pts_1gw: number`, `proj_pts_3gw: number`, `proj_pts_5gw: number`, `xmins: number`, `start_prob: number`, `mins_risk: MinsRisk` all present in types.ts; `MinsRisk` type exported |
| 10 | Tests validate the new pipeline fields and pass without a live pipeline run | VERIFIED | `npx vitest run` full suite: 90 passed, 8 skipped, 0 failed; 3 non-skipped Phase 7 tests green (shape, null-chance, DGW) |

**Score:** 10/10 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pipeline/defcon.py` | Refactored module accepting summaries dict | VERIFIED | Signature `compute_defcon_stats(bootstrap, difficulty_scores, summaries: dict)`; pure computation, no I/O |
| `pipeline/xmins.py` | xmins/start_prob/mins_risk computation module | VERIFIED | `compute_xmins_stats` + `_compute_player_xmins`; `import statistics`; no fpl_client dependency |
| `pipeline/merge.py` | Projected points computation for 1/3/5 GW horizons | VERIFIED | `_proj_pts_ngw` helper + 6 new fields written in merge loop for every player |
| `pipeline/run.py` | Orchestration with shared element-summary cache | VERIFIED | Shared fetch loop, `compute_xmins_stats` call, updated `merge_players` and `compute_defcon_stats` call sites |
| `src/lib/types.ts` | Extended MergedPlayer interface | VERIFIED | `MinsRisk` type + 6 new non-nullable fields added after `fixtures: FixtureEntry[]` |
| `tests/lib/merge.test.ts` | Unit tests for new pipeline fields | VERIFIED | Phase 7 projected points block, xmins fields block, type shape validation block (3 non-skipped green) |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `pipeline/defcon.py` | `pipeline/run.py` | summaries dict parameter | VERIFIED | `compute_defcon_stats(bootstrap, difficulty_scores, summaries)` at run.py line 93 |
| `pipeline/xmins.py` | `pipeline/run.py` | summaries dict parameter | VERIFIED | `compute_xmins_stats(bootstrap, summaries, finished_gws)` at run.py line 82 |
| `pipeline/run.py` | `pipeline/merge.py` | xmins_stats kwarg | VERIFIED | `merge_players(bootstrap, fixtures, understat, id_map, xmins_stats=xmins_stats)` at run.py line 86 |
| `pipeline/merge.py` | `merged_players.json` | 6 new fields written per player | VERIFIED | All 6 field assignments (`player['proj_pts_1gw']` through `player['mins_risk']`) present; fields written unconditionally for every player |
| `src/lib/types.ts` | `pipeline/cache/merged_players.json` | MergedPlayer shape must match pipeline output | VERIFIED | 6 non-nullable fields in TypeScript match Python pipeline's unconditional writes (0.0 numeric fallback, 'injured' string fallback) |
| `tests/lib/merge.test.ts` | `src/lib/types.ts` | MergedPlayer type used in test fixtures | VERIFIED | Test constructs inline player object with all 6 new fields; `mins_risk: 'nailed' as const` uses MinsRisk union |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `pipeline/merge.py` | `proj_pts_1gw` | `element['ep_next']` from bootstrap | Yes — FPL API string field converted with `float(... or 0) * availability` | FLOWING |
| `pipeline/merge.py` | `proj_pts_3gw` / `proj_pts_5gw` | `element['points_per_game']` + `xmins_stats[fpl_id]['start_prob']` + `team_fixtures` | Yes — PPG from bootstrap, start_prob from xmins computation, fixtures from FPL API | FLOWING |
| `pipeline/merge.py` | `xmins`, `start_prob`, `mins_risk` | `xmins_stats[fpl_id]` populated by `compute_xmins_stats` | Yes — computed from element-summary history with bootstrap fallback | FLOWING |
| `pipeline/xmins.py` | `start_prob`, `xmins`, `mins_risk` | `summaries` dict (element-summary history) + bootstrap fields | Yes — uses `history[-10:]` slice from element-summary or bootstrap fallback | FLOWING |
| `pipeline/run.py` | `summaries` | `get_element_summary(element['id'])` rate-limited loop | Yes — live FPL API fetch with try/except guard and 0.1s sleep | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| defcon.py accepts summaries dict (correct signature) | `python -c "from defcon import compute_defcon_stats; import inspect; print(list(inspect.signature(compute_defcon_stats).parameters.keys()))"` | `['bootstrap', 'difficulty_scores', 'summaries']` | PASS |
| xmins.py computes for all players including GKs | `python -c "from xmins import compute_xmins_stats; r = compute_xmins_stats({'elements': [{'id':1,'starts':10,'minutes':850,'status':'a','news':'','chance_of_playing_next_round':None,'element_type':3}]},{},30); print(r[1])"` | `{'xmins': 28.3, 'start_prob': 0.3333, 'mins_risk': 'rotation_risk'}` | PASS |
| DGW produces higher projected points than single GW | `_proj_pts_ngw(5.0, 0.9, DGW_fixtures, 2)` vs single | DGW: 10.8, single: 7.2 | PASS |
| TypeScript compilation | `npx tsc --noEmit` | 0 errors | PASS |
| Full test suite | `npx vitest run` | 90 passed, 8 skipped, 0 failed | PASS |
| merge.test.ts + gem-score.test.ts | `npx vitest run tests/lib/merge.test.ts tests/lib/gem-score.test.ts` | 15 passed, 8 skipped | PASS |
| Single element-summary fetch loop | `grep 'get_element_summary(element' pipeline/run.py` count | 1 occurrence | PASS |
| All 6 task commits present in git | `git log --oneline 9ed8524 d236075 ae67088 a90c3b0 28d8dc9 bb23120` | All 6 SHAs resolved | PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PROJ-01 | 07-02, 07-03 | Projected pts 1 GW | SATISFIED | `proj_pts_1gw = round(ep_next * availability, 2)` in merge.py; `proj_pts_1gw: number` in MergedPlayer |
| PROJ-02 | 07-02, 07-03 | Projected pts 3 GW | SATISFIED | `proj_pts_3gw = _proj_pts_ngw(ppg, sp, player_fixtures, 3)` in merge.py; `proj_pts_3gw: number` in MergedPlayer |
| PROJ-03 | 07-02, 07-03 | Projected pts 5 GW | SATISFIED | `proj_pts_5gw = _proj_pts_ngw(ppg, sp, player_fixtures, 5)` in merge.py; `proj_pts_5gw: number` in MergedPlayer |
| MINS-01 | 07-01, 07-03 | Expected minutes + start probability per player | SATISFIED | `xmins.py` computes `xmins`/`start_prob`/`mins_risk` for all players; fields in MergedPlayer; `MinsRisk` type exported |

**Orphaned requirements check:** REQUIREMENTS.md maps PROJ-04, MINS-02, MINS-03 to Phases 8/9 — none assigned to Phase 7. No orphaned requirements for this phase.

---

## Anti-Patterns Found

No blockers or warnings detected.

| File | Pattern Checked | Result |
|------|-----------------|--------|
| `pipeline/defcon.py` | TODO/FIXME/placeholder | None found |
| `pipeline/defcon.py` | `get_element_summary`, `time.sleep`, `import time` | Not present (correctly removed) |
| `pipeline/xmins.py` | `from fpl_client import`, `time.sleep` | Not present |
| `pipeline/merge.py` | Hardcoded empty returns, `return null/[]` | Not found; fallback values (0.0, 'injured') only used when `xmins_stats is None` |
| `pipeline/run.py` | Duplicate element-summary fetch loops | Only 1 loop — confirmed |
| `src/lib/types.ts` | `number \| null` on new fields | Not present; all 6 new fields are non-nullable `number` or `MinsRisk` |

---

## Human Verification Required

### 1. Live Pipeline Run Field Validation

**Test:** Run `cd pipeline && python run.py` against live FPL API; inspect `pipeline/cache/merged_players.json` for a representative player (e.g. `jq '.[] | select(.web_name=="Salah")' merged_players.json`)
**Expected:** `proj_pts_1gw`, `proj_pts_3gw`, `proj_pts_5gw` are positive numbers consistent with player quality; `xmins` is in [60,90] for a nailed starter; `mins_risk` is `'nailed'`; `start_prob` is in [0.85, 1.0]
**Why human:** Requires live FPL API access and a running Python environment with soccerdata. The 8 skipped Vitest tests cover this validation once pipeline has run.

### 2. DGW Field Accuracy in Production

**Test:** After a GW is confirmed as a DGW for some teams, run pipeline and verify those teams' players have `proj_pts_3gw` noticeably higher than teams with standard fixtures
**Expected:** A player with a DGW in the next 3 GWs should have `proj_pts_3gw` roughly 1.5x-2x a comparable player with all single fixtures
**Why human:** DGW scenarios only exist at specific points in the season; cannot be verified in a dry environment

---

## Gaps Summary

No gaps found. All 10 observable truths are verified. All artifacts exist, are substantive, and are fully wired. All 4 requirement IDs (PROJ-01, PROJ-02, PROJ-03, MINS-01) are satisfied. The pipeline computes and publishes projected points and expected minutes for every player.

The 8 skipped Vitest tests (pipeline-dependent shape validation) are by design — they require a live pipeline run and follow the established project pattern. They do not represent gaps; the non-skipped tests confirm the type shape contract.

---

_Verified: 2026-03-29T07:43:30Z_
_Verifier: Claude (gsd-verifier)_
