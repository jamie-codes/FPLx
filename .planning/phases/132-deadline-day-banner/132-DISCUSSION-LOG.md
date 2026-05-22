# Phase 132: Deadline Day Banner - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 132-deadline-day-banner
**Areas discussed:** Data source, Tick interval + format, Off-season behavior, Red sticky mechanics

---

## Data Source

| Option | Description | Selected |
|--------|-------------|----------|
| Direct bootstrap hook | useNextDeadline calls /api/fpl/bootstrap-static/ directly — same pattern as useSettledGws. No new route. TanStack Query caches with 1h staleTime. | ✓ |
| New /api/deadline route | Server extracts only {id, deadline_time} for the next event. Smaller payload, one more route to maintain. | |

**User's choice:** Direct bootstrap hook (Recommended)
**Notes:** Consistent with existing pattern — no additional server route needed.

---

## Tick Interval + Format

| Option | Description | Selected |
|--------|-------------|----------|
| 60s ticks, always "Xh Ym" | Simple. Reads "14h 22m" throughout. Matches LastUpdated.tsx precedent. | ✓ |
| 60s ticks, adaptive format | Same 60s tick, format switches to "45m" under 1h (cleaner, no leading "0h"). | |
| 1s ticks when <2h | Switch to 1-second ticks in amber/red states, showing seconds. More expensive. | |

**User's choice:** 60s ticks, always "Xh Ym"
**Notes:** Claude's discretion on whether to show "0h 45m" or just "45m" sub-hour.

---

## Off-Season Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Hide banner entirely | Render null when no is_next event. Banner only exists when actionable. | ✓ |
| Show neutral placeholder | Render zinc banner with "Season complete — next deadline TBD". More complex. | |

**User's choice:** Hide banner entirely (Recommended)
**Notes:** Current state (off-season) means the banner won't appear until FPL activates next season's GW schedule.

---

## Red Sticky Mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| Sticky + dismissible in all states | Red state adds position:sticky. Dismiss button always visible, including in red. | ✓ |
| Sticky red, no dismiss when red | position:sticky at <2h AND dismiss button hidden — forces urgent banner to stay. | |
| Just a color change, no sticky | All states in normal document flow. "Red sticky" is just the state name. | |

**User's choice:** Sticky + dismissible in all states (Recommended)
**Notes:** User retains control even in red state — if they've noted the deadline, they can dismiss it.

---

## Claude's Discretion

- Sub-hour format: `"0h 45m"` vs `"45m"` — either acceptable; pick the cleaner one
- Whether `useNextDeadline` lives in `src/lib/hooks/` or banner-specific module
- Exact z-index value for sticky red state
- Whether `DeadlineBanner` is a standalone file or colocated with its hook

## Deferred Ideas

None — discussion stayed within phase scope.
