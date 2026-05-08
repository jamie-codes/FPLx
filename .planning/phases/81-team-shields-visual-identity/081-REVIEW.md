---
phase: 81-team-shields-visual-identity
reviewed: 2026-05-08T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/lib/hooks/useTeamBadge.ts
  - src/lib/hooks/useTeamBadge.test.ts
  - src/components/set-pieces/SetPieceTakerPanel.tsx
  - src/components/set-pieces/SetPieceTakerPanel.test.tsx
  - src/components/club-form/FixtureHeatMap.tsx
  - src/components/club-form/FixtureHeatMap.test.tsx
  - src/components/squad/LineupTab.tsx
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: fixed
---

# Phase 81: Code Review Report

**Reviewed:** 2026-05-08T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

This phase adds a `useTeamBadge` hook as a single source of truth for crest URL, load-error fallback state, and fallback colour, then wires it into three placement sites: `SetPieceTakerPanel` (ghost watermark), `FixtureHeatMap` (row-header crest), and `LineupTab` (kit image fallback). The hook itself is clean. Two of the three placement sites are sound. The critical defect is in `LineupTab`: `teamKitUrl` receives `undefined` when the team short name is not in `TEAM_BADGE_CODE`, but `showFallback` is already `true` in that case and the `<img>` branch is unreachable — so the crash cannot happen at runtime. However the type signature of `teamKitUrl(number): string` accepts `undefined` when `teamCode` is `undefined`, producing a URL of `…/shirt_undefined-66.png` that would fire the `onError` callback — the guard in the JSX (`showFallback ? fallback : img`) prevents the bad URL from ever being set as the `src`, so this is a latent type error rather than a live crash. Both are documented below with appropriate severity.

---

## Critical Issues

### CR-01: `teamKitUrl` called with potentially `undefined` argument — type safety hole

**File:** `src/components/squad/LineupTab.tsx:88`

**Issue:** `teamCode` is derived on line 46 as:

```ts
const teamCode = TEAM_BADGE_CODE[player.team_short_name]
```

`TEAM_BADGE_CODE` is typed `Record<string, number>`, which means TypeScript considers the result `number`, not `number | undefined`. In practice, any `team_short_name` not present in the map returns `undefined` at runtime. On line 88 the value is forwarded directly to `teamKitUrl(teamCode)` — which is typed to accept only `number`. If TypeScript's strict index-signature checking is not enabled (`noUncheckedIndexedAccess`), this compiles without error yet produces `teamKitUrl(undefined)` → URL `…/shirt_undefined-66.png` for any unrecognised team.

The JSX guard `showFallback ? fallback : <img src={teamKitUrl(teamCode)} …>` prevents the bad URL from being rendered while `showFallback` is `true`. `useTeamBadge` sets `showFallback = true` whenever `src === null`, which happens when `TEAM_BADGE_CODE[shortName]` is `undefined`. So the two lookups agree — the img branch is only reachable when `teamCode` is a valid number. The crash path is blocked at runtime.

However, the correlation between `showFallback` and `teamCode` being defined is implicit and fragile. If either lookup table is updated independently (e.g. a team is added to `TEAM_BADGE_CODE` but not to `TEAM_COLOURS`, or vice-versa), the guard can become misaligned and the bad URL will be rendered. The fix is to eliminate the second independent lookup entirely.

**Fix:**
```tsx
// LineupTab.tsx — PlayerCard
// Remove the separate TEAM_BADGE_CODE lookup. useTeamBadge already owns the
// badge code logic; expose `src` from the hook and derive the kit URL from the
// same code, or add a kitSrc to the hook.

// Option A — use the badge code from the hook (requires hook to expose it, or
//            expose a kitSrc directly):
const { src: badgeSrc, onError, showFallback, fallbackColour } = useTeamBadge(player.team_short_name)
// derive kit URL only when we know the code is valid
const kitSrc = showFallback ? null : teamKitUrl(TEAM_BADGE_CODE[player.team_short_name]!)

// Then in JSX:
// {showFallback ? <fallback /> : <img src={kitSrc!} ... />}

// Option B (preferred) — add kitSrc to UseTeamBadgeResult in useTeamBadge.ts:
// kitSrc: code !== undefined ? teamKitUrl(code) : null
// and consume `kitSrc` directly in PlayerCard instead of calling teamKitUrl again.
```

---

## Warnings

### WR-01: `HeatMapRow` defined inside render function — hooks-rules risk and recreation cost

**File:** `src/components/club-form/FixtureHeatMap.tsx:123`

**Issue:** `HeatMapRow` is a React component (it calls `useTeamBadge`) defined as a nested function inside `FixtureHeatMap`'s render function body, after the early-return guard. The comment on line 120–122 explains the intention: capture `grid`, `mode`, `tierMap`, and `ownedTeamIds` from the outer scope to satisfy `react-hooks/rules-of-hooks`.

The hooks-rules concern is real — a component function that calls hooks must not itself be defined inside another component's render. React identifies components by referential identity; because `HeatMapRow` is re-created on every render of `FixtureHeatMap`, React considers it a *new* component each render and unmounts/remounts every row, destroying their hook state (including the `imgError` state inside each `useTeamBadge` call). This means:

1. Every re-render of `FixtureHeatMap` (mode toggle, horizon toggle, dark-mode change) resets all `imgError` states, causing every crest `<img>` that previously errored to briefly render its broken URL again before erroring and re-entering the fallback state.
2. The unnecessary unmount/remount cycle triggers new `onError` handler closures that re-call `setImgError`, causing an extra render per erroring image.

This is a correctness defect for the fallback path, not merely a performance concern.

