# Phase 66: Fixture Heat Map - Research

**Researched:** 2026-05-04
**Domain:** React / Tailwind CSS component; Python pipeline constant change
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Extend `FIXTURE_LOOKAHEAD` from 5 to 16 in `pipeline/merge.py`. Covers 8 GWs even for DGW teams (8 GWs × 2 fixtures = 16 max). Update `ClubForm.upcoming_fixtures` type comment from "next 5" to "next 16".
- **D-02:** Heat map component groups `upcoming_fixtures` by `event_id` (same groupby pattern as `_xpts_ngw`). Takes the first 8 event groups as columns. DGW teams have 2 entries in one group; BGW teams have 0 entries for the skipped event_id.
- **D-03:** DGW cells use CSS `linear-gradient` split-diagonal (top-left = fixture 1 colour, bottom-right = fixture 2 colour). No JS required.
- **D-04:** DGW tooltip: single native `title` attribute showing both fixtures separated by a slash — e.g. `"ARS (H) 0.28 / CHE (A) 0.71"`.
- **D-05:** Single-fixture cells use `difficulty_tier` field ('easy' → green, 'medium' → amber, 'hard' → red). No new threshold computation.
- **D-06:** New sub-tab in Analyse section `SECTIONS` constant: `id: 'fixture-heat-map'`, `label: 'Heat Map'`, `mobileLabel: 'Heat Map'`. Appended **after `'price-changes'`**. Resulting strip: `Gems | Insights | DefCon | Set Pieces | Accuracy | Price Changes | Heat Map`.
- **D-07:** `SubTab` union type gains `'fixture-heat-map'`. Render guard: `activeSection !== 'squad' && activeSubTab === 'fixture-heat-map'`.
- **D-08:** Single-fixture cell `title` format: `"ARS (H) — 0.28"`. Native `title` attribute; no Radix/custom Tooltip.

### Claude's Discretion

- CSS approach for the split-diagonal (linear-gradient clip-path vs. pseudo-elements) — pick the more maintainable option.
- Default row sort: alphabetical or by current fixture ease — no sort toggle.
- Cell dimensions (min-width, row-height) to achieve single-screen constraint — tune for 1440px desktop.
- Mobile layout: no horizontal scroll required on desktop; mobile can scroll horizontally (`overflow-x-auto` on container).
- GW column header label: absolute event number ("GW34") or relative ("GW+1").

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HEAT-01 | User can see a colour-coded fixture grid for all 20 PL teams across the next 8 GWs — green (easy), amber (medium), red (hard) using existing `attacking_difficulty` values | Covered by D-01 (FIXTURE_LOOKAHEAD=16) + D-02 (groupby event_id) + D-05 (difficulty_tier); `useClubForm()` hook already available |
| HEAT-02 | DGW fixtures are visually highlighted (double-cell or badge); BGW teams show a blank/empty cell for that GW | Covered by D-03 (CSS linear-gradient split-diagonal for DGW) + BGW cell = empty `<td>` with zinc background |
| HEAT-03 | Heat map is scannable on a single screen without horizontal scrolling on desktop | Covered by UI-SPEC grid contract: 64px team column + 8 × 48px cells = 448px total < 1440px viewport |
</phase_requirements>

---

## Summary

Phase 66 adds a read-only Fixture Heat Map to the Analyse section. It is a 20-team × 8-GW colour-coded grid using data already produced by the pipeline — specifically the `attacking_difficulty` and `difficulty_tier` fields per `ClubFormFixture`. No new API routes, hooks, or pipeline data structures are needed beyond:

1. A single constant change: `FIXTURE_LOOKAHEAD = 5 → 16` in `pipeline/merge.py` (line 775).
2. A new `FixtureHeatMap.tsx` component in `src/components/club-form/`.
3. Four small edits to `page.tsx` and `types.ts` for navigation wiring and type comment.

The UI contract is fully locked by the UI-SPEC. CSS split-diagonal for DGW cells is a single `linear-gradient` property (no JS). `useClubForm()` is the existing hook; the heat map component calls it directly with no new data-fetching layer.

