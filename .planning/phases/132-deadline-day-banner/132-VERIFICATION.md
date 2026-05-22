---
phase: 132-deadline-day-banner
verified: 2026-05-22T12:12:00Z
status: human_needed
score: 12/12 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Visit the app with a live FPL bootstrap that has a future is_next event; confirm the banner renders above the section nav with the correct GW text"
    expected: "Banner shows 'GWN deadline in Xh Ym' (or 'Ym') using the real FPL deadline; text matches the bootstrap is_next event id and deadline_time"
    why_human: "Requires a running dev server with a live/proxied FPL bootstrap returning a real is_next event; cannot verify without an active FPL season or mock proxy"
  - test: "Dismiss the banner with the × button, then refresh the page"
    expected: "Banner is absent after refresh for the same GW; when the next GW becomes is_next the banner reappears"
    why_human: "LocalStorage persistence and cross-GW reappearance requires browser state across page loads"
  - test: "With fewer than 2h to deadline, confirm the banner becomes sticky red at the top of the viewport while scrolling through section tabs"
    expected: "Banner sticks to top-0 with red colouring; sits visually above the section nav (z-50 > z-40)"
    why_human: "Visual layering and scroll behaviour can only be confirmed in a live browser"
  - test: "Open the Insights tab with the red sticky banner active and scroll the inner sticky filter row"
    expected: "The Insights sticky filter row should not be obscured by the red banner (--nav-height interaction noted as open carry-forward)"
    why_human: "CSS stacking context interaction between two sticky elements requires live browser + active red state"
---

# Phase 132: Deadline Day Banner Verification Report

