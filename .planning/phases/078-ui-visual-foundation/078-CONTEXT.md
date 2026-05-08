# Phase 78: UI Visual Foundation - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Five deliverables that collectively establish a coherent design system:

1. **VIS-01** — Complete CSS custom property token set (background, surface, elevated surface, text, muted, border, primary/secondary accent, positive/warning/negative) wired into Tailwind `@theme inline`. No hardcoded hex in core layout or card shells.
2. **VIS-02** — Geist Sans applied app-wide (remove the `font-family: Arial` body override); `font-variant-numeric: tabular-nums` on all numeric data columns.
3. **VIS-03** — Section tabs (Analyse/Plan/Squad) and sub-tabs redesigned as filled `rounded-full` pills with a solid-fill active state; nav rows are sticky on scroll.
4. **VIS-04** — Data freshness badge ("Updated X ago") moved into the sticky nav row (right side), visible on every section; refactored as a pill badge with dot indicator; amber when >2h stale.
5. **VIS-05** — Light mode background softened to `#F7F8FC`; dark mode card background deepened to `#111827`; card borders visible via border tokens.

No pipeline changes. All work is CSS, token definitions, and component styling.

</domain>

<decisions>
## Implementation Decisions

### Token System (VIS-01)
- **D-01:** Extend Tailwind v4's `@theme inline` block in `globals.css` so new tokens become first-class Tailwind utility classes (`bg-surface`, `text-muted`, `border-border`). Pattern mirrors how `--font-geist-sans` is already wired. No `var()` syntax in JSX.
- **D-02:** Token scope is **core layout + card shells only** in this phase: `page.tsx`, `MobileNav.tsx`, `globals.css`. Tab content components (InsightsTab, GemTable, DefCon, etc.) keep their existing `zinc-*` classes — a follow-on phase migrates those.
- **D-03:** Accent colour palette — primary: `#22c55e` (green-500); secondary: `#3b82f6` (blue-500); positive: `#22c55e`; warning: `#f59e0b` (amber-500); negative: `#ef4444` (red-500). Matches existing gem/signal colour conventions in the codebase.

### Pill Nav (VIS-03)
- **D-04:** Both section tabs **and** sub-tabs become `rounded-full` filled pills on **desktop**. Removes the `border-b-2` underline pattern entirely. Desktop now matches existing MobileNav pill visual language.
- **D-05:** Active state = solid fill: `bg-zinc-900 text-white` (light mode) / `bg-white text-zinc-900` (dark mode). Consistent with current MobileNav active pill — no new visual pattern needed.
- **D-06:** Update MobileNav to use the new semantic token classes (e.g. `bg-surface-inverted text-surface-inverted-fg` or equivalent) so mobile stays consistent when token values change. Small diff — existing pill shape is correct.

### Sticky Nav (VIS-03)
- **D-07:** Only the **section tabs row and sub-tabs row** stick. The FPLx header row (logo + theme toggle) scrolls away. Saves vertical real estate; matches analytics app convention (Vercel, Linear).
- **D-08:** Sticky wrapper: `sticky top-0 z-40 bg-surface/95 backdrop-blur-sm border-b border-border`. Frosted glass effect prevents content bleed-through when scrolling.

### Freshness Badge (VIS-04)
- **D-09:** Move `LastUpdated` **out of the header row** and into the sticky section-tabs row (right side). It will be visible on every section even after the header scrolls away, satisfying VIS-04.
- **D-10:** Style as a **pill badge with dot indicator**: `rounded-full px-2 py-0.5 text-xs`. Normal state: `bg-surface-elevated text-muted`. Stale (>2h): `bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400` with `⚠` or `●` dot prefix.
- **D-11:** **Refactor `LastUpdated.tsx` in place.** Update the render output to the new pill badge style. Keep `useLastUpdated` hook and stale detection logic unchanged. Update tests to match new markup.

### Background & Card Colors (VIS-05)
- **D-12:** Light mode page background token → `#F7F8FC` (replaces `#ffffff`). Dark mode card/surface token → `#111827` (replaces `#0a0a0a`). These values go into `:root` / `.dark` in `globals.css` and are referenced via the `@theme` token system.

