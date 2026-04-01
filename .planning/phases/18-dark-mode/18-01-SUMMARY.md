---
phase: 18-dark-mode
plan: 01
subsystem: ui
tags: [tailwind, dark-mode, css, fouc, localStorage, next.js]

# Dependency graph
requires:
  - phase: 13-navigation-layout-foundations
    provides: globals.css, layout.tsx, page.tsx structure used as base
provides:
  - Tailwind v4 class-based dark mode via @custom-variant dark
  - FOUC-prevention inline script in layout.tsx <head>
  - ThemeToggle client component with localStorage persistence
  - ThemeToggle rendered in page.tsx header next to LastUpdated
affects: [18-02, 18-03, all component files needing dark: variants]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "@custom-variant dark (&:where(.dark, .dark *)) for Tailwind v4 class-based dark mode"
    - "Inline <script dangerouslySetInnerHTML> in <head> for FOUC prevention"
    - "suppressHydrationWarning on <html> to suppress class mismatch warning"
    - "ThemeToggle reads DOM after hydration via useEffect + useState(false)"

key-files:
  created:
    - src/components/theme/ThemeToggle.tsx
  modified:
    - src/app/globals.css
    - src/app/layout.tsx
    - src/app/page.tsx

key-decisions:
  - "Replace @media prefers-color-scheme block with .dark class selector — inline script drives system preference into class, media query conflicts"
  - "No next-themes dependency — manual inline script avoids React 19 'Encountered a script tag' warning"
  - "suppressHydrationWarning on <html> only — suppresses one-level class mismatch without disabling child hydration"

patterns-established:
  - "Pattern: FOUC prevention via themeInitScript const + dangerouslySetInnerHTML in layout.tsx <head>"
  - "Pattern: ThemeToggle syncs isDark state from DOM after hydration (not SSR)"

requirements-completed: [DARK-01, DARK-02]

# Metrics
duration: 2min
completed: 2026-04-01
---

# Phase 18 Plan 01: Dark Mode Infrastructure Summary

**Tailwind v4 @custom-variant dark + FOUC-prevention inline script + ThemeToggle button wired to localStorage and .dark class on <html>**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-01T18:10:34Z
- **Completed:** 2026-04-01T18:12:04Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Replaced media-query dark mode with class-based dark variant using Tailwind v4's `@custom-variant dark`
- Added inline FOUC-prevention script to layout.tsx `<head>` — reads localStorage then falls back to system preference
- Created `ThemeToggle.tsx` client component with sun/moon icons, aria-label, localStorage persistence
- Wired `<ThemeToggle />` into page.tsx header alongside `<LastUpdated />`

## Task Commits

Each task was committed atomically:

1. **Task 1: Dark mode CSS infrastructure and FOUC prevention script** - `a195d95` (feat)
2. **Task 2: ThemeToggle component and header integration** - `1c41b67` (feat)

**Plan metadata:** (final commit below)

## Files Created/Modified
- `src/app/globals.css` - Added @custom-variant dark, replaced @media block with .dark selector
- `src/app/layout.tsx` - Added themeInitScript const, inline <script> in <head>, suppressHydrationWarning on <html>
- `src/components/theme/ThemeToggle.tsx` - New client component: toggle button with localStorage + classList.toggle
- `src/app/page.tsx` - Import and render <ThemeToggle /> in header flex div alongside <LastUpdated />

## Decisions Made
- Replaced `@media (prefers-color-scheme: dark)` block with `.dark` class selector — media query would conflict with JS-controlled class (Pitfall 6 from research)
- No `next-themes` — manual inline script avoids React 19 "Encountered a script tag" warning documented in research
- `suppressHydrationWarning` on `<html>` element only — suppresses the class mismatch introduced by the inline script without disabling deeper hydration warnings

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Dark mode infrastructure is complete: toggle works, FOUC prevented, localStorage persists preference
- Phase 18-02 (component theming) can now add `dark:` variants to all component files
- Components without `dark:` variants will still render but backgrounds/text will not adapt to dark mode until 18-02/18-03 address them

---
*Phase: 18-dark-mode*
*Completed: 2026-04-01*
