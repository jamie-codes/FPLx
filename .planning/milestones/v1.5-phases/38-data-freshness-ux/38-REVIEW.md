---
phase: 38-data-freshness-ux
reviewed: 2026-04-29T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/lib/formatRelativeTime.ts
  - src/lib/formatRelativeTime.test.ts
  - src/components/LastUpdated.tsx
  - src/components/LastUpdated.test.tsx
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 38: Code Review Report

**Reviewed:** 2026-04-29T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Four files were reviewed: the `formatRelativeTime` pure utility, its unit tests, the `LastUpdated` connected component, and its component tests. The logic for time-band formatting is correct and well-tested at the happy path. Two structural bugs were found: one causing an empty-string flash on first render of `LastUpdated`, and one causing silent `"NaN day ago"` output from `formatRelativeTime` when given an invalid timestamp string. Two test coverage gaps accompany these bugs.

---

## Warnings

### WR-01: `LastUpdated` renders an empty `<p>` on first paint when data is already cached

**File:** `src/components/LastUpdated.tsx:22-34`

**Issue:** `relativeTime` is initialized to `''` (empty string). `useEffect` runs *after* the first render. When React Query has data in cache (the common case after the first load), `data` is non-null immediately, so the early `if (!data) return null` guard at line 33 does not fire. The component renders `<LastUpdatedDisplay relativeTime="" stale={...} />` for one render cycle — producing an empty but visible `<p>` element. This is a real UX artifact: layout space is claimed with no text, then the label snaps in.

**Fix:** Compute the initial formatted label eagerly so the first render is never blank:

```tsx
export function LastUpdated() {
  const { data } = useLastUpdated()
  const [relativeTime, setRelativeTime] = useState<string>(
    () => (data?.last_updated ? formatRelativeTime(data.last_updated) : '')
  )

  useEffect(() => {
    if (!data?.last_updated) return
    setRelativeTime(formatRelativeTime(data.last_updated))
    const id = setInterval(() => {
      setRelativeTime(formatRelativeTime(data.last_updated))
    }, 30_000)
    return () => clearInterval(id)
  }, [data?.last_updated])

  if (!data) return null
  return <LastUpdatedDisplay relativeTime={relativeTime} stale={data.stale} />
}
```

Alternatively, derive `relativeTime` via `useMemo` and drop the state/effect pattern entirely, since the only consumer of the interval is to keep the displayed label fresh against wall-clock drift — a pattern that could be handled by a shared ticker context.

---

### WR-02: `formatRelativeTime` silently produces `"NaN day ago"` for invalid input

**File:** `src/lib/formatRelativeTime.ts:15-22`

**Issue:** `new Date("not-a-date").getTime()` returns `NaN`. Every subsequent arithmetic operation propagates `NaN`. All comparisons (`NaN < 1`, `NaN < 60`, `NaN < 48`) evaluate to `false`, so control falls through to the final `return` on line 22, yielding the string `"NaN day ago"` (or `"NaN days ago"` — the pluralisation check `diffDays === 1` is also `false` for `NaN`). This string is rendered to the DOM without error.

The hook (`useLastUpdated`) types `last_updated` as `string`, which doesn't constrain format. If the API ever returns malformed data or a null-coerced empty string, the bug surfaces silently.

**Fix:** Add an explicit guard at the top of the function:

```ts
export function formatRelativeTime(isoTimestamp: string, nowMs: number = Date.now()): string {
  const ts = new Date(isoTimestamp).getTime()
  if (isNaN(ts)) return 'unknown'           // guard for invalid input
  const diffMs = nowMs - ts
  // ... rest unchanged
}
```

---

### WR-03: `LastUpdated` connected-component tests do not cover the first-paint blank-state scenario

**File:** `src/components/LastUpdated.test.tsx:77-83`

**Issue:** The test "renders formatted relative time on first paint" (line 77) passes because fake timers are active and `useEffect` runs synchronously within the `render` call under `vi.useFakeTimers()` in some configurations — but this is implementation-dependent and environment-specific. The test does not explicitly assert that no blank `<p>` is visible *before* the effect fires, so the WR-01 flash is not caught by the test suite. If the test environment's React scheduler runs effects asynchronously, the test may still pass while the bug exists in production.

**Fix:** Add a test that verifies the rendered output *before* any effects flush, or assert that a non-empty string is present immediately after render without wrapping in `act`:

```tsx
it('does not render a blank label on first paint when data is cached', () => {
  mockedUseLastUpdated.mockReturnValue({
    data: { last_updated: isoMinutesBefore(60), stale: false },
  } as any)
  const { container } = render(<LastUpdated />)
  const p = container.querySelector('p')
  // p should be null (not rendered) or have non-empty text — never an empty <p>
  if (p) expect(p.textContent).not.toBe('')
})
```

---

## Info

### IN-01: No test coverage for invalid/non-ISO input to `formatRelativeTime`

**File:** `src/lib/formatRelativeTime.test.ts`

**Issue:** The test suite covers all happy-path time bands and the default-`nowMs` behaviour, but there is no test for malformed input (e.g. `formatRelativeTime("not-a-date", NOW)`). This leaves the `"NaN day ago"` bug described in WR-02 undetected by tests.

**Fix:** Add a case to the existing `describe` block:

```ts
it("returns 'unknown' for a non-ISO string input", () => {
  expect(formatRelativeTime('not-a-date', NOW)).toBe('unknown')
})
```

---

### IN-02: Spec comment on hour band boundary is imprecise

**File:** `src/lib/formatRelativeTime.ts:8`

**Issue:** The JSDoc comment states `1-47 hr -> "X hour ago"` but the actual boundary is `diffHours < 48`, meaning 47 hours and any fractional minutes (up to 47h 59m 59s) still render as hours. The boundary is correct per the test expectations (line 42-44 tests `47 * 3_600_000`), but the comment misleads readers about where the threshold is.

**Fix:** Update the comment to match the code:

```
 *   1–47h 59m  -> "X hour ago" / "X hours ago"  (i.e. diffHours < 48)
 *   48h+       -> "X day ago"  / "X days ago"
```

---

_Reviewed: 2026-04-29T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
