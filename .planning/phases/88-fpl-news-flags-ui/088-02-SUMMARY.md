---
phase: 88-fpl-news-flags-ui
plan: "02"
subsystem: news-flags
tags: [green-phase, tdd, scraper-01, news-chrome, gem-table, transfer-panel, squad-view, pipeline]
dependency_graph:
  requires:
    - 088-01 (RED test scaffold — 24 failing tests)
  provides:
    - src/lib/newsSeverity.ts
    - src/lib/hooks/useAccuracy.ts (useNewsFlagEnabled export)
    - src/components/news/NewsBadge.tsx
    - src/components/news/NewsBanner.tsx
    - pipeline/merge.py (news_added + chance_of_playing_next_round pass-through)
    - pipeline/accuracy.py (news_flag_enabled: True in summary dict)
    - src/lib/types.ts (type extensions)
    - src/components/gem-table/columns.tsx (Status title= tooltip)
    - src/components/gem-table/GemTable.tsx (RowExpandNewsSection + useNewsFlagEnabled)
    - src/components/transfers/OpportunityCostTable.tsx (NewsBanner in PlayerMoveCell)
    - src/components/squad/SquadView.tsx (NewsBanner in player name cell)
  affects:
    - GemTable Status column
    - GemTable row-expand panel
    - TransferPanel OCS rows
    - SquadView owned-player rows
tech_stack:
  added: []
  patterns:
    - severity-classifier pure utility (computeNewsSeverity — analog of formatRelativeTime)
    - FragilityNote-clone multi-severity component (NewsBanner)
    - gate accessor hook pattern (useNewsFlagEnabled wraps useAccuracy)
    - createColumns boolean param threading (hooks-in-closures workaround)
    - RowExpandNewsSection module-scope helper component
key_files:
  created:
    - src/lib/newsSeverity.ts
    - src/components/news/NewsBadge.tsx
    - src/components/news/NewsBanner.tsx
  modified:
    - pipeline/merge.py
    - pipeline/accuracy.py
    - src/lib/types.ts
    - src/lib/hooks/useAccuracy.ts
    - src/components/gem-table/columns.tsx
    - src/components/gem-table/GemTable.tsx
    - src/components/transfers/OpportunityCostTable.tsx
    - src/components/squad/SquadView.tsx
decisions:
  - "RowExpandNewsSection defined at module scope (not inline IIFE) — cleaner, avoids duplicating SEVERITY_CLASS maps in two expand rows"
  - "newsFlagEnabled threaded as createColumns 3rd param (not via hook inside cell) — React hook rules prohibit hook calls inside column cell closures"
  - "NewsBanner accepts news_added prop for forward-compat but does not render it — timestamp appears only in GemTable row-expand variant (UI-SPEC constraint)"
  - "Pre-existing test failures (captain-picks 5, MobileNav 10, club-form 1) are unchanged from baseline — documented in STATE.md deferred items"
metrics:
  duration: "~30 minutes"
  completed: "2026-05-10"
  tasks: 5 of 6 (Task 6 is human UAT checkpoint)
  files: 11
---

# Phase 88 Plan 02: GREEN — SCRAPER-01 Implementation Summary

GREEN phase implementation for SCRAPER-01: 11 files modified; all 24 Wave 0 RED tests now GREEN; full project type-checks clean. FPL injury/availability news surfaced in GemTable Status tooltip, GemTable row-expand, TransferPanel OCS rows, and SquadView owned-player rows — gated by `useNewsFlagEnabled()` against accuracy_backtest.json.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Pipeline pass-through + TypeScript type extensions | 4cfa5fc | pipeline/merge.py, pipeline/accuracy.py, src/lib/types.ts |
| 2 | GREEN — newsSeverity.ts + useNewsFlagEnabled accessor | 9109013 | src/lib/newsSeverity.ts, src/lib/hooks/useAccuracy.ts |
| 3 | GREEN — NewsBadge.tsx + NewsBanner.tsx components | 0c5c48a | src/components/news/NewsBadge.tsx, src/components/news/NewsBanner.tsx |
| 4 | Wire into GemTable — Status tooltip + row-expand | c86aac0 | src/components/gem-table/columns.tsx, src/components/gem-table/GemTable.tsx |
| 5 | Wire NewsBanner into TransferPanel OCS + SquadView | b6e30f4 | src/components/transfers/OpportunityCostTable.tsx, src/components/squad/SquadView.tsx |
| 6 | Human UAT — checkpoint (pending) | — | n/a |

## Files Modified

