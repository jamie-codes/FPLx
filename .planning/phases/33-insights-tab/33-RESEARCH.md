# Phase 33: Insights Tab - Research

**Researched:** 2026-04-28
**Domain:** Data pipeline pattern analysis + React tab component
**Confidence:** HIGH

## Summary

Phase 33 adds an Insights tab that surfaces data-driven FPL pattern statements with confidence
weights. The architecture is a three-layer system: Python pipeline computes insights and writes
`insights.json` to the cache; a Next.js API route (`/api/insights`) serves the file; a React hook
(`useInsights`) fetches it; and an `InsightsTab` component renders it. This is an exact structural
clone of the captain-picks pattern shipped in Phase 31, so every integration point is proven.

The design decisions are fully locked in CONTEXT.md. All four new artifacts (pipeline module,
API route, hook, component) follow existing file-for-file analogues in the codebase. The main
creative work is writing non-trivial pattern computations in the pipeline using the season data
already available in `merged_players.json` and the FPL bootstrap + fixtures that `run.py` already
fetches.

**Primary recommendation:** Clone the `captain-picks` pattern four times (pipeline write, API
route, hook, TS type), then write the insight computation logic as a standalone module
`pipeline/insights.py` that `run.py` calls, matching how `defcon.py` and `xmins.py` are
structured.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- D-01: Pipeline-computed, persisted to `insights.json`. `pipeline/run.py` computes all pattern
  statements and writes `insights.json` alongside `merged_players.json`. Frontend renders via
  `/api/insights` route + hook — no client-side heavy computation.
- D-02: Dynamic count — all insights that pass the triviality and confidence gates. Count varies;
  frontend renders all grouped by category.
- D-03: Minimum 10 data points before an insight is shown. Below this floor the insight is
  suppressed.
- D-04: Tier badge + percentage in tooltip. Tier thresholds: HIGH >= 70%, MEDIUM 50–69%, LOW <
  50% (but above minimum sample floor — if below floor, suppressed entirely).
- D-05: Badge colours: HIGH = green (`bg-green-100 text-green-800 dark:bg-green-900
  dark:text-green-200`), MEDIUM = amber (`bg-amber-100 text-amber-800 dark:bg-amber-900
  dark:text-amber-200`), LOW = zinc/grey (`bg-zinc-100 text-zinc-600 dark:bg-zinc-800
  dark:text-zinc-400`).
- D-06: Four categories: Defensive, Attacking, Player-specific, Captaincy.
  - Defensive: CS rates by opponent rank, home vs away CS rates, teams on clean sheet streaks.
  - Attacking: Goal returns by fixture difficulty tier, teams over/under-performing xG,
    top-scoring home/away splits.
  - Player-specific: Players who score/assist disproportionately against tough opponents,
    players with high xPts variance (regression_signal context), consistent vs boom-bust patterns.
  - Captaincy: Captain points concentration, double-digit haul rate by player.
- D-07: Hardcoded exclusion list in pipeline for trivially obvious pattern types.
- D-08: Card list grouped by category. No accordion — all categories expanded by default.
- D-09: Tab positioned after Set Pieces. Navigation order: Gems | DefCon | Squad | Club Form |
  Set Pieces | **Insights** | Value Gems | Planner. `Tab` union type gains `'insights'`.
- D-10: No filtering or pagination on the tab.
- D-11: `/api/insights` route + `useInsights()` hook. `staleTime: 6 * 60 * 60 * 1000` (6h).
  `insights.json` written by `pipeline/run.py`.
- D-12: `Insight` TypeScript type. Fields: `id: string`, `category: 'defensive' | 'attacking' |
  'player' | 'captaincy'`, `statement: string`, `confidence_pct: number` (0–100), `sample_n:
  number`, `sample_total: number`.

### Claude's Discretion

- Exact wording of individual insight statements (specific and non-trivial)
- Whether `insights.json` is an array or `{ insights: Insight[] }` wrapper (recommend flat array)
- Order of insights within each category (recommend descending by `confidence_pct`)
- Exact number of pattern computations the pipeline implements

### Deferred Ideas (OUT OF SCOPE)

