---
phase: 119-ui-surfaces
verified: 2026-05-18T12:00:00Z
status: passed
score: 9/9
overrides_applied: 0
---

# Phase 119: UI Surfaces — Verification Report

**Phase Goal:** Wire Phase 118's lineup news engine penalties into the UI so confirmed-absent and doubted players are visually flagged across CaptainPicksPanel, OpportunityCostTable, TransferPanel, and DecisionSummaryTab — with a Team News Alert section in DecisionSummaryTab listing all owned flagged squad players.
**Verified:** 2026-05-18T12:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | StatusLabelBadge component renders null for confirmed_start, unknown, and undefined | VERIFIED | Line 35-36: `const config = statusLabel ? BADGE_MAP[statusLabel] : undefined; if (!config) return null` — BADGE_MAP only has doubted and confirmed_absent keys; all other inputs yield undefined config |
| 2 | StatusLabelBadge renders red pill for confirmed_absent and amber pill for doubted | VERIFIED | Lines 15-28: BADGE_MAP entries confirmed — `bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300` for confirmed_absent; `bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200` for doubted |
| 3 | StatusLabelBadge has 6 Vitest tests locking null-render cases and visible-pill colour classes | VERIFIED | StatusLabelBadge.test.tsx: 6 `it(` blocks covering undefined/confirmed_start/unknown null cases; doubted amber pill classes and title; confirmed_absent red pill and title; exactly one span |
| 4 | CaptainPicksPanel CandidateRow calls useLineupNews() directly, derives statusLabel, and renders StatusLabelBadge between McLabel and NewsBanner | VERIFIED | Line 103: hook call inside CandidateRow; line 104: statusLabel derivation; line 139: badge render; grep confirms McLabel (137) → StatusLabelBadge (139) → NewsBanner (141) ordering |
| 5 | OpportunityCostTable accepts optional lineupNewsMap prop, prop-drills to PlayerMoveCell, and renders StatusLabelBadge for buy candidate after RotationRiskBadge and before NewsBanner | VERIFIED | Lines 31, 118: `lineupNewsMap?: Map<number, LineupNewsPlayer>` in both OpportunityCostTableProps and PlayerMoveCell param; line 142: StatusLabelBadge render; RotationRiskBadge (140) → StatusLabelBadge (142) → NewsBanner (144) ordering confirmed |
| 6 | TransferPanel calls useLineupNews() and forwards lineupNewsMap to OpportunityCostTable | VERIFIED | Line 56: `const { data: lineupNewsMap } = useLineupNews()`; line 448: `lineupNewsMap={lineupNewsMap}` prop on OpportunityCostTable; TransferPanel's suggestTransfers call does NOT receive lineupNewsMap (intentional scope boundary — UI-04 is DecisionSummaryTab only) |
| 7 | DecisionSummaryTab calls useLineupNews() once and threads lineupNewsMap into suggestTransfers() and OpportunityCostTable | VERIFIED | Line 188: hook call; lines 246+248: `lineupNewsMap,` in suggestTransfers params and useMemo deps; line 612: `lineupNewsMap={lineupNewsMap}` on OpportunityCostTable |
| 8 | Team News Alert section renders between 2×2 card grid and CalibrationHealthIndicator when flaggedPlayers.length > 0; completely absent when not | VERIFIED | Line 520: grid opens; line 712: grid closes (`</div>`); lines 715-732: Team News Alert conditional block; line 736: CalibrationHealthIndicator — ordering is grid (520) → team-news-alert (720) → CalibrationHealthIndicator (736). Guard is `{flaggedPlayers.length > 0 && ...}`; flaggedPlayers returns `[]` when lineupNewsMap is undefined (line 408) |
| 9 | Team News Alert lists all 15 squad picks filtered to doubted/confirmed_absent with StatusLabelBadge per row; no placeholder text when empty | VERIFIED | Lines 407-421: flaggedPlayers memo iterates all myTeamData.picks (no position filter — D-11); filters on `status_label === 'doubted' \|\| status_label === 'confirmed_absent'`; no "No alerts" / "Loading lineup news" text found in grep |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/shared/StatusLabelBadge.tsx` | Shared presentational badge, exports StatusLabelBadge | VERIFIED | Exists, 45 lines, exports `StatusLabelBadge`, type-only import of StatusLabel, no hooks |
| `src/components/shared/StatusLabelBadge.test.tsx` | Vitest coverage for null + render cases | VERIFIED | Exists, 57 lines, 6 `it(` blocks, @vitest-environment jsdom pragma |
| `src/components/captaincy/CaptainPicksPanel.tsx` | CandidateRow with useLineupNews hook + StatusLabelBadge | VERIFIED | Modified — imports useLineupNews and StatusLabelBadge; CandidateRow calls hook at line 103 |
| `src/components/transfers/OpportunityCostTable.tsx` | Optional lineupNewsMap prop, prop-drilled to PlayerMoveCell, badge for buy candidate | VERIFIED | Modified — lineupNewsMap in OpportunityCostTableProps (line 31), PlayerMoveCell param (line 118), forwarded at line 210, badge at line 142 |
| `src/components/transfers/TransferPanel.tsx` | useLineupNews() call + lineupNewsMap prop on OpportunityCostTable | VERIFIED | Modified — hook call at line 56, prop at line 448 |
| `src/components/squad/DecisionSummaryTab.tsx` | useLineupNews wired into ocsSuggestions, flaggedPlayers memo, Team News Alert section, lineupNewsMap forwarded to OpportunityCostTable | VERIFIED | Modified — all 4 edits confirmed |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| CaptainPicksPanel (CandidateRow) | useLineupNews.ts | direct hook call `useLineupNews()` | WIRED | Line 103 — inside CandidateRow body (line 88-178), before CaptainPicksPanel function (line 180) |
| TransferPanel | OpportunityCostTable | `lineupNewsMap={lineupNewsMap}` prop | WIRED | Line 448 — confirmed between OpportunityCostTable opening tag and closing `/>` |
| DecisionSummaryTab (suggestTransfers call) | suggest-transfers.ts (SuggestTransfersParams.lineupNewsMap) | named arg in params object | WIRED | Line 246: `lineupNewsMap,` inside suggestTransfers({ }) block; line 248: in useMemo deps |
| DecisionSummaryTab (Team News Alert) | myTeamData.picks ∩ lineupNewsMap | useMemo filter producing flaggedPlayers | WIRED | Lines 407-421: flaggedPlayers memo; line 715: `{flaggedPlayers.length > 0 && ...}` guard renders section with `data-testid="team-news-alert"` (line 720) |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| CaptainPicksPanel CandidateRow | statusLabel | `useLineupNews()` → `lineupNewsMap?.get(candidate.id)?.status_label` | Yes — hook fetches from /api/lineup-news, returns Map\<number, LineupNewsPlayer\> | FLOWING |
| OpportunityCostTable PlayerMoveCell | lineupNewsMap prop | TransferPanel line 56 / DecisionSummaryTab line 188 — both call `useLineupNews()` and pass result as prop | Yes — TanStack Query cache; prop is `undefined` when stale (48h gate in hook select transform) | FLOWING |
| DecisionSummaryTab flaggedPlayers | myTeamData.picks ∩ lineupNewsMap | `useMyTeam()` + `useLineupNews()` | Yes — both hooks fetch from authenticated FPL API / lineup-news API | FLOWING |
| DecisionSummaryTab ocsSuggestions | lineupNewsMap | `useLineupNews()` → `suggestTransfers({ lineupNewsMap })` | Yes — availability_factor penalties applied when data fresh; undefined = no penalty (backward compat) | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: The phase produces React component code — no CLI entry points or runnable API endpoints to spot-check without a running server. Automated test results reported in SUMMARY files are the functional proxy.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| StatusLabelBadge tests pass | `npm test -- --run src/components/shared/StatusLabelBadge.test.tsx` | 6 passed (from 119-01-SUMMARY.md — TDD verified) | PASS |
| CaptainPicksPanel suite | `npm test -- --run src/components/captaincy` | 28 passed (from 119-02-SUMMARY.md) | PASS |
| Transfers suite (OpportunityCostTable + TransferPanel) | `npm test -- --run src/components/transfers` | 25 passed (from 119-02-SUMMARY.md) | PASS |
| DecisionSummaryTab suite | `npm test -- --run src/components/squad/DecisionSummaryTab` | Passed (from 119-03-SUMMARY.md) | PASS |
| TypeScript compile | `npx tsc --noEmit -p tsconfig.json` | 0 errors (from 119-02 and 119-03 SUMMARY files) | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| UI-01 | 119-02-PLAN.md | CaptainPicksPanel CandidateRow StatusLabelBadge for doubted/confirmed_absent | SATISFIED | CandidateRow lines 103-104, 139: hook call, statusLabel derivation, badge render confirmed |
| UI-02 | 119-02-PLAN.md | TransferPanel OCS buy-candidate rows show inline badge for doubted/absent players | SATISFIED | OpportunityCostTable line 142: StatusLabelBadge for buy candidate; TransferPanel line 448: lineupNewsMap forwarded |
| UI-03 | 119-03-PLAN.md | DecisionSummaryTab Team News Alert section listing owned squad players with active news | SATISFIED | Lines 715-732: conditional section with role="region", aria-label="Team News Alert", data-testid="team-news-alert"; flaggedPlayers memo covers all 15 picks |
| UI-04 | 119-03-PLAN.md | DecisionSummaryTab threads lineupNewsMap into suggestTransfers() call | SATISFIED | Line 246: lineupNewsMap in suggestTransfers params; line 248: in useMemo deps array |

No orphaned requirements — all 4 UI requirements for Phase 119 claimed and verified.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | — |

No stubs, no placeholder text, no TODO/FIXME markers, no empty handler functions found in the 6 modified/created files. All data paths traced to real hook calls (useLineupNews, useMyTeam) with proper staleness guards.

One noted observation (not a blocker): TransferPanel's `suggestTransfers` call does not receive `lineupNewsMap` (lines 133-141). This is an intentional design decision documented in Plan 02 and 119-03 SUMMARY — the scope boundary is that only DecisionSummaryTab's OCS table reflects the availability penalty (UI-04). TransferPanel is a separate surface. This is correct per the phase requirements.

---

### Human Verification Required

1. **Visual badge rendering — CaptainPicksPanel**
   **Test:** In a browser with lineup news data loaded, navigate to the Captain Picks panel. Find a player with status_label "doubted" or "confirmed_absent" in the lineup news API response.
   **Expected:** An amber pill ("doubted") or red pill ("confirmed absent") appears between the McLabel badge and the NewsBanner text in the candidate row. Players with confirmed_start or unknown status show no badge.
   **Why human:** Visual layout and dark mode rendering cannot be verified programmatically.

2. **Visual badge rendering — OpportunityCostTable**
   **Test:** With lineup news data loaded, navigate to the Transfer Opportunity Cost table. Identify a "Buy" candidate row where the player is doubted or confirmed_absent.
   **Expected:** A red or amber StatusLabelBadge appears after RotationRiskBadge and before the news text in the buy-candidate inline cluster. The sell candidate row shows no badge.
   **Why human:** Visual inline cluster ordering in a browser requires human confirmation.

3. **Team News Alert section — conditional render**
   **Test:** On the Decision Summary tab with squad loaded and fresh lineup news, check the section between the 2×2 card grid and the CalibrationHealthIndicator.
   **Expected:** If any of the 15 squad players are doubted or confirmed_absent, the "Team News Alert" section appears listing those players with their appropriate badge. If none are flagged (or lineup news is stale/unavailable), the section is completely absent from the DOM — no placeholder, no heading.
   **Why human:** DOM presence/absence under different data states requires a browser with live data.

4. **Engine penalty activation — DecisionSummaryTab OCS ranking**
   **Test:** On the Decision Summary tab, load a squad that includes a confirmed_absent player as a potential buy candidate. Compare the OCS ranking with the Transfer tab OCS ranking for the same squad.
   **Expected:** The Decision Summary OCS table ranks the confirmed_absent buy candidate lower (penalised to 0.01 availability_factor) compared to healthy players with similar xPts. The Transfer tab OCS may rank the same player differently (TransferPanel suggestTransfers does not receive lineupNewsMap — intentional).
   **Why human:** Requires live data and comparison of two OCS tables; xPts ranking differences are not verifiable programmatically.

---

### Gaps Summary

No gaps. All 9 observable truths verified against codebase evidence. All 4 required artifacts exist and are substantive. All 4 key links are wired with data flowing to rendering. All 4 UI requirements (UI-01, UI-02, UI-03, UI-04) are satisfied by the implementation.

The phase goal is achieved: Phase 118's lineup news engine penalties are surfaced in the UI across all four target surfaces (CaptainPicksPanel, OpportunityCostTable, TransferPanel, DecisionSummaryTab) with the Team News Alert section providing an owned-squad availability overview.

---

_Verified: 2026-05-18T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
