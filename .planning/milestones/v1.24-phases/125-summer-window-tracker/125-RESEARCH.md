# Phase 125: Summer Window Tracker — Research

**Researched:** 2026-05-19
**Domain:** React/Next.js UI — new sub-tab with feed display + cross-component badge injection
**Confidence:** HIGH (all integration points verified against live codebase)

---

## Summary

Phase 125 wires together three isolated work units: (1) a new "Summer Window" sub-tab in the Analyse section that renders the `useTransferNews()` feed with filter pills, (2) a `ConfirmedSigningBadge` shared component injected into GemTable expanded rows, and (3) the same badge injected into `OpportunityCostTable`'s `PlayerMoveCell` buy cluster. No new types, routes, hooks, or build infrastructure are required — Phase 123 delivered all data plumbing. This is a pure UI composition phase.

The badge pattern is already fully established by `MinsRiskBadge`, `StatusLabelBadge`, and `VerdictBadge` — all three share identical JSX structure (`inline-block text-xs font-normal ... rounded px-2 py-1`) and the green colour token (`bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`) is already used by `MinsRiskBadge` "nailed" and `VerdictBadge` "buy". The filter pill pattern is already established in `AccuracyTab`'s `PositionTabSelector` with exact CSS classes documented in UI-SPEC.

Sub-tab registration in `page.tsx` is mechanical: add `'window'` to the `SubTab` union, add an entry to the Analyse `SECTIONS` array after `'season'`, and add a render condition block. `MobileNav` consumes `SECTIONS` from `page.tsx` directly — no separate MobileNav change needed. The `sectionMemory` initialiser in `Home()` does not need updating because it only sets initial state per section, not per sub-tab.

**Primary recommendation:** Three sequential tasks — (1) `ConfirmedSigningBadge` shared component + its test, (2) `SummerWindowTab` feed component, (3) page.tsx sub-tab registration + badge injection into GemTable and OpportunityCostTable.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Compact card layout: title + source badge + relative date only. No summary text visible by default. Each card fits in ~2 lines.
- **D-02:** Article title is a link (`<a target="_blank">`) to the original Sky Sports / BBC article. `url` field from `TransferNewsArticle` is always set.
- **D-03:** Source displayed as a short badge: `[SKY]` or `[BBC]` using the `source` field (`'skysports' | 'bbc'`). Date shows relative time (e.g. "3h ago") from `published` field; fall back to `scraped_at` if `published` is null.
- **D-04:** When `feed.scraped_at` is older than 24h, show a yellow banner above the article list: "Feed last updated Xh ago — may not reflect latest news." Articles still display. Mirrors the lineup-news staleness pattern.
- **D-05:** Pills: All | Confirmed | Rumour | Injury | Rotation (5 pills). `general` class has no dedicated pill — `general` articles appear only under "All".
- **D-06:** Pills are single-select (radio style) — one active at a time.
- **D-07:** Default active pill on tab open: All.
- **D-08:** Filter mapping: Confirmed → `confirmed_signing`, Rumour → `rumour`, Injury → `injury_return`, Rotation → `rotation_signal`. "All" shows all classifications.
- **D-09:** Empty state when no articles match the active filter: card with copy "No [filter label] articles found."
- **D-10:** Badge placement in GemTable: expanded row only, after existing expanded-row content (consistent with `FragilityBadge` placement pattern at lines 372–373 and 401–402 of GemTable.tsx).
- **D-11:** Badge label: "Confirmed Signing". Visual style: green background, consistent with positive-signal badges in the shared component library.
- **D-12:** Match logic: `useTransferNews().data.articles.filter(a => a.classification === 'confirmed_signing' && a.element_id === player.id)`. If multiple matching articles exist, show one badge (the most recent by `published` or `scraped_at`).
- **D-13:** Badge only appears when a match exists — absent for unmatched players.
- **D-14:** Badge placement in TransferPanel: `OpportunityCostTable` `PlayerMoveCell` buy cluster — the same slot used by `MinsRiskBadge` and `StatusLabelBadge` in Phase 122.
- **D-15:** Badge has a native tooltip (`title` attribute) showing the article headline + source on hover. E.g. `title="Salah signs new deal · Sky Sports"`.
- **D-16:** Same match logic as D-12. Buy-side only — sell-side player rows do not show signing badges.
- **D-17:** Sub-tab ID: `'window'`, label: `"Summer Window"`, mobileLabel: `"Window"`. Inserted after `'season'` in the Analyse section of `SECTIONS` in `page.tsx`.

