# Phase 4: DefCon Analysis - Research

**Researched:** 2026-03-28
**Domain:** FPL element-summary API + per-match hit-rate computation + Python pipeline extension + TanStack Table v8 dual-table UI
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEF-01 | Per-position thresholds: DEF needs 10 defensive contributions, MID/FWD need 12 | `defensive_contribution` field confirmed in element-summary history; threshold values hard-coded per requirement |
| DEF-02 | Per player: DefCon hit rate (% of games achieved +2), avg defensive contributions per 90, distance to threshold | Hit rate requires per-match element-summary data; avg_per90 and distance can derive from bootstrap `defensive_contribution_per_90` already available |
| DEF-03 | Hypothesis analysis: do players get more DefCon in tough vs easy fixtures? | element-summary history includes `opponent_team` (team id) and `was_home`; can join to existing difficulty scores from merge.py |
| DEF-04 | Separate ranking tables per position — no combined table (thresholds differ) | Two TanStack Table instances: one filtered to DEF, one filtered to MID+FWD |
| UIX-01 | Clear, data-forward layout using tabs or cards per section | Tab or section alongside existing GemTable in page.tsx |
| UIX-02 | Scannable tables with sort/filter by position | TanStack Table v8 with sorting on hit_rate, avg_per90, distance columns |
</phase_requirements>

---

## Summary

Phase 4 has two distinct work streams: a **Python pipeline extension** and a **React UI**. The pipeline must fetch per-match history from the FPL `element-summary/{id}/` endpoint for every outfield player who has started at least one game (~425 players), compute DefCon hit rates and per-match fixture context, and write the results to a new `defcon_stats.json` cache file. The UI then reads this file via a new `/api/defcon` route, computes display metrics client-side, and renders two separate sortable TanStack Table instances — one for DEF (threshold=10), one for MID/FWD (threshold=12).

There is a **critical field naming bug** in the existing codebase that Phase 4 must fix as a prerequisite: `types.ts`, `fpl-adapter.ts`, and `merge.py` all reference `defensive_contributions` (plural), but the actual FPL API returns `defensive_contribution` (singular) at both the bootstrap and element-summary levels. The merged cache currently stores `null` for this field for all players because the wrong key is looked up. Phase 4 must correct this bug before relying on any defensive stats.

The `element-summary` API is fast (~80ms per call) and fetching ~425 outfield starters with a 100ms delay takes roughly 1-2 minutes in the daily pipeline. The bootstrap already provides `defensive_contribution_per_90` (season aggregate), which is sufficient for avg-contributions-per-90 and distance-to-threshold. Hit rate requires per-match data and can only come from element-summary history. The `defensive_contribution` field in element-summary history covers both DEF and MID/FWD players (Garner: 12.22 dc/90, Ugarte: 14.89 dc/90) — MID players clearly produce meaningful hit rates against the threshold=12 criterion.

**Primary recommendation:** Fix the `defensive_contribution` field name bug across all three files first. Then extend the pipeline to call element-summary for DEF/MID/FWD starters, persist `defcon_stats.json`, add `/api/defcon` route, and build a `DefConTables` client component with two TanStack Table instances and a DEF-03 fixture-correlation mini-analysis.

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md references AGENTS.md, which contains:

> This is NOT the Next.js you know. This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

**Verified against `node_modules/next/dist/docs/` (Next.js 16.2.1):**
- Route Handlers: `export async function GET()` returning `Response.json()` or `new Response(data, { headers })` — confirmed in `route.md`. Pattern already used in `src/app/api/players/route.ts`.
- `'use client'` directive: Must appear at top of file before imports for any component using `useState` or TanStack Query hooks — confirmed in existing `GemTable.tsx` pattern.
- Server Components cannot use `useState` or `useQuery` — `DefConTables` must be a `'use client'` component.
- `params` in dynamic routes is a `Promise<>` that must be `await`-ed — confirmed in existing `[...proxy]/route.ts`.

---

## Critical Bug: Field Name Mismatch

**This must be addressed in Phase 4 before any DefCon computation.**

