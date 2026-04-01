# Phase 18: Dark Mode — Research

**Researched:** 2026-04-01
**Domain:** Tailwind CSS v4 dark mode, FOUC prevention, Next.js 16 / React 19 inline scripts
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DARK-01 | Toggle in app header; preference persists via localStorage | Tailwind v4 `@custom-variant dark` + inline script + toggle button in `page.tsx` header area |
| DARK-02 | Default to system `prefers-color-scheme` on first visit | Inline script reads `localStorage` first, falls back to `window.matchMedia('(prefers-color-scheme: dark)')` |
| DARK-03 | All components render correctly — no illegible text, no white flash | `dark:` variants on hardcoded colours; FOUC prevention via `<head>` inline script; `suppressHydrationWarning` on `<html>` |
</phase_requirements>

---

## Summary

This project uses Tailwind CSS v4.2.2 with `@import "tailwindcss"` and no `tailwind.config.js`. In Tailwind v4 the `dark:` variant defaults to `prefers-color-scheme: dark` via a media query. To support a user-controlled toggle, the `dark` variant must be re-bound to a CSS class selector using `@custom-variant dark (&:where(.dark, .dark *))` in `globals.css`. Adding the `.dark` class to `<html>` then activates all `dark:` utilities.

FOUC is the central challenge. Next.js 16 with React 19 renders the page on the server before any client JavaScript runs, so a plain `useEffect` that reads localStorage is too late — the page will flash white on initial load for dark-mode users. The established solution is a tiny inline `<script>` injected into the `<html>` element (via `dangerouslySetInnerHTML`) in `layout.tsx` that runs before hydration. `suppressHydrationWarning` on `<html>` is required to silence the resulting mismatch warning.

The codebase has ~200 hardcoded colour class usages across 13 component files. The most colour-dense components are `GemTable`, `TransferPanel`, `SquadView`, and `MobileNav` — each using `bg-white` on sticky/fixed elements that will "float" as bright white bars in dark mode if not addressed. Badge components (`MinsRiskBadge`, `VerdictBadge`, `FixtureBadges`, `CaptaincyPanel`) use semantic colour tokens (green/amber/red/blue on light backgrounds) that need dark-aware counterparts.

**Primary recommendation:** Use `@custom-variant dark` in `globals.css` + an inline FOUC-prevention script in `layout.tsx` + systematic `dark:` class additions per component. Do NOT reach for `next-themes` — it introduces a React 19 script-tag warning and adds dependency weight for what is a 3-file change.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tailwindcss | 4.2.2 (installed) | Dark mode via `dark:` variants | Already in project; v4 supports class-based mode via `@custom-variant` |
| Next.js | 16.2.1 (installed) | SSR layout, inline script injection | `dangerouslySetInnerHTML` on `<script>` in root layout is the documented pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| localStorage | browser built-in | Persist user's theme choice | Read in inline script + write in toggle handler |
| `window.matchMedia` | browser built-in | Detect system preference | Fallback when no localStorage entry exists |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual inline script | `next-themes` ^0.3.0 | next-themes causes a React 19 "Encountered a script tag" warning in Next.js 16.2+; adds dependency; the manual approach is ~30 lines and has no external risks |
| `@custom-variant` class mode | Media-query-only mode | Media-query-only mode satisfies DARK-02 but not DARK-01 (no manual toggle) |
| CSS custom properties for theme | Pure `dark:` Tailwind classes | CSS variables work but add indirection; `dark:` classes are more explicit and consistent with existing project style |

**No new packages needed.** This phase is CSS + a single inline script.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── globals.css          # Add @custom-variant dark + dark :root vars
│   └── layout.tsx           # Add inline FOUC script + suppressHydrationWarning
├── components/
│   ├── ThemeToggle.tsx      # New: toggle button (client component)
│   └── [all existing]       # Add dark: variants per component
```

### Pattern 1: Tailwind v4 Class-Based Dark Mode

**What:** Override the default media-query `dark:` variant with a class-based selector.
**When to use:** Any time a manual toggle is required alongside system preference fallback.

Add to `globals.css` (after `@import "tailwindcss"`):
```css
/* Source: https://tailwindcss.com/docs/dark-mode */
@custom-variant dark (&:where(.dark, .dark *));
```

This makes `dark:bg-zinc-900` activate whenever any ancestor element has `class="dark"`, which will be set on `<html>`.

### Pattern 2: FOUC Prevention Inline Script

**What:** A synchronous script in `<head>` that applies the `.dark` class before first paint.
**When to use:** Any SSR app with user-controlled themes.

```tsx
// Source: tailwindcss.com/docs/dark-mode (Tailwind docs) + vercel/next.js discussion #53063
// In layout.tsx <html> element — add suppressHydrationWarning
// Place script as first child of <html> or <body>

