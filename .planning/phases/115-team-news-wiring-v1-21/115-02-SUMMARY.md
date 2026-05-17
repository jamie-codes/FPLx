---
phase: 115-team-news-wiring-v1-21
plan: 02
subsystem: ui
tags: [react, vitest, rtl, news-banner, captain-picks, tdd]

# Dependency graph
requires:
  - phase: 115-01
    provides: NEWS-01 staleness suppression gate in NewsBanner — prerequisite for NEWS-02 wiring
provides:
  - NEWS-02: NewsBanner wired into CaptainPicksPanel CandidateRow — captain candidates show inline team news
  - NEWS-03 verified: OpportunityCostTable buy-candidate news staleness suppression confirmed via automated test (no code change)
  - 3 new Vitest test cases (2 NEWS-02 + 1 NEWS-03) across 2 test files
affects:
  - CaptainPicksPanel.tsx — 1 new import + 1 new JSX element in CandidateRow

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NewsBanner inline in flex-wrap badge row: import + <NewsBanner news={x ?? ''} news_added={x} chance_of_playing_next_round={x} /> after McLabel — mirrors OpportunityCostTable canonical pattern"
    - "TDD RED/GREEN cycle: test commit (bfc15a5) confirms Case 1 fails before wiring; feat commit (4f26dcf) confirms all 3 NEWS-02/03 cases green"
    - "NEWS-03 verification-only: pre-existing OpportunityCostTable pass-through + Plan 01 staleness guard = automatic activation; no source change needed"

key-files:
  created: []
  modified:
    - src/components/captaincy/CaptainPicksPanel.tsx
    - src/components/captaincy/CaptainPicksPanel.test.tsx
    - src/components/transfers/OpportunityCostTable.test.tsx

key-decisions:
  - "D-04 followed: NewsBanner inserted inside first flex div of CandidateRow, after McLabel JSX, inside existing flex-wrap div"
  - "D-05 followed: OpportunityCostTable.tsx byte-identical to pre-plan state — NEWS-03 is verification-only"
  - "news_added={candidate.news_added} and chance_of_playing_next_round={candidate.chance_of_playing_next_round} props passed — matches canonical OpportunityCostTable call-site convention"
  - "news={candidate.news ?? ''} fallback applied per RESEARCH.md Pitfall 5 — defensive despite MergedPlayer.news: string typing"

patterns-established:
  - "TDD RED/GREEN cycle: test commit (bfc15a5) confirms RED bookend (Case 1 fails); feat commit (4f26dcf) confirms GREEN (all 56 pass)"

requirements-completed:
  - NEWS-02
  - NEWS-03

# Metrics
duration: 10min
completed: 2026-05-17
---

# Phase 115 Plan 02: NEWS-02 CaptainPicksPanel Wiring + NEWS-03 Verification Summary

**NewsBanner wired into CaptainPicksPanel CandidateRow (NEWS-02); staleness suppression in OpportunityCostTable buy-candidate rows verified via automated test (NEWS-03 — no code change)**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-05-17
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 3 (CaptainPicksPanel.tsx + 2 test files)

## Accomplishments

- `CaptainPicksPanel.tsx` — Added `import { NewsBanner } from '@/components/news/NewsBanner'` and inserted `<NewsBanner news={candidate.news ?? ''} news_added={candidate.news_added} chance_of_playing_next_round={candidate.chance_of_playing_next_round} />` inside the first `flex items-center gap-1.5 sm:flex-1 flex-wrap` div of `CandidateRow`, after the `{mcLabel && <McLabel .../>}` line (D-04 insertion contract)
- `CaptainPicksPanel.test.tsx` — Added `useAccuracy` mock, `afterEach` import, and new describe block `'CaptainPicksPanel — Phase 115 NEWS-02 NewsBanner in CandidateRow'` with 2 cases (Case 1 RED bookend: banner present for fresh zinc; Case 2 regression guard: no banner for empty/stale)
- `OpportunityCostTable.test.tsx` — Added `useAccuracy` mock and new describe block `'OpportunityCostTable — Phase 115 NEWS-03 staleness suppression'` with 1 case confirming stale zinc buy candidate suppresses NewsBanner (activates through pre-existing wiring + Plan 01 staleness guard)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add NEWS-02 test cases (RED) + NEWS-03 verification** - `bfc15a5` (test)
2. **Task 2: Wire NewsBanner into CaptainPicksPanel CandidateRow (GREEN)** - `4f26dcf` (feat)

_TDD cycle: test commit (bfc15a5) confirms RED bookend (Case 1 fails — no NewsBanner in component yet); feat commit (4f26dcf) confirms GREEN (all 56 tests across 3 files pass)._

## Files Created/Modified

