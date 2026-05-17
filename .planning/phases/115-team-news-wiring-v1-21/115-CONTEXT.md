# Phase 115: Team News Wiring (v1.21) - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 115 activates staleness-suppressed team news on two decision surfaces:
1. **NEWS-01** — Implement 14-day staleness suppression gate inside `NewsBanner`: zinc-severity badges older than 14 days are suppressed (red/amber never suppressed regardless of age)
2. **NEWS-02** — Wire `NewsBanner` into `CaptainPicksPanel.CandidateRow` so captain pick candidates show inline team news
3. **NEWS-03** — `OpportunityCostTable` already passes `news`, `news_added`, and `chance_of_playing_next_round` to `NewsBanner` — this requirement is automatically satisfied once NEWS-01 is implemented; no additional wiring needed

No pipeline changes. No new data fields. No new routes. Pure UI wiring + one staleness guard.
</domain>

<decisions>
## Implementation Decisions

### NEWS-01: Staleness Suppression Architecture
- **D-01:** The 14-day staleness check lives **inside `NewsBanner`** — add `if (severity === 'zinc' && isStale(news_added)) return null` before the main return. `computeNewsSeverity()` stays a pure severity classifier (signature unchanged).
- **D-02:** Use `Date.now()` directly inside `NewsBanner` — no injectable `now` parameter. Tests that cover staleness behaviour use `jest.useFakeTimers()` or `jest.spyOn(Date, 'now')`, which is the Jest standard approach.
- **D-03:** Threshold is exactly 14 days (from ROADMAP success criterion). Red and amber severity are **never** suppressed regardless of `news_added` age.

### NEWS-02: CaptainPicksPanel Row Layout
- **D-04:** `NewsBanner` is placed **inline in the first flex div** of `CandidateRow` — appended after the existing badges (DangerousToFadeBadge, McLabel). The `flex-wrap` already on that div handles overflow gracefully. This matches the `OpportunityCostTable` pattern (NewsBanner inline in the player-move flex div).

### NEWS-03: TransferPanel / OpportunityCostTable
- **D-05:** No additional wiring needed. `OpportunityCostTable` line ~137 already passes `news`, `news_added`, and `chance_of_playing_next_round` to `NewsBanner`. NEWS-03 is satisfied automatically once NEWS-01 is in place.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 115 Requirements
- `.planning/REQUIREMENTS.md` §v1.21 — NEWS-01, NEWS-02, NEWS-03 requirement definitions
- `.planning/ROADMAP.md` Phase 115 — Goal, success criteria, dependencies

### NewsBanner Component
- `src/components/news/NewsBanner.tsx` — Component to modify for NEWS-01 staleness gate; `news_added` prop already accepted but currently unused
- `src/lib/newsSeverity.ts` — `computeNewsSeverity()` pure classifier (DO NOT change its signature); read to understand severity contract before adding staleness guard
- `src/components/news/types.ts` — News-related type definitions

### CaptainPicksPanel (NEWS-02)
- `src/components/captaincy/CaptainPicksPanel.tsx` — `CandidateRow` component (lines ~85–163): add `NewsBanner` inline in the first flex div after McLabel; `candidate` is `MergedPlayer` which has `news`, `news_added`, `chance_of_playing_next_round`

### TransferPanel / OpportunityCostTable (NEWS-03)
- `src/components/transfers/OpportunityCostTable.tsx` — `PlayerMoveCell` lines ~136–141: existing `NewsBanner` call for buy candidates (already passes `news_added`); verify staleness suppression activates correctly after NEWS-01
- `src/components/transfers/TransferPanel.tsx` — Parent of OpportunityCostTable; no changes required

### Type Reference
- `src/lib/types.ts` lines ~26–28 — `MergedPlayer`: `news: string`, `news_added?: string` (ISO timestamp), `chance_of_playing_next_round?: number | null`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `NewsBanner.tsx`: Already wired in OpportunityCostTable; accepts `news`, `news_added`, `chance_of_playing_next_round`. The `news_added` prop is in the interface but the render ignores it — NEWS-01 activates it.
- `computeNewsSeverity()`: Pure function returning `'red' | 'amber' | 'zinc' | 'none'` — stays unchanged.
- `MergedPlayer` type: All three news fields already present — no type changes needed.

### Established Patterns
- NewsBanner inline placement: `OpportunityCostTable` line ~137 puts `<NewsBanner>` inside a `flex flex-wrap items-center gap-x-2` div alongside the player name — same approach for `CandidateRow`.
- Severity suppression: Existing `if (severity === 'none') return null` in `NewsBanner` line 35 — staleness suppression is a natural extension of this guard pattern.
- `flex-wrap` on `CandidateRow` first div: Already present (`gap-1.5 sm:flex-1 flex-wrap`) — overflow handled automatically.

### Integration Points
- `CaptainPicksPanel.tsx` `CandidateRow` first flex div (after `{mcLabel && <McLabel .../>}`) — insert `<NewsBanner>` here
- `NewsBanner.tsx` render function (after `const severity = computeNewsSeverity(...)` line 34) — add staleness guard before `if (severity === 'none') return null`
- `OpportunityCostTable.tsx` `PlayerMoveCell` — no changes; existing `news_added` pass-through becomes effective once NEWS-01 lands

</code_context>

<specifics>
## Specific Ideas

- Staleness helper: `const isStale = (newsAdded?: string) => newsAdded ? Date.now() - new Date(newsAdded).getTime() > 14 * 24 * 60 * 60 * 1000 : false`; call inside NewsBanner after severity is computed: `if (severity === 'zinc' && isStale(news_added)) return null`
- Guard ordering in NewsBanner: staleness check runs AFTER `computeNewsSeverity` (so severity is known) but BEFORE the existing `if (severity === 'none') return null` — this preserves the logical flow and keeps zinc suppression adjacent to the none-suppression.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 115-team-news-wiring-v1-21*
*Context gathered: 2026-05-17*
