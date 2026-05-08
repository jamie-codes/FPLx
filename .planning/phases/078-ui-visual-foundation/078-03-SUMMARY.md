---
phase: 078-ui-visual-foundation
plan: "03"
subsystem: ui-components
tags: [tokens, css, tailwind, design-system, visual-foundation, last-updated, mobile-nav]
dependency_graph:
  requires: [078-01]
  provides: [LastUpdated-pill-badge, MobileNav-token-classes]
  affects:
    - src/components/LastUpdated.tsx
    - src/components/LastUpdated.test.tsx
    - src/components/nav/MobileNav.tsx
tech_stack:
  added: []
  patterns: [tailwind-v4-semantic-tokens, pill-badge-pattern, aria-hidden-decorative-icons]
key_files:
  created: []
  modified:
    - src/components/LastUpdated.tsx
    - src/components/LastUpdated.test.tsx
    - src/components/nav/MobileNav.tsx
decisions:
  - "LastUpdatedDisplay renders span pill with if/return pattern (not ternary className) for clear normal/stale separation"
  - "bg-white in MobileNav dark:bg-white retained only as active-state dark-mode fill; bg-surface replaces nav background"
  - "Test text assertions use { exact: false } for getByText to tolerate dot character prefix in span.textContent"
metrics:
  duration: "< 2 minutes"
  completed: "2026-05-08T07:14:41Z"
  tasks_completed: 2
  files_changed: 3
---

# Phase 078 Plan 03: LastUpdated Badge + MobileNav Token Alignment Summary

**One-liner:** LastUpdatedDisplay refactored from <p> to inline-flex span pill badge with dot/warning indicators and semantic token classes; MobileNav bg/border hardcoded zinc classes replaced with bg-surface and border-border tokens.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Refactor LastUpdatedDisplay to span pill badge | eaf556d | src/components/LastUpdated.tsx |
| 2 | Update LastUpdated tests; apply MobileNav token classes | 4b40d28 | src/components/LastUpdated.test.tsx, src/components/nav/MobileNav.tsx |

## What Was Built

### LastUpdated.tsx (VIS-04, D-10, D-11)

`LastUpdatedDisplay` replaced `<p className={...}>` with two `<span>` pill badge branches:

**Normal state (stale === false):**
```tsx
<span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs bg-surface-elevated text-muted">
  <span aria-hidden="true">●</span>
  Updated {relativeTime}
</span>
```

**Stale state (stale === true):**
```tsx
<span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
  <span aria-hidden="true">⚠</span>
  Updated {relativeTime}
</span>
```

Changes from prior implementation:
- `<p>` → `<span>` outer element (inline for flex nav row use)
- `mt-1` removed (badge sits in flex nav row, no margin needed)
- `text-zinc-400` / `dark:text-amber-500` removed (replaced by token classes)
- Added `inline-flex items-center gap-1 rounded-full px-2 py-1` pill shape
- Added `bg-surface-elevated text-muted` semantic tokens (normal)
- Added `bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400` (stale)
- Added `aria-hidden="true"` dot/warning indicator inner spans
- Added `Updated ` static prefix to relativeTime text

### LastUpdated.test.tsx

All 12 tests updated and passing:
- `getDisplayP` helper renamed to `getDisplaySpan`, queries `span` not `p`
- All `getByText` calls updated to include `Updated ` prefix (e.g. `'Updated 1 hour ago'`)
- Zinc colour assertions replaced with `bg-surface-elevated`/`text-muted` for normal state
- Stale colour assertions updated: `dark:text-amber-500` → `dark:text-amber-400`
- `mt-1` assertion removed; pill shape classes (`rounded-full`, `px-2`, `py-1`) asserted
- Connected test no longer queries `container.querySelector('p')` (uses `span`)

### MobileNav.tsx (VIS-03, D-06)

Four targeted class substitutions:

| Location | Before | After |
|----------|--------|-------|
| `<nav>` background | `bg-white dark:bg-zinc-900` | `bg-surface` |
| `<nav>` border | `border-zinc-200 dark:border-zinc-700` | `border-border` |
| Inner `<div>` sub-tab border | `border-zinc-200 dark:border-zinc-700` | `border-border` |
| Sub-tab active dark mode | `dark:bg-zinc-100` | `dark:bg-white` |
| Section button active | `text-zinc-900 dark:text-zinc-100` | `text-foreground` |

Unchanged: pill shape (`rounded-full`), min-h-[44px] touch targets, SECTIONS import, aria attributes, onClick handlers, nav-safe-bottom/z-50/fixed bottom-0 positioning.

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

All plan verification criteria met:

1. `npx vitest run src/components/LastUpdated.test.tsx` → 12/12 passed
2. `grep -c 'border-zinc-200' src/components/nav/MobileNav.tsx` → 0
3. `grep -c '<p ' src/components/LastUpdated.tsx` → 0
4. `grep -c 'bg-surface' src/components/nav/MobileNav.tsx` → 1
5. `npx tsc --noEmit` → exit 0

## Known Stubs

None. Both components are wired to real data (LastUpdated reads from useLastUpdated hook; MobileNav receives props from page.tsx).

## Threat Flags

No new security surface introduced. Changes are pure CSS class string substitutions and component markup refactoring.

## Self-Check: PASSED

- [x] `src/components/LastUpdated.tsx` exists — no `<p>` element, contains `inline-flex rounded-full` pill
- [x] `src/components/LastUpdated.test.tsx` exists — 12 tests pass, no `querySelector('p')`, no `mt-1` assertion
- [x] `src/components/nav/MobileNav.tsx` exists — `bg-surface` present, `border-border` x2, no `border-zinc-200`
- [x] Commit eaf556d exists: `feat(078-03): refactor LastUpdatedDisplay to span pill badge`
- [x] Commit 4b40d28 exists: `feat(078-03): update LastUpdated tests for pill badge; apply token classes in MobileNav`
