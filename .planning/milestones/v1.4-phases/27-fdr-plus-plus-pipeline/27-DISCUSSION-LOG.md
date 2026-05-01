# Phase 27: FDR++ Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 27-FDR++ Pipeline
**Areas discussed:** FDR++ methodology, Fixture ease ranking UI, Position toggle design

---

## FDR++ Methodology

### Goals-scored data source

| Option | Description | Selected |
|--------|-------------|----------|
| Plain goals from FPL fixtures | Rolling avg from fpl_fixtures.json — consistent with existing goals-conceded approach | ✓ |
| Understat xG (xGF/xGA per team) | More accurate but requires new team-level API fetch; Understat data in pipeline is currently per-player | |

**User's choice:** Plain goals from FPL fixtures

---

### Rolling window for goals-scored

| Option | Description | Selected |
|--------|-------------|----------|
| Same 6-game window | Consistent with existing goals-conceded window | |
| Different window for goals-scored | More reactive to recent attacking form | ✓ |

**User's choice:** Different (shorter) window

---

### Window size for goals-scored

| Option | Description | Selected |
|--------|-------------|----------|
| 3 games | Reactive — captures hot-streak teams quickly | ✓ |
| 4 games | Middle ground | |
| 5 games | Closer to 6-game defensive window | |

**User's choice:** 3 games

---

### Normalization approach

| Option | Description | Selected |
|--------|-------------|----------|
| Independent normalization | Each metric (attacking/defensive) normalized 0–1 on its own scale | ✓ |
| Shared normalization | Both share a single min/max | |

**User's choice:** Independent normalization

---

## Fixture Ease Ranking UI

### Panel placement on Form tab

| Option | Description | Selected |
|--------|-------------|----------|
| New panel above existing form table | Separate prospective/retrospective views | ✓ |
| Extend existing ClubFormTable | Add Ease column + GW toggle to existing table | |
| Replace form table with unified view | New table ranking by ease, form stats alongside | |

**User's choice:** New panel above existing form table

---

### Row content in ease ranking

| Option | Description | Selected |
|--------|-------------|----------|
| Rank + team + colored ease bar | Progress bar (green=easy, red=hard) | ✓ |
| Rank + team + individual fixture badges | Reuse FixtureBadges component, more detail | |
| Rank + team + both ease bar and badges | Most information-dense | |

**User's choice:** Rank + team + colored ease bar

---

### GW toggle style

| Option | Description | Selected |
|--------|-------------|----------|
| Same pill-toggle style as Gem Ratings | Reuses existing pattern — consistent UX | ✓ |
| Inline buttons styled differently | New button pattern | |

**User's choice:** Same pill-toggle style as Gem Ratings

---

## Position Toggle Design

### Position context selection

| Option | Description | Selected |
|--------|-------------|----------|
| ATT/DEF toggle pill alongside GW toggle | Explicit user choice, default ATT | ✓ |
| Both ATT and DEF as separate columns | No toggle needed, more info at once | |
| ATT-only (no toggle) | Simpler, but wrong for DEF buyers | |

**User's choice:** ATT/DEF toggle pill, default ATT

---

### Toggle scope

| Option | Description | Selected |
|--------|-------------|----------|
| Scoped to fixture ease panel only | ClubFormTable below unaffected | ✓ |
| Global ATT/DEF context for whole Form tab | Also changes FixtureBadges coloring in ClubFormTable | |

**User's choice:** Scoped to fixture ease panel only

---

### Data source for ease ranking

| Option | Description | Selected |
|--------|-------------|----------|
| Extend /api/club-form | computeClubForm() already reads fixtures/bootstrap; natural extension | ✓ |
| New /api/fixture-ease route | Separate route, cleaner but duplicates fetch logic | |

**User's choice:** Extend /api/club-form

---

## Claude's Discretion

- BGW handling: exclude missing fixtures from the average (do not penalize)
- Tier thresholds: use same percentile-based approach (bottom/top third) as existing `difficulty_tier`
- Ease bar color: reuse `DifficultyTier` color palette from `FixtureBadges` (green/amber/red)
- Constant naming: `OFFENSIVE_ROLLING = 3` for the new goals-scored window

## Deferred Ideas

None raised during discussion.
