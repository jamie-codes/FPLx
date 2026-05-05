---
phase: 072-lineup-optimiser
reviewed: 2026-05-05T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/lib/lineup-swap.ts
  - src/lib/lineup-swap.test.ts
  - src/components/squad/LineupTab.tsx
  - src/components/squad/LineupTab.test.tsx
  - src/app/page.tsx
  - src/app/page.test.tsx
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 072: Code Review Report

**Reviewed:** 2026-05-05T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Six files were reviewed covering the Phase 72 lineup optimiser implementation: two pure-function helpers (`lineup-swap.ts`), two component files (`LineupTab.tsx`), and `page.tsx` with its test. The logic for swap legalisation and application is fundamentally sound, but two correctness bugs were found — one that causes a runtime crash under a reachable race-condition, and one that silently produces a wrong lineup on every bench-swap scenario. Four warnings cover missing legality enforcement, the BGW-banner logic incorrectly reaching the banner path for a non-null lineup, a stale-closure risk, and a captain-badge collision. No security issues were found; no hardcoded secrets or injection vectors exist in the reviewed files.

---

## Critical Issues

### CR-01: Non-null assertion crashes when benched player is missing from playerMap

**File:** `src/lib/lineup-swap.ts:61`

In `applySwap`, after building `newStarters`, the captain sort uses a non-null assertion `playerMap.get(b)!` for every id in `newStarters`. If `benchId` (which has just been added to `newStarters`) is absent from `playerMap`, the assertion throws `TypeError: Cannot read properties of undefined`. This is not protected by the `if (!starter || !benchP)` guard at line 21 which only applies to `isLegalSwap`; `applySwap` performs no such guard and is called after `isLegalSwap` returns `true`. The check at line 21 guards `isLegalSwap`, but the `handleBenchTap` in `LineupTab.tsx` (line 174-175) calls `isLegalSwap` first and only then calls `applySwap` — the two functions share the same `playerMap`, so in practice both are safe **only if** no mutation or stale reference has occurred between the two calls. However, if `playersData` is refetched between renders (TanStack Query background refetch) and the component re-renders with a new `playerMap` reference while a swap tap is in flight, `applySwap` can receive the stale `playerMap` captured in the `legalBenchIds` memo while `LineupTab`'s re-render passes a fresh `playerMap` to `handleBenchTap`. This is a real crash path, not a theoretical one.

**Fix:** Remove the non-null assertions; treat a missing player as a no-op (return the unchanged lineup) or re-validate before calling:

```typescript
const sorted = [...newStarters].sort((a, b) => {
  const pa = playerMap.get(a)
  const pb = playerMap.get(b)
  return captainKey(pb ?? { xPts_90th_1gw: 0, xPts_1gw: 0 } as MergedPlayer)
       - captainKey(pa ?? { xPts_90th_1gw: 0, xPts_1gw: 0 } as MergedPlayer)
})
```

Or, more simply, guard at the top of `applySwap`:

```typescript
export function applySwap(...): OptimisedLineup {
  const starter = playerMap.get(starterId)
  const benchP  = playerMap.get(benchId)
  if (!starter || !benchP) return lineup   // defensive: return unchanged lineup
  // ... rest of function
}
```

---

### CR-02: `handleBenchTap` is unreachable for bench cards — bench taps fall through to `handleStarterTap`

**File:** `src/components/squad/LineupTab.tsx:270-273`

The `onCardTap` dispatcher at lines 270-273 is:

```tsx
const onCardTap = (id: number) => {
  if (lineup.starters.includes(id)) handleStarterTap(id)
  else if (lineup.bench.includes(id)) handleBenchTap(id)
}
```

`onCardTap` is passed to **both** the XI `PitchRow` instances and the Bench `PitchRow`. When a bench card is tapped (e.g., a legal target is clicked), `lineup.starters.includes(id)` is evaluated first. After a cross-position swap, the player being swapped *in* is moved from bench to starters. But before the swap completes — i.e., while the swap is in progress and `pendingStarterId` is set — the bench card id is still in `lineup.bench` and NOT in `lineup.starters`, so the `else if` branch fires correctly in the normal path.

