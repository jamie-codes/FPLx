# Phase 17: Polish + Infrastructure - Research

**Researched:** 2026-04-01
**Domain:** Mobile CSS polish (sticky filter bar, back-to-top), GitHub Actions cron verification, Vercel Blob last-updated fix
**Confidence:** HIGH

---

## Summary

Phase 17 has three independent workstreams. Two are pure CSS/React polish in `GemTable.tsx` (MOB-POL-01, MOB-POL-02), and one is an infrastructure verification + small code fix (DAT-01).

The sticky filter bar (MOB-POL-01) requires lifting the `PositionFilter` + `GwToggle` row out of normal flow and making it `sticky top-0` on mobile only, with a background so it doesn't bleed through table rows. This is a small DOM restructure inside `GemTable.tsx`.

The back-to-top button (MOB-POL-02) requires a `useEffect` scroll listener (same `window.innerWidth` pattern the project already uses) to detect scroll position and conditionally render a floating button. Tapping it calls `window.scrollTo({ top: 0, behavior: 'smooth' })`. The button is mobile-only and appears after the user scrolls past one viewport height.

DAT-01 has two parts: (1) fix the `/api/last-updated` route which currently reads only from the local filesystem — it has no Vercel Blob read path, unlike `/api/players` which does — so production Vercel deployments never show a fresh timestamp; (2) confirm the GitHub Actions cron has actually executed by checking workflow run history and verifying `last_updated.json` in Blob has a recent timestamp.

**Primary recommendation:** Implement MOB-POL-01 and MOB-POL-02 entirely within `GemTable.tsx` using established project patterns (Tailwind utility classes, `window.innerWidth` scroll listener). Fix DAT-01 by mirroring the Blob-read pattern from `/api/players/route.ts` into `/api/last-updated/route.ts`, then manually trigger the GitHub Actions workflow via `workflow_dispatch` to confirm end-to-end operation.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MOB-POL-01 | GW toggle and position filter row is sticky below the top of the viewport on mobile so the user can filter GemTable without scrolling back to the top | Tailwind `sticky top-0` + `sm:static` on the filter wrapper div; needs `z-index` and background to cover scrolling rows below; thead already uses `sticky top-0 bg-white` as pattern |
| MOB-POL-02 | A "back to top" button appears in GemTable on mobile after the user has scrolled past the first screen of rows | `window.scrollY > window.innerHeight` threshold checked in a scroll listener; `window.scrollTo({ top: 0, behavior: 'smooth' })`; button is `fixed` positioned, mobile-only (`sm:hidden`); project already uses `window.addEventListener('resize', ...)` pattern |
| DAT-01 | Verified automated daily refresh — GitHub Actions cron confirmed operational | `/api/last-updated/route.ts` must read from Vercel Blob when `USE_BLOB=true` (currently reads filesystem only); GitHub Actions cron at `0 7 * * *` writes `last_updated.json` to Blob via `USE_BLOB=true`; verify by checking workflow run history and Blob content |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

AGENTS.md (loaded via CLAUDE.md `@AGENTS.md`) contains one directive:

> **This is NOT the Next.js you know.** This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

- Always verify Next.js patterns against `node_modules/next/dist/docs/` before implementing
- This project uses **Next.js 16.2.1** with **React 19.2.4** — both post-August-2025 releases, ahead of Claude training cutoff
- Tailwind v4 is in use (`@import "tailwindcss"` in globals.css, `@tailwindcss/postcss` devDep) — no `tailwind.config.js`, v4 syntax only
- No `useMediaQuery` hook — project pattern is `window.innerWidth` in a `useEffect` with resize listener, assigned to `isMobile` state
- No new React context — state passed as props
- CSS-only show/hide with `sm:hidden` / `hidden sm:flex` — `sm` breakpoint = 640px

---

## Standard Stack

