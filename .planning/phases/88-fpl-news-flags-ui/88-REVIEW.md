---
phase: 88-fpl-news-flags-ui
reviewed: 2026-05-10T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - pipeline/accuracy.py
  - pipeline/merge.py
  - src/components/gem-table/GemTable.tsx
  - src/components/gem-table/columns.tsx
  - src/components/news/NewsBadge.tsx
  - src/components/news/NewsBanner.tsx
  - src/components/news/types.ts
  - src/components/squad/SquadView.tsx
  - src/components/transfers/OpportunityCostTable.tsx
  - src/lib/hooks/useAccuracy.ts
  - src/lib/newsSeverity.ts
  - src/lib/types.ts
findings:
  critical: 2
  warning: 3
  info: 2
  total: 7
status: issues_found
---

# Phase 88: Code Review Report

**Reviewed:** 2026-05-10
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 88 adds FPL injury/news flag display across GemTable, SquadView, and OpportunityCostTable, gated by `useNewsFlagEnabled()` which reads `data?.summary?.news_flag_enabled`. The gate path is correct. No XSS via `dangerouslySetInnerHTML` — news text is injected as React children (text nodes) and as native `title=` attributes only, both safe.

Two blockers found: `NewsBanner` will render a lone icon with no text when `chance_of_playing_next_round = 75` and `news` is empty, because `computeNewsSeverity` returns `'amber'` for `chance=75` regardless of whether `news` has content, and `NewsBanner` lacks the news-emptiness guard that all other callers use. The second blocker is that `NewsBadge` is dead code that is never imported in production, wasting the hook call it contains.

Three warnings: `NewsBanner` silently ignores the `news_added` timestamp prop it accepts, producing inconsistent timestamp display between SquadView/OpportunityCostTable (no timestamp) and GemTable (timestamp shown). The `NewsBadge` component header documents an illegal hooks-in-plain-function call pattern that will break React if a future caller follows the comment. Pipeline's `news_flag_enabled: True` is unconditional with no programmatic kill-switch path.

---

## Critical Issues

### CR-01: `NewsBanner` renders a bare icon with no text when `chance=75` and `news` is empty

**File:** `src/components/news/NewsBanner.tsx:31-40`

**Issue:** `computeNewsSeverity(75, '')` returns `'amber'` (D-09 in `newsSeverity.ts` has no empty-news exception for `chance=75`). `NewsBanner` only guards on `severity === 'none'`, so when a player has `chance_of_playing_next_round = 75` with an empty `news` string — a real FPL API state — it renders:

```tsx
<div className="text-xs text-amber-600 ...">
  <span aria-hidden="true">⚠ </span>
  {/* news is '' — nothing here */}
</div>
```

The result is a visible amber warning icon with no accompanying text, displayed in the SquadView player name cell and OpportunityCostTable buy candidate cell. All other callers (`RowExpandNewsSection` in `GemTable.tsx` line 114, `columns.tsx` line 280) guard `news.trim().length === 0` before reaching severity classification. `NewsBanner` is the only caller that skips this guard.

**Fix:** Add the news-emptiness guard inside `NewsBanner` before the severity check, matching the pattern used in every other call site:

```tsx
export function NewsBanner({ news, chance_of_playing_next_round }: NewsBannerProps) {
  const enabled = useNewsFlagEnabled()
  if (!enabled) return null
  // Guard matches RowExpandNewsSection line 114 — no guard in computeNewsSeverity for chance=75
  if (!news || news.trim().length === 0) return null
  const severity = computeNewsSeverity(chance_of_playing_next_round, news)
  if (severity === 'none') return null
  return (
    <div className={`text-xs ${SEVERITY_CLASS[severity]}`} data-testid="news-banner">
      <span aria-hidden="true">{SEVERITY_ICON[severity]} </span>
      {news}
    </div>
  )
}
```

---

### CR-02: `NewsBadge` is dead production code — never imported outside tests

**File:** `src/components/news/NewsBadge.tsx:1-17`

**Issue:** `NewsBadge` is imported only in `NewsBadge.test.tsx`. No production file (`columns.tsx`, `GemTable.tsx`, `SquadView.tsx`, or any other source file) imports or uses it. The component header comment states "Used as: `const newsTitle = NewsBadge({ news: row.original.news })`" — but `columns.tsx` implements the same gate logic inline (lines 279-281) without calling `NewsBadge` at all.

This means Phase 88 shipped a component that calls a React hook (`useNewsFlagEnabled`) but is unreachable at runtime. The tests pass because they use JSX rendering (`<NewsBadge />`), but the documented call pattern (plain function call) would violate the Rules of Hooks if a future contributor follows the comment.

Dead hook-bearing code that documents an illegal usage pattern is a maintenance trap with two failure modes: (a) a caller follows the comment and introduces a hooks violation crash, (b) the gate test coverage is entirely detached from the actual production gate path (which is the inline check in `columns.tsx`).

**Fix:** Remove `NewsBadge.tsx` and its test. The status column gate is already correctly implemented inline in `columns.tsx` lines 279-281. If a shared helper is needed, extract a pure function (no hook) that the column cell already handles via the `newsFlagEnabled` prop passed into `createColumns`.

---

## Warnings

### WR-01: `NewsBanner` accepts `news_added` prop but silently drops it — no timestamp displayed

**File:** `src/components/news/NewsBanner.tsx:12-13, 31`

