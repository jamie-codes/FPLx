# Phase 79: Insight Card Redesign - Research

**Researched:** 2026-05-08
**Domain:** UI redesign + Python pipeline data-shape extension
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Data Model (INS-01 — pipeline extension)**
- **D-01:** The pipeline (`pipeline/insights.py`) is extended to emit new structured fields alongside the existing 6. Each insight dict adds: `title` (short card heading, e.g. "Home Clean Sheet Advantage"), `metric_value` (float, the headline number), `metric_label` (string, e.g. "CS rate at home"), `takeaway` (plain-English sentence — what this data means), `action_hint` (string, e.g. "Target home defenders in good runs"), `benchmark_value` (float, the reference line for the progress bar — typically league average for that metric), `gw_coverage` (string, e.g. "GW1–34"), `player_ids` (list[int], FPL player IDs relevant to this insight — empty list if not applicable), `team_ids` (list[int], FPL team IDs relevant to this insight — empty list if not applicable).
- **D-02:** The TypeScript `Insight` interface in `src/lib/types.ts` is updated to match. Downstream pipeline test (`pipeline/test_insights.py` if it exists) must be updated to assert new fields are present.
- **D-03:** The existing `statement` field is kept for backwards compatibility in the API but is no longer the primary display string — the card renders from the structured fields. The API route (`src/app/api/insights/route.ts`) passes through all fields unchanged.

**Signal Badge System (INS-02)**
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

**Decision Summary Panel (INS-05)**
- **D-07:** Decision Summary selects the **top 3 insights by `confidence_pct`** that have a non-empty `player_ids` or `team_ids` list. Falls back to top 3 by confidence overall if fewer than 3 have entity lists. No separate pipeline output file — sourced from the same insight array.
- **D-08:** Player chips render the FPL player display name (from `MergedPlayer.web_name` — available in merged player data). Team chips render team short name. Chips are pill-shaped, matching the pill badge pattern from Phase 78 (VIS-04 pattern). No click action required (read-only display).
- **D-09:** The sticky panel uses `sticky top-[nav-height] z-30` so it sticks below the nav bar (which is `z-40` per Phase 78 D-07/D-08). Panel background uses `bg-surface/95 backdrop-blur-sm` consistent with the sticky nav.

**Section Structure (INS-04)**
- **D-10:** "Priority Insights" section = top 5 insights by `confidence_pct` regardless of category, deduped from their category sections. These insights appear in Priority AND in their category section.
- **D-11:** Collapsible state uses **React `useState`** — resets when tab is unmounted. All sections start **expanded** by default. No localStorage persistence.
- **D-12:** Section header format: `[Section name] · [count]` with a chevron toggle (▼/▶). Count badge shows number of insights in that section.

**Card Layout (INS-01, INS-03, INS-06)**
- **D-13:** Mini progress bar for `metric_value`: `<div>` with inner fill at `(metric_value / 100) * 100%` width; benchmark line rendered as an absolute-positioned vertical bar at `benchmark_value%`. Both clamp to 0–100%.
- **D-14:** Hover/expand methodology area uses a `<details>/<summary>` element (native browser expand, no JS required) below the action hint. Reveal text format: "Sample: {sample_n}/{sample_total} · {gw_coverage} · Confidence: {confidence_pct}%"
- **D-15:** The 5 zones stack vertically in the card: [category badge row] → [title] → [metric + progress bar] → [takeaway] → [action hint]. Spacing uses `space-y-2` inside `p-4`.

**Carried Forward (Phase 78 tokens)**
- **D-16:** Card shell uses Phase 78 token classes: `bg-surface border-border rounded` — not hardcoded zinc. Signal badge uses `rounded-full px-2 py-0.5 text-xs` pill shape (VIS-04 pattern).
- **D-17:** Headline metric uses `font-variant-numeric: tabular-nums` via the `tabular-nums` Tailwind class (VIS-02 established this globally but explicit class on the metric element).

### Claude's Discretion
- Exact confidence threshold boundaries for the signal label rules within the category × confidence matrix (approximate values in D-04 are the guide, but Claude can tune ±3pp based on the actual data distribution).
- Whether `<details>/<summary>` for hover/expand is styled to feel consistent with the card or whether a plain text expansion toggle is cleaner.
- Whether "Priority Insights" deduplication from category sections uses visual deduplication (show in both) or exclusion (remove from category if shown in Priority).
- Exact chevron icon for collapse toggle (▼/▶ text chars vs. a Heroicons chevron SVG).
- Padding/gap inside the mini progress bar and the exact height (suggesting `h-2` for the bar, `h-4` for the benchmark line).
- Whether player/team chip data is pre-fetched in `useInsights` response or cross-referenced from `useMergedPlayers` — simpler to embed names directly in the pipeline output (pipeline has access to both).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INS-01 | Five visual zones on every card: category badge, bold title, large tabular headline metric, plain-English takeaway, action hint | Pipeline extension (see Architecture Patterns: §Pipeline Extension Pattern) emits `title`/`metric_value`/`metric_label`/`takeaway`/`action_hint`; client renders five zones (see §Card Layout Pattern) |
| INS-02 | Six semantic signal labels with icon prefix replacing LOW/MEDIUM/HIGH | Pipeline `_signal_label()` helper emits `signal_label` (see §Signal Computation Pattern); client maps via `SIGNAL_CLASSES` constant (replaces existing `TIER_CLASSES`) |
| INS-03 | Inline mini progress bar with benchmark reference line for percentage/rate metrics | Reuse `PriceChangePanel` progress bar primitive (see §Code Examples §Progress Bar with Benchmark Line); pipeline emits `benchmark_value` |
| INS-04 | InsightsTab divided into 4 collapsible sections with count badges: Priority Insights, Defensive, Attacking, Player-Specific | Client-side: extend existing `CATEGORY_ORDER`/`CATEGORY_LABELS` with `priority` section; useState for collapse; chevron toggle (see §Collapsible Section Pattern) |
| INS-05 | Decision Summary sticky panel listing top 3 actionable angles with player/team chips | Pipeline embeds `player_ids`/`team_ids` per insight; client filters & renders sticky panel below nav (see §Decision Summary Pattern) |
| INS-06 | Hover/expand area per card revealing sample size, GWs covered, confidence rationale | `<details>/<summary>` native expand (precedent: `PlannerTab.tsx:350`); pipeline emits `gw_coverage`; combines with existing `sample_n`/`sample_total`/`confidence_pct` |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

`CLAUDE.md` and `AGENTS.md` impose two directives that bind this phase:

1. **"This is NOT the Next.js you know."** Read `node_modules/next/dist/docs/` before writing Next.js-affected code. (Verified: app router docs live at `node_modules/next/dist/docs/01-app/`.) For Phase 79, `InsightsTab.tsx` is already a `'use client'` component and `src/app/api/insights/route.ts` is a passthrough — neither requires server-component-specific updates. Pipeline-side and component-side changes don't trigger the directive but verify before extending API behavior.
2. **No `Co-Authored-By` trailers in commits.**

## Summary

Phase 79 is **two coordinated changes**:

1. **Pipeline (`pipeline/insights.py`):** Extend each insight dict with 9 new structured fields (`title`, `metric_value`, `metric_label`, `takeaway`, `action_hint`, `benchmark_value`, `gw_coverage`, `player_ids`, `team_ids`) plus `signal_label`. Add a `_signal_label()` helper computing the 6-category label from `(category, confidence_pct, insight_id)`. The 5 existing generator functions (`_defensive_patterns`, `_attacking_patterns`, `_player_patterns`, `_captaincy_patterns`) need per-insight enrichment — each existing insight has only 6 fields today; each gains 10 more.

2. **TypeScript / UI (`src/components/insights/InsightsTab.tsx`, `src/lib/types.ts`):** Full rewrite of `InsightCard` to render 5 stacked zones with progress bar + native `<details>` methodology expand. New `InsightsTab` body adds a sticky Decision Summary panel above 4 collapsible sections (Priority + 3 categories). `Insight` interface extended to match pipeline output. Replace `TIER_CLASSES` with `SIGNAL_CLASSES` (6 keys). Replace hardcoded zinc card colors with Phase 78 tokens (`bg-surface border-border`).

The API route is a passthrough — no logic change but new fields flow through automatically. `useInsights` hook is unchanged.

**Primary recommendation:** Sequence the work as **pipeline-first**, then **types**, then **client**. Updating `pipeline/insights.py` first lets the planner schedule the cache regeneration as the boundary between data and UI work; the new fields land in `pipeline/cache/insights.json` and the client picks them up via the existing API passthrough.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Insight data shape (title, metric, takeaway, action_hint, benchmark, gw_coverage, player_ids, team_ids) | Python pipeline | API passthrough | All upstream data (merged players, fixtures, team short names, player web names) is already in pipeline scope; embedding here avoids client-side cross-referencing |
| Signal label computation (`_signal_label(category, confidence_pct, insight_id)`) | Python pipeline | — | D-04 explicitly locates this in the pipeline; client just renders the string |
| `Insight` type contract | TypeScript types (`src/lib/types.ts`) | — | Single source of truth for the API contract on the client side |
| Card rendering (5 zones + progress bar + details expand) | React client component | — | Pure presentation; uses Phase 78 tokens already wired |
| Section collapse/expand state | React client component | — | Local UI state only (D-11: `useState`, no persistence) |
| Decision Summary sticky panel | React client component | — | Derived from the same `Insight[]` array; no API call |
| Icon prefix mapping (▲/●/⚠/★) | React client component (constant) | — | D-06 places icon mapping client-side as a styling concern |
| API passthrough (verify only) | Next.js route handler | — | Existing route in `src/app/api/insights/route.ts` reads cache and forwards JSON.parse'd value verbatim — no schema validation, new fields flow through |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.1 | App router, route handler for `/api/insights` | [VERIFIED: `package.json`] Already in use; per AGENTS.md this is "not the Next.js you know" — read `node_modules/next/dist/docs/` before any router/handler changes |
| React | 19.2.4 | UI rendering, useState for collapse | [VERIFIED: `package.json`] Existing version; native `<details>` is supported in React 19 without ref forwarding gotchas |
| TanStack Query | ^5.95.2 | Existing `useInsights` hook | [VERIFIED: `package.json`] No changes needed — existing 6h staleTime kept |
| Tailwind CSS | ^4 | Token classes (`bg-surface`, `border-border`, `tabular-nums`) | [VERIFIED: `package.json` + `globals.css`] Phase 78 wired tokens via `@theme inline` |
| Vitest + RTL | ^4.1.2 | Component tests for `InsightsTab` | [VERIFIED: `package.json` + `vitest.config.ts`] jsdom env globally; existing `InsightsTab.test.tsx` patterns reused |
| pytest | 8.3.5 | Pipeline tests | [VERIFIED: `python -m pytest --version`] Used by all `pipeline/tests/test_*.py` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Geist Sans | (already loaded) | Font | All text inherits — no per-component font work |
| (none) | — | Icons | Use Unicode chars (▲ ● ⚠ ★) per D-06 — no icon library needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `<details>/<summary>` | Headless UI Disclosure / Radix Collapsible | Locked by D-14; precedent at `PlannerTab.tsx:350-354` shows it works with Tailwind classes; native is zero-bundle |
| Embedded `player_ids[int]` + client-side name resolution via `useMergedPlayers` | Embed `player_names[str]` directly in pipeline output | D-08 / specifics confirm pipeline embeds names directly. Pipeline already has `web_name` per merged player and `short_name` per team — embedding strings avoids second client fetch and avoids partial loading states |
| New separate `decision_summary.json` cache | Derive in-client from `insights.json` | D-07 explicitly forbids a separate pipeline file; client filters & sorts |

**Installation:** No new packages required.

**Version verification:** All package versions verified from in-tree `package.json` (already installed); no npm registry calls needed for this phase.

## Architecture Patterns

### System Architecture Diagram

```
                                                                 ┌──────────────────────────────────┐
                                                                 │ pipeline/insights.py             │
                                                                 │   compute_insights(merged,       │
                                                                 │     bootstrap, fixtures,         │
                                                                 │     summaries, finished_gws)     │
                                                                 │                                  │
   bootstrap.json ──────┐                                        │   ┌──────────────────────────┐   │
   fixtures.json ───────┼───── merge_players() ──── merged ─────►│   │ _defensive_patterns()    │   │
   summaries (per-pl) ──┘                                        │   │ _attacking_patterns()    │   │
                                                                 │   │ _player_patterns()       │   │
                                                                 │   │ _captaincy_patterns()    │   │
                                                                 │   └────────────┬─────────────┘   │
                                                                 │                │                 │
                                                                 │   ┌────────────▼─────────────┐   │
                                                                 │   │ _signal_label() applied  │   │
                                                                 │   │ NEW fields populated     │   │
                                                                 │   │ (title, metric_value,    │   │
                                                                 │   │  takeaway, etc.)         │   │
                                                                 │   └────────────┬─────────────┘   │
                                                                 │                │                 │
                                                                 │           filter/sort            │
                                                                 │                │                 │
                                                                 └────────────────┼─────────────────┘
                                                                                  │
                                                                                  ▼
                                                                  pipeline/cache/insights.json (enriched)
                                                                                  │
                                                                                  │ (passthrough)
                                                                                  ▼
                                                                  GET /api/insights (route handler)
                                                                                  │
                                                                                  │  TanStack Query
                                                                                  ▼
                                                                       useInsights() ──► Insight[]
                                                                                  │
                                                                  ┌───────────────┴───────────────┐
                                                                  │ <InsightsTab>                 │
                                                                  │                               │
                                                                  │   ┌────────────────────────┐  │
                                                                  │   │ Decision Summary panel │  │  ◄── filters: top 3 by
                                                                  │   │ (sticky z-30)          │  │      confidence_pct WHERE
                                                                  │   │  ┌─chip─chip─chip─┐    │  │      player_ids ∪ team_ids
                                                                  │   │  └────────────────┘    │  │      non-empty
                                                                  │   └────────────────────────┘  │
                                                                  │                               │
                                                                  │   ┌────────────────────────┐  │
                                                                  │   │ Priority Insights · 5  │  │  ◄── top 5 by confidence
                                                                  │   │ (collapsible)          │  │
                                                                  │   └────────────────────────┘  │
                                                                  │   ┌────────────────────────┐  │
                                                                  │   │ Defensive · n          │  │
                                                                  │   │ Attacking · n          │  │
                                                                  │   │ Player-Specific · n    │  │
                                                                  │   └────────┬───────────────┘  │
                                                                  │            │                  │
                                                                  │   ┌────────▼───────────────┐  │
                                                                  │   │ <InsightCard>          │  │
                                                                  │   │  zone1: category badge │  │
                                                                  │   │  zone2: title          │  │
                                                                  │   │  zone3: metric + bar   │  │
                                                                  │   │  zone4: takeaway       │  │
                                                                  │   │  zone5: action_hint    │  │
                                                                  │   │  <details>methodology  │  │
                                                                  │   └────────────────────────┘  │
                                                                  └───────────────────────────────┘
```

