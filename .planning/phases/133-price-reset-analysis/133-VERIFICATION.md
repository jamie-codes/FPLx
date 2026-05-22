---
phase: 133-price-reset-analysis
verified: 2026-05-22T17:04:00Z
status: human_needed
score: 4/4
overrides_applied: 0
human_verification:
  - test: "Manual UI inspection of Price Reset tab in a running dev server"
    expected: "Tab labelled 'Price Reset' appears between 'Summer Window' and 'Price Changes' in Analyse section; empty state shows 'Prices not yet published' copy; when price_baseline.json contains differing costs the Price Reset section renders green + pills and red - pills with Unicode minus; Value Target rows show '#N POS' rank; no console errors"
    why_human: "Visual layout, Unicode glyph rendering, correct tab strip ordering, and React console error absence cannot be verified programmatically from static code analysis. Task 3 of Plan 03 records user approval but the approval note is embedded in SUMMARY.md which is not independently verifiable evidence."
---

# Phase 133: Price Reset Analysis — Verification Report

**Phase Goal:** When FPL publishes next-season prices, users can immediately see which players rose or fell vs the season-end baseline, with a Value Targets section highlighting fallen-price players who still rate well by xPts
**Verified:** 2026-05-22T17:04:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | pipeline/price_baseline.py writes price_baseline.json once and never overwrites on subsequent runs | VERIFIED | `_blob_exists` guard at first statement of `capture_price_baseline()`; test_idempotency_skips_when_baseline_exists passes — `save` is never called when blob present |
| 2 | price_baseline.json shape is `{ [element_id_string]: now_cost }` covering every bootstrap element | VERIFIED | Dict comprehension `{ str(el['id']): el['now_cost'] for el in elements if 'now_cost' in el }`; test_writes_baseline_when_absent asserts `{'1': 50, '2': 55, '3': 60}` |
| 3 | pipeline/run.py invokes capture_price_baseline() on every run inside try/except that logs to stderr | VERIFIED | Lines 144-151 in run.py: unconditional try/except with stderr on exception; confirmed NOT inside IS_GW38 or IS_OFF_SEASON block |
| 4 | GET /api/price-reset returns `{ published, players, value_targets }` as PriceResetResponse | VERIFIED | route.ts exports `GET()`; all return paths use `satisfies PriceResetResponse`; 6/6 vitest route tests pass including shape verification in Test 3 |
| 5 | When price_baseline.json absent, route returns published: false with players=[] value_targets=[] (D-08 — no 404) | VERIFIED | Lines 61-66 in route.ts; Test 1 `published_false_when_baseline_absent` asserts HTTP 200 and empty arrays |
| 6 | When baseline exists and deltas present, published: true and players sorted by largest absolute delta first | VERIFIED | Lines 114-115: `players.sort((a,b) => Math.abs(b.delta_cost) - Math.abs(a.delta_cost))`; Test 3 asserts sort order |
| 7 | value_targets contains only fall-rows whose xPts exceeds position median, sorted largest fall first | VERIFIED | Line 178 guards `delta_cost >= 0 continue`; line 184 guards `xPts <= positionMedian continue`; line 196 sorts ascending by delta_cost; Tests 4 and 5 pass |
| 8 | usePriceReset() TanStack Query hook fetches /api/price-reset with staleTime 30 minutes | VERIFIED | `queryKey: ['price-reset']`, `fetch('/api/price-reset')`, `staleTime: 30 * 60 * 1000` — all confirmed in usePriceReset.ts |
| 9 | PriceResetTab renders loading, error, empty (published=false), and populated states | VERIFIED | All four branches in PriceResetTab.tsx; 6/6 RTL tests pass covering each branch |
| 10 | Rise pills use bg-green-100 with '+' prefix; fall pills use bg-red-100 with Unicode minus U+2212 | VERIFIED | Constants `DELTA_PILL_RISE`, `DELTA_PILL_FALL` and `MINUS = '−'` (U+2212) at lines 6-10; Test 4 asserts class substrings and Unicode minus glyph |
| 11 | ValueTargetRow shows '#N POS' rank label | VERIFIED | Template literal `` `${row.team} · £${(row.current_cost/10).toFixed(1)}m · #${row.position_rank} ${row.position_label}` `` at line 46; Test 5 asserts `'LIV · £12.0m · #3 MID'` |
| 12 | page.tsx SubTab union includes 'price-reset'; subTabs array positions it between 'window' and 'price-changes'; conditional render wired | VERIFIED | Line 63 (union), line 78 (subTabs between window:77 and price-changes:79), line 301 (conditional render between window:300 and price-changes:302) |

