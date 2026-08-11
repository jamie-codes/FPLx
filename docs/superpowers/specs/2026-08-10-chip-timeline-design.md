# Chip Timeline Bars — Per-Chip Recommended GW Windows — Design

**Date:** 2026-08-10
**Status:** Approved (design), pending implementation plan
**Part of:** the Matchday Fintech redesign (`handoff/HANDOFF.md` §3 card 4 — the chip advisor as
season-timeline bars). The final remaining redesign item.

## Problem

The Cockpit chip advisor (`ChipAdviceCard` + pipeline `build_chip_advice`) answers only "is THIS
gameweek the week to play a chip?" — one `signal`/`value`/`reason` per chip for `current_gw`. The
mockup (cockpit-2a card 4) shows a forward **season timeline**: each chip's recommended GW
window(s) drawn as bars (e.g. Bench Boost late-season DGW cluster, Free Hit on a spring blank).

The gap is forward-looking window data the pipeline never emits. It *can* be derived: merged
players carry up to 32 forward fixtures (`FIXTURE_LOOKAHEAD = 32`), each tagged with `event_id`,
and `_detect_dgw_bgw(merged, gw)` already works for any GW.

## The data-availability constraint (the crux)

DGWs/BGWs exist in the fixture data **only once the Premier League confirms rescheduled
fixtures** (postponements re-slotted mid-season). Early season the calendar is one-fixture-per-GW,
so DGW/BGW-driven chip windows literally are not in the data yet — they fill in as the season
progresses. The mockup's specific GW34-37 windows are illustrative of a late-season state, not
something derivable in August.

**Decision (approved): data-driven and honest.** Windows appear only where the confirmed fixture
calendar supports them. Early season shows few or no windows, with a caveat. No historical/heuristic
priors are seeded — a guessed window that looks authoritative is worse than an empty one.

### The beyond-horizon guard (mandatory correctness point)

`_detect_dgw_bgw` flags a team as **BGW when it has 0 fixtures** at a GW. Past the confirmed
fixture horizon, *every* team has 0 fixtures — which would fabricate a blank gameweek (false Free
Hit windows) across the entire late season. The scan therefore first computes the **maximum
scheduled `event_id`** actually present across all players' fixtures, and only scans
`current_gw … max_scheduled_gw`. GWs beyond that are "not yet scheduled" → no signal. This guard is
what makes the feature honest rather than misleading, and is the single highest-risk thing to get
right.

## Design

### 1. Pipeline (`pipeline/chip_advisor.py`)

Extend `build_chip_advice(merged, ledger, current_gw)` — keep its entire current single-GW output
unchanged; ADD forward windows.

- **Horizon:** `max_scheduled_gw = max(event_id across all players' fixtures, that is >= current_gw)`.
  If no fixtures at/after `current_gw` (pure off-season, no calendar), horizon is empty → all
  chips get `windows: []`. Emit `horizon_start = current_gw`, `horizon_end = max_scheduled_gw`
  (or `current_gw` when empty).
- **Per-GW scan:** for `gw in range(current_gw, max_scheduled_gw + 1)`, compute
  `dgw = _detect_dgw_bgw(merged, gw)` and count `dgw_teams` / `bgw_teams` at that GW.
- **Window scoring (fixture-shape — what is actually knowable ahead):**
  - **Bench Boost:** a GW qualifies when `dgw_team_count >= BB_WIN_DGW` (default 4).
    `strength = 'play'` when `>= BB_WIN_DGW_STRONG` (default 6), else `'consider'`.
  - **Triple Captain:** a GW qualifies on the same DGW basis (`dgw_team_count >= TC_WIN_DGW`,
    default 4) — a premium doubler is TC territory. Same play/consider split at
    `TC_WIN_DGW_STRONG` (default 6).
  - **Free Hit:** a GW qualifies when `bgw_team_count >= FH_WIN_BGW` (default 4, matches the
    existing `FH_BGW_TEAMS`) → `strength = 'play'`; OR a very large double
    `dgw_team_count >= FH_WIN_DGW` (default 8) → `strength = 'consider'`.
  - **Wildcard:** no windows (`windows: []`) — timing is fixture-swing driven, not a clean
    fixture-shape signal; stays informational (unchanged behaviour, approved).
- **Contiguity merge:** consecutive qualifying GWs collapse into one window
  `{start_gw, end_gw, strength, reason}`. A window's `strength` is the strongest of its GWs
  (`play` > `consider`). `reason` states the driver, e.g.
  `"3 DGW teams peak — GW34-35"` / `"5 teams blank GW29"`.
