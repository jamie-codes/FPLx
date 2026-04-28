# Phase 31: Captaincy Ceiling - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a dedicated `CaptainPicks` panel to the Gems tab that surfaces two pre-computed captain recommendations per GW: a **ceiling pick** (highest 90th-percentile xPts player globally) and an **EO-adjusted pick** (highest 90th-percentile xPts player with ownership below a template threshold). All computation happens in the pipeline — the UI reads two pre-classified fields. No squad-awareness needed; no new data sources; depends on Phase 28 xPts variance and Phase 30 ownership data already in `merged_players.json`.

</domain>

<decisions>
## Implementation Decisions

### UI Location (CAP-03, CAP-04)

- **D-01: Dedicated captain panel on the Gems tab.** A card/panel on the Gems tab (styled like `ClubFormTable` or `SetPieceTakerPanel`) showing two named picks side-by-side or stacked. **Not** a GemTable column and **not** on the Planner tab. The panel sits on the Gems tab because captaincy is a player-selection decision, not a transfer-plan decision.
- **D-02: Two picks, no shortlists.** One ceiling pick and one EO pick displayed. Single recommendation per type — actionable and decisive. No ranked top-3 list.
- **D-03: Panel data per pick:** player name, price (`now_cost` formatted as £X.Xm), `xPts_1gw` (the ceiling / expected score), ownership % (`selected_by_percent`). Optionally: position badge (MID/FWD). No history sparklines or component breakdown needed at this phase.

### Ceiling Pick Algorithm (CAP-03)

- **D-04: Ceiling pick = player with highest `xPts_90th_1gw`.** Phase 28 already computes `_sigma_1gw` per player. The 90th-percentile ceiling is `xPts_1gw + 1.28 * sigma_1gw` (Poisson approximation; 1.28 = z-score for 90th percentile). Pipeline selects the player with the maximum `xPts_90th_1gw` across all available players (`status == 'a'`). Unavailable players (injured/suspended) are excluded — same `status == 'a'` gate as DIFF.
- **D-05: Formula for xPts_90th_1gw:** `xpts_1gw + 1.28 * sigma_1gw`. This field is already a partial (sigma is stored as `_sigma_1gw` in Phase 28 but not persisted to JSON). Pipeline needs to compute `xPts_90th_1gw = xPts_1gw + 1.28 * _sigma_1gw` during the ceiling pass and store it as a new field on each player dict.

### EO-Adjusted Pick Algorithm (CAP-04)