const themeScript = `
  (function() {
    var stored = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (stored === 'dark' || (!stored && prefersDark)) {
      document.documentElement.classList.add('dark');
    }
  })();
`
```

In `layout.tsx`:
```tsx
<html
  lang="en"
  suppressHydrationWarning   // required — classList differs between SSR and client
  className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
>
  <head>
    <script dangerouslySetInnerHTML={{ __html: themeScript }} />
  </head>
  <body className="min-h-full flex flex-col">
    <Providers>{children}</Providers>
  </body>
</html>
```

**Why `suppressHydrationWarning` is required:** The server renders `<html class="...geist vars...">` without `.dark`. The inline script may add `.dark` before React hydrates. React sees a class mismatch and warns. `suppressHydrationWarning` suppresses this one-level-deep warning without disabling child hydration.

### Pattern 3: Toggle Button (Client Component)

**What:** A button that reads/writes `localStorage` and toggles the `.dark` class on `<html>`.
**When to use:** Header area, works with any SSR framework.

```tsx
// ThemeToggle.tsx - 'use client'
'use client'

import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    // Sync state with current DOM state after hydration
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggle() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="p-2 rounded text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
    >
      {isDark ? '☀' : '🌙'}
    </button>
  )
}
```

**Placement:** Inside the header `<div>` in `page.tsx` alongside `<LastUpdated />`. The header is currently:
```tsx
<div className="flex items-center gap-3 mb-2">
  <Image src="/logo.png" alt="fplx logo" width={252} height={120} />
  <div className="ml-auto"><LastUpdated /></div>
</div>
```
The toggle sits between `<LastUpdated />` and the edge, or wraps both in the `ml-auto` div.

### Pattern 4: Dark Variants on CSS Custom Properties

The existing `globals.css` already has CSS variables for background and foreground, driven by a `@media (prefers-color-scheme: dark)`. These must be updated to respond to the `.dark` class instead:

```css
/* Replace existing media query block */
:root {
  --background: #ffffff;
  --foreground: #171717;
}

