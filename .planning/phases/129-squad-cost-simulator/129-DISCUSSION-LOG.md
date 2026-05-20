# Phase 129: Squad Cost Simulator - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 129-squad-cost-simulator
**Areas discussed:** inputs artifact path, Slider initialization, Infeasibility display, Amber track technique

---

## inputs artifact path

### Q1: How to obtain inputs in the ILP pre-computed squad path?

| Option | Description | Selected |
|--------|-------------|----------|
| Read archive+bootstrap in parallel | Route always fetches archive and bootstrap alongside pre_season_squad.json when ?include=inputs is set; computes inputs inline. Adds parallel reads in ILP fast path but keeps pipeline simple. | ✓ |
| Pipeline writes pre_season_inputs.json | Pipeline pre-computes and stores inputs as a separate blob. Zero extra latency in Resolution 1, but new artifact + new route read. | |
| inputs only in Resolution 2 (greedy) | Slider disabled when ILP squad is active. Clean but breaks slider whenever pipeline has run. | |

**User's choice:** Read archive+bootstrap in parallel (Recommended)

### Q2: ?include=inputs gate or always-include?

| Option | Description | Selected |
|--------|-------------|----------|
| ?include=inputs query param gate | Route checks query param; skips extra reads when absent. Existing callers unaffected. | ✓ |
| Always include inputs | Always reads archive+bootstrap; simpler route logic but every caller pays the extra reads. | |

**User's choice:** ?include=inputs query param gate (Recommended)

### Q3: scoreMap serialization format

| Option | Description | Selected |
|--------|-------------|----------|
| Record<string, number> object | {"123": 0.0452, ...} — Object.fromEntries() to serialize; Object.entries() to restore. Standard JSON idiom. | ✓ |
| Array of [id, score] entries | [[123, 0.0452], ...] — restores via new Map(entries). ID stays numeric. | |

**User's choice:** Record<string, number> object (Recommended)

---

## Slider initialization

### Q1: Default slider position

| Option | Description | Selected |
|--------|-------------|----------|
| Always £100m default | Simple and predictable. ROADMAP-specified default. | ✓ |
| Mirror squad.budgetUsed | Initialise at squad's actual spend. Grid and slider in sync from start but position changes each pipeline run. | |

**User's choice:** Always £100m default (Recommended)

### Q2: Formation grid on first load (before first drag)

| Option | Description | Selected |
|--------|-------------|----------|
| API squad (server result) | Grid shows data.squad (ILP or greedy from API). Switches to client greedy on first pointer release. Simple — no extra recompute on mount. | ✓ |
| Immediately compute greedy at £100m | Run buildPreSeasonSquad(£100m) client-side as soon as inputs load. Always reflects greedy algorithm. ILP squad never shown. | |

**User's choice:** API squad (ILP or greedy from server) (Recommended)

---

## Infeasibility display

### Q1: Formation grid when greedy returns null

| Option | Description | Selected |
|--------|-------------|----------|
| Keep last valid squad, message above | Grid stays showing previous commit's squad. "No squad possible at £Xm — try £Ym+" above it. User has a reference point. | ✓ |
| Clear grid, show only message | Grid empties entirely. Cleaner signal but removes context. | |

**User's choice:** Keep last valid squad, message above it (Recommended)

### Q2: Message when health is null

| Option | Description | Selected |
|--------|-------------|----------|
| Only when health is available | Full "try £Ym+" suggestion only when health.min_feasible_budget_greedy is non-null. Graceful fallback to bare message when health absent. | ✓ |
| Always show full message | Fall back to slider min (£80m) as suggestion when health is null. Simpler logic but suggestion may be wrong. | |

**User's choice:** Only when health is available (Recommended)

---

## Amber track technique

### Q1: Track coloring approach

| Option | Description | Selected |
|--------|-------------|----------|
| CSS linear-gradient on native range | Dynamic background: linear-gradient(...) as inline style. Works in modern browsers. No new UI primitive. | ✓ |
| Custom range slider component | Fully custom div-based slider. Full control, more code. | |

**User's choice:** CSS linear-gradient on native range (Recommended)

### Q2: Track when health is null

| Option | Description | Selected |
|--------|-------------|----------|
| Single-colour neutral track | Full track in zinc — no amber zone. Clean fallback. Slider still interactive. | ✓ |
| Hide slider entirely | Slider hidden until health data is available. | |

**User's choice:** Single-colour neutral track (Recommended)

---

## Claude's Discretion

- Exact CSS values for amber/zinc gradient colours
- webkit/moz slider track CSS for cross-browser support
- useDeferredValue wiring details (sliderValue vs committedBudget state split; keyboard 300ms debounce)
- Whether slider is extracted to a named subcomponent or kept inline
- Separate `usePreSeasonSquadWithInputs` hook or inline query param on existing hook

## Deferred Ideas

None — discussion stayed within phase scope.
