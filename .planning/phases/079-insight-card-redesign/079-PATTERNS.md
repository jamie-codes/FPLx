# Phase 79: Insight Card Redesign - Pattern Map

**Mapped:** 2026-05-08
**Files analyzed:** 6 (create/modify; 2 verify-only excluded from pattern table)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `pipeline/insights.py` | service/transformer | batch, transform | `pipeline/insights.py` itself (self-extension) | self |
| `pipeline/tests/test_insights.py` | test | batch | `pipeline/tests/test_accuracy.py` | exact |
| `src/lib/types.ts` | model | request-response | `src/lib/types.ts` itself (lines 594-601, self-extension) | self |
| `src/components/insights/InsightsTab.tsx` | component | request-response | `src/components/insights/InsightsTab.tsx` (self-rewrite) + `src/components/accuracy/AccuracyTab.tsx` | self + role-match |
| `src/components/insights/InsightsTab.test.tsx` | test | request-response | `src/components/insights/InsightsTab.test.tsx` (self-rewrite) | self |
| `src/app/api/insights/route.ts` | route | request-response | (verify only — no changes) | n/a |

---

## Pattern Assignments

### `pipeline/insights.py` (service/transformer, batch)

**Analog:** self — extend existing `out.append({...})` sites in `_defensive_patterns`, `_attacking_patterns`, `_player_patterns`, `_captaincy_patterns`.

**Existing dict construction pattern** (`pipeline/insights.py` lines 97-107 — representative of all 11 sites):
```python
out.append({
    'id': 'def_cs_home_vs_away',
    'category': 'defensive',
    'statement': (
        f'Home teams keep clean sheets in {home_pct}% of finished fixtures '
        f'({home_cs}/{total}), away teams in {away_pct}%.'
    ),
    'confidence_pct': confidence_pct,
    'sample_n': int(sample_n),
    'sample_total': int(total),
})
```

**New `_signal_label()` helper to add at module top (per D-04):**
```python
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

**Extended dict pattern (all 10 new fields to append to every `out.append({...})`):**
```python
# After the existing 6 fields, add:
    'title': 'Home Clean Sheet Advantage',          # short card heading
    'metric_value': float(home_pct),                # headline number (float)
    'metric_label': 'CS rate at home',              # axis/unit label
    'takeaway': (                                   # plain-English meaning
        f'Home defenders keep clean sheets {home_pct}% of the time — '
        f'{round(home_pct - away_pct, 1)}pp more than away sides.'
    ),
    'action_hint': 'Target home defenders in good runs',
    'benchmark_value': 25.0,                        # reference line value (float, 0-100)
    'gw_coverage': f'GW1–{finished_gws}',     # em-dash, e.g. "GW1–34"
    'player_ids': [],                               # list[int] — empty if not player-specific
    'team_ids': [],                                 # list[int] — empty if not team-specific
    'player_names': [],                             # list[str] — web_name from merged player
    'team_names': [],                               # list[str] — short_name from bootstrap teams
    'signal_label': _signal_label('defensive', confidence_pct, 'def_cs_home_vs_away'),