### Claude's Discretion
None recorded — all decisions were locked in discussion.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WIN-01 | Summer Window feed displays `transfer_news.json` articles sorted by date, filterable by classification (confirmed / rumour / injury / rotation) | `useTransferNews()` hook verified (returns `TransferNewsFeed`); filter pill pattern verified in `AccuracyTab`; article card structure fully specified in UI-SPEC |
| WIN-02 | Confirmed signing badge appears on relevant player rows in GemTable and TransferPanel when a `confirmed_signing` article is matched to that player's element ID | Badge slot verified in GemTable (lines 372–373, 401–402); buy cluster slot verified in `PlayerMoveCell` (line 141–145 pattern); `player.id === element_id` match confirmed throughout codebase |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Article feed display + filtering | Browser / Client | — | Pure client-side state (`useState` filter), TanStack Query cache; no server computation needed |
| Sub-tab registration | Browser / Client | — | `page.tsx` SubTab union + SECTIONS array; MobileNav derives from SECTIONS automatically |
| `ConfirmedSigningBadge` rendering in GemTable | Browser / Client | — | Expanded-row render is already client-side; hook call at component top, gate via `isSuccess` |
| `ConfirmedSigningBadge` rendering in TransferPanel | Browser / Client | — | `PlayerMoveCell` is already 'use client'; badge slotted after existing badges |
| Data fetching (`useTransferNews`) | API / Backend | Browser cache | Phase 123 route handler at `/api/transfer-news` already implemented; hook already exists |

---

## Standard Stack

### Core (all already installed — no new dependencies)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| React | 19.2.4 | UI rendering | Already installed [VERIFIED: package.json] |
| Next.js | 16.2.1 | App framework | Already installed [VERIFIED: package.json] |
| @tanstack/react-query | ^5.95.2 | Data fetching / cache | Already installed [VERIFIED: package.json] |
| Tailwind CSS | ^4 | Styling | Already installed [VERIFIED: package.json] |
| lucide-react | already installed | Icons (if needed) | Available per UI-SPEC [CITED: 125-UI-SPEC.md] |

**No new packages to install.** [VERIFIED: package.json]

---

## Architecture Patterns

### System Architecture Diagram

```
page.tsx (SubTab union + SECTIONS)
    │
    ├─► activeSubTab === 'window'
    │       └─► SummerWindowTab
    │               ├─► useTransferNews() ──► /api/transfer-news ──► Vercel Blob
    │               ├─► [stale banner — conditional on scraped_at age > 24h]
    │               ├─► filter pills (useState<TransferClass | 'all'>)
    │               └─► article card list (filtered + sorted by published desc)
    │
    ├─► activeSubTab === 'gems'
    │       └─► GemTable
    │               └─► expanded row
    │                       └─► [ConfirmedSigningBadge — conditional on match]
    │                               └─► useTransferNews() [same cache key — no extra fetch]
    │
    └─► activeSection === 'squad' && activeSubTab === 'transfers'
            └─► TransferPanel ──► OpportunityCostTable ──► PlayerMoveCell (buy side)
                                                                └─► [ConfirmedSigningBadge — conditional on match]
                                                                        └─► useTransferNews() [same cache key]
```

### Recommended Project Structure

New files this phase:

```
src/
├── components/
│   ├── news/
│   │   └── SummerWindowTab.tsx       # new — WIN-01 feed tab
│   └── shared/
│       └── ConfirmedSigningBadge.tsx # new — WIN-02 badge
└── (no new hooks, types, or routes — all exist from Phase 123)
```

### Pattern 1: Sub-tab Registration (page.tsx)

