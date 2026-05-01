# Phase 27: FDR++ Pipeline - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Add position-split fixture difficulty (attacking_difficulty and defensive_difficulty) to the pipeline and to `computeClubForm()`, and surface a new Fixture Ease Ranking panel on the Form tab with 1GW/3GW/5GW and ATT/DEF toggles. The existing `difficulty_score` field is unchanged. No new external data sources — plain goals from FPL fixtures only.

</domain>

<decisions>
## Implementation Decisions

### FDR++ Methodology (DATA-01)

- **D-01:** `attacking_difficulty` uses a 6-game rolling goals-conceded average per team — same formula as the existing `difficulty_score`. The `difficulty_score` field is unchanged; `attacking_difficulty` is a new parallel field computed identically.
- **D-02:** `defensive_difficulty` uses a 3-game rolling goals-scored average per team (NOT the existing 6-game window). Shorter window intentional — captures hot-streak teams more reactively.
- **D-03:** Data source is plain goals from FPL fixtures only. No Understat dependency for this metric.
- **D-04:** Both metrics are independently normalized (each 0.0–1.0 on its own scale, with its own min/max across the 20 teams). A 0.8 `attacking_difficulty` means hard to score against relative to all teams; a 0.8 `defensive_difficulty` means hard to keep a CS relative to all teams. They are not comparable to each other numerically.

### Fixture Ease Ranking UI (FIX-01)

- **D-05:** A new "Fixture Ease Ranking" panel is placed **above** the existing ClubFormTable on the Form tab. Prospective (fixture ease) and retrospective (W/D/L form) data are visually separate.
- **D-06:** Each row shows: rank number, team short name, and a colored ease bar (green=easy, red=hard) representing the average ease over the selected GW window.
- **D-07:** GW window toggle uses the same pill-toggle style as the existing 1GW/3GW/5GW toggle in Gem Ratings — reuse existing component/pattern.
- **D-08:** The fixture ease ranking data comes from extending `/api/club-form` (not a new route). `computeClubForm()` in `src/lib/club-form.ts` is extended to return per-team `attacking_ease` and `defensive_ease` arrays (one value per GW window: 1, 3, 5) alongside existing fields.

### Position Toggle Design (FIX-02)

- **D-09:** An ATT/DEF toggle pill lives in the fixture ease panel header, alongside the 1GW/3GW/5GW toggle. Default state: ATT (MID/FWD). ATT uses `attacking_difficulty` for ranking; DEF uses `defensive_difficulty`.
- **D-10:** The ATT/DEF toggle is scoped to the fixture ease panel only. It does not affect the existing ClubFormTable or FixtureBadges below.

### Claude's Discretion

- BGW handling: when a team has no fixture in the selected GW window, exclude missing fixtures from the average (don't penalize or fill with a neutral value).
- Tier thresholds for `attacking_difficulty` and `defensive_difficulty` use the same percentile-based approach as the existing `difficulty_tier` (bottom third = easy, top third = hard).
- The ease bar color uses the same `difficulty_tier` color palette already established in `FixtureBadges` (green = easy, amber = medium, red = hard).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pipeline
- `pipeline/merge.py` — existing `_compute_difficulty_score()`, `_difficulty_tier()`, `ROLLING_WINDOW = 6`, and the team_fixtures dict structure. FDR++ adds `attacking_difficulty` and `defensive_difficulty` to each fixture entry using the same normalization pattern.
- `pipeline/run.py` — pipeline entry point; shows how merge_players is called and how outputs are written.

### UI — Form Tab
- `src/lib/club-form.ts` — `computeClubForm()` function. This is where FDR++ needs to be extended for the UI. Currently only computes goals-conceded difficulty; needs to add goals-scored rolling avg for defensive difficulty.
- `src/components/club-form/ClubFormTable.tsx` — existing Form tab component. New FixtureEaseRankingPanel goes above this.
- `src/app/api/club-form/route.ts` — route that calls `computeClubForm()` and returns JSON. Will return extended response with ease ranking data.

### UI — Patterns to Reuse
- `src/lib/types.ts` lines 72–80 — `DifficultyTier`, `FixtureEntry` type definitions; see how difficulty_score/difficulty_tier are currently typed.
- `src/components/club-form/columns.tsx` — existing ClubFormTable column definitions (do not modify; new panel is a separate component).

### Requirements
- `.planning/REQUIREMENTS.md` — DATA-01, FIX-01, FIX-02 (the three requirements this phase satisfies).
- `.planning/ROADMAP.md` — Phase 27 success criteria (three items).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `_compute_difficulty_score(team_xga, min_xga, max_xga)` in `merge.py` — reuse this exact function for both `attacking_difficulty` (same call) and `defensive_difficulty` (pass goals-scored values instead of xGA).
- `computeClubForm()` in `club-form.ts` — extend this function, don't create a new one. The `teamXga` rolling avg loop is the insertion point for a parallel `teamGoalsScored` loop.
- `DifficultyTier` type and `tier()` function in `club-form.ts` — reuse for tier classification of both new metrics.
- `FixtureBadges` component — established color vocabulary (green/amber/red) that the ease bar should match visually.
- 1GW/3GW/5GW pill toggle — pattern from GemTable; reuse the same component or styling.

### Established Patterns
- `difficulty_score` is always 0.0=easiest, 1.0=hardest. Both new fields follow the same convention.
- `ROLLING_WINDOW = 6` is defined in both `merge.py` and `club-form.ts`. The 3-game goals-scored window should use a named constant (e.g., `OFFENSIVE_ROLLING = 3`).
- `USE_BLOB` env pattern for local/production data routing — already in `club-form/route.ts`, no changes needed.
- Mobile column visibility via TanStack `VisibilityState` — the new ease ranking panel should also handle mobile gracefully.

### Integration Points
- Pipeline: `merge.py` `team_fixtures` dict — each fixture entry gains `attacking_difficulty` and `defensive_difficulty` fields (in addition to existing `difficulty_score`).
- TypeScript types: `FixtureEntry` interface in `src/lib/types.ts` gains two optional new fields.
- `ClubForm` interface in `src/lib/types.ts` gains ease ranking fields (e.g., `attacking_ease_1gw`, `attacking_ease_3gw`, `attacking_ease_5gw`, `defensive_ease_1gw`, `defensive_ease_3gw`, `defensive_ease_5gw`).
- `/api/club-form` response shape expands — backward compatible (adds fields, does not remove or rename existing ones).

</code_context>

<specifics>
## Specific Ideas

- The 3-game window for goals-scored was chosen specifically to be more reactive to hot-streak teams — this is an intentional asymmetry with the 6-game defensive window.
- The ease bar visualization should use the same green/amber/red color palette already established by `FixtureBadges` and `DifficultyTier` — not a new color system.
- ATT defaults to active in the fixture ease panel since most FPL managers are primarily looking for attackers to buy.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 27-FDR++ Pipeline*
*Context gathered: 2026-04-28*
