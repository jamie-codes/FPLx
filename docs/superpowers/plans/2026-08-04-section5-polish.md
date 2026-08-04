# §5 Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the four remaining Matchday-Fintech §5 polish items — volt "Fx" logo badge, mobile active-tab volt fill, sidebar/mobile deadline countdown, and a shared ChartTheme — as isolated restyle units with no engine or data changes.

**Architecture:** A new fill-only volt token pair (theme-invariant) plus deadline-card surface tokens back four small presentational units: a shared `Brand` lockup, a recoloured mobile active tab, a deadline feature (pure formatter + 1s hook + two thin display components), and a `chart-theme` constants module the 4 Recharts tabs import. Everything reuses existing infrastructure (`useNextDeadline`, the `--sp-*`/`@theme inline` token system, TanStack Query).

**Tech Stack:** Next.js (client components), TypeScript, Tailwind v4 (`@theme inline`), Recharts, Vitest + @testing-library/react (jsdom), TanStack Query.

## Global Constraints

- **Keep-all-features (UIX-01):** no existing element, prop, route, or a11y attribute may be removed in any restyle. Additions only.
- **Token separation:** the logo badge and mobile active tab are **volt fill + dark ink in both themes** — use `bg-volt`/`text-on-volt` (theme-invariant), never `bg-accent`/`text-on-accent` (which is pitch-green+white in light).
- **Volt fill value:** volt `#c8f542`, on-volt `#0c0e0d` — identical in light and dark.
- **Deadline card:** dark bg `#12150f` / border `#2b331f`; light bg `#eef4e6` / border `#e2e7de`; card text uses the existing `text-accent`.
- **Out of scope:** the desktop sidebar active nav pill (already shipped), chip-timeline bars (data-blocked), any font-package swap (Geist Mono stays), and any change to `DeadlineBanner` or its dismiss logic.
- **No `Co-Authored-By` trailers** on commits.
- Restyle + DRY only: do not touch the `?t=` tab shell, TanStack Query hooks' behaviour, or any `src/lib` engine.

---

### Task 1: Fill-only volt + deadline tokens

**Files:**
- Modify: `src/app/globals.css` (`:root` ~15-27, `.dark` ~28-41, `@theme inline` ~59-81)

**Interfaces:**
- Produces: Tailwind utilities `bg-volt`, `text-on-volt`, `bg-deadline-bg`, `border-deadline-border` (via `--color-volt`, `--color-on-volt`, `--color-deadline-bg`, `--color-deadline-border`). Volt/on-volt are theme-invariant; deadline-bg/border differ per theme.

- [ ] **Step 1: Add the theme-invariant volt pair to `:root`**

In `src/app/globals.css`, inside the `:root {` block (light primitives, currently ending at the `--sp-focus-ring` line ~26), add the volt pair. It lives in `:root` only because it is identical in both themes and `.dark` inherits `:root` vars it doesn't override:

```css
  --sp-focus-ring: rgba(63, 109, 29, 0.4);
  /* §5: fill-only volt — logo badge + mobile active tab. Volt fails as TEXT on
     white, so it is used only as a FILL with dark ink, identical in both themes. */
  --sp-volt: #c8f542; --sp-on-volt: #0c0e0d;
  /* §5: deadline-card surfaces (text uses the theme-adaptive --sp-accent). */
  --sp-deadline-bg: #eef4e6; --sp-deadline-border: #e2e7de;
```

- [ ] **Step 2: Add the dark deadline-card surfaces to `.dark`**

Inside the `.dark {` block, after the `--sp-violet` line (~39), add ONLY the deadline overrides (volt/on-volt are inherited from `:root`, do not repeat them):

```css
  --sp-violet: #b9a3f5; --sp-violet-soft: #191323;
  /* §5: deadline-card surfaces (dark). */
  --sp-deadline-bg: #12150f; --sp-deadline-border: #2b331f;
```

- [ ] **Step 3: Map the new tokens in `@theme inline`**

Inside `@theme inline {`, after the `--color-violet` line (~70), add:

```css
  --color-violet: var(--sp-violet); --color-violet-soft: var(--sp-violet-soft);
  /* §5 fill-only volt + deadline surfaces */
  --color-volt: var(--sp-volt); --color-on-volt: var(--sp-on-volt);
  --color-deadline-bg: var(--sp-deadline-bg); --color-deadline-border: var(--sp-deadline-border);
```

