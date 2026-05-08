# Phase 79: Insight Card Redesign - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete visual and structural redesign of `InsightsTab` and `InsightCard`:

1. **INS-01** — Every insight card rendered with 5 distinct visual zones: category badge, bold card title (15–16px), large headline metric (28–36px tabular), plain-English takeaway sentence, action hint.
2. **INS-02** — Signal badges use 6 semantic labels (Weak signal / Watchlist / Strong signal / Trap risk / Regression risk / Hidden gem) with icon prefix (●/▲/⚠/★); replacing LOW/MEDIUM/HIGH.
3. **INS-03** — Percentage/rate metrics show an inline mini progress bar with a benchmark reference line.
4. **INS-04** — InsightsTab divided into collapsible sections: Priority Insights (highest-signal), Defensive Patterns, Attacking Patterns, Player-Specific Patterns — each with count badge.
5. **INS-05** — Decision Summary sticky panel at top of InsightsTab lists top 3 actionable angles with affected player/team chips.
6. **INS-06** — Each card has a hover/expand area revealing sample size, GWs covered, and confidence rationale.

**Scope includes pipeline changes** — the Python `insights.py` pipeline must be extended to emit new structured fields per insight. This is not a UI-only phase.

</domain>

<decisions>
## Implementation Decisions

### Data Model (INS-01 — pipeline extension)
- **D-01:** The pipeline (`pipeline/insights.py`) is extended to emit new structured fields alongside the existing 6. Each insight dict adds: `title` (short card heading, e.g. "Home Clean Sheet Advantage"), `metric_value` (float, the headline number), `metric_label` (string, e.g. "CS rate at home"), `takeaway` (plain-English sentence — what this data means), `action_hint` (string, e.g. "Target home defenders in good runs"), `benchmark_value` (float, the reference line for the progress bar — typically league average for that metric), `gw_coverage` (string, e.g. "GW1–34"), `player_ids` (list[int], FPL player IDs relevant to this insight — empty list if not applicable), `team_ids` (list[int], FPL team IDs relevant to this insight — empty list if not applicable).
- **D-02:** The TypeScript `Insight` interface in `src/lib/types.ts` is updated to match. Downstream pipeline test (`pipeline/test_insights.py` if it exists) must be updated to assert new fields are present.
- **D-03:** The existing `statement` field is kept for backwards compatibility in the API but is no longer the primary display string — the card renders from the structured fields. The API route (`src/app/api/insights/route.ts`) passes through all fields unchanged.

### Signal Badge System (INS-02)
- **D-04:** Signal badge label is computed by the pipeline using **category × confidence rules** — not a hardcoded `signal_type` field. Logic lives in `pipeline/insights.py` as a `_signal_label(category, confidence_pct, insight_id)` helper:
  - `confidence_pct >= 70` + any category → "Strong signal"
  - `confidence_pct >= 55` + any category → "Watchlist" (default mid-tier)
  - `confidence_pct < 55` → "Weak signal" (default low-tier)
  - `player` category + `confidence_pct >= 65` → promoted to "Hidden gem" (overrides Watchlist)
  - `attacking` or `player` category + `confidence_pct < 45` → "Trap risk" (contrarian low-confidence)
  - `defensive` category + `confidence_pct < 45` → "Regression risk" (low-confidence defensive patterns are often reverting)
  - Rule precedence: category-specific overrides run before generic threshold checks
- **D-05:** The pipeline emits a `signal_label` string field on each insight dict. The TypeScript client renders it directly — no client-side derivation needed.
- **D-06:** Icon prefix mapping (client-side constant in InsightsTab or a shared util): "Strong signal" → ▲, "Hidden gem" → ★, "Watchlist" → ●, "Weak signal" → ●, "Trap risk" → ⚠, "Regression risk" → ⚠.

### Decision Summary Panel (INS-05)
- **D-07:** Decision Summary selects the **top 3 insights by `confidence_pct`** that have a non-empty `player_ids` or `team_ids` list. Falls back to top 3 by confidence overall if fewer than 3 have entity lists. No separate pipeline output file — sourced from the same insight array.
- **D-08:** Player chips render the FPL player display name (from `MergedPlayer.web_name` — available in merged player data). Team chips render team short name. Chips are pill-shaped, matching the pill badge pattern from Phase 78 (VIS-04 pattern). No click action required (read-only display).
- **D-09:** The sticky panel uses `sticky top-[nav-height] z-30` so it sticks below the nav bar (which is `z-40` per Phase 78 D-07/D-08). Panel background uses `bg-surface/95 backdrop-blur-sm` consistent with the sticky nav.

### Section Structure (INS-04)
- **D-10:** "Priority Insights" section = top 5 insights by `confidence_pct` regardless of category, deduped from their category sections. These insights appear in Priority AND in their category section.
- **D-11:** Collapsible state uses **React `useState`** — resets when tab is unmounted. All sections start **expanded** by default. No localStorage persistence.
- **D-12:** Section header format: `[Section name] · [count]` with a chevron toggle (▼/▶). Count badge shows number of insights in that section.

### Card Layout (INS-01, INS-03, INS-06)
- **D-13:** Mini progress bar for `metric_value`: `<div>` with inner fill at `(metric_value / 100) * 100%` width; benchmark line rendered as an absolute-positioned vertical bar at `benchmark_value%`. Both clamp to 0–100%.
- **D-14:** Hover/expand methodology area uses a `<details>/<summary>` element (native browser expand, no JS required) below the action hint. Reveal text format: "Sample: {sample_n}/{sample_total} · {gw_coverage} · Confidence: {confidence_pct}%"
- **D-15:** The 5 zones stack vertically in the card: [category badge row] → [title] → [metric + progress bar] → [takeaway] → [action hint]. Spacing uses `space-y-2` inside `p-4`.

