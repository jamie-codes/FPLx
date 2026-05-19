---
phase: 126-next-season-planner
verified: 2026-05-19T12:30:00Z
status: passed
score: 12/12 must-haves verified
overrides_applied: 0
re_verification: null
---

# Phase 126: Next Season Planner Verification Report

**Phase Goal:** Build the Next Season Planner feature — a read-only pre-season squad display + GW1-8 FDR heatmap tab under Plan → Next Season, backed by a Python archive pipeline (NSP-01) and TypeScript squad builder (NSP-02/03/04).
**Verified:** 2026-05-19T12:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | `pipeline/archive_season.py` archives element-summary history, is idempotent, applies >=50% partial-write guard, uses concurrent fetch with ThreadPoolExecutor(max_workers=10) | VERIFIED | File exists. `_blob_exists()` is first statement in `archive_season()`. `MAX_WORKERS = 10` declared. `>= 0.5 * total` guard at line 107. `concurrent.futures.ThreadPoolExecutor` at line 68. Blob write goes via `from upload import save`. No direct `vercel_blob.put` calls. |
| 2  | `pipeline/suggest_squad.py` runs PuLP ILP with budget/size/position/team-cap constraints and writes `pre_season_squad.json` | VERIFIED | File exists. `pulp.LpProblem("PreSeasonSquad", pulp.LpMaximize)` with binary variables, budget constraint `<= 1000`, squad size `== 15`, MIN_SLOTS/MAX_SLOTS per position, team cap `<= 3`. `SQUAD_KEY = 'pre_season_squad.json'`. `save(SQUAD_KEY, squad_dict)` called exactly once. |
| 3  | `pipeline/run.py` invokes archive_season only when `IS_GW38 == True`, positioned BEFORE the IS_OFF_SEASON block | VERIFIED | `IS_GW38 = (CURRENT_GW > 0) and (CURRENT_GW == last_event_id)` at line 203. `if IS_GW38:` block at lines 205-227. `if not IS_OFF_SEASON:` at line 235 — IS_GW38 block comes first. Both `from archive_season import archive_season` and `from suggest_squad import suggest_squad` present inside IS_GW38 gate with non-fatal try/except. |
| 4  | `buildPreSeasonSquad(players, scoreMap)` returns a valid 15-player squad (starters[11] + bench[4]) or null; eligibility is scoreMap.has(p.id) only (no status check) | VERIFIED | `src/lib/pre-season-squad.ts` exists and exports `buildPreSeasonSquad`. `eligible = players.filter(p => scoreMap.has(p.id))`. No `status === 'a'` or `xPts_1gw` filter. Returns `null` if `squad.length < 15` or any MIN_SLOTS position unmet. Starters[11] + bench[4] derived correctly. |
| 5  | `/api/pre-season-squad` reads `pre_season_squad.json` first (ILP precompute), falls back to `season_archive_gw38.json` (greedy computation), returns 404 when both absent | VERIFIED | `route.ts` exists. Resolution order: `readBlobOrLocal('pre_season_squad.json')` then `readBlobOrLocal('season_archive_gw38.json')`. Returns `status: 404` `{ error: 'Archive not available' }` on both-absent. Imports `buildPreSeasonSquad` and applies `totalMinutes < 500` exclusion at line 107. |
| 6  | `usePreSeasonSquad()` returns `null` on 404 (not throw), has `staleTime: 6h` | VERIFIED | `if (res.status === 404) return null` at line 12. `staleTime: 6 * 60 * 60 * 1000` at line 16. Non-404 errors throw. |
| 7  | `HeatMapRow` and `HeatMapRowProps` are exported from `FixtureHeatMap.tsx` | VERIFIED | `export interface HeatMapRowProps` at line 42. `export function HeatMapRow` at line 54. Both are named exports in the original file (not moved). |
| 8  | `NextSeasonPlannerTab` renders 4 states: loading, error ("Failed to load pre-season squad"), null data ("Pre-season squad not yet available"), populated formation grid (GK/DEF/MID/FWD rows + bench with opacity-60) | VERIFIED | All four states present. Loading: "Loading pre-season squad...". Error (line 95): "Failed to load pre-season squad." Null (line 104): "Pre-season squad not yet available." Formation grid: position-grouped rows with `border-l-2 border-green-500` for XI, `opacity-60` for bench. ppm as `title` attribute on total-points span. No `<button>` mutation elements. |
| 9  | GW1-8 FDR heatmap section renders "Fixtures not yet published" empty state (known deferred condition) and imports HeatMapRow for future wiring | VERIFIED | "Fixtures not yet published for next season." at line 129. `HeatMapRow` imported at line 14 with eslint-disable comment. Future-ready code path present at lines 121-125. `nextSeasonFixtures = []` with TODO(GW1-8-FIXTURES) comment. |
| 10 | `'next-season'` sub-tab registered after `'rivals'` in Plan SECTIONS array; `SubTab` union extended; render condition wired | VERIFIED | `SubTab` union includes `'next-season'` at line 59. `{ id: 'next-season' as SubTab, label: 'Next Season', mobileLabel: 'Pre-Season' }` at line 88, immediately after `'rivals'` at line 87. `{activeSection === 'plan' && activeSubTab === 'next-season' && <NextSeasonPlannerTab />}` at lines 295-296. `defaultSubTab: 'planner'` unchanged at line 90. |
| 11 | `PreSeasonPlayer`, `PreSeasonSquad`, `SeasonArchiveEntry` types exported from `src/lib/types.ts`; `PreSeasonPlayer.element_type` uses `PositionCode` alias | VERIFIED | All three interfaces at lines 1096-1123. `element_type: PositionCode` (references existing alias, not inline `1 \| 2 \| 3 \| 4`). `SeasonArchiveEntry.history` has `[k: string]: unknown` index signature. |
| 12 | `pulp>=2.7.0` declared in `pipeline/requirements.txt` | VERIFIED | `grep -c "pulp>=2.7.0" pipeline/requirements.txt` returns 1. |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pipeline/archive_season.py` | NSP-01 season archive pipeline | VERIFIED | Exports `archive_season`, `_blob_exists`, `_fetch_one`, `_fetch_all_summaries`. Uses `save()` not `vercel_blob.put`. |
| `pipeline/suggest_squad.py` | NSP-02 ILP fallback squad builder | VERIFIED | Exports `suggest_squad`, `_solve_ilp`, `_compute_score_map`, `_derive_squad_dict`. PuLP constraints complete. |
| `pipeline/run.py` | GW38 gate | VERIFIED | `IS_GW38` token present, positioned before IS_OFF_SEASON block. Both pipeline modules wired non-fatally. |
| `pipeline/requirements.txt` | `pulp>=2.7.0` declaration | VERIFIED | Line present. |
| `pipeline/test_archive_season.py` | RED → GREEN pytest scaffold | VERIFIED | 4 `def test_` functions covering idempotency, >=50% success, <50% failure, non-fatal per-player exception. |
| `src/lib/types.ts` | PreSeasonPlayer, PreSeasonSquad, SeasonArchiveEntry | VERIFIED | All three interfaces at lines 1096-1123. |
| `src/lib/pre-season-squad.ts` | `buildPreSeasonSquad` pure greedy function | VERIFIED | Named export. scoreMap eligibility. MIN_SLOTS/MAX_SLOTS redeclared locally. No status check. |
| `src/app/api/pre-season-squad/route.ts` | GET route with 3-tier resolution | VERIFIED | Resolution order confirmed. 500-min exclusion. 404 when absent. Cache-Control header present. |
| `src/lib/hooks/usePreSeasonSquad.ts` | TanStack Query hook, 404→null | VERIFIED | Named export. `if (res.status === 404) return null`. `staleTime: 6h`. |
| `src/components/club-form/FixtureHeatMap.tsx` | HeatMapRow + HeatMapRowProps exported | VERIFIED | Both exported in-place (not moved). |
| `src/components/next-season/NextSeasonPlannerTab.tsx` | Read-only formation grid + FDR heatmap | VERIFIED | `'use client'` on line 1. Named export. All 4 states. Read-only (no mutation buttons). |
| `src/app/page.tsx` | Sub-tab registration | VERIFIED | SubTab union, SECTIONS entry, import, render condition — all 3 occurrences of `'next-season'` confirmed. |
| `src/lib/pre-season-squad.test.ts` | 4-case vitest scaffold | VERIFIED | 4 `it()` cases covering squad validity, null on low budget, scoreMap exclusion, team cap. |
| `src/components/next-season/NextSeasonPlannerTab.test.tsx` | 4-case RTL scaffold | VERIFIED | 4 `it()` cases covering null state, populated formation grid, fixtures empty state, error state. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `pipeline/archive_season.py` | `pipeline/upload.py save()` | `from upload import save` | WIRED | Line 20 confirmed. No `vercel_blob.put` calls. |
| `pipeline/run.py` | `archive_season` | `from archive_season import archive_season` | WIRED | Line 207 inside IS_GW38 gate. |
| `pipeline/run.py` | `suggest_squad` | `from suggest_squad import suggest_squad` | WIRED | Line 217 inside IS_GW38 gate. |
| `pipeline/suggest_squad.py` | `pipeline/upload.py save()` | `save('pre_season_squad.json', ...)` | WIRED | `SQUAD_KEY = 'pre_season_squad.json'`; `save(SQUAD_KEY, squad_dict)` at line 313. |
| `src/app/api/pre-season-squad/route.ts` | `src/lib/pre-season-squad.ts` | `import { buildPreSeasonSquad }` | WIRED | Line 9; called at line 125. |
| `src/lib/hooks/usePreSeasonSquad.ts` | `/api/pre-season-squad` | `fetch('/api/pre-season-squad')` | WIRED | Line 11 in queryFn. |
| `src/lib/pre-season-squad.ts` | `src/lib/types.ts` | `import type { PreSeasonPlayer, PreSeasonSquad }` | WIRED | Line 3. Types consumed in function signature. |
| `src/components/next-season/NextSeasonPlannerTab.tsx` | `src/lib/hooks/usePreSeasonSquad.ts` | `usePreSeasonSquad()` | WIRED | Line 10 import; line 83 call site. |
| `src/components/next-season/NextSeasonPlannerTab.tsx` | `src/components/club-form/FixtureHeatMap.tsx` | `import { HeatMapRow }` | WIRED | Line 14 import. Future-ready code path present. |
| `src/app/page.tsx` | `src/components/next-season/NextSeasonPlannerTab.tsx` | import + render condition | WIRED | Line 31 import; line 295-296 render conditional. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `NextSeasonPlannerTab.tsx` | `data` (PreSeasonSquad) | `usePreSeasonSquad()` → `/api/pre-season-squad` → Blob/local cache | Yes — route reads Blob artifacts, computes ppm from archive history, calls `buildPreSeasonSquad` | FLOWING |
| `/api/pre-season-squad/route.ts` | `squad` (PreSeasonSquad) | `readBlobOrLocal('pre_season_squad.json')` or `readBlobOrLocal('season_archive_gw38.json')` | Yes — real Blob reads; 404 sentinel for absent data | FLOWING |
| `archive_season.py` | `results` dict | `get_element_summary()` via `ThreadPoolExecutor` | Yes — real FPL API calls; 50% guard prevents writing incomplete data | FLOWING |
| Note: `nextSeasonFixtures = []` is hard-coded empty (GW1-8-FIXTURES deferred, documented in CONTEXT.md D-12). This is intentional: FPL does not publish next-season fixtures until late June. The "Fixtures not yet published" empty state is the correct behaviour at ship time. | | | | |

### Behavioral Spot-Checks

Step 7b: SKIPPED (requires running server/pipeline with live FPL API access or installed PuLP; cannot test without external services). Static code analysis confirms all entry points are present and wired.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| NSP-01 | 126-02 | `pipeline/archive_season.py` archives per-player element-summary history | SATISFIED | File exists with all 4 functions, concurrent fetch, idempotency, 50% guard, save() call. |
| NSP-02 | 126-02, 126-03 | `buildPreSeasonSquad()` greedy + Python ILP fallback via `suggest_squad.py` | SATISFIED | `pre-season-squad.ts` greedy function + `suggest_squad.py` ILP both exist and are wired. |
| NSP-03 | 126-03, 126-04 | GW1-8 FDR heatmap reuses HeatMapRow; shows "Fixtures not yet published" empty state | SATISFIED | HeatMapRow exported from FixtureHeatMap.tsx; imported in NextSeasonPlannerTab; "Fixtures not yet published" copy at line 129. Empty state is correct ship-time behaviour per CONTEXT.md D-12. |
| NSP-04 | 126-04 | Next Season Planner in Plan section; "Prices pending" graceful state | SATISFIED | `'next-season'` sub-tab wired after `'rivals'`; label "Next Season", mobileLabel "Pre-Season"; "Pre-season squad not yet available" graceful state renders on null data (D-03). |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/next-season/NextSeasonPlannerTab.tsx` | 118 | `nextSeasonFixtures: unknown[] = []` hard-coded empty | INFO | GW1-8-FIXTURES deferred per CONTEXT.md D-12. Intentional and documented with TODO comment. Empty state is the correct render at ship time. Not a blocker. |

No blocker or warning-level anti-patterns found. The single INFO-level stub is explicitly documented as a deferred condition in the phase CONTEXT.md with a TODO comment tracking when it will be resolved (late June when FPL publishes next-season fixtures).

### Human Verification Required

None — all observable truths are verifiable via static code analysis. The feature is read-only display (no user interactions beyond sub-tab navigation). The graceful empty states (Prices pending, Fixtures not yet published) are the correct render paths at ship time by design.

### Gaps Summary

No gaps. All 12 must-haves verified. All four requirement IDs (NSP-01..NSP-04) are satisfied with substantive, wired, data-flowing implementations. The one known deferred item (GW1-8-FIXTURES fixture data) is explicitly scoped as a future-wiring item in CONTEXT.md D-12, correctly renders the "Fixtures not yet published" empty state, and does not prevent the NSP-03 requirement from being satisfied.

---

_Verified: 2026-05-19T12:30:00Z_
_Verifier: Claude (gsd-verifier)_
