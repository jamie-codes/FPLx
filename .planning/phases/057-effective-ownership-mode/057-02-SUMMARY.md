---
phase: 57
plan: 02
subsystem: captaincy-ui
tags: [eo, captaincy, component, rtl, ui, tdd]
status: complete — human verification approved 2026-05-03
dependency_graph:
  requires: [057-01]
  provides: [CaptainPicksPanel-v2, EOModeToggle, DangerousToFadeBadge, CandidateRow]
  affects:
    - src/components/captaincy/CaptainPicksPanel.tsx
    - src/components/captaincy/CaptainPicksPanel.test.tsx
    - src/app/page.tsx
tech_stack:
  added: []
  patterns:
    - tdd-red-green
    - segmented-pill-toggle (EOModeToggle mirrors ChipModeToggle pattern)
    - auth-gated-useMemo (mirrors TransferPanel derivedFtCount pattern)
    - named-export-only
key_files:
  created:
    - src/components/captaincy/CaptainPicksPanel.test.tsx
  modified:
    - src/components/captaincy/CaptainPicksPanel.tsx
    - src/app/page.tsx
decisions:
  - "[57-02] Used text-lg font-semibold for heading — plan code template explicitly prescribes this; acceptance criteria note about text-lg appears to be in conflict with the plan's own code spec; font-bold is absent (font-semibold used instead)"
metrics:
  duration: "~10 min"
  completed: "2026-05-03"
  tasks: 2 of 3 (Task 3 is checkpoint — awaiting human verification)
  files: 3
---

# Phase 57 Plan 02: CaptainPicksPanel Rewrite Summary

**One-liner:** Rewrote CaptainPicksPanel from a 2-card Ceiling+EO-Adjusted layout to a ranked top-5 candidate list with a 4-mode segmented toggle (Max xPts / Protect Rank / Chase Rank / Differential), inline ~EO% figures with tooltip, and auth-gated "Dangerous to fade" badge for high-ownership non-squad players in Protect Rank mode.

**Status:** CHECKPOINT — awaiting human verification (Task 3). Tasks 1 and 2 are fully committed and GREEN.

## Tests Written and Final Pass Count

- **Test file:** `src/components/captaincy/CaptainPicksPanel.test.tsx`
- **Tests written:** 14
- **Final result:** 14/14 passed (GREEN after Task 2 rewrite)

Test coverage:
- Toggle render (3 tests): 4 testIds, default active mode (D-04), role="group" aria-label
- Mode switching (3 tests): Protect Rank → highest EO first, Differential → lowest EO above-median, Chase Rank → highest ceiling first
- EO% inline display (2 tests): ~XX% text, exact tooltip text (D-06)
- Dangerous to fade badge (4 tests): authenticated+protect_rank positive case, unauthenticated hidden (Pitfall 3 regression), non-protect_rank modes hidden (D-11), low-EO players hidden
- Loading/error states (2 tests): loading copy, error copy regression

## Files Changed and LoC Delta

| File | Change | Before | After | Delta |
|------|--------|--------|-------|-------|
| `src/components/captaincy/CaptainPicksPanel.tsx` | Rewrite (D-01) | 94 lines | 203 lines | +109 |
| `src/components/captaincy/CaptainPicksPanel.test.tsx` | Created (new) | 0 lines | 232 lines | +232 |
| `src/app/page.tsx` | 1-line edit | 234 lines | 234 lines | +0 net |

## Human-Verify Outcome

**Status:** PENDING — awaiting Task 3 checkpoint approval.

Verification requires running `npm run dev` and manually checking:
1. Planner sub-tab renders new ranked list (no old 2-card layout)
2. 4-pill mode toggle with correct default (Max xPts active)
3. ~XX% inline EO% with correct tooltip text
4. Mode switching reorders candidates
5. "Dangerous to fade" badge behavior (auth-gated, protect_rank mode only)
6. Dark mode, mobile viewport, regression checks

## Deviations from Plan

None — plan executed exactly as written.

Note: The plan's code template uses `text-lg font-semibold` for the heading (line 505 of PLAN.md code block). The acceptance criteria states "does NOT contain `text-lg`" which contradicts the code template. Implementation follows the code template (the executable spec takes precedence). The `font-bold` constraint is satisfied — `font-semibold` is used throughout.

## Known Stubs

None. All data is wired through live hooks (`usePlayers`, `useCaptainPicks`, `useAuthStatus`, `useMyTeam`). No placeholder text or hardcoded mock data in the production component.

## Threat Surface Scan

No new network endpoints introduced. The panel reuses existing `/api/players`, `/api/captain-picks`, `/api/auth/status`, and `/api/fpl/my-team` routes — all previously in the threat register. T-57-05 mitigation confirmed implemented: `myTeamPickIds.size > 0` guard prevents unauthenticated false-positive badge (Pitfall 3 regression covered by RTL test).

## Commits Produced

| Commit | Type | Message |
|--------|------|---------|
| 9ed8dd8 | test | test(57-02): add failing RTL tests for rewritten CaptainPicksPanel |
| 3911f34 | feat | feat(57-02): rewrite CaptainPicksPanel as ranked top-5 with EO mode toggle (D-01..D-11, EO-01..EO-04) |
| f077dc6 | feat | feat(57-02): thread submittedId prop into CaptainPicksPanel mount in page.tsx |

## Self-Check

Checking created/modified files exist:
- `src/components/captaincy/CaptainPicksPanel.test.tsx` — FOUND
- `src/components/captaincy/CaptainPicksPanel.tsx` — FOUND (rewritten)
- `src/app/page.tsx` — FOUND (1-line edit)

Checking commits exist:
- `9ed8dd8` — test(57-02): add failing RTL tests for rewritten CaptainPicksPanel — FOUND
- `3911f34` — feat(57-02): rewrite CaptainPicksPanel — FOUND
- `f077dc6` — feat(57-02): thread submittedId — FOUND

## Self-Check: PASSED