- **Thresholds** are module constants near the existing `BB_PLAY`/`FH_BGW_TEAMS`, tunable and named
  (`BB_WIN_DGW`, `BB_WIN_DGW_STRONG`, `TC_WIN_DGW`, `TC_WIN_DGW_STRONG`, `FH_WIN_BGW`, `FH_WIN_DGW`).

Output shape (additions only):

```python
'horizon_start': current_gw,
'horizon_end': max_scheduled_gw,          # == current_gw when no calendar
'chips': {
  'bench_boost':    { ...existing..., 'windows': [ {start_gw, end_gw, strength, reason}, ... ] },
  'triple_captain': { ...existing..., 'windows': [ ... ] },
  'free_hit':       { ...existing..., 'windows': [ ... ] },
  'wildcard':       { ...existing..., 'windows': [] },
},
```

### 2. Types (`src/lib/types.ts`)

All additive and optional so existing cached `chip_advice.json` still parses:

```ts
export interface ChipWindow {
  start_gw: number
  end_gw: number
  strength: 'play' | 'consider'
  reason: string
}
// added to ChipAdviceEntry:
windows?: ChipWindow[]
// added to ChipAdvice:
horizon_start?: number
horizon_end?: number
```

### 3. UI

**`ChipTimelineBar` (`src/components/cockpit/ChipTimelineBar.tsx`, new)**

Props: `{ windows: ChipWindow[]; horizonStart: number; horizonEnd: number }`.
- Renders a horizontal GW axis spanning `horizonStart…horizonEnd`. Each window is a filled segment
  positioned/sized by GW offset: `bg-accent` (theme-adaptive) for `play`, a muted fill
  (`bg-surface-2` + `text-ink-muted` border) for `consider`, with a small GW-range label
  (`GW{start}` or `GW{start}-{end}`) on/under the segment.
- **Empty state:** when `windows` is empty OR `horizonEnd <= horizonStart`, render the axis track
  with no segments plus a muted hint: `"no confirmed windows yet"`.
- Degrades gracefully if `horizonStart`/`horizonEnd` are undefined (old JSON) — treat as empty.

**`ChipAdviceCard` (`src/components/cockpit/ChipAdviceCard.tsx`, modify)**

- `ChipRow` gains the timeline bar for BB/TC/FH: one row = label + `value` + signal `Chip` +
  `ChipTimelineBar` + `reason`. Wildcard row unchanged (no bar; keeps its informational note).
- The card's footer note gains the honesty caveat:
  `"Windows are drawn from confirmed fixtures and fill in as DGWs/BGWs are scheduled."`
- Everything currently rendered (signal chip, value, reason, subtitle counts) stays — keep-all-features (UIX-01).

### 4. Testing

- **`pipeline/test_chip_advisor.py`** (extend): synthetic merged data with fixtures across several
  future GWs.
  - BB/TC windows appear on the DGW GWs; strength play vs consider at the thresholds.
  - FH window on a BGW GW; and on a very large DGW round (consider).
  - **Beyond-horizon guard:** teams with no fixtures past `max_scheduled_gw` do NOT create BGW/FH
    windows there — the scan stops at the max scheduled `event_id`. (Explicit test: a calendar that
    ends at GW35 must not emit any window at GW36-38.)
  - Contiguous qualifying GWs merge into one window (start_gw/end_gw span).
  - All-single-fixture calendar (early season) → every chip `windows: []`, `horizon_end == current_gw`
    only if the calendar is that GW; otherwise the scanned range with no qualifying windows.
  - Existing 8 tests stay green (single-GW signals unchanged).
- **`ChipTimelineBar.test.tsx`** (new): segments render at the right GW offsets; play vs consider
  styling; empty-state hint when no windows; graceful with undefined horizon.
- **`ChipAdviceCard` test** (extend if present): BB/TC/FH rows include a bar; Wildcard row has none;
  existing signal/reason assertions unchanged.
- `npx tsc --noEmit` = 0; `python -m pytest pipeline/test_chip_advisor.py` green.

## Files

- **Modify:** `pipeline/chip_advisor.py`, `pipeline/test_chip_advisor.py`, `src/lib/types.ts`,
  `src/components/cockpit/ChipAdviceCard.tsx`.
- **Create:** `src/components/cockpit/ChipTimelineBar.tsx` (+ test).

## Out of scope

- Historical/heuristic season priors for windows (explicitly rejected — honesty).
- A Wildcard fixture-swing window (approved: WC stays informational).
- Per-future-GW bench/captain *value* projection — windows are fixture-shape (DGW/BGW) driven, which
  is what the confirmed calendar actually supports; xPts-weighted window ranking is a later idea.
- Any change to the single-GW signal logic, the API route, or the `useChipAdvice` hook (the hook
  passes the JSON through; new optional fields flow without change).
