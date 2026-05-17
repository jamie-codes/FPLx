---
phase: 115-team-news-wiring-v1-21
plan: 01
subsystem: ui
tags: [react, vitest, rtl, news-banner, staleness, testing]

# Dependency graph
requires:
  - phase: 88-fpl-news-flags-ui
    provides: NewsBanner component with news_added prop in interface (Phase 88 SCRAPER-01)
provides:
  - NEWS-01 staleness suppression gate in NewsBanner — zinc-severity badges older than 14 days suppressed
  - news_added destructured in NewsBanner function signature (previously silently dropped)
  - 5 new Vitest staleness test cases (10 total in NewsBanner.test.tsx)
affects:
  - 115-02 (NEWS-02 CaptainPicksPanel wiring — can now safely rely on staleness gate)
  - OpportunityCostTable (NEWS-03 auto-satisfied — existing news_added pass-through now activates guard)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline staleness helper as const arrow inside component body; no injectable now param — vi.spyOn(Date, 'now') for tests (D-02)"
    - "Guard order: feature flag -> empty news -> computeNewsSeverity -> staleness gate -> none guard -> render"
    - "Zinc-only age gate: if (severity === 'zinc' && isStale(news_added)) return null — red/amber never suppressed"

key-files:
  created: []
  modified:
    - src/components/news/NewsBanner.tsx
    - src/components/news/NewsBanner.test.tsx

key-decisions:
  - "D-01 followed: staleness check lives inside NewsBanner; computeNewsSeverity() signature unchanged"
  - "D-02 followed: Date.now() direct; tests use vi.spyOn(Date, 'now').mockReturnValue()"
  - "D-03 followed: threshold exactly 14 * 24 * 60 * 60 * 1000 ms; red and amber never age-gated"
  - "news_added was already in NewsBannerProps interface but omitted from function destructuring — fixed as part of implementation (Pitfall 1 from RESEARCH.md)"

patterns-established:
  - "TDD RED/GREEN cycle: test commit (c76bb68) confirms Case 1 fails before guard lands; feat commit (88c7df3) confirms all 10 pass"

requirements-completed:
  - NEWS-01

# Metrics
duration: 8min
completed: 2026-05-17
---

# Phase 115 Plan 01: NEWS-01 Staleness Suppression Gate Summary

**14-day staleness gate added to NewsBanner: zinc-severity badges older than 14 days are now suppressed; red/amber always render regardless of age**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-17T09:29:00Z
- **Completed:** 2026-05-17T09:31:30Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 2

## Accomplishments

- `NewsBanner` now destructures `news_added` from its props (was silently dropped at the function signature despite being in `NewsBannerProps`)
- Inline `isStale` helper + early-return guard inserted in the correct position (after `computeNewsSeverity`, before `severity === 'none'` check)
- 5 new Vitest cases covering the full staleness matrix: stale zinc suppressed, fresh zinc renders, red not suppressed, amber not suppressed, missing news_added no suppression
- All 10 NewsBanner tests pass (5 Phase 88 + 5 Phase 115); `newsSeverity.ts` byte-identical to pre-phase state

## Task Commits

Each task was committed atomically:

1. **Task 1: Add 5 staleness test cases (RED)** - `c76bb68` (test)
2. **Task 2: Implement NEWS-01 staleness guard (GREEN)** - `88c7df3` (feat)

_TDD cycle: test commit confirms RED bookend (Case 1 fails); feat commit confirms GREEN (all 10 pass)._

## Files Created/Modified

- `src/components/news/NewsBanner.tsx` — Added `news_added` to destructuring; inserted 3-line staleness guard block
- `src/components/news/NewsBanner.test.tsx` — Added `afterEach` import + new `describe('NewsBanner — Phase 115 NEWS-01 staleness gate')` block with 5 cases

## Guard Ordering Used

Final guard order in `NewsBanner`:
1. Feature flag + empty-news check (`!enabled || !news || news.trim().length === 0`)
2. `computeNewsSeverity(chance_of_playing_next_round, news)`
3. **NEWS-01 staleness guard** (NEW): `if (severity === 'zinc' && isStale(news_added)) return null`
4. None guard: `if (severity === 'none') return null`
5. Render

## Invariants Confirmed

- `src/lib/newsSeverity.ts` — `git diff --stat src/lib/newsSeverity.ts` shows empty diff (D-01 invariant preserved)
- `computeNewsSeverity()` signature unchanged: `(chance_of_playing_next_round?: number | null, news?: string) => NewsSeverity`
- TypeScript build: no errors in `NewsBanner.tsx` (`npx tsc --noEmit` shows 0 NewsBanner errors)

## Test Counts

- Phase 88: 5 existing cases (preserved byte-for-byte)
- Phase 115: 5 new staleness cases
- **Total in NewsBanner.test.tsx: 10**

## Deviations from Plan

None — plan executed exactly as written. The `news_added` destructuring fix was anticipated and documented in RESEARCH.md Pitfall 1; it was part of Task 2's action spec.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `news_added` is now destructured in `NewsBanner`; NEWS-02 wiring in `CaptainPicksPanel` (Plan 02) can safely pass `candidate.news_added` without risk of the staleness gate being permanently inactive
- NEWS-03 (OpportunityCostTable) is auto-satisfied: `PlayerMoveCell` already passes `news_added` to `NewsBanner` at lines ~137–141; staleness guard now activates there automatically
- No blockers for Plan 02

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. Pure render-time guard on existing trusted data.

## Self-Check

- `src/components/news/NewsBanner.tsx` — FOUND (modified)
- `src/components/news/NewsBanner.test.tsx` — FOUND (modified)
- Commit `c76bb68` — FOUND (RED bookend)
- Commit `88c7df3` — FOUND (GREEN implementation)
- `npx vitest run src/components/news/NewsBanner.test.tsx` — 10 passed (confirmed)

## Self-Check: PASSED

---
*Phase: 115-team-news-wiring-v1-21*
*Completed: 2026-05-17*