### Claude's Discretion
- Exact token names for the full set (e.g., `--surface`, `--surface-elevated`, `--border`, `--muted`) — follow a semantic naming convention that downstream phases can extend
- Whether to use a `bg-surface/95` opacity shorthand or a separate `--surface-sticky` token for the frosted-glass nav
- Exact padding/gap values for the pill nav rows
- Whether to keep `font-variant-numeric: tabular-nums` as a global CSS rule or as a Tailwind utility applied per-component

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/ROADMAP.md` §Phase 78 — Goal, success criteria, VIS-01 through VIS-05 requirement mapping
- `.planning/REQUIREMENTS.md` §VIS-01, §VIS-02, §VIS-03, §VIS-04, §VIS-05 — full requirement text

### CSS & Token System (primary targets)
- `src/app/globals.css` — current `:root` / `.dark` tokens (`--background`, `--foreground`) and `@theme inline` block; all new tokens go here
- `src/app/layout.tsx` — Geist font loading (`--font-geist-sans`); `body` className chain; the `font-family: Arial` override is in `globals.css` body rule (line 30), not here

### Navigation & Layout (primary targets)
- `src/app/page.tsx` — section nav (lines 177–189, underline style to replace), sub-tab nav (lines 191–209), header row (lines 168–175); sticky wrapper wraps lines ~177–209
- `src/components/nav/MobileNav.tsx` — existing `rounded-full` pill pattern to update to token classes; active: `bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900` (lines ~23–26)

### Freshness Badge (primary targets)
- `src/components/LastUpdated.tsx` — `LastUpdatedDisplay` render function to refactor to pill badge; `stale` prop already present; `useLastUpdated` hook untouched
- `src/components/LastUpdated.test.tsx` — tests to update for new markup
- `src/lib/hooks/useLastUpdated.ts` — stale detection logic; read-only reference

### Pattern References
- `src/components/theme/ThemeToggle.tsx` — positioned in same header row as LastUpdated; may need repositioning when badge moves to sticky nav
- Phase 77 CONTEXT.md: `.planning/phases/077-pitch-visuals-mobile-polish/077-CONTEXT.md` — prior phase decisions (kit images, overflow fixes); no conflicts with Phase 78

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `--font-geist-sans` CSS var in `layout.tsx` — Geist is already loaded; VIS-02 just requires removing the `font-family: Arial` override in `globals.css` body rule
- `LastUpdated` component + `useLastUpdated` hook — stale detection and 30s interval already implemented; only the render shape changes
- `formatRelativeTime` utility in `src/lib/formatRelativeTime.ts` — already used by `LastUpdated`; no changes needed

### Established Patterns
- Tailwind v4 `@theme inline` in `globals.css` — `--font-geist-sans` → `--font-sans` mapping shows the pattern; new color tokens follow the same `--color-{name}: var(--{name})` structure
- MobileNav `rounded-full` pill pattern (lines ~23–26) — the active/inactive visual is the gold standard for this phase; desktop must match it
- `<img>` + `onError` fallback (Phase 77) — established image pattern; no relation to Phase 78 but confirms not to use Next.js `<Image>` for CDN resources
- `min-h-[44px]` on interactive elements — enforce on all new pill nav buttons

### Integration Points
- Sticky nav wraps the two `<nav>` elements in `page.tsx` (section nav ~line 178, sub-tab nav ~line 196); content container starts at ~line 225 — the sticky wrapper must sit between the header div and the content block
- `LastUpdated` currently rendered at `page.tsx` line 172 (inside header div) — moves to the section-tabs sticky row (inside the new sticky wrapper, right side)
- `ThemeToggle` stays in the header div (scrolls away) unless Claude finds a cleaner placement

</code_context>

<specifics>
## Specific Ideas

- Frosted glass nav: `bg-surface/95 backdrop-blur-sm` — user confirmed this over plain solid background
- Freshness badge dot format: `● Updated 2m ago` normal; `⚠ Updated 3h ago` stale — reflects the discussed pill preview
- Active pill colours: `bg-zinc-900 text-white` / `dark:bg-white dark:text-zinc-900` — user confirmed solid fill over ring/outline approach
- Background values are precise: light `#F7F8FC`, dark card `#111827` — these are from the ROADMAP.md success criteria, not approximations

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 78-UI-Visual-Foundation*
*Context gathered: 2026-05-08*
