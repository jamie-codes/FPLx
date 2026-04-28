# Phase 33: Insights Tab - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a new "Insights" tab to the navigation (positioned after Set Pieces, before Value Gems) that displays data-driven pattern statements about this season's FPL data. Each statement has a confidence weight shown as a tier badge (HIGH/MEDIUM/LOW) with the exact percentage in a tooltip. Statements are pipeline-computed and persisted to `insights.json` alongside `merged_players.json`. All four categories are covered: Defensive, Attacking, Player-specific, Captaincy. Trivially obvious statements are excluded via a hardcoded pipeline exclusion list. This phase adds one new pipeline output file, one API route, one hook, and one React tab component — no changes to existing components.

</domain>

<decisions>
## Implementation Decisions

### Insight Generation (INS-01, INS-02)

- **D-01: Pipeline-computed, persisted to `insights.json`.** `pipeline/run.py` computes all pattern statements and confidence weights, writing `insights.json` alongside `merged_players.json`. The frontend renders it via an API route + hook — no client-side heavy computation. This matches the existing pattern for `captain_picks.json` (Phase 31).
- **D-02: Dynamic count — all insights that pass the triviality and confidence gates.** The pipeline outputs every valid pattern it finds. The count varies; the frontend renders all of them grouped by category.
- **D-03: Minimum 10 data points before an insight is shown.** Below this floor the insight is suppressed (insufficiently evidenced). This prevents noisy early-season percentages while still surfacing insights from GW10+.

### Confidence Weight Format (INS-02)

- **D-04: Tier badge + percentage in tooltip.** Rendered as a coloured badge (HIGH / MEDIUM / LOW) on the card for quick scanning. Hovering the badge shows the exact percentage (e.g. "True in 61% of fixtures — 14/23 matches"). Tier thresholds: HIGH ≥ 70%, MEDIUM 50–69%, LOW < 50% (but still above the minimum sample floor — if below floor, suppressed entirely rather than shown as LOW).
- **D-05: Badge colours follow project convention.** HIGH = green (`bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`), MEDIUM = amber (`bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200`), LOW = zinc/grey (`bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400`).

### Insight Categories (INS-03)

- **D-06: Four categories.** Defensive patterns, Attacking patterns, Player-specific patterns, Captaincy patterns. Each category gets its own heading section on the tab.
  - **Defensive:** CS rates by opponent rank, home vs away CS rates, teams on clean sheet streaks.
  - **Attacking:** Goal returns by fixture difficulty tier, teams over/under-performing xG, top-scoring home/away splits.
  - **Player-specific:** Players who score/assist disproportionately against tough opponents, players with high xPts variance (regression_signal context), consistent vs boom-bust patterns.
  - **Captaincy:** Captain points concentration (e.g. top-3 captains account for X% of FPL captaincy points this season), double-digit haul rate by player.

### Triviality Gate (INS-04)

- **D-07: Hardcoded exclusion list in pipeline.** The pipeline has an explicit list of known trivial pattern types that are skipped regardless of their confidence score. Examples of excluded patterns: "suspended players score 0 points", "bench players score fewer points than starters", "teams that win score more goals". The planner is responsible for coding only non-trivial pattern computations; the exclusion list is a safety net for patterns that slip through.

### Tab Layout & Display (INS-01)

- **D-08: Card list grouped by category.** Category heading (e.g. `## Defensive Patterns`) followed by a list of insight cards. Each card contains: the statement text, the confidence tier badge, and (on hover) the tooltip with exact percentage. No accordion — all categories expanded by default.
- **D-09: Tab positioned after Set Pieces.** Navigation order: Gems | DefCon | Squad | Club Form | Set Pieces | **Insights** | Value Gems | Planner. The `Tab` union type in `src/app/page.tsx` gains `'insights'`.
- **D-10: No filtering or pagination on the tab.** All insights rendered in a single scrollable list. If dynamic count produces too many, the pipeline's triviality gate is the control knob — not frontend pagination.

### API / Data Layer

- **D-11: `/api/insights` route + `useInsights()` hook.** Mirrors the `/api/captain-picks` + `useCaptainPicks` pattern from Phase 31. `staleTime: 6 * 60 * 60 * 1000` (6h, matching other FPL data hooks). `insights.json` written by `pipeline/run.py` alongside `merged_players.json`.
- **D-12: `Insight` TypeScript type.** Fields: `id: string`, `category: 'defensive' | 'attacking' | 'player' | 'captaincy'`, `statement: string`, `confidence_pct: number` (0–100), `sample_n: number`, `sample_total: number`. The tier badge is derived client-side from `confidence_pct`.

### Claude's Discretion

- Exact wording of each individual insight statement (the pipeline author chooses the human-readable copy as long as it is specific and non-trivial)
- Whether `insights.json` is an array or `{ insights: Insight[] }` wrapper object (recommend flat array, consistent with `captain_picks.json`)
- Order of insights within each category (recommend descending by `confidence_pct`)
- Exact number of pattern computations the pipeline implements (as many non-trivial patterns as can be derived from the available data)

</decisions>

<canonical_refs>
## Canonical References

- `.planning/REQUIREMENTS.md` — INS-01, INS-02, INS-03, INS-04 definitions
- `.planning/ROADMAP.md` — Phase 33 goal, success criteria, dependencies
- `.planning/phases/33-insights-tab/33-CONTEXT.md` — this file
- `src/app/page.tsx` — Tab union type and tab content mount point (add `'insights'` literal)
- `src/components/captaincy/CaptainPicksPanel.tsx` — analog component pattern (card-based, uses a hook, mounts on a tab)
- `src/lib/hooks/useCaptainPicks.ts` — analog hook pattern (useQuery, 6h staleTime, /api route)
- `src/app/api/captain-picks/route.ts` — analog API route pattern (reads JSON from pipeline cache, USE_BLOB toggle)
- `pipeline/merge.py` + `pipeline/run.py` — pipeline output pattern; `run.py` writes `captain_picks.json`, new `insights.json` follows the same write call
</canonical_refs>

<code_context>
## Reusable Assets

- **Tab scaffolding:** `src/app/page.tsx` — add `'insights'` to `Tab` union, add nav button, add `{activeTab === 'insights' && <InsightsTab />}` content block. Exact same pattern as every other tab.
- **API route pattern:** `src/app/api/captain-picks/route.ts` — copy for `/api/insights/route.ts`, replace filename and type.
- **Hook pattern:** `src/lib/hooks/useCaptainPicks.ts` — copy for `useInsights.ts`, replace endpoint and return type.
- **Badge style:** `text-xs font-normal rounded px-2 py-1` + colour tokens — already used by RegressionSignalBadge, DifferentialBadge, TARGET badge.
- **Section heading style:** Look at `DefConTables.tsx` or `ClubFormTable.tsx` for the `<h2 className="text-xl font-bold mb-2">` pattern used for category headings.
- **Pipeline output pattern:** `pipeline/run.py` lines that write `captain_picks.json` — mirror for `insights.json`.
</code_context>
