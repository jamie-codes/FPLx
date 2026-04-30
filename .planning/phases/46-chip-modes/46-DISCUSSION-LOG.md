# Phase 46: Chip Modes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 46-chip-modes
**Mode:** --auto (user requested autonomous operation until 7am)
**Areas discussed:** chip-toggle-placement, wildcard-fh-engine, budget-source, bench-boost-view, chip-squad-display

---

## Chip Toggle Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Pill row below horizon selector | 4-button pill (None / WC / FH / BB), same pattern as FtToggle | ✓ |
| Integrated with FT toggle | Combine into single control row | |
| Separate chip panel section | Expand/collapse chip section at bottom | |

**Auto-selected:** Pill row below horizon selector (recommended default — consistent with FtToggle/GwToggle pill patterns already in OptimiserPanel)
**Notes:** FT toggle hidden when WC/FH active (irrelevant for scratch-squad modes). FT toggle visible for BB mode.

---

## Wildcard / Free Hit Engine

| Option | Description | Selected |
|--------|-------------|----------|
| New chip-modes.ts pure engine | buildOptimalSquad() in src/lib/chip-modes.ts, greedy algorithm | ✓ |
| Extend optimise-lineup.ts | Add chipMode param to optimiseLineup() | |
| Reuse computeFHResult() directly | Import from chip-strategy-engine.ts | |

**Auto-selected:** New pure engine in chip-modes.ts (recommended — keeps engines single-purpose; chip-strategy-engine.ts is for "when to use chips", chip-modes.ts is for "what squad to build when using chips")
**Notes:** computeFHResult() greedy algorithm is the structural reference but not imported directly (D-07 — avoid cross-engine coupling).

---

## Budget Source for WC / FH

| Option | Description | Selected |
|--------|-------------|----------|
| Sell prices + bank (auth) / £100m (unauth) | Matches Phase 45 D-09 and computeFHResult() pattern | ✓ |
| Always £100m flat | Simpler, no auth dependency | |
| User-editable budget field | Flexible but adds UI complexity | |

**Auto-selected:** Sell prices + bank when authenticated, £100m when not (recommended — matches established budget pattern from Phase 45 and chip-strategy-engine.ts)

---

## Bench Boost View

| Option | Description | Selected |
|--------|-------------|----------|
| Enhanced comparison table | Same table, new headline row with bench xPts, bench at full opacity | ✓ |
| Dedicated bench-only component | New component showing only bench slots + totals | |
| Overlay / highlight mode | Comparison table unchanged, BB banner above | |

**Auto-selected:** Enhanced comparison table (recommended — minimal scope, reuses existing table; BB view requirement satisfied by bench xPts headline and full-opacity bench section)

---

## Chip Squad Display (WC / FH)

| Option | Description | Selected |
|--------|-------------|----------|
| ChipSquadView component | New position-grouped 15-player view, best XI highlighted | ✓ |
| Reuse comparison table | Show scratch squad vs current squad side-by-side | |
| Simple list | Flat list of 15 players sorted by xPts | |

**Auto-selected:** New ChipSquadView component (recommended — comparison with current squad is not meaningful for WC/FH since the scratch squad differs entirely; a dedicated squad view is clearer)

---

## Claude's Discretion

- Exact Tailwind classes for ChipModeToggle — follow FtToggle.tsx pattern
- Tie-break in buildOptimalSquad — lower now_cost wins when xPts equal
- Loading/error states when buildOptimalSquad returns null — amber banner
- Whether FH horizon selector is disabled vs hidden — disabled (greyed out) with tooltip

## Deferred Ideas

- Formation preference picker for WC/FH (deferred to v1.7)
- Player locking in WC/FH squad builder (deferred to v1.7)
- Multi-chip side-by-side comparison (out of scope for Phase 46)
