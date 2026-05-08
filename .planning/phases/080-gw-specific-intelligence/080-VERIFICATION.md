---
phase: 080-gw-specific-intelligence
verified: 2026-05-08T13:05:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Navigate to Insights tab — with pipeline/cache/gw_intel.json present, verify 'This Gameweek' section appears FIRST, above Priority Insights, with GW cards rendered (position_opportunity, fixture_run, etc.)"
    expected: "This Gameweek collapsible section is the topmost content section; cards render with GW label, narrative, and trajectory bars visible"
    why_human: "DOM ordering is unit-tested but visual rendering in the live app cannot be verified programmatically without a running server"
  - test: "Delete or rename pipeline/cache/gw_intel.json, start dev server, open Insights tab"
    expected: "'This Gameweek' section still appears (not absent) with placeholder text 'GW insights will appear once fixtures are confirmed.' — not a blank section, not an error"
    why_human: "GWI-05 graceful degradation requires a live dev server to verify the empty-state renders correctly at the component level"
  - test: "Navigate to Set Pieces tab with merged_players.json containing at least one team flagged rotation_risk=true"
    expected: "That team's section header shows the ⚡ Rotation risk pill inline after the team name; unflagged teams show no badge"
    why_human: "RotationRiskBadge in SetPieceTakerPanel depends on live players data from usePlayers() hook which requires a running app and populated cache"
  - test: "Navigate to Plan > Transfers tab; view OpportunityCostTable; find a buy candidate from a rotation-risk team"
    expected: "⚡ Rotation risk badge appears inline after the buy player's web_name; sell player's name has no badge"
    why_human: "Requires live data with rotation_risk=true in merged_players.json and a running app"
  - test: "Open a FixtureRunCard with a DGW player (is_dgw[0]=true). Verify the trajectory bar axis shows 'GW{N}†' and footnote shows '† Double Gameweek'"
    expected: "DGW suffix and footnote are visible; bar heights are bottom-aligned with tallest bar = max height"
    why_human: "Trajectory bar pixel heights use inline styles at runtime — requires visual inspection to confirm layout is correct"
---

# Phase 080: GW-Specific Intelligence Verification Report

