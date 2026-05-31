// Phase 96: vitest setup file — Node 25 / jsdom localStorage compatibility patch.
//
// Node v25 ships an experimental WebStorage global (`localStorage`, `sessionStorage`)
// that does NOT implement the full Storage interface (no .clear(), .setItem(), etc.).
// When vitest sets up the jsdom environment, its `populateGlobal` helper skips
// `localStorage`/`sessionStorage` because they are already in the Node global — but
// the Node 25 stubs are broken. This setup file re-assigns the correct jsdom-backed
// storage instances before each test.
//
// The `globalThis.jsdom` fixture is injected by vitest's jsdom environment provider
// (vitest/dist/chunks/index.DC7d2Pf8.js line 526) and carries the proper Storage
// objects on its `.window` property.
//
// This fix is required for Node v25 + vitest 4.x + jsdom; it should be a no-op on
// older Node versions where localStorage is not a built-in global.
//
// Deviation tracking: Rule 3 (blocking fix) — required by Phase 96 Plan 03 Task 3.
// The RED test file (src/lib/hooks/useDecisionHistory.test.ts) calls
// `window.localStorage.clear()` which throws on Node 25 without this patch.

import '@testing-library/jest-dom'
import { beforeEach } from 'vitest'

beforeEach(() => {
  // Only patch if we are in a jsdom environment (globalThis.jsdom is vitest's fixture).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dom = (globalThis as any).jsdom
  if (!dom || typeof dom.window === 'undefined') return

  // If window.localStorage already has .clear(), it's already the jsdom version — no patch needed.
  if (typeof window !== 'undefined' && typeof window.localStorage?.clear === 'function') return

  // Replace the broken Node 25 stubs with the jsdom-backed Storage objects.
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
      value: dom.window.localStorage,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(window, 'sessionStorage', {
      value: dom.window.sessionStorage,
      configurable: true,
      writable: true,
    })
  }
})
