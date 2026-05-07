---
phase: 77
plan: 01
subsystem: ui
tags: [ui, lineup, kit-art, captain, accuracy, mobile-polish, opt-02, pol-01, pol-02]
dependency_graph:
  requires: []
  provides: [teamKitUrl-helper, kit-image-PlayerCard, captain-row-flex-wrap, accuracy-overflow-x-auto]
  affects: [src/lib/fpl-images.ts, src/components/squad/LineupTab.tsx, src/components/squad/DecisionSummaryTab.tsx, src/components/accuracy/AccuracyTab.tsx]
tech_stack:
  added: []
  patterns: [useState-onError-fallback, overflow-x-auto-table-wrapper]
key_files:
  created:
    - tests/lib/fpl-images.test.ts
  modified:
    - src/lib/fpl-images.ts
    - src/components/squad/LineupTab.tsx
    - src/components/squad/DecisionSummaryTab.tsx
    - src/components/accuracy/AccuracyTab.tsx
decisions:
  - teamKitUrl uses fantasy.premierleague.com/dist/img/shirts/standard/shirt_{code}-66.png (D-01 confirmed)
  - Plain img tag with onError handler (D-03 — not Next.js Image)
  - CaptainPicksPanel EOModeToggle already had flex-wrap (no edit needed)
metrics:
  duration: ~8 minutes
  completed: "2026-05-07"
  tasks: 3
  files: 4
---

# Phase 77 Plan 01: Pitch Visuals & Mobile Polish (OPT-02 + POL-01 + POL-02) Summary

**One-liner:** FPL team kit images on LineupTab PlayerCard with team-colour fallback, captain row flex-wrap fix, and AccuracyTab overflow-x-auto wrappers on all four tables.

## What Was Built

### Task 1 (TDD): teamKitUrl helper in fpl-images.ts

New exported function added after `teamBadgeUrl`:

```typescript
export function teamKitUrl(teamCode: number): string {
  return `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}-66.png`
}
```

Test file `tests/lib/fpl-images.test.ts` created with 5 test cases:
- `playerImageUrl` and `teamBadgeUrl` existing function tests (2)
- `teamKitUrl` tests for Arsenal/3, Liverpool/14, Man City/43 (3)

All 5 tests pass. TDD RED→GREEN cycle completed.

### Task 2 (TDD): Kit image + fallback in LineupTab PlayerCard

`src/components/squad/LineupTab.tsx` modified:

**New imports (lines 10–11):**
- `import { teamKitUrl } from '@/lib/fpl-images'`
- `import { TEAM_BADGE_CODE, getTeamColour } from '@/lib/team-colours'`

**PlayerCard body restructured (lines 40–130):**
- Added `const [kitError, setKitError] = useState(false)` hook
- Added `teamCode`, `teamColour`, `showFallback` derived values
- Body button children wrapped in `<div className="flex flex-row items-center gap-2 w-full">`
- Kit image: `<img src={teamKitUrl(teamCode)} alt="${team_short_name} kit" width={28} height={28} className="w-6 h-6 sm:w-7 sm:h-7 object-contain shrink-0" onError={() => setKitError(true)} />`
- Fallback: `<div role="img" aria-label="${team_short_name} team colour" className="w-6 h-6 sm:w-7 sm:h-7 rounded shrink-0" style={{ background: teamColour.primary }} />`
- Text column moved into inner `<div className="flex flex-col min-w-0 flex-1">`
- All existing data-testids preserved (`pitch-card-${id}`, `pitch-card-body-${id}`, `captain-badge`, `vc-badge`, `set-c-${id}`, `set-vc-${id}`)
- `min-h-[44px]` on Set C/Set VC pillBase preserved
- `// eslint-disable-next-line @next/next/no-img-element` added above img (anti-pattern #1 avoided)

Production build passes.

### Task 3: flex-wrap + AccuracyTab overflow wrappers

**DecisionSummaryTab.tsx (POL-01):**
- Line 509 className updated: `sm:flex-wrap` inserted between `sm:flex-row` and `sm:items-center`
- Before: `flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3`
- After: `flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3`

**CaptainPicksPanel.tsx (POL-01 part B — VERIFY ONLY):**
- Line 38 already contains `inline-flex flex-wrap rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-700`
- No edit required. `flex-wrap` was already present as documented in UI-SPEC line 110.

**AccuracyTab.tsx (POL-02) — four overflow-x-auto wrappers added:**
1. `VersionHistoryTable` (~line 110): `<div className="overflow-x-auto">` wraps `<table className={TABLE_CLS}>`
2. `GwSummaryTable` (~line 358): `<div className="overflow-x-auto">` wraps outer `<table className={TABLE_CLS}>` (inner sub-tables in drill-down colSpan rows unchanged)
3. `HaulterList` (~line 528): `<div className="overflow-x-auto">` wraps `<table className={TABLE_CLS}>`
4. `PlayerDeltaTable` (~line 624): `<div className="overflow-x-auto">` wraps `<table className={TABLE_CLS}>`

Pattern mirrors `RivalsTab.tsx:96` and `ValueGemsTable.tsx:21`.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 67ec4ef | feat(077-01): add teamKitUrl helper to fpl-images.ts |
| 2 | ed53142 | feat(077-01): add kit image + fallback to LineupTab PlayerCard |
| 3 | 6cc66dc | feat(077-01): flex-wrap on captain row + overflow-x-auto on AccuracyTab tables |

## Deviations from Plan

None — plan executed exactly as written.

The CaptainPicksPanel verification (Task 3 Edit 2) confirmed that `flex-wrap` was already present in the `inline-flex` group at line 38, consistent with UI-SPEC line 110's documentation. No edit was required.

## Note for Plan 02 Executor

Kit images and overflow wrappers are now in place:
- `teamKitUrl` is exported from `src/lib/fpl-images.ts`
- PlayerCard in `LineupTab.tsx` renders kit image (or team-colour fallback) at 24px/28px
- All four AccuracyTab top-level tables have `overflow-x-auto` wrappers
- DecisionSummaryTab captain candidate rows have `sm:flex-wrap`

Plan 02's Playwright assertions at 430px viewport can now verify this baseline — `document.body.scrollWidth <= window.innerWidth` (no horizontal scroll) on AccuracyTab and other tabs.

## Known Stubs

None.

## Threat Flags

None — threat model analysed in PLAN.md. T-077-01 through T-077-05 all accepted/mitigated in implementation:
- Kit URL uses only public team_code (no user PII)
- teamCode is type-safe from TEAM_BADGE_CODE record (not user input)
- onError handler fires at most once per card via useState flag (no retry loop)

## Self-Check: PASSED

Files confirmed present:
- src/lib/fpl-images.ts: contains `export function teamKitUrl`
- src/components/squad/LineupTab.tsx: contains `teamKitUrl`
- src/components/squad/DecisionSummaryTab.tsx: contains `sm:flex-wrap`
- src/components/accuracy/AccuracyTab.tsx: 4 `overflow-x-auto` occurrences
- tests/lib/fpl-images.test.ts: created and passing

Commits confirmed:
- 67ec4ef feat(077-01): add teamKitUrl helper to fpl-images.ts
- ed53142 feat(077-01): add kit image + fallback to LineupTab PlayerCard
- 6cc66dc feat(077-01): flex-wrap on captain row + overflow-x-auto on AccuracyTab tables
