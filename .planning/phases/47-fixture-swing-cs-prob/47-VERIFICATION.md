---
phase: 47-fixture-swing-cs-prob
verified: 2026-05-01T15:06:00Z
status: human_needed
score: 9/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "CS% values visible in GemTable Analysis preset after pipeline re-run"
    expected: "GK/DEF rows show percentages like 42%, 28%, 0%. MID/FWD rows show em-dash."
    why_human: "merged_players.json cache was last modified 2026-04-30 (before Phase 47 pipeline commit on 2026-05-01). The pipeline code is correct and tested (7/7 pytest passing), but the deployed cache has 0/830 players with cs_prob_1gw. The GemTable CS% column will show em-dash or undefined for all rows until the pipeline re-runs."
---

# Phase 47: Fixture Swing Detector & Clean Sheet Probability — Verification Report

**Phase Goal:** Users can see which teams have materially improving or worsening fixtures and accurate CS% for every upcoming fixture — giving proactive buy/sell signals and grounding defensive picks in data
**Verified:** 2026-05-01T15:06:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| SC-1 | User can see a panel listing teams with materially improving/worsening upcoming fixtures with quantified ease delta | VERIFIED | `FixtureSwingDetector.tsx` exists (258 lines), is mounted in `page.tsx` between `FixtureEaseRankingPanel` and `ClubFormTable`, implements `SWING_THRESHOLD = 0.20`, `ROW_CAP = 4`, and renders Improving/Worsening sections with delta percentages. |
| SC-2 | Fixture swing view is toggleable across 1/3/5 GW windows | VERIFIED | `GwToggle` wired in component: `<GwToggle value={win} onChange={setWin} />`. `swingValue()` and `easeValue()` helper functions return `swing_1gw`/`swing_3gw`/`swing_5gw` per active window. |
| SC-3 | User's squad players from high-swing teams are visually highlighted | VERIFIED | `useTeamIdFromStorage()` reads `fpl_team_id` from localStorage (consistent with `page.tsx` key). `useSquad(teamId)` fetches squad picks. `ownedTeamIds: Set<number>` computed from squad picks + players. "You own N" badge rendered; click/Enter/Space expand toggle works. |
| SC-4 | User can see CS% per fixture for GK/DEF-relevant teams in GemTable Analysis preset | VERIFIED (code) / UNCERTAIN (live data) | `columns.tsx` has `col.accessor('cs_prob_1gw', ...)` with position-gated cell renderer (GK/DEF → percentage, MID/FWD → em-dash). `GwToggle.tsx` hides it in Default/Compact/mobile, absent from analysis preset (visible). Pipeline code `_cs_prob_1gw_for_fixtures()` and `player['cs_prob_1gw']` assignment are present. **However**: `merged_players.json` cache (last modified 2026-04-30) has 0/830 players with `cs_prob_1gw` — the pipeline has not been re-run since the Phase 47 code landed. Live CS% display requires a pipeline re-run. |
| SC-5 | DGW fixtures show combined CS% using `1 - (1-p1)*(1-p2)` formula | VERIFIED (code/tests) / UNCERTAIN (live) | `_cs_prob_1gw_for_fixtures()` uses `groupby(event_id)` to take only the first event group, then computes `1 - prod(1-p_i)`. Pytest `test_dgw_combined_probability` passes. Same cache freshness caveat as SC-4. |

**Score: 9/10 must-haves verified** (SC-4 and SC-5 are code-verified but live data requires human confirmation after pipeline re-run)

---

### Plan-level Must-Have Truths

