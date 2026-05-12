# Phase 99: Top-10k Comparison - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-12
**Phase:** 099-top-10k-comparison
**Areas discussed:** Top-10k data source, Template players, UI placement

---

## Top-10k data source

| Option | Description | Selected |
|--------|-------------|----------|
| Research top-10k endpoints | Researcher investigates FPL dream-team/{gw}/, per-entry rank data, or any other approach that could give a top-10k-level score. Phase 99 ships with top-10k if found, graceful fallback if not. | ✓ |
| Use FPL average, better labeled | Skip the top-10k hunt. Phase 98 already shows average_score. Phase 99 adds a visible delta and template player list with no new data source. | |

**User's choice:** Research top-10k endpoints (single-request-only constraint)

### Fallback benchmark

| Option | Description | Selected |
|--------|-------------|----------|
| FPL average (~11M managers) | average_entry_score is already fetched. Label "FPL average" with delta. | |
| Dream team approach | dream-team/{gw}/ gives optimal XI for each GW; sum their points as benchmark. | ✓ |
| Omit benchmark, show delta row only | If top-10k fails, show no explicit benchmark number. | |

**User's choice:** Dream team approach — sum of 11 dream team players' GW points

### API call cost gate

| Option | Description | Selected |
|--------|-------------|----------|
| Single-request-only | Only endpoints returning top-10k data in 1–2 calls. No pagination. | ✓ |
| A few calls OK (up to 5) | Allow 3–5 calls per GW if that's the only way to get top-10k data. | |

**Notes:** Hard constraint — iterating league standings pages is out of scope for a personal tool.

---

## Template players

| Option | Description | Selected |
|--------|-------------|----------|
| Dream team players not in squad | 11 dream team players the user didn't own. Consistent with the benchmark. | ✓ |
| High overall ownership not in squad | selected_by_percent > threshold from MergedPlayer. | |
| Both — dream team + high ownership | Show dream team misses AND high-ownership misses separately. | |

**User's choice:** Dream team players not in squad

### Count

| Option | Description | Selected |
|--------|-------------|----------|
| Top 3 misses | Surface the 3 most impactful template players missed. | ✓ |
| All misses (uncapped) | Show every template player missed. | |
| Top 5 misses | Show up to 5. | |

**User's choice:** Top 3 misses, sorted by points scored descending

---

## UI placement

### Benchmark score location

| Option | Description | Selected |
|--------|-------------|----------|
| Replace 'FPL average' StatCard | Swap 4th card for the new benchmark. Grid stays 2×4. Delta as sub-label. | ✓ |
| Keep FPL average, add delta as info row | Preserve existing StatCard, add new row below Best bench. | |

**User's choice:** Replace the "FPL average" StatCard with the new benchmark

### Template players location

| Option | Description | Selected |
|--------|-------------|----------|
| New info row below 'Best bench' | "Missed: Salah (14), Haaland (12), Saka (10)" — compact row. | ✓ |
| Dedicated section with player cards | Separate section with one mini-card per missed player. | |
| Hidden behind expand toggle | Collapsed "Show template misses" toggle. | |

**User's choice:** New info row below "Best bench", compact format

### Zero-misses state

| Option | Description | Selected |
|--------|-------------|----------|
| Omit the row entirely | Nothing shown when user owned all dream team players. | ✓ |
| Show a positive confirmation | "You owned all dream team players" — green success state. | |

**User's choice:** Omit the row entirely

---

## Claude's Discretion

- Exact StatCard delta rendering (secondary line vs label suffix vs sentiment colour)
- Whether to extend `/api/gw-review` route vs separate client-side dream team fetch
- `GwReview` type field names for benchmark_score / benchmark_label / missed_players
- Player ID → web_name resolution for dream team misses (elementMap already in route)

## Deferred Ideas

None — discussion stayed within phase scope.