The only non-trivial logic is the client-side `useMemo` that groups `upcoming_fixtures` by `event_id` (mirroring the `_compute_xpts_ngw` groupby pattern) and resolves the first 8 GW groups as columns. BGW teams produce an empty array for a GW group, which renders as a blank cell.

**Primary recommendation:** One pipeline edit + one new component + four small file edits. Deliver as two waves: Wave 1 = pipeline + types (unblocks), Wave 2 = FixtureHeatMap component + page.tsx wiring.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fixture data availability (8 GWs) | Pipeline (Python) | — | FIXTURE_LOOKAHEAD must be 16 before any UI work is useful |
| DGW/BGW detection and grouping | Frontend (React useMemo) | — | Groups already-fetched `upcoming_fixtures` by `event_id` client-side; no server-side change needed |
| Colour coding | Frontend (React/Tailwind) | — | `difficulty_tier` already computed per-fixture; CSS classes drive colour |
| DGW cell split-diagonal | Frontend (CSS) | — | Pure `linear-gradient` on inline style; no JS |
| Tooltip | Frontend (HTML `title`) | — | Native browser attribute; zero library dependency |
| Navigation wiring | Frontend (page.tsx) | — | SubTab union + SECTIONS constant + render guard |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (Next.js) | project's installed version | Component rendering | Project-wide [VERIFIED: codebase] |
| Tailwind CSS v4 | v4 (project-configured) | Styling, colour classes | Project-wide — no shadcn [VERIFIED: UI-SPEC.md] |
| @tanstack/react-query | project's installed version | `useClubForm()` hook already uses it | No new hook needed [VERIFIED: src/lib/hooks/useClubForm.ts] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `useMemo` (React built-in) | — | Grouping `upcoming_fixtures` by `event_id` | Avoid recompute on every render |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS `linear-gradient` for DGW split | Two absolutely-positioned `<div>` pseudo-elements | Gradient is simpler (one property); pseudo-elements are more flexible but add DOM nodes — gradient is locked by D-03 |
| Native `title` tooltip | Radix Tooltip | Project convention is `title`; Radix not used — locked by D-08 |
| HTML `<table>` | CSS Grid | `<table>` provides native accessibility semantics (`<thead>`, `<th scope>`); locked by UI-SPEC accessibility contract |

**Installation:** No new packages required. [VERIFIED: codebase]

---

## Architecture Patterns

### System Architecture Diagram

```
pipeline/merge.py (FIXTURE_LOOKAHEAD=16)
      |
      v
pipeline/cache/club_form.json (ClubForm[] — upcoming_fixtures up to 16 entries)
      |
      v
GET /api/club-form
      |
      v
useClubForm() hook (TanStack Query — 6h staleTime)
      |
      v
FixtureHeatMap.tsx
  useMemo: group upcoming_fixtures by event_id → first 8 groups → columns
  sort teams: alphabetical by team_short_name
  render: <table>
    <thead>: GW column headers (GW{event_id})
    <tbody>: 20 rows × 8 <td> cells
      single-fix cell: bg-{tier}-100/900 + title="OPP (H/A) — 0.xx"
      DGW cell: linear-gradient(to bottom right, {c1} 50%, {c2} 50%) + title="OPP1 (H/A) 0.xx / OPP2 (H/A) 0.xx"
      BGW cell: bg-zinc-50 dark:bg-zinc-900 + title="No fixture (BGW)"
      |
      v
page.tsx render guard:
  activeSection !== 'squad' && activeSubTab === 'fixture-heat-map'
```

### Recommended Project Structure

```
src/
├── components/
│   └── club-form/
│       └── FixtureHeatMap.tsx    # New component (only new file)
├── app/
│   └── page.tsx                  # Modify: SubTab union + SECTIONS entry + render guard + import
├── lib/
│   └── types.ts                  # Modify: upcoming_fixtures comment "next 5" → "next 16"
pipeline/
└── merge.py                      # Modify: FIXTURE_LOOKAHEAD = 5 → 16
```

