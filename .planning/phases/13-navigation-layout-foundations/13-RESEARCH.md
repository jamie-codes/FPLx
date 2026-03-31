# Phase 13: Navigation + Layout Foundations - Research

**Researched:** 2026-03-31
**Domain:** Responsive mobile navigation, Tailwind v4 breakpoints, iOS safe-area, touch targets
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from STATE.md decisions)

### Locked Decisions
- CSS-only show/hide (`hidden sm:flex`, `sm:hidden`) for nav — no `useMediaQuery` hook; avoids hydration mismatch
- `sm` breakpoint (640px) chosen for mobile/desktop boundary — phones are <=480px, tablets get full desktop layout
- Tab state stays in page.tsx; MobileNav receives activeTab/onTabChange as props — no new context needed
- This is Tailwind CSS v4 (breaking changes from v3)

### Claude's Discretion
- MobileNav component structure and file location
- Exact icon choices for the 5 tabs
- Padding values for bottom nav bar height
- How to express `env(safe-area-inset-bottom)` in Tailwind v4 (arbitrary value vs. custom CSS class)

### Deferred Ideas (OUT OF SCOPE)
- Swipe-between-tabs gestures (conflicts with horizontal table scroll)
- Column-picker UI
- Progressive Web App manifest
- Separate /mobile route
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MOB-NAV-01 | Fixed bottom tab bar with 5 tabs on screens < 768px, replacing top horizontal tab strip | CSS-only show/hide with Tailwind `sm:hidden` / `hidden sm:flex` pattern; `sm` = 640px so `max-sm:` targets < 640px; requirement says < 768px but LOCKED decision uses 640px sm breakpoint |
| MOB-NAV-02 | Desktop top tab strip unchanged (>=768px); bottom tab bar hidden on desktop | `hidden sm:flex` on desktop strip, `sm:hidden` on mobile nav — both keyed to same `sm` breakpoint |
| MOB-NAV-03 | Bottom tab bar inset above iOS home indicator via `env(safe-area-inset-bottom)` | Requires `viewportFit: 'cover'` in Next.js 16 `viewport` export; arbitrary Tailwind value `pb-[env(safe-area-inset-bottom)]` or custom CSS class in globals.css |
| MOB-LAY-01 | All tab content renders single-column at 375px — no horizontal overflow | `main` needs `overflow-x-hidden` or `max-w-full`; tables already use `overflow-x-auto` wrapper; existing `px-4` padding on `<main>` must be preserved |
| MOB-LAY-02 | Scrollable content has sufficient bottom padding to clear fixed bottom nav | `pb-20` or similar on `<main>` at `max-sm:` breakpoint — only applies on mobile where bottom nav exists |
| MOB-TOUCH-01 | All interactive elements have minimum 44x44px tap target | Filter pills need `min-h-11` (44px); GwToggle buttons need `py-3`; sort headers need `py-2.5 min-h-[44px]`; tab bar items need `min-h-[44px]` |
| MOB-TOUCH-02 | All `<input>` fields display at 16px font size on mobile | TransferPanel has 3 `<input>` fields currently using `text-sm` (14px); add `text-base sm:text-sm` or `max-sm:text-base` to all inputs |
| MOB-TOUCH-03 | All buttons and tab items apply `active:scale-95` for tap feedback | Add `active:scale-95 transition-transform` to PositionFilter pills, GwToggle buttons, tab items |
</phase_requirements>

---

## Summary

Phase 13 establishes the mobile navigation contract that all subsequent phases depend on. The work is CSS-only responsive styling — no new routing, no new data fetching, no state management changes beyond adding a `MobileNav` component that receives `activeTab`/`onTabChange` props from the existing `page.tsx` state.

The three structural changes are: (1) add a `MobileNav` component rendered at the bottom of `<main>` visible only on mobile, (2) hide the existing horizontal tab strip on mobile, and (3) ensure the page layout accounts for the fixed bar height (content padding) and iOS safe area (viewport meta + `env()` inset on the nav bar).

Touch compliance (MOB-TOUCH-01 through 03) requires audit and targeted enlargement of several existing interactive elements: the PositionFilter pills, GwToggle buttons, all three `<input>` fields in TransferPanel, and all `<th>` sort headers in GemTable. None of these require component rewrites — only className additions.