```

**`compute_insights()` required-keys guard to update** (lines 68-69) — extend `required` set:
```python
required = {
    'id', 'category', 'statement', 'confidence_pct', 'sample_n', 'sample_total',
    'title', 'metric_value', 'metric_label', 'takeaway', 'action_hint',
    'benchmark_value', 'gw_coverage', 'player_ids', 'team_ids',
    'player_names', 'team_names', 'signal_label',
}
```

**All 11 insight IDs and their generator functions (for locating every `out.append` site):**

| Insight ID | Generator function | Lines (approx.) |
|---|---|---|
| `def_cs_home_vs_away` | `_defensive_patterns` | 97-107 |
| `def_cs_rate_top6_vs_rest` | `_defensive_patterns` | 150-160 |
| `def_cs_streak_ge2` | `_defensive_patterns` | 195-205 |
| `att_top_xg_overperformers` | `_attacking_patterns` | 229-239 |
| `att_home_goal_share` | `_attacking_patterns` | 248-258 |
| `att_top_team_goal_share` | `_attacking_patterns` | 279-289 |
| `player_buy_signal_count` | `_player_patterns` | 313-323 |
| `player_sell_signal_count` | `_player_patterns` | 330-340 |
| `player_diff_count` | `_player_patterns` | 347-357 |
| `player_template_trap_count` | `_player_patterns` | 364-374 |
| `cap_top3_xpts_share` | `_captaincy_patterns` | 397-407 |
| `cap_double_digit_haul_rate` | `_captaincy_patterns` | 421-432 |

**Player/team name embedding pattern** — pipeline already accesses `web_name` and `short_name`:
- `merged[i].get('web_name')` — available on every merged player record
- `bootstrap['teams']` dict keyed by `id` — `teams_by_id.get(team_id, {}).get('short_name')` (see `_attacking_patterns` lines 262, 277)

For player-specific insights (`player_*` category), build `player_names` like:
```python
player_names = [p.get('web_name', '') for p in buy_players[:5]]
player_ids   = [p.get('id', 0) for p in buy_players[:5]]
```

---

### `pipeline/tests/test_insights.py` (test, batch — CREATE NEW)

**Analog:** `pipeline/tests/test_accuracy.py` — closest role-match (same pipeline test structure, same conftest pattern, same helper-function + assertion style).

**Conftest sys.path pattern** (`pipeline/tests/conftest.py` lines 1-15 — already present, no changes needed):
```python
import os
import sys

PIPELINE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PIPELINE_DIR not in sys.path:
    sys.path.insert(0, PIPELINE_DIR)
```
This means `test_insights.py` simply writes `from insights import compute_insights, _signal_label` — the conftest handles the path.

**Import block pattern** (copy from `test_accuracy.py` lines 1-21, adapted):
```python
"""Unit tests for pipeline/insights.py (Phase 79 INS-01/INS-02/INS-06).

Tests assert all new structured fields are present on every insight dict,
and that _signal_label() implements the D-04 rule matrix correctly.
"""

import pytest
from insights import compute_insights, _signal_label
```

**Minimal fixture builder pattern** (copy structure from `test_accuracy.py` lines 26-76):
```python
def _minimal_bootstrap(team_ids=(1, 2)):
    return {
        'teams': [{'id': tid, 'short_name': f'TM{tid}', 'position': i + 1}
                  for i, tid in enumerate(team_ids)],
        'elements': [],
        'events': [{'id': gw, 'finished': True} for gw in range(1, 35)],
    }

def _finished_fixture(h, a, h_score, a_score, gw=1):
    return {'team_h': h, 'team_a': a, 'team_h_score': h_score,
            'team_a_score': a_score, 'event': gw, 'finished': True}
```

**Test assertion pattern** (copy from `test_accuracy.py` lines 81-95 — key-presence checks):
```python
REQUIRED_NEW_FIELDS = {
    'title', 'metric_value', 'metric_label', 'takeaway', 'action_hint',
    'benchmark_value', 'gw_coverage', 'player_ids', 'team_ids',
    'player_names', 'team_names', 'signal_label',
}

def test_each_insight_has_structured_fields():
    """INS-01 / D-01: every insight dict carries all 10 new structured fields."""
    bootstrap = _minimal_bootstrap()
    fixtures = [_finished_fixture(1, 2, 1, 0, gw) for gw in range(1, 35)]
    result = compute_insights(merged=[], bootstrap=bootstrap,
                              fixtures=fixtures, summaries={}, finished_gws=34)
    for ins in result:
        missing = REQUIRED_NEW_FIELDS - ins.keys()
        assert not missing, f"{ins['id']} missing fields: {missing}"
```

**Signal label rule matrix test pattern** (6 assertions covering D-04):
```python
def test_signal_label_rules():
    """INS-02 / D-04: _signal_label() rule matrix (category-specific overrides first)."""
    assert _signal_label('player', 65, 'x') == 'Hidden gem'
    assert _signal_label('attacking', 44, 'x') == 'Trap risk'
    assert _signal_label('player', 44, 'x') == 'Trap risk'
    assert _signal_label('defensive', 44, 'x') == 'Regression risk'
    assert _signal_label('defensive', 70, 'x') == 'Strong signal'
    assert _signal_label('attacking', 57, 'x') == 'Watchlist'
    assert _signal_label('defensive', 30, 'x') == 'Regression risk'  # < 45 override
    assert _signal_label('captaincy', 30, 'x') == 'Weak signal'      # no category override
