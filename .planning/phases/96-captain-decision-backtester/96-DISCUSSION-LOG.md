# Phase 96: Captain Decision Backtester - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-11
**Phase:** 96-captain-decision-backtester
**Areas discussed:** AccuracyTab nav structure, BackTab visualization, Captain snapshot content, Pre-deployment GW handling

---

## AccuracyTab Nav Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Full tab nav | "Summary \| Calibration \| Back" pill nav — restructures AccuracyTab into three distinct tabs | ✓ |
| Append to scroll | Just add BackTab at bottom of existing flat page — no restructuring | |

**User's choice:** Full tab nav

| Option | Description | Selected |
|--------|-------------|----------|
| Summary (default) | Preserves existing landing experience | ✓ |
| Back | Opens straight to captain history | |
| Calibration | Unlikely as default | |

**User's choice:** Summary as default active tab

| Option | Description | Selected |
|--------|-------------|----------|
| Reset to Summary | Component-local useState, resets on re-mount | ✓ |
| Persist session only | Lifted to page.tsx | |
| Persist across sessions | localStorage | |

**User's choice:** Reset to Summary on re-mount

**Notes:** Consistent with Phase 95 set-piece toggle and v1.5 GemTable preset behaviour.

---

## BackTab Visualization

| Option | Description | Selected |
|--------|-------------|----------|
| Chart + table rows | Recharts bar chart (regret per GW) + per-GW detail rows | ✓ |
| Table rows only | Color-coded rows only, no chart | |

**User's choice:** Chart + table rows

| Option | Description | Selected |
|--------|-------------|----------|
| Signed score + color | Positive (red) = model better; negative (green) = user won. Bar chart above/below zero | ✓ |
| Absolute regret only | Only show positive regret, GWs where user beat model show 0 | |
| Two separate totals | Summary row at top with aggregate totals | |

**User's choice:** Signed score with color

| Option | Description | Selected |
|--------|-------------|----------|
| Season total + win/loss record | Total regret + "Model better: N \| You won: N \| Tied: N" | ✓ |
| No summary header | Let the chart speak for itself | |
| You decide | Builder picks | |

**User's choice:** Season total regret + win/loss record

**Notes:** Formula: `regret = ceiling_pts × 2 − user_capt_pts × 2`. Captain points framing throughout.

---

## Captain Snapshot Content

| Option | Description | Selected |
|--------|-------------|----------|
| Ceiling pick | Highest xPts_90th_1gw — model's most bullish recommendation | ✓ |
| EO-adjusted pick | Differential captaincy angle (ownership < 25%) | |
| Plain xPts_1gw top pick | Conservative median rather than 90th-percentile | |

**User's choice:** Ceiling pick as the "model recommendation"

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse captain_picks.json payload | ceiling + eo_adjusted, same schema — one-liner side-write | ✓ |
| Add top-3 array | Keep existing fields + new top3 array — more pipeline work | |

**User's choice:** Reuse existing payload verbatim

**Notes:** Side-write is `upload_json(f'captain_picks_gw{current_gw}.json', captain_picks)` — zero new pipeline schema.

---

## Pre-Deployment GW Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Show with placeholder | User's actual captain visible; model column shows "No snapshot" | ✓ |
| Skip pre-deployment GWs | Only render GWs where snapshot exists | |
| Empty state until first snapshot | Single "no data yet" message | |

**User's choice:** Show with "No snapshot" placeholder per row

| Option | Description | Selected |
|--------|-------------|----------|
| Empty state message | "No captain history yet — data accumulates each GW after deployment. Log in to see your captain picks." | ✓ |
| Loading skeleton | Skeleton rows then resolve to empty | |
| You decide | Builder picks | |

**User's choice:** Empty state message on first visit (zero snapshots + no session cookie)

**Notes:** Per-row placeholder keeps the timeline complete for past GWs. Empty state message only applies when there are truly zero snapshots at all.

---

## Claude's Discretion

- Exact Tailwind styling for the "Summary | Calibration | Back" pill nav
- Recharts bar chart type (BarChart vs ComposedChart) and axis formatting for zero-baseline chart
- Column widths and layout of per-GW detail rows
- Whether the localStorage ring buffer logic lives in the hook or a separate utility
- `/api/decision-history` response shape details

## Deferred Ideas

None — discussion stayed within phase scope.