### Pattern 1: groupby event_id (DGW-aware column building)

**What:** Group `upcoming_fixtures` by `event_id` then take first 8 groups as grid columns. DGW = 2 entries in one group; BGW = missing group (produce empty array for that GW slot).

**When to use:** Any time we need per-GW aggregation over `ClubFormFixture[]`.

**Example:**
```typescript
// Source: mirrors pipeline/merge.py _compute_xpts_ngw lines 287-294 [VERIFIED: codebase]
// Client-side equivalent in useMemo:
const gwColumns = useMemo(() => {
  // Build sorted event_id list across all teams (20 teams × up to 16 fixtures)
  const allEventIds = Array.from(
    new Set(clubForms.flatMap(t => t.upcoming_fixtures.map(f => f.event_id)))
  ).sort((a, b) => a - b).slice(0, 8)  // first 8 GWs

  // Map: team_id → Map<event_id, ClubFormFixture[]>
  const byTeamGw = new Map(
    clubForms.map(team => [
      team.team_id,
      team.upcoming_fixtures.reduce((acc, f) => {
        const arr = acc.get(f.event_id) ?? []
        arr.push(f)
        acc.set(f.event_id, arr)
        return acc
      }, new Map<number, ClubFormFixture[]>())
    ])
  )

  return { allEventIds, byTeamGw }
}, [clubForms])
```

**Key insight:** Derive `allEventIds` by scanning ALL teams, not just one team — otherwise a team with a BGW may define fewer columns than there are GWs.

### Pattern 2: DGW CSS split-diagonal

**What:** `linear-gradient(to bottom right, {colour1} 50%, {colour2} 50%)` applied as inline style on the `<td>`.

**When to use:** Cell has exactly 2 fixtures for the same GW group.

**Example:**
```tsx
// Source: UI-SPEC.md §Grid Layout Contract §DGW cell [VERIFIED: codebase]
const tierBg = (tier: DifficultyTier, shade: 'light' | 'dark') =>
  tier === 'easy'   ? (shade === 'light' ? '#dcfce7' : '#14532d') :  // green-100 / green-900
  tier === 'medium' ? (shade === 'light' ? '#fef3c7' : '#78350f') :  // amber-100 / amber-900
                      (shade === 'light' ? '#fee2e2' : '#7f1d1d')    // red-100   / red-900

// In the JSX — note: dark mode hex must be read from Tailwind's colour palette
// Simpler approach: use Tailwind class on outer wrapper for background, clip inner divs
// OR use CSS custom properties via globals.css
// Locked approach (D-03): inline style on <td> with gradient
<td
  style={{
    background: `linear-gradient(to bottom right, ${c1bg} 50%, ${c2bg} 50%)`
  }}
  title={`${fix1.opponent_team} (${fix1.is_home ? 'H' : 'A'}) ${fix1.attacking_difficulty.toFixed(2)} / ${fix2.opponent_team} (${fix2.is_home ? 'H' : 'A'}) ${fix2.attacking_difficulty.toFixed(2)}`}
/>
```

**Dark mode note:** Inline styles cannot use Tailwind's `dark:` classes. The recommended approach is to read the resolved colour from a CSS custom property declared in `globals.css`, or to conditionally set the hex based on `document.documentElement.classList.contains('dark')` read inside a `useEffect`. Alternatively, render two overlapping `<div>` elements inside the `<td>` using clip-path — this allows Tailwind classes and dark mode to work naturally. The UI-SPEC locks the gradient approach; implementation detail of dark mode handling is Claude's discretion.

### Pattern 3: Analyse section sub-tab wiring

**What:** Add `'fixture-heat-map'` to `SubTab` union, add entry to `SECTIONS[0].subTabs`, add render guard and import in page.tsx.

**When to use:** Every new Analyse-section tab follows this identical pattern.