- **D-06: EO pick = highest `xPts_90th_1gw` player with `selected_by_percent < 25.0`.** The threshold 25% is the "template ownership" boundary — players above this are likely captained by a large chunk of the field. If the ceiling pick already has ownership < 25%, the EO pick may be the same player (that's valid — low-owned and high-ceiling is ideal). Pipeline uses `_safe_float(selected_by_percent, 0.0) < 25.0` as the ownership gate.
- **D-07: Status gate for EO pick:** same as ceiling — `status == 'a'` required. An injured player's ownership is irrelevant.
- **D-08: If no player has ownership < 25% after filtering (edge case), raise the threshold to 35% and retry. If still no candidate, fall back to the ceiling pick (EO pick = ceiling pick with a note).** This handles hypothetical GWs where every top player is heavily template.

### Pipeline Output Format

- **D-09: Two new top-level fields in `merged_players.json` are NOT the right structure.** Since ceiling/EO picks are GW-level aggregates (two players, not per-player fields), they belong in a separate `pipeline/cache/captain_picks.json` file. This keeps `merged_players.json` clean and avoids adding a boolean flag to every player's record.

  `captain_picks.json` structure:
  ```json
  {
    "generated_at": "ISO timestamp",
    "gameweek": 30,
    "ceiling": {
      "id": 123,
      "name": "Bukayo Saka",
      "team": "ARS",
      "position": "MID",
      "now_cost": 91,
      "xPts_1gw": 7.8,
      "xPts_90th_1gw": 9.2,
      "selected_by_percent": "12.4"
    },
    "eo_adjusted": {
      "id": 456,
      "name": "Ollie Watkins",
      "team": "AVL",
      "position": "FWD",
      "now_cost": 86,
      "xPts_1gw": 6.5,
      "xPts_90th_1gw": 7.9,
      "selected_by_percent": "8.1",
      "eo_threshold_used": 25.0
    }
  }
  ```

- **D-10: New pipeline function `_compute_captain_picks(result: list) -> dict`.** Runs as a post-loop pass in `merge_players()`, after the differential-flag block (Phase 30) and the xPts ceiling classification block (Phase 28). Returns the dict written to `captain_picks.json`.

- **D-11: `xPts_90th_1gw` is also stored per-player in `merged_players.json`.** Even though the panel reads from `captain_picks.json`, storing 90th-percentile ceiling per player in the main JSON enables future sorting/filtering in GemTable (Phase 32+). Add `xPts_90th_1gw` to each player dict alongside `xPts_1gw`.

### Frontend Integration

- **D-12: New React hook `useCaptainPicks()`.** Fetches `/pipeline/cache/captain_picks.json` (same pattern as `usePlayers()` fetches `merged_players.json`). Returns `{ ceiling, eo_adjusted, isLoading, error }`.
- **D-13: New component `CaptainPicksPanel.tsx` in `src/components/captain/`.** Renders two pick cards. On mobile portrait: stack vertically. On landscape/desktop: side-by-side. Panel is not hidden on mobile — captain picks are a primary GW decision.
- **D-14: Panel placement on Gems tab:** renders below the `GwToggle` + `GemTable` block and above the footer, or above GemTable in a collapsible section. Claude decides exact placement relative to existing page structure.

### Claude's Discretion

- Exact visual design of the pick cards (icon choice for "ceiling" vs "EO", color treatment, label wording)
- Whether `xPts_90th_1gw` is exposed as a sortable GemTable column (likely out of scope for Phase 31; can be added in Phase 32)
- Whether the panel shows a tooltip explaining what "ceiling" and "EO-adjusted" mean (recommended: yes, using native `title` attribute per project convention)
- Edge case where ceiling pick == EO pick: show both cards with the same player; EO card notes "also low-owned"

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pipeline patterns to follow
- `pipeline/merge.py` — `_compute_differential_flag()` (lines 386–414) for the post-loop helper pattern. `_compute_captain_picks()` follows identical placement: after the differential-flag block, before or after the xPts ceiling classification block.
- `pipeline/merge.py` — `_compute_regression_signal()` (lines 331–380) for the helper-before-`merge_players()` placement convention.
- `pipeline/merge.py` — `_safe_float()` (lines 7–11) for safe ownership cast.
- `pipeline/run.py` — where `merged_players.json` is written; add parallel write of `captain_picks.json` in the same step.

### xPts variance data (Phase 28)
- `pipeline/merge.py` — search for `_sigma_1gw` to find where sigma is computed and attached to player dicts. The ceiling formula needs `_sigma_1gw`.
- `.planning/phases/28-xpts-engine/28-01-SUMMARY.md` — xPts component breakdown and sigma computation details.

### Frontend patterns to follow
- `src/hooks/usePlayers.ts` — hook pattern for fetching pipeline cache JSON; replicate for `useCaptainPicks()`.
- `src/components/gem-table/RegressionSignalBadge.tsx` — `'use client'` + named export + native title attribute convention.
- `src/components/set-pieces/SetPieceTakerPanel.tsx` — standalone panel component on Gems tab for structural reference.
- `src/app/page.tsx` (or equivalent Gems tab layout) — where to insert `CaptainPicksPanel` in the render tree.

### Types
- `src/lib/types.ts` — `MergedPlayer` interface; add `xPts_90th_1gw?: number` field.
- Create `src/lib/types.ts` — new `CaptainPick` and `CaptainPicks` interfaces for `useCaptainPicks()` return type.

</canonical_refs>

<code_context>
## Reusable Assets

- **`usePlayers()` hook pattern** (`src/hooks/usePlayers.ts`) — fetch + parse `merged_players.json` from pipeline cache. `useCaptainPicks()` replicates this pattern for `captain_picks.json`.
- **`_compute_differential_flag()` + post-loop block** (Phase 30, `pipeline/merge.py`) — the structural analog for `_compute_captain_picks()`: a post-loop helper that scans the full `result` list and returns a dict written to a separate file.
- **`SetPieceTakerPanel`** — standalone panel component structure on Gems tab.
- **`_safe_float()` helper** — already available for safe ownership cast.
- **Phase 28 sigma fields** — `_sigma_1gw`, `_sigma_3gw`, `_sigma_5gw` already computed per player in `merge_players()`; ceiling formula uses `_sigma_1gw`.

</code_context>