### Core (already installed — no new dependencies needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | Component rendering, state, effects | Project baseline |
| Next.js | 16.2.1 | App router, route handlers | Project baseline |
| Tailwind CSS | ^4 (v4) | Utility classes for sticky/fixed/z-index/scroll | Already used throughout |
| @vercel/blob | 2.3.1 | Read `last_updated.json` from Blob in production | Already used in `/api/players` |

No new packages required for this phase.

### Tailwind v4 Relevant Utilities
| Utility | Purpose | Notes |
|---------|---------|-------|
| `sticky` | Sticky positioning | Used on `thead` already — same mechanism for filter bar |
| `top-0` | Stick to top of scroll container | Pairs with `sticky` |
| `z-10`, `z-20`, `z-30` | Layer management | thead headers are `z-20`/`z-30`; filter bar needs `z-40` to sit above |
| `bg-white` | Background fill so sticky element covers rows underneath | Pattern from `thead sticky top-0 bg-white` |
| `sm:static` | Override sticky on desktop (≥640px) | Filter bar is NOT sticky on desktop — only mobile |
| `fixed` | Back-to-top button positioning | Floats in corner, outside table flow |
| `sm:hidden` | Hide on desktop | Keeps back-to-top mobile-only |

---

## Architecture Patterns

### Pattern 1: Sticky Filter Bar (MOB-POL-01)

**What:** The `<div>` containing `<PositionFilter>` and `<GwToggle>` inside `GemTable` becomes `sticky top-0` on mobile.

**Key constraint:** The scroll container is `window` (the page scrolls, not an inner div). The `<main>` in `page.tsx` has `overflow-x-hidden` but not `overflow-y: scroll/auto`, so `sticky` works against the nearest scrolling ancestor (the viewport). This is confirmed correct.

**The filter bar is currently:**
```tsx
// GemTable.tsx line 103-106
<div className="flex justify-between items-center mb-2">
  <PositionFilter active={activePosition} onChange={handlePositionChange} />
  <GwToggle value={gwHorizon} onChange={setGwHorizon} />
</div>
```

**Target pattern:**
```tsx
// sticky on mobile, normal flow on desktop
// z-40 sits above sticky thead (z-20) and sticky left column (z-30)
<div className="sticky top-0 sm:static z-40 bg-white py-2 -mx-4 px-4 flex justify-between items-center mb-2">
  <PositionFilter active={activePosition} onChange={handlePositionChange} />
  <GwToggle value={gwHorizon} onChange={setGwHorizon} />
</div>
```

**Z-index stack in GemTable (existing + new):**
| Element | z-index | Class |
|---------|---------|-------|
| Filter bar (new sticky) | 40 | `z-40` |
| Sticky column headers | 30 | `z-30 bg-white` |
| Sticky tbody cells (player name) | 10 | `z-10 bg-white` |
| Sticky thead row | 20 | `z-20` (implied by `sticky top-0`) |

**Anti-pattern:** Do NOT use a separate wrapper component for the sticky bar — keep it as a class change on the existing div in `GemTable.tsx`. Minimises diff.

**Desktop behaviour:** `sm:static` removes stickiness on desktop. The filter bar behaves exactly as it does today.

**Negative space fix:** `-mx-4 px-4` extends the background colour to the screen edge on mobile so the filter bar doesn't show table content peeking through the sides. (The `<main>` has `px-4`.)

### Pattern 2: Back-to-Top Button (MOB-POL-02)

**What:** A floating button rendered conditionally based on `scrollY > window.innerHeight`. Calls `window.scrollTo({ top: 0, behavior: 'smooth' })` on tap.

**Scroll listener pattern (consistent with existing isMobile pattern):**
```tsx
const [showBackToTop, setShowBackToTop] = useState(false)
useEffect(() => {
  const handleScroll = () => setShowBackToTop(window.scrollY > window.innerHeight)
  window.addEventListener('scroll', handleScroll, { passive: true })
  return () => window.removeEventListener('scroll', handleScroll)
}, [])
```