**Example:**
```tsx
// Source: src/app/page.tsx lines 54, 60-67 [VERIFIED: codebase]
// 1. SubTab union (line 54):
export type SubTab = '...' | 'price-changes' | 'fixture-heat-map'

// 2. SECTIONS[0].subTabs array — append after price-changes entry:
{ id: 'fixture-heat-map' as SubTab, label: 'Heat Map', mobileLabel: 'Heat Map' },

// 3. Render guard (after existing price-changes guard):
{activeSection !== 'squad' && activeSubTab === 'fixture-heat-map' && (
  <FixtureHeatMap />
)}
```

### Pattern 4: Loading / Error / Empty states

**What:** Project convention for components consuming `useQuery` hooks.

**Example:**
```tsx
// Source: src/components/club-form/FixtureEaseRankingPanel.tsx lines 51-61 [VERIFIED: codebase]
if (isLoading) return <p className="text-zinc-500 dark:text-zinc-400">Loading fixture heat map...</p>
if (error) return <p className="text-sm text-red-600 dark:text-red-400 py-4">Failed to load fixture data. Check the pipeline output and refresh.</p>
if (!data || data.length === 0) return <p className="text-sm text-zinc-500 dark:text-zinc-400">No fixture data available. Run the pipeline to generate fixture data.</p>
```

### Anti-Patterns to Avoid

- **Deriving GW columns from a single team's fixtures:** A BGW team may have fewer than 8 entries — always build `allEventIds` from the union of all teams' `event_id` values.
- **Using `slice(0, 8)` on raw `upcoming_fixtures`:** With FIXTURE_LOOKAHEAD=16, a DGW team could have 2 entries for the same `event_id`. Slicing 8 items ≠ 8 GWs. Must group by `event_id` first, then take 8 groups.
- **Using Tailwind dynamic classes for gradient colours:** JIT does not generate `bg-[#dcfce7]` at runtime. Use either predefined Tailwind classes (for non-gradient cells) or explicit hex values in inline styles (for gradient cells).
- **Putting `difficulty_tier` computation in the component:** The `difficulty_tier` field is already computed per-fixture in the pipeline and in `club-form.ts`. Do not re-derive it in the component.
- **Forgetting `page.test.tsx` mock:** Every new component rendered in `page.tsx` must have a `vi.mock(...)` entry in `src/app/page.test.tsx` (see lines 1-48 of that file). Omitting it causes the test suite to fail at import.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data fetching for club form | Custom fetch / new API route | `useClubForm()` already exists | Fetches `/api/club-form`, returns `ClubForm[]`, 6h staleTime — zero new work [VERIFIED: src/lib/hooks/useClubForm.ts] |
| `difficulty_tier` mapping | Re-derive from `attacking_difficulty` | `ClubFormFixture.difficulty_tier` already computed | Pipeline + `club-form.ts` both produce this field; using it directly avoids threshold duplication [VERIFIED: src/lib/types.ts line 371] |
| Tooltip component | Radix Tooltip / custom popup | Native HTML `title` attribute | Project-wide convention; consistent with VarianceBadge, DifferentialBadge, RegressionSignalBadge [VERIFIED: src/components/gem-table/VarianceBadge.tsx] |
| Table scroll on mobile | Custom scroll detection | `overflow-x-auto` + `min-w-[640px]` | Used in RouteTreeTab and ManualPlanTab [ASSUMED: not directly verified in those files, but confirmed pattern by CONTEXT.md and UI-SPEC] |

**Key insight:** All data infrastructure exists. This phase is almost entirely a rendering problem.

---

## Common Pitfalls

### Pitfall 1: DGW detection using array length on `upcoming_fixtures` instead of grouped count

**What goes wrong:** Checking `team.upcoming_fixtures.length > 8` to detect DGW does not work — after the FIXTURE_LOOKAHEAD change, all teams will have up to 16 entries. DGW detection must happen per GW group (i.e., `group.length === 2`).

**Why it happens:** Pre-D-01 code would have `upcoming_fixtures.length === 5`; extending to 16 makes length-based checks meaningless.

**How to avoid:** Always group by `event_id` first; check `group.length >= 2` within each GW slot to identify DGW.

