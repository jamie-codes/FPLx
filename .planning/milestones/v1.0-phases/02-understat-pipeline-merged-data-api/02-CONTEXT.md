# Phase 2: Understat Pipeline + Merged Data API - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the Python pipeline that fetches Understat xG/xA via soccerdata, merges it with Phase 1's FPL data on `player_id_map.json`, computes per-90 normalisation and custom FDR, and writes `merged_players.json` to Vercel Blob. Expose the merged dataset via a Next.js `/api/players` Route Handler and a `usePlayers()` TanStack Query hook on the frontend.

No new UI tables in this phase — the deliverable is the data API layer that Phases 3–6 consume. The one "UI" element scoped here is the fixture difficulty colour coding logic (UIX-03/04): how difficulty maps to a visual tier, stored as a computed field in the merged data.

</domain>

<decisions>
## Implementation Decisions

### Form Window
- **D-01:** "Form" is defined as the **last 5 gameweeks**. All per-90 form metrics (recent points, recent xG, recent xA, recent minutes) are computed over this window. A Double Gameweek week counts once in the denominator (minutes played that GW, not per match) so DGW players are not inflated.

### Custom FDR — Rolling xGA Window
- **D-02:** Custom fixture difficulty is derived from rolling **xGA over the last 6 games** per team. This is the denominator for difficulty: higher team xGA conceded → easier fixture for attacking players. Six games balances responsiveness (catches defensive collapses/improvements) against noise from single outlier results.

### Upcoming Fixtures Lookahead
- **D-03:** Include **next 5 upcoming fixtures** per player in `merged_players.json`. Each fixture entry includes: `opponent_team` (short name), `is_home` (bool), `event_id` (GW number), and `difficulty_score` (float, derived from opponent's rolling xGA). This covers the standard FPL planning horizon including DGW/BGW detection.

### Home/Away in Fixture Difficulty
- **D-04:** Custom FDR is a **single difficulty score per fixture** (derived from opponent's rolling xGA). Home/away is exposed as a separate `is_home: bool` field — **not** a separate score. The frontend shows an H/A badge alongside the difficulty colour. No home advantage multiplier is applied at the pipeline level.

### Difficulty Tier Mapping
- **D-05 (Claude's Discretion):** Map the continuous xGA-derived score to **3 visual tiers** for UIX-03: easy (green), medium (amber), hard (red). Threshold: top-third of current-season team xGA range = hard, bottom-third = easy, middle = medium. Claude decides the exact percentile cutoffs.

### merged_players.json Schema
- **D-06 (Claude's Discretion):** Claude defines the exact schema. It must include at minimum: all Phase 1 FPL fields, `understat_id` (null for unmatched), `xg_per90` (null for unmatched), `xa_per90` (null for unmatched), `minutes_per90` (form window), `form_pts_per90` (form window), `fixtures` (array of next 5, per D-03). The schema must be stable enough for Phase 3 Gem scoring to add computed fields on top without a schema breaking change.

### Soccerdata / Understat Cache Strategy
- **D-07 (Claude's Discretion):** soccerdata Understat fetches are slow (~30s). Claude decides caching strategy. Recommended: cache Understat season data in `pipeline/cache/understat_current.json`; refresh only if cache is older than 24 hours (same daily cadence as FPL). This avoids re-fetching Understat on every pipeline run.

### /api/players Route Handler
- **D-08 (Claude's Discretion):** Claude decides exact Next.js 16 Route Handler pattern. Must: read from Vercel Blob in production / `pipeline/cache/` in dev (USE_BLOB env var from Phase 1), return JSON with `Content-Type: application/json`, include `Cache-Control: public, s-maxage=3600` for CDN edge caching to hit the <500ms target on warm cache. No Zod validation on the way out (the pipeline is the trust boundary).

### usePlayers() Hook
- **D-09 (Claude's Discretion):** Claude decides file location and TanStack Query v5 config. Must: use `staleTime: 6 * 60 * 60 * 1000` (6 hours), `queryKey: ['players']`, fetch from `/api/players`. Lives in `src/lib/hooks/usePlayers.ts`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 Outputs (build on these)
- `src/lib/types.ts` — FPLElement, FPLTeam, FPLEvent, PlayerIdMapEntry, PipelineMetadata interfaces
- `pipeline/player_id_map.json` — 825 entries, keyed by FPL id string, `understat_id` null for 43 promoted-team players
- `pipeline/fpl_client.py` — FPL API client (get_bootstrap_static, get_fixtures, get_element_summary)
- `pipeline/upload.py` — blob/local routing via USE_BLOB env var
- `pipeline/run.py` — pipeline entry point with stale-cache fallback (D-06 from Phase 1)
- `.planning/phases/01-data-foundation/01-VERIFICATION.md` — confirmed Phase 1 outputs

### Project Context
- `.planning/ROADMAP.md` §Phase 2 — 5 success criteria
- `.planning/REQUIREMENTS.md` — GEM-03, FFA-01, FFA-02, FFA-04, UIX-03, UIX-04
- `.planning/research/ARCHITECTURE.md` — folder layout and data flow

### Key Prior Decisions
- Phase 1 D-02: Unmatched players (null understat_id) appear in ALL tables with dash — never excluded
- Phase 1 D-03: player_id_map.json is the join key — NO string name matching fallback
- Phase 1 D-06: stale cache pattern — previous day's data served with `stale: true` on pipeline failure

</canonical_refs>

<specifics>
## Specific Ideas

- soccerdata's Understat scraper returns a DataFrame with `player_name`, `xg`, `xa`, `minutes` columns at minimum. The join to `player_id_map.json` must use `understat_id` (not name) to avoid the name-mismatch pitfall documented in Phase 1 research.
- Per-90 formula: `value_per90 = (sum_over_form_window / total_minutes_in_form_window) * 90`. Total minutes is the denominator — if a player played 0 minutes across 5 GWs, the result is 0 (not NaN).
- The `difficulty_score` field in each fixture entry should be a normalised float (0.0–1.0 or similar) so Phase 3/6 can threshold it however they need without re-deriving from raw xGA.
- TanStack Query v5 requires the `queryFn` to be async. The hook should handle the `stale: true` flag from PipelineMetadata — if stale, downstream components can show a banner.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-understat-pipeline-merged-data-api*
*Context gathered: 2026-03-28*
