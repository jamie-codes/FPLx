---
phase: 06-club-form-value-gems-and-polish
verified: 2026-03-29T19:08:00Z
status: passed
score: 15/15 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 13/13
  gaps_closed:
    - "tier() function corrected — high diffScore maps to 'hard', low diffScore maps to 'easy'; Man City fixtures now show red"
    - "NaN price trend eliminated — all three render sites (value-gems/columns.tsx, gem-table/columns.tsx, TransferPanel.tsx) now apply ?? 0 guards on cost_change_event and cost_change_start"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Visual confirmation of Man City fixture colour"
    expected: "In the Club Form tab and Value Gems/Gem Ratings tables, upcoming fixtures against Man City show red (hard) chips, not green"
    why_human: "Requires running the dev server and loading the app in a browser; not testable with static grep"
  - test: "Visual confirmation of price trend display"
    expected: "Value Gems, Gem Ratings, and Transfer Panel price trend columns show arrows or dashes with numeric amounts (e.g. '+0.1m') not 'NaN'. Season sub-text appears only when non-zero."
    why_human: "Requires running the app in a browser against live pipeline data"
---

# Phase 06: Club Form, Value Gems, and Polish Verification Report

**Phase Goal:** Club Form tab, Value Gems tab, and price trend columns — with all UAT gaps closed
**Verified:** 2026-03-29T19:08:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure by plan 06-04

## Re-verification Summary

Previous verification (2026-03-29T17:00:00Z) recorded status `passed` on 13/13 truths for plans 06-01 through 06-03. Plan 06-04 subsequently closed the two major UAT bugs identified in 06-UAT.md. This re-verification confirms both fixes are correctly implemented and no regressions were introduced.

**Gap 1 closed: Fixture tier inversion**
Commit `410d0ae` swapped the return values in `tier()` inside `computeClubForm`. The corrected function reads `if (score >= hardThreshScore) return 'hard'` / `if (score <= easyThreshScore) return 'easy'`. A regression test (7th test in club-form.test.ts) confirms BUR's `difficulty_tier` is not `'hard'` and its `difficulty_score` is `< 0.5`.

**Gap 2 closed: NaN price trend**
Commit `bbb568a` applied `?? 0` nullish coalescing at all three render call-sites. 24 guards are present in TransferPanel.tsx, covering both the single-transfer block and the two-transfer combo block across all 4 fields (sell.cost_change_event, sell.cost_change_start, buy.cost_change_event, buy.cost_change_start).

---

## Goal Achievement

### Observable Truths (15 total — 2 new truths added by 06-04)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | MergedPlayer type includes cost_change_event and cost_change_start as number fields | VERIFIED | `src/lib/types.ts` lines 105-107: both fields present |
| 2 | merge.py passes cost_change_event and cost_change_start from FPL element to output | VERIFIED | `pipeline/merge.py` lines 300-302: both fields extracted with `.get(..., 0)` |
| 3 | ClubForm and ClubFormFixture types exported from types.ts | VERIFIED | `src/lib/types.ts` lines 153-173: both interfaces exported |
| 4 | computeClubForm() returns correct W/D/L/GS/GC for a 5-game rolling window per team | VERIFIED | 7 tests in club-form.test.ts all pass |
| 5 | isCheapGem and isLowOwned filter predicates return correct boundary results | VERIFIED | 8 boundary tests in value-gems.test.ts all pass |
| 6 | Club Form tab shows wins, draws, losses, GS, GC over last 5 fixtures | VERIFIED | `ClubFormTable.tsx` renders W/D/L/GS/GC via TanStack Table |
| 7 | Club form table is sortable by any column | VERIFIED | `getSortedRowModel`, default sort `[{ id: 'wins', desc: true }]` |
| 8 | Fixture difficulty badges show coloured chips with opponent short name and H/A indicator | VERIFIED | `FixtureBadges.tsx`: green/amber/red per tier, `{opponent_team} {is_home ? 'H' : 'A'}` |
| 9 | Fixture badges appear on both GemTable and ClubFormTable | VERIFIED | Both `gem-table/columns.tsx` and `club-form/columns.tsx` import and render `<FixtureBadges />` |
| 10 | A last-updated timestamp is visible on every tab | VERIFIED | `page.tsx` renders `<LastUpdated />` in all tabs |
| 11 | Last-updated shows amber text when data is stale | VERIFIED | `LastUpdated.tsx` applies `text-amber-600` when `stale=true`; 2 unit tests pass |
| 12 | Value Gems tab lists players filtered by cheap/low-owned using extracted predicates | VERIFIED | `ValueGemsTable.tsx` imports and uses `isCheapGem`, `isLowOwned` |
| 13 | Price trend arrows appear on Gem Ratings, Value Gems, and Squad and Transfers views | VERIFIED | trend column in gem-table/columns.tsx and value-gems/columns.tsx; trend spans in TransferPanel.tsx |
| 14 | **[NEW] tier() maps strong opponents to 'hard', weak opponents to 'easy'** | VERIFIED | `club-form.ts` lines 71-73: `>= hardThreshScore` returns `'hard'`; regression test (test 7) confirms BUR difficulty_tier is not `'hard'` and difficulty_score `< 0.5` |
| 15 | **[NEW] Price trend columns show formatted values, never NaN** | VERIFIED | All three render sites apply `?? 0`: value-gems/columns.tsx lines 59-60, gem-table/columns.tsx lines 78-79, TransferPanel.tsx (24 occurrences) |