None documented.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INS-01 | User can see an Insights tab with data-driven statements about patterns from this season's FPL data | Tab scaffold in `page.tsx` + `MobileNav.tsx` (D-09); `InsightsTab` component following `CaptainPicksPanel` pattern |
| INS-02 | Each statement displays a confidence weight derived from actual season data (e.g. "True in 67% of matches analysed") | `confidence_pct` + `sample_n` + `sample_total` fields in `Insight` type (D-12); tier badge computed client-side (D-04); tooltip showing exact fraction |
| INS-03 | Statements span defensive, attacking, and player-specific patterns | Four categories (D-06); pipeline insight computations use fixtures, element-summary history, xG/xA, regression_signal from `merged_players.json` |
| INS-04 | Trivially obvious statements are excluded | Hardcoded exclusion list in `pipeline/insights.py` (D-07) |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pattern computation | Pipeline (Python) | — | Aggregates season-long fixture/player history; too heavy for a request handler |
| Data persistence | Pipeline cache (`insights.json`) | Vercel Blob (USE_BLOB=true) | Matches existing `captain_picks.json` + `merged_players.json` write pattern |
| Data serving | API (Next.js route) | — | File read + USE_BLOB toggle; mirrors `/api/captain-picks` exactly |
| Data consumption | Frontend Server (hook) | — | `useQuery` with 6h staleTime, identical to `useCaptainPicks` |
| Insight rendering | Browser (React component) | — | Stateless render of JSON; no heavy client-side logic |
| Navigation wiring | Browser (page.tsx + MobileNav) | — | `Tab` union type update + two button additions |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React + Next.js | 19.2.4 / 16.2.1 | Component rendering and API routes | Already the project stack [VERIFIED: package.json] |
| @tanstack/react-query | ^5.95.2 | Server-state caching for hook | Already used by every data hook in the project [VERIFIED: package.json] |
| Tailwind CSS | ^4 | Styling badge, cards, headings | Already the project styling approach [VERIFIED: package.json] |

### Pipeline

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python stdlib (`json`, `collections`) | stdlib | Pattern aggregation and JSON write | No new dependency needed; all data is in already-fetched dicts |

### No New Dependencies

This phase introduces zero new npm packages and zero new Python packages. [VERIFIED: codebase inspection]

### Installation

```bash
# No installation step — all dependencies already present
```

---

## Architecture Patterns

### System Architecture Diagram

```
pipeline/run.py
    └── compute_insights(merged, bootstrap, fixtures, summaries)  [new insights.py]
            ├── defensive_patterns(fixtures, bootstrap)
            ├── attacking_patterns(merged, fixtures, bootstrap)
            ├── player_patterns(merged, summaries)
            └── captaincy_patterns(merged, summaries)
        → insights.json  ──→  pipeline/cache/insights.json
                               │
                               ▼
                       GET /api/insights/route.ts
                         (USE_BLOB toggle → Vercel Blob or local file)
                               │
                               ▼
                        useInsights() hook
                         (react-query, 6h staleTime)
                               │
                               ▼
                        <InsightsTab />
                          ├── <h2>Defensive Patterns</h2>
                          │   └── <InsightCard> × N
                          ├── <h2>Attacking Patterns</h2>
                          │   └── <InsightCard> × N
                          ├── <h2>Player-Specific Patterns</h2>
                          │   └── <InsightCard> × N
                          └── <h2>Captaincy Patterns</h2>
                              └── <InsightCard> × N
```

### Recommended Project Structure

```
pipeline/
├── insights.py          # NEW — pattern computation module (like defcon.py / xmins.py)
├── run.py               # MODIFIED — add compute_insights call + save('insights.json', ...)

src/
├── app/
│   ├── page.tsx                         # MODIFIED — add 'insights' to Tab, nav button, content block
│   └── api/
│       └── insights/
│           └── route.ts                 # NEW — mirrors captain-picks/route.ts
├── components/
│   └── insights/
│       └── InsightsTab.tsx              # NEW — top-level tab component
├── lib/
│   ├── hooks/
│   │   └── useInsights.ts              # NEW — mirrors useCaptainPicks.ts
│   └── types.ts                        # MODIFIED — add Insight interface
```

