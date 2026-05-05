# Phase 62: MC Rank Simulator & Captain Integration - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Two distinct client-side deliverables — no new pipeline work:

1. **Rank trajectory simulator** — A new Plan sub-tab (4th: Planner / Manual Plan / Route Tree / Rank Sim) with a Recharts fan chart showing the current XI's projected cumulative GW score over 5 GWs (mean line + p10–p90 confidence band), plus P(rank gain) and P(rank drop) stats. User can define a one-transfer alternative XI via two dropdowns (sell from squad, buy from full player pool) to compare trajectories side-by-side on the same chart.

2. **MC captain labels** — Augment `CaptainPicksPanel`'s candidate rows with MC-derived labels ("Highest ceiling", "Lowest floor", "Best P(haul)") assigned via priority cascade (one label per player, three max). A TC recommendation callout ("TC: Salah — 41% P(haul)") surfaces below the existing EO mode toggle.

Depends on Phase 61 MC fields: `blank_prob`, `haul_prob`, `p10_pts`, `p90_pts` per player (1-GW, written to `merged_players.json`). The fan chart extrapolates to 5 GWs using the 1-GW distribution per player. Requires one new `useEntryRank` hook (fetches public FPL entry endpoint for `summary_overall_rank`).

</domain>

<decisions>
## Implementation Decisions

### Rank Model
- **D-01:** Fetch user's live rank from the public FPL entry endpoint via the existing FPL proxy: `GET /api/fpl/entry/${teamId}/` → `summary_overall_rank`, `summary_overall_points`. No auth required — same pattern as `useRivals` (Phase 58). Implement as a new `useEntryRank(teamId)` hook (~15 lines, 5-min staleTime). Enabled only when teamId is provided; degrades to prompt when squad not loaded (SC-05).
- **D-02:** Display: Current rank as context header, P(rank gain) and P(rank drop) as the two primary probability stats. No P(top-10k) — too hard to model honestly without real population distribution data.
- **D-03:** Beat-the-average heuristic: P(rank gain) = P(simulated XI score > FPL GW average). P(rank drop) = P(simulated XI score < FPL GW average). These are complementary; show both.
- **D-04:** FPL GW average (`events[N].average_entry_score`) — check during research whether this is available from the existing data path. If not in `usePlayers`, add it as a metadata field to the `/api/players` response (small pipeline addition: read from bootstrap in `run.py`, write `gw_average_pts` at the top level of `merged_players.json`). This is the minimal pipeline touch needed.

### 5-GW Trajectory Chart
- **D-05:** Use **Recharts** (new npm dependency) for the fan chart — `AreaChart` with upper/lower confidence band lines (`<Area>` for mean, `<Area>` for p10–p90 band). No existing chart library in the codebase.
- **D-06:** Chart shows **cumulative** projected score over 5 GWs. X-axis: GW+1 through GW+5. Y-axis: cumulative points. Mean line = cumulative sum of (XI total xPts_1gw × N). For GW+1 the MC-derived floor/ceiling are used; for GW+2–5, the same per-GW distribution is repeated (independence assumption, explicitly noted in UI as "estimate").
- **D-07:** Confidence band computed analytically (no client-side simulation). Per-player σ estimated from p10/p90 assuming normal distribution: `σ_player = (p90_pts - p10_pts) / 2.56` (two-tailed 90% interval). For the XI squad total, sum variances: `σ_XI = √(Σ σ_player²)`. Captain's contribution is doubled in both mean and variance (`σ_captain` × 2). After N GWs, band = `cumMean ± √N × σ_XI`.
- **D-08:** BGW players in squad: p10=0, p90=0 per Phase 61 (blank_prob=1.0 already set). Their contribution to mean and variance is zero for that GW. For the 5-GW trajectory, use their existing 1-GW data as-is.
- **D-09:** Captain selection for the score computation: use the current captain from the squad picks (same player as `useSquad` returns). Double their mean and σ contribution. If no squad loaded, show degraded state (SC-05).

### Alternative XI UX
- **D-10:** Alternative XI is a **transfer scenario** — user replaces one owned player with a player not currently in their squad. Compares: "current XI" vs "XI with [buy] instead of [sell]". Uses the full `usePlayers` player pool for the buy side.
- **D-11:** Two dropdowns: (1) **Sell** — shows the user's current squad (position-filtered after user picks a sell target); (2) **Buy** — shows all available players at the same position, sorted by xPts_1gw descending, excluding players already in squad. Affordability shown in the buy dropdown (flag players user can't afford based on bank + sell price).
- **D-12:** One transfer at a time only. Compare current XI vs 1-transfer XI. Multi-transfer comparisons belong in Route Tree / Manual Planner.
- **D-13:** Both trajectory lines shown on the same Recharts chart: current XI (solid line, zinc/dark) vs alternative XI (dashed line, amber/highlight). Confidence bands rendered for both or only for current XI (researcher to decide based on visual clarity — likely current XI only to avoid chart clutter).