**Placement:** Rendered inside `GemTable` return JSX (or as a sibling), conditionally:
```tsx
{isMobile && showBackToTop && (
  <button
    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    className="fixed bottom-24 right-4 z-50 bg-zinc-900 text-white rounded-full p-3 shadow-lg active:scale-95 transition-transform sm:hidden"
    aria-label="Back to top"
  >
    ↑
  </button>
)}
```

**Bottom offset:** `bottom-24` (6rem) clears the mobile nav bar which is `pb-16` (`max-sm:pb-24` on `<main>`) + safe area. Use `bottom-20` or `bottom-24` — verify against `MobileNav` height.

**The `{ passive: true }` option** is important for scroll performance — prevents jank on mobile.

**Anti-pattern:** Do NOT use IntersectionObserver for this. A simple scroll listener is correct and minimal. Do NOT add `overflow-y: scroll` to a container just to get a scroller — the page scroll is the correct scroll context.

### Pattern 3: last-updated Route Blob Fix (DAT-01)

**What:** `/api/last-updated/route.ts` currently reads only from local filesystem. In production (`USE_BLOB=true`), it will always 404 because `pipeline/cache/last_updated.json` doesn't exist on Vercel's serverless function filesystem. Fix by mirroring the pattern from `/api/players/route.ts`.

**Current (broken in production):**
```ts
// route.ts — reads only from local cache
const cachePath = join(process.cwd(), 'pipeline', 'cache', 'last_updated.json')
const data = await readFile(cachePath, 'utf-8')
```

**Target (mirrors players route):**
```ts
import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'

export async function GET() {
  try {
    let data: string
    if (USE_BLOB) {
      const { blobs } = await list({ prefix: 'last_updated.json', limit: 1 })
      if (!blobs.length) {
        return Response.json({ error: 'Last updated data not available' }, { status: 404 })
      }
      const res = await fetch(blobs[0].url)
      data = await res.text()
    } else {
      const cachePath = join(process.cwd(), 'pipeline', 'cache', 'last_updated.json')
      data = await readFile(cachePath, 'utf-8')
    }
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    })
  } catch {
    return Response.json({ error: 'Last updated data not available' }, { status: 404 })
  }
}
```

**No schema changes needed** — `last_updated.json` written by the pipeline already has `last_updated`, `stale`, `source` fields. `LastUpdated.tsx` and `useLastUpdated.ts` already consume these correctly.

### Pattern 4: GitHub Actions Cron Verification (DAT-01)

**What the workflow does:**
- Schedule: `cron: '0 7 * * *'` — runs daily at 07:00 UTC
- `USE_BLOB=true` env set in the job
- `BLOB_READ_WRITE_TOKEN` loaded from GitHub secret
- Runs `python pipeline/run.py` which calls `save()` → `upload_json()` for each JSON file including `last_updated.json`

**Verification steps (to be done by the executor, not automated):**
1. Go to GitHub → Actions → "Daily Data Pipeline" → check run history for a completed run
2. If no completed run exists: trigger manually via `workflow_dispatch`
3. Confirm run succeeds (green check, no step failures)
4. Confirm `last_updated.json` in Vercel Blob has a recent timestamp (use Vercel dashboard or Blob SDK)
5. Load the deployed app and confirm `LastUpdated` shows a fresh non-stale timestamp

**The `BLOB_READ_WRITE_TOKEN` secret** must already be set in the GitHub repository for the workflow to write to Blob. This cannot be verified from code alone — the executor must check GitHub Settings → Secrets.

