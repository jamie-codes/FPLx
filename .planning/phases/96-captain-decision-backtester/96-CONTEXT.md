# Phase 96: Captain Decision Backtester - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 96 delivers the BACK-01 captain decision backtester. It adds:

1. **Pipeline**: `captain_picks_gw{N}.json` side-written to Vercel Blob each run — a per-GW durable snapshot of the model's captain recommendation at decision time (mirrors the `predictions_snapshot_gw{N}.json` pattern from Phase 41)
2. **API + hook**: `/api/decision-history` route + `useDecisionHistory` TanStack Query hook — reads per-GW captain snapshots, joins with authenticated FPL API picks to surface the user's actual captain per GW, computes regret scores, caches in localStorage ring buffer (38 GWs, keyed by team ID)
3. **UI restructure**: AccuracyTab gains a "Summary | Calibration | Back" sub-tab nav. Existing content is reorganised into Summary and Calibration tabs; BackTab is the new third tab
4. **BackTab**: Season summary stats + recharts bar chart (regret per GW above/below zero) + per-GW detail rows

**Out of scope:** BACK-02 transfer regret backtester, pipeline changes beyond the captain snapshot side-write, new MergedPlayer fields, new AccuracyTab sections beyond the three defined above.

</domain>

<decisions>
## Implementation Decisions

### AccuracyTab Navigation Restructure

- **D-01:** AccuracyTab gains a **"Summary | Calibration | Back" pill nav** at the top of the component. This is a full restructure from the current flat-scroll layout into three distinct tabs.

- **D-02:** Tab content grouping:
  - **Summary** = DataHealthPanel + GwSummaryTable + HaulterList + PlayerDeltaTable (existing landing experience preserved)
  - **Calibration** = CalibrationSection + VersionHistoryTable
  - **Back** = BackTab (captain regret backtester — new)

- **D-03:** Default active tab on mount = **Summary**. Preserves the existing first-visit experience — user sees pipeline health and backtest summary, same as today.

- **D-04:** Tab state lives in **component-local `useState`** inside `AccuracyTab`. Resets to Summary on re-mount (switching away to another section and returning). Consistent with Phase 95 set-piece toggle (`useState<'takers' | 'league'>('takers')`) and v1.5 GemTable preset pattern.

### BackTab Visualization

- **D-05:** BackTab layout: **season summary header** → **recharts bar chart** → **per-GW detail rows**. The chart is the "at a glance" signal; rows are the detail.

- **D-06:** Regret formula: `regret = ceiling_pts × 2 − user_capt_pts × 2` (signed, in captain points).
  - **Positive regret** (model was better, user lost points) → red, bar above zero axis
  - **Negative regret** (user beat the model) → green, bar below zero axis
  - Rows show the signed value with color and a label: e.g. `+8pts (model better)` or `−2pts (you beat it)`

- **D-07:** Season summary header (above chart):
  - Total captain regret (sum of all signed regret values across GWs with full data)
  - Win/loss/tie record: "Model better: N GWs | You won: N GWs | Tied: N GWs"
  - Example: `Total captain regret: −18pts across 12 GWs | Model better: 8 | You won: 4 | Tied: 0`

### Captain Snapshot Content

- **D-08:** The "model recommendation" that regret is computed against is the **ceiling pick** — the player with highest `xPts_90th_1gw` from the pipeline run. This is the model's most bullish captain recommendation, consistent with the existing `captain_picks.json` ceiling concept.

- **D-09:** `captain_picks_gw{N}.json` **reuses the existing `captain_picks.json` payload verbatim** (ceiling + eo_adjusted, same schema, same field names). Pipeline side-write is a one-liner after the existing `save('captain_picks.json', captain_picks)` call:
  ```python
  if os.getenv('USE_BLOB', '').lower() == 'true':
      from upload import upload_json
      upload_json(f'captain_picks_gw{current_gw}.json', captain_picks)
  ```
  This is NOT a replacement of the existing `captain_picks.json` — it is a side-write that accumulates one immutable Blob object per GW.

