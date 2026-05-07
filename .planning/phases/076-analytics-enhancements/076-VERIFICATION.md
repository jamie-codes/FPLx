---
phase: 076-analytics-enhancements
verified: 2026-05-07T13:00:00Z
status: passed
score: 22/22
overrides_applied: 0
---

# Phase 76: Analytics Enhancements — Verification Report

**Phase Goal:** GemTable gains a sortable Routes to Points column from pipeline data; Accuracy tab GW rows become clickable to reveal flagged players and haulers; LineupTab gains a manual captain/VC override interaction
**Verified:** 2026-05-07
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every player in merged_players.json has a routes_to_points integer field (0..5) | VERIFIED | `pipeline/merge.py:1138` writes `p['routes_to_points'] = routes`; full 40-line pass confirmed at lines 1100–1140 |
| 2 | A player with no point-scoring routes scores 0 (not clamped to 1) | VERIFIED | Pass initialises `routes = 0` and never clamps; test_routes_to_points_no_routes asserts `== 0` |
| 3 | Per-team medians computed only over non-null values; teams with zero entries produce no median entry | VERIFIED | `team_xg_med = {t: median(vals) for t, vals in team_xg_values.items() if vals}` — `if vals` guard confirmed at merge.py |
| 4 | Pytest test_merge_routes.py has 5 test cases, all passing | VERIFIED | File exists; `grep -c "^def test_routes"` returns 5 |
| 5 | REQUIREMENTS.md RTP-01 reads "integer 0–5" | VERIFIED | Line 50: `routes_to_points score (integer 0–5)` confirmed |
| 6 | GemTable renders a sortable "Routes" column (col.accessor routes_to_points, enableSorting true) | VERIFIED | `columns.tsx:385` accessor; `columns.tsx:394` `enableSorting: true` |
| 7 | Routes cell: 0..5 renders as digit; null/undefined renders em-dash | VERIFIED | Cell guard at columns.tsx:389–392 matches spec exactly |
| 8 | MergedPlayer interface declares routes_to_points as optional number | VERIFIED | `types.ts:204` `routes_to_points?: number` |
| 9 | MOBILE_HIDDEN_COLUMNS includes routes_to_points: false | VERIFIED | `GwToggle.tsx:24` entry confirmed |
| 10 | vitest columns.test.tsx has Phase 76 RTP-02 describe block (4 cases) | VERIFIED | `columns.test.tsx:202-203` confirm describe block present |
| 11 | Each GW row in AccuracyTab is clickable, toggling inline drill-down (single-expand) | VERIFIED | `AccuracyTab.tsx:329` `expandedGw` state; rows wrapped in Fragment with onClick/onKeyDown/tabIndex/role/aria-expanded/aria-controls/data-testid |
| 12 | Drill-down shows Haulers sub-table (from data.haulters filtered by gw) | VERIFIED | `AccuracyTab.tsx:421-423` `Haulers (≥10 pts)` heading; filter `data.haulters.filter(h => h.gw === r.gw)` confirmed |
| 13 | Drill-down shows Flagged Misses from data.players[].gws[] flatMap (NOT data.haulters) | VERIFIED | `AccuracyTab.tsx:376` `gwFlaggedMisses = data.players.flatMap(...)` with `xpts_flagged === true && actual_pts <= 2` — comment confirms rationale |
| 14 | Locked copy strings present: headings, empty states | VERIFIED | `AccuracyTab.tsx` contains `"Haulers (≥10 pts)"`, `"xPts Flagged Misses"`, `"No haulers this GW."`, `"No flagged misses this GW — predictions held."` |
| 15 | Single-expand: clicking second GW row collapses first | VERIFIED | `expandedGw` is `number | null`; `setExpandedGw(isExpanded ? null : r.gw)` — a second click always sets to new gw, collapsing previous |
| 16 | 6 ACC2-01 vitest cases exist under describe('ACC2-01: GW row drill-down') | VERIFIED | `AccuracyTab.test.tsx:177` describe block confirmed |
| 17 | Each PlayerCard renders Set C / Set VC pill buttons (div wrapper, sibling buttons) | VERIFIED | `LineupTab.tsx:64` `pitch-card-body-{id}`; `LineupTab.tsx:97,108` `set-c-{id}` / `set-vc-{id}` — sibling button structure confirmed |
| 18 | captainOverrideId / vcOverrideId state; effectiveCaptainId ?? fallback pattern | VERIFIED | `LineupTab.tsx:218,219` state slots; `LineupTab.tsx:326-327` `effectiveCaptainId = captainOverrideId ?? lineup.captainId` |
| 19 | Auto-shuffle: Set C on current VC moves VC to previous captain | VERIFIED | `LineupTab.tsx:332-333` `if (id === effectiveVcId) { setVcOverrideId(effectiveCaptainId) }` |
| 20 | Set VC on current captain is disabled/inert | VERIFIED | `canSetVc={!isCaptain && !isViceCaptain}` in PitchRow; pill gets `disabled={!canSetVc}` |
| 21 | Reset and useEffect([initialLineup]) both clear captainOverrideId and vcOverrideId | VERIFIED | `LineupTab.tsx:224,244` both setCaptainOverrideId(null) calls confirmed in useEffect and handleReset |
| 22 | No localStorage/sessionStorage writes for captain/VC override | VERIFIED | grep finds zero localStorage.setItem / sessionStorage.setItem in LineupTab.tsx |