### Component Responsibilities

| File | Responsibility | Phase 79 Action |
|------|---------------|-----------------|
| `pipeline/insights.py` | Compute insights; emit Insight dicts | **Modify**: extend each dict with 10 new fields; add `_signal_label()` helper |
| `pipeline/run.py` | Orchestrate pipeline; call `compute_insights()` | **Verify only**: existing call signature `compute_insights(merged, bootstrap, fixtures, summaries, finished_gws)` is unchanged (line 214) |
| `pipeline/tests/test_insights.py` | Pipeline tests | **Create new** — does not exist today (verified by `glob pipeline/test_*.py` → only `test_run.py`, `test_merge.py`, etc.; insights has no test file). New tests assert all new fields present + `_signal_label()` rule matrix |
| `src/lib/types.ts` | `Insight` interface (lines 594–601) | **Modify**: extend with 10 new fields |
| `src/components/insights/InsightsTab.tsx` | Component file | **Rewrite**: replace `TIER_CLASSES` with `SIGNAL_CLASSES`; replace `getTier()` with no-op (use `signal_label` from data); rewrite `InsightCard` to 5 zones; add Decision Summary panel; add collapsible sections with chevron + count |
| `src/components/insights/InsightsTab.test.tsx` | Existing component tests | **Rewrite**: existing tests assert `bg-green-100` / `bg-amber-100` / `bg-zinc-100` for HIGH/MEDIUM/LOW + literal `statement` text — all of these need replacement to assert new structure |
| `src/app/api/insights/route.ts` | Passthrough route handler | **Verify only**: code at lines 28–30 does `JSON.parse(data)` then `Response.json(parsed)` — no schema enforcement, new fields flow through automatically |
| `src/lib/hooks/useInsights.ts` | TanStack Query hook | **No change**: returns `Insight[]` typed by import, automatically picks up extended type |
| `src/components/accuracy/AccuracyTab.tsx` | Sibling tab | **No change**: defines its own `TIER_CLASSES` (lines 26–30) — unrelated to InsightsTab redesign |

### Pattern 1: Pipeline Extension Pattern

**What:** Each `_*_patterns()` generator function builds a dict literal. Phase 79 adds 10 keys per dict.

**When to use:** Every `out.append({...})` site in `pipeline/insights.py`.

**Example (extending `def_cs_home_vs_away` in `_defensive_patterns`):**
```python
# Source: pipeline/insights.py:97-107 (existing) extended per D-01/D-04/D-05
out.append({
    'id': 'def_cs_home_vs_away',
    'category': 'defensive',
    'statement': (  # kept for backwards compat per D-03
        f'Home teams keep clean sheets in {home_pct}% of finished fixtures '
        f'({home_cs}/{total}), away teams in {away_pct}%.'
    ),
    'confidence_pct': confidence_pct,
    'sample_n': int(sample_n),
    'sample_total': int(total),
    # New fields per D-01:
    'title': 'Home Clean Sheet Advantage',
    'metric_value': float(home_pct),
    'metric_label': 'CS rate at home',
    'takeaway': f'Home defenders keep clean sheets {home_pct}% of the time — {round(home_pct - away_pct, 1)}pp more than away sides.',
    'action_hint': 'Target home defenders in good runs',
    'benchmark_value': 25.0,  # historical PL CS rate baseline; tune per data
    'gw_coverage': f'GW1–{finished_gws}',  # finished_gws threaded in (already a param)
    'player_ids': [],  # empty for venue-aggregate insight
    'team_ids': [],
    # New per D-04/D-05:
    'signal_label': _signal_label('defensive', confidence_pct, 'def_cs_home_vs_away'),
})
```

### Pattern 2: Signal Label Computation

**What:** Pure helper mapping `(category, confidence_pct, insight_id)` → one of 6 labels.

**When to use:** Called once per insight dict during construction.

**Example:**
```python
# Source: pipeline/insights.py — new helper per D-04
def _signal_label(category: str, confidence_pct: float, insight_id: str) -> str:
    """Map (category, confidence_pct) to one of 6 signal labels.

    Rule precedence: category-specific overrides run BEFORE generic threshold checks.
    Per D-04 in 079-CONTEXT.md.
    """
    # Category-specific overrides (highest precedence)
    if category == 'player' and confidence_pct >= 65:
        return 'Hidden gem'
    if category in ('attacking', 'player') and confidence_pct < 45:
        return 'Trap risk'
    if category == 'defensive' and confidence_pct < 45:
        return 'Regression risk'

    # Generic threshold checks
    if confidence_pct >= 70:
        return 'Strong signal'
    if confidence_pct >= 55:
        return 'Watchlist'
    return 'Weak signal'
```

### Pattern 3: Card Layout (5 Zones + Progress Bar + Details)

**Source pattern: existing precedent at `src/components/price-changes/PriceChangePanel.tsx:127-132` (progress bar) and `src/components/planner/PlannerTab.tsx:350-354` (details/summary).**