| Location | Current (wrong) | Correct |
|----------|-----------------|---------|
| `src/lib/types.ts` L19, L95 | `defensive_contributions` (plural) | `defensive_contribution` (singular) |
| `src/lib/fpl-adapter.ts` L14 | `defensive_contributions` (plural) | `defensive_contribution` (singular) |
| `pipeline/merge.py` L244 | `element.get('defensive_contributions')` | `element.get('defensive_contribution')` |

**Evidence:** Live FPL bootstrap JSON shows `defensive_contribution` and `defensive_contribution_per_90` — no plural form exists. The element-summary history also uses `defensive_contribution` (singular). As a result, the current `merged_players.json` has `null` for `defensive_contributions` for every player. Additionally, `defensive_contribution_per_90` exists in the bootstrap but is not currently mapped into `MergedPlayer`.

The test fixture `tests/fixtures/bootstrap-static-sample.json` uses the wrong plural form too — it must be updated when the bug is fixed.

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-table` | 8.21.3 (installed) | Dual sortable tables for DEF and MID/FWD | Already used in GemTable; identical pattern |
| `@tanstack/react-query` | 5.95.2 (installed) | `useDefCon()` hook fetching `/api/defcon` | Same pattern as `usePlayers()` |
| React + Next.js | 19.2.4 / 16.2.1 (installed) | UI + App Router | Project stack |
| Tailwind CSS v4 | installed | Table styling | Project stack |
| Vitest | 4.1.2 (installed) | Unit tests for hit-rate calculation | Pure function — fully testable without DOM |
| Python 3.11 + requests | installed | Pipeline: element-summary fetching | Already used in `fpl_client.py` |

### No New Dependencies Required

Phase 4 adds no new npm packages. The Python pipeline already has `requests` installed. All computation is in pure TypeScript functions (testable) and Python.

---

## Architecture Patterns

### Recommended Project Structure (additions)

```
pipeline/
├── fpl_client.py            # MODIFY: get_element_summary() already exists — use it
├── defcon.py                # NEW: compute DefCon stats from element-summary history
├── run.py                   # MODIFY: call defcon pipeline step, write defcon_stats.json
├── cache/
│   └── defcon_stats.json    # NEW: per-player hit rates, avg_per90, per-match history

src/
├── app/
│   └── api/
│       └── defcon/
│           └── route.ts     # NEW: serve defcon_stats.json (mirrors players/route.ts pattern)
├── lib/
│   ├── types.ts             # MODIFY: fix defensive_contribution singular; add DefConPlayer type
│   ├── fpl-adapter.ts       # MODIFY: fix Zod schema field name
│   └── hooks/
│       └── useDefCon.ts     # NEW: TanStack Query hook for /api/defcon
└── components/
    └── defcon/
        ├── DefConTables.tsx  # NEW: 'use client', two TanStack Table instances
        └── columns.ts        # NEW: column definitions for DEF and MID/FWD tables
```

### Pattern 1: Pipeline — element-summary Batch Fetch

The existing `fpl_client.get_element_summary(player_id)` function is already written. It is called for DEF+MID+FWD players with `starts > 0` (~425 players). A 100ms inter-request delay is sufficient — measured at ~80ms per call, total pipeline time ~1.3 minutes.

```python
# Source: pipeline/fpl_client.py (existing function) + new defcon.py
import time

DEFCON_THRESHOLD = {2: 10, 3: 12, 4: 12}  # position_code -> threshold