### Placement
- **D-14:** Rank simulator is a **4th Plan sub-tab**: `Planner | Manual Plan | Route Tree | Rank Sim`. Consistent with the planning theme (future scenario comparison). No Squad sub-tab — that section already has 5 tabs.
- **D-15:** Sub-tab label: `'Rank Sim'` (short enough for mobile; full name "Rank Simulator" in desktop header). Mobile MobileNav pill row updated to include this 4th Plan pill.

### Captain MC Labels
- **D-16:** Three MC dimensions for labelling:
  - "Highest ceiling" → `p90_pts` descending
  - "Lowest floor" → `p10_pts` descending (highest p10 = most reliable minimum, NOT most volatile)
  - "Best P(haul)" → `haul_prob` descending
  
  Priority cascade (greedy, one label per player): **Best P(haul) > Highest ceiling > Lowest floor**. Assign the highest-priority label to the winning player per dimension. A player who wins multiple dimensions gets only their highest-priority label; the next candidate wins that dimension instead. Players who win no dimension show no MC label (candidates 4–5 typically). At most 3 labels shown across all candidates.

- **D-17:** MC label rendered as a small badge (same size as existing "Dangerous to fade" badge in `CaptainPicksPanel`) on the candidate row. Shows the label + value (e.g., "Best P(haul) — 41%", "Highest ceiling — 14.2 pts", "Lowest floor — 4.8 pts p10").

- **D-18:** TC recommendation: small callout rendered **below the EO mode toggle, above the candidate list** in `CaptainPicksPanel`. Text: "TC: [web_name] — [haul_prob × 100 rounded]% P(haul)". Only shown when `haul_prob` data is available for candidates (MC fields present). Hides when MC fields are absent (pre-Phase 61 data).

### Claude's Discretion
- Whether to show "estimate" or "~" disclaimer on the fan chart P(rank gain/drop) stats (annotating the approximation nature of the beat-the-average heuristic).
- Chart Y-axis: whether to show weekly score or cumulative score; whether to label GW numbers or "GW+N" offset labels.
- Whether to show the confidence band for the alternative XI trajectory, or only the mean line (avoid cluttering the chart).
- Exact badge styling for MC labels in `CandidateRow` — follow the existing "Dangerous to fade" badge pattern (amber/zinc pill, `text-xs font-normal`, matching dark mode tokens).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §Monte Carlo Simulator (MC-03, MC-04) — 2 locked requirements for Phase 62
- `.planning/ROADMAP.md` §Phase 62 — goal, success criteria, dependency on Phase 61

### Phase 61 Context (MC field definitions)
- `.planning/phases/061-mc-simulation-core/061-CONTEXT.md` — all decisions from Phase 61; defines D-05 through D-14 (field meanings, BGW/DGW handling, XPtsCell hover card)
- `.planning/phases/061-mc-simulation-core/061-02-SUMMARY.md` — simulate.py implementation details
- `.planning/phases/061-mc-simulation-core/061-03-SUMMARY.md` — XPtsCell MC hover card implementation

### Pipeline — MC Fields Source
- `pipeline/simulate.py` — `compute_simulations()` writes `blank_prob`, `haul_prob`, `p10_pts`, `p90_pts` per player
- `pipeline/run.py` lines 182–208 — pipeline orchestration; check for `gw_average_pts` (D-04 research task)
- `pipeline/merge.py` — `_compute_xpts_fixture` (Poisson/Bernoulli parameters) and `xPts_90th_1gw` (now overwritten by p90_pts)

### Frontend — Captain Panel (existing structure to extend)
- `src/components/captaincy/CaptainPicksPanel.tsx` — `CandidateRow` component, EO mode toggle, "Dangerous to fade" badge pattern; MC labels add a badge to `CandidateRow`, TC callout inserts below EO toggle
- `src/lib/eo-candidates.ts` — `computeEOCandidates()` and `EOMode` type; Chase Rank mode already sorts by `xPts_90th_1gw` (= p90_pts post-Phase 61)

### Frontend — Plan Sub-tab (integration points)
- `src/app/page.tsx` — SECTIONS constant, Plan section sub-tabs (`SubTab` union), `planHorizon` shared state, `HorizonSelector` above Plan nav. The 4th Plan sub-tab 'Rank Sim' adds to this list; pattern: additive edits only
- `src/components/planner/RouteTreeTab.tsx` — reference for Plan sub-tab component structure (props: teamId, submittedId, planHorizon, bank)
- `src/components/nav/MobileNav.tsx` — Plan pills must include the new Rank Sim pill

### Frontend — Alternative XI Data
- `src/lib/hooks/usePlayers.ts` — full player pool for buy dropdown (D-11)
- `src/lib/hooks/useSquad.ts` — user's current squad picks for sell dropdown
- `src/lib/hooks/useRivals.ts` — **reference pattern** for calling FPL proxy for entry data; `useEntryRank` follows the same pattern for `summary_overall_rank`

