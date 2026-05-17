---
phase: 115-team-news-wiring-v1-21
reviewed: 2026-05-17T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/components/news/NewsBanner.tsx
  - src/components/news/NewsBanner.test.tsx
  - src/components/captaincy/CaptainPicksPanel.tsx
  - src/components/captaincy/CaptainPicksPanel.test.tsx
  - src/components/transfers/OpportunityCostTable.test.tsx
findings:
  critical: 1
  warning: 3
  info: 1
  total: 5
findings_resolved:
  critical: 1
  warning: 3
status: clean
---

# Phase 115: Code Review Report

**Reviewed:** 2026-05-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

The phase wires `NewsBanner` into `CaptainPicksPanel` (NEWS-02) and verifies staleness suppression in `OpportunityCostTable` (NEWS-03). The staleness gate logic itself is correct in production code. However, one critical test-data defect means the fresh-zinc staleness test in `NewsBanner.test.tsx` exercises the wrong code path — `FRESH_NEWS_ADDED` is set to a date *after* `STALE_NOW`, producing a negative delta that renders as "not stale" for the wrong reason (negative overflow, not the positive-delta "< 14 days" path). Two further logic gaps exist in `NewsBanner.tsx` and `OpportunityCostTable.test.tsx`, and a type mismatch lurks in the test fixture for `makeScoredPlayer`.

---

## Critical Issues

### CR-01: "Fresh" staleness test fixture uses a future date — exercises wrong code path

**File:** `src/components/news/NewsBanner.test.tsx:70`

**Issue:** `FRESH_NEWS_ADDED` is set to `'2026-01-15T00:00:00Z'`, which is *14 days after* `STALE_NOW` (`2026-01-01T00:00:00Z`). The comment correctly notes "delta negative", but this is the problem: `Date.now() - new Date(FRESH_NEWS_ADDED).getTime()` produces a negative number (approximately −1,209,600,000 ms). The `isStale` predicate checks `> 14 * 24 * 60 * 60 * 1000` (a large positive), so a negative value trivially fails the condition and returns `false` — not because the news is less than 14 days old, but because the news is in the *future* relative to the mocked clock.

The test passes, but it does not actually verify that `isStale` correctly handles a legitimately fresh timestamp (e.g., 1 day old). A correctly written fresh date should be *before* `STALE_NOW` by fewer than 14 days — for example `'2025-12-31T00:00:00Z'` (1 day old) or `'2025-12-19T00:00:00Z'` (13 days old). As written, the test gives no coverage of the actual boundary: it would pass even if the predicate were `> 0` instead of `> 14 * 24 * 60 * 60 * 1000`.

**Fix:**
```typescript
// In NewsBanner.test.tsx, replace:
const FRESH_NEWS_ADDED = '2026-01-15T00:00:00Z'  // after mocked now → delta negative → not stale

// With a legitimately fresh date (13 days before mocked now):
const FRESH_NEWS_ADDED = '2025-12-19T00:00:00Z'  // 13 days before mocked now → fresh → renders
```
The comment should also be updated: `// 13 days before mocked now → delta +13d < 14d threshold → not stale`.

---

## Warnings

### WR-01: `isStale` function defined inside render — recreated on every render

**File:** `src/components/news/NewsBanner.tsx:36-37`

**Issue:** The `isStale` helper is defined as an arrow function *inside* the component body, below the early-return guards. This means a new function object is allocated on every render that reaches that point. While React will not cause correctness issues here (there is no memoisation dependency on it), it is an unnecessary allocation and an unusual pattern — functions that do not close over any state or props should be module-level utilities, matching the pattern used by `computeNewsSeverity`.

More importantly, defining a named function inside a render body after conditional returns can mislead future developers about its scope and lifecycle.

**Fix:**
```typescript
// Move isStale to module scope (above the component), alongside SEVERITY_CLASS:
const isStale = (newsAdded?: string): boolean =>
  newsAdded ? Date.now() - new Date(newsAdded).getTime() > 14 * 24 * 60 * 60 * 1000 : false

export function NewsBanner({ news, news_added, chance_of_playing_next_round }: NewsBannerProps) {
  const enabled = useNewsFlagEnabled()
  if (!enabled || !news || news.trim().length === 0) return null
  const severity = computeNewsSeverity(chance_of_playing_next_round, news)
  if (severity === 'zinc' && isStale(news_added)) return null
  if (severity === 'none') return null
  // ...
}
```

### WR-02: `news_added: null` in `makeScoredPlayer` fixture is a type mismatch