**Primary recommendation:** Build MobileNav as a new `src/components/nav/MobileNav.tsx`. Make all edits to page.tsx, layout.tsx (viewport export), globals.css (safe-area utility), and existing interactive components in that order.

---

## Standard Stack

### Core (already installed, no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tailwindcss | 4.2.2 | Responsive utilities, `sm:` breakpoints, `active:` variants | Already in project; v4 `max-sm:` replaces v3 workarounds |
| React | 19.2.4 | Component rendering | Already in project |
| Next.js | 16.2.1 | `viewport` export for `viewportFit: 'cover'` | Already in project |

### No new packages required

The entire phase is implementable with:
- Tailwind v4 utility classes (already installed)
- Raw CSS `env(safe-area-inset-bottom)` via Tailwind arbitrary value syntax
- Next.js `viewport` export in `layout.tsx`

**Do not install** `tailwindcss-safe-area` plugin — the arbitrary value `pb-[env(safe-area-inset-bottom)]` is sufficient and keeps dependencies clean.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── layout.tsx          # ADD: viewport export with viewportFit: 'cover'
│   └── page.tsx            # EDIT: add MobileNav, hide top strip on mobile, add pb for bottom nav
├── components/
│   ├── nav/
│   │   └── MobileNav.tsx   # NEW: bottom tab bar component
│   ├── gem-table/
│   │   ├── GemTable.tsx    # EDIT: sort header tap targets
│   │   ├── GwToggle.tsx    # EDIT: tap targets + active:scale-95
│   │   └── PositionFilter.tsx  # EDIT: tap targets + active:scale-95
│   └── transfers/
│       └── TransferPanel.tsx   # EDIT: input font sizes
```

### Pattern 1: CSS-only nav show/hide (LOCKED DECISION)

**What:** The top tab strip gets `hidden sm:flex` (hidden on mobile, flex row on desktop). MobileNav gets `sm:hidden` (visible on mobile, hidden on desktop). No JavaScript media query check.

**Why:** Eliminates hydration mismatch. Server renders both; CSS hides the appropriate one at each viewport.

**Example:**
```tsx
{/* Top tab strip — hidden on mobile, shown on desktop */}
<div className="hidden sm:flex gap-4 mb-6 border-b border-zinc-200">
  {/* existing tab buttons */}
</div>

{/* Mobile bottom nav — shown on mobile, hidden on desktop */}
<MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
```

### Pattern 2: MobileNav component structure

**What:** Fixed-position bar, full-width, at `bottom: 0`. Five tab items as `<button>` elements. Uses `env(safe-area-inset-bottom)` for iOS home indicator clearance.

**Example:**
```tsx
// src/components/nav/MobileNav.tsx
'use client'

type Tab = 'gems' | 'defcon' | 'squad' | 'club-form' | 'value-gems'

const TABS = [
  { id: 'gems',       label: 'Gems'      },
  { id: 'defcon',     label: 'DefCon'    },
  { id: 'squad',      label: 'Squad'     },
  { id: 'club-form',  label: 'Club Form' },
  { id: 'value-gems', label: 'Values'    },
] as const