**Issue:** `NewsBannerProps` declares `news_added?: string` and `SquadView.tsx` (line 175) and `OpportunityCostTable.tsx` (line 105) both pass `news_added` to `NewsBanner`. However, `NewsBanner`'s function signature destructures only `{ news, chance_of_playing_next_round }` — `news_added` is accepted by the interface but never destructured or used in the render. The timestamp is silently dropped.

This creates inconsistent UX: the GemTable row-expand section (`RowExpandNewsSection` in `GemTable.tsx` lines 117-123) does render the relative timestamp (e.g. "3 days ago"), while `NewsBanner` renders the same news text in SquadView without any timestamp. Users see timestamps in one context and not the other with no explanation.

**Fix:** Destructure and render `news_added` in `NewsBanner`, matching `RowExpandNewsSection`:

```tsx
export function NewsBanner({ news, news_added, chance_of_playing_next_round }: NewsBannerProps) {
  const enabled = useNewsFlagEnabled()
  if (!enabled || !news || news.trim().length === 0) return null
  const severity = computeNewsSeverity(chance_of_playing_next_round, news)
  if (severity === 'none') return null
  const relTime = news_added ? formatRelativeTime(news_added) : null
  return (
    <div className={`text-xs ${SEVERITY_CLASS[severity]}`} data-testid="news-banner">
      <span aria-hidden="true">{SEVERITY_ICON[severity]} </span>
      {news}
      {relTime && <span className="ml-1 text-zinc-400 dark:text-zinc-500">({relTime})</span>}
    </div>
  )
}
```

---

### WR-02: `NewsBadge` documents an illegal React hooks call pattern in its header comment

**File:** `src/components/news/NewsBadge.tsx:2`

**Issue:** Line 2 reads: `// Used as: const newsTitle = NewsBadge({ news: row.original.news }) — caller passes to title=.`

Calling a function that contains `useNewsFlagEnabled()` as a plain function — `NewsBadge({ news: ... })` — rather than via JSX (`<NewsBadge />`) violates the React Rules of Hooks. React hooks must be called inside function components or custom hooks; a plain function call bypasses React's hook invocation tracking and will throw "Invalid hook call" at runtime.

Even if `NewsBadge` is currently dead code (CR-02), this comment actively documents an incorrect usage pattern that will cause a runtime crash if followed.

**Fix:** Remove the component (per CR-02). If the comment is kept for any reason, correct it to reflect JSX usage only, or convert the helper to a pure function with no hook and accept `enabled: boolean` as a prop.

---

### WR-03: Pipeline `news_flag_enabled: True` is hardcoded with no programmatic kill-switch path

**File:** `pipeline/accuracy.py:404, 483`

**Issue:** Both `compute_accuracy_backtest` (line 404) and `_empty_backtest` (line 483) unconditionally write `'news_flag_enabled': True`. The comment states "kill switch in UI gate" — but the UI gate (`useNewsFlagEnabled`) reads from the pipeline-written JSON. Because the pipeline always writes `True`, the only way to disable news display is to manually edit `accuracy_backtest.json` in the cache after the pipeline has run.

By contrast, every other gate flag (`xmins_v2_enabled`, `bonus_predictor_enabled`, `save_predictor_enabled`) is preserved across pipeline runs by reading the prior cache value. `news_flag_enabled` ignores the prior cache entirely, so:

1. A manually-set `False` value in the cache is overwritten by the next pipeline run.
2. There is no code path that can produce `news_flag_enabled: False` after the first run.

The documented "kill switch" does not function as a kill switch.

**Fix:** Read and preserve the existing `news_flag_enabled` value from the prior cache, defaulting to `True` only on cold start — mirroring the pattern used for all other gate flags:

```python
news_flag_enabled = bool(prior_cache.get('summary', {}).get('news_flag_enabled', True))
```

Then use `news_flag_enabled` (the variable) instead of the literal `True` at lines 404 and 483.

---

## Info

### IN-01: `computeNewsSeverity` treats any `chance_of_playing_next_round` value other than `null`, `100`, or `75` as `'red'` — no range validation

**File:** `src/lib/newsSeverity.ts:31`

**Issue:** The docstring lists valid values as `25/50/75/100 or null`, but the final `return 'red'` catches any value not handled above — including values like `0`, `10`, `33`, or any unexpected integer the FPL API might return. While the current FPL API only emits the documented values, there is no guard or logging when an unexpected value is received. This is low-risk given FPL API stability, but the comment "any other unexpected value treated as flagged" documents this as a known assumption rather than a verified invariant.

**Fix:** No code change required; acceptable as-is given the FPL API contract. Consider adding a comment noting that FPL only emits `{25, 50, 75, 100, null}` so future readers understand why the fallback to `'red'` is intentional.

---

### IN-02: `RowExpandNewsSection` in `GemTable.tsx` duplicates severity classification and icon lookup already present in `NewsBanner`

**File:** `src/components/gem-table/GemTable.tsx:94-125`

**Issue:** `GemTable.tsx` defines its own `ROW_EXPAND_SEVERITY_CLASS` and `ROW_EXPAND_SEVERITY_ICON` maps (lines 94-100) and re-implements the same render logic as `NewsBanner`, including the `computeNewsSeverity` call, timestamp display, and icon/class lookup. The only difference is that `RowExpandNewsSection` adds the timestamp. This duplication means any future severity colour change or icon update must be applied in two places.

**Fix:** Extend `NewsBanner` to accept an optional `showTimestamp` prop (or always render the timestamp when available, per WR-01), and replace `RowExpandNewsSection` with `<NewsBanner ... />`. This eliminates the duplicated severity maps and consolidates the news display contract in one component.

---

_Reviewed: 2026-05-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