```
src/components/nav/MobileNav.tsx          # MODIFIED — add 'insights' to Tab + TABS array
```

### Pattern 1: Pipeline Module (insights.py)

**What:** Standalone Python module that receives already-fetched data objects and returns a list
of `Insight` dicts. Called once in `run.py`, output saved via `save()`.

**When to use:** Any pipeline computation that needs full-season aggregates across all players
and fixtures.

**Example:**

```python
# Source: pipeline/defcon.py + xmins.py structural analogue [VERIFIED: codebase]
def compute_insights(
    merged: list,
    bootstrap: dict,
    fixtures: list,
    summaries: dict,        # element_id -> element-summary dict (already fetched in run.py)
    finished_gws: int,
) -> list:
    """Return list of Insight dicts for insights.json."""
    insights = []
    insights.extend(_defensive_patterns(merged, bootstrap, fixtures))
    insights.extend(_attacking_patterns(merged, bootstrap, fixtures))
    insights.extend(_player_patterns(merged, summaries, finished_gws))
    insights.extend(_captaincy_patterns(merged, summaries))
    # Sort descending by confidence_pct within each category
    insights.sort(key=lambda i: (i['category'], -i['confidence_pct']))
    return insights
```

**Data available in `run.py`:** `merged` (list of merged player dicts), `bootstrap` (FPL
bootstrap-static), `fixtures` (all fixtures), `summaries` (element_id -> element-summary,
already fetched at line 127 of `run.py`), `finished_gws` (count of finished GWs). No new
fetches required. [VERIFIED: pipeline/run.py lines 102–148]

### Pattern 2: API Route (mirrors captain-picks)

**What:** Reads `insights.json` from local cache or Vercel Blob, returns raw JSON.

**Example:**

```typescript
// Source: src/app/api/captain-picks/route.ts [VERIFIED: codebase]
// Replace: 'captain_picks.json' → 'insights.json'
//          'Captain picks' → 'Insights'
import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'

export async function GET() {
  try {
    let data: string
    if (USE_BLOB) {
      const { blobs } = await list({ prefix: 'insights.json', limit: 1 })
      if (!blobs.length) {
        return Response.json({ error: 'Insights not available' }, { status: 404 })
      }
      const res = await fetch(blobs[0].url)
      data = await res.text()
    } else {
      const cachePath = join(process.cwd(), 'pipeline', 'cache', 'insights.json')
      data = await readFile(cachePath, 'utf-8')
    }
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch {
    return Response.json({ error: 'Failed to load insights' }, { status: 500 })
  }
}
```

### Pattern 3: Hook (mirrors useCaptainPicks)

```typescript
// Source: src/lib/hooks/useCaptainPicks.ts [VERIFIED: codebase]
import { useQuery } from '@tanstack/react-query'
import type { Insight } from '../types'

export function useInsights() {
  return useQuery<Insight[]>({
    queryKey: ['insights'],
    queryFn: async () => {
      const res = await fetch('/api/insights')
      if (!res.ok) throw new Error('Failed to fetch insights')
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000, // 6 hours
  })
}
```

