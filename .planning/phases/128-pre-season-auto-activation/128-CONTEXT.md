# Phase 128: Pre-Season Auto-Activation - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 128 delivers automated detection of next-season FPL bootstrap publication and the UI feedback that follows:

1. **Pipeline auto-activation (AUTO-01/02)** — `run.py` evaluates a tri-state predicate inside the IS_OFF_SEASON block: `IS_OFF_SEASON AND len(events)>=38 AND not any(e.finished) AND events[0].deadline_time present`. On the first run where this predicate is true AND `pre_season_active.json` is absent, the pipeline writes the artifact to Blob and calls `suggest_squad(force=True)` to override the cached previous-season squad with a fresh ILP-optimal squad against the newly published bootstrap prices. All subsequent pipeline runs are idempotent — predicate true but artifact exists → skip.

2. **UI readiness indicator + banner (AUTO-03)** — `NextSeasonPlannerTab` gains a zinc "Awaiting" / green "Live" status pill at the top of tab content (above the formation grid), driven by `usePreSeasonActive()` and `/api/pre-season-active`. On first activation, a dismissible inline banner appears between the pill and the formation grid, suppressed forever via `localStorage['nsp_activation_seen_{seasonId}']`.

**No overlap with Phase 129 (budget slider)** — the `/api/pre-season-squad` envelope shape from Phase 127 is consumed here unchanged.

</domain>

<decisions>
## Implementation Decisions

### Activation Sequencing in run.py (AUTO-01/02)

- **D-01:** Activation block lives **nested inside the IS_OFF_SEASON block**, after the GW38 gate section. The predicate naturally requires IS_OFF_SEASON — no redundant top-level check needed.
- **D-02:** Activation guard sequence in run.py:
  1. Evaluate tri-state predicate: `IS_OFF_SEASON AND len(events) >= 38 AND not any(e.get('finished') for e in events) AND bool(events[0].get('deadline_time'))`
  2. If predicate is true → check if `pre_season_active.json` exists (via blob list or local path check, same pattern as suggest_squad idempotency)
  3. If artifact **absent** → write `pre_season_active.json` (with `activated_at` + `season_id`) AND call `suggest_squad(bootstrap, archive, force=True)`
  4. If artifact **present** → skip silently (idempotent)
- **D-03:** `force=True` in `suggest_squad.py` bypasses **blob + local idempotency check only** — skips the "already exists → return early" guard and re-runs the full ILP against the current bootstrap. All other logic (score_map computation, player filtering, ILP solve, `_derive_squad_dict`) runs normally. This overrides the previous-season cached `pre_season_squad.json`.
- **D-04:** `suggest_squad` function signature gains a `force: bool = False` parameter. Callers in the GW38 block continue to call it without `force` (default False). Only the activation block passes `force=True`.

### pre_season_active.json Schema + API (AUTO-02/03)

- **D-05:** `pre_season_active.json` schema:
  ```json
  {
    "activated_at": "2026-08-01T04:12:33Z",
    "season_id": "2526"
  }
  ```
- **D-06:** `season_id` is derived from `events[0].deadline_time`. Take the year component (e.g., `2026`), form `"{year-1}{str(year)[-2:]}"` → `"2526"`. Human-readable, matches FPL's own season naming convention. Computed by `run.py` at write time; also computable client-side from the returned `activated_at` timestamp.
- **D-07:** `/api/pre-season-active` returns **404** when `pre_season_active.json` does not exist. `usePreSeasonActive()` treats `null` data (from a 404) as the "Awaiting" state. Consistent with the `/api/pre-season-squad` 404 pattern already in the codebase.
- **D-08:** `/api/pre-season-active` response shape when active:
  ```ts
  interface PreSeasonActiveResponse {
    activated_at: string  // ISO 8601
    season_id: string     // e.g. "2526"
  }
  ```

### Status Pill in NextSeasonPlannerTab (AUTO-03)

- **D-09:** Status pill lives at the **top of the tab content area**, as a standalone status row — the first element rendered inside `NextSeasonPlannerTab`, before the formation grid. Placement is visually distinct from the Phase 127 solver badge (which is inline with the formation headline).
- **D-10:** Pill styles: zinc background for "Awaiting" (not yet active), green background for "Live" (activated). Match the existing pill size/style used for the solver badge in Phase 127.
- **D-11:** When status is "Awaiting" (pre_season_active.json absent), the rest of the tab still renders — formation grid, health indicator, solver badge all visible. Squad may show previous-season cached data or the "Prices pending" empty state depending on what `/api/pre-season-squad` returns.

### First-Activation Banner (AUTO-03)

