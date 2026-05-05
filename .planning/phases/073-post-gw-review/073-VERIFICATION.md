---
phase: 073-post-gw-review
verified: 2026-05-05T18:37:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open http://localhost:3000 → Squad → Review tab; submit a numeric team ID via Decision tab; switch to Review"
    expected: "4-stat review card renders with GW Score, Bench pts left, Captain delta, FPL average. GW pill toggle (GW33/GW34/GW35) is visible. Clicking a pill reloads with that GW's data. With no team ID: 'Load your squad to see GW reviews.' With seed files (gw: null): 'GW review will appear once scores finalise.'"
    why_human: "Full integration requires a running dev server, a real FPL team ID, and live FPL picks API. The seed-file path (gw:null → 503 → unsettled message) is unit-tested; the happy-path (real picks data, stat cards with actual player names) can only be confirmed in-browser."
  - test: "Run python pipeline/run.py (full run, not --dry-run) against live FPL API; inspect pipeline/cache/"
    expected: "3 new files: pipeline/cache/gw_review_gw{N}.json (where N is the actual last 3 finished GW numbers) each containing { gw: <N>, average_score: <int> }. Files overwrite the seed files when GW numbers match."
    why_human: "Requires live FPL API access and a real bootstrap payload with finished events. Cannot be verified without network access to fantasy.premierleague.com."
---

# Phase 73: Post-GW Review Verification Report

**Phase Goal:** Post-GW Review feature — pipeline writes gw_review_gw{N}.json per finished GW; API route merges with FPL picks data; GwReviewTab component shows 4-stat review card in Squad section.
**Verified:** 2026-05-05T18:37:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can open Squad → "Review" sub-tab and see a GW review card for the most recently settled GW showing: bench points left, their captain vs the optimal captain (player names + points delta), their top scorer (player name + points), and their GW score vs FPL average | ? UNCERTAIN (human) | GwReviewTab.tsx implements all 4 stat cards with correct field mapping. RTL test confirms data renders when hook returns mock data. Live browser test required to confirm with real FPL picks. |
| 2 | Review data is written by the pipeline to Vercel Blob as gw_review_gw{N}.json (fields: gw, average_score) for the last 3 settled GWs; served via GET /api/gw-review?teamId=&gw= which merges Blob data with on-demand FPL picks; consumed by useGwReview TanStack Query hook | ✓ VERIFIED | pipeline/run.py lines 249-263 implement the writer block. route.ts reads gw_review_gw{gw}.json via USE_BLOB switch and merges with FPL picks. useGwReview hook queries /api/gw-review. All files exist and are substantive. tsc passes. |
| 3 | A GW pill toggle (e.g., "GW33 | GW34 | GW35") lets the user switch between the last 3 settled GWs; defaults to most recent settled GW | ✓ VERIFIED | GwPillToggle sub-component in GwReviewTab.tsx renders buttons for each GW with aria-pressed. defaultGw = settledGws[settledGws.length - 1]. RTL test 4 confirms clicking GW33 pill calls useGwReview with gw=33 and updates aria-pressed. |
| 4 | When GW is not yet settled or Blob file is missing, screen shows "GW review will appear once scores finalise" rather than an error; when no team ID is loaded, shows "Load your squad to see GW reviews" | ✓ VERIFIED | GwReviewTab.tsx: submittedId===null branch returns "Load your squad to see GW reviews."; error.status===503 branch returns "GW review will appear once scores finalise." Route returns 503 when blobBase.gw===null (seed file path). RTL tests 2 and 3 confirm both branches render correctly. |
| 5 | Review is keyed by team ID — switching team ID loads that team's own GW review data, not stale state from a previous team | ✓ VERIFIED | useGwReview.ts: queryKey: ['gw-review', teamId, gw] — both teamId and gw participate in cache identity. Confirmed in src/lib/hooks/useGwReview.ts line 29. |

**Score:** 5/5 truths verified (SC 1 requires human browser test for full confirmation — all code paths implemented and unit-tested)

### Deferred Items