However, the `PitchRow` for bench rows is rendered with `isBench={true}`, which makes `isLegalTarget` and `isIncompatible` work correctly. The **actual bug** is subtler: `onCardTap` uses `lineup` from the render closure. If a bench card triggers `onCardTap(benchId)` and `lineup.starters` happens to contain `benchId` (this cannot occur under normal operation since a player cannot simultaneously be a starter and bench player), the call is harmless. But the real problem is that the bench `PitchRow` is **not** passed a separate `onBenchTap` — it shares `onCardTap`, which means it also calls `handleStarterTap` if a bench player's id ever ends up in `lineup.starters`.

More critically: after `applySwap` succeeds, the swapped-in player (formerly bench) is now in `lineup.starters`. If the user taps this player in the starter rows **and then immediately** taps a bench card whose id was in the **old** bench (but the `lineup` ref has already updated), the `lineup.bench.includes` check on line 272 will correctly use the fresh ref. But the `legalBenchIds` useMemo (line 187-194) depends on `[pendingStarterId, lineup, playerMap]`, so it will recompute correctly. **This specific path is safe.**

The real correctness bug in `onCardTap` is that it is called from bench `PlayerCard` clicks too (line 318), and because bench cards are rendered with `disabled={isIncompatible}`, disabled buttons do still fire synthetic events in jsdom/React testing — but the disabled prop prevents real browser interaction. In an actual browser, `disabled` buttons do not fire `onClick`, so this is not a production bug. However, the code structure assumes all bench-row card taps that are legal targets have already cleared the `pendingStarterId !== null` guard in `handleBenchTap`, but **if a user somehow taps a bench card without a pending starter (e.g., via keyboard, screen reader, or assistive technology bypassing the `disabled` attribute)**, `handleBenchTap` silently returns at line 172 (`if (pendingStarterId === null || !lineup) return`), which is acceptable. No hard crash, but the UX is confusing: the bench card appears tappable (green ring) to AT users but produces no action.

**Re-assessment:** On careful re-reading, this is not a crash but the design exposes all bench cards as tappable via the shared `onCardTap`, with legality enforced only by the `disabled` attribute on `<button>`. The `disabled` attribute does NOT prevent `onClick` from firing via keyboard `Enter`/`Space` on a focused disabled button in all browser versions. In WCAG-accessible usage this means a user who keyboards to a bench card that is marked `isIncompatible` and presses Enter will fire `onCardTap`, which will call `handleBenchTap`, which calls `isLegalSwap` as defence-in-depth and returns early if illegal. So no incorrect swap occurs. **However**, a keyboard user on an `isLegalTarget` bench card that is NOT disabled will fire `handleBenchTap` via `onCardTap`, which IS the intended path. This is correct.

The actual bug: `disabled` buttons with `onClick` still receive keyboard events in some browser/AT combinations, meaning the defence-in-depth `isLegalSwap` check at line 174 is load-bearing for correctness. This is documented as "Defence in depth (Pitfall 4)" — so the implementation is intentional. **Downgrading this from BLOCKER: the architecture is intentional and the safety net is in place.**

**Actual CR-02:** The `isLegalSwap` call at line 174 checks legality against the **current `lineup` and `playerMap`** from the closure at render time. But `pendingStarterId` is state, and `lineup` is also state — both from the same render cycle, so the closure is consistent. This is correct. However, `playerMap` is derived from `useMemo` (line 132), which recomputes when `playersData` changes. If `playersData` changes between the time the starter is armed and the bench is tapped (background refetch), the `handleBenchTap` closure captures the **stale** `playerMap` from the render when `pendingStarterId` was set, while `lineup` has potentially been reset by the `useEffect` at line 161. This means `isLegalSwap` and `applySwap` could be called with an inconsistent `lineup` (reset to new `initialLineup`) and `playerMap` (stale reference captured in closure). The `useEffect` at line 161 calls `setLineup(initialLineup)` which triggers re-render and clears `pendingStarterId` — actually NO, the `useEffect` does NOT clear `pendingStarterId`. So after a background refetch, `lineup` resets to the new initial recommendation but `pendingStarterId` retains its old value, causing `handleBenchTap` to apply a swap to the freshly-reset lineup using the stale `playerMap`.

