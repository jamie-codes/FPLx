# Phase 37: GemTable View Presets - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a three-way preset toggle (Default / Compact / Analysis) to the GemTable that controls which columns are visible. The chosen preset persists while navigating between tabs within a session. No new data columns are introduced — this is purely column visibility management layered on top of the existing `getColumnVisibility` / TanStack `VisibilityState` mechanism.

</domain>

<decisions>
## Implementation Decisions

### Column Sets per Preset

- **D-01 (Compact):** Shows only 5 columns: Player (`web_name`), Pos (`element_type`), Gem (`gem_score`), xPts 1GW (`xPts_1gw`), Risk (`mins_risk`). All other columns hidden. This is the literal GEM-02 requirement.
- **D-02 (Default):** Curated view — hides the 9 granular sub-score columns (`fdr_score`, `form_score`, `xg_per90`, `xa_per90`, `xg_score`, `xa_score`, `ownership_score`, `minutes_score`, `set_piece_score`). Visible: Player, Pos, Price, Team, Gem, xPts (GW-toggle driven), Risk, Signal (`regression_signal`), Diff (`differential_flag`), Fixtures, Own% (`selected_by_percent`), Status, Trend.
- **D-03 (Analysis):** Default set plus `xg_per90` and `xa_per90` (the two raw Understat stats). Does NOT add the normalised score columns (`xg_score`, `xa_score`) — those remain hidden in Analysis too.
- **D-04:** The GW horizon toggle (1GW / 3GW / 5GW) is orthogonal to the preset — it layers on top. In Compact mode, GW horizon still applies (xPts column switches between 1gw/3gw/5gw). No conflict to resolve.

### Control Placement & Style

- **D-05:** Preset toggle lives in the existing sticky controls bar in GemTable, positioned **left of GwToggle**: `[PositionFilter] ··· [Default|Compact|Analysis] [1GW|3GW|5GW]`. No new row, no vertical layout cost.
- **D-06:** Visual style matches GwToggle exactly — segmented button group with shared border, rounded corners, filled active state (`bg-zinc-900 dark:bg-white`, `text-white dark:text-zinc-900`). Reuses the exact same Tailwind classes and pattern.
- **D-07:** Hidden on mobile (`sm:hidden` or `hidden sm:flex`). Mobile already uses `MOBILE_HIDDEN_COLUMNS` for its own column reduction; adding a preset toggle to the cramped mobile sticky bar adds no value.

### State Persistence

- **D-08:** `gemPreset` state is lifted to `page.tsx` and passed as a prop (`preset` + `onPresetChange`) to `GemTable`. This mirrors the `sectionMemory` pattern introduced in Phase 36. GemTable unmounts on tab switch — local state would be lost — so lifting is required for GEM-04.
- **D-09:** Initial value is `'default'`. No reset on tab change — `page.tsx` simply holds the last-selected preset as long as the session is open. No sessionStorage / localStorage needed; session-only persistence is sufficient per GEM-04.

### Claude's Discretion

- Exact prop name (`preset` / `viewPreset` / `gemPreset`) — whichever reads cleanest at the call site.
- Whether to introduce a `type ViewPreset = 'default' | 'compact' | 'analysis'` alias in a shared file or inline it in `page.tsx` and `GemTable` — Claude picks whichever is cleaner.
- Whether to extract a `PresetToggle` sub-component from `GemTable` or keep it inline (like GwToggle, which is its own file) — Claude decides based on complexity.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §GemTable View Presets (GEM-01 through GEM-04) — 4 locked requirements for this phase

### Existing Column Visibility Code
- `src/components/gem-table/GemTable.tsx` — component to modify; sticky controls bar, `columnVisibility` wiring, `VisibilityState` usage
- `src/components/gem-table/GwToggle.tsx` — `getColumnVisibility()` function and `GwToggle` component; preset toggle must match this visual pattern exactly; preset column maps live here or alongside this file
- `src/components/gem-table/columns.tsx` — full column definition list; exact column IDs needed to build preset `VisibilityState` maps

### Navigation & State Ownership (Phase 36 pattern)
- `src/app/page.tsx` — owns `activeSection`, `sectionMemory`; `gemPreset` state is added here; GemTable is rendered at `activeSection !== 'squad' && activeSubTab === 'gems'`
- `.planning/phases/36-navigation-consolidation/36-CONTEXT.md` — sectionMemory / state-in-page.tsx pattern that D-08 mirrors

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GwToggle` component: visual pattern for the preset toggle — same segmented button group, same Tailwind classes (`border`, `rounded`, `overflow-hidden`, `bg-zinc-900 dark:bg-white` for active). Copy-adapt rather than invent.
- `getColumnVisibility(horizon, isMobile)`: returns `VisibilityState`; will be extended or replaced with a function that also accepts `preset` parameter. Existing tests in `GwToggle.test.ts` must continue to pass.
- `MOBILE_HIDDEN_COLUMNS`: the mobile column-hiding record already handles the mobile case; preset logic skips mobile entirely (D-07).

### Established Patterns
- `VisibilityState` from TanStack Table: `Record<string, boolean>` — preset maps are the same type; merge preset map + GW-horizon map before passing to `useReactTable`.
- `hidden sm:flex` / `sm:hidden`: CSS-only breakpoint pattern for desktop/mobile split — use `hidden sm:flex` on the preset toggle wrapper (D-07).
- `aria-pressed` on toggle buttons: GwToggle uses this for accessibility; preset toggle should use the same pattern.

### Integration Points
- `page.tsx` → `GemTable`: new `preset` and `onPresetChange` props added. No other components receive these.
- `getColumnVisibility` in `GwToggle.tsx`: signature changes to accept `preset` (or a new function is exported alongside); the existing export must remain for backward compat with the test file, or the test must be updated.
- `GwToggle.test.ts`: tests cover `getColumnVisibility` — will need updating if the function signature changes.

</code_context>

<specifics>
## Specific Ideas

No specific references cited during discussion — open to standard Tailwind/React approaches consistent with the existing codebase style.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 37-GemTable View Presets*
*Context gathered: 2026-04-29*
