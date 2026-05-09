# Phase 88: FPL News Flags UI - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Surface existing FPL player news — `news` (injury/availability text string), `news_added` (ISO timestamp), and `chance_of_playing_next_round` (integer: 25/50/75/100/null) — as visual indicators in GemTable and TransferPanel. This phase is **display-only**: no new pipeline scraping, no new API route. Two small pipeline additions are required: (1) `news_added` and `chance_of_playing_next_round` pass-through in `merge.py`, and (2) `news_flag_enabled: true` written to `accuracy_backtest.json` by `accuracy.py`.

**What ships:**
- `merge.py`: add `news_added` and `chance_of_playing_next_round` pass-through from FPL element dict (~3 lines)
- `accuracy.py`: write `news_flag_enabled: true` to accuracy_backtest.json (canonical gate pattern)
- `MergedPlayer` type: add `news_added?: string` and `chance_of_playing_next_round?: number | null`
- `AccuracyBacktest` type: add `news_flag_enabled?: boolean`
- `useNewsFlagEnabled()` accessor: reads `accuracy.news_flag_enabled` from `useAccuracy()` data
- `src/lib/newsSeverity.ts`: pure function mapping `chance_of_playing_next_round` to severity tone (amber/red/zinc/none); unit tested
- `NewsBadge`: small inline badge for GemTable Status-column tooltip extension + row-expand panel
- `NewsBanner`: news text + timestamp banner for TransferPanel candidate rows
- Wire into GemTable Status column (tooltip) + row-expand panel + TransferPanel OCS rows

**Out of scope:** SCRAPER-02 (external press feeds), new API routes, new pipeline scraping, new query keys

</domain>

<decisions>
## Implementation Decisions

### Pipeline Field Gap
- **D-01:** Add `chance_of_playing_next_round` (int or null, from `element.get('chance_of_playing_next_round')`) and `news_added` (string, from `element.get('news_added', '')`) to the `merge.py` player dict — same position as the existing `'news': element.get('news', '')` line (~3 lines total). Both are already in the FPL bootstrap element response.
- **D-02:** Add corresponding optional fields to `MergedPlayer` in `src/lib/types.ts`: `news_added?: string` and `chance_of_playing_next_round?: number | null`. The existing `news: string` field stays non-optional (already there).

### Gate Mechanism
- **D-03:** Follow the canonical gate pattern: `accuracy.py` writes `news_flag_enabled: true` to `accuracy_backtest.json`. Add `news_flag_enabled?: boolean` to the `AccuracyBacktest` interface in `src/lib/types.ts`. Create `useNewsFlagEnabled()` accessor that calls `useAccuracy()` and returns `data?.news_flag_enabled ?? false`. Every render path that shows news chrome MUST call this hook — never inline `accuracy.news_flag_enabled` inside leaf components.
- **D-04:** Gate ships `true` by default (news display is safe and production data is already live). The gate is a true kill switch — when OFF, `NewsBadge` and `NewsBanner` both return empty fragment with no residual layout chrome.

### GemTable Indicator
- **D-05:** News text surfaces via `title=` attribute on the existing Status badge — no new column, no Player-cell changes. When `news` is non-empty, the Status badge gains `title={news}` so a desktop hover shows the full text alongside the D/I/S/U letter. Visually unchanged for healthy players.
- **D-06:** Row-expand panel shows the full `news` text and the `news_added` timestamp formatted via the existing `formatRelativeTime()` utility (`src/lib/formatRelativeTime.ts`) when non-empty. Omit the news section entirely when `news` is empty or `news_flag_enabled` is false.

### TransferPanel News Banner
- **D-07:** `NewsBanner` renders below the buy-candidate player name in the OCS candidate rows. Follows the `FragilityNote` pattern (inline, no filled-pill, amber/red text). Severity tone computed by `newsSeverity()` from `chance_of_playing_next_round`: `=== 75` → amber; `<= 50` → red; `=== null && news non-empty` → zinc/info; `=== 100 || both absent` → no banner.
- **D-08:** `NewsBanner` also appears in the current-squad section of `SquadView` for owned players who are flagged — same severity logic. This surfaces news for players already in the squad, not just buy candidates.

### Severity Helper
- **D-09:** `src/lib/newsSeverity.ts` exports `computeNewsSeverity(chance_of_playing_next_round?: number | null, news?: string): 'red' | 'amber' | 'zinc' | 'none'`. Unit tested in isolation — components consume the tone enum, never raw integers. Thresholds: `chance === null || chance === 100 && news empty` → `'none'`; `chance === 100 && news non-empty` → `'zinc'`; `chance === 75` → `'amber'`; `chance <= 50` → `'red'`.