**Score:** 15/15 truths verified

---

### Required Artifacts (06-04 modified files)

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `src/lib/club-form.ts` | Corrected tier() function | VERIFIED | Line 71: `if (score >= hardThreshScore) return 'hard'` — commit 410d0ae |
| `tests/lib/club-form.test.ts` | Regression test for tier direction | VERIFIED | 134 lines, 7 tests, all pass including new "assigns difficulty tier correctly" test |
| `src/components/value-gems/columns.tsx` | PriceTrendCell with undefined guards | VERIFIED | Lines 59-60: `costChangeEvent={row.original.cost_change_event ?? 0}` and `costChangeStart={row.original.cost_change_start ?? 0}` |
| `src/components/gem-table/columns.tsx` | Inline price trend with undefined guards | VERIFIED | Lines 78-79: `const ev = row.original.cost_change_event ?? 0` and `const st = row.original.cost_change_start ?? 0` |
| `src/components/transfers/TransferPanel.tsx` | All cost_change reads guarded with ?? 0 | VERIFIED | 24 occurrences of `?? 0` in file; both single-transfer and two-transfer-combo blocks fully guarded across all 4 fields |

All artifacts from plans 06-01 through 06-03 (verified in previous report) passed regression check — no changes detected.

---

### Key Link Verification (06-04 focus)

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `tier()` return values | `ClubFormFixture.difficulty_tier` | `difficulty_tier: tier(ds)` at lines 94 and 106 of club-form.ts | WIRED | The corrected `tier()` is the sole setter of `difficulty_tier`; `FixtureBadges.tsx` reads this field for colour assignment |
| `?? 0` guards in value-gems/columns.tsx | `PriceTrendCell` props | `costChangeEvent` and `costChangeStart` props at lines 59-60 | WIRED | Props are typed `number`; `?? 0` guarantees a number is passed even when field is absent from player data |
| `?? 0` guards in gem-table/columns.tsx | Inline trend cell | `ev` and `st` local variables at lines 78-79 | WIRED | All downstream arithmetic (`/ 10`, `Math.abs`, comparison to `0`) operates on number not undefined |
| `?? 0` guards in TransferPanel.tsx | Sell/buy trend spans | All 8 conditional expressions and span content across both render blocks | WIRED | Pattern `(s.sell.cost_change_event ?? 0)` applied consistently; season sub-text condition also guards with `?? 0` |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| club-form.test.ts — all 7 tests pass | `npx vitest run tests/lib/club-form.test.ts` | 7 passed (7) | PASS |
| Full lib suite — no regressions | `npx vitest run tests/lib/` | 87 passed, 2 skipped (documented pipeline skip) | PASS |
| Commits 410d0ae and bbb568a exist | `git log --oneline -10` | Both commits present in history | PASS |
| tier() direction: `>= hardThreshScore` returns 'hard' | Read club-form.ts line 71 | `if (score >= hardThreshScore) return 'hard'` | PASS |
| BUR fixture is not 'hard' (regression test assertion) | Vitest test 7 | `expect(vsBur!.difficulty_tier).not.toBe('hard')` passes | PASS |
| BUR difficulty_score < 0.5 (weak team = low score) | Vitest test 7 | `expect(vsBur!.difficulty_score).toBeLessThan(0.5)` passes | PASS |
| value-gems/columns.tsx has ?? 0 guards | Read lines 59-60 | `?? 0` on both props to PriceTrendCell | PASS |
| gem-table/columns.tsx has ?? 0 guards | Read lines 78-79 | `ev = ... ?? 0` and `st = ... ?? 0` | PASS |
| TransferPanel.tsx ?? 0 guards count | grep -c "?? 0" | 24 occurrences | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FFA-03 | 06-01, 06-02, 06-04 | Club form table with correct fixture difficulty | SATISFIED | computeClubForm with corrected tier() logic; ClubFormTable renders W/D/L/GS/GC with correctly coloured fixture badges |
| VAL-01 | 06-01, 06-03 | Cheap gems filter | SATISFIED | isCheapGem (now_cost <= 60); ValueGemsTable Cheap filter pill |
| VAL-02 | 06-01, 06-03 | Low-owned but high-scoring filter | SATISFIED | isLowOwned (selected_by_percent < 10); ValueGemsTable Low-owned filter pill |
| VAL-03 | 06-01, 06-02, 06-03, 06-04 | Show price and price change trend with no NaN | SATISFIED | cost_change fields on MergedPlayer; PriceTrendCell and TransferPanel all guarded with ?? 0; NaN is impossible |
| UIX-01 | 06-02, 06-04 | Clear data-forward layout; fixture difficulty correct | SATISFIED | 5-tab page.tsx layout; tier() now correctly maps strong opponents to hard (red) |
| UIX-02 | 06-02, 06-03 | Sortable tables | SATISFIED | ClubFormTable and ValueGemsTable both use getSortedRowModel |
| UIX-03 | 06-02, 06-03 | Colour-coded fixture difficulty | SATISFIED | FixtureBadges uses bg-green-100/bg-amber-100/bg-red-100 per DifficultyTier |
| UIX-04 | 06-02, 06-03 | Home/away clearly distinguished | SATISFIED | FixtureBadges renders `{opponent_team} {is_home ? 'H' : 'A'}` |
| DAT-02 | 06-02 | Last-updated timestamp on all views | SATISFIED | LastUpdated rendered in all 5 tabs; amber text when stale (unit tested) |