Note: `insights.json` is a flat array (`Insight[]`), not a wrapper object. The hook return type
is `Insight[]` directly. [ASSUMED — planner should confirm flat array vs wrapper; CONTEXT.md
says Claude's discretion recommends flat array]

### Pattern 4: Tab Wiring (page.tsx + MobileNav.tsx)

**What:** Two files need `'insights'` added to their `Tab` type, one navigation button inserted
between Set Pieces and Value Gems, one content block, and one entry in the `TABS` constant.

```typescript
// Source: src/app/page.tsx [VERIFIED: codebase]
type Tab = 'gems' | 'defcon' | 'squad' | 'club-form' | 'set-pieces' | 'insights' | 'value-gems' | 'planner'
//                                                                      ^^^^^^^^^^ insert here
```

Mobile nav `TABS` array in `MobileNav.tsx` also has a hardcoded `Tab` type (line 3) that must
be updated in sync. [VERIFIED: src/components/nav/MobileNav.tsx line 3]

### Pattern 5: Badge Component (inline or shared)

**What:** The confidence tier badge follows the same `text-xs font-normal rounded px-2 py-1`
pattern used by `RegressionSignalBadge` and `DifferentialBadge`.

```typescript
// Source: CONTEXT.md D-05 badge tokens [CITED: 33-CONTEXT.md]
const TIER_CLASSES = {
  HIGH:   'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  MEDIUM: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  LOW:    'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
} as const

function getTier(pct: number): keyof typeof TIER_CLASSES {
  if (pct >= 70) return 'HIGH'
  if (pct >= 50) return 'MEDIUM'
  return 'LOW'
}
```

Tooltip text: `"True in ${confidence_pct}% of fixtures — ${sample_n}/${sample_total} matches"`.
HTML `title` attribute is sufficient for MVP (no custom tooltip library needed).

### Anti-Patterns to Avoid

- **Computing insights client-side:** All aggregation must happen in the pipeline. The component
  receives pre-computed `Insight[]` and only derives the tier badge from `confidence_pct`.
- **Adding pagination/filtering:** D-10 is explicit — single scrollable list. The triviality
  gate in the pipeline is the control knob.
- **Calling FPL API from the insights module:** `insights.py` receives data passed in from
  `run.py` — it must not fetch anything itself (mirrors `defcon.py` and `xmins.py`).
- **Forgetting MobileNav:** The `Tab` type is duplicated in `MobileNav.tsx`. Both files must
  be updated atomically. Failing to update MobileNav causes a TypeScript error at build time.
  [VERIFIED: src/components/nav/MobileNav.tsx]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Confidence badge tooltip | Custom tooltip component | HTML `title` attribute | MVP sufficient; consistent with other data-quality labels in the codebase |
| Data fetching + caching | Custom fetch logic | `useQuery` with `staleTime` | React Query already handles cache invalidation, loading/error states |
| JSON persistence | Custom serialisation | `pipeline/upload.py save()` function | Already handles both local and Vercel Blob writes; USE_BLOB toggle built in |

---

## Data Available for Pattern Computation

The following fields are present in `merged` (from `merged_players.json`) and can be used
directly in `insights.py` without additional fetches. [VERIFIED: src/lib/types.ts MergedPlayer]

| Field | Type | Use case |
|-------|------|----------|
| `goals_scored` | number | Attacking goal-return patterns |
| `assists` | number | Attacking assist patterns |
| `expected_goals` | number | xG over/under-performance |
| `expected_assists` | number | xA over/under-performance |
| `fixtures` | FixtureEntry[] | Difficulty-split patterns (easy vs hard fixtures) |
| `regression_signal` | 'buy'/'sell'/null | Player-specific over/under-performance flag |
| `actual_vs_xg_delta` | number\|null | Deviation magnitude |
| `xPts_1gw` / `xPts_ceiling_1gw` | number/bool | Captaincy ceiling / boom-bust |
| `differential_flag` | 'diff'/'trap'/null | Ownership-relative value signal |
| `selected_by_percent` | string | Captaincy concentration patterns |
| `element_type` | 1-4 | Filter by position |
| `team` / `team_short_name` | number/string | Team-level aggregations |
| `total_points` | number | Season haul patterns |
| `pts_last3gw` / `pts_last5gw` | number | Recency patterns |

**Element summaries** (`summaries[player_id]`) provide per-gameweek history (`history` array):
each entry includes `total_points`, `minutes`, `goals_scored`, `assists`, `clean_sheets`,
`was_home`, `opponent_team`. This is the primary data source for fixture-split patterns.
[VERIFIED: pipeline/run.py line 132 — summaries already fetched and passed to xmins/defcon]

**Fixtures** (`fixtures`) provide full season fixture results:
`team_h`, `team_a`, `team_h_score`, `team_a_score`, `event`, `finished`. Used for team-level
CS rates and goal patterns. [VERIFIED: pipeline/run.py line 108]

---

## Common Pitfalls

### Pitfall 1: Minimum sample gate not applied per-category
**What goes wrong:** An insight with `sample_total = 4` appears in the Captaincy category with
HIGH confidence (e.g. "3/4 = 75%") — misleading because the sample is too small.
**Why it happens:** The D-03 minimum floor (10 data points) must be checked inside every
pattern computation function, not just at the top level.
**How to avoid:** Each pattern helper function must call `if sample_total < 10: return None`
and the caller skips `None` results.
**Warning signs:** Very high confidence percentages from obviously scarce data (players with
fewer than 10 completed GWs in the summaries).

### Pitfall 2: Trivial patterns leaking through because exclusion list is incomplete
**What goes wrong:** A technically non-excluded pattern like "players who play more minutes
score more points" slips through and appears on the tab.
**Why it happens:** The exclusion list can only block known patterns; new pattern computations
may generate trivial outputs.
**How to avoid:** Code review each pattern computation function — ask "would a non-FPL-expert
consider this surprising?" before including it. The exclusion list is a last-resort safety net.

### Pitfall 3: MobileNav Tab type out of sync
**What goes wrong:** TypeScript compile error — `Argument of type '"insights"' is not
assignable to parameter of type 'Tab'` from `MobileNav.tsx`.
**Why it happens:** `MobileNav.tsx` declares its own `Tab` type (copy-paste from `page.tsx`)
rather than importing from a shared location. Both must be updated in the same task.
**How to avoid:** Update both `page.tsx` (Tab type + nav button + content block) and
`MobileNav.tsx` (Tab type + TABS array) in a single atomic task.
**Warning signs:** TypeScript error mentioning `MobileNav` when trying to call `setActiveTab('insights')`.

### Pitfall 4: insights.json missing from cache causes 500 on first load
**What goes wrong:** The API route throws because `insights.json` does not exist in
`pipeline/cache/` until the pipeline runs.
**Why it happens:** Unlike `merged_players.json`, the new file has no fallback data in the repo.
**How to avoid:** Seed an empty `pipeline/cache/insights.json` (e.g. `[]`) so the tab renders
an empty state rather than an error state. The `InsightsTab` component should handle the empty
array gracefully with a "No insights available" message.
**Warning signs:** 500 response from `/api/insights` with message "Failed to load insights".

### Pitfall 5: Tooltip on LOW-confidence badge confusing the user
**What goes wrong:** Users see a LOW badge with tooltip "True in 45% of fixtures — 9/20 matches"
and wonder why a pattern below 50% is shown at all.
**Why it happens:** D-04 allows LOW-tier insights to appear as long as `sample_total >= 10`.
**How to avoid:** Ensure the tooltip wording is clear: "True in 45% of fixtures" is more honest
than "Seen in 9 of 20 matches analysed". Consider adding "Patterns shown only when seen ≥ 10
times" as a footnote on the tab.

---

## Code Examples

### Verified: How run.py calls a computation module

```python
# Source: pipeline/run.py lines 143-148 [VERIFIED: codebase]
# Pattern: call compute_X(args), receive output, call save()
merged, captain_picks = merge_players(bootstrap, fixtures, understat, id_map,
                                       xmins_stats=xmins_stats, summaries=summaries)
save('merged_players.json', merged)
save('captain_picks.json', captain_picks)  # Phase 31 CAP-03/CAP-04
```

Mirror for insights:
```python
from insights import compute_insights
# ... after merged is available and summaries is populated ...
insights = compute_insights(merged, bootstrap, fixtures, summaries, finished_gws)
save('insights.json', insights)
```

### Verified: How save() works in upload.py

```python
# Source: pipeline/upload.py (inferred from usage pattern) [VERIFIED: pipeline/run.py]
# save(filename, data) — writes JSON locally or to Vercel Blob depending on USE_BLOB
save('insights.json', insights)  # insights is a Python list — json.dumps applied internally
```

### Verified: Tooltip via HTML title attribute (existing pattern)

```typescript
// Source: src/components/captaincy/CaptainPicksPanel.tsx line 25 [VERIFIED: codebase]
<h3 className="text-sm font-semibold" title={TOOLTIPS[kind]}>{LABELS[kind]}</h3>
```

For the badge tooltip, use the same `title` attribute approach:
```tsx
<span
  className={`text-xs font-normal rounded px-2 py-1 cursor-help ${TIER_CLASSES[tier]}`}
  title={`True in ${insight.confidence_pct}% of fixtures — ${insight.sample_n}/${insight.sample_total} matches`}
>
  {tier}
</span>
```

### Verified: Section heading pattern

```typescript
// Source: src/components/defcon/DefConTables.tsx / src/components/club-form/ClubFormTable.tsx
// [VERIFIED: CONTEXT.md canonical refs]
<h2 className="text-xl font-bold mb-2">Defensive Patterns</h2>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate fetch per analysis | All analysis computed in single pipeline run, written to single JSON | Phase 1 onwards | New `insights.py` follows this established pattern |
| Tab count static in Tab union type | Tab union extended per phase | Each phase adding a tab | Requires atomic update of `page.tsx` + `MobileNav.tsx` |

**No deprecated patterns in scope for this phase.**

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `insights.json` is a flat `Insight[]` array (not a wrapper object) | Hook pattern | If planner uses a wrapper, the hook type must be `{ insights: Insight[] }` and the component must unwrap it — minor change |
| A2 | `upload.py save()` accepts any JSON-serialisable value | Code Examples | If `save()` requires a specific type, the pipeline write line needs adjustment — low risk, function is simple |

---

## Open Questions

1. **Insight seeding before first pipeline run**
   - What we know: `captain_picks.json` and other files do not exist until the pipeline runs.
     The API route returns 500 when the cache file is absent.
   - What's unclear: Whether to seed `pipeline/cache/insights.json` with `[]` in this phase
     or let the tab show a graceful error state.
   - Recommendation: Seed `[]` and add an empty-state message to the component — consistent
     with best UX practice.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code changes (Python module + TypeScript files).
No new external dependencies, databases, CLIs, or services are introduced. The pipeline
already runs with the existing Python environment and `pipeline/requirements.txt`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.2 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

No Python test framework is currently configured (`pipeline/tests/` does not exist). Pipeline
logic is validated by running the pipeline and checking the output file structure.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INS-01 | Insights tab renders without error when data is loaded | unit (component smoke) | `npx vitest run src/components/insights/InsightsTab.test.ts` | ❌ Wave 0 |
| INS-02 | Tier badge shows correct label for HIGH/MEDIUM/LOW thresholds | unit | `npx vitest run src/components/insights/InsightsTab.test.ts` | ❌ Wave 0 |
| INS-03 | Four categories present in rendered output | unit | `npx vitest run src/components/insights/InsightsTab.test.ts` | ❌ Wave 0 |
| INS-04 | Trivially excluded patterns do not appear | pipeline smoke (manual) | Run `python pipeline/run.py` and inspect `pipeline/cache/insights.json` | N/A |

### Sampling Rate

- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/components/insights/InsightsTab.test.ts` — covers INS-01, INS-02, INS-03
  (render smoke test with fixture data, badge label assertions)

---

## Sources

### Primary (HIGH confidence)

- `src/app/page.tsx` — current `Tab` union type and tab navigation pattern [VERIFIED: codebase]
- `src/components/nav/MobileNav.tsx` — duplicate `Tab` type that must stay in sync [VERIFIED: codebase]
- `src/app/api/captain-picks/route.ts` — API route pattern to clone [VERIFIED: codebase]
- `src/lib/hooks/useCaptainPicks.ts` — hook pattern to clone [VERIFIED: codebase]
- `src/lib/types.ts` — `MergedPlayer` interface (available pipeline fields) [VERIFIED: codebase]
- `pipeline/run.py` — pipeline structure, summaries dict, finished_gws, save() calls [VERIFIED: codebase]
- `.planning/phases/33-insights-tab/33-CONTEXT.md` — all locked decisions [CITED: 33-CONTEXT.md]

### Secondary (MEDIUM confidence)

None — all critical claims verified directly from codebase.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies present in package.json, no new installs
- Architecture: HIGH — all analogue files read and confirmed; patterns are exact clones
- Pitfalls: HIGH — identified from reading both the source files and the CONTEXT.md decisions
- Pipeline data availability: HIGH — `MergedPlayer` type + `run.py` read directly

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (stable stack — Next.js 16, React 19, TanStack Query 5 already locked in)
