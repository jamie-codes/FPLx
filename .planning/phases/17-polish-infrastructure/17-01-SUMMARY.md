---
phase: 17-polish-infrastructure
plan: "01"
subsystem: gem-table
tags: [mobile, sticky, back-to-top, ux-polish]
dependency_graph:
  requires: []
  provides: [sticky-filter-bar-mobile, back-to-top-button-mobile]
  affects: [GemTable]
tech_stack:
  added: []
  patterns: [sticky-top-0-sm-static, window-scroll-passive-listener]
key_files:
  created: []
  modified:
    - src/components/gem-table/GemTable.tsx
decisions:
  - Filter bar z-40 sits above sticky thead (z-30) and sticky player column header to prevent player name float-over
  - back-to-top uses isMobile gate plus sm:hidden CSS class as dual safety (consistent with project pattern)
  - bottom-24 (6rem) offset clears mobile nav bar height plus iOS safe area
metrics:
  duration: 74s
  completed: "2026-04-01T11:41:14Z"
  tasks_completed: 2
  files_modified: 1
---

# Phase 17 Plan 01: Mobile GemTable Polish Summary

**One-liner:** Sticky filter bar (z-40 over thead) and scroll-triggered back-to-top button added to GemTable via Tailwind sticky+fixed positioning and passive scroll listener.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Sticky filter bar on mobile (MOB-POL-01) | 5d05050 | src/components/gem-table/GemTable.tsx |
| 2 | Back-to-top button on mobile (MOB-POL-02) | e101003 | src/components/gem-table/GemTable.tsx |

## What Was Built

### Task 1: Sticky Filter Bar (MOB-POL-01)

Modified the filter bar `div` in `GemTable.tsx` (line 103) from `flex justify-between items-center mb-2` to:

```
sticky top-0 sm:static z-40 bg-white py-2 -mx-4 px-4 flex justify-between items-center mb-2 border-b border-gray-100 sm:border-0
```

Key class decisions:
- `sticky top-0` / `sm:static` — sticks on mobile, normal flow on desktop
- `z-40` — sits above sticky thead (z-20/z-30) so player names don't float over filter pills
- `bg-white` — opaque background covers scrolling rows
- `-mx-4 px-4` — extends background to screen edge (compensates for main's `px-4` padding)
- `border-b border-gray-100 sm:border-0` — subtle mobile-only separator

The filter bar was already outside the `overflow-x-auto` wrapper — no DOM restructuring required.

### Task 2: Back-to-Top Button (MOB-POL-02)

Added to `GemTable.tsx`:

1. State: `const [showBackToTop, setShowBackToTop] = useState(false)`
2. Scroll listener: `window.addEventListener('scroll', handleScroll, { passive: true })` — threshold `window.scrollY > window.innerHeight`
3. JSX: `fixed bottom-24 right-4 z-50 bg-zinc-900 text-white rounded-full w-10 h-10`, gated on `isMobile && showBackToTop`, `sm:hidden` safety class, `aria-label="Back to top"`, `window.scrollTo({ top: 0, behavior: 'smooth' })` on click

## Decisions Made

- **z-40 for filter bar:** Existing z-index stack is z-10 (sticky player body cells), z-20 (thead cells), z-30 (sticky player header). z-40 is safe and clears all of them.
- **z-50 for back-to-top:** Above everything including the sticky filter bar (z-40) and mobile nav.
- **Dual gating (isMobile + sm:hidden):** Consistent with Phase 13/14 pattern — `isMobile` prevents DOM render cost, `sm:hidden` is CSS safety net for resize edge cases.
- **bottom-24:** Matches `max-sm:pb-24` on main — clears mobile nav bar + safe area.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all functionality is fully wired. No placeholder data, no hardcoded empty values.

## Self-Check: PASSED

Files exist:
- `src/components/gem-table/GemTable.tsx` — FOUND (modified)

Commits exist:
- 5d05050 (feat(17-01): sticky filter bar on mobile) — FOUND
- e101003 (feat(17-01): back-to-top button on mobile) — FOUND

Build: `npx next build` passed with no errors or TypeScript issues.