### Pre-Deployment GW Handling

- **D-10:** For GWs played **before Phase 96 deployed** (no `captain_picks_gw{N}.json` snapshot exists): the row still renders with the user's actual captain from the FPL API, but the model column shows a **"No snapshot"** placeholder — e.g. `"No model snapshot for this GW"`. This keeps the timeline complete and explains the data gap clearly.

- **D-11:** For the **very first visit** (zero snapshots in Blob AND no FPL session cookie): render a single **empty state message**:
  > "No captain history yet — data accumulates each GW after this version is deployed. Log in to see your actual captain picks."
  No loading skeleton, no error state. Consistent with the cookie-expired graceful degradation spec in the ROADMAP (SC-5).

### Claude's Discretion

- Exact Tailwind styling for the "Summary | Calibration | Back" pill nav (reuse segmented pill from GwToggle / PresetToggle or new implementation)
- Recharts bar chart type (BarChart vs ComposedChart) and axis formatting for the zero-baseline regret chart
- Column widths and layout of per-GW detail rows (player name, actual pts × 2, model pts × 2, regret score)
- Whether the localStorage ring buffer is managed in the hook or in a separate `src/lib/decisionHistory.ts` utility
- `/api/decision-history` response shape beyond what types dictate

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` §"Phase 96: Captain Decision Backtester" — full goal, success criteria (SC-1 through SC-5), wave breakdown (4 plans, 3 waves), cross-cutting constraints (snapshot-at-decision-time, localStorage ring buffer key)
- `.planning/REQUIREMENTS.md` §BACK-01 — requirement text including localStorage ring buffer spec and authenticated FPL API reference

### Pipeline — Snapshot Pattern (MUST READ)
- `pipeline/run.py` lines 330–342 — `build_predictions_snapshot` + `upload_json` blob side-write pattern that Phase 96 mirrors exactly for captain snapshots
- `pipeline/run.py` lines 213–227 — where `captain_picks` is produced (from `merge_players`) and saved as `captain_picks.json`; Phase 96 side-write goes immediately after line 227
- `pipeline/merge.py` lines 598–660 — `_compute_captain_picks()` function and the `captain_picks.json` schema (ceiling + eo_adjusted fields); Phase 96 snapshot reuses this schema verbatim

### API — Authenticated FPL Picks (MUST READ)
- `src/app/api/gw-review/route.ts` lines 99–119 — pattern for fetching `/entry/{teamId}/event/{gw}/picks/` from the FPL API; `/api/decision-history` follows the same approach (no fpl_session cookie needed — public endpoint with team ID)
- `src/app/api/accuracy/route.ts` — existing `/api/accuracy` route; `/api/decision-history` follows the same blob-read + response pattern

### AccuracyTab Restructure (MUST READ)
- `src/components/accuracy/AccuracyTab.tsx` — full component (1046 lines); Phase 96 restructures this into three tabbed sections; read the full file before planning to understand existing section boundaries and the DataHealthPanel / CalibrationSection / GwSummaryTable component names
- `src/components/accuracy/AccuracyTab.test.tsx` — existing test suite; new tab nav tests extend here or in a new `BackTab.test.tsx`

### Existing Patterns (MUST READ)
- `src/lib/hooks/useAccuracy.ts` (or wherever defined) — existing hook pattern; `useDecisionHistory` follows same TanStack Query shape
- `src/components/gem-table/GwToggle.tsx` — segmented pill toggle pattern to reuse for "Summary | Calibration | Back" nav
- `src/lib/types.ts` — existing `MergedPlayer`, `CaptainPick` (if defined) types; new types `CaptainPickSnapshot`, `RegretEntry`, `DecisionHistory` go here (ROADMAP plan 096-01 wave 0)
- `src/app/page.tsx` line 66 — `SubTab` type definition; AccuracyTab sub-tab nav is internal to AccuracyTab, not a new SubTab entry

### Recharts Reference
- `src/components/accuracy/AccuracyTab.tsx` §CalibrationSection (lines 253–380 approx.) — existing recharts chart usage (CalibrationTooltip, Tooltip, axis patterns); regret bar chart follows the same recharts conventions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `_compute_captain_picks(result, current_gw)` in `pipeline/merge.py` — already produces the `captain_picks` dict; Phase 96 uploads the same dict to Blob. Zero new pipeline logic.
- `upload_json(f'predictions_snapshot_gw{current_gw}.json', snapshot_data)` in `pipeline/run.py` lines 340–342 — exact upload pattern to mirror. Import `upload_json` from `upload` module (already imported conditionally).
- `fetch(\`${FPL_BASE}/entry/${teamId}/event/${gw}/picks/\`, ...)` in `src/app/api/gw-review/route.ts` line 103 — the authenticated picks fetch pattern for `/api/decision-history`.
- `useAccuracy()` hook in `src/lib/hooks/useAccuracy.ts` — TanStack Query hook shape; `useDecisionHistory` follows same pattern (queryKey, fetcher, staleTime).
- Recharts `BarChart` in `AccuracyTab.tsx` CalibrationSection — existing axes, Tooltip, ResponsiveContainer usage; regret chart reuses this.
- Segmented pill from `src/components/gem-table/GwToggle.tsx` (or PresetToggle) — for "Summary | Calibration | Back" nav.

### Established Patterns
- **Blob read for per-GW files**: `predictions_snapshot_gw{N}.json` is read by `/api/accuracy` — follow the same fetch-by-name pattern for `captain_picks_gw{N}.json` in `/api/decision-history`.
- **localStorage with try/catch**: All existing localStorage accesses are wrapped in try/catch (theme, fpl_team_id, fpl_manual_plan, league_id). Ring buffer key `decisionHistory:teamId:{id}` must follow the same guard.
- **Dark mode**: Tailwind `.dark:` variants on all new classes.
- **Empty state pattern**: AccuracyTab already handles isLoading / error / !data states at lines 1001–1033. BackTab follows the same three-guard pattern.
- **Graceful degradation**: ROADMAP SC-5 requires that FPL API failure (cookie expired) renders a placeholder per row, never blocks the rest of AccuracyTab. The existing AccuracyTab error state pattern (render DataHealthPanel first, then fail gracefully) is the model.

### Integration Points
- `AccuracyTab.tsx` — restructure into three tabbed sections (D-01/D-02). New internal sub-tab state (D-04). New `BackTab` imported and rendered conditionally.
- `pipeline/run.py` — one-line addition after `save('captain_picks.json', captain_picks)` at line 227: upload `captain_picks_gw{current_gw}.json` to Blob when `USE_BLOB=true`.
- `src/lib/types.ts` — add `CaptainPickSnapshot`, `RegretEntry`, `DecisionHistory` types.
- `src/app/api/decision-history/route.ts` — new API route; reads per-GW captain Blob snapshots and joins with FPL picks.
- `src/lib/hooks/useDecisionHistory.ts` — new TanStack Query hook; manages localStorage ring buffer (38 GWs keyed by `decisionHistory:teamId:{id}`).

</code_context>

<specifics>
## Specific Ideas

- The regret formula uses captained points (×2): `ceiling_pts × 2 − user_capt_pts × 2`. Positive = model was better. This is the "captain points" framing — not raw player points.
- Bar chart shows signed regret with a zero baseline. Bars above zero (red) = model was better; bars below zero (green) = user beat it. The zero baseline is the key visual element that makes "beats" visible at a glance.
- Season summary header gives the manager a quick verdict: "Over 12 GWs you lost 18 total captain points by ignoring the model." Actionable and honest.
- The "no snapshot" placeholder for pre-deployment GWs is per-row (not a full-page state) — the FPL picks API still returns the user's actual captain even for old GWs, so those columns populate normally.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 96-captain-decision-backtester*
*Context gathered: 2026-05-11*
