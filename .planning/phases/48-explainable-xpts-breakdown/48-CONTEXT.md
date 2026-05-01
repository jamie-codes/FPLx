# Phase 48: Explainable xPts Breakdown - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Upgrade the existing xPts breakdown from a plain native tooltip to a rich hover card, and extend the component set to satisfy XPT-01's full requirement list: appearance probability, goal contribution, assist contribution, clean sheet probability, bonus points, and minutes risk signal. The CS component uses `cs_prob_1gw` from Phase 47. Breakdown is scoped to the GemTable xPts_1gw cell only.

</domain>

<decisions>
## Implementation Decisions

### Appearance & Minutes Components
- **D-01:** Add `appearance_pts` as an explicit pipeline component. Formula: `start_prob × 2`. Extend `xPts_components_1gw` type with `appearance_pts: number`. Sum invariant: `appearance_pts + goal_pts + assist_pts + cs_pts + bonus_pts = xPts_1gw` (±0.01 rounding tolerance). This satisfies XPT-01 and XPT-02 cleanly — components literally sum to the headline figure.
- **D-02:** `minutes_risk` modifier is NOT added as an additive component — it is a multiplier embedded in `xmins` (start_prob × avg_mins) and cannot be cleanly separated. Satisfy XPT-01's "minutes risk modifier" requirement by showing the existing `MinsRiskBadge` adjacent to the hover card. No new pts row, sum invariant preserved.

### Interaction Design
- **D-03:** Replace the native `title` tooltip on `XPtsCell` with a styled hover card using **CSS-only Tailwind `group-hover`** — no new dependency (Floating UI / Radix out of scope). Desktop: hover reveals a floating panel positioned below the cell. Mobile: `useState` touch-toggle (tap to open/close).
- **D-04:** Reuse the existing `group-hover` pattern already in `XPtsCell` (the compare button uses `opacity-0 group-hover/name:opacity-100`). The hover card extends this pattern as a sibling element.

### DGW Player Breakdown
- **D-05:** DGW players: **show summed breakdown** — sum goal/assist/cs/bonus/appearance_pts across both fixtures in the pipeline and store the aggregated result in `xPts_components_1gw`. Sum invariant remains intact (`components.sum ≈ xPts_1gw`). This is more honest than "unavailable" and more work than the fallback ROADMAP anticipated, but the user confirmed this approach.
- **D-06:** BGW players: **no hover card shown**. `xPts_components_1gw` remains null for BGW players. The existing `XPtsCell` null/zero short-circuit (`if (value === undefined || value === null || value <= 0)`) handles this — no card rendered.

### Breakdown Placement
- **D-07:** Breakdown hover card is **GemTable only** — scoped to the `XPtsCell` component in the xPts_1gw column. PlayerComparisonModal is out of scope for this phase. XPT-01's "any player" requirement is satisfied by the GemTable which shows all players.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Explainable xPts Breakdown — XPT-01, XPT-02, XPT-03, XPT-04
- `.planning/ROADMAP.md` §Phase 48 — goal, success criteria, phase notes (appearance_pts resolution, sum-of-components rule, DGW handling)

### Pipeline (Python)
- `pipeline/merge.py` — `_xpts_ngw()`: where `xPts_components_1gw` is computed. Currently returns `{total, goal_pts, assist_pts, cs_pts, bonus_pts}` — extend with `appearance_pts`. DGW: `first_gw_components` dict exists; extend to accumulate all fixtures.
- `pipeline/merge.py` — `_cs_prob_1gw_for_fixtures()` (Phase 47): already returns fixture-adjusted CS% — `cs_pts` in the breakdown already uses this.

### TypeScript / UI
- `src/lib/types.ts` — `MergedPlayer.xPts_components_1gw` (line ~149): extend with `appearance_pts: number`.
- `src/components/gem-table/columns.tsx` — `XPtsCell` (line ~23): replace `title` tooltip with group-hover styled card. `components` prop type must also include `appearance_pts`.
- `src/components/shared/MinsRiskBadge.tsx` — existing badge to render adjacent to hover card for D-02 minutes risk signal.

### UI Pattern Reference
- `src/components/gem-table/columns.tsx` line ~64–71: `group-hover/name:opacity-100` pattern (existing compare button) — exact pattern to reuse for hover card visibility.
- `src/components/gem-table/PlayerComparisonModal.tsx` — NOT in scope for this phase, referenced only to confirm the breakdown does NOT extend here.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `xPts_components_1gw` type + pipeline write: already ships goal/assist/cs/bonus. Adding `appearance_pts` is an additive extension — no breaking change.
- `XPtsCell` group-hover infrastructure: already uses Tailwind `group` on the wrapper — adding a hover card as an `absolute` child follows the same pattern as the compare button.
- `MinsRiskBadge`: existing component, no new code needed for D-02.
- `first_gw_components` dict in `_xpts_ngw()`: accumulates the first fixture's component totals. For DGW, extend the accumulation loop to sum all fixtures' components before assigning to `xPts_components_1gw`.

### Key Constraints
- **Sum invariant (XPT-02):** `appearance_pts + goal_pts + assist_pts + cs_pts + bonus_pts` must equal `xPts_1gw` within ±0.01. Pipeline must compute and store the rounded sum as the canonical total — do NOT show both component-sum and headline independently.
- **CS source (XPT-03):** The `cs_pts` component already uses `_cs_prob(defensive_difficulty, xmins)` which is the Phase 47 fixture-adjusted value. No change needed for XPT-03 — it is architecturally satisfied.
- **appearance_pts formula:** `start_prob × 2`. The pipeline already has `start_prob` available when computing `xmins` — add `appearance_pts = round(start_prob * 2, 3)` alongside the other components.
- **Mobile touch toggle:** `XPtsCell` will need a `useState(false)` `open` flag and an `onClick` handler on the cell wrapper to toggle visibility on mobile, layered on top of the CSS hover.

</code_context>

<specifics>
## Specific Details

- Hover card row layout: label (left, muted) + value (right, monospaced). Rows: Appearance / Goals / Assists / Clean sheet / Bonus / ─── / Total. Show MinsRiskBadge below the card if player has a risk signal.
- CS component label: "Clean sheet" (not "CS%"). Tooltip on that row if needed: "Fixture-adjusted CS probability × CS pts value."
- DGW hover card: no special label needed — the summed components just render normally. The existing DGW badge on the player row already signals it's a double gameweek.
- BGW: `xPts_components_1gw` is null → no hover card, cell shows "0.0" per existing short-circuit.
- The hover card replaces the native `title` attribute entirely — remove the `title` prop from `XPtsCell` once the styled card is live.

</specifics>

<deferred>
## Deferred Ideas

- Breakdown in PlayerComparisonModal — user confirmed out of scope; can be added in a later phase once the hover card component is stable.
- xPts breakdown for 3GW and 5GW horizons — REQUIREMENTS.md §Future Requirements already deferred this.

</deferred>

---

*Phase: 48-Explainable-xPts-Breakdown*
*Context gathered: 2026-05-01*
