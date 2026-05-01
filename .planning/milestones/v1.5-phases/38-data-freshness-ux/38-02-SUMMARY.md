---
phase: 38-data-freshness-ux
plan: "02"
subsystem: components/display
tags:
  - last-updated
  - relative-time
  - interval-tick
  - dat-02
  - rtl-tests
dependency_graph:
  requires:
    - "formatRelativeTime(isoTimestamp, nowMs?) from Plan 01"
    - "useLastUpdated() hook (unchanged)"
  provides:
    - "LastUpdated — connected component with 30s interval tick (FRE-01, FRE-02, FRE-03)"
    - "LastUpdatedDisplay — pure render component accepting relativeTime: string"
  affects:
    - "src/app/page.tsx (mount site unchanged — <LastUpdated /> already present)"
tech_stack:
  added: []
  patterns:
    - "DAT-02 pure/connected split — display component receives pre-formatted string"
    - "useEffect + setInterval with clearInterval cleanup (T-38-07 mitigation)"
    - "vi.useFakeTimers + vi.advanceTimersByTime for deterministic interval tests"
commit_metadata:
  commits:
    - hash: "b4ddfa7"
      message: "feat(38-02): upgrade LastUpdated to relative-time with 30s interval tick"
      files:
        - src/components/LastUpdated.tsx
        - src/components/LastUpdated.test.tsx
key_files:
  created:
    - path: src/components/LastUpdated.test.tsx
      lines: 118
      role: "RTL test suite — 11 tests across LastUpdatedDisplay and LastUpdated (connected)"
  modified:
    - path: src/components/LastUpdated.tsx
      lines: 35
      role: "Upgraded component: relativeTime prop, 30s interval, cleanup"
deviations: []
---

## What Was Built

`src/components/LastUpdated.tsx` upgraded to display a human-readable relative-time string produced by `formatRelativeTime` (Plan 01). The pure/connected DAT-02 split is preserved: `LastUpdatedDisplay` now accepts `relativeTime: string` (pre-formatted) instead of a raw `timestamp`, keeping the display component free of `Date` logic.

`LastUpdated` (connected) wires the interval: on mount it formats the label immediately, then calls `setInterval(30_000)` so the string re-formats every 30 seconds as time passes in the browser session. `clearInterval` is returned from `useEffect` so no timers leak on unmount or route change. Effect dependency is `[data?.last_updated]` — re-runs only when the underlying timestamp changes, not on every TanStack Query refetch tick.

Stale data renders amber (`text-amber-600 dark:text-amber-500`); fresh data renders zinc (`text-zinc-400`). No "Data as of" prefix, no "(stale)" suffix — stale state is communicated by colour alone per D-02.

## Test Counts

**LastUpdated.test.tsx — 11 tests, all pass**

`describe('LastUpdatedDisplay')` — 6 tests:
- renders relativeTime string verbatim
- uses zinc colour when not stale
- uses amber colour (+ dark variant) when stale
- applies base classes text-xs and mt-1 (non-stale)
- applies base classes text-xs and mt-1 (stale)
- does not render "(stale)" suffix

`describe('LastUpdated (connected)')` — 5 tests:
- renders nothing when hook returns undefined
- renders formatted relative time on first paint
- re-formats label after 59 min → 1 hour band crossing (fake timers)
- clears interval on unmount (clearInterval spy)
- renders amber when stale flag is true

Full suite: **397 passed, 34 skipped** — no regressions.

## Pre-existing Tests

`src/app/page.test.tsx` did not require updates — it mocks `LastUpdated` entirely via `vi.mock('@/components/LastUpdated', ...)` and is unaffected by the prop rename.

## Human Verification Outcome

All 8 checks passed (approved by user):
- Header shows relative-time label on all sections and sub-tabs (Analyse / Plan / Squad + all sub-tabs)
- No old "Data as of" format visible
- No prefix, no "(stale)" suffix
- Mobile viewport (375px) — label above fold
- className correct: `text-xs mt-1 text-zinc-400` for fresh data
- No console errors related to setInterval or useEffect

## Self-Check: PASSED
