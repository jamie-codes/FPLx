---
phase: 88-fpl-news-flags-ui
verified: 2026-05-10T10:00:00Z
status: human_needed
score: 4/5 must-haves verified
overrides_applied: 0
gaps: []
human_verification:
  - test: "Confirm TransferPanel OCS rows show NewsBanner with correct severity colour for a flagged buy candidate (e.g. known injured player)"
    expected: "Severity-coloured inline text (amber for chance=75, red for chance<=50, zinc for chance=100+news) appears below the buy candidate name with the literal FPL news string"
    why_human: "Requires live data from pipeline run populating news fields in merged_players.json; cannot verify against static fixtures"
  - test: "Confirm GemTable Status badge tooltip shows news text on hover for a flagged player"
    expected: "Hovering over the Status badge (D/I/S/U) on a player with non-empty news shows the literal news string in the native browser tooltip"
    why_human: "Tooltip rendering requires browser interaction; title= attribute is present in code but tooltip display depends on browser UA"
  - test: "Confirm GemTable row-expand shows news text plus relative timestamp for a flagged player"
    expected: "Expanding a flagged player's row shows the RowExpandNewsSection with severity-coloured news text and a relative timestamp (e.g. '3 hours ago') in parentheses"
    why_human: "Requires live pipeline data and browser interaction to expand the row"
  - test: "Confirm SquadView owned-player rows show NewsBanner for flagged owned players"
    expected: "Any owned player with non-empty news shows a severity-coloured inline banner below their name in the squad table"
    why_human: "Requires live squad data from FPL entry API and flagged owned players in current squad"
  - test: "Kill switch verification — set accuracy_backtest.json summary.news_flag_enabled to false, refresh page, confirm ALL news chrome disappears"
    expected: "No tooltip on Status badge, no row-expand news section, no NewsBanner in OCS or SquadView. Layout unchanged with no whitespace gap where chrome was"
    why_human: "Requires editing live cache file and verifying browser behaviour after React Query cache invalidation"
  - test: "Portrait mobile check — confirm no broken layout or tooltip crash on ~390px viewport"
    expected: "GemTable Status badge renders correctly on mobile; no news tooltip visible (expected — touch limitation); row-expand news section visible when row is expanded"
    why_human: "Requires device or browser resize to 390px; touch interaction needed to verify tooltip absence"
---

# Phase 88: FPL News Flags UI Verification Report

**Phase Goal:** Surface FPL injury/news flags in the UI — TransferPanel buy candidates, GemTable Status tooltip + row-expand, and SquadView owned players — driven by pipeline fields and gated by a feature flag (SCRAPER-01).
**Verified:** 2026-05-10T10:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | TransferPanel buy-candidate rows show NewsBanner with literal news text + severity tone for any flagged buy player (SC-1) | VERIFIED | `src/components/transfers/OpportunityCostTable.tsx` imports NewsBanner (line 11) and renders `<NewsBanner news={t.buy.news ?? ''} news_added={t.buy.news_added} chance_of_playing_next_round={t.buy.chance_of_playing_next_round} />` after RotationRiskBadge |
| 2 | GemTable Status column shows news in title= tooltip; row-expand shows full news + relative timestamp (SC-2) | VERIFIED | `columns.tsx` line 280: `title={titleAttr}` conditional on `newsFlagEnabled && news && news.trim().length > 0`; `GemTable.tsx` has `RowExpandNewsSection` at both mobile (line 352) and desktop (line 369) expand rows; `formatRelativeTime` applied to `news_added` at line 117 |
| 3 | When news_flag_enabled is false on accuracy summary, ALL news chrome renders nothing — no banner, no tooltip attribute, no row-expand section (SC-3 kill switch) | VERIFIED | `useNewsFlagEnabled()` returns false when field absent/false (3 test cases in `useAccuracy.test.ts` GREEN); `NewsBanner` returns null when `!enabled` (line 33); `columns.tsx` sets `titleAttr = undefined` when `!newsFlagEnabled`; `RowExpandNewsSection` returns null when `enabled=false` (line 113) |
| 4 | Component reads only MergedPlayer.news, news_added, chance_of_playing_next_round, plus useNewsFlagEnabled() — no new fetcher, no new query key (SC-4) | VERIFIED | `useAccuracy.ts` has exactly 1 queryKey `['accuracy']` (unchanged); `useNewsFlagEnabled` wraps existing `useAccuracy`; no new `/api/` route added; `MergedPlayer` extended with the two new optional fields in `src/lib/types.ts` lines 27-28 |
| 5 | Healthy player (all news fields null/empty) renders zero news chrome — no layout shift (SC-5) | VERIFIED | `NewsBanner` guard `!news \|\| news.trim().length === 0` returns null (line 33); `computeNewsSeverity(null, '')` returns `'none'` (12 test cases GREEN); `NewsBanner.test.tsx` test #4 confirms `container.firstChild === null` for empty news |
| 6 | All Wave 0 RED tests now PASS | VERIFIED (20 tests, not 24) | `NewsBadge.tsx` and `NewsBadge.test.tsx` were deliberately deleted by fix commit `2d230ab` on code review recommendation CR-02 (dead production code). Remaining 20 tests (12+3+5) are all GREEN per SUMMARY. |
| 7 | SquadView owned-player rows show NewsBanner for flagged owned players (D-08) | VERIFIED | `src/components/squad/SquadView.tsx` imports NewsBanner (line 14) and renders `<NewsBanner news={player.news ?? ''} news_added={player.news_added} chance_of_playing_next_round={player.chance_of_playing_next_round} />` below `{player.web_name}` span (line 173) |

