# Phase 1: Data Foundation - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the infrastructure layer that every subsequent phase depends on: Next.js scaffold with App Router, FPL Route Handler proxy (bypasses CORS), Zod adapter/schema layer (isolates FPL API field breakage), Vercel Blob cache (persistent JSON storage), and the player ID mapping file that enables FPL ↔ Understat joins.

No UI features in this phase. The deliverables are all plumbing — if Phase 1 is solid, every subsequent phase is building on a reliable foundation.

</domain>

<decisions>
## Implementation Decisions

### Player ID Mapping

- **D-01:** Seed `player_id_map.json` using `ChrisMusson/FPL-ID-Map` (`Understat.csv`, 2,049 entries) as the Understat ID bridge, cross-referenced against the live FPL `bootstrap-static` to resolve current player names and IDs. The `vaastav/Fantasy-Premier-League` repo is an acceptable alternative source for FPL IDs if the live bootstrap is unavailable, but live FPL bootstrap is the preferred approach. ChrisMusson's file is the authoritative Understat ID source. This produces ~500 active player entries.
- **D-02:** Unmatched players (e.g. newly promoted team players with no Understat history) are represented as `null` xG/xA — they appear in all tables with a dash in xG/xA columns. They are **never excluded** from tables. Gem scores are computed on available dimensions only for these players.
- **D-03:** The mapping file (`player_id_map.json`) is a static JSON committed to the repo. It is updated manually at season start when squads change. The pipeline uses it as the join key — it never falls back to string name matching.

### Zod Schema

- **D-04:** Validate **only fields the app actively consumes** — not the full FPL API shape. Use `z.object({...}).strip()` so unknown/extra FPL fields are silently ignored. This makes the schema resilient to FPL adding new fields each season while still loudly catching renames or removals of fields we depend on.
- **D-05:** Required fields to validate in `bootstrap-static` elements: `id`, `web_name`, `team`, `element_type`, `now_cost`, `selected_by_percent`, `form`, `status`, `minutes`, `starts`, `defensive_contributions`, `clearances_blocks_interceptions`, `news`.
- **D-06:** When Zod validation fails (a required field is missing or the wrong type): the pipeline **throws loudly**, logs the error, and aborts the current refresh. The previous day's Blob cache is served to the UI with a `stale: true` flag and visible staleness indicator. No broken/partial data reaches the frontend.

### Claude's Discretion

- **Local dev data strategy** — not discussed; Claude decides. Recommended approach: local dev uses file-based JSON in `pipeline/cache/` (no Vercel Blob needed); production uses Vercel Blob. An environment variable (`USE_BLOB=true`) switches between the two. This means developers can run the pipeline and test Route Handlers without cloud credentials.
- **FPL proxy design** — not discussed; Claude decides. Recommended approach: single catch-all route `/api/fpl/[...proxy]/route.ts` that forwards any path to the FPL API server-side. This is flexible and requires no new route files as subsequent phases add new FPL endpoint calls.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Full requirements, constraints, and feature list
- `.planning/REQUIREMENTS.md` — Acceptance criteria per requirement ID (DAT-01, DAT-02, PPS-01–04)
- `.planning/ROADMAP.md` §Phase 1 — Success criteria for this phase (5 criteria)

### Research
- `.planning/research/STACK.md` — Confirmed tech stack with versions and rationale (Next.js 16, TypeScript 5, Tailwind v4, shadcn/ui, TanStack Query v5)
- `.planning/research/ARCHITECTURE.md` — Module structure, folder layout, data flow diagram, phase-by-phase build-up
- `.planning/research/PITFALLS.md` — 13 pitfalls; critical ones for this phase: Pitfall 1 (CORS), Pitfall 6 (Understat name mismatch), Pitfall 7 (FPL API field instability), Pitfall 11 (position codes), Pitfall 12 (missing Understat data)
- `.planning/research/FEATURES.md` §FPL API Data Availability Reference — Confirmed field names including `defensive_contributions` and `clearances_blocks_interceptions`

### External
- Community player ID source: `https://github.com/vaastav/Fantasy-Premier-League` — Player CSV with FPL IDs for mapping bootstrap

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project. No existing components, hooks, or utilities.

### Established Patterns
- None yet — this phase establishes the patterns all subsequent phases follow.

### Integration Points
- `pipeline/` directory (to be created): Python pipeline writes JSON to Blob or local cache
- `src/app/api/fpl/[...proxy]/route.ts` (to be created): FPL CORS proxy — all subsequent phases call FPL endpoints through this
- `src/lib/fpl-adapter.ts` (to be created): Zod schema + adapter — all subsequent phases import player types from here
- `src/lib/types.ts` (to be created): Shared TypeScript interfaces — all subsequent phases import from here

</code_context>

<specifics>
## Specific Ideas

- The `vaastav/Fantasy-Premier-League` repo was specifically called out as the community CSV source for the player ID mapping. Use the `player_idlist.csv` file from that repo as the starting point.
- The Zod schema failure → serve stale cache pattern is important: the UI should show "Data from [yesterday's date]" rather than an error screen when the pipeline fails.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-data-foundation*
*Context gathered: 2026-03-26*