### Carried Forward (Phase 78 tokens)
- **D-16:** Card shell uses Phase 78 token classes: `bg-surface border-border rounded` — not hardcoded zinc. Signal badge uses `rounded-full px-2 py-0.5 text-xs` pill shape (VIS-04 pattern).
- **D-17:** Headline metric uses `font-variant-numeric: tabular-nums` via the `tabular-nums` Tailwind class (VIS-02 established this globally but explicit class on the metric element).

### Claude's Discretion
- Exact confidence threshold boundaries for the signal label rules within the category × confidence matrix (approximate values in D-04 are the guide, but Claude can tune ±3pp based on the actual data distribution).
- Whether `<details>/<summary>` for hover/expand is styled to feel consistent with the card or whether a plain text expansion toggle is cleaner.
- Whether "Priority Insights" deduplication from category sections uses visual deduplication (show in both) or exclusion (remove from category if shown in Priority).
- Exact chevron icon for collapse toggle (▼/▶ text chars vs. a Heroicons chevron SVG).
- Padding/gap inside the mini progress bar and the exact height (suggesting `h-2` for the bar, `h-4` for the benchmark line).
- Whether player/team chip data is pre-fetched in `useInsights` response or cross-referenced from `useMergedPlayers` — simpler to embed names directly in the pipeline output (pipeline has access to both).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/ROADMAP.md` §Phase 79 — Goal, success criteria, INS-01 through INS-06 requirement mapping
- `.planning/REQUIREMENTS.md` §INS-01, §INS-02, §INS-03, §INS-04, §INS-05, §INS-06 — full requirement text

### Pipeline (primary change targets)
- `pipeline/insights.py` — all insight dict construction; `compute_insights()`, `_defensive_patterns()`, `_attacking_patterns()`, `_player_patterns()`, `_captaincy_patterns()`; new structured fields added here alongside existing 6
- `pipeline/run.py` — orchestrates pipeline; verify `insights.py` call signature after signature changes

### TypeScript Types (primary change target)
- `src/lib/types.ts` — `Insight` interface; extend with new fields matching pipeline output

### UI Components (primary change targets)
- `src/components/insights/InsightsTab.tsx` — full rewrite: `InsightCard`, section structure, Decision Summary panel, collapsible sections
- `src/components/insights/InsightsTab.test.tsx` — update tests for new card structure

### API (pass-through, verify only)
- `src/app/api/insights/route.ts` — reads and forwards `pipeline/cache/insights.json`; no logic changes expected, but verify new fields pass through

### Design System (carry-forward from Phase 78)
- `.planning/phases/078-ui-visual-foundation/078-CONTEXT.md` — token system decisions (D-01 through D-12); card shells use `bg-surface border-border`, pill badges use `rounded-full px-2 py-0.5 text-xs`, sticky elements use `bg-surface/95 backdrop-blur-sm z-40`
- `src/app/globals.css` — `:root` / `.dark` token definitions (`--surface`, `--border`, `--muted`, etc.)

### Hooks (read-only reference)
- `src/lib/hooks/useInsights.ts` — React Query hook; `staleTime: 6h`; no changes expected unless Insight type requires a different query shape

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useInsights` hook — already wired; returns `Insight[]`; just needs updated type
- `CATEGORY_ORDER` / `CATEGORY_LABELS` constants in `InsightsTab.tsx` — keep and extend with "Priority Insights" section
- `TIER_CLASSES` mapping — replace with `SIGNAL_CLASSES` using the 6 new semantic labels + icon prefixes
- Phase 78 pill badge pattern (`rounded-full px-2 py-0.5 text-xs`) — reuse for signal badges and player/team chips
- `sticky top-0 z-40 bg-surface/95 backdrop-blur-sm` sticky wrapper (Phase 78 nav) — Decision Summary panel uses same backdrop pattern at `z-30`

### Established Patterns
- Inline card tooltip via `title=` attribute (current `InsightCard` line 32–33) — replace with `<details>/<summary>` for INS-06 (hover/expand is richer than tooltip)
- `<img>` + `onError` fallback (Phase 77) — not directly relevant but confirms no Next.js `<Image>` for external resources
- `font-variant-numeric: tabular-nums` class on metric element (Phase 78 VIS-02)
- `space-y-3` for card list items (current InsightsTab) — keep for section body

### Integration Points
- `InsightsTab` is rendered inside `page.tsx` sub-tab routing — no changes to routing needed
- Pipeline `cache/insights.json` is the data file; pipeline changes write the enriched JSON; API route passes it through
- `TEAM_BADGE_CODE` in `src/lib/team-colours.ts` — available for team chip resolution if needed; pipeline output should embed `team_short_name` strings directly for simplicity

</code_context>

<specifics>
## Specific Ideas

- Sticky Decision Summary panel stacks below the sticky nav: `z-30` (nav is `z-40` per Phase 78 D-07)
- Player/team chip names embedded directly in pipeline output (pipeline has access to player `web_name` and team `short_name`) — avoids cross-referencing from the client side
- Progress bar: `h-2` bar height, benchmark line as `h-4` absolute vertical bar to visually overhang the bar
- `<details>/<summary>` native expand for methodology — no extra JS state

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 079-Insight-Card-Redesign*
*Context gathered: 2026-05-08*