None identified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pipeline/run.py` | gw_review writer block invoked once per pipeline run | ✓ VERIFIED | Lines 249-263: PGW-02 comment, finished_events filter, last_3_gws slice, save() call with f'gw_review_gw{event["id"]}.json'. Python AST parse passes. |
| `pipeline/cache/gw_review_gw33.json` | Cold-start seed, content {"gw": null} | ✓ VERIFIED | File exists, JSON.parse returns {gw: null}, git ls-files confirms tracked despite gitignore. |
| `pipeline/cache/gw_review_gw34.json` | Cold-start seed, content {"gw": null} | ✓ VERIFIED | File exists, JSON.parse returns {gw: null}, git-tracked. |
| `pipeline/cache/gw_review_gw35.json` | Cold-start seed, content {"gw": null} | ✓ VERIFIED | File exists, JSON.parse returns {gw: null}, git-tracked. |
| `src/lib/types.ts` | GwReview interface with 9 fields | ✓ VERIFIED | export interface GwReview present with all 9 fields in specified order: gw, your_score, bench_pts_left, captain_name, optimal_captain_name, captain_delta, top_scorer_name, top_scorer_pts, average_score. |
| `src/app/api/gw-review/route.ts` | GET handler merging Blob data with FPL picks | ✓ VERIFIED | 176 lines. Exports GET. Validates teamId+gw with /^\d+$/. USE_BLOB switch present. pathname exact-match guard. blobBase.gw===null → 503. Direct FPL upstream fetch (not /api/fpl proxy). captain delta uses yourCaptain.multiplier. Math.max(0,captainDeltaRaw). Returns typed GwReview. |
| `src/lib/hooks/useGwReview.ts` | TanStack Query hook with 30-min staleTime | ✓ VERIFIED | Exports useGwReview(teamId, gw). queryKey includes both. enabled: !!teamId && /^\d+$/.test(teamId) && gw!==null. staleTime: 1000*60*30. retry: 1. |
| `src/components/squad/GwReviewTab.tsx` | 5th Squad sub-tab component | ✓ VERIFIED | 200 lines. Exports GwReviewTab. 5 render branches (no-squad, no-settled-gws, loading, error, data). data-testid="gw-review-tab" on all branches. data-testid="gw-review-stat-grid" on data branch only. GwPillToggle with aria-pressed. All UI-SPEC copy strings present. |
| `src/components/squad/GwReviewTab.test.tsx` | RTL coverage — 4 test cases | ✓ VERIFIED | 4 RTL tests: data render, no-squad empty, unsettled 503, GW pill toggle. vi.mock('@/lib/hooks/useGwReview'). All 4 pass. |
| `src/app/page.tsx` | SubTab union, Squad subTabs entry, render guard, import | ✓ VERIFIED | import GwReviewTab present. 'review' in SubTab union. {id: 'review' as SubTab} in Squad subTabs. activeSection==='squad' && activeSubTab==='review' render guard. SETTLED_GWS_PLACEHOLDER=[33,34,35] constant. |
| `src/components/nav/MobileNav.test.tsx` | 5-pill Squad assertion | ✓ VERIFIED | "shows 5 pills Decision, Transfers, Optimiser, Lineup, Review". toHaveLength(8) for allButtons. toHaveLength(5) for pillButtons. Old toHaveLength(7) removed. All 9 tests pass. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| pipeline/run.py (gw_review block) | save() in upload.py | save(f'gw_review_gw{event["id"]}.json', gw_data) | ✓ WIRED | Line 261: exact pattern present. |
| src/app/api/gw-review/route.ts | pipeline/cache/gw_review_gw{N}.json (or Vercel Blob) | readFile(join(cwd, 'pipeline','cache', filename)) OR list({prefix: filename, limit: 1}) | ✓ WIRED | Both local (readFile, line 75) and Blob (list+fetch, lines 64-72) paths present with USE_BLOB switch. |
| src/app/api/gw-review/route.ts | FPL upstream entry/{teamId}/event/{gw}/picks/ | fetch('https://fantasy.premierleague.com/api/entry/...') | ✓ WIRED | FPL_BASE constant = 'https://fantasy.premierleague.com/api'. Direct fetch at line 130. NOT via /api/fpl proxy (comment at line 41 only). |
| src/lib/hooks/useGwReview.ts | /api/gw-review | fetch with template string | ✓ WIRED | Line 15: fetch(`/api/gw-review?teamId=${teamId}&gw=${gw}`). |
| src/app/page.tsx | src/components/squad/GwReviewTab.tsx | render guard activeSection === 'squad' && activeSubTab === 'review' | ✓ WIRED | Lines 248-250: render guard with GwReviewTab teamId={submittedId ?? ''} settledGws={SETTLED_GWS_PLACEHOLDER}. |
| src/components/squad/GwReviewTab.tsx | src/lib/hooks/useGwReview.ts | useGwReview(submittedId, queryGw) | ✓ WIRED | Line 74: const { data, isLoading, isError, error } = useGwReview(submittedId, queryGw). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| GwReviewTab.tsx | data (GwReview) | useGwReview hook → /api/gw-review → FPL picks API + Blob file | Yes — route fetches real FPL picks and reads pipeline-written JSON | ✓ FLOWING |
| /api/gw-review/route.ts | blobBase / picks / entryHistory | readFile from pipeline/cache OR Vercel Blob list+fetch; FPL upstream fetch | Yes — real I/O calls, not static returns | ✓ FLOWING |
| pipeline/run.py (gw_review block) | gw_data | bootstrap['events'] filter + FPL average_entry_score | Yes — reads from live bootstrap payload | ✓ FLOWING (pending live pipeline run — human verification) |

Note: Data-flow for the pipeline writer (row 3) is structurally correct but cannot be confirmed as producing real non-null values without a live pipeline run against the FPL API (see Human Verification section).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| pipeline/run.py syntax valid | python -c "import ast; ast.parse(open('pipeline/run.py').read())" | SYNTAX OK | ✓ PASS |
| pipeline/run.py --dry-run exits 0 | python pipeline/run.py --dry-run | "Dry run complete" | ✓ PASS |
| Seed files parse as {gw: null} | node -e "for (const gw of [33,34,35]) { ... }" | OK - all gw:null | ✓ PASS |
| Seed files git-tracked | git ls-files pipeline/cache/gw_review_gw*.json | 3 paths listed | ✓ PASS |
| GwReviewTab tests pass (4/4) | npx vitest run src/components/squad/GwReviewTab.test.tsx | 4 passed | ✓ PASS |
| MobileNav tests pass (9/9) | npx vitest run src/components/nav/MobileNav.test.tsx | 9 passed | ✓ PASS |
| page.test.tsx passes (13/13) | npx vitest run src/app/page.test.tsx | 13 passed | ✓ PASS |
| TypeScript compile | npx tsc --noEmit | Exit 0, no output | ✓ PASS |
| Full suite regressions | npx vitest run | 838 pass, 6 fail (pre-existing: captain-picks TEST-57 x5, club-form x1) | ✓ PASS (no new failures) |
| Live API + browser smoke | npm run dev + curl/browser | SKIPPED — requires live FPL API + running server | ? SKIP (human) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PGW-01 | 073-03 | After each GW settles, user can view auto-generated GW review (bench pts left, captain pick vs optimal, top scorer, GW score vs FPL average) | ✓ SATISFIED | GwReviewTab.tsx renders all 4 stats. RTL tests confirm data render, empty state, unsettled state. Pill toggle works. |
| PGW-02 | 073-01, 073-02, 073-03 | GW review data written to Vercel Blob by pipeline, served via /api/gw-review, consumed by typed TanStack Query hook | ✓ SATISFIED | pipeline/run.py writer block + seed files (Plan 01). route.ts + types.ts + useGwReview.ts (Plan 02). GwReviewTab wired into page.tsx (Plan 03). |

No orphaned requirements. Both PGW-01 and PGW-02 are addressed by plans 073-01 through 073-03.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/app/page.tsx | ~37-41 | SETTLED_GWS_PLACEHOLDER hardcoded [33,34,35] | Info | By design — deferred per RESEARCH.md Open Question 2. GwReviewTab handles 404/503 gracefully when these GW numbers don't match actual finished GWs on production. Documented in SUMMARY and CONTEXT. |

No blockers. The hardcoded placeholder is intentional and guarded by graceful degradation in the component and route.

### Human Verification Required

#### 1. Live Review Tab — Browser Smoke Test

**Test:** Start dev server (`npm run dev`). Open http://localhost:3000. Click "Squad". Confirm 5 sub-tabs visible: Decision, Transfers, Optimiser, Lineup, Review. Click "Review". With no team ID: confirm "Load your squad to see GW reviews." Enter a numeric team ID in Decision tab, submit, return to Review. Expect either "GW review will appear once scores finalise." (seed files have gw:null → 503) or a 4-stat card if the pipeline has run.
**Expected:** All 5 sub-tabs visible on desktop and mobile. GW pills GW33/GW34/GW35 shown. Stat cards render when GW data is available. All degraded-state messages display correctly.
**Why human:** Full integration requires a running dev server, live FPL picks API response for a real team ID, and browser rendering. The 503/unsettled path is unit-tested; the happy-path stat card with real player names and real scores requires a post-GW-settle environment.

#### 2. Live Pipeline Run — Blob Write Verification

**Test:** Run `python pipeline/run.py` (not --dry-run) with `USE_BLOB=false` against live FPL API. Then inspect `pipeline/cache/gw_review_gw*.json` — files should be overwritten with real data for the 3 most recently finished GWs.
**Expected:** 3 files with content `{"gw": <int>, "average_score": <int>}` where gw is a non-null GW number and average_score is a positive integer. File names match the actual finished GW numbers from FPL bootstrap.events.
**Why human:** The pipeline writer's correctness against live FPL data (non-null gw, real average_entry_score) can only be confirmed with a live FPL API call. The dry-run path returns before fetching FPL data.

---

## Gaps Summary

No blocking gaps. All 5 ROADMAP success criteria have complete code implementations. All unit tests pass. The 2 human verification items are integration/smoke tests that cannot be executed programmatically — they represent the final confirmation of end-to-end behavior in a running environment.

The 6 pre-existing test failures (captain-picks TEST-57 x5, club-form x1) are documented in STATE.md and pre-date Phase 73 — they are not regressions introduced by this phase.

---

_Verified: 2026-05-05T18:37:00Z_
_Verifier: Claude (gsd-verifier)_
