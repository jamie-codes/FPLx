# Phase 112: Optimiser On-Demand & Transfer Suggestion Cap (v1.20) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 112-optimiser-on-demand-transfer-suggestion-cap-v1-20
**Areas discussed:** Controls pre-click, Re-trigger policy, Transfer cap scope, Truncation indicator

---

## Controls pre-click

| Option | Description | Selected |
|--------|-------------|----------|
| Show all controls (Recommended) | Horizon selector, FT toggle, chip mode visible and interactive before click — one intentional run with the right settings | ✓ |
| Hide until after click | Clean minimal CTA; controls only appear once results are shown | |

**User's choice:** Show all controls
**Notes:** Matches the "deliberate planning" goal of v1.20 — user configures first, then triggers.

### Empty state design

| Option | Description | Selected |
|--------|-------------|----------|
| Results area placeholder (Recommended) | Controls at top as now; bordered card below with "Optimise Lineup" button + teaser line | ✓ |
| Button above controls | Prominent CTA at very top, controls beneath | |
| You decide | Claude picks a clean empty state | |

**User's choice:** Results area placeholder
**Notes:** Bordered card with centred CTA and short teaser sits below the existing controls.

---

## Re-trigger policy

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-recompute (Recommended) | Control changes update results immediately after first click | ✓ |
| Reset to button state | Any control change clears results, user must re-click | |
| Stale-result indicator | Results stay visible but dimmed; "Re-optimise" prompt shown | |

**User's choice:** Auto-recompute
**Notes:** Button gate applies only to the initial computation on tab load; subsequent control changes behave identically to today.

---

## Transfer cap scope

### Which sub-tabs

| Option | Description | Selected |
|--------|-------------|----------|
| Both sub-tabs (Recommended) | Cap at source so both Transfers and Optimiser get consistent behaviour | ✓ |
| Transfers sub-tab only | Strictly follows success criteria; Optimiser keeps full list | |

**User's choice:** Both sub-tabs

### Where the cap is applied

| Option | Description | Selected |
|--------|-------------|----------|
| Post-filter in each useMemo (Recommended) | capByPosition() utility called after suggestTransfers — no engine change | ✓ |
| Inside suggestTransfers engine | Cap baked into engine output; affects all callers | |

**User's choice:** Post-filter in each useMemo
**Notes:** Preserves engine purity; planner/route-tree/OCS call sites unaffected.

---

## Truncation indicator

| Option | Description | Selected |
|--------|-------------|----------|
| Silent truncation | Show top 3, no messaging | |
| Subtle footnote | "Showing top 3 of N [position] suggestions" below truncated groups | ✓ |
| You decide | Claude picks whatever fits | |

**User's choice:** Subtle footnote
**Notes:** Footnote only renders when N > 3; no noise when list is already short.

---

## Position slot clarification

| Option | Description | Selected |
|--------|-------------|----------|
| element_type — 4 buckets (Recommended) | GK/DEF/MID/FWD, cap of 3 per bucket | ✓ |
| Squad slot — 15 slots | Per-slot cap (finer-grained but rarely useful) | |

**User's choice:** element_type — 4 buckets
**Notes:** Confirms the ROADMAP default. capByPosition groups by sug.buy.element_type for single transfers.

---

## Claude's Discretion

- Button copy and teaser line wording ("Optimise Lineup" / teaser text) — tune for tone consistency
- Exact footnote copy and placement within suggestion rows

## Deferred Ideas

None — discussion stayed within phase scope.