### Frontend — Types
- `src/lib/types.ts` — `MergedPlayer` (includes `blank_prob`, `haul_prob`, `p10_pts`, `p90_pts` as optional); `ScoredPlayer` — check if MC fields are propagated to ScoredPlayer (needed for rank computation over squad picks)

### Recharts
- Researcher should check the installed package version and current Recharts v2 docs. Use `AreaChart` + `Area` for the fan chart. Note: Tailwind dynamic classes don't work for chart styling — use inline styles or CSS vars.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/captaincy/CaptainPicksPanel.tsx` `CandidateRow` — extend with an MC label badge. "Dangerous to fade" badge is the exact template to follow for `McLabel` badge styling.
- `src/lib/eo-candidates.ts` `computeEOCandidates()` — pure function over `MergedPlayer[]`; a new `computeMCLabels(candidates: MergedPlayer[])` follows this exact pattern (pure ranker, exported, testable)
- `src/lib/hooks/useRivals.ts` — FPL proxy call pattern; `useEntryRank` hook is ~15 lines following this structure (query key `['entry-rank', teamId]`, 5-min staleTime, enabled when teamId is defined)
- `src/lib/lineup-swap.ts` `isLegalSwap` / `applySwap` — NOT used for the alternative XI (transfer scenario, not within-squad swap), but `applySwap` can be consulted for how squad state is mutated

### Established Patterns
- **FPL proxy calls**: `fetch('/api/fpl/...')` from hooks, not direct FPL calls. `useRivals.ts` and `useMyTeam.ts` are references.
- **Tailwind dynamic classes forbidden for values**: use `style={{ width: `${value}%` }}` (established in Phase 54 Pitfall 4). Same applies for chart heights/widths.
- **Plan sub-tab component props**: `{ teamId: string | null, submittedId: string | null, planHorizon: number, bank: number }` — check `RouteTreeTab.tsx` for exact prop shape and mirror it.
- **No auth required** for `summary_overall_rank` — FPL entry endpoint is public, team ID is sufficient. Same as Phase 58 rivals data.
- **New dependencies**: add to `package.json` and run `npm install recharts`. Check if types package needed (`@types/recharts` — Recharts v2 ships its own types).
- **Pipeline metadata fields**: If adding `gw_average_pts` to merged_players.json, write it as a top-level key (not per-player) in the JSON file — see how `run.py` currently saves the file and determine if the API route / `usePlayers` would surface it.

### Integration Points
- `src/app/page.tsx` — add `'rank-sim'` to `SubTab` union + SECTIONS Plan entry; add `<RankSimTab>` render conditional; this is 4 additive edits (exact pattern from Phase 73's `page.tsx` wiring)
- `src/components/nav/MobileNav.tsx` — add 4th Plan pill; update MobileNav tests
- `src/components/captaincy/CaptainPicksPanel.tsx` — add TC callout after EO toggle; extend `CandidateRow` with MC label badge prop
- `pipeline/run.py` — potentially add `gw_average_pts` read from bootstrap; small addition if needed (D-04 research task)

</code_context>

<specifics>
## Specific Ideas

- TC callout format: `"TC: Salah — 41% P(haul)"` — concise, mimics the "Dangerous to fade" badge's sentence format
- MC badge examples: `"Best P(haul) — 41%"`, `"Highest ceiling — 14.2 pts"`, `"Lowest floor — 4.8 pts"` — label + value, no verbose "chance of..." phrasing (consistent with Phase 61 D-12 format)
- Fan chart: cumulative score on Y-axis (growing from 0), GW+1 through GW+5 on X-axis; both lines start at 0 so the chart shows the relative divergence clearly
- Alternative XI comparison: when no alternative is selected (dropdowns at default/empty), only the current XI line is shown. Comparison line appears after both sell and buy are chosen.
- The rank simulator tab should degrade gracefully: if squad not loaded, show "Load your squad to run the rank simulator" (SC-05 pattern, consistent with OptimiserPanel and other squad-dependent components)

</specifics>

<deferred>
## Deferred Ideas

- **P(top-10k)**: Dropped in favour of P(rank gain/drop) with beat-the-average heuristic. Computing P(top-10k) requires modelling the full FPL score distribution tails — deferred or a future enhancement if FPL exposes percentile data.
- **Two-transfer alternative XI**: Comparing current XI vs 2-transfer XI. The Route Tree already covers multi-transfer planning; deferred to avoid overlap.
- **3GW/5GW MC windows**: Extending `simulate.py` to produce multi-GW MC percentiles. The 5-GW trajectory uses 1-GW data repeated — full multi-GW simulation is a future pipeline enhancement (noted in Phase 61 deferred items).
- **Within-squad lineup swap in rank simulator**: Comparing bench-boost or lineup variants. LineupTab (Phase 72) covers this; not needed in the rank simulator.
- **haul_prob in ceiling badge**: Replacing the existing sigma-tercile ceiling badge with haul_prob threshold — deferred from Phase 61.

</deferred>

---

*Phase: 62-MC Rank Simulator & Captain Integration*
*Context gathered: 2026-05-05*