### Anti-Patterns to Avoid
- **Overusing `overflow: hidden` on scroll containers** — `sticky` does not work inside an ancestor with `overflow: hidden`. The `overflow-x-hidden` on `<main>` is OK because it only restricts horizontal, not vertical.
- **Setting `position: sticky` without a scroll parent** — the GemTable's table wrapper (`overflow-x-auto`) creates a horizontal scroll context but NOT a vertical one, so vertical `sticky` still works against the page scroll.
- **Using `useMediaQuery`** — project explicitly uses `window.innerWidth` pattern to avoid hydration mismatch.
- **Duplicating isMobile state** — `GemTable` already has `isMobile` state via `window.innerWidth`. The back-to-top render can gate on `isMobile` (in addition to `sm:hidden` on the button) for consistency.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Blob file listing | Custom fetch to blob URL | `@vercel/blob` `list()` | Already used in `/api/players` — exact same pattern |
| Scroll position detection | Polling with `setInterval` | `window.addEventListener('scroll', ..., { passive: true })` | Standard browser API, passive for perf |
| Smooth scroll | Custom easing animation | `window.scrollTo({ top: 0, behavior: 'smooth' })` | Native browser API, all modern mobile browsers support it |

---

## Common Pitfalls

### Pitfall 1: Sticky Inside overflow-x-auto
**What goes wrong:** The `<div className="overflow-x-auto">` wrapper around the `<table>` in GemTable creates a new stacking context. If the sticky filter bar is placed INSIDE this wrapper, it will only stick relative to the table's horizontal scroll container (which clips it), not the viewport.
**Why it happens:** `sticky` positions relative to the nearest scrolling ancestor.
**How to avoid:** Place the sticky filter bar div OUTSIDE the `overflow-x-auto` wrapper. The current structure in `GemTable.tsx` already puts the filter bar above the `overflow-x-auto` div, so no restructuring is needed — only class changes.
**Warning signs:** Filter bar disappears as soon as the user scrolls horizontally.

### Pitfall 2: Z-index Conflicts with Sticky Column
**What goes wrong:** The sticky Player column (`z-30`) appears ABOVE the sticky filter bar, causing player names to "float" over the filter pills.
**Why it happens:** `z-index` is evaluated within stacking contexts. All elements with `position: sticky` create their own stacking context.
**How to avoid:** Give the filter bar `z-40` (higher than the `z-30` column header). Confirmed: existing thead uses `z-30`, tbody sticky cells use `z-10`, so `z-40` for the filter bar is safe.

### Pitfall 3: last-updated Route Not Reading from Blob
**What goes wrong:** On production Vercel, `LastUpdated` always shows "stale" or renders nothing because the route returns 404.
**Why it happens:** The route only reads from `pipeline/cache/last_updated.json` on the filesystem — this path does not exist on Vercel serverless functions.
**How to avoid:** Apply the same `USE_BLOB` branch as in `/api/players/route.ts`.
**Warning signs:** Deploy to Vercel, check `/api/last-updated` — it returns `{ "error": "Last updated data not available" }`.

### Pitfall 4: Back-to-Top z-index Below Mobile Nav
**What goes wrong:** Back-to-top button is hidden behind the fixed mobile nav bar.
**Why it happens:** `MobileNav` is `fixed bottom-0` and uses a high z-index. The back-to-top button needs both a higher `z-index` AND sufficient `bottom` offset.
**How to avoid:** Use `z-50` on the back-to-top button (higher than nav bar). Use `bottom-20` or `bottom-24` — verify visually against nav bar height. The nav bar height is roughly 56px + safe area.

### Pitfall 5: Cron Job BLOB_READ_WRITE_TOKEN Missing
**What goes wrong:** GitHub Actions cron run fails with authentication error when writing to Vercel Blob.
**Why it happens:** `BLOB_READ_WRITE_TOKEN` is referenced in the workflow YAML but the secret may not be set in the GitHub repository settings.
**How to avoid:** Verify in GitHub → Settings → Secrets and variables → Actions that `BLOB_READ_WRITE_TOKEN` exists before triggering the workflow.

---

## Code Examples

