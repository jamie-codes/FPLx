---
phase: 132-deadline-day-banner
reviewed: 2026-05-22T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/lib/hooks/useNextDeadline.ts
  - src/lib/hooks/useNextDeadline.test.ts
  - src/components/DeadlineBanner.tsx
  - src/components/DeadlineBanner.test.tsx
  - src/app/page.tsx
  - src/app/page.test.tsx
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 132: Code Review Report

**Reviewed:** 2026-05-22T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

The implementation covers the `useNextDeadline` hook, the `DeadlineBanner` component with 3-state urgency and dismiss logic, and the integration into `page.tsx`. The hook and adapter plumbing are solid. The primary issues are two distinct state initialisation bugs in `DeadlineBanner` that cause incorrect renders on the load cycle (a real-world flash), one display bug for sub-minute countdowns, and two test-isolation gaps in `page.test.tsx`.

---

## Warnings

### WR-01: `dismissed` state lazy initialiser is always `false` on first render in production

**File:** `src/components/DeadlineBanner.tsx:58-65`

**Issue:** The `useState` lazy initialiser for `dismissed` captures `id` from the enclosing render scope. In production, `useNextDeadline()` returns `data: undefined` on the first render (React Query is still loading), so `id` is `null` and the initialiser unconditionally returns `false` — it never reads `localStorage`. The `useEffect` on line 68-78 then fires after mount and sets `dismissed = true` if the key exists. This creates a brief render where the banner appears visible before being immediately hidden — a flash of incorrect content for previously-dismissed banners.

The test suite masks this because the mock returns data synchronously, so `id` is already populated when the initialiser runs.

**Fix:** Remove the lazy initialiser logic and rely solely on the `useEffect` for dismissed state. Initialise `dismissed` to `false` unconditionally, which is already the fallback:

```tsx
const [dismissed, setDismissed] = useState<boolean>(false)

// The existing useEffect on [id] already handles the correct read:
useEffect(() => {
  if (id === null) {
    setDismissed(false)
    return
  }
  try {
    setDismissed(localStorage.getItem(`deadline-dismissed:GW${id}`) !== null)
  } catch {
    setDismissed(false)
  }
}, [id])
```

---

### WR-02: `msRemaining` stays `0` for one render cycle after data loads — banner is briefly hidden

**File:** `src/components/DeadlineBanner.tsx:81-83`

**Issue:** The `useState` lazy initialiser for `msRemaining` runs at mount time when `data` is still `undefined`. `invalidDeadline` is `true` so `msRemaining` initialises to `0`. When data arrives on the next render, `deadlineTime` changes from `null` to a valid string. At this point:

1. `msRemaining` is still `0` (lazy initialisers do not re-run).
2. The render gate `if (msRemaining <= 0) return null` fires — banner is hidden.
3. The countdown `useEffect` (depending on `[deadlineTime]`) then runs `tick()` → `setMsRemaining(actual)`.
4. A third render shows the banner.

Result: the banner is incorrectly hidden for exactly one render cycle every time the data first loads. Under normal React batching this is imperceptible, but under slow renders or React Strict Mode's double-invoke it can produce visible flashes.

**Fix:** Compute the live countdown inline without storing it in state, or ensure the initialiser derives from the actual deadline when available. The simplest correct approach: compute `msRemaining` directly in the render body (not as state) and keep state only for the tick trigger:

```tsx
// Replace the msRemaining useState with a tick counter:
const [, setTick] = useState(0)

useEffect(() => {
  if (!deadlineTime) return
  const intervalId = setInterval(() => setTick(n => n + 1), TICK_MS)
  return () => clearInterval(intervalId)
}, [deadlineTime])

// Compute msRemaining inline on every render — always correct:
const msRemaining = deadlineTime
  ? new Date(deadlineTime).getTime() - Date.now()
  : 0
```

This eliminates both the stale initialisation and the separate `tick()` call on effect start.

---

### WR-03: `formatCountdown` displays `"0m"` when between 1 and 59 seconds remain

**File:** `src/components/DeadlineBanner.tsx:37-42`

**Issue:** `Math.floor(msRemaining / 60_000)` truncates any sub-minute duration to `0`, so when `msRemaining` is e.g. `30_000` (30 seconds), the banner reads `"GW32 deadline in 0m"` rather than `"<1m"` or `"1m"`. The tick interval is 60 seconds (`TICK_MS = 60_000`), so this incorrect label is visible for up to the last full tick cycle — as long as 59 seconds of display time before the render gate hides the banner.

**Fix:** Clamp the minute display to a minimum of 1 when there is any time remaining, or use a `<1m` label:

```ts
export function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return '0m'           // defensive; render gate should prevent this
  const totalMinutes = Math.max(1, Math.floor(msRemaining / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours === 0 ? `${minutes}m` : `${hours}h ${minutes}m`
}
```

---

## Info

### IN-01: `page.test.tsx` missing mock for `@/lib/hooks/useWatchlist`

**File:** `src/app/page.test.tsx:1-88`

**Issue:** `page.tsx` calls `useWatchlist()` unconditionally at the top level. The test file mocks `@/components/DeadlineBanner`, `@/lib/hooks/useSettledGws`, and every rendered component, but does not mock `useWatchlist`. The real hook runs — it reads `localStorage` during initialisation. This is harmless in jsdom but is an unmocked side-effect in the test environment. If a future test sets `fplx_watchlist` in localStorage it could leak state across tests.

**Fix:** Add a mock alongside the other hook mocks:

```ts
vi.mock('@/lib/hooks/useWatchlist', () => ({
  useWatchlist: () => ({ watchlistIds: [], toggleWatchlist: vi.fn() }),
}))
```

---

### IN-02: Redundant `data === undefined` check in render gates

**File:** `src/components/DeadlineBanner.tsx:98-99`

**Issue:** Line 98 checks `data === null || data === undefined`, and line 99 immediately checks `if (id === null)`. Since `id` is derived as `data?.id ?? null`, when `data` is `null` or `undefined`, `id` is already `null`. The `data === undefined` branch on line 98 is unreachable — control never passes through it to line 99. The `data === null` case is the only meaningful check on line 98.

This is dead code; it does not affect correctness but obscures intent.

**Fix:** Collapse the two guards into one, or document the distinction:

```tsx
// data === undefined  → loading (id is null → caught by line 99)
// data === null       → off-season (no next GW)
if (data === null) return null
if (id === null) return null   // belt-and-suspenders for undefined
```

---

_Reviewed: 2026-05-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
