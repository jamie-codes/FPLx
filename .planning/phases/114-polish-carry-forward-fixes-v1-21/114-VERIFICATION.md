---
phase: 114-polish-carry-forward-fixes-v1-21
verified: 2026-05-16T00:00:00Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
re_verification: null
gaps: []
deferred: []
human_verification: []
---

# Phase 114: Polish & Carry-Forward Fixes Verification Report

**Phase Goal:** Users see a corrected and enriched GemTable surface — the Transfer Route Tree "Hits" label shows the right number, a disabled ChipToggle stub is visible in RouteTreeTab, the Transfer Regret Backtester passes human UAT on all four visual dimensions, and GemTable gains a rank trajectory sparkline column so managers can see trend direction at a glance

**Verified:** 2026-05-16T00:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | RouteTreeTab Hits column shows `path.totalHits ?? 0`, not `path.totalTransfers` | VERIFIED | `RouteTreeTab.tsx:308` — `{path.totalHits ?? 0}`; grep for `totalTransfers` in that file returns 0 |
| 2 | ChipToggle accepts `disabled?: boolean` and dims wrapper to `opacity-50 pointer-events-none` when true | VERIFIED | `ChipToggle.tsx:12` — `disabled?: boolean`; line 17 — `className={disabled ? 'pointer-events-none opacity-50' : undefined}` |
| 3 | ChipToggle adds `aria-disabled={disabled}` to the `role="group"` div | VERIFIED | `ChipToggle.tsx:21` — `aria-disabled={disabled}` on the `role="group"` div |
| 4 | RouteTreeTab renders a disabled ChipToggle above the route summary table in the squad-loaded branch only | VERIFIED | `RouteTreeTab.tsx:233-240` — `<ChipToggle gw={startingGw ?? 1} activeChip={null} onToggle={() => {}} disabled={true} />` inside `<div>` after `</header>` in squad-loaded branch only; not in loading or no-squad branches |
| 5 | No chip toggling occurs — interaction is intentionally suppressed | VERIFIED | `onToggle={() => {}}` noop at line 237; pointer-events-none wrapper prevents reaching buttons; confirmed by plan D-06 |
| 6 | GemTable shows a Trend column after `xPts_5gw` with inline SVG polyline for players with `rank_trajectory` data | VERIFIED | `columns.tsx:337-352` — `col.accessor('rank_trajectory', ...)` with SVG at lines 347-349; positioned after `xPts_5gw` (line 322) and before `regression_signal` (line 353) |
| 7 | Sparkline stroke is green / red / zinc-400 based on trend with ±0.05 threshold; absent data shows em-dash | VERIFIED | `columns.tsx:343-344` — `trend < -0.05 ? 'var(--color-positive)' : trend > 0.05 ? 'var(--color-negative)' : '#a1a1aa'`; line 342 — `!trajectory \|\| trajectory.length < 2` returns `<span className="text-zinc-400">—</span>` |
| 8 | `rank_trajectory` column is hidden on mobile and in compact preset; not hidden in default or analysis | VERIFIED | `GwToggle.tsx:25` — `rank_trajectory: false` in MOBILE_HIDDEN_COLUMNS; line 49 — `rank_trajectory: false` in compact preset; absent from default and analysis objects (absence = visible per `getColumnVisibility` logic at lines 85-89) |
| 9 | `rank_trajectory` column is not sortable (`enableSorting: false`) | VERIFIED | `columns.tsx:339` — `enableSorting: false` |
| 10 | Transfer Regret Backtester passes UAT on all four visual dimensions | VERIFIED | Human checkpoint (plan 114-03) approved by user; commit `66d5f41` records sign-off; code evidence: `BackTab.tsx:55-60` — `transferRegretFill` delta>0=REGRET_RED, delta<0=REGRET_GREEN; lines 103,108 — `join(' + ')` for multi-transfer; sections structurally distinct |

