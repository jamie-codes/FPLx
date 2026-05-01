# Phase 28: xPts Engine - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the heuristic `proj_pts` display in GemTable with a statistically grounded xPts model (Poisson for goals/assists, Bernoulli for CS/minutes) and surface a component breakdown tooltip plus a variance badge inline with the xPts cell. The pipeline emits both `proj_pts_*` (unchanged, for all existing consumers) and new `xPts_*` fields. GemTable is the only UI surface touched in this phase.

</domain>

<decisions>
## Implementation Decisions

### xPts / proj_pts Relationship (DATA-02, XPTS-01)

- **D-01:** Pipeline emits **both** sets of fields: existing `proj_pts_1gw`, `proj_pts_3gw`, `proj_pts_5gw` (unchanged) **and** new `xPts_1gw`, `xPts_3gw`, `xPts_5gw`. No consumers of `proj_pts_*` are modified in this phase.
- **D-02:** GemTable "Proj Pts" columns are **renamed to "xPts"** and backed by the new model. The columns remain in the same position; only the label and data source change.
- **D-03:** `proj_pts_*` continues to power: TransferPanel, PlannerTab (planning engine), captaincy engine, replacement shortlist. Full migration of those consumers is out of scope for Phase 28.

### GW Windows (XPTS-01)

- **D-04:** Pipeline emits `xPts_1gw`, `xPts_3gw`, `xPts_5gw` — one field per GW window — matching the existing `proj_pts` pattern.
- **D-05:** GemTable uses the **existing shared `GwToggle.tsx` state** (1 / 3 / 5 GW pill). xPts columns hook into the same toggle as `proj_pts` did. No new toggle state.
- **D-06:** DGW handling: same as `_proj_pts_ngw()` — group fixtures by `event_id`, sum per-fixture xPts across all fixtures in the same GW event. BGW handling: no fixture = no contribution (no neutral fill).

### Variance Indicator (XPTS-02)

- **D-07:** Variance indicator is an **icon badge inline with the xPts cell** — ⬆ for high-ceiling (high-variance, boom-or-bust) and = for consistent (low-variance). No separate column.
- **D-08:** Badge appears inside the xPts cell, after the number. A **tooltip on hover** (or tap) explains what the badge means (e.g., "High ceiling — this player's points are highly variable. Good captain pick when chasing rank.").
- **D-09:** Threshold for "high-ceiling" vs "consistent" is Claude's discretion (e.g., top-tercile σ across all players in the dataset). The classification is computed in the pipeline alongside xPts.

### Claude's Discretion

- **Component breakdown display**: User did not select this area — Claude decides. The existing tap-to-expand row pattern (mobile) and column tooltip pattern (desktop) are both established. Recommend: tooltip on the xPts cell showing goal pts / assist pts / CS pts / bonus pts breakdown, consistent with the variance tooltip. Avoids table width impact.
- **xPts model scoring rates**: Use `xg_per90` and `xa_per90` (Understat) as Poisson rate inputs where available. For players with `understat_id = null`, fall back to `goals_scored` / `assists` season totals normalised to per-90 (DQ-01 proxy pattern already established in `gem-score.ts`).
- **CS probability**: Derived from the opposing team's `attacking_difficulty` (Phase 27 output, available in `FixtureEntry.attacking_difficulty`). Bernoulli parameterisation is Claude's choice.
- **Bonus component**: Claude decides (position-adjusted historical bonus expectation, or BPS-rank proxy). Must not double-count with CS — see STATE.md blocker: "CS points and DefCon bonus are correlated; use joint defensive-points model."
- **Variance threshold**: Claude decides what σ percentile constitutes "high-ceiling" (suggestion: top 33% of per-GW σ across all players).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pipeline
- `pipeline/merge.py` — `_proj_pts_ngw()` (lines 104–133, DGW/BGW grouping logic to reuse), `merge_players()` (result dict structure, where new xPts fields slot in at lines 468–470). `_compute_difficulty_score()` and `ROLLING_WINDOW` constants for normalization patterns.
- `pipeline/run.py` — pipeline entry point; shows how `merge_players()` is called and how `merged_players.json` is written.