.dark {
  --background: #0a0a0a;
  --foreground: #ededed;
}
```

Remove the `@media (prefers-color-scheme: dark)` block — the inline script handles the class promotion, so the media query is no longer needed at the CSS level (the `@custom-variant dark` replaces it for all `dark:` utilities).

### Anti-Patterns to Avoid

- **Checking theme in `useEffect` to conditionally render:** `useEffect` runs after paint, causing a flash. Use the inline script approach.
- **Using `useTheme` from next-themes in Next.js 16 + React 19:** Triggers "Encountered a script tag" warning in dev mode; the library renders a `<script>` via `React.createElement` which React 19 flags.
- **Applying `dark:` only to the body/wrapper and relying on inheritance:** Sticky/fixed elements (`MobileNav bg-white`, GemTable sticky thead `bg-white`, filter bar `bg-white`) sit outside normal stacking context and won't inherit; each needs explicit `dark:` classes.
- **Removing `suppressHydrationWarning` from `<html>`:** Without it, React throws hydration warnings in development due to the class mismatch introduced by the inline script.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| System preference detection | Custom media query listener | `window.matchMedia('(prefers-color-scheme: dark)')` | Browser standard, handles updates, no library needed |
| Theme persistence | Custom cookie/session logic | `localStorage.setItem('theme', ...)` | Two lines; localStorage survives page reload without server involvement |
| FOUC prevention | Complex SSR middleware | Inline `<script>` with `dangerouslySetInnerHTML` | Only approach that runs before first paint in Next.js App Router |

**Key insight:** Dark mode in this app is 3 things: one line of CSS (`@custom-variant`), one inline script (~6 lines), and systematic `dark:` class additions. No new packages needed.

---

## Runtime State Inventory

Not applicable — this is a CSS and React component change with no data migration, stored state, or renamed identifiers.

---

## Common Pitfalls

### Pitfall 1: Sticky and Fixed Elements Stay White

**What goes wrong:** `GemTable` thead, the filter bar, `MobileNav`, and the back-to-top button all use `bg-white`. These elements are out of normal flow (sticky/fixed) and will appear as bright white bars floating over a dark background.
**Why it happens:** `dark:bg-zinc-900` on `<body>` does not cascade into `position: sticky` or `position: fixed` elements.
**How to avoid:** Add `dark:bg-zinc-900` (or appropriate dark bg) explicitly to every `bg-white` usage on sticky/fixed elements. Confirmed affected:
- `GemTable.tsx` line 110: `bg-white py-2` (filter bar, sticky)
- `GemTable.tsx` line 119: `bg-white border-b` (thead, sticky)
- `GemTable.tsx` line 127: `bg-white` (sticky player name column in thead)
- `GemTable.tsx` line 159: `bg-white` (sticky player name column in tbody)
- `MobileNav.tsx` line 22: `bg-white border-t` (fixed bottom nav)
- `SquadView.tsx` line 131: `bg-white` (sticky player column in squad table)
- `SquadView.tsx` line 150: `bg-white` (sticky player column in tbody)
**Warning signs:** In dev, visible as white bars in dark mode.

### Pitfall 2: Badge Backgrounds Become Unreadable

**What goes wrong:** Badges like `bg-green-100 text-green-800` were designed for light mode. On a dark background, `bg-green-100` is a very pale green — it still contrasts with text but looks washed out and may fail WCAG against a dark page background.
**Why it happens:** `green-100` is near-white; `green-800` is dark. In dark mode you want near-black backgrounds with lighter text.
**How to avoid:** Use `dark:bg-green-900 dark:text-green-200` pattern for all semantic badge classes. Affected: `MinsRiskBadge`, `VerdictBadge`, `CaptaincyPanel` (TYPE_MAP), `FixtureBadges` (TIER_COLOURS), `TransferPanel` (inline badge spans).
**Warning signs:** Badges look very pale/faded in dark mode.

### Pitfall 3: Table Row Alternating Colours Disappear

**What goes wrong:** `even:bg-gray-50` and `even:bg-zinc-50` are nearly indistinguishable from `bg-white` in dark mode — both map to near-white, so alternating rows lose their visual rhythm.
**Why it happens:** Tailwind's `gray-50` and `zinc-50` are essentially white. In dark mode the base row colour is dark, but the `even:` variant still applies the light colour.
**How to avoid:** Add `even:dark:bg-zinc-800` (or `dark:even:bg-zinc-800` — Tailwind v4 supports both orderings) to all table `<tr>` elements with `even:bg-*` classes.
**Warning signs:** Tables look completely flat / no row separation in dark mode.

### Pitfall 4: Hover States Use Light Colours

**What goes wrong:** `hover:bg-blue-50` on table rows turns a dark row briefly white/light on hover — visible flash.
**Why it happens:** `blue-50` is near-white.
**How to avoid:** Add `dark:hover:bg-zinc-700` or `dark:hover:bg-blue-900` to all `hover:bg-blue-50` and `hover:bg-blue-100` usages.
**Warning signs:** Table row hover flashes light in dark mode.

### Pitfall 5: Input Borders Vanish on Dark Backgrounds

**What goes wrong:** `border-zinc-300` on inputs is very light; against `dark:bg-zinc-900` it becomes invisible.
**Why it happens:** `zinc-300` has low contrast on dark surfaces.
**How to avoid:** Add `dark:border-zinc-600` to all form inputs in `TransferPanel`.
**Warning signs:** Input fields appear borderless in dark mode.

### Pitfall 6: `@media prefers-color-scheme` Block in globals.css Conflicts

**What goes wrong:** The existing `globals.css` `@media (prefers-color-scheme: dark)` block updates `--background` and `--foreground` CSS variables based on system preference, ignoring `localStorage`. If the user set "light" mode but their system is dark, the variables still flip to dark values.
**Why it happens:** The CSS media query runs independently of the JavaScript `.dark` class.
**How to avoid:** Replace the `@media` block with a `.dark { }` selector block. The inline script in `layout.tsx` is responsible for reflecting system preference into the `.dark` class, so the media query is redundant and conflicting.
**Warning signs:** Light mode persists but body background switches to dark on system-dark devices.

---

## Code Examples

Verified patterns from official sources:

### globals.css Final Shape

```css
/* Source: https://tailwindcss.com/docs/dark-mode */
@import "tailwindcss";