- [ ] **Step 4: Verify the on-volt/volt contrast passes WCAG (self-contained, the stale contrast-check.mjs is NOT the gate)**

Run this one-liner (computes the WCAG 2.1 ratio for on-volt `#0c0e0d` on volt `#c8f542`):

```bash
node -e "const h=x=>[0,2,4].map(i=>parseInt(x.replace('#','').slice(i,i+2),16));const L=([r,g,b])=>{const f=c=>{c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4)};return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)};const R=(a,b)=>{const[x,y]=[L(a),L(b)].sort((m,n)=>n-m);return (x+0.05)/(y+0.05)};const v=R(h('#0c0e0d'),h('#c8f542'));console.log('on-volt/volt',v.toFixed(2));process.exit(v>=4.5?0:1)"
```

Expected: `on-volt/volt 15.xx` and exit 0 (well above 4.5).

- [ ] **Step 5: Verify tokens compile (build picks up the new utilities)**

Run: `npx tsc --noEmit`
Expected: 0 errors. (CSS token additions don't affect tsc, but this confirms nothing else regressed. Utilities are exercised for real by Tasks 2/3/6.)

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(section5): fill-only volt + deadline-card tokens"
```

---

### Task 2: `Brand` logo lockup

**Files:**
- Create: `src/components/shell/Brand.tsx`
- Create: `src/components/shell/Brand.test.tsx`
- Modify: `src/components/shell/Sidebar.tsx:14-18` (replace the honk wordmark span)
- Modify: `src/components/shell/TopBar.tsx:8-10` (replace the honk wordmark span)

**Interfaces:**
- Consumes: `bg-volt`, `text-on-volt` utilities (Task 1).
- Produces: `export function Brand({ className }: { className?: string }): JSX.Element` — a `[Fx] FPLx` lockup.

- [ ] **Step 1: Write the failing test**

Create `src/components/shell/Brand.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Brand } from './Brand'

