# Phase 127: Squad Health Diagnostics & Transfer Watchlist - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 127-Squad Health Diagnostics & Transfer Watchlist
**Areas discussed:** Health sweep strategy, API response shape, Watchlist card & data, Star placement in GemTable

---

## Health Sweep Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Full sweep £80m–£120m | 81 calls, exact null rate across realistic range, matches Phase 129 slider range | ✓ |
| Binary search only | ~7 calls, finds min_feasible_budget but no null rate percentage | |
| Targeted sweep £85m–£105m | 41 calls, narrower range, may miss edge cases | |

**User's choice:** Full sweep £80m–£120m (recommended)
**Notes:** Matches Phase 129's slider range exactly, so health data is directly useful for amber-track rendering.

| Option | Description | Selected |
|--------|-------------|----------|
| Skip greedy_optimality_gap_avg | Set to null in Phase 127, schema field present for stability | ✓ |
| Compute with ILP comparison | ~5 ILP calls at sampled budget points | |
| Compute analytically | Estimate from score difference — cheap but approximate | |

**User's choice:** Skip for now (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Read fpl_bootstrap.json | Same source as suggest_squad.py, consistent pipeline patterns | ✓ |
| Accept player list as argument | Depends on merge step completing first | |
| Reuse season_archive_gw38.json | Works standalone but redundant when ILP has run | |

**User's choice:** Read fpl_bootstrap.json (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Always runs | Lightweight, Phase 129 depends on output | ✓ |
| Gate with SQUAD_HEALTH_ENABLED | Adds flag to maintain, not warranted for greedy compute | |

**User's choice:** Always runs (recommended)

---

## API Response Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Switch to envelope now | { squad, health, solver } — Phase 129 just adds inputs, no second breaking change | ✓ |
| Keep flat shape, add optional fields | Backward compat but Phase 129 breaks it anyway | |

**User's choice:** Switch to envelope now (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Graceful null (side-read) | Route reads pre_season_squad_health.json separately, falls back to null | ✓ |
| Force refresh required | Health only appears after pipeline re-runs, simpler route | |

**User's choice:** Graceful null (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Route infers from resolution path | Resolution 1 → ilp, Resolution 2 → greedy. Simple, route already knows | ✓ |
| Store solver in pre_season_squad.json | Requires pipeline change to write field | |
| You decide | Defer to planner | |

**User's choice:** Route infers from resolution path (recommended)

---

## Watchlist Card & Data

| Option | Description | Selected |
|--------|-------------|----------|
| useLineupNews() side-load | Consistent with NewsBanner; checks news_added timestamp | ✓ |
| Derive from usePlayers() only | Simpler, but MergedPlayer.news is text string, no timestamp | |

**User's choice:** useLineupNews() side-load (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, call usePreSeasonSquad() | Overlap dot is key; null squad → no dots (graceful) | ✓ |
| Skip overlap dot for Phase 127 | Defer — but WATCH-04 explicitly requires it | |

**User's choice:** Yes, call usePreSeasonSquad() (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Bespoke WatchlistPlayerCard | Self-contained card; table-cell components fight card layout | ✓ |
| Reuse PriceTrendCell + NewsBanner | Avoids new code but components have wrong context | |

**User's choice:** Bespoke card (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| JSON array of IDs | Simple, Departed = ID missing from /api/players | ✓ |
| JSON array of { id, pinned_at } | Enables newest-first sort, slightly more complex | |

**User's choice:** JSON array of IDs (recommended)

---

## Star Placement in GemTable

| Option | Description | Selected |
|--------|-------------|----------|
| New action row at top of expand | First child of both mobile and desktop expand rows, before existing content | ✓ |
| Append after ComparisonSearch | No new cluster needed, but at the bottom | |
| Dedicated column (not expand) | Always visible but adds column to dense table | |

**User's choice:** New action row at top of expand (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| useWatchlist hook, state in page.tsx | Consistent with planHorizon/submittedId flow; props passed down | ✓ |
| useWatchlist local in GemTable | Two instances reading same localStorage; needs storage event listener | |

**User's choice:** State in page.tsx (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Text button with star glyph | ⭐ Pin to watchlist / ⭐ Pinned, amber text when pinned | ✓ |
| Icon-only star button | Smaller, needs tooltip for accessibility | |
| You decide | Defer styling to executor | |

**User's choice:** Text button with star glyph (recommended)

---

## Claude's Discretion

- Exact stale time for useWatchlist localStorage re-reads
- WatchlistTab card sort order (recommended: position order GK→DEF→MID→FWD)
- TDD test scope for WatchlistPlayerCard
- Exact SquadHealth TypeScript interface field names

## Deferred Ideas

- `greedy_optimality_gap_avg` ILP comparison computation — deferred beyond Phase 127
- Watchlist sort order options (alphabetical, price, xPts) — deferred
- Pinned-at timestamp in localStorage — deferred; plain ID array sufficient