**What:** Add `'window'` to the `SubTab` union type, add entry to Analyse SECTIONS array, add render condition.

**Exact insertion point verified:** [VERIFIED: src/app/page.tsx line 57]

Current `SubTab` union ends with `'rank-sim'`. Add `'window'` to the union.

Current Analyse `subTabs` array ends with `price-changes` at line 71. Insert `{ id: 'window' as SubTab, label: 'Summer Window', mobileLabel: 'Window' }` after `season` (line 70) and before `price-changes` (line 71).

Render condition to add (after the `season` render block at line 284):
```tsx
{activeSection !== 'squad' && activeSubTab === 'window' && <SummerWindowTab />}
```

**MobileNav:** No separate change needed — MobileNav imports `SECTIONS` directly from `page.tsx` and renders `sub.mobileLabel`. [VERIFIED: src/components/nav/MobileNav.tsx line 2]

**`sectionMemory` initialiser:** No change needed — it stores the last active SubTab per section, not a hardcoded set. [VERIFIED: src/app/page.tsx lines 104–108]

### Pattern 2: Badge Component (shared pattern)

**What:** `ConfirmedSigningBadge` follows the `MinsRiskBadge` / `StatusLabelBadge` / `VerdictBadge` shape contract exactly.

**Verified shape contract:** [VERIFIED: src/components/shared/MinsRiskBadge.tsx line 59]
```tsx
<span className={`inline-block text-xs font-normal ${config.text} ${config.bg} rounded px-2 py-1`} title={titleText}>
```

`ConfirmedSigningBadge` implementation per UI-SPEC:
```tsx
// Source: UI-SPEC.md §WIN-02: ConfirmedSigningBadge
export function ConfirmedSigningBadge({ tooltipText }: { tooltipText: string }) {
  return (
    <span
      className="inline-block text-xs font-normal text-green-800 bg-green-100 dark:bg-green-900 dark:text-green-200 rounded px-2 py-1"
      title={tooltipText}
    >
      Confirmed Signing
    </span>
  )
}
```

Green token confirmed used by `MinsRiskBadge` "nailed" and `VerdictBadge` "buy". [VERIFIED: src/components/shared/MinsRiskBadge.tsx line 12–14, VerdictBadge.tsx line 14–17]

### Pattern 3: TanStack Query hook usage (rules-of-hooks)

**What:** `useTransferNews()` must be called unconditionally at the top of any component that needs it, then data access gated via `isSuccess`.

**Verified pattern from codebase:** [VERIFIED: src/lib/hooks/useTransferNews.ts]

Hook returns `{ data, isLoading, isError, isSuccess }` from `useQuery<TransferNewsFeed>`.

In GemTable, this hook will be called alongside the existing `usePlayers()` call. The TanStack Query cache deduplicates fetches by `queryKey: ['transfer-news']` — calling it in multiple components does not trigger multiple network requests. [VERIFIED: src/lib/hooks/useTransferNews.ts line 6]

### Pattern 4: GemTable expanded row injection

**What:** Add `ConfirmedSigningBadge` after `FragilityBadge` in BOTH expanded row `<td>` blocks (mobile: lines ~372–373; desktop: lines ~401–402).

**Verified placement:** [VERIFIED: src/components/gem-table/GemTable.tsx lines 372–413]

Both blocks follow the same structure: `RowExpandNewsSection` → `FragilityBadge` → `ComparisonSearch` → `PlayerInsightSection`. Badge must go after `FragilityBadge` and before `ComparisonSearch` to stay consistent with the D-10 "after existing expanded-row content" decision.

Match derivation inside GemTable:
```tsx
// Call at top of GemTable component (unconditional per rules-of-hooks)
const { data: transferNews } = useTransferNews()

// Inside expanded row, per player:
const confirmedArticle = transferNews?.articles
  .filter(a => a.classification === 'confirmed_signing' && a.element_id === row.original.id)
  .sort((a, b) => {
    const ta = new Date(a.published ?? a.scraped_at).getTime()
    const tb = new Date(b.published ?? b.scraped_at).getTime()
    return tb - ta
  })[0]
```

