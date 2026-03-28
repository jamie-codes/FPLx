---
phase: 04-defcon-analysis
verified: 2026-03-28T22:37:00Z
status: gaps_found
score: 8/9 must-haves verified
re_verification: false
gaps:
  - truth: "defcon_stats.json is written to pipeline/cache/ with hit_rate, avg_per90, distance_to_threshold, and fixture_correlation per player"
    status: failed
    reason: "pipeline/cache/defcon_stats.json does not exist — the pipeline (run.py) has not been executed since Phase 4 code was written. The pipeline code is fully wired to produce it, but the file is absent from cache."
    artifacts:
      - path: "pipeline/cache/defcon_stats.json"
        issue: "File missing from cache directory. pipeline/run.py correctly calls compute_defcon_stats and save('defcon_stats.json', ...) but has not been run."
    missing:
      - "Run `python pipeline/run.py` from project root to generate defcon_stats.json in pipeline/cache/"
      - "Until this file exists, GET /api/defcon returns 404 and the DefCon UI shows an error state"
human_verification:
  - test: "Visual verification of DefCon tables in browser"
    expected: "Two separate sortable tables render under DefCon Analysis tab — DEF (threshold 10) and MID/FWD (threshold 12) — with hit rates, avg DC/90, distance values and fixture correlation"
    why_human: "Requires running dev server and pipeline data. Plan 03 Task 3 was a human-verify checkpoint and is documented as approved in 04-03-SUMMARY.md, but this cannot be confirmed programmatically."
  - test: "Stale merged_players.json in cache still uses plural key"
    expected: "After pipeline rerun, merged_players.json should contain 'defensive_contribution' (singular) for all players"
    why_human: "The source code is fixed (merge.py uses singular) but the cached output file from a pre-Phase-4 run still has plural keys. This resolves automatically on next pipeline run but needs human confirmation post-run."
---

# Phase 4: DefCon Analysis Verification Report

