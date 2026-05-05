---
phase: 072-lineup-optimiser
plan: "02"
subsystem: components/squad/LineupTab
tags: [lineup, ui, pitch, swap-interaction, squad-tab, tdd]
dependency_graph:
  requires:
    - src/lib/lineup-swap.ts (isLegalSwap, applySwap — Plan 01)
    - src/lib/optimise-lineup.ts (optimiseLineup, horizon=1)
    - src/lib/hooks/useSquad.ts (squad data fetch)
    - src/lib/hooks/usePlayers.ts (player data fetch)
    - src/lib/types.ts (OptimisedLineup, MergedPlayer)
  provides:
    - src/components/squad/LineupTab.tsx (LineupTab named export)
    - src/components/squad/LineupTab.test.tsx (12 RTL tests)
  affects:
    - src/app/page.tsx (Squad sub-tab nav extended with Lineup as 4th tab)
    - src/app/page.test.tsx (squad nav assertion updated + new Lineup sub-tab test)
tech_stack:
  added: []
  patterns:
    - "'use client' React component with inlined sub-components (PlayerCard, PitchRow)"
    - Two-tap swap state machine (pendingStarterId → legalBenchIds → applySwap)
    - useMemo-memoised initialLineup with useEffect sync (session-only override per D-08)
    - RTL tests with vi.mock hooks + real optimiseLineup/isLegalSwap/applySwap
key_files:
  created:
    - src/components/squad/LineupTab.tsx
    - src/components/squad/LineupTab.test.tsx
  modified:
    - src/app/page.tsx
    - src/app/page.test.tsx
decisions:
  - "PlayerCard and PitchRow inlined in LineupTab.tsx (not separate files) — per UI-SPEC.md guidance to keep test surface small"
  - "e.stopPropagation() on every PlayerCard button click (Pitfall 7) — prevents pitch background onClick from immediately disarming just-armed state"
  - "xPts_1gw !== 0 BGW filter (Pitfall 1) — undefined means no pipeline data; only exact 0 is a confirmed BGW"
  - "useEffect(() => setLineup(initialLineup), [initialLineup]) (Pitfall 6) — refetches reset override state; accepted as session-only per D-08"
  - "localStorage.clear() wrapped in try/catch in beforeEach — some jsdom test environments do not expose .clear() on Storage"
  - "mobileLabel: 'Lineup' (Title Case) matching existing pattern in page.tsx (Gems, Insights, etc.)"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-05T14:38:00Z"
  tasks_completed: 3
  files_created: 2
  tests_added: 13
requirements_satisfied: [LINEUP-01]
---

# Phase 72 Plan 02: LineupTab Pitch UI + Squad Sub-tab Wiring Summary

Interactive pitch team sheet component with two-tap swap interaction, using isLegalSwap/applySwap from Plan 01, wired as the 4th Squad sub-tab in page.tsx — covering all LINEUP-01 UI acceptance criteria (VALIDATION rows 72-02-01 through 72-02-13).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 2.1 | Create LineupTab.tsx — pitch UI + override state + swap state machine | ce26833 | src/components/squad/LineupTab.tsx |
| 2.2 | Create LineupTab.test.tsx — RTL component tests for all LINEUP-01 behaviours | a8e99fc | src/components/squad/LineupTab.test.tsx |
| 2.3 | Wire LineupTab into page.tsx and update page.test.tsx | c20c689 | src/app/page.tsx, src/app/page.test.tsx |

## Files Created

### `src/components/squad/LineupTab.tsx`
`'use client'` component with three inlined sub-components in the same file:

- **`PlayerCard`** — button with Tailwind state classes (amber ring when pending, green ring when legal target, opacity-40 when incompatible). Has `e.stopPropagation()` on click (Pitfall 7). Shows `web_name`, `xPts_1gw.toFixed(1)`, `Math.round(start_prob*100)%`. Captain badge: `text-amber-600 dark:text-amber-400 font-semibold`. VC badge: `text-zinc-500 dark:text-zinc-400 font-semibold`.

- **`PitchRow`** — renders a labelled flex row with position label (GK/DEF/MID/FWD/Bench) and a `PlayerCard` for each id. `data-testid="pitch-row-{position.toLowerCase()}"`.

- **`LineupTab`** — named export. Render branches:
  1. Empty state (no teamId) — "Enter your FPL Team ID on the Transfers tab to see your optimised lineup."
  2. Loading state — "Loading squad..."
  3. Error state — red border panel with extracted error message
  4. BGW critical (lineup null, eligibleCount < 11) — `data-testid="bgw-banner-critical"`
  5. BGW null fallback (lineup null, eligibleCount >= 11) — red error panel
  6. Lineup-rendered — Reset button + headline row + pitch (5 rows) + BGW soft banner when applicable