### TypeScript Types
- `src/lib/types.ts` — `MergedPlayer` interface (lines 90–140, new xPts fields added here); `FixtureEntry` interface (lines 76–84, has `attacking_difficulty` and `defensive_difficulty` from Phase 27 — Phase 28 CS probability reads `attacking_difficulty`).

### UI — GemTable
- `src/components/gem-table/columns.tsx` — existing `proj_pts_1gw`, `proj_pts_3gw`, `proj_pts_5gw` column definitions (lines 86–100 area); xPts columns replace these.
- `src/components/gem-table/GwToggle.tsx` — shared 1/3/5 GW toggle component that xPts columns hook into (same toggle state as proj_pts used).

### Requirements
- `.planning/REQUIREMENTS.md` — DATA-02 (pipeline model), XPTS-01 (GemTable display), XPTS-02 (variance indicator).
- `.planning/ROADMAP.md` — Phase 28 success criteria (3 items).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `_proj_pts_ngw(ppg, start_prob, fixtures, n_gws)` in `pipeline/merge.py` — the DGW/BGW-aware GW grouping loop (group by `event_id`, iterate up to `n_gws` groups). xPts multi-GW computation uses the same grouping structure; replace the inner `ppg * start_prob * difficulty_modifier` line with per-fixture xPts via Poisson/Bernoulli.
- `GwToggle.tsx` — renders 1/3/5 GW pills and exposes selected window state. xPts columns consume the same state as existing proj_pts columns (no changes to the toggle itself).
- `FixtureEntry.attacking_difficulty` — Phase 27 output; already in merged_players.json for each upcoming fixture. This is the input for xPts CS probability (Bernoulli parameter).
- `xg_per90`, `xa_per90` on `MergedPlayer` — existing Understat fields, already null-guarded across the codebase. Use as Poisson rate inputs.
- DQ-01 proxy pattern in `src/lib/gem-score.ts` — when `xg_per90` is null, use FPL `goals_scored`/`assists` normalised to per-90 as proxy. xPts model reuses the same fallback for players with `understat_id = null`.

### Established Patterns
- New pipeline fields added at the same point in the `merge_players()` result dict as `proj_pts_1/3/5gw` (around line 468). Follow the same naming: snake_case, suffixed with `_1gw`/`_3gw`/`_5gw`.
- `MergedPlayer` new fields use `?: number` (optional) during pipeline rollout — same pattern as `attacking_difficulty?: number` added in Phase 27.
- GemTable column accessors follow the existing `col.accessor('field_name', { header: H('Label', 'Tooltip text'), ... })` pattern in `columns.tsx`.
- Mobile column visibility via TanStack `columnVisibility` — xPts and any variance column should follow the existing mobile-hide pattern (check columns.tsx for which proj_pts columns are currently hidden on mobile).
- Cell tooltip pattern: look at existing `H()` header tooltips and any cell-level tooltip usage in GemTable for the breakdown tooltip approach.

### Integration Points
- `merge_players()` result dict: gains `xPts_1gw`, `xPts_3gw`, `xPts_5gw` (floats), `xPts_components_1gw` (dict with `goal_pts`, `assist_pts`, `cs_pts`, `bonus_pts`), `xPts_variance_1gw` (float σ), and a derived `xPts_ceiling` boolean (high-ceiling flag, precomputed for UI efficiency).
- `MergedPlayer` interface: gains the above fields (optional during rollout).
- GemTable `columns.tsx`: proj_pts accessor strings changed from `proj_pts_*` to `xPts_*`; column headers updated; variance badge rendered inline in cell renderer.
- No changes to TransferPanel, PlannerTab, captaincy engine, or replacement shortlist — these continue reading `proj_pts_*` unchanged.

</code_context>

<specifics>
## Specific Ideas

- Variance badge style: ⬆ = high-ceiling (Poisson distributions with high λ = high spread), = = consistent. Inline after the number, same cell. Tooltip text distinguishes the two clearly for FPL context ("Good captain pick when chasing rank" vs "Safe floor player").
- xPts in GemTable replaces the label and accessor of the existing Proj Pts columns — not a new set of columns added to an already-wide table.
- STATE.md blocker must be resolved during planning: CS points and DefCon bonus are correlated. The model must not add both independently — use a joint defensive-points distribution or attribute the bonus as part of CS reward only.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 28-xPts Engine*
*Context gathered: 2026-04-28*