### Claude's Discretion
- Component file locations: `src/components/news/NewsBadge.tsx` and `src/components/news/NewsBanner.tsx` (new `news/` directory, mirrors `shared/` pattern)
- Mobile portrait: Status tooltip is inaccessible on touch — rely on row-expand panel for mobile news detail (no additional mobile-specific changes needed)
- `news_added` format in row-expand: `formatRelativeTime()` gives "X min ago" / "X hours ago" — use that, no raw ISO string shown

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/ROADMAP.md` §Phase 88 — Goal, 5 success criteria (SC-1 through SC-5), cross-cutting constraints, phase notes including severity threshold table and gate default
- `.planning/REQUIREMENTS.md` §SCRAPER-01 — full requirement text; confirms display-only scope, gate spec, news banner + indicator spec

### Pipeline Change Targets
- `pipeline/merge.py` line ~992 — `'news': element.get('news', '')` line; add `news_added` and `chance_of_playing_next_round` immediately after (~3 lines)
- `pipeline/accuracy.py` — add `news_flag_enabled: True` to the dict returned by `compute_accuracy_backtest()`

### Primary TypeScript Change Targets
- `src/lib/types.ts` `MergedPlayer` interface — add `news_added?: string`, `chance_of_playing_next_round?: number | null`
- `src/lib/types.ts` `AccuracyBacktest` interface (around line 336) — add `news_flag_enabled?: boolean`
- `src/components/gem-table/columns.tsx` — Status column cell (around line 260) — add `title={news}` when `news` non-empty
- `src/components/transfers/TransferPanel.tsx` — add `NewsBanner` below buy-candidate rows in OCS section
- `src/lib/formatRelativeTime.ts` — existing utility for `news_added` timestamp display

### Existing Patterns to Mirror
- `src/lib/hooks/useAccuracy.ts` — `useAccuracy()` hook; `useNewsFlagEnabled()` wraps it identically to how other gate accessors work
- `src/components/shared/FragilityNote.tsx` — inline amber text pattern (no filled-pill); `NewsBanner` follows same visual rules
- `src/components/gem-table/columns.tsx` lines 260-280 — Status badge with `title=` approach: add news text here
- `src/app/api/accuracy/route.ts` — accuracy API route (no changes, just reference for the data shape)
- `pipeline/accuracy.py` — gate flag write pattern (xmins_v2_enabled, bonus_predictor_enabled, save_predictor_enabled); mirror for `news_flag_enabled`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `formatRelativeTime(isoTimestamp, nowMs?)` in `src/lib/formatRelativeTime.ts` — formats `news_added` string into "X min ago" / "X hours ago" for row-expand display
- `useAccuracy()` in `src/lib/hooks/useAccuracy.ts` — base hook for `useNewsFlagEnabled()` accessor
- `FragilityNote` in `src/components/shared/FragilityNote.tsx` — inline amber text pattern for `NewsBanner` to mirror
- Status badge cell in `columns.tsx` ~line 260 — extend with `title=` attribute, no new column needed

### Established Patterns
- Gate pattern: `useXxx()` accessor reads `useAccuracy().data?.xxx_enabled ?? false`; gate wraps every render path (single source of truth — never inline in leaf components)
- Empty-fragment fallback: `if (!enabled || !news) return null` — guards layout-shift for healthy players
- `text-xs font-normal rounded px-2 py-1` badge class: existing inline badge pattern (Status column, SP tier badge)

### Integration Points
- `GemTable` columns: Status column cell is the insertion point for the `title=` tooltip on the badge
- `GemTable` row-expand panel: add news section conditionally when `news` non-empty and gate enabled
- `TransferPanel` → `OpportunityCostTable`: news banner slots below buy-candidate info per row (need to thread `MergedPlayer` news fields into OCSRow or look up by player id)
- `SquadView`: news banner for owned flagged players (same `NewsBanner` component, same severity logic)

</code_context>

<specifics>
## Specific Ideas

- Severity thresholds are locked: `chance === 75` → amber, `chance ≤ 50` → red, `non-empty news + chance === 100` → zinc/info, everything else → no banner/tooltip
- Gate ships ON by default (`news_flag_enabled: true`) — data is already live in production cache
- `NewsBadge` and `NewsBanner` must return empty fragment (not a zero-height div) when not shown — prevents layout shift
- Status badge tooltip: when `news` non-empty, `title={news}` on the badge span is sufficient; no dedicated `NewsTooltip` component needed

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 88-FPL-News-Flags-UI*
*Context gathered: 2026-05-09*
