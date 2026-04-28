# Phase 28: xPts Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 28-xPts Engine
**Areas discussed:** proj_pts / xPts relationship, GW windows, variance indicator style

---

## proj_pts / xPts Relationship

First, user asked for clarification on the difference between proj_pts and xPts. Claude explained:
- `proj_pts`: heuristic `ppg × start_prob × difficulty_modifier` — single number, no component breakdown, no uncertainty
- `xPts`: Poisson(xG/xA) + Bernoulli(CS) — component breakdown is a natural output; variance falls out of the distributions

| Option | Description | Selected |
|--------|-------------|----------|
| Full replace everywhere | xPts replaces proj_pts in all consumers (GemTable, TransferPanel, planner, captaincy engine) | |
| GemTable only, proj_pts stays | xPts surfaces in GemTable only; proj_pts unchanged for all logic consumers | ✓ |
| You decide | Claude picks | |

**User's choice:** GemTable only, proj_pts stays

| Option | Description | Selected |
|--------|-------------|----------|
| Replace in GemTable | GemTable "Proj Pts" columns renamed to "xPts", backed by new model | ✓ |
| Add alongside | Both Proj Pts and xPts visible in GemTable for comparison | |

**User's choice:** Replace in GemTable (rename columns, not add new ones)

**Notes:** Pipeline emits both fields. TransferPanel, PlannerTab, captaincy engine, and replacement shortlist continue using `proj_pts_*` unchanged. Full migration deferred to Phase 30/31 scope.

---

## GW Windows

| Option | Description | Selected |
|--------|-------------|----------|
| Same 1/3/5 GW toggle | Pipeline emits xPts_1gw/3gw/5gw; GemTable uses existing GwToggle.tsx | ✓ |
| Next GW only | Single xPts_1gw field; toggle removed | |

**User's choice:** Same 1/3/5 GW toggle

| Option | Description | Selected |
|--------|-------------|----------|
| Same shared toggle | xPts hooks into the existing GwToggle state (recommended) | ✓ |
| You decide | Claude picks | |

**User's choice:** Same shared toggle — no new toggle state needed

**Notes:** DGW/BGW handling follows `_proj_pts_ngw()` grouping logic (group by event_id, no neutral fill for BGW gaps).

---

## Variance Indicator (XPTS-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Icon badge on xPts cell | ⬆/= icon inline with xPts number; tooltip explains on hover | ✓ |
| Separate variance column | Dedicated σ or "Ceiling/Consistent" column | |
| You decide | Claude picks | |

**User's choice:** Icon badge on xPts cell — ⬆ for high-ceiling, = for consistent. Tooltip on hover.

**Notes:** No separate column (avoids adding table width). Variance threshold for ⬆ vs = is Claude's discretion.

---

## Claude's Discretion

- **Component breakdown display**: User did not select this area. Claude decides — recommend tooltip on xPts cell showing goal pts / assist pts / CS pts / bonus pts, consistent with the variance tooltip approach.
- **xPts model scoring rates**: Poisson rate = `xg_per90`/`xa_per90` (Understat); fall back to `goals_scored`/`assists` normalised per-90 for players with `understat_id = null` (DQ-01 proxy pattern).
- **CS probability parameterisation**: Derived from opponent's `attacking_difficulty` (Phase 27 FixtureEntry field). Bernoulli parameterisation is Claude's choice.
- **Bonus component**: Claude decides (historical bonus expectation or position-based estimate). Must not double-count with CS (see STATE.md blocker on correlated CS/DefCon bonus).
- **Variance threshold**: Top tercile of per-GW σ across all players = "high-ceiling".

## Deferred Ideas

None — discussion stayed within phase scope.
