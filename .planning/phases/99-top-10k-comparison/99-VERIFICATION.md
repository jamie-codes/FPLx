---
phase: 99-top-10k-comparison
verified: 2026-05-12T12:46:00Z
status: human_needed
score: 10/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Load the Squad tab for a settled GW, open the GW Review tab. Visually confirm the 4th stat card shows 'Dream team' (or 'FPL average' on degraded path) as its label with a score value, and a coloured delta sub-label below the value (+N vs you / on par / −N vs you). Confirm the delta is absent when the label is 'FPL average'."
    expected: "4th card renders benchmark label + score; delta sub-label uses green for positive/par, amber for negative; delta is absent in FPL average fallback."
    why_human: "Sentiment colours (green/amber) and exact character rendering (U+2212 minus sign) require visual inspection to confirm. CSS class application cannot be verified programmatically without a browser."
  - test: "With a settled GW where the FPL dream-team includes players not in your squad, confirm the 'Missed' info row appears below 'Best bench', listing up to 3 player names in 'Name (pts)' format joined by ', '."
    expected: "Row is present with data-testid='gw-review-missed-row', label 'Missed', and player list formatted as e.g. 'Saka (12), Palmer (10)'."
    why_human: "Requires a real settled GW with live dream-team data from fantasy.premierleague.com/api/dream-team/{gw}/ — cannot be verified with unit tests alone. The degraded fallback path (missed_players=[]) also needs live verification."
---

# Phase 99: Top-10k Comparison Verification Report