**Score:** 4/4 ROADMAP success criteria verified (12/12 plan truths verified)

---

### ROADMAP Success Criteria Cross-check

| SC# | Criterion | Status | Evidence |
|-----|-----------|--------|----------|
| 1 | pipeline/price_baseline.py writes idempotently — never overwritten | VERIFIED | Truth 1-3 above; 4/4 pytest pass |
| 2 | User can open Price Reset tab showing season-end vs new price with coloured delta pills | VERIFIED | Truths 9-12; tab registered at correct position; 6/6 RTL tests pass |
| 3 | Value Targets section lists fall-players with xPts above position median and xPts rank | VERIFIED | Truths 7, 11; route logic confirmed; Tests 4-5 pass |
| 4 | Empty state shows "FPL typically publishes new prices in mid-to-late July" when unpublished | VERIFIED | PriceResetTab.tsx line 83; Test 3 asserts verbatim D-09 copy |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pipeline/price_baseline.py` | Idempotent baseline capture (PRST-01) | VERIFIED | Exists, 74 lines, exports `capture_price_baseline` + `_blob_exists` + `BASELINE_KEY` |
| `pipeline/tests/test_price_baseline.py` | 4 pytest tests | VERIFIED | 4 tests, all pass (4/4) |
| `pipeline/run.py` | try/except integration call | VERIFIED | Lines 144-151: import + call + stderr exception handler |
| `src/lib/types.ts` | PriceResetRow, ValueTargetRow, PriceResetResponse interfaces | VERIFIED | Lines 1166-1189; all three interfaces exported; ValueTargetRow extends PriceResetRow |
| `src/app/api/price-reset/route.ts` | Diff-based GET handler | VERIFIED | 217 lines; exports `GET`; reads 3 blobs concurrently; all logic substantive |
| `src/app/api/price-reset/route.test.ts` | 6 vitest tests | VERIFIED | 6/6 passing; covers D-07, D-08, delta sort, value_targets filter, graceful degradation |
| `src/lib/hooks/usePriceReset.ts` | TanStack Query hook | VERIFIED | 14 lines; `queryKey: ['price-reset']`; `staleTime: 30 * 60 * 1000` |
| `src/components/price-reset/PriceResetTab.tsx` | Client component | VERIFIED | 115 lines; `'use client'`; exports `PriceResetTab`; Unicode minus at line 10 |
| `src/components/price-reset/PriceResetTab.test.tsx` | 6 RTL tests | VERIFIED | 6/6 passing; `// @vitest-environment jsdom` on line 1 |
| `src/app/page.tsx` | 3-location sub-tab registration | VERIFIED | Import line 30, union line 63, subTabs line 78, render line 301 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `pipeline/run.py` | `pipeline/price_baseline.py capture_price_baseline()` | lazy import + try/except at lines 144-151 | WIRED | Confirmed unconditional; after `save('fpl_bootstrap.json', bootstrap)` and before `events = bootstrap.get('events', [])` |
| `pipeline/price_baseline.py capture_price_baseline()` | Vercel Blob at `price_baseline.json` | `save(BASELINE_KEY, baseline)` from upload.py | WIRED | Line 72; BASELINE_KEY = 'price_baseline.json' |
| `src/app/api/price-reset/route.ts` | `price_baseline.json` + `fpl_bootstrap.json` + `merged_players.json` | `readBlobOrLocal` helper mirroring pre-season-squad pattern | WIRED | Lines 54-58; `Promise.all` with merged_players `.catch(() => null)` |
| `src/app/api/price-reset/route.ts` | `PriceResetResponse` type | `import type ... from '@/lib/types'` at line 7 | WIRED | Confirmed; `satisfies PriceResetResponse` on all return paths |
| `src/lib/hooks/usePriceReset.ts` | `/api/price-reset` endpoint | `fetch('/api/price-reset')` in queryFn | WIRED | Line 8 |
| `src/components/price-reset/PriceResetTab.tsx` | `usePriceReset` hook | `import { usePriceReset } from '@/lib/hooks/usePriceReset'` line 3 | WIRED | Used at line 60 inside exported component |
| `src/components/price-reset/PriceResetTab.tsx` | `PriceResetResponse, PriceResetRow, ValueTargetRow` types | `import type ... from '@/lib/types'` line 4 | WIRED | Type-only import; applied to component props |
| `src/app/page.tsx` | `src/components/price-reset/PriceResetTab.tsx` | `import { PriceResetTab }` line 30 + conditional render line 301 | WIRED | `{activeSection !== 'squad' && activeSubTab === 'price-reset' && <PriceResetTab />}` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `PriceResetTab.tsx` | `data` from `usePriceReset()` | `fetch('/api/price-reset')` → route.ts → `readBlobOrLocal('price_baseline.json')` + `readBlobOrLocal('fpl_bootstrap.json')` + `readBlobOrLocal('merged_players.json')` | Yes — diff computed from real blob artifacts; no hardcoded fallback values in populated path | FLOWING |
| `route.ts` `players` array | bootstrap elements vs baseline dict | `price_baseline.json` (pipeline artifact) + `fpl_bootstrap.json` (pipeline artifact) | Yes — delta computed from actual `now_cost` values; returns `published: false` when data absent | FLOWING |
| `route.ts` `valueTargets` | merged_players xPts + position median | `merged_players.json` (pipeline artifact) | Yes — median computed from actual xPts_1gw values; degrades to `[]` on parse failure | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Python pipeline tests (4) | `python -m pytest pipeline/tests/test_price_baseline.py -v` | 4 passed in 0.05s | PASS |
| API route vitest (6) | `npx vitest run src/app/api/price-reset/route.test.ts` | 6 passed | PASS |
| PriceResetTab RTL tests (6) | `npx vitest run src/components/price-reset/PriceResetTab.test.tsx` | 6 passed | PASS |
| TypeScript compilation | `npx tsc --noEmit` (price-reset files) | No errors in price-reset files | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PRST-01 | 133-01 | Pipeline captures price baseline — idempotent, write-once | SATISFIED | price_baseline.py + run.py integration; 4/4 tests pass |
| PRST-02 | 133-02, 133-03 | User can see Price Reset tab with who rose/fell vs baseline | SATISFIED | PriceResetTab registered in Analyse section; route returns populated players array; 12/12 tests pass |
| PRST-03 | 133-02, 133-03 | Coloured delta pills (+X.Xm green / -X.Xm red); Value Targets section | SATISFIED | DELTA_PILL_RISE/FALL constants; Unicode minus U+2212; ValueTargetRow #N POS rank; Tests 4-5 pass |
| PRST-04 | 133-02, 133-03 | Empty state before prices published with availability note | SATISFIED | published=false → "Prices not yet published" + D-09 copy; D-08 ensures HTTP 200 never 404 |

