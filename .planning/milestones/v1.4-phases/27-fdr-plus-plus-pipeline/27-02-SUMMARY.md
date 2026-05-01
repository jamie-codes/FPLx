---
phase: 27-fdr-plus-plus-pipeline
plan: "02"
subsystem: ui
tags: [ui, club-form, fixture-ease, ranking-panel, react-testing-library, rtl, vitest, jsdom]
dependency_graph:
  requires:
    - phase: 27-01
      provides: "attacking_ease_{1,3,5}gw + defensive_ease_{1,3,5}gw per team on ClubForm type; RTL + jsdom devDependencies installed"
  provides:
    - "EaseBar.tsx — presentational tier-coloured bar component (TIER_BG local palette, role=img, aria-label)"
    - "AttDefToggle.tsx — ATT|DEF pill toggle mirroring GwToggle structure"
    - "FixtureEaseRankingPanel.tsx — 20-team ranked list with ATT/DEF + 1/3/5 GW toggles, panel-local state"
    - "page.tsx mounts FixtureEaseRankingPanel ABOVE ClubFormTable in Club Form tab"
    - "8 component tests covering sort, BGW filter, both toggles, loading/error states"
  affects:
    - "Phase 28 (xPts Engine) — attacking_difficulty and defensive_difficulty now surfaced in UI; Phase 28 can consume for clean-sheet probability"
    - "ClubFormTable — sibling component, state scoping confirmed (no props passed, no bleed)"

tech-stack:
  added: []
  patterns:
    - "Panel-local useState (never hoisted to page.tsx) enforces state-scoping invariant D-10"
    - "easeKey() helper generates ClubForm field name from (mode, win) pair — single source of truth for key shape in component and tests"
    - "per-file // @vitest-environment jsdom directive overrides global vitest.config.ts jsdom setting for RTL component tests (B1 invariant)"
    - "TIER_BG palette kept local to EaseBar.tsx — not extracted to shared module (avoids scope creep per 27-RESEARCH.md)"

key-files:
  created:
    - "src/components/club-form/EaseBar.tsx"
    - "src/components/club-form/AttDefToggle.tsx"
    - "src/components/club-form/FixtureEaseRankingPanel.tsx"
    - "tests/components/club-form/FixtureEaseRankingPanel.test.tsx"
  modified:
    - "src/app/page.tsx"
  deleted:
    - "tests/smoke.test.tsx (temporary Wave 0 file, replaced by real component test)"

key-decisions:
  - "ATT/DEF and 1/3/5 GW state lives only inside FixtureEaseRankingPanel (D-10) — NEVER hoisted to page.tsx; verified by grep returning 0 matches in ClubFormTable.tsx"
  - "Default window = 3 GW (mid-range planning horizon, most common FPL unit); default mode = ATT (D-09)"
  - "isMobile useState removed (destructured value never read, lint warning); mobile layout handled purely via Tailwind sm: responsive classes"
  - "TIER_BG palette is a local duplicate in EaseBar.tsx, not a shared module — avoids premature abstraction for single-phase use"
  - "smoke.test.tsx deleted — its purpose (prove RTL/jsdom works) is superseded by the 8 real component tests"

requirements-completed:
  - FIX-01
  - FIX-02

duration: ~15 minutes
completed: 2026-04-28
---

# Phase 27 Plan 02: Fixture Ease Ranking Panel UI Summary

**FixtureEaseRankingPanel surfaces FDR++ ease aggregates — 20-team ranked list with ATT/DEF and 1/3/5 GW pill toggles mounted above ClubFormTable on the Club Form tab, with panel-local state scoping (D-10) and 8 passing component tests.**

## Performance

- **Duration:** ~15 minutes
- **Started:** 2026-04-28T08:20:00Z
- **Completed:** 2026-04-28T08:35:00Z
- **Tasks:** 3 (Tasks 1 + 2 auto, Task 3 human-verify)
- **Files modified:** 5 (3 created, 1 modified, 1 deleted)

## Accomplishments

- Three new components shipped: EaseBar (tier-coloured proportional bar), AttDefToggle (ATT|DEF pill), FixtureEaseRankingPanel (ranked list with both toggles)
- State scoping invariant D-10 enforced: ATT/DEF and 1/3/5 GW state lives only inside FixtureEaseRankingPanel; toggling does NOT change FixtureBadges colours in the ClubFormTable below (verified via grep + human check)
- 8 component tests cover: smoke render, default toggle state, sort order, BGW null filter, ATT/DEF toggle re-rank, GW toggle re-rank, loading state, error state — all green
- Human verification approved: panel placement above ClubFormTable, both toggles functional, mobile layout readable, dark/light mode respected
- Full test suite: 22 test files, 254 tests pass, 8 skipped — no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: EaseBar.tsx + AttDefToggle.tsx** - `2286f85` (feat)
2. **Task 2: FixtureEaseRankingPanel + page.tsx mount + component tests + smoke.test.tsx deleted** - `74f5f8c` (feat)
3. **Task 3: Human verification** — approved by user (no code commit)

## Files Created/Modified

