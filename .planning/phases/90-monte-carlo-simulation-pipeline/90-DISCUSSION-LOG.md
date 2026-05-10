# Phase 90: Monte Carlo Simulation Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-10
**Phase:** 90-monte-carlo-simulation-pipeline
**Areas discussed:** Gate scope, Iteration budget, rank_trajectory semantics

---

## Gate Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Skip everything | Entire simulate.py skipped — all MC fields absent (blank_prob, haul_prob, p10_pts, p90_pts, plus new 5-GW fields). CaptainPicksPanel degrades gracefully since all fields are optional. One gate controls one module. | ✓ |
| Skip only 5-GW outputs | Keep Phase 61 1-GW simulation always-on; gate only suppresses new xPts_5gw_p10/p50/p90/rank_trajectory fields. More complex: two separate code paths in simulate.py. | |

**User's choice:** Skip everything (Recommended)
**Notes:** Clean single-module gate; all existing MC fields already optional so frontend degrades gracefully.

---

## Iteration Budget

| Option | Description | Selected |
|--------|-------------|----------|
| 1,000 (default) | MC_ITERATIONS=1000, env var allows override. Matches spec. Fast for CI and production; statistically stable. Phase 61's 10K was over-engineered for 1-GW window. | ✓ |
| 10,000 | Keep Phase 61's budget. More precise p10/p90 bands but ~5× slower for 5-GW pass. | |
| 1,000 dev / 10,000 prod | MC_ITERATIONS=1000 default; pipeline.yml sets MC_ITERATIONS=10000. Maximally precise in prod, fast in dev/CI. More moving parts. | |

**User's choice:** 1,000 (Recommended)
**Notes:** MC_SEED=42 for CI reproducibility also locked in.

---

## rank_trajectory Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Cumulative rank at each horizon | Element [i] = player's percentile rank within position for cumulative xPts over GWs 1..i+1. Shows fading/rising players across the horizon. | ✓ |
| Single-GW rank at each GW | Element [i] = rank for that specific GW only (non-cumulative). More noisy; DGW spikes visible. | |

**Position pool question:**

| Option | Description | Selected |
|--------|-------------|----------|
| Same position only | GK vs GKs, DEF vs DEFs, etc. Meaningful for transfer decisions. | ✓ |
| All players | All ~600 players ranked together. Simpler but less meaningful (GKs always rank low). | |

**User's choice:** Cumulative rank at each horizon, within same position
**Notes:** Standard FPL decision unit — you compare DEF vs DEFs when deciding transfers.

---

## Claude's Discretion

None — all areas had clear user selections.

## Deferred Ideas

None — discussion stayed within phase scope.