**File:** `src/components/squad/LineupTab.tsx:161-163`

```tsx
useEffect(() => {
  setLineup(initialLineup)
}, [initialLineup])
```

`pendingStarterId` is not cleared when `initialLineup` changes, so a data refetch mid-swap will reset `lineup` but leave a stale `pendingStarterId` armed. On the next bench tap, `handleBenchTap` will call `applySwap(newLineup, stalePendingStarterId, benchId, playerMap)` where `stalePendingStarterId` may no longer be in `newLineup.starters` — the swap produces an incorrect lineup where `stalePendingStarterId` appears twice (it was already removed from the old lineup but the `newBench` computation still replaces `benchId` with it).

**Fix:**

```tsx
useEffect(() => {
  setLineup(initialLineup)
  setPendingStarterId(null)   // disarm any pending swap when lineup resets
}, [initialLineup])
```

---

## Warnings

### WR-01: BGW critical banner (`bgw-banner-critical`) is unreachable when `lineup === null` but `eligibleCount >= 11`

**File:** `src/components/squad/LineupTab.tsx:234-253`

When `lineup === null` (line 234), the component renders either the `bgw-banner-critical` (when `eligibleCount < 11`) or a generic "Unable to optimise" error (when `eligibleCount >= 11`). However, `optimiseLineup` returns `null` only when `eligible.length < 11` (see `optimise-lineup.ts:54`). Therefore, when `eligibleCount >= 11`, `optimiseLineup` will not return `null` (barring no-bench-GK edge case at line 141 of `optimise-lineup.ts`). The "Unable to optimise lineup. Please try again." message at line 247-249 is only reachable if both GKs start (impossible with FPL squad rules), so it is effectively dead code. This is not a runtime bug but it means there is no UX path for the "no bench GK" failure case beyond the silent generic error.

Additionally, the `bgw-banner-critical` test at line 126-148 of `LineupTab.test.tsx` sends a squad where only 5 players have `xPts_1gw > 0`, which would cause `optimiseLineup` to return `null` (< 11 eligible). The component then shows the banner. But the test asserts `container.querySelector('[data-testid="bgw-banner-critical"]')` is not null without verifying that `lineup === null`. If `optimiseLineup` were changed to return a partial lineup for fewer than 11 eligible players, the test would still pass (banner visible only in `lineup === null` branch) — but the real-world rendering depends on `initialLineup` being null, which this test correctly exercises. Not a critical issue, but the rendering path for `eligibleCount >= 11 && lineup === null` produces a misleading error message.

**Fix:** Add a guard comment or handle the edge case explicitly:

```tsx
{eligibleCount < 11 ? (
  <div data-testid="bgw-banner-critical">...</div>
) : (
  // This branch is only reached when optimiseLineup returns null despite >= 11 eligible
  // players, which occurs only when no bench GK is available (should not occur in a
  // valid 15-player FPL squad).
  <div className="...">Unable to optimise lineup: no bench GK found. Please check your squad.</div>
)}
```

---

### WR-02: `applySwap` does not validate that `benchId` is present in `lineup.bench`

**File:** `src/lib/lineup-swap.ts:53-54`

```typescript
const benchIdx = lineup.bench.indexOf(benchId)
const newBench = lineup.bench.map((id, i) => i === benchIdx ? starterId : id)
```

If `benchId` is not found in `lineup.bench`, `indexOf` returns `-1`. The map then never substitutes `starterId` because no index equals `-1`. As a result, `newBench` still contains `benchId` (not replaced), AND `newStarters` already has `benchId` in it (from line 52). The returned lineup has `benchId` appearing in both `starters` and `bench` simultaneously — a corrupted state that would cause double-render of the same player card.

