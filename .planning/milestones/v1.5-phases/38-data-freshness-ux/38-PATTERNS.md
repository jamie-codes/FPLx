# Phase 38: Data Freshness UX - Pattern Map

**Mapped:** 2026-04-29
**Files analyzed:** 2 (1 modified, 1 new utility)
**Analogs found:** 2 / 2

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/LastUpdated.tsx` | component (pure + connected split) | request-response + event-driven (interval) | `src/components/theme/ThemeToggle.tsx` | role-match (useEffect+useState tick pattern) |
| `src/lib/formatRelativeTime.ts` | utility (pure function) | transform | `src/lib/auth-expiry.ts` | exact (pure time-delta → label function) |

---

## Pattern Assignments

### `src/components/LastUpdated.tsx` (component, request-response + interval tick)

**Analog:** `src/components/theme/ThemeToggle.tsx`

This is the file being modified, not created from scratch. The pure/connected split already exists. The upgrade adds:
1. `useState<string>` to hold the formatted relative time string
2. `useEffect` with `setInterval` for the 30-second tick
3. Interval cleanup on unmount via return function

**Existing file to modify** (`src/components/LastUpdated.tsx`, lines 1–23 — full file already read):

Current structure to preserve:
- `'use client'` directive at top (line 1)
- `LastUpdatedDisplay` — pure render component, prop-driven (lines 6–15)
- `LastUpdated` — connected wrapper calling `useLastUpdated()` (lines 18–23)

**`'use client'` + imports pattern** — copy from `src/components/theme/ThemeToggle.tsx` lines 1–3:
```typescript
'use client'

import { useEffect, useState } from 'react'
```

The upgraded `LastUpdated.tsx` import block will be:
```typescript
'use client'

import { useEffect, useState } from 'react'
import { useLastUpdated } from '@/lib/hooks/useLastUpdated'
import { formatRelativeTime } from '@/lib/formatRelativeTime'
```

**`useEffect` + `useState` tick pattern** — copy structure from `src/components/theme/ThemeToggle.tsx` lines 6–17:
```typescript
// ThemeToggle: state initialised, useEffect reads/writes side-effect
const [isDark, setIsDark] = useState(false)

useEffect(() => {
  setIsDark(document.documentElement.classList.contains('dark'))
}, [])
```

Translate to interval pattern for `LastUpdated` connected component:
```typescript
// In LastUpdated connected component:
const [label, setLabel] = useState<string>('')

useEffect(() => {
  if (!data) return
  setLabel(formatRelativeTime(data.last_updated))          // immediate render
  const id = setInterval(() => {
    setLabel(formatRelativeTime(data.last_updated))
  }, 30_000)
  return () => clearInterval(id)                           // cleanup on unmount / data change
}, [data])
```

**`useEffect` cleanup pattern** — copy from `src/components/transfers/AuthModal.tsx` lines 52–58 (event listener cleanup idiom, same return-function teardown shape):
```typescript
useEffect(() => {
  const el = dialogRef.current
  if (!el) return
  const handleClose = () => onClose()
  el.addEventListener('close', handleClose)
  return () => el.removeEventListener('close', handleClose)   // <-- teardown return
}, [onClose])
```

**Tailwind colour classes** — copy from `src/components/LastUpdated.tsx` line 11 (existing, keep unchanged):
```typescript
className={`text-xs mt-1 ${stale ? 'text-amber-600' : 'text-zinc-400'}`}
```
Dark mode equivalents from codebase convention (`src/components/transfers/AuthModal.tsx` line 193, `src/components/nav/MobileNav.tsx` line 25):
- Normal: `text-zinc-400 dark:text-zinc-400` (zinc-400 already reads well in both modes)
- Stale: `text-amber-600 dark:text-amber-500` (D-06 confirms `text-amber-600`; dark variant `dark:text-amber-500` matches project amber dark-mode convention seen in `src/components/gem-table/DifferentialBadge.tsx` line 32: `dark:bg-amber-900 text-amber-800 dark:text-amber-200`)

**Pure `LastUpdatedDisplay` prop change** — current signature (line 6):
```typescript
export function LastUpdatedDisplay({ timestamp, stale }: { timestamp: string; stale: boolean })
```
New signature accepts pre-formatted string (CONTEXT.md "Reusable Assets" option A):
```typescript
export function LastUpdatedDisplay({ relativeTime, stale }: { relativeTime: string; stale: boolean })
```
The `LastUpdated` connected component computes `relativeTime` via `useState`+interval and passes it down; `LastUpdatedDisplay` is kept free of `Date` logic and remains purely a renderer for tests.

---

### `src/lib/formatRelativeTime.ts` (utility, transform)

**Analog:** `src/lib/auth-expiry.ts`

`auth-expiry.ts` is the canonical pattern for a pure time-delta utility in this codebase: it takes two numeric time values, computes the difference, and maps it to a labelled output. `formatRelativeTime` does the same thing with a different output shape (string label vs. enum).

**Full analog** (`src/lib/auth-expiry.ts`, lines 1–19):
```typescript
export type AuthExpiryState = 'normal' | 'expiring-soon' | 'expired'