### Pattern 5: OpportunityCostTable buy cluster injection

**What:** Add `ConfirmedSigningBadge` in `PlayerMoveCell` after `MinsRiskBadge` (line 145), buy-side only.

**Verified buy cluster:** [VERIFIED: src/components/transfers/OpportunityCostTable.tsx lines 140–151]

Current order: `RotationRiskBadge` → `StatusLabelBadge` → `MinsRiskBadge` → `NewsBanner`

After this phase: `RotationRiskBadge` → `StatusLabelBadge` → `MinsRiskBadge` → `ConfirmedSigningBadge` → `NewsBanner`

`OpportunityCostTable` requires passing the transfer news data down. Options:
1. Call `useTransferNews()` inside `PlayerMoveCell` (it is a 'use client' component; hook is valid here; cache deduplication means no extra fetch) — simplest, no prop drilling
2. Pass a `Set<number>` of confirmed-signing element IDs as a prop to `OpportunityCostTable`

**Recommendation:** Option 1 — call `useTransferNews()` inside `PlayerMoveCell` directly. The component is already 'use client' [VERIFIED: OpportunityCostTable.tsx line 1]. Avoids widening the `OpportunityCostTableProps` interface and the `TransferPanel` prop chain. Same cache key guarantees deduplication.

Tooltip format: `"${article.title} · ${SOURCE_NAME[article.source]}"` where `SOURCE_NAME = { skysports: 'Sky Sports', bbc: 'BBC Sport' }` [CITED: 125-CONTEXT.md D-15]

### Pattern 6: Filter pills (SummerWindowTab)

**What:** `useState<TransferClass | 'all'>('all')` local state; PILLS constant maps to `TransferClass` values.

**Exact CSS classes verified in AccuracyTab:** [VERIFIED: src/components/accuracy/AccuracyTab.tsx lines 282–292]
- Active: `bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900`
- Inactive: `bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700`
- Button: `min-h-[44px] sm:min-h-0 px-3 py-1 rounded text-xs font-semibold uppercase tracking-wide transition-colors`

Note: AccuracyTab uses `sm:min-h-0` only in the sub-tab nav, not in `PositionTabSelector`. UI-SPEC specifies `sm:min-h-0` for the filter pills — use it.

### Pattern 7: Stale banner

**What:** Yellow banner rendered when `Date.now() - new Date(feed.scraped_at).getTime() > 24 * 60 * 60 * 1000`.

**Exact colour tokens verified from `LastUpdatedDisplay` stale branch:** [VERIFIED: src/components/LastUpdated.tsx line 19]
- `bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400` (LastUpdated uses slightly different classes)
- UI-SPEC specifies `bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800` — use UI-SPEC values (they're verified against the design system's amber semantic token)

`formatRelativeTime` signature: `formatRelativeTime(isoTimestamp: string, nowMs?: number): string` [VERIFIED: src/lib/formatRelativeTime.ts line 14] — already imported in GemTable.tsx.

### Pattern 8: Article sort order

**What:** Articles sorted by `published` desc; fall back to `scraped_at` when `published` is null.

```ts
// Source: UI-SPEC.md §Article card + CONTEXT.md D-03
const sorted = [...articles].sort((a, b) => {
  const ta = new Date(a.published ?? a.scraped_at).getTime()
  const tb = new Date(b.published ?? b.scraped_at).getTime()
  return tb - ta
})
```

`published` is typed `string | null` [VERIFIED: src/lib/types.ts line 1076] — nullish coalescing to `scraped_at` is the correct fallback.

### Anti-Patterns to Avoid

