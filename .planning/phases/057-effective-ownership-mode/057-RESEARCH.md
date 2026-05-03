# Phase 57: Effective Ownership Mode - Research

**Researched:** 2026-05-03
**Domain:** React/TypeScript UI — captain panel replacement with EO mode toggle and ranked candidate list
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** The existing 2-card layout (Ceiling + EO-Adjusted) is **replaced entirely** — not extended, not tab-separated. The panel becomes a ranked candidate list with the mode toggle at the top.
- **D-02:** Show **top 5 candidates** in the ranked list regardless of mode. No pagination, no "show more" — 5 is the fixed cap.
- **D-03:** Four modes with concrete sort keys:
  - **Max xPts** — sort by `xPts_1gw` descending
  - **Protect Rank** — sort by `selected_by_percent` descending (highest EO first)
  - **Chase Rank** — sort by `xPts_90th_1gw` descending
  - **Differential Aggressive** — sort by `selected_by_percent` ascending, filtered to players whose `xPts_1gw >= median xPts_1gw` of the full eligible candidate pool
- **D-04:** Max xPts is the default mode on first render.
- **D-05:** EO% appears **inline next to the player name** as `~X%` (e.g. "Salah ~34%"). Tilde signals approximation. No separate column or badge chip.
- **D-06:** Tooltip on the `~X%` figure itself (using `title` attribute). Tooltip text: `"Approximate effective ownership based on FPL selected_by_percent data."`
- **D-07:** EO% sourced from `selected_by_percent` on `MergedPlayer` — already available, no pipeline changes.
- **D-08:** "Dangerous to fade" badge is **inline on the candidate row** — a small chip/label, visible only in **Protect Rank mode**.
- **D-09:** Badge trigger: `parseFloat(selected_by_percent) > 30` AND player is **not** in the authenticated user's squad.
- **D-10:** When the user is **unauthenticated**, the badge is **hidden entirely** — no login nudge, no false-positive fallback.
- **D-11:** Badge disappears automatically when mode switches away from Protect Rank.

### Claude's Discretion

- Toggle UI component choice (pill group / segmented control / tab strip) — follow existing Tailwind design system (ChipModeToggle pattern is the established precedent).
- Row layout within the candidate list (exact spacing, icon usage, mobile stacking order) — follow established squad component patterns.

### Deferred Ideas (OUT OF SCOPE)

- EO-05: EO mode affecting Transfer suggestions (deferred to v1.10)
- EO-06: EO mode affecting Decision Summary card rankings (deferred to v1.10)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EO-01 | Each captain candidate displays an EO% figure from `selected_by_percent`, labelled `~X%` with a tooltip | `selected_by_percent: string` confirmed on `MergedPlayer` in `types.ts:100`; `parseFloat()` before display |
| EO-02 | Captain panel has a 4-mode toggle (Max xPts / Protect Rank / Chase Rank / Differential Aggressive) that re-ranks candidates | Sort logic confirmed viable from actual data; `xPts_1gw`, `xPts_90th_1gw`, `selected_by_percent` all present on `MergedPlayer` |
| EO-03 | In Protect Rank mode, players with EO > 30% not in the user's squad show "Dangerous to fade" badge | `useSquad` + `useMyTeam` + `useAuthStatus` hooks confirmed; squad membership check via `myTeamData.picks.find(p => p.element === candidate.id)` |
| EO-04 | EO mode selection scoped to captain panel only; does not affect Transfer suggestions or Decision Summary | `useState<EOMode>('max_xpts')` local to component; no global state lift |
</phase_requirements>

---

## Summary

