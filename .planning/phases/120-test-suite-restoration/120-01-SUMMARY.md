---
plan: 120-01
phase: 120-test-suite-restoration
status: complete
completed: 2026-05-18
key-files:
  created:
    - tests/lib/captain-picks.test.tsx
  modified: []
  deleted:
    - tests/lib/captain-picks.test.ts
---

# Phase 120 Plan 01: Captain-Picks Test Restoration Summary

## What Was Built

Restored 5 failing CaptainPicksPanel component tests (CAP-03/CAP-04) in the captain-picks test suite. Root cause was `render(CaptainPicksPanel({}))` plain function calls bypassing React's reconciler so `useState` resolved to null. The fix required more than a mechanical JSX swap because the component had evolved from a 2-card ceiling/EO-adjusted layout (Phase 31) to a 5-candidate ranked EO mode panel (Phase 57), requiring updated mocks and revised assertions.

## Tasks Completed

- [x] Task 1: Convert all 5 CaptainPicksPanel render calls to JSX and update mocks/assertions to match current component API

## Key Decisions

### Deviation: File renamed .ts -> .tsx (Rule 3 - blocking issue)

- **Found during:** Task 1 execution
- **Issue:** `.ts` files cannot contain JSX syntax. Vite/Oxc parser rejected `<CaptainPicksPanel />` in a `.ts` file at transform time.
- **Fix:** Renamed `tests/lib/captain-picks.test.ts` to `tests/lib/captain-picks.test.tsx`. Git tracked this as a rename (66% similarity).
- **Files modified:** `tests/lib/captain-picks.test.tsx` (renamed from `.ts`)
- **Commit:** 8909d85

### Deviation: Additional vi.mock calls required (Rule 2 - missing critical mocks)

- **Found during:** Task 1 execution
- **Issue:** The CONTEXT.md (D-02) stated "both already mocked" but the component had evolved to use 5 hooks: `useCaptainPicks`, `usePlayers`, `useAuthStatus`, `useMyTeam`, `useLineupNews`. Additionally, `NewsBanner` (rendered inside `CandidateRow`) uses `useNewsFlagEnabled` from `useAccuracy`. Without mocks for these, tests either threw `No QueryClient set` (for hooks using `useQueryClient`) or made real fetch calls.
- **Fix:** Added `vi.mock` for `usePlayers`, `useAuthStatus`, `useMyTeam`, `useLineupNews`, and `useAccuracy` (with `useNewsFlagEnabled` returning `false`).
- **Files modified:** `tests/lib/captain-picks.test.tsx`

### Deviation: Test assertions rewritten to match current component (Rule 1 - bug fix)

- **Found during:** Task 1 execution
- **Issue:** The original test assertions checked for a 2-card layout (ceiling card with "£9.1m", "xPts:", "90th pct:", "EO-Adjusted", "same-player note") that no longer exists. The Phase 57 component renders a ranked 5-candidate EO mode list with `web_name`, `~{eoPercent}%`, `team_short_name`, and `{xPts_1gw * 2} pts (C)`.
- **Fix:** Rewrote all 5 component tests to assert what the current component actually renders:
  1. Candidate list with GW header and player name/team (CAP-03)
  2. EO mode toggle with all 4 modes (CAP-04)
  3. Empty candidates message when all players are injured (edge case)
  4. Loading state via `usePlayers.isLoading: true` (CAP-03/04)
  5. Error state via `usePlayers.error: new Error('boom')` (CAP-03/04)
- **Files modified:** `tests/lib/captain-picks.test.tsx`

## Self-Check: PASSED

- `tests/lib/captain-picks.test.tsx` exists: FOUND
- Commit 8909d85 exists: FOUND
- `npx vitest run tests/lib/captain-picks.test.tsx` exits 0: CONFIRMED (6 passed, 8 skipped)
- `render(<CaptainPicksPanel />)` appears 5 times: CONFIRMED
- `render(CaptainPicksPanel({` appears 0 times: CONFIRMED
- No "Cannot read properties of null (reading 'useState')" in output: CONFIRMED
- 8 pipeline output tests remain skipped (not modified): CONFIRMED
- Wave 0 stub assertion still passes: CONFIRMED