- `src/components/captaincy/CaptainPicksPanel.tsx` — Added NewsBanner import + 1 JSX element in CandidateRow (7 lines inserted)
- `src/components/captaincy/CaptainPicksPanel.test.tsx` — Added useAccuracy mock + afterEach import + new describe block (Phase 115 NEWS-02, 2 cases)
- `src/components/transfers/OpportunityCostTable.test.tsx` — Added useAccuracy mock + afterEach import + new describe block (Phase 115 NEWS-03, 1 case)

## NEWS-02 Insertion Confirmed

The `<NewsBanner>` JSX is positioned inside the existing `flex items-center gap-1.5 sm:flex-1 flex-wrap` div in `CandidateRow`, after the `{mcLabel && <McLabel label={mcLabel.label} value={mcLabel.value} />}` line. The `flex-wrap` already present on that div handles badge overflow. Source comment `{/* Phase 115 NEWS-02 (D-04): inline news banner for captain candidate */}` tags the insertion.

## NEWS-03 Verification Confirmed

`OpportunityCostTable.tsx` is byte-identical to its pre-plan state (D-05). The pre-existing `news_added={t.buy.news_added}` pass-through at lines 137-141 activates the Plan 01 staleness guard automatically. The new automated test confirms: stale zinc buy candidate (`news_added='2025-12-17T00:00:00Z'`, `Date.now()` mocked to `2026-01-01T00:00:00Z` — 15 days later) produces zero `[data-testid="news-banner"]` elements in the rendered DOM.

## Total Phase 115 Test Additions

- Plan 01 (NEWS-01): 5 new cases in `NewsBanner.test.tsx`
- Plan 02 (NEWS-02): 2 new cases in `CaptainPicksPanel.test.tsx`
- Plan 02 (NEWS-03): 1 new case in `OpportunityCostTable.test.tsx`
- **Total Phase 115 additions: 8 new cases**

## UI-SPEC Checker Sign-Off Pointer

Manual verification pointer for `/gsd-verify-work`: See `.planning/phases/115-team-news-wiring-v1-21/115-UI-SPEC.md` — the `§Checker Sign-Off` block defines the human verification steps:
- Fresh zinc news in captain picks row → inline badge renders
- Empty news in captain picks row → no badge (row unchanged)
- Stale zinc news in captain picks row → no badge (row unchanged)
- Transfer buy candidate with stale zinc news → no badge (NEWS-03 suppression)

## Invariants Confirmed

- `src/components/transfers/OpportunityCostTable.tsx` — `git diff --stat` shows empty diff (D-05 invariant preserved)
- `src/components/news/NewsBanner.tsx` — unchanged vs post-Plan-01 state (Plan 01 invariant preserved)
- TypeScript build: no new errors in CaptainPicksPanel.tsx (pre-existing error in unrelated `decision-history/route.test.ts` not introduced by Phase 115)

## Pre-existing Test Failures (not caused by Phase 115)

4 test files had pre-existing failures before Phase 115:
- `tests/lib/captain-picks.test.ts` (5 failures — old Phase 31 component tests with different mock expectations)
- `tests/lib/club-form.test.ts` (1 failure — pre-existing)
- `src/components/nav/MobileNav.test.tsx` (9 failures — pre-existing nav test expectations)
- `src/lib/hooks/useRivals.test.ts` (10 failures — pre-existing rival hook tests)

None of these were introduced or changed by this plan. The 3 plan-specific test files (CaptainPicksPanel.test.tsx, OpportunityCostTable.test.tsx, NewsBanner.test.tsx) are all green.

## Deviations from Plan

**1. [Rule 3 - Blocker] Worktree missing Plan 01 changes**

- **Found during:** Pre-execution setup
- **Issue:** Worktree branch was behind `main` — Plan 01 commits (`c76bb68`, `88c7df3`) were not present in the worktree, so `NewsBanner.tsx` still had the old signature without `news_added` destructured or the staleness guard
- **Fix:** Ran `git merge main --no-edit` to bring all Plan 01 changes into the worktree. Fast-forward merge succeeded cleanly.
- **Impact:** No code rework needed — merge resolved the dependency automatically.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. Pure render-time wiring on data already fetched and processed by the existing pipeline.

## Self-Check

- `src/components/captaincy/CaptainPicksPanel.tsx` — FOUND (modified)
- `src/components/captaincy/CaptainPicksPanel.test.tsx` — FOUND (modified)
- `src/components/transfers/OpportunityCostTable.test.tsx` — FOUND (modified)
- Commit `bfc15a5` — FOUND (RED bookend)
- Commit `4f26dcf` — FOUND (GREEN implementation)
- `npx vitest run src/components/captaincy/CaptainPicksPanel.test.tsx src/components/transfers/OpportunityCostTable.test.tsx src/components/news/NewsBanner.test.tsx` — 56 passed (confirmed)

## Self-Check: PASSED

---
*Phase: 115-team-news-wiring-v1-21*
*Completed: 2026-05-17*