### Sticky Filter Bar (MOB-POL-01)
```tsx
// In GemTable.tsx — modify the existing filter row div
// Before (line 103): <div className="flex justify-between items-center mb-2">
// After:
<div className="sticky top-0 sm:static z-40 bg-white py-2 -mx-4 px-4 flex justify-between items-center mb-2 border-b border-gray-100 sm:border-0">
  <PositionFilter active={activePosition} onChange={handlePositionChange} />
  <GwToggle value={gwHorizon} onChange={setGwHorizon} />
</div>
```
Source: Tailwind v4 docs (sticky, z-index utilities); confirmed against project's existing `sticky top-0 bg-white` pattern in thead.

### Back-to-Top Button (MOB-POL-02)
```tsx
// Add state + effect inside GemTable component
const [showBackToTop, setShowBackToTop] = useState(false)
useEffect(() => {
  const handleScroll = () => setShowBackToTop(window.scrollY > window.innerHeight)
  window.addEventListener('scroll', handleScroll, { passive: true })
  return () => window.removeEventListener('scroll', handleScroll)
}, [])

// Add JSX at end of GemTable return, outside overflow-x-auto wrapper
{isMobile && showBackToTop && (
  <button
    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    className="fixed bottom-24 right-4 z-50 bg-zinc-900 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg active:scale-95 transition-transform sm:hidden"
    aria-label="Back to top"
  >
    ↑
  </button>
)}
```
Source: MDN Web API (ScrollToOptions.behavior), project pattern (`window.addEventListener('resize', ...)` in GemTable/PositionFilter).

### last-updated Route Blob Fix (DAT-01)
```ts
// /src/app/api/last-updated/route.ts — full replacement
import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'

export async function GET() {
  try {
    let data: string
    if (USE_BLOB) {
      const { blobs } = await list({ prefix: 'last_updated.json', limit: 1 })
      if (!blobs.length) {
        return Response.json({ error: 'Last updated data not available' }, { status: 404 })
      }
      const res = await fetch(blobs[0].url)
      data = await res.text()
    } else {
      const cachePath = join(process.cwd(), 'pipeline', 'cache', 'last_updated.json')
      data = await readFile(cachePath, 'utf-8')
    }
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    })
  } catch {
    return Response.json({ error: 'Last updated data not available' }, { status: 404 })
  }
}
```
Source: Mirrors `/src/app/api/players/route.ts` exactly (verified in codebase).

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| `tailwind.config.js` for Tailwind setup | `@import "tailwindcss"` in globals.css | Tailwind v4 — no config file needed |
| `useMediaQuery` hook for responsive behaviour | `window.innerWidth` in `useEffect` | Project decision — avoids hydration mismatch in Next.js |
| `IntersectionObserver` for scroll detection | `scroll` event with `passive: true` | Simpler; IntersectionObserver requires a sentinel element |

---

## Environment Availability

Step 2.6: External dependencies for this phase are GitHub Actions (cloud) and Vercel Blob (cloud). No local tools beyond the existing project stack are required. The DAT-01 verification step requires the executor to check GitHub and Vercel dashboards manually — no local CLI audit needed.

| Dependency | Required By | Available | Notes |
|------------|-------------|-----------|-------|
| @vercel/blob | DAT-01 route fix | Already installed (2.3.1) | No install step needed |
| BLOB_READ_WRITE_TOKEN secret | GitHub Actions cron | Must verify in GitHub Settings | Cannot be checked from code |
| GitHub Actions | DAT-01 cron verification | Cloud — always available | Verify via workflow run history |

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.2 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MOB-POL-01 | Sticky filter bar CSS classes present | manual-only (visual) | — | N/A |
| MOB-POL-02 | Back-to-top scroll threshold logic | unit | `npx vitest run src/components/gem-table/` | ❌ Wave 0 |
| DAT-01 | last-updated route reads from blob when USE_BLOB=true | manual (deployed env) | — | N/A |

