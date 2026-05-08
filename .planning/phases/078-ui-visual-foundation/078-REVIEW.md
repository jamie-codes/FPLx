---
phase: 078-ui-visual-foundation
reviewed: 2026-05-08T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/app/globals.css
  - src/app/page.tsx
  - src/components/LastUpdated.tsx
  - src/components/LastUpdated.test.tsx
  - src/components/nav/MobileNav.tsx
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 078: Code Review Report

**Reviewed:** 2026-05-08T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Five files were reviewed: the global CSS token file, the root page component, the `LastUpdated` connected component and its display variant, its test suite, and `MobileNav`. The visual foundation work (design tokens, dark-mode variants, sticky nav, mobile nav) is structurally sound. No security vulnerabilities or data-loss risks were found.

Four warnings were identified: a blank-flash on first render in `LastUpdated`, a misleading test description that advances 60 s instead of the described 30 s, a tab-routing guard inconsistency that leaves `planner`-section sub-tabs renderable under the `analyse` section, and missing `overflow-x: auto` on the mobile sub-tab row (which clips content without scrolling). Three info items cover a persistent `console.error` in an error boundary, an unreachable `subTabs.length === 0` guard, and a hardcoded placeholder comment that should reference a tracking issue.

---

## Warnings

### WR-01: Blank relativeTime flash on first render when data arrives asynchronously

**File:** `src/components/LastUpdated.tsx:30-44`

**Issue:** `useState` initialiser runs once at component mount time. When `useLastUpdated` returns `data: undefined` on first render (cache miss, network in-flight), the state is set to `''`. When data subsequently arrives, React re-renders — the guard `if (!data) return null` fires on the outer component and correctly suppresses rendering. However, when the hook is seeded from a warm TanStack Query cache and `data` is non-null on the very first render, the `useState` lazy initialiser correctly computes the formatted string. The **real** flash case is the transition: `data` becomes defined mid-render cycle after a cache miss, but `relativeTime` is still `''` from the initial mount. Between the cache-miss render (hidden, returns null) and the first effect fire that calls `setRelativeTime`, there is a synchronous window where `data` is defined but `relativeTime` is `''`. On that transient render the component renders `<LastUpdatedDisplay relativeTime="" stale={...} />` — displaying "Updated " with no time string.

This is confirmed by the test at line 94-102 which only guards against an empty `<span>` by checking `if (span)`, rather than asserting the label is always non-empty when data is present. The fix is to compute the displayed value inline from `data` rather than storing it in a separate state variable that lags by one render:

```tsx
export function LastUpdated() {
  const { data } = useLastUpdated()
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!data?.last_updated) return
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [data?.last_updated])

  if (!data) return null
  const relativeTime = formatRelativeTime(data.last_updated)
  return <LastUpdatedDisplay relativeTime={relativeTime} stale={data.stale} />
}
```

The `tick` state is incremented every 30 s solely to trigger a re-render; `formatRelativeTime` is then called inline so it always reflects the current time with no intermediate blank state.

---

### WR-02: Test description claims 30-second advance but advances 60 seconds

**File:** `src/components/LastUpdated.test.tsx:104-117`

**Issue:** The test is titled "re-formats label after 30 seconds elapse crossing a band boundary" but the body calls `vi.advanceTimersByTime(60_000)` (60 000 ms = 60 s). The 30-second interval fires at exactly 30 s; the test should only need to advance 30 s to trigger it. Advancing 60 s happens to work because two ticks fire and the second one also satisfies the assertion, but it does not actually verify that the 30-second interval fires at the correct frequency. A future change that increases the interval to 60 s would not be caught by this test.

```ts
// Fix: advance only 30 s to precisely exercise the interval boundary
act(() => {
  vi.setSystemTime(NOW + 60_000)   // wall-clock is still correct (59→60 min)
  vi.advanceTimersByTime(30_000)   // advance exactly one interval tick
})
```

---

### WR-03: Tab-routing guard uses `activeSection !== 'squad'` — allows `analyse`-only tabs to render under `plan` section

**File:** `src/app/page.tsx:261-277`

**Issue:** Tabs such as `gems`, `defcon`, `set-pieces`, `insights`, `accuracy`, `price-changes`, `fixture-heat-map`, and `value-gems` are guarded only with `activeSection !== 'squad'`. Looking at `SECTIONS`, these sub-tabs belong exclusively to the `analyse` section — they do not appear in the `plan` section's `subTabs` list. Because `sectionMemory` is per-section, `activeSubTab` under `plan` will never be any of these values during normal navigation. However, if external code or a future refactor sets `sectionMemory.plan` to `'gems'` (e.g. via a deep-link, URL state, or test), `GemTable` would render under the `plan` section without the plan-specific horizon controls, in an unexpected UI state.

The guard should be tightened to `activeSection === 'analyse'` for tabs that are exclusive to `analyse`:

```tsx
{activeSection === 'analyse' && activeSubTab === 'gems' && (
  <GemTable ... />
)}
// repeat pattern for defcon, set-pieces, insights, accuracy,
// price-changes, fixture-heat-map, value-gems
```

---

### WR-04: Mobile sub-tab row can clip without scrolling on narrow viewports with many tabs

**File:** `src/components/nav/MobileNav.tsx:22`

**Issue:** The sub-tab container uses `flex gap-2 px-4 py-2` with no `overflow-x: auto`. The `plan` section has 7 sub-tabs and the `analyse` section has 7. On narrow phones (320 px–375 px), the buttons will be clipped by the fixed-width container with no way to scroll to hidden tabs. The desktop nav uses `overflow-x-hidden` only on `html/body`; the mobile nav does not add a scroll container.

```tsx
// Fix: add overflow-x-auto to the sub-tab row div
<div className="flex gap-2 px-4 py-2 border-b border-border overflow-x-auto">
```

The mobile horizon selector in `page.tsx` at line 226 already applies `overflow-x-auto` as a precedent for this same class of problem.

---

## Info

### IN-01: `console.error` in production error boundary

**File:** `src/app/page.tsx:51`

**Issue:** `componentDidCatch` calls `console.error(...)` which emits to the browser console in production. This is acceptable for an error boundary (React itself also calls `console.error` for unhandled errors), but the log message `[DecisionSummaryTab crash]` should ideally be routed to a structured error-reporting service rather than `console.error` alone. Flag for future monitoring integration.

---

### IN-02: Unreachable `subTabs.length === 0` guard in `MobileNav`

**File:** `src/components/nav/MobileNav.tsx:20`

**Issue:** `if (!activeSectionDef.subTabs.length) return null` — all three sections in `SECTIONS` have at least five sub-tabs, so this branch is never reached. As a guard for a truly dynamic sections array it would be correct, but given the static `SECTIONS` constant the branch is dead code. Either document why it is kept as a defensive guard, or remove it to reduce noise.

---

### IN-03: `SETTLED_GWS_PLACEHOLDER` magic numbers should reference a tracking issue

**File:** `src/app/page.tsx:43`

**Issue:** The comment at line 37-43 explains the placeholder and defers a `useSettledGws` hook "out of scope for Phase 73". Phase 73 is complete; this deferred work now has no clear ownership. The comment should reference a backlog issue or next-phase ticket so it does not silently bitrot.

---

_Reviewed: 2026-05-08T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