interface Props {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

export function MobileNav({ activeTab, onTabChange }: Props) {
  return (
    <nav
      className="sm:hidden fixed bottom-0 inset-x-0 bg-white border-t border-zinc-200 nav-safe-bottom z-50"
      aria-label="Mobile navigation"
    >
      <div className="flex">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            aria-current={activeTab === id ? 'page' : undefined}
            className={`flex-1 flex flex-col items-center justify-center min-h-[44px] py-2 text-xs font-medium
              active:scale-95 transition-transform
              ${activeTab === id ? 'text-zinc-900' : 'text-zinc-400'}`}
          >
            {label}
          </button>
        ))}
      </div>
    </nav>
  )
}
```

The `.nav-safe-bottom` class is defined in `globals.css`:
```css
.nav-safe-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}
```

### Pattern 3: viewport export for safe-area support (Next.js 16)

**What:** Export `viewport` const from `layout.tsx`. This is a Server Component export — not placed inside `metadata`. Requires `viewportFit: 'cover'` so the browser exposes `env(safe-area-inset-bottom)` values.

**Example:**
```tsx
// src/app/layout.tsx
import type { Viewport } from 'next'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}
```

**Critical:** Without `viewportFit: 'cover'`, `env(safe-area-inset-bottom)` evaluates to `0` and the home indicator overlap fix has no effect. This is a prerequisite for MOB-NAV-03.

### Pattern 4: Content bottom padding for fixed nav

**What:** The `<main>` element in `page.tsx` needs extra bottom padding on mobile so that the last visible content row is not obscured by the fixed 44px+ nav bar.

**Example:**
```tsx
// page.tsx — <main> element
<main className="max-w-7xl mx-auto px-4 pt-2 pb-8 sm:pb-8 pb-24">
```

In Tailwind v4, the `max-sm:` prefix targets `@media (width < 40rem)` (640px). Since the fixed nav only renders on mobile, padding only needs to apply there:
```tsx
<main className="max-w-7xl mx-auto px-4 pt-2 pb-8 max-sm:pb-24">
```

`pb-24` = 96px — enough to clear a ~56px nav bar + safe area inset.

### Pattern 5: Tap target enforcement

**What:** 44px is Apple's Human Interface Guidelines minimum. The Tailwind utility is `min-h-[44px]` (or `min-h-11` which = 44px in Tailwind v4 spacing where 1 unit = 4px, so `11 * 4 = 44px`).

**Current gap (needs fixing):**

| Element | Current | Fix |
|---------|---------|-----|
| PositionFilter pills | `py-1` (~28px) | `py-2.5` or `min-h-[44px]` |
| GwToggle buttons | `py-1` (~28px) | `py-2.5 sm:py-1` |
| GemTable sort `<th>` | `py-1` (~28px) | `py-2.5 sm:py-1` |
| MobileNav tab items | (new) | `min-h-[44px]` built in |

**Verification:** `min-h-11` in Tailwind v4 — confirm `11 * 4px = 44px`. Tailwind v4 uses 4px base spacing so `h-11 = 44px`. Confirmed from theme.css: `--spacing: 0.25rem` (4px).

### Pattern 6: Input font size (iOS zoom prevention)

**What:** iOS Safari auto-zooms the viewport when an `<input>` receives focus if its `font-size` is less than 16px. The fix is `font-size: 16px` on the input element on mobile. In Tailwind that's `text-base` (16px).

**Current inputs in TransferPanel.tsx:**
- Team ID input: `text-sm` (14px) — triggers zoom
- Free transfers input: `text-sm` (14px) — triggers zoom
- Token input: `text-xs` (12px) — triggers zoom

**Fix pattern:**
```tsx
// Before
className="... text-sm ..."
// After — 16px on mobile, reverts to 14px on desktop
className="... text-base sm:text-sm ..."
```

**Important:** Do NOT set `maximum-scale=1` or `user-scalable=no` as the viewport zoom workaround — this harms accessibility. The 16px font size fix is the correct approach.

### Anti-Patterns to Avoid

- **`useMediaQuery` hook for nav visibility:** Causes hydration mismatch (server renders one state, client re-renders after JS loads). Use CSS-only `hidden sm:flex` / `sm:hidden`.
- **`maximum-scale=1` in viewport to prevent input zoom:** Disables user zoom entirely, fails accessibility audits. Use 16px input font size instead.
- **Hardcoding nav bar height:** Use `env(safe-area-inset-bottom)` + Tailwind padding. Hardcoded heights break on iPhone 14 Pro Max vs SE.
- **Rendering MobileNav inside each tab component:** State must stay in page.tsx; nav is a sibling to the tab content, not a child.
- **`fixed` positioning without `z-index`:** Other elements with transforms can create stacking contexts that obscure the nav. Always add `z-50`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| iOS home indicator clearance | Custom JS to detect device | `env(safe-area-inset-bottom)` + `viewportFit: 'cover'` | CSS env() is the W3C standard; works on all notched iPhones |
| Mobile breakpoint detection | `useMediaQuery` hook | Tailwind `sm:hidden` / `hidden sm:flex` | No hydration mismatch, no JS overhead |
| Tap target size enforcement | Custom padding calculation | Tailwind `min-h-[44px]` or `min-h-11` | Declarative, readable, no custom logic |
| Input zoom prevention | JS focus handler resizing viewport | `text-base sm:text-sm` on inputs | Browser-native, no JS required |

**Key insight:** Every mobile UX requirement in this phase is solvable with CSS alone. Any JavaScript solution introduces hydration risk and additional complexity.

---

## Common Pitfalls

### Pitfall 1: `env(safe-area-inset-bottom)` evaluates to 0

**What goes wrong:** The bottom nav bar still gets obscured by the iOS home indicator after adding the `env()` padding.

**Why it happens:** `viewportFit: 'cover'` was not added to the Next.js `viewport` export. Without it, the browser does not expose safe area insets.

**How to avoid:** Always add `viewportFit: 'cover'` in `layout.tsx` BEFORE testing safe area.

**Warning signs:** `env(safe-area-inset-bottom)` computed value = `0px` in DevTools.

### Pitfall 2: Tailwind `sm:` targets 640px, requirement says 768px

**What goes wrong:** The nav switches at 640px instead of the 768px stated in MOB-NAV-01/02.

**Why it happens:** The LOCKED decision uses the `sm` breakpoint (640px) as the mobile/desktop boundary, even though the requirements document states 768px.

**How to avoid:** The locked decision overrides the requirements verbatim — use `sm:` (640px). Tablets (640–768px) will get the desktop layout. This is intentional.

**Note for planner:** MOB-NAV-01 says "narrower than 768px" but the locked decision is 640px. Plan tasks to use `sm:` (640px). The discrepancy is acknowledged.

### Pitfall 3: Fixed bottom nav creates scroll issues

**What goes wrong:** Fixed elements in iOS Safari can cause `overflow: hidden` to stop working on ancestor elements, or the bottom of the page content is hidden behind the nav bar even with padding.

**Why it happens:** `position: fixed` on iOS Safari has several quirks with `overflow` containers.

**How to avoid:** Add `max-sm:pb-24` to `<main>` so content is never obscured. Do NOT rely on `margin-bottom` inside scrollable content — use padding on the scroll container.

### Pitfall 4: `active:scale-95` not triggering on iOS

**What goes wrong:** The tap scale animation does nothing on an iPhone.

**Why it happens:** `:active` pseudo-class requires a `touch-action` policy on iOS. iOS Safari historically did not fire `:active` on non-link elements without `cursor: pointer` or `touch-action: manipulation`.

**How to avoid:** Add `cursor-pointer touch-action-manipulation` or include `touch-action: manipulation` via a CSS class on all tappable elements. In Tailwind v4: `cursor-pointer` is sufficient in most modern iOS (15+) but `touch-action: manipulation` eliminates the 300ms delay on older devices.

**Tailwind class:** `cursor-pointer` on all buttons covers this for iOS 15+. Add `[touch-action:manipulation]` arbitrary property for iOS 14 and older if needed.

### Pitfall 5: `hidden sm:flex` causes layout shift on first paint

**What goes wrong:** A brief flash where both the top strip and bottom nav are visible before CSS loads.

**Why it happens:** On very slow connections, HTML loads before CSS.

**How to avoid:** This is acceptable for a Next.js app — CSS is inlined by Next.js in production for the initial render. No special handling needed.

---

## Code Examples

Verified patterns from official sources and confirmed with installed package versions:

### Tailwind v4 — `max-sm:` variant (targets < 640px)
```css
/* Source: tailwindcss 4.2.2 theme.css — --breakpoint-sm: 40rem (640px) */
/* max-sm: generates @media (width < 40rem) */
```
```html
<!-- Show only on mobile (<640px) -->
<nav class="sm:hidden fixed bottom-0 ...">
<!-- Show only on desktop (>=640px) -->
<div class="hidden sm:flex ...">
```

### Next.js 16 — viewport export with viewportFit
```tsx
// Source: node_modules/next/dist/lib/metadata/types/extra-types.d.ts
// viewportFit: 'auto' | 'cover' | 'contain'
import type { Viewport } from 'next'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}
```

### Safe area inset via globals.css (not Tailwind arbitrary)
```css
/* globals.css — custom utility class approach */
.nav-safe-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}
```
Alternative: Tailwind arbitrary value `pb-[env(safe-area-inset-bottom)]` — both approaches work; custom class is more readable.

### 44px tap target on filter pills
```tsx
// PositionFilter.tsx — before: py-1 (~28px), after: py-2.5 (~44px on mobile)
className={`px-3 py-2.5 sm:py-1 rounded text-sm font-medium cursor-pointer transition-colors active:scale-95 transition-transform ...`}
```

### 16px input font to prevent iOS zoom
```tsx
// TransferPanel.tsx — before: text-sm (14px), after: 16px on mobile
className="border border-zinc-300 rounded px-3 py-1.5 text-base sm:text-sm ..."
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` for custom breakpoints | `@theme { --breakpoint-sm: 40rem; }` in CSS | Tailwind v4 | No JS config file needed |
| `sm:max-md:hidden` for breakpoint ranges | `max-sm:hidden` dedicated max-* variants | Tailwind v4 | Cleaner syntax |
| `metadata.viewport` in Next.js | `export const viewport: Viewport` | Next.js 14 | Separated from metadata |
| `maximum-scale=1` to prevent input zoom | 16px font-size on inputs | Always wrong, now widely understood | Accessibility improvement |
| `@tailwindcss/postcss` via `tailwind.config.js` | `@import "tailwindcss"` in globals.css | Tailwind v4 | Project already using this correctly |

**Deprecated/outdated:**
- `metadata.viewport` string: deprecated since Next.js 14, use `export const viewport: Viewport`
- `tailwind.config.js` for breakpoints: replaced by `@theme` CSS directive in Tailwind v4
- `sm:max-md:hidden` range syntax: still works but `max-sm:hidden` is the v4 idiom

---

## Open Questions

1. **Tab labels on 5-item bottom nav at 375px**
   - What we know: 375px / 5 tabs = 75px per tab. "Club Form" is 9 chars, "DefCon" is 6 chars. At `text-xs` (12px) this fits on one line.
   - What's unclear: "Value Gems" (10 chars) may need to be shortened to "Values" to fit at 12px.
   - Recommendation: Use "Gems", "DefCon", "Squad", "Form", "Values" as tab labels in MobileNav. Verify visually.

2. **Icon usage in MobileNav**
   - What we know: Requirements say "5 labelled tabs" — labels are mandatory. Icons are Claude's discretion.
   - What's unclear: Icons require either an icon library (new dep) or inline SVGs.
   - Recommendation: Use emoji or single-character text labels only (no icon library) to keep Phase 13 scope tight. Phase 17 polish can add icons if desired.

3. **TransferPanel token input at `text-xs` (12px)**
   - What we know: The token paste input uses `text-xs font-mono` for the pasted JWT token. Changing to `text-base` on mobile would make the pasted token very large.
   - What's unclear: Whether MOB-TOUCH-02 applies to the token input (it's a `<input>` field so technically yes).
   - Recommendation: Apply `text-base sm:text-sm` to team ID and free transfers inputs. For the token input, apply `text-base sm:text-xs` — this is correct per the requirement but will look large; acceptable since the user only taps once.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 13 is CSS/component changes only. No external tools, databases, or services beyond the already-running Next.js 16 / Node 25 dev environment.

---

## Validation Architecture

`nyquist_validation` is enabled (not explicitly false in `.planning/config.json`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (exists) |
| Environment | `node` (not jsdom — component rendering tests not currently supported) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Critical note on test environment

The project's `vitest.config.ts` sets `environment: 'node'` — not `jsdom`. This means React component rendering tests (e.g., checking that a component renders a `<nav>` element) are **not supported** in the current test infrastructure without adding `jsdom` or `happy-dom`.

**Consequence:** Phase 13 requirements are predominantly CSS layout and DOM structure concerns that cannot be meaningfully unit-tested in a node environment. The validation strategy relies on:
1. **Build-time:** TypeScript compilation catches prop-type errors in MobileNav
2. **Manual browser testing:** The success criteria explicitly require "on a real phone at 375px" verification — this is inherently manual
3. **Smoke tests:** Can be written for the pure logic portions (none in Phase 13)

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Automated? |
|--------|----------|-----------|-------------------|-----------|
| MOB-NAV-01 | Bottom tab bar renders with 5 tabs | Manual browser | — | No — CSS visibility not testable in node env |
| MOB-NAV-02 | Desktop top strip unchanged | Manual browser | — | No — CSS visibility not testable in node env |
| MOB-NAV-03 | iOS safe area inset applied | Manual device | — | No — requires physical device |
| MOB-LAY-01 | No horizontal overflow at 375px | Manual browser (DevTools mobile) | — | No — layout not testable in node env |
| MOB-LAY-02 | Bottom padding clears nav bar | Manual browser | — | No — visual inspection |
| MOB-TOUCH-01 | 44px tap targets on all interactive elements | TypeScript audit + manual | `npm test` (build check only) | Partial — code review checklist |
| MOB-TOUCH-02 | 16px input font on mobile | TypeScript compile check | `npm test` (build check only) | Partial — code review checklist |
| MOB-TOUCH-03 | `active:scale-95` on buttons + tabs | TypeScript compile check | `npm test` (build check only) | Partial — code review checklist |

### Sampling Rate
- **Per task commit:** `npm test` (build + existing unit tests — confirms no regressions in existing lib logic)
- **Per wave merge:** `npm test` + manual browser check at 375px DevTools simulation
- **Phase gate:** Manual verification on iOS Safari (real device or Xcode Simulator) before `/gsd:verify-work`

### Wave 0 Gaps
- No new test files are needed for Phase 13 (all requirements are visual/CSS, not unit-testable in current node env)
- If jsdom is added: a smoke test asserting MobileNav renders 5 `<button>` elements could be added, but this is out of scope for Phase 13

*(The existing test suite (14 test files in tests/lib/) covers lib logic and should remain green throughout Phase 13 — these are the regression guard.)*

---

## Project Constraints (from CLAUDE.md / AGENTS.md)

**AGENTS.md directive:** "This is NOT the Next.js you know. This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code."

**Verified compliance for Phase 13:**
- `viewport` export pattern: verified in `node_modules/next/dist/lib/metadata/types/extra-types.d.ts` — `viewportFit: 'cover'` is a supported field in `ViewportLayout`
- `metadata` vs `viewport` separation: confirmed deprecated `metadata.viewport` in favour of `export const viewport: Viewport`
- Tailwind v4 breakpoints: verified `--breakpoint-sm: 40rem` in `node_modules/tailwindcss/theme.css`
- `max-sm:` variant: confirmed generates `@media (width < 40rem)` per Tailwind v4 docs
- No `tailwind.config.js` used — project correctly uses `@import "tailwindcss"` in globals.css

**Do not:**
- Add `metadata.viewport` in layout.tsx (deprecated)
- Use `tailwind.config.js` for breakpoint customisation (v4 uses `@theme` in CSS)
- Import `useMediaQuery` from any library (locked decision: CSS-only)

---

## Sources

### Primary (HIGH confidence)
- `node_modules/tailwindcss/theme.css` — breakpoint values (`--breakpoint-sm: 40rem`)
- `node_modules/next/dist/lib/metadata/types/extra-types.d.ts` — `ViewportLayout` type including `viewportFit`
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-viewport.md` — `viewport` export API
- [Tailwind CSS v4 Responsive Design](https://tailwindcss.com/docs/responsive-design) — `max-sm:` and breakpoint range variants

### Secondary (MEDIUM confidence)
- [Next.js Discussion #81264](https://github.com/vercel/next.js/discussions/81264) — `env(safe-area-inset-bottom)` with Next.js and iOS

### Tertiary (LOW confidence — needs manual verification)
- [Skies.dev — iOS bottom padding fix](https://www.skies.dev/mobile-padding) — `env(safe-area-inset-bottom)` pattern

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified from node_modules
- Architecture patterns: HIGH — viewport type verified, Tailwind breakpoints verified
- Pitfalls: HIGH — viewport pitfall from official docs; iOS active: from MDN/known platform behaviour
- Touch target sizes: HIGH — 44px from Apple HIG, Tailwind `h-11 = 44px` verified from theme.css spacing

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable stack — Tailwind v4 and Next.js 16 conventions unlikely to change in 30 days)
