---
phase: 28-xpts-engine
verified: 2026-04-28T10:30:00Z
status: human_needed
score: 3/3 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open Gems tab and confirm xPts columns, variance badges, and breakdown tooltip"
    expected: "Columns headed 'xPts', 'xPts (3)', 'xPts (5)'; ⬆/= badge inline after each xPts value; hovering 1GW cell shows Goals/Assists/Clean sheet/Bonus breakdown tooltip; hovering badge shows High ceiling / Consistent tooltip"
    why_human: "Visual rendering, native browser title tooltip behaviour, and badge colour in light/dark mode require a running browser — cannot verify programmatically"
    status: approved
  - test: "Verify GwToggle pill switching controls xPts column visibility"
    expected: "Exactly one xPts column visible at a time as 1/3/5 GW pill is toggled"
    why_human: "TanStack column visibility is runtime DOM state — cannot grep"
    status: approved
  - test: "Verify D-03 non-regression: TransferPanel and PlannerTab still show proj_pts-based numbers"
    expected: "No visual regression in Transfer and Planner tabs; those consumers still read proj_pts_*"
    why_human: "Runtime display verification required"
    status: approved
---

# Phase 28: xPts Engine Verification Report

**Phase Goal:** User can see a statistically grounded expected points projection per player with component breakdown, replacing the heuristic proj_pts
**Verified:** 2026-04-28T10:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Pipeline computes xPts per player per upcoming GW with goal, assist, clean sheet, and bonus components using Poisson/Bernoulli distributions | VERIFIED | `_compute_xpts_fixture()`, `_xpts_ngw()`, `_compute_xpts_sigma()` exist in `pipeline/merge.py` (lines 166, 228, 281). Constants `GOAL_PTS`, `ASSIST_PTS`, `CS_PTS`, `BONUS_RATE` defined at module level (lines 16-22). `merge_players()` assigns `xPts_1gw/3gw/5gw`, `xPts_components_1gw`, `xPts_ceiling_1gw/3gw/5gw` (lines 683-720). Post-loop tercile classification with scratch field cleanup confirmed. |
| 2 | User can see per-player xPts with component breakdown in GemTable | VERIFIED | `src/components/gem-table/columns.tsx` has `col.accessor('xPts_1gw')`, `col.accessor('xPts_3gw')`, `col.accessor('xPts_5gw')` (lines 123, 135, 147). `XPtsCell` exported from columns.tsx builds breakdown tooltip: `xPts breakdown (${window} GW):\nGoals: ...\nAssists: ...\nClean sheet: ...\nBonus: ...` (line 45). Human approval received. |
| 3 | User can see an xPts variance indicator distinguishing high-ceiling players from consistent scorers | VERIFIED | `src/components/gem-table/VarianceBadge.tsx` exports `VarianceBadge` with ⬆ (violet, high-ceiling) and = (zinc, consistent) inline badges; ceiling boolean from pipeline `xPts_ceiling_*gw` drives rendering; `null` for undefined. 9 XPtsCell.test.tsx tests pass (including VarianceBadge tests). Human approval received. |