def compute_defcon_stats(bootstrap: dict, team_difficulty: dict) -> list:
    """
    For each DEF/MID/FWD player with starts > 0, fetch element-summary
    and compute hit rate, avg per90, distance to threshold, and per-match context.
    """
    results = []
    for element in bootstrap['elements']:
        pos = element['element_type']
        if pos not in (2, 3, 4):
            continue
        if element.get('starts', 0) == 0:
            continue

        threshold = DEFCON_THRESHOLD[pos]
        summary = get_element_summary(element['id'])
        history = [m for m in summary.get('history', []) if m['minutes'] > 0]

        games_played = len(history)
        if games_played == 0:
            continue

        hits = sum(1 for m in history if m.get('defensive_contribution', 0) >= threshold)
        hit_rate = round(hits / games_played, 4)  # 0.0-1.0

        # avg_per90 uses bootstrap field — it already exists and matches element-summary totals
        avg_per90 = element.get('defensive_contribution_per_90', 0.0)
        distance = round(threshold - avg_per90, 2)  # negative = already above threshold

        results.append({
            'id': element['id'],
            'web_name': element['web_name'],
            'element_type': pos,
            'team': element['team'],
            'hit_rate': hit_rate,
            'hits': hits,
            'games_played': games_played,
            'avg_per90': avg_per90,
            'distance_to_threshold': distance,
            'threshold': threshold,
            'history': history,  # kept for DEF-03 fixture correlation
        })
        time.sleep(0.1)

    return results
```

**Key insight:** `defensive_contribution_per_90` from bootstrap is mathematically identical to computing it from element-summary history (verified: Garner bootstrap=12.22, from history=12.22). Use bootstrap value for avg_per90 to avoid recomputing.

### Pattern 2: DEF-03 Fixture Difficulty Correlation

The element-summary history contains `opponent_team` (FPL team id) and `was_home`. The existing `merge.py` computes `difficulty_scores` dict keyed by team id. Pass this dict into `defcon.py` to join per-match difficulty.

```python
# Source: merge.py (difficulty_scores dict already computed there)
def compute_fixture_correlation(history: list, difficulty_scores: dict, threshold: int) -> dict:
    """
    Split games into easy vs hard fixtures and compare hit rates.
    Returns {'easy_hit_rate': float, 'hard_hit_rate': float, 'sample_sizes': dict}
    or {'insufficient_data': True} when fewer than 5 games in any bucket.
    """
    easy_games = [m for m in history if difficulty_scores.get(m['opponent_team'], 0.5) < 0.4]
    hard_games = [m for m in history if difficulty_scores.get(m['opponent_team'], 0.5) > 0.6]

    if len(easy_games) < 5 or len(hard_games) < 5:
        return {'insufficient_data': True, 'easy_n': len(easy_games), 'hard_n': len(hard_games)}

    easy_hits = sum(1 for m in easy_games if m.get('defensive_contribution', 0) >= threshold)
    hard_hits = sum(1 for m in hard_games if m.get('defensive_contribution', 0) >= threshold)

    return {
        'insufficient_data': False,
        'easy_hit_rate': round(easy_hits / len(easy_games), 4),
        'hard_hit_rate': round(hard_hits / len(hard_games), 4),
        'easy_n': len(easy_games),
        'hard_n': len(hard_games),
    }