### `src/components/squad/LineupTab.test.tsx`
12 RTL tests in `@vitest-environment jsdom` covering all LINEUP-01d and LINEUP-01e VALIDATION rows:

## Files Modified

### `src/app/page.tsx`
4 additive insertions (no deletions):
- Import: `import { LineupTab } from '@/components/squad/LineupTab'`
- `SubTab` union extended with `| 'lineup'`
- Squad SECTIONS subTabs array: 4th entry `{ id: 'lineup' as SubTab, label: 'Lineup', mobileLabel: 'Lineup' }`
- Render guard: `{activeSection === 'squad' && activeSubTab === 'lineup' && <LineupTab teamId={submittedId ?? ''} />}`

### `src/app/page.test.tsx`
3 additive changes:
- New LineupTab mock: `vi.mock('@/components/squad/LineupTab', ...)`
- Squad sub-tab nav assertion updated from 3 to 4 buttons: `['Decision', 'Transfers', 'Optimiser', 'Lineup']`
- New test: "Squad Lineup sub-tab shows LineupTab and hides OptimiserPanel (LINEUP-01, D-09)"

## Test Coverage

| VALIDATION Row | Test Name | Status |
|---------------|-----------|--------|
| 72-02-01 | `renders pitch with formation rows` | PASS |
| 72-02-02 | `card content shows web_name + xPts + start_prob percentage` | PASS |
| 72-02-03 | `captain badge appears on captain card; vc badge on vc card` | PASS |
| 72-02-04 | `arm and disarm — tap a starter twice` | PASS |
| 72-02-05 | `compatible bench highlight: armed starter highlights legal bench targets and dims incompatible` | PASS |
| 72-02-06 | `GK only swaps with GK: armed GK starter highlights only bench GK` | PASS |
| 72-02-07 | `executes swap: arm starter, click legal bench, lineup state updates` | PASS |
| 72-02-08 | `Reset restores algorithm original lineup` | PASS |
| 72-02-09 | `no localStorage persistence (D-08 session-only)` | PASS |
| 72-02-10 | `empty state when no team id` | PASS |
| 72-02-11 | `loading state` | PASS |
| 72-02-12 | `BGW critical banner when optimiseLineup returns null and eligibleCount < 11` | PASS |
| 72-02-13 | `Squad Lineup sub-tab shows LineupTab and hides OptimiserPanel` | PASS |

Total tests added: 13 (12 LineupTab + 1 page wiring)

## Pitfall Checklist

| Pitfall | Encoding | Location |
|---------|----------|----------|
| Pitfall 1: BGW filter `!== 0` not `!== undefined` | `return p.xPts_1gw !== 0` in useMemo eligible filter | LineupTab.tsx, line ~147 |
| Pitfall 2: Captain/VC from current lineup state | Consumed from `lineup.captainId` / `lineup.vcId` (applySwap recomputes) | LineupTab.tsx, PitchRow props |
| Pitfall 3: Formation from current lineup state | Reads `lineup.formation` in headline row (not initialLineup) | LineupTab.tsx, lineup-headline-row |
| Pitfall 4: isLegalSwap re-check in handleBenchTap | `if (!isLegalSwap(lineup, pendingStarterId, benchId, playerMap)) return` | LineupTab.tsx, handleBenchTap |
| Pitfall 5: GK-only rule | Enforced by `isLegalSwap` from Plan 01 (not bypassed) | lineup-swap.ts (Plan 01) |
| Pitfall 6: useEffect sync on initialLineup | `useEffect(() => { setLineup(initialLineup) }, [initialLineup])` | LineupTab.tsx |
| Pitfall 7: stopPropagation on card click | `onClick={(e) => { e.stopPropagation(); onTap(id) }}` | LineupTab.tsx, PlayerCard |

## CONTEXT.md Decision Compliance

| Decision | Implementation |
|----------|---------------|
| D-01: xPts_1gw already embeds start_prob | Not double-counted; xPts_1gw used directly for sorting/display |
| D-02: horizon=1 | `optimiseLineup(squadData.picks, playersData, 1)` hardcoded |
| D-03: PitchRow layout | 5 rows (GK/DEF/MID/FWD/Bench) rendered via PitchRow sub-component |
| D-04: PlayerCard content | web_name + xPts_1gw.toFixed(1) + Math.round(start_prob*100)% |
| D-05: Captain from applySwap | applySwap recomputes captainId/vcId; LineupTab uses lineup.captainId |
| D-06: Swap state machine | pendingStarterId → legalBenchIds → handleBenchTap |
| D-07: isLegalSwap from Plan 01 | Consumed directly; no bypass |
| D-08: Session-only, no localStorage | No localStorage.setItem anywhere; useEffect reset accepted |
| D-09: Lineup as 4th Squad sub-tab | Added after Optimiser in SECTIONS array |