**Score:** 3/3 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pipeline/merge.py` | `_compute_xpts_fixture()`, `_xpts_ngw()`, `_compute_xpts_sigma()`, constants, result-dict fields | VERIFIED | All 3 helper functions present. Constants `GOAL_PTS`, `ASSIST_PTS`, `CS_PTS`, `BONUS_RATE` at module level. `player['xPts_1gw']`, `player['xPts_3gw']`, `player['xPts_5gw']`, `player['xPts_components_1gw']` assigned. `xPts_ceiling_{window}gw` written via f-string post-loop. Scratch `_sigma_*gw` fields deleted before return. Python parses clean (`ast.parse` exits 0). |
| `src/lib/types.ts` | `MergedPlayer` optional xPts fields | VERIFIED | 7 optional fields confirmed: `xPts_1gw?: number`, `xPts_3gw?: number`, `xPts_5gw?: number`, `xPts_ceiling_1gw?: boolean`, `xPts_ceiling_3gw?: boolean`, `xPts_ceiling_5gw?: boolean`, `xPts_components_1gw?: { goal_pts, assist_pts, cs_pts, bonus_pts } | null`. `npx tsc --noEmit` exits 0. |
| `src/components/gem-table/VarianceBadge.tsx` | VarianceBadge component | VERIFIED | Exists. `export function VarianceBadge`. Violet (`bg-violet-100 dark:bg-violet-900 text-violet-800 dark:text-violet-200`) for ceiling=true, zinc (`bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300`) for false, null for undefined. `ml-1 inline-block text-xs font-normal rounded px-2 py-1` envelope. Native `title` tooltips. |
| `src/components/gem-table/columns.tsx` | `XPtsCell` + three xPts column defs | VERIFIED | `export function XPtsCell` present. `import { VarianceBadge }`. Three `col.accessor('xPts_1gw/3gw/5gw')` with headers `H('xPts', ...)`, `H('xPts (3)', ...)`, `H('xPts (5)', ...)`. Zero `col.accessor('proj_pts_` references. |
| `src/components/gem-table/GwToggle.tsx` | `getColumnVisibility()` uses xPts_*gw keys | VERIFIED | `xPts_1gw: horizon === 1`, `xPts_3gw: horizon === 3`, `xPts_5gw: horizon === 5`. Zero `proj_pts_` references. Toggle pill UI and aria-label unchanged. |
| `tests/lib/xpts-engine.test.ts` | 7 it.skip + 1 placeholder | VERIFIED | File exists. `grep -c "it.skip"` returns 8 (note: SUMMARY claims 7, actual count is 8 — an off-by-one in the claim but not a functional gap: all cache-integration tests are appropriately skipped). 1 placeholder test passes. Full suite: 264 passed, 16 skipped, 0 failed. |
| `tests/components/gem-table/XPtsCell.test.tsx` | RTL tests for VarianceBadge + XPtsCell | VERIFIED | File exists with `@vitest-environment jsdom`. Two describe blocks: `describe('VarianceBadge')` and `describe('XPtsCell')`. 9 tests pass (including sentence-case "Clean sheet" assertion). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `pipeline/merge.py` merge_players() | result dict xPts fields | `player['xPts_1gw'] = xpts_1gw` (line 683) | WIRED | Assignment confirmed alongside existing `proj_pts_*` fields (line 663-665). Additive rollout intact. |
| `pipeline/merge.py` _xpts_ngw | `FixtureEntry.defensive_difficulty` | `fix.get('defensive_difficulty', 1.0 - fix.get('attacking_difficulty', 0.5))` (line 267) | WIRED | Uses `defensive_difficulty` (Phase 27 output) with fallback derived from `attacking_difficulty`. Deviation from PLAN (which used `attacking_difficulty` directly) — CR-01 fix for correct CS probability direction. |
| `src/components/gem-table/columns.tsx` | `VarianceBadge.tsx` | `import { VarianceBadge } from '@/components/gem-table/VarianceBadge'` | WIRED | Import confirmed at line 5. Used inside `XPtsCell` at line 51. |
| `src/components/gem-table/columns.tsx` | `ScoredPlayer.xPts_ceiling_*gw / xPts_components_1gw` | `info.row.original.xPts_ceiling_1gw` / `info.row.original.xPts_components_1gw` | WIRED | Confirmed in column definitions at lines 123-160. |
| `src/components/gem-table/GwToggle.tsx` | TanStack columnVisibility | `{ xPts_1gw: horizon === 1, xPts_3gw: horizon === 3, xPts_5gw: horizon === 5 }` | WIRED | Key map confirmed at lines 23-25. No `proj_pts_` keys remain. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `columns.tsx` XPtsCell | `xPts_1gw`, `xPts_ceiling_1gw`, `xPts_components_1gw` | `pipeline/merge.py merge_players()` → `merged_players.json` → Next.js API → `usePlayers()` hook | Yes (Poisson/Bernoulli computation, not hardcoded) | FLOWING — optional fields default to undefined when pipeline cache not present; cell shows `0.0` via `(value ?? 0).toFixed(1)` guard |
| `VarianceBadge.tsx` | `ceiling: boolean | undefined` | Pipeline `xPts_ceiling_*gw` boolean (top-tercile sigma) | Yes (cross-player tercile computed at pipeline run time) | FLOWING — renders null gracefully when field absent (pre-pipeline-run state) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Python pipeline syntax valid | `python -c "import ast; ast.parse(open('pipeline/merge.py').read())"` | OK | PASS |
| TypeScript type check | `npx tsc --noEmit` | Exit 0 (no output) | PASS |
| xpts-engine.test.ts + XPtsCell.test.tsx | `npx vitest run tests/lib/xpts-engine.test.ts tests/components/gem-table/XPtsCell.test.tsx` | 10 passed, 8 skipped, 0 failed | PASS |
| Full test suite | `npx vitest run` | 264 passed, 16 skipped, 0 failed | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DATA-02 | 28-01-PLAN.md | System computes xPts per player per upcoming GW with component breakdown (goals, assists, CS, bonus) using Poisson/Bernoulli | SATISFIED | `_compute_xpts_fixture()`, `_xpts_ngw()` in `pipeline/merge.py`. All 7 fields emitted per player. |
| XPTS-01 | 28-01-PLAN.md, 28-02-PLAN.md | User can see per-player xPts with component breakdown (goal pts, assist pts, CS pts, bonus pts) in GemTable | SATISFIED | `XPtsCell` renders xPts value + breakdown tooltip (1GW window). `col.accessor('xPts_1gw/3gw/5gw')` in columns.tsx. Human approval received. |
| XPTS-02 | 28-01-PLAN.md, 28-02-PLAN.md | User can see an xPts variance indicator distinguishing high-ceiling vs consistent scorers | SATISFIED | `VarianceBadge` renders ⬆/= inline. `xPts_ceiling_*gw` boolean from top-tercile sigma classification. Human approval received. |

No orphaned requirements: REQUIREMENTS.md maps DATA-02, XPTS-01, XPTS-02 to Phase 28 — all three claimed and verified.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `pipeline/merge.py` | 216 | `bonus_pts = BONUS_RATE[element_type] * (xmins / 90.0)` — omits `start_prob` vs PLAN spec `* start_prob * (xmins / 90.0)` | INFO | Not a stub. This is CR-02 fix: `xmins` is defined as `start_prob * avg_mins_started` (verified in `pipeline/xmins.py` line 54), so applying `start_prob` again would double-scale. The implementation is mathematically correct. The double-count guard intent (no cs_prob term in bonus) is fully satisfied. |
| `tests/lib/xpts-engine.test.ts` | 70 | Double-count guard test computes `impliedRate = bonus_pts / (sp * (xmins / 90))`. With CR-02 formula, `impliedRate = BONUS_RATE / sp` (not BONUS_RATE), so this test would fail when un-skipped against pipeline cache. | WARNING | Test is `it.skip` — only relevant when pipeline cache present. The skip status is correct for CI. Needs to be updated if/when the cache integration tests are un-skipped: the formula check should be `bonus_pts / (xmins / 90)`. |

### Human Verification Required

The human verification was completed during the execution session. The user approved the Gems tab UI after Plan 02 Task 3 (checkpoint:human-verify).

**Status: APPROVED by user in this session.**

The following checks were performed and approved:

1. **xPts column headers** — columns display "xPts", "xPts (3)", "xPts (5)" (not "Proj Pts")
2. **GwToggle pill switching** — exactly one xPts column visible per pill state
3. **VarianceBadge rendering** — ⬆ violet and = zinc badges render inline after xPts values
4. **1GW cell tooltip** — breakdown tooltip surfaces goal/assist/CS/bonus components
5. **D-03 non-regression** — TransferPanel and PlannerTab still display proj_pts-based numbers

### Notes on CS Probability Implementation (Deviation from PLAN)

The PLAN specified using `attacking_difficulty` directly as the CS probability input. The implementation uses `defensive_difficulty` (also a Phase 27 field) via the extracted `_cs_prob(defensive_difficulty, xmins)` helper, with a fallback `1.0 - attacking_difficulty` when `defensive_difficulty` is absent. This CR-01 fix resolves a directionality issue: `defensive_difficulty` directly represents opponent attacking threat (0.0=weak attacker → high CS prob, 1.0=strong attacker → low CS prob), making the formula `0.40 - defensive_difficulty * 0.30` unambiguously correct. This is a refinement that improves model accuracy.

### Gaps Summary

No blocking gaps. All three roadmap success criteria are verified. All required artifacts exist and are substantive and wired. The full test suite is green (264 passed). TypeScript compiles clean.

Two items are recorded as WARNING/INFO but do not block goal achievement:

1. **INFO:** CR-02 bonus formula deviation from PLAN spec — mathematically correct (xmins already encodes start_prob); no cs_prob double-count.
2. **WARNING:** Double-count guard `it.skip` test uses a formula that would fail against pipeline cache under the CR-02 implementation. Test needs updating before un-skipping.

---

_Verified: 2026-04-28T10:30:00Z_
_Verifier: Claude (gsd-verifier)_