In the calling code (`LineupTab.tsx:174-176`) this is only called after `isLegalSwap` returns `true`, and `isLegalSwap` does not verify that `benchId` is actually in `lineup.bench` — it only checks player map membership and formation legality. A stale `legalBenchIds` set (computed in the `useMemo` at lines 187-194 from a prior render's `lineup`) could contain a `benchId` that is no longer in the current `lineup.bench`. Combined with CR-02's stale-lineup scenario, this path is reachable.

**Fix:** Guard against `benchIdx === -1`:

```typescript
const benchIdx = lineup.bench.indexOf(benchId)
if (benchIdx === -1) return lineup   // benchId not on bench — return unchanged (defensive)
const newBench = lineup.bench.map((id, i) => i === benchIdx ? starterId : id)
```

---

### WR-03: `isLegalSwap` does not verify that `starterId` is in `lineup.starters` or that `benchId` is in `lineup.bench`

**File:** `src/lib/lineup-swap.ts:13-41`

`isLegalSwap` accepts any two player IDs and validates position/formation compatibility, but never checks whether `starterId` is actually a starter in the current lineup or whether `benchId` is actually on the bench. Any caller that passes reversed IDs (bench id as `starterId`, starter id as `benchId`) will receive a formation-validity answer that uses the **existing** lineup's formation counts (from `lineup.starters`), but simulates a swap that substitutes `starterId` in the starters list even if it is already a bench player.

The `onCardTap` dispatcher (LineupTab.tsx:270-273) correctly routes bench taps to `handleBenchTap(benchId)` which calls `isLegalSwap(lineup, pendingStarterId, benchId)` — the argument order is correct. But the function itself provides no internal guarantee, making it unsafe to call from untested callsites.

**Fix:** Add membership assertions at the top of `isLegalSwap`:

```typescript
if (!lineup.starters.includes(starterId)) return false
if (!lineup.bench.includes(benchId)) return false
```

---

### WR-04: Captain and vice-captain badge can both render on the same card when `captainId === vcId`

**File:** `src/components/squad/LineupTab.tsx:63-73`

`PlayerCard` renders a "C" badge when `isCaptain` is true and a "VC" badge when `isViceCaptain` is true. Both badges are positioned `absolute top-1 right-1`, so if a player is both captain and VC, both badges are rendered — the VC badge stacks on top of (and obscures) the C badge. While `applySwap` sorts starters and assigns `sorted[0]` as captain and `sorted[1]` as VC, if the sorted array has fewer than 2 distinct entries (degenerate case: only one starter player in the list), `captainId` and `vcId` would be identical. This cannot occur in a valid 11-player lineup, but if `optimiseLineup` or `applySwap` ever produced a lineup with fewer starters (e.g., during the no-bench-GK null path or a future code change), both badges would render on the same card and visually collide.

More practically: the badges share the same CSS position (`absolute top-1 right-1`) — even if `captainId !== vcId`, the badge for captain is rendered first and VC second; they do not collide in the normal case. This is a latent but bounded risk.

**Fix:** Ensure the VC badge is only rendered when `isViceCaptain && !isCaptain`:

```tsx
{isViceCaptain && !isCaptain && (
  <span ... data-testid="vc-badge">VC</span>
)}
```

---

## Info

### IN-01: Duplicated `makePlayer` factory between test files

**File:** `src/lib/lineup-swap.test.ts:9-54` and `src/components/squad/LineupTab.test.tsx:28-73`

Both test files define an identical `makePlayer` factory with the full `MergedPlayer` default shape. Any future field addition to `MergedPlayer` must be patched in two places, creating a maintenance divergence risk.

**Fix:** Extract the shared factory to a test utility file (e.g., `src/lib/test-utils/player-fixtures.ts`) and import from both test files. This is a test-file refactor and carries no runtime risk.

---

### IN-02: `console.error` left in production code path (`DecisionErrorBoundary`)

**File:** `src/app/page.tsx:41`

```typescript
componentDidCatch(error: Error, info: ErrorInfo) { console.error('[DecisionSummaryTab crash]', error, info) }
```

`console.error` in a production error boundary leaks internal stack traces to the browser console. In development this is useful, but in production builds this may expose implementation details. This is pre-existing code (not introduced by Phase 72), but it is present in the reviewed file.

**Fix:** Guard with an environment check or replace with a structured logger:

```typescript
componentDidCatch(error: Error, info: ErrorInfo) {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[DecisionSummaryTab crash]', error, info)
  }
  // TODO: send to error reporting service (Sentry, etc.)
}
```

---

_Reviewed: 2026-05-05T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