**File:** `src/components/transfers/OpportunityCostTable.test.tsx:72`

**Issue:** `makeScoredPlayer` sets `news_added: null`. The `MergedPlayer` (and its supertype `FPLElement`) declare `news_added?: string` — the field is optional but, when present, must be a `string`, not `null`. Passing `null` is only masked by the `as unknown as ScoredPlayer` cast on line 89. 

When `t.buy.news_added` (of type `string | null`) reaches `NewsBanner`'s `news_added` prop (typed `string | undefined`), TypeScript allows it because the cast hides the mismatch — but at runtime, `new Date(null)` produces `new Date(0)` (Unix epoch), not the expected "no value" semantics. This means if `news_added: null` were ever passed to `isStale`, the staleness check would compute `Date.now() - 0 > threshold`, which is almost always `true` — incorrectly treating a null `news_added` as a 55-year-old timestamp. The `NewsBanner` implementation guards against this via `if (!enabled || !news ...)` before reaching `isStale`, but the type mismatch silently passes an unintended sentinel through the interface.

**Fix:**
```typescript
// In makeScoredPlayer, use undefined instead of null:
news: '',
news_added: undefined,   // matches news_added?: string
```
And remove the `as unknown as ScoredPlayer` cast where possible, or narrow it to `as ScoredPlayer` to let TypeScript catch future type mismatches.

### WR-03: `CaptainPicksPanel.test.tsx` does not reset `useNewsFlagEnabled` between describe blocks

**File:** `src/components/captaincy/CaptainPicksPanel.test.tsx:80-85`

**Issue:** The `beforeEach` at module scope (lines 80–85) sets up all the primary mocks but does NOT set a return value for `useNewsFlagEnabled`, which is mocked at line 13. The Phase 115 NEWS-02 describe block sets `vi.mocked(useNewsFlagEnabled).mockReturnValue(true)` in its own `beforeEach` (line 395–397), and uses `afterEach(() => vi.restoreAllMocks())` (line 398) to restore spies. However, `vi.restoreAllMocks()` restores spy implementations but does NOT reset mock return values set with `mockReturnValue` — only `vi.resetAllMocks()` or `vi.clearAllMocks()` does that.

This means if tests within the NEWS-02 describe block run before the Phase 57 or Phase 62 describe blocks in the same file, `useNewsFlagEnabled` may return `true` in those earlier tests only by coincidence (its initial mock state returns `undefined`, which is falsy). The Phase 57 and MC-04 tests all render players with `news: ''` (empty), so `NewsBanner` exits early on `!news` before calling `useNewsFlagEnabled` — masking the missing mock setup. Any future test that adds a player with non-empty `news` to the earlier describe blocks will unexpectedly suppress banners because `useNewsFlagEnabled` returns `undefined` (falsy).

**Fix:**
```typescript
// In the module-level beforeEach (around line 80), add:
beforeEach(() => {
  vi.mocked(usePlayers).mockReturnValue({ data: buildPlayers(), isLoading: false, error: null } as never)
  vi.mocked(useCaptainPicks).mockReturnValue({ data: { gameweek: 28, ceiling: null, eo_adjusted: null }, isLoading: false, error: null } as never)
  vi.mocked(useAuthStatus).mockReturnValue({ isAuthenticated: false, expiresAt: undefined, isLoading: false, setAuthenticated: vi.fn(), clearAuthenticated: vi.fn() } as never)
  vi.mocked(useMyTeam).mockReturnValue({ data: undefined, isLoading: false, error: null } as never)
  vi.mocked(useNewsFlagEnabled).mockReturnValue(true)  // ADD THIS LINE
})
```

---

## Info

### IN-01: `FRESH_NEWS_ADDED` comment acknowledges wrong behavior rather than fixing it

**File:** `src/components/news/NewsBanner.test.tsx:70`

**Issue:** The comment `// after mocked now → delta negative → not stale` explicitly documents that the date is in the future relative to the mocked clock and that the delta will be negative. This is a test smell: the comment reveals that the author understood the date was future-dated but accepted this as acceptable test behavior. This conflates "does not trigger suppression" with "is genuinely within the 14-day fresh window." Combined with CR-01 above, this reduces confidence in the staleness gate coverage.

**Fix:** Addressed by the fix in CR-01. Once `FRESH_NEWS_ADDED` is corrected to a legitimately past date within 14 days, the comment should read:
```typescript
const FRESH_NEWS_ADDED = '2025-12-19T00:00:00Z'  // 13 days before mocked now → within 14d → renders
```

---

_Reviewed: 2026-05-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