**Score:** 10/10 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/planner/ChipToggle.tsx` | disabled prop + opacity-50 wrapper | VERIFIED | Contains `disabled?: boolean`, outer wrapper div, `aria-disabled={disabled}`; commits 8c0b159 |
| `src/components/planner/RouteTreeTab.tsx` | ChipToggle import + disabled stub render + totalHits cell | VERIFIED | Line 17: `import { ChipToggle }`, line 234: disabled render, line 308: `path.totalHits ?? 0`; commit 45635a6 |
| `src/components/gem-table/columns.tsx` | rank_trajectory column with inline SVG | VERIFIED | Lines 337-352; no Recharts import added (grep returns 0); commit 4a880da |
| `src/components/gem-table/GwToggle.tsx` | rank_trajectory in MOBILE_HIDDEN_COLUMNS + compact preset | VERIFIED | Lines 25 and 49; not in default or analysis; commit 05ecea3 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `RouteTreeTab.tsx` | `ChipToggle.tsx` | `import { ChipToggle }` + `disabled={true}` render | WIRED | Line 17 import; line 238 `disabled={true}` |
| `RouteTreeTab.tsx:308` | `RoutePath.totalHits` | direct JSX `{path.totalHits ?? 0}` | WIRED | Confirmed; `totalTransfers` absent from cell |
| `columns.tsx rank_trajectory column` | `ScoredPlayer.rank_trajectory` | `col.accessor('rank_trajectory', ...)` | WIRED | Line 337 accessor key matches `rank_trajectory?: number[]` in types.ts |
| `GwToggle.tsx MOBILE_HIDDEN_COLUMNS` | `rank_trajectory column` | `rank_trajectory: false` entry | WIRED | Line 25 |
| `BackTab.tsx:57` | `transferRegretFill` delta logic | `delta > 0 → REGRET_RED` | WIRED | Confirmed; D-09 intentionally correct |
| `BackTab.tsx:103,108` | multi-transfer join rendering | `e.engineSell.join(' + ')` / `e.userSell.join(' + ')` | WIRED | Lines 103 and 108 confirmed |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `columns.tsx` rank_trajectory cell | `trajectory = info.getValue()` | `ScoredPlayer.rank_trajectory` from pipeline/simulate.py (mc_enabled=true) | Yes — live field on MergedPlayer; em-dash guard for absent data | FLOWING |
| `RouteTreeTab.tsx` Hits cell | `path.totalHits` | `RoutePath.totalHits` from `buildTransferRouteTree` engine | Yes — field is `0` per D-01 (no hits allowed); displays accurately | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| No Recharts import in columns.tsx | `grep -c recharts src/components/gem-table/columns.tsx` | 0 | PASS |
| `totalTransfers` absent from Hits cell | `grep -c totalTransfers src/components/planner/RouteTreeTab.tsx` | 0 | PASS |
| `rank_trajectory` in MOBILE_HIDDEN_COLUMNS | `grep "rank_trajectory" GwToggle.tsx` | 2 matches (line 25 + line 49) | PASS |
| ChipToggle disabled prop defined | `grep "disabled" ChipToggle.tsx` | prop declaration, wrapper className, aria-disabled | PASS |
| All 4 commits present | `git log --oneline` | 8c0b159, 45635a6, 4a880da, 05ecea3 | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TRT-01 | 114-01-PLAN.md | RouteTreeTab "Hits" column displays `totalHits`, not `totalTransfers` | SATISFIED | `RouteTreeTab.tsx:308` `{path.totalHits ?? 0}` |
| TRT-02 | 114-01-PLAN.md | ChipToggle visible as disabled stub in RouteTreeTab | SATISFIED | ChipToggle.tsx `disabled?: boolean`; RouteTreeTab.tsx render at line 234 |
| SPARK-01 | 114-02-PLAN.md | GemTable `rank_trajectory` sparkline column using inline SVG | SATISFIED | `columns.tsx:337-352`; GwToggle.tsx mobile/compact hiding |
| UAT-01 | 114-03-PLAN.md | Transfer Regret Backtester visual verification — all four dimensions | SATISFIED | Human checkpoint passed; commit 66d5f41; BackTab.tsx code evidence |

All 4 phase-114 requirements satisfied. No orphaned requirements.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `RouteTreeTab.tsx` | 90 | `const chipMode: PlannerChip = null` — stable constant in useMemo dep array | Info (WR-04 from REVIEW) | Misleading dep array; ChipToggle interaction stub is intentional per D-06 |
| `columns.tsx` | 345 | `2 + i * 9` x-coord formula hardcoded for 5 elements only | Warning (WR-02 from REVIEW) | Clips SVG if pipeline emits >5-element array; guarded by `length < 2` but not upper-bounded |

**Stub classification note:** The `const chipMode: PlannerChip = null` is intentional per architecture decision D-06 (chip wiring deferred). This is documented in 114-01-SUMMARY.md "Known Stubs" section. It does not prevent the phase goal — the goal requires a *disabled stub to be visible*, not functional chip selection.

**WR-02 note:** The sparkline coordinate overflow for arrays longer than 5 is a future robustness concern. `rank_trajectory` is defined as `number[]` but in practice always 5 elements (Phase 90 MC-01 contract). The `trajectory.length < 2` guard at line 342 catches empty/single-point arrays but not overflow. Not a blocker for the current phase goal.

---

### Human Verification Required

None. The UAT-01 checkpoint was completed within the phase itself (plan 114-03) and the user explicitly approved all four visual dimensions. The approval is recorded in commit `66d5f41` ("UAT-01 human visual checkpoint approved — all four dimensions pass").

---

### ROADMAP Success Criteria Cross-Check

| SC | Criterion | Status | Notes |
|----|-----------|--------|-------|
| 1 | Transfer Regret Backtester: correct colour polarity, multi-transfer format, no captain regression — all four UAT-01 checkpoints pass | VERIFIED | Human approved; code evidence confirms implementation. Note: ROADMAP SC-1 text states "positive delta = green, negative = red" but the implementation (and D-09 intent) is delta>0=RED (engine better=regret=red). The ROADMAP wording is a description error; the implementation is correct and was approved by UAT. |
| 2 | RouteTreeTab Hits column shows correct totalHits (not totalTransfers) | VERIFIED | `RouteTreeTab.tsx:308` |
| 3 | RouteTreeTab ChipToggle visibly present but disabled | VERIFIED | Lines 234-239 |
| 4 | GemTable rank_trajectory sparkline mini-column visible | VERIFIED | `columns.tsx:337-352` |

**All 4 success criteria satisfied.**

---

### Gaps Summary

No gaps. All 10 observable truths verified across all four requirements. All artifacts exist, are substantive, and are wired. Data flows from live sources. The human UAT checkpoint was completed within the phase. The two REVIEW.md warnings (WR-02 sparkline coordinate overflow risk, WR-04 misleading dep array) are not blockers — they are forward robustness concerns that do not prevent the phase goal from being achieved.

---

_Verified: 2026-05-16T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