```

---

### `src/lib/types.ts` (model, request-response — MODIFY)

**Analog:** self — extend existing `Insight` interface at lines 594-601.

**Current interface** (`src/lib/types.ts` lines 594-601):
```typescript
export interface Insight {
  id: string
  category: 'defensive' | 'attacking' | 'player' | 'captaincy'
  statement: string
  confidence_pct: number
  sample_n: number
  sample_total: number
}
```

**Target interface (replace lines 591-601 with this block — per D-02/D-05):**
```typescript
export type SignalLabel =
  | 'Strong signal'
  | 'Watchlist'
  | 'Weak signal'
  | 'Trap risk'
  | 'Regression risk'
  | 'Hidden gem'

// Insights data (Phase 33 INS-01..INS-06 — pipeline writes pipeline/cache/insights.json)
// Extended in Phase 79: 10 new structured fields + signal_label emitted by pipeline.
export interface Insight {
  // Existing 6 fields (kept for backwards compat — D-03)
  id: string
  category: 'defensive' | 'attacking' | 'player' | 'captaincy'
  statement: string
  confidence_pct: number
  sample_n: number
  sample_total: number
  // New structured fields (D-01)
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
  // Signal label (D-04/D-05) — emitted by pipeline, not derived client-side
  signal_label: SignalLabel
}
```

**`SIGNAL_CLASSES` must be typed as `Record<SignalLabel, string>`** to enforce all 6 keys at compile time (Pitfall 5 from RESEARCH.md):
```typescript
const SIGNAL_CLASSES: Record<SignalLabel, string> = {
  'Strong signal':     'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'Hidden gem':        'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  'Watchlist':         'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  'Weak signal':       'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  'Trap risk':         'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  'Regression risk':   'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
}
```

---

### `src/components/insights/InsightsTab.tsx` (component, request-response — REWRITE)

**Primary analog:** self (existing `InsightsTab.tsx` lines 1-110) — structure/hook/loading states kept; card and section logic replaced.
**Secondary analogs:**
- `src/components/price-changes/PriceChangePanel.tsx` lines 127-132 — progress bar primitive
- `src/components/planner/PlannerTab.tsx` lines 350-354 — `<details>/<summary>` pattern
- `src/components/LastUpdated.tsx` lines 12, 19 — pill badge with icon prefix
- `src/app/page.tsx` line 177 — sticky backdrop panel

**Imports block to keep** (lines 1-4, adapt):
```typescript
'use client'

import { useState } from 'react'
import { useInsights } from '@/lib/hooks/useInsights'
import type { Insight, SignalLabel } from '@/lib/types'
```

**Constants to replace** — remove `TIER_CLASSES`, `getTier()`. Add:
```typescript
const SIGNAL_ICONS: Record<SignalLabel, string> = {
  'Strong signal':   '▲',
  'Hidden gem':      '★',
  'Watchlist':       '●',
  'Weak signal':     '●',
  'Trap risk':       '⚠',
  'Regression risk': '⚠',
}

// SIGNAL_CLASSES typed as Record<SignalLabel, string> — see types.ts pattern above
```

**`CATEGORY_ORDER` / `CATEGORY_LABELS` to extend** (existing lines 22-28):
```typescript
// Existing 4 categories kept; planner to decide captaincy placement (Open Question 5)
const CATEGORY_ORDER = ['defensive', 'attacking', 'player', 'captaincy'] as const
```

**Progress bar pattern** — copy from `PriceChangePanel.tsx` lines 127-132, extend with benchmark line:
```tsx
// PriceChangePanel.tsx:127-132 (existing — no benchmark line):
<div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
  <div
    className={`h-full rounded-full transition-all ${barColor}`}
    style={{ width: `${prediction.confidence_pct}%` }}
  />
</div>

// InsightCard version (Phase 79 extension — adds relative wrapper + benchmark span):
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
Note: the existing panel uses `overflow-hidden` which will clip the benchmark span. The benchmark line must sit on a non-clipped container — use `relative` wrapper without `overflow-hidden` and nest the fill `div` and benchmark `span` inside.

