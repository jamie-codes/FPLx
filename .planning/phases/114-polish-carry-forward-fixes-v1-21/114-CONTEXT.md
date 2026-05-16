# Phase 114: Polish & Carry-Forward Fixes (v1.21) - Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 114 delivers four targeted fixes/additions across three UI surfaces:
1. **TRT-01** — RouteTreeTab "Hits" column shows `totalHits` (not `totalTransfers`) — 1-line fix
2. **TRT-02** — RouteTreeTab gains a visibly present but disabled ChipToggle stub
3. **SPARK-01** — GemTable gains a `rank_trajectory` sparkline micro-column after xPts_5gw
4. **UAT-01** — Human visual verification of the Transfer Regret Backtester (dark mode, delta colour, multi-transfer format, captain regression) — no code change unless regressions found

No pipeline changes. No new data fields. No new routes. UI wiring and a trivial label fix only.
</domain>

<decisions>
## Implementation Decisions

### TRT-01: Hits Column Fix
- **D-01:** Replace `path.totalTransfers` with `path.totalHits` in the RouteTreeTab table body (single cell, line ~300). The `totalHits` field already exists on `TransferRoutePath` in `transfer-route-tree.ts`.

### SPARK-01: rank_trajectory Sparkline
- **D-02:** Render via **inline SVG `<polyline>`** — no Recharts import, no ResponsiveContainer. ~10 lines of JSX. rank_trajectory has only 5 points so no charting library is needed.
- **D-03:** **Trend-coloured**: green stroke if `last < first` (rank improving = percentile rank falling toward 0), red stroke if `last > first` (rank falling), zinc-400 if flat or data absent/undefined.
- **D-04:** **Mobile-hidden** — add `'rank_trajectory'` to `MOBILE_HIDDEN_COLUMNS` (or equivalent pattern). Follows Signal, Diff, CS% precedent.
- **D-05:** **Placement: after xPts_5gw column** — sparkline contextualises the horizon projected points immediately to its left.

### TRT-02: ChipToggle Disabled Stub
- **D-06:** **Extend `ChipToggle.tsx`** with an optional `disabled?: boolean` prop. When true: apply `opacity-50 pointer-events-none` (or equivalent Tailwind) to the wrapping div; `onToggle` is never called. The existing button markup is unchanged — visual parity is automatic.
- **D-07:** **No label or tooltip** — the dim/unresponsive visual is sufficient signal for a personal tool. Do not add "coming soon" text.
- **D-08:** In RouteTreeTab, pass `activeChip={null}` and `onToggle={() => {}}` alongside `disabled`. Use the existing `startingGw` value (already in scope) for the `gw` prop.

### UAT-01: Transfer Regret Backtester Visual Check
- **D-09:** The current BackTab delta colour semantics are **intentionally correct** — `delta > 0` → RED ("engine better") is appropriate regret framing. The ROADMAP success criterion phrase "positive delta = green" was misleadingly worded; the code's interpretation (`delta > 0` = bad for user = red) matches the spec intent.
- **D-10:** UAT-01 is a **verification task only** — the planner should produce a human checkpoint task (not a code task). The task is marked done when the user confirms all four visual dimensions pass: dark mode rendering, delta colour polarity, multi-transfer GW formatting, and absence of captain regression artefacts.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 114 Requirements
- `.planning/REQUIREMENTS.md` §v1.21 — UAT-01, TRT-01, TRT-02, SPARK-01 requirement definitions
- `.planning/ROADMAP.md` Phase 114 — Goal, success criteria, dependencies

### RouteTreeTab & ChipToggle
- `src/components/planner/RouteTreeTab.tsx` — TRT-01 fix site (line ~300: `path.totalTransfers`); TRT-02 chipMode comment (lines 89–91); ChipToggle usage pattern
- `src/components/planner/ChipToggle.tsx` — Component to extend with `disabled` prop
- `src/lib/transfer-route-tree.ts` — `TransferRoutePath` type: `totalHits` and `totalTransfers` fields

### GemTable Sparkline
- `src/components/gem-table/GemTable.tsx` — Column definitions, `MOBILE_HIDDEN_COLUMNS`, TanStack Table column factory pattern
- `src/lib/types.ts` line ~194–198 — `rank_trajectory?: number[]` definition (length-5, values 0–1 position-relative percentile rank)

### BackTab (UAT-01 reference)
- `src/components/accuracy/BackTab.tsx` — `transferRegretFill` function (lines 55–60), delta cell rendering (lines 514–537), TransferRegretView — read to understand UAT-01 visual contract before producing the checkpoint task

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ChipToggle.tsx`: Existing component with `gw`, `activeChip`, `onToggle` props and 4 chip buttons (WC/FH/BB/TC). Extend with `disabled?: boolean` — no fork needed.
- `rank_trajectory?: number[]`: Already in `MergedPlayer` type. Zero pipeline changes needed.
- Recharts (BarChart, Cell, etc.): Already imported in BackTab. **Not needed** for sparkline — inline SVG is the chosen approach.

### Established Patterns
- `MOBILE_HIDDEN_COLUMNS` array in GemTable.tsx: signal, diff, cs_prob — sparkline joins this list.
- TanStack Table column definitions in GemTable.tsx: use the same `columnHelper.accessor()` factory pattern as existing columns.
- ChipToggle `disabled` precedent: ChipToggle is already used with aria-pressed in PlannerTab/ManualPlanTab — the disabled extension is purely additive.
- BackTab delta semantics: `delta = engine_pts − user_pts`. Positive = engine better = red (regret). Negative = user better = green. This is intentional and correct.

### Integration Points
- `RouteTreeTab.tsx` line ~300: single cell change `{path.totalTransfers}` → `{path.totalHits}`
- `RouteTreeTab.tsx` lines 89–91: replace `const chipMode: PlannerChip = null` with ChipToggle render (disabled)
- `GemTable.tsx`: new column definition after xPts_5gw; new `SparklineCell` component (or inline renderer)
- `ChipToggle.tsx`: add `disabled` prop to interface + conditional class on wrapper div

</code_context>

<specifics>
## Specific Ideas

- Sparkline SVG: `<svg width="40" height="20" viewBox="0 0 40 20"><polyline points="..." fill="none" stroke="<colour>" strokeWidth="1.5" /></svg>` — map rank_trajectory values to y-coordinates (0 = top = y:1, 1 = bottom = y:19), x evenly spaced.
- Sparkline colour logic: `const trend = trajectory[trajectory.length - 1] - trajectory[0]`; green if `trend < -0.05`, red if `trend > 0.05`, zinc if within ±0.05 threshold (avoids false colouring on flat/noise).
- ChipToggle in RouteTreeTab: render above or below the route table header, in the same position as it appears in PlannerTab (before the route list).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 114-polish-carry-forward-fixes-v1-21*
*Context gathered: 2026-05-16*