| Plan | Truth | Status | Evidence |
|------|-------|--------|---------|
| 47-01 | `ClubForm` carries `past_ease_3gw`, `swing_1gw`, `swing_3gw`, `swing_5gw` fields | VERIFIED | `src/lib/types.ts` lines 392–395: all four fields present as `number \| null`. |
| 47-01 | `MergedPlayer` carries optional `cs_prob_1gw` field | VERIFIED | `src/lib/types.ts` line 184: `cs_prob_1gw?: number` present in `MergedPlayer` interface. |
| 47-01 | TypeScript build passes with extended types | VERIFIED | `npx tsc --noEmit` exits 0. Only pre-existing `captain-picks.test.ts` errors (5 errors, pre-Phase-47, confirmed in SUMMARY). |
| 47-02 | `computeClubForm()` emits `past_ease_3gw` from last 3 finished fixtures | VERIFIED | `src/lib/club-form.ts` lines 175–186: `finishedFx = teamFinished.get(tId).slice(-3)`, `past_ease_3gw = finishedFx.length >= 3 ? meanEase(finishedFx, 3, 'attacking_difficulty') : null`. |
| 47-02 | `swing_1gw`, `swing_3gw`, `swing_5gw` computed as delta with null guard | VERIFIED | Lines 205–207: `swing_1gw: attacking_ease_1gw != null && past_ease_3gw != null ? attacking_ease_1gw - past_ease_3gw : null` (and same for 3gw/5gw). |
| 47-02 | BGW teams get null swing values | VERIFIED | When `teamUpcoming.get(tId)` is empty, `attacking_ease_1gw = null` → swing values all null. Confirmed by Test 4 in `club-form-swing.test.ts`. |
| 47-02 | Teams with fewer than 3 finished fixtures get `past_ease_3gw = null` | VERIFIED | `finishedFx.length >= 3` guard at line 184. Test 5 asserts null for 2 finished fixtures. |
| 47-03 | `merged_players.json` carries `cs_prob_1gw` for every player | UNCERTAIN | Pipeline code is correct; `player['cs_prob_1gw'] = _cs_prob_1gw_for_fixtures(...)` at line 951 of `merge.py`. But cache was generated 2026-04-30, before the pipeline change. Current cache has 0/830 players with the field. |
| 47-03 | BGW players get `cs_prob_1gw = 0` (not null, not missing) | VERIFIED (code) | `_cs_prob_1gw_for_fixtures([], xmins)` returns `0.0`. Test 3 passes. |
| 47-03 | DGW players get combined probability | VERIFIED (code) | `groupby(event_id)` → first group → `1 - prod(1-p_i)`. Test 2 and Test 6 pass. 7/7 pytest passing. |
| 47-04 | GemTable defines `cs_prob_1gw` column rendering CS% for GK/DEF, em-dash for MID/FWD | VERIFIED | `columns.tsx` lines 224–245: accessor with `element_type` check (1/2 → percentage, others → em-dash). |
| 47-04 | Default and Compact presets HIDE the CS% column | VERIFIED | `GwToggle.tsx`: `cs_prob_1gw: false` in `PRESET_COLUMN_VISIBILITY.default` and `PRESET_COLUMN_VISIBILITY.compact`. |
| 47-04 | Analysis preset SHOWS the CS% column | VERIFIED | Key is absent from `PRESET_COLUMN_VISIBILITY.analysis` — per the inverted-convention comment, absent key = visible. |
| 47-04 | Mobile layout HIDES the CS% column | VERIFIED | `cs_prob_1gw: false` in `MOBILE_HIDDEN_COLUMNS`. |
| 47-05 | Club Form tab shows FixtureSwingDetector below FixtureEaseRankingPanel | VERIFIED | `page.tsx` lines 165–170: `<FixtureEaseRankingPanel />`, then `<FixtureSwingDetector />`, then `<ClubFormTable />`. |
| 47-05 | Panel has Improving/Worsening sections with 0.20 threshold | VERIFIED | `SWING_THRESHOLD = 0.20` (line 20). Improving: `swing >= SWING_THRESHOLD`, Worsening: `swing <= -SWING_THRESHOLD`. |
| 47-05 | Each section shows up to 4 teams sorted by absolute delta | VERIFIED | `ROW_CAP = 4` (line 22). `.slice(0, ROW_CAP)` applied after sorting. Improving sorted descending by swing; worsening sorted ascending (most-negative first). |
| 47-05 | GwToggle switches the upcoming window | VERIFIED | `useState<Win>(3)` for default window. `swingValue(team, win)` dispatches to correct field. |
| 47-05 | "You own N" badge with expand interaction | VERIFIED | Badge rendered when `ownedCount > 0`. `onClick`/`onKeyDown`/`tabIndex=0`/`role="button"` on rows with owned players. Single expand state via `expandedTeamId`. |
| 47-05 | BGW teams silently excluded | VERIFIED | `.filter(row => row.swing !== null && row.ease !== null)` before classification. |
| 47-05 | Empty-state copy renders when no teams qualify | VERIFIED | Both sections have `length === 0` conditional rendering empty-state paragraph. |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/types.ts` | Extended `ClubForm` + `MergedPlayer` interfaces | VERIFIED | All 5 new fields present: `past_ease_3gw`, `swing_1gw`, `swing_3gw`, `swing_5gw` in `ClubForm`; `cs_prob_1gw?` in `MergedPlayer`. |
| `src/lib/club-form.ts` | Swing computation in `computeClubForm()` | VERIFIED | Substantive implementation: past window built from `teamFinished.get(tId).slice(-3)`, `meanEase()` reused, swing deltas computed with null guards. |
| `src/lib/__tests__/club-form-swing.test.ts` | 6 Vitest tests for swing math | VERIFIED | File exists, 6 tests (Test 1–6 per spec). All 6 pass: `6 passed (6)`. |
| `pipeline/merge.py` | `_cs_prob_1gw_for_fixtures()` + `player['cs_prob_1gw']` assignment | VERIFIED | Function at line 141. Assignment at line 951. Co-located after `xPts_components_1gw`. |
| `pipeline/tests/test_merge_cs_prob.py` | 7 pytest tests (1 precondition + 6 behavioral) | VERIFIED | File exists, 7 tests. All 7 pass: `7 passed`. |
| `src/components/gem-table/columns.tsx` | `cs_prob_1gw` column accessor | VERIFIED | `col.accessor('cs_prob_1gw', ...)` at line 229. Header `H('CS%', ...)` with correct tooltip. Position-gated cell renderer. |
| `src/components/gem-table/GwToggle.tsx` | Preset visibility wiring | VERIFIED | Exactly 3 occurrences of `cs_prob_1gw: false` (mobile + compact + default). Absent from analysis. |
| `src/components/club-form/FixtureSwingDetector.tsx` | `FixtureSwingDetector` React component | VERIFIED | 258 lines. All required patterns present: `SWING_THRESHOLD`, `ROW_CAP`, `useClubForm`, `usePlayers`, `useSquad`, `GwToggle`, `EaseBar`, `swing_1gw/3gw/5gw`, "You own", `data-testid="fixture-swing-panel"`. |
| `src/app/page.tsx` | Mount point between `FixtureEaseRankingPanel` and `ClubFormTable` | VERIFIED | Import at line 12. `<FixtureSwingDetector />` at line 168, between the two existing components. |
| `src/app/page.test.tsx` | `vi.mock` for `FixtureSwingDetector` | VERIFIED | `vi.mock('@/components/club-form/FixtureSwingDetector', ...)` at line 20. 7/7 page tests pass. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/types.ts` | `src/lib/club-form.ts` | `ClubForm.past_ease_3gw` / `swing_*gw` filled | WIRED | `computeClubForm()` computes and pushes all 4 new fields. |
| `src/lib/types.ts` | `src/components/gem-table/columns.tsx` | `MergedPlayer.cs_prob_1gw` | WIRED | `col.accessor('cs_prob_1gw', ...)` directly reads the typed field. |
| `src/lib/club-form.ts` | `src/lib/__tests__/club-form-swing.test.ts` | imports `computeClubForm` and asserts new fields | WIRED | `import { computeClubForm } from '@/lib/club-form'` at test line 2. All 6 tests assert `past_ease_3gw`, `swing_1gw/3gw/5gw`. |
| `pipeline/merge.py` | `merged_players.json` (pipeline output) | `player['cs_prob_1gw'] = ...` | WIRED (code) / NOT YET IN CACHE | Code correct; cache stale (pre-Phase-47 pipeline run). |
| `src/components/club-form/FixtureSwingDetector.tsx` | `src/lib/hooks/useClubForm.ts` | `useClubForm()` | WIRED | Import at component line 4; called in component body. |
| `src/components/club-form/FixtureSwingDetector.tsx` | `src/lib/hooks/usePlayers.ts` | `usePlayers()` | WIRED | Import at line 5; called in component body. |
| `src/components/club-form/FixtureSwingDetector.tsx` | `src/lib/hooks/useSquad.ts` | `useSquad(teamId)` | WIRED | Import at line 6; called in component body. |
| `src/app/page.tsx` | `src/components/club-form/FixtureSwingDetector.tsx` | import + JSX mount | WIRED | Import at page.tsx line 12. `<FixtureSwingDetector />` at line 168. |
| `src/components/gem-table/GwToggle.tsx` | `src/components/gem-table/GemTable.tsx` | `PRESET_COLUMN_VISIBILITY` drives visibility | WIRED | `cs_prob_1gw: false` in 3 presets; absent from analysis. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `FixtureSwingDetector.tsx` | `data` (ClubForm[]) | `useClubForm()` → `/api/club-form` → `computeClubForm()` | YES — `computeClubForm()` now produces `swing_*gw` fields from finished fixture data | FLOWING |
| `columns.tsx` CS% cell | `cs_prob_1gw` (MergedPlayer) | pipeline `merge.py` → `merged_players.json` → `/api/players` | STALE — pipeline code correct but cache last generated before Phase 47; 0/830 players have field in current cache | STATIC (cache stale) |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Swing test suite — all 6 tests pass | `npx vitest run src/lib/__tests__/club-form-swing.test.ts` | 6 passed (6) | PASS |
| Pipeline CS probability tests — all 7 pass | `python -m pytest pipeline/tests/test_merge_cs_prob.py -v` | 7/7 passed | PASS |
| Full pipeline test suite — no regressions | `python -m pytest pipeline/tests/ -q` | 33 passed | PASS |
| Page-level tests — FixtureSwingDetector mock wired | `npx vitest run src/app/page.test.tsx` | 7 passed (7) | PASS |
| TypeScript compile — no new errors | `npx tsc --noEmit` | 0 errors (5 pre-existing in `captain-picks.test.ts`) | PASS |
| cs_prob_1gw in live cache | `python -c "...count cs_prob_1gw in cache..."` | 0/830 players have field | FAIL — cache stale |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| CS-01 | 47-01, 47-03, 47-04 | User can see CS% per fixture for GK/DEF teams, derived from rolling xGA | VERIFIED (code) / NEEDS PIPELINE RUN | `cs_prob_1gw` field in types, pipeline function, GemTable column all present. Cache stale. |
| CS-02 | 47-03 | DGW CS% shows combined probability `1-(1-p1)*(1-p2)` | VERIFIED (code/tests) / NEEDS PIPELINE RUN | `_cs_prob_1gw_for_fixtures` uses `groupby(event_id)` + combined formula. Pytest confirms. |
| CS-03 | 47-04 | CS% surfaced in GK/DEF-oriented context (GemTable column) | VERIFIED | `cs_prob_1gw` column in `columns.tsx` — GK/DEF show percentage, MID/FWD show em-dash. Analysis preset shows it. |
| SWG-01 | 47-01, 47-02, 47-05 | Teams with materially improving fixtures visible (buy signal) | VERIFIED | Improving section in FixtureSwingDetector with `swing >= 0.20` filter. |
| SWG-02 | 47-01, 47-02, 47-05 | Teams with materially worsening fixtures visible (sell signal) | VERIFIED | Worsening section with `swing <= -0.20` filter. |
| SWG-03 | 47-01, 47-02, 47-05 | Swing view toggleable across 1/3/5 GW windows | VERIFIED | `GwToggle` in panel; `swingValue(team, win)` dispatches to correct field. |
| SWG-04 | 47-05 | User's owned players from high-swing teams highlighted | VERIFIED | "You own N" badge + expand sub-row via `useSquad`/`usePlayers`. `fpl_team_id` localStorage key consistent across codebase. |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `pipeline/cache/merged_players.json` | — | Stale cache — 0/830 players have `cs_prob_1gw` | Warning | CS% column shows em-dash/undefined for all rows in current deployment until pipeline re-runs. Not a code defect — this is the expected state before a pipeline refresh. |