- **Calling `useTransferNews()` conditionally:** Violates rules-of-hooks. Always call unconditionally at component top, guard data access with `isSuccess` or optional chaining.
- **Mutating `articles` array before sorting:** `TransferNewsFeed.articles` is a readonly API response — spread first: `[...articles].sort(...)`.
- **Widening `OpportunityCostTableProps` unnecessarily:** Calling `useTransferNews()` inside `PlayerMoveCell` avoids prop-drilling through `OpportunityCostTable` and `TransferPanel`.
- **Adding `'window'` to `sectionMemory` initialiser:** `sectionMemory` is `Record<Section, SubTab | null>` — it maps sections to sub-tabs, not sub-tabs to sections. No change needed.
- **Separate MobileNav registration:** MobileNav reads from `SECTIONS` via import — adding to SECTIONS in page.tsx is sufficient.
- **Showing badge in sell-side rows:** D-16 is explicit: buy-side only. The `t.buy.id` is the match target, not `t.sell.id`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Relative date display | Custom date formatter | `formatRelativeTime()` from `@/lib/formatRelativeTime` | Already handles all edge cases, has `nowMs` injection for testing [VERIFIED] |
| Green pill badge | Custom badge component | Follow `MinsRiskBadge` / `StatusLabelBadge` shape contract | Consistent shape, dark mode, spacing; existing tests validate the pattern |
| Native tooltip | Custom tooltip component | `title` attribute on `<span>` | D-15 explicitly specifies native tooltip; no new dependency needed |
| Feed data fetching | Custom fetch logic | `useTransferNews()` hook | Already handles staleTime, error state, loading state [VERIFIED] |

---

## Common Pitfalls

### Pitfall 1: Only patching one of the two GemTable expanded row blocks

**What goes wrong:** GemTable renders two `<tr>` expansion blocks — one mobile (`sm:hidden`) at lines ~340–385 and one desktop (`hidden sm:table-row`) at lines ~387–415. Adding the badge to only one block causes inconsistent badge display between mobile and desktop.

**Why it happens:** The desktop block is visually separated in the file and easy to miss.

**How to avoid:** Search for both `Phase 93 SENS-01 (D-10): FragilityBadge after RowExpandNewsSection` comment blocks and add the badge comment + render after each `FragilityBadge` line.

**Warning signs:** Badge visible on mobile expand but not desktop (or vice versa).

### Pitfall 2: `useTransferNews()` import in GemTable adds a rules-of-hooks violation if placed inside the row-render map

**What goes wrong:** GemTable uses `scoredPlayers.map(...)` to render rows. Placing `useTransferNews()` inside the map callback violates rules-of-hooks (hooks cannot be called inside callbacks).

**How to avoid:** Call `useTransferNews()` once at the top of the `GemTable` function component, then pass the derived `confirmedArticle` lookup into the row expansion block.

### Pitfall 3: `TransferClass` type import for PILLS constant type

**What goes wrong:** The PILLS constant uses `TransferClass | 'all'` values. If `TransferClass` is not imported in `SummerWindowTab.tsx`, TypeScript will complain on the `useState` type annotation.

**How to avoid:** Import `TransferClass` from `@/lib/types` at the top of the file. [VERIFIED: src/lib/types.ts line 1066]

### Pitfall 4: Sorting mutates the original articles array

**What goes wrong:** `Array.prototype.sort` mutates in-place. `feed.articles` is part of React Query's cached data — mutating it causes cache corruption and unexpected re-renders.

**How to avoid:** Always spread before sorting: `[...feed.articles].sort(...)`. For filtered subsets also spread before sort: `[...filtered].sort(...)`.

### Pitfall 5: element_id null check in match logic

**What goes wrong:** `TransferNewsArticle.element_id` is typed `number | null` [VERIFIED: types.ts line 1079]. A filter of `a.element_id === player.id` will never match null, but `a.element_id === null` must not accidentally match a player with id 0 or similar.

**How to avoid:** The filter `a.classification === 'confirmed_signing' && a.element_id === player.id` is safe because `player.id` is always a positive integer in FPL data; `null === positiveInt` is always false in JavaScript.

### Pitfall 6: Missing `'use client'` directive on SummerWindowTab

**What goes wrong:** `SummerWindowTab` uses `useState` and `useTransferNews` (both client-only). Without `'use client'` at the top, Next.js 16 will throw a server component error.

**How to avoid:** Add `'use client'` as the first line of `src/components/news/SummerWindowTab.tsx`.

---

## Code Examples

### ConfirmedSigningBadge (full implementation)

