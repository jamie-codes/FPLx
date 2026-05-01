# Phase 47: Fixture Swing Detector & Clean Sheet Probability - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver two foundation signal engines: (1) a Fixture Swing Detector panel that classifies teams as improving or worsening fixture runs and highlights owned players within those teams, and (2) a `cs_prob_1gw` field surfaced as a GemTable column for GK/DEF-relevant defensive picks. Both outputs feed downstream phases 48, 49, and 51.

</domain>

<decisions>
## Implementation Decisions

### Swing Threshold & Team Cap
- **D-01:** Threshold confirmed at **0.20 ease delta** (`upcoming_N_ease - past_3_ease ≥ 0.20` for improving; ≤ -0.20 for worsening). No change from ROADMAP recommendation.
- **D-02:** Team cap confirmed at **4 improving + 4 worsening** (8 rows max). Only teams above/below threshold are shown; if fewer than 4 qualify in either direction, show what exists.

### Swing Calculation (pure TypeScript)
- **D-03:** Swing is computed **entirely in TypeScript** — extend `computeClubForm()` in `src/lib/club-form.ts` to also compute `past_ease_3gw` from `finished=true` fixtures. The `meanEase()` helper is reused on the past-fixture subset.
- **D-04:** Past window is **fixed at 3 GWs** regardless of the GW selector. The GwToggle (1/3/5) controls only the *upcoming* window. Swing delta: `upcoming_ease_N - past_ease_3`.
- **D-05:** DGW grouping: group fixtures by `event` (gameweek ID) before computing ease averages to avoid double-counting DGW matches. BGW teams that have no upcoming fixtures show `null` swing (excluded from the panel).

### Swing Panel Placement & Squad Highlight
- **D-06:** The `FixtureSwingDetector` panel lives on the **Club Form tab**, below the existing `FixtureEaseRankingPanel`. No nav changes required.
- **D-07:** Squad personalisation (SWG-04) uses the **badge count + expand pattern** — identical to the existing TARGET expand in `FixtureEaseRankingPanel`. Show "You own N" badge next to the team name; click to expand an inline player list showing owned players from that team (name, position, xPts_1gw).

### CS% Display Surface
- **D-08:** CS% is surfaced as a **`cs_prob_1gw` column in GemTable** — not a separate panel. GK/DEF rows show the percentage; MID/FWD rows show em-dash. DGW players show combined CS% using `1 - (1-p1)*(1-p2)`.
- **D-09:** Column is **hidden by default** — included in the **Analysis preset** column set (PRESET_COLUMN_VISIBILITY). Not visible in Default or Compact presets.
- **D-10:** `cs_prob_1gw` must be added to `merged_players.json` via `pipeline/merge.py` (~5 lines in `_xpts_ngw()` or similar). The raw per-fixture `_cs_prob(defensive_difficulty, xmins)` already exists — this just exposes the value as a top-level field. BGW players: `cs_prob_1gw = 0` (no fixture, no CS chance).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Clean Sheet Probability — CS-01, CS-02, CS-03 (7 requirements for this phase)
- `.planning/REQUIREMENTS.md` §Fixture Swing Detector — SWG-01, SWG-02, SWG-03, SWG-04
- `.planning/ROADMAP.md` §Phase 47 — goal, success criteria, phase notes (swing threshold, DGW grouping, BGW handling, cs_prob_1gw scope)

### Pipeline (Python)
- `pipeline/merge.py` — `_cs_prob(defensive_difficulty, xmins)` (lines ~122–137): existing CS% formula. `_xpts_ngw()`: where `cs_prob_1gw` field addition goes. `_compute_difficulty_scores()`: where `attacking_difficulty` / `defensive_difficulty` per fixture originates.

### TypeScript Engine
- `src/lib/club-form.ts` — `computeClubForm()` and `meanEase()`: extend here to add `past_ease_3gw` from `finished=true` fixtures and the `swing_Ngw` delta fields on `ClubForm`.
- `src/lib/types.ts` — `MergedPlayer` (add `cs_prob_1gw?: number`) and `ClubForm` (add `past_ease_3gw`, `swing_1gw`, `swing_3gw`, `swing_5gw`).

### UI Patterns to Reuse
- `src/components/club-form/FixtureEaseRankingPanel.tsx` — TARGET badge + expand-on-click pattern (D-07 reuses this exactly). `EaseBar`, `AttDefToggle`, `GwToggle` components available.
- `src/components/gem-table/GwToggle.tsx` — `PRESET_COLUMN_VISIBILITY` map (D-09: add `cs_prob_1gw` to the Analysis preset here).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `_cs_prob(defensive_difficulty, xmins)` in `pipeline/merge.py`: already computes per-fixture CS probability. Adding `cs_prob_1gw` to pipeline output is ~5 lines.
- `meanEase(fixtures, n, key)` in `src/lib/club-form.ts`: reuse with `finished=true` filter to compute `past_ease_3gw`.
- `FixtureEaseRankingPanel.tsx` expand-on-click pattern (TARGET badge): copy this interaction for D-07 squad highlight.
- `GwToggle` + `AttDefToggle`: already imported in `FixtureEaseRankingPanel`, available for `FixtureSwingDetector`.
- `PRESET_COLUMN_VISIBILITY` in `GwToggle.tsx`: add `cs_prob_1gw` to the Analysis preset object here.

### Established Patterns
- Pipeline output fields follow `merged_players.json` schema; new fields added in `_xpts_ngw()` or dedicated per-player loop.
- New panels on Club Form tab: mounted as children in the Club Form tab render in `page.tsx` or its tab component — check where `FixtureEaseRankingPanel` is mounted and add `FixtureSwingDetector` directly after it.
- Column visibility: all new GemTable columns must be added to `MOBILE_HIDDEN_COLUMNS` and `PRESET_COLUMN_VISIBILITY` in `GwToggle.tsx`.

### Integration Points
- `ClubForm` type extension: `past_ease_3gw`, `swing_1gw`, `swing_3gw`, `swing_5gw` fields feed `FixtureSwingDetector` component.
- `MergedPlayer.cs_prob_1gw` field: feeds GemTable CS% column and Phase 48 (xPts breakdown CS component).
- `useClubForm` hook: already serves `ClubForm[]`; `FixtureSwingDetector` consumes the same hook — no new API route needed.
- `usePlayers` hook: `FixtureSwingDetector` needs player data for SWG-04 squad highlight — same pattern as `FixtureEaseRankingPanel` which already imports both `useClubForm` and `usePlayers`.

</code_context>

<specifics>
## Specific Ideas

- Squad highlight: render identically to the existing TARGET badge + expand in `FixtureEaseRankingPanel` — the user confirmed this pattern. Badge label: "You own N" (not "TARGET"). Only appears when a squad is loaded (team ID present).
- CS% column header: "CS%" (short). Tooltip: "Clean sheet probability for next fixture, derived from rolling xGA." For DGW players: show combined CS% `1-(1-p1)(1-p2)`.
- BGW players: `cs_prob_1gw = 0` in pipeline; GemTable CS% column shows "0%" for BGW players (not em-dash, since 0% is the correct meaningful value).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 47-Fixture-Swing-Detector-CS-Probability*
*Context gathered: 2026-05-01*