**MOB-POL-01 rationale for manual-only:** Sticky positioning is a browser layout behaviour — it cannot be asserted in a unit test without a full browser environment (vitest runs in Node with `environment: 'node'`). Visual verification on a device or browser DevTools mobile simulation is the correct gate.

**DAT-01 rationale for manual:** Vercel Blob read requires a live blob URL and valid token — not testable in unit/CI environment without mocking. Manual verification of the deployed route and GitHub Actions run history is the correct gate.

**MOB-POL-02 unit test scope:** The scroll threshold check (`scrollY > innerHeight`) is pure logic that can be extracted and unit-tested. The scroll listener wiring itself requires DOM — not worth mocking in Node environment. Test only the threshold condition.

### Wave 0 Gaps
- [ ] `src/components/gem-table/BackToTop.test.ts` — covers MOB-POL-02 threshold logic (extract `shouldShow(scrollY, innerHeight): boolean` as a pure function)

*(If the back-to-top logic is kept inline in GemTable without extraction, this test gap is acceptable — the behaviour is simple enough that visual verification suffices. The planner should decide whether to extract.)*

---

## Open Questions

1. **Back-to-top `bottom` offset exact value**
   - What we know: `<main>` has `max-sm:pb-24` (6rem = 96px); `MobileNav` is `fixed bottom-0`
   - What's unclear: Exact rendered height of `MobileNav` on iOS with safe area inset — varies by device
   - Recommendation: Use `bottom-24` (96px) as initial value; adjust visually during verification. Document as a visual check in the plan.

2. **Sticky filter bar on desktop when GemTable is not the active tab**
   - What we know: `sm:static` disables stickiness on desktop — no issue
   - What's unclear: Nothing — confirmed non-issue

3. **GitHub Actions BLOB_READ_WRITE_TOKEN secret existence**
   - What we know: The workflow YAML references `secrets.BLOB_READ_WRITE_TOKEN`; the secret may or may not be set
   - What's unclear: Whether the secret is actually configured in the repo
   - Recommendation: Make "verify secret exists" an explicit task step in the plan; if missing, document how to add it (GitHub Settings → Secrets → Actions → New repository secret)

---

## Sources

### Primary (HIGH confidence)
- Codebase: `src/components/gem-table/GemTable.tsx` — existing isMobile pattern, sticky thead pattern, z-index stack
- Codebase: `src/app/api/players/route.ts` — Blob read pattern to mirror for last-updated route
- Codebase: `.github/workflows/pipeline.yml` — GitHub Actions cron schedule and env configuration
- Codebase: `src/app/globals.css` + `package.json` — Tailwind v4 setup confirmed
- `node_modules/next/dist/docs/` — Next.js 16 documentation (verified project uses App Router)

### Secondary (MEDIUM confidence)
- MDN Web API: `ScrollToOptions.behavior: 'smooth'` — supported in all modern mobile browsers
- MDN Web API: `addEventListener` passive option — standard for scroll event performance
- Tailwind v4 `sticky`, `z-*` utility classes — inferred from v4 `@import "tailwindcss"` globals.css; same utility names as v3 for these properties

### Tertiary (LOW confidence)
- Sticky positioning interaction with `overflow-x: hidden` vs `overflow-x: auto` — tested reasoning, not verified against a running browser in this session. Manual visual verification required.

---

## Metadata

**Confidence breakdown:**
- MOB-POL-01 sticky filter: HIGH — pattern already exists in codebase (sticky thead, sm:static); only class changes needed
- MOB-POL-02 back-to-top: HIGH — standard browser scroll API; project's existing scroll/resize listener pattern covers it
- DAT-01 route fix: HIGH — exact pattern to copy exists in the same codebase (`/api/players`)
- DAT-01 cron verification: MEDIUM — depends on runtime state (secrets, workflow run history) not inspectable from code

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable domain — Tailwind v4, browser scroll API, Next.js route handlers are not rapidly changing)