No placeholder/stub patterns found in any implementation file. No `TODO`/`FIXME` comments in Phase 47 code. No empty handlers or empty returns in critical paths.

---

### Human Verification Required

#### 1. CS% Column End-to-End After Pipeline Re-Run

**Test:** Run the pipeline locally: `python -m pipeline.run --offline` (or equivalent). Then verify:
- `python -c "import json; rows=json.load(open('pipeline/cache/merged_players.json', encoding='utf-8')); print(sum(1 for r in rows if 'cs_prob_1gw' in r), '/', len(rows))"` should print `<N>/<N>` (100%).
- Start `npm run dev`. Navigate to Analyse → Gem Ratings, switch preset to **Analysis**.
- Confirm GK/DEF rows show percentages like `42%`, `28%`, `0%`.
- Confirm MID/FWD rows show em-dash (`—`).
- Switch to **Default** and **Compact** presets — CS% column must be hidden.
- On a narrow viewport (< 640 px), CS% must be hidden in all presets.

**Expected:** 100% of players have `cs_prob_1gw`. GK/DEF show percentages in Analysis preset. Column hidden elsewhere.

**Why human:** The `merged_players.json` cache (last modified 2026-04-30) does not yet contain `cs_prob_1gw`. Pipeline code is correct and fully tested, but the deployed data file predates the Phase 47 pipeline commit. A pipeline re-run is required before the CS% column can be visually confirmed.

---

### Gaps Summary

No code gaps. All implementation files exist, are substantive (not stubs), and are correctly wired. The single outstanding item is operational: the `merged_players.json` cache needs a pipeline re-run to include the `cs_prob_1gw` field that the Phase 47 pipeline code now generates. This is expected — the cache is not committed to git and is refreshed by running the pipeline.

Once the pipeline re-runs and the cache is refreshed (or the app is redeployed with a fresh pipeline output), all 7 requirements (CS-01, CS-02, CS-03, SWG-01, SWG-02, SWG-03, SWG-04) will be fully observable in production.

---

_Verified: 2026-05-01T15:06:00Z_
_Verifier: Claude (gsd-verifier)_
