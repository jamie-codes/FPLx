---
phase: 43-lineup-engine-navigator
reviewed: 2026-04-30T00:00:00Z
depth: quick
files_reviewed: 10
files_reviewed_list:
  - src/lib/optimise-lineup.ts
  - src/lib/optimise-lineup.test.ts
  - src/components/optimiser/OptimiserPanel.tsx
  - src/components/optimiser/OptimiserPanel.test.tsx
  - src/lib/types.ts
  - src/app/page.tsx
  - src/components/nav/MobileNav.tsx
  - src/components/transfers/TransferPanel.tsx
  - src/app/page.test.tsx
  - src/components/nav/MobileNav.test.tsx
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 43: Code Review Report

**Reviewed:** 2026-04-30T00:00:00Z
**Depth:** quick
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Ten files covering the Phase 43 lineup-engine and navigator wiring were reviewed. The pure-function optimiser engine (`optimise-lineup.ts`) is logically sound for the happy path. Defects concentrate in three areas: (1) a bench-construction bug that silently drops bench players when a squad member has no pipeline entry, (2) multiple non-null assertion crashes in `OptimiserPanel.tsx` that become reachable when `playerMap` is out of sync with the engine's output, and (3) swallowed `localStorage` errors in `page.tsx` that mask SecurityErrors and quota exceptions rather than the intentional SSR-guard they document.

---

## Critical Issues

### CR-01: Non-null assertions on `playerMap.get()` crash when player is absent from pipeline data

**File:** `src/components/optimiser/OptimiserPanel.tsx:175-176`

**Issue:** `benchGkPlayer` is retrieved with `playerMap.get(lineup.bench[0])!` using a non-null assertion. `lineup.bench` is produced by `optimise-lineup.ts`, which builds bench entries from `picks` (the full 15-player list) but only adds players that are in `playerMap`. However, within the UI the `playerMap` is built from `playersData` (the `/api/players` response), which may differ from the `playersData` array passed to the engine if the hook returns a stale intermediate value between renders. The engine uses the `playersData` captured at memo-evaluation time; React may call the render function a second time after a partial re-render with a fresher `squadData` but the same stale `playersData`, causing `playerMap.get(lineup.bench[0])` to return `undefined`. Dereferencing it with `!` then throws `TypeError: Cannot read properties of undefined`. The same pattern applies to every `playerMap.get(id)!` call in the `starterGks`/`starterDefs`/`starterMids`/`starterFwds` `.map()` callbacks (lines 205, 222, 237, 250).

Additionally, `benchOutfieldPlayers` on line 176 applies `.filter(Boolean)` after the non-null assertion, which means the guard is applied *after* the crash-inducing `!` dereference on line 175, not before it.

**Fix:**
```tsx
// Line 175: guard before non-null assertion
const benchGkPlayer = playerMap.get(lineup.bench[0])
if (!benchGkPlayer) return null  // should not happen, but defend against stale map

// Line 176: remove the non-null assertion; filter already guards
const benchOutfieldPlayers = lineup.bench.slice(1)
  .map((id: number) => playerMap.get(id))
  .filter((p): p is MergedPlayer => p !== undefined)

// In each row's .map(), guard with optional chaining:
// const p = playerMap.get(id)
// if (!p) return null
// return <PlayerCircle key={id} player={p} ... />
```

---

## Warnings

### WR-01: BGW bench count is silently wrong when eligible < 15 — bench may have fewer than 4 entries

**File:** `src/lib/optimise-lineup.ts:125-142`

**Issue:** Bench players are collected from `picks` (the full 15-player list), not `eligible`. A player who was excluded by the BGW filter (`xPts_1gw === 0`) is still present in `picks`, so it may appear in `benchPicks` if it is not a starter — which is correct. However, the bench outfield sort at line 136 relies on `horizonScore(p)` which for a BGW player returns `0` (via `?? 0` fallback on an undefined field for a horizon-3/5 request). More importantly, if a player is missing from `playerMap` entirely (pipeline data absent), the `.filter((p): p is MergedPlayer => p !== undefined)` on line 130 silently drops them. This can produce a `bench` array with fewer than 4 entries. The UI at line 176 then silently renders only `benchOutfieldPlayers.length < 3` outfield slots without any error, but the `OPT-04` contract (`bench` has 4 entries, `bench[0]` is GK) is violated.

The test suite does not cover the case where a pick has no corresponding pipeline entry (i.e. `playerMap.get(pick.element) === undefined`) when computing bench.

**Fix:** After building `bench`, assert its length is 4 before returning, or return `null` to signal an unresolvable lineup:
```ts
if (bench.length !== 4) return null
```

### WR-02: `localStorage` errors silently swallowed — hides real runtime exceptions

**File:** `src/app/page.tsx:74,77,82`