**Phase Goal:** Deadline Day Banner — surface the next FPL gameweek deadline as a dismissable countdown banner with 3-state urgency (zinc/amber/red+sticky).
**Verified:** 2026-05-22T12:12:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | useNextDeadline returns `{ id, deadline_time }` when exactly one bootstrap event has `is_next === true` | VERIFIED | `useNextDeadline.ts` line 25: `events.find((e) => e.is_next) ?? null`; test A passes (`id: 33, deadline_time: '2026-01-22T11:00:00Z'`) |
| 2 | useNextDeadline returns null when no bootstrap event has `is_next === true` (off-season) | VERIFIED | Same selection path; null returned when find returns undefined; test passes |
| 3 | useNextDeadline surfaces `isError === true` when /api/fpl/bootstrap-static/ returns non-OK | VERIFIED | Lines 17-20 throw a typed error on `!res.ok`; test using 502 response passes with `isError: true` |
| 4 | Hook uses TanStack Query with queryKey `['next-deadline']`, staleTime `3_600_000ms`, retry 1 | VERIFIED | Lines 32-35: `queryKey: ['next-deadline']`, `staleTime: 60 * 60 * 1000`, `retry: 1` |
| 5 | User sees 'GW{id} deadline in {hours}h {minutes}m' / '{minutes}m' banner for future deadlines | VERIFIED | `DeadlineBanner.tsx` line 125: `<span>GW{id} deadline in {formatCountdown(msRemaining)}</span>`; formatCountdown drops `0h` prefix; tests A2 and E1 pass |
| 6 | Banner uses zinc / amber / red+sticky classes keyed on msRemaining thresholds | VERIFIED | `URGENCY_CLASSES` and `STICKY_CLASSES` maps at lines 17-27; `computeUrgency` at lines 31-35; tests B1-B3 pass asserting exact class substrings |
| 7 | Countdown re-renders every 60 seconds; state escalates automatically crossing thresholds | VERIFIED | `setInterval(tick, TICK_MS)` where `TICK_MS = 60_000`; test B4 advances system time 1h and asserts class changes from amber to red |
| 8 | User can dismiss the banner with × button; banner immediately renders null | VERIFIED | `handleDismiss()` sets `setDismissed(true)`; render gate at line 102; test C2 passes |
| 9 | Dismiss state is keyed per GW (`deadline-dismissed:GW{id}`); reappears on new GW | VERIFIED | Key literal `deadline-dismissed:GW${id}` at lines 61, 74, 110; id-change `useEffect` at lines 68-78 re-reads localStorage; test C1 passes |
| 10 | Banner renders null when data is null/undefined, msRemaining <= 0, deadline_time parses to NaN, or dismissed | VERIFIED | Render gates lines 98-102; tests A1, A3, A4, C1 pass |
| 11 | All localStorage reads/writes wrapped in try/catch | VERIFIED | Lines 60-64 (lazy init), 72-77 (id-change effect), 109-113 (dismiss handler) all have try/catch; tests C3 and C4 pass |
| 12 | Banner injected immediately above the sticky nav wrapper div in src/app/page.tsx | VERIFIED | `page.tsx` line 200: `<DeadlineBanner />`; line 201: `{/* Sticky nav wrapper */}` — banner line number (200) is less than wrapper comment line number (201) |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/hooks/useNextDeadline.ts` | useNextDeadline hook returning `{ id: number; deadline_time: string } \| null` | VERIFIED | 37 lines; exports `useNextDeadline` and `NextDeadline` type; no `'use client'`; imports `parseFPLBootstrap` from `@/lib/fpl-adapter` |
| `src/lib/hooks/useNextDeadline.test.ts` | Contract tests for is_next found, absent, non-OK response | VERIFIED | 114 lines; first line `// @vitest-environment jsdom`; 4 tests in `describe('useNextDeadline — Phase 132 DL-01'...)`; all pass |
| `src/components/DeadlineBanner.tsx` | DeadlineBanner client component with countdown, urgency states, dismiss | VERIFIED | 136 lines; first line `'use client'`; exports `DeadlineBanner`, `computeUrgency`, `formatCountdown` |
| `src/components/DeadlineBanner.test.tsx` | Vitest + Testing Library coverage for DL-01/DL-02/DL-03 | VERIFIED | 246 lines; 16 tests across 4 describe blocks; all pass |
| `src/app/page.tsx` | Layout injection of `<DeadlineBanner />` | VERIFIED | Import at line 39; JSX at line 200 above sticky nav wrapper comment at line 201 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `useNextDeadline.ts` | `/api/fpl/bootstrap-static/` | `fetch` inside `fetchNextDeadline` | WIRED | Line 16: `const res = await fetch('/api/fpl/bootstrap-static/')` |
| `useNextDeadline.ts` | `parseFPLBootstrap` in `fpl-adapter.ts` | import + safeParse | WIRED | Line 2 import; line 23 `parseFPLBootstrap(raw)` |
| `DeadlineBanner.tsx` | `useNextDeadline.ts` | import + invocation | WIRED | Line 4 import; line 47 `const { data } = useNextDeadline()` |
| `DeadlineBanner.tsx` | browser localStorage | try/catch getItem/setItem keyed `deadline-dismissed:GW${id}` | WIRED | Lines 61, 74 (reads); line 110 (write); all wrapped in try/catch |
| `page.tsx` | `DeadlineBanner.tsx` | JSX render above sticky nav wrapper div | WIRED | Line 39 import; line 200 `<DeadlineBanner />`; precedes sticky nav wrapper at line 201 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `DeadlineBanner.tsx` | `data` (from `useNextDeadline`) | `fetchNextDeadline` → `GET /api/fpl/bootstrap-static/` → `parseFPLBootstrap` → `events.find(e => e.is_next)` | Yes — live API proxy call, Zod-validated | FLOWING |
| `DeadlineBanner.tsx` | `msRemaining` | `new Date(deadlineTime).getTime() - Date.now()` on 60s interval | Yes — derived from live deadline_time + real clock | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 4 useNextDeadline contract tests pass | `npx vitest run src/lib/hooks/useNextDeadline.test.ts` | 4 passed, 0 failed | PASS |
| All 16 DeadlineBanner tests pass | `npx vitest run src/components/DeadlineBanner.test.tsx` | 16 passed, 0 failed | PASS |
| Combined suite (Plan 01 + 02) passes | Both files combined | 20 passed, 0 failed | PASS |
| TypeScript type-check clean | `npx tsc --noEmit` (filtered for DeadlineBanner/useNextDeadline/page.tsx) | No errors | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|------------|-------------|--------|----------|
| DL-01 | Plans 01 + 02 | User sees a persistent countdown banner to the next FPL gameweek deadline displayed in local timezone | SATISFIED | `useNextDeadline` fetches bootstrap and returns `{ id, deadline_time }`; `DeadlineBanner` renders `GW{id} deadline in Xh Ym`; 60s interval keeps countdown current |
| DL-02 | Plan 02 | Banner shifts visual urgency: neutral zinc (> 24h), amber (2-24h), red sticky (< 2h) | SATISFIED | `URGENCY_CLASSES` + `STICKY_CLASSES` + `computeUrgency` implement all three states; tests B1-B4 verify class substrings and auto-escalation |
| DL-03 | Plan 02 | User can dismiss the deadline banner per-gameweek; dismiss state resets on new GW | SATISFIED | `handleDismiss` writes `deadline-dismissed:GW${id}`; lazy-init + id-change effect reads per-GW key; tests C1-C4 verify all dismiss paths |