**Fix:**
```tsx
// Move HeatMapRow outside FixtureHeatMap. Pass the closed-over values as explicit props.

interface HeatMapRowProps {
  t: ClubForm
  grid: { allEventIds: number[]; byTeamGw: Map<number, Map<number, ClubFormFixture[]>> }
  mode: 'ATT' | 'DEF'
  tierMap: Record<DifficultyTier, string>
  ownedTeamIds: Set<number>
}

function HeatMapRow({ t, grid, mode, tierMap, ownedTeamIds }: HeatMapRowProps) {
  const { src, onError, showFallback, fallbackColour, initial } = useTeamBadge(t.team_short_name)
  // ... rest of existing body unchanged
}

// In FixtureHeatMap's return:
visibleTeams.map(t => (
  <HeatMapRow
    key={t.team_id}
    t={t}
    grid={grid!}
    mode={mode}
    tierMap={tierMap}
    ownedTeamIds={ownedTeamIds}
  />
))
```

### WR-02: Triple-game-week (TGW) gradient only covers two opponents — third opponent never displayed

**File:** `src/components/club-form/FixtureHeatMap.tsx:169-170`

**Issue:** When `fixtures.length >= 2`, the gradient and label rendering has explicit branches for exactly 2 and exactly 3 fixtures (lines 169–170):

```tsx
const gradient = colours.length === 2
  ? `linear-gradient(to bottom right, ${colours[0]} 50%, ${colours[1]} 50%)`
  : `linear-gradient(to bottom right, ${colours[0]} 33%, ${colours[1]} 33% 66%, ${colours[2]} 66%)`
```

However the label rendering below only ever shows two `<span>` elements: `fixtures[0].opponent_team` (top-left) and `fixtures[1].opponent_team` (bottom-right). If a TGW produces 3 fixtures, the third opponent's name is silently dropped from the UI. The tooltip (line 172) joins all fixtures correctly with `join(' / ')`, so the data is not lost entirely, but the cell label is visually misleading — the third colour band is shown without a label.

**Fix:**
```tsx
// If fixtures.length >= 3, render a third label, e.g. bottom-left:
{fixtures.length >= 3 && (
  <span className="absolute bottom-0 left-1 text-[10px] font-mono leading-none pb-0.5 text-zinc-900 dark:text-zinc-100">
    {fixtures[2].opponent_team}
  </span>
)}
```

If TGWs are considered impossible in the current FPL season's data, add an assertion or a comment. Leaving it silently unlabelled will confuse users if TGW data ever appears.

### WR-03: `onError` callback identity changes every render — all `<img>` elements lose stable `onError`

**File:** `src/lib/hooks/useTeamBadge.ts:26`

**Issue:** The hook returns `onError: () => setImgError(true)` as an inline arrow function created fresh on every render. This is not a correctness defect in the normal case (the handler always calls the same `setImgError`), but it means every consumer that passes `onError` as a prop to an `<img>` element will see a new function reference on every render, causing React to detach and reattach the event handler on every render. In `FixtureHeatMap` the problem is compounded by WR-01 (row remounts), and in `LineupTab` where there are 15 player cards on screen simultaneously, this generates 15 × N spurious handler reattachments per render.

The practical consequence: if an `onError` fires during the brief window when the old handler has been removed and the new one not yet attached, the error event can be missed and `imgError` never becomes `true`. This is an unlikely but non-zero race in jsdom-based tests and on very fast connections.

**Fix:**
```ts
import { useState, useCallback } from 'react'

export function useTeamBadge(shortName: string): UseTeamBadgeResult {
  const [imgError, setImgError] = useState(false)
  const code = TEAM_BADGE_CODE[shortName]
  const src = code !== undefined ? teamBadgeUrl(code) : null
  const onError = useCallback(() => setImgError(true), [])  // stable reference
  return {
    src,
    onError,
    showFallback: src === null || imgError,
    fallbackColour: getTeamColour(shortName).primary,
    initial: shortName[0] ?? '?',
  }
}
```

---

## Info

### IN-01: `useTeamBadge` is marked `'use client'` but is a pure hook — directive is misplaced

**File:** `src/lib/hooks/useTeamBadge.ts:1`

**Issue:** `'use client'` is a module-level directive that marks the entire module (and its transitive imports) as client-side. Hook files should not carry this directive — the directive belongs on the component that uses the hook. Placing it on the hook file prevents the hook from being imported by RSC-compatible utilities and pollutes the module graph unnecessarily.

**Fix:** Remove the `'use client'` directive from `useTeamBadge.ts`. The directive is already present on all three consumer files (`SetPieceTakerPanel.tsx`, `FixtureHeatMap.tsx`, `LineupTab.tsx`) which is the correct location.

### IN-02: `FixtureHeatMap.test.tsx` — test `SHD-02` uses a fragile fallback detection heuristic

**File:** `src/components/club-form/FixtureHeatMap.test.tsx:416`

**Issue:** The test checks for a fallback element with:

```tsx
const hasFallback = th.querySelector('span.rounded-full') !== null
  || th.querySelector('[aria-label*="fallback"]') !== null
```

The production component (`FixtureHeatMap.tsx:135`) renders the fallback `<span>` with class `rounded-full` and `aria-hidden="true"`, not an `aria-label` containing "fallback". The second selector (`[aria-label*="fallback"]`) will never match anything in the current implementation. Because the first selector (`span.rounded-full`) does match, the test still passes — but the second branch creates a false sense of coverage and will silently stop being useful if the fallback's `rounded-full` class is ever changed.

**Fix:**
```tsx
// Replace the compound heuristic with a single reliable selector
const hasFallback = th.querySelector('span[aria-hidden="true"]') !== null
// or use a data-testid on the fallback span for more explicit targeting
```

---

_Reviewed: 2026-05-08T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