Phase 57 is a pure client-side UI replacement. The existing `CaptainPicksPanel.tsx` (a 2-card standalone panel mounted in the Plan section's Planner sub-tab) is rewritten as a ranked top-5 candidate list with a 4-mode toggle controlling sort order. No pipeline changes, no new API endpoints, and no new npm packages are required.

The critical data source insight: `captain_picks.json` (the current data source for `CaptainPicksPanel` via `useCaptainPicks`) only contains 2 picks (ceiling + eo_adjusted). To build a top-5 ranked list across four different sort modes, the new panel must derive candidates from **`usePlayers()`** (which returns all 830 merged players with `xPts_1gw`, `xPts_90th_1gw`, and `selected_by_percent` already computed). The `useCaptainPicks` hook is retained only to extract the current `gameweek` number.

The "Dangerous to fade" badge (EO-03) requires squad membership data. Because `CaptainPicksPanel` is in the Plan section (not the Squad section), `submittedId` must be threaded from `page.tsx` as a new prop — matching the exact same pattern already used for `TransferPanel` and `DecisionSummaryTab`.

**Primary recommendation:** Rewrite `CaptainPicksPanel.tsx` to consume `usePlayers()` for candidate pool, `useCaptainPicks()` for gameweek number, `useAuthStatus()` + `useMyTeam(isAuthenticated && !!submittedId)` for the EO-03 badge; thread `submittedId` prop from `page.tsx`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| EO% display (EO-01) | Browser / Client | — | Pure client-side derivation: `Math.round(parseFloat(selected_by_percent))` |
| Mode toggle state (EO-02) | Browser / Client | — | `useState<EOMode>` local to component per EO-04 |
| Candidate ranking per mode (EO-02) | Browser / Client | — | Client-side `.sort()` and `.filter()` over already-fetched `MergedPlayer[]` array |
| "Dangerous to fade" badge (EO-03) | Browser / Client | API / Backend | Client computes badge; backend (FPL proxy) provides squad picks via existing `/api/squad/{id}` |
| Player data pool | API / Backend | — | `/api/players` returns `merged_players.json` with all required fields |
| Gameweek number | API / Backend | — | `/api/captain-picks` returns `captain_picks.json` with `gameweek` field |
| Squad membership check | API / Backend | — | `/api/fpl/my-team` (authenticated) or `/api/squad/{id}` provide squad picks |

---

## Standard Stack

### Core (all already installed — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (Next.js) | 16.x (project-pinned) | Component rendering, `useState`, `useMemo` | Project framework |
| TanStack Query | 5.x (project-pinned) | `useQuery` hooks: `usePlayers`, `useCaptainPicks`, `useSquad`, `useMyTeam`, `useAuthStatus` | Established data-fetching layer |
| Tailwind CSS | v4 (config-less) | Utility-class styling; zinc palette, dark mode via `.dark` class | Project design system |

**Installation:** None required. All dependencies are already in `package.json`. [VERIFIED: codebase grep + package.json]

### Supporting Hooks (already available, newly consumed by this component)

| Hook | File | Used For |
|------|------|---------|
| `usePlayers()` | `src/lib/hooks/usePlayers.ts` | Fetch full `MergedPlayer[]` pool for candidate ranking |
| `useCaptainPicks()` | `src/lib/hooks/useCaptainPicks.ts` | Get `data.gameweek` for panel heading |
| `useAuthStatus()` | `src/lib/hooks/useAuthStatus.ts` | Gate "Dangerous to fade" badge on `isAuthenticated` |
| `useMyTeam(enabled)` | `src/lib/hooks/useMyTeam.ts` | Fetch authenticated squad picks for EO-03 badge |

---

## Architecture Patterns

### System Architecture Diagram

```
page.tsx (Plan section, Planner sub-tab)
  |
  +-- [NEW prop: submittedId] ----------------> CaptainPicksPanel (replacement)
                                                  |
                                    +-------------+-------------+
                                    |             |             |
                              usePlayers()  useCaptainPicks()  useAuthStatus()
                              (MergedPlayer[])  (gameweek)     (isAuthenticated)
                                    |                          |
                             [client-side]            useMyTeam(isAuthenticated
                              filter + sort             && !!submittedId)
                              by EOMode                 (squad picks)
                                    |
                              top-5 candidates
                                    |
                          +----+----+----+----+
                          |                   |
                    CandidateRows      EOModeToggle
                    (rank, name,       (4 pills,
                     ~EO%, pts,         useState)
                     badges)
                          |
                   DangerousToFadeBadge
                   (Protect Rank + EO>30%
                    + not in squad
                    + isAuthenticated)
```

### Recommended Component Structure

```
src/components/captaincy/
├── CaptainPicksPanel.tsx   # Rewritten in place (same filename, new implementation)
│   ├── EOMode type         # 'max_xpts' | 'protect_rank' | 'chase_rank' | 'differential_aggressive'
│   ├── EOModeToggle        # Sub-component: 4-pill segmented control
│   ├── CandidateRow        # Sub-component: rank, name+~EO%, fixture, pts, badges
│   └── DangerousToFadeBadge # Sub-component: amber inline badge
└── CaptaincyPanel.tsx      # UNCHANGED — Squad section Transfers sub-tab (separate concern)
```

### Pattern 1: EOMode Type and Toggle

```typescript
// Source: CONTEXT.md D-03 + ChipModeToggle.tsx established pattern
type EOMode = 'max_xpts' | 'protect_rank' | 'chase_rank' | 'differential_aggressive'

const EO_MODES: { value: EOMode; label: string; testId: string }[] = [
  { value: 'max_xpts',                label: 'Max xPts',    testId: 'eo-toggle-max-xpts' },
  { value: 'protect_rank',            label: 'Protect Rank', testId: 'eo-toggle-protect-rank' },
  { value: 'chase_rank',              label: 'Chase Rank',  testId: 'eo-toggle-chase-rank' },
  { value: 'differential_aggressive', label: 'Differential', testId: 'eo-toggle-differential' },
]

// Toggle renders as:
// <div role="group" aria-label="Captain ranking mode" className="inline-flex rounded-md overflow-hidden border ...">
//   {EO_MODES.map(opt => <button aria-pressed={mode === opt.value} ...>)}
// </div>
```

### Pattern 2: Candidate Pool Computation

```typescript
// Source: CONTEXT.md D-03; verified against merged_players.json data
// Eligibility: status === 'a', element_type !== 1 (no GKs), xPts_1gw exists and > 0
function computeEOCandidates(
  players: MergedPlayer[],
  mode: EOMode,
  topN = 5,
): MergedPlayer[] {
  const eligible = players.filter(
    p => p.status === 'a' &&
         p.element_type !== 1 &&
         p.xPts_1gw != null && p.xPts_1gw > 0
  )

  if (mode === 'max_xpts') {
    return eligible
      .sort((a, b) => (b.xPts_1gw ?? 0) - (a.xPts_1gw ?? 0))
      .slice(0, topN)
  }

  if (mode === 'protect_rank') {
    return eligible
      .sort((a, b) =>
        parseFloat(b.selected_by_percent) - parseFloat(a.selected_by_percent)
      )
      .slice(0, topN)
  }

  if (mode === 'chase_rank') {
    return eligible
      .sort((a, b) => (b.xPts_90th_1gw ?? 0) - (a.xPts_90th_1gw ?? 0))
      .slice(0, topN)
  }

  if (mode === 'differential_aggressive') {
    // Median computed over the FULL eligible pool (not just top-5)
    const xptsValues = eligible.map(p => p.xPts_1gw ?? 0).sort((a, b) => a - b)
    const mid = Math.floor(xptsValues.length / 2)
    const median = xptsValues.length % 2 !== 0
      ? xptsValues[mid]
      : (xptsValues[mid - 1] + xptsValues[mid]) / 2
    return eligible
      .filter(p => (p.xPts_1gw ?? 0) >= median)
      .sort((a, b) =>
        parseFloat(a.selected_by_percent) - parseFloat(b.selected_by_percent)
      )
      .slice(0, topN)
  }

  return []
}
```

### Pattern 3: "Dangerous to Fade" Badge Trigger

```typescript
// Source: CONTEXT.md D-09 / D-10; TransferPanel.tsx:87-92 pattern
// In the panel component body:
const myTeamPickIds = useMemo(() => {
  if (!isAuthenticated || !myTeamData) return new Set<number>()
  return new Set(myTeamData.picks.map(p => p.element))
}, [isAuthenticated, myTeamData])

// In CandidateRow:
const showDangerBadge =
  mode === 'protect_rank' &&
  isAuthenticated &&
  myTeamPickIds.size > 0 &&
  parseFloat(candidate.selected_by_percent) > 30 &&
  !myTeamPickIds.has(candidate.id)
```

### Pattern 4: EO% Inline Display

```typescript
// Source: CONTEXT.md D-05 / D-06; UI-SPEC §Interaction Contract
// ~XX% where XX = Math.round(parseFloat(selected_by_percent))
// Tilde prefix is plain ASCII U+007E — NOT a styled span
const eoDisplay = `~${Math.round(parseFloat(candidate.selected_by_percent))}%`

// Rendered inline:
<span
  className="text-sm text-zinc-500 dark:text-zinc-400"
  title="Approximate effective ownership based on FPL selected_by_percent data."
>
  {eoDisplay}
</span>
```

### Pattern 5: Submitting submittedId from page.tsx

```typescript
// Source: page.tsx lines 186-191 (TransferPanel pattern) — thread submittedId as prop
// In page.tsx, the Planner sub-tab block changes from:
//   <CaptainPicksPanel />
// to:
//   <CaptainPicksPanel submittedId={submittedId} />
//
// CaptainPicksPanel prop interface:
interface CaptainPicksPanelProps {
  submittedId?: string | null  // optional — badge gracefully hidden when absent
}
```

### Anti-Patterns to Avoid

- **Sourcing candidates from `useCaptainPicks()` alone:** `captain_picks.json` has only 2 picks (ceiling + eo_adjusted). A top-5 ranked list across 4 sort modes requires the full player pool from `usePlayers()`.
- **Global state lift for EOMode:** EO-04 explicitly forbids it. `useState<EOMode>('max_xpts')` stays inside the component.
- **Computing median only from the top-5 already-filtered set:** The median floor for Differential Aggressive mode must be computed from the FULL eligible pool, then apply the median filter, then take top-5. Doing it in the wrong order produces bad results.
- **Showing "Dangerous to fade" badge when unauthenticated:** D-10 — hide entirely, no login nudge, no false positive.
- **Softening the badge label:** The exact text is `"Dangerous to fade"` (CONTEXT.md §specifics). Do not use "High ownership", "Template", etc.
- **Introducing `text-lg`, `font-bold`, or custom tooltip components:** UI-SPEC §Typography — project uses `text-base`/`text-sm`/`text-xs` and `title` attribute only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Segmented pill toggle | Custom CSS transitions or tab system | Pattern from `ChipModeToggle.tsx` | Already established; `role="group"` + `aria-pressed` + zinc border pattern is the project standard |
| Tooltip | Floating `<div>` with `position: absolute` | `title` attribute | Project-wide convention; confirmed in existing `CaptaincyPanel.tsx`, `CaptainPicksPanel.tsx` TOOLTIPS pattern |
| Data fetching | New `/api/captain-candidates` endpoint | `usePlayers()` (already fetches merged_players) | No new API calls per phase notes; TanStack Query cache means no extra network round-trip if usePlayers was already called |
| Median computation | External stats library | Inline array sort + mid-index formula | Only 400-800 eligible players; trivial to compute inline; no library justifies the dependency |

---

## Key Implementation Finding: Data Source Requires usePlayers()

The current `CaptainPicksPanel` uses `useCaptainPicks()` which fetches `captain_picks.json`. That file contains only 2 picks (ceiling + eo_adjusted). The new panel requires a top-5 ranked list sortable by 4 different keys — this cannot be derived from 2 items.

**The solution (no pipeline/API changes):**

1. The new panel calls `usePlayers()` (returns `MergedPlayer[]`, already has `xPts_1gw`, `xPts_90th_1gw`, `selected_by_percent`, `fixtures`, `status`, `element_type`)
2. Client-side `useMemo` computes `computeEOCandidates(players, mode, 5)` — pure sort/filter, synchronous
3. `useCaptainPicks()` is still called to get `data.gameweek` for the heading "Captain Picks — GW {N}"
4. If TanStack Query already has `['players']` in cache (e.g. Squad section has been visited), `usePlayers()` returns instantly — no duplicate fetch

[VERIFIED: merged_players.json confirmed to contain `xPts_1gw`, `xPts_90th_1gw`, `selected_by_percent` on all players; captain_picks.json confirmed to contain only 2 picks]

---

## Component Inventory

| Component | Action | File | Notes |
|-----------|--------|------|-------|
| `CaptainPicksPanel` | **Rewrite** | `src/components/captaincy/CaptainPicksPanel.tsx` | Replace 2-card impl with ranked list + mode toggle |
| `EOModeToggle` | **New sub-component** | Colocated in `CaptainPicksPanel.tsx` | 4-pill segmented control following `ChipModeToggle.tsx` pattern |
| `DangerousToFadeBadge` | **New sub-component** | Colocated in `CaptainPicksPanel.tsx` | Amber inline badge; conditionally rendered |
| `CandidateRow` | **New sub-component** | Colocated in `CaptainPicksPanel.tsx` | Replicates structure from `CaptaincyPanel.tsx` rows with `~EO%` added |
| `page.tsx` | **Edit** | `src/app/page.tsx` | Thread `submittedId` as prop to `<CaptainPicksPanel submittedId={submittedId} />` |
| `CaptaincyPanel` | **Unchanged** | `src/components/captaincy/CaptaincyPanel.tsx` | Squad section Transfers sub-tab — separate concern, untouched |
| `useCaptainPicks` | **Unchanged** | `src/lib/hooks/useCaptainPicks.ts` | Retained for gameweek number only |

---

## Common Pitfalls

### Pitfall 1: Wrong Candidate Pool Size
**What goes wrong:** Panel shows fewer than 5 candidates because it tries to sort `useCaptainPicks()` data (2 picks) instead of `usePlayers()` data.
**Why it happens:** `useCaptainPicks` has the word "candidates" in its description but only returns 2 picks.
**How to avoid:** Use `usePlayers()` for the candidate pool; `useCaptainPicks()` only for `data.gameweek`.
**Warning signs:** Unit tests where mock returns 2 picks and `slice(0, 5)` produces a 2-item list.

### Pitfall 2: Median Computed on Already-Filtered Subset
**What goes wrong:** Differential Aggressive mode uses median of the top-10 xPts players rather than ALL eligible players, resulting in a biased floor.
**Why it happens:** Natural temptation to pre-filter then compute median.
**How to avoid:** Compute median over ALL eligible players first, then filter by median, then sort ascending EO%, then take top-5.
**Warning signs:** Empty list in Differential mode because median is too high.

### Pitfall 3: EO-03 Badge Shows When Unauthenticated
**What goes wrong:** Badge appears for unauthenticated users because `myTeamPickIds.size === 0` (empty set) is treated as "player not in squad".
**Why it happens:** Checking `!myTeamPickIds.has(candidate.id)` returns `true` for an empty set.
**How to avoid:** Guard requires `isAuthenticated === true` AND `myTeamData != null` (non-zero set) before the `has()` check. Use the `myTeamPickIds.size > 0` guard.
**Warning signs:** Badge visible in Protect Rank mode without logging in.

### Pitfall 4: selected_by_percent Numeric Comparison Without parseFloat
**What goes wrong:** String comparison `"9.5" > "30"` returns `false` because `"3" > "9"` lexicographically.
**Why it happens:** `selected_by_percent` is a string type ("12.5") — FPL API convention.
**How to avoid:** Always use `parseFloat(p.selected_by_percent)` before numeric comparison or sort.
**Warning signs:** Protect Rank mode sorts in wrong order; EO-03 badge misses some players.

### Pitfall 5: Forgetting to Thread submittedId from page.tsx
**What goes wrong:** "Dangerous to fade" badge never fires because `useMyTeam(false)` is always disabled.
**Why it happens:** `CaptainPicksPanel` in the Planner tab has no access to `submittedId` unless explicitly threaded.
**How to avoid:** Add `submittedId?: string | null` to `CaptainPicksPanelProps` in the component and update the mount in `page.tsx` to pass `submittedId={submittedId}`.
**Warning signs:** Badge never appears even when authenticated and squad is loaded.

### Pitfall 6: Breaking the Planner sub-tab by Changing Page Layout
**What goes wrong:** `page.tsx` edit accidentally disrupts `PlannerTab` which sits above `CaptainPicksPanel` in the Planner sub-tab.
**Why it happens:** Planner sub-tab renders `<PlannerTab />` followed by `<CaptainPicksPanel />` in a fragment; refactoring the fragment structure can break the conditional.
**How to avoid:** Only change the `<CaptainPicksPanel />` call to add the `submittedId` prop; do not restructure the JSX block.

---

## Code Examples

### EO Candidate Computation in useMemo

```typescript
// Source: patterns from captaincy-engine.ts + CONTEXT.md D-03
const eoCandidates = useMemo(() => {
  if (!playersData) return []
  const eligible = playersData.filter(
    p => p.status === 'a' && p.element_type !== 1 && p.xPts_1gw != null && p.xPts_1gw > 0
  )

  if (mode === 'max_xpts') {
    return eligible
      .slice()
      .sort((a, b) => (b.xPts_1gw ?? 0) - (a.xPts_1gw ?? 0))
      .slice(0, 5)
  }
  if (mode === 'protect_rank') {
    return eligible
      .slice()
      .sort((a, b) => parseFloat(b.selected_by_percent) - parseFloat(a.selected_by_percent))
      .slice(0, 5)
  }
  if (mode === 'chase_rank') {
    return eligible
      .slice()
      .sort((a, b) => (b.xPts_90th_1gw ?? 0) - (a.xPts_90th_1gw ?? 0))
      .slice(0, 5)
  }
  // differential_aggressive
  const xptsValues = eligible.map(p => p.xPts_1gw ?? 0).sort((a, b) => a - b)
  const mid = Math.floor(xptsValues.length / 2)
  const median = xptsValues.length % 2 !== 0
    ? xptsValues[mid]
    : (xptsValues[mid - 1] + xptsValues[mid]) / 2
  return eligible
    .filter(p => (p.xPts_1gw ?? 0) >= median)
    .slice()
    .sort((a, b) => parseFloat(a.selected_by_percent) - parseFloat(b.selected_by_percent))
    .slice(0, 5)
}, [playersData, mode])
```

### Squad Membership Check

```typescript
// Source: TransferPanel.tsx:87-92 derivedFtCount pattern; CONTEXT.md §canonical_refs
const { isAuthenticated } = useAuthStatus()
const { data: myTeamData } = useMyTeam(isAuthenticated && !!submittedId)

const myTeamPickIds = useMemo(() => {
  if (!isAuthenticated || !myTeamData) return new Set<number>()
  return new Set(myTeamData.picks.map(p => p.element))
}, [isAuthenticated, myTeamData])
```

### page.tsx Mount Point Change

```typescript
// Source: page.tsx lines 212-216; current implementation
// BEFORE:
{activeSection !== 'squad' && activeSubTab === 'planner' && (
  <>
    <PlannerTab />
    <CaptainPicksPanel />
  </>
)}

// AFTER (only change: add submittedId prop):
{activeSection !== 'squad' && activeSubTab === 'planner' && (
  <>
    <PlannerTab />
    <CaptainPicksPanel submittedId={submittedId} />
  </>
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 2-card Ceiling / EO-Adjusted layout | Ranked top-5 list with 4-mode toggle | Phase 57 (this phase) | More information density; mode-driven ordering aligns to manager's rank position |
| `useCaptainPicks()` as sole data source | `usePlayers()` for candidate pool; `useCaptainPicks()` only for GW number | Phase 57 (this phase) | Enables top-5 across 4 sort modes without pipeline changes |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `captain_picks.json` will NOT be extended with a `candidates[]` array in this phase (no pipeline changes) | Standard Stack | If pipeline is extended instead, the client-side `usePlayers()` approach is unnecessary complexity |
| A2 | The TanStack Query `['players']` cache is often warm when the user visits the Planner tab (they've already been to Analyse or Squad tabs) | Standard Stack | If cold, `usePlayers()` adds a network request before candidates can render — acceptable, has loading state |
| A3 | `submittedId` is the correct prop to thread for enabling the EO-03 badge | Architecture | If the Planner section has its own teamId state separate from Squad section's, this may not be the right source |

**All critical implementation decisions are VERIFIED from the codebase. Only the assumptions above remain unverified.**

---

## Open Questions

1. **Where exactly should `computeEOCandidates` live?**
   - What we know: Logic is pure TypeScript, testable in isolation
   - What's unclear: Should it be inlined in `CaptainPicksPanel.tsx` or extracted to `src/lib/eo-candidates.ts`?
   - Recommendation: Extract to `src/lib/eo-candidates.ts` — enables unit testing without component setup; follows the `captaincy-engine.ts` / `gem-score.ts` / `suggest-transfers.ts` pattern of pure lib functions

2. **Does the EO-03 badge work for the Squad → Transfers sub-tab's `CaptaincyPanel`?**
   - What we know: `CaptaincyPanel` (Transfers sub-tab) is unchanged in this phase per D-01
   - What's unclear: EO-04 says "Squad section captain panel only" — if the "Squad section captain panel" refers to `CaptaincyPanel` rather than `CaptainPicksPanel`, the implementation is inverted
   - Recommendation: Implement as described (rewrite `CaptainPicksPanel`). The discussion log and CONTEXT §canonical_refs are unambiguous — `CaptainPicksPanel` is the component being replaced.

---

## Environment Availability

Step 2.6: SKIPPED — Phase is purely TypeScript/React component changes. No external tools, services, runtimes, databases, or CLI utilities beyond `npm run test` (vitest) are required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 + React Testing Library 16.3.2 |
| Config file | `vitest.config.ts` (jsdom environment) |
| Quick run command | `npx vitest run src/components/captaincy/` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EO-01 | Candidate row displays `~XX%` inline next to player name with tooltip | unit/RTL | `npx vitest run src/components/captaincy/CaptainPicksPanel.test.tsx` | ❌ Wave 0 |
| EO-01 | `parseFloat` correctly converts string `"12.5"` → rounded `13` | unit | `npx vitest run src/lib/eo-candidates.test.ts` | ❌ Wave 0 |
| EO-02 | Mode toggle renders 4 pills with `aria-pressed` | unit/RTL | `npx vitest run src/components/captaincy/CaptainPicksPanel.test.tsx` | ❌ Wave 0 |
| EO-02 | Max xPts mode sorts by `xPts_1gw` descending | unit | `npx vitest run src/lib/eo-candidates.test.ts` | ❌ Wave 0 |
| EO-02 | Protect Rank mode sorts by `selected_by_percent` descending | unit | `npx vitest run src/lib/eo-candidates.test.ts` | ❌ Wave 0 |
| EO-02 | Chase Rank mode sorts by `xPts_90th_1gw` descending | unit | `npx vitest run src/lib/eo-candidates.test.ts` | ❌ Wave 0 |
| EO-02 | Differential mode filters to above-median xPts then sorts by EO ascending | unit | `npx vitest run src/lib/eo-candidates.test.ts` | ❌ Wave 0 |
| EO-03 | "Dangerous to fade" badge appears when EO>30%, not in squad, authenticated, Protect Rank mode | unit/RTL | `npx vitest run src/components/captaincy/CaptainPicksPanel.test.tsx` | ❌ Wave 0 |
| EO-03 | Badge does NOT appear when unauthenticated | unit | `npx vitest run src/lib/eo-candidates.test.ts` | ❌ Wave 0 |
| EO-04 | Switching mode does not affect Transfer suggestions or Decision Summary rendering | integration | Manual — no shared state to break | manual-only |

### Sampling Rate

- **Per task commit:** `npx vitest run src/components/captaincy/ src/lib/eo-candidates.test.ts`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/lib/eo-candidates.test.ts` — pure logic tests for `computeEOCandidates` covering all 4 modes, median computation, edge cases
- [ ] `src/components/captaincy/CaptainPicksPanel.test.tsx` — RTL tests for toggle, EO% display, badge conditions

*(Existing test infrastructure covers the rest — `vitest.config.ts` in place, `jsdom` environment configured, RTL available)*

---

## Security Domain

This phase adds no authentication flows, no new API endpoints, no data persistence, no input handling beyond a UI toggle, and no cryptography. The only security-adjacent concern is:

- **Auth-gated badge (EO-03):** Correctly gates on `isAuthenticated && myTeamData != null` — consistent with existing auth patterns; no new risk introduced.

ASVS V4 (Access Control) — not applicable; the badge is purely cosmetic and hides by default (no dangerous action is gated behind it). No additional ASVS categories apply to this UI-only change.

---

## Sources

### Primary (HIGH confidence)

- `src/components/captaincy/CaptainPicksPanel.tsx` — Component being replaced; TOOLTIPS pattern, hook usage confirmed [VERIFIED: codebase read]
- `src/components/captaincy/CaptaincyPanel.tsx` — Row layout and badge pattern reference [VERIFIED: codebase read]
- `src/lib/types.ts` — `MergedPlayer` interface: `selected_by_percent: string`, `xPts_1gw?: number`, `xPts_90th_1gw?: number`, `fixtures: FixtureEntry[]` all confirmed [VERIFIED: codebase read, lines 91-190]
- `src/lib/captaincy-engine.ts` — Eligibility filter pattern (`status === 'a'`, no GKs, xPts > 0) confirmed [VERIFIED: codebase read]
- `pipeline/cache/merged_players.json` — All 830 players have `xPts_1gw`, `xPts_90th_1gw`, `selected_by_percent` [VERIFIED: Python probe]
- `pipeline/cache/captain_picks.json` — Confirmed only 2 picks; no `candidates[]` array [VERIFIED: file read]
- `src/app/page.tsx` — `CaptainPicksPanel` mount point (Planner sub-tab, line 215); `submittedId` already lifted at page level [VERIFIED: codebase read]
- `src/components/transfers/TransferPanel.tsx` — `useMyTeam` + `useAuthStatus` auth-gated pattern at lines 87-92 [VERIFIED: codebase read]
- `.planning/phases/057-effective-ownership-mode/057-CONTEXT.md` — Locked decisions D-01 through D-11 [VERIFIED: file read]
- `.planning/phases/057-effective-ownership-mode/057-UI-SPEC.md` — Full UI design contract: colours, typography, spacing, interactions [VERIFIED: file read]
- `vitest.config.ts` — Test framework configuration confirmed (jsdom, `@` alias) [VERIFIED: codebase read]

### Secondary (MEDIUM confidence)

- `src/components/optimiser/ChipModeToggle.tsx` — Established toggle pattern (4-pill segmented control, `aria-pressed`) for Claude's discretion toggle implementation [VERIFIED: codebase read]

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — no new packages; all hooks and data sources confirmed in codebase
- Architecture: HIGH — data flow verified against live JSON and hook implementations
- Pitfalls: HIGH — derived from actual code paths and type definitions, not training assumptions
- Mode logic: HIGH — verified against actual merged_players.json data with Python probe

**Research date:** 2026-05-03
**Valid until:** 2026-06-03 (stable — no external dependencies)