```tsx
// Source: UI-SPEC.md §WIN-02: ConfirmedSigningBadge — verified against MinsRiskBadge/StatusLabelBadge shape contract
export function ConfirmedSigningBadge({ tooltipText }: { tooltipText: string }) {
  return (
    <span
      className="inline-block text-xs font-normal text-green-800 bg-green-100 dark:bg-green-900 dark:text-green-200 rounded px-2 py-1"
      title={tooltipText}
    >
      Confirmed Signing
    </span>
  )
}
```

### Match helper (reusable across GemTable + PlayerMoveCell)

```ts
// Source: CONTEXT.md D-12, UI-SPEC.md §WIN-02
import type { TransferNewsArticle } from '@/lib/types'

const SOURCE_NAME: Record<'skysports' | 'bbc', string> = {
  skysports: 'Sky Sports',
  bbc: 'BBC Sport',
}

export function findConfirmedSigningArticle(
  articles: TransferNewsArticle[],
  elementId: number
): TransferNewsArticle | undefined {
  return articles
    .filter(a => a.classification === 'confirmed_signing' && a.element_id === elementId)
    .sort((a, b) => {
      const ta = new Date(a.published ?? a.scraped_at).getTime()
      const tb = new Date(b.published ?? b.scraped_at).getTime()
      return tb - ta
    })[0]
}

export function signingTooltip(article: TransferNewsArticle): string {
  return `${article.title} · ${SOURCE_NAME[article.source]}`
}
```

### Stale banner (SummerWindowTab)

```tsx
// Source: UI-SPEC.md §Stale feed banner — colours verified against LastUpdated.tsx stale token
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000

function StaleBanner({ scrapedAt }: { scrapedAt: string }) {
  const isStale = Date.now() - new Date(scrapedAt).getTime() > STALE_THRESHOLD_MS
  if (!isStale) return null
  return (
    <div className="flex items-center gap-2 rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
      <span aria-hidden="true">⚠</span>
      Feed last updated {formatRelativeTime(scrapedAt)} — may not reflect latest news.
    </div>
  )
}
```

### Filter pills (SummerWindowTab)

