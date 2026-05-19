# Phase 126: Next Season Planner - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Four deliverables:
1. `pipeline/archive_season.py` — fetch per-player element-summary history for all 700+ players and write `season_archive_gw38.json` to Vercel Blob before GW38 closes (time-sensitive, no recovery path after rollover)
2. `buildPreSeasonSquad()` TypeScript function — greedy 15-player squad builder from full player pool at 100m; score map is caller-supplied (pts-per-minute from archive); Python ILP fallback via `pipeline/suggest_squad.py` + PuLP if greedy returns null
3. GW1-8 FDR heatmap for next season — reuses `HeatMapRow`; shows "Fixtures not yet published" empty state until FPL releases next-season fixture data
4. Next Season Planner tab in Plan section — read-only formation grid showing recommended 15; "Prices pending" graceful state when `season_archive_gw38.json` is absent from Blob

</domain>

<decisions>
## Implementation Decisions

### Pre-season Player Scoring (NSP-02)
- **D-01:** Score source is `season_archive_gw38.json` — last-season per-player element-summary history. No bootstrap `ep_next` or `form` (unreliable off-season).
- **D-02:** Score formula: `points_per_minute = total_points / total_minutes`. Players with fewer than 500 total minutes in the season are excluded from scoring (treated as unscored / ineligible for recommendation). This is the value passed in the caller-supplied score map to `buildPreSeasonSquad()`.
- **D-03:** "Prices pending" graceful state triggers when `season_archive_gw38.json` is absent from Blob. No second check needed. Once the archive is written and FPL reopens with new-season prices, this state resolves.

### Squad Builder UI (NSP-04)
- **D-04:** Read-only formation grid. No swapping, locking, or interactive editing in this phase. User sees the recommended 15; they can observe the result but cannot modify it within this tab.
- **D-05:** Layout: formation grid (GK row / DEF row / MID row / FWD row + 4 bench) — mirrors the OptimiserPanel visual pattern.
- **D-06:** Each player card shows: name, team name, `£X.Xm` cost, last-season total points. Pts-per-minute shown as a tooltip on the score / sort signal — not as a primary field.
- **D-07:** Sub-tab ID: `'next-season'`, label: `"Next Season"`, mobileLabel: `"Pre-Season"`. Placed at the end of the Plan section (after `'rivals'`).

### archive_season.py Pipeline Integration (NSP-01)
- **D-08:** Integrated into `run.py` behind a GW38 gate: run only when the current GW (`current_event`) is GW38 (or the last available GW in `events[]`). Idempotent — if `season_archive_gw38.json` already exists in Blob, skip silently. Runs daily alongside other pipeline steps during GW38, not as a standalone script.
- **D-09:** Archive scope: per-player `/element-summary/{id}/` fetch for every player in the bootstrap. Captures `history[]` (per-GW stats) and `summary_season` aggregates. Does NOT snapshot the full bootstrap — only element summaries.
- **D-10:** Fetch strategy: concurrent requests (~10 at a time with asyncio). Non-fatal with partial write: if ≥ 50% of players fetched successfully, write what was collected; if < 50% succeed, skip the Blob write entirely. Failures logged per player. Mirrors the non-fatal scraper isolation pattern from Phase 123.

### GW1-8 FDR Heatmap (NSP-03)
- **D-11:** `HeatMapRow` is currently module-level (not exported) in `FixtureHeatMap.tsx`. Reuse strategy: extract `HeatMapRow` as an exported component or import from that file; do NOT copy the component.
- **D-12:** "Fixtures not yet published" empty state triggers when the FPL fixtures API returns no events for next season. Claude decides the exact detection mechanism (e.g. empty fixtures array or no GW1 event).

### Claude's Discretion
- Exact concurrent request count for archive_season.py (D-10 specifies ~10 as a starting point)
- HeatMapRow export strategy — extract to shared module or export from FixtureHeatMap.tsx
- FDR heatmap empty-state detection mechanism (D-12)
- Loading/skeleton state design for the squad builder tab
- Exact formation (4-3-3, 4-4-2, etc.) layout defaults in the formation grid

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — NSP-01, NSP-02, NSP-03, NSP-04 requirement text and acceptance criteria (read in full before planning)