describe('Brand', () => {
  it('renders the "Fx" badge and the "FPLx" wordmark', () => {
    const { container } = render(<Brand />)
    expect(container.textContent).toContain('Fx')
    expect(container.textContent).toContain('FPLx')
  })

  it('the badge uses the fill-only volt tokens (not the theme-adaptive accent)', () => {
    const { container } = render(<Brand />)
    const badge = container.querySelector('.bg-volt')
    expect(badge).not.toBeNull()
    expect(badge!.className).toContain('text-on-volt')
    expect(badge!.textContent).toBe('Fx')
  })

  it('applies a passed className to the root', () => {
    const { container } = render(<Brand className="test-hook" />)
    expect((container.firstChild as HTMLElement).className).toContain('test-hook')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/shell/Brand.test.tsx`
Expected: FAIL — `Cannot find module './Brand'`.

- [ ] **Step 3: Write the component**

Create `src/components/shell/Brand.tsx`:

```tsx
// §5: shared brand lockup — a volt "Fx" badge (fill + dark ink, both themes)
// beside the "FPLx" wordmark in Inter semibold. Replaces the two duplicated
// Honk-font wordmarks (Sidebar top + TopBar mobile). The Honk font stays
// defined in globals.css; only these two logo usages drop it.
export function Brand({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 leading-none ${className ?? ''}`}>
      <span className="bg-volt text-on-volt rounded-md px-1.5 py-1 text-body font-bold leading-none">
        Fx
      </span>
      <span className="text-h4 font-semibold text-ink leading-none">FPLx</span>
    </span>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/shell/Brand.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire `Brand` into the Sidebar**

In `src/components/shell/Sidebar.tsx`, add the import after the existing `import { GROUPS, ... }` line:

```tsx
import { Brand } from './Brand'
```

Replace the brand block (currently lines 14-18):

```tsx
      <div className="px-4 pt-4 pb-2 shrink-0">
        <span className="font-[family-name:var(--font-honk)] text-display text-ink leading-none">
          FPLx
        </span>
      </div>
```

with:

```tsx
      <div className="px-4 pt-4 pb-2 shrink-0">
        <Brand />
      </div>
```

- [ ] **Step 6: Wire `Brand` into the TopBar**

In `src/components/shell/TopBar.tsx`, add at the top of the file (it currently has no imports besides the implicit React types):

```tsx
import { Brand } from './Brand'
```

Replace the mobile wordmark (currently lines 8-10):

```tsx
      <span className="lg:hidden font-[family-name:var(--font-honk)] text-display text-ink leading-none">
        FPLx
      </span>
```

with:

```tsx
      <Brand className="lg:hidden" />
```

- [ ] **Step 7: Run the shell suite + tsc to confirm no regression**

Run: `npx vitest run src/components/shell/ && npx tsc --noEmit`
Expected: shell tests PASS, tsc 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/shell/Brand.tsx src/components/shell/Brand.test.tsx src/components/shell/Sidebar.tsx src/components/shell/TopBar.tsx
git commit -m "feat(section5): volt Fx logo badge (shared Brand lockup)"
```

---

### Task 3: Mobile active-tab volt fill

**Files:**
- Modify: `src/components/shell/MobileBar.tsx:20-62`
- Modify: `src/components/shell/shell.test.tsx` (add active-fill assertions)

**Interfaces:**
- Consumes: `bg-volt`, `text-on-volt` utilities (Task 1).
- Produces: no new exports — the existing `MobileBar` gains a volt-pill active treatment.

**Context:** `MobileBar` renders 4 group links + a "More" button, each a `flex-1` column of icon-over-label. Active state today is only `text-accent` (fails as volt-on-white in light). Keep the structure; wrap the active item's icon in a volt pill.

- [ ] **Step 1: Write the failing test**

In `src/components/shell/shell.test.tsx`, add a test (match the existing import style in that file; `MobileBar` takes plain props — no providers needed):

```tsx
  it('MobileBar wraps the active tab icon in a volt fill pill', () => {
    const { container } = render(
      <MobileBar active="cockpit" onSelect={() => {}} onMore={() => {}} />,
    )
    // The active group's icon sits inside a bg-volt/text-on-volt pill.
    const pill = container.querySelector('.bg-volt.text-on-volt')
    expect(pill).not.toBeNull()
    // Exactly one active pill is rendered.
    expect(container.querySelectorAll('.bg-volt').length).toBe(1)
  })
```

(If `MobileBar` isn't already imported at the top of `shell.test.tsx`, add it to the existing shell import. `active="cockpit"` resolves to the "This Week" group via `groupOf`.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/shell/shell.test.tsx -t "volt fill pill"`
Expected: FAIL — no `.bg-volt` element (active state is currently `text-accent` only).

- [ ] **Step 3: Implement the volt-pill active treatment**

In `src/components/shell/MobileBar.tsx`, the button class constant currently is:

```tsx
const BTN_CLS =
  'flex-1 min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-data font-medium transition-colors duration-150 ease-out'
```

Add a small helper for the icon wrapper below it:

```tsx
// §5: active tab = icon in a volt fill pill (fill + dark ink, both themes),
// label below in ink. Inactive = muted, no pill. Keeps the icon+label shape.
const ICON_PILL = 'rounded-lg p-1 transition-colors duration-150 ease-out'
```

Replace the group link's inner render (currently):

```tsx
          <a
            key={groupId}
            href={`?t=${group.tools[0].id}`}
            onClick={(e) => {
              e.preventDefault()
              onSelect(group.tools[0].id)
            }}
            aria-current={isActive ? 'page' : undefined}
            className={`${BTN_CLS} ${isActive ? 'text-accent' : 'text-ink-muted'}`}>
            <group.icon size={20} strokeWidth={2} aria-hidden />
            {label}
          </a>
```

with:

```tsx
          <a
            key={groupId}
            href={`?t=${group.tools[0].id}`}
            onClick={(e) => {
              e.preventDefault()
              onSelect(group.tools[0].id)
            }}
            aria-current={isActive ? 'page' : undefined}
            className={`${BTN_CLS} ${isActive ? 'text-ink' : 'text-ink-muted'}`}>
            <span className={`${ICON_PILL} ${isActive ? 'bg-volt text-on-volt' : ''}`}>
              <group.icon size={20} strokeWidth={2} aria-hidden />
            </span>
            {label}
          </a>
```

And replace the "More" button's render (currently):

```tsx
      <button
        type="button"
        onClick={onMore}
        aria-haspopup="dialog"
        aria-expanded={moreOpen}
        className={`${BTN_CLS} ${moreActive ? 'text-accent' : 'text-ink-muted'}`}>
        <Ellipsis size={20} strokeWidth={2} aria-hidden />
        More
      </button>
```

with:

```tsx
      <button
        type="button"
        onClick={onMore}
        aria-haspopup="dialog"
        aria-expanded={moreOpen}
        className={`${BTN_CLS} ${moreActive ? 'text-ink' : 'text-ink-muted'}`}>
        <span className={`${ICON_PILL} ${moreActive ? 'bg-volt text-on-volt' : ''}`}>
          <Ellipsis size={20} strokeWidth={2} aria-hidden />
        </span>
        More
      </button>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/shell/shell.test.tsx`
Expected: PASS (the new test + all existing shell tests).

- [ ] **Step 5: Confirm tsc**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/shell/MobileBar.tsx src/components/shell/shell.test.tsx
git commit -m "feat(section5): mobile active-tab volt fill"
```

---

### Task 4: `formatDeadlineCountdown` pure formatter

**Files:**
- Create: `src/lib/deadline-format.ts`
- Create: `src/lib/deadline-format.test.ts`

**Interfaces:**
- Produces: `export function formatDeadlineCountdown(ms: number, showSeconds: boolean): string`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/deadline-format.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatDeadlineCountdown } from './deadline-format'

const SEC = 1000
const MIN = 60 * SEC
const HOUR = 60 * MIN
const DAY = 24 * HOUR

describe('formatDeadlineCountdown', () => {
  it('multi-day with seconds', () => {
    expect(formatDeadlineCountdown(21 * DAY + 23 * HOUR + 33 * MIN + 7 * SEC, true)).toBe('21d 23:33:07')
  })
  it('multi-day without seconds', () => {
    expect(formatDeadlineCountdown(21 * DAY + 23 * HOUR + 33 * MIN + 7 * SEC, false)).toBe('21d 23:33')
  })
  it('exactly 24h keeps a 1d prefix', () => {
    expect(formatDeadlineCountdown(DAY, true)).toBe('1d 00:00:00')
  })
  it('just under 24h drops the day part', () => {
    expect(formatDeadlineCountdown(23 * HOUR + 59 * MIN + 59 * SEC, true)).toBe('23:59:59')
    expect(formatDeadlineCountdown(23 * HOUR + 59 * MIN + 59 * SEC, false)).toBe('23:59')
  })
  it('zero-pads single-digit hours, minutes and seconds', () => {
    expect(formatDeadlineCountdown(2 * DAY + 3 * HOUR + 4 * MIN + 5 * SEC, true)).toBe('2d 03:04:05')
  })
  it('floors non-positive input to zeros (day part dropped)', () => {
    expect(formatDeadlineCountdown(0, true)).toBe('00:00:00')
    expect(formatDeadlineCountdown(-5000, false)).toBe('00:00')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/deadline-format.test.ts`
Expected: FAIL — `Cannot find module './deadline-format'`.

- [ ] **Step 3: Write the formatter**

Create `src/lib/deadline-format.ts`:

```ts
// §5: long-range deadline countdown formatter for the sidebar card (with
// seconds) and the mobile GW pill (without). Distinct from DeadlineBanner's
// minute-only formatCountdown, which is left untouched. Day part appears only
// at >= 1 day; below that it is dropped.
export function formatDeadlineCountdown(ms: number, showSeconds: boolean): string {
  const clamped = ms > 0 ? ms : 0
  const totalSec = Math.floor(clamped / 1000)
  const days = Math.floor(totalSec / 86_400)
  const hours = Math.floor((totalSec % 86_400) / 3_600)
  const minutes = Math.floor((totalSec % 3_600) / 60)
  const seconds = totalSec % 60
  const p = (n: number) => String(n).padStart(2, '0')
  const hms = showSeconds ? `${p(hours)}:${p(minutes)}:${p(seconds)}` : `${p(hours)}:${p(minutes)}`
  return days >= 1 ? `${days}d ${hms}` : hms
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/deadline-format.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/deadline-format.ts src/lib/deadline-format.test.ts
git commit -m "feat(section5): formatDeadlineCountdown (long-range deadline formatter)"
```

---

### Task 5: `useDeadlineCountdown` hook

**Files:**
- Create: `src/lib/hooks/useDeadlineCountdown.ts`
- Create: `src/lib/hooks/useDeadlineCountdown.test.ts`

**Interfaces:**
- Consumes: `useNextDeadline()` from `./useNextDeadline` (returns a TanStack Query result whose `data` is `{ id: number; deadline_time: string } | null`).
- Produces: `export function useDeadlineCountdown(): { id: number; ms: number } | null` — ticks every 1000ms.

- [ ] **Step 1: Write the failing test**

Create `src/lib/hooks/useDeadlineCountdown.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock the underlying query hook so no QueryClient/provider is needed.
const useNextDeadlineMock = vi.fn()
vi.mock('./useNextDeadline', () => ({ useNextDeadline: () => useNextDeadlineMock() }))

import { useDeadlineCountdown } from './useDeadlineCountdown'

describe('useDeadlineCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T00:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
    useNextDeadlineMock.mockReset()
  })

  it('returns null when there is no deadline data', () => {
    useNextDeadlineMock.mockReturnValue({ data: null })
    const { result } = renderHook(() => useDeadlineCountdown())
    expect(result.current).toBeNull()
  })

  it('returns id and ms-remaining for a future deadline', () => {
    useNextDeadlineMock.mockReturnValue({
      data: { id: 3, deadline_time: '2026-08-01T01:00:00Z' }, // +1h
    })
    const { result } = renderHook(() => useDeadlineCountdown())
    expect(result.current).toEqual({ id: 3, ms: 60 * 60 * 1000 })
  })

  it('decreases ms on each 1s tick', () => {
    useNextDeadlineMock.mockReturnValue({
      data: { id: 3, deadline_time: '2026-08-01T01:00:00Z' },
    })
    const { result } = renderHook(() => useDeadlineCountdown())
    const before = result.current!.ms
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current!.ms).toBe(before - 1000)
  })

  it('returns null when deadline_time is unparseable', () => {
    useNextDeadlineMock.mockReturnValue({ data: { id: 3, deadline_time: 'not-a-date' } })
    const { result } = renderHook(() => useDeadlineCountdown())
    expect(result.current).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/hooks/useDeadlineCountdown.test.ts`
Expected: FAIL — `Cannot find module './useDeadlineCountdown'`.

- [ ] **Step 3: Write the hook**

Create `src/lib/hooks/useDeadlineCountdown.ts`:

```ts
import { useEffect, useState } from 'react'
import { useNextDeadline } from './useNextDeadline'

// §5: ticks the next-deadline countdown once per second, returning raw
// { id, ms }. Formatting lives in formatDeadlineCountdown; consumers render.
// Returns null when data is missing, deadline_time is unparseable, or id is null.
export function useDeadlineCountdown(): { id: number; ms: number } | null {
  const { data } = useNextDeadline()
  const id = data?.id ?? null
  const deadlineTime = data?.deadline_time ?? null

  const [ms, setMs] = useState<number>(() =>
    deadlineTime ? new Date(deadlineTime).getTime() - Date.now() : NaN,
  )

  useEffect(() => {
    if (!deadlineTime) return
    const tick = () => setMs(new Date(deadlineTime).getTime() - Date.now())
    tick()
    const intervalId = setInterval(tick, 1000)
    return () => clearInterval(intervalId)
  }, [deadlineTime])

  if (id === null || deadlineTime === null) return null
  if (Number.isNaN(ms)) return null
  return { id, ms }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/hooks/useDeadlineCountdown.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/hooks/useDeadlineCountdown.ts src/lib/hooks/useDeadlineCountdown.test.ts
git commit -m "feat(section5): useDeadlineCountdown 1s hook"
```

---

### Task 6: Deadline display — sidebar card + mobile pill

**Files:**
- Create: `src/components/shell/SidebarDeadlineCard.tsx`
- Create: `src/components/shell/SidebarDeadlineCard.test.tsx`
- Create: `src/components/shell/MobileDeadlinePill.tsx`
- Create: `src/components/shell/MobileDeadlinePill.test.tsx`
- Modify: `src/components/shell/Sidebar.tsx` (mount the card at the bottom, after `</nav>`)
- Modify: `src/app/page.tsx:174-179` (mount the pill in the TopBar children slot)

**Interfaces:**
- Consumes: `useDeadlineCountdown()` (Task 5, returns `{ id, ms } | null`), `formatDeadlineCountdown(ms, showSeconds)` (Task 4), tokens `bg-deadline-bg`/`border-deadline-border`/`text-accent` (Task 1).
- Produces: `export function SidebarDeadlineCard(): JSX.Element | null`, `export function MobileDeadlinePill(): JSX.Element | null`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/shell/SidebarDeadlineCard.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'

const countdownMock = vi.fn()
vi.mock('@/lib/hooks/useDeadlineCountdown', () => ({ useDeadlineCountdown: () => countdownMock() }))

import { SidebarDeadlineCard } from './SidebarDeadlineCard'

describe('SidebarDeadlineCard', () => {
  afterEach(() => countdownMock.mockReset())

  it('renders the GW label and a seconds-precision countdown', () => {
    countdownMock.mockReturnValue({ id: 5, ms: 21 * 86_400_000 + 23 * 3_600_000 + 33 * 60_000 + 7000 })
    const { container } = render(<SidebarDeadlineCard />)
    expect(container.textContent).toContain('GW5 deadline')
    expect(container.textContent).toContain('21d 23:33:07')
  })

  it('renders nothing when there is no deadline', () => {
    countdownMock.mockReturnValue(null)
    const { container } = render(<SidebarDeadlineCard />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when the deadline has passed (ms <= 0)', () => {
    countdownMock.mockReturnValue({ id: 5, ms: 0 })
    const { container } = render(<SidebarDeadlineCard />)
    expect(container.firstChild).toBeNull()
  })
})
```

Create `src/components/shell/MobileDeadlinePill.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'

const countdownMock = vi.fn()
vi.mock('@/lib/hooks/useDeadlineCountdown', () => ({ useDeadlineCountdown: () => countdownMock() }))

import { MobileDeadlinePill } from './MobileDeadlinePill'

describe('MobileDeadlinePill', () => {
  afterEach(() => countdownMock.mockReset())

  it('renders GW id and a minute-precision countdown', () => {
    countdownMock.mockReturnValue({ id: 5, ms: 21 * 86_400_000 + 23 * 3_600_000 + 33 * 60_000 + 7000 })
    const { container } = render(<MobileDeadlinePill />)
    expect(container.textContent).toContain('GW5')
    expect(container.textContent).toContain('21d 23:33')
    expect(container.textContent).not.toContain('21d 23:33:07') // no seconds on the pill
  })

  it('renders nothing when there is no deadline', () => {
    countdownMock.mockReturnValue(null)
    const { container } = render(<MobileDeadlinePill />)
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/shell/SidebarDeadlineCard.test.tsx src/components/shell/MobileDeadlinePill.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `SidebarDeadlineCard`**

Create `src/components/shell/SidebarDeadlineCard.tsx`:

```tsx
'use client'
// §5: deadline countdown pinned at the sidebar bottom — GW label + a
// seconds-precision volt-mono clock. Desktop-only by construction (mounted
// inside the hidden-lg:flex sidebar aside). Renders nothing off-season.
import { useDeadlineCountdown } from '@/lib/hooks/useDeadlineCountdown'
import { formatDeadlineCountdown } from '@/lib/deadline-format'

export function SidebarDeadlineCard() {
  const cd = useDeadlineCountdown()
  if (cd === null || cd.ms <= 0) return null
  return (
    <div className="shrink-0 px-4 pb-4 pt-2">
      <div className="rounded-lg bg-deadline-bg border border-deadline-border px-3 py-2">
        <div className="text-data text-ink-muted">GW{cd.id} deadline</div>
        <div className="text-h4 font-mono tabular text-accent leading-tight">
          {formatDeadlineCountdown(cd.ms, true)}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write `MobileDeadlinePill`**

Create `src/components/shell/MobileDeadlinePill.tsx`:

```tsx
'use client'
// §5: mobile-only GW + countdown pill for the top-bar right cluster. Volt
// outline + accent text (accent is volt in dark, pitch-green in light — both
// pass as text/border). Minute precision, no seconds. Renders nothing off-season.
import { useDeadlineCountdown } from '@/lib/hooks/useDeadlineCountdown'
import { formatDeadlineCountdown } from '@/lib/deadline-format'

export function MobileDeadlinePill() {
  const cd = useDeadlineCountdown()
  if (cd === null || cd.ms <= 0) return null
  return (
    <span className="lg:hidden inline-flex items-center rounded-full border border-accent text-accent px-2 py-0.5 text-data font-mono tabular whitespace-nowrap">
      GW{cd.id} · {formatDeadlineCountdown(cd.ms, false)}
    </span>
  )
}
```

- [ ] **Step 5: Run both component tests to verify they pass**

Run: `npx vitest run src/components/shell/SidebarDeadlineCard.test.tsx src/components/shell/MobileDeadlinePill.test.tsx`
Expected: PASS (5 tests total).

- [ ] **Step 6: Mount the card in the Sidebar**

In `src/components/shell/Sidebar.tsx`, add the import beside the `Brand` import:

```tsx
import { SidebarDeadlineCard } from './SidebarDeadlineCard'
```

Add the card as the last child of the `<aside>`, immediately after the closing `</nav>` tag and before `</aside>`:

```tsx
      </nav>
      <SidebarDeadlineCard />
    </aside>
```

- [ ] **Step 7: Mount the pill in the TopBar children (page.tsx)**

In `src/app/page.tsx`, add the import near the other shell imports (beside `DeadlineBanner`):

```tsx
import { MobileDeadlinePill } from '@/components/shell/MobileDeadlinePill'
```

In the `<TopBar>` children block (currently lines 174-179), add the pill as the first child:

```tsx
        <TopBar>
          <MobileDeadlinePill />
          <DeadlineBanner />
          <LastUpdated />
          <BellNotificationButton />
          <ThemeToggle />
```

- [ ] **Step 8: Run the shell suite + tsc**

Run: `npx vitest run src/components/shell/ && npx tsc --noEmit`
Expected: PASS, 0 tsc errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/shell/SidebarDeadlineCard.tsx src/components/shell/SidebarDeadlineCard.test.tsx src/components/shell/MobileDeadlinePill.tsx src/components/shell/MobileDeadlinePill.test.tsx src/components/shell/Sidebar.tsx src/app/page.tsx
git commit -m "feat(section5): sidebar deadline card + mobile GW pill"
```

---

### Task 7: Shared ChartTheme constants

**Files:**
- Create: `src/lib/chart-theme.ts`
- Modify: `src/components/accuracy/AccuracyTab.tsx` (lines ~410, 417, 426, 502, 507, 514)
- Modify: `src/components/season-review/SeasonReviewTab.tsx` (lines ~378, 382, 389)
- Modify: `src/components/accuracy/BackTab.tsx` (lines ~337, 343, 403, 409)
- Modify: `src/components/planner/RankSimTab.tsx` (lines ~277, 278, 279)

**Interfaces:**
- Produces: `export const CHART_GRID_STROKE`, `CHART_GRID_DASH`, `CHART_TICK` from `src/lib/chart-theme.ts`.

**Context:** These are the exact literals repeated across the tabs today. Only the identical, purpose-neutral chrome moves; divergent per-purpose strokes (ReferenceLine/diagonal `50%`/`70%`/`40%` color-mix) stay inline. This is a behaviour-preserving DRY refactor — no test asserts the constant values (that would be tautological); the tabs' existing render tests are the regression guard.

- [ ] **Step 1: Create the constants module**

Create `src/lib/chart-theme.ts`:

```ts
// §5: shared Recharts chrome — the grid stroke, grid dash, and axis-tick style
// repeated verbatim across the 4 chart tabs (Accuracy, SeasonReview, Back,
// RankSim). Values read the live theme via CSS vars, so they follow light/dark
// automatically. Series/domain colours and divergent ReferenceLine strokes stay
// in the tabs. This is a DRY extraction of existing literals — no behaviour change.
export const CHART_GRID_STROKE = 'color-mix(in srgb, var(--color-ink-muted) 30%, transparent)'
export const CHART_GRID_DASH = '3 3'
export const CHART_TICK = { fontSize: 12, fill: 'currentColor' } as const
```

- [ ] **Step 2: Refactor `AccuracyTab`**

In `src/components/accuracy/AccuracyTab.tsx`, add the import with the other `@/lib` imports:

```tsx
import { CHART_GRID_STROKE, CHART_GRID_DASH, CHART_TICK } from '@/lib/chart-theme'
```

Replace both `CartesianGrid` occurrences (lines ~410 and ~502):

```tsx
            <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--color-ink-muted) 30%, transparent)" />
```

with:

```tsx
            <CartesianGrid strokeDasharray={CHART_GRID_DASH} stroke={CHART_GRID_STROKE} />
```

Replace each axis tick object `tick={{ fontSize: 12, fill: 'currentColor' }}` (lines ~417, 426, 507, 514) with:

```tsx
              tick={CHART_TICK}
```

Leave the diagonal/reference `stroke="color-mix(... 50% ...)"` and the sparkline `40%` stroke inline (divergent).

- [ ] **Step 3: Refactor `SeasonReviewTab`**

In `src/components/season-review/SeasonReviewTab.tsx`, add the import:

```tsx
import { CHART_GRID_STROKE, CHART_GRID_DASH, CHART_TICK } from '@/lib/chart-theme'
```

Replace the `CartesianGrid` (line ~378):

```tsx
            <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--color-ink-muted) 30%, transparent)" />
```

with:

```tsx
            <CartesianGrid strokeDasharray={CHART_GRID_DASH} stroke={CHART_GRID_STROKE} />
```

Replace the two axis ticks `tick={{ fontSize: 12, fill: 'currentColor' }}` (lines ~382, 389) with `tick={CHART_TICK}`. Leave the `70%` ReferenceLine stroke and the legend swatch inline (divergent).

- [ ] **Step 4: Refactor `BackTab`**

In `src/components/accuracy/BackTab.tsx`, add the import:

```tsx
import { CHART_TICK } from '@/lib/chart-theme'
```

`BackTab` has no `CartesianGrid`; replace only the four axis ticks `tick={{ fontSize: 12, fill: 'currentColor' }}` (lines ~337, 343, 403, 409) with `tick={CHART_TICK}`. Leave the `REGRET_GREY` constant and the `ReferenceLine` `50%` strokes inline (divergent, already named locally).

- [ ] **Step 5: Refactor `RankSimTab`**

In `src/components/planner/RankSimTab.tsx`, add the import:

```tsx
import { CHART_GRID_STROKE, CHART_GRID_DASH, CHART_TICK } from '@/lib/chart-theme'
```

Replace the `CartesianGrid` (line ~277):

```tsx
            <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--color-ink-muted) 30%, transparent)" />
```

with:

```tsx
            <CartesianGrid strokeDasharray={CHART_GRID_DASH} stroke={CHART_GRID_STROKE} />
```

Replace the two axis ticks `tick={{ fontSize: 12, fill: 'currentColor' }}` (lines ~278, 279) with `tick={CHART_TICK}`. Leave the area/line fills (`25%` color-mix, `var(--color-accent)`) inline (divergent, series colours).

- [ ] **Step 6: Run the 4 tabs' tests + tsc to confirm behaviour is preserved**

Run: `npx vitest run src/components/accuracy/AccuracyTab.test.tsx src/components/accuracy/BackTab.test.tsx src/components/season-review/SeasonReviewTab.test.tsx src/components/planner/RankSimTab.test.tsx && npx tsc --noEmit`
Expected: PASS (all existing tab tests), 0 tsc errors. (If `BackTab` has no test file, run the other three; do not add a tautological test.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/chart-theme.ts src/components/accuracy/AccuracyTab.tsx src/components/season-review/SeasonReviewTab.tsx src/components/accuracy/BackTab.tsx src/components/planner/RankSimTab.tsx
git commit -m "refactor(section5): shared ChartTheme constants across the 4 Recharts tabs"
```

---

## Final Verification (after all tasks)

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npx vitest run` → full suite green (new: Brand, deadline-format, useDeadlineCountdown, SidebarDeadlineCard, MobileDeadlinePill, MobileBar volt-fill; existing shell + chart-tab suites unchanged-green)
- [ ] `node -e` on-volt/volt contrast one-liner (Task 1 Step 4) → exit 0
- [ ] Manual dev-server eyeball (user): logo badge, mobile active-tab fill + GW pill, sidebar deadline card, and the 4 chart tabs in both light and dark.
