# Phase 34: Chip Strategy - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a Chip Strategy panel to the Planner tab (above the TransferPlanTable) that shows — for each of the three remaining chips (Bench Boost, Triple Captain, Free Hit) — the optimal upcoming gameweek to play it and an ease-score bar across the next 5 GWs. Chips already played are detected via the FPL history API and shown greyed out with a "Used GW{N}" label rather than hidden. For Free Hit, the panel also includes an expandable player list with the greedy 15-player squad suggestion for the target GW. No new pipeline fields required — fixture ease data comes from the existing ClubForm hook.

</domain>

<decisions>
## Implementation Decisions

### Multi-GW Scoring (CHIP-01, CHIP-02, CHIP-03)

- **D-01: Fixture-ease heuristic — no pipeline change.** For each upcoming GW, score each chip by summing `attacking_difficulty` from ClubForm's `upcoming_fixtures[]` for the relevant players' teams that week. Lower summed difficulty = better week. This avoids a pipeline expansion (no per-GW xPts fields needed).
- **D-02: 5 GW horizon.** Score GW N through N+4 (the next 5 upcoming gameweeks). Consistent with the 5GW window used throughout FDR++ and xPts. Fixture reliability degrades beyond GW+5.
- **D-03: ClubForm hook as data source.** `useClubForm()` already provides `upcoming_fixtures: ClubFormFixture[]` per team with per-fixture `attacking_difficulty`. The chip scorer maps each player's `team_id` to their upcoming fixtures from this data. No new hook, no new API route for fixture data.

### Bench Boost Scoring (CHIP-01)

- **D-04: User's live bench via useSquad(teamId).** The bench players are positions 12–15 from the existing `useSquad(teamId)` hook (already in the app). BB ease score = sum of `attacking_difficulty` for bench players' teams across each GW window. Most accurate because it reflects the actual bench composition.

### Triple Captain Scoring (CHIP-02)

- **D-05: TC ease score = top captain candidate's fixture ease per GW.** Use `xPts_90th_1gw` to identify the top-3 captain candidates (highest ceiling), then score each upcoming GW by the best candidate's fixture ease that week. This reuses the ceiling model from Phase 31 (CAP-03).

### Free Hit Scoring and Suggestion (CHIP-03)

- **D-06: GW + greedy 15-player squad suggestion.** The FH row shows the recommended GW AND an expandable suggested squad for that week. Clicking the FH row expands to reveal the 15-player list (Phase 32 Team Target expand pattern).
- **D-07: Greedy xPts maximisation.** Reuse the planning engine's existing Free Hit greedy logic — picks the highest `xPts_1gw` player per position slot within budget. Re-score by weighting `xPts_1gw` by the target GW's fixture ease for each player's team. No new solver dependency.
- **D-08: FH GW scoring = sum of top-11 attainable xPts for that week's fixtures.** The best FH GW is the one where the optimal greedy squad has the highest total xPts when fixture-ease-weighted. The scoring and squad suggestion are derived together in one pass.

### UI Layout

- **D-09: Panel within Planner tab, above TransferPlanTable.** No new nav tab. Chip Strategy sits at the top of the existing Planner tab, always visible when the user opens Planner. Consistent placement: analytics → plan → squad view (top to bottom).
- **D-10: Always expanded.** No accordion. The panel is compact (3 chip rows + optional FH expansion) — same pattern as CaptainPicksPanel (Phase 31).
- **D-11: Each chip row shows: chip name, recommended GW label, and a 5-cell ease bar.** The ease bar shows relative attractiveness across GW N to N+4 (darker/greener = better). Best GW is highlighted.

### Chip Eligibility

- **D-12: Detect used chips via FPL history API.** Fetch `/api/fpl/entry/{id}/history/` (public, no auth) to get the manager's `chips[]` array. If a chip has a `played_by_entry` entry, it has been used.
- **D-13: Used chips remain visible, greyed out with "Used GW{N}" label.** Not hidden — informational. The user can see when they played each chip. Unused chips show the recommendation normally.

### Claude's Discretion

- Whether the ease bar uses CSS width-proportion or a fixed 5-cell grid
- Exact Tailwind tokens for the ease bar cells (recommend green-intensity scale matching FDR++ colours)
- Whether BB and TC show the top candidate's name alongside the GW recommendation (e.g., "GW36 — Salah has easiest fixture")
- Formation validation logic for the FH greedy squad (GK/DEF/MID/FWD slot counts)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planner tab — existing structure
- `src/components/planner/PlannerTab.tsx` — Planner tab root; new ChipStrategyPanel mounts above TransferPlanTable here
- `src/components/planner/TransferPlanTable.tsx` — existing table immediately below the new panel
- `src/lib/planning-engine.ts` — Free Hit greedy logic to reuse for FH squad suggestion
- `src/components/planner/ChipToggle.tsx` — existing chip UI pattern; `PlannerChip` type and `CHIP_LABELS` are defined in `plan-helpers.ts`
- `src/components/planner/plan-helpers.ts` — `CHIP_LABELS`, `CHIP_CODES` constants