### Pipeline patterns
- `pipeline/run.py` — IS_OFF_SEASON gate (Phase 123); add GW38 gate for archive_season.py at the same structural level. `pipeline/upload.py` is the ONLY Blob write path — never call Vercel Blob SDK directly.
- `pipeline/lineup_news.py` — non-fatal scraper isolation pattern (try/except per source, partial write guard) to follow for archive_season.py failure handling
- `pipeline/suggest_squad.py` (new) — Python ILP fallback via PuLP; called by buildPreSeasonSquad() if greedy returns null

### TypeScript squad builder
- `src/lib/planning-engine.ts` — DO NOT reuse `buildOptimalSquad()`; `buildPreSeasonSquad()` is a new function (C-01 from STATE.md: greedy cold-start on 700+ players at 100m fails without backtracking)
- `src/components/optimiser/OptimiserPanel.tsx` — formation grid visual pattern to follow for the Next Season Planner squad display
- `src/components/optimiser/OptimiserPanel.test.tsx` — test pattern for the formation grid

### FDR heatmap reuse
- `src/components/club-form/FixtureHeatMap.tsx` — `HeatMapRow` (module-level, currently not exported); extract or export for reuse in the Next Season Planner heatmap

### Navigation integration
- `src/app/page.tsx` lines 57–98 — `SubTab` union type and `SECTIONS` array. Add `'next-season'` SubTab and register in Plan section after `'rivals'`. Follow the Phase 125 `'window'` sub-tab registration as exact pattern.

### Phase 123 archive dependency
- `pipeline/player_matching.py` — shared player-matching utility (from Phase 123); may be useful for archive_season.py player ID resolution
- `src/lib/hooks/useTransferNews.ts` — 6h staleTime hook pattern; new `usePreSeasonSquad` hook should follow the same staleTime and Blob-read pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `HeatMapRow` (`src/components/club-form/FixtureHeatMap.tsx`) — GW-row rendering for FDR heatmap; needs to be exported before the Next Season heatmap can import it
- `OptimiserPanel` (`src/components/optimiser/OptimiserPanel.tsx`) — formation grid layout (GK / DEF / MID / FWD / bench); primary visual template for the squad builder display
- `pipeline/upload.py` `save()` function — sole Blob write path; `archive_season.py` must use this

### Established Patterns
- Non-fatal pipeline step: wrap in try/except, continue pipeline on failure, log per-source errors (Phase 123 scraper pattern)
- Idempotent Blob write: check if artifact exists before writing (gw_intel.py pattern — check Blob existence before computing)
- TanStack Query hook: `staleTime: 6 * 60 * 60 * 1000`, numeric teamId guard `!!teamId && /^\d+$/.test(teamId)`, `isSuccess` gate before data access
- SubTab registration: add value to `SubTab` union + entry in `SECTIONS` array + render condition in page.tsx render switch (Phase 125 'window' tab is the most recent example)
- FPL UA header: `'fplx/1.X (+https://fplx.app)'` in all fetch calls

### Integration Points
- `pipeline/run.py` — add GW38 gate block for `archive_season.py`; position after `IS_OFF_SEASON` block to ensure it doesn't run post-rollover
- `src/app/page.tsx` — add `'next-season'` to SubTab union and SECTIONS Plan array; add `NextSeasonPlannerTab` render condition
- `src/lib/types.ts` — new `PreSeasonSquad`, `PreSeasonPlayer`, `SeasonArchiveEntry` types needed; read existing types before defining to avoid duplication

</code_context>

<specifics>
## Specific Ideas

- `archive_season.py` is one-time-per-season: if `season_archive_gw38.json` already exists in Blob, skip — do not overwrite with a potentially partial re-run
- "Prices pending" copy for the graceful state: exact wording TBD by planner, but should explain that the pre-season squad builder becomes available once the season archive is ready
- Formation grid in the squad builder mirrors OptimiserPanel — the planner should read OptimiserPanel.tsx to understand the exact grid structure before implementing a new component
- The ILP fallback (suggest_squad.py + PuLP) is a pipeline step, not a runtime compute — it writes a pre-computed result to Blob so the UI can read it if buildPreSeasonSquad() greedy returns null

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 126-next-season-planner*
*Context gathered: 2026-05-19*