```tsx
// Source: UI-SPEC.md §Filter pill row — CSS classes verified against AccuracyTab PositionTabSelector
import type { TransferClass } from '@/lib/types'

const PILLS = [
  { value: 'all' as const,               label: 'All'       },
  { value: 'confirmed_signing' as const, label: 'Confirmed' },
  { value: 'rumour' as const,            label: 'Rumour'    },
  { value: 'injury_return' as const,     label: 'Injury'    },
  { value: 'rotation_signal' as const,   label: 'Rotation'  },
] satisfies ReadonlyArray<{ value: TransferClass | 'all'; label: string }>

// State:
const [activeFilter, setActiveFilter] = useState<TransferClass | 'all'>('all')
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Per-component fetch of news data | TanStack Query cache with `queryKey: ['transfer-news']` | All three components (SummerWindowTab, GemTable, PlayerMoveCell) share a single fetch; no duplicate network calls |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | — | — | — |

**All claims in this research were verified or cited — no user confirmation needed.**

---

## Open Questions

None. All integration points verified against live codebase.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code/config changes. No external dependencies beyond the already-running Next.js 16 development environment.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/components/shared/ConfirmedSigningBadge.test.tsx` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WIN-01 | SummerWindowTab renders article cards from feed | unit (render) | `npx vitest run src/components/news/SummerWindowTab.test.tsx` | ❌ Wave 0 |
| WIN-01 | Filter pills update displayed articles | unit (render) | `npx vitest run src/components/news/SummerWindowTab.test.tsx` | ❌ Wave 0 |
| WIN-01 | Empty state shown when no articles match filter | unit (render) | `npx vitest run src/components/news/SummerWindowTab.test.tsx` | ❌ Wave 0 |
| WIN-01 | Stale banner shown when scraped_at > 24h old | unit (render) | `npx vitest run src/components/news/SummerWindowTab.test.tsx` | ❌ Wave 0 |
| WIN-02 | ConfirmedSigningBadge renders correct text and green classes | unit (render) | `npx vitest run src/components/shared/ConfirmedSigningBadge.test.tsx` | ❌ Wave 0 |
| WIN-02 | ConfirmedSigningBadge title attribute matches tooltip format | unit (render) | `npx vitest run src/components/shared/ConfirmedSigningBadge.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/components/shared/ConfirmedSigningBadge.test.tsx src/components/news/SummerWindowTab.test.tsx`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/components/shared/ConfirmedSigningBadge.test.tsx` — covers WIN-02 badge contract
- [ ] `src/components/news/SummerWindowTab.test.tsx` — covers WIN-01 feed tab behaviours

*(Existing test infrastructure: Vitest 4.1.2 + jsdom + @testing-library/react already configured. No framework install needed.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes (limited) | Article URLs rendered in `<a href>` — Next.js/React auto-escapes attribute values; no `dangerouslySetInnerHTML` used anywhere in this phase |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Open redirect via article.url | Tampering | `<a target="_blank" rel="noopener noreferrer">` prevents tab-napping; URL is from Vercel Blob artifact (server-controlled) not user input |
| XSS via article title in tooltip | Tampering | `title` attribute on React `<span>` — React escapes string interpolation; no `innerHTML` |

---

## Sources

### Primary (HIGH confidence)

- [VERIFIED: src/app/page.tsx] — SubTab union (line 57), SECTIONS array (lines 59–100), render conditions (lines 247–304), sectionMemory initialiser (lines 104–108)
- [VERIFIED: src/lib/hooks/useTransferNews.ts] — Hook signature, return type, queryKey, staleTime
- [VERIFIED: src/lib/types.ts lines 1063–1091] — TransferClass, TransferNewsArticle, TransferNewsFeed type definitions
- [VERIFIED: src/components/gem-table/GemTable.tsx lines 340–415] — Both expanded row blocks, FragilityBadge placement at lines 372–373 and 401–402
- [VERIFIED: src/components/transfers/OpportunityCostTable.tsx lines 108–176] — PlayerMoveCell buy cluster, existing badge order (RotationRiskBadge → StatusLabelBadge → MinsRiskBadge → NewsBanner)
- [VERIFIED: src/components/shared/MinsRiskBadge.tsx] — Shape contract `inline-block text-xs font-normal ... rounded px-2 py-1`, green "nailed" token
- [VERIFIED: src/components/shared/StatusLabelBadge.tsx] — Shape contract confirmation
- [VERIFIED: src/components/shared/VerdictBadge.tsx] — Green "buy" token confirmation
- [VERIFIED: src/components/shared/FragilityBadge.tsx] — Non-pill style (text-only, no bg); confirmed ConfirmedSigningBadge must NOT follow this pattern
- [VERIFIED: src/components/accuracy/AccuracyTab.tsx lines 254–298] — POSITION_PILLS pattern, exact filter pill CSS classes
- [VERIFIED: src/components/LastUpdated.tsx] — Stale banner amber token classes
- [VERIFIED: src/lib/formatRelativeTime.ts] — Function signature `(isoTimestamp: string, nowMs?: number): string`
- [VERIFIED: src/components/nav/MobileNav.tsx] — MobileNav derives from SECTIONS import; no separate registration
- [VERIFIED: package.json] — No new dependencies needed; Vitest 4.1.2 already installed
- [VERIFIED: vitest.config.ts] — jsdom environment, setupFiles, path aliases

### Secondary (MEDIUM confidence)

- [CITED: .planning/phases/125-summer-window-tracker/125-CONTEXT.md] — All locked decisions D-01 through D-17
- [CITED: .planning/phases/125-summer-window-tracker/125-UI-SPEC.md] — Complete JSX markup, Tailwind classes, colour contracts, component inventory

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json
- Architecture: HIGH — all integration points verified in live source files
- Pitfalls: HIGH — derived from direct code inspection of both expansion blocks and hook rules
- Test patterns: HIGH — verified against existing StatusLabelBadge.test.tsx and MinsRiskBadge.test.tsx

**Research date:** 2026-05-19
**Valid until:** 2026-06-18 (stable codebase; 30 day window)