```

**DEF-03 note from REQUIREMENTS.md:** "If data is insufficient at Phase 4 time, this criterion will surface an 'insufficient data' message rather than a full analysis." The `insufficient_data: true` path above handles this gracefully.

### Pattern 3: New API Route

Mirrors the existing `/api/players` route exactly. The `defcon_stats.json` file does not go through Vercel Blob in v1 — it is served from local cache in dev and can be added to Blob upload in production if needed (out of scope for Phase 4).

```typescript
// Source: mirrors src/app/api/players/route.ts pattern
// src/app/api/defcon/route.ts
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET() {
  try {
    const cachePath = join(process.cwd(), 'pipeline', 'cache', 'defcon_stats.json')
    const data = await readFile(cachePath, 'utf-8')
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch {
    return Response.json({ error: 'DefCon data not available' }, { status: 404 })
  }
}
```

Note: No `USE_BLOB` split needed for Phase 4 — DefCon data is served local-only in v1. If Blob support is needed later it follows the same pattern.

### Pattern 4: Dual TanStack Table UI

Two separate `useReactTable` instances with the same column definitions but different data slices. Do NOT use position filter on a single table — keep them as truly separate instances with their own sort state.

```typescript
// Source: mirrors src/components/gem-table/GemTable.tsx pattern
'use client'

import { useState, useMemo } from 'react'
import { useReactTable, getCoreRowModel, getSortedRowModel, type SortingState } from '@tanstack/react-table'
import { useDefCon } from '@/lib/hooks/useDefCon'
import { defconColumns } from './columns'

export function DefConTables() {
  const { data, isLoading, error } = useDefCon()

  const defPlayers = useMemo(() => (data ?? []).filter(p => p.element_type === 2), [data])
  const midFwdPlayers = useMemo(() => (data ?? []).filter(p => p.element_type === 3 || p.element_type === 4), [data])

  const [defSorting, setDefSorting] = useState<SortingState>([{ id: 'hit_rate', desc: true }])
  const [midFwdSorting, setMidFwdSorting] = useState<SortingState>([{ id: 'hit_rate', desc: true }])

  const defTable = useReactTable({
    data: defPlayers,
    columns: defconColumns,
    state: { sorting: defSorting },
    onSortingChange: setDefSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const midFwdTable = useReactTable({
    data: midFwdPlayers,
    columns: defconColumns,
    state: { sorting: midFwdSorting },
    onSortingChange: setMidFwdSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  // render defTable then midFwdTable with their own headers
}
```

### Pattern 5: Page Navigation

The current `page.tsx` renders only `<GemTable />`. Phase 4 must add navigation between Gem Ratings and DefCon Analysis. The simplest approach consistent with the existing codebase is **tab-based navigation within `page.tsx`** using a `useState` for the active tab — no new App Router routes needed since UIX-01 says "tabs or cards per section".

### Anti-Patterns to Avoid

- **Combining DEF and MID/FWD into one table with a filter:** The requirements explicitly forbid this (DEF-04). Separate table instances are required.
- **Computing avg_per90 from element-summary history:** Bootstrap already provides `defensive_contribution_per_90` — identical value, no extra computation needed.
- **Using `clearances_blocks_interceptions` for MID/FWD hit rate:** The success criteria explicitly state MID/FWD uses `defensive_contributions` field (now confirmed as `defensive_contribution` in the API). The `clearances_blocks_interceptions` field is a different, lower-level metric.
- **Fetching element-summary for all 825 players:** Only DEF/MID/FWD with `starts > 0` are relevant (~425 players). GKs do not have a DefCon threshold.
- **Storing full match history in `defcon_stats.json` per-player for production:** For DEF-03 the per-match correlation analysis can be computed in the Python pipeline and stored as a summary (`fixture_correlation` object per player) — the raw `history` array can be stripped before writing the final JSON to keep the file size manageable.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sortable table with per-column sort state | Custom sort handler | TanStack Table v8 (already installed) | Already proven in GemTable; sort state, toggle, and column definitions are handled |
| API data fetching with stale-while-revalidate | Custom fetch + cache | TanStack Query `useQuery` (already installed) | `staleTime` config already set to 6h in `Providers` |
| Rate limiting element-summary calls | Custom exponential backoff | Simple `time.sleep(0.1)` | FPL API is fast (~80ms), a flat 100ms delay across 425 calls is 1.3 min total — well within daily pipeline budget |

---

## Common Pitfalls

### Pitfall 1: Field Name Singular vs Plural

**What goes wrong:** Code accesses `defensive_contributions` (plural) but the FPL API returns `defensive_contribution` (singular). All values are `null`.
**Why it happens:** The field was misread when writing the initial Phase 1 schema.
**How to avoid:** Fix in `types.ts`, `fpl-adapter.ts`, `merge.py`, and the test fixture before any Phase 4 work.
**Warning signs:** All players show `null` for defensive contributions in the merged cache (currently confirmed).

### Pitfall 2: Using Season Aggregate for Hit Rate

**What goes wrong:** Hit rate computed as `(total_dc / games_played >= threshold)` instead of counting per-match threshold crossings.
**Why it happens:** Bootstrap provides season totals and `defensive_contribution_per_90` — easy to mistakenly use these.
**How to avoid:** Hit rate MUST be computed per-match from element-summary history. A player averaging 11 dc/90 could have a hit rate of 0% if they always get 9 or 13 but never exactly 10+... Wait — actually 13 > 10 would count. The issue is variance: averaging 11/game with high variance might hit 10 in some games and miss in others. The per-match calculation is mandatory per the success criteria.
**Warning signs:** Hit rates that look perfectly correlated with avg_per90.

### Pitfall 3: Partial Minutes — Exclude Matches with 0 Minutes

**What goes wrong:** A player listed in a gameweek with 0 minutes (came on as late sub, DNP) counts as a missed DefCon game, inflating miss rate.
**Why it happens:** Element-summary history includes all gameweek entries including DNP (minutes=0).
**How to avoid:** Filter `history` to `minutes > 0` before computing hit rate (shown in Pattern 1 above).
**Warning signs:** Hit rates lower than expected for reliable starters.

### Pitfall 4: DEF-03 Insufficient Data

**What goes wrong:** Correlating tough vs easy fixtures requires both buckets to have enough games. Early in the season or for rotation players, one bucket might have 1-2 games.
**Why it happens:** The 20-team PL has uneven fixture distribution across difficulty bands.
**How to avoid:** Return `{ insufficient_data: true }` when either bucket has fewer than 5 games (as shown in Pattern 2). Display "Insufficient data" in the UI for that player.
**Warning signs:** Skewed correlations for players with <10 games played.

### Pitfall 5: run.py Integration — Don't Block on Pipeline Failure

**What goes wrong:** If element-summary fetch fails for one player, the entire DefCon pipeline step fails and no `defcon_stats.json` is written.
**Why it happens:** `get_element_summary()` can throw if the FPL API returns 4xx/5xx.
**How to avoid:** Wrap individual `get_element_summary()` calls in try/except and skip the player with a log warning. Partial data is better than no data.
**Warning signs:** `defcon_stats.json` missing from cache after pipeline run.

---

## API Contract: `defcon_stats.json`

Each entry in the JSON array:

```typescript
interface DefConPlayer {
  id: number
  web_name: string
  element_type: PositionCode       // 2=DEF, 3=MID, 4=FWD
  team: number
  team_short_name: string          // filled by pipeline joining teams lookup
  threshold: number                // 10 for DEF, 12 for MID/FWD
  hit_rate: number                 // 0.0–1.0 (e.g. 0.516 = 51.6%)
  hits: number                     // absolute count of qualifying games
  games_played: number             // games with minutes > 0
  avg_per90: number                // defensive_contribution_per_90 from bootstrap
  distance_to_threshold: number    // threshold - avg_per90 (negative = above threshold)
  fixture_correlation: {
    insufficient_data: boolean
    easy_hit_rate?: number
    hard_hit_rate?: number
    easy_n?: number
    hard_n?: number
  }
}
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3 | Pipeline defcon.py | Yes | 3.11.9 | — |
| requests (Python) | element-summary fetch | Yes | 2.32.3 | — |
| FPL API (element-summary) | Hit rate computation | Yes (live, tested) | — | Serve 404 from /api/defcon |
| Node.js | Next.js dev/build | Yes | per env | — |
| @tanstack/react-table | DefConTables component | Yes | 8.21.3 | — |
| @tanstack/react-query | useDefCon hook | Yes | 5.95.2 | — |

No missing dependencies. All tools confirmed available.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npm test -- --reporter=verbose tests/lib/defcon.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEF-01 | DEF threshold=10, MID/FWD threshold=12 | unit | `npm test -- tests/lib/defcon.test.ts` | No — Wave 0 |
| DEF-02 | Hit rate = (games >= threshold) / games_played, NOT season_total / games | unit | `npm test -- tests/lib/defcon.test.ts` | No — Wave 0 |
| DEF-02 | avg_per90 from bootstrap field, distance = threshold - avg_per90 | unit | `npm test -- tests/lib/defcon.test.ts` | No — Wave 0 |
| DEF-03 | fixture_correlation returns `insufficient_data: true` when bucket < 5 | unit | `npm test -- tests/lib/defcon.test.ts` | No — Wave 0 |
| DEF-04 | DEF table rows all have element_type=2; MID/FWD table rows all have element_type 3 or 4 | unit | `npm test -- tests/lib/defcon.test.ts` | No — Wave 0 |
| DEF-01 | Fix: defensive_contribution (singular) parses correctly via Zod | unit | `npm test -- tests/lib/fpl-adapter.test.ts` | Yes (needs update) |

### Sampling Rate

- **Per task commit:** `npm test -- tests/lib/defcon.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/lib/defcon.test.ts` — covers DEF-01, DEF-02, DEF-03, DEF-04 (pure TypeScript hit-rate and correlation logic)
- [ ] Update `tests/fixtures/bootstrap-static-sample.json` — rename `defensive_contributions` to `defensive_contribution`, add `defensive_contribution_per_90`
- [ ] Update `tests/lib/fpl-adapter.test.ts` — rename field references

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `clearances_blocks_interceptions` for all positions | `defensive_contribution` (FPL 2025/26 new field) | 2025/26 season | `defensive_contribution` is the canonical field; `clearances_blocks_interceptions` still exists but is not the DefCon trigger field |
| Season aggregate for "contribution level" | Per-match threshold crossing for hit rate | Phase 4 requirement | Bootstrap `defensive_contribution_per_90` is good for avg/distance but insufficient for hit rate |

**Deprecated/outdated:**
- `defensive_contributions` (plural): Never existed in FPL API. The current codebase used this wrong name from Phase 1 — Phase 4 is the correction point.

---

## Open Questions

1. **Should `defcon_stats.json` be uploaded to Vercel Blob like `merged_players.json`?**
   - What we know: `merged_players.json` uses `USE_BLOB` routing for production. `defcon_stats.json` is a similar daily-refreshed file.
   - What's unclear: Phase 4 scope doesn't explicitly call for Blob integration. The `/api/defcon` route only reads from local cache.
   - Recommendation: Implement local-only for Phase 4. Add Blob support as a follow-on when deploying to Vercel production. The route.ts pattern makes this a 5-line addition later.

2. **Should full match history be stored in `defcon_stats.json` or only the correlation summary?**
   - What we know: The UI only displays hit_rate, avg_per90, and distance. DEF-03 needs correlation buckets, not raw history.
   - What's unclear: Whether a future phase might want per-match breakdown.
   - Recommendation: Store the `fixture_correlation` summary object and strip the raw `history` array from the final JSON. Keeps the file size manageable (~425 objects with summary data vs full 31-match history per player).

3. **Min-minutes filter for hit rate: should sub appearances count as "played"?**
   - What we know: Currently filtering to `minutes > 0` meaning a 1-minute cameo counts as a game played (and almost certainly a DefCon miss).
   - What's unclear: Whether a minimum minutes threshold (e.g. 45+) would be more meaningful.
   - Recommendation: Use `minutes > 0` for v1 (matches the phase description which doesn't specify a min-minutes qualifier). Document the filter in the UI so managers understand the denominator.

---

## Sources

### Primary (HIGH confidence)

- Live FPL API (`element-summary/5/`, `element-summary/303/`) — field names, data structure, and availability verified by direct API call
- `pipeline/cache/fpl_bootstrap.json` — confirmed `defensive_contribution` (singular) and `defensive_contribution_per_90` field presence
- `pipeline/cache/merged_players.json` — confirmed all `defensive_contributions` values are `null` (the bug)
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — Route Handler conventions for Next.js 16.2.1

### Secondary (MEDIUM confidence)

- Garner (id=303) element-summary: 31 games, 16 DefCon hits at threshold=12, 51.6% hit rate — validated the algorithm end-to-end
- Timing measurements: 5 element-summary calls averaged 80ms, estimated 1.3 min for 425 players with 100ms delay

### Tertiary (LOW confidence)

- None — all critical claims verified against live data or source code.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages installed and confirmed by `node_modules`
- API field names: HIGH — verified by direct live API calls and local bootstrap cache inspection
- Architecture: HIGH — patterns directly derived from existing working code in the project
- Bug identification: HIGH — confirmed by checking merged cache (all nulls) and bootstrap JSON (singular field name)
- DEF-03 fixture correlation: MEDIUM — algorithm is sound but actual data patterns (whether harder fixtures genuinely yield more DefCon) are unknown until runtime

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (FPL API field names are stable within a season; bootstrap structure unlikely to change mid-season)