All three requirement IDs (DL-01, DL-02, DL-03) from both plan frontmatter entries are accounted for. REQUIREMENTS.md shows all three marked `[x] Complete` and mapped to Phase 132. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | No TODO/FIXME/placeholder comments in implementation files | — | — |
| None found | — | No hardcoded empty returns (`return null` render gates are conditional, not stubs) | — | — |
| None found | — | No `position: fixed` or `FPLEventSchema` duplication in DeadlineBanner.tsx | — | — |

No stub indicators found. All conditional `return null` paths are legitimate render gates (null data, past deadline, NaN guard, dismissed) — not stubs, as data flows from a live API call.

### Human Verification Required

#### 1. Live banner display with real FPL bootstrap

**Test:** Start the dev server; visit the app when FPL bootstrap has a future `is_next` event.
**Expected:** Banner appears above the section nav reading `GWN deadline in Xh Ym`; text matches real FPL deadline; banner is absent when no `is_next` event exists (off-season).
**Why human:** Requires a live or proxied FPL bootstrap returning a real `is_next: true` event; automated tests mock the hook.

#### 2. Dismiss persistence across page loads

**Test:** Dismiss the banner with ×; hard-refresh the page.
**Expected:** Banner stays hidden after refresh (localStorage key persists). Open a new GW boundary scenario: when `is_next` changes to the next GW id, the banner reappears.
**Why human:** LocalStorage persistence across page reloads requires browser session state; automated tests only verify within a single render.

#### 3. Red sticky positioning above section nav

**Test:** Approach a deadline (< 2h); observe scroll behaviour with both the red banner and the section nav sticky.
**Expected:** Red banner sticks to `top-0 z-50`; section nav sticks at `top-0 z-40` below it; banner visually layers above nav when scrolling.
**Why human:** CSS stacking context and scroll behaviour requires a real browser with the red state active.

#### 4. Insights tab sticky row interaction under red banner (open carry-forward)

**Test:** With red banner active (< 2h to deadline), open the Insights tab and scroll so the inner sticky filter row would normally pin.
**Expected:** Inner sticky filter row should remain visible and not be obscured by the deadline banner.
**Why human:** Interaction between two sticky elements at different z-levels (`z-50` banner vs `z-40` nav + `top-[var(--nav-height,96px)]` inner row) only surfaces in a live browser. This is an open carry-forward noted in 132-02-SUMMARY.md — may require updating `--nav-height` if observed.

### Gaps Summary

No programmatic gaps found. All 12 observable truths are verified against the actual codebase. All three requirements (DL-01, DL-02, DL-03) are fully implemented with passing unit tests and clean TypeScript compilation.

The `human_needed` status reflects four items requiring a live browser — the most significant being the visual layering of the red sticky banner above the section nav (a CSS stacking behaviour that cannot be asserted programmatically), and the noted open carry-forward regarding `--nav-height` interaction in the Insights tab.

---

_Verified: 2026-05-22T12:12:00Z_
_Verifier: Claude (gsd-verifier)_