/**
 * Computes the expiry state of an FPL auth token.
 *
 * @param expiresAt - Unix timestamp (seconds) when the token expires, or undefined if no token
 * @param nowSeconds - Current Unix timestamp in seconds
 * @returns 'normal' if > 1hr remaining, 'expiring-soon' if 15min–1hr, 'expired' if < 15min or no token
 */
export function computeAuthExpiryState(
  expiresAt: number | undefined,
  nowSeconds: number
): AuthExpiryState {
  if (expiresAt === undefined) return 'expired'
  const remaining = expiresAt - nowSeconds
  if (remaining >= 3600) return 'normal'
  if (remaining >= 900) return 'expiring-soon'
  return 'expired'
}
```

**Pattern to copy — file structure:**
- No imports (pure function, no external deps)
- JSDoc comment block with `@param` and `@returns`
- Named export (no default export)
- `nowMs` injected as second param (enables deterministic tests — same pattern as `nowSeconds` in `computeAuthExpiryState`)

**Target implementation shape:**
```typescript
/**
 * Formats an ISO timestamp as a human-readable relative time string.
 *
 * @param isoTimestamp - ISO 8601 string (e.g. "2026-04-29T10:00:00Z")
 * @param nowMs        - Current time in milliseconds (defaults to Date.now(); injectable for tests)
 * @returns "just now" | "X min ago" | "X hours ago" | "X days ago"
 */
export function formatRelativeTime(isoTimestamp: string, nowMs: number = Date.now()): string {
  const diffMs = nowMs - new Date(isoTimestamp).getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1)  return 'just now'
  if (diffMins < 60) return `${diffMins} min ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 48) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
}
```

---

## Shared Patterns

### `'use client'` directive
**Source:** `src/components/LastUpdated.tsx` line 1, `src/components/theme/ThemeToggle.tsx` line 1
**Apply to:** `src/components/LastUpdated.tsx` (already present; keep on first line)
```typescript
'use client'
```
Note: `src/lib/formatRelativeTime.ts` is a pure utility — no `'use client'` directive needed.

### `useEffect` with cleanup return
**Source:** `src/components/transfers/AuthModal.tsx` lines 52–58
**Apply to:** `LastUpdated` connected component's interval effect
```typescript
return () => clearInterval(id)   // cleanup pattern
```

### Dark mode Tailwind classes
**Source:** `src/components/LastUpdated.tsx` line 11 (current), extended per `src/components/transfers/AuthModal.tsx` and `src/components/nav/MobileNav.tsx` patterns
**Apply to:** `LastUpdatedDisplay` className
- Normal: `text-zinc-400` (no dark override needed — zinc-400 works in both modes)
- Stale: `text-amber-600 dark:text-amber-500`

### Pure function test pattern (for `formatRelativeTime.test.ts`)
**Source:** `src/lib/chip-strategy-engine.test.ts` lines 1–2, `src/lib/squad-adapter.test.ts` lines 1–2
```typescript
import { describe, it, expect } from 'vitest'
import { formatRelativeTime } from '@/lib/formatRelativeTime'
```
Tests pass `nowMs` as second argument to make assertions deterministic (same pattern as `nowSeconds` injection in `computeAuthExpiryState`).

---

## No Analog Found

None. Both files have strong analogs.

---

## Metadata

**Analog search scope:** `src/components/`, `src/lib/`
**Files scanned:** 12 source files read, 3 glob scans, 4 grep scans
**Pattern extraction date:** 2026-04-29