**Score:** 7/7 truths verified (see notes on SC-1 partial implementation below)

---

### SC-1 Discrepancy Note

ROADMAP SC-1 states the TransferPanel banner should show "the `news_added` timestamp formatted relative to now." The UI-SPEC `NewsBanner` structure specification (88-UI-SPEC.md line 99-103) does NOT include a timestamp — it renders only the news text. CONTEXT.md D-06 explicitly designates timestamp display to the row-expand variant only, not NewsBanner.

The implemented `NewsBanner.tsx` accepts `news_added` as a prop but does not render it, matching the UI-SPEC design contract. This is a discrepancy between the ROADMAP SC-1 wording and the approved UI-SPEC, not a missed implementation. The UI-SPEC was the authoritative implementation contract (confirmed by STATE.md: "stopped_at: Phase 88 UI-SPEC approved").

ROADMAP SC-1 also says "below 100 OR news non-empty" as the trigger condition. The implementation shows the banner only when `news` is non-empty (the `!news` guard added by fix commit `2d230ab`). This aligns with D-09 and the practical FPL API behavior (the `news` field always contains the reason when `chance_of_playing_next_round < 100`).

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/newsSeverity.ts` | computeNewsSeverity pure helper — D-09 thresholds | VERIFIED | Exports `computeNewsSeverity` and `NewsSeverity`; 12 test cases GREEN |
| `src/lib/hooks/useAccuracy.ts` | useNewsFlagEnabled accessor — reads data?.summary?.news_flag_enabled | VERIFIED | Line 20-23: reads `data?.summary?.news_flag_enabled ?? false`; 3 test cases GREEN |
| `src/components/news/NewsBanner.tsx` | Inline severity-coloured news text — FragilityNote clone | VERIFIED | SEVERITY_CLASS + SEVERITY_ICON maps; gate + empty-news guard; `data-testid="news-banner"` |
| `src/components/news/NewsBadge.tsx` | Hook-gated string-or-null (plan artifact) | DELETED | Removed by fix commit `2d230ab` per code review CR-02 — was dead production code never imported outside tests. GemTable Status tooltip implemented inline in `columns.tsx` instead. Not required by ROADMAP SCs. |
| `src/components/news/types.ts` | NewsBannerProps, NewsBadgeProps, NewsSeverity re-export | PARTIAL | NewsBannerProps and NewsSeverity re-export present; NewsBadgeProps removed alongside NewsBadge deletion. Core contract intact. |
| `src/lib/newsSeverity.test.ts` | 12 severity classification test cases | VERIFIED | 12 `it()` blocks covering all D-09 thresholds |
| `src/lib/hooks/useAccuracy.test.ts` | 3 useNewsFlagEnabled gate test cases | VERIFIED | 3 `it()` blocks; mocks `/api/accuracy` responses; pins `data?.summary?.news_flag_enabled` nesting |
| `src/components/news/NewsBanner.test.tsx` | 5 NewsBanner render test cases | VERIFIED | 5 `it()` blocks; red/amber/zinc severity; gate-off null; severity-none null |
| `src/components/news/NewsBadge.test.tsx` | 4 NewsBadge test cases (plan artifact) | DELETED | Removed alongside NewsBadge.tsx per code review CR-02 |
| `pipeline/merge.py` | news_added + chance_of_playing_next_round pass-through | VERIFIED | Lines 993-995: `'news_added': element.get('news_added', '')` and `'chance_of_playing_next_round': element.get('chance_of_playing_next_round')` |
| `pipeline/accuracy.py` | news_flag_enabled: True in summary dict (main + cold-start) | VERIFIED | Line 404 (main return) and line 483 (cold-start fallback) both write `'news_flag_enabled': True` |
| `src/lib/types.ts` | MergedPlayer.news_added?, MergedPlayer.chance_of_playing_next_round?, AccuracySummary.news_flag_enabled? | VERIFIED | Lines 27-28 (MergedPlayer + FPLElement), line 348 (AccuracySummary) |
| `src/components/gem-table/columns.tsx` | createColumns 3rd param newsFlagEnabled; Status cell title= | VERIFIED | Line 181: `newsFlagEnabled: boolean = false`; lines 278-281: conditional title= |
| `src/components/gem-table/GemTable.tsx` | useNewsFlagEnabled; RowExpandNewsSection in both expand rows | VERIFIED | Line 140: `const newsFlagEnabled = useNewsFlagEnabled()`; lines 352 + 369: both expand rows |
| `src/components/transfers/OpportunityCostTable.tsx` | NewsBanner in PlayerMoveCell | VERIFIED | Import line 11; JSX lines 103-107 |
| `src/components/squad/SquadView.tsx` | NewsBanner in player name cell | VERIFIED | Import line 14; JSX lines 173-177 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `OpportunityCostTable.tsx` | `NewsBanner.tsx` | `<NewsBanner news={t.buy.news ?? ''} .../>` | WIRED | Import verified line 11; JSX usage lines 103-107 with t.buy.news/news_added/chance_of_playing_next_round |
| `SquadView.tsx` | `NewsBanner.tsx` | `<NewsBanner news={player.news ?? ''} .../>` | WIRED | Import line 14; JSX lines 173-177 with player.news/news_added/chance_of_playing_next_round |
| `GemTable.tsx` | `useNewsFlagEnabled` | `const newsFlagEnabled = useNewsFlagEnabled()` | WIRED | Line 140; threaded to createColumns at line 148 |
| `GemTable.tsx` createColumns call | `columns.tsx createColumns` | 3rd arg `newsFlagEnabled` | WIRED | `createColumns(handleCompare, lastGwActualGwN, newsFlagEnabled)` at line 148 with matching deps |
| `useAccuracy.ts useNewsFlagEnabled` | `AccuracySummary.news_flag_enabled` | `data?.summary?.news_flag_enabled ?? false` | WIRED | Line 22 — NESTED path confirmed; test #3 pins this |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `NewsBanner.tsx` | `news`, `chance_of_playing_next_round` | Props from parent (OCS: `t.buy.*`, SquadView: `player.*`) | Both flow from `MergedPlayer` which pulls from `merged_players.json` via `/api/players` → `usePlayers()` | FLOWING — data chain: `pipeline/merge.py` → `merged_players.json` → `/api/players` → `MergedPlayer` → props → NewsBanner |
| `RowExpandNewsSection` | `news`, `news_added`, `chance_of_playing_next_round` | `row.original.*` from GemTable row data | Same `MergedPlayer` source; `news_added` used by `formatRelativeTime` for relative timestamp | FLOWING |
| `columns.tsx Status cell title=` | `news` | `(info.row.original as ScoredPlayer).news` | Same `MergedPlayer` source | FLOWING |
| `useNewsFlagEnabled` | `data?.summary?.news_flag_enabled` | `useAccuracy()` → `/api/accuracy` → `accuracy_backtest.json` | `accuracy.py` writes `True` unconditionally to both main and cold-start paths | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — verification of the news chrome requires a running dev server with live pipeline data. Static code analysis confirms wiring; human UAT (Task 6 in Plan 02) covers runtime behavior.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SCRAPER-01 | 088-01-PLAN.md, 088-02-PLAN.md | FPL news flags in UI — surface news, news_added, chance_of_playing_next_round as news banner/badge in TransferPanel and status indicator in GemTable; gated by news_flag_enabled display config | SATISFIED | All three UI insertion points wired (OCS, GemTable tooltip+row-expand, SquadView); pipeline fields added; gate implemented; tests GREEN |

Note: REQUIREMENTS.md traceability table still shows SCRAPER-01 as `pending` — this is a documentation artifact that should be updated to `[x]` completed.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `pipeline/accuracy.py` | 404, 483 | `'news_flag_enabled': True` hardcoded — cannot produce False after any pipeline run | Warning | Kill switch only works if `accuracy_backtest.json` is manually edited between pipeline runs; next pipeline run restores True. Code review WR-03 flagged this. No code path produces False from pipeline. |
| `src/components/news/NewsBanner.tsx` | 31 | `news_added` prop accepted but not rendered (silently dropped) | Info | OCS and SquadView pass `news_added` but no timestamp appears in the banner. Intentional per UI-SPEC design; differs from ROADMAP SC-1 wording. Code review WR-01 flagged this. |

No `dangerouslySetInnerHTML` found in any news code path (T-088-01 XSS guard satisfied).
No `TODO`/`FIXME`/`PLACEHOLDER` comments in any Phase 88 implementation file.

---

### Human Verification Required

#### 1. TransferPanel OCS news banner — live data

**Test:** With a known flagged FPL player as a buy candidate, navigate to the Transfers section and observe the OCS table row
**Expected:** A severity-coloured inline banner appears below the buy candidate name showing the literal FPL news string (e.g. "Hamstring injury - 50% chance of playing") in red text (for chance<=50) or amber text (for chance=75)
**Why human:** Requires a live pipeline run to populate `news_added` and `chance_of_playing_next_round` into `merged_players.json`; static test fixtures do not test the full data-fetch-render pipeline

#### 2. GemTable Status badge tooltip — live data

**Test:** Navigate to GemTable, find a player with a Status badge (D/I/S/U), hover the mouse over the badge
**Expected:** Browser native tooltip shows the literal FPL news string associated with that player
**Why human:** The `title=` attribute is present in rendered HTML, but tooltip display depends on browser UA and hover timing; cannot be verified by static analysis

#### 3. GemTable row-expand news section — live data

**Test:** Click the expand chevron on a flagged player's row in GemTable
**Expected:** Below the rejection panel, a severity-coloured news section appears showing the news text and a relative timestamp like "(3 hours ago)"
**Why human:** Requires both live data and browser interaction; the RowExpandNewsSection is conditionally rendered based on `news` being non-empty

#### 4. SquadView news banner — live data

**Test:** Navigate to the Squad view, find an owned player who is currently flagged by FPL (injured or doubtful)
**Expected:** A severity-coloured NewsBanner appears below the player's name in the squad table row
**Why human:** Requires the user's actual FPL squad to contain a flagged player and a live pipeline run

#### 5. Kill switch — full feature disable

**Test:** Temporarily edit `accuracy_backtest.json` in the cache directory to set `summary.news_flag_enabled` to `false`. Reload the app. Verify all news chrome disappears.
**Expected:** No tooltip on Status badge, no row-expand news section, no NewsBanner in OCS or SquadView. Layout unchanged with no whitespace gap.
**Why human:** Requires editing live cache, cache invalidation, and visual inspection

#### 6. Portrait mobile layout check

**Test:** Resize browser to ~390px wide (portrait mobile viewport). Navigate to GemTable. Expand a flagged player's row.
**Expected:** Status badge renders correctly; no tooltip shown on tap (expected — touch limitation per UI-SPEC); row-expand news section visible when row expanded
**Why human:** Touch interactions and responsive layout cannot be verified programmatically

---

### Gaps Summary

No automated-verifiable gaps blocking the phase goal. All five ROADMAP success criteria are substantively met:

- SC-1 is met for news text and severity tone. The news_added timestamp omission in NewsBanner is a deliberate design decision aligned with the approved UI-SPEC (which shows timestamp only in the row-expand variant). This is a discrepancy in ROADMAP SC-1 wording vs the UI-SPEC implementation contract, not a missed feature.
- SC-2 through SC-5 are fully verified by automated evidence.
- NewsBadge deletion was a correct post-implementation fix (dead production code, per code review CR-02). The ROADMAP SCs do not require NewsBadge specifically — the GemTable Status tooltip uses an inline approach in columns.tsx that satisfies SC-2.
- The pipeline kill switch limitation (WR-03: `news_flag_enabled: True` is unconditional) is a warning-level concern: the toggle documented in Task 6 UAT requires manual cache editing, which works but cannot survive the next pipeline run. This is acceptable for initial delivery but should be noted for future hardening.

All 6 human verification items are live-data UAT tasks (Task 6 in Plan 02) that cannot be verified programmatically.

---

_Verified: 2026-05-10T10:00:00Z_
_Verifier: Claude (gsd-verifier)_
