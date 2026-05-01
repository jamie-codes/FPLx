# Phase 29: Regression Detector - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 29-regression-detector
**Areas discussed:** Per-match data fetch, Signal display location, GW window & threshold

---

## Per-match data fetch

### Q1: How to pull per-match xG/xA?

| Option | Description | Selected |
|--------|-------------|----------|
| soccerdata library | In tech stack, built-in caching/rate-limiting, avoids bespoke per-player scraper | ✓ |
| Scrape player pages directly | Hit understat.com/player/{id} for ~782 players; consistent with existing direct-HTTP approach | |
| You decide | Claude picks | |

**User's choice:** soccerdata library

---

### Q2: Where to store per-match data?

| Option | Description | Selected |
|--------|-------------|----------|
| Separate JSON + inline fields on merge | Intermediate cache file; merge.py attaches pre-computed signals to merged_players.json | ✓ |
| Embedded per-match rows in merged_players.json | Each player gets a per_match array; UI computes signal at render time | |
| You decide | Claude picks | |

**User's choice:** Separate JSON, pre-computed signals on merge

---

### Q3: Fallback if fetch fails?

| Option | Description | Selected |
|--------|-------------|----------|
| Skip signals, don't fail the run | Pipeline continues without regression fields; UI shows em-dash | ✓ |
| Abort the run | Hard-fail if per-match data unavailable | |
| You decide | Claude picks | |

**User's choice:** Skip signals, don't fail the run

---

## Signal display location

### Q1: Where do buy/sell signals appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline badges in GemTable | BUY/SELL pill in each player row, following VarianceBadge pattern | ✓ |
| New Regression tab/panel | Dedicated tab showing only players with signals, sorted by signal strength | |
| Both: badge + dedicated panel | Badge in GemTable + standalone panel | |

**User's choice:** Inline badges in GemTable

---

### Q2: Badge in dedicated column or inside player name cell?

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated 'Signal' column | Narrow, sortable column — user can sort to surface all signals | ✓ |
| Inline with player name cell | Badge appended to name cell; unsortable | |
| You decide | Claude picks based on table width constraints | |

**User's choice:** Dedicated Signal column

---

### Q3: Mobile visibility?

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden on mobile, visible on desktop | Follows existing TanStack columnVisibility mobile-hide pattern | |
| Visible on mobile | Always show; displaces another mobile column | |
| You decide | Claude picks based on mobile column priority | |

**User's choice (free text):** "Hidden until you turn the phone landscape" — hidden on portrait mobile, visible on landscape + desktop

**Notes:** User wants landscape-aware visibility matching the Phase 26 landscape tip pattern.

---

## GW window & threshold

### Q1: What GW window?

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed at 5 GW | Simple, captures recent form; minimum 900-min gate already in requirements | ✓ |
| Fixed at 10 GW | More statistically robust but slower to react | |
| User-selectable 5/10 GW toggle | Flexible but adds UI state and extra pipeline fields | |

**User's choice:** Fixed at 5 GW

---

### Q2: What threshold defines "significant"?

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed absolute: ±0.5 xG+xA per match | Simple, auditable; ~2.5 goal involvements of luck swing over 5 games | ✓ |
| Percentile-based (top/bottom quartile) | Adapts to season distribution; always flags 25% as signals | |
| You decide | Claude picks approach and cutoff | |

**User's choice:** Fixed absolute ±0.5 xG+xA per match

---

### Q3: Combined or separate signals?

| Option | Description | Selected |
|--------|-------------|----------|
| Combined xG+xA vs G+A | Single delta, single signal; matches FPL "goal involvements" mental model | ✓ |
| Separate xG vs G and xA vs A | Two deltas, more granular but noisier; two badges per player | |
| You decide | Claude picks signal composition | |

**User's choice:** Combined xG+xA vs G+A

---

## Claude's Discretion

- Tooltip content for BUY/SELL badge
- Signal column position in GemTable column order
- soccerdata cache TTL for per-match data
- Pipeline module structure (new file vs extending understat_client.py)

## Deferred Ideas

None — discussion stayed within phase scope.