- **D-12:** Banner appears **between the status pill row and the formation grid** — inline in the tab flow, not a toast.
- **D-13:** Banner is shown only when: `usePreSeasonActive()` returns active data AND `localStorage['nsp_activation_seen_{seasonId}']` is not set.
- **D-14:** Banner text: `"🏆 Pre-season is live — your squad has been re-optimised against the new FPL prices."`
- **D-15:** Dismiss UI: **× icon in the top-right of the banner**. On click: set `localStorage['nsp_activation_seen_{seasonId}'] = 'true'` → banner disappears and never returns for this season.
- **D-16:** `seasonId` in the localStorage key comes from `usePreSeasonActive()` data (`season_id` field). Hook must return the full `PreSeasonActiveResponse` so the banner can read `season_id` for the key.

### Claude's Discretion
- Exact Tailwind classes for the status pill and banner (follow existing pill/alert patterns in the codebase; green = `bg-green-500/10 text-green-600 dark:text-green-400`; zinc = similar muted variant)
- TanStack Query `staleTime` for `usePreSeasonActive()` (suggest 60 000 ms — same as `usePreSeasonSquad`)
- Whether `pre_season_active.json` write uses `save()` from `upload.py` (consistent with all other pipeline artifacts) — yes, it should
- Error handling in the activation block: non-fatal; log errors and continue, matching the `suggest_squad` and `squad_health` non-fatal wrapper pattern

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pipeline
- `pipeline/run.py` — IS_OFF_SEASON block where activation block is nested (D-01); GW38 gate section for reference (lines ~196–245)
- `pipeline/suggest_squad.py` — idempotency check to refactor for `force` parameter (D-03/D-04); `suggest_squad(bootstrap, archive)` signature
- `pipeline/upload.py` — `save()` helper used for all artifact writes; reuse for `pre_season_active.json` (D-05)

### API Route
- `src/app/api/pre-season-squad/route.ts` — `readBlobOrLocal()` helper to reuse in new route; 404 response pattern (D-07); `USE_BLOB` env var pattern

### Frontend Hooks
- `src/lib/hooks/usePreSeasonSquad.ts` — hook pattern to mirror for `usePreSeasonActive()` (TanStack Query, staleTime, 404→null)

### Frontend Components
- `src/components/next-season/NextSeasonPlannerTab.tsx` — integration point for status pill (D-09), banner (D-12), and `usePreSeasonActive()` call
- `src/lib/types.ts` — add `PreSeasonActiveResponse` type (D-08)

### Requirements
- `.planning/REQUIREMENTS.md` §AUTO-01, AUTO-02, AUTO-03 — locked requirements for this phase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `readBlobOrLocal()` in `src/app/api/pre-season-squad/route.ts` — copy/re-export for new `/api/pre-season-active` route
- `save()` in `pipeline/upload.py` — routes to Blob or local; use for `pre_season_active.json` write
- Solver badge pill (Phase 127) — reuse Tailwind classes for the Awaiting/Live pill

### Established Patterns
- **Idempotency check in suggest_squad.py**: blob list check + local path check; `force=True` should replicate the same dual-path check but skip/bypass rather than return
- **IS_OFF_SEASON block in run.py**: non-fatal try/except wrappers around each step (squad_health, suggest_squad); activation block follows the same pattern
- **Hook 404→null**: `usePreSeasonSquad` returns `null` on 404; `usePreSeasonActive` mirrors this exactly
- **LocalStorage key prefix**: `fplx_` prefix for app storage; `nsp_activation_seen_{seasonId}` deviates slightly — planner should confirm or align

### Integration Points
- `run.py` IS_OFF_SEASON block → add activation sub-block after squad_health section (~line 239–245)
- `suggest_squad.py` `suggest_squad()` function → add `force: bool = False` param; wrap idempotency check in `if not force:`
- `src/app/api/` → new `pre-season-active/route.ts` following pre-season-squad route structure
- `src/lib/hooks/` → new `usePreSeasonActive.ts`
- `NextSeasonPlannerTab.tsx` → add pill at top of return, banner conditional between pill and existing grid content
- `src/lib/types.ts` → `PreSeasonActiveResponse` interface

</code_context>

<specifics>
## Specific Ideas

- Status pill text: `"Awaiting"` (zinc) / `"Live"` (green) — one word each, no icon needed
- Banner text: `"🏆 Pre-season is live — your squad has been re-optimised against the new FPL prices."`
- Banner × button: top-right corner, `onClick={() => { localStorage.setItem('nsp_activation_seen_' + seasonId, 'true'); setDismissed(true); }}`
- `season_id` derivation in Python: `year = int(events[0]['deadline_time'][:4]); season_id = f"{year-1}{str(year)[2:]}"`
- `usePreSeasonActive()` return type: `PreSeasonActiveResponse | null` (null = Awaiting, non-null = Live)

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 128-Pre-Season Auto-Activation*
*Context gathered: 2026-05-19*