All 9 requirement IDs satisfied.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `tests/lib/merge.test.ts` | 6, 18 | `it.skip(...)` — pipeline cache tests skipped | Info | Expected — pipeline has not been re-run in this environment. merge.py code is correct. Non-blocking. |

No new anti-patterns introduced by plan 06-04. No TODO/FIXME in changed files. No empty implementations. No hardcoded empty returns.

---

### Human Verification Required

#### 1. Visual confirmation — Man City fixture colour

**Test:** Run `npm run dev`, open the app in a browser, navigate to the Club Form tab. Find a team with Man City in their upcoming fixtures.
**Expected:** Man City fixture chips appear red (hard tier), not green (easy tier). Contrast with a newly-promoted side or Burnley equivalent which should show green.
**Why human:** Requires running the dev server and loading real fixture data through the browser. Static analysis confirms `tier()` logic is correct but visual rendering needs confirmation.

#### 2. Visual confirmation — price trend no NaN

**Test:** Run `npm run dev`, open the app. Check the Gem Ratings table Trend column, the Value Gems table Trend column, and the Transfer Panel (enter a team ID) cost_change display.
**Expected:** All rows show either a green arrow with "+X.Xm", a red arrow with "-X.Xm", or a grey dash. No row shows "NaN" or "NaNm". Season sub-text (if present) shows a numeric value.
**Why human:** Requires loading live data through the browser. Static analysis confirms `?? 0` guards prevent NaN but visual spot-check confirms end-to-end.

---

### Gaps Summary

No gaps. All 15 truths verified. Both UAT bugs closed by plan 06-04 are confirmed fixed in the codebase:

1. **Tier inversion** (`src/lib/club-form.ts` line 71): The `tier()` function now correctly returns `'hard'` for `score >= hardThreshScore`. The regression test (test 7 in `tests/lib/club-form.test.ts`) asserts Burnley (the weakest team in the test data) produces `difficulty_tier !== 'hard'` and `difficulty_score < 0.5`. All 7 club-form tests pass.

2. **NaN price trend** (three render files): All 3 call-sites apply `?? 0` before any arithmetic on `cost_change_event` and `cost_change_start`. The pattern is consistent and complete — `Math.abs`, division by 10, and comparison to 0 all receive a guaranteed number. Full lib suite (87 tests, 2 documented skips) shows no regressions.

The two remaining human-verification items are visual confirmations only — they require a browser but no code changes.

---

_Verified: 2026-03-29T19:08:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — after gap closure by plan 06-04_
