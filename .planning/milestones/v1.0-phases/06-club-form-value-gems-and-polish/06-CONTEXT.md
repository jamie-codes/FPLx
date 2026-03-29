---
phase: 06-club-form-value-gems-and-polish
type: context
created: 2026-03-29
---

<objective>
Supporting analytics views (club form, value gems, price trends) and UI polish (fixture difficulty badges, last-updated timestamp) to make the app complete for daily use.
</objective>

<decisions>

## Club Form Table (FFA-03)

- **Rolling window:** Last 5 games — aligns with standard FPL form horizon
- **Placement:** New dedicated "Club Form" tab in the main nav (alongside Gem Ratings / DefCon / Squad & Transfers)
- **Stats per club row:** Wins, Draws, Losses, Goals Scored, Goals Conceded over last 5 finished fixtures — computed server-side from `pipeline/cache/fpl_fixtures.json` (309 finished fixtures available)
- **Route:** New `/api/club-form` Route Handler — reads `fpl_fixtures.json` and `fpl_bootstrap.json` from cache, computes rolling form, returns array of ClubForm objects
- **Sortable:** Yes — TanStack Table, sortable by any column (same pattern as GemTable / DefConTables)

## Value Gems View (VAL-01, VAL-02)

- **Placement:** New "Value Gems" tab in main nav
- **Sub-filters within the tab:** Two filter pills — "Cheap (£6m-)" and "Low-owned (<10%)"
  - "Cheap" = `now_cost / 10 <= 6.0`
  - "Low-owned" = `parseFloat(selected_by_percent) < 10`
  - Filters are independent — user can toggle between them (or show players matching either)
- **Data source:** `usePlayers()` hook already available — no new API needed; `computeAllGemScores` already runs on players data
- **Columns:** Player name, Position, Team, Price (approx), Ownership %, Recent Points (`total_points`), Gem Score, Price Trend (see below)
- **Default sort:** Gem Score descending within the selected filter

## Price Trend (VAL-03)

- **Data fields:** `cost_change_event` (this GW, tenths of £1m) and `cost_change_start` (since season start, tenths of £1m) — both already in FPL bootstrap
- **Display format:** Arrow + amount: `↑ 0.1m` (green), `↓ 0.1m` (red), `—` (grey) for no change
  - Threshold for stable: `cost_change_event === 0`
  - Show this-GW change as the primary indicator; season-total as a secondary sub-text
- **Views that show price trend:** Gem Ratings table, Value Gems view, Squad & Transfers tab
- **Pipeline change needed:** `cost_change_event` and `cost_change_start` must be passed through `merge.py` into `merged_players.json` (currently not included — needs adding to MergedPlayer type)

## Fixture Difficulty Badges (UIX-03)

- **Fixtures per row:** Next 5 upcoming fixtures
- **Badge style:** Coloured mini chips — `[OPP H]` or `[OPP A]` using team short name + home/away indicator
  - Colour: green = easy, amber = medium, red = hard (using existing `difficulty_tier` from merged data)
  - Each player already has `fixtures: FixtureEntry[]` with `difficulty_tier`, `difficulty_score`, `is_home`, and opponent team data
- **Views that get badges:** Gem Ratings table, Value Gems view, Club Form table (upcoming fixtures column per club)
- **Implementation:** Reusable `<FixtureBadges fixtures={player.fixtures.slice(0, 5)} />` component in `src/components/fixtures/`

## Last-Updated Timestamp (DAT-02)

- **Source:** `last_updated.json` already written by pipeline with ISO timestamp and `stale: boolean`
- **Display:** Small footer/header line on every data view — "Data as of {date} {time}" — amber/grey if stale
- **Route:** Already serving from pipeline cache; just needs a UI component reading from `/api/fpl/last-updated` or a shared hook
- **Placement:** Visible on all tabs (persistent header or per-tab footer)

</decisions>

<canonical_refs>
- .planning/REQUIREMENTS.md — FFA-03, VAL-01, VAL-02, VAL-03, UIX-03, UIX-04, DAT-02
- .planning/PROJECT.md — Core value, constraints, out-of-scope
- src/lib/types.ts — MergedPlayer, FixtureEntry, ScoredPlayer types (need cost_change fields added)
- src/components/gem-table/GemTable.tsx — TanStack Table pattern to follow for club form and value gems
- src/components/defcon/DefConTables.tsx — Position-split table pattern reference
- pipeline/merge.py — Where cost_change_event/cost_change_start need to be added to merged output
- pipeline/cache/fpl_fixtures.json — Source for club form computation (309 finished fixtures)
- pipeline/cache/fpl_bootstrap.json — Source for price change fields and team data
</canonical_refs>

<specifics>
- Club form window = 5 games (not configurable in v1)
- Cheap threshold = £6.0m (now_cost / 10 <= 6.0)
- Low-owned threshold = 10% (selected_by_percent < 10)
- Price trend: arrow + GW amount primary, season total secondary
- Fixture badges: next 5, coloured chips with opponent short name + H/A
- All new tabs follow existing page.tsx tab pattern (zinc styling, border-b active indicator)
</specifics>

<deferred>
- User-adjustable price/ownership sliders (added complexity, out of scope for v1)
- Club form inline within other tabs (kept as own tab for cleanliness)
- Live price change predictions (requires transfer volume analysis — out of scope)
</deferred>