| File | Change |
|------|--------|
| `pipeline/merge.py` | Add `news_added` + `chance_of_playing_next_round` pass-through from FPL element dict after existing `news` line |
| `pipeline/accuracy.py` | Write `news_flag_enabled: True` to summary dict in both main `compute_accuracy_backtest()` and `_empty_backtest()` cold-start fallback |
| `src/lib/types.ts` | Add `news_added?: string`, `chance_of_playing_next_round?: number | null` to `FPLElement` + `MergedPlayer`; add `news_flag_enabled?: boolean` to `AccuracySummary` |
| `src/lib/hooks/useAccuracy.ts` | Append `useNewsFlagEnabled(): boolean` — reads `data?.summary?.news_flag_enabled ?? false` (NESTED path, not root-level) |
| `src/lib/newsSeverity.ts` | NEW: pure `computeNewsSeverity(chance?, news?): NewsSeverity` — D-09 thresholds (null/100+empty=none, 100+news=zinc, 75=amber, <=50=red) |
| `src/components/news/NewsBadge.tsx` | NEW: hook-gated string-or-null; returns news text for Status badge `title=` attribute |
| `src/components/news/NewsBanner.tsx` | NEW: severity-coloured inline banner mirroring FragilityNote; SEVERITY_CLASS + SEVERITY_ICON maps; gate + severity=none guard |
| `src/components/gem-table/columns.tsx` | Add `newsFlagEnabled: boolean = false` param to `createColumns`; Status cell gets `title={titleAttr}` when gate on + news non-empty |
| `src/components/gem-table/GemTable.tsx` | Import `useNewsFlagEnabled`, `computeNewsSeverity`, `formatRelativeTime`; call `useNewsFlagEnabled()`; thread to `createColumns`; add `RowExpandNewsSection` module-scope helper; render in both mobile + desktop expand rows |
| `src/components/transfers/OpportunityCostTable.tsx` | Add `<NewsBanner>` after `<RotationRiskBadge>` in `PlayerMoveCell` map (D-07) |
| `src/components/squad/SquadView.tsx` | Add `<NewsBanner>` after `<span>{player.web_name}</span>` in name cell for owned flagged players (D-08) |

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| src/lib/newsSeverity.test.ts | 12 | GREEN (was RED) |
| src/lib/hooks/useAccuracy.test.ts | 3 | GREEN (was RED) |
| src/components/news/NewsBanner.test.tsx | 5 | GREEN (was RED) |
| src/components/news/NewsBadge.test.tsx | 4 | GREEN (was RED) |
| **Wave 0 total** | **24** | **ALL GREEN** |
| Full project | 1051 pass / 16 fail / 34 skip | Pre-existing failures only (see Deferred) |

## Verification Checks

- `npx tsc --noEmit` exits 0 — full project type-checks clean
- `grep -rc "Phase 88 SCRAPER-01" src/ pipeline/ | grep -v ":0$" | wc -l` returns 16 (tagged in all 11 modified files plus comment lines)
- `grep -E "useAccuracy\(\)\..*news_flag_enabled" src/components/` returns nothing — cross-cutting constraint satisfied (no inline access)
- XSS guard: no `dangerouslySetInnerHTML` in any news code path (T-088-01)
- Gate accessor reads `data?.summary?.news_flag_enabled` (NOT `data?.news_flag_enabled`) — T-088-04 mitigated

## Success Criteria Status

| SC | Description | Status |
|----|-------------|--------|
| SC-1 | TransferPanel OCS rows render NewsBanner with literal news text + severity | DONE (Task 5) |
| SC-2 | GemTable Status badge title= tooltip; row-expand shows news + relative timestamp | DONE (Task 4) |
| SC-3 | news_flag_enabled OFF kill-switches all chrome — no residual layout | DONE (Wave 0 tests pin gate-off path; kill-switch UAT in Task 6) |
| SC-4 | Zero new fetcher / query key / API route | DONE (only useNewsFlagEnabled over existing useAccuracy) |
| SC-5 | Healthy player renders nothing | DONE (computeNewsSeverity returns 'none'; all guards return null) |

## Deviations from Plan

### Out-of-scope pre-existing test failures (not caused by this plan)

The following test failures existed before this plan's changes (verified by git stash comparison):
- `tests/lib/captain-picks.test.ts` — 5 failures (documented in STATE.md as TEST-57)
- `src/components/nav/MobileNav.test.tsx` — 10 failures (documented as WR-03/04)
- `tests/lib/club-form.test.ts` — 1 failure (pre-existing)

These are out-of-scope per deviation rule scope boundary. Logged in `deferred-items.md`.

## Known Stubs

None — all news chrome is fully wired to real `MergedPlayer.news`, `news_added`, and `chance_of_playing_next_round` fields. Gate ships true from pipeline. Data populates on next pipeline run.

## Threat Surface Scan

No new network endpoints, API routes, auth paths, or schema changes at trust boundaries beyond what the plan's threat model captures. All threats registered (T-088-01 through T-088-07).

## Hand-off Notes

- **Phase 93 (SENS-01):** `computeNewsSeverity` and `NewsSeverity` are available at `@/lib/newsSeverity`. Import them for the "news flip to 'doubt'" perturbation rather than re-deriving thresholds.
- **Pipeline:** `news_added` and `chance_of_playing_next_round` will populate in `merged_players.json` on the next pipeline run. `news_flag_enabled: True` in `accuracy_backtest.json` enables all chrome immediately post-run.
- **Known limitation:** Mobile portrait Status badge has no touch tooltip (expected per UI-SPEC accessibility contract; row-expand shows news on mobile instead).
- **Task 6 pending:** Human UAT to verify all 4 insertion points visually + kill-switch behaviour in dev server.

## Self-Check: PASSED

Files created:
- src/lib/newsSeverity.ts: EXISTS
- src/lib/hooks/useAccuracy.ts: EXISTS (modified)
- src/components/news/NewsBadge.tsx: EXISTS
- src/components/news/NewsBanner.tsx: EXISTS
- .planning/phases/88-fpl-news-flags-ui/088-02-SUMMARY.md: EXISTS

Commits:
- 4cfa5fc: feat(88-02): pipeline pass-through + TypeScript type extensions
- 9109013: feat(88-02): GREEN — newsSeverity.ts + useNewsFlagEnabled accessor
- 0c5c48a: feat(88-02): GREEN — NewsBadge.tsx + NewsBanner.tsx components
- c86aac0: feat(88-02): wire news chrome into GemTable — Status tooltip + row-expand section
- b6e30f4: feat(88-02): wire NewsBanner into TransferPanel OCS + SquadView owned players