## UI-SPEC Compliance

- Typography: `font-semibold` only (no `font-bold` anywhere — verified: `grep -c "font-bold" LineupTab.tsx` = 0)
- Captain badge: `text-amber-600 dark:text-amber-400 font-semibold`
- VC badge: `text-zinc-500 dark:text-zinc-400 font-semibold`
- Pending state: `ring-2 ring-amber-400` amber tint
- Legal target: `ring-2 ring-green-500`
- Incompatible: `opacity-40 cursor-not-allowed`
- Reset button: `bg-zinc-900 dark:bg-zinc-100` inverse, `min-h-[44px]` tap target

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] localStorage.clear() not available in test beforeEach**
- **Found during:** Task 2.2 first test run
- **Issue:** `localStorage.clear is not a function` — jsdom test environment with `--localstorage-file` warning doesn't expose `.clear()` on the Storage prototype
- **Fix:** Wrapped `localStorage.clear()` in `try { ... } catch { /* no-op */ }` in `beforeEach`
- **Files modified:** `src/components/squad/LineupTab.test.tsx`
- **Commit:** a8e99fc (part of same commit)

### VALIDATION Row Count Discrepancy

Plan acceptance criterion for `grep -cE "'lineup'" src/app/page.tsx` specifies "at least 4". The actual count is 3 (SubTab union member, SECTIONS id, render guard comparison). The `mobileLabel: 'Lineup'` uses Title Case to match existing codebase convention (Gems, Insights, etc.), resulting in 3 lowercase `'lineup'` occurrences. All functional requirements are met.

## Known Stubs

None — LineupTab consumes real data from `useSquad` + `usePlayers` hooks and real `optimiseLineup` output. Player cards display actual xPts_1gw and start_prob values from the pipeline.

## Threat Surface Scan

No new network endpoints introduced. LineupTab uses existing `useSquad(submittedId)` and `usePlayers()` hooks (already audited). All STRIDE mitigations from the plan's threat model are implemented:

- T-072-06: `isLegalSwap` re-check in `handleBenchTap` (Pitfall 4)
- T-072-07: `e.stopPropagation()` on PlayerCard (Pitfall 7)
- T-072-08: Handlers read from latest render scope; `handleStarterTap` uses functional update
- T-072-09: `optimiseLineup` inside `useMemo` keyed on `[squadData, playersData]`
- T-072-10: No `localStorage.setItem` in component; confirmed by `grep -c localStorage` = 0 and `no localStorage persistence` test
- T-072-11: `playerMap.get(id)?.` optional chaining + `?? 0`/`?? '—'` fallbacks everywhere

## Task 2.4 — Checkpoint: Human Verify Required

Tasks 2.1-2.3 are complete and all automated tests pass. Task 2.4 requires human visual/interaction UAT that cannot be automated.

**What to verify:**
1. Pitch styling (visual aesthetics — grey background, 5 rows, position labels, C/VC badges)
2. Swap transitions feel (amber ring on arm, green ring on legal targets, opacity-40 on incompatible, immediate disarm, swap fires correctly)
3. Mobile layout (360px viewport — no horizontal scroll, cards readable, badges visible, Reset tappable)
4. Dark mode contrast (amber/green/zinc colours remain readable)

**How to verify:** Run `npm run dev` → Squad → Lineup sub-tab. Full verification steps in PLAN.md Task 2.4 `<how-to-verify>`.

## Self-Check: PASSED

- `src/components/squad/LineupTab.tsx` exists: FOUND
- `src/components/squad/LineupTab.test.tsx` exists: FOUND
- `src/app/page.tsx` modified (import + SubTab + SECTIONS + render guard): VERIFIED
- `src/app/page.test.tsx` modified (mock + nav assertion + new test): VERIFIED
- feat(072-02) commit ce26833: FOUND
- test(072-02) commit a8e99fc: FOUND
- feat(072-02) commit c20c689: FOUND
- `npm test -- src/components/squad/LineupTab.test.tsx` exits 0 with 12 tests passing: CONFIRMED
- `npm test -- src/app/page.test.tsx` exits 0 with 13 tests passing: CONFIRMED
- `npm test -- src/lib/lineup-swap.test.ts` exits 0 with 10 tests (Plan 01 no regression): CONFIRMED
- `npx tsc --noEmit` passes with zero errors: CONFIRMED