### Hooks and data
- `src/lib/hooks/useSquad.ts` — `useSquad(teamId)` returns `SquadPicksResponse` with `picks[].position` (12–15 = bench); `active_chip`
- `src/lib/hooks/useClubForm.ts` — `useClubForm()` returns `ClubForm[]` with `upcoming_fixtures: ClubFormFixture[]` per team; per-fixture `attacking_difficulty`
- `src/lib/hooks/useCaptainPicks.ts` — analog pattern for `useChipStrategy` hook (useQuery, 6h staleTime skipped here — chip scores are derived client-side from live data)
- `src/lib/squad-adapter.ts` — `SquadPicksResponse`, `SquadPick` types; `active_chip` field

### Types
- `src/lib/types.ts` — `PlannerChip = 'wildcard' | 'freehit' | 'bboost' | '3xc' | null`; `MergedPlayer.xPts_90th_1gw`; `ClubFormFixture.attacking_difficulty`; `MergedPlayer.xPts_1gw`

### FPL history API (chip eligibility)
- FPL endpoint: `/api/fpl/entry/{id}/history/` — `chips[]` array with `name` and `event` fields; public (no auth needed)
- `src/app/api/fpl/[...proxy]/route.ts` — existing FPL proxy route; chip history fetch goes through this

### Phase 32 expand pattern (FH squad display)
- `src/components/club-form/FixtureEaseRankingPanel.tsx` — `expandedTeam: number | null` local state, click-to-expand inline player list — replicate this for FH squad

### Requirements
- `.planning/REQUIREMENTS.md` — CHIP-01, CHIP-02, CHIP-03 definitions
- `.planning/ROADMAP.md` — Phase 34 goal, success criteria, dependencies

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useSquad(teamId)` — bench positions (12–15) already fetched; no new API route needed for BB bench data
- `useClubForm()` — `upcoming_fixtures[]` with per-fixture `attacking_difficulty`; the chip scorer's primary data source
- `planning-engine.ts` Free Hit greedy — `generateFreeHitSuggestions()` or equivalent; adapt with fixture-ease weighting for target GW
- `FixtureEaseRankingPanel.tsx` expand-on-click pattern — replicate `expandedTeam` state for the FH squad list
- `CaptainPicksPanel.tsx` — card-based always-expanded panel pattern; no accordion
- `PlannerChip` type + `CHIP_LABELS` + `CHIP_CODES` — use directly; no new chip type definitions
- Existing FPL proxy `/api/fpl/[...proxy]/route.ts` — route the history API call through this

### Established Patterns
- All prior analytics panels (CaptainPicksPanel, InsightsTab) are always-expanded, no accordion
- Phase 32 expand-on-click: `expandedTeam: number | null` local state, toggles inline child table on row click
- Badge style: `text-xs font-normal rounded px-2 py-1` + colour tokens (green/amber/zinc for HIGH/MEDIUM/LOW)
- Hook pattern: `useQuery` with `queryKey`, `staleTime: 6 * 60 * 60 * 1000` for pipeline-cached data; for client-derived chip scores, compute in component or useMemo (no separate hook needed)

### Integration Points
- `PlannerTab.tsx` — new `ChipStrategyPanel` component mounted at the top, above `TransferPlanTable`
- `teamId` prop/context — already threaded to `useSquad`; available in PlannerTab
- `usePlayers()` — `MergedPlayer[]` with `xPts_1gw`, `xPts_90th_1gw`, `team_id`; needed for TC candidate identification and FH squad greedy pass

</code_context>

<specifics>
## Specific Ideas

- Ease bar visual: 5 cells, one per upcoming GW. Cell fill intensity reflects fixture ease (darker green = easier). Best GW cell highlighted with a distinct border or label.
- BB row: "Best week: GW36 — bench ease 0.74" with 5 ease cells
- TC row: "Best week: GW35 — [Player] ceiling fixture" with 5 ease cells
- FH row: "Best week: GW36 — click to see suggested squad" → expands to 15-player list with Name, Pos, xPts_1gw, ease for that GW

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 34-chip-strategy*
*Context gathered: 2026-04-28*