```tsx
// New InsightCard skeleton — D-13/D-14/D-15/D-16/D-17
function InsightCard({ insight }: { insight: Insight }) {
  const signalCls = SIGNAL_CLASSES[insight.signal_label] ?? SIGNAL_CLASSES['Weak signal']
  const icon = SIGNAL_ICONS[insight.signal_label] ?? '●'
  const fillPct = Math.max(0, Math.min(100, insight.metric_value))
  const benchmarkPct = Math.max(0, Math.min(100, insight.benchmark_value))
  return (
    <div className="rounded border border-border bg-surface p-4 space-y-2">
      {/* Zone 1: category badge row */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">{CATEGORY_LABELS[insight.category]}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs ${signalCls}`}>
          {icon} {insight.signal_label}
        </span>
      </div>
      {/* Zone 2: title */}
      <h3 className="text-[15px] font-semibold leading-tight">{insight.title}</h3>
      {/* Zone 3: metric + progress bar */}
      <div className="space-y-1">
        <div className="flex items-baseline justify-between">
          <span className="tabular-nums text-3xl font-semibold">{insight.metric_value.toFixed(1)}%</span>
          <span className="text-xs text-muted">{insight.metric_label}</span>
        </div>
        <div className="relative w-full h-2 bg-surface-elevated rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-primary" style={{ width: `${fillPct}%` }} />
          {/* Benchmark line: absolute, taller than bar */}
          <span
            className="absolute top-[-4px] w-px h-4 bg-muted"
            style={{ left: `${benchmarkPct}%` }}
            aria-label={`Benchmark ${benchmarkPct}%`}
          />
        </div>
      </div>
      {/* Zone 4: takeaway */}
      <p className="text-sm text-foreground">{insight.takeaway}</p>
      {/* Zone 5: action hint */}
      <p className="text-xs text-muted">{insight.action_hint}</p>
      {/* Methodology (INS-06, D-14) */}
      <details className="text-xs text-muted">
        <summary className="cursor-pointer select-none">Methodology</summary>
        <p className="mt-1">
          Sample: {insight.sample_n}/{insight.sample_total} · {insight.gw_coverage} · Confidence: {insight.confidence_pct.toFixed(1)}%
        </p>
      </details>
    </div>
  )
}
```

### Pattern 4: Collapsible Section

```tsx
// Source pattern: native React useState — D-11 (no external state)
function CollapsibleSection({
  label, count, children,
}: { label: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)  // D-11: starts expanded
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left text-lg font-semibold mb-2 min-h-[44px]"
        aria-expanded={open}
      >
        <span aria-hidden="true">{open ? '▼' : '▶'}</span>
        <span>{label}</span>
        <span className="text-xs text-muted rounded-full px-2 py-0.5 bg-surface-elevated">{count}</span>
      </button>
      {open && <div className="space-y-3">{children}</div>}
    </div>
  )
}
```

### Pattern 5: Decision Summary Panel

```tsx
// Source pattern: D-07/D-08/D-09 — sticky below nav (z-30; nav is z-40 per Phase 78 D-07)
function DecisionSummary({ insights }: { insights: Insight[] }) {
  const candidates = insights
    .filter(i => i.player_ids.length > 0 || i.team_ids.length > 0)
    .sort((a, b) => b.confidence_pct - a.confidence_pct)
    .slice(0, 3)
  // D-07 fallback: if fewer than 3 with entity lists, fall back to top 3 by confidence overall
  const top3 = candidates.length >= 3
    ? candidates
    : [...insights].sort((a, b) => b.confidence_pct - a.confidence_pct).slice(0, 3)
  if (top3.length === 0) return null
  return (
    <div className="sticky top-[var(--nav-height,96px)] z-30 bg-surface/95 backdrop-blur-sm border-b border-border -mx-4 px-4 py-3">
      <h2 className="text-sm font-semibold mb-2">Decision Summary</h2>
      <ul className="space-y-2">
        {top3.map(insight => (
          <li key={insight.id} className="text-sm flex flex-wrap items-center gap-2">
            <span>{insight.action_hint}</span>
            {insight.player_names?.map(name => (
              <span key={name} className="rounded-full px-2 py-0.5 text-xs bg-surface-elevated text-foreground">
                {name}
              </span>
            ))}
            {insight.team_names?.map(team => (
              <span key={team} className="rounded-full px-2 py-0.5 text-xs bg-surface-elevated text-foreground">
                {team}
              </span>
            ))}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

### Recommended Project Structure

No new directories or files — all changes are in-place edits or test creation:
```
pipeline/
├── insights.py                            # Modify: add fields + _signal_label()
└── tests/
    └── test_insights.py                   # CREATE — does not exist today
src/
├── components/
│   └── insights/
│       ├── InsightsTab.tsx                # Rewrite
│       └── InsightsTab.test.tsx           # Rewrite
├── lib/
│   ├── types.ts                           # Modify Insight interface
│   └── hooks/
│       └── useInsights.ts                 # No change
└── app/
    └── api/
        └── insights/
            └── route.ts                   # Verify only
```

### Anti-Patterns to Avoid

- **Don't keep `getTier(pct)`/`TIER_CLASSES` for backwards compat** — D-05 specifies the pipeline emits `signal_label` directly. Client-side derivation re-introduces the duplication problem (signal label has 6 buckets, not 3).
- **Don't import `MergedPlayer[]` from `useMergedPlayers` to resolve player chip names** — Discretion item resolved by D-08 + Specifics: pipeline embeds names directly. Two-call pattern adds loading states and consistency bugs.
- **Don't use `<Image>` from `next/image` for any new visual element** — established codebase convention (CLAUDE.md/AGENTS.md context + Phase 77 pattern: plain `<img>` with `onError`). Phase 79 has no images.
- **Don't add a separate sticky offset value** — Phase 78 sticky nav is `top-0 z-40`; Decision Summary is `z-30` and stacks below. Use the existing nav height; don't introduce a new offset variable.
- **Don't break `AccuracyTab.tsx`** — it has its own `TIER_CLASSES` (line 26–30) which looks identical to the InsightsTab one but is independent. Leave AccuracyTab alone.
- **Don't add a separate pipeline cache file for Decision Summary** — D-07 explicitly forbids this. Derive client-side.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collapse/expand transitions | Custom collapse animation logic | Conditional render via `useState` + `aria-expanded` (D-11) | Simple toggle is sufficient; no animation requested; less code, no scroll-jank edge cases |
| Methodology hover/expand | JS state + onMouseEnter/Leave handlers | `<details>/<summary>` (D-14, precedent at `PlannerTab.tsx:350`) | Native browser semantics, keyboard accessible by default, zero JS, supports keyboard toggle without ARIA work |
| Chip components for player/team names | New `<Chip>` component | Inline `<span className="rounded-full px-2 py-0.5 text-xs bg-surface-elevated">` | Phase 78 D-10 pill pattern used by `LastUpdated.tsx:12` and section nav already; inline span is sufficient |
| Player name resolution | Cross-fetching `MergedPlayer[]` to look up name from `player_id` | Embed `player_names: string[]` (and `team_names: string[]`) in pipeline output alongside the IDs (Discretion + Specifics) | Pipeline already has access to `web_name` and `team_short_name` per D-08; one extra string field per insight saves a client roundtrip and avoids partial-load races |
| Numeric font alignment | Custom CSS for tabular numerics | `tabular-nums` class — Phase 78 VIS-02 wired this globally via `globals.css:59-61` | Existing token; D-17 explicitly references it |

**Key insight:** Phase 79 changes are predominantly **shape changes** (data fields + JSX zones), not new behaviors. Reach for native HTML (`<details>`, `<button>`) and existing tokens (`bg-surface`, `border-border`, `tabular-nums`, `rounded-full px-2 py-0.5 text-xs`) before any custom abstraction.

## Common Pitfalls

### Pitfall 1: Stale Cache After Pipeline Change
**What goes wrong:** Pipeline `compute_insights()` is updated and tests pass, but the developer is testing the UI against `pipeline/cache/insights.json` from a previous run that lacks the new fields. UI either crashes (TypeError on `undefined.toFixed`) or silently shows blank cards.

**Why it happens:** Pipeline run is a manual trigger via `python pipeline/run.py`. Cache is gitignored or stale.

**How to avoid:** Phase 79 plan includes a step to either (a) re-run `python pipeline/run.py` after `insights.py` changes, OR (b) seed a small test fixture for `pipeline/cache/insights.json` that exercises all 6 signal labels. Option (b) decouples UI verification from a full pipeline run.

**Warning signs:** UI shows "0.0% / undefined / Methodology" or `TypeError: Cannot read properties of undefined`. Existing test fixture in `InsightsTab.test.tsx:23-56` still has only the 6 old fields — must be expanded.

### Pitfall 2: API Route Schema Enforcement Surprise
**What goes wrong:** Developer assumes the API route validates incoming JSON shape and surfaces helpful errors, then the new `signal_label` field fails to render because of a hidden filter.

**Why it happens:** Common Next.js pattern is to add zod validation in route handlers; reviewer assumes it exists.

**How to avoid:** Verify (already verified in this research): `src/app/api/insights/route.ts:29-30` does `JSON.parse(data)` and `Response.json(parsed)` with no validation. New fields **flow through verbatim**. No route changes needed for Phase 79.

**Warning signs:** Test failures isolated to fields the pipeline emits but the UI doesn't see — would indicate a hidden serializer; not present in this codebase.

### Pitfall 3: Sticky Stack Conflicts (Decision Summary z-index vs. Nav)
**What goes wrong:** Decision Summary either floats above the section nav (covering the tabs) or scrolls offscreen.

**Why it happens:** Sticky panels need correct `top-` offset to sit below the existing sticky nav (`page.tsx:177` is `sticky top-0 z-40`). If `top-0` is used on Decision Summary, it stacks **at the same y-position** as the nav (visually on top, hiding it).

**How to avoid:** Use `top-[var(--nav-height,...)]` or a numeric offset matching the rendered nav height. D-09 specifies `sticky top-[nav-height] z-30` and `bg-surface/95 backdrop-blur-sm`. Inspect rendered nav height (Phase 78: section tabs row + sub-tabs row both `py-2` with `min-h-[44px]` buttons → ~96px combined). Plan to either define a CSS var in `globals.css` or use a Tailwind-friendly fixed offset (e.g. `top-[96px]`).

**Warning signs:** Decision Summary pinned to viewport top covering the section pills, OR scrolls offscreen and never reappears.

### Pitfall 4: `<details>` Default Open State Race
**What goes wrong:** Opening a card's methodology re-renders the parent and collapses other cards' methodology state.

**Why it happens:** `<details>` is uncontrolled native state. When the React tree re-renders (e.g. parent state changes), the `<details>` open state is preserved — but if you remount the component (e.g. by changing `key`), the open state resets.

**How to avoid:** Don't change `key` on `InsightCard` based on volatile state (e.g. don't include `Date.now()` or random values). Use `key={insight.id}` (stable). Otherwise this pitfall doesn't fire.

**Warning signs:** User opens methodology, scrolls, then methodology silently re-collapses. Diagnose by checking parent component's render conditions.

### Pitfall 5: 6-Label `SIGNAL_CLASSES` Map Missing a Key
**What goes wrong:** Pipeline emits `'Hidden gem'` but client falls back to default styling because the constant only has 5 keys.

**Why it happens:** Type-level enforcement. The `Insight['signal_label']` type should be a string literal union of the 6 labels — if it's just `string`, TypeScript won't catch a missing key in `SIGNAL_CLASSES`.

**How to avoid:** Type `signal_label` in `Insight` as `'Strong signal' | 'Watchlist' | 'Weak signal' | 'Trap risk' | 'Regression risk' | 'Hidden gem'`. Type `SIGNAL_CLASSES` and `SIGNAL_ICONS` as `Record<NonNullable<Insight['signal_label']>, string>`. TypeScript will then enforce all 6 keys at compile time.

**Warning signs:** Card renders with no signal badge (or default zinc fallback) for a specific subset of insights.

### Pitfall 6: Pipeline Test File Doesn't Exist Yet
**What goes wrong:** The CONTEXT.md D-02 says "pipeline test (`pipeline/test_insights.py` if it exists)" — implying it might. Verified: it does NOT exist. Plan must CREATE it (or use existing test_run.py patterns at `pipeline/tests/test_run.py`).

**Why it happens:** No test was created in Phase 33 when `insights.py` was originally written. Phase 79 introduces new structural fields, so this is the right time to add coverage.

**How to avoid:** Plan a Wave 0 task: create `pipeline/tests/test_insights.py` with imports, conftest pattern from `pipeline/tests/conftest.py:13-15` (`sys.path.insert(0, PIPELINE_DIR)`), and an empty test stub. Then Wave 2 fills in real assertions.

**Warning signs:** Plan references "update existing tests" without checking the file exists.

## Runtime State Inventory

> Phase 79 is partly a refactor (rename `LOW/MEDIUM/HIGH` → 6 semantic labels), so this section applies.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `pipeline/cache/insights.json` — 11 records currently (verified by reading file) with old 6-field shape only. Will be **regenerated on next `python pipeline/run.py`** with new 16-field shape. No data migration needed because cache is rebuilt every run. | Re-run pipeline to regenerate cache after `insights.py` change |
| Live service config | None — no external service holds insight data. Vercel Blob hosts a copy when `USE_BLOB=true` (verified: `route.ts:11-23`), but it's overwritten each pipeline upload. | Re-run pipeline (existing CI/cron) — handled implicitly |
| OS-registered state | None — no scheduled tasks reference insight categories or labels. | None |
| Secrets / env vars | `USE_BLOB` env var (read at `route.ts:5`) — not affected by Phase 79 schema change. | None |
| Build artifacts / installed packages | `pipeline/__pycache__/insights.cpython-311.pyc` exists from prior runs — Python auto-invalidates by mtime. No manual cleanup needed. | None |

**Other code that depends on the old `LOW/MEDIUM/HIGH` tier vocabulary:**
- `src/components/accuracy/AccuracyTab.tsx:26-30` defines its own `TIER_CLASSES` for **hit rate tiers** — semantically different from insight signals. Verified: comment at line 25 says "reused verbatim from InsightsTab (TIER_CLASSES locked by 33-UI-SPEC)" but it's a copy not an import. **No action needed** — Phase 79 leaves AccuracyTab untouched. The naming-similarity is a foot-gun for future agents but not Phase 79's concern.
- `src/components/insights/InsightsTab.test.tsx` — 6 of 11 tests (lines 84–127, 84-100 specifically) assert `bg-green-100` / `bg-amber-100` / `bg-zinc-100` and literal "HIGH"/"MEDIUM"/"LOW" badge text. Will need rewrite when `TIER_CLASSES` is replaced.

**The canonical question — after every file in the repo is updated, what runtime systems still have the old strings cached, stored, or registered?**
Answer: only `pipeline/cache/insights.json` and (if used) Vercel Blob's `insights.json` blob. Both are rebuilt by `python pipeline/run.py`. No manual data migration required.

## Code Examples

### Existing Insight Dict Shape (current state)
```python
# Source: pipeline/cache/insights.json (as of 2026-05-08)
{
  "id": "att_home_goal_share",
  "category": "attacking",
  "statement": "55.2% of all goals this season have been scored by the home team (532/964).",
  "confidence_pct": 55.2,
  "sample_n": 532,
  "sample_total": 964
}
```

### Target Insight Dict Shape (Phase 79)
```python
# Source: D-01 + D-04/D-05 from 079-CONTEXT.md
{
  # — existing 6 fields kept verbatim per D-03 —
  "id": "att_home_goal_share",
  "category": "attacking",
  "statement": "55.2% of all goals this season have been scored by the home team (532/964).",
  "confidence_pct": 55.2,
  "sample_n": 532,
  "sample_total": 964,
  # — 10 new fields per D-01/D-04/D-05/D-08+specifics —
  "title": "Home Field Goal Share",
  "metric_value": 55.2,
  "metric_label": "of league goals scored at home",
  "takeaway": "Home teams are scoring more than half of all PL goals this season.",
  "action_hint": "Favour home attackers in fixture-good runs",
  "benchmark_value": 50.0,
  "gw_coverage": "GW1–34",
  "player_ids": [],
  "team_ids": [],
  "player_names": [],   # specifics: embed names alongside IDs
  "team_names": [],
  "signal_label": "Watchlist"
}
```

### Existing Insight TypeScript Interface
```typescript
// Source: src/lib/types.ts:594-601 (current)
export interface Insight {
  id: string
  category: 'defensive' | 'attacking' | 'player' | 'captaincy'
  statement: string
  confidence_pct: number
  sample_n: number
  sample_total: number
}
```

### Target Insight TypeScript Interface
```typescript
// Source: D-02 — extend to match pipeline output
export type SignalLabel =
  | 'Strong signal'
  | 'Watchlist'
  | 'Weak signal'
  | 'Trap risk'
  | 'Regression risk'
  | 'Hidden gem'

export interface Insight {
  // existing 6 fields (kept)
  id: string
  category: 'defensive' | 'attacking' | 'player' | 'captaincy'
  statement: string
  confidence_pct: number
  sample_n: number
  sample_total: number
  // new fields (D-01)
  title: string
  metric_value: number
  metric_label: string
  takeaway: string
  action_hint: string
  benchmark_value: number
  gw_coverage: string
  player_ids: number[]
  team_ids: number[]
  player_names: string[]
  team_names: string[]
  // signal computation (D-04/D-05)
  signal_label: SignalLabel
}
```

### Progress Bar with Benchmark Line
```tsx
// Source pattern: existing src/components/price-changes/PriceChangePanel.tsx:127-132
// Phase 79 extension: add the absolute-positioned benchmark line per D-13
const fillPct = Math.max(0, Math.min(100, insight.metric_value))
const benchmarkPct = Math.max(0, Math.min(100, insight.benchmark_value))

<div className="relative w-full h-2 bg-surface-elevated rounded-full overflow-hidden">
  <div className="h-full rounded-full bg-primary" style={{ width: `${fillPct}%` }} />
  <span
    className="absolute top-[-4px] w-px h-4 bg-muted"
    style={{ left: `${benchmarkPct}%` }}
    aria-label={`Benchmark ${benchmarkPct}%`}
  />
</div>
```

### Native Details/Summary (existing precedent)
```tsx
// Source: src/components/planner/PlannerTab.tsx:350-354 (precedent in codebase)
<details className="text-sm text-zinc-500 dark:text-zinc-400">
  <summary className="cursor-pointer select-none hover:text-zinc-700 dark:hover:text-zinc-300">
    How do chips work in the planner?
  </summary>
  <ul className="mt-2 ml-4 space-y-1 list-disc">
    {/* content */}
  </ul>
</details>
```

### Pipeline Test Conftest Pattern
```python
# Source: pipeline/tests/conftest.py — already exists, used by all pipeline tests
import os
import sys
PIPELINE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PIPELINE_DIR not in sys.path:
    sys.path.insert(0, PIPELINE_DIR)
# Phase 79 test_insights.py imports `from insights import compute_insights, _signal_label`
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 3-tier `LOW`/`MEDIUM`/`HIGH` badge derived client-side from `confidence_pct` | 6-label semantic `signal_label` derived in pipeline by `_signal_label()` | Phase 79 | Badge meaning becomes context-aware (category × confidence) instead of confidence-only |
| Card renders `statement` field as the entire card body (one paragraph) | Card renders 5 structured zones from typed fields | Phase 79 | Scannable layout; readers spot the metric, takeaway, and action without reading prose |
| InsightsTab single flat list grouped by category | Sticky Decision Summary + Priority Insights + 3 collapsible category sections | Phase 79 | Top actions surface above the fold; less-relevant categories collapsible |
| Hardcoded `bg-white dark:bg-zinc-900` card shell | Phase 78 token classes `bg-surface border-border` | Phase 79 (carry-forward from Phase 78) | Theme tokens flow through; light/dark consistency |
| Hardcoded `bg-zinc-200 dark:bg-zinc-700` progress-bar track | Phase 78 token `bg-surface-elevated` | Phase 79 | Aligns with token system established in Phase 78 |

**Deprecated/outdated:**
- `TIER_CLASSES` const + `getTier(pct)` function in `InsightsTab.tsx:7-19` — replaced by `SIGNAL_CLASSES` + direct `insight.signal_label` rendering.
- `title=` HTML attribute tooltip on the badge (`InsightsTab.tsx:38`) — replaced by `<details>` methodology expand for INS-06.
- 6-field `Insight` interface (`types.ts:594-601`) — extended to 16 fields.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Sticky nav rendered height is approximately 96px (section tabs row `py-2 min-h-[44px]` + sub-tabs row `py-2 min-h-[44px]`) | Pitfall 3 (Sticky stack conflicts) | Decision Summary either covers the nav (too high) or has a gap above it (too low). Mitigation: implementer measures the actual rendered height in DevTools or defines a CSS var |
| A2 | `benchmark_value` default for venue/league-aggregate insights should be `50.0` (e.g. equal-share baseline) where not specified by pipeline math | Code Examples | Visual benchmark line lands in a meaningless position. Mitigation: planner can ask user what benchmark to use per insight ID, or pipeline computes a per-insight default (e.g. league average from prior season) |
| A3 | `gw_coverage` is derived as `f"GW1–{finished_gws}"` for season-aggregate insights | Pattern 1 | Display string format may be wrong (e.g. user expects "GW 1–34" with space, or per-insight overrides for window-specific patterns like `pts_last5gw`). Mitigation: pattern-helper-by-pattern review during implementation |
| A4 | The pipeline can compute and embed `player_names` and `team_names` directly without an extra fetch | Standard Stack alternatives + Don't Hand-Roll | Discretion item resolved by D-08+specifics. If pipeline-side embedding turns out infeasible, fall back to client-side resolution via `useMergedPlayers`. Risk: low — verified pipeline already accesses `web_name` (`merge.py:888`) and `team_short_name` (`merge.py:890`) |
| A5 | All existing 11 insight IDs need new field population (none can omit `title`/`metric_value` etc.) | Pattern 1 | Some insights (e.g. `def_cs_streak_ge2`) may not have a sensible `metric_value` percentage — could be a count fraction. Mitigation: planner reviews each of the 11 current insights and assigns the right metric per ID |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

## Open Questions (RESOLVED)

1. **Per-insight benchmark values.** The pipeline currently has no notion of a "league average" for each metric. Each new insight ID needs a documented benchmark. Some are obvious (home/away CS rate → ~25%; double-digit haul rate → ~5%), others are not (top-team goal share → ?).
   - What we know: D-01 calls benchmark_value "typically league average for that metric"; existing pipeline math computes the metric value but not an explicit benchmark.
   - What's unclear: source-of-truth for benchmark values per insight ID — historical means? hardcoded?
   - Recommendation: planner adds a per-insight-ID benchmark constant table at the top of `pipeline/insights.py` for transparency, and lets implementer fill in sensible defaults (subject to user review during plan-check).
   - **RESOLVED (079-01-PLAN.md):** `BENCHMARK_DEFAULTS` dict in Plan 01 enumerates hardcoded constants per insight ID (def_cs_home_vs_away→25.0, att_home_goal_share→50.0, cap_double_digit_haul_rate→15.0, etc.). Implementer fills in sensible defaults; user can tune post-execution.

2. **Action hint text per insight.** D-01 specifies the field exists ("e.g. 'Target home defenders in good runs'") but doesn't enumerate strings for all 11 current insights.
   - What we know: D-01 example covers `def_cs_home_vs_away`; the other 10 insights need their own action hints.
   - What's unclear: whether action hints are pure prose in the pipeline (one string per ID) or computed from data (e.g. "Sell {player_name} now" templated).
   - Recommendation: pure prose strings per insight ID — keep pipeline simple. Planner enumerates all 11 in plan and surfaces them for user sign-off if uncertain.
   - **RESOLVED (079-01-PLAN.md):** `INSIGHT_ACTION_HINTS` dict in Plan 01 enumerates verb-led ≤7-word strings for all insight IDs (e.g. "Target home defenders in good runs", "Prioritise top-six defence assets"). Pure prose, no templating.

3. **Title strings per insight.** Same question as action hints — D-01 gives one example title but 10 others need defining.
   - Recommendation: as above — pure prose per insight ID.
   - **RESOLVED (079-01-PLAN.md):** `INSIGHT_TITLES` dict in Plan 01 enumerates ≤4-word noun phrases for all insight IDs (e.g. "Home Clean Sheet Edge", "Top Team Clean Sheets", "Home Field Goal Share").

4. **What if `_signal_label()` returns "Watchlist" for all 11 current insights?** Looking at the cache: confidence_pcts are 55.2, 20.7, 7.2, 4.6, 3.0, 31.6, 28.4, 5.0, 32.1, 2.6, 0.7. The 55.2% one would be "Watchlist"; the rest fall under 55% so default to "Weak signal" or category-overrides ("Trap risk" / "Regression risk").
   - What we know: the rule matrix from D-04 produces a coherent distribution given current data — most current insights would land "Weak signal"/"Trap risk"/"Regression risk".
   - What's unclear: whether the user expects to see "Strong signal" / "Hidden gem" labels at all in the v1.13 release with current pipeline output.
   - Recommendation: include this distribution check in the plan-check / verify step. If "Strong signal" never appears in the actual cache, that's not a bug per D-04 — it just means pipeline doesn't currently emit a high-confidence pattern. Document as expected.
   - **RESOLVED (079-04-PLAN.md):** Plan 04 verification step confirms signal-label distribution from the regenerated cache. If "Strong signal"/"Hidden gem" never appear, this is documented as expected behavior (D-04 rule matrix, not a bug). No pipeline changes needed.

5. **Section ordering on screen.** D-10 says Priority Insights first. But the existing tab is grouped `defensive → attacking → player → captaincy`. Phase 79 adds Priority + 3 categories (the CONTEXT.md mentions "Defensive Patterns, Attacking Patterns, Player-Specific Patterns" — note **captaincy is dropped from the named sections in INS-04**).
   - What we know: INS-04 mentions 4 sections: "Priority Insights, Defensive Patterns, Attacking Patterns, Player-Specific Patterns." `captaincy` insights still exist (`cap_top3_xpts_share`, `cap_double_digit_haul_rate`).
   - What's unclear: where do `captaincy` insights render in the new layout? Drop them? Render them in Priority only? Add a 5th "Captaincy" section?
   - Recommendation: planner clarifies with user during plan-check — likely either (a) keep a Captaincy section to match the existing 4 categories, OR (b) merge captaincy into Priority Insights only. The CONTEXT.md is silent on this; the INS-04 requirement names only 3 categories.
   - **RESOLVED (079-03-PLAN.md):** A 5th "Captaincy Insights" section is added. Final section order: Priority Insights → Defensive Patterns → Attacking Patterns → Player-Specific Patterns → Captaincy Insights. All 4 existing categories get their own collapsible section; no insights are orphaned.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js + npm | Next.js dev/build | ✓ | (existing project) | — |
| Python 3.11+ | Pipeline | ✓ | 3.11.9 | — |
| pytest | Pipeline tests | ✓ | 8.3.5 | — |
| Vitest + jsdom | Component tests | ✓ | ^4.1.2 | — |
| TanStack Query | useInsights hook | ✓ | ^5.95.2 | — |
| Tailwind CSS | Token classes | ✓ | ^4 | — |
| Existing `pipeline/cache/` artifacts | Local end-to-end verification | ✓ | (last run produced 11 insights, 2026-05-08) | Test fixture in InsightsTab.test.tsx covers UI without re-running pipeline |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None — all required tooling is installed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| TS framework | Vitest ^4.1.2 + @testing-library/react |
| TS config file | `vitest.config.ts` (jsdom global env) |
| TS quick run | `npx vitest run src/components/insights/InsightsTab.test.tsx` |
| TS full suite | `npm test` (vitest run) |
| Python framework | pytest 8.3.5 |
| Python config | `pipeline/tests/conftest.py` (sys.path injection) |
| Python quick run | `python -m pytest pipeline/tests/test_insights.py -x` |
| Python full suite | `python -m pytest pipeline/tests/` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INS-01 | Pipeline emits 5 structured fields per insight | Python unit | `python -m pytest pipeline/tests/test_insights.py::test_each_insight_has_structured_fields -x` | Wave 0 |
| INS-01 | Card renders 5 distinct zones | TS component | `npx vitest run src/components/insights/InsightsTab.test.tsx -t "5 zones"` | Wave 0 (rewrite existing) |
| INS-02 | `_signal_label()` produces correct label per (category, confidence_pct) matrix | Python unit | `python -m pytest pipeline/tests/test_insights.py::test_signal_label_rules -x` | Wave 0 |
| INS-02 | Card renders `signal_label` text + matching icon prefix | TS component | `npx vitest run src/components/insights/InsightsTab.test.tsx -t "signal badge"` | Wave 0 (rewrite) |
| INS-03 | Progress bar renders fill + benchmark line for percentage metric | TS component | `npx vitest run src/components/insights/InsightsTab.test.tsx -t "progress bar"` | Wave 0 (new test) |
| INS-04 | InsightsTab renders 4 sections with count badges | TS component | `npx vitest run src/components/insights/InsightsTab.test.tsx -t "section structure"` | Wave 0 (rewrite) |
| INS-04 | Sections collapsible via chevron toggle | TS component | `npx vitest run src/components/insights/InsightsTab.test.tsx -t "collapsible"` | Wave 0 (new test) |
| INS-05 | Decision Summary panel sticky and renders top 3 with chips | TS component | `npx vitest run src/components/insights/InsightsTab.test.tsx -t "Decision Summary"` | Wave 0 (new test) |
| INS-06 | `<details>` methodology reveal text format | TS component | `npx vitest run src/components/insights/InsightsTab.test.tsx -t "methodology"` | Wave 0 (new test) |
| INS-06 | Pipeline emits `gw_coverage` field on every insight | Python unit | `python -m pytest pipeline/tests/test_insights.py::test_gw_coverage_present -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** TS — `npx vitest run src/components/insights/`. Python — `python -m pytest pipeline/tests/test_insights.py -x`.
- **Per wave merge:** Both quick runs above + `python -m pytest pipeline/tests/` (full pipeline suite — protects against integration regressions).
- **Phase gate:** Full suite (`npm test` AND `python -m pytest pipeline/tests/`) green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `pipeline/tests/test_insights.py` — does NOT exist today; create with stubs covering INS-01/INS-02/INS-06 (pipeline-side requirements). Use `pipeline/tests/conftest.py` sys.path pattern.
- [ ] Rewrite `src/components/insights/InsightsTab.test.tsx` — existing tests assert old structure (`HIGH`/`MEDIUM`/`LOW` badge text + literal `statement` text). All new fixture data must include the 16-field `Insight` shape.
- [ ] Build a new fixture (or factory) for the `Insight[]` test data — current fixture at `InsightsTab.test.tsx:23-56` has 4 insights with 6 fields; needs ≥6 insights covering all 6 signal labels with all 16 fields.

## Security Domain

> Phase 79 has no auth, session, network, or input-validation surface. The only data flow is: Python pipeline → static JSON → API route passthrough → client render. No user input. No new external network calls. No new query parameters. No new cookies/headers.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — (insights are public, no per-user data) |
| V5 Input Validation | no | — (no user input in this phase) |
| V6 Cryptography | no | — |

### Known Threat Patterns for {React + Next.js + JSON-passthrough route}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via uncontrolled string render in card | Tampering / Information Disclosure | React JSX auto-escapes string children — no `dangerouslySetInnerHTML` introduced; takeaway/action_hint/title rendered as `{insight.field}` not raw HTML |
| Prototype pollution via JSON.parse on cache | Tampering | Cache file is generated by trusted pipeline; no untrusted source feeds it. `Object.create(null)` not required because no dynamic property assignment from untrusted keys. |
| Excess data exposure via API | Information Disclosure | All 16 fields on each insight are public-by-design (season aggregates, anonymized counts). No PII. No per-user fields. |

## Sources

### Primary (HIGH confidence)
- `.planning/phases/079-insight-card-redesign/079-CONTEXT.md` — locked decisions D-01 through D-17 + Discretion + Specifics
- `.planning/REQUIREMENTS.md` §INS-01 through §INS-06 — full requirement text (lines 81–87)
- `.planning/ROADMAP.md` §Phase 79 (lines 761–773) — goal + 6 success criteria
- `pipeline/insights.py` — current `compute_insights()`, generator function shapes (lines 79, 210, 294, 379)
- `pipeline/cache/insights.json` — current 11-insight cache (verified shape)
- `pipeline/run.py:214` — call site for `compute_insights(merged, bootstrap, fixtures, summaries, finished_gws)`
- `pipeline/merge.py:884-890` — verified `web_name` and `team_short_name` per merged player
- `pipeline/tests/conftest.py:1-15` — sys.path pattern for pipeline tests
- `src/components/insights/InsightsTab.tsx` — current InsightCard at lines 30–43; `TIER_CLASSES` at 7–11; `getTier()` at 15–19
- `src/components/insights/InsightsTab.test.tsx` — current tests + fixture
- `src/lib/types.ts:594-601` — current `Insight` interface
- `src/lib/hooks/useInsights.ts` — TanStack Query hook (verified no changes needed)
- `src/app/api/insights/route.ts:28-30` — passthrough verification
- `src/app/globals.css:5-31` — Phase 78 design tokens (`--surface`, `--border`, `--muted`, `--surface-elevated`, accent colors)
- `src/app/page.tsx:177` — sticky nav `top-0 z-40 bg-surface/95 backdrop-blur-sm border-b border-border` (Phase 78 D-08)
- `src/components/price-changes/PriceChangePanel.tsx:127-132` — existing progress-bar primitive
- `src/components/planner/PlannerTab.tsx:350-354` — existing `<details>/<summary>` precedent
- `src/components/LastUpdated.tsx:12,19` — existing pill badge pattern (Phase 78 D-10)
- `src/components/accuracy/AccuracyTab.tsx:25-30` — separate `TIER_CLASSES` not affected by Phase 79
- `package.json` — verified: Next.js 16.2.1, React 19.2.4, Vitest ^4.1.2, TanStack Query ^5.95.2, Tailwind ^4
- `vitest.config.ts` — verified: jsdom global env, `@/` alias to `./src`
- `CLAUDE.md` + `AGENTS.md` — project directives
- `.planning/phases/078-ui-visual-foundation/078-CONTEXT.md` — Phase 78 token decisions D-01 through D-12

### Secondary (MEDIUM confidence)
- None — all claims verified against in-tree files.

### Tertiary (LOW confidence)
- A1 (sticky nav rendered height ≈96px) — derived from `py-2` + `min-h-[44px]` × 2 rows; not measured. Flag for verification at implementation time.
- A2/A3 (default values for `benchmark_value` and `gw_coverage` formats) — best-guess defaults; require planner sign-off.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package/version verified against in-tree `package.json` and `vitest.config.ts`.
- Architecture: HIGH — locked by 17 D-decisions in CONTEXT.md; pipeline + client paths verified by reading the actual files.
- Pitfalls: HIGH — 6 pitfalls grounded in specific verified file references; all surfaced from existing codebase reading.
- Open questions: MEDIUM — 5 questions are real gaps (benchmark values, action hint strings, title strings, signal-label distribution sanity check, captaincy section placement). Captaincy section question is the most consequential; planner should escalate to user during plan-check.

**Research date:** 2026-05-08
**Valid until:** 2026-06-07 (30 days — codebase is stable; the only volatility is `pipeline/cache/insights.json` which regenerates per pipeline run)
