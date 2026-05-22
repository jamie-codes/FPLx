# Phase 133: Price Reset Analysis - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 133 delivers a two-part off-season price comparison feature:
1. **Pipeline** — `price_baseline.py` captures `now_cost` per player from the FPL bootstrap and writes `price_baseline.json` to Vercel Blob exactly once (idempotent write-once).
2. **UI** — `PriceResetTab` in the Analyse section compares the baseline against current bootstrap prices, showing delta pills per player. A "Value Targets" subsection highlights players whose price fell but whose xPts (from last-season Monte Carlo sim) still rates above their position median.

</domain>

<decisions>
## Implementation Decisions

### Baseline Capture (pipeline/price_baseline.py)
- **D-01:** `price_baseline.py` runs on **every pipeline run**, guarded by an idempotency check (`_blob_exists`) — same pattern as `archive_season.py`. No GW gate or season flag needed; the blob guard ensures write-once behaviour.
- **D-02:** Captures **`now_cost` only** per player (minimal). Shape: `{ [element_id]: now_cost }` — keeps `price_baseline.json` small (~30KB) and diff logic simple.
- **D-03:** **Non-fatal** in `run.py` — wrapped in `try/except`, log to stderr and continue if blob write fails. Mirrors `archive_season.py` and `squad_health.py` patterns.

### xPts Source for Value Targets
- **D-04:** Value Targets uses **`merged_players.json` xPts** (Monte Carlo simulation output from last season). Even though it is last-season data in July, it reflects real measured performance — better than bootstrap estimates for identifying proven quality.
- **D-05:** **Position median** is computed as the median xPts across **all players in the same `element_type`** (GK/DEF/MID/FWD) from `merged_players.json`. Standard median, no ownership filter.
- **D-06:** Each Value Targets row shows: **player name, price drop pill, xPts rank within position** (e.g. "#3 MID"). Matches PRST-03 exactly — minimal and scannable.

### Published State Detection (API + frontend)
- **D-07:** The API route uses a **diff-based detection** approach: read `price_baseline.json` from Blob, read current bootstrap `now_cost` for all elements, compute deltas. If any delta is non-zero, `published: true` is returned along with populated player rows. If all deltas are zero (or baseline is absent), `published: false` → frontend shows empty state.
- **D-08:** **Fallback when `price_baseline.json` is absent from Blob** (pipeline hasn't run yet): the API uses current bootstrap `now_cost` as both baseline and current. All deltas are zero → response is `published: false` → seamless empty state. No 404 / hard error.
- **D-09:** **Empty state content** — static message only: *"FPL typically publishes new prices in mid-to-late July"*. No countdown, no dynamic timestamp needed. Matches PRST-04.

### Tab Placement
- **D-10:** `PriceResetTab` is registered as sub-tab ID `'price-reset'` in the **Analyse section**, positioned **after `'window'` (Summer Window) and before `'price-changes'`**. Groups the two off-season tabs together (Summer Window → Price Reset → Price Changes).
- **D-11:** Tab label: `'Price Reset'`, mobile label: `'Resets'` — consistent with the existing `label` / `mobileLabel` pattern in the `subTabs` array.

### Claude's Discretion
- API route name/path — follow existing pattern (e.g. `/api/price-reset/route.ts`)
- Blob key for price_baseline.json — `'price_baseline.json'` (flat key, matches `season_archive_gw38.json` convention)
- Delta pill colour implementation — green for price rise, red for price fall (matching existing colour conventions across PriceChangePanel)
- Sorting of the main table — default to largest absolute delta first, or alphabetical by name; planner to decide
- xPts rank display format — e.g. `#3 MID` or `3rd (MID)` — planner to decide

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pipeline idempotency pattern
- `pipeline/archive_season.py` — canonical idempotency pattern: `_blob_exists()` guard + `save()` from `upload.py`. `price_baseline.py` should mirror this structure.
- `pipeline/upload.py` — `save()` function routes to Vercel Blob (production) or local cache (dev) based on `USE_BLOB` env var. The only approved way to write blob artifacts.
- `pipeline/run.py` — integration point. Add `price_baseline` import and try/except call alongside other non-fatal pipeline steps (see `archive_season` and `squad_health` call sites).

### UI sub-tab registration
- `src/app/page.tsx` — `SubTab` union type + `subTabs` array in the `analyse` section + conditional render block. All three must be updated to register `'price-reset'`. See D-10/D-11 for placement and labels.
- `src/components/price-changes/PriceChangePanel.tsx` — existing price UI with pill colour conventions (green/amber/red). Use as reference for delta pill styling.

### Requirements
- `.planning/REQUIREMENTS.md` §Price Reset Analysis — PRST-01 through PRST-04 (write-once baseline, delta table, Value Targets, empty state).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `pipeline/archive_season.py` `_blob_exists()` — can be copied verbatim or extracted to a shared helper; `price_baseline.py` needs the same pattern
- `pipeline/upload.py` `save()` — use as-is for writing `price_baseline.json`
- `src/components/price-changes/PriceChangePanel.tsx` — pill colour classes and loading/error/empty state patterns to match

### Established Patterns
- Idempotent pipeline step: `_blob_exists` check → early return if present → fetch data → partial-write guard → `save()`
- Non-fatal pipeline step: `try/except` around the entire function call in `run.py`, stderr log on failure
- Sub-tab registration: add to `SubTab` union, `subTabs` array entry with `id`/`label`/`mobileLabel`, conditional `{activeSection !== 'squad' && activeSubTab === 'price-reset' && <PriceResetTab />}` render

### Integration Points
- `pipeline/run.py` — add `from price_baseline import capture_price_baseline` + try/except call (unconditional, runs every run)
- `src/app/page.tsx` — three-location update: `SubTab` type, `subTabs` array in analyse section, conditional render block
- New API route: `src/app/api/price-reset/route.ts` — reads `price_baseline.json` from Blob + current bootstrap, computes deltas, returns `{ published, players, value_targets }`
- New hook: `src/lib/hooks/usePriceReset.ts` — TanStack Query hook following `usePriceChanges` pattern

</code_context>

<specifics>
## Specific Ideas

- The "Value Targets" section is a subsection within `PriceResetTab`, not a separate tab
- xPts rank is per-position (e.g. "#3 MID") so comparisons are meaningful across the position group
- Empty state message verbatim from PRST-04: *"FPL typically publishes new prices in mid-to-late July"*

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 133-price-reset-analysis*
*Context gathered: 2026-05-22*