**Warning signs:** Cells that never show split-diagonal even during DGWs.

### Pitfall 2: Dark mode CSS for inline-style gradients

**What goes wrong:** Tailwind dark mode is class-based (`dark:bg-green-900`). Inline `style` attributes cannot react to the dark class — the gradient colours will be wrong in dark mode if hardcoded as light-mode hex values.

**Why it happens:** CSS-in-JS and Tailwind class systems are separate; `linear-gradient` in a `style` prop bypasses Tailwind.

**How to avoid:** Two options:
1. Render two absolutely-positioned child `<div>` elements inside the DGW `<td>`, each covering one triangle via `clip-path`, and apply Tailwind `bg-` classes to each. This lets dark mode work naturally.
2. Use a `useRef`/`useEffect` to detect dark mode and pick hex values, or declare CSS custom properties for tier colours in `globals.css` and reference them in the gradient.

**Warning signs:** Gradient cells appear with light-mode colours in dark mode.

### Pitfall 3: `page.test.tsx` will fail if new component is not mocked

**What goes wrong:** `src/app/page.test.tsx` imports `page.tsx` which now imports `FixtureHeatMap`. If no `vi.mock(...)` entry exists for `FixtureHeatMap`, all page tests fail immediately with a module resolution error.

**Why it happens:** page.test.tsx mocks all child components to isolate routing logic (pattern established across lines 6-48).

**How to avoid:** Add `vi.mock('@/components/club-form/FixtureHeatMap', () => ({ FixtureHeatMap: () => <div data-testid="fixture-heat-map" /> }))` alongside the other mocks.

**Warning signs:** All tests in `page.test.tsx` fail simultaneously when the component is mounted.

### Pitfall 4: FIXTURE_LOOKAHEAD change may affect ease aggregate computations downstream

**What goes wrong:** `attacking_ease_1gw` / `attacking_ease_3gw` / `attacking_ease_5gw` in `ClubForm` are computed from `team_fixtures` in `computeClubForm()` in `club-form.ts`. If anything downstream slices `upcoming_fixtures` to the first N entries (instead of up to the lookahead), adding more fixtures to the array is safe. However, if any code does `.slice(0, 5)` assuming the old limit, those slices are still correct but potentially stale.

**Why it happens:** The limit was 5 — any hardcoded `5` in fixture-consuming code could mask the expansion.

**How to avoid:** Grep for `slice(0, 5)` or `upcoming_fixtures.slice` in club-form.ts and related files before deploying the pipeline change. The heat map component uses its own groupby logic and is unaffected — but existing FixtureEaseRankingPanel and FixtureSwingDetector consume `upcoming_fixtures` too.

**Warning signs:** FixtureEaseRankingPanel showing more than 5 fixture bars after the change (it currently takes `team.upcoming_fixtures.slice(0, 5)` explicitly at line 83).

---

## Code Examples

Verified patterns from official sources:

### useClubForm() hook call pattern
```typescript
// Source: src/components/club-form/FixtureEaseRankingPanel.tsx lines 38-40 [VERIFIED: codebase]
const { data, isLoading, error } = useClubForm()
// data: ClubForm[] | undefined
```

### ClubFormFixture fields available for heat map
```typescript
// Source: src/lib/types.ts lines 363-371 [VERIFIED: codebase]
export interface ClubFormFixture {
  opponent_team: string        // e.g. "ARS"
  is_home: boolean             // true = H, false = A
  event_id: number             // GW number e.g. 34
  difficulty_score: number     // same as attacking_difficulty
  difficulty_tier: DifficultyTier  // 'easy' | 'medium' | 'hard'
  attacking_difficulty: number // 0.0–1.0 (lower = easier)
  defensive_difficulty: number
}
```

### DifficultyTier type
```typescript
// Source: src/lib/types.ts (DifficultyTier export); confirmed by club-form.ts lines 84-87 [VERIFIED: codebase]
type DifficultyTier = 'easy' | 'medium' | 'hard'
// 'easy' → green-100/900, 'medium' → amber-100/900, 'hard' → red-100/900
```

