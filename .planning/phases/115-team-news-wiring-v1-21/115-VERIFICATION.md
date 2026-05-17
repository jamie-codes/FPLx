---
phase: 115-team-news-wiring-v1-21
verified: 2026-05-17T09:52:00Z
status: human_needed
score: 6/6 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open CaptainPicksPanel in browser. Find a captain candidate with non-empty news that is less than 14 days old."
    expected: "A colour-coded inline news badge (zinc/amber/red depending on severity) appears inside the candidate row, after any McLabel badge, on the same flex line."
    why_human: "Visual placement and flex-wrap overflow are not verifiable programmatically — need to confirm the badge appears inline in the correct position within the row layout."
  - test: "Open CaptainPicksPanel in browser. Find a captain candidate whose news_added is more than 14 days ago and whose chance_of_playing_next_round is 100 (zinc severity)."
    expected: "No news badge appears for that candidate — the row is visually identical to one with empty news."
    why_human: "Staleness suppression visibility requires real FPL data with dated news_added values to confirm the gate fires correctly on a live surface."
  - test: "Open TransferPanel / OpportunityCostTable in browser. Find a buy candidate with stale zinc news (more than 14 days old, chance_of_playing_next_round = 100)."
    expected: "No news badge appears in the PlayerMoveCell for that buy candidate — NEWS-03 staleness suppression is active."
    why_human: "Requires real data with stale news_added values to confirm the pre-existing pass-through activates the staleness gate visually."
---

# Phase 115: Team News Wiring (v1.21) Verification Report

**Phase Goal:** Users see live FPL team news on the two highest-stakes decision surfaces — captain picks and transfer candidates — with a 14-day staleness suppression gate ensuring zinc-severity badges for long-settled news never dilute the signal quality on decision-critical surfaces
**Verified:** 2026-05-17T09:52:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | NewsBanner zinc-severity badges older than 14 days are suppressed; red/amber are never suppressed | VERIFIED | `NewsBanner.tsx` line 36-38: `isStale` arrow function + `if (severity === 'zinc' && isStale(news_added)) return null`. 5 Vitest cases in `NewsBanner.test.tsx` describe block `'NewsBanner — Phase 115 NEWS-01 staleness gate'` all pass. |
| SC-2 | User sees NewsBanner in CaptainPicksPanel candidate rows with severity colour-coding | VERIFIED | `CaptainPicksPanel.tsx` line 17: `import { NewsBanner }`. Lines 133-138: JSX element inside `flex-wrap` div after `McLabel`. 2 Vitest cases in `CaptainPicksPanel.test.tsx` describe block `'CaptainPicksPanel — Phase 115 NEWS-02 NewsBanner in CandidateRow'` all pass. |
| SC-3 | User sees NewsBanner in OpportunityCostTable buy-candidate rows with staleness suppression applied | VERIFIED | `OpportunityCostTable.tsx` lines 137-141: pre-existing `<NewsBanner news={t.buy.news ?? ''} news_added={t.buy.news_added} .../>`. Plan 01 staleness guard fires automatically. 1 Vitest case in `OpportunityCostTable.test.tsx` describe block `'OpportunityCostTable — Phase 115 NEWS-03 staleness suppression'` passes confirming stale zinc is suppressed. |

**Score:** 6/6 truths verified (3 roadmap SC + 3 plan must-haves — all pass)

### Must-Have Truths (from Plan Frontmatter)

**Plan 01 — NEWS-01:**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Zinc-severity news older than 14 days renders nothing inside NewsBanner | VERIFIED | Line 38: `if (severity === 'zinc' && isStale(news_added)) return null`. Test case "suppresses zinc badge when news_added is stale" passes. |
| 2 | Zinc-severity news younger than 14 days still renders normally | VERIFIED | Test case "renders zinc badge when news_added is fresh" passes. |
| 3 | Red-severity news is NEVER suppressed regardless of age | VERIFIED | Test case "does NOT suppress red badge when news_added is stale" passes. |
| 4 | Amber-severity news is NEVER suppressed regardless of age | VERIFIED | Test case "does NOT suppress amber badge when news_added is stale" passes. |
| 5 | Missing news_added does not trigger suppression | VERIFIED | `isStale` returns `false` when `newsAdded` is falsy. Test case "does NOT suppress zinc badge when news_added is missing" passes. |
| 6 | computeNewsSeverity() signature unchanged | VERIFIED | `git diff HEAD~4..HEAD -- src/lib/newsSeverity.ts` shows no output (zero changes to file). |