**Phase Goal:** Add a benchmark comparison card to the GW Review tab — showing the FPL dream-team score (or FPL average as fallback) alongside up to 3 missed dream-team players the user did not own. Requirement: PGW-03.
**Verified:** 2026-05-12T12:46:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET /api/gw-review returns benchmark_score, benchmark_label, and missed_players on a 200 response | VERIFIED | route.ts lines 236-239 include all three fields in the `review: GwReview` literal; 7/7 tests pass including assertions on these fields |
| 2 | When dream-team fetch succeeds, benchmark_label === 'Dream team' and benchmark_score === sum(team[*].points) | VERIFIED | route.ts lines 204-214; test "returns benchmark_label='Dream team' and benchmark_score=sum(team[*].points)" passes GREEN |
| 3 | When dream-team fetch fails (non-ok, empty team, or thrown), benchmark_label === 'FPL average', benchmark_score === average_score, missed_players === [] | VERIFIED | route.ts lines 215-218; standalone try/catch at lines 156-169 with `useDreamTeamBenchmark` flag; 503-failure test passes GREEN |
| 4 | missed_players contains only dream-team elements not present in the user's 15 picks (starters + bench) | VERIFIED | `new Set(picks.map(p => p.element))` at line 200 builds from all 15 picks; bench-ownership test passes GREEN |
| 5 | missed_players is sorted descending by pts and capped at 3 entries | VERIFIED | `.sort((a, b) => b.points - a.points).slice(0, 3)` at lines 209-212; sort+cap test passes GREEN (5 misses → 3 returned) |
| 6 | User sees the 4th StatCard show review.benchmark_label as the label and review.benchmark_score as the value | VERIFIED | GwReviewTab.tsx lines 196-202; component test "renders benchmark StatCard with label and value" passes GREEN |
| 7 | User sees a delta sub-label '+N vs you' / 'on par' / '−N vs you' (U+2212) below the benchmark score when benchmark_label !== 'FPL average' | VERIFIED | Lines 174-183 compute benchmarkDeltaLabel with U+2212 confirmed present; positive/negative/on-par component tests all pass GREEN |
| 8 | User does NOT see a delta sub-label when benchmark_label === 'FPL average' (degraded fallback) | VERIFIED | Line 200: `delta={review.benchmark_label === 'FPL average' ? undefined : benchmarkDeltaLabel}`; FPL-average fallback component test passes GREEN |
| 9 | User sees a 'Missed' info row listing dream-team players they did not own when missed_players.length > 0 | VERIFIED | GwReviewTab.tsx lines 231-241; conditional render + data-testid='gw-review-missed-row'; Missed row component test passes GREEN |
| 10 | User does NOT see the 'Missed' row when missed_players.length === 0 | VERIFIED | Guard `review.missed_players.length > 0` at line 231; Missed-absent test passes GREEN (querySelector returns null) |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/types.ts` | GwReview extended with 3 new required fields | VERIFIED | Lines 889-892: benchmark_score, benchmark_label, missed_players all present with correct types |
| `src/app/api/gw-review/route.ts` | Dream-team fetch + benchmark/missed computation | VERIFIED | FPLDreamTeamPick/FPLDreamTeamResponse interfaces (lines 27-37); Step 4 fetch block (lines 150-169); computation block (lines 199-219); 3 new fields in review literal (lines 236-239) |
| `src/app/api/gw-review/route.test.ts` | PGW-03 unit tests + extended mockUpstream | VERIFIED | Extended mockUpstream with dreamTeam/dreamTeamOk params (lines 25-49); dreamTeamPayload helper (lines 63-70); Phase 99 PGW-03 describe block with 4 tests (lines 200-334) |
| `src/components/squad/GwReviewTab.tsx` | StatCard delta+testid props; benchmark card; conditional Missed row | VERIFIED | StatCardProps extended (lines 14-20); StatCard body updated (lines 22-38); benchmark computation (lines 170-183); 4th-slot replacement (lines 196-202); Missed row (lines 231-241) |
| `src/components/squad/GwReviewTab.test.tsx` | Phase 99 PGW-03 component tests | VERIFIED | sampleReview extended (lines 27-33); Phase 99 describe block with 8 tests (lines 152-257) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| route.ts | fantasy.premierleague.com/api/dream-team/{gw}/ | fetch with User-Agent header inside try/catch | WIRED | Line 157: `fetch(\`${FPL_BASE}/dream-team/${gw}/\`, { headers: { 'User-Agent': 'fplx/1.17 (+https://fplx.app)' } })` |
| route.ts | GwReview type (3 new fields) | review object construction | WIRED | Lines 236-239: `benchmark_score: benchmarkScore, benchmark_label: benchmarkLabel, missed_players: missedPlayers` |
| route.test.ts | route.ts | fetch mock dispatch on /dream-team/ URL substring | WIRED | Line 41: `if (url.includes('/dream-team/'))` branch in mockUpstream |
| GwReviewTab.tsx | GwReview (benchmark fields) | review.benchmark_score / review.benchmark_label / review.missed_players field access | WIRED | Lines 171, 197-201, 231 — all three fields accessed and rendered |
| GwReviewTab.tsx | data-testid='gw-review-benchmark-card' | testid prop forwarded to root div of StatCard | WIRED | Line 201: `testid="gw-review-benchmark-card"` passed to StatCard; line 27: `data-testid={testid}` on root div |
| GwReviewTab.tsx | data-testid='gw-review-missed-row' | conditional render guarded by missed_players.length > 0 | WIRED | Lines 231-241: guard condition + data-testid attribute on div |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| GwReviewTab.tsx | review.benchmark_score / review.benchmark_label / review.missed_players | /api/gw-review route which fetches fantasy.premierleague.com/api/dream-team/{gw}/ | Yes — DB/upstream fetch in route.ts, computation applied, fields returned in JSON | FLOWING |
| route.ts | dreamTeamPicks | FPL upstream dream-team/{gw}/ endpoint | Yes — real upstream HTTP fetch with graceful degradation on failure | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All route tests pass (7 total: 3 Phase 98 + 4 Phase 99) | `npx vitest run src/app/api/gw-review/route.test.ts` | 7 passed (7) | PASS |
| All component tests pass (14 total: 6 Phase 73/98 + 8 Phase 99) | `npx vitest run src/components/squad/GwReviewTab.test.tsx` | 14 passed (14) | PASS |
| TypeScript compiles clean | `npx tsc --noEmit` | No errors | PASS |
| No Promise.all usage in new dream-team code | `grep -c "Promise.all(" route.ts` | 0 | PASS |
| Old static 4th StatCard removed | `grep -c 'label="FPL average"' GwReviewTab.tsx` | 0 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| PGW-03 | 99-01, 99-02 | User can see their GW score compared to the top-10k average, including which template players they didn't own | SATISFIED | Backend: route fetches dream-team, computes benchmark_score + missed_players. Frontend: GwReviewTab renders 4th StatCard with benchmark label/score/delta, conditional Missed row. 7 route tests + 8 component tests all GREEN. |

### Anti-Patterns Found

No blockers or stub anti-patterns found. Scanned for TODO/FIXME/PLACEHOLDER, `return null`, `return []`, `return {}` — none present in Phase 99 modified files. The `missedPlayers = []` on the degraded fallback path is correct behaviour (empty array is the specified output, not a stub), verified by the 503-failure test.

### Human Verification Required

#### 1. Benchmark card visual rendering

**Test:** Load Squad tab for a user with a settled GW. Open GW Review. Inspect the 4th stat card.
**Expected:** Shows `'Dream team'` label (or `'FPL average'` if degraded), numeric benchmark score, and a colour-coded delta sub-label (`+N vs you` in green, `on par` in green, `−N vs you` in amber). In degraded state, no delta sub-label appears.
**Why human:** CSS sentiment classes (`text-green-600`, `text-amber-700`) and U+2212 minus sign rendering require visual browser confirmation. Class presence is verified by unit tests, but actual rendered colour is not.

#### 2. Missed row with live dream-team data

**Test:** Use a settled GW where the user did not own all 11 FPL dream-team players. Scroll to below the 'Best bench' row.
**Expected:** A 'Missed' row appears listing up to 3 dream-team players not in the user's squad, formatted as `'Saka (12), Palmer (10)'`. If the user owned all dream-team players, the row is absent.
**Why human:** Requires live data from `fantasy.premierleague.com/api/dream-team/{gw}/` — a live GW must be settled and the response must be non-empty. Unit tests mock this endpoint; end-to-end behaviour depends on FPL's actual response shape remaining consistent with the `FPLDreamTeamResponse` interface.

---

## Gaps Summary

No gaps found. All 10 observable truths are VERIFIED by direct codebase inspection and passing test suites. The phase goal is substantively achieved: the benchmark comparison card and Missed row are implemented, wired, tested, and TypeScript-clean.

The `human_needed` status reflects two items requiring live browser/FPL-API verification that cannot be confirmed programmatically: visual colour rendering of the sentiment classes, and end-to-end behaviour with real dream-team data from FPL's upstream API.

---

_Verified: 2026-05-12T12:46:00Z_
_Verifier: Claude (gsd-verifier)_