**`<details>/<summary>` pattern** — copy directly from `PlannerTab.tsx` lines 350-354:
```tsx
// PlannerTab.tsx:350-354 (existing precedent):
<details className="text-sm text-zinc-500 dark:text-zinc-400">
  <summary className="cursor-pointer select-none hover:text-zinc-700 dark:hover:text-zinc-300">
    How do chips work in the planner?
  </summary>
  ...
</details>

// InsightCard version (Phase 79 — same structure, updated classes to tokens):
<details className="text-xs text-muted">
  <summary className="cursor-pointer select-none">Methodology</summary>
  <p className="mt-1">
    Sample: {insight.sample_n}/{insight.sample_total} · {insight.gw_coverage} · Confidence: {insight.confidence_pct.toFixed(1)}%
  </p>
</details>
```

**Pill badge pattern** — copy from `LastUpdated.tsx` lines 12, 19:
```tsx
// LastUpdated.tsx:12 (existing — Phase 78 VIS-04 pill):
<span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs bg-surface-elevated text-muted">
  <span aria-hidden="true">●</span>
  Updated {relativeTime}
</span>

// Signal badge in InsightCard (Phase 79 — same shape, signal-specific classes):
<span className={`rounded-full px-2 py-0.5 text-xs ${SIGNAL_CLASSES[insight.signal_label]}`}>
  <span aria-hidden="true">{SIGNAL_ICONS[insight.signal_label]}</span>{' '}
  {insight.signal_label}
</span>

// Player/team chip (Decision Summary — same pill, neutral surface-elevated):
<span className="rounded-full px-2 py-0.5 text-xs bg-surface-elevated text-foreground">
  {name}
</span>
```

**Sticky backdrop pattern** — copy from `page.tsx` line 177:
```tsx
// page.tsx:177 (existing sticky nav — z-40):
<div className="sticky top-0 z-40 bg-surface/95 backdrop-blur-sm border-b border-border -mx-4 px-4">

// DecisionSummary panel (Phase 79 — z-30, sits below nav):
<div className="sticky top-[var(--nav-height,96px)] z-30 bg-surface/95 backdrop-blur-sm border-b border-border -mx-4 px-4 py-3">
```

**CollapsibleSection `useState` pattern** — derived from existing `InsightsTab` grouping logic (lines 77-87) and D-11:
```tsx
// No external analog — use React useState directly.
// Section starts expanded (open = true initial state per D-11).
function CollapsibleSection({ label, count, children }: {
  label: string; count: number; children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
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

**Loading / error / empty states to keep** (existing `InsightsTab.tsx` lines 49-74) — copy verbatim, updating hardcoded `text-zinc-500 dark:text-zinc-400` → `text-muted` for token consistency:
```tsx
if (isLoading) return (
  <p className="text-sm text-muted text-center py-8">Loading insights…</p>
)
if (error) return (
  <p className="text-sm text-red-600 dark:text-red-400 py-4">
    Failed to load insights. Check the pipeline output and refresh.
  </p>
)
if (!data || data.length === 0) return (
  <section className="mt-6 space-y-2" aria-label="Insights not available">
    <h2 className="text-lg font-semibold">No insights available yet</h2>
    <p className="text-sm text-muted">Run the pipeline to generate pattern data for this season.</p>
  </section>
)
```

**Card shell token classes** — replace `border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900` (existing line 34) with Phase 78 tokens (D-16):
```tsx
// Old (line 34):
<div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 space-y-2">
// New:
<div className="rounded border border-border bg-surface p-4 space-y-2">
```

---

### `src/components/insights/InsightsTab.test.tsx` (test, request-response — REWRITE)

**Analog:** self — existing file structure (lines 1-208) is the template. Keep: test file header, `vi.mock` pattern, `mockedUseInsights`, `beforeEach` reset. Replace: fixture data + all test assertions.

**`vi.mock` + hook mock pattern to keep** (lines 8-16):
```typescript
vi.mock('@/lib/hooks/useInsights', () => ({
  useInsights: vi.fn(),
}))

import { InsightsTab } from '@/components/insights/InsightsTab'
import { useInsights } from '@/lib/hooks/useInsights'
import type { Insight } from '@/lib/types'