/* @custom-variant replaces the default media-query dark: with class-based */
@custom-variant dark (&:where(.dark, .dark *));

:root {
  --background: #ffffff;
  --foreground: #171717;
}

/* Driven by .dark class (set by inline script) instead of @media */
.dark {
  --background: #0a0a0a;
  --foreground: #ededed;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

html, body {
  overflow-x: hidden;
  max-width: 100%;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}

.nav-safe-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}
```

### Inline FOUC Script (in layout.tsx)

```tsx
// Source: https://tailwindcss.com/docs/dark-mode, https://github.com/vercel/next.js/discussions/53063
const themeInitScript = `(function(){
  var t=localStorage.getItem('theme');
  var d=window.matchMedia('(prefers-color-scheme: dark)').matches;
  if(t==='dark'||(t===null&&d)){document.documentElement.classList.add('dark')}
})();`
```

### Systematic dark: Variant Pattern for Badges

```tsx
// Before (light only)
const BADGE_MAP = {
  nailed: { bg: 'bg-green-100', text: 'text-green-800' },
  ...
}

// After (dark-aware)
const BADGE_MAP = {
  nailed: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200' },
  likely_start: { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-200' },
  rotation_risk: { bg: 'bg-amber-100 dark:bg-amber-900', text: 'text-amber-800 dark:text-amber-200' },
  cameo: { bg: 'bg-zinc-100 dark:bg-zinc-700', text: 'text-zinc-600 dark:text-zinc-300' },
}
```

### Table Row Example

```tsx
// Before
<tr className="even:bg-gray-50 hover:bg-blue-50">

// After
<tr className="even:bg-gray-50 dark:even:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-zinc-700">
```

### Sticky Column Dark Background

```tsx
// Before (GemTable thead sticky player name)
<th className="sticky left-0 z-30 bg-white">

// After
<th className="sticky left-0 z-30 bg-white dark:bg-zinc-900">
```

---

## Color Token Audit

Full inventory of hardcoded colour classes in the project (from component scan):

### Backgrounds requiring `dark:` variants
| Token | Count | Dark Replacement | Components |
|-------|-------|-----------------|------------|
| `bg-white` | 12 | `dark:bg-zinc-900` | GemTable (filter bar, thead, sticky cols), MobileNav, SquadView, GwToggle, ValueGemsTable, ClubFormTable |
| `bg-zinc-50` | 8 | `dark:bg-zinc-800` | TransferPanel (cards), CaptaincyPanel (cards), ExplainPanel |
| `bg-gray-50` | 3 | `dark:bg-zinc-800` | GemTable rows, ClubFormTable rows, ValueGemsTable rows |
| `bg-blue-50` | 6 | `dark:bg-blue-950` | GemTable expanded row, TransferPanel chip warning |
| `bg-green-100` | 4 | `dark:bg-green-900` | MinsRiskBadge, VerdictBadge, TransferPanel budget badge |
| `bg-red-100` | 3 | `dark:bg-red-900` | VerdictBadge, TransferPanel budget badge, SquadView error |
| `bg-amber-100` | 3 | `dark:bg-amber-900` | MinsRiskBadge, CaptaincyPanel TYPE_MAP |
| `bg-blue-100` | 3 | `dark:bg-blue-900` | MinsRiskBadge, CaptaincyPanel TYPE_MAP |
| `bg-zinc-100` | 2 | `dark:bg-zinc-700` | MinsRiskBadge (cameo), VerdictBadge (hold) |
| `bg-zinc-900` | 4 | `dark:bg-white` (for text) | GwToggle active, back-to-top button, filter pills |
| `bg-blue-600` | 2 | `dark:bg-blue-500` | PositionFilter active, TransferPanel login button |
| `bg-red-50` | 2 | `dark:bg-red-950` | ExplainPanel budget, TransferPanel error |
| `bg-green-50` | 2 | `dark:bg-green-950` | TransferPanel save recommendation |
| `bg-amber-50` | 1 | `dark:bg-amber-950` | TransferPanel free-hit warning |
| `bg-gray-100` | 1 | `dark:bg-zinc-700` | PositionFilter inactive pills |

### Text colours requiring `dark:` variants
| Token | Count | Dark Replacement |
|-------|-------|-----------------|
| `text-zinc-900` | 16 | `dark:text-zinc-100` |
| `text-zinc-700` | 24 | `dark:text-zinc-300` |
| `text-zinc-600` | 13 | `dark:text-zinc-400` |
| `text-zinc-500` | 30 | `dark:text-zinc-400` |
| `text-zinc-400` | 29 | (acceptable in dark; may need `dark:text-zinc-500`) |
| `text-gray-700` | 4 | `dark:text-zinc-300` |
| `text-gray-500` | 7 | `dark:text-zinc-400` |
| `text-green-800` | 4 | `dark:text-green-200` |
| `text-red-700` | 3 | `dark:text-red-300` |
| `text-amber-800` | 4 | `dark:text-amber-200` |
| `text-blue-800` | 5 | `dark:text-blue-200` |

### Borders requiring `dark:` variants
| Token | Count | Dark Replacement |
|-------|-------|-----------------|
| `border-zinc-200` | 11 | `dark:border-zinc-700` |
| `border-zinc-300` | 5 | `dark:border-zinc-600` |
| `border-zinc-100` | 6 | `dark:border-zinc-800` |
| `border-gray-200` | 3 | `dark:border-zinc-700` |
| `border-gray-100` | 1 | `dark:border-zinc-800` |

### FixtureBadges TIER_COLOURS (most complex colour object)
```tsx
// Before
const TIER_COLOURS = {
  easy:   'bg-green-100 text-green-800 border-green-300',
  medium: 'bg-amber-100 text-amber-800 border-amber-300',
  hard:   'bg-red-100 text-red-800 border-red-300',
}

// After
const TIER_COLOURS = {
  easy:   'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700',
  medium: 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700',
  hard:   'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700',
}
```

---

## Component Complexity Ranking

Ordered by dark mode work required:

1. **TransferPanel.tsx** — highest: inline badge spans (no badge component), form inputs, error/success panels, suggestion cards, many text colours. Recommend extracting the recurring budget badge into a reusable component during this phase.
2. **GemTable.tsx** — multiple sticky `bg-white` instances (filter bar, thead, sticky column × 2), alternating rows, hover colours, back-to-top button.
3. **SquadView.tsx** — sticky player column, many inline `text-zinc-*` usages, StatusBadge with `bg-green-500`/`bg-amber-400`/`bg-red-500` (solid dots — readable in both modes, no change needed).
4. **MobileNav.tsx** — fixed `bg-white`, active/inactive text.
5. **FixtureBadges.tsx** — `TIER_COLOURS` object (3 tier strings), DGW label `text-violet-700`.
6. **CaptaincyPanel.tsx** — `TYPE_MAP` badge configs, card backgrounds.
7. **MinsRiskBadge.tsx** — `BADGE_MAP` (4 badge configs).
8. **VerdictBadge.tsx** — `VERDICT_MAP` (3 badge configs).
9. **PositionFilter.tsx** — active `bg-blue-600`, inactive `bg-gray-100`.
10. **GwToggle.tsx** — active `bg-zinc-900 text-white`, inactive `bg-white`.
11. **DefConTables.tsx** — `distance_to_threshold` cell has inline `text-green-600`/`text-red-600` (fine as-is, semantic).
12. **ClubFormTable.tsx** — `bg-white` thead, alternating rows.
13. **ValueGemsTable.tsx** — filter pills `bg-zinc-900`/`bg-white`, `bg-white` thead.
14. **ExplainPanel.tsx** — `bg-zinc-50`, inline budget colour spans.
15. **LastUpdated.tsx** — `text-amber-600` (stale) / `text-zinc-400` (fresh) — both work in dark mode.
16. **page.tsx** — desktop tab strip: `border-b-2 border-zinc-900 text-zinc-900` active, `border-zinc-200` tab strip. Needs `dark:` variants.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `darkMode: 'class'` in `tailwind.config.js` | `@custom-variant dark (...)` in CSS | Tailwind v4 (2025) | No config file needed; variant defined in globals.css |
| `darkMode: 'media'` default | `prefers-color-scheme` media query via built-in `dark:` variant | Tailwind v4 | Default unchanged; custom variant overrides it |
| `next-themes` ThemeProvider | Manual inline script + toggle button | React 19 + Next.js 16 compatibility | Avoids "Encountered a script tag" warning |

**Deprecated/outdated:**
- `tailwind.config.js darkMode` key: Replaced by `@custom-variant` in CSS — do not create a config file to set this.
- `@tailwind base/components/utilities` directives: Replaced by `@import "tailwindcss"` in v4 — project is already correct.

---

## Open Questions

1. **`dark:` variant ordering in Tailwind v4**
   - What we know: Tailwind v4 supports both `dark:even:bg-zinc-800` and `even:dark:bg-zinc-800`
   - What's unclear: Whether compound variant ordering matters in v4's CSS output
   - Recommendation: Use `dark:even:bg-*` ordering (dark first) for consistency, matching the documented examples

2. **StatusBadge dot colours in SquadView**
   - What we know: `bg-green-500`, `bg-amber-400`, `bg-red-500` are solid coloured dots — these are semantic and visible in both modes
   - What's unclear: Whether they meet WCAG contrast on a dark background for users with reduced vision
   - Recommendation: Leave as-is for this phase (solid colours are readable); flag for accessibility audit later

3. **`text-violet-700` for DGW labels**
   - What we know: Used in `FixtureBadges` and `CaptaincyPanel` on what will be a dark background
   - What's unclear: Whether `violet-700` has sufficient contrast on `dark:bg-zinc-900`
   - Recommendation: Add `dark:text-violet-400` to ensure legibility

---

## Environment Availability

Step 2.6: SKIPPED — this phase involves only CSS class additions and a React component change. No external tooling, CLI utilities, databases, or services are required beyond the already-running Next.js dev server.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DARK-01 | Toggle button in header switches `.dark` class + writes localStorage | manual-only | — | N/A |
| DARK-02 | First visit with system dark preference opens in dark mode, no flash | manual-only | — | N/A |
| DARK-03 | All 5 tabs render no illegible text in dark mode | manual-only | — | N/A |

**Rationale for manual-only:** All three requirements are visual/browser behaviour:
- DARK-01 requires a real browser (localStorage + DOM class toggle)
- DARK-02 requires OS dark preference simulation (DevTools emulation)
- DARK-03 requires visual inspection across 5 tabs

The existing Vitest suite runs in Node environment with no DOM — it is not suited for visual regression or browser-DOM testing without adding Playwright or similar. Adding Playwright is out of scope for this phase.

### Sampling Rate
- **Per task commit:** `npm test` (existing suite — confirms no regressions to logic layer)
- **Per wave merge:** `npm test` + manual browser check of dark mode toggle
- **Phase gate:** Manual verification in browser — system dark + manual toggle + each of the 5 tabs

### Wave 0 Gaps
None for automated tests — the phase is CSS + client-side DOM. The existing test suite covers the logic layer and should continue to pass unchanged.

---

## Sources

### Primary (HIGH confidence)
- `https://tailwindcss.com/docs/dark-mode` — `@custom-variant dark` syntax, class-based mode, combining system + manual
- `node_modules/tailwindcss/package.json` — confirmed version 4.2.2
- `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md` — confirmed Tailwind v4 setup pattern (`@import "tailwindcss"`)
- `src/app/globals.css` — confirmed no tailwind.config.js, `@import "tailwindcss"` pattern, existing `@media` block
- `src/app/layout.tsx` — confirmed `<html>` element structure, no `suppressHydrationWarning` present
- Full component source read — confirmed all colour usage patterns

### Secondary (MEDIUM confidence)
- `https://github.com/vercel/next.js/discussions/53063` — inline script + `dangerouslySetInnerHTML` pattern confirmed for App Router
- `https://github.com/pacocoursey/next-themes` — confirmed `next-themes` attribute="class" approach and React 19 warning issue

### Tertiary (LOW confidence)
- WebSearch finding: React 19 "Encountered a script tag" warning from `next-themes` — corroborated by multiple sources but not directly tested

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md references AGENTS.md which states:

> This is NOT the Next.js you know. This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

**Verified compliance:**
- Next.js guides read from `node_modules/next/dist/docs/` before forming recommendations
- No deprecated `@tailwind base/components/utilities` directives used — project correctly uses `@import "tailwindcss"` (v4)
- No `tailwind.config.js darkMode` key recommended — v4 uses `@custom-variant` in CSS
- Inline script pattern verified against Next.js App Router docs (discussions/53063)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — confirmed via installed `package.json`, Tailwind source, Next.js docs
- Architecture patterns: HIGH — `@custom-variant dark` syntax verified against official Tailwind v4 docs; inline script pattern verified against Next.js discussion
- Pitfalls: HIGH — all identified from direct source code inspection of the actual components; not hypothetical
- Colour audit: HIGH — generated by grep across all `.tsx` files in `src/`

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (Tailwind v4 is stable; Next.js 16 is current)
