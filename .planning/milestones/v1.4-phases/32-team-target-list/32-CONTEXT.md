# Phase 32: Team Target List - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the Club Form tab with two layers of intelligence: (1) highlight teams with 4+ favourable upcoming fixtures directly within the `FixtureEaseRankingPanel` using a green TARGET badge (TGT-01); (2) clicking a highlighted team row expands inline to show its top 3 players ranked by xGI involvement %, with xPts_1gw, regression_signal (BUY/SELL), and differential_flag (DIFF/TRAP) visible alongside (TGT-02, TGT-03). All computation is client-side — pipeline outputs from Phases 27–30 supply every required field. No new pipeline changes, no new tabs.

</domain>

<decisions>
## Implementation Decisions

### Green Fixture Definition (TGT-01)

- **D-01: "Favourable" = attacking_ease > 0.5.** Uses the normalised 0–1 attacking_ease scale from FDR++ (Phase 27). The midpoint 0.5 is the natural threshold on a min-max normalised scale — teams above it face easier-than-average attacking fixtures.
- **D-02: Always the 5GW window.** The green-run check counts `attacking_ease_per_fixture > 0.5` across the next 5 upcoming fixtures per team. This count is independent of the ATT/DEF/GW toggle state in the existing `FixtureEaseRankingPanel`. A team qualifies as a target if it has 4+ fixtures above 0.5 out of its next 5.
- **D-03: Client-side computation from ClubForm data.** `computeClubForm()` (already called by `useClubForm()`) produces `upcoming_fixtures: ClubFormFixture[]` per team with per-fixture `attacking_difficulty`. The green-run check runs in the component — no new hook, no pipeline change. Formula: `count(f.attacking_difficulty < 0.5 for f in upcoming_fixtures.slice(0,5)) >= 4` — note: `attacking_difficulty` is the raw difficulty; low difficulty = easy fixture (0 = easiest, 1 = hardest). `attacking_ease = 1 - attacking_difficulty`, so equivalently `f.attacking_difficulty < 0.5`.
- **D-04: Visual treatment = green TARGET badge on the team row.** A small green pill labelled `TARGET` appended after the team name in the row. No row background change. Badge is consistent with the project's existing badge style (`text-xs font-normal rounded px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`).

### Player List Structure (TGT-02, TGT-03)

- **D-05: Expand-on-click inside FixtureEaseRankingPanel.** Clicking any TARGET-badged team row toggles an inline expansion showing that team's top players. Non-TARGET teams are not expandable. Uses a simple `expandedTeam: number | null` state local to the panel — no new component tree needed.
- **D-06: Top 3 players per team, ranked by xGI involvement % descending.** Limited to `status === 'a'` players. Three players is the right balance for an inline expansion — actionable without being a long list.
- **D-07: Player columns: Name, Position, xGI%, xPts_1gw, Signal, Diff.** Exactly the six columns needed to satisfy TGT-02 (xGI%, xPts_1gw) and TGT-03 (Signal = regression_signal, Diff = differential_flag). All fields are already in `MergedPlayer` from prior phases.

### xGI Involvement % (TGT-02)

- **D-08: Client-side computation from merged_players.json.** No pipeline changes. The component (or a local utility) groups players by `team_id`, sums `(expected_goals + expected_assists)` per team, then computes each player's share as `(player.expected_goals + player.expected_assists) / teamTotal`. Zero-division guard: if `teamTotal === 0`, the player's xGI% displays as `—`.
- **D-09: FPL `expected_goals` + `expected_assists` fields as the source.** Consistent with Phase 29 D-01 convention (regression_signal also uses FPL StatsBomb xG/xA, not Understat). These fields are present on every player — no nulls that would understate team totals (unlike Understat, which has ~43 unmatched players).

### Claude's Discretion

- Exact label wording for the TARGET badge ("TARGET" vs a bullet/icon)
- Whether the expand toggle is a chevron icon on the row or clicking anywhere on the row
- Mobile behaviour of the expanded player table (recommend horizontal scroll if columns are tight)
- Whether `xgi_involvement_pct` is added as a derived field on `MergedPlayer` by a utility function, or computed inline in the component

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Club Form tab — existing structure
- `src/app/page.tsx` — Club Form tab section (lines 116–120); new TeamTargetList panel or expansion logic inserted here or within FixtureEaseRankingPanel
- `src/components/club-form/FixtureEaseRankingPanel.tsx` — component to extend with TARGET badge and expand-on-click player list
- `src/components/club-form/EaseBar.tsx` — ease visualisation component used in the panel
- `src/lib/hooks/useClubForm.ts` — supplies `ClubForm[]` with `upcoming_fixtures` and `attacking_ease_{1,3,5}gw`
- `src/lib/hooks/usePlayers.ts` — supplies `MergedPlayer[]` with all player fields needed for the inline list

### Types
- `src/lib/types.ts` — `ClubForm` interface (lines 205–236 area): `upcoming_fixtures: ClubFormFixture[]` with per-fixture `attacking_difficulty`; `attacking_ease_5gw` aggregate
- `src/lib/types.ts` — `MergedPlayer` interface: `expected_goals`, `expected_assists`, `xPts_1gw`, `regression_signal`, `differential_flag`, `selected_by_percent`

### Signal and Diff badge patterns (TGT-03)
- `src/components/gem-table/RegressionSignalBadge.tsx` — Signal badge component; reuse for TGT-03 Signal column
- `src/components/gem-table/DifferentialBadge.tsx` — Diff badge component; reuse for TGT-03 Diff column

### Prior phase decisions to respect
- `.planning/phases/29-regression-detector/29-CONTEXT.md` — D-01/D-02: regression_signal uses FPL StatsBomb xG/xA (not Understat); same source used for xGI% in Phase 32
- `.planning/phases/30-differential-tracker/30-CONTEXT.md` — D-10: DifferentialBadge receives `ownership: number` prop for tooltip; replicate when rendering Diff column in the inline player table

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FixtureEaseRankingPanel` — extend directly; already has GwToggle + AttDefToggle + `ranked[]` computation; add `expandedTeam` state and TARGET badge inline
- `RegressionSignalBadge` + `DifferentialBadge` — drop-in reuse for Signal and Diff columns in the player list; no new badge components needed
- `useClubForm()` + `usePlayers()` — both already available; the component can receive players as a prop or call `usePlayers()` directly if co-located

### Established Patterns
- Expand-on-click: `PlayerPickerModal` in planner has row-level interaction; simpler approach is `useState<number | null>` for `expandedTeamId` in the panel
- Badge style: `text-xs font-normal rounded px-2 py-1` envelope with semantic colours (green for positive, amber for caution)
- Mobile column handling: hidden columns via Tailwind `hidden sm:table-cell` on tight columns (Signal/Diff could be hidden on portrait mobile if layout is tight)

### Integration Points
- `src/app/page.tsx` line 116–120: the Club Form tab renders `<FixtureEaseRankingPanel />` then `<ClubFormTable />` — the expand-on-click approach means no changes to `page.tsx`
- `src/lib/types.ts` — may need `xgi_involvement_pct?: number` added to `MergedPlayer` if computed as a derived field; alternatively kept as a local computed value inside the component

</code_context>

<specifics>
## Specific Ideas

- xGI% is "share of team xG+xA" using FPL `expected_goals + expected_assists` (season-to-date) — consistent with regression signal source
- 4+ favourable = `attacking_difficulty < 0.5` across the next 5 upcoming fixtures, checked client-side
- The inline player list is limited to TARGET teams only — non-target teams have no expandable content

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 32-team-target-list*
*Context gathered: 2026-04-28*