const mockedUseInsights = vi.mocked(useInsights)
```

**Fixture data to replace** — current fixture (lines 23-56) has 4 insights with 6 fields. New fixture needs ≥6 insights covering all 6 signal labels with all 16 fields. Minimum shape for each fixture entry:
```typescript
const baseInsight: Insight = {
  id: 'def_cs_home_vs_away',
  category: 'defensive',
  statement: 'Home teams keep clean sheets in 32.5% of finished fixtures.',
  confidence_pct: 75.0,
  sample_n: 100,
  sample_total: 308,
  title: 'Home Clean Sheet Advantage',
  metric_value: 32.5,
  metric_label: 'CS rate at home',
  takeaway: 'Home defenders keep clean sheets 32.5% of the time.',
  action_hint: 'Target home defenders in good runs',
  benchmark_value: 25.0,
  gw_coverage: 'GW1–34',
  player_ids: [],
  team_ids: [],
  player_names: [],
  team_names: [],
  signal_label: 'Strong signal',
}
```

**Assertions that must change** (tests in lines 84-127 assert `bg-green-100`, `HIGH`, `MEDIUM`, `LOW`, `span[title]`):
- Replace `bg-green-100` assertions → assert signal badge contains `insight.signal_label` text
- Replace `span[title]` selector → no more `title` attribute on badge; methodology is in `<details>`
- Replace `badge.textContent === 'HIGH'` → assert `badge.textContent` contains `'Strong signal'` (or the label from fixture)
- Replace tooltip assertion → assert `<details>` contains "Sample: 100/308"

**Pattern for testing `<details>` expand** (no existing analog — use RTL `userEvent`):
```typescript
import userEvent from '@testing-library/user-event'

it('methodology details shows sample/gw/confidence on expand (INS-06)', async () => {
  const user = userEvent.setup()
  mockedUseInsights.mockReturnValue({ data: [baseInsight], isLoading: false, error: null } as ...)
  const { getByText } = render(<InsightsTab />)
  await user.click(getByText('Methodology'))
  expect(document.body.textContent).toContain('Sample: 100/308')
  expect(document.body.textContent).toContain('GW1–34')
})
```

**Loading/error/empty tests to keep** (lines 165-201) — these pass through unchanged since loading states are kept verbatim.

---

## Shared Patterns

### Phase 78 Token Classes
**Source:** `src/app/globals.css` (CSS custom properties — `--surface`, `--border`, `--muted`, `--surface-elevated`)
**Apply to:** `InsightsTab.tsx` card shell, badge, section header count badge, loading/empty states
```
bg-surface        → replaces bg-white dark:bg-zinc-900
border-border     → replaces border-zinc-200 dark:border-zinc-700
text-muted        → replaces text-zinc-500 dark:text-zinc-400
bg-surface-elevated → replaces bg-zinc-100 dark:bg-zinc-800
```

### Pill Badge Shape
**Source:** `src/components/LastUpdated.tsx` lines 12, 19
**Apply to:** signal badges (InsightCard zone 1), section count badges (CollapsibleSection), player/team chips (DecisionSummary)
```
rounded-full px-2 py-0.5 text-xs
```

### Tabular Numeric Class
**Source:** Phase 78 VIS-02 — `src/app/globals.css` lines 59-61
**Apply to:** InsightCard zone 3 headline metric element only (D-17)
```
tabular-nums
```

### Sticky Backdrop
**Source:** `src/app/page.tsx` line 177
**Apply to:** DecisionSummary panel (z-30, below nav's z-40)
```
sticky top-[var(--nav-height,96px)] z-30 bg-surface/95 backdrop-blur-sm border-b border-border -mx-4 px-4
```

### Pipeline Test Structure
**Source:** `pipeline/tests/test_accuracy.py` + `pipeline/tests/conftest.py`
**Apply to:** `pipeline/tests/test_insights.py`
- No explicit conftest import needed — conftest.py auto-loaded by pytest
- Pattern: minimal data builder helper → `test_*` functions using direct `compute_*` calls → key-presence assertions

---

## No Analog Found

All files have analogs or are self-extensions. No "no analog" entries.

---

## Metadata

**Analog search scope:** `pipeline/`, `pipeline/tests/`, `src/components/insights/`, `src/components/price-changes/`, `src/components/planner/`, `src/components/`, `src/lib/`, `src/app/`
**Files scanned:** 13 source files read in full or in targeted ranges
**Pattern extraction date:** 2026-05-08
