# Phase 126: Next Season Planner - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 126-next-season-planner
**Areas discussed:** Pre-season scoring, Squad builder interactivity, archive_season.py trigger

---

## Pre-season scoring

| Option | Description | Selected |
|--------|-------------|----------|
| Season archive stats | Score from season_archive_gw38.json (goals, assists, minutes%) — most meaningful signal | ✓ |
| FPL bootstrap only | ep_next or points_per_game / form — unreliable off-season | |
| User-adjustable weights | Sliders for attack/defense/price weighting — adds UI complexity | |

**User's choice:** Season archive stats

---

| Option | Description | Selected |
|--------|-------------|----------|
| Points-per-minute | total_points / total_minutes; exclude < 500 mins — rewards consistent starters | ✓ |
| Raw total points / price | Classic FPL value metric — favours cheapies with lucky hauls | |
| You decide | Leave formula to planner | |

**User's choice:** Points-per-minute (exclude players with < 500 total minutes)

---

| Option | Description | Selected |
|--------|-------------|----------|
| season_archive_gw38.json absent | Single signal — if archive Blob doesn't exist, show "Prices pending" | ✓ |
| IS_OFF_SEASON + no next-season events | Two-check approach — more precise but more complex | |
| You decide | Leave detection to planner | |

**User's choice:** season_archive_gw38.json absent from Blob triggers "Prices pending" state

---

## Squad builder interactivity

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only recommended 15 | Show computed optimal 15 — like OptimiserPanel but pre-season, no swapping | ✓ |
| Lock-and-rerun | Pin players, rebuild around them | |
| Full interactive swap | Full drag/swap editing like ManualPlanTab — highest complexity | |

**User's choice:** Read-only recommended 15

---

| Option | Description | Selected |
|--------|-------------|----------|
| Formation grid | GK / DEF / MID / FWD + bench — mirrors OptimiserPanel visual pattern | ✓ |
| Simple table | 15-row table grouped by position — easier to build, less visual | |

**User's choice:** Formation grid

---

| Option | Description | Selected |
|--------|-------------|----------|
| Name + cost + last-season pts | Name, team, £X.Xm, last-season total points; pts-per-min as tooltip | ✓ |
| Name + cost + pts-per-min score | Show raw computed score — more transparent but less intuitive | |
| You decide | Leave card content to planner | |

**User's choice:** Name + team + cost + last-season total points; pts-per-minute shown as tooltip

---

## archive_season.py trigger

| Option | Description | Selected |
|--------|-------------|----------|
| GW38 gate in run.py | Run when current_event == 38; idempotent if already written | ✓ |
| Always-run + Blob check | Skip if Blob exists — no gate, runs every pipeline day | |
| Standalone script | One-time manual run outside run.py — risky if forgotten | |

**User's choice:** GW38 gate in run.py (idempotent)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Per-player element-summary only | /element-summary/{id}/ for all 700+ players; captures history[] + summary_season | ✓ |
| Element-summary + bootstrap snapshot | Also snapshot full bootstrap — larger Blob write, longer pipeline | |
| You decide | Leave scope to planner | |

**User's choice:** Per-player element-summary only

---

| Option | Description | Selected |
|--------|-------------|----------|
| Non-fatal with partial write | asyncio concurrent (~10 at a time); ≥50% success → write; <50% → skip | ✓ |
| All-or-nothing | Abort on any failure — safe but fragile on network blips | |

**User's choice:** Non-fatal with partial write (≥ 50% threshold)

---

## Claude's Discretion

- Exact concurrent request count for archive_season.py (D-10 specifies ~10 as a starting point)
- HeatMapRow export strategy — extract to shared module or export from FixtureHeatMap.tsx
- FDR heatmap empty-state detection mechanism for "Fixtures not yet published"
- Loading/skeleton state design for the squad builder tab
- Exact formation layout defaults in the formation grid

## Deferred Ideas

None — discussion stayed within phase scope.