**Phase Goal:** The manager can see per-player DefCon hit rates and distance-to-threshold for DEF and MID/FWD separately, enabling identification of reliable +2 point earners
**Verified:** 2026-03-28T22:37:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | defensive_contribution (singular) is parsed correctly from FPL API bootstrap data | ✓ VERIFIED | types.ts L19, fpl-adapter.ts L14: singular field. 12/12 fpl-adapter tests pass. No plural references in src/, pipeline/, or tests/ source files. |
| 2  | Pipeline fetches element-summary for DEF/MID/FWD starters and computes per-match hit rates | ✓ VERIFIED | pipeline/defcon.py (102 lines): iterates elements, calls get_element_summary(), computes hit_rate per-match. Python import confirmed clean. |
| 3  | defcon_stats.json is written to pipeline/cache/ with hit_rate, avg_per90, distance_to_threshold, and fixture_correlation per player | ✗ FAILED | File is ABSENT from pipeline/cache/. Pipeline code is complete and wired, but run.py has not been executed. |
| 4  | DEF threshold is 10, MID/FWD threshold is 12 | ✓ VERIFIED | defcon.py L6: `DEFCON_THRESHOLD = {2: 10, 3: 12, 4: 12}`. defcon.ts L27-31: same constants. 3/3 threshold tests pass. |
| 5  | Distance to threshold is threshold minus avg_per90 | ✓ VERIFIED | defcon.py L49: `distance = round(threshold - avg_per90, 2)`. DefConPlayer type field: `distance_to_threshold: number`. |
| 6  | Fixture correlation returns insufficient_data when bucket has fewer than 5 games | ✓ VERIFIED | defcon.py L85: `if len(easy_games) < 5 or len(hard_games) < 5`. 4/4 formatCorrelation tests pass including insufficient_data case. |
| 7  | GET /api/defcon returns JSON array of DefConPlayer objects from pipeline/cache/defcon_stats.json | ✓ VERIFIED (code) / ? PENDING (runtime) | route.ts reads pipeline/cache/defcon_stats.json with correct headers. Code is complete but runtime behaviour depends on defcon_stats.json existing (gap #3). Returns 404 currently. |
| 8  | Two separate tables render: DEF (threshold=10) and MID/FWD (threshold=12) — never combined | ✓ VERIFIED | DefConTables.tsx: two independent useReactTable instances (defTable, midFwdTable) with separate SortingState. splitByPosition() segregates by element_type. Section headers show thresholds 10 and 12. |
| 9  | User can navigate between Gem Ratings and DefCon Analysis views | ✓ VERIFIED | page.tsx: 'use client', useState<Tab>('gems'), conditionally renders GemTable or DefConTables. Tab buttons labeled "Gem Ratings" and "DefCon Analysis". Build passes. |

**Score:** 8/9 truths verified (1 gap: missing cache file)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pipeline/defcon.py` | DefCon computation from element-summary history | ✓ VERIFIED | 102 lines. Contains compute_defcon_stats, _compute_fixture_correlation, DEFCON_THRESHOLD, get_element_summary call, time.sleep(0.1), per-player exception handling. |
| `pipeline/cache/defcon_stats.json` | Per-player DefCon stats output | ✗ MISSING | File does not exist in pipeline/cache/. Pipeline must be run to generate it. |
| `src/lib/types.ts` | Fixed defensive_contribution field + DefConPlayer type | ✓ VERIFIED | Contains `defensive_contribution: number | null` (singular, L19), `defensive_contribution_per_90: number | null` (L20), and `export interface DefConPlayer` (L114-133). |
| `src/lib/defcon.ts` | Pure functions for DefCon display computations | ✓ VERIFIED | 69 lines. Exports DEFCON_THRESHOLD, splitByPosition, formatHitRate, getDefConStatus, formatCorrelation. All 19 unit tests pass. |
| `tests/lib/defcon.test.ts` | Unit tests covering DEF-01 through DEF-04 | ✓ VERIFIED | 175 lines, 19 test cases across 5 describe blocks. All pass. |
| `src/app/api/defcon/route.ts` | DefCon data API endpoint | ✓ VERIFIED | 18 lines. Exports GET, reads defcon_stats.json, returns with Cache-Control header, handles missing file with 404. |
| `src/lib/hooks/useDefCon.ts` | TanStack Query hook for /api/defcon | ✓ VERIFIED | 18 lines. Exports useDefCon, queryKey: ['defcon'], staleTime: 6h, typed DefConPlayer[]. |
| `src/components/defcon/DefConTables.tsx` | Client component with two TanStack Table instances | ✓ VERIFIED | 118 lines. 'use client', useReactTable called twice with independent defSorting/midFwdSorting state, uses splitByPosition, flexRender, loading/error states. |
| `src/components/defcon/columns.tsx` | Column definitions for DefCon tables (note: .tsx not .ts) | ✓ VERIFIED | 51 lines. defconColumns with hit_rate, avg_per90, distance_to_threshold, fixture_correlation. Imports formatHitRate and formatCorrelation from @/lib/defcon. |
| `src/app/page.tsx` | Tab navigation between GemTable and DefConTables | ✓ VERIFIED | 43 lines. 'use client', useState<Tab>('gems'), imports DefConTables, renders conditionally. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| pipeline/defcon.py | pipeline/fpl_client.py | get_element_summary(player_id) | ✓ WIRED | defcon.py L4: `from fpl_client import get_element_summary`. L35: called inside try/except. |
| pipeline/run.py | pipeline/defcon.py | compute_defcon_stats import and call | ✓ WIRED | run.py L17: `from defcon import compute_defcon_stats`. L70: called with (bootstrap, difficulty_scores). L71: result saved. |
| pipeline/merge.py | _compute_difficulty_scores function | Extracted for reuse | ✓ WIRED | merge.py L39: `def _compute_difficulty_scores(bootstrap, fixtures)`. run.py L68-69: imports and calls it. |
| src/components/defcon/DefConTables.tsx | src/lib/hooks/useDefCon.ts | useDefCon() hook call | ✓ WIRED | DefConTables.tsx L12: imports useDefCon. L62: called, data destructured. |
| src/lib/hooks/useDefCon.ts | src/app/api/defcon/route.ts | fetch('/api/defcon') | ✓ WIRED | useDefCon.ts L5: `fetch('/api/defcon')`. route.ts exports GET handler at that path. |
| src/app/page.tsx | src/components/defcon/DefConTables.tsx | conditional render based on active tab | ✓ WIRED | page.tsx L5: imports DefConTables. L40: `{activeTab === 'defcon' && <DefConTables />}`. |
| src/components/defcon/DefConTables.tsx | src/lib/defcon.ts | splitByPosition, formatHitRate, formatCorrelation imports | ✓ WIRED | DefConTables.tsx L13: `import { splitByPosition } from '@/lib/defcon'`. L64: splitByPosition called. columns.tsx L3: imports formatHitRate and formatCorrelation. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| DefConTables.tsx | `data` (DefConPlayer[]) | useDefCon() → fetch('/api/defcon') → readFile(defcon_stats.json) | Conditional: YES when defcon_stats.json exists (pipeline has been run) / NO currently (file missing) | ⚠️ HOLLOW — wired but data file absent |
| src/app/api/defcon/route.ts | raw JSON from file | pipeline/cache/defcon_stats.json | NO — file does not exist; returns 404 | ✗ DISCONNECTED (data source missing) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| defcon.py imports cleanly | `python -c "from pipeline.defcon import compute_defcon_stats, _compute_fixture_correlation; print('import OK')"` | "import OK" | ✓ PASS |
| All defcon unit tests pass | `npx vitest run tests/lib/defcon.test.ts` | 19/19 passed | ✓ PASS |
| All fpl-adapter tests pass | `npx vitest run tests/lib/fpl-adapter.test.ts` | 12/12 passed | ✓ PASS |
| Full test suite passes | `npx vitest run` | 42/42 passed (3 files) | ✓ PASS |
| Next.js build succeeds | `npx next build` | Build succeeded, /api/defcon route registered as Dynamic | ✓ PASS |
| defcon_stats.json exists in cache | `ls pipeline/cache/defcon_stats.json` | File not found | ✗ FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DEF-01 | Plans 01, 02 | Per-position thresholds: DEF needs 10 defensive contributions, MID/FWD need 12 | ✓ SATISFIED | DEFCON_THRESHOLD = {2:10, 3:12, 4:12} in defcon.py and defcon.ts. 3 passing threshold tests. |
| DEF-02 | Plans 01, 02, 03 | Per player: DefCon hit rate (% of games achieved +2), average defensive contributions per 90, distance to threshold | ✓ SATISFIED | hit_rate, avg_per90, distance_to_threshold computed in defcon.py and displayed in columns.tsx. |
| DEF-03 | Plans 01, 02 | Hypothesis analysis: do players get more DefCon in tough vs easy fixtures? | ✓ SATISFIED | _compute_fixture_correlation() in defcon.py splits games into easy/hard buckets, returns hit rates or insufficient_data. |
| DEF-04 | Plans 02, 03 | Separate ranking tables per position — no combined table (thresholds differ) | ✓ SATISFIED | splitByPosition() segregates DEF from MID/FWD. Two independent useReactTable instances with separate sort state. |
| UIX-01 | Plan 03 | Clear, data-forward layout using tabs or cards per section | ✓ SATISFIED | page.tsx implements tab navigation with "Gem Ratings" and "DefCon Analysis" tabs. Note: REQUIREMENTS.md traceability maps UIX-01 to Phase 3; Phase 4 extends it for DefCon. |
| UIX-02 | Plan 03 | Scannable tables with sort/filter by position | ✓ SATISFIED | Both DefCon tables have sortable columns (hit_rate, avg_per90, distance_to_threshold, web_name, hits). Independent sort state per table. Note: REQUIREMENTS.md traceability maps UIX-02 to Phase 3; Phase 4 extends it for DefCon. |

**Requirements traceability note:** REQUIREMENTS.md maps UIX-01 and UIX-02 to Phase 3 (where tab navigation and sortable GemTable were first built). Phase 4 Plan 03 also claims these IDs because it extends those patterns for DefCon. This is additive coverage, not a conflict. All 6 requirement IDs claimed across the three plans are accounted for.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/defcon.ts` | 5 | Exports a local `DefConPlayer` interface that duplicates the canonical one in `src/lib/types.ts` | ℹ️ Info | No runtime impact — TypeScript build passes because both definitions are structurally identical. A TODO comment at L3-4 documents the intended cleanup. Not a stub. |
| `pipeline/cache/merged_players.json` | multiple | Contains old `"defensive_contributions"` (plural) keys — stale cached output from pre-Phase-4 pipeline run | ⚠️ Warning | Not a source code bug. Source (merge.py) is fixed. Cached file will be overwritten on next pipeline run. The Zod schema will reject this old field on next API call since `merged_players.json` is served by `/api/players` which doesn't use the DefCon field. No functional regression for existing views. |

### Human Verification Required

### 1. Visual DefCon Tables

**Test:** After running `python pipeline/run.py` to generate `defcon_stats.json`, start `npm run dev` and visit `http://localhost:3000`. Click "DefCon Analysis" tab.
**Expected:** Two separate tables render — "Defenders (threshold: 10 contributions)" and "Midfielders & Forwards (threshold: 12 contributions)". DEF table shows only defenders, MID/FWD table shows midfielders and forwards. Hit rates display as percentages. Distance column shows green text for negative values, red for positive. Tables sort independently.
**Why human:** Requires running the pipeline (external API calls, ~2 min) and a live dev server. The 04-03-SUMMARY.md documents human approval of Task 3 visual checkpoint but this cannot be re-confirmed programmatically.

### 2. Post-pipeline merged_players.json field name

**Test:** After running `python pipeline/run.py`, check `pipeline/cache/merged_players.json` for the field name.
**Expected:** All player records contain `"defensive_contribution"` (singular), not `"defensive_contributions"` (plural).
**Why human:** The cache file currently has plural keys (stale output). Source code is fixed. This resolves on next pipeline run but requires manual confirmation.

### Gaps Summary

One gap blocks full goal achievement in the live application: `pipeline/cache/defcon_stats.json` does not exist. The pipeline (run.py) has been correctly wired to compute and write this file — `compute_defcon_stats()` is called, the result is passed to `save('defcon_stats.json', ...)` — but the pipeline has not been executed since Phase 4 was completed. Without this file, `GET /api/defcon` returns a 404 response, causing the DefConTables component to show its error state rather than the DefCon data.

All source code is complete and correct. The gap is an operational one: the pipeline must be run to populate the cache. Once `python pipeline/run.py` is executed successfully, the full goal will be achieved.

---

_Verified: 2026-03-28T22:37:00Z_
_Verifier: Claude (gsd-verifier)_