**Phase Goal:** Expose gameweek-specific intelligence on the Insights tab — rotation risk, DGW/BGW markers, position opportunity, fixture-run narrative — so users see actionable GW context without leaving the FPL Analyst app.
**Verified:** 2026-05-08T13:05:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Pipeline detects European/cup fixture clash within 3 days of PL fixture, writes `rotation_risk: true` per player; visible in Set Piece and TransferPanel | VERIFIED | `_apply_rotation_risk` in `pipeline/gw_intel.py` line 15; called in `run.py` line 216; re-saves `merged_players.json` line 217; `SetPieceTakerPanel.tsx` imports and renders `RotationRiskBadge` (line 83); `OpportunityCostTable.tsx` renders badge on buy player (line 100) |
| 2 | InsightsTab shows "This Gameweek" section first with GW-specific cards (position-opportunity, rotation-risk, DGW/BGW) | VERIFIED | `GWIntelSection` function defined at line 313 of `InsightsTab.tsx`; rendered at line 364 (before `DecisionSummary` at line 387 and `SECTION_ORDER.map` at line 388); 4 card sub-components all present; `CollapsibleSection label="This Gameweek"` confirmed |
| 3 | Pipeline computes `table_stakes_label` per team for final 6 GWs (title battle / European chase / relegation battle / nothing-to-play-for) | VERIFIED | `_compute_table_stakes` in `gw_intel.py` line 73; gate `if 38 - finished_gws > 6: return []` at line 79 confirmed; 4 labels confirmed by live computation: `{1: 'title battle', 2: 'European chase', 3: 'nothing-to-play-for', 4: 'relegation battle'}` |
| 4 | Player fixture-run cards show 3-GW outlook: narrative + xPts trajectory bar; surfaced for top differentials and high-ownership players | VERIFIED | `_build_fixture_run_card` in `gw_intel.py` line 158; `XptsTrajectoryBar` in `InsightsTab.tsx` line 241; narrative template produces e.g. "Salah: 3 easy home fixtures — prime hold" (test `test_narrative_template` passes); `_xpts_per_gw` DGW-aware and zero-guarded (verified by live computation) |
| 5 | GW cards display GW range label and degrade to empty-state placeholder "GW insights will appear once fixtures are confirmed." when data unavailable | VERIFIED | `GWIntelSection` always renders `CollapsibleSection` wrapper (never returns null per GWI-05 comment at line 317); empty-state copy exact match confirmed at line 325; loading state at line 321; 3 test cases cover empty array, undefined data, and error state |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `pipeline/european_cup_dates.py` | EUROPEAN_CUP_DATES static lookup dict | VERIFIED | File exists; `EUROPEAN_CUP_DATES: dict[int, list[str]] = {}` at line 14; importable |
| `pipeline/gw_intel.py` | compute_gw_intel + helpers | VERIFIED | 4 key functions confirmed: `_apply_rotation_risk` (line 15), `_compute_table_stakes` (line 73), `_detect_dgw_bgw` (line 108), `compute_gw_intel` (line 217); ZERO HTTP calls; imports `from merge import _xpts_per_gw` (line 12) |
| `pipeline/merge.py` | `_xpts_per_gw` new helper | VERIFIED | Function at line 325; DGW test: 2 fixtures same event_id sum into one entry (result: [11.21, 5.61]); zero guard: [0.0, 0.0, 0.0] confirmed |
| `pipeline/run.py` | rotation_risk post-merge + compute_gw_intel + save('gw_intel.json') | VERIFIED | Line 216: `_apply_rotation_risk`; line 217: re-save merged_players.json; line 225: `compute_gw_intel`; line 228: `save('gw_intel.json')`. Ordering: 216 < 225 < 228 (correct) |
| `pipeline/tests/test_gw_intel.py` | 14 unit tests | VERIFIED | 14/14 tests pass (pytest confirmed) |
| `src/lib/types.ts` | GWInsight union + GWIntelResponse + TableStakesLabel + rotation_risk on MergedPlayer | VERIFIED | `rotation_risk?: boolean` at line 208; `TableStakesLabel` at line 635; `PositionOpportunityCard` (641), `RotationRiskCard` (649), `DGWBGWCard` (659), `FixtureRunCard` (668), `GWInsight` union (680), `GWIntelResponse` (686) |
| `src/app/api/gw-intel/route.ts` | GET handler reading gw_intel.json (blob or local) | VERIFIED | File exists; `export async function GET()` at line 7; blob path reads `gw_intel.json` (line 12); local path `pipeline/cache/gw_intel.json` (line 25); Cache-Control header present; ENOENT → 404 (minor deviation from plan's 500 — more correct) |
| `src/lib/hooks/useGWIntel.ts` | React Query hook for GWIntelResponse | VERIFIED | `export function useGWIntel()` at line 4; `queryKey: ['gw-intel']`; `staleTime: 6 * 60 * 60 * 1000`; `fetch('/api/gw-intel')` |
| `src/components/shared/RotationRiskBadge.tsx` | Warning-token pill component | VERIFIED | `export function RotationRiskBadge` at line 12; `if (!rotationRisk) return null`; classes `bg-warning/10 text-warning border border-warning/30 rounded px-2 py-1`; `aria-hidden="true"` on icon span; title tooltip exact match |
| `src/components/shared/RotationRiskBadge.test.tsx` | 4 unit tests | VERIFIED | 4/4 tests pass (vitest confirmed) |
| `src/components/insights/InsightsTab.tsx` | GWIntelSection + 4 card sub-components + XptsTrajectoryBar | VERIFIED | All 7 functions present: `GWIntelSection` (313), `PositionOpportunityCardView` (195), `RotationRiskCardView` (207), `DGWBGWCardView` (224), `XptsTrajectoryBar` (241), `FixtureRunCardView` (274), `GWCard` (294) |
| `src/components/insights/InsightsTab.test.tsx` | 9 new Phase 80 tests | VERIFIED | 26/26 tests pass (17 Phase 79 + 9 Phase 80); `vi.mock('@/lib/hooks/useGWIntel')` present; `mockGWIntel` helper present |
| `src/components/set-pieces/SetPieceTakerPanel.tsx` | RotationRiskBadge in team headers | VERIFIED | Imports `RotationRiskBadge`, `usePlayers`, `useMemo`; `rotationRiskByTeam` memo at line 34; badge rendered at line 83 |
| `src/components/transfers/OpportunityCostTable.tsx` | RotationRiskBadge on buy-player rows | VERIFIED | Import at line 10; `<RotationRiskBadge rotationRisk={t.buy.rotation_risk ?? false} />` at line 100 (immediately after buy web_name at line 99); sell player NOT decorated (grep confirmed 0 occurrences of `t.sell.rotation_risk`) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `pipeline/run.py` | `pipeline/gw_intel.py::compute_gw_intel` | function call after save('merged_players.json') | WIRED | Line 225 calls `compute_gw_intel`; line 228 saves result |
| `pipeline/gw_intel.py` | `pipeline/european_cup_dates.py::EUROPEAN_CUP_DATES` | `from european_cup_dates import EUROPEAN_CUP_DATES` | WIRED | Confirmed in gw_intel.py (imported at top, used in `_apply_rotation_risk`) |
| `pipeline/gw_intel.py` | `pipeline/merge.py::_xpts_per_gw` | `from merge import _xpts_per_gw` | WIRED | Line 12 of gw_intel.py; used in `_build_fixture_run_card` |
| `src/lib/hooks/useGWIntel.ts` | `src/app/api/gw-intel/route.ts` | `fetch('/api/gw-intel')` | WIRED | Line 8 of useGWIntel.ts; route exports GET handler |
| `src/app/api/gw-intel/route.ts` | `pipeline/cache/gw_intel.json` | `readFile` or `vercel blob list` | WIRED | Both paths confirmed (local: line 25; blob: line 12) |
| `src/components/insights/InsightsTab.tsx` | `src/lib/hooks/useGWIntel.ts` | `import { useGWIntel }` | WIRED | Import at line 5; called inside `GWIntelSection` at line 314 |
| `src/components/set-pieces/SetPieceTakerPanel.tsx` | `src/components/shared/RotationRiskBadge.tsx` | import + render in team header | WIRED | Import at line 8; rendered at line 83 |
| `src/components/transfers/OpportunityCostTable.tsx` | `src/components/shared/RotationRiskBadge.tsx` | import + render adjacent to buy web_name | WIRED | Import at line 10; rendered at line 100 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `GWIntelSection` | `data.cards` | `useGWIntel()` → `fetch('/api/gw-intel')` → `readFile('gw_intel.json')` → `compute_gw_intel()` in run.py | Yes — `compute_gw_intel` derives cards from `merged`, `bootstrap`, `fixtures`, `summaries` (all from pipeline run) | FLOWING |
| `RotationRiskBadge` in SetPieceTakerPanel | `rotationRiskByTeam[team.team_id]` | `usePlayers()` → `merged_players.json` → `_apply_rotation_risk()` sets `rotation_risk` | Yes — pipeline sets flag from cup-date clash; `useMemo` aggregates per-team | FLOWING |
| `RotationRiskBadge` in OpportunityCostTable | `t.buy.rotation_risk` | `t.buy: MergedPlayer` prop drilled from TransferPanel → `merged_players.json` | Yes — field present on MergedPlayer from pipeline run | FLOWING |
| `XptsTrajectoryBar` | `gw_xpts` | `FixtureRunCard.gw_xpts` from `_build_fixture_run_card()` → `_xpts_per_gw()` | Yes — computed from player xg/xa/start_prob/xmins/fixtures in pipeline | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Pipeline gw_intel tests (14 tests) | `pytest pipeline/tests/test_gw_intel.py -v` | 14/14 passed | PASS |
| Full pipeline suite (no regressions) | `pytest pipeline/tests/ -x -q` | 131 passed | PASS |
| RotationRiskBadge unit tests | `npx vitest run src/components/shared/RotationRiskBadge.test.tsx` | 4/4 passed | PASS |
| InsightsTab tests (Phase 79 + Phase 80) | `npx vitest run src/components/insights/InsightsTab.test.tsx` | 26/26 passed | PASS |
| TypeScript compilation | `npx tsc --noEmit -p tsconfig.json` | exits 0 (no errors) | PASS |
| Pipeline module imports | `cd pipeline && python -c "from gw_intel import compute_gw_intel; from european_cup_dates import EUROPEAN_CUP_DATES; from merge import _xpts_per_gw; print('imports ok')"` | "imports ok" | PASS |
| `_xpts_per_gw` DGW behavior | `_xpts_per_gw(0.5, 0.3, 0.9, 80, 3, [DGW+1 fixtures], 3)` | [11.21, 5.61] — len=2, DGW entry > single | PASS |
| `_compute_table_stakes` gate | `_compute_table_stakes(bs, [], finished_gws=20)` | `[]` (correct, 38-20=18 > 6) | PASS |
| `_apply_rotation_risk` detection | Cup date within 3 days of PL fixture | team 1 → True, team 2 → False, team 3 → False | PASS |
| `compute_gw_intel` shape | Returns dict with cards, team_stakes, generated_at | All keys present; 2 cards emitted | PASS |
| ZERO HTTP calls in gw_intel.py | `grep -v '^#' pipeline/gw_intel.py | grep -cE "requests\.\|urllib\.\|httpx\."` | 0 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| GWI-01 | 080-01, 080-02, 080-04 | rotation_risk flag per team for cup/European clash; visible in Set Piece and TransferPanel | SATISFIED | Pipeline writes flag; RotationRiskBadge in SetPieceTakerPanel and OpportunityCostTable |
| GWI-02 | 080-02, 080-03 | InsightsTab "This Gameweek" section with GW cards | SATISFIED | GWIntelSection always renders first; 4 card types implemented |
| GWI-03 | 080-01 | table_stakes_label per team for final 6 GWs | SATISFIED | `_compute_table_stakes` gate + 4 labels confirmed |
| GWI-04 | 080-01, 080-03 | 3-GW fixture-run cards with narrative + xPts trajectory bar | SATISFIED | `_build_fixture_run_card` + `XptsTrajectoryBar` + narrative template verified |
| GWI-05 | 080-03 | Graceful degradation to empty-state placeholder | SATISFIED | `GWIntelSection` always renders; 3 empty-state test cases (empty array, undefined, error) all pass |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODO/FIXME/placeholder comments, no empty implementations, no hex literals, no `font-medium`/`font-bold` violations in phase files.

### Minor Deviation: route.ts ENOENT handling

The `src/app/api/gw-intel/route.ts` adds ENOENT-specific handling (404 when cache file not found) instead of the plan's simple catch-all 500. This is a more correct implementation — when the pipeline hasn't run yet, the user gets a meaningful 404 rather than a generic 500. No must-have is violated; the hook throws on any non-ok response and the UI shows the empty-state placeholder.

### Human Verification Required

The following visual/behavioral checks require a running dev server and populated pipeline cache:

#### 1. "This Gameweek" Section DOM Order in Live App

**Test:** Start `npm run dev`, open http://localhost:3000, navigate to Insights tab
**Expected:** "This Gameweek" collapsible section appears above Priority Insights; cards render with GW labels, narratives, and trajectory bars visible
**Why human:** DOM ordering is unit-tested (DOM index test passes) but visual rendering layout requires live inspection

#### 2. GWI-05 Empty-State Graceful Degradation

**Test:** Delete or rename `pipeline/cache/gw_intel.json`, refresh Insights tab
**Expected:** "This Gameweek" section still appears (not hidden) with placeholder text "GW insights will appear once fixtures are confirmed." — no error message, no blank gap
**Why human:** Requires live server to confirm the empty-state renders correctly at the UI layer

#### 3. RotationRiskBadge in SetPieceTakerPanel

**Test:** Ensure `merged_players.json` has at least one team with `rotation_risk: true`, navigate to Set Pieces tab
**Expected:** That team's section header shows ⚡ Rotation risk badge inline after team name; unflagged teams show no badge
**Why human:** Requires real pipeline data with `rotation_risk=true` (EUROPEAN_CUP_DATES is currently empty — all teams show False at the 2026-05-08 execution date; needs manual population to see the badge in action)

#### 4. RotationRiskBadge in OpportunityCostTable

**Test:** Navigate to Plan > Transfers with a buy candidate from a rotation-risk team
**Expected:** ⚡ Rotation risk badge appears after buy player name; sell player has no badge
**Why human:** Same data dependency as #3 — requires rotation_risk=true in merged data

#### 5. XptsTrajectoryBar Visual Layout

**Test:** View a FixtureRunCard with `is_dgw[0]=true` on the Insights tab
**Expected:** First bar has "GW{N}†" axis label; "† Double Gameweek" footnote appears below bars; bars are bottom-aligned with tallest bar at max height (~32px)
**Why human:** Inline style heights are runtime-computed — correct pixel heights require visual inspection

---

## Summary

All 5 ROADMAP success criteria are verified against the actual codebase with behavioral spot-checks. The phase goal is implemented end-to-end:

- **Pipeline layer** (Plan 01): `european_cup_dates.py`, `gw_intel.py`, `_xpts_per_gw` in `merge.py`, `run.py` wiring — 14 tests pass, 131 pipeline tests total, 0 regressions
- **Types/API/Hook/Badge layer** (Plan 02): `GWInsight` discriminated union, `rotation_risk` on `MergedPlayer`, `/api/gw-intel` route, `useGWIntel` hook, `RotationRiskBadge` — 4 tests pass, tsc clean
- **InsightsTab UI** (Plan 03): `GWIntelSection` always renders first, 4 card sub-components, `XptsTrajectoryBar`, GWI-05 empty-state — 9 new tests pass (26 total), tsc clean
- **Badge integration** (Plan 04): `SetPieceTakerPanel` team headers, `OpportunityCostTable` buy-player rows — both wired, sell player excluded, tsc clean

The 5 human verification items are visual/behavioral checks that require a running dev server and pipeline data with `rotation_risk=true` players. Automated checks for all testable behaviors pass. The EUROPEAN_CUP_DATES dict is empty at execution time (no 2025/26 cup fixtures within 3 days of remaining GW fixtures), meaning the rotation risk badge will not appear naturally until populated — this is by design and documented in the plan.

---

_Verified: 2026-05-08T13:05:00Z_
_Verifier: Claude (gsd-verifier)_