**Plan 02 — NEWS-02 / NEWS-03:**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | NewsBanner renders inline inside CandidateRow when candidate has non-empty news | VERIFIED | JSX at lines 134-138 of `CaptainPicksPanel.tsx`. Vitest Case 1 confirms banner present for fresh zinc. |
| 2 | NewsBanner in CandidateRow is after McLabel in the same flex-wrap div | VERIFIED | Lines 132-138 of `CaptainPicksPanel.tsx`: `{mcLabel && <McLabel .../>}` then comment then `<NewsBanner .../>` — both inside the `flex items-center gap-1.5 sm:flex-1 flex-wrap` div. |
| 3 | CandidateRow unchanged (no banner) when candidate has empty news | VERIFIED | NewsBanner returns null for empty news (existing guard at line 33). Vitest Case 2 confirms zero banners when news is empty. |
| 4 | CandidateRow unchanged (no banner) when candidate has stale zinc news | VERIFIED | Staleness guard returns null. Vitest Case 2 confirms zero banners for stale zinc. |
| 5 | OpportunityCostTable suppresses NewsBanner when buy.news_added >= 14 days and severity is zinc | VERIFIED | NEWS-03 Vitest case confirms zero `[data-testid="news-banner"]` elements for stale zinc buy candidate. |
| 6 | OpportunityCostTable.tsx is byte-identical to pre-plan state (NEWS-03 is verification-only) | VERIFIED | `git diff HEAD~4..HEAD -- src/components/transfers/OpportunityCostTable.tsx` shows no output (zero changes). |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/news/NewsBanner.tsx` | Staleness suppression guard for zinc-severity badges (14-day gate via news_added) | VERIFIED | `news_added` destructured at line 31; `isStale` helper at lines 36-37; guard at line 38 — exact pattern `severity === 'zinc' && isStale(news_added)` present |
| `src/components/news/NewsBanner.test.tsx` | 5 new Vitest cases covering staleness matrix | VERIFIED | Describe block `'NewsBanner — Phase 115 NEWS-01 staleness gate'` present with 5 `it()` blocks; `vi.spyOn(Date, 'now')` used; `afterEach(() => vi.restoreAllMocks())` present |
| `src/components/captaincy/CaptainPicksPanel.tsx` | NewsBanner import + 1 JSX call site inside CandidateRow after McLabel (NEWS-02) | VERIFIED | `import { NewsBanner } from '@/components/news/NewsBanner'` at line 17; JSX at lines 133-138 with correct props |
| `src/components/captaincy/CaptainPicksPanel.test.tsx` | 2 new Vitest cases for NEWS-02 | VERIFIED | Describe block `'CaptainPicksPanel — Phase 115 NEWS-02 NewsBanner in CandidateRow'` with 2 `it()` blocks, both using `vi.spyOn(Date, 'now').mockReturnValue(` |
| `src/components/transfers/OpportunityCostTable.test.tsx` | 1 new Vitest case for NEWS-03 | VERIFIED | Describe block `'OpportunityCostTable — Phase 115 NEWS-03 staleness suppression'` with 1 `it()` block using `vi.spyOn(Date, 'now')` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `NewsBanner.tsx` function body | `Date.now() - new Date(news_added).getTime()` | Inline `isStale` arrow function | WIRED | Line 37: exact integer expression `14 * 24 * 60 * 60 * 1000`; function destructures `news_added` at line 31 |
| `NewsBanner.tsx` function signature | `NewsBannerProps.news_added` | Destructured prop `{ news, news_added, chance_of_playing_next_round }` | WIRED | Line 31 matches pattern `NewsBanner({ news, news_added, chance_of_playing_next_round }` |
| `CaptainPicksPanel.tsx CandidateRow` | `NewsBanner.tsx` | `<NewsBanner news={candidate.news ?? ''} news_added={candidate.news_added} .../>` | WIRED | Lines 133-138: comment + JSX element inside the `flex flex-wrap` div after McLabel |
| `OpportunityCostTable.tsx PlayerMoveCell` | `NewsBanner.tsx` staleness guard | Pre-existing `news_added={t.buy.news_added}` pass-through activates NEWS-01 guard | WIRED | Lines 137-141: existing `<NewsBanner news={t.buy.news ?? ''} news_added={t.buy.news_added} .../>` confirmed unchanged |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `NewsBanner.tsx` | `news`, `news_added`, `chance_of_playing_next_round` | Props from parent (MergedPlayer fields — fetched from FPL API via `usePlayers`) | Yes — FPL API data, existing trusted pipeline (Phase 88) | FLOWING |
| `CaptainPicksPanel.tsx CandidateRow` | `candidate.news`, `candidate.news_added`, `candidate.chance_of_playing_next_round` | `eoCandidates` computed from `usePlayers()` data | Yes — hooks fetch real MergedPlayer data | FLOWING |
| `OpportunityCostTable.tsx PlayerMoveCell` | `t.buy.news`, `t.buy.news_added`, `t.buy.chance_of_playing_next_round` | `OCSRow.transfers[].buy` — ScoredPlayer with news fields (pre-existing Phase 88 wiring) | Yes — pre-existing trusted pipeline | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All Phase 115 test files pass (56 tests) | `npx vitest run NewsBanner.test.tsx CaptainPicksPanel.test.tsx OpportunityCostTable.test.tsx` | 3 files passed, 56 tests passed | PASS |
| Staleness guard pattern present in NewsBanner | `grep "severity === 'zinc' && isStale"` | 1 match at line 38 | PASS |
| 14-day threshold uses integer expression | `grep "14 * 24 * 60 * 60 * 1000"` | 1 match at line 37 | PASS |
| NewsBanner import in CaptainPicksPanel | `grep "import { NewsBanner }"` | 1 match at line 17 | PASS |
| D-01 invariant: newsSeverity.ts unmodified | `git diff HEAD~4..HEAD -- src/lib/newsSeverity.ts` | Empty output | PASS |
| D-05 invariant: OpportunityCostTable.tsx unmodified | `git diff HEAD~4..HEAD -- src/components/transfers/OpportunityCostTable.tsx` | Empty output | PASS |
| Commit hashes documented in SUMMARY match git log | `git log --oneline` | `c76bb68` (RED 01), `88c7df3` (GREEN 01), `bfc15a5` (RED 02), `4f26dcf` (GREEN 02) all present | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| NEWS-01 | 115-01-PLAN.md | NewsBanner badges older than 14 days (zinc severity) suppressed | SATISFIED | Staleness guard at NewsBanner.tsx lines 36-38; 5 Vitest cases pass; D-01/D-02/D-03 invariants held |
| NEWS-02 | 115-02-PLAN.md | NewsBanner in CaptainPicksPanel candidate rows | SATISFIED | Import at line 17, JSX at lines 133-138 of CaptainPicksPanel.tsx; 2 Vitest cases pass |
| NEWS-03 | 115-02-PLAN.md | NewsBanner in OpportunityCostTable buy-candidate rows with staleness suppression | SATISFIED | Pre-existing wiring (lines 137-141) + Plan 01 staleness guard = automatic activation; 1 Vitest case confirms suppression; OpportunityCostTable.tsx unchanged (D-05) |

All three requirements assigned to Phase 115 in REQUIREMENTS.md are accounted for in plan frontmatter and verified in the codebase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODO/FIXME/placeholder comments, empty returns, or hardcoded stubs found in the modified source files.

### Human Verification Required

#### 1. Fresh news badge visible in CaptainPicksPanel

**Test:** Log into the FPL Analyst app. Navigate to the captain picks panel. Identify a captain candidate whose team news was added within the last 14 days (news_added within 14 days of today). Confirm the news text appears as an inline badge inside the candidate row, coloured correctly (red/amber/zinc).
**Expected:** A colour-coded badge with the news text appears inline in the row, positioned after any McLabel badge in the same flex-wrap line.
**Why human:** Badge visual placement and flex-wrap overflow behaviour cannot be verified programmatically — Vitest/RTL confirms DOM presence but not visual position within the rendered layout.

#### 2. Stale zinc news suppressed in CaptainPicksPanel

**Test:** Identify a captain candidate with `chance_of_playing_next_round = 100` (zinc severity) whose `news_added` is more than 14 days ago. Confirm no news badge appears in that row.
**Expected:** The candidate row shows no news badge — it is visually identical to a row with no news at all.
**Why human:** Requires real FPL data with a dated `news_added` field to confirm the staleness gate fires on the live surface.

#### 3. Stale zinc news suppressed in OpportunityCostTable buy-candidate rows

**Test:** Navigate to the Transfer Panel. In the OpportunityCostTable, find a buy candidate whose `news_added` is more than 14 days ago and `chance_of_playing_next_round = 100`. Confirm no news badge appears in the PlayerMoveCell for that candidate.
**Expected:** No news badge in the buy-candidate cell — the stale zinc suppression gate from NEWS-01 fires through the pre-existing wiring.
**Why human:** Same as above — requires live data with stale news_added timestamps.

### Gaps Summary

No automated gaps found. All 6/6 must-have truths are VERIFIED, all artifacts exist with substantive implementations, all key links are wired, all 56 tests pass, and D-01/D-05 invariants are confirmed by git diff.

The only outstanding items are human verification steps for visual placement and live-data staleness suppression confirmation on the two decision surfaces. These are inherently non-automatable.

---

_Verified: 2026-05-17T09:52:00Z_
_Verifier: Claude (gsd-verifier)_
