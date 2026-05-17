# Phase 116: Prose Staleness & Model Versioning (v1.21) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 116-prose-staleness-model-versioning-v1-21
**Areas discussed:** Prose staleness display, Prose prompt enrichment, Versions tab structure, VER-01 backward compat

---

## Prose Staleness Display

| Option | Description | Selected |
|--------|-------------|----------|
| Inline amber text | Replace zinc footer colour with amber when stale; single line, no extra element | ✓ |
| Separate amber note below | Keep zinc timestamp, add second amber line "May not reflect recent news" | |
| Amber banner above prose | Amber pill/banner above the prose text when stale; more prominent | |

**User's choice:** Inline amber text

| Option | Description | Selected |
|--------|-------------|----------|
| 'Updated 3 hours ago' | Relative time only | |
| 'Updated 3 hours ago · GW38' | Relative time + GW label | ✓ |
| You decide | Leave wording to planner/executor | |

**User's choice:** "Updated 3 hours ago · GW38"
**Notes:** Footer format keeps GW context alongside the freshness signal. Same line, same position — just richer content.

---

## Prose Prompt Enrichment

| Option | Description | Selected |
|--------|-------------|----------|
| Active chip only | If chip active this GW, name it; if none, omit | ✓ (initially) |
| Active chip + recommendation | Active chip + chip timing recommendation engine output | |
| Skip — no chip data in prompt | Leave chip context out entirely | |

**Clarification follow-up** — pipeline is universal (no user-specific chip state):

| Option | Description | Selected |
|--------|-------------|----------|
| GW type flag (DGW/BGW) | If GW has DGW teams, include team names in prompt | ✓ |
| Generic chip window hint | Derived flag from captain_picks data | |
| Skip chip context entirely | Lifecycle risk flags sufficient; chip is user-specific | |

**User's choice:** GW type flag (DGW/BGW) — derive from `_detect_dgw_bgw()` in `gw_intel.py`

| Option | Description | Selected |
|--------|-------------|----------|
| Injury/doubt flags on captains + gems | Pass chance_of_playing_next_round + news per candidate | ✓ |
| Full lifecycle labels | Include DefCon/Hot/Steady labels per candidate | |
| Skip — no lifecycle data in prompt | Keep prompt focused on picks only | |

**User's choice:** Injury/doubt flags on captains + gems

| Option | Description | Selected |
|--------|-------------|----------|
| New keyword args | dgw_teams: list[str] \| None = None — backward compat | ✓ |
| Single context dict | context: dict \| None = None — bundles future additions | |

**User's choice:** New keyword args
**Notes:** Backwards-compatible. Existing tests still pass without change.

---

## Versions Tab Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Move it — remove from Calibration | VersionHistoryTable lives only in new Versions sub-tab | ✓ |
| Keep in both | VersionHistoryTable in both Calibration and new Versions tab | |

**User's choice:** Move it — remove from Calibration

| Option | Description | Selected |
|--------|-------------|----------|
| Labelled row — 'cold start' in Hit Rate cell | Amber label instead of HitRateBadge for sample_gws < 3 | ✓ |
| Greyed-out row with label | opacity-50 / zinc text + note | |
| Filter them out | Hide cold-start rows entirely | |

**User's choice:** Labelled row — amber 'cold start' in Hit Rate cell

| Option | Description | Selected |
|--------|-------------|----------|
| Show as column | Add 'Sample GWs' column showing integer count | ✓ |
| Use internally for label only | sample_gws drives label but not shown as column | |

**User's choice:** Show as column
**Notes:** Cold-start rows show '< 3 GWs' in amber in the Sample GWs cell alongside 'cold start' in the Hit Rate cell.

---

## VER-01 Backward Compat

| Option | Description | Selected |
|--------|-------------|----------|
| Treat missing as cold start (0) | sample_gws?: number; default to 0 when absent | ✓ |
| Treat missing as unknown (—) | Show '—' for old records; third display state | |

**User's choice:** Treat missing as cold start (0)

| Option | Description | Selected |
|--------|-------------|----------|
| len(gws_covered) at write time | sample_gws = len(target_gws_desc) when record is appended | ✓ |
| You decide | Leave derivation to researcher/planner | |

**User's choice:** `len(gws_covered)` at write time
**Notes:** Simple and correct — counts finished GWs that contributed to the hit_rate snapshot. `_empty_backtest()` gets `sample_gws: 0` by definition.

---

## Claude's Discretion

- Relative time formatting implementation (hours/minutes label construction) — standard approach
- XML attribute format for availability flags in `_build_user_prompt()` — e.g. `chance_of_playing_next_round="75"`
- DGW note exact wording in user prompt — e.g. "Note: Gameweek N is a double gameweek for: City, Arsenal."

## Deferred Ideas

None — discussion stayed within phase scope.
