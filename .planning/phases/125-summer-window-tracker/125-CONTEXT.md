# Phase 125: Summer Window Tracker - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

A new "Summer Window" sub-tab in the Analyse section displaying the live transfer news feed (from `useTransferNews()`) with single-select classification filter pills, plus a "Confirmed Signing" badge on matching player rows in GemTable (expanded row) and TransferPanel (OpportunityCostTable buy-cell cluster).

</domain>

<decisions>
## Implementation Decisions

### Article Card Layout (WIN-01)
- **D-01:** Compact card layout: **title + source badge + relative date** only. No summary text visible by default. Each card fits in ~2 lines.
- **D-02:** Article title is a link (`<a target="_blank">`) to the original Sky Sports / BBC article. `url` field from `TransferNewsArticle` is always set.
- **D-03:** Source displayed as a short badge: `[SKY]` or `[BBC]` using the `source` field (`'skysports' | 'bbc'`). Date shows relative time (e.g. "3h ago") from `published` field; fall back to `scraped_at` if `published` is null.

### Stale Feed Handling
- **D-04:** When `feed.scraped_at` is older than 24h, show a **yellow banner** above the article list: "Feed last updated Xh ago — may not reflect latest news." Articles still display. Mirrors the lineup-news staleness pattern.

### Filter Pills (WIN-01)
- **D-05:** Pills: **All | Confirmed | Rumour | Injury | Rotation** (5 pills). `general` class has no dedicated pill — `general` articles appear only under "All".
- **D-06:** Pills are **single-select (radio style)** — one active at a time.
- **D-07:** Default active pill on tab open: **All**.
- **D-08:** Filter mapping: Confirmed → `confirmed_signing`, Rumour → `rumour`, Injury → `injury_return`, Rotation → `rotation_signal`. "All" shows all classifications.
- **D-09:** Empty state when no articles match the active filter: card with copy "No [filter label] articles found." (e.g. "No Confirmed articles found.")

### Confirmed Signing Badge — GemTable (WIN-02)
- **D-10:** Badge placement: **expanded row only**, after existing expanded-row content (consistent with `FragilityBadge` placement pattern at line 372–373 of GemTable.tsx).
- **D-11:** Badge label: **"Confirmed Signing"**. Visual style: green background, consistent with positive-signal badges in the shared component library.
- **D-12:** Match logic: `useTransferNews().data.articles.filter(a => a.classification === 'confirmed_signing' && a.element_id === player.id)`. If multiple matching articles exist, show one badge (the most recent by `published` or `scraped_at`).
- **D-13:** Badge only appears when a match exists — absent for unmatched players.

### Confirmed Signing Badge — TransferPanel (WIN-02)
- **D-14:** Badge placement: **OpportunityCostTable `PlayerMoveCell` buy cluster** — the same slot used by `MinsRiskBadge` and `StatusLabelBadge` in Phase 122.
- **D-15:** Badge has a **native tooltip** (`title` attribute) showing the article headline + source on hover. E.g. `title="Salah signs new deal · Sky Sports"`.
- **D-16:** Same match logic as D-12. Buy-side only — sell-side player rows do not show signing badges.

### Sub-tab registration
- **D-17:** Sub-tab ID: `'window'`, label: `"Summer Window"`, mobileLabel: `"Window"`. Inserted after `'season'` in the Analyse section of `SECTIONS` in `page.tsx`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase data dependency
- `src/lib/hooks/useTransferNews.ts` — The hook this phase builds on. Returns `TransferNewsFeed`. No changes to this hook.
- `src/lib/types.ts` lines 1066–1090 — `TransferClass`, `TransferNewsArticle`, `TransferNewsFeed` type definitions.

### Integration points
- `src/app/page.tsx` lines 57–98 — `SubTab` union type and `SECTIONS` array. Add `'window'` SubTab and register in Analyse section after `'season'`.
- `src/components/gem-table/GemTable.tsx` lines 370–374 — Expanded row badge slot (FragilityBadge pattern to follow for placement).
- `src/components/transfers/OpportunityCostTable.tsx` — `PlayerMoveCell` buy cluster (badge slot established in Phase 122).

### Existing badge patterns
- `src/components/shared/FragilityBadge.tsx` — Expanded-row badge pattern.
- `src/components/shared/` — Check for reusable badge primitives before creating new ones.

### Requirements
- `WIN-01` — Summer Window feed tab with filter pills
- `WIN-02` — Confirmed signing badge on GemTable and TransferPanel rows

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useTransferNews()` (`src/lib/hooks/useTransferNews.ts`) — Ready to use; returns `{ data: TransferNewsFeed, isLoading, isError }`. 6h staleTime.
- `FragilityBadge` (`src/components/shared/FragilityBadge.tsx`) — Badge component; check if `ConfirmingSigningBadge` can reuse its base or follow its pattern.
- `formatRelativeTime` (`src/lib/formatRelativeTime.ts`) — Already imported in GemTable; use for article published dates.
- Filter-pill state: use `useState<TransferClass | 'all'>('all')` locally in the tab component.

### Established Patterns
- SubTab registration: add to `SubTab` union + `SECTIONS` array + render condition in `page.tsx` (Phase 124 added `'season'` — exact pattern to follow).
- TanStack Query hooks called unconditionally at top of component (rules-of-hooks), gated via `isSuccess` before data access.
- `player.id` === `element_id` for FPL element matching throughout the codebase.
- Expanded-row badge: rendered conditionally after news/fragility content in GemTable's row expansion block.

### Integration Points
- `page.tsx` — SubTab union + SECTIONS (Analyse section) + render condition for `activeSubTab === 'window'`
- `GemTable.tsx` — Pass signed player IDs set as prop or derive inside expanded row from `useTransferNews`
- `OpportunityCostTable.tsx` / `PlayerMoveCell` — Buy-cell badge cluster

</code_context>

<specifics>
## Specific Ideas

- Stale banner colour: yellow — user confirmed "mirrors the lineup-news staleness pattern"
- `general` class articles: no dedicated filter pill; visible only under "All"
- Multiple confirmed_signing articles for same player: show one badge (most recent)
- Badge tooltip: `"[Article title] · [Source]"` e.g. `"Salah signs new deal · Sky Sports"`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 125-summer-window-tracker*
*Context gathered: 2026-05-19*