No orphaned requirements — all 4 PRST IDs assigned to Phase 133 in REQUIREMENTS.md traceability table are claimed by plans 133-01, 133-02, and 133-03.

---

### Anti-Patterns Found

No anti-patterns detected. Scanned all 5 new/modified source files for TODO/FIXME/placeholder/stub patterns — none found. The two `return null` occurrences in route.ts are inside `readBlobOrLocal` and represent documented absent-file handling, not stubs.

---

### Human Verification Required

#### 1. Visual UI inspection of Price Reset tab

**Test:** Run `npm run dev`. Navigate to the Analyse section. Confirm the sub-tab strip shows "Price Reset" positioned to the right of "Summer Window" and left of "Price Changes". On mobile viewport (≤640px), confirm the tab pill shows "Resets".

**Expected:** Tab is correctly ordered and labelled. With no `pipeline/cache/price_baseline.json` present, the tab displays heading "Prices not yet published" and body "FPL typically publishes new prices in mid-to-late July". To test populated state: write a `pipeline/cache/price_baseline.json` with 2-3 element IDs with `now_cost` values differing from current bootstrap, then reload — the Price Reset section should render rows with green `+` pills and red `−` pills. Value Target rows should show `#N POS` metadata. ARIA labels `aria-label="Price reset analysis"` and `aria-label="Value targets — price fell, xPts above median"` should be present in the DOM. No React console errors.

**Why human:** Visual layout correctness, Unicode minus glyph rendering (U+2212 vs ASCII hyphen), correct tab ordering on screen, and absence of React console errors cannot be verified from static code analysis. Note: SUMMARY.md for Plan 03 records user approval of all six verification steps — but this verification report cannot independently confirm that approval against the running application. The human verification item is retained as formal record.

---

### Gaps Summary

No gaps found. All 4 ROADMAP success criteria are verified in the actual codebase. All 16 tests pass (4 Python + 6 API route vitest + 6 RTL vitest). TypeScript compiles clean. Data flows from pipeline artifacts through API route to component without disconnection. The single human_needed item is a visual confirmation of the already-approved UI checkpoint — all automated checks pass.

---

_Verified: 2026-05-22T17:04:00Z_
_Verifier: Claude (gsd-verifier)_