- `src/components/club-form/EaseBar.tsx` - Presentational tier-coloured ease bar; TIER_BG local palette; `role="img"` + `aria-label="Ease NN%"`; `data-testid="ease-bar"` + `data-tier={tier}`
- `src/components/club-form/AttDefToggle.tsx` - ATT|DEF pill toggle; mirrors GwToggle structure verbatim; `aria-pressed` on active button; `min-h-[44px]` mobile tap target
- `src/components/club-form/FixtureEaseRankingPanel.tsx` - 20-team ranked list; consumes `useClubForm()`; `easeKey()` helper; BGW filter (`typeof t[key] === 'number'`); panel-local `useState<Win>` + `useState<Mode>`
- `src/app/page.tsx` - `FixtureEaseRankingPanel` imported and mounted ABOVE `ClubFormTable` inside `activeTab === 'club-form'` branch via JSX fragment
- `tests/components/club-form/FixtureEaseRankingPanel.test.tsx` - 8 RTL tests; `// @vitest-environment jsdom` first-line directive; `vi.mock('@/lib/hooks/useClubForm')`
- `tests/smoke.test.tsx` - DELETED (superseded by real component tests)

## State-Scoping Discipline (D-10)

The state-scoping invariant (Decision D-10, Pitfall #5) was the critical correctness requirement for this plan. Implementation approach:

1. `mode` (`ATT | DEF`) and `win` (`1 | 3 | 5`) are declared via `useState` inside `FixtureEaseRankingPanel` only
2. Neither state variable is passed to `ClubFormTable` or any other sibling
3. `page.tsx` renders both components as siblings inside a `<>` fragment — no shared state props
4. Verified: `grep -c "FixtureEaseRankingPanel" src/components/club-form/ClubFormTable.tsx` returns 0
5. Human verification check 8 ("State scoping check") confirmed: FixtureBadges colours unchanged when ATT/DEF or 1/3/5 GW flipped in panel

## Human Verification Outcome

Task 3 checkpoint was approved. All 10 checks passed:
- Panel renders above ClubFormTable heading "Fixture Ease Ranking" ✓
- ATT default (pressed/dark), 3 GW default (pressed/dark) ✓
- 20 teams ranked easiest-first with green/amber/red bars ✓
- DEF toggle re-ranks list (different ordering than ATT) ✓
- 1 GW and 5 GW toggles both change rank order ✓
- FixtureBadges colours in ClubFormTable unchanged when panel toggles are flipped (D-10) ✓
- Mobile layout readable at <640px; 44px tap targets ✓
- Dark/light theme respected ✓

## Decisions Made

- **Panel-local state only (D-10):** ATT/DEF and GW state scoped to FixtureEaseRankingPanel exclusively, enforcing the non-bleed invariant between the new panel and the existing ClubFormTable
- **Default window = 3 GW:** Mid-range FPL planning horizon; 1 GW is too noisy, 5 GW too far ahead
- **Default mode = ATT (D-09):** Attacking ease is primary user intent (buying forwards/midfielders)
- **Removed isMobile useState:** The `useState(false)` / `useEffect` pair for detecting mobile viewport was dropped — the destructured value was never read; Tailwind `sm:` responsive classes handle mobile layout without JS
- **TIER_BG local to EaseBar.tsx:** No shared colour module created; duplication is intentional for single-phase use (per 27-RESEARCH.md recommendation)

## Deviations from Plan

None — plan executed exactly as written. The `isMobile` removal was pre-documented in the plan action notes (revision iteration 2).

## Issues Encountered

None. All acceptance checks passed on first run:
- `npm test`: 254 passed / 22 files
- `npx tsc --noEmit`: exit 0
- State scoping grep: 0 matches in ClubFormTable.tsx
- FixtureBadges.tsx diff: 0 lines changed

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Phase 28 (xPts Engine) is unblocked. The FDR++ foundation is fully surfaced:
- `attacking_difficulty` and `defensive_difficulty` are available per fixture in `ClubFormFixture`
- `attacking_ease_{1,3,5}gw` / `defensive_ease_{1,3,5}gw` are available per team in `ClubForm`
- Phase 28 can now consume `attacking_difficulty` for clean-sheet probability and per-position scoring rates without any additional pipeline or type work

## Threat Flags

None. No new trust boundaries, network endpoints, or auth surfaces introduced. The panel is a read-only client component consuming the existing `/api/club-form` route. React escapes `team_short_name` string children by default; no `dangerouslySetInnerHTML` used (T-27-07 mitigated).

## Self-Check: PASSED

All files created/modified exist on disk:
- FOUND: src/components/club-form/EaseBar.tsx
- FOUND: src/components/club-form/AttDefToggle.tsx
- FOUND: src/components/club-form/FixtureEaseRankingPanel.tsx
- FOUND: tests/components/club-form/FixtureEaseRankingPanel.test.tsx
- FOUND: src/app/page.tsx (modified)
- NOT FOUND (deleted as intended): tests/smoke.test.tsx

All task commits verified in git log:
- 2286f85: Task 1 (EaseBar.tsx + AttDefToggle.tsx)
- 74f5f8c: Task 2 (FixtureEaseRankingPanel + page.tsx + tests + smoke deleted)

Full test suite: 22 files, 254 passed — green.
TypeScript: `npx tsc --noEmit` exit 0 — no errors.

---
*Phase: 27-fdr-plus-plus-pipeline*
*Completed: 2026-04-28*