**Score:** 22/22 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pipeline/merge.py` | routes_to_points post-loop pass (0..5) | VERIFIED | 40-line pass at lines 1100–1140; `p['routes_to_points'] = routes` at line 1138 |
| `pipeline/tests/test_merge_routes.py` | 5 pytest cases | VERIFIED | File exists; 5 `def test_routes_*` functions |
| `.planning/REQUIREMENTS.md` | RTP-01 range "integer 0–5" | VERIFIED | Line 50 updated |
| `src/lib/types.ts` | routes_to_points?: number on MergedPlayer | VERIFIED | Line 204 |
| `src/components/gem-table/columns.tsx` | col.accessor('routes_to_points') sortable | VERIFIED | Line 385; enableSorting: true at line 394 |
| `src/components/gem-table/GwToggle.tsx` | MOBILE_HIDDEN_COLUMNS entry | VERIFIED | Line 24 |
| `src/components/gem-table/columns.test.tsx` | Phase 76 RTP-02 describe block (4 cases) | VERIFIED | Lines 202–203 |
| `src/components/accuracy/AccuracyTab.tsx` | expandedGw state, Fragment accordion, drill-down | VERIFIED | Lines 328–451; all locked strings present |
| `src/components/accuracy/AccuracyTab.test.tsx` | 6 ACC2-01 vitest cases | VERIFIED | Line 177 describe block |
| `src/components/squad/LineupTab.tsx` | captainOverrideId/vcOverrideId state machine, refactored PlayerCard | VERIFIED | Lines 64, 97, 108, 218–219, 326–327, 332–333 |
| `src/components/squad/LineupTab.test.tsx` | Phase 76 OPT-01 describe block (8 cases) | VERIFIED | Line 344 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| merge.py merge_players() post-loop | every player dict routes_to_points | second iteration writing `p['routes_to_points'] = routes` | VERIFIED | Confirmed at merge.py:1138 |
| types.ts MergedPlayer routes_to_points | columns.tsx col.accessor | TanStack Table generic; accessorKey 'routes_to_points' on typed interface | VERIFIED | Both files confirmed |
| GwToggle.tsx MOBILE_HIDDEN_COLUMNS | GemTable column visibility | routes_to_points: false entry consumed by getColumnVisibility isMobile branch | VERIFIED | Entry at GwToggle.tsx:24 |
| GwSummaryTable tr (clickable) | expandedGw state + conditional drill-down tr | onClick/onKeyDown/setExpandedGw | VERIFIED | AccuracyTab.tsx:369,403,418 |
| drill-down Flagged Misses | data.players[].gws[] | flatMap filter xpts_flagged===true && actual_pts<=2 | VERIFIED | AccuracyTab.tsx:376 — correct source, not data.haulters |
| Set C pill onClick | setCaptainOverrideId(id) + auto-shuffle | direct dispatch; LineupTab.tsx:330–336 | VERIFIED | Auto-shuffle logic confirmed |
| handleReset() | captainOverrideId, vcOverrideId cleared | setCaptainOverrideId(null) at line 244 | VERIFIED | Both override slots cleared |
| useEffect([initialLineup]) | captainOverrideId, vcOverrideId cleared | setCaptainOverrideId(null) at line 224 | VERIFIED | Pitfall 2 mitigation wired |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| RTP-01 | 076-01 | Pipeline routes_to_points 0–5 per player | VERIFIED | merge.py pass + 5 pytest cases |
| RTP-02 | 076-02 | GemTable sortable Routes column, mobile-hidden | VERIFIED | columns.tsx + GwToggle.tsx + types.ts |
| ACC2-01 | 076-03 | Clickable GW rows with drill-down in AccuracyTab | VERIFIED | AccuracyTab.tsx expandedGw + Fragment accordion |
| OPT-01 | 076-04 | Manual captain/VC override in LineupTab | VERIFIED | captainOverrideId state machine + Set C/VC pills |

---

### Anti-Patterns Found

None. Specific checks run:
- No `return null` / placeholder components in modified files
- No `useMemo` inside `rows.map()` in AccuracyTab — inline filter/flatMap confirmed
- No localStorage/sessionStorage in LineupTab.tsx
- No stub `// STUB — Task 2b` comments remaining in LineupTab.tsx
- Flagged Misses correctly sourced from `data.players` flatMap, not `data.haulters`

---

### Human Verification Required

1. **Routes column visible on desktop, hidden on mobile**
   - **Test:** Load GemTable on desktop — confirm "Routes" column appears with sortable header. Resize to <640px — confirm column is absent.
   - **Expected:** Column present on desktop, absent on mobile portrait.
   - **Why human:** Visual layout, MOBILE_HIDDEN_COLUMNS wiring requires a live render to confirm column visibility toggle.

2. **AccuracyTab GW row drill-down interaction**
   - **Test:** Load AccuracyTab; click a GW row — confirm drill-down appears with Haulers and Flagged Misses sub-tables. Click the same row again — confirm collapse. Click a second row — confirm first collapses automatically.
   - **Expected:** Single-expand accordion; both sub-tables render with player names and predicted values to 1 decimal.
   - **Why human:** Interactive accordion behaviour requires browser render.

3. **LineupTab Set C / Set VC pills**
   - **Test:** Load LineupTab; tap "Set C" on a non-captain player — confirm C badge moves. Tap "Set C" on the current VC — confirm C moves AND VC moves to the previous captain. Tap Reset — confirm both badges return to algorithm choices.
   - **Expected:** Badges update immediately; auto-shuffle fires correctly; Reset restores algorithm selection.
   - **Why human:** Interactive state machine requires live render; badge positioning requires visual verification.

---

### Gaps Summary

No gaps found. All 22 must-haves are VERIFIED against the codebase.

---

_Verified: 2026-05-07T13:00:00Z_
_Verifier: Claude (gsd-verifier)_