### Colour class mapping (from UI-SPEC — project convention)
```tsx
// Source: UI-SPEC.md §Color; matches FixtureEaseRankingPanel TARGET badge pattern [VERIFIED: codebase]
const tierClasses: Record<DifficultyTier, string> = {
  easy:   'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  hard:   'bg-red-100   text-red-800   dark:bg-red-900   dark:text-red-200',
}
```

### Tooltip format
```tsx
// Source: UI-SPEC.md §Tooltip Contract [VERIFIED: UI-SPEC.md]
// Single fixture:
title={`${fix.opponent_team} (${fix.is_home ? 'H' : 'A'}) — ${fix.attacking_difficulty.toFixed(2)}`}
// DGW:
title={`${fix1.opponent_team} (${fix1.is_home ? 'H' : 'A'}) ${fix1.attacking_difficulty.toFixed(2)} / ${fix2.opponent_team} (${fix2.is_home ? 'H' : 'A'}) ${fix2.attacking_difficulty.toFixed(2)}`}
// BGW:
title="No fixture (BGW)"
```

### FIXTURE_LOOKAHEAD change in merge.py
```python
# Source: pipeline/merge.py line 775 [VERIFIED: codebase]
# Before:
FIXTURE_LOOKAHEAD = 5
# After (D-01):
FIXTURE_LOOKAHEAD = 16
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `FIXTURE_LOOKAHEAD = 5` | `FIXTURE_LOOKAHEAD = 16` | Phase 66 (this phase) | Exposes up to 8 GWs for DGW teams in `upcoming_fixtures` |
| `ClubForm.upcoming_fixtures` comment: "next 5" | "next 16" | Phase 66 (this phase) | Type documentation accuracy only |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `FixtureEaseRankingPanel.tsx` line 83 uses `.slice(0, 5)` on `upcoming_fixtures` — hardcoded limit that will silently show more fixture bars after D-01 | Common Pitfalls §Pitfall 4 | Minor visual regression in FixtureEaseRankingPanel; no crash | 
| A2 | Dark mode gradient requires special handling (inline style cannot use `dark:` classes) | Common Pitfalls §Pitfall 2 / Code Examples §DGW CSS | DGW cells render wrong colours in dark mode |
| A3 | Mobile `overflow-x-auto` pattern is used in RouteTreeTab and ManualPlanTab (stated in CONTEXT.md; not directly verified in those component files in this session) | Don't Hand-Roll | Low risk — pattern is well-established in the project |

**Note:** A1 was verified: `FixtureEaseRankingPanel.tsx` line 83 does `team.upcoming_fixtures.slice(0, 5)`. After D-01 the panel will show up to 5 fixtures in the TARGET evaluation — still correct for its purpose (it counts fixtures with `attacking_difficulty < 0.5` in first 5). No regression.

---

## Open Questions

1. **Dark mode gradient colour source**
   - What we know: DGW cells need a CSS `linear-gradient` with two colours; Tailwind `dark:` classes cannot be used in inline styles.
   - What's unclear: Whether to use hex values from Tailwind's colour palette directly, CSS custom properties, or an alternative DOM structure (two clipped `<div>` elements).
   - Recommendation: Declare CSS custom properties `--tier-easy-bg`, `--tier-medium-bg`, `--tier-hard-bg` in `globals.css` with light/dark theme overrides (via `.dark` selector), then reference them in the inline `linear-gradient`. This is clean and consistent with the project's globals.css `@theme` pattern.

2. **GW column header: absolute vs. relative label**
   - What we know: UI-SPEC §Grid Layout Contract locks to `GW{event_id}` (e.g. "GW34") — absolute numbering.
   - What's unclear: Nothing — locked by UI-SPEC.
   - Recommendation: Use `GW{event_id}` from the `allEventIds` array.

3. **Default row sort**
   - What we know: UI-SPEC §Team row sort order locks to alphabetical by `team_short_name` (A–Z).
   - What's unclear: Nothing — locked by UI-SPEC.
   - Recommendation: `[...clubForms].sort((a, b) => a.team_short_name.localeCompare(b.team_short_name))`.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — pipeline change is a constant edit; component is pure React/Tailwind with an existing API route).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (jsdom environment) |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/components/club-form/FixtureHeatMap.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HEAT-01 | 20 rows rendered, each with 8 cells colour-coded by difficulty_tier | unit (RTL) | `npx vitest run src/components/club-form/FixtureHeatMap.test.tsx` | ❌ Wave 0 |
| HEAT-02 | DGW cell has split-diagonal style; BGW cell has no colour class | unit (RTL) | `npx vitest run src/components/club-form/FixtureHeatMap.test.tsx` | ❌ Wave 0 |
| HEAT-03 | Container has `overflow-x-auto`; table has `min-w-[640px]` | unit (RTL DOM inspect) | `npx vitest run src/components/club-form/FixtureHeatMap.test.tsx` | ❌ Wave 0 |
| D-06/D-07 | 'fixture-heat-map' tab appears in Analyse nav; heat map renders when active | unit (RTL on page.tsx) | `npx vitest run src/app/page.test.tsx` | ✅ (needs mock + new test case) |

### Sampling Rate

- **Per task commit:** `npx vitest run src/components/club-form/FixtureHeatMap.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/components/club-form/FixtureHeatMap.test.tsx` — covers HEAT-01, HEAT-02, HEAT-03
- [ ] `src/app/page.test.tsx` — needs new `vi.mock` for `FixtureHeatMap` + one test case for Heat Map tab navigation

---

## Security Domain

No ASVS controls applicable. Phase 66 is a read-only UI component consuming public FPL fixture data already in the pipeline. No authentication, no user input, no data mutation, no secrets. Same classification as PriceChangePanel (Phase 54) which was explicitly marked "read-only public data — no ASVS controls required". [VERIFIED: RESEARCH.md pattern from Phase 54 notes in ROADMAP.md]

---

## Sources

### Primary (HIGH confidence)
- `src/lib/types.ts` — ClubFormFixture and ClubForm interface definitions (VERIFIED in session)
- `src/lib/hooks/useClubForm.ts` — hook implementation (VERIFIED in session)
- `src/components/club-form/FixtureEaseRankingPanel.tsx` — reference component pattern (VERIFIED in session)
- `src/components/gem-table/VarianceBadge.tsx` — tooltip convention documentation (VERIFIED in session)
- `pipeline/merge.py` lines 773–815 — FIXTURE_LOOKAHEAD and team_fixtures loop (VERIFIED in session)
- `pipeline/merge.py` lines 270–319 — _compute_xpts_ngw groupby pattern (VERIFIED in session)
- `src/app/page.tsx` lines 53–93, 209–262 — SubTab union, SECTIONS, render guards (VERIFIED in session)
- `src/app/page.test.tsx` — mock pattern for new components (VERIFIED in session)
- `.planning/phases/066-fixture-heat-map/066-CONTEXT.md` — locked decisions D-01 through D-08 (VERIFIED in session)
- `.planning/phases/066-fixture-heat-map/066-UI-SPEC.md` — full UI contract (VERIFIED in session)
- `vitest.config.ts` — test framework configuration (VERIFIED in session)
- `src/lib/club-form.ts` lines 76–88 — DifficultyTier threshold logic (VERIFIED in session)

### Secondary (MEDIUM confidence)
- None required — all critical claims verified directly from codebase.

### Tertiary (LOW confidence)
- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified as already installed and in use
- Architecture: HIGH — groupby pattern verified in pipeline; component structure mirrors existing panels
- Pitfalls: HIGH (P1, P3) / MEDIUM (P2 dark mode) — P1 and P3 verified from code; P2 is known CSS behaviour
- Test architecture: HIGH — vitest.config.ts and existing test patterns verified

**Research date:** 2026-05-04
**Valid until:** End of season (stable codebase; fixture data format won't change mid-season)