**Issue:** All three `try/catch` blocks swallow every thrown exception with no logging or re-throw. The documented intent is to guard against SSR (where `localStorage` is undefined). However, `localStorage.getItem` and `localStorage.setItem` can also throw `SecurityError` (when cookies/storage are blocked by the browser) and `setItem` can throw `QuotaExceededError`. Swallowing these silently means a user whose browser blocks storage will see a permanently broken team-ID field (always empty, never persisting) with no diagnostic. The pattern `catch {}` (no binding, no log) treats all errors identically.

**Fix:** Narrow the catch to `ReferenceError` (SSR guard) or at minimum log unexpected errors:
```ts
const [teamId, setTeamId] = useState<string>(() => {
  try {
    return localStorage.getItem('fpl_team_id') ?? ''
  } catch (e) {
    if (!(e instanceof ReferenceError)) {
      // eslint-disable-next-line no-console
      console.warn('[page] localStorage unavailable:', e)
    }
    return ''
  }
})
```

### WR-03: Captain/VC selection always uses `xPts_90th_1gw` regardless of horizon — incorrect for horizon 3/5

**File:** `src/lib/optimise-lineup.ts:57-58`

**Issue:** `captainKey` is hardcoded to `xPts_90th_1gw ?? xPts_1gw ?? 0` regardless of the `horizon` argument. When `horizon` is 3 or 5, the engine scores starters by `xPts_3gw` / `xPts_5gw`, but captain and VC are still selected by the 1 GW ceiling metric. This is internally inconsistent: the user asked for a 5 GW horizon, so the lineup is built to maximise 5 GW xPts, but the captaincy band goes to the player with the highest 1 GW ceiling. The spec comment says "Captain: starter with highest (xPts_90th_1gw ?? xPts_1gw ?? 0)" without horizon qualification, but this is only correct for horizon=1. There are no `xPts_90th_3gw` / `xPts_90th_5gw` pipeline fields, so the fix is to at least use the horizon xPts field as the fallback:

**Fix:**
```ts
const captainKey = (p: MergedPlayer): number =>
  p.xPts_90th_1gw ?? horizonScore(p)
```
This keeps the ceiling metric as the primary signal (only available for 1 GW) but falls back to the correct horizon score rather than always falling back to `xPts_1gw`.

### WR-04: MobileNav test expects exactly 4 Analyse pills but SECTIONS now has 5 Analyse sub-tabs — test will fail

**File:** `src/components/nav/MobileNav.test.tsx:40-49`

**Issue:** The test at line 40 asserts that Analyse has 4 pills (`Gems`, `Insights`, `DefCon`, `SP`) and `expect(pillButtons).toHaveLength(4)`. But `SECTIONS` in `src/app/page.tsx` (lines 31-36) defines 5 Analyse sub-tabs: `gems`, `insights`, `defcon`, `set-pieces`, and `accuracy` (mobileLabel: `'Acc'`). The test filter `['Gems', 'Insights', 'DefCon', 'SP']` will find 4 pills, pass the `toHaveLength(4)` assertion, but will never validate the `Acc` pill — meaning the `accuracy` sub-tab is effectively untested in the MobileNav suite, and if a future change alters the pill count the test continues to give a false-green signal. This is a test coverage gap that can mask regressions.

**Fix:** Update the test to include `'Acc'` and assert length 5:
```ts
const pillButtons = allButtons.filter(b =>
  ['Gems', 'Insights', 'DefCon', 'SP', 'Acc'].includes(b.textContent ?? '')
)
expect(pillButtons).toHaveLength(5)
```

---

## Info

### IN-01: `HORIZON_FIELD` duplicated between engine and UI component

**File:** `src/components/optimiser/OptimiserPanel.tsx:27-31`

**Issue:** `HORIZON_FIELD` is defined identically in both `src/lib/optimise-lineup.ts` (lines 9-13) and `OptimiserPanel.tsx` (lines 27-31). If a new horizon value is added, both copies must be updated in sync. The engine already exports `HORIZON_FIELD`; the component could import it directly.

**Fix:**
```ts
// In OptimiserPanel.tsx — replace local definition with:
import { HORIZON_FIELD } from '@/lib/optimise-lineup'
```

### IN-02: `page.test.tsx` mocks `AccuracyTab` implicitly via unused mock absence — missing mock causes test isolation gap

**File:** `src/app/page.test.tsx:1-32`

**Issue:** `page.tsx` imports `AccuracyTab` (line 20), but `page.test.tsx` has no `vi.mock` for it. If `AccuracyTab` imports anything that fails in a jsdom environment (e.g. a charting library, canvas, or a module that calls browser APIs), the entire test suite will fail with an opaque import error rather than a clear test failure. All other direct imports of panel components in `page.tsx` are mocked. The missing mock is an oversight.

**Fix:**
```ts
vi.mock('@/components/accuracy/AccuracyTab', () => ({ AccuracyTab: () => <div data-testid="accuracy" /> }))
```

---

_Reviewed: 2026-04-30T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
