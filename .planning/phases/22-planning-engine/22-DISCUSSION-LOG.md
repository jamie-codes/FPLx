# Phase 22: Planning Engine — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 22-planning-engine
**Areas discussed:** Algorithm depth, Per-GW scoring, Hit threshold, Squad data requirement

---

## Algorithm Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Pure greedy per-GW | Commit to best transfer at each step, no look-ahead | |
| Greedy with 1-level look-ahead | Score GW1 options by GW1 + discounted GW2 payoff | ✓ |

**User's choice:** Greedy with 1-level look-ahead
**Notes:** LP/MILP explicitly deferred as out of scope for personal use (PLAN-11). Look-ahead captures DGW setup moves without exponential cost.

---

## Per-GW Scoring

| Option | Description | Selected |
|--------|-------------|----------|
| proj_pts_1gw as proxy for all steps | Simple; ignores fixture variation | |
| Derive delta from aggregates | GW2 ≈ (3gw − 1gw)/2 | |
| fixtures × PPG per step | proj_pts_1gw × fixture_count_for_step | ✓ (Claude's discretion) |
| Extend pipeline | Add per-GW arrays to merged_players.json | |

**User's choice:** Delegated to Claude's discretion
**Notes:** User clarified these fields are forward projections not historical. Claude chose `proj_pts_1gw × fixture_count_for_step(gw)` — handles DGW (×2) and BGW (×0) correctly without pipeline changes.

---

## Hit Threshold

| Option | Description | Selected |
|--------|-------------|----------|
| Never suggest hits | Only free transfers; user adds hits in Phase 25 | |
| Gain-based threshold | Suggest hit when net gain > 0 after -4pt deduction | ✓ |
| DGW-weighted | Extra weighting for DGW targets | (folded into scoring via ×2 fixture multiplier) |

**User's choice:** Suggest paid hits when gain justifies
**Notes:** DGW weighting is implicit — the ×2 fixture multiplier already makes DGW targets score higher, naturally justifying hits for them.

---

## Squad Data Requirement

| Option | Description | Selected |
|--------|-------------|----------|
| Requires auth | Button disabled without login; exact prices | |
| Team ID only | Approximate prices, no bank balance | |
| Hybrid | Works with Team ID, upgrades when auth available | ✓ |

**User's choice:** Hybrid
**Notes:** Engine is a pure function — PlannerTab passes whichever data is available. No auth gate on the Generate Plan button.

---

## Logo Change (out of scope for planning engine — immediate fix)

User requested replacing `logo.png` with the "Honk" Google Font rendering "FPLx" in large text.

**Implemented immediately:**
- Added `Honk` font via `next/font/google` in `layout.tsx`
- Replaced `<Image src="/logo.png">` in `page.tsx` with `<span className="font-[family-name:var(--font-honk)] text-5xl">FPLx</span>`
- Dark mode aware (zinc-900 / white)
